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

async function pickPatient(page: Page, name: string) {
  await page.getByPlaceholder("Search by name, phone, or patient ID").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
}

const region = (page: Page, name: string) => page.getByRole("region", { name });

test.describe("doctor-wise treatment & financial report", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("keeps treatment value, collection and payable separate across tables, filters, exports and print", async ({
    page,
  }) => {
    const stamp = Date.now();
    const doctorA = `Dr Report A ${stamp}`;
    const doctorB = `Dr Report B ${stamp}`;
    const patientName = `Report Patient ${stamp}`;
    await createDoctor(page, doctorA);
    await createDoctor(page, doctorB);

    await page.goto("/patients/new");
    await page.getByLabel("Full name").fill(patientName);
    await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
    await page.getByRole("button", { name: "Register patient" }).click();
    await expect(page.getByRole("heading", { name: patientName })).toBeVisible();

    // Advance of 15,000 today.
    await page.goto("/billing/advance/new");
    await pickPatient(page, patientName);
    await page.getByLabel("Advance amount (NPR)").fill("15000");
    await page.getByLabel("Method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Record advance" }).click();
    await expect(page).toHaveURL(/\/billing\/patients\/.+/);

    // Invoice 1: RCT by A (completed, tooth 36) and crown by B (planned, tooth 11); paid from the advance.
    await page.goto("/billing/new");
    await pickPatient(page, patientName);
    await page.getByPlaceholder("Description").first().fill("RCT");
    await page.getByPlaceholder("Price").first().fill("5000");
    await page.getByLabel("Treating doctor").first().selectOption({ label: doctorA });
    await page.getByLabel("Treatment status").first().selectOption("COMPLETED");
    await page.getByLabel("Tooth").first().fill("36");
    await page.getByRole("button", { name: "+ Add item" }).click();
    await page.getByPlaceholder("Description").nth(1).fill("Crown");
    await page.getByPlaceholder("Price").nth(1).fill("10000");
    await page.getByLabel("Treating doctor").nth(1).selectOption({ label: doctorB });
    await page.getByLabel("Tooth").nth(1).fill("11");
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();
    await page.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();

    // Invoice 2: an item with no doctor recorded, unpaid.
    await page.goto("/billing/new");
    await pickPatient(page, patientName);
    await page.getByPlaceholder("Description").first().fill("Scaling");
    await page.getByPlaceholder("Price").first().fill("500");
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.getByRole("link", { name: "Print receipt" })).toBeVisible();

    const base = `/reports/doctor-financial?patient=${encodeURIComponent(patientName)}`;
    await page.goto(base);

    // Doctor totals: value by treating doctor; unknown doctor flagged, not guessed.
    const doctors = region(page, "Doctor-wise totals");
    await expect(doctors.getByRole("row", { name: new RegExp(doctorA) })).toContainText("रु. 5,000.00");
    await expect(doctors.getByRole("row", { name: new RegExp(doctorB) })).toContainText("रु. 10,000.00");
    await expect(doctors.getByRole("row", { name: /NOT RECORDED/ })).toContainText("रु. 500.00");
    await expect(doctors.getByRole("row", { name: new RegExp(doctorA) })).toContainText("Not configured");
    await expect(page.getByText(/no treating doctor recorded/)).toBeVisible();

    // Treatments: one row per item, with tooth, doctor, status and per-item money.
    const treatments = region(page, "Treatments (date-wise)");
    await expect(treatments.locator("tbody tr")).toHaveCount(3);
    const rct = treatments.getByRole("row", { name: /RCT/ });
    await expect(rct).toContainText("36");
    await expect(rct).toContainText(doctorA);
    await expect(rct).toContainText("Completed");
    await expect(rct).toContainText("Paid");
    await expect(treatments.locator("tfoot")).toContainText("रु. 15,500.00"); // value
    await expect(treatments.locator("tfoot")).toContainText("रु. 15,000.00"); // allocated
    await expect(treatments.locator("tfoot")).toContainText("रु. 500.00"); // outstanding

    // Cash: the advance once, on its date; applying it added nothing.
    const payments = region(page, "Payment transactions");
    await expect(payments.locator("tbody tr")).toHaveCount(1);
    await expect(payments.locator("tbody tr").first()).toContainText("Advance");
    await expect(payments.locator("tbody tr").first()).toContainText("रु. 15,000.00");
    const daily = region(page, "Daily collection");
    await expect(daily.locator("tbody tr")).toHaveCount(1);
    await expect(daily.locator("tfoot")).toContainText("रु. 15,000.00");

    // Doctor filter narrows treatments only; cash is not attributed to doctors.
    await page.getByLabel("Doctor", { exact: true }).selectOption({ label: doctorA });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toHaveCount(1);
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toContainText("RCT");
    await expect(region(page, "Payment transactions").locator("tbody tr")).toHaveCount(1);

    // "Doctor not recorded" filter shows only the flagged item.
    await page.getByLabel("Doctor", { exact: true }).selectOption({ label: "Doctor not recorded" });
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toHaveCount(1);
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toContainText("Scaling");

    // Status and payment-status filters.
    await page.goto(`${base}&status=PLANNED`);
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toHaveCount(2);
    await page.goto(`${base}&paymentStatus=UNPAID`);
    await expect(region(page, "Treatments (date-wise)").locator("tbody tr")).toHaveCount(1);

    // CSV exports carry the same rows and totals.
    const csv = async (section: string, extra = "") => {
      const res = await page.request.get(
        `/reports/doctor-financial/export?section=${section}&patient=${encodeURIComponent(patientName)}${extra}`
      );
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/csv");
      return res.text();
    };
    const doctorsCsv = await csv("doctors");
    expect(doctorsCsv).toContain(`${doctorA},1,5000.00,0.00,5000.00,5000.00,0.00,Not configured`);
    expect(doctorsCsv).toContain("NOT RECORDED,1,0.00,500.00,500.00,0.00,500.00,Not configured");
    expect(doctorsCsv).toContain("TOTAL,3,5000.00,10500.00,15500.00,15000.00,500.00,Not configured");
    const treatmentsCsv = await csv("treatments");
    expect(treatmentsCsv.trim().split("\r\n")).toHaveLength(1 + 3 + 1); // header, rows, total
    const dailyCsv = await csv("daily");
    expect(dailyCsv).toContain("Cash,15000.00,0.00,15000.00");
    expect(dailyCsv).toContain("TOTAL,,,15000.00,0.00,15000.00");
    const filteredCsv = await csv("treatments", "&status=COMPLETED");
    expect(filteredCsv.trim().split("\r\n")).toHaveLength(1 + 1 + 1);
    expect((await page.request.get("/reports/doctor-financial/export?section=bogus")).status()).toBe(400);

    // Print view: same totals.
    await page.goto(`/print/reports/doctor-financial?patient=${encodeURIComponent(patientName)}`);
    await expect(page.getByRole("heading", { name: "Doctor-wise Treatment & Financial Report" })).toBeVisible();
    await expect(page.getByText("Total रु. 15,500.00")).toBeVisible();
    await expect(page.getByText("Net रु. 15,000.00")).toBeVisible();
    await expect(page.getByText(/Not configured — no commission rules exist/)).toBeVisible();
  });

  test("is not available without the report permission", async ({ page }) => {
    // Reception has no report.view by default.
    const stamp = Date.now();
    const email = `reception${stamp}@example.test`;
    await page.goto("/users/new");
    await page.getByLabel("Name").fill(`Reception ${stamp}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Role").selectOption({ label: "Reception" });
    await page.getByLabel("Temporary password").fill("Test-Password-123");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page).not.toHaveURL(/\/users\/new/);
    await page.getByRole("button", { name: "Sign out" }).click();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Test-Password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/reports/doctor-financial");
    await expect(page.getByRole("heading", { name: /Doctor-wise treatment/ })).toHaveCount(0);
    const res = await page.request.get("/reports/doctor-financial/export?section=daily", { maxRedirects: 0 });
    expect(res.headers()["content-type"] ?? "").not.toContain("text/csv");
  });
});
