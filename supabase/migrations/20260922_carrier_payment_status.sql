-- Shipment Carrier Payment Status Tracking
BEGIN;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier_payment_status VARCHAR(20) DEFAULT 'Pending';
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_payment_status ON public.shipments (carrier_payment_status);
COMMIT;
