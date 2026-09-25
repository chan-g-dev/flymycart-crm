-- Shipment and Booking Entity Tracking Migration
-- Additive upgrade: preserve all existing customer, booking and shipment data.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_proof_front TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_proof_back TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS id_proof_front TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS id_proof_back TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS is_ddp BOOLEAN DEFAULT FALSE;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS receiver_id_proof VARCHAR(100);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS receiver_id_proof_front TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS receiver_id_proof_back TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS entity VARCHAR(100) DEFAULT 'Globe Courier';
CREATE INDEX IF NOT EXISTS idx_shipments_entity ON public.shipments (entity);

ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS entity VARCHAR(100) DEFAULT 'Globe Courier';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS is_ddp BOOLEAN DEFAULT FALSE;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS receiver_id_proof VARCHAR(100);
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS receiver_id_proof_front TEXT;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS receiver_id_proof_back TEXT;
CREATE INDEX IF NOT EXISTS idx_booking_requests_entity ON public.booking_requests (entity);
