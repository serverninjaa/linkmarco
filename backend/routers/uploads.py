"""Logo/görsel yükleme — dosyalar Mongo'da saklanır, diske bağımlılık yok."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from lib.db import db
from routers.auth import require_admin

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"}
MAX_BYTES = 2 * 1024 * 1024


class UploadResult(BaseModel):
    url: str


@router.post("", response_model=UploadResult, dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Sadece PNG, JPG, WEBP, GIF veya SVG yükleyebilirsiniz")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Dosya boyutu en fazla 2 MB olabilir")
    if not data:
        raise HTTPException(status_code=400, detail="Boş dosya")
    upload_id = str(uuid.uuid4())
    await db.uploads.insert_one(
        {
            "id": upload_id,
            "content_type": file.content_type,
            "filename": file.filename or "logo",
            "data": data,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return UploadResult(url=f"/api/uploads/{upload_id}")


@router.get("/{upload_id}")
async def get_image(upload_id: str):
    doc = await db.uploads.find_one({"id": upload_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc["content_type"],
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
