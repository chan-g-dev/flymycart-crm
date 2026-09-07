# ================================================================
# FLY MY CART CRM - UNIFIED CLOUD STORAGE ADAPTER (app/storage.py)
# ================================================================

import os
import io
import requests
from app.config import settings

class CloudStorageManager:
    """
    Unified Storage Adapter supporting:
    1. Supabase Storage (Active Default)
    2. Cloudflare R2 / AWS S3 (Seamless future switch)
    3. Local Storage (Offline Dev Fallback)
    """

    def __init__(self):
        self.provider = os.getenv("STORAGE_PROVIDER", "supabase").lower()
        self.supabase_url = os.getenv("SUPABASE_URL", "https://ftwjlunfjuzgfvwqmyqo.supabase.co").rstrip("/")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
        self.supabase_bucket = os.getenv("SUPABASE_BUCKET", "fly-my-cart-files")

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str:
        """
        Uploads a file to the active cloud storage provider and returns the public URL.
        """
        if self.provider == "supabase" and self.supabase_key:
            return self._upload_to_supabase(file_bytes, filename, content_type)
        elif self.provider == "r2" and settings.R2_ACCESS_KEY_ID:
            return self._upload_to_r2(file_bytes, filename, content_type)
        else:
            return self._save_locally(file_bytes, filename)

    def _upload_to_supabase(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Uploads file directly to Supabase Storage REST API."""
        upload_url = f"{self.supabase_url}/storage/v1/object/{self.supabase_bucket}/{filename}"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apiKey": self.supabase_key,
            "Content-Type": content_type,
            "x-upsert": "true"
        }
        
        try:
            response = requests.post(upload_url, headers=headers, data=file_bytes, timeout=10)
            if response.status_code in [200, 201]:
                # Return public asset URL
                return f"{self.supabase_url}/storage/v1/object/public/{self.supabase_bucket}/{filename}"
            else:
                print(f"[Supabase Storage Warning] Upload returned {response.status_code}: {response.text}")
                return self._save_locally(file_bytes, filename)
        except Exception as e:
            print(f"[Supabase Storage Error] {str(e)}")
            return self._save_locally(file_bytes, filename)

    def _upload_to_r2(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Uploads file to Cloudflare R2 via S3 API."""
        try:
            import boto3
            from botocore.config import Config
            
            s3_client = boto3.client(
                service_name="s3",
                endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto"
            )
            s3_client.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=filename,
                Body=file_bytes,
                ContentType=content_type
            )
            return f"https://{settings.R2_BUCKET_NAME}.r2.cloudflarestorage.com/{filename}"
        except Exception as e:
            print(f"[R2 Storage Error] {str(e)}")
            return self._save_locally(file_bytes, filename)

    def _save_locally(self, file_bytes: bytes, filename: str) -> str:
        """Fallback local file saving."""
        uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        file_path = os.path.join(uploads_dir, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return f"/uploads/{filename}"

storage_manager = CloudStorageManager()
