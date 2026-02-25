import json
import os
import urllib.error
import urllib.request


def _truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _request_json(url: str, method: str = "GET", headers: dict | None = None, body: dict | None = None) -> dict:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url=url, method=method, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = resp.read().decode("utf-8")
        return json.loads(payload) if payload else {}


def load_vault_secrets_into_env() -> None:
    if not _truthy(os.getenv("VAULT_ENABLED", "false")):
        return

    addr = os.getenv("VAULT_ADDR", "http://localhost:8200").rstrip("/")
    mount = os.getenv("VAULT_KV_MOUNT", "secret")
    path = os.getenv("VAULT_KV_PATH", "iceforge/dev/bot")
    role_id = os.getenv("VAULT_ROLE_ID", "")
    secret_id = os.getenv("VAULT_SECRET_ID", "")
    fail_fast = _truthy(os.getenv("VAULT_FAIL_FAST", "true"))

    try:
        if not role_id or not secret_id:
            raise RuntimeError("VAULT_ROLE_ID / VAULT_SECRET_ID manquants")

        login = _request_json(
            f"{addr}/v1/auth/approle/login",
            method="POST",
            headers={"Content-Type": "application/json"},
            body={"role_id": role_id, "secret_id": secret_id},
        )
        token = ((login.get("auth") or {}).get("client_token") or "").strip()
        if not token:
            raise RuntimeError("Token Vault absent apres login AppRole")

        data = _request_json(
            f"{addr}/v1/{mount}/data/{path}",
            headers={"X-Vault-Token": token},
        )
        secrets = ((data.get("data") or {}).get("data") or {})
        for key, value in secrets.items():
            os.environ[str(key)] = "" if value is None else str(value)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
        if fail_fast:
            raise
        print(f"[vault] warning: chargement des secrets ignore ({exc})")

