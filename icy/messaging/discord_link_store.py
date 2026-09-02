import os
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DiscordLink:
    channel_id: int
    message_id: int


class DiscordLinkStore:
    """Small durable ledger for Discord messages awaiting backend linkage."""

    def __init__(self, path: str | None = None):
        configured_path = path or os.getenv(
            "BOT_IDEMPOTENCY_DB", "/app/config/discord-links.sqlite3"
        )
        self.path = Path(configured_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self):
        return sqlite3.connect(self.path, timeout=5)

    def _initialize(self):
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS discord_links (
                        resource_type TEXT NOT NULL,
                        resource_id TEXT NOT NULL,
                        channel_id INTEGER NOT NULL,
                        message_id INTEGER NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (resource_type, resource_id)
                    )
                    """
                )

    def get(self, resource_type: str, resource_id: object) -> DiscordLink | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """
                SELECT channel_id, message_id
                FROM discord_links
                WHERE resource_type = ? AND resource_id = ?
                """,
                (resource_type, str(resource_id)),
            ).fetchone()
        return DiscordLink(int(row[0]), int(row[1])) if row else None

    def save(
        self,
        resource_type: str,
        resource_id: object,
        channel_id: int,
        message_id: int,
    ) -> DiscordLink:
        link = DiscordLink(int(channel_id), int(message_id))
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    INSERT INTO discord_links (
                        resource_type, resource_id, channel_id, message_id
                    ) VALUES (?, ?, ?, ?)
                    ON CONFLICT(resource_type, resource_id) DO UPDATE SET
                        channel_id = excluded.channel_id,
                        message_id = excluded.message_id
                    """,
                    (resource_type, str(resource_id), link.channel_id, link.message_id),
                )
        return link

    def delete(self, resource_type: str, resource_id: object):
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    DELETE FROM discord_links
                    WHERE resource_type = ? AND resource_id = ?
                    """,
                    (resource_type, str(resource_id)),
                )
