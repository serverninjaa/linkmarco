"""Visitor public API: per-slug site config resolves, and click tracking increments counts."""

import uuid

import httpx

from tests.conftest import api_url


def _login() -> httpx.Client:
    c = httpx.Client()
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    return c


def test_public_site_resolves_by_slug_and_click_tracked():
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-public-{suffix}"
    admin = _login()
    try:
        site_resp = admin.post(api_url("/sites"), json={"slug": slug, "name": "tscheck public site"})
        assert site_resp.status_code == 201
        site_id = site_resp.json()["id"]

        slot_resp = admin.post(
            api_url(f"/sites/{site_id}/slots"),
            json={"site_id": site_id, "title": "Public Slot", "target_url": "https://example.com"},
        )
        assert slot_resp.status_code == 201
        slot_id = slot_resp.json()["id"]

        # Public, unauthenticated resolution
        with httpx.Client() as anon:
            pub_resp = anon.get(api_url("/public/site"), params={"slug": slug})
            assert pub_resp.status_code == 200, pub_resp.text
            body = pub_resp.json()
            assert body["site"]["slug"] == slug
            assert any(s["id"] == slot_id for s in body["slots"])

            click_resp = anon.post(api_url(f"/public/slots/{slot_id}/click"))
            assert click_resp.status_code == 200, click_resp.text
            assert click_resp.json()["ok"] is True

        # clicks incremented
        slots_after = admin.get(api_url(f"/sites/{site_id}/slots")).json()
        clicked = next(s for s in slots_after if s["id"] == slot_id)
        assert clicked["clicks"] == 1
    finally:
        admin.delete(api_url(f"/sites/{site_id}"))
        admin.close()


def test_public_site_unknown_slug_falls_back_to_default():
    with httpx.Client() as anon:
        resp = anon.get(api_url("/public/site"), params={"slug": "tscheck-unknown-slug-zzz"})
        # Documented spec deviation: unknown slug falls back to default site (200, not 404)
        assert resp.status_code == 200, resp.text
        assert "site" in resp.json()
