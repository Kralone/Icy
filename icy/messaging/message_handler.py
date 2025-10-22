import logging
import json
import discord
import os
from utils.html_to_discord import html_to_discord

logger = logging.getLogger("icy.handler")


class MessageHandler:
    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit
        self.channel_id = int(os.getenv("DISCORD_NEWS_CHANNEL_ID", "0"))  # défini dans .env

    async def handle_message(self, routing_key: str, payload: dict):
        """Gère les messages entrants RabbitMQ."""
        logger.info(f"🔔 Nouveau message RabbitMQ ({routing_key})")
        logger.debug(json.dumps(payload, indent=2, ensure_ascii=False))

        if routing_key == "news.created":
            await self._handle_news_created(payload)
        elif routing_key == "news.deleted":
            await self._handle_news_deleted(payload)
        elif routing_key == "news.updated":
            await self._handle_news_updated(payload)
        else:
            logger.warning(f"Aucun handler pour la clé : {routing_key}")

    # 🧊 NEWS.CREATED : création d’un embed
    async def _handle_news_created(self, payload: dict):
        title = payload.get("title", "Sans titre")
        author = payload.get("author", "Inconnu")
        content = html_to_discord(payload.get("content", "Aucun contenu"))
        type_info = payload.get("type", {})
        image_url = type_info.get("imageUrl")
        type_name = type_info.get("name")
        type_color = type_info.get("color")

        # Convertir couleur hex → discord.Color
        color_value = None
        if isinstance(type_color, str):
            try:
                color_value = discord.Color(int(type_color.replace("#", ""), 16))
            except ValueError:
                logger.warning(f"Couleur invalide reçue : {type_color}")

        embed = discord.Embed(
            title=title,
            description=content,
            color=color_value or discord.Color.blue(),
        )
        embed.set_footer(text=f"{type_name} | Par {author}")
        if image_url:
            embed.set_image(url=image_url)

        # Envoi sur Discord
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error(f"⚠️ Salon introuvable pour ID={self.channel_id}")
            return

        message = await channel.send(embed=embed)
        logger.info(f"✅ Message publié dans #{channel.name} pour '{title}'")

        # Envoi retour backend (news.discordLinked)
        if self.rabbit:
            await self.rabbit.publish(
                "news.discordLinked",
                {
                    "newsId": payload["id"],
                    "messageId": message.id,
                    "channelId": message.channel.id,
                },
            )
            logger.info(f"📨 Événement RabbitMQ envoyé pour newsId={payload['id']}")

    # 🗑️ NEWS.DELETED : suppression du message Discord
    async def _handle_news_deleted(self, payload: dict):
        """Supprime un message Discord à partir de son ID et channel."""
        news_id = payload.get("newsId")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        logger.info(f"🧾 Suppression demandée pour newsId={news_id}, msg={message_id}, channel={channel_id}")

        try:
            channel = self.bot.get_channel(int(channel_id))
            if not channel:
                logger.error(f"⚠️ Channel introuvable ({channel_id})")
                return

            message = await channel.fetch_message(int(message_id))
            await message.delete()
            logger.info(f"🗑️ Message supprimé sur Discord (newsId={news_id})")

        except discord.NotFound:
            logger.warning(f"⚠️ Message introuvable sur Discord (peut-être déjà supprimé)")
        except Exception as e:
            logger.exception(f"❌ Erreur lors de la suppression Discord : {e}")


    # ✏️ NEWS.UPDATED : mise à jour du message Discord
    async def _handle_news_updated(self, payload: dict):
        """Met à jour un message Discord existant avec les nouvelles infos."""
        news_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        logger.info(f"✏️ Mise à jour demandée pour newsId={news_id}")

        try:
            channel = self.bot.get_channel(int(channel_id))
            if not channel:
                logger.error(f"⚠️ Channel introuvable ({channel_id})")
                return

            message = await channel.fetch_message(int(message_id))
            if not message:
                logger.warning(f"⚠️ Message non trouvé pour newsId={news_id}")
                return

            # Reconstruction de l’embed
            title = payload.get("title", "Sans titre")
            author = payload.get("author", "Inconnu")
            content = html_to_discord(payload.get("content", "Aucun contenu"))
            type_info = payload.get("type", {})
            image_url = type_info.get("imageUrl")
            type_name = type_info.get("name")
            type_color = type_info.get("color")

            color_value = None
            if isinstance(type_color, str):
                try:
                    color_value = discord.Color(int(type_color.replace("#", ""), 16))
                except ValueError:
                    logger.warning(f"Couleur invalide reçue : {type_color}")

            embed = discord.Embed(
                title=title,
                description=content,
                color=color_value or discord.Color.blue(),
            )
            embed.set_footer(text=f"{type_name} | Par {author}")
            if image_url:
                embed.set_image(url=image_url)

            # Édition du message existant
            await message.edit(embed=embed)
            logger.info(f"✅ Message mis à jour sur Discord (newsId={news_id})")

        except discord.NotFound:
            logger.warning(f"⚠️ Message à mettre à jour introuvable (newsId={news_id})")
        except Exception as e:
            logger.exception(f"❌ Erreur lors de la mise à jour Discord : {e}")
