from datetime import datetime, timezone
import asyncio
import os
import discord
from discord import ui, ButtonStyle
from utils.html_to_discord import html_to_discord
import logging
from typing import Dict, List, Tuple, Optional
import json
import re
from os import getenv
from urllib.parse import urlsplit
from messaging.discord_link_store import DiscordLink

logger = logging.getLogger("icy.event_handler")
EVENT_BUTTON_CUSTOM_ID_RE = re.compile(r"^event:([0-9a-fA-F-]{36}):(-?1|0|1)$")
EVENT_REMINDER_RESOURCE_TYPE = "event_reminder_one_hour"


def is_supported_discord_image_url(value: object) -> bool:
    """Discord embed images must be reachable through an absolute HTTP(S) URL."""
    if not isinstance(value, str):
        return False
    try:
        parsed = urlsplit(value.strip())
        return parsed.scheme.lower() in {"http", "https"} and bool(parsed.netloc)
    except ValueError:
        return False

# Limites de Discord pour un embed : au-delà, l'envoi est refusé en bloc.
EMBED_TITLE_LIMIT = 256
EMBED_DESCRIPTION_LIMIT = 4096
EMBED_FIELD_LIMIT = 1024
EMBED_TOTAL_LIMIT = 6000
# Le briefing d'une opération est résumé : le détail se lit sur le site.
OPERATION_BRIEFING_LIMIT = 900
OBJECTIVE_KIND_LABELS = (("PRINCIPAL", "Principaux"), ("SECONDAIRE", "Secondaires"))


def truncate_text(value: object, limit: int, suffix: str = "…") -> str:
    """Coupe un texte à `limit` caractères, sur un mot si possible, et le termine par `suffix`."""
    text = "" if value is None else str(value).strip()
    if len(text) <= limit:
        return text
    room = max(0, limit - len(suffix))
    cut = text[:room]
    last_space = cut.rfind(" ")
    if last_space > room * 0.6:
        cut = cut[:last_space]
    return cut.rstrip(" ,;:.\n") + suffix


def truncate_lines(lines: List[str], limit: int, more: str) -> str:
    """Garde des lignes entières sous `limit` caractères ; `more` annonce celles qui manquent (`{count}` = leur nombre)."""
    kept: List[str] = []
    for index, line in enumerate(lines):
        remaining = len(lines) - index
        candidate = "\n".join(kept + [line])
        note = more.format(count=remaining - 1)
        if len(candidate) + (len(note) + 1 if remaining > 1 else 0) > limit:
            note = more.format(count=remaining)
            while kept and len("\n".join(kept + [note])) > limit:
                kept.pop()
                note = more.format(count=len(lines) - len(kept))
            return "\n".join(kept + [note])[:limit]
        kept.append(line)
    return "\n".join(kept)


def format_objectives(value: object) -> str:
    """
    Objectifs d'une opération en texte lisible. Ils sont enregistrés en JSON
    (`[{"kind": "PRINCIPAL", "text": "…"}]`) ; un ancien texte libre est repris tel quel.
    """
    if not value:
        return ""
    text = str(value).strip()
    try:
        items = json.loads(text)
    except (ValueError, TypeError):
        return truncate_text(html_to_discord(text), EMBED_FIELD_LIMIT)
    if not isinstance(items, list):
        return truncate_text(html_to_discord(text), EMBED_FIELD_LIMIT)

    lines: List[str] = []
    known = {kind for kind, _ in OBJECTIVE_KIND_LABELS}
    groups = list(OBJECTIVE_KIND_LABELS) + [(None, "Autres")]
    for kind, label in groups:
        texts = [
            str(item.get("text", "")).strip()
            for item in items
            if isinstance(item, dict)
            and str(item.get("text", "")).strip()
            and (item.get("kind") == kind if kind else item.get("kind") not in known)
        ]
        if not texts:
            continue
        lines.append(f"**{label}**")
        lines.extend(f"• {truncate_text(entry, 200)}" for entry in texts)
    return truncate_lines(lines, EMBED_FIELD_LIMIT, "… suite sur la fiche de l’opération")


def format_schedule(start: object, end: object) -> str:
    """Date et heure de début, avec l'heure de fin quand elle est connue (et le jour s'il diffère)."""
    text = format_date(start)
    if not end:
        return text
    end_time = format_time(end)
    if not end_time:
        return text
    if format_day(start) == format_day(end):
        return f"{text} → {end_time}"
    return f"{text} → {format_date(end)}"


