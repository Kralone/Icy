import logging
import json
from messaging.news_handler import NewsHandler
from messaging.event_handler import EventHandler  # à venir

logger = logging.getLogger("icy.handler")


class MessageHandler:
    """Dispatch des messages RabbitMQ vers le handler métier approprié."""

    def __init__(self, bot, rabbit=None):
        self.bot = bot
        self.rabbit = rabbit

        # Enregistre les sous-handlers
        self.news_handler = NewsHandler(bot, rabbit)
        self.event_handler = EventHandler(bot, rabbit)  # sera ajouté plus tard

    async def handle_message(self, routing_key: str, payload: dict):
        logger.info(f"🔔 Message RabbitMQ reçu ({routing_key})")
        logger.debug(json.dumps(payload, indent=2, ensure_ascii=False))

        # --- NEWS ---
        if routing_key.startswith("news."):
            await self.news_handler.handle(routing_key, payload)

        # --- EVENTS ---
        elif routing_key.startswith("events."):
            await self.event_handler.handle(routing_key, payload)

        else:
            logger.warning(f"Aucun handler trouvé pour la clé : {routing_key}")
