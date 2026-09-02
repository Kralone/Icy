import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from messaging.discord_link_store import DiscordLinkStore
from messaging.event_handler import EventHandler
from messaging.news_handler import NewsHandler


class DiscordLinkStoreTest(unittest.TestCase):
    def test_link_survives_store_reopen_and_can_be_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "links.sqlite3")
            first = DiscordLinkStore(path)
            first.save("event", "event-1", 123, 456)

            reopened = DiscordLinkStore(path)
            self.assertEqual(123, reopened.get("event", "event-1").channel_id)
            self.assertEqual(456, reopened.get("event", "event-1").message_id)

            reopened.delete("event", "event-1")
            self.assertIsNone(first.get("event", "event-1"))


class DiscordCreationIdempotencyTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _message(message_id=456, channel_id=123):
        message = MagicMock()
        message.id = message_id
        message.channel.id = channel_id
        return message

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_event_retry_reuses_message_when_backend_link_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            bot = MagicMock()
            channel = MagicMock()
            channel.name = "events"
            channel.send = AsyncMock(return_value=self._message())
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock(side_effect=[RuntimeError("backend down"), True])
            handler = EventHandler(bot, rabbit, store)
            payload = {"id": "event-1", "participants": [], "type": {}}

            with self.assertRaises(RuntimeError):
                await handler.handle_event_created(payload)
            await handler.handle_event_created(payload)

            channel.send.assert_awaited_once()
            self.assertEqual(2, rabbit.publish.await_count)
            linked = rabbit.publish.await_args.args[1]
            self.assertEqual(456, linked["messageId"])
            self.assertEqual(123, linked["channelId"])

    @patch.dict(os.environ, {"DISCORD_NEWS_CHANNEL_ID": "123"}, clear=False)
    async def test_news_retry_reuses_message_when_backend_link_failed(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            bot = MagicMock()
            channel = MagicMock()
            channel.name = "news"
            channel.send = AsyncMock(return_value=self._message(654, 321))
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock(side_effect=[RuntimeError("backend down"), True])
            handler = NewsHandler(bot, rabbit, store)
            payload = {"id": "news-1", "type": {}}

            with self.assertRaises(RuntimeError):
                await handler._created(payload)
            await handler._created(payload)

            channel.send.assert_awaited_once()
            self.assertEqual(2, rabbit.publish.await_count)
            linked = rabbit.publish.await_args.args[1]
            self.assertEqual(654, linked["messageId"])
            self.assertEqual(321, linked["channelId"])


if __name__ == "__main__":
    unittest.main()
