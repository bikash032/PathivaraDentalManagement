import { test, expect } from "@playwright/test";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("visits and clinical records", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("starts a visit from an appointment, records a prescription, and completes the appointment", async ({
    page,
  }) => {
    const stamp = Date.now();
    const doctorName = `Dr. Visit ${stamp}`;
    const patientName = `Visit Patient ${stamp}`;

    await page.goto("/users/new");
    await page.getByLabel("Name").fill(doctorName);
    await page.getByLabel("Email").fill(`visit-doctor.${stamp}@example.com`);
    await page.getByLabel("Role").selectOption({ label: "Doctor" });
    await page.getByLabel("Temporary password").fill("Temp-Password-123");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { name: doctorName })).toBeVisible();

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill("9811112222");
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    await page.goto("/appointments/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Doctor").selectOption({ label: doctorName });
    await page.getByLabel("Date").fill("2027-02-10");
    await page.getByLabel("Time").fill("11:00");
    await page.getByRole("button", { name: "Book appointment" }).click();
    await expect(page.getByText(doctorName)).toBeVisible();

    await page.getByRole("link", { name: "Start visit" }).click();
    await expect(page).toHaveURL(/\/visits\/new/);

    await page.getByLabel("Chief complaint").fill("Toothache, lower right molar");
    await page.getByLabel("Diagnosis").fill("Dental caries");
    await page.getByPlaceholder("Medicine").fill("Amoxicillin");
    await page.getByPlaceholder("Dosage").fill("500mg");
    await page.getByPlaceholder("Frequency").fill("3x daily");
    await page.getByRole("button", { name: "Save visit" }).click();

    await expect(page.getByText("Toothache, lower right molar")).toBeVisible();
    await expect(page.getByText("Amoxicillin")).toBeVisible();

    // appointment should now be marked completed
    await page.goto("/appointments?date=2027-02-10");
    const row = page.getByRole("row", { name: new RegExp(patientName) });
    await expect(row.getByText("Completed")).toBeVisible();
  });
});
