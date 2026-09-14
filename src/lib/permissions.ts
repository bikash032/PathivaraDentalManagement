// Single source of truth for permission keys, seeded into the database and
// referenced by authorization checks. Add a new permission here, then run
// `npx prisma db seed` — it will be created and auto-granted to Super Admin.

export const PERMISSIONS = [
  // Patients
  { key: "patient.view", category: "Patients", description: "View patient records" },
  { key: "patient.create", category: "Patients", description: "Register new patients" },
  { key: "patient.update", category: "Patients", description: "Edit patient records" },
  { key: "patient.archive", category: "Patients", description: "Archive or reactivate patients" },

  // Appointments
  { key: "appointment.view", category: "Appointments", description: "View appointments" },
  { key: "appointment.create", category: "Appointments", description: "Book appointments" },
  { key: "appointment.update", category: "Appointments", description: "Edit or change appointment status" },
  { key: "appointment.cancel", category: "Appointments", description: "Cancel appointments" },

  // Clinical
  { key: "visit.view", category: "Clinical", description: "View visit/clinical records" },
  { key: "visit.create", category: "Clinical", description: "Create visit/clinical records" },
  { key: "visit.update", category: "Clinical", description: "Edit visit/clinical records" },
  { key: "prescription.manage", category: "Clinical", description: "Create or edit prescriptions" },

  // Treatments
  { key: "treatment.manage", category: "Treatments", description: "Manage the treatment/service catalog" },

  // Billing
  { key: "billing.view", category: "Billing", description: "View invoices and payments" },
  { key: "invoice.create", category: "Billing", description: "Create invoices" },
  { key: "invoice.update", category: "Billing", description: "Edit unpaid invoices" },
  { key: "invoice.cancel", category: "Billing", description: "Cancel invoices" },
  { key: "payment.record", category: "Billing", description: "Record payments against an invoice" },
  { key: "payment.void", category: "Billing", description: "Void a recorded payment" },

  // Reports
  { key: "report.view", category: "Reports", description: "View operational and financial reports" },

  // Administration
  { key: "user.manage", category: "Administration", description: "Create, edit, deactivate staff accounts" },
  { key: "role.manage", category: "Administration", description: "Create/edit roles and permission grants" },
  { key: "settings.manage", category: "Administration", description: "Edit clinic profile and app settings" },
  { key: "audit.view", category: "Administration", description: "View the audit log" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ROLE_KEYS = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  RECEPTION: "RECEPTION",
  DOCTOR: "DOCTOR",
} as const;

const ADMIN_PERMISSIONS: PermissionKey[] = [
  "patient.view", "patient.create", "patient.update", "patient.archive",
  "appointment.view", "appointment.create", "appointment.update", "appointment.cancel",
  "visit.view", "visit.create", "visit.update", "prescription.manage",
  "treatment.manage",
  "billing.view", "invoice.create", "invoice.update", "invoice.cancel", "payment.record", "payment.void",
  "report.view",
  "audit.view",
  "settings.manage",
];

const RECEPTION_PERMISSIONS: PermissionKey[] = [
  "patient.view", "patient.create", "patient.update",
  "appointment.view", "appointment.create", "appointment.update", "appointment.cancel",
  "billing.view", "invoice.create", "payment.record",
];

const DOCTOR_PERMISSIONS: PermissionKey[] = [
  "patient.view",
  "appointment.view", "appointment.update",
  "visit.view", "visit.create", "visit.update", "prescription.manage",
];

/**
 * Seed definition for the 4 system roles. Super Admin's permission list is
 * "ALL" — resolved at seed time against the full PERMISSIONS array, so any
 * newly added permission is automatically granted to Super Admin.
 */
export const ROLE_SEED_DEFS = [
  {
    key: ROLE_KEYS.SUPER_ADMIN,
    name: "Super Admin",
    description: "Full system access: users, roles, settings, audit log, and all operational modules.",
    permissions: "ALL" as const,
  },
  {
    key: ROLE_KEYS.ADMIN,
    name: "Admin",
    description: "Operational and financial management across the clinic.",
    permissions: ADMIN_PERMISSIONS,
  },
  {
    key: ROLE_KEYS.RECEPTION,
    name: "Reception",
    description: "Front-desk: patients, appointments, and basic billing.",
    permissions: RECEPTION_PERMISSIONS,
  },
  {
    key: ROLE_KEYS.DOCTOR,
    name: "Doctor",
    description: "Appointments, clinical records, and patient history.",
    permissions: DOCTOR_PERMISSIONS,
  },
];
