"""Hermetic tests: synthetic keys only; never reads production initialization files."""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "production/vault/vault-recovery.py"
spec = importlib.util.spec_from_file_location("vault_recovery", SOURCE)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
KEY = base64.b64encode(bytes(range(32))).decode()


class VaultRecoveryTests(unittest.TestCase):
    def test_accepts_single_key_and_multishare_base64_and_hex(self):
        for size in (32, 33):
            raw = bytes(range(size))
            self.assertTrue(recovery.valid_key(base64.b64encode(raw).decode()))
            self.assertTrue(recovery.valid_key(raw.hex()))
        self.assertFalse(recovery.valid_key(base64.b64encode(bytes(34)).decode()))

    def run_main(self, action, state, stdin=""):
        output = io.StringIO()
        with patch("sys.argv", [str(SOURCE), action]), patch("os.geteuid", return_value=0), \
                patch("sys.stdin", io.StringIO(stdin)), contextlib.redirect_stdout(output), \
                patch.object(recovery, "vault_request", side_effect=state) as request:
            recovery.main()
        return output.getvalue(), request

    def test_unseal_only_posts_operator_input_and_outputs_allowlisted_status(self):
        closed = {"initialized": True, "sealed": True, "t": 1, "progress": 0}
        opened = {**closed, "sealed": False, "key": KEY, "root_token": "must-never-leak"}
        output, request = self.run_main("unseal", [closed, opened], json.dumps({"key": KEY}))
        self.assertEqual(request.call_args_list[1].args, ("iceforge_vault", "unseal", {"key": KEY}))
        self.assertFalse(json.loads(output)["sealed"])
        self.assertNotIn(KEY, output)
        self.assertNotIn("must-never-leak", output)

    def test_already_open_does_not_consume_or_submit_key(self):
        output, request = self.run_main("unseal", [{"initialized": True, "sealed": False}])
        self.assertFalse(json.loads(output)["sealed"])
        self.assertEqual(request.call_count, 1)

    def test_partial_threshold_is_reported_without_reset_or_extra_attempts(self):
        closed = {"initialized": True, "sealed": True, "t": 3, "progress": 1}
        output, request = self.run_main("unseal", [closed, {**closed, "progress": 2}], json.dumps({"key": KEY}))
        self.assertTrue(json.loads(output)["sealed"])
        self.assertEqual(json.loads(output)["progress"], 2)
        self.assertEqual(request.call_count, 2)

    def test_bad_key_or_root_token_is_rejected_before_post(self):
        for value in ("hvs.not-an-unseal-key", "", None, 42):
            with self.assertRaises(RuntimeError):
                self.run_main("unseal", [{"initialized": True, "sealed": True}], json.dumps({"key": value}))

    def test_uninitialized_vault_is_never_initialized(self):
        with self.assertRaises(RuntimeError):
            self.run_main("unseal", [{"initialized": False, "sealed": True}])

    def test_saved_key_only_and_file_protection(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "init.json"
            path.write_text(json.dumps({"unseal_keys_b64": [KEY], "root_token": "do-not-return"}))
            path.chmod(0o600)
            self.assertEqual(recovery.read_saved_key(path), KEY)
            path.chmod(0o644)
            with self.assertRaises(RuntimeError):
                recovery.read_saved_key(path)
            link = Path(folder) / "link.json"
            link.symlink_to(path)
            with self.assertRaises(OSError):
                recovery.read_saved_key(link)

    def test_secret_is_only_on_stdin_of_http_client(self):
        result = subprocess.CompletedProcess([], 0, '{"sealed":false}', "")
        with patch("subprocess.run", return_value=result) as run:
            recovery.vault_request("iceforge_vault", "unseal", {"key": KEY})
        self.assertNotIn(KEY, " ".join(run.call_args.args[0]))
        self.assertEqual(json.loads(run.call_args.kwargs["input"]), {"key": KEY})
        self.assertTrue(run.call_args.kwargs["capture_output"])

    def test_http_errors_are_not_echoed_with_potential_secret_body(self):
        result = subprocess.CompletedProcess([], 1, KEY, "secret-error-" + KEY)
        with patch("subprocess.run", return_value=result):
            with self.assertRaises(RuntimeError) as error:
                recovery.vault_request("iceforge_vault", "unseal", {"key": KEY})
        self.assertNotIn(KEY, str(error.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
