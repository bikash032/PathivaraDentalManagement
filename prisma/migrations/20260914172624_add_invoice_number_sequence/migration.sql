-- Sequence used to atomically generate human-facing Invoice numbers
-- (INV-2027-000123) under concurrent requests, without a race condition.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;
