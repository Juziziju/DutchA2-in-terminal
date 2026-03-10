"""Supabase Storage helper — upload and get public URLs for audio files."""

import re
import httpx

from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_AUDIO_BUCKET


def _sanitize(filename: str) -> str:
    """Make filename safe for Supabase Storage (ASCII only)."""
    # Replace accented chars with ASCII equivalents
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", filename)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    ascii_name = re.sub(r"[^\w.\-]", "_", ascii_name)
    return ascii_name or filename

# Sub-folders inside the bucket: vocab/, listening/, speaking/
# Public URL pattern: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }


def public_url(folder: str, filename: str) -> str:
    """Return the public CDN URL for a file in the audio bucket."""
    safe = _sanitize(filename)
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_AUDIO_BUCKET}/{folder}/{safe}"


def upload_file(folder: str, filename: str, data: bytes, content_type: str = "audio/mpeg") -> bool:
    """Upload a file to Supabase Storage. Returns True on success."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False
    safe = _sanitize(filename)
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_AUDIO_BUCKET}/{folder}/{safe}"
    resp = httpx.put(
        url,
        content=data,
        headers={**_headers(), "Content-Type": content_type, "x-upsert": "true"},
        timeout=30,
    )
    return resp.status_code in (200, 201)


def delete_file(folder: str, filename: str) -> bool:
    """Delete a file from Supabase Storage. Returns True on success."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False
    safe = _sanitize(filename)
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_AUDIO_BUCKET}/{folder}/{safe}"
    resp = httpx.delete(url, headers=_headers(), timeout=30)
    return resp.status_code in (200, 204)


def upload_file_from_path(folder: str, filepath: str) -> bool:
    """Upload a local file to Supabase Storage."""
    import os
    filename = os.path.basename(filepath)
    with open(filepath, "rb") as f:
        return upload_file(folder, filename, f.read())
