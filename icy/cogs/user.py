import discord
from discord.ext import commands
from utils.util import Util
from utils.embeds import EmbedFactory

util = Util()
ALLOWED_ROLE_IDS = util.get_allowed_roles()     #TODO Envoyer au back

class UserCog(commands.Cog):
    def __init__(self, bot):
        self.api_cog = bot.get_cog("APIClient")
        self.bot = bot

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