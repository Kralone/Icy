import json
import logging
import aio_pika

logger = logging.getLogger("icy.publisher")


class MessagePublisher:
    """Service responsable de publier des événements RabbitMQ vers le backend."""

    def __init__(self, connection: aio_pika.RobustConnection, exchange_name: str = "icy.exchange"):
        self.connection = connection
        self.exchange_name = exchange_name

    async def publish(self, routing_key: str, payload: dict):
        """Publie un message sur l’exchange configuré."""
        try:
            # Ouvre un canal temporaire
            channel = await self.connection.channel()
            exchange = await channel.declare_exchange(
                self.exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )

            # Création du message JSON
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            message = aio_pika.Message(
                body=body,
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,  # pour éviter les pertes
            )

            # Publication
            await exchange.publish(message, routing_key=routing_key)
            logger.info(f"📤 Message publié ({routing_key})")
            logger.debug(json.dumps(payload, indent=2, ensure_ascii=False))

            # Fermeture propre du canal
            await channel.close()

        except Exception as e:
            logger.exception(f"❌ Erreur lors de l’envoi du message RabbitMQ : {e}")
