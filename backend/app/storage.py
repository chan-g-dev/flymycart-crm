"""Private document storage. Cloud failures never silently fall back to disk."""
from pathlib import Path
from urllib.parse import quote, unquote
import requests
from fastapi import HTTPException
from app.config import settings

class CloudStorageManager:
    def __init__(self):
        self.provider = settings.STORAGE_PROVIDER.lower()
        self.supabase_url = settings.SUPABASE_URL.rstrip('/')
        self.supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.supabase_bucket = settings.SUPABASE_BUCKET
        self.local_root = Path(__file__).resolve().parents[1] / 'uploads'

    def _key(self, value):
        prefix = f"{self.supabase_url}/storage/v1/object/public/{self.supabase_bucket}/"
        if value.startswith(prefix):
            value = unquote(value[len(prefix):])
        elif value.startswith('/uploads/'):
            value = value[len('/uploads/'):]
        if not value or value.startswith('/') or '\\' in value or ':' in value or any(p in ('', '.', '..') for p in value.split('/')):
            raise HTTPException(400, 'Invalid document path')
        return value

    def _headers(self):
        if not self.supabase_key:
            raise HTTPException(503, 'Document storage is not configured')
        return {'Authorization': f'Bearer {self.supabase_key}', 'apikey': self.supabase_key}

    def _r2(self):
        import boto3
        return boto3.client('s3', endpoint_url=f'https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
            aws_access_key_id=settings.R2_ACCESS_KEY_ID, aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto')

    def _local_path(self, key):
        if settings.ENVIRONMENT == 'production':
            raise HTTPException(503, 'Production requires cloud document storage')
        root = self.local_root.resolve()
        path = (root / key).resolve()
        if not path.is_relative_to(root):
            raise HTTPException(400, 'Invalid document path')
        return path

    def upload_file(self, file_bytes, filename, content_type='application/octet-stream'):
        key = self._key(filename)
        try:
            if self.provider == 'supabase':
                bucket = requests.get(f'{self.supabase_url}/storage/v1/bucket/{self.supabase_bucket}', headers=self._headers(), timeout=10)
                bucket.raise_for_status()
                if bucket.json().get('public', True):
                    raise HTTPException(503, 'Document storage bucket must be private')
                response = requests.post(f'{self.supabase_url}/storage/v1/object/{self.supabase_bucket}/{quote(key, safe="/")}',
                    headers={**self._headers(), 'Content-Type': content_type, 'x-upsert': 'false'}, data=file_bytes, timeout=30)
                response.raise_for_status()
            elif self.provider == 'r2':
                self._r2().put_object(Bucket=settings.R2_BUCKET_NAME, Key=key, Body=file_bytes, ContentType=content_type)
            elif self.provider == 'local':
                path = self._local_path(key)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(file_bytes)
            else:
                raise HTTPException(503, 'Unsupported document storage provider')
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(503, 'Document upload failed; please retry') from exc
        return key

    def download_file(self, value):
        key = self._key(value)
        try:
            if self.provider == 'supabase':
                response = requests.get(f'{self.supabase_url}/storage/v1/object/authenticated/{self.supabase_bucket}/{quote(key, safe="/")}',
                    headers=self._headers(), timeout=30)
                response.raise_for_status()
                return response.content
            if self.provider == 'r2':
                return self._r2().get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)['Body'].read()
            if self.provider == 'local':
                return self._local_path(key).read_bytes()
            raise HTTPException(503, 'Unsupported document storage provider')
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(503, 'Document download failed; please retry') from exc

storage_manager = CloudStorageManager()
