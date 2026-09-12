"""Admin login sets a session cookie and protects /sites; invalid creds/no cookie are rejected."""

import httpx

from tests.conftest import api_url


def test_login_success_and_session_cookie():
    with httpx.Client() as c:
        resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["username"] == "admin"
        assert "ads_session" in resp.cookies


def test_sites_requires_auth_and_works_with_cookie():
    with httpx.Client() as c:
        # No cookie -> 401
        resp = c.get(api_url("/sites"))
        assert resp.status_code == 401, resp.text

        # Login then access with cookie
        login = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
        assert login.status_code == 200
        resp2 = c.get(api_url("/sites"))
        assert resp2.status_code == 200, resp2.text
        assert isinstance(resp2.json(), list)


def test_login_wrong_password_rejected():
    with httpx.Client() as c:
        resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "wrong-pass"})
        assert resp.status_code == 401, resp.text
