import unittest
from unittest.mock import AsyncMock, MagicMock

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
    def test_operation_view_only_offers_the_deep_link(self):
        view = EventParticipationView(
            AsyncMock(),
            "operation-id",
            operation_url="https://iceforge.fr/icy/operations/operation-id",
        )

        self.assertEqual(["Consulter l’opération"], [item.label for item in view.children])
        self.assertEqual(
            "https://iceforge.fr/icy/operations/operation-id",
            view.children[0].url,
        )
        self.assertIsNone(view.children[0].custom_id)

    @staticmethod
    def _interaction(response=None, error=None, cog=True):
        interaction = AsyncMock()
        interaction.user.id = 123
        interaction.user.name = "member"
        api = MagicMock()
        api.api_request = AsyncMock(return_value=response, side_effect=error)
        interaction.client = MagicMock()
        interaction.client.get_cog.return_value = api if cog else None
        return interaction, api

    async def _reply(self, **kwargs):
        interaction, api = self._interaction(**kwargs)
        rabbit = AsyncMock()
        await EventParticipationView(rabbit, "event-id")._send_participation(interaction, 1)
        # La réponse ne passe plus par RabbitMQ : le bot attend le verdict du serveur.
        rabbit.publish.assert_not_awaited()
        interaction.followup.send.assert_awaited_once()
        self.assertTrue(interaction.followup.send.await_args.kwargs["ephemeral"])
        return interaction.followup.send.await_args.args[0], api

    async def test_success_is_confirmed_only_when_the_backend_recorded_the_answer(self):
        reply, api = await self._reply(response={"httpCode": 200, "outcome": "RECORDED"})

        self.assertEqual("✅ Votre choix a été enregistré !", reply)
        api.api_request.assert_awaited_once_with(
            "POST",
            "api/events/bot/participation",
            data={"eventId": "event-id", "discordUserId": "123", "username": "member", "status": 1},
        )

    async def test_an_unknown_or_inactive_account_gets_an_explicit_failure(self):
        reply, _ = await self._reply(response={"httpCode": 200, "outcome": "UNKNOWN_USER"})

        self.assertTrue(reply.startswith("❌"))
        self.assertIn("n'a pas été enregistré", reply)
        self.assertIn("compte Discord", reply)

    async def test_no_backend_verdict_is_never_reported_as_success(self):
        cases = [
            {"response": None},
            {"response": {"httpCode": 503}},
            {"response": {"httpCode": 400, "outcome": "RECORDED"}},
            {"response": {"httpCode": 200}},
            {"response": {"httpCode": 200, "outcome": "SOMETHING_NEW"}},
            {"response": {"httpCode": 200, "outcome": "EVENT_NOT_FOUND"}},
            {"response": {"httpCode": 200, "outcome": "NOT_PUBLISHED"}},
            {"response": {"httpCode": 200, "outcome": "OPERATION_CLOSED"}},
            {"cog": False},
        ]
        for case in cases:
            with self.subTest(case=case):
                if case.get("cog") is False:
                    with self.assertLogs("icy.event_handler", level="ERROR"):
                        reply, _ = await self._reply(**case)
                else:
                    reply, _ = await self._reply(**case)
                self.assertTrue(reply.startswith("❌"), reply)

    async def test_a_backend_error_is_not_reported_as_success_and_leaks_nothing(self):
        with self.assertLogs("icy.event_handler", level="ERROR") as logs:
            reply, _ = await self._reply(error=RuntimeError("backend unavailable with super-secret"))

        self.assertEqual("❌ Votre choix n'a pas pu être enregistré. Réessayez plus tard.", reply)
        self.assertNotIn("super-secret", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
