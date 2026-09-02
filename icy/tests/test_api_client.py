import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp

from cogs.api_client import APIClient


class APIClientTest(unittest.IsolatedAsyncioTestCase):
    def make_client(self, *, status=200, payload=None):
        env = {
            "BOT_API_KEY": "test-only-secret-key",
            "BACKEND_API_URL": "http://backend:8080",
        }
        with patch.dict(os.environ, env, clear=True):
            client = APIClient(object())

        response = MagicMock()
        response.status = status
        response.json = AsyncMock(return_value=payload if payload is not None else {})

        request_context = MagicMock()
        request_context.__aenter__ = AsyncMock(return_value=response)
        request_context.__aexit__ = AsyncMock(return_value=False)

        session = MagicMock()
        session.closed = False
        session.request.return_value = request_context
        session.close = AsyncMock()
        client._session = session
        return client, session, response

    async def test_reuses_session_and_uses_transport_status(self):
        client, session, _ = self.make_client(
            status=404,
            payload={"httpCode": 200, "messageDetail": {"message": "missing"}},
        )

        first = await client.api_request("GET", "/api/test")
        second = await client.api_request("GET", "/api/test")

        self.assertEqual(404, first["httpCode"])
        self.assertEqual(404, second["httpCode"])
        self.assertEqual(2, session.request.call_count)

    async def test_authorization_header_cannot_be_overridden(self):
        client, session, _ = self.make_client(payload={"httpCode": 200})

        await client.api_request(
            "GET",
            "api/test",
            headers={"Authorization": "Bearer attacker-controlled"},
        )

        sent_headers = session.request.call_args.kwargs["headers"]
        self.assertEqual("Bot test-only-secret-key", sent_headers["Authorization"])

    async def test_invalid_json_returns_none_and_notifies_context(self):
        client, _, response = self.make_client(status=502)
        response.json.side_effect = json.JSONDecodeError("bad JSON", "x", 0)
        ctx = MagicMock()
        ctx.send = AsyncMock()

        result = await client.api_request("GET", "api/test", ctx=ctx)

        self.assertIsNone(result)
        ctx.send.assert_awaited_once()

    async def test_non_object_json_is_rejected(self):
        client, _, _ = self.make_client(payload=["unexpected"])

        result = await client.api_request("GET", "api/test")

        self.assertIsNone(result)

    async def test_timeout_is_handled(self):
        client, session, _ = self.make_client()
        session.request.side_effect = asyncio.TimeoutError
        ctx = MagicMock()
        ctx.send = AsyncMock()

        result = await client.api_request("GET", "api/test", ctx=ctx)

        self.assertIsNone(result)
        ctx.send.assert_awaited_once()

    async def test_network_error_log_does_not_include_exception_secret(self):
        client, session, _ = self.make_client()
        session.request.side_effect = aiohttp.ClientConnectionError(
            "request failed with Bot must-not-appear"
        )

        with self.assertLogs("icy.api_client", level="WARNING") as captured:
            result = await client.api_request("GET", "api/test?token=also-hidden")

        rendered_logs = "\n".join(captured.output)
        self.assertIsNone(result)
        self.assertNotIn("must-not-appear", rendered_logs)
        self.assertNotIn("also-hidden", rendered_logs)

    async def test_close_releases_session(self):
        client, session, _ = self.make_client()

        await client.close()

        session.close.assert_awaited_once()

    async def test_rejects_absolute_endpoint_to_prevent_key_exfiltration(self):
        client, session, _ = self.make_client()

        with self.assertRaisesRegex(ValueError, "relative"):
            await client.api_request("GET", "https://attacker.invalid/collect")

        session.request.assert_not_called()


class APIClientTimeoutConfigurationTest(unittest.TestCase):
    @patch.dict(
        os.environ,
        {"BOT_API_KEY": "test", "BACKEND_API_TIMEOUT_SECONDS": "0"},
        clear=True,
    )
    def test_rejects_non_positive_timeout(self):
        with self.assertRaisesRegex(RuntimeError, "positive number"):
            APIClient(object())


if __name__ == "__main__":
    unittest.main()
