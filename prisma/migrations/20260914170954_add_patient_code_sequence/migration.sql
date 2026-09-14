-- Sequence used to atomically generate human-facing Patient IDs (PDC-000123)
-- under concurrent requests, without a race condition.
CREATE SEQUENCE IF NOT EXISTS patient_code_seq START WITH 1 INCREMENT BY 1;
