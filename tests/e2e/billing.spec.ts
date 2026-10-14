import { test, expect } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("treatments and billing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("creates a treatment and rejects a duplicate code", async ({ page }) => {
    const stamp = Date.now();
    const code = `E2E${stamp}`;
    const name = `E2E Test Treatment ${stamp}`;

    await page.goto("/treatments/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Default price (NPR)").fill("1234.50");
    await page.getByRole("button", { name: "Create treatment" }).click();
    await expect(page).toHaveURL(/\/treatments$/);
    await expect(page.getByText(name)).toBeVisible();

    await page.goto("/treatments/new");
    await page.getByLabel("Name").fill("Duplicate code attempt");
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Default price (NPR)").fill("100");
    await page.getByRole("button", { name: "Create treatment" }).click();
    await expect(page.getByText("A treatment with this code already exists.")).toBeVisible();
  });

  test("creates an invoice, records a partial payment, then pays in full — status transitions correctly", async ({
    page,
  }) => {
    const stamp = Date.now();
    const patientName = `Billing Patient ${stamp}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    await page.goto("/billing/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByPlaceholder("Description").first().fill("Consultation");
    await page.getByPlaceholder("Price").first().fill("1000");
    await page.getByRole("button", { name: "Create invoice" }).click();

    await expect(page).toHaveURL(/\/billing\/.+/);
    await expect(page.getByText("रु. 1,000.00").first()).toBeVisible();
    await expect(page.getByText("UNPAID")).toBeVisible();

    // partial payment
    await page.getByLabel("Amount (NPR)").fill("400");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("PARTIALLY PAID")).toBeVisible();

    // overpayment should be rejected
    await page.getByLabel("Amount (NPR)").fill("1000");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText(/exceeds the remaining balance/)).toBeVisible();

    // pay the remaining balance exactly
    await page.getByLabel("Amount (NPR)").fill("600");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();

    // fully paid invoice no longer shows a payment form
    await expect(page.getByLabel("Amount (NPR)")).toHaveCount(0);
  });
});
