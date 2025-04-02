import os
import discord
from discord.ext import commands
import asyncio
from dotenv import load_dotenv
import threading
from utils.bot_api import launch_api

env_mode = os.getenv("ENV_MODE", "development")  # Valeur par défaut : "development"

# Sélectionner le bon fichier .env à charger
env_file = ".env.prod" if env_mode == "production" else ".env"

print(f"[LOG] Running in '{env_mode.upper()}' mode")
print(f"[LOG] Loading environment variables from '{env_file}'")

# Charger les variables d'environnement
load_dotenv(dotenv_path=env_file)

token = os.getenv("DISCORD_TOKEN")
guild_id = int(os.getenv("GUILD_ID"))

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="/", intents=intents)

async def setup():
    # Charger tous les cogs présents dans le dossier "cogs"
    cogs_dir = "cogs"
    for filename in os.listdir(cogs_dir):
        if filename.endswith(".py") and not filename.startswith("__"):
            cog_name = f"{cogs_dir}.{filename[:-3]}"
            try:
                await bot.load_extension(cog_name)
                print(f"✅ Cog chargé : {cog_name}")
            except Exception as e:
                print(f"❌ Erreur lors du chargement de {cog_name} : {e}")

@bot.event
async def on_ready():
    print(f"✅ Connecté en tant que {bot.user}")
    print("🔍 Cogs chargés :", bot.cogs.keys())  # Affiche tous les cogs chargés
    threading.Thread(target=launch_api, args=(bot,), daemon=True).start()

    try:
        synced = await bot.tree.sync(guild=discord.Object(id=guild_id))
        print(f"🔃 {len(synced)} commande(s) slash synchronisée(s) avec succès dans la guilde {guild_id} :")
        # Afficher la liste des noms des commandes synchronisées
        for command in synced:
            print(f"   • {command.name}")
    except Exception as e:
        print(f"❌ Erreur lors de la synchronisation des commandes slash : {e}")


@bot.event
async def on_command_error(ctx, error):
    print(f"❌ Erreur inconnue : {str(error)}")

async def main():
    async with bot:
        await setup()
        await bot.start(token)

asyncio.run(main())
