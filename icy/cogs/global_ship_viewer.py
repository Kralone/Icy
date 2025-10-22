import discord
from discord.ext import commands
from db import get_fleet_summary

class GlobalShipViewer(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    # @commands.hybrid_command(name="fleet_summary", description="Affiche un résumé des vaisseaux de tous les membres du groupe, classé par focus.")
    # async def fleet_summary(self, ctx):
    #     print(f"[DEBUG] Command 'fleet_summary' called by {ctx.author.id}")
    #
    #     # Appel à l'API
    #     response = await self.bot.get_cog("APIClient").api_request("GET", "api/user-ships/fleet-summary")
    #
    #     if not response or response["httpCode"] != 200:
    #         print("[DEBUG] Erreur lors de la récupération des données de flotte.")
    #         await ctx.send("Impossible de récupérer le résumé de la flotte.", ephemeral=True)
    #         return
    #
    #     fleet_summary = response["data"]
    #     if not fleet_summary:
    #         print("[DEBUG] Aucun vaisseau trouvé.")
    #         await ctx.send("Aucun vaisseau enregistré dans la base de données.", ephemeral=True)
    #         return
    #
    #     embed = discord.Embed(
    #         title="🛸 Flotte des membres IceForge",
    #         color=discord.Color.blue()
    #     )
    #     embed.set_image(url="https://i.ytimg.com/vi/jyOOhMK24Lk/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLC9hReO5er-J2jaih_bbRsVPXJQ3Q")
    #
    #     for focus, ships in fleet_summary.items():
    #         ship_list = "\n".join([f"- {ship}" for ship in ships])
    #         embed.add_field(name=f"**{focus}**", value=ship_list, inline=False)
    #
    #     await ctx.send(embed=embed)

async def setup(bot):
    await bot.add_cog(GlobalShipViewer(bot))
