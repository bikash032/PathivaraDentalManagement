import { test, expect } from "@playwright/test";
import { pickBSDate } from "./bs-helpers";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("appointment management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("books an appointment and prevents a double-booking", async ({ page }) => {
    const stamp = Date.now();
    const doctorName = `Dr. E2E ${stamp}`;
    const patientName = `Appt Patient ${stamp}`;

    // create a doctor
    await page.goto("/users/new");
    await page.getByLabel("Name").fill(doctorName);
    await page.getByLabel("Email").fill(`doctor.${stamp}@example.com`);
    await page.getByLabel("Role").selectOption({ label: "Doctor" });
    await page.getByLabel("Temporary password").fill("Temp-Password-123");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { name: doctorName })).toBeVisible();

    // create a patient
    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill("9801234567");
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    // book an appointment
    await page.goto("/appointments/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByText(patientName, { exact: false }).first().waitFor();
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Doctor").selectOption({ label: doctorName });
    await pickBSDate(page, "Date (वि.सं.)", "2027-01-15");
    await page.getByLabel("Time").fill("10:00");
    await page.getByRole("button", { name: "Book appointment" }).click();

    await expect(page.getByText(doctorName, { exact: false })).toBeVisible();

    // attempt an overlapping booking for the same doctor
    await page.goto("/appointments/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByText(patientName, { exact: false }).first().waitFor();
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Doctor").selectOption({ label: doctorName });
    await pickBSDate(page, "Date (वि.सं.)", "2027-01-15");
    await page.getByLabel("Time").fill("10:15");
    await page.getByRole("button", { name: "Book appointment" }).click();
    await expect(page.getByText(/already has an appointment that overlaps/)).toBeVisible();

    // day view shows the appointment and status change works
    await page.goto("/appointments?date=2027-01-15");
    const row = page.getByRole("row", { name: new RegExp(patientName) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("Confirmed")).toBeVisible();
  });
});
