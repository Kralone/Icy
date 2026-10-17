#!/usr/bin/env python3
"""Operator recovery: secrets travel on stdin, never in command arguments."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

INIT_FILE = Path("/root/iceforge/.secrets/vault/prod-init.json")


def valid_key(value):
    if not isinstance(value, str):
        return False
    if re.fullmatch(r"[0-9a-fA-F]{64}(?:[0-9a-fA-F]{2})?", value):
        return True
    try:
        # Shamir shares add a one-byte share identifier to the 32-byte key.
        return len(base64.b64decode(value, validate=True)) in (32, 33)
    except (ValueError, TypeError):
        return False


def vault_request(container, path, payload=None):
    command = ["docker", "exec"]
    if payload is not None:
        command.append("-i")
    command += [container, "wget", "-qO-", "-T", "15"]
    if payload is not None:
        command += ["--header", "Content-Type: application/json", "--post-file=/dev/stdin"]
    command.append("http://127.0.0.1:8200/v1/sys/" + path)
    result = subprocess.run(command, input=None if payload is None else json.dumps(payload),
                            text=True, capture_output=True, timeout=25, check=False)
    if result.returncode:
        # Do not relay response bodies, process input or arbitrary stderr containing secrets.
        raise RuntimeError("Vault ne répond pas ou refuse la demande ; vérifier son état et la clé saisie.")
    try:
        return json.loads(result.stdout)
    except (ValueError, TypeError):
        raise RuntimeError("Réponse Vault invalide.") from None


def status_only(response):
    return {name: response.get(name) for name in ("initialized", "sealed", "t", "n", "progress", "version")}


def read_saved_key(path=INIT_FILE):
    # O_NOFOLLOW and fstat validate the actual opened file, including a symlink race.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
            raise RuntimeError("Le fichier d’initialisation doit être régulier, root:root, mode 0600.")
        data = json.load(stream)
    keys = data.get("unseal_keys_b64", [])
    if not isinstance(keys, list) or not keys or not valid_key(keys[0]):
        raise RuntimeError("Clé de déverrouillage absente ou invalide dans le fichier d’initialisation.")
    return keys[0]


def main():
    parser = argparse.ArgumentParser(description="Récupération opérateur Vault IceForge")
    parser.add_argument("action", choices=("status", "unseal", "show-key"))
    parser.add_argument("--container", default="iceforge_vault")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError("Ce programme doit être exécuté avec sudo.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", args.container):
        raise RuntimeError("Nom de conteneur invalide.")
    if args.action == "show-key":
        # This action is intended only for the operator's separate local console.
        print(read_saved_key())
        return
    state = vault_request(args.container, "seal-status")
    if not state.get("initialized"):
        raise RuntimeError("Vault n’est pas initialisé : ne pas lancer operator init pour une reprise.")
    if args.action == "unseal" and state.get("sealed"):
        try:
            payload = json.loads(sys.stdin.readline())
        except (ValueError, TypeError):
            raise RuntimeError("Entrée de déverrouillage invalide.") from None
        key = payload.get("key") if isinstance(payload, dict) else None
        if not valid_key(key):
            raise RuntimeError("Format de clé invalide : fournir une clé unseal Vault, pas le token root.")
        state = vault_request(args.container, "unseal", {"key": key})
    print(json.dumps(status_only(state)))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired):
        # Exceptions can contain command output or malformed secret input: never print them verbatim.
        print("Échec de la récupération Vault. Vérifier l’accès root, le fichier 0600, l’état de Vault et la clé.", file=sys.stderr)
        sys.exit(1)
