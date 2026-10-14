import { test, expect, type Page } from "@playwright/test";
import { uniquePhone } from "./fixtures";
import { pickBSDate } from "./bs-helpers";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

/** Boundary dates for the range under test. */
const FROM_DATE = "2027-05-10";
const TO_DATE = "2027-05-16";
const AFTER_TO_DATE = "2027-05-17";

async function applyRange(page: Page, from: string, to: string) {
  await pickBSDate(page, "From (वि.सं.)", from);
  await pickBSDate(page, "To (वि.सं.)", to);
  await page.getByRole("button", { name: "Apply filter" }).click();
}

test.describe("appointment date range filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("filters appointments by an inclusive From → To range", async ({ page }) => {
    const stamp = Date.now();
    const doctorName = `Dr. Range ${stamp}`;
    const patientName = `Range Patient ${stamp}`;
    const onFrom = `RangeFrom${stamp}`;
    const onTo = `RangeTo${stamp}`;
    const afterTo = `RangeAfter${stamp}`;

    await page.goto("/users/new");
    await page.getByLabel("Name").fill(doctorName);
    await page.getByLabel("Email").fill(`range.doctor.${stamp}@example.com`);
    await page.getByLabel("Role").selectOption({ label: "Doctor" });
    await page.getByLabel("Temporary password").fill("Temp-Password-123");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { name: doctorName })).toBeVisible();

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    async function book(date: string, time: string, reason: string) {
      await page.goto("/appointments/new");
      await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
      await page.getByText(patientName, { exact: false }).first().waitFor();
      await page.getByRole("button", { name: new RegExp(patientName) }).click();
      await page.getByLabel("Doctor").selectOption({ label: doctorName });
      await pickBSDate(page, "Date (वि.सं.)", date);
      await page.getByLabel("Time").fill(time);
      await page.getByLabel("Reason / complaint").fill(reason);
      await page.getByRole("button", { name: "Book appointment" }).click();
      await expect(page.getByText(reason, { exact: false }).first()).toBeVisible();
    }

    // first day of the range, last day of the range (late at night), and the
    // day after — the third must never appear.
    await book(FROM_DATE, "09:00", onFrom);
    await book(TO_DATE, "23:30", onTo);
    await book(AFTER_TO_DATE, "10:00", afterTo);

    // a one-week range includes both boundary days, including a 23:30
    // appointment on the To date
    await page.goto("/appointments");
    await applyRange(page, FROM_DATE, TO_DATE);
    await expect(page.getByRole("row", { name: new RegExp(onFrom) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(onTo) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(afterTo) })).toHaveCount(0);

    // extending the range by one day brings the next appointment in
    await page.goto("/appointments");
    await applyRange(page, FROM_DATE, AFTER_TO_DATE);
    await expect(page.getByRole("row", { name: new RegExp(afterTo) })).toBeVisible();

    // From == To shows only that single day
    await page.goto("/appointments");
    await applyRange(page, FROM_DATE, FROM_DATE);
    await expect(page.getByRole("row", { name: new RegExp(onFrom) })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(onTo) })).toHaveCount(0);
  });

  test("rejects an inverted range and reports an empty one", async ({ page }) => {
    await page.goto("/appointments");

    // From after To: the message shows and the list is not re-queried
    await pickBSDate(page, "From (वि.सं.)", AFTER_TO_DATE);
    await pickBSDate(page, "To (वि.सं.)", FROM_DATE);
    await expect(page.getByText("From date cannot be later than to date.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply filter" })).toBeDisabled();

    // a valid range with nothing in it
    await page.goto("/appointments");
    await applyRange(page, "2028-06-01", "2028-06-05");
    await expect(
      page.getByText("No appointments found for the selected date range.")
    ).toBeVisible();

    // Clear returns the list to its default single-day view
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/appointments$/);
  });

  test("quick ranges apply without a page reload", async ({ page }) => {
    await page.goto("/appointments");

    await page.getByRole("button", { name: "This month", exact: true }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("button", { name: "This month", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
