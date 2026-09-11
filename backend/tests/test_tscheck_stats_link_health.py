"""Stats & link-health endpoints return well-shaped payloads for a freshly created site."""

import uuid

import httpx

from tests.conftest import api_url


def _login() -> httpx.Client:
    c = httpx.Client()
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


def test_site_stats_endpoint_shape():
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-stats-{suffix}"
    c = _login()
    try:
        site_resp = c.post(api_url("/sites"), json={"slug": slug, "name": "tscheck stats site"})
        assert site_resp.status_code == 201
        site_id = site_resp.json()["id"]

        slot_resp = c.post(
            api_url(f"/sites/{site_id}/slots"),
            json={"site_id": site_id, "title": "Stat Slot", "target_url": "https://example.com"},
        )
        assert slot_resp.status_code == 201
        slot_id = slot_resp.json()["id"]

        # generate a click via public endpoint
        with httpx.Client() as anon:
            click_resp = anon.post(api_url(f"/public/slots/{slot_id}/click"))
            assert click_resp.status_code == 200

        stats_resp = c.get(api_url(f"/sites/{site_id}/stats"), params={"days": 7})
        assert stats_resp.status_code == 200, stats_resp.text
        body = stats_resp.json()
        assert body["days"] == 7
        assert body["total_clicks"] >= 1
        assert isinstance(body["daily"], list) and len(body["daily"]) == 7
        assert any(s["slot_id"] == slot_id for s in body["slots"])

        # link health check endpoint
        health_resp = c.post(api_url(f"/sites/{site_id}/slots/check-links"))
        assert health_resp.status_code == 200, health_resp.text
        health = health_resp.json()
        assert health["checked"] == 1
        assert health["results"][0]["slot_id"] == slot_id
    finally:
        c.delete(api_url(f"/sites/{site_id}"))
        c.close()
