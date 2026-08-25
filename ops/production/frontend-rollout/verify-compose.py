#!/usr/bin/env python3
"""Validate only the effective frontend Compose model without printing secrets."""

import json
import os
import sys


def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(1)


model = json.load(sys.stdin)
frontend = model.get("services", {}).get("frontend")
if not frontend:
    fail("frontend service is missing")

expected_image = os.environ.get("EXPECTED_FRONTEND_IMAGE")
if not expected_image:
    fail("EXPECTED_FRONTEND_IMAGE is missing")
if frontend.get("image") != expected_image:
    fail("effective frontend image is not the requested immutable tag")
if frontend.get("build"):
    fail("frontend build must be disabled in the production overlay")
if frontend.get("user") not in ("0:0", "0"):
    fail("frontend master must start as root to read the 0600 TLS key")
if frontend.get("read_only") is not True:
    fail("frontend root filesystem is not read-only")

networks = frontend.get("networks", {})
network_names = set(networks if isinstance(networks, list) else networks.keys())
if network_names != {"internal", "external"}:
    fail("frontend must be attached only to internal and external networks")

if "ALL" not in frontend.get("cap_drop", []):
    fail("frontend must drop all Linux capabilities")
if set(frontend.get("cap_add", [])) != {"CHOWN", "SETGID", "SETUID"}:
    fail("frontend must add back only CHOWN, SETGID, and SETUID for nginx workers")
if "no-new-privileges:true" not in frontend.get("security_opt", []):
    fail("frontend must enable no-new-privileges")

targets = set()
for mount in frontend.get("volumes", []):
    if isinstance(mount, dict):
        targets.add(mount.get("target"))
required_targets = {
    "/etc/nginx/nginx.conf",
    "/etc/nginx/conf.d/default.conf",
    "/etc/letsencrypt",
    "/usr/share/nginx/html/images",
}
if not required_targets.issubset(targets):
    fail("one or more required nginx, TLS, or image mounts are missing")

ports = set()
for port in frontend.get("ports", []):
    if isinstance(port, dict):
        ports.add((str(port.get("published")), str(port.get("target"))))
if ports != {("80", "8080"), ("443", "8443")}:
    fail("frontend ports must be exactly 80:8080 and 443:8443")

print("Effective frontend Compose model: OK")
