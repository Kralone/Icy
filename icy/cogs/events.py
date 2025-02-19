import discord
from discord.ext import commands
from discord.ui import View, Button
import uuid
from datetime import datetime
import asyncio

class EventManager(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.api_client = None

    async def create_event(self, ctx):
        embed = discord.Embed(
            title="📝 Création d'un événement",
            description="Répondez simplement dans le chat pour renseigner les informations.",
            color=discord.Color.blue()
        )
        view = EventCreationView(ctx, self.api_client)
        message = await ctx.send(embed=embed, view=view)
        view.message = message
        await view.ask_next(ctx)

class EventCreationView(View):
    def __init__(self, ctx, api_client):
        super().__init__(timeout=300)
        self.ctx = ctx
        self.author = ctx.author
        self.data = {}
        self.step = 0
        self.steps = ["title", "description", "date"]
        self.prompts = {
            "title": "Titre",
            "description": "Description",
            "date": "Date (format YYYY-MM-DD)"
        }
        self.message = None

        self.api_client = api_client

    async def ask_next(self, ctx):
        if self.step < len(self.steps):
            current_step = self.steps[self.step]
            prompt = f"Veuillez entrer {self.prompts[current_step].lower()} :"
            await ctx.send(prompt)
            response = await self.get_response(ctx)
            if response is None:
                return

            self.data[current_step] = response
            self.step += 1
            await self.ask_next(ctx)
        else:
            await self.save_event(ctx)

    async def save_event(self, ctx):
        event_data = {
            "name": self.data["title"],
            "description": self.data["description"],
            "date": self.data["date"]
        }
        response = await self.api_client.post("/events/create", event_data)
        if response:
            await ctx.send(f"✅ Événement '{self.data['title']}' créé avec succès!")
        else:
            await ctx.send("❌ Une erreur s'est produite lors de la création de l'événement.")

async def setup(bot):
    await bot.add_cog(EventManager(bot))
    print("🚧 EventManager en chantier")
