import { test, expect } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("receipts and printing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("prints an invoice receipt and a patient registration slip", async ({ page }) => {
    const stamp = Date.now();
    const patientName = `Print Patient ${stamp}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    const patientUrl = page.url();
    const patientId = patientUrl.split("/patients/")[1];

    await page.goto(`/print/patients/${patientId}`);
    await expect(page.getByText(patientName)).toBeVisible();
    await expect(page.getByText(/PDC-\d{6}/)).toBeVisible();

    await page.goto("/billing/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByPlaceholder("Description").first().fill("X-Ray");
    await page.getByPlaceholder("Price").first().fill("500");
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page).toHaveURL(/\/billing\/.+/);
    await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();
    const invoiceId = page.url().split("/billing/")[1];

    await page.goto(`/print/invoices/${invoiceId}`);
    await expect(page.getByText(patientName)).toBeVisible();
    await expect(page.getByText("X-Ray")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
  });
});
