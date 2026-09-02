import json
import unittest
from unittest.mock import ANY, AsyncMock, MagicMock, patch

import aio_pika

from messaging.message_publisher import MessagePublisher
from messaging.rabbit_manager import (
    FAILURE_REASON_HEADER,
    RETRY_COUNT_HEADER,
    RabbitManager,
    safe_amqp_endpoint,
)


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

        result = await MessagePublisher(connection).publish(
            "events.updated", {"name": "été"}
        )

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
        self.assertTrue(result)

    async def test_closes_channel_when_publish_fails(self):
        connection = MagicMock()
        channel = MagicMock()
        channel.is_closed = False
        channel.close = AsyncMock()
        exchange = MagicMock()
        exchange.publish = AsyncMock(side_effect=RuntimeError("broker unavailable"))
        channel.declare_exchange = AsyncMock(return_value=exchange)
        connection.channel = AsyncMock(return_value=channel)

        secret = "amqp://user:do-not-log@rabbitmq/"
        exchange.publish.side_effect = RuntimeError(secret)

        with self.assertLogs("icy.publisher", level="ERROR") as captured_logs:
            with self.assertRaises(RuntimeError):
                await MessagePublisher(connection).publish("events.updated", {})

        channel.close.assert_awaited_once()
        self.assertNotIn(secret, "\n".join(captured_logs.output))


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
        channel.set_qos = AsyncMock()
        connection.channel = AsyncMock(return_value=channel)
        connect_robust.return_value = connection
        bot = object()
        manager = RabbitManager("amqp://guest:guest@rabbitmq/", bot)

        with self.assertLogs("icy.rabbit", level="INFO") as captured_logs:
            self.assertTrue(await manager.connect())

        connect_robust.assert_awaited_once_with("amqp://guest:guest@rabbitmq/")
        self.assertEqual(3, channel.declare_exchange.await_count)
        channel.declare_exchange.assert_any_await(
            "icy.exchange", aio_pika.ExchangeType.TOPIC, durable=True
        )
        channel.declare_exchange.assert_any_await(
            "icy.exchange.bot.retry", aio_pika.ExchangeType.TOPIC, durable=True
        )
        channel.declare_exchange.assert_any_await(
            "icy.exchange.bot.dlx", aio_pika.ExchangeType.TOPIC, durable=True
        )
        channel.set_qos.assert_awaited_once_with(prefetch_count=10)
        self.assertEqual(6, channel.declare_queue.await_count)
        self.assertEqual(6, queue.bind.await_count)
        self.assertEqual(4, queue.consume.await_count)
        publisher_type.assert_called_once_with(connection, "icy.exchange")
        handler_type.assert_called_once_with(bot, publisher_type.return_value, ANY)
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

    @patch("messaging.rabbit_manager.MessageHandler")
    @patch("messaging.rabbit_manager.MessagePublisher")
    @patch("messaging.rabbit_manager.aio_pika.connect_robust", new_callable=AsyncMock)
    async def test_custom_exchange_is_used_by_publisher(
        self, connect_robust, publisher_type, handler_type
    ):
        connection = MagicMock()
        connection.is_closed = False
        channel = MagicMock()
        exchange = MagicMock()
        queue = MagicMock()
        queue.bind = AsyncMock()
        queue.consume = AsyncMock()
        channel.declare_exchange = AsyncMock(return_value=exchange)
        channel.declare_queue = AsyncMock(return_value=queue)
        channel.set_qos = AsyncMock()
        connection.channel = AsyncMock(return_value=channel)
        connect_robust.return_value = connection

        bot = object()
        manager = RabbitManager(
            "amqp://guest:guest@rabbitmq/", bot, exchange_name="icy.test"
        )
        self.assertTrue(await manager.connect())

        publisher_type.assert_called_once_with(connection, "icy.test")
        handler_type.assert_called_once_with(bot, publisher_type.return_value, ANY)

    @patch("messaging.rabbit_manager.aio_pika.connect_robust", new_callable=AsyncMock)
    async def test_partial_connection_is_closed_and_credentials_are_not_logged(
        self, connect_robust
    ):
        secret = "amqp://user:do-not-log@rabbitmq/"
        connection = MagicMock()
        connection.is_closed = False
        connection.close = AsyncMock()
        connection.channel = AsyncMock(side_effect=RuntimeError(secret))
        connect_robust.return_value = connection
        manager = RabbitManager(secret, object())

        with self.assertLogs("icy.rabbit", level="ERROR") as captured_logs:
            self.assertFalse(await manager.connect())

        connection.close.assert_awaited_once()
        self.assertIsNone(manager.connection)
        self.assertIsNone(manager.channel)
        self.assertNotIn(secret, "\n".join(captured_logs.output))

    async def test_invalid_message_body_is_not_logged(self):
        secret = b"not-json-with-super-secret"
        manager = RabbitManager("amqp://guest:guest@rabbitmq/", object())
        manager.dead_letter_exchange = MagicMock()
        manager.dead_letter_exchange.publish = AsyncMock()
        message = MagicMock()
        message.body = secret
        message.routing_key = "events.updated"
        context = AsyncMock()
        context.__aenter__.return_value = None
        context.__aexit__.return_value = None
        message.process.return_value = context

        with self.assertLogs("icy.rabbit", level="ERROR") as captured_logs:
            await manager.on_message(message)

        rendered_logs = "\n".join(captured_logs.output)
        self.assertIn("JSON invalide", rendered_logs)
        self.assertNotIn("super-secret", rendered_logs)
        manager.dead_letter_exchange.publish.assert_awaited_once()

    async def test_non_object_json_is_rejected_before_dispatch(self):
        manager = RabbitManager("amqp://guest:guest@rabbitmq/", object())
        manager.handler = MagicMock()
        manager.handler.handle_message = AsyncMock()
        manager.dead_letter_exchange = MagicMock()
        manager.dead_letter_exchange.publish = AsyncMock()
        message = MagicMock()
        message.body = b'["unexpected"]'
        message.routing_key = "events.updated"
        context = AsyncMock()
        context.__aenter__.return_value = None
        context.__aexit__.return_value = None
        message.process.return_value = context

        with self.assertLogs("icy.rabbit", level="ERROR") as captured_logs:
            await manager.on_message(message)

        manager.handler.handle_message.assert_not_awaited()
        self.assertIn("objet JSON attendu", "\n".join(captured_logs.output))
        dead_letter = manager.dead_letter_exchange.publish.await_args.args[0]
        self.assertEqual("invalid_payload", dead_letter.headers[FAILURE_REASON_HEADER])

    async def test_successful_handler_does_not_retry_or_dead_letter(self):
        manager = self._manager_with_routes()
        manager.handler.handle_message = AsyncMock()
        message = self._message(b'{"eventId": "123"}')

        await manager._process_message(message)

        manager.handler.handle_message.assert_awaited_once_with(
            "events.updated", {"eventId": "123"}
        )
        manager.retry_exchange.publish.assert_not_awaited()
        manager.dead_letter_exchange.publish.assert_not_awaited()

    async def test_transient_handler_failure_is_sent_to_bounded_retry(self):
        manager = self._manager_with_routes()
        manager.handler.handle_message = AsyncMock(
            side_effect=RuntimeError("Discord contained super-secret")
        )
        message = self._message(b'{"eventId": "123"}')

        with self.assertLogs("icy.rabbit", level="WARNING") as captured_logs:
            await manager._process_message(message)

        retried = manager.retry_exchange.publish.await_args.args[0]
        self.assertEqual(1, retried.headers[RETRY_COUNT_HEADER])
        self.assertEqual(
            "events.updated",
            manager.retry_exchange.publish.await_args.kwargs["routing_key"],
        )
        manager.dead_letter_exchange.publish.assert_not_awaited()
        self.assertNotIn("super-secret", "\n".join(captured_logs.output))

    async def test_exhausted_handler_failure_is_sent_to_dlq(self):
        manager = self._manager_with_routes()
        manager.retry_limit = 2
        manager.handler.handle_message = AsyncMock(side_effect=RuntimeError("failed"))
        message = self._message(
            b'{"eventId": "123"}', headers={RETRY_COUNT_HEADER: 2}
        )

        await manager._process_message(message)

        manager.retry_exchange.publish.assert_not_awaited()
        dead_letter = manager.dead_letter_exchange.publish.await_args.args[0]
        self.assertEqual(2, dead_letter.headers[RETRY_COUNT_HEADER])
        self.assertEqual(
            "handler_retries_exhausted",
            dead_letter.headers[FAILURE_REASON_HEADER],
        )

    async def test_retry_publish_failure_propagates_for_original_requeue(self):
        manager = self._manager_with_routes()
        manager.handler.handle_message = AsyncMock(side_effect=RuntimeError("Discord down"))
        manager.retry_exchange.publish.side_effect = RuntimeError(
            "broker retry route down with super-secret"
        )
        message = self._message(b'{"eventId": "123"}')

        with self.assertRaises(RuntimeError):
            await manager._process_message(message)

        manager.dead_letter_exchange.publish.assert_not_awaited()

    @staticmethod
    def _manager_with_routes():
        manager = RabbitManager("amqp://guest:guest@rabbitmq/", object())
        manager.handler = MagicMock()
        manager.retry_exchange = MagicMock()
        manager.retry_exchange.publish = AsyncMock()
        manager.dead_letter_exchange = MagicMock()
        manager.dead_letter_exchange.publish = AsyncMock()
        return manager

    @staticmethod
    def _message(body, headers=None):
        message = MagicMock()
        message.body = body
        message.routing_key = "events.updated"
        message.headers = headers or {}
        message.correlation_id = "correlation-id"
        message.message_id = "message-id"
        return message


if __name__ == "__main__":
    unittest.main()
