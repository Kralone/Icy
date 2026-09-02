import unittest
from unittest.mock import AsyncMock

from messaging.user_handler import UserHandler


class UserHandlerTest(unittest.IsolatedAsyncioTestCase):
    async def test_password_reset_sends_private_message(self):
        bot = AsyncMock()
        user = AsyncMock()
        bot.fetch_user.return_value = user
        handler = UserHandler(bot)

        await handler.handle(
            "users.password_reset",
            {"discordId": "123456789", "tempPassword": "one-time-password"},
        )

        bot.fetch_user.assert_awaited_once_with(123456789)
        sent_message = user.send.await_args.args[0]
        self.assertIn("one-time-password", sent_message)

    async def test_missing_password_is_rejected_without_discord_call(self):
        bot = AsyncMock()
        handler = UserHandler(bot)

        await handler.handle("users.password_reset", {"discordId": "123456789"})

        bot.fetch_user.assert_not_awaited()

    async def test_invalid_discord_id_is_rejected_without_discord_call(self):
        bot = AsyncMock()
        handler = UserHandler(bot)

        await handler.handle(
            "users.password_reset",
            {"discordId": "not-an-id", "tempPassword": "secret"},
        )

        bot.fetch_user.assert_not_awaited()

    async def test_discord_error_log_does_not_expose_password(self):
        bot = AsyncMock()
        bot.fetch_user.side_effect = RuntimeError("failed with super-secret-password")
        handler = UserHandler(bot)

        with self.assertLogs("icy.user", level="ERROR") as captured:
            with self.assertRaises(RuntimeError):
                await handler.handle(
                    "users.password_reset",
                    {"discordId": "123456789", "tempPassword": "super-secret-password"},
                )

        self.assertNotIn("super-secret-password", "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
