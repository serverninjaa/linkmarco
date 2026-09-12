"""Retest briefing: IP validation bug fix + autowire/SSL/IPv6/purge regression coverage.

Covers:
1. PUT /cloudflare/settings with an invalid (non-IPv4) server_ip -> 400 with a Turkish
   "not a valid IPv4" message (never a raw Cloudflare error).
2. With server_ip='' saved, POST /cloudflare/autowire -> 400 telling the user to save the
   server IPv4 first (never a raw Cloudflare "Content for A record must be a valid IPv4
   address" error).
3. Restoring a valid IPv4 (203.161.57.207) makes autowire succeed again: A records for
   sultan5.com + www.sultan5.com = 203.161.57.207, proxied true.
4. autowire disables IPv6 for the zone (GET .../ssl -> ipv6=false).
5. SSL/IPv6 panel: GET returns ssl/always_use_https/ipv6; PUT ipv6 true then false both
   round-trip correctly.
6. Cache purge still succeeds after all of the above.

Uses only the live sultan5.com zone (never marcopanel.site, per spec_deviations). The
global `server_ip` setting is restored to 203.161.57.207 at the end of every test that
mutates it, and the sultan5.com zone is left at ssl='flexible', ipv6=false.
"""

import httpx
import pytest

from tests.conftest import api_url

ZONE_SULTAN5 = "e2933ef25eec2b393f57c2af845376e4"
CORRECT_IP = "203.161.57.207"


def _login() -> httpx.Client:
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


@pytest.fixture
def logged_in():
    c = _login()
    try:
        yield c
    finally:
        # Always restore the global server_ip setting after any test that might have
        # changed it, per spec_deviations.
        c.put(api_url("/cloudflare/settings"), json={"server_ip": CORRECT_IP})
        c.close()


def test_invalid_server_ip_rejected_with_turkish_message(logged_in):
    c = logged_in
    resp = c.put(api_url("/cloudflare/settings"), json={"server_ip": "benim-sunucum"})
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert "benim-sunucum" in detail, detail
    assert "IPv4" in detail, detail
    # Never leak the raw Cloudflare A-record error text
    assert "Content for A record" not in detail, detail


def test_autowire_with_empty_server_ip_gives_actionable_400(logged_in):
    c = logged_in
    # Save an empty server_ip explicitly
    save = c.put(api_url("/cloudflare/settings"), json={"server_ip": ""})
    assert save.status_code == 200, save.text
    assert save.json().get("server_ip") == "", save.json()

    resp = c.post(api_url("/cloudflare/autowire"), json={"domain": "sultan5.com"})
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert "IP" in detail, detail
    assert "Content for A record" not in detail, detail
    assert "must be a valid IPv4 address" not in detail, detail


def test_autowire_succeeds_once_valid_ip_saved_and_disables_ipv6(logged_in):
    c = logged_in
    save = c.put(api_url("/cloudflare/settings"), json={"server_ip": CORRECT_IP})
    assert save.status_code == 200, save.text
    assert save.json().get("server_ip") == CORRECT_IP, save.json()

    resp = c.post(api_url("/cloudflare/autowire"), json={"domain": "sultan5.com"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    records = {r["name"]: r for r in body["records"]}
    assert records["sultan5.com"]["content"] == CORRECT_IP, records
    assert records["sultan5.com"]["proxied"] is True, records
    assert records["www.sultan5.com"]["content"] == CORRECT_IP, records
    assert records["www.sultan5.com"]["proxied"] is True, records

    ssl = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
    assert ssl.status_code == 200, ssl.text
    assert ssl.json().get("ipv6") is False, ssl.json()


def test_ssl_ipv6_panel_toggle_roundtrip(logged_in):
    c = logged_in
    get_resp = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
    assert get_resp.status_code == 200, get_resp.text
    original = get_resp.json()
    for key in ("ssl", "always_use_https", "ipv6"):
        assert key in original, original

    try:
        on = c.put(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"), json={"ipv6": True})
        assert on.status_code == 200, on.text
        assert on.json().get("ipv6") is True, on.json()

        confirm_on = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"))
        assert confirm_on.json().get("ipv6") is True, confirm_on.json()

        off = c.put(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"), json={"ipv6": False})
        assert off.status_code == 200, off.text
        assert off.json().get("ipv6") is False, off.json()
    finally:
        # Leave sultan5.com at ssl=flexible, ipv6=false per spec_deviations
        c.put(
            api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl"),
            json={"ssl": "flexible", "ipv6": False},
        )
        final = c.get(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/ssl")).json()
        assert final.get("ssl") == "flexible", final
        assert final.get("ipv6") is False, final


def test_purge_cache_still_succeeds(logged_in):
    c = logged_in
    resp = c.post(api_url(f"/cloudflare/zones/{ZONE_SULTAN5}/purge-cache"))
    assert resp.status_code == 200, resp.text
    assert resp.json().get("ok") is True, resp.text
