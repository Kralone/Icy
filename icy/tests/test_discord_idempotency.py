import asyncio
import os
import tempfile
import unittest
import discord
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

    def test_multiple_message_refs_survive_reopen_and_can_be_deleted_individually(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "links.sqlite3")
            first = DiscordLinkStore(path)
            first.add_message_ref("event_reminder_one_hour", "event-1", 123, 456)
            first.add_message_ref("event_reminder_one_hour", "event-1", 123, 789)

            reopened = DiscordLinkStore(path)
            self.assertEqual(
                [(123, 456), (123, 789)],
                [
                    (link.channel_id, link.message_id)
                    for link in reopened.get_message_refs(
                        "event_reminder_one_hour", "event-1"
                    )
                ],
            )

            reopened.delete_message_ref("event_reminder_one_hour", "event-1", 456)
            self.assertEqual(
                [789],
                [
                    link.message_id
                    for link in first.get_message_refs(
                        "event_reminder_one_hour", "event-1"
                    )
                ],
            )


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

    @patch.dict(
        os.environ,
        {"DISCORD_EVENTS_CHANNEL_ID": "123", "ICEFORGE_PUBLIC_URL": "https://iceforge.fr"},
        clear=False,
    )
    async def test_operation_event_embed_presents_context_and_deep_link(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            bot = MagicMock()
            channel = MagicMock(name="events")
            channel.name = "events"
            channel.send = AsyncMock(return_value=self._message())
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock()
            handler = EventHandler(bot, rabbit, store)

            await handler.handle_event_created(
                {
                    "id": "operation-1",
                    "title": "Convoy minier",
                    "description": "Briefing et objectifs du convoi.",
                    "date": "2026-10-12T20:30:00Z",
                    "activityType": "OPERATION",
                    "operation": {
                        "briefing": "Briefing opérationnel.",
                        "objectives": "Objectif Alpha",
                        "meetingPoint": "Port Olisar",
                        "imageUrl": "https://cdn.example.test/mission.png",
                    },
                    "author": "Amiral",
                    "type": {
                        "name": "Opération",
                        "color": "#1E90FF",
                        "imageUrl": "https://cdn.example.test/operation.png",
                    },
                    "participants": [],
                }
            )

            embed = channel.send.await_args.kwargs["embed"]
            self.assertEqual("Opération : Convoy minier", embed.title)
            self.assertIn("Briefing opérationnel.", embed.description)
            self.assertIn("Date :", embed.description)
            self.assertEqual("Créé par Amiral", embed.footer.text)
            self.assertEqual("https://cdn.example.test/mission.png", embed.image.url)
            self.assertEqual("Objectifs", embed.fields[4].name)
            self.assertEqual("Lieu", embed.fields[5].name)
            operation_field = next(field for field in embed.fields if field.name == "Opération")
            self.assertIn("https://iceforge.fr/icy/operations/operation-1", operation_field.value)
            self.assertEqual(
                "https://iceforge.fr/icy/operations/operation-1",
                channel.send.await_args.kwargs["view"].children[3].url,
            )

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

    @patch.dict(os.environ, {"DISCORD_NEWS_CHANNEL_ID": "123"}, clear=False)
    async def test_concurrent_news_deliveries_send_only_one_message(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            bot = MagicMock()
            channel = MagicMock()
            async def delayed_send(**kwargs):
                await asyncio.sleep(0)
                return self._message(654, 321)
            channel.send = AsyncMock(side_effect=delayed_send)
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock()
            handler = NewsHandler(bot, rabbit, store)
            payload = {"id": "news-concurrent", "type": {}}
            await asyncio.gather(handler._created(payload), handler._created(payload))
            channel.send.assert_awaited_once()
            self.assertEqual(2, rabbit.publish.await_count)

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_earlier_event_rebuilds_channel_in_chronological_order(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            store.save("event", "later", 123, 456, "2026-10-02T12:00:00+00:00")
            bot = MagicMock()
            channel = MagicMock()
            channel.id = 123
            old = self._message(456, 123)
            old.embeds = [discord.Embed(title="Later")]
            old.embeds[0].add_field(name="Opération", value="[Voir](https://iceforge.fr/icy/operations/later)")
            channel.fetch_message = AsyncMock(return_value=old)
            deleted = MagicMock()
            deleted.delete = AsyncMock()
            channel.get_partial_message.return_value = deleted
            first = self._message(900, 123)
            second = self._message(901, 123)
            channel.send = AsyncMock(side_effect=[first, second])
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock()
            handler = EventHandler(bot, rabbit, store)

            await handler.handle_event_created({
                "id": "earlier", "title": "Earlier", "date": "2026-10-01T12:00:00Z",
                "participants": [], "type": {},
            })

            self.assertEqual(["Événement : Earlier", "Later"], [call.kwargs["embed"].title for call in channel.send.await_args_list])
            self.assertEqual(3, len(channel.send.await_args_list[0].kwargs["view"].children))
            self.assertTrue(channel.send.await_args_list[1].kwargs["view"].children[3].url.endswith("/icy/operations/later"))
            deleted.delete.assert_awaited_once()
            self.assertEqual(2, rabbit.publish.await_count)

    def test_finished_event_is_excluded_until_reopened(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            store.save("event", "finished", 123, 456, "2026-09-20T20:00:00+00:00")
            store.finish_event("finished")
            self.assertEqual([], store.list_events(123))
            store.reopen_event("finished")
            self.assertEqual(["finished"], [event_id for event_id, _, _ in store.list_events(123)])

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_editing_finished_message_as_active_restores_buttons(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            store.save("event", "event-1", 123, 456, "2026-10-01T20:00:00+00:00")
            store.finish_event("event-1")
            bot = MagicMock()
            channel = MagicMock(id=123, name="events")
            message = self._message(456, 123)
            async def edit_message(**kwargs):
                message.embeds = [kwargs["embed"]]
            message.edit = AsyncMock(side_effect=edit_message)
            message.embeds = [discord.Embed(title="🧊 [TERMINÉ] Ancien")]
            channel.fetch_message = AsyncMock(return_value=message)
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock()
            handler = EventHandler(bot, rabbit, store)

            await handler.handle_event_updated({
                "id": "event-1", "channelId": 123, "messageId": 456,
                "activityType": "OPERATION",
                "operation": {
                    "briefing": "Briefing mis à jour.",
                    "objectives": "Objectif Bravo",
                    "meetingPoint": "New Babbage",
                    "imageUrl": "https://cdn.example.test/updated.png",
                },
                "title": "Actif", "date": "2026-10-01T20:00:00Z",
                "finished": False, "participants": [], "type": {},
            })

            self.assertFalse(store.is_event_finished("event-1"))
            self.assertIsNotNone(message.edit.await_args.kwargs["view"])
            self.assertTrue(message.edit.await_args.kwargs["view"].children[3].url.endswith("/icy/operations/event-1"))
            self.assertEqual("Opération", message.edit.await_args.kwargs["embed"].fields[3].name)
            self.assertIn("Briefing mis à jour.", message.edit.await_args.kwargs["embed"].description)
            self.assertEqual("Objectifs", message.edit.await_args.kwargs["embed"].fields[-2].name)
            self.assertEqual("Lieu", message.edit.await_args.kwargs["embed"].fields[-1].name)

    @patch.dict(os.environ, {"DISCORD_EVENTS_CHANNEL_ID": "123"}, clear=False)
    async def test_editing_event_date_reorders_active_messages(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DiscordLinkStore(os.path.join(directory, "links.sqlite3"))
            store.save("event", "earlier", 123, 200, "2026-10-02T20:00:00+00:00")
            store.save("event", "later", 123, 100, "2026-10-03T20:00:00+00:00")
            bot = MagicMock()
            channel = MagicMock(id=123, name="events")
            edited = self._message(200, 123)
            async def edit_edited(**kwargs):
                edited.embeds = [kwargs["embed"]]
            edited.edit = AsyncMock(side_effect=edit_edited)
            edited.embeds = [discord.Embed(title="Earlier")]
            later = self._message(100, 123)
            later.embeds = [discord.Embed(title="Later")]
            channel.fetch_message = AsyncMock(side_effect=[edited, edited, later])
            channel.send = AsyncMock(side_effect=[self._message(300, 123), self._message(301, 123)])
            partial = MagicMock()
            partial.delete = AsyncMock()
            channel.get_partial_message.return_value = partial
            bot.get_channel.return_value = channel
            rabbit = MagicMock()
            rabbit.publish = AsyncMock()
            handler = EventHandler(bot, rabbit, store)

            await handler.handle_event_updated({
                "id": "earlier", "channelId": 123, "messageId": 200,
                "activityType": "OPERATION",
                "title": "Earlier", "date": "2026-10-01T20:00:00Z",
                "finished": False, "participants": [], "type": {},
            })

            self.assertEqual(2, channel.send.await_count)
            self.assertEqual(["Événement : Earlier", "Later"], [call.kwargs["embed"].title for call in channel.send.await_args_list])
            self.assertTrue(channel.send.await_args_list[0].kwargs["view"].children[3].url.endswith("/icy/operations/earlier"))
            self.assertEqual(3, len(channel.send.await_args_list[1].kwargs["view"].children))


if __name__ == "__main__":
    unittest.main()
