import { test, expect } from "@playwright/test";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("updates the clinic profile", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Address").fill("Birtamode-5, Jhapa, Nepal");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Clinic profile updated.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Address")).toHaveValue("Birtamode-5, Jhapa, Nepal");
  });

  test("adds a payment method and toggles it inactive", async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Wallet ${stamp}`;

    await page.goto("/settings/payment-methods");
    await page.getByPlaceholder("e.g. eSewa").fill(name);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(name)).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "Active" }).click();
    await expect(row.getByRole("button", { name: "Inactive" })).toBeVisible();
  });

  test("Reception role has no audit.view permission by default and can be edited", async ({ page }) => {
    await page.goto("/settings/roles");
    const receptionCard = page.getByTestId("role-card-RECEPTION");
    const auditCheckbox = receptionCard.getByRole("checkbox", { name: "View the audit log" });
    await expect(auditCheckbox).not.toBeChecked();

    await auditCheckbox.check();
    await receptionCard.getByRole("button", { name: "Save permissions" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/settings/roles");
    const receptionCardAfter = page.getByTestId("role-card-RECEPTION");
    await expect(receptionCardAfter.getByRole("checkbox", { name: "View the audit log" })).toBeChecked();

    // revert
    await receptionCardAfter.getByRole("checkbox", { name: "View the audit log" }).uncheck();
    await receptionCardAfter.getByRole("button", { name: "Save permissions" }).click();
  });
});
