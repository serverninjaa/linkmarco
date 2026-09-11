"""Cloudflare error-message quality + unaffected-endpoints regression checks.

Covers the retest briefing's new criteria:
1. BUG FIX: purge-cache permission error is actionable (mentions "Zone → Cache Purge").
2. Zone-create permission error is actionable (mentions "Account → Zone → Edit").
3. Working endpoints (status/zones/verify-domains) still return 200 with expected data.
4. SSL settings panel read (GET) + write (PUT) round-trips.

Uses the live sultan5.com zone for SSL toggling (never marcopanel.site, per spec_deviations).
The configured Cloudflare token intentionally lacks Cache Purge and zone-create permissions,
so those calls are EXPECTED to fail at Cloudflare — the criterion is the quality of the 400
detail message, not success.
"""

import uuid

import httpx

from tests.conftest import api_url

ZONE_MARCOPANEL = "fba27ca4a607d42cdafaac1ecd0d1bab"
ZONE_SULTAN5 = "e2933ef25eec2b393f57c2af845376e4"


def _login() -> httpx.Client:
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


def test_purge_cache_permission_error_is_actionable():
    c = _login()
    resp = c.post(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/purge-cache"))
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert "Cache Purge" in detail, detail
    assert "Zone" in detail, detail
    # must not be the bare unhelpful Cloudflare error
    assert detail.strip() != "Cloudflare: Authentication error", detail
    assert len(detail) > 40, detail  # actionable instructions, not just a code


def test_zone_create_permission_error_is_actionable():
    c = _login()
    name = f"tscheck-{uuid.uuid4().hex[:8]}.example.com"
    resp = c.post(api_url("/cloudflare/zones"), json={"name": name})
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert "Account" in detail and "Zone" in detail and "Edit" in detail, detail
    assert detail.strip() != "Cloudflare: Authentication error", detail


def test_working_cloudflare_endpoints_unaffected():
    c = _login()

    status = c.get(api_url("/cloudflare/status"))
    assert status.status_code == 200, status.text
    body = status.json()
    assert body.get("token_valid") is True, body
    assert body.get("account_name"), body

    zones = c.get(api_url("/cloudflare/zones"))
    assert zones.status_code == 200, zones.text
    names = {z["name"] for z in zones.json()}
    assert "marcopanel.site" in names, names
    assert "sultan5.com" in names, names

    verify = c.get(api_url("/cloudflare/verify-domains"))
    assert verify.status_code == 200, verify.text
    assert isinstance(verify.json(), list)


def test_ssl_settings_read_and_write_roundtrip():
    c = _login()

    get_resp = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
    assert get_resp.status_code == 200, get_resp.text
    original = get_resp.json()
    assert original["zone_id"] == ZONE_SULTAN5
    original_https = original["always_use_https"]

    try:
        put_resp = c.put(
            api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"),
            json={"always_use_https": True},
        )
        assert put_resp.status_code == 200, put_resp.text
        updated = put_resp.json()
        assert updated["always_use_https"] is True, updated

        confirm = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["always_use_https"] is True, confirm.json()
    finally:
        # restore original value to avoid leaving mutated zone state behind
        c.put(
            api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"),
            json={"always_use_https": original_https},
        )
