"""Logo upload accepts GIF images and serves them back; non-image uploads are rejected."""

import httpx

from tests.conftest import api_url

# Minimal 1x1 transparent GIF (43 bytes)
GIF_BYTES = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024c01003b"
)


def _login() -> httpx.Client:
    c = httpx.Client()
    resp = c.post(api_url("/auth/login"), json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, resp.text
    return c


def test_upload_gif_accepted_and_served():
    c = _login()
    try:
        files = {"file": ("tscheck-logo.gif", GIF_BYTES, "image/gif")}
        resp = c.post(api_url("/uploads"), files=files)
        assert resp.status_code == 200, resp.text
        url = resp.json()["url"]
        assert url.startswith("/api/uploads/")

        get_resp = c.get(api_url(url.replace("/api", "", 1)))
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.headers["content-type"] == "image/gif"
        assert get_resp.content == GIF_BYTES

        # cleanup
        upload_id = url.rsplit("/", 1)[-1]
        del_resp = c.delete(api_url(f"/uploads/{upload_id}"))
        assert del_resp.status_code == 200
    finally:
        c.close()


def test_upload_non_image_rejected():
    c = _login()
    try:
        files = {"file": ("tscheck-notes.txt", b"just some text", "text/plain")}
        resp = c.post(api_url("/uploads"), files=files)
        assert resp.status_code == 400, resp.text
    finally:
        c.close()
