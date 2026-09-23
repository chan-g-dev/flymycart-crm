-- Allow descriptive customer categories without changing existing values.
BEGIN;
ALTER TABLE public.customers ALTER COLUMN customer_type TYPE VARCHAR(50);
ALTER TABLE public.shipments ALTER COLUMN customer_type TYPE VARCHAR(50);
ALTER TABLE public.booking_requests ALTER COLUMN customer_type TYPE VARCHAR(50);
COMMIT;
