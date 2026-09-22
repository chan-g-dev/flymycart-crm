-- Personal access overrides are backend-only, like the existing RBAC tables.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    user_id VARCHAR(50) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    permission_code VARCHAR(200) REFERENCES public.permissions(code) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL,
    updated_by VARCHAR(50) REFERENCES public.user_profiles(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    PRIMARY KEY (user_id, permission_code)
);
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_permission_overrides FROM anon, authenticated;
COMMIT;
