import asyncio
import aio_pika
import json
import logging

from messaging.message_handler import MessageHandler
from messaging.message_publisher import MessagePublisher

logger = logging.getLogger("icy.rabbit")


class RabbitManager:
    """
    Gère la connexion RabbitMQ, la consommation de messages
    et la publication d'événements.
    """

    def __init__(self, amqp_url: str, bot, queue_name: str = "news.queue", exchange_name: str = "icy.exchange"):
        self.amqp_url = amqp_url
        self.queue_name = queue_name
        self.exchange_name = exchange_name
        self.connection = None
        self.channel = None
        self.bot = bot

        # Ces deux attributs seront initialisés après connexion
        self.publisher = None
        self.handler = None

    async def connect(self):
        """Établit la connexion à RabbitMQ et configure les composants."""
        logger.info(f"🐇 Connexion à RabbitMQ ({self.amqp_url})...")
        try:
            self.connection = await aio_pika.connect_robust(self.amqp_url)
            self.channel = await self.connection.channel()

            # Exchange + Queue
            exchange = await self.channel.declare_exchange(
                self.exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )
            queue = await self.channel.declare_queue(self.queue_name, durable=True)

            # Liaison pour écouter les messages news.*
            await queue.bind(exchange, routing_key="news.*")
            await queue.consume(self.on_message)

            # Crée le publisher pour les envois sortants
            self.publisher = MessagePublisher(self.connection)

            # Crée le handler pour traiter les messages entrants
            self.handler = MessageHandler(self.bot, self.publisher)

            logger.info(f"✅ Connecté à RabbitMQ et en écoute sur : {self.queue_name}")

        except Exception as e:
            logger.exception(f"❌ Erreur lors de la connexion à RabbitMQ : {e}")

    async def on_message(self, message: aio_pika.IncomingMessage):
        """Callback exécuté à chaque message reçu sur la queue."""
        async with message.process():
            try:
                payload = json.loads(message.body)
                routing_key = message.routing_key
                logger.info(f"📨 Message reçu : {routing_key}")

                if not self.handler:
                    logger.error("⚠️ Aucun handler défini pour RabbitMQ.")
                    return

                await self.handler.handle_message(routing_key, payload)

            except json.JSONDecodeError:
                logger.error(f"❌ Message non valide (JSON invalide) : {message.body}")
            except Exception as e:
                logger.exception(f"Erreur lors du traitement du message : {e}")

    async def publish(self, routing_key: str, payload: dict):
        """Publie un message via le publisher."""
        if not self.publisher:
            logger.error("⚠️ Publisher non initialisé, message non envoyé.")
            return
        await self.publisher.publish(routing_key, payload)

    async def close(self):
        """Ferme proprement la connexion RabbitMQ."""
        if self.connection:
            await self.connection.close()
            logger.info("🔌 Connexion RabbitMQ fermée.")
