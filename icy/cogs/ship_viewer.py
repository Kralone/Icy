import discord
from discord.ext import commands
from utils.embeds import EmbedFactory

class ShipViewer(discord.ui.View):
    def __init__(self, api_cog, discord_id):
        super().__init__(timeout=180)
        self.api_cog = api_cog
        self.discord_id = discord_id
        self.ships = []
        self.index = 0

    async def fetch_ships(self):
        response = await self.api_cog.api_request("GET", f"api/user-ships?discordId={self.discord_id}")

        if response and response["httpCode"] == 200:
            self.ships = response["data"]
        else:
            self.ships = []

        if not self.ships:
            self.disable_all()

    def disable_all(self):
        for item in self.children:
            item.disabled = True

    def get_embed(self):
        if not self.ships:
            return EmbedFactory.error_embed("Erreur", "Vous n'avez aucun vaisseau attribué.")

        ship = self.ships[self.index]
        embed = EmbedFactory.info_embed(
            title="Vos vaisseaux :",
            description=f"**{ship['name']}** de **{ship['brand']['name']}**",
            image_url=ship['imageUrl'],
            thumbnail_url=ship['brand']['imageUrl']
        )
        return embed

    @discord.ui.button(label="⬅️", style=discord.ButtonStyle.primary)
    async def previous_ship(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.index = (self.index - 1) % len(self.ships)
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

    @discord.ui.button(label="🗑️", style=discord.ButtonStyle.danger)
    async def delete_ship(self, interaction: discord.Interaction, button: discord.ui.Button):
        ship_id = self.ships[self.index]['id']
        response = await self.api_cog.api_request("DELETE", f"api/user-ships?discordId={interaction.user.id}&shipId={ship_id}")

        if response and response["httpCode"] == 200:
            self.ships.pop(self.index)
            if not self.ships:
                await interaction.response.edit_message(embed=self.get_embed(), view=None)
            else:
                self.index %= len(self.ships)
                await interaction.response.edit_message(embed=self.get_embed(), view=self)
        else:
            await interaction.response.send_message("Erreur lors de la suppression du vaisseau.", ephemeral=True)

    @discord.ui.button(label="➡️", style=discord.ButtonStyle.primary)
    async def next_ship(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.index = (self.index + 1) % len(self.ships)
        await interaction.response.edit_message(embed=self.get_embed(), view=self)

class ShipEmbedCog(commands.Cog):
    def __init__(self, bot):
        self.api_cog = bot.get_cog("APIClient")
        self.bot = bot

    @commands.hybrid_command(name="ships_list", description="Affiche la liste de vos vaisseaux.")
    async def show_ships(self, ctx):
        view = ShipViewer(self.api_cog, ctx.author.id)
        await view.fetch_ships()
        await ctx.send(embed=view.get_embed(), view=view, ephemeral=True)

async def setup(bot):
    await bot.add_cog(ShipEmbedCog(bot))
