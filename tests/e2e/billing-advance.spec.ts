import { test, expect, type Page } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

async function createDoctor(page: Page, name: string) {
  await page.goto("/users/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`${name.replace(/\W+/g, "").toLowerCase()}@example.test`);
  await page.getByLabel("Role").selectOption({ label: "Doctor" });
  await page.getByLabel("Temporary password").fill("Test-Password-123");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page).not.toHaveURL(/\/users\/new/);
}

async function collectionRows(page: Page, patientName: string) {
  await page.goto("/reports?type=collection");
  return page.getByRole("row", { name: new RegExp(patientName) });
}

test.describe("billing: advance, allocation, attribution", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("an advance is collected once, applied without new collection, and treatments are attributed per doctor", async ({
    page,
  }) => {
    const stamp = Date.now();
    const doctorA = `Dr Alpha ${stamp}`;
    const doctorB = `Dr Beta ${stamp}`;
    const patientName = `Advance Patient ${stamp}`;
    await createDoctor(page, doctorA);
    await createDoctor(page, doctorB);

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    // 1. Advance of 15,000 before any invoice exists.
    await page.goto("/billing/advance/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Advance amount (NPR)").fill("15000");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page).toHaveURL(/\/billing\/patients\/.+/);
    await expect(page.getByText("Available credit")).toBeVisible();
    await expect(page.getByText("रु. 15,000.00").first()).toBeVisible();

    // Collected today: one row of 15,000.
    let rows = await collectionRows(page, patientName);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole("cell", { name: "Advance", exact: true })).toBeVisible();
    await expect(rows.first().getByText("रु. 15,000.00")).toBeVisible();

    // 2. Invoice with two treatments by two different doctors.
    await page.goto("/billing/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByPlaceholder("Description").first().fill("RCT");
    await page.getByPlaceholder("Price").first().fill("5000");
    await page.getByLabel("Treating doctor").first().selectOption({ label: doctorA });
    await page.getByLabel("Treatment status").first().selectOption("COMPLETED");
    await page.getByRole("button", { name: "+ Add item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("Crown");
    await page.getByPlaceholder("Price").nth(1).fill("10000");
    await page.getByLabel("Treating doctor").nth(1).selectOption({ label: doctorB });
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();
    await expect(page.getByText("UNPAID")).toBeVisible();
    const invoiceUrl = page.url();

    // Attribution: Dr A completed 5,000; Dr B's crown not yet completed.
    const valueTable = page.locator("section", { hasText: "Treatment value by doctor" });
    await expect(valueTable.getByRole("row", { name: new RegExp(doctorA) })).toContainText("रु. 5,000.00");
    await expect(valueTable.getByRole("row", { name: new RegExp(doctorB) })).toContainText("रु. 0.00");
    await expect(valueTable.getByRole("row", { name: new RegExp(doctorB) })).toContainText("रु. 10,000.00");

    // 3. Apply the advance: the invoice is paid, but nothing new is collected.
    await expect(page.getByText("Apply patient credit")).toBeVisible();
    await expect(page.getByLabel("Amount to apply (NPR)")).toHaveValue("15000.00");
    await page.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByText(/from advance\/credit/)).toBeVisible();

    rows = await collectionRows(page, patientName);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByText("रु. 15,000.00")).toBeVisible();

    // 4. The crown is performed later: Dr B is now attributed 10,000.
    await page.goto(invoiceUrl);
    const crownRow = page.getByRole("row", { name: /Crown/ });
    await crownRow.getByText("Edit treatment").click();
    await crownRow.getByLabel("Treatment status").selectOption("COMPLETED");
    await crownRow.getByRole("button", { name: "Save treatment" }).click();
    await expect(crownRow.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(
      page.locator("section", { hasText: "Treatment value by doctor" }).getByRole("row", { name: new RegExp(doctorB) })
    ).toContainText("रु. 10,000.00");

    // 5. Unapplying returns the money to credit; re-applying does not collect again.
    await page.getByRole("button", { name: "Unapply" }).first().click();
    await expect(page.getByText("UNPAID")).toBeVisible();
    await page.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    rows = await collectionRows(page, patientName);
    await expect(rows).toHaveCount(1);
  });

  test("unapplied credit can be refunded, which reduces collection on the refund date", async ({ page }) => {
    const stamp = Date.now();
    const patientName = `Refund Patient ${stamp}`;

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    await page.goto("/billing/advance/new");
    await page.getByPlaceholder("Search by name, phone, or patient ID").fill(patientName);
    await page.getByRole("button", { name: new RegExp(patientName) }).click();
    await page.getByLabel("Advance amount (NPR)").fill("3000");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page).toHaveURL(/\/billing\/patients\/.+/);

    // More than the receipt holds is refused.
    await page.getByLabel("Refund amount (NPR)").fill("3500");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByLabel("Reason").fill("Treatment postponed");
    await page.getByRole("button", { name: "Record refund" }).click();
    await expect(page.getByText(/Only रु\. 3000\.00 of this receipt is unapplied/)).toBeVisible();

    await page.getByLabel("Refund amount (NPR)").fill("1000");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByLabel("Reason").fill("Treatment postponed");
    await page.getByRole("button", { name: "Record refund" }).click();
    await expect(page.getByText("Refund recorded.")).toBeVisible();
    await page.reload();
    await expect(page.locator("div", { hasText: /^Available credit/ }).getByText("रु. 2,000.00")).toBeVisible();

    const rows = await collectionRows(page, patientName);
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole("row", { name: new RegExp(`${patientName}.*Refund`) })).toContainText("-");
  });
});
