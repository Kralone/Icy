"""Real local Vault lifecycle; never contacts the production server."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument("--docker", default="docker")
args = parser.parse_args()
os.environ["DOCKER_CONTEXT"] = "desktop-linux"
os.environ["PATH"] = str(Path(args.docker).resolve().parent) + os.pathsep + os.environ["PATH"]
source = Path(__file__).resolve().parents[1] / "production/vault/vault-recovery.py"
spec = importlib.util.spec_from_file_location("vault_recovery", source)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
name = "iceforge-vault-recovery-test-" + uuid.uuid4().hex[:10]


def docker(*arguments):
    result = subprocess.run([args.docker, *arguments], capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise RuntimeError("Local Docker test command failed; output suppressed to protect temporary keys.")
    return result.stdout


config = {"storage": {"file": {"path": "/vault/file"}},
          "listener": {"tcp": {"address": "127.0.0.1:8200", "tls_disable": True}}, "disable_mlock": True}
started = False
try:
    docker("run", "-d", "--rm", "--network", "none", "--name", name,
           "-e", "VAULT_LOCAL_CONFIG=" + json.dumps(config), "hashicorp/vault:1.17.6", "server")
    started = True
    for attempt in range(30):
        try:
            state = recovery.vault_request(name, "seal-status")
            break
        except RuntimeError:
            time.sleep(0.5)
    else:
        raise RuntimeError("Local Vault did not start.")
    initialized = json.loads(docker("exec", name, "vault", "operator", "init",
                                   "-address=http://127.0.0.1:8200", "-key-shares=3", "-key-threshold=2", "-format=json"))
    keys = initialized["unseal_keys_b64"]
    assert len(keys) == 3 and all(recovery.valid_key(key) for key in keys)
    assert recovery.vault_request(name, "seal-status")["sealed"] is True
    partial = recovery.vault_request(name, "unseal", {"key": keys[0]})
    assert partial["sealed"] is True and partial["progress"] == 1
    opened = recovery.vault_request(name, "unseal", {"key": keys[1]})
    assert opened["sealed"] is False
    docker("restart", name)
    for attempt in range(30):
        try:
            state = recovery.vault_request(name, "seal-status")
            break
        except RuntimeError:
            time.sleep(0.5)
    assert state["initialized"] is True and state["sealed"] is True
    assert recovery.vault_request(name, "unseal", {"key": keys[0]})["sealed"] is True
    assert recovery.vault_request(name, "unseal", {"key": keys[1]})["sealed"] is False
    print("VAULT-RECOVERY-LIVE=OK (real 2/3 shares, stdin HTTP, restart, unseal again; no secrets printed)")
finally:
    if started:
        docker("rm", "-f", name)
