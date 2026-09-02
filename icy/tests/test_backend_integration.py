import os
import unittest

import aiohttp


@unittest.skipUnless(
    os.getenv("BACKEND_TEST_URL") and os.getenv("BOT_API_KEY"),
    "BACKEND_TEST_URL and BOT_API_KEY are required for backend integration tests",
)
class BackendBotAuthenticationIntegrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_bot_key_reaches_dedicated_bot_endpoint(self):
        base_url = os.environ["BACKEND_TEST_URL"].rstrip("/")
        headers = {"Authorization": f"Bot {os.environ['BOT_API_KEY']}"}

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{base_url}/api/user-ships/bot",
                params={"discordId": "9223372036854775000"},
                headers=headers,
            ) as response:
                # The synthetic Discord user need not exist. A 404 proves that
                # authentication passed; 401/403 means the bot contract broke.
                self.assertNotIn(response.status, {401, 403})

    async def test_invalid_bot_key_is_rejected(self):
        base_url = os.environ["BACKEND_TEST_URL"].rstrip("/")
        headers = {"Authorization": "Bot deliberately-invalid-test-key"}

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{base_url}/api/user-ships/bot",
                params={"discordId": "9223372036854775000"},
                headers=headers,
            ) as response:
                self.assertIn(response.status, {401, 403})


if __name__ == "__main__":
    unittest.main()
