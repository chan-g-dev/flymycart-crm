-- ================================================================
-- FLY MY CART CRM / STAFF MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'manager', 'staff', 'viewer')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    requested_role VARCHAR(50) NOT NULL DEFAULT 'staff' CHECK (requested_role IN ('super_admin', 'manager', 'staff', 'viewer')),
    password_hash VARCHAR(255),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarantee that ONLY ONE row can EVER have role = 'super_admin'
CREATE UNIQUE INDEX IF NOT EXISTS unique_super_admin ON public.profiles (role) WHERE role = 'super_admin';

-- 2. PROFILE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('approved', 'rejected', 'suspended', 'role_changed', 'reactivated', 'created')),
    old_role VARCHAR(50),
    new_role VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_profile_id ON public.profile_audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.profile_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.profile_audit_log(action);

-- 3. AUTOMATIC USER CREATION TRIGGER (FROM Supabase auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name VARCHAR(255);
    v_req_role VARCHAR(50);
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    v_req_role := COALESCE(
        NEW.raw_user_meta_data->>'requested_role',
        NEW.raw_user_meta_data->>'role',
        'staff'
    );
    
    IF v_req_role NOT IN ('super_admin', 'manager', 'staff', 'viewer') THEN
        v_req_role := 'staff';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        status,
        requested_role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        'staff',
        'pending',
        v_req_role,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. AUTOMATIC AUDIT TRIGGER FUNCTION ON PROFILES (AFTER UPDATE)
CREATE OR REPLACE FUNCTION public.log_profile_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(50);
    v_changed_by UUID;
    v_reason TEXT;
    v_changed_by_str TEXT;
BEGIN
    -- Only trigger if role or status changed
    IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        -- Determine primary action
        IF OLD.status = 'suspended' AND NEW.status = 'approved' THEN
            v_action := 'reactivated';
        ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
            v_action := 'approved';
        ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
            v_action := 'rejected';
        ELSIF NEW.status = 'suspended' AND OLD.status != 'suspended' THEN
            v_action := 'suspended';
        ELSIF OLD.role IS DISTINCT FROM NEW.role THEN
            v_action := 'role_changed';
        ELSE
            v_action := 'role_changed';
        END IF;

        -- Extract session variables if passed by FastAPI / session
        BEGIN
            v_changed_by_str := NULLIF(current_setting('app.audit_changed_by', true), '');
            IF v_changed_by_str IS NOT NULL THEN
                v_changed_by := v_changed_by_str::UUID;
            ELSE
                v_changed_by := NEW.approved_by;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_changed_by := NEW.approved_by;
        END;

        BEGIN
            v_reason := NULLIF(current_setting('app.audit_reason', true), '');
        EXCEPTION WHEN OTHERS THEN
            v_reason := NULL;
        END;

        -- Insert audit log record
        INSERT INTO public.profile_audit_log (
            profile_id,
            changed_by,
            action,
            old_role,
            new_role,
            old_status,
            new_status,
            reason,
            created_at
        ) VALUES (
            NEW.id,
            v_changed_by,
            v_action,
            OLD.role,
            NEW.role,
            OLD.status,
            NEW.status,
            v_reason,
            NOW()
        );
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_audit ON public.profiles;
CREATE TRIGGER trg_profile_audit
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_profile_audit_trigger();

-- 5. HELPER STORED FUNCTIONS (RPC) FOR ATOMIC ACTIONS WITH AUDIT REASONS
CREATE OR REPLACE FUNCTION public.admin_approve_user(
    p_profile_id UUID,
    p_admin_id UUID,
    p_role VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    -- Set session variables for audit trigger
    PERFORM set_config('app.audit_changed_by', p_admin_id::TEXT, true);
    IF p_reason IS NOT NULL THEN
        PERFORM set_config('app.audit_reason', p_reason, true);
    END IF;

    UPDATE public.profiles
    SET role = p_role,
        status = 'approved',
        approved_by = p_admin_id,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_profile_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found with ID %', p_profile_id;
    END IF;

    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_user(
    p_profile_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    PERFORM set_config('app.audit_changed_by', p_admin_id::TEXT, true);
    IF p_reason IS NOT NULL THEN
        PERFORM set_config('app.audit_reason', p_reason, true);
    END IF;

    UPDATE public.profiles
    SET status = 'rejected',
        approved_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_profile_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found with ID %', p_profile_id;
    END IF;

    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(
    p_profile_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    PERFORM set_config('app.audit_changed_by', p_admin_id::TEXT, true);
    IF p_reason IS NOT NULL THEN
        PERFORM set_config('app.audit_reason', p_reason, true);
    END IF;

    UPDATE public.profiles
    SET status = 'suspended',
        approved_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_profile_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found with ID %', p_profile_id;
    END IF;

    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_change_user_role(
    p_profile_id UUID,
    p_admin_id UUID,
    p_role VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    PERFORM set_config('app.audit_changed_by', p_admin_id::TEXT, true);
    IF p_reason IS NOT NULL THEN
        PERFORM set_config('app.audit_reason', p_reason, true);
    END IF;

    UPDATE public.profiles
    SET role = p_role,
        updated_at = NOW()
    WHERE id = p_profile_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found with ID %', p_profile_id;
    END IF;

    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS) AND BACKEND-ONLY ACCESS
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
