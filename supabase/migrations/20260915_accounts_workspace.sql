-- Accounts workspace: additive metadata; existing transactions remain intact.
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS vendor VARCHAR(150);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(100);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS transfer_to VARCHAR(100);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS center VARCHAR(100);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(50);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS bill_key VARCHAR(500);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS bill_name VARCHAR(200);
CREATE INDEX IF NOT EXISTS ix_accounting_entries_shipment_id ON accounting_entries (shipment_id);
