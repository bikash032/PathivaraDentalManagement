import "server-only";
import { db } from "@/lib/db";

export async function nextInvoiceNumber(): Promise<string> {
  const rows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq')`;
  const n = rows[0].nextval;
  const year = new Date().getFullYear();
  return `INV-${year}-${n.toString().padStart(6, "0")}`;
}
