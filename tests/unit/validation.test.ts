import { describe, it, expect } from "vitest";
import { nepaliPhoneRegex, patientSchema } from "@/lib/validation/patient";
import { getDayRangeNepal, toNepalDateInputValue } from "@/lib/date";
import { combineDateTimeNepal } from "@/lib/validation/appointment";

describe("Nepali phone validation", () => {
  it.each(["9812345678", "9741234567", "9861234567", "9601234567"])("accepts %s", (phone) => {
    expect(nepaliPhoneRegex.test(phone)).toBe(true);
  });

  it.each([
    "981234567", // too short
    "98123456789", // too long
    "9512345678", // invalid prefix
    "1812345678", // doesn't start with 9
    "98-1234567", // punctuation
    "",
  ])("rejects %s", (phone) => {
    expect(nepaliPhoneRegex.test(phone)).toBe(false);
  });
});

describe("patientSchema", () => {
  it("requires a name and a valid phone", () => {
    const result = patientSchema.safeParse({ fullName: "R", phone: "123", gender: "MALE" });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid patient", () => {
    const result = patientSchema.safeParse({
      fullName: "Sita Sharma",
      phone: "9812345678",
      gender: "FEMALE",
    });
    expect(result.success).toBe(true);
  });
});

describe("Nepal timezone handling", () => {
  it("computes a day range as local midnight-to-midnight in Nepal (UTC+5:45)", () => {
    const { start, end } = getDayRangeNepal("2026-09-14");
    // Nepal midnight is 18:15 UTC the previous day
    expect(start.toISOString()).toBe("2026-09-13T18:15:00.000Z");
    expect(end.toISOString()).toBe("2026-09-14T18:15:00.000Z");
  });

  it("round-trips a date input value", () => {
    const { start } = getDayRangeNepal("2026-01-05");
    expect(toNepalDateInputValue(start)).toBe("2026-01-05");
  });

  it("combines a Nepal date and time into the correct UTC instant", () => {
    // 10:00 in Kathmandu is 04:15 UTC
    expect(combineDateTimeNepal("2026-09-14", "10:00").toISOString()).toBe("2026-09-14T04:15:00.000Z");
  });

  it("handles a time that crosses midnight UTC correctly", () => {
    // 02:00 in Kathmandu is 20:15 UTC on the previous day
    expect(combineDateTimeNepal("2026-09-14", "02:00").toISOString()).toBe("2026-09-13T20:15:00.000Z");
  });
});
