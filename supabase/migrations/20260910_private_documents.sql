-- Run on the production Supabase database before enabling document uploads.
-- If SUPABASE_BUCKET differs, replace the bucket ID below.
BEGIN;
UPDATE storage.buckets SET public = false WHERE id = 'fly-my-cart-files';
-- CRM sessions are validated by FastAPI, not the Supabase Data API.
-- Restrictive policies also block any existing permissive client policies.
CREATE POLICY crm_documents_backend_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'fly-my-cart-files')
WITH CHECK (bucket_id <> 'fly-my-cart-files');
COMMIT;
