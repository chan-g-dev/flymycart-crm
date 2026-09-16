-- Existing records retain NULL details; new payments are validated by the API.
ALTER TABLE payment_collections ADD COLUMN IF NOT EXISTS payment_details JSON;
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS payment_details JSON;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS payment_details JSON;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payment_details JSON;
