"""Startup checks use an isolated subprocess and never contact production services."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


class StartupTests(unittest.TestCase):
    def test_fresh_database_startup_and_health(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory, 'startup.db').as_posix()
            env = {**os.environ, "DATABASE_URL": f"sqlite:///{database}",
                   "ENVIRONMENT": "development", "REMINDERS_ENABLED": "false",
                   "BOOTSTRAP_ADMIN_PASSWORD": "startup-test-only-password-918273!"}
            code = """
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    response = client.get('/api/health')
    assert response.status_code == 200, response.text
    assert response.json()['database'] == 'healthy'
"""
            result = subprocess.run([sys.executable, '-c', code],
                cwd=Path(__file__).resolve().parents[1], env=env,
                capture_output=True, text=True, timeout=45)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_application_import_does_not_initialize_supabase(self):
        env = {**os.environ, "DATABASE_URL": "sqlite:///:memory:",
               "ENVIRONMENT": "development", "REMINDERS_ENABLED": "false"}
        result = subprocess.run(
            [sys.executable, "-c", "import sys; import app.main; assert 'supabase' not in sys.modules"],
            cwd=Path(__file__).resolve().parents[1], env=env,
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_unconfigured_client_does_not_load_sdk(self):
        from app.dependencies import _get_supabase_client
        with patch('app.dependencies._create_supabase_client') as create:
            self.assertIsNone(_get_supabase_client(''))
            create.assert_not_called()

    def test_client_construction_failure_can_retry(self):
        from app.dependencies import _get_supabase_client
        client = object()
        with patch('app.dependencies.settings.SUPABASE_URL', 'https://example.supabase.co'), \
             patch('app.dependencies._create_supabase_client', side_effect=[RuntimeError('unavailable'), client]), \
             self.assertLogs('app.dependencies', level='WARNING'):
            self.assertIsNone(_get_supabase_client('test-key-longer-than-twenty-characters'))
            self.assertIs(_get_supabase_client('test-key-longer-than-twenty-characters'), client)
