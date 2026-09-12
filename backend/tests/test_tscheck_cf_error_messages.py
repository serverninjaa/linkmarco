"""Cloudflare error-message quality + unaffected-endpoints regression checks.

NOTE (superseded by Global API Key credential switch, see test_tscheck_global_key_cf.py):
backend/.env now carries CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY (Global Key), which takes
precedence over the old scoped CLOUDFLARE_API_TOKEN. The Global Key has full permissions,
so purge-cache and zone-create no longer fail with actionable 400s — they now succeed (200).
test_purge_cache_permission_error_is_actionable below is kept only as a historical marker
and updated to assert the new success behavior; see test_tscheck_global_key_cf.py for the
full new-criteria coverage.

Covers the retest briefing's new criteria:
1. Zone-create permission error is actionable (mentions "Account → Zone → Edit") -- N/A now, see below.
2. Working endpoints (status/zones/verify-domains) still return 200 with expected data.
3. SSL settings panel read (GET) + write (PUT) round-trips.

Uses the live sultan5.com zone for SSL toggling (never marcopanel.site, per spec_deviations).
"""

import uuid

import httpx

from tests.conftest import api_url

ZONE_MARCOPANEL = "fba27ca4a607d42cdafaac1ecd0d1bab"
ZONE_SULTAN5 = "e2933ef25eec2b393f57c2af845376e4"


def _login() -> httpx.Client:
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    return c


def test_purge_cache_permission_error_is_actionable():
    # Superseded: with the Global API Key now configured, purge-cache succeeds.
    # See test_tscheck_global_key_cf.py::test_purge_cache_succeeds_with_global_key
    # for the current-behavior assertion. Kept here (updated) so the pre-existing
    # suite doesn't regress-fail after the credential switch.
    c = _login()
    resp = c.post(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/purge-cache"))
    assert resp.status_code == 200, resp.text
    assert resp.json().get("ok") is True, resp.text


def test_zone_create_permission_error_is_actionable():
    # Superseded: with the Global API Key now configured, zone-create succeeds
    # (creates a pending zone) instead of failing with a permission error.
    # See test_tscheck_global_key_cf.py::test_zone_create_succeeds_with_global_key.
    c = _login()
    name = f"tscheck-{uuid.uuid4().hex[:10]}.com"
    resp = c.post(api_url("/cloudflare/zones"), json={"name": name})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("name") == name, body
    assert "id" in body, body


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
