-- Receipt comparisons are snapshots, not payment or balance adjustments.
BEGIN;
CREATE TABLE IF NOT EXISTS public.account_checks (
    id varchar(50) PRIMARY KEY,
    date varchar(20) NOT NULL,
    account varchar(100) NOT NULL,
    center varchar(100),
    expected_amount double precision NOT NULL,
    counted_amount double precision NOT NULL,
    difference double precision NOT NULL,
    receipt_count integer NOT NULL,
    notes varchar(1000),
    checked_by varchar(100) NOT NULL,
    created_by varchar(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_account_checks_date ON public.account_checks(date);
CREATE INDEX IF NOT EXISTS ix_account_checks_account ON public.account_checks(account);
CREATE INDEX IF NOT EXISTS ix_account_checks_center ON public.account_checks(center);
ALTER TABLE public.account_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_checks FROM PUBLIC, anon, authenticated;
COMMIT;
