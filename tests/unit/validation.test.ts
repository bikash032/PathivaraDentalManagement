import { describe, it, expect } from "vitest";
import {
  nepaliPhoneRegex,
  patientSchema,
  normalizeNepaliPhone,
  phoneTakenMessage,
} from "@/lib/validation/patient";
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

describe("normalizeNepaliPhone", () => {
  it.each([
    ["9852828286", "9852828286"], // already bare
    ["+9779852828286", "9852828286"], // +977 country code
    ["9779852828286", "9852828286"], // 977 without the plus
    ["09852828286", "9852828286"], // trunk zero
    ["09752828286", "9752828286"],
    ["985-282-8286", "9852828286"], // punctuation
    ["985 282 8286", "9852828286"],
    ["(985) 2828286", "9852828286"],
    ["+977 985-282-8286", "9852828286"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeNepaliPhone(input)).toBe(expected);
  });

  it("leaves a valid local number starting with 977 alone", () => {
    // 9779852828 is a real 10-digit number, not a country code plus a number
    expect(normalizeNepaliPhone("9779852828")).toBe("9779852828");
    expect(nepaliPhoneRegex.test(normalizeNepaliPhone("9779852828"))).toBe(true);
  });

  it("maps every accepted spelling of one number onto the same key", () => {
    const spellings = ["9852828286", "+9779852828286", "09852828286", "985-282-8286"];
    const normalized = new Set(spellings.map(normalizeNepaliPhone));
    expect(normalized.size).toBe(1);
  });

  it("is applied by patientSchema before validation", () => {
    const parsed = patientSchema.safeParse({
      fullName: "Bikash Bishokarma",
      phone: "+977 985-282-8286",
      gender: "MALE",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("9852828286");
  });
});

describe("phoneTakenMessage", () => {
  it("names the patient holding the number", () => {
    expect(phoneTakenMessage("Bikash Bishokarma")).toBe(
      "Phone number is already used by Bikash Bishokarma."
    );
  });
});
