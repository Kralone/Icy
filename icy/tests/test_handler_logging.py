import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from messaging.event_handler import EventHandler
from messaging.news_handler import NewsHandler
from messaging.scwe_handler import ScweHandler


class HandlerLoggingTest(unittest.IsolatedAsyncioTestCase):
    @patch.dict(os.environ, {"DISCORD_NEWS_CHANNEL_ID": "123"}, clear=False)
    async def test_news_error_does_not_log_exception_text(self):
        bot = MagicMock()
        channel = MagicMock()
        channel.fetch_message = AsyncMock(
            side_effect=RuntimeError("news super-secret")
        )
        bot.get_channel.return_value = channel
        handler = NewsHandler(bot)

        with self.assertLogs("icy.news_handler", level="WARNING") as logs:
            with self.assertRaises(RuntimeError):
                await handler._updated({"id": "news", "channelId": 123, "messageId": 456})

        self.assertNotIn("super-secret", "\n".join(logs.output))

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_event_error_does_not_log_exception_text(self):
        bot = MagicMock()
        channel = MagicMock()
        channel.fetch_message = AsyncMock(
            side_effect=RuntimeError("event super-secret")
        )
        bot.get_channel.return_value = channel
        handler = EventHandler(bot, AsyncMock())

        with self.assertLogs("icy.event_handler", level="ERROR") as logs:
            with self.assertRaises(RuntimeError):
                await handler.handle_event_deleted(
                    {"eventId": "event", "channelId": 123, "messageId": 456}
                )

        self.assertNotIn("super-secret", "\n".join(logs.output))

    @patch.dict(os.environ, {"DISCORD_NOTIFICATIONS_CHANNEL_ID": "123"}, clear=False)
    async def test_scwe_error_does_not_log_exception_text(self):
        bot = MagicMock()
        channel = MagicMock()
        channel.send = AsyncMock(side_effect=RuntimeError("scwe super-secret"))
        bot.get_channel.return_value = channel
        handler = ScweHandler(bot)

        with self.assertLogs("icy.scwe_handler", level="ERROR") as logs:
            with self.assertRaises(RuntimeError):
                await handler.handle_tier_passed({"category": "Test"})

        self.assertNotIn("super-secret", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
