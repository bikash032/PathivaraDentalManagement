import { test, expect } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("reports and audit log", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a recorded payment appears in the collection report for today", async ({ page }) => {
    const stamp = Date.now();
    const patientName = `Report Patient ${stamp}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    await page.goto("/billing/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByPlaceholder("Description").first().fill("Consultation");
    await page.getByPlaceholder("Price").first().fill("750");
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page).toHaveURL(/\/billing\/.+/);

    await page.getByLabel("Amount (NPR)").fill("750");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();

    // collection report should include this payment
    await page.goto("/reports?type=collection");
    const row = page.getByRole("row", { name: new RegExp(patientName) });
    await expect(row).toBeVisible();
    await expect(row.getByText("रु. 750.00")).toBeVisible();

    // the new patient shows in the registration report
    await page.goto("/reports?type=patients");
    await expect(page.getByRole("row", { name: new RegExp(patientName) })).toBeVisible();
  });

  test("outstanding report lists an unpaid invoice", async ({ page }) => {
    const stamp = Date.now();
    const patientName = `Outstanding Patient ${stamp}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();

    await page.goto("/billing/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByPlaceholder("Description").first().fill("Root Canal Treatment");
    await page.getByPlaceholder("Price").first().fill("8000");
    await page.getByRole("button", { name: "Create invoice" }).click();
    // wait for the redirect to the created invoice to land — "/billing/.+" alone
    // would also match "/billing/new" and let us navigate away mid-redirect
    await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();

    await page.goto("/reports?type=outstanding");
    const row = page.getByRole("row", { name: new RegExp(patientName) });
    await expect(row).toBeVisible();
    await expect(row.getByText("रु. 8,000.00").first()).toBeVisible();
  });

  test("audit log records patient creation and payment actions", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();

    await page.getByPlaceholder("Filter by action (e.g. payment)").fill("patient.create");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("patient.create").first()).toBeVisible();

    await page.goto("/audit");
    await page.getByPlaceholder("Filter by action (e.g. payment)").fill("auth.login");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("auth.login").first()).toBeVisible();
  });
});
