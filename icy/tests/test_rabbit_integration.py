import json
import os
import unittest
import uuid
from urllib.parse import unquote, urlsplit

import aio_pika

from messaging.message_publisher import MessagePublisher
from messaging.rabbit_manager import RabbitManager


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
        self.assertNotIn(unquote(parsed.username or ""), rendered_logs)
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


if __name__ == "__main__":
    unittest.main()
