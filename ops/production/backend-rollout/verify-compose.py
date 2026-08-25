#!/usr/bin/env python3
"""Validate the effective backend Compose model without printing secrets."""

import json
import os
import sys


def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(1)


model = json.load(sys.stdin)
backend = model.get("services", {}).get("backend")
if not backend:
    fail("backend service is missing")

expected_image = os.environ.get("EXPECTED_BACKEND_IMAGE")
if not expected_image:
    fail("EXPECTED_BACKEND_IMAGE is missing")
if backend.get("image") != expected_image:
    fail("effective backend image is not the requested immutable tag")
if backend.get("build"):
    fail("backend build must be disabled in the production overlay")
if backend.get("user") != "10001:101":
    fail("backend must run as UID 10001 and GID 101")
if backend.get("read_only") is not True:
    fail("backend root filesystem is not read-only")

health_test = backend.get("healthcheck", {}).get("test", [])
if not any("http://127.0.0.1:8080/api/front/members" in item for item in health_test):
    fail("backend healthcheck must probe the local public API")

networks = backend.get("networks", {})
network_names = set(networks if isinstance(networks, list) else networks.keys())
if network_names != {"internal", "external"}:
    fail("backend must be attached only to internal and external networks")

if backend.get("ports"):
    fail("backend must not publish a host port")
if set(backend.get("cap_drop", [])) != {"ALL"}:
    fail("backend must drop all Linux capabilities")
if backend.get("cap_add"):
    fail("backend must not add a Linux capability")
if "no-new-privileges:true" not in backend.get("security_opt", []):
    fail("backend must enable no-new-privileges")

targets = {}
for mount in backend.get("volumes", []):
    if isinstance(mount, dict):
        targets[mount.get("target")] = not mount.get("read_only", False)
for target in ("/app/logs", "/app/uploads/images"):
    if targets.get(target) is not True:
        fail(f"required writable volume is missing: {target}")

tmpfs_targets = set()
for item in backend.get("tmpfs", []):
    if isinstance(item, dict):
        tmpfs_targets.add(item.get("target"))
    elif isinstance(item, str):
        tmpfs_targets.add(item.split(":", 1)[0])
if "/tmp" not in tmpfs_targets:
    fail("backend must have a tmpfs mounted on /tmp")

if int(backend.get("mem_limit", 0)) < 1024 * 1024 * 1024:
    fail("backend memory limit is unexpectedly low")
if int(backend.get("pids_limit", 0)) < 100:
    fail("backend PID limit is unexpectedly low")

print("Effective backend Compose model: OK")
