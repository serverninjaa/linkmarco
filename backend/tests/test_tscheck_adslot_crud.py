"""Ad slot CRUD + ordering inside a site: add, edit, reorder, delete."""

import uuid

import httpx

from tests.conftest import api_url


def _login() -> httpx.Client:
    c = httpx.Client()
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


def test_adslot_crud_and_reorder():
    suffix = uuid.uuid4().hex[:8]
    slug = f"tscheck-slot-{suffix}"
    c = _login()
    try:
        site_resp = c.post(api_url("/sites"), json={"slug": slug, "name": "tscheck slot site"})
        assert site_resp.status_code == 201
        site_id = site_resp.json()["id"]

        # CREATE two slots
        slot_a = c.post(
            api_url(f"/sites/{site_id}/slots"),
            json={"site_id": site_id, "title": "A", "target_url": "https://a.example.com", "order": 0},
        )
        assert slot_a.status_code == 201, slot_a.text
        slot_a_id = slot_a.json()["id"]

        slot_b = c.post(
            api_url(f"/sites/{site_id}/slots"),
            json={"site_id": site_id, "title": "B", "target_url": "https://b.example.com", "order": 1},
        )
        assert slot_b.status_code == 201, slot_b.text
        slot_b_id = slot_b.json()["id"]

        # UPDATE slot A fields
        upd = c.put(
            api_url(f"/sites/{site_id}/slots/{slot_a_id}"),
            json={
                "title": "A Updated",
                "badge": "HOT",
                "text_size": "lg",
                "effect": "glow",
                "col_span": 2,
            },
        )
        assert upd.status_code == 200, upd.text
        assert upd.json()["title"] == "A Updated"
        assert upd.json()["effect"] == "glow"
        assert upd.json()["col_span"] == 2

        # persists on refetch
        list_resp = c.get(api_url(f"/sites/{site_id}/slots"))
        assert list_resp.status_code == 200
        slots = list_resp.json()
        by_id = {s["id"]: s for s in slots}
        assert by_id[slot_a_id]["badge"] == "HOT"
        assert by_id[slot_a_id]["text_size"] == "lg"

        # REORDER: put B first
        reorder = c.post(
            api_url(f"/sites/{site_id}/slots/reorder"), json={"ids": [slot_b_id, slot_a_id]}
        )
        assert reorder.status_code == 200, reorder.text
        ordered = reorder.json()
        assert [s["id"] for s in ordered] == [slot_b_id, slot_a_id]

        # DELETE slot A
        del_resp = c.delete(api_url(f"/sites/{site_id}/slots/{slot_a_id}"))
        assert del_resp.status_code == 200, del_resp.text
        remaining = c.get(api_url(f"/sites/{site_id}/slots")).json()
        assert slot_a_id not in [s["id"] for s in remaining]
    finally:
        c.delete(api_url(f"/sites/{site_id}"))
        c.close()
