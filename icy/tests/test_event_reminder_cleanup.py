import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

from messaging.discord_link_store import DiscordLinkStore
from messaging.event_handler import EventHandler


class EventReminderCleanupTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _sent_message(message_id: int, channel_id: int):
        message = MagicMock()
        message.id = message_id
        message.channel.id = channel_id
        return message

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_cleanup_uses_durable_refs_after_handler_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            channel = MagicMock()
            channel.send = AsyncMock(return_value=self._sent_message(456, 123))
            reminder = MagicMock()
            reminder.delete = AsyncMock()
            channel.fetch_message = AsyncMock(return_value=reminder)
            bot = MagicMock()
            bot.get_channel.return_value = channel

            first = EventHandler(bot, AsyncMock(), store)
            await first.handle_reminder_one_hour(
                {
                    "eventId": "event-1",
                    "title": "Test",
                    "participants": [{"username": "User", "status": 1}],
                }
            )

            restarted = EventHandler(bot, AsyncMock(), store)
            await restarted.cleanup_event_notifications({"id": "event-1"})

            reminder.delete.assert_awaited_once()
            self.assertEqual(
                [], store.get_message_refs("event_reminder_one_hour", "event-1")
            )

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_failed_cleanup_keeps_ref_for_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            store.add_message_ref("event_reminder_one_hour", "event-1", 123, 456)
            channel = MagicMock()
            channel.fetch_message = AsyncMock(side_effect=discord.HTTPException(MagicMock(), "down"))
            bot = MagicMock()
            bot.get_channel.return_value = channel
            handler = EventHandler(bot, AsyncMock(), store)

            with self.assertRaises(RuntimeError):
                await handler.cleanup_event_notifications({"id": "event-1"})

            self.assertEqual(
                [456],
                [
                    link.message_id
                    for link in store.get_message_refs(
                        "event_reminder_one_hour", "event-1"
                    )
                ],
            )

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_deleted_event_cleans_reminder_without_main_message_ids(self):
        handler = EventHandler(MagicMock(), AsyncMock())
        handler.cleanup_event_notifications = AsyncMock()

        await handler.handle_event_deleted({"eventId": "event-1"})

        handler.cleanup_event_notifications.assert_awaited_once()

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_ended_event_cleans_reminder_when_main_message_is_missing(self):
        channel = MagicMock()
        channel.fetch_message = AsyncMock(side_effect=discord.NotFound(MagicMock(), "missing"))
        bot = MagicMock()
        bot.get_channel.return_value = channel
        handler = EventHandler(bot, AsyncMock())
        handler.cleanup_event_notifications = AsyncMock()

        await handler.handle_event_ended(
            {"id": "event-1", "channelId": 123, "messageId": 999}
        )

        handler.cleanup_event_notifications.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
