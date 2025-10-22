import logging
import discord
import os
from utils.html_to_discord import html_to_discord

logger = logging.getLogger("icy.news_handler")


class NewsHandler:
    """Gère la logique métier liée aux actualités (news.*)."""

    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit
        self.channel_id = int(os.getenv("DISCORD_NEWS_CHANNEL_ID", "0"))

    async def handle(self, routing_key: str, payload: dict):
        """Dirige le message vers la méthode appropriée."""
        if routing_key == "news.created":
            await self._created(payload)
        elif routing_key == "news.updated":
            await self._updated(payload)
        elif routing_key == "news.deleted":
            await self._deleted(payload)
        else:
            logger.warning(f"⚠️ Clé non reconnue pour NewsHandler : {routing_key}")

    # -----------------------------------------------------------------------
    # 🧊 NEWS.CREATED
    # -----------------------------------------------------------------------
    async def _created(self, payload: dict):
        title = payload.get("title", "Sans titre")
        author = payload.get("author", "Inconnu")
        content = html_to_discord(payload.get("content", "Aucun contenu"))
        type_info = payload.get("type", {})
        image_url = type_info.get("imageUrl")
        type_name = type_info.get("name")
        type_color = type_info.get("color")

        # Couleur
        try:
            color_value = discord.Color(int(type_color.replace("#", ""), 16)) if type_color else discord.Color.blue()
        except Exception:
            color_value = discord.Color.blue()

        embed = discord.Embed(title=title, description=content, color=color_value)
        embed.set_footer(text=f"{type_name} | Par {author}")
        if image_url:
            embed.set_image(url=image_url)

        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error(f"⚠️ Salon introuvable (ID={self.channel_id})")
            return

        message = await channel.send(embed=embed)
        logger.info(f"✅ Actualité publiée : '{title}' dans #{channel.name}")

        # Retour backend (news.discordLinked)
        if self.rabbit:
            await self.rabbit.publish(
                "news.discordLinked",
                {
                    "newsId": payload["id"],
                    "messageId": message.id,
                    "channelId": message.channel.id,
                },
            )
            logger.info(f"📨 Réponse RabbitMQ envoyée pour newsId={payload['id']}")

    # -----------------------------------------------------------------------
    # ✏️ NEWS.UPDATED
    # -----------------------------------------------------------------------
    async def _updated(self, payload: dict):
        news_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        logger.info(f"✏️ Mise à jour d'une actualité : {news_id}")

        try:
            channel = self.bot.get_channel(int(channel_id))
            message = await channel.fetch_message(int(message_id))
        except Exception as e:
            logger.warning(f"⚠️ Impossible de récupérer le message Discord : {e}")
            return

        title = payload.get("title", "Sans titre")
        author = payload.get("author", "Inconnu")
        content = html_to_discord(payload.get("content", ""))
        type_info = payload.get("type", {})
        image_url = type_info.get("imageUrl")
        type_name = type_info.get("name")
        type_color = type_info.get("color")

        try:
            color_value = discord.Color(int(type_color.replace("#", ""), 16)) if type_color else discord.Color.blue()
        except Exception:
            color_value = discord.Color.blue()

        embed = discord.Embed(title=title, description=content, color=color_value)
        embed.set_footer(text=f"{type_name} | Par {author}")
        if image_url:
            embed.set_image(url=image_url)

        await message.edit(embed=embed)
        logger.info(f"✅ Actualité mise à jour sur Discord (newsId={news_id})")

    # -----------------------------------------------------------------------
    # 🗑️ NEWS.DELETED
    # -----------------------------------------------------------------------
    async def _deleted(self, payload: dict):
        news_id = payload.get("newsId")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        logger.info(f"🧾 Suppression d'une actualité (newsId={news_id})")

        try:
            channel = self.bot.get_channel(int(channel_id))
            message = await channel.fetch_message(int(message_id))
            await message.delete()
            logger.info(f"🗑️ Actualité supprimée sur Discord (newsId={news_id})")
        except discord.NotFound:
            logger.warning("⚠️ Message déjà supprimé ou introuvable")
        except Exception as e:
            logger.exception(f"❌ Erreur lors de la suppression Discord : {e}")
