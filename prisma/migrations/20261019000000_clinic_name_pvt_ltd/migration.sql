-- Data-only migration: the clinic's official name now includes "प्रा. लि".
-- Renames only a profile still carrying an earlier official name (Nepali or
-- the seeded English default); a name customised in Settings is left alone.
UPDATE "ClinicProfile"
SET "clinicName" = 'पाथिभरा डेण्टल क्लिनिक प्रा. लि',
    "updatedAt"  = CURRENT_TIMESTAMP
WHERE "clinicName" IN ('पाथिभरा डेण्टल क्लिनिक', 'Pathivara Dental Clinic');
