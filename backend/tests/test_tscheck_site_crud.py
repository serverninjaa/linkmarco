"""Site CRUD: create / update / duplicate / set-default / delete via the admin API."""

import uuid

import httpx

from tests.conftest import api_url


def _login() -> httpx.Client:
    c = httpx.Client()
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "1727Fd40."})
    assert resp.status_code == 200, resp.text
    return c


def test_site_create_update_duplicate_set_default_delete():
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-site-{suffix}"
    c = _login()
    try:
        # CREATE
        create_resp = c.post(
            api_url("/sites"),
            json={"slug": slug, "name": f"tscheck-site-{suffix}", "domains": [], "title": "T"},
        )
        assert create_resp.status_code == 201, create_resp.text
        site = create_resp.json()
        site_id = site["id"]
        assert site["slug"] == slug

        # UPDATE
        upd_resp = c.put(api_url(f"/sites/{site_id}"), json={"title": "Updated Title", "columns": 5})
        assert upd_resp.status_code == 200, upd_resp.text
        updated = upd_resp.json()
        assert updated["title"] == "Updated Title"
        assert updated["columns"] == 5

        # persists on re-fetch
        get_resp = c.get(api_url(f"/sites/{site_id}"))
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Updated Title"

        # SET-DEFAULT
        default_resp = c.post(api_url(f"/sites/{site_id}/set-default"))
        assert default_resp.status_code == 200, default_resp.text
        assert default_resp.json()["is_default"] is True

        # DUPLICATE
        dup_slug = f"{slug}-dup"
        dup_resp = c.post(
            api_url(f"/sites/{site_id}/duplicate"),
            json={"slug": dup_slug, "name": "tscheck dup", "domains": []},
        )
        assert dup_resp.status_code == 201, dup_resp.text
        dup_site = dup_resp.json()
        assert dup_site["slug"] == dup_slug
        assert dup_site["is_default"] is False

        # DELETE both
        del1 = c.delete(api_url(f"/sites/{site_id}"))
        assert del1.status_code == 200, del1.text
        del2 = c.delete(api_url(f"/sites/{dup_site['id']}"))
        assert del2.status_code == 200, del2.text

        # confirm deleted
        confirm = c.get(api_url(f"/sites/{site_id}"))
        assert confirm.status_code == 404
    finally:
        c.close()


def test_site_create_duplicate_slug_rejected():
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-slugdup-{suffix}"
    c = _login()
    try:
        first = c.post(api_url("/sites"), json={"slug": slug, "name": "first"})
        assert first.status_code == 201
        site_id = first.json()["id"]
        second = c.post(api_url("/sites"), json={"slug": slug, "name": "second"})
        assert second.status_code == 409, second.text
        c.delete(api_url(f"/sites/{site_id}"))
    finally:
        c.close()
