import "server-only";
import { db } from "@/lib/db";

export async function nextPatientCode(): Promise<string> {
  const rows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('patient_code_seq')`;
  const n = rows[0].nextval;
  return `PDC-${n.toString().padStart(6, "0")}`;
}