def format_date(date_str: str) -> str:
    """Convertit une date ISO (ex: 2025-11-03T12:30:00) en format lisible français, sans dépendre de la locale système."""
    if not date_str:
        return "Date inconnue"

    jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    mois = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ]

    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        jour_nom = jours[dt.weekday()]
        mois_nom = mois[dt.month - 1]
        return f"{jour_nom} {dt.day} {mois_nom} {dt.year} à {dt.hour:02d}h{dt.minute:02d}"
    except Exception:
        return date_str


def format_day(date_str: str) -> str:
    """Convertit une date ISO en format français sans afficher d'heure."""
    if not date_str:
        return "Date inconnue"

    jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    mois = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ]

    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        jour_nom = jours[dt.weekday()]
        mois_nom = mois[dt.month - 1]
        return f"{jour_nom} {dt.day} {mois_nom} {dt.year}"
    except Exception:
        return date_str


def format_time(date_str: str) -> str:
    """Convertit une date ISO en heure lisible (HHhMM)."""
    if not date_str:
        return ""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return f"{dt.hour:02d}h{dt.minute:02d}"
    except Exception:
        return ""



class EventHandler:
    def __init__(self, bot, rabbit, discord_link_store=None):
        self.bot = bot
        self.rabbit = rabbit
        self.discord_link_store = discord_link_store
        self.channel_id = self._read_channel_id("DISCORD_EVENTS_CHANNEL_ID")
        self._daily_ping_messages: Dict[int, Dict[str, object]] = {}
        self._reminder_one_hour_messages: Dict[str, List[Tuple[int, int]]] = {}
        self._registered_message_views = set()
        self._event_lock = asyncio.Lock()

    @staticmethod
    def _read_channel_id(env_var: str) -> int:
        raw = (os.getenv(env_var) or "").strip()
        if not raw:
            logger.warning(f"⚠️ Variable {env_var} vide ou absente. Le handler restera inactif.")
            return 0
        try:
            return int(raw)
        except ValueError:
            logger.error(f"❌ Variable {env_var} invalide: '{raw}'. Valeur attendue: entier Discord ID.")
            return 0

    async def handle(self, routing_key: str, payload: dict):
        """Redirige les sous-événements event.* vers les bonnes fonctions."""
        if routing_key == "news.discordLinked":
            logger.debug("↩️ Ignoré (retour backend).")
            return

        if routing_key in {"events.created", "events.updated", "events.deleted", "events.ended"}:
            async with self._event_lock:
                handler = {
                    "events.created": self.handle_event_created,
                    "events.updated": self.handle_event_updated,
                    "events.deleted": self.handle_event_deleted,
                    "events.ended": self.handle_event_ended,
                }[routing_key]
                await handler(payload)
            return

        if routing_key == "events.dailyPing":
            await self.handle_daily_ping(payload)
        elif routing_key == "events.reminderOneHour":
            await self.handle_reminder_one_hour(payload)

        else:
            logger.warning(f"⚠️ Clé inconnue pour EventHandler : {routing_key}")


    async def handle_event_created(self, payload: dict):
        event_id = payload.get("id")
        if not event_id:
            raise ValueError("Event id is required")
        title = payload.get("title", "Sans titre")
        embed, operation_url = self._build_event_embed(event_id, payload)
        view = EventParticipationView(self.rabbit, payload["id"], operation_url=operation_url)

        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error(f"⚠️ Salon introuvable (ID={self.channel_id})")
            raise RuntimeError("Discord events channel is unavailable")

        link = (
            self.discord_link_store.get("event", event_id)
            if self.discord_link_store
            else None
        )
        if link is None:
            link = await self._publish_event_in_order(channel, event_id, payload, embed, view)
            message = None
            logger.info(f"✅ Événement '{title}' publié dans #{channel.name}")
        else:
            logger.info(
                "♻️ Message Discord existant réutilisé pour eventId=%s", event_id
            )
        if link is not None:
            channel_id = link.channel_id
            message_id = link.message_id

        await self.rabbit.publish(
            "event.discordLinked",
            {
                "eventId": event_id,
                "messageId": message_id,
                "channelId": channel_id,
            },
        )

    @staticmethod
    def _operation_url(event_id) -> str:
        return f"{getenv('ICEFORGE_PUBLIC_URL', 'https://iceforge.fr').rstrip('/')}/icy/operations/{event_id}"

    def _build_event_embed(self, event_id, payload: dict):
        """
        Annonce d'un événement ou d'une opération, toujours sous les limites de Discord.
        Rend l'embed et, pour une opération, l'adresse de sa fiche (None sinon).
        """
        is_operation = payload.get("activityType") == "OPERATION"
        operation_info = (payload.get("operation") or {}) if is_operation else {}
        type_info = payload.get("type", {}) or {}
        type_name = type_info.get("name", "Événement")
        type_color = type_info.get("color")
        image_url = operation_info.get("imageUrl") or type_info.get("imageUrl")
        creator = payload.get("author", "Inconnu")

        description = html_to_discord(payload.get("description", ""))
        if is_operation:
            if operation_info.get("briefing"):
                description = html_to_discord(operation_info["briefing"])
            # Résumé : le briefing complet, la composition et la flotte se lisent sur la fiche.
            description = truncate_text(description, OPERATION_BRIEFING_LIMIT, "… Suite sur la fiche de l’opération.")
            schedule = format_schedule(payload.get("date"), payload.get("endDate"))
        else:
            schedule = format_date(payload.get("date"))
        header = f"📅 **Date :** {schedule}\n\n💬 "
        description = truncate_text(description, EMBED_DESCRIPTION_LIMIT - len(header))

        try:
            color_value = discord.Color(int(type_color.replace("#", ""), 16)) if type_color else discord.Color.blue()
        except (ValueError, AttributeError):
            color_value = discord.Color.blue()

        participants = payload.get("participants", []) or []

        def names(status):
            listed = [str(p.get("username", "?")) for p in participants if p.get("status") == status]
            return truncate_lines(listed, EMBED_FIELD_LIMIT, "… et {count} autre(s)") if listed else "–"

        embed = discord.Embed(
            title=truncate_text(f"{type_name} : {payload.get('title', 'Sans titre')}", EMBED_TITLE_LIMIT),
            description=f"{header}{description}",
            color=color_value,
        )
        embed.add_field(name="✅ Confirmés", value=names(1), inline=True)
        embed.add_field(name="❔ Peut-être", value=names(0), inline=True)
        embed.add_field(name="❌ Refusés", value=names(-1), inline=True)
        embed.set_footer(text=truncate_text(f"Créé par {creator}", 200))
        if is_supported_discord_image_url(image_url):
            embed.set_image(url=image_url)
        elif image_url:
            logger.warning("⚠️ Image d'événement ignorée : URL Discord non compatible")

        operation_url = None
        if is_operation:
            operation_url = self._operation_url(event_id)
            # Ce champ sert aussi à reconnaître une opération quand ses boutons sont reconstruits.
            embed.add_field(name="Opération", value=f"[Consulter l’opération sur IceForge]({operation_url})", inline=False)
            objectives = format_objectives(operation_info.get("objectives"))
            if objectives:
                embed.add_field(name="Objectifs", value=objectives, inline=False)
            if operation_info.get("meetingPoint"):
                embed.add_field(name="Lieu", value=truncate_text(operation_info["meetingPoint"], EMBED_FIELD_LIMIT), inline=False)

        # Dernier garde-fou : la somme de tous les textes ne doit pas dépasser la limite globale.
        excess = len(embed) - EMBED_TOTAL_LIMIT
        if excess > 0:
            embed.description = f"{header}{truncate_text(description, max(0, len(description) - excess))}"
        return embed, operation_url

    @staticmethod
    def _event_sort_key(value: object) -> str | None:
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except ValueError:
            return None

    async def _publish_event_in_order(self, channel, event_id, payload, embed, view):
        """Publish a new event and rebuild the channel order when it is inserted earlier.

        Discord messages cannot be moved. Existing embeds are copied before their
        messages are deleted, so participant fields and event details remain intact.
        """
        sort_key = self._event_sort_key(payload.get("date"))
        if not self.discord_link_store:
            message = await channel.send(embed=embed, view=view)
            return DiscordLink(message.channel.id, message.id)
        channel_id = getattr(channel, "id", None)
        if not isinstance(channel_id, int):
            channel_id = self.channel_id
        existing = self.discord_link_store.list_events(channel_id)
        records = []
        old_messages = []
        for old_event_id, old_link, old_key in existing:
            try:
                old_message = await channel.fetch_message(old_link.message_id)
            except discord.NotFound:
                continue
            old_embed = old_message.embeds[0] if old_message.embeds else None
            if self._is_finished_message(old_message):
                self.discord_link_store.finish_event(old_event_id)
                continue
            if old_embed is None:
                continue
            old_key = old_key or self._legacy_sort_key(old_embed)
            if old_key is None:
                logger.warning("Event %s has no reliable date; leaving its message untouched", old_event_id)
                continue
            if old_embed is not None:
                old_embed = discord.Embed.from_dict(old_embed.to_dict())
            records.append((old_key or "9999", old_event_id, old_embed))
            old_messages.append(old_link.message_id)
        needs_reorder = bool(sort_key and any(sort_key < key for key, _, _ in records))
        if not needs_reorder:
            message = await channel.send(embed=embed, view=view)
            return self.discord_link_store.save("event", event_id, message.channel.id, message.id, sort_key)
        records.append((sort_key or "9999", str(event_id), embed))
        records.sort(key=lambda record: (record[0], record[1]))
        new_links = {}
        for key, current_event_id, current_embed in records:
            if current_embed is None:
                continue
            current_message = await channel.send(
                embed=current_embed,
                view=self._view_for_embed(current_event_id, current_embed),
            )
            saved = self.discord_link_store.save("event", current_event_id, current_message.channel.id, current_message.id, key)
            new_links[current_event_id] = saved
        for message_id in old_messages:
            try:
                await channel.fetch_message(message_id)
                await channel.get_partial_message(message_id).delete()
            except discord.NotFound:
                pass
        for current_event_id, saved in new_links.items():
            if current_event_id != str(event_id):
                await self.rabbit.publish("event.discordLinked", {
                    "eventId": current_event_id, "messageId": saved.message_id, "channelId": saved.channel_id,
                })
        return new_links[str(event_id)]

    def _view_for_embed(self, event_id, embed):
        # Rebuilt messages have no original payload. The operation field is
        # retained in the embed; reconstruct only our own canonical URL.
        operation_url = None
        if any(field.name == "Opération" for field in embed.fields):
            operation_url = self._operation_url(event_id)
        return EventParticipationView(self.rabbit, event_id, operation_url=operation_url)

    @staticmethod
    def _is_finished_message(message):
        return any("[TERMINÉ]" in (embed.title or "") or any(
            field.name == "Statut" and "terminé" in field.value.casefold()
            for field in embed.fields
        ) for embed in message.embeds)

    @staticmethod
    def _legacy_sort_key(embed):
        months = "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split()
        match = re.search(r"Date\s*:\*\*\s*\w+\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s+à\s+(\d{2})h(\d{2})", embed.description or "", re.IGNORECASE)
        if not match:
            return None
        day, month, year, hour, minute = match.groups()
        try:
            return datetime(int(year), months.index(month.lower()) + 1, int(day), int(hour), int(minute), tzinfo=timezone.utc).isoformat()
        except ValueError:
            return None

    async def handle_event_updated(self, payload: dict):
        event_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")
        link = self.discord_link_store.get("event", event_id) if self.discord_link_store else None
        if link:
            channel_id, message_id = link.channel_id, link.message_id

        if not (channel_id and message_id):
            logger.warning(f"⚠️ Données incomplètes pour event.updated ({event_id})")
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            raise RuntimeError("Discord event channel is unavailable")

        try:
            message = await channel.fetch_message(int(message_id))
        except discord.NotFound:
            logger.warning(f"⚠️ Message introuvable pour event {event_id}")
            return

        is_finished = bool(payload.get("finished", False))
        if is_finished:
            if self.discord_link_store:
                self.discord_link_store.finish_event(event_id)
            await message.edit(view=None)
            return
        if self.discord_link_store:
            # Un événement corrigé/reprogrammé redevient actif, même si une
            # ancienne reconstruction l'avait marqué terminé dans le registre.
            self.discord_link_store.reopen_event(event_id)

        title = payload.get("title", "Sans titre")
        embed, _ = self._build_event_embed(event_id, payload)
        view = self._view_for_embed(event_id, embed)
        await message.edit(embed=embed, view=view)
        if self.discord_link_store:
            self.discord_link_store.save("event", event_id, message.channel.id, message.id, self._event_sort_key(payload.get("date")))
            if not is_finished:
                await self._reorder_active_events(channel)
        logger.info(f"✏️ Événement mis à jour dans #{channel.name} ({title})")

    async def _reorder_active_events(self, channel):
        """Réordonne les événements actifs après une modification de date."""
        if not self.discord_link_store:
            return
        channel_id = getattr(channel, "id", self.channel_id)
        existing = self.discord_link_store.list_events(channel_id, include_finished=True)
        records = []
        last_finished_message = 0
        for event_id, link, key in existing:
            if self.discord_link_store.is_event_finished(event_id):
                last_finished_message = max(last_finished_message, link.message_id)
                continue
            try:
                message = await channel.fetch_message(link.message_id)
            except discord.NotFound:
                continue
            if self._is_finished_message(message):
                self.discord_link_store.finish_event(event_id)
                last_finished_message = max(last_finished_message, link.message_id)
                continue
            embed = message.embeds[0] if message.embeds else None
            key = self._event_sort_key(key) or self._legacy_sort_key(embed) if embed else None
            if embed is None or key is None:
                continue
            records.append((key, event_id, link.message_id, discord.Embed.from_dict(embed.to_dict())))

        desired = sorted(records, key=lambda record: (record[0], record[1]))
        current_ids = [event_id for _, event_id, _, _ in sorted(records, key=lambda record: record[2])]
        desired_ids = [event_id for _, event_id, _, _ in desired]
        behind_history = all(message_id > last_finished_message for _, _, message_id, _ in records)
        if current_ids == desired_ids and behind_history:
            return

        old_message_ids = [message_id for _, _, message_id, _ in records]
        new_links = {}
        for key, event_id, _, embed in desired:
            sent = await channel.send(embed=embed, view=self._view_for_embed(event_id, embed))
            new_links[event_id] = self.discord_link_store.save("event", event_id, sent.channel.id, sent.id, key)
        for message_id in old_message_ids:
            try:
                await channel.get_partial_message(message_id).delete()
            except discord.NotFound:
                pass
        for event_id, link in new_links.items():
            await self.rabbit.publish("event.discordLinked", {
                "eventId": event_id, "messageId": link.message_id, "channelId": link.channel_id,
            })


    async def handle_event_ended(self, payload: dict):
        """Met à jour le message Discord pour signaler la fin d'un événement,
        ou supprime le dailyPing du jour si aucun ID n'est fourni."""
        event_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        # Le nettoyage ne doit pas dépendre de l'état du message principal.
        # Il doit notamment fonctionner après un redémarrage du bot ou si le
        # message de l'événement a déjà été supprimé manuellement.
        if event_id:
            await self.cleanup_event_notifications(payload)

        # 🧹 Cas spécial : signal de nettoyage du dailyPing (aucun message lié)
        if not (channel_id and message_id):
            logger.info("🧹 Signal reçu : suppression du message dailyPing du jour.")
            await self.cleanup_daily_ping()
            return

        # --- Cas classique : un événement Discord à terminer ---
        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            raise RuntimeError("Discord event channel is unavailable")

        try:
            message = await channel.fetch_message(int(message_id))
        except discord.NotFound:
            logger.warning(f"⚠️ Message introuvable pour event {event_id}")
            return

        embed = message.embeds[0] if message.embeds else None
        if not embed:
            logger.warning(f"⚠️ Aucun embed trouvé pour event {event_id}")
            return

        # 🔧 Mise à jour de l’embed pour marquer l’événement terminé
        embed.color = discord.Color.dark_grey()
        embed.title = f"🧊 [TERMINÉ] {embed.title}"
        embed.add_field(
            name="Statut",
            value="✅ Cet événement est terminé automatiquement.",
            inline=False,
        )

        # ❌ Retrait des boutons
        await message.edit(embed=embed, view=None)
        if self.discord_link_store:
            self.discord_link_store.save("event", event_id, int(channel_id), int(message_id))
            self.discord_link_store.finish_event(event_id)
        logger.info(f"🏁 Événement terminé et mis à jour sur Discord (eventId={event_id})")

    async def cleanup_event_notifications(self, payload: dict):
        """Supprime les rappels liés à un événement terminé.
        - reminderOneHour: suppression du message dédié
        - dailyPing: suppression de la ligne de l'événement, puis suppression du message si vide
        """
        event_id_raw = payload.get("id") or payload.get("eventId")
        event_id = str(event_id_raw) if event_id_raw is not None else None
        if not event_id:
            logger.warning("⚠️ cleanup_event_notifications: event_id manquant.")
            return

        # 1) Supprimer les messages reminderOneHour de cet event
        reminder_refs = list(self._reminder_one_hour_messages.get(event_id, []))
        if self.discord_link_store:
            reminder_refs.extend(
                (link.channel_id, link.message_id)
                for link in self.discord_link_store.get_message_refs(
                    EVENT_REMINDER_RESOURCE_TYPE, event_id
                )
            )

        # La même référence peut être présente en mémoire et dans le registre durable.
        reminder_refs = list(dict.fromkeys(reminder_refs))
        failed_refs = []
        for channel_id, message_id in reminder_refs:
            try:
                target_channel = self.bot.get_channel(int(channel_id))
                if not target_channel:
                    failed_refs.append((channel_id, message_id))
                    continue
                message = await target_channel.fetch_message(int(message_id))
                await message.delete()
                logger.info(f"🧹 Reminder 1h supprimé (eventId={event_id}, messageId={message_id})")
            except discord.NotFound:
                pass
            except Exception as exc:
                failed_refs.append((channel_id, message_id))
                logger.warning(
                    "⚠️ Impossible de supprimer reminder 1h (%s, %s)",
                    message_id,
                    type(exc).__name__,
                )
                continue

            if self.discord_link_store:
                self.discord_link_store.delete_message_ref(
                    EVENT_REMINDER_RESOURCE_TYPE, event_id, message_id
                )

        if failed_refs:
            self._reminder_one_hour_messages[event_id] = failed_refs
        else:
            self._reminder_one_hour_messages.pop(event_id, None)

        # 2) Mettre à jour les dailyPing qui contiennent cet event
        daily_ping_failed = False
        for message_id, metadata in list(self._daily_ping_messages.items()):
            events = metadata.get("events", [])
            if not isinstance(events, list):
                continue

            filtered_events = [e for e in events if str(e.get("id")) != event_id]
            if len(filtered_events) == len(events):
                continue

            channel_id = metadata.get("channel_id")
            date = str(metadata.get("date", ""))

            try:
                target_channel = self.bot.get_channel(int(channel_id))
                if not target_channel:
                    daily_ping_failed = True
                    continue
                message = await target_channel.fetch_message(int(message_id))

                if not filtered_events:
                    await message.delete()
                    self._daily_ping_messages.pop(message_id, None)
                    logger.info(f"🧹 Daily ping supprimé (plus d'event) (messageId={message_id})")
                    continue

                updated_content = self._build_daily_ping_content(filtered_events, date)
                await message.edit(content=updated_content)
                metadata["events"] = filtered_events
                self._daily_ping_messages[message_id] = metadata
                logger.info(f"🧹 Daily ping mis à jour (event retiré) (messageId={message_id})")
            except discord.NotFound:
                self._daily_ping_messages.pop(message_id, None)
            except Exception as exc:
                daily_ping_failed = True
                logger.warning(
                    "⚠️ Impossible de mettre à jour le daily ping (%s, %s)",
                    message_id,
                    type(exc).__name__,
                )

        if failed_refs or daily_ping_failed:
            raise RuntimeError(
                f"Discord event notification cleanup incomplete for event {event_id}"
            )


    async def cleanup_daily_ping(self):
        """Supprime le message dailyPing du jour dans le canal d’événements."""
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error("⚠️ Salon Discord introuvable pour nettoyage dailyPing")
            return

        from datetime import datetime
        today_iso = datetime.now().strftime("%Y-%m-%d")
        today_label = format_day(today_iso)

        async for message in channel.history(limit=30):
            if message.author != self.bot.user:
                continue
            if (
                "événement(s)" in message.content
                and (today_iso in message.content or today_label in message.content)
            ):
                try:
                    await message.delete()
                    logger.info(f"🧹 Message dailyPing du {today_iso} supprimé.")
                except Exception as exc:
                    logger.error(
                        "❌ Erreur lors du nettoyage dailyPing (%s)",
                        type(exc).__name__,
                    )
                return

        logger.warning(f"⚠️ Aucun message dailyPing trouvé pour {today_iso}.")


    async def handle_event_deleted(self, payload: dict):
        event_id = payload.get("eventId")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        if event_id:
            await self.cleanup_event_notifications(payload)

        if not (channel_id and message_id):
            logger.warning(f"⚠️ Données incomplètes pour event.deleted ({event_id})")
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            raise RuntimeError("Discord event channel is unavailable")

        try:
            message = await channel.fetch_message(int(message_id))
            await message.delete()
            if self.discord_link_store and event_id:
                self.discord_link_store.delete("event", event_id)
            logger.info(f"🗑️ Événement supprimé de Discord (eventId={event_id})")
        except discord.NotFound:
            if self.discord_link_store and event_id:
                self.discord_link_store.delete("event", event_id)
            logger.warning(f"⚠️ Message déjà supprimé pour event {event_id}")
        except Exception as exc:
            logger.error(
                "❌ Erreur lors de la suppression de l’event Discord (%s)",
                type(exc).__name__,
            )
            raise


    async def handle_daily_ping(self, payload: dict):
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error("⚠️ Salon introuvable pour dailyPing")
            raise RuntimeError("Discord events channel is unavailable")

        events = payload.get("events", [])
        date = format_day(payload.get("date"))
        msg = self._build_daily_ping_content(events, date)
        sent = await channel.send(msg)

        normalized_events = [
            {
                "id": str(e.get("id")),
                "title": e.get("title", "Sans titre"),
                "date": e.get("date"),
            }
            for e in events
            if e.get("id") is not None
        ]
        self._daily_ping_messages[sent.id] = {
            "channel_id": sent.channel.id,
            "date": date,
            "events": normalized_events,
        }
        logger.info("📢 Daily ping envoyé.")

    async def handle_reminder_one_hour(self, payload: dict):
        """Ping individuel des membres confirmés ou indécis 1h avant l’événement."""
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error("⚠️ Salon Discord introuvable pour reminderOneHour")
            raise RuntimeError("Discord events channel is unavailable")

        title = payload.get("title")
        participants = payload.get("participants", [])

        if not participants:
            logger.info(f"⚠️ Aucun participant à notifier pour {title}")
            return

        # Séparation confirmés / indécis
        confirmed = [p for p in participants if p.get("status") == 1]
        maybe     = [p for p in participants if p.get("status") == 0]

        def mention_from(p):
            discord_id = p.get("discordId")
            if discord_id:         # mention directe par ID (fiable, ping garanti)
                return f"<@{discord_id}>"
            username = p.get("username")
            # Fallback : en gras si aucun ID (ne ping pas mais montre le pseudo)
            return f"**{username}**" if username else "**Inconnu**"

        confirmed_mentions = " ".join(mention_from(p) for p in confirmed) or "_(personne)_"
        maybe_mentions = " ".join(mention_from(p) for p in maybe) or r"¯\\\_(ツ)\_/¯"

        msg = (
            f"⏰ **Rappel** : l’événement **{title}** commence dans **1h** !\n"
            f"✅ **Confirmés** : {confirmed_mentions}\n"
            f"❔ **Indécis** : {maybe_mentions}"
        )

        sent = await channel.send(msg)

        event_id = payload.get("eventId")
        if event_id is not None:
            event_key = str(event_id)
            self._reminder_one_hour_messages.setdefault(event_key, []).append((sent.channel.id, sent.id))
            if self.discord_link_store:
                self.discord_link_store.add_message_ref(
                    EVENT_REMINDER_RESOURCE_TYPE,
                    event_key,
                    sent.channel.id,
                    sent.id,
                )

        logger.info(f"⏰ Rappel 1h avant envoyé pour {title} ({len(confirmed)} confirmés, {len(maybe)} indécis).")

    async def restore_event_views(self, history_limit: int = 200):
        """Ré-enregistre les vues persistantes des messages d'events après redémarrage bot/backend."""
        if not self.rabbit:
            logger.warning("⚠️ Rabbit indisponible: impossible de restaurer les vues d'events.")
            return

        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            try:
                channel = await self.bot.fetch_channel(self.channel_id)
            except Exception as exc:
                logger.error(
                    "❌ Impossible de récupérer le salon d'events (%s, %s)",
                    self.channel_id,
                    type(exc).__name__,
                )
                return

        restored = 0
        skipped = 0

        async for message in channel.history(limit=history_limit):
            if not message.components:
                continue
            if message.author != self.bot.user:
                continue
            if message.id in self._registered_message_views:
                continue

            if self._is_finished_message(message):
                # Nettoie les boutons laissés par une ancienne reconstruction.
                event_id = self._extract_event_id_from_message_components(message)
                try:
                    await message.edit(view=None)
                except Exception as exc:
                    logger.warning("Impossible de retirer les boutons d'un événement terminé (%s)", type(exc).__name__)
                if event_id and self.discord_link_store:
                    self.discord_link_store.finish_event(event_id)
                continue

            event_id = self._extract_event_id_from_message_components(message)
            if not event_id:
                skipped += 1
                continue

            self.bot.add_view(EventParticipationView(self.rabbit, event_id), message_id=message.id)
            self._registered_message_views.add(message.id)
            restored += 1

        logger.info(f"🔁 Vues d'events restaurées: {restored} (ignorées: {skipped})")

    @staticmethod
    def _extract_event_id_from_message_components(message) -> Optional[str]:
        for row in message.components:
            for child in getattr(row, "children", []):
                custom_id = getattr(child, "custom_id", None)
                if not custom_id:
                    continue
                match = EVENT_BUTTON_CUSTOM_ID_RE.match(custom_id)
                if match:
                    return match.group(1)
        return None

    def _build_daily_ping_content(self, events: List[dict], date: str) -> str:
        lines = []
        for event in events:
            title = event.get("title", "Sans titre")
            time_label = format_time(event.get("date"))
            if time_label:
                lines.append(f"• {time_label} - {title}")
            else:
                lines.append(f"• {title}")

        titles = "\n".join(lines)
        return (
            f"<@&1325528040322896025> \n"
            f" 🔔 **{len(events)} événement(s)** prévu(s) aujourd’hui ({date}) :\n"
            f"{titles}\n\n"
            f"Pensez à confirmer votre participation !"
        )



