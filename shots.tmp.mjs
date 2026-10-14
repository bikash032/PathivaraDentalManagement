import { chromium } from "@playwright/test";
const tag = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: "http://localhost:3000", viewport: { width: 1280, height: 860 } });
await page.goto("/login", { waitUntil: "networkidle", timeout: 90000 });
await page.screenshot({ path: `/tmp/theme-${tag}-login.png` });
await page.getByLabel("Email").fill(process.env.SEED_SUPER_ADMIN_EMAIL);
await page.getByLabel("Password").fill(process.env.SEED_SUPER_ADMIN_PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/dashboard/, { timeout: 90000 });
for (const [name, path] of [["dashboard","/dashboard"],["appointments","/appointments"],["billing","/billing"],["patient-new","/patients/new"]]) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `/tmp/theme-${tag}-${name}.png` });
}
await browser.close();
console.log("saved", tag, "screenshots");
