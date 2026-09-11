"""Host-based routing: /api/public/host-role classifies known ad domains as portal, others panel.

PANEL_DOMAIN is intentionally empty in this preview environment (per briefing), so any host
NOT registered as a site domain resolves to role=panel, and a registered domain resolves to
role=portal with its site slug.
"""

import httpx

from tests.conftest import api_url


def test_known_domain_resolves_to_portal_with_slug():
    with httpx.Client() as c:
        resp = c.get(api_url("/public/host-role"), params={"host": "marco.com"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["role"] == "portal", body
        assert body["slug"] == "marco", body


def test_unknown_host_resolves_to_panel():
    with httpx.Client() as c:
        resp = c.get(
            api_url("/public/host-role"), params={"host": "tscheck-unknown-host.example.com"}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["role"] == "panel", body
        assert body.get("slug") is None, body
