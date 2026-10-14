import { test, expect, type Page } from "@playwright/test";
import { uniquePhone } from "./fixtures";

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL!;
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD!;

const takenMessage = (name: string) => `Phone number is already used by ${name}.`;

async function registerPatient(page: Page, name: string, phone: string) {
  await page.goto("/patients/new");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Phone", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

test.describe("patient phone uniqueness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("blocks a duplicate on create and accepts a free number", async ({ page }) => {
    const stamp = Date.now();
    const ownerName = `Phone Owner ${stamp}`;
    const takenPhone = uniquePhone();

    await registerPatient(page, ownerName, takenPhone);

    // Test 1 — the taken number is reported and cannot be saved
    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(`Duplicate Attempt ${stamp}`);
    await page.getByLabel("Phone", { exact: true }).fill(takenPhone);

    await expect(page.getByText(takenMessage(ownerName))).toBeVisible();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Register patient" })).toBeDisabled();

    // Test 2 — a free number clears the error and saves
    const freePhone = uniquePhone();
    await page.getByLabel("Phone", { exact: true }).fill(freePhone);
    await expect(page.getByText(takenMessage(ownerName))).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Register patient" })).toBeEnabled();

    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: `Duplicate Attempt ${stamp}` })).toBeVisible();
  });

  test("detects a duplicate typed in another format", async ({ page }) => {
    const stamp = Date.now();
    const ownerName = `Format Owner ${stamp}`;
    const takenPhone = uniquePhone();

    await registerPatient(page, ownerName, takenPhone);

    // +977 prefix and a trunk zero are the same number, so both must collide
    for (const spelling of [`+977${takenPhone}`, `0${takenPhone}`]) {
      await page.goto("/patients/new");
      await page.getByLabel("Full name").fill(`Format Attempt ${stamp}`);
      await page.getByLabel("Phone", { exact: true }).fill(spelling);
      await expect(page.getByText(takenMessage(ownerName))).toBeVisible();
      await expect(page.getByRole("button", { name: "Register patient" })).toBeDisabled();
    }
  });

  test("lets a patient keep their own number but not take another's", async ({ page }) => {
    const stamp = Date.now();
    const firstName = `Edit First ${stamp}`;
    const secondName = `Edit Second ${stamp}`;
    const firstPhone = uniquePhone();

    const firstUrl = await registerPatient(page, firstName, firstPhone);
    const secondUrl = await registerPatient(page, secondName, uniquePhone());

    // Test 3 — unchanged own number saves fine
    await page.goto(`${firstUrl}/edit`);
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(firstPhone);
    await expect(page.getByText(takenMessage(firstName))).toHaveCount(0);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: firstName })).toBeVisible();

    // Test 4 — taking another patient's number is rejected
    await page.goto(`${secondUrl}/edit`);
    await page.getByLabel("Phone", { exact: true }).fill(firstPhone);
    await expect(page.getByText(takenMessage(firstName))).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("the server rejects a duplicate even when the live check is bypassed", async ({ page }) => {
    const stamp = Date.now();
    const ownerName = `Server Owner ${stamp}`;
    const takenPhone = uniquePhone();

    await registerPatient(page, ownerName, takenPhone);

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(`Server Attempt ${stamp}`);

    // Set the field and submit in the same tick, so the 300ms debounce never
    // fires and the client-side check cannot be what blocks this.
    await page.evaluate((phone) => {
      const input = document.querySelector<HTMLInputElement>("#phone")!;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setValue.call(input, phone);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.form!.requestSubmit();
    }, takenPhone);

    await expect(page.getByText(takenMessage(ownerName))).toBeVisible();
    await expect(page).toHaveURL(/\/patients\/new$/);
  });
});
