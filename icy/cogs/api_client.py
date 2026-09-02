import asyncio
import json
import logging
import math
import os
from urllib.parse import urlsplit

import aiohttp
from discord.ext import commands

from utils.embeds import EmbedFactory


logger = logging.getLogger("icy.api_client")
_ALLOWED_METHODS = {"DELETE", "GET", "PATCH", "POST", "PUT"}


class APIClient(commands.Cog):
    """Authenticated, reusable HTTP client for calls from the bot to the backend."""

    def __init__(self, bot):
        self.bot = bot
        self.api_base_url = os.getenv("BACKEND_API_URL", "http://backend:8080").rstrip("/")
        parsed_base_url = urlsplit(self.api_base_url)
        if parsed_base_url.scheme not in {"http", "https"} or not parsed_base_url.netloc:
            raise RuntimeError("BACKEND_API_URL must be an absolute HTTP(S) URL")
        if parsed_base_url.username or parsed_base_url.password:
            raise RuntimeError("BACKEND_API_URL must not contain credentials")

        api_key = os.getenv("BOT_API_KEY")
        if not api_key:
            raise RuntimeError("BOT_API_KEY is required for backend requests")
        self.default_headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bot {api_key}",
        }

        total_timeout = self._positive_timeout("BACKEND_API_TIMEOUT_SECONDS", 10.0)
        connect_timeout = self._positive_timeout("BACKEND_API_CONNECT_TIMEOUT_SECONDS", 3.0)
        self.timeout = aiohttp.ClientTimeout(total=total_timeout, connect=connect_timeout)
        self._session = None

    @staticmethod
    def _positive_timeout(name, default):
        raw_value = os.getenv(name)
        if raw_value is None:
            return default
        try:
            value = float(raw_value)
        except ValueError as exc:
            raise RuntimeError(f"{name} must be a positive number") from exc
        if not math.isfinite(value) or value <= 0:
            raise RuntimeError(f"{name} must be a positive number")
        return value

    def _get_session(self):
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self._session

    async def close(self):
        if self._session is not None and not self._session.closed:
            await self._session.close()

    async def cog_unload(self):
        await self.close()

    @staticmethod
    async def _send_failure(ctx, title, message):
        if ctx is not None:
            await ctx.send(embed=EmbedFactory.error_embed(title, message))

    async def api_request(self, method, endpoint, data=None, headers=None, ctx=None):
        request_method = str(method).upper()
        if request_method not in _ALLOWED_METHODS:
            raise ValueError(f"Unsupported backend HTTP method: {request_method}")

        raw_endpoint = str(endpoint)
        parsed_endpoint = urlsplit(raw_endpoint)
        if parsed_endpoint.scheme or parsed_endpoint.netloc:
            raise ValueError("Backend endpoint must be relative")
        endpoint = raw_endpoint.lstrip("/")

        url = f"{self.api_base_url}/{endpoint}"
        # Authentication is applied last so a caller cannot accidentally replace it.
        request_headers = {**(headers or {}), **self.default_headers}
        log_path = urlsplit(url).path

        try:
            session = self._get_session()
            async with session.request(
                request_method,
                url,
                json=data,
                headers=request_headers,
                allow_redirects=False,
            ) as response:
                if response.status == 204:
                    return {"httpCode": 204, "data": None}

                try:
                    payload = await response.json(content_type=None)
                except (aiohttp.ContentTypeError, json.JSONDecodeError, UnicodeDecodeError):
                    logger.warning(
                        "Backend returned invalid JSON for %s %s (status=%s)",
                        request_method,
                        log_path,
                        response.status,
                    )
                    await self._send_failure(
                        ctx,
                        "Réponse invalide",
                        "Le service a renvoyé une réponse illisible. Réessaie plus tard.",
                    )
                    return None

                if not isinstance(payload, dict):
                    logger.warning(
                        "Backend returned a non-object JSON response for %s %s (status=%s)",
                        request_method,
                        log_path,
                        response.status,
                    )
                    await self._send_failure(
                        ctx,
                        "Réponse invalide",
                        "Le service a renvoyé une réponse inattendue. Réessaie plus tard.",
                    )
                    return None

                # The transport status is authoritative, even if the body disagrees.
                payload["httpCode"] = response.status
                if response.status >= 500:
                    await self._send_failure(
                        ctx,
                        "Service indisponible",
                        "Le service rencontre un problème temporaire. Réessaie plus tard.",
                    )
                elif response.status >= 400:
                    await self._send_failure(
                        ctx,
                        "Requête refusée",
                        "La demande n'a pas pu être traitée.",
                    )
                return payload
        except asyncio.TimeoutError:
            logger.warning("Backend request timed out for %s %s", request_method, log_path)
            await self._send_failure(
                ctx,
                "Service indisponible",
                "Le service met trop de temps à répondre. Réessaie plus tard.",
            )
        except aiohttp.ClientError as exc:
            # aiohttp exceptions may contain URLs or headers, so log the class only.
            logger.warning(
                "Backend request failed for %s %s (%s)",
                request_method,
                log_path,
                type(exc).__name__,
            )
            await self._send_failure(
                ctx,
                "Service indisponible",
                "Impossible de joindre le service. Réessaie plus tard.",
            )
        return None


async def setup(bot):
    await bot.add_cog(APIClient(bot))
