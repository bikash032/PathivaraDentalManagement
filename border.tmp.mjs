import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: "http://localhost:3000" });
await page.goto("/login", { waitUntil: "networkidle", timeout: 90000 });
await page.evaluate(() => document.activeElement && document.activeElement.blur());
const b = (label) => page.getByLabel(label).evaluate((el) => ({
  focused: document.activeElement === el, border: getComputedStyle(el).borderTopColor }));
for (const l of ["Email", "Password"]) {
  const r = await b(l);
  console.log(`${l.padEnd(9)} focused=${r.focused}  border=${r.border}  ${r.border === "rgb(203, 213, 225)" ? "PASS (#CBD5E1)" : "FAIL"}`);
}
await browser.close();
