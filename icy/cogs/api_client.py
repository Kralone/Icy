import os

import aiohttp
from discord.ext import commands

from utils.embeds import EmbedFactory


class APIClient(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.api_base_url = os.getenv("BACKEND_API_URL", "http://backend:8080").rstrip("/")
        api_key = os.getenv("BOT_API_KEY")
        if not api_key:
            raise RuntimeError("BOT_API_KEY is required for backend requests")
        self.default_headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bot {api_key}",
        }

    async def api_request(self, method, endpoint, data=None, headers=None, ctx=None):
        url = f"{self.api_base_url}/{endpoint}"
        request_headers = {**self.default_headers, **(headers or {})}

        # print(f"[DEBUG] API request: {method} {url} {data} {headers}") #TODO Debug only
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=data, headers=request_headers) as response:

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
