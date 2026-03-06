"""One-time script: upload all local audio files to Supabase Storage."""

import os
import sys

# Ensure backend config loads .env
sys.path.insert(0, os.path.dirname(__file__))
from backend.core.storage import upload_file_from_path
from backend.config import ROOT_DIR

FOLDERS = {
    "vocab": ROOT_DIR / "audio",
    "listening": ROOT_DIR / "audio_listening",
    "speaking": ROOT_DIR / "audio_speaking",
}


def main():
    for folder_name, local_dir in FOLDERS.items():
        if not local_dir.is_dir():
            print(f"  Skipping {folder_name}: {local_dir} not found")
            continue
        files = [f for f in os.listdir(local_dir) if f.endswith(".mp3") or f.endswith(".webm")]
        print(f"\n  Uploading {len(files)} files to {folder_name}/...")
        ok = 0
        for f in files:
            path = str(local_dir / f)
            if upload_file_from_path(folder_name, path):
                ok += 1
            else:
                print(f"    FAILED: {f}")
        print(f"  Done: {ok}/{len(files)} uploaded to {folder_name}/")


if __name__ == "__main__":
    main()
