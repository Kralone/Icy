import discord
from discord.ext import commands
from discord.ui import View
from datetime import datetime
import asyncio

class EventManager(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        # Assure-toi que api_client est bien injecté ou initialisé ici ou via le bot
        self.api_client = getattr(bot, "api_client", None)

    @commands.command(name="create_event")
    async def create_event(self, ctx):
        """Lance la procédure de création d'événement."""
        embed = discord.Embed(
            title="📝 Création d'un événement",
            description="Je vais vous poser quelques questions. Répondez simplement dans le chat.",
            color=discord.Color.blue()
        )
        view = EventCreationView(ctx, self.api_client)
        view.message = await ctx.send(embed=embed, view=view)

        # On lance le questionnaire
        await view.ask_next(ctx)

class EventCreationView(View):
    def __init__(self, ctx, api_client):
        super().__init__(timeout=300)
        self.ctx = ctx
        self.author = ctx.author
        self.api_client = api_client
        self.message = None

        self.data = {}
        self.step = 0
        self.steps = ["title", "description", "date"]

        self.prompts = {
            "title": "Titre de l'événement",
            "description": "Description courte",
            # ICI : On demande explicitement l'heure pour éviter le 00h00 par défaut
            "date": "Date et Heure (format `YYYY-MM-DD HH:MM`)\n*Exemple : 2026-05-20 21:00*"
        }

    async def get_response(self, ctx):
        """Attend une réponse de l'utilisateur qui a lancé la commande."""
        def check(m):
            return m.author == ctx.author and m.channel == ctx.channel

        try:
            msg = await ctx.bot.wait_for('message', check=check, timeout=120.0)
            return msg.content
        except asyncio.TimeoutError:
            await ctx.send("⏱️ Temps écoulé ! La création d'événement est annulée.")
            return None

    async def ask_next(self, ctx):
        if self.step < len(self.steps):
            current_step = self.steps[self.step]
            prompt_text = self.prompts[current_step]

            await ctx.send(f"👉 **{prompt_text}** :")

            response = await self.get_response(ctx)

            # Si timeout ou erreur
            if response is None:
                return

            # Validation spécifique pour la date
            if current_step == "date":
                try:
                    # On vérifie si le format est valide tout de suite
                    datetime.strptime(response, "%Y-%m-%d %H:%M")
                except ValueError:
                    await ctx.send("❌ Format de date invalide. Merci d'utiliser `YYYY-MM-DD HH:MM` (ex: 2026-05-20 21:00).")
                    # On relance la même étape sans incrémenter self.step
                    await self.ask_next(ctx)
                    return

            self.data[current_step] = response
            self.step += 1
            await self.ask_next(ctx)
        else:
            await self.save_event(ctx)

    async def save_event(self, ctx):
        """Formate les données et envoie à l'API."""
        if not self.api_client:
            await ctx.send("❌ Erreur interne : Client API non connecté.")
            return

        # Transformation de la date String vers ISO 8601 pour l'API
        # L'input est genre "2026-05-20 21:00" -> On veut "2026-05-20T21:00:00"
        date_str = self.data["date"]
        try:
            dt_obj = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
            iso_date = dt_obj.isoformat()
        except ValueError:
            iso_date = date_str # Fallback (ne devrait pas arriver grâce à la validation)

        event_data = {
            "name": self.data["title"],
            "description": self.data["description"],
            "date": iso_date
        }

        # Envoi (simulation de la méthode post)
        try:
            response = await self.api_client.post("/events/create", event_data)

            if response: # Tu devras adapter selon ce que renvoie vraiment ton api_client (status code, json, boolean ?)
                pretty_date = dt_obj.strftime("%d/%m/%Y à %Hh%M")
                await ctx.send(f"✅ Événement **{self.data['title']}** créé pour le {pretty_date} !")
            else:
                await ctx.send("❌ L'API a refusé la création de l'événement.")
        except Exception as e:
            await ctx.send(f"❌ Une erreur technique est survenue : {e}")

async def setup(bot):
    await bot.add_cog(EventManager(bot))
    print("🚧 EventManager chargé")