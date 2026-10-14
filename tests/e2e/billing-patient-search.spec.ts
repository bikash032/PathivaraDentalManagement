import { test, expect, type Page } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

const searchBox = (page: Page) => page.getByLabel("Search patient by name");
const dropdown = (page: Page) => page.locator("ul.absolute");

async function typeSearch(page: Page, text: string) {
  await searchBox(page).fill(text);
}

test.describe("billing patient-name search", () => {
  // A token unique to this run, so "starts with" vs "contains" can be asserted
  // exactly without older test patients interfering.
  const token = `Qtest${Date.now()}`;
  const startsA = `${token} Kumar`;
  const startsB = `${token} Bahadur`;
  const containsA = `Hari ${token}`;
  const containsB = `Sita ${token}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("matches on starting letters only, case-insensitively, and filters billing", async ({
    page,
  }) => {
    async function registerPatient(name: string, phone: string) {
      await page.goto("/patients/new");
      await page.getByLabel("Full name").fill(name);
      await page.getByLabel("Phone", { exact: true }).fill(phone);
      await page.getByRole("button", { name: "Register patient" }).click();
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }

    const phoneA = uniquePhone();
    await registerPatient(startsA, phoneA);
    await registerPatient(startsB, uniquePhone());
    await registerPatient(containsA, uniquePhone());
    await registerPatient(containsB, uniquePhone());

    async function invoiceFor(name: string, amount: string) {
      await page.goto("/billing/new");
      await page.getByPlaceholder("Search by name, phone, or patient ID").fill(name);
      await page.getByRole("button", { name: new RegExp(name) }).click();
      await page.getByPlaceholder("Description").first().fill("Consultation");
      await page.getByPlaceholder("Price").first().fill(amount);
      await page.getByRole("button", { name: "Create invoice" }).click();
      await expect(page).toHaveURL(/\/billing\/.+/);
    }

    await invoiceFor(startsA, "1000");
    await invoiceFor(startsB, "2000");

    await page.goto("/billing");

    // empty box shows no dropdown at all
    await expect(dropdown(page)).toHaveCount(0);

    // a single starting letter already searches
    await typeSearch(page, token.slice(0, 1));
    await expect(dropdown(page)).toBeVisible();

    // full token: only the names that START with it
    await typeSearch(page, token);
    await expect(page.getByRole("button", { name: new RegExp(startsA) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(startsB) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(containsA) })).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(containsB) })).toHaveCount(0);

    // ...and the same for upper and lower case
    for (const variant of [token.toUpperCase(), token.toLowerCase()]) {
      await typeSearch(page, variant);
      await expect(page.getByRole("button", { name: new RegExp(startsA) })).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(containsA) })).toHaveCount(0);
    }

    // the dropdown shows the patient code and phone alongside the name
    await typeSearch(page, token);
    await expect(page.getByRole("button", { name: new RegExp(`${startsA}.*PDC-.*${phoneA}`) })).toBeVisible();

    // selecting narrows the invoice list to that patient
    await page.getByRole("button", { name: new RegExp(startsA) }).click();
    await expect(page).toHaveURL(/patientId=/);
    await expect(page.getByText(startsA, { exact: false }).first()).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("cell", { name: startsA })).toBeVisible();
    await expect(page.getByRole("cell", { name: startsB })).toHaveCount(0);

    // the existing status filter still works, and keeps the selected patient
    await page.getByRole("combobox").selectOption("PAID");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/patientId=/);
    await expect(page.getByText("No invoices found.")).toBeVisible();
    await expect(page.getByText(startsA, { exact: false }).first()).toBeVisible();

    // clearing the patient restores the unfiltered list
    await page.getByRole("link", { name: "Clear patient" }).click();
    await expect(page).not.toHaveURL(/patientId=/);
  });

  test("reports when nothing matches and hides the dropdown when emptied", async ({ page }) => {
    await page.goto("/billing");

    await typeSearch(page, "zzzznosuchpatientzzzz");
    await expect(page.getByText("No patients found")).toBeVisible();

    await typeSearch(page, "");
    await expect(dropdown(page)).toHaveCount(0);
    await expect(page.getByText("No patients found")).toHaveCount(0);
  });
});
