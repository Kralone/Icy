import discord
from discord.ext import commands
from utils.embeds import EmbedFactory
import aiohttp

class APIClient(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.api_base_url = "http://backend:8080"  # Remplace par l'URL de ton API

    async def api_request(self, method, endpoint, data=None, headers=None, ctx=None):
        url = f"{self.api_base_url}/{endpoint}"
        headers = headers or {"Content-Type": "application/json; charset=utf-8",
                              "Authorization": "Bot jK9LmN2pQ5VtYB8GhX4CsR7Md6wX9Jz3kLmN2pQ5VtYB8GhX4CsR7Md6wX9Jz"
                              }


        # print(f"[DEBUG] API request: {method} {url} {data} {headers}") #TODO Debug only
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=data, headers=headers) as response:

                response = await response.json()

                if response["httpCode"] == 500:
                    message = response["messageDetail"]['message']
                    title = response["messageDetail"]['title']
                    if ctx:
                        await ctx.send(embed=EmbedFactory.error_embed(title, message))
                        return

                return response

async def setup(bot):
    await bot.add_cog(APIClient(bot))
