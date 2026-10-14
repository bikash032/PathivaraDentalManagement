import { test, expect } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("patient management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("rejects an invalid phone number", async ({ page }) => {
    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill("Test Patient Invalid Phone");
    await page.getByLabel("Phone", { exact: true }).fill("12345");
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByText(/valid 10-digit Nepali mobile number/)).toBeVisible();
  });

  test("registers a patient, views, edits, and archives them", async ({ page }) => {
    const uniqueName = `E2E Patient ${Date.now()}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(uniqueName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByLabel("Gender").selectOption("FEMALE");
    await page.getByRole("button", { name: "Register patient" }).click();

    // redirected to the detail page
    await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible();
    await expect(page.getByText(/PDC-\d{6}/)).toBeVisible();

    // shows up in the list
    await page.goto("/patients");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(uniqueName);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: uniqueName })).toBeVisible();

    // edit
    await page.getByRole("link", { name: uniqueName }).click();
    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Address").fill("Birtamode, Jhapa");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Birtamode, Jhapa")).toBeVisible();

    // archive
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("ARCHIVED")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
  });
});
