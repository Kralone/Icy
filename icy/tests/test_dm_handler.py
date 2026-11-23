import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import discord

from messaging.dm_handler import RESULT_KEY, DirectMessageHandler, DmDeliveryLedger, build_embed, media_path
from messaging.message_handler import MessageHandler


def http_error(error_type, status, code):
    response = MagicMock()
    response.status = status
    response.reason = "error"
    return error_type(response, {"code": code, "message": "refused"})


def payload(**overrides):
    value = {
        "deliveryId": "6f0c8f0e-6d3c-4f0e-9b7a-111111111111",
        "discordId": "190174996235026433",
        "origin": "REMINDER",
        "reference": "42",
        "content": "Hello Vexa ! 👋",
    }
    value.update(overrides)
    return value


class DirectMessageHandlerTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ledger = DmDeliveryLedger(os.path.join(self.tmp.name, "ledger.sqlite3"))
        self.bot = MagicMock()
        self.user = MagicMock()
        self.user.send = AsyncMock()
        self.bot.fetch_user = AsyncMock(return_value=self.user)
        self.rabbit = MagicMock()
        self.rabbit.publish = AsyncMock()
        self.handler = DirectMessageHandler(self.bot, self.rabbit, self.ledger)

    def reported(self):
        routing_key, body = self.rabbit.publish.await_args.args
        self.assertEqual(RESULT_KEY, routing_key)
        return body

    async def test_sends_the_text_without_any_mention_and_reports_it(self):
        await self.handler.handle("dm.send", payload())

        self.bot.fetch_user.assert_awaited_once_with(190174996235026433)
        kwargs = self.user.send.await_args.kwargs
        self.assertEqual("Hello Vexa ! 👋", kwargs["content"])
        self.assertFalse(kwargs["allowed_mentions"].everyone)
        self.assertFalse(kwargs["allowed_mentions"].users)
        self.assertEqual({"deliveryId": payload()["deliveryId"], "origin": "REMINDER", "reference": "42", "status": "SENT", "reason": None}, self.reported())

    async def test_a_retry_never_sends_the_same_message_twice(self):
        await self.handler.handle("dm.send", payload())
        await self.handler.handle("dm.send", payload())

        self.user.send.assert_awaited_once()
        self.assertEqual(2, self.rabbit.publish.await_count)
        self.assertEqual("SENT", self.reported()["status"])

    async def test_two_simultaneous_deliveries_send_only_once(self):
        release = asyncio.Event()

        async def slow_send(**kwargs):
            await release.wait()

        self.user.send.side_effect = slow_send
        first = asyncio.create_task(self.handler.handle("dm.send", payload()))
        await asyncio.sleep(0)
        await self.handler.handle("dm.send", payload())
        release.set()
        await first

        self.user.send.assert_awaited_once()
        self.rabbit.publish.assert_awaited_once()
        self.assertEqual("SENT", self.reported()["status"])

    async def test_closed_private_messages_are_reported_as_such(self):
        self.user.send.side_effect = http_error(discord.Forbidden, 403, 50007)

        await self.handler.handle("dm.send", payload())

        self.assertEqual(("FAILED", "dm_closed"), (self.reported()["status"], self.reported()["reason"]))

    async def test_unknown_discord_account_is_reported(self):
        self.bot.fetch_user.side_effect = http_error(discord.NotFound, 404, 10013)

        await self.handler.handle("dm.send", payload())

        self.assertEqual("user_not_found", self.reported()["reason"])

    async def test_discord_outage_is_retried_by_rabbitmq(self):
        self.user.send.side_effect = http_error(discord.HTTPException, 503, 0)

        with self.assertRaises(discord.HTTPException):
            await self.handler.handle("dm.send", payload())

        self.rabbit.publish.assert_not_awaited()
        self.assertIsNone(self.ledger.get(payload()["deliveryId"]))

    async def test_embed_replaces_plain_text_when_given(self):
        await self.handler.handle("dm.send", payload(content=None, embed={"title": "Avertissement", "description": "Retard", "color": 0xF87171, "footer": "IceForge"}))

        embed = self.user.send.await_args.kwargs["embed"]
        self.assertEqual("Avertissement", embed.title)
        self.assertEqual(0xF87171, embed.color.value)
        self.assertIsNone(self.user.send.await_args.kwargs["content"])

    async def test_attaches_the_gif_from_the_image_library(self):
        media_dir = Path(self.tmp.name) / "media"
        media_dir.mkdir()
        (media_dir / "rappel-inactivite.gif").write_bytes(b"GIF89a....")

        with patch.dict(os.environ, {"BOT_MEDIA_DIR": str(media_dir)}):
            await self.handler.handle("dm.send", payload(mediaFile="rappel-inactivite.gif"))

        files = self.user.send.await_args.kwargs["files"]
        self.assertEqual("rappel-inactivite.gif", files[0].filename)
        self.assertEqual("SENT", self.reported()["status"])

    async def test_missing_gif_still_sends_the_text_and_says_so(self):
        with patch.dict(os.environ, {"BOT_MEDIA_DIR": self.tmp.name}):
            await self.handler.handle("dm.send", payload(mediaFile="absent.gif"))

        self.user.send.assert_awaited_once()
        self.assertEqual(("SENT", "media_missing"), (self.reported()["status"], self.reported()["reason"]))

    async def test_invalid_discord_id_is_reported_without_calling_discord(self):
        await self.handler.handle("dm.send", payload(discordId="@everyone"))

        self.bot.fetch_user.assert_not_awaited()
        self.assertEqual("invalid_discord_id", self.reported()["reason"])


class MediaPathTest(unittest.TestCase):
    def test_refuses_paths_and_hidden_files(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {"BOT_MEDIA_DIR": root}):
            Path(root, "ok.gif").write_bytes(b"GIF89a")
            self.assertIsNotNone(media_path("ok.gif"))
            for name in ["../etc/passwd", "/etc/passwd", ".env", "sub/ok.gif", "", None, 12]:
                self.assertIsNone(media_path(name), name)

    def test_no_embed_without_data(self):
        self.assertIsNone(build_embed({"content": "x"}))


class DispatchTest(unittest.IsolatedAsyncioTestCase):
    async def test_dm_keys_reach_the_direct_message_handler(self):
        bot = MagicMock()
        bot.is_ready.return_value = True
        dispatcher = MessageHandler(bot, None, None)
        dispatcher.dm_handler.handle = AsyncMock()

        await dispatcher.handle_message("dm.send", payload())

        dispatcher.dm_handler.handle.assert_awaited_once()
