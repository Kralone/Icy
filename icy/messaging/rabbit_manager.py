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
    et la publication d'événements (news + events).
    """

    def __init__(self, amqp_url: str, bot, exchange_name: str = "icy.exchange"):
        self.amqp_url = amqp_url
        self.exchange_name = exchange_name
        self.connection = None
        self.channel = None
        self.bot = bot

        # Components
        self.publisher = None
        self.handler = None

        # Queues écoutées
        self.queues = {
            "news": "news.queue",
            "events": "events.queue",
            "users": "users.queue"
        }

    async def connect(self):
        """Établit la connexion à RabbitMQ et configure les composants."""
        logger.info(f"🐇 Connexion à RabbitMQ ({self.amqp_url})...")

        try:
            self.connection = await aio_pika.connect_robust(self.amqp_url)
            self.channel = await self.connection.channel()

            # Exchange principal
            exchange = await self.channel.declare_exchange(
                self.exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )

            # Déclaration et binding des deux queues
            for key, queue_name in self.queues.items():
                queue = await self.channel.declare_queue(queue_name, durable=True)
                routing_pattern = f"{key}.*"
                await queue.bind(exchange, routing_key=routing_pattern)
                await queue.consume(self.on_message)
                logger.info(f"🎧 Écoute activée sur {queue_name} (clé: {routing_pattern})")

            # Publisher pour les envois sortants
            self.publisher = MessagePublisher(self.connection)

            # Handler pour les messages entrants
            self.handler = MessageHandler(self.bot, self.publisher)

            logger.info("✅ RabbitMQ connecté et en écoute sur toutes les files.")

        except Exception as e:
            logger.exception(f"❌ Erreur lors de la connexion à RabbitMQ : {e}")

    async def on_message(self, message: aio_pika.IncomingMessage):
        """Callback exécuté à chaque message reçu sur les queues."""
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
