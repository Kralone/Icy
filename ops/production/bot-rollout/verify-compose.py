#!/usr/bin/env python3
"""Validate the effective bot Compose model without printing secrets."""

import json
import os
import sys


def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(1)


model = json.load(sys.stdin)
bot = model.get("services", {}).get("bot")
if not bot:
    fail("bot service is missing")

expected_image = os.environ.get("EXPECTED_BOT_IMAGE")
if not expected_image or bot.get("image") != expected_image:
    fail("effective bot image is not the requested immutable tag")
if bot.get("build"):
    fail("bot build must be disabled in the production overlay")
if bot.get("user") != "10001:10001":
    fail("bot must run as UID/GID 10001")
if bot.get("read_only") is not True:
    fail("bot root filesystem is not read-only")
if bot.get("ports"):
    fail("bot must not publish a host port")

networks = bot.get("networks", {})
network_names = set(networks if isinstance(networks, list) else networks.keys())
if network_names != {"internal", "external"}:
    fail("bot must be attached only to internal and external networks")
if set(bot.get("cap_drop", [])) != {"ALL"} or bot.get("cap_add"):
    fail("bot capabilities are not fully dropped")
if "no-new-privileges:true" not in bot.get("security_opt", []):
    fail("bot must enable no-new-privileges")

targets = {}
for mount in bot.get("volumes", []):
    if isinstance(mount, dict):
        targets[mount.get("target")] = not mount.get("read_only", False)
if targets.get("/app/config") is not True:
    fail("writable bot config volume is missing")

health_test = bot.get("healthcheck", {}).get("test", [])
if not any("socket.create_connection" in item for item in health_test):
    fail("bot healthcheck must probe RabbitMQ")
if int(bot.get("mem_limit", 0)) < 128 * 1024 * 1024:
    fail("bot memory limit is unexpectedly low")
if int(bot.get("pids_limit", 0)) < 50:
    fail("bot PID limit is unexpectedly low")

print("Effective bot Compose model: OK")
