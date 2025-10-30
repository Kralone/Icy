import logging
import json

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

        except Exception as e:
            logger.exception(f"❌ Erreur dans UserHandler : {e}")

    async def _handle_password_reset(self, payload: dict):
        discord_id = int(payload.get("discordId"))
        temp_password = payload.get("tempPassword")

        logger.info(f"🔐 Notification de mot de passe pour {discord_id}")

        user = await self.bot.fetch_user(discord_id)
        if user:
            await user.send(
                f"🔐 Ton mot de passe temporaire est : **{temp_password}**\n"
                f"Pense à le changer dès que possible dès ta connexion sur le site !"
            )
            logger.info(f"✅ Mot de passe envoyé à {discord_id}")
        else:
            logger.warning(f"⚠️ Utilisateur {discord_id} introuvable sur Discord.")