# --- Classe View pour les boutons ---
class EventParticipationView(ui.View):
    def __init__(self, rabbit, event_id, operation_url=None):
        super().__init__(timeout=None)
        self.rabbit = rabbit
        self.event_id = str(event_id)

        # Les identifiants des boutons ne changent pas : seuls les libellés d'une opération diffèrent.
        if operation_url:
            self.add_item(self._build_button("Présent", ButtonStyle.success, 1))
            self.add_item(self._build_button("Peut-être", ButtonStyle.secondary, 0))
            self.add_item(self._build_button("Indisponible", ButtonStyle.danger, -1))
            self.add_item(ui.Button(label="Consulter l’opération", style=ButtonStyle.link, url=operation_url))
        else:
            self.add_item(self._build_button("Présent ✅", ButtonStyle.success, 1))
            self.add_item(self._build_button("Peut-être ❔", ButtonStyle.secondary, 0))
            self.add_item(self._build_button("Absent ❌", ButtonStyle.danger, -1))

    def _build_button(self, label: str, style: ButtonStyle, status: int) -> ui.Button:
        button = ui.Button(
            label=label,
            style=style,
            custom_id=f"event:{self.event_id}:{status}"
        )

        async def _callback(interaction: discord.Interaction):
            await self._send_participation(interaction, status)

        button.callback = _callback
        return button

    async def _send_participation(self, interaction: discord.Interaction, status: int):
        await interaction.response.defer(ephemeral=True)
        try:
            await self.rabbit.publish(
                "events.participation",
                {
                    "eventId": self.event_id,
                    "userId": interaction.user.id,
                    "username": interaction.user.name,
                    "status": status,
                },
            )
        except Exception as exc:
            logger.error(
                "❌ Publication de participation impossible (%s)",
                type(exc).__name__,
            )
            await interaction.followup.send(
                "❌ Votre choix n'a pas pu être enregistré. Réessayez plus tard.",
                ephemeral=True,
            )
            return
        await interaction.followup.send(
            "✅ Votre choix a été enregistré !", ephemeral=True
        )
