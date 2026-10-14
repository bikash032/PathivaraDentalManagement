import { db } from "@/lib/db";

export type PhoneOwner = { id: string; fullName: string; patientCode: string };

/**
 * The patient already holding `phone`, or null.
 *
 * `excludeId` is the record being edited, so a patient keeping their own
 * number is never reported as a collision.
 *
 * Deliberately not filtered by status: the database constraint is global, so
 * an archived patient still owns their number and must be reported here —
 * otherwise the form would promise a save that the database then rejects.
 */
export async function findPhoneOwner(
  phone: string,
  excludeId?: string
): Promise<PhoneOwner | null> {
  return db.patient.findFirst({
    where: {
      phone,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, fullName: true, patientCode: true },
  });
}

/**
 * True when Prisma rejected a write because of the phone unique index.
 *
 * The pre-checks above close the ordinary case; this catches the narrow race
 * where two registrations pass their check and only one can win, so the loser
 * sees a field error instead of a 500.
 */
export function isPhoneUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((field) => field.toLowerCase().includes("phone"));
}
