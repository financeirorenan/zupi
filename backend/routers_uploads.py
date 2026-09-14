import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Response

from database import db
from security import require_roles
from storage import APP_NAME, put_object, get_object
from utils import now_iso

router = APIRouter(prefix="/api", tags=["uploads"])
uploader = require_roles("restaurant", "admin")

ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_BYTES = 5 * 1024 * 1024


@router.post("/uploads/image")
async def upload_image(file: UploadFile = File(...), user=Depends(uploader)):
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Envie uma imagem JPG, PNG, WEBP ou GIF")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Imagem muito grande (máx. 5 MB)")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await put_object(path, data, file.content_type)
    except Exception:
        raise HTTPException(502, "Falha ao enviar imagem. Tente novamente.")
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": file.filename,
        "content_type": file.content_type, "size": result.get("size", len(data)), "owner_id": user["id"],
        "is_deleted": False, "created_at": now_iso(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@router.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Arquivo não encontrado")
    try:
        data, ct = await get_object(path)
    except Exception:
        raise HTTPException(502, "Falha ao carregar imagem")
    return Response(content=data, media_type=rec.get("content_type", ct), headers={"Cache-Control": "public, max-age=86400"})
