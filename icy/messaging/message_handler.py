import logging
import json
from messaging.news_handler import NewsHandler
from messaging.event_handler import EventHandler  # à venir
from messaging.user_handler import UserHandler  # 👈 nouveau import

logger = logging.getLogger("icy.handler")


class MessageHandler:
    """Dispatch des messages RabbitMQ vers le handler métier approprié."""

    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit

        # Enregistre les sous-handlers
        self.news_handler = NewsHandler(bot, rabbit)
        self.event_handler = EventHandler(bot, rabbit)  # sera ajouté plus tard
        self.user_handler = UserHandler(bot)  # 👈 ajouté

    async def handle_message(self, routing_key: str, payload: dict):
        logger.info(f"🔔 Message RabbitMQ reçu ({routing_key})")
        logger.debug(json.dumps(payload, indent=2, ensure_ascii=False))

        # --- NEWS ---
        if routing_key.startswith("news."):
            await self.news_handler.handle(routing_key, payload)

        # --- EVENTS ---
        elif routing_key.startswith("events."):
            await self.event_handler.handle(routing_key, payload)

        # --- USERS ---
        elif routing_key.startswith("users."):
            await self.user_handler.handle(routing_key, payload)

        # --- AUCUN MATCH ---
        else:
            logger.warning(f"Aucun handler trouvé pour la clé : {routing_key}")
