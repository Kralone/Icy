import os
import unittest
from unittest.mock import patch

from cogs.api_client import APIClient


class APIClientConfigurationTest(unittest.TestCase):
    @patch.dict(os.environ, {"BOT_API_KEY": "test-only-key"}, clear=False)
    def test_uses_bot_api_key_from_environment(self):
        client = APIClient(object())

        self.assertEqual("Bot test-only-key", client.default_headers["Authorization"])
        self.assertEqual("http://backend:8080", client.api_base_url)

    @patch.dict(os.environ, {}, clear=True)
    def test_rejects_missing_bot_api_key(self):
        with self.assertRaisesRegex(RuntimeError, "BOT_API_KEY"):
            APIClient(object())


if __name__ == "__main__":
    unittest.main()
