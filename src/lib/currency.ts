// Accepts number/string/null/undefined, plus anything Decimal-like
// (Prisma's Decimal) that stringifies to a numeric value.
export function formatNPR(amount: number | string | null | undefined | { toString(): string }): string {
  const num = amount == null ? 0 : Number(amount.toString());
  return `रु. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
