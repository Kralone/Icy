import importlib.util
import unittest
from pathlib import Path


class RemovedAttackSurfaceTest(unittest.TestCase):
    def test_legacy_password_http_server_is_absent(self):
        bot_root = Path(__file__).resolve().parents[1]

        self.assertFalse((bot_root / "utils" / "bot_api.py").exists())

    def test_broken_event_creation_cog_is_not_loadable(self):
        self.assertIsNone(importlib.util.find_spec("cogs.events"))


if __name__ == "__main__":
    unittest.main()
