import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { PERMISSIONS, ROLE_SEED_DEFS, ROLE_KEYS } from "../src/lib/permissions";
import { OFFICIAL_CLINIC_ADDRESS, OFFICIAL_CLINIC_NAME } from "../src/lib/clinic-branding";

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, category: p.category },
      create: p,
    });
  }
}

async function seedRoles() {
  const allPermissionKeys = PERMISSIONS.map((p) => p.key);

  for (const roleDef of ROLE_SEED_DEFS) {
    const role = await db.role.upsert({
      where: { key: roleDef.key },
      update: { name: roleDef.name, description: roleDef.description },
      create: {
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });

    const grantedKeys = roleDef.permissions === "ALL" ? allPermissionKeys : roleDef.permissions;
    const permissions = await db.permission.findMany({ where: { key: { in: grantedKeys as string[] } } });

    for (const permission of permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — skipping Super Admin creation."
    );
    return;
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super Admin user already exists (${email}), leaving as-is.`);
    return;
  }

  const superAdminRole = await db.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.SUPER_ADMIN } });
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      name: "Super Admin",
      email,
      passwordHash,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Created Super Admin user: ${email} (change this password after first login).`);
}

async function seedPaymentMethods() {
  const methods = ["Cash", "Bank Transfer", "Card", "Digital Wallet", "Other"];
  for (const name of methods) {
    await db.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function seedTreatments() {
  const treatments = [
    { code: "CONSULT", name: "Consultation", defaultPrice: "500.00" },
    { code: "CLEAN", name: "Dental Cleaning (Scaling)", defaultPrice: "1500.00" },
    { code: "FILL", name: "Filling", defaultPrice: "2000.00" },
    { code: "EXTRACT", name: "Extraction", defaultPrice: "1500.00" },
    { code: "RCT", name: "Root Canal Treatment", defaultPrice: "8000.00" },
    { code: "CROWN", name: "Crown", defaultPrice: "10000.00" },
    { code: "XRAY", name: "X-Ray", defaultPrice: "500.00" },
  ];
  for (const t of treatments) {
    await db.treatment.upsert({ where: { code: t.code }, update: {}, create: t });
  }
}

async function seedClinicProfile() {
  const existing = await db.clinicProfile.findFirst();
  if (existing) return;

  await db.clinicProfile.create({
    data: {
      clinicName: process.env.CLINIC_NAME || OFFICIAL_CLINIC_NAME,
      address: OFFICIAL_CLINIC_ADDRESS,
    },
  });
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedSuperAdmin();
  await seedPaymentMethods();
  await seedTreatments();
  await seedClinicProfile();
  console.log("Seed complete.");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
