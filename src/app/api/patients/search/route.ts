import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "patient.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const patients = await db.patient.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { patientCode: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, phone: true, patientCode: true },
    take: 10,
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(patients);
}
