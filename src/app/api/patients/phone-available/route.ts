import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth/current-user";
import { findPhoneOwner } from "@/lib/patient-phone";
import { normalizeNepaliPhone, nepaliPhoneRegex } from "@/lib/validation/patient";

/**
 * Availability check behind the patient form's phone field.
 *
 * Kept separate from /api/patients/search because it answers a different
 * question: search looks for ACTIVE patients by fragment, this reports the one
 * record — archived included — that would collide with the unique constraint.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "patient.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const phone = normalizeNepaliPhone(searchParams.get("phone")?.trim() ?? "");
  const excludeId = searchParams.get("excludeId") ?? undefined;

  // Not a complete number yet — nothing to report on.
  if (!nepaliPhoneRegex.test(phone)) return NextResponse.json({ taken: false });

  const owner = await findPhoneOwner(phone, excludeId);

  return NextResponse.json(
    owner ? { taken: true, fullName: owner.fullName, patientCode: owner.patientCode } : { taken: false }
  );
}
