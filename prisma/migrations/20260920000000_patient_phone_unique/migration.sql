-- A patient's phone number identifies them, so it may belong to only one
-- record. Existing duplicates were resolved before this migration was applied.

-- DropIndex: the unique index below serves the same lookups.
DROP INDEX "Patient_phone_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Patient_phone_key" ON "Patient"("phone");
