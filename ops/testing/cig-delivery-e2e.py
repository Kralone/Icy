"""One explicitly selected local CIG retry; never activates global delivery."""
import json
import time
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:18080"
ENTRY_ID = 33

def request(path, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None if payload is None else json.dumps(payload).encode()
    with urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, headers=headers), timeout=100) as response:
        return json.load(response)

def main():
    login = request("/api/auth/login", {"username": "validation_admin", "password": "password"})
    token = login["tokens"]["accessToken"]
    def feed():
        return request("/api/news/cig/feed?limit=200", token=token)["data"]
    before = feed()
    assert before["discordRelayEnabled"], "Local relay must be enabled explicitly before running this test"
    selected = next(item for item in before["items"] if item["id"] == ENTRY_ID)
    assert selected["newsId"] == 2 and selected["translationStatus"] == "TRANSLATED"
    assert selected["deliveryStatus"] != "DELIVERED", "This test was already delivered; do not send another item"
    request(f"/api/news/cig/entries/{ENTRY_ID}/retry", {}, token)
    after = None
    for _ in range(20):
        after = feed()
        current = next(item for item in after["items"] if item["id"] == ENTRY_ID)
        if current["deliveryStatus"] == "DELIVERED":
            break
        time.sleep(2)
    assert current["deliveryStatus"] == "DELIVERED", current.get("lastError")
    request(f"/api/news/cig/entries/{ENTRY_ID}/retry", {}, token)
    final = feed()
    old_statuses = {item["id"]: item["deliveryStatus"] for item in before["items"]}
    changes = [{"id": item["id"], "before": old_statuses.get(item["id"]), "after": item["deliveryStatus"]}
               for item in final["items"] if old_statuses.get(item["id"]) != item["deliveryStatus"]]
    assert [item["id"] for item in changes] == [ENTRY_ID], changes
    report = {"entryId": ENTRY_ID, "newsId": 2, "deliveryStatus": current["deliveryStatus"],
              "changedEntries": changes, "entryCountBefore": len(before["items"]),
              "entryCountAfter": len(final["items"]), "secondRetry": "completed without status change"}
    Path("ops/testing/cig-delivery-e2e.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))

if __name__ == "__main__":
    main()
