import aio_pika
import json
import logging
import os
from urllib.parse import urlsplit

from messaging.message_handler import MessageHandler
from messaging.message_publisher import MessagePublisher
from messaging.discord_link_store import DiscordLinkStore

logger = logging.getLogger("icy.rabbit")
RETRY_COUNT_HEADER = "x-iceforge-retry-count"
FAILURE_REASON_HEADER = "x-iceforge-failure-reason"


def safe_amqp_endpoint(amqp_url: str) -> str:
    """Return a connection target that never contains AMQP credentials."""
    try:
        parsed = urlsplit(amqp_url)
        if parsed.scheme not in {"amqp", "amqps"} or not parsed.hostname:
            return "<invalid-amqp-endpoint>"
        port = f":{parsed.port}" if parsed.port is not None else ""
        path = parsed.path or "/"
        return f"{parsed.scheme}://{parsed.hostname}{port}{path}"
    except (TypeError, ValueError):
        return "<invalid-amqp-endpoint>"


class RabbitManager:
    """
    Gère la connexion RabbitMQ, la consommation de messages
    et la publication d'événements (news + events).
    """

    def __init__(
        self,
        amqp_url: str,
        bot,
        exchange_name: str = "icy.exchange",
        discord_link_store=None,
    ):
        self.amqp_url = amqp_url
        self.safe_endpoint = safe_amqp_endpoint(amqp_url)
        self.exchange_name = exchange_name
        self.connection = None
        self.channel = None
        self.retry_exchange = None
        self.dead_letter_exchange = None
        self.bot = bot
        self.discord_link_store = discord_link_store
        self.retry_limit = self._read_bounded_integer(
            "BOT_RABBIT_RETRY_LIMIT", default=3, minimum=0, maximum=10
        )
        self.retry_delay_ms = self._read_bounded_integer(
            "BOT_RABBIT_RETRY_DELAY_MS", default=5000, minimum=100, maximum=300000
        )

        # Components
        self.publisher = None
        self.handler = None

        # Queues écoutées
        self.queues = {
            "news": "news.queue",
            "events": "events.queue",
            "users": "users.queue",
            "scwe": "scwe.queue"
        }

    @staticmethod
    def _read_bounded_integer(name, *, default, minimum, maximum):
        raw_value = os.getenv(name)
        if raw_value is None:
            return default
        try:
            value = int(raw_value)
        except ValueError as exc:
            raise RuntimeError(f"{name} must be an integer") from exc
        if not minimum <= value <= maximum:
            raise RuntimeError(f"{name} must be between {minimum} and {maximum}")
        return value

    async def connect(self):
        """Établit la connexion à RabbitMQ et configure les composants."""
        logger.info("🐇 Connexion à RabbitMQ (%s)...", self.safe_endpoint)

        # A failed setup may leave a live connection behind. Always start a
        # manual retry from a clean state; aio-pika still handles transparent
        # reconnects after a successful robust connection.
        await self._close_connection()

        try:
            self.connection = await aio_pika.connect_robust(self.amqp_url)
            self.channel = await self.connection.channel()
            await self.channel.set_qos(prefetch_count=10)

            # Exchange principal
            exchange = await self.channel.declare_exchange(
                self.exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )
            retry_exchange_name = f"{self.exchange_name}.bot.retry"
            dead_letter_exchange_name = f"{self.exchange_name}.bot.dlx"
            self.retry_exchange = await self.channel.declare_exchange(
                retry_exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )
            self.dead_letter_exchange = await self.channel.declare_exchange(
                dead_letter_exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
            )

            retry_queue = await self.channel.declare_queue(
                f"{retry_exchange_name}.{self.retry_delay_ms}.queue",
                durable=True,
                arguments={
                    "x-message-ttl": self.retry_delay_ms,
                    "x-dead-letter-exchange": self.exchange_name,
                },
            )
            await retry_queue.bind(self.retry_exchange, routing_key="#")

            dead_letter_queue = await self.channel.declare_queue(
                f"{dead_letter_exchange_name}.queue", durable=True
            )
            await dead_letter_queue.bind(self.dead_letter_exchange, routing_key="#")

            # Publisher/handler initialisés avant la consommation pour éviter
            # une course où un message arrive avant que self.handler soit prêt.
            self.publisher = MessagePublisher(self.connection, self.exchange_name)
            if self.discord_link_store is None:
                self.discord_link_store = DiscordLinkStore()
            self.handler = MessageHandler(
                self.bot, self.publisher, self.discord_link_store
            )

            # Déclaration et binding des queues
            for key, queue_name in self.queues.items():
                queue = await self.channel.declare_queue(queue_name, durable=True)
                routing_pattern = f"{key}.*"
                await queue.bind(exchange, routing_key=routing_pattern)
                await queue.consume(self.on_message)
                logger.info(f"🎧 Écoute activée sur {queue_name} (clé: {routing_pattern})")

            logger.info("✅ RabbitMQ connecté et en écoute sur toutes les files.")
            return True

        except Exception as exception:
            logger.error(
                "❌ Connexion RabbitMQ impossible vers %s (%s)",
                self.safe_endpoint,
                type(exception).__name__,
            )
            await self._close_connection()
            return False

    async def on_message(self, message: aio_pika.IncomingMessage):
        """Callback exécuté à chaque message reçu sur les queues."""
        try:
            # If publishing to retry/DLQ itself fails, leaving the context with
            # an exception rejects and requeues the original message.
            async with message.process(requeue=True):
                await self._process_message(message)
        except Exception as exception:
            logger.error(
                "Impossible de router le message RabbitMQ en échec (%s)",
                type(exception).__name__,
            )

    async def _process_message(self, message: aio_pika.IncomingMessage):
        routing_key = message.routing_key
        logger.info("📨 Message reçu : %s", routing_key)
        try:
            payload = json.loads(message.body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            logger.error("❌ Message RabbitMQ envoyé en DLQ : JSON invalide.")
            await self._publish_dead_letter(message, reason="invalid_json")
            return

        if not isinstance(payload, dict):
            logger.error("❌ Message RabbitMQ envoyé en DLQ : objet JSON attendu.")
            await self._publish_dead_letter(message, reason="invalid_payload")
            return

        if not self.handler:
            raise RuntimeError("RabbitMQ handler is not initialized")

        try:
            await self.handler.handle_message(routing_key, payload)
        except Exception as exception:
            retry_count = self._retry_count(message)
            if retry_count < self.retry_limit:
                next_retry = retry_count + 1
                await self._publish_retry(message, payload, next_retry)
                logger.warning(
                    "Traitement RabbitMQ échoué (%s %s/%s), retry planifié",
                    type(exception).__name__,
                    next_retry,
                    self.retry_limit,
                )
            else:
                await self._publish_dead_letter(
                    message,
                    reason="handler_retries_exhausted",
                    payload=payload,
                    retry_count=retry_count,
                )
                logger.error(
                    "Traitement RabbitMQ épuisé après %s retry(s) (%s), message en DLQ",
                    retry_count,
                    type(exception).__name__,
                )

    @staticmethod
    def _retry_count(message):
        headers = message.headers or {}
        try:
            return max(0, int(headers.get(RETRY_COUNT_HEADER, 0)))
        except (TypeError, ValueError):
            return 0

    async def _publish_retry(self, source_message, payload, retry_count):
        if self.retry_exchange is None:
            raise RuntimeError("RabbitMQ retry exchange is not initialized")
        await self._publish_copy(
            self.retry_exchange,
            source_message,
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            {RETRY_COUNT_HEADER: retry_count},
        )

    async def _publish_dead_letter(
        self, source_message, *, reason, payload=None, retry_count=None
    ):
        if self.dead_letter_exchange is None:
            raise RuntimeError("RabbitMQ dead-letter exchange is not initialized")
        body = (
            source_message.body
            if payload is None
            else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        )
        headers = {FAILURE_REASON_HEADER: reason}
        if retry_count is not None:
            headers[RETRY_COUNT_HEADER] = retry_count
        await self._publish_copy(
            self.dead_letter_exchange, source_message, body, headers
        )

    @staticmethod
    async def _publish_copy(exchange, source_message, body, headers):
        copied_message = aio_pika.Message(
            body=body,
            headers=headers,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            correlation_id=source_message.correlation_id,
            message_id=source_message.message_id,
        )
        await exchange.publish(copied_message, routing_key=source_message.routing_key)

    async def publish(self, routing_key: str, payload: dict):
        """Publie un message via le publisher."""
        if not self.publisher:
            logger.error("⚠️ Publisher non initialisé, message non envoyé.")
            raise RuntimeError("RabbitMQ publisher is not initialized")
        return await self.publisher.publish(routing_key, payload)

    async def close(self):
        """Ferme proprement la connexion RabbitMQ."""
        if self.connection is not None:
            await self._close_connection()
            logger.info("🔌 Connexion RabbitMQ fermée.")

    async def _close_connection(self):
        connection = self.connection
        self.connection = None
        self.channel = None
        self.retry_exchange = None
        self.dead_letter_exchange = None
        self.publisher = None
        self.handler = None
        if connection is not None and not connection.is_closed:
            await connection.close()
