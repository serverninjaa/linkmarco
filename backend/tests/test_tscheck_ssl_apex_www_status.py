"""Criterion: SSL card reports apex and www DNS separately + auth/issue guards.

Covers:
1. GET /api/ssl (authed) returns, for each registered ad domain, both resolved_ip/dns_ok
   (apex) and www_resolved_ip/www_dns_ok (www); `ready` is true only when apex+www+cert
   are all ok.
2. Unauthenticated GET /api/ssl and POST /api/ssl/issue both return 401.
3. POST /api/ssl/issue with a domain NOT registered on any site returns 422.
4. In this preview environment (no certbot installed), POST /api/ssl/issue for a known
   domain (marco.com, seeded) returns 503 with a Turkish "certbot kurulu değil" message.
"""

import httpx
import pytest

from tests.conftest import api_url


@pytest.fixture
def logged_in():
    c = httpx.Client(timeout=30.0)
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    try:
        yield c
    finally:
        c.close()


def test_ssl_status_reports_apex_and_www_separately(logged_in):
    c = logged_in
    resp = c.get(api_url("/ssl"))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "server_ip" in body
    rows = body.get("domains") or []
    marco_row = next((r for r in rows if r["domain"] == "marco.com"), None)
    assert marco_row is not None, rows

    for field in ("resolved_ip", "dns_ok", "www_resolved_ip", "www_dns_ok", "cert_ok", "ready"):
        assert field in marco_row, marco_row

    # marco.com resolves to 209.59.129.74 while server_ip is 203.161.57.207 (spec_deviations)
    # -> dns_ok must be False, and ready can never be true when dns_ok is False.
    if not marco_row["dns_ok"]:
        assert marco_row["ready"] is False, marco_row
    # ready requires apex AND www AND cert all ok simultaneously.
    expected_ready = marco_row["dns_ok"] and marco_row["www_dns_ok"] and marco_row["cert_ok"]
    assert marco_row["ready"] == expected_ready, marco_row


def test_ssl_endpoints_require_auth():
    anon = httpx.Client(timeout=30.0)
    r1 = anon.get(api_url("/ssl"))
    assert r1.status_code == 401, r1.text
    r2 = anon.post(api_url("/ssl/issue"), json={})
    assert r2.status_code == 401, r2.text


def test_issue_rejects_domain_not_registered_in_panel(logged_in):
    c = logged_in
    resp = c.post(
        api_url("/ssl/issue"),
        json={"domains": ["tscheck-unregistered-ssl.example.com"]},
    )
    assert resp.status_code == 422, resp.text
    assert "tscheck-unregistered-ssl.example.com" in resp.json().get("detail", "")


def test_issue_known_domain_fails_503_no_certbot_in_preview(logged_in):
    c = logged_in
    resp = c.post(api_url("/ssl/issue"), json={"domains": ["marco.com"]})
    assert resp.status_code == 503, resp.text
    detail = resp.json().get("detail", "")
    assert "certbot" in detail.lower(), detail
