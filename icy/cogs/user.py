import logging

import discord
from discord import app_commands
from discord.ext import commands

from utils.embeds import EmbedFactory


logger = logging.getLogger("icy.user_command")

USER_ROLES = [
    app_commands.Choice(name="Junior", value="JUNIOR"),
    app_commands.Choice(name="Associé", value="ASSOCIE"),
    app_commands.Choice(name="Ingénieur", value="INGENIEUR"),
    app_commands.Choice(name="Spécialiste", value="SPECIALISTE"),
    app_commands.Choice(name="Officier", value="OFFICIER"),
    app_commands.Choice(name="Administrateur", value="ADMIN"),
]

class UserCog(commands.Cog):
    def __init__(self, bot):
        self.api_cog = bot.get_cog("APIClient")
        self.bot = bot

    @app_commands.command(
        name="ajouter_utilisateur",
        description="Ajoute un membre Discord au système IceForge.",
    )
    @app_commands.describe(
        utilisateur="Membre Discord à ajouter",
        role="Grade IceForge à attribuer",
        pseudo="Pseudo IceForge (le handle Discord est utilisé par défaut)",
    )
    @app_commands.choices(role=USER_ROLES)
    @app_commands.default_permissions(administrator=True)
    @app_commands.checks.has_permissions(administrator=True)
    @app_commands.guild_only()
    async def ajouter_utilisateur(
        self,
        interaction: discord.Interaction,
        utilisateur: discord.Member,
        role: app_commands.Choice[str],
        pseudo: str | None = None,
    ):
        """Create an IceForge account and trigger the temporary-password DM."""
        await interaction.response.defer(ephemeral=True)

        username = (pseudo if pseudo is not None else utilisateur.name).strip()
        if not username or len(username) > 50:
            await interaction.followup.send(
                "Le pseudo doit contenir entre 1 et 50 caractères.",
                ephemeral=True,
            )
            return

        response = await self.api_cog.api_request(
            "POST",
            "api/users/bot/create",
            {
                "discordId": str(utilisateur.id),
                "username": username,
                "role": role.value,
            },
        )

        if response is None:
            await interaction.followup.send(
                embed=EmbedFactory.error_embed(
                    "Service indisponible",
                    "Impossible de créer le compte pour le moment. Réessaie plus tard.",
                ),
                ephemeral=True,
            )
            return

        message_detail = response.get("messageDetail") or {}
        title = message_detail.get("title", "Création d'utilisateur")
        message = message_detail.get("message", "La demande n'a pas pu être traitée.")

        if response.get("httpCode") == 201:
            await interaction.followup.send(
                embed=EmbedFactory.success_embed(
                    title,
                    f"{message}\nUn message privé avec ses accès a été envoyé à {utilisateur.mention}.",
                ),
                ephemeral=True,
            )
            return

        logger.info(
            "Création Discord refusée (status=%s, discord_id=%s)",
            response.get("httpCode"),
            utilisateur.id,
        )
        await interaction.followup.send(
            embed=EmbedFactory.error_embed(title, message),
            ephemeral=True,
        )

    # @commands.hybrid_command(name="register_user", description="Enregistre un utilisateur dans la base de données.")
    # async def register_user_command(self, ctx, member: discord.Member = None):
    #     if member is None:
    #         member = ctx.author
    #
    #     response = await self.api_cog.api_request("POST", "api/users/create", {"discordId": member.id, "username": member.name})
    #
    #     print(f"[DEBUG] Response: {response["httpCode"]}, {response["messageDetail"]['message']}")
    #
    #     message = response["messageDetail"]['message']
    #     title = response["messageDetail"]['title']
    #
    #     if response["httpCode"] == 201:
    #         await ctx.send(embed=EmbedFactory.success_embed(title, message))
    #     elif response["httpCode"] == 409:
    #         await ctx.send(embed=EmbedFactory.error_embed(title, message))
    #
    #
    #
    # @commands.hybrid_command(name="remove_user", description="Supprime un utilisateur de la base de données.")
    # async def remove_user_command(self, ctx, member: discord.Member = None):
    #     if member is None:
    #         await ctx.send(embed=EmbedFactory.error_embed("Veuillez spécifier un utilisateur à supprimer."))
    #         return
    #
    #     # Suppression de l'utilisateur
    #     response = await self.api_cog.api_request("DELETE", f"api/users?discordId={member.id}", ctx=ctx)
    #     if not response:
    #         return
    #
    #     message = response["messageDetail"]['message']
    #     title = response["messageDetail"]['title']
    #
    #     if response["httpCode"] == 200:
    #         await ctx.send(embed=EmbedFactory.success_embed(title, message))
    #     elif response["httpCode"] == 404:
    #         await ctx.send(embed=EmbedFactory.error_embed(title, message))


async def setup(bot):
    await bot.add_cog(UserCog(bot))
