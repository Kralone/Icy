import logging
import os
import re
import sqlite3
from contextlib import closing
from pathlib import Path

import discord

logger = logging.getLogger("icy.dm")

SEND_KEY = "dm.send"
# Le retour ne commence pas par « dm. » : la file du bot écoute « dm.* » et se le renverrait à elle-même.
RESULT_KEY = "directmessage.result"

CONTENT_LIMIT = 2000
TITLE_LIMIT = 256
DESCRIPTION_LIMIT = 4096
FOOTER_LIMIT = 2048
# Limite d'une pièce jointe envoyée par un bot. Au-delà, l'image est montrée dans une carte plutôt que jointe.
ATTACHMENT_LIMIT = 10 * 1024 * 1024
MEDIA_NAME = re.compile(r"^[A-Za-z0-9._-]{1,200}$")
# Code d'erreur Discord quand le membre n'accepte pas les messages privés du serveur.
CANNOT_SEND_TO_USER = 50007


def _truncate(text, limit):
    text = text or ""
    return text if len(text) <= limit else text[: limit - 1] + "…"


class DmDeliveryLedger:
    """Messages privés déjà envoyés. Un nouvel essai RabbitMQ ne doit pas envoyer le même message deux fois."""

    def __init__(self, path=None):
        configured = path or os.getenv("BOT_IDEMPOTENCY_DB", "/app/config/discord-links.sqlite3")
        self.path = Path(configured)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path, timeout=5)) as connection:
            with connection:
                connection.execute(
                    """CREATE TABLE IF NOT EXISTS dm_deliveries (
                           delivery_id TEXT PRIMARY KEY,
                           status TEXT NOT NULL,
                           reason TEXT,
                           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"""
                )

    def get(self, delivery_id):
        with closing(sqlite3.connect(self.path, timeout=5)) as connection:
            row = connection.execute(
                "SELECT status, reason FROM dm_deliveries WHERE delivery_id = ?", (str(delivery_id),)
            ).fetchone()
        return (row[0], row[1]) if row else None

    def save(self, delivery_id, status, reason):
        with closing(sqlite3.connect(self.path, timeout=5)) as connection:
            with connection:
                connection.execute(
                    "INSERT OR REPLACE INTO dm_deliveries (delivery_id, status, reason) VALUES (?, ?, ?)",
                    (str(delivery_id), status, reason),
                )


def media_path(file_name):
    """Fichier de la bibliothèque d'images, lu dans le volume partagé. Aucun chemin n'est accepté, seulement un nom."""
    if not isinstance(file_name, str) or not MEDIA_NAME.match(file_name) or file_name.startswith("."):
        return None
    root = Path(os.getenv("BOT_MEDIA_DIR", "/app/media")).resolve()
    candidate = (root / file_name).resolve()
    if candidate.parent != root or not candidate.is_file():
        return None
    return candidate


def build_embed(payload):
    data = payload.get("embed")
    if not isinstance(data, dict):
        return None
    color = data.get("color")
    embed = discord.Embed(
        title=_truncate(str(data.get("title") or ""), TITLE_LIMIT) or None,
        description=_truncate(str(data.get("description") or ""), DESCRIPTION_LIMIT) or None,
        color=discord.Color(int(color)) if isinstance(color, int) and 0 <= color <= 0xFFFFFF else discord.Color.from_rgb(103, 232, 249),
    )
    footer = data.get("footer")
    if footer:
        embed.set_footer(text=_truncate(str(footer), FOOTER_LIMIT))
    return embed


class DirectMessageHandler:
    """
    Envoie un message privé préparé par le serveur (rappel, promotion, avertissement) et lui renvoie le résultat.
    Le texte est rédigé et validé par le serveur ; le bot n'y ajoute rien et n'autorise aucune mention.
    """

    def __init__(self, bot, rabbit=None, ledger=None):
        self.bot = bot
        self.rabbit = rabbit
        self._ledger = ledger

    @property
    def ledger(self):
        # Ouvert au premier message : construire le dispatcher ne touche pas au disque.
        if self._ledger is None:
            self._ledger = DmDeliveryLedger()
        return self._ledger

    async def handle(self, routing_key, payload):
        if routing_key != SEND_KEY:
            logger.warning("Clé de message privé inconnue : %s", routing_key)
            return
        delivery_id = str(payload.get("deliveryId") or "").strip()
        if not delivery_id:
            raise ValueError("deliveryId manquant")

        already = self.ledger.get(delivery_id)
        if already:
            # Nouvel essai d'un message déjà traité : on redonne seulement le résultat au serveur.
            await self._report(payload, *already)
            return

        status, reason = await self._deliver(payload)
        self.ledger.save(delivery_id, status, reason)
        await self._report(payload, status, reason)

    async def _deliver(self, payload):
        try:
            discord_id = int(str(payload.get("discordId") or ""))
        except ValueError:
            return "FAILED", "invalid_discord_id"
        content = _truncate(str(payload.get("content") or ""), CONTENT_LIMIT) or None
        embed = build_embed(payload)
        if not content and not embed:
            return "FAILED", "empty_message"

        try:
            user = await self.bot.fetch_user(discord_id)
        except discord.NotFound:
            return "FAILED", "user_not_found"

        reason = None
        files = []
        media_name = payload.get("mediaFile")
        if media_name:
            path = media_path(media_name)
            if path is None:
                reason = "media_missing"
            elif path.stat().st_size <= ATTACHMENT_LIMIT:
                files.append(discord.File(path, filename=path.name))
            else:
                reason = "media_too_large"

        allowed = discord.AllowedMentions.none()
        try:
            await user.send(content=content, embed=embed, files=files or None, allowed_mentions=allowed)
        except discord.Forbidden as exc:
            if getattr(exc, "code", None) == CANNOT_SEND_TO_USER:
                return "FAILED", "dm_closed"
            return "FAILED", "forbidden"
        except discord.HTTPException as exc:
            status = getattr(exc, "status", None)
            if isinstance(status, int) and 400 <= status < 500 and status != 429:
                return "FAILED", "discord_rejected"
            # Limite de débit ou panne de Discord : RabbitMQ réessaiera.
            raise
        logger.info("Message privé %s envoyé (%s)", payload.get("deliveryId"), payload.get("origin"))
        return "SENT", reason

    async def _report(self, payload, status, reason):
        if self.rabbit is None:
            return
        await self.rabbit.publish(RESULT_KEY, {
            "deliveryId": str(payload.get("deliveryId")),
            "origin": payload.get("origin"),
            "reference": payload.get("reference"),
            "status": status,
            "reason": reason,
        })
