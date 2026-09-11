-- CRM tables are accessed through the authorized FastAPI backend.
-- Run as postgres. No customer records are modified.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE obj record;
BEGIN
    FOR obj IN
        SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', obj.relname);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', obj.relname);
    END LOOP;
END $$;

-- These policies previously granted every caller full access.
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access on audit log" ON public.profile_audit_log;
-- Profile access and administration are handled by the backend; remove
-- recursive policies and avoid exposing password hashes through the Data API.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can read audit log" ON public.profile_audit_log;

-- SECURITY DEFINER admin RPCs must not be callable by untrusted clients.
DO $$
DECLARE obj record;
BEGIN
    FOR obj IN
        SELECT p.oid::regprocedure AS signature FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN (
            'admin_approve_user', 'admin_reject_user',
            'admin_suspend_user', 'admin_change_user_role',
            'handle_new_user', 'log_profile_audit_trigger'
        )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', obj.signature);
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', obj.signature);
    END LOOP;
END $$;

-- New tables created by the backend must not inherit public API grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
COMMIT;
