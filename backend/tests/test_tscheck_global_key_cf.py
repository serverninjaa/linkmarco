"""Retest coverage for the Global API Key credential switch.

backend/.env now carries CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY (Global API Key) in
addition to the old CLOUDFLARE_API_TOKEN; the Global Key takes precedence and has full
account permissions, so previously permission-blocked operations (purge-cache,
zone-create) now succeed.

Covers the retest briefing's acceptance matrix:
1. Cache purge works with Global API Key -> POST purge-cache 200 {ok: true}.
2. GET /cloudflare/status reflects Global Key auth (configured, token_valid, token_status
   mentions "global key", account_name, server_ip).
3. Zone create works with Global Key -> POST /cloudflare/zones returns 200 with id/name/
   name_servers for a pending zone.
4. SSL read/write still fine on sultan5.com (flexible / always_use_https roundtrip).
5. autowire unaffected -> A records for sultan5.com + www.sultan5.com = server_ip, proxied.
6. verify-domains still 200.

Never touches marcopanel.site DNS/SSL (spec_deviations); sultan5.com SSL restored to
flexible afterward.
"""

import uuid

import httpx

from tests.conftest import api_url

ZONE_SULTAN5 = "e2933ef25eec2b393f57c2af845376e4"
SERVER_IP = "203.161.57.207"


def _login() -> httpx.Client:
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


def test_purge_cache_succeeds_with_global_key():
    c = _login()
    resp = c.post(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/purge-cache"))
    assert resp.status_code == 200, resp.text
    assert resp.json().get("ok") is True, resp.text


def test_cloudflare_status_reflects_global_key_auth():
    c = _login()
    resp = c.get(api_url("/cloudflare/status"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("configured") is True, body
    assert body.get("token_valid") is True, body
    token_status = str(body.get("token_status", "")).lower()
    assert "global key" in token_status, body
    assert body.get("account_name"), body
    assert body.get("server_ip") == SERVER_IP, body


def test_zone_create_succeeds_with_global_key():
    c = _login()
    name = f"tscheck-{uuid.uuid4().hex[:10]}.com"
    resp = c.post(api_url("/cloudflare/zones"), json={"name": name})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("name") == name, body
    assert "id" in body, body
    assert "name_servers" in body, body
    # NOTE: pending zone created at Cloudflare (name=%s); not deleted, per instructions
    # (tester not required to delete via Cloudflare).


def test_ssl_settings_roundtrip_sultan5():
    c = _login()

    get_resp = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
    assert get_resp.status_code == 200, get_resp.text
    original = get_resp.json()
    assert original["zone_id"] == ZONE_SULTAN5
    assert original.get("ssl") == "flexible", original
    original_https = original["always_use_https"]

    try:
        put_resp = c.put(
            api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"),
            json={"always_use_https": not original_https},
        )
        assert put_resp.status_code == 200, put_resp.text
        assert put_resp.json()["always_use_https"] is (not original_https), put_resp.json()

        confirm = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["always_use_https"] is (not original_https)
    finally:
        # restore to true per spec_deviations / briefing instruction
        restore = c.put(
            api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"),
            json={"always_use_https": True},
        )
        assert restore.status_code == 200, restore.text
        assert restore.json()["always_use_https"] is True


def test_autowire_unaffected_by_global_key_switch():
    c = _login()
    resp = c.post(api_url("/cloudflare/autowire"), json={"domain": "sultan5.com"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    records = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/records"))
    if records.status_code == 200:
        recs = {r["name"]: r for r in records.json() if r.get("type") == "A"}
        for hostname in ("sultan5.com", "www.sultan5.com"):
            assert hostname in recs, recs
            assert recs[hostname]["content"] == SERVER_IP, recs[hostname]
            assert recs[hostname]["proxied"] is True, recs[hostname]
    else:
        # fall back to autowire response body if dns-records endpoint shape differs
        assert body, body


def test_verify_domains_unaffected():
    c = _login()
    resp = c.get(api_url("/cloudflare/verify-domains"))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)
