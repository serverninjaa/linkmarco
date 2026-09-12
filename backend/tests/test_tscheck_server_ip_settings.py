"""Criterion: Server IP can be saved and drives the SSL checks.

Covers:
1. PUT /api/cloudflare/settings with a valid IPv4 returns 200 and the value round-trips
   via GET /api/cloudflare/status (server_ip) — this is what the panel's server-IP card
   reads to render "Kayıtlı IP".
2. An invalid value (non-IPv4 string) is rejected with 400 and a Turkish message.
3. The saved server_ip is restored to the seeded 203.161.57.207 at the end (per
   seed_facts) so it keeps driving the SSL DNS checks used by other criteria.
"""

import httpx
import pytest

from tests.conftest import api_url

SEEDED_IP = "203.161.57.207"


@pytest.fixture
def logged_in():
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    try:
        yield c
    finally:
        c.put(api_url("/cloudflare/settings"), json={"server_ip": SEEDED_IP})
        c.close()


def test_valid_ipv4_saved_and_reflected_in_status(logged_in):
    c = logged_in
    test_ip = "203.0.113.77"  # TEST-NET-3, harmless placeholder
    resp = c.put(api_url("/cloudflare/settings"), json={"server_ip": test_ip})
    assert resp.status_code == 200, resp.text
    assert resp.json()["server_ip"] == test_ip

    status = c.get(api_url("/cloudflare/status"))
    assert status.status_code == 200, status.text
    assert status.json()["server_ip"] == test_ip

    ssl_status = c.get(api_url("/ssl"))
    assert ssl_status.status_code == 200, ssl_status.text
    assert ssl_status.json()["server_ip"] == test_ip


def test_invalid_ip_rejected_with_4xx(logged_in):
    c = logged_in
    resp = c.put(api_url("/cloudflare/settings"), json={"server_ip": "not-an-ip"})
    assert 400 <= resp.status_code < 500, resp.text
    detail = resp.json().get("detail", "")
    assert "IPv4" in detail, detail
