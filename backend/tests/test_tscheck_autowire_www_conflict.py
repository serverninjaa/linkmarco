"""Cloudflare autowire behavior against the shared sultan5.com zone.

Both tests below share this module (not split into separate files) on purpose: pytest.ini
pins `-n 2 --dist loadscope`, which schedules whole modules to workers, so keeping them
together avoids a real cross-worker race on the same live Cloudflare zone.

1. BUG FIX: autowire must succeed even when a conflicting CNAME already exists for
   www.<domain> — it should convert/replace it with an A record, no duplicates left.
2. autowire with site_id attaches the domain to the chosen site's domains array.

Uses the sultan5.com zone (per spec_deviations — never touch marcopanel.site).
"""

import uuid

import httpx

from tests.conftest import api_url

DOMAIN = "sultan5.com"
WWW = f"www.{DOMAIN}"


def _login() -> httpx.Client:
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    return c


def _find_zone(c: httpx.Client, name: str) -> dict:
    resp = c.get(api_url("/cloudflare/zones"))
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    match = [z for z in zones if z["name"] == name]
    assert match, f"zone {name} not found in {zones}"
    return match[0]


def test_autowire_survives_existing_www_cname_conflict():
    c = _login()

    status = c.get(api_url("/cloudflare/status"))
    assert status.status_code == 200, status.text
    server_ip = status.json().get("server_ip")
    assert server_ip, "server_ip must be pre-configured for this test"

    zone = _find_zone(c, DOMAIN)
    zone_id = zone["id"]

    # Remove any pre-existing A/CNAME records at www.<domain> so we control the fixture,
    # then plant a conflicting CNAME (not pointing at server_ip) to reproduce the bug scenario.
    records = c.get(api_url(f"/cloudflare/zones/{zone_id}/records")).json()
    for r in records:
        if r["name"] == WWW and r["type"] in ("A", "CNAME"):
            del_resp = c.delete(api_url(f"/cloudflare/zones/{zone_id}/records/{r['id']}"))
            assert del_resp.status_code == 200, del_resp.text

    created = c.post(
        api_url(f"/cloudflare/zones/{zone_id}/records"),
        json={
            "type": "CNAME",
            "name": WWW,
            "content": "tscheck-conflict.example.com",
            "ttl": 1,
            "proxied": False,
        },
    )
    assert created.status_code == 200, created.text

    # Now autowire the domain — must succeed (not 400/409) despite the conflicting CNAME.
    autowire = c.post(api_url("/cloudflare/autowire"), json={"domain": DOMAIN})
    assert autowire.status_code == 200, autowire.text
    body = autowire.json()

    records_by_name = {r["name"]: r for r in body["records"]}
    assert DOMAIN in records_by_name, body
    assert WWW in records_by_name, body
    for name in (DOMAIN, WWW):
        rec = records_by_name[name]
        assert rec["type"] == "A", rec
        assert rec["content"] == server_ip, rec
        assert rec["proxied"] is True, rec

    # No duplicate/leftover A or CNAME record remains for either name.
    fresh = c.get(api_url(f"/cloudflare/zones/{zone_id}/records")).json()
    for name in (DOMAIN, WWW):
        matches = [r for r in fresh if r["name"] == name and r["type"] in ("A", "CNAME")]
        assert len(matches) == 1, f"expected exactly one A/CNAME record for {name}, got {matches}"
        assert matches[0]["type"] == "A"
        assert matches[0]["content"] == server_ip


def test_autowire_with_site_id_attaches_domain():
    c = _login()

    slug = f"tscheck-autowire-{uuid.uuid4().hex[:8]}"
    created = c.post(
        api_url("/sites"),
        json={"name": f"TS Autowire {slug}", "slug": slug, "domains": []},
    )
    assert created.status_code == 201, created.text
    site = created.json()
    site_id = site["id"]

    status = c.get(api_url("/cloudflare/status"))
    assert status.status_code == 200, status.text
    assert status.json().get("server_ip"), "server_ip must be pre-configured for this test"

    autowire = c.post(
        api_url("/cloudflare/autowire"), json={"domain": DOMAIN, "site_id": site_id}
    )
    assert autowire.status_code == 200, autowire.text

    sites = c.get(api_url("/sites"))
    assert sites.status_code == 200, sites.text
    match = next((s for s in sites.json() if s["id"] == site_id), None)
    assert match is not None, "created fixture site missing from GET /sites"
    assert DOMAIN in match["domains"], match
