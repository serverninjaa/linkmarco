"""Criterion: Active-domain gating still works.

Creates its own fixture site (never touches the seeded 'marco' site) with two domains and
an explicit active_domain set. Verifies:
- GET /api/public/site?host=<other listed domain> -> status 'pending', slots == [].
- GET /api/public/site?host=<active domain> -> status 'live', slots present.
Cleans up the fixture site afterwards.
"""

import uuid

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


@pytest.fixture
def gated_site(logged_in):
    c = logged_in
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-gate-{suffix}"
    active_domain = f"tscheck-active-{suffix}.example.com"
    other_domain = f"tscheck-pending-{suffix}.example.com"
    payload = {
        "slug": slug,
        "name": f"TS Check Gate {suffix}",
        "domains": [active_domain, other_domain],
        "active_domain": active_domain,
    }
    resp = c.post(api_url("/sites"), json=payload)
    assert resp.status_code in (200, 201), resp.text
    site = resp.json()
    try:
        yield site, active_domain, other_domain
    finally:
        c.delete(api_url(f"/sites/{site['id']}"))


def test_other_listed_domain_is_pending_with_no_slots(gated_site):
    _site, active_domain, other_domain = gated_site
    resp = httpx.get(api_url("/public/site"), params={"host": other_domain}, timeout=30.0)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "pending", body
    assert body.get("slots") == [], body


def test_active_domain_is_live_with_slots_field_present(gated_site):
    _site, active_domain, other_domain = gated_site
    resp = httpx.get(api_url("/public/site"), params={"host": active_domain}, timeout=30.0)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "live", body
    assert "slots" in body, body
