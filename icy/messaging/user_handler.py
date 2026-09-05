import logging

import discord

logger = logging.getLogger("icy.user")

class UserHandler:
    """Gère les messages utilisateur (ex: envoi du mot de passe temporaire)."""

    def __init__(self, bot):
        self.bot = bot

    async def handle(self, routing_key: str, payload: dict):
        try:
            if routing_key == "users.password_reset":
                await self._handle_password_reset(payload)
            else:
                logger.warning(f"⚠️ Clé de routage non gérée : {routing_key}")

        except Exception as exc:
            # Discord/client exceptions can contain message content. Password-reset
            # payloads are sensitive, so never render the exception itself.
            logger.error("❌ Erreur dans UserHandler (%s)", type(exc).__name__)
            raise

    async def _handle_password_reset(self, payload: dict):
        try:
            discord_id = int(payload.get("discordId"))
        except (TypeError, ValueError):
            logger.warning("⚠️ Notification de mot de passe ignorée: Discord ID invalide.")
            return
        temp_password = payload.get("tempPassword")
        username = payload.get("username")

        if (
            discord_id <= 0
            or not isinstance(temp_password, str)
            or not temp_password
            or not isinstance(username, str)
            or not username.strip()
        ):
            logger.warning("⚠️ Notification de mot de passe ignorée: payload invalide.")
            return

        logger.info(f"🔐 Notification de mot de passe pour {discord_id}")

        user = await self.bot.fetch_user(discord_id)
        if user:
            safe_username = discord.utils.escape_markdown(
                discord.utils.escape_mentions(username.strip())
            )
            await user.send(
                f"👤 Ton identifiant IceForge est : **{safe_username}**\n"
                f"🔐 Ton mot de passe temporaire est : **{temp_password}**\n"
                "🌐 [Accéder à IceForge](https://iceforge.fr)\n"
                "Pense à le changer dès que possible dès ta connexion sur le site !"
            )
            logger.info(f"✅ Mot de passe envoyé à {discord_id}")
        else:
            logger.warning(f"⚠️ Utilisateur {discord_id} introuvable sur Discord.")
