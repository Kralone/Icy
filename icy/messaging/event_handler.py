import os
import discord
from discord import ui, ButtonStyle
from utils.html_to_discord import html_to_discord
import logging

logger = logging.getLogger("icy.event_handler")


class EventHandler:
    def __init__(self, bot, rabbit):
        self.bot = bot
        self.rabbit = rabbit
        self.channel_id = int(os.getenv("DISCORD_EVENTS_CHANNEL_ID", "0"))

    async def handle(self, routing_key: str, payload: dict):
        """Redirige les sous-événements event.* vers les bonnes fonctions."""
        if routing_key == "news.discordLinked":
            logger.debug("↩️ Ignoré (retour backend).")
            return

        if routing_key == "events.created":
            await self.handle_event_created(payload)
        elif routing_key == "events.updated":
            await self.handle_event_updated(payload)
        elif routing_key == "events.deleted":
            await self.handle_event_deleted(payload)
        elif routing_key == "events.ended":
            await self.handle_event_ended(payload)  # 🧊 nouveau
        else:
            logger.warning(f"⚠️ Clé inconnue pour EventHandler : {routing_key}")


    async def handle_event_ended(self, payload: dict):
        """Met à jour le message Discord pour signaler la fin de l'événement."""
        event_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        if not (channel_id and message_id):
            logger.warning(f"⚠️ Données incomplètes pour event.ended ({event_id})")
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            return

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

        logger.info(f"🏁 Événement terminé et mis à jour sur Discord (eventId={event_id})")

    async def handle_event_created(self, payload: dict):
        title = payload.get("title", "Sans titre")
        description = html_to_discord(payload.get("description", ""))
        creator = payload.get("author", "Inconnu")
        date = payload.get("date", "Date inconnue")

        type_info = payload.get("type", {}) or {}
        image_url = type_info.get("imageUrl")
        type_name = type_info.get("name", "Événement")
        type_color = type_info.get("color")

        color_value = discord.Color(int(type_color.replace("#", ""), 16)) if type_color else discord.Color.blue()

        participants = payload.get("participants", [])
        confirmed = [p["username"] for p in participants if p["status"] == 1]
        maybe = [p["username"] for p in participants if p["status"] == 0]
        refused = [p["username"] for p in participants if p["status"] == -1]

        def fmt_list(lst):
            return "\n".join(lst) if lst else "–"

        embed = discord.Embed(
            title=f"{type_name} : {title}",
            description=f"📅 **Date :** {date}\n\n💬 {description}",
            color=color_value,
        )
        embed.add_field(name="✅ Confirmés", value=fmt_list(confirmed), inline=True)
        embed.add_field(name="❔ Peut-être", value=fmt_list(maybe), inline=True)
        embed.add_field(name="❌ Refusés", value=fmt_list(refused), inline=True)
        embed.set_footer(text=f"Créé par {creator}")
        if image_url:
            embed.set_image(url=image_url)

        view = EventParticipationView(self.rabbit, payload["id"])

        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            logger.error(f"⚠️ Salon introuvable (ID={self.channel_id})")
            return

        message = await channel.send(embed=embed, view=view)
        logger.info(f"✅ Événement '{title}' publié dans #{channel.name}")

        await self.rabbit.publish(
            "event.discordLinked",
            {
                "eventId": payload["id"],
                "messageId": message.id,
                "channelId": message.channel.id,
            },
        )

    async def handle_event_updated(self, payload: dict):
        event_id = payload.get("id")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        if not (channel_id and message_id):
            logger.warning(f"⚠️ Données incomplètes pour event.updated ({event_id})")
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            return

        try:
            message = await channel.fetch_message(int(message_id))
        except discord.NotFound:
            logger.warning(f"⚠️ Message introuvable pour event {event_id}")
            return

        title = payload.get("title", "Sans titre")
        description = html_to_discord(payload.get("description", ""))
        creator = payload.get("author", "Inconnu")
        date = payload.get("date", "Date inconnue")

        type_info = payload.get("type", {}) or {}
        image_url = type_info.get("imageUrl")
        type_name = type_info.get("name", "Événement")
        type_color = type_info.get("color")

        color_value = discord.Color(int(type_color.replace("#", ""), 16)) if type_color else discord.Color.blue()

        participants = payload.get("participants", [])
        confirmed = [p["username"] for p in participants if p["status"] == 1]
        maybe = [p["username"] for p in participants if p["status"] == 0]
        refused = [p["username"] for p in participants if p["status"] == -1]

        def fmt_list(lst):
            return "\n".join(lst) if lst else "–"

        embed = discord.Embed(
            title=f"{type_name} : {title}",
            description=f"📅 **Date :** {date}\n\n💬 {description}",
            color=color_value,
        )
        embed.add_field(name="✅ Confirmés", value=fmt_list(confirmed), inline=True)
        embed.add_field(name="❔ Peut-être", value=fmt_list(maybe), inline=True)
        embed.add_field(name="❌ Refusés", value=fmt_list(refused), inline=True)
        embed.set_footer(text=f"Créé par {creator}")
        if image_url:
            embed.set_image(url=image_url)

        view = EventParticipationView(self.rabbit, event_id)
        await message.edit(embed=embed, view=view)
        logger.info(f"✏️ Événement mis à jour dans #{channel.name} ({title})")

    async def handle_event_deleted(self, payload: dict):
        event_id = payload.get("eventId")
        channel_id = payload.get("channelId")
        message_id = payload.get("messageId")

        if not (channel_id and message_id):
            logger.warning(f"⚠️ Données incomplètes pour event.deleted ({event_id})")
            return

        channel = self.bot.get_channel(int(channel_id))
        if not channel:
            logger.error(f"⚠️ Channel introuvable ({channel_id})")
            return

        try:
            message = await channel.fetch_message(int(message_id))
            await message.delete()
            logger.info(f"🗑️ Événement supprimé de Discord (eventId={event_id})")
        except Exception as e:
            logger.exception(f"❌ Erreur lors de la suppression de l’event Discord : {e}")


# --- Classe View pour les boutons ---
class EventParticipationView(ui.View):
    def __init__(self, rabbit, event_id):
        super().__init__(timeout=None)
        self.rabbit = rabbit
        self.event_id = event_id

    @ui.button(label="Participer ✅", style=ButtonStyle.success, custom_id="event_confirm")
    async def confirm(self, interaction: discord.Interaction, button: ui.Button):
        await self._send_participation(interaction, 1)

    @ui.button(label="Peut-être ❔", style=ButtonStyle.secondary, custom_id="event_maybe")
    async def maybe(self, interaction: discord.Interaction, button: ui.Button):
        await self._send_participation(interaction, 0)

    @ui.button(label="Refuser ❌", style=ButtonStyle.danger, custom_id="event_decline")
    async def decline(self, interaction: discord.Interaction, button: ui.Button):
        await self._send_participation(interaction, -1)

    async def _send_participation(self, interaction: discord.Interaction, status: int):
        await interaction.response.defer(ephemeral=True)
        await self.rabbit.publish(
            "events.participation",
            {
                "eventId": self.event_id,
                "userId": interaction.user.id,
                "username": interaction.user.name,
                "status": status,
            },
        )
        await interaction.followup.send(
            "✅ Votre choix a été enregistré !",
            ephemeral=True,
        )
