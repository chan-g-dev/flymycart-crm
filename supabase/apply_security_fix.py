from pathlib import Path
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
from urllib.parse import urlparse

values = dotenv_values('backend/.env')
url = values['DATABASE_URL']
target = urlparse(url)
assert 'ftwjlunfjuzgfvwqmyqo' in (target.username or '') + (target.hostname or ''), 'Wrong project'
conn = psycopg2.connect(url, connect_timeout=10)
try:
    with conn.cursor() as cur:
        cur.execute('SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname=current_user')
        assert cur.fetchone() == ('postgres', True), 'Unexpected backend role'
        migration = Path('supabase/migrations/20260909_secure_public_tables.sql').read_text()
        assert migration.rstrip().endswith('COMMIT;')
        cur.execute(migration.rstrip()[:-len('COMMIT;')])
        cur.execute("SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind IN ('r','p') ORDER BY 1")
        tables = cur.fetchall()
        assert tables and all(enabled for _, enabled in tables)
        for role in ['anon', 'authenticated']:
            for name, _ in tables:
                for privilege in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']:
                    cur.execute('SELECT has_table_privilege(%s,%s,%s)', (role, 'public.' + name, privilege))
                    assert not cur.fetchone()[0], (role, name, privilege)
            cur.execute("SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'admin_%%' AND has_function_privilege(%s,p.oid,'EXECUTE')", (role,))
            assert not cur.fetchall(), 'Admin RPC remains accessible'
        for name, _ in tables:
            cur.execute(sql.SQL('SELECT * FROM public.{} LIMIT 0').format(sql.Identifier(name)))
        print('Verified: RLS enabled on all', len(tables), 'public tables.')
        print('Verified: anon and authenticated have no table privileges or admin RPC access.')
        print('Verified: backend postgres role can query every table.')
    conn.commit()
    print('COMMITTED security fix to fly-my-cart-db.')
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()

