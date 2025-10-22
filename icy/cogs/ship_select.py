# import traceback
# import discord
# from discord.ext import commands
# import json
# from utils.embeds import EmbedFactory
#
# class ShipSelectionView(discord.ui.View):
#     def __init__(self, api_client, brands, selected_brand=None, ships=None, selected_ship=None):
#         super().__init__(timeout=180)  # Temps limite d'interaction
#         self.api_client = api_client
#         self.brands = brands
#         self.selected_brand = selected_brand
#         self.ships = ships if ships else []
#         self.selected_ship = selected_ship
#
#         self.brand_select = discord.ui.Select(
#             placeholder="Sélectionnez une marque",
#             min_values=1,
#             max_values=1,
#             options=[discord.SelectOption(label=brand["name"], value=brand["name"], default=(brand["name"] == self.selected_brand)) for brand in brands],
#             custom_id="select_brand"
#         )
#         self.brand_select.callback = self.select_brand
#         self.add_item(self.brand_select)
#
#         self.ship_select = discord.ui.Select(
#             placeholder="Sélectionnez un vaisseau",
#             min_values=1,
#             max_values=1,
#             options=[discord.SelectOption(label="Aucun vaisseau disponible", value="none")],
#             disabled=True,
#             custom_id="select_ship"
#         )
#         self.ship_select.callback = self.select_ship
#         self.add_item(self.ship_select)
#
#     async def fetch_brand_image(self, brand_name):
#         return next((brand["imageUrl"] for brand in self.brands if brand["name"] == self.selected_brand), None)
#
#     async def select_brand(self, interaction: discord.Interaction):
#         try:
#             await interaction.response.defer()  # Accuse réception de l'interaction
#
#             self.selected_brand = self.brand_select.values[0]
#             print(f"[DEBUG] Marque sélectionnée: {self.selected_brand}")
#
#             response = await self.api_client.api_request("GET", f"api/ships/shipsByBrand?brand={self.selected_brand}")
#             self.ships = response.get("data", []) if response else []
#             print(f"[DEBUG] Vaisseaux récupérés: {self.ships}")
#
#             ship_options = [
#                 discord.SelectOption(label=ship['name'], value=str(ship['id']))
#                 for ship in self.ships
#             ] if self.ships else [discord.SelectOption(label="Aucun vaisseau disponible", value="none")]
#
#             self.ship_select.options = ship_options
#             self.ship_select.disabled = not bool(self.ships)
#
#             self.brand_select.options = [
#                 discord.SelectOption(label=brand["name"], value=brand["name"], default=(brand["name"] == self.selected_brand))
#                 for brand in self.brands
#             ]
#
#             embed = discord.Embed(
#                 title=f"Sélection des vaisseaux de {self.selected_brand}",
#                 description="Veuillez choisir un vaisseau dans la liste.",
#                 color=discord.Color.blue()
#             )
#             embed.set_image(url=await self.fetch_brand_image(self.selected_brand))
#
#             await interaction.edit_original_response(embed=embed, view=self)
#         except Exception as e:
#             print(f"Une erreur s'est produite : {e}")
#
#     async def select_ship(self, interaction: discord.Interaction):
#         await interaction.response.defer()
#
#         self.selected_ship = self.ship_select.values[0]
#         print(f"[DEBUG] Vaisseau sélectionné: {self.selected_ship}")
#
#         # Trouver les détails du vaisseau sélectionné
#         selected_ship_data = next((ship for ship in self.ships if str(ship["id"]) == self.selected_ship), None)
#
#         if selected_ship_data:
#             ship_image_url = selected_ship_data.get("imageUrl", None)
#             brand_image_url = await self.fetch_brand_image(self.selected_brand)
#         else:
#             ship_image_url = None
#
#
#
#     # Envoyer les données au backend
#         payload = {"shipId": self.selected_ship, "discordId": interaction.user.id}
#         response = await self.api_client.api_request("POST", "api/user-ships", payload)
#         print(f"[DEBUG] Réponse API après envoi des données: {response}")
#
#         message = response["messageDetail"]['message']
#         title = response["messageDetail"]['title']
#
#         try:
#
#             print(f"Value de interaction.message: {interaction.message}")
#             if response.get("httpCode") == 201:
#                 await interaction.edit_original_response(embed=EmbedFactory.success_embed(title, message, ship_image_url, brand_image_url), view=None)
#             else:
#                 await interaction.edit_original_response(embed=EmbedFactory.error_embed(title, message, ship_image_url, brand_image_url), view=None)
#         except Exception as e:
#             print(f"Une erreur s'est produite : {e}")
#
# class ShipSelectionCog(commands.Cog):
#     def __init__(self, bot):
#         self.bot = bot
#         self.api_client = bot.get_cog("APIClient")
#
#     @commands.hybrid_command(name="select_ship")
#     async def select_ship(self, ctx: commands.Context):
#         print("[DEBUG] Envoi de la requête pour récupérer les marques de vaisseaux")
#         response = await self.api_client.api_request("GET", "api/ships/brands/images")
#
#         brands = response.get("data", []) if response else []
#         print(f"[DEBUG] Marques récupérées: {brands}")
#
#         if not brands:
#             await ctx.send("Aucune marque de vaisseau disponible.", ephemeral=True)
#             return
#
#         embed = discord.Embed(
#             title="Liste des Marques de Vaisseaux",
#             description="Veuillez sélectionner une marque dans la liste ci-dessous :",
#             color=discord.Color.blue()
#         )
#
#         view = ShipSelectionView(self.api_client, brands)
#         await ctx.send(embed=embed, view=view, ephemeral=True)
#
async def setup(bot):
    return
