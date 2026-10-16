import logging
import os
import re

import discord

from utils.public_url import public_base_url

logger = logging.getLogger("icy.mining_handler")

# Limites Discord des embeds : un texte trop long est coupé plutôt que refusé.
TITLE_LIMIT = 256
DESCRIPTION_LIMIT = 4096
DISCORD_ID = re.compile(r"^\d{5,25}$")
COLORS = {
    "mining.order_ready": discord.Color.from_rgb(103, 232, 249),
    "mining.all_ready": discord.Color.from_rgb(253, 186, 116),
    "mining.settled": discord.Color.from_rgb(244, 205, 125),
    "mining.reopened": discord.Color.from_rgb(165, 180, 252),
}


def _truncate(text: str, limit: int) -> str:
    text = text or ""
    return text if len(text) <= limit else text[: limit - 1] + "…"


def build_message(routing_key: str, payload: dict):
    """Contenu (mentions) et embed d'une notification de fiche de minage. Le texte est rédigé par le serveur."""
    mentions = [f"<@{value}>" for value in payload.get("mentionDiscordIds") or [] if DISCORD_ID.match(str(value))]
    lines = [str(line) for line in payload.get("lines") or []]
    description = payload.get("description") or ""
    if lines:
        description = description + "\n\n" + "\n".join(f"• {line}" for line in lines)
    path = str(payload.get("path") or "")
    url = public_base_url() + path if path.startswith("/") else None
    embed = discord.Embed(
        title=_truncate(payload.get("title") or "Fiche de minage", TITLE_LIMIT),
        description=_truncate(description, DESCRIPTION_LIMIT),
        color=COLORS.get(routing_key, discord.Color.blurple()),
        url=url,
    )
    embed.set_footer(text="Fiche de minage • IceForge")
    return " ".join(mentions) or None, embed


class MiningHandler:
    """Notifications des fiches de minage, dans le salon des notifications (celui des SC World Events)."""

    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit
        raw = (os.getenv("DISCORD_NOTIFICATIONS_CHANNEL_ID") or "").strip()
        self.channel_id = int(raw) if raw.isdigit() else 0
        if not self.channel_id:
            logger.warning("DISCORD_NOTIFICATIONS_CHANNEL_ID vide ou invalide : notifications de minage inactives.")

    async def handle(self, routing_key: str, payload: dict):
        if routing_key not in COLORS:
            logger.warning("Clé de minage inconnue : %s", routing_key)
            return
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error("Salon des notifications introuvable (ID=%s) pour %s", self.channel_id, routing_key)
            raise RuntimeError("Discord notifications channel is unavailable")
        content, embed = build_message(routing_key, payload)
        # Seules les personnes concernées sont mentionnées : jamais @everyone ni de rôle.
        allowed = discord.AllowedMentions(everyone=False, roles=False, users=True)
        try:
            await channel.send(content=content, embed=embed, allowed_mentions=allowed)
            logger.info("Notification de minage envoyée : %s", routing_key)
        except Exception as exc:
            logger.error("Échec de l'envoi de la notification de minage (%s)", type(exc).__name__)
            raise
