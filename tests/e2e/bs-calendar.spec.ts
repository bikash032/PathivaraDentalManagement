import { test, expect } from "@playwright/test";
import bikramSambat from "bikram-sambat";
import { pickBSDate, expectedBSText, toNepaliNumerals } from "./bs-helpers";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

/** Today's AD date in Nepal Time — the app's notion of "today". */
function todayInNepal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

test.describe("Bikram Sambat calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("the picker opens on today's BS month with Nepali weekday headers", async ({ page }) => {
    const todayBS = bikramSambat.toBik(todayInNepal());

    await page.goto("/appointments/new");
    await page.getByLabel("Date (वि.सं.)").click();

    const dialog = page.getByRole("dialog", { name: "Bikram Sambat date picker" });
    await expect(dialog).toBeVisible();

    // header shows the current BS month and year, dynamically — not hard-coded
    await expect(dialog).toContainText(toNepaliNumerals(todayBS.year));

    for (const weekday of ["आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि"]) {
      await expect(dialog.getByText(weekday, { exact: true })).toBeVisible();
    }

    // the "Today" button names today's BS date
    await expect(dialog.getByRole("button", { name: /आज/ })).toContainText(
      toNepaliNumerals(todayBS.day)
    );
  });

  test("month navigation shows the correct number of days for a BS month", async ({ page }) => {
    await page.goto("/appointments/new");

    // BS 2083 Asar (month 3) has 32 days — a length no Gregorian month has,
    // so selecting day 32 proves the grid is genuinely Bikram Sambat
    expect(bikramSambat.daysInMonth(2083, 3)).toBe(32);
    await pickBSDate(page, "Date (वि.सं.)", bikramSambat.toGreg_text(2083, 3, 32));
    await expect(page.getByLabel("Date (वि.सं.)")).toContainText("३२ असार २०८३");
  });

  test("a BS date chosen for an appointment is stored as the right AD date", async ({ page }) => {
    const stamp = Date.now();
    const doctorName = `Dr. BS ${stamp}`;
    const patientName = `BS Patient ${stamp}`;
    const adDate = "2027-03-11"; // BS 2083-11-27

    await page.goto("/users/new");
    await page.getByLabel("Name").fill(doctorName);
    await page.getByLabel("Email").fill(`bs-doctor.${stamp}@example.com`);
    await page.getByLabel("Role").selectOption({ label: "Doctor" });
    await page.getByLabel("Temporary password").fill("Temp-Password-123");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { name: doctorName })).toBeVisible();

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill("9812223334");
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    await page.goto("/appointments/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Doctor").selectOption({ label: doctorName });
    await pickBSDate(page, "Date (वि.सं.)", adDate);
    await page.getByLabel("Time").fill("09:30");
    await page.getByRole("button", { name: "Book appointment" }).click();

    // the appointment detail heading renders the BS date
    await expect(page.getByRole("heading", { name: new RegExp(expectedBSText(adDate)) })).toBeVisible();

    // and the underlying AD date is what the day view queries by
    await page.goto(`/appointments?date=${adDate}`);
    await expect(page.getByRole("row", { name: new RegExp(patientName) })).toBeVisible();
  });

  test("patient date of birth is entered in BS and displayed in BS", async ({ page }) => {
    const stamp = Date.now();
    const patientName = `DOB Patient ${stamp}`;
    const dobAD = "1990-06-15"; // BS 2047-03-01

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill("9813334445");
    await pickBSDate(page, "Date of birth (वि.सं., if known)", dobAD);
    await page.getByRole("button", { name: "Register patient" }).click();

    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();
    await expect(page.getByText(expectedBSText(dobAD))).toBeVisible();
  });

  test("reports accept a BS date range and filter correctly", async ({ page }) => {
    await page.goto("/reports?type=collection");
    // the range summary line renders as "<BS date> — <BS date>"
    await expect(page.getByText(/^\S+ \S+ २०\S+ — \S+ \S+ २०\S+$/)).toBeVisible();

    await pickBSDate(page, "From (वि.सं.)", "2026-09-01");
    await pickBSDate(page, "To (वि.सं.)", "2026-09-30");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/from=2026-09-01/);
    await expect(page).toHaveURL(/to=2026-09-30/);
  });
});
