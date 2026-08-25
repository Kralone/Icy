import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import aio_pika

from messaging.message_publisher import MessagePublisher
from messaging.rabbit_manager import RabbitManager, safe_amqp_endpoint


class MessagePublisherTest(unittest.IsolatedAsyncioTestCase):
    async def test_publishes_persistent_json_and_closes_channel(self):
        connection = MagicMock()
        channel = MagicMock()
        channel.is_closed = False
        channel.close = AsyncMock()
        exchange = MagicMock()
        exchange.publish = AsyncMock()
        channel.declare_exchange = AsyncMock(return_value=exchange)
        connection.channel = AsyncMock(return_value=channel)

        await MessagePublisher(connection).publish("events.updated", {"name": "été"})

        channel.declare_exchange.assert_awaited_once_with(
            "icy.exchange", aio_pika.ExchangeType.TOPIC, durable=True
        )
        exchange.publish.assert_awaited_once()
        message = exchange.publish.await_args.args[0]
        self.assertEqual({"name": "été"}, json.loads(message.body))
        self.assertEqual("application/json", message.content_type)
        self.assertEqual(aio_pika.DeliveryMode.PERSISTENT, message.delivery_mode)
        self.assertEqual("events.updated", exchange.publish.await_args.kwargs["routing_key"])
        channel.close.assert_awaited_once()

    async def test_closes_channel_when_publish_fails(self):
        connection = MagicMock()
        channel = MagicMock()
        channel.is_closed = False
        channel.close = AsyncMock()
        exchange = MagicMock()
        exchange.publish = AsyncMock(side_effect=RuntimeError("broker unavailable"))
        channel.declare_exchange = AsyncMock(return_value=exchange)
        connection.channel = AsyncMock(return_value=channel)

        with self.assertLogs("icy.publisher", level="ERROR"):
            await MessagePublisher(connection).publish("events.updated", {})

        channel.close.assert_awaited_once()


class RabbitManagerTest(unittest.IsolatedAsyncioTestCase):
    def test_safe_endpoint_never_contains_credentials(self):
        endpoint = safe_amqp_endpoint(
            "amqps://iceforge-user:super-secret@rabbitmq.internal:5671/iceforge"
        )

        self.assertEqual(
            "amqps://rabbitmq.internal:5671/iceforge",
            endpoint,
        )
        self.assertNotIn("iceforge-user", endpoint)
        self.assertNotIn("super-secret", endpoint)

    @patch("messaging.rabbit_manager.MessageHandler")
    @patch("messaging.rabbit_manager.MessagePublisher")
    @patch("messaging.rabbit_manager.aio_pika.connect_robust", new_callable=AsyncMock)
    async def test_connect_declares_and_consumes_all_queues(
        self, connect_robust, publisher_type, handler_type
    ):
        connection = MagicMock()
        channel = MagicMock()
        exchange = MagicMock()
        queue = MagicMock()
        queue.bind = AsyncMock()
        queue.consume = AsyncMock()
        channel.declare_exchange = AsyncMock(return_value=exchange)
        channel.declare_queue = AsyncMock(return_value=queue)
        connection.channel = AsyncMock(return_value=channel)
        connect_robust.return_value = connection
        bot = object()
        manager = RabbitManager("amqp://guest:guest@rabbitmq/", bot)

        with self.assertLogs("icy.rabbit", level="INFO") as captured_logs:
            self.assertTrue(await manager.connect())

        connect_robust.assert_awaited_once_with("amqp://guest:guest@rabbitmq/")
        channel.declare_exchange.assert_awaited_once_with(
            "icy.exchange", aio_pika.ExchangeType.TOPIC, durable=True
        )
        self.assertEqual(4, channel.declare_queue.await_count)
        self.assertEqual(4, queue.bind.await_count)
        self.assertEqual(4, queue.consume.await_count)
        publisher_type.assert_called_once_with(connection)
        handler_type.assert_called_once_with(bot, publisher_type.return_value)
        rendered_logs = "\n".join(captured_logs.output)
        self.assertIn("amqp://rabbitmq/", rendered_logs)
        self.assertNotIn("guest", rendered_logs)

    @patch("messaging.rabbit_manager.aio_pika.connect_robust", new_callable=AsyncMock)
    async def test_connection_error_does_not_log_credentials(self, connect_robust):
        secret_url = "amqp://iceforge-user:super-secret@rabbitmq:5672/"
        connect_robust.side_effect = RuntimeError(
            f"connection rejected for {secret_url}"
        )
        manager = RabbitManager(secret_url, object())

        with self.assertLogs("icy.rabbit", level="ERROR") as captured_logs:
            self.assertFalse(await manager.connect())

        rendered_logs = "\n".join(captured_logs.output)
        self.assertIn("amqp://rabbitmq:5672/", rendered_logs)
        self.assertNotIn("iceforge-user", rendered_logs)
        self.assertNotIn("super-secret", rendered_logs)


if __name__ == "__main__":
    unittest.main()
