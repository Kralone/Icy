import json
import unittest
from unittest.mock import AsyncMock, MagicMock

import discord

from messaging.event_handler import (
    EMBED_DESCRIPTION_LIMIT,
    EMBED_FIELD_LIMIT,
    EMBED_TOTAL_LIMIT,
    EventHandler,
    EventParticipationView,
    format_objectives,
    format_schedule,
    truncate_lines,
    truncate_text,
)
from messaging.rabbit_manager import (
    FAILURE_REASON_HEADER,
    RabbitManager,
    is_permanent_failure,
)


def operation_payload(**overrides):
    payload = {
        "id": "11111111-1111-1111-1111-111111111111",
        "title": "Escorte Nyx",
        "description": "Description de l'événement.",
        "date": "2026-11-20T20:30:00",
        "endDate": "2026-11-20T23:30:00",
        "activityType": "OPERATION",
        "author": "Amiral",
        "type": {"name": "Opération", "color": "#1E90FF", "imageUrl": "https://cdn.example.test/type.png"},
        "operation": {
            "briefing": "<p>Escorte d'un convoi vers <b>Nyx</b>.</p>",
            "objectives": json.dumps(
                [
                    {"kind": "PRINCIPAL", "text": "Protéger le convoi"},
                    {"kind": "SECONDAIRE", "text": "Cartographier le point de saut"},
                    {"kind": "PRINCIPAL", "text": "Atteindre Nyx"},
                ]
            ),
            "meetingPoint": "Port Tressler",
            "imageUrl": "https://cdn.example.test/mission.png",
        },
        "participants": [{"username": "Kael", "status": 1}, {"username": "Mira", "status": 0}],
    }
    payload.update(overrides)
    return payload


def handler():
    return EventHandler(MagicMock(), MagicMock(), None)


class OperationAnnouncementTest(unittest.TestCase):
    def test_announcement_shows_name_type_schedule_place_and_readable_objectives(self):
        embed, url = handler()._build_event_embed("11111111-1111-1111-1111-111111111111", operation_payload())

        self.assertEqual("Opération : Escorte Nyx", embed.title)
        self.assertIn("Vendredi 20 novembre 2026 à 20h30 → 23h30", embed.description)
        self.assertIn("Escorte d'un convoi vers **Nyx**.", embed.description)
        fields = {field.name: field.value for field in embed.fields}
        self.assertEqual("Port Tressler", fields["Lieu"])
        self.assertEqual(
            "**Principaux**\n• Protéger le convoi\n• Atteindre Nyx\n**Secondaires**\n• Cartographier le point de saut",
            fields["Objectifs"],
        )
        # Jamais de JSON brut dans l'annonce.
        self.assertNotIn("{", fields["Objectifs"])
        self.assertNotIn("PRINCIPAL", fields["Objectifs"])
        self.assertEqual("https://iceforge.fr/icy/operations/11111111-1111-1111-1111-111111111111", url)
        self.assertIn(url, fields["Opération"])
        self.assertEqual("https://cdn.example.test/mission.png", embed.image.url)

    def test_legacy_free_text_objectives_are_kept_as_text(self):
        self.assertEqual("Objectif Alpha", format_objectives("Objectif Alpha"))
        self.assertEqual("", format_objectives(None))
        self.assertEqual("", format_objectives("[]"))

    def test_a_long_briefing_is_summarised_and_every_discord_limit_is_respected(self):
        long_objectives = json.dumps([{"kind": "PRINCIPAL", "text": f"Objectif numéro {index} " + "x" * 150} for index in range(40)])
        payload = operation_payload(
            title="T" * 400,
            participants=[{"username": f"Pilote-{index:03d}-" + "n" * 20, "status": 1} for index in range(120)],
        )
        payload["operation"]["briefing"] = "Mot " * 20000
        payload["operation"]["objectives"] = long_objectives
        payload["operation"]["meetingPoint"] = "L" * 3000

        embed, _ = handler()._build_event_embed(payload["id"], payload)

        self.assertLessEqual(len(embed.title), 256)
        self.assertLessEqual(len(embed.description), EMBED_DESCRIPTION_LIMIT)
        self.assertLess(len(embed.description), 1100)
        self.assertIn("Suite sur la fiche de l’opération.", embed.description)
        for field in embed.fields:
            self.assertLessEqual(len(field.value), EMBED_FIELD_LIMIT, field.name)
            self.assertTrue(field.value, field.name)
        self.assertLessEqual(len(embed), EMBED_TOTAL_LIMIT)
        confirmed = next(field.value for field in embed.fields if "Confirmés" in field.name)
        self.assertIn("autre(s)", confirmed)
        objectives = next(field.value for field in embed.fields if field.name == "Objectifs")
        self.assertIn("suite sur la fiche", objectives)

    def test_schedule_handles_a_missing_end_and_an_end_on_another_day(self):
        self.assertEqual("Vendredi 20 novembre 2026 à 20h30", format_schedule("2026-11-20T20:30:00", None))
        self.assertEqual(
            "Vendredi 20 novembre 2026 à 20h30 → Samedi 21 novembre 2026 à 01h00",
            format_schedule("2026-11-20T20:30:00", "2026-11-21T01:00:00"),
        )

    def test_a_classic_event_keeps_its_announcement_and_its_buttons(self):
        payload = {
            "id": "22222222-2222-2222-2222-222222222222",
            "title": "Soirée minage",
            "description": "Sortie détente.",
            "date": "2026-11-20T20:30:00",
            "endDate": "2026-11-20T23:30:00",
            "activityType": "EVENT",
            "author": "Amiral",
            "type": {"name": "Minage"},
            "participants": [],
        }
        embed, url = handler()._build_event_embed(payload["id"], payload)

        self.assertIsNone(url)
        self.assertEqual("Minage : Soirée minage", embed.title)
        self.assertEqual("📅 **Date :** Vendredi 20 novembre 2026 à 20h30\n\n💬 Sortie détente.", embed.description)
        self.assertEqual(["✅ Confirmés", "❔ Peut-être", "❌ Refusés"], [field.name for field in embed.fields])
        view = EventParticipationView(AsyncMock(), payload["id"])
        self.assertEqual(["Présent ✅", "Peut-être ❔", "Absent ❌"], [item.label for item in view.children])

    def test_operation_buttons_keep_their_identifiers(self):
        view = EventParticipationView(AsyncMock(), "op", operation_url="https://iceforge.fr/icy/operations/op")

        self.assertEqual(["Présent", "Peut-être", "Indisponible", "Consulter l’opération"], [item.label for item in view.children])
        self.assertEqual(["event:op:1", "event:op:0", "event:op:-1"], [item.custom_id for item in view.children[:3]])

    def test_truncation_helpers(self):
        self.assertEqual("court", truncate_text("court", 10))
        self.assertLessEqual(len(truncate_text("mot " * 100, 50)), 50)
        self.assertEqual("a\nb", truncate_lines(["a", "b"], 100, "… et {count} autre(s)"))
        shortened = truncate_lines([f"ligne {index}" for index in range(50)], 60, "… et {count} autre(s)")
        self.assertLessEqual(len(shortened), 60)
        self.assertTrue(shortened.endswith("autre(s)"))


