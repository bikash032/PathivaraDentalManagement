-- Data-only migration: adopt the clinic's official Nepali name and address.
-- Touches only a clinic profile still carrying the old seeded English default,
-- so a name already customised in Settings is left alone. No schema change.
UPDATE "ClinicProfile"
SET "clinicName" = 'पाथिभरा डेण्टल क्लिनिक',
    "address"    = 'चौदण्डिगडी नगरपालिका-६, बेल्टार, बसपार्क',
    "updatedAt"  = CURRENT_TIMESTAMP
WHERE "clinicName" = 'Pathivara Dental Clinic';
