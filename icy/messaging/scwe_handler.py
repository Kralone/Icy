import discord
import logging
import os

logger = logging.getLogger("icy.scwe_handler")

class ScweHandler:
    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit

        self.channel_id = int((os.getenv("DISCORD_NOTIFICATIONS_CHANNEL_ID") or "").strip())

    async def handle(self, routing_key: str, payload: dict):
        if routing_key == "scwe.tier_passed":
            await self.handle_tier_passed(payload)

    async def handle_tier_passed(self, payload: dict):
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error(f"⚠️ Salon introuvable (ID={self.channel_id}) pour SCWE Tier")
            return

        description = payload.get("discordDescription", "Un palier a été franchi !")
        image_url = payload.get("imageUrl")
        category = payload.get("category", "SCWE")
        milestone = payload.get("milestoneLabel", "Niveau Supérieur")

        # ✅ NOUVEAU : Récupération de la récompense
        reward_text = payload.get("rewardText")

        embed = discord.Embed(
            title=f"🎉 {category} : {milestone} franchi !",
            description=description,
            color=discord.Color.gold()
        )

        # ✅ AJOUT DU CHAMP RÉCOMPENSE
        if reward_text:
            embed.add_field(
                name="🎁 Récompense Débloquée : ",
                value=f"**{reward_text}**",
                inline=False
            )

        if image_url:
            embed.set_thumbnail(url=image_url)

        embed.set_footer(text="Star Citizen World Event • ICY")

        try:
            await channel.send(embed=embed)
            logger.info(f"🏆 Notification SCWE envoyée avec récompense : {reward_text}")
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'envoi du message SCWE : {e}")
