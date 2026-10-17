import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

from messaging.message_handler import MessageHandler
from messaging.mining_handler import MiningHandler, build_message


def ready_payload(**overrides):
    payload = {
        "sheetId": "11111111-1111-1111-1111-111111111111",
        "sheetName": "Quanta du jeudi",
        "path": "/icy/outils/fiches-minage/11111111-1111-1111-1111-111111111111",
        "title": "Raffinage prêt · Quanta du jeudi",
        "description": "Ton raffinage à CRU-L1 est prêt : 14,8 SCU de Laranite. À remettre à Vexa.",
        "lines": [],
        "mentionDiscordIds": ["190174996235026433"],
    }
    payload.update(overrides)
    return payload


class MiningMessageTest(unittest.TestCase):
    def test_mentions_only_valid_discord_ids_and_links_to_the_sheet(self):
        with patch.dict(os.environ, {"ICEFORGE_PUBLIC_URL": "https://staging.iceforge.test"}):
            content, embed = build_message("mining.order_ready", ready_payload(mentionDiscordIds=["190174996235026433", "@everyone", "<@&123>"]))

        self.assertEqual(content, "<@190174996235026433>")
        self.assertEqual(embed.url, "https://staging.iceforge.test/icy/outils/fiches-minage/11111111-1111-1111-1111-111111111111")
        self.assertIn("Laranite", embed.description)

    def test_lists_transfers_under_the_description(self):
        _, embed = build_message("mining.settled", ready_payload(lines=["Kralone verse 440 000 aUEC à Torin"], mentionDiscordIds=[]))

        self.assertIn("• Kralone verse 440 000 aUEC à Torin", embed.description)

    def test_no_mention_gives_no_content(self):
        content, _ = build_message("mining.reopened", ready_payload(mentionDiscordIds=[]))

        self.assertIsNone(content)

    def test_long_text_is_truncated_not_refused(self):
        _, embed = build_message("mining.all_ready", ready_payload(title="x" * 400, description="y" * 5000))

        self.assertLessEqual(len(embed.title), 256)
        self.assertLessEqual(len(embed.description), 4096)


class MiningHandlerTest(unittest.IsolatedAsyncioTestCase):
    async def test_sends_to_the_notifications_channel_without_mass_mentions(self):
        channel = MagicMock()
        channel.send = AsyncMock()
        bot = MagicMock()
        bot.get_channel.return_value = channel
        with patch.dict(os.environ, {"DISCORD_NOTIFICATIONS_CHANNEL_ID": "424242"}):
            handler = MiningHandler(bot)
        await handler.handle("mining.order_ready", ready_payload())

        bot.get_channel.assert_called_once_with(424242)
        kwargs = channel.send.await_args.kwargs
        self.assertEqual(kwargs["content"], "<@190174996235026433>")
        self.assertFalse(kwargs["allowed_mentions"].everyone)
        self.assertFalse(kwargs["allowed_mentions"].roles)

    async def test_missing_channel_raises_so_the_message_is_retried(self):
        bot = MagicMock()
        bot.get_channel.return_value = None
        with patch.dict(os.environ, {"DISCORD_NOTIFICATIONS_CHANNEL_ID": "424242"}):
            handler = MiningHandler(bot)

        with self.assertRaises(RuntimeError):
            await handler.handle("mining.order_ready", ready_payload())

    async def test_unknown_key_is_ignored(self):
        bot = MagicMock()
        handler = MiningHandler(bot)
        await handler.handle("mining.unknown", ready_payload())

        bot.get_channel.assert_not_called()

    async def test_dispatcher_routes_mining_keys(self):
        bot = MagicMock()
        bot.is_ready.return_value = True
        dispatcher = MessageHandler(bot, None, None)
        dispatcher.mining_handler.handle = AsyncMock()

        await dispatcher.handle_message("mining.settled", ready_payload())

        dispatcher.mining_handler.handle.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
