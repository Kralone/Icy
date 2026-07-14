import os
import socket
import sys
import discord
import asyncio
import logging
from discord.ext import commands
from dotenv import load_dotenv
from messaging.rabbit_manager import RabbitManager
from utils.vault_loader import load_vault_secrets_into_env


# --- CONFIG LOGGING GLOBALE ---
logging.basicConfig(
    level=logging.DEBUG if os.getenv("ENV_MODE", "development") == "development" else logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Réduit le bruit de certains loggers
for logger_name in ["discord", "aio_pika", "asyncio"]:
    logging.getLogger(logger_name).setLevel(logging.INFO)

logger = logging.getLogger("icy.bot")
logger.info("🔧 Logging initialisé.")


# Charge automatiquement le .env uniquement si présent (utile en local)
load_dotenv()
# Charge ensuite les secrets depuis Vault (prioritaires) si activé
load_vault_secrets_into_env()
env_mode = os.getenv("ENV_MODE", "development")
logger.info(f"🌍 Mode: {env_mode.upper()}")

# Récupération des variables
token = os.getenv("DISCORD_TOKEN")
guild_id_str = os.getenv("GUILD_ID")

# --- RabbitMQ config ---
rabbit_host = os.getenv("RABBITMQ_HOST", "localhost")
rabbit_port = os.getenv("RABBITMQ_PORT", "5672")
rabbit_user = os.getenv("RABBITMQ_USER", "icy")
rabbit_pass = os.getenv("RABBITMQ_PSWD", "icy123")

rabbit_url = f"amqp://{rabbit_user}:{rabbit_pass}@{rabbit_host}:{rabbit_port}/"
logger.info("🔌 Configuration RabbitMQ chargée : %s:%s (utilisateur: %s)", rabbit_host, rabbit_port, rabbit_user)


# Vérifications préliminaires
if not token:
    logger.error("❌ Variable d'environnement DISCORD_TOKEN manquante. Vérifie ton .env ou ton env_file Docker.")
    sys.exit(1)

if not guild_id_str:
    logger.error("❌ Variable d'environnement GUILD_ID manquante.")
    sys.exit(1)

try:
    guild_id = int(guild_id_str)
except ValueError:
    logger.error(f"❌ GUILD_ID invalide : '{guild_id_str}' (doit être un entier).")
    sys.exit(1)

logger.info("✅ Variables d'environnement chargées avec succès.")


# --- CONFIG DISCORD ---
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="/", intents=intents)


async def setup():
    """Charge dynamiquement tous les COGs"""
    cogs_dir = "cogs"
    for filename in os.listdir(cogs_dir):
        if filename.endswith(".py") and not filename.startswith("__"):
            cog_name = f"{cogs_dir}.{filename[:-3]}"
            try:
                await bot.load_extension(cog_name)
                logger.info(f"✅ Cog chargé : {cog_name}")
            except Exception as e:
                logger.exception(f"❌ Erreur lors du chargement de {cog_name}: {e}")


@bot.event
async def on_ready():
    logger.info(f"✅ Connecté en tant que {bot.user}")
    logger.info(f"🔍 Cogs actifs: {list(bot.cogs.keys())}")

    # Connexion à RabbitMQ
    await wait_for_rabbitmq(host=rabbit_host, port=int(rabbit_port))
    rabbit = RabbitManager(rabbit_url, bot)
    connected = await rabbit.connect()
    if connected:
        logger.info("🐇 RabbitMQ connecté et en écoute.")
        try:
            await rabbit.handler.event_handler.restore_event_views()
        except Exception as e:
            logger.exception(f"❌ Erreur pendant la restauration des boutons d'events: {e}")
    else:
        logger.error("❌ RabbitMQ non opérationnel: consommation désactivée.")

    # Synchronisation des commandes slash
    try:
        synced = await bot.tree.sync(guild=discord.Object(id=guild_id))
        logger.info(f"🔃 {len(synced)} commande(s) slash synchronisée(s): {[cmd.name for cmd in synced]}")
    except Exception as e:
        logger.exception("❌ Erreur lors de la synchronisation des commandes slash.")


async def wait_for_rabbitmq(host, port, timeout: int = 10):

    logger.debug(f"⏳ Vérification de la disponibilité de RabbitMQ sur {host}:{port}")

    for attempt in range(1, timeout + 1):
        try:
            with socket.create_connection((host, port), timeout=2):
                logger.info(f"✅ RabbitMQ est prêt (tentative {attempt})")
                return True
        except Exception as e:
            logger.warning(f"⏳ En attente de RabbitMQ... (tentative {attempt})")
            logger.debug(f"Détail : {repr(e)}")
            await asyncio.sleep(2)

    logger.error(f"❌ RabbitMQ n'est pas accessible après {timeout * 2}s sur {host}:{port}")
    sys.exit(1)


@bot.event
async def on_command_error(ctx, error):
    logger.error(f"❌ Erreur de commande: {error}")


async def main():
    async with bot:
        await setup()
        await bot.start(token)


if __name__ == "__main__":
    asyncio.run(main())
