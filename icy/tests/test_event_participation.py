import unittest
from unittest.mock import AsyncMock

from messaging.event_handler import EventParticipationView, is_supported_discord_image_url


class DiscordEventImageUrlTest(unittest.TestCase):
    def test_accepts_absolute_http_urls(self):
        self.assertTrue(is_supported_discord_image_url("https://cdn.example.test/event.png"))
        self.assertTrue(is_supported_discord_image_url("http://example.test/event.png"))

    def test_rejects_relative_or_non_http_urls(self):
        for value in ("/assets/event.png", "event.png", "file:///event.png", "", None):
            with self.subTest(value=value):
                self.assertFalse(is_supported_discord_image_url(value))


class EventParticipationViewTest(unittest.IsolatedAsyncioTestCase):
    async def test_publish_success_is_confirmed_to_user(self):
        rabbit = AsyncMock()
        rabbit.publish.return_value = True
        interaction = AsyncMock()
        interaction.user.id = 123
        interaction.user.name = "member"
        view = EventParticipationView(rabbit, "event-id")

        await view._send_participation(interaction, 1)

        interaction.followup.send.assert_awaited_once_with(
            "✅ Votre choix a été enregistré !", ephemeral=True
        )

    async def test_publish_failure_is_not_reported_as_success(self):
        rabbit = AsyncMock()
        rabbit.publish.side_effect = RuntimeError("broker unavailable with super-secret")
        interaction = AsyncMock()
        interaction.user.id = 123
        interaction.user.name = "member"
        view = EventParticipationView(rabbit, "event-id")

        with self.assertLogs("icy.event_handler", level="ERROR") as logs:
            await view._send_participation(interaction, 1)

        interaction.followup.send.assert_awaited_once_with(
            "❌ Votre choix n'a pas pu être enregistré. Réessayez plus tard.",
            ephemeral=True,
        )
        self.assertNotIn("super-secret", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
