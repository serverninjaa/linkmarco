"""Cloudflare API v4 istemcisi — token yalnızca backend'de, .env üzerinden okunur."""

import os
from typing import Any, Optional

import httpx

BASE_URL = "https://api.cloudflare.com/client/v4"


class CloudflareError(Exception):
    def __init__(self, status_code: int, errors: list[Any]):
        self.status_code = status_code
        self.errors = errors
        message = (
            "; ".join(
                str(e.get("message", e)) if isinstance(e, dict) else str(e) for e in errors
            )
            or "Cloudflare isteği başarısız"
        )
        super().__init__(message)


def token() -> Optional[str]:
    value = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    return value or None


def global_key() -> Optional[tuple[str, str]]:
    """Global API Key kimliği (e-posta + anahtar). Token'da eksik izin varsa yedek yöntem."""
    email = os.environ.get("CLOUDFLARE_EMAIL", "").strip()
    key = os.environ.get("CLOUDFLARE_API_KEY", "").strip()
    return (email, key) if email and key else None


def credentials() -> Optional[dict]:
    """Kullanılacak kimlik başlıkları — Global Key varsa o tercih edilir (tüm izinlere sahip)."""
    gk = global_key()
    if gk:
        return {"X-Auth-Email": gk[0], "X-Auth-Key": gk[1], "Content-Type": "application/json"}
    api_token = token()
    if api_token:
        return {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}
    return None


def configured() -> bool:
    return credentials() is not None


async def cf_request(method: str, path: str, **kwargs) -> dict:
    """Cloudflare zarfını (success/errors/result) doğrular ve result gövdesini döner."""
    headers = credentials()
    if not headers:
        raise CloudflareError(
            400,
            [
                {
                    "message": "Cloudflare kimliği tanımlı değil — backend/.env içinde "
                    "CLOUDFLARE_API_TOKEN ya da CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY girin"
                }
            ],
        )
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, headers=headers, timeout=20.0) as client:
            response = await client.request(method, path, **kwargs)
    except httpx.RequestError as exc:
        raise CloudflareError(503, [{"message": f"Cloudflare'a ulaşılamadı: {exc}"}])

    try:
        body = response.json()
    except ValueError:
        raise CloudflareError(response.status_code, [{"message": "Geçersiz Cloudflare yanıtı"}])

    # Cloudflare 2xx döndürüp success=false verebilir; ikisini de kontrol et.
    if response.is_error or body.get("success") is not True:
        raise CloudflareError(
            response.status_code, body.get("errors") or [{"message": "İşlem başarısız"}]
        )
    return body
