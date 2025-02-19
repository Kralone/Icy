import discord
from discord.ext import commands

class APITest(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.api_cog = bot.get_cog("APIClient")

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return  # Ignore les messages des bots

        response = await self.api_cog.api_request("GET", "api/users/190174996235026433")
        await message.channel.send(f"Réponse API automatique: {response}")


async def setup(bot):
    await bot.add_cog(APITest(bot))