class OperationAnnouncementUpdateTest(unittest.IsolatedAsyncioTestCase):
    async def test_an_update_edits_the_existing_message_and_never_posts_a_new_one(self):
        bot = MagicMock()
        channel = MagicMock()
        channel.name = "events"
        channel.send = AsyncMock()
        message = MagicMock()
        message.id = 555
        message.channel.id = 42
        message.edit = AsyncMock()
        channel.fetch_message = AsyncMock(return_value=message)
        bot.get_channel.return_value = channel
        event_handler = EventHandler(bot, MagicMock(), None)

        payload = operation_payload(channelId="42", messageId="555")
        payload["operation"]["meetingPoint"] = "Area18"
        await event_handler.handle_event_updated(payload)

        channel.send.assert_not_awaited()
        message.edit.assert_awaited_once()
        embed = message.edit.await_args.kwargs["embed"]
        self.assertEqual("Area18", next(field.value for field in embed.fields if field.name == "Lieu"))
        self.assertEqual("Consulter l’opération", message.edit.await_args.kwargs["view"].children[3].label)

    async def test_a_deleted_discord_message_is_acknowledged_without_error(self):
        bot = MagicMock()
        channel = MagicMock()
        channel.send = AsyncMock()
        response = MagicMock()
        response.status = 404
        channel.fetch_message = AsyncMock(side_effect=discord.NotFound(response, "inconnu"))
        bot.get_channel.return_value = channel
        event_handler = EventHandler(bot, MagicMock(), None)

        await event_handler.handle_event_updated(operation_payload(channelId="42", messageId="555"))

        channel.send.assert_not_awaited()


class PermanentFailureTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _http_error(status):
        response = MagicMock()
        response.status = status
        return discord.HTTPException(response, "refus")

    def test_classification(self):
        self.assertTrue(is_permanent_failure(ValueError("charge invalide")))
        self.assertTrue(is_permanent_failure(KeyError("id")))
        self.assertTrue(is_permanent_failure(self._http_error(400)))
        self.assertTrue(is_permanent_failure(self._http_error(403)))
        self.assertFalse(is_permanent_failure(self._http_error(429)))
        self.assertFalse(is_permanent_failure(self._http_error(503)))
        self.assertFalse(is_permanent_failure(RuntimeError("Discord indisponible")))

    async def test_a_permanent_failure_goes_straight_to_the_dead_letter_queue(self):
        manager = RabbitManager("amqp://guest:guest@localhost/", MagicMock())
        manager.retry_exchange = MagicMock()
        manager.retry_exchange.publish = AsyncMock()
        manager.dead_letter_exchange = MagicMock()
        manager.dead_letter_exchange.publish = AsyncMock()
        manager.handler = MagicMock()
        manager.handler.handle_message = AsyncMock(side_effect=self._http_error(400))
        message = MagicMock()
        message.routing_key = "events.updated"
        message.body = b'{"id": "x"}'
        message.headers = {}

        await manager._process_message(message)

        manager.retry_exchange.publish.assert_not_awaited()
        manager.dead_letter_exchange.publish.assert_awaited_once()
        dead_letter = manager.dead_letter_exchange.publish.await_args.args[0]
        self.assertEqual("permanent_failure", dead_letter.headers[FAILURE_REASON_HEADER])


if __name__ == "__main__":
    unittest.main()
