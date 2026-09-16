BEGIN;
CREATE TABLE IF NOT EXISTS payment_requests (
    id VARCHAR(64) PRIMARY KEY,
    fingerprint VARCHAR(64) NOT NULL,
    resource_id VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE payment_requests FROM anon, authenticated;
COMMIT;
