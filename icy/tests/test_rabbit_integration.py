import asyncio
import json
import os
import unittest
import uuid
from urllib.parse import unquote, urlsplit
from unittest.mock import AsyncMock, MagicMock

import aio_pika

from messaging.message_publisher import MessagePublisher
from messaging.rabbit_manager import (
    FAILURE_REASON_HEADER,
    RETRY_COUNT_HEADER,
    RabbitManager,
)


@unittest.skipUnless(
    os.getenv("RABBITMQ_TEST_URL"),
    "RABBITMQ_TEST_URL is required for the RabbitMQ integration test",
)
class RabbitIntegrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_manager_connects_without_logging_credentials(self):
        amqp_url = os.environ["RABBITMQ_TEST_URL"]
        parsed = urlsplit(amqp_url)
        manager = RabbitManager(
            amqp_url,
            object(),
            exchange_name=f"icy.test.manager.{uuid.uuid4().hex}",
        )

        with self.assertLogs("icy.rabbit", level="INFO") as captured_logs:
            self.assertTrue(await manager.connect())
            await manager.close()

        rendered_logs = "\n".join(captured_logs.output)
        self.assertNotIn(amqp_url, rendered_logs)
        # The default user can be "icy", which is also the application logger
        # namespace. Check credential syntax rather than the bare short name.
        self.assertNotIn(f"{unquote(parsed.username or '')}:", rendered_logs)
        self.assertNotIn(unquote(parsed.password or ""), rendered_logs)

    async def test_publishes_and_consumes_message(self):
        connection = await aio_pika.connect_robust(os.environ["RABBITMQ_TEST_URL"])
        channel = await connection.channel()
        suffix = uuid.uuid4().hex
        exchange_name = f"icy.test.{suffix}"
        routing_key = "events.integration"
        exchange = await channel.declare_exchange(
            exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue("", exclusive=True, auto_delete=True)
        await queue.bind(exchange, routing_key=routing_key)

        try:
            await MessagePublisher(connection, exchange_name).publish(
                routing_key, {"source": "python-3.14-integration"}
            )
            message = await queue.get(timeout=5)
            self.assertEqual(
                {"source": "python-3.14-integration"}, json.loads(message.body)
            )
            await message.ack()
        finally:
            await exchange.delete(if_unused=False)
            await connection.close()

    async def test_manager_can_reconnect_after_connection_closes(self):
        amqp_url = os.environ["RABBITMQ_TEST_URL"]
        manager = RabbitManager(
            amqp_url,
            object(),
            exchange_name=f"icy.test.reconnect.{uuid.uuid4().hex}",
        )

        self.assertTrue(await manager.connect())
        first_connection = manager.connection
        await first_connection.close()
        self.assertTrue(first_connection.is_closed)

        self.assertTrue(await manager.connect())
        self.assertIsNot(first_connection, manager.connection)
        self.assertFalse(manager.connection.is_closed)
        await manager.close()

    async def test_invalid_broker_message_is_dead_lettered_without_logging_body(self):
        connection = await aio_pika.connect_robust(os.environ["RABBITMQ_TEST_URL"])
        channel = await connection.channel()
        suffix = uuid.uuid4().hex
        exchange = await channel.declare_exchange(
            f"icy.test.invalid.{suffix}",
            aio_pika.ExchangeType.TOPIC,
            durable=False,
            auto_delete=True,
        )
        queue = await channel.declare_queue("", exclusive=True, auto_delete=True)
        await queue.bind(exchange, routing_key="events.invalid")
        dead_letter_exchange = await channel.declare_exchange(
            f"icy.test.invalid.dlx.{suffix}",
            aio_pika.ExchangeType.TOPIC,
            durable=False,
            auto_delete=True,
        )
        dead_letter_queue = await channel.declare_queue(
            "", exclusive=True, auto_delete=True
        )
        await dead_letter_queue.bind(dead_letter_exchange, routing_key="#")
        secret = "invalid-json-with-integration-secret"
        await exchange.publish(
            aio_pika.Message(secret.encode("utf-8")),
            routing_key="events.invalid",
        )
        message = await queue.get(timeout=5)
        manager = RabbitManager(os.environ["RABBITMQ_TEST_URL"], object())
        manager.dead_letter_exchange = dead_letter_exchange

        try:
            with self.assertLogs("icy.rabbit", level="ERROR") as captured_logs:
                await manager.on_message(message)

            rendered_logs = "\n".join(captured_logs.output)
            self.assertIn("JSON invalide", rendered_logs)
            self.assertNotIn(secret, rendered_logs)
            self.assertTrue(message.processed)
            dead_letter = await dead_letter_queue.get(timeout=5)
            self.assertEqual(secret.encode("utf-8"), dead_letter.body)
            await dead_letter.ack()
        finally:
            await connection.close()

    async def test_transient_failure_retries_then_reaches_dlq(self):
        amqp_url = os.environ["RABBITMQ_TEST_URL"]
        suffix = uuid.uuid4().hex
        exchange_name = f"icy.test.retry.{suffix}"
        source_queue_name = f"{exchange_name}.source"
        retry_queue_name = f"{exchange_name}.bot.retry.100.queue"
        dead_letter_queue_name = f"{exchange_name}.bot.dlx.queue"
        manager = RabbitManager(amqp_url, object(), exchange_name=exchange_name)
        manager.queues = {"events": source_queue_name}
        manager.retry_limit = 1
        manager.retry_delay_ms = 100

        self.assertTrue(await manager.connect())
        manager.handler = MagicMock()
        manager.handler.handle_message = AsyncMock(
            side_effect=RuntimeError("Discord failure with integration-secret")
        )

        try:
            with self.assertLogs("icy.rabbit", level="WARNING") as captured_logs:
                await manager.publisher.publish(
                    "events.integration", {"eventId": "integration"}
                )
                dead_letter_queue = await manager.channel.declare_queue(
                    dead_letter_queue_name, durable=True
                )
                deadline = asyncio.get_running_loop().time() + 5
                dead_letter = None
                while dead_letter is None and asyncio.get_running_loop().time() < deadline:
                    dead_letter = await dead_letter_queue.get(fail=False)
                    if dead_letter is None:
                        await asyncio.sleep(0.05)

            self.assertIsNotNone(dead_letter)
            self.assertEqual(1, dead_letter.headers[RETRY_COUNT_HEADER])
            self.assertEqual(
                "handler_retries_exhausted",
                dead_letter.headers[FAILURE_REASON_HEADER],
            )
            self.assertEqual(
                {"eventId": "integration"}, json.loads(dead_letter.body)
            )
            self.assertNotIn("integration-secret", "\n".join(captured_logs.output))
            await dead_letter.ack()
        finally:
            await manager.close()
            cleanup_connection = await aio_pika.connect_robust(amqp_url)
            cleanup_channel = await cleanup_connection.channel()
            for queue_name in (
                source_queue_name,
                retry_queue_name,
                dead_letter_queue_name,
            ):
                queue = await cleanup_channel.declare_queue(queue_name, passive=True)
                await queue.delete(if_unused=False, if_empty=False)
            for name in (
                f"{exchange_name}.bot.retry",
                f"{exchange_name}.bot.dlx",
                exchange_name,
            ):
                exchange = await cleanup_channel.get_exchange(name, ensure=False)
                await exchange.delete(if_unused=False)
            await cleanup_connection.close()


if __name__ == "__main__":
    unittest.main()
