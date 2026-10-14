import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Patient lookup for the pickers.
 *
 * Default mode matches a fragment anywhere in the name, phone or patient code.
 * `mode=name-prefix` narrows to names *starting with* the query, which is what
 * the billing patient-name search uses — there "ram" must find "Ram Kumar" but
 * not "Hari Ram". Prefix mode also answers from a single letter, since the
 * result set is naturally narrow.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "patient.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const namePrefix = searchParams.get("mode") === "name-prefix";

  if (q.length < (namePrefix ? 1 : 2)) return NextResponse.json([]);

  const where: Prisma.PatientWhereInput = namePrefix
    ? { status: "ACTIVE", fullName: { startsWith: q, mode: "insensitive" } }
    : {
        status: "ACTIVE",
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { patientCode: { contains: q, mode: "insensitive" } },
        ],
      };

  const patients = await db.patient.findMany({
    where,
    select: { id: true, fullName: true, phone: true, patientCode: true },
    take: 10,
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(patients);
}
