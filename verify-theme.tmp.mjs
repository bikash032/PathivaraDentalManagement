import { chromium } from "@playwright/test";

const hex = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16));
const rgbStr = (h) => `rgb(${hex(h).join(", ")})`;
const lum = ([r, g, b]) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
  .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const x = lum(hex(a)), y = lum(hex(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

console.log("=== contrast of every token pairing (AA = 4.5:1) ===");
const pairs = [
  ["white on primary (buttons)", "#FFFFFF", "#0F766E"],
  ["white on primary-hover", "#FFFFFF", "#115E59"],
  ["white on secondary (selected date)", "#FFFFFF", "#2563EB"],
  ["primary link on white", "#0F766E", "#FFFFFF"],
  ["primary on primary-soft (active nav)", "#0F766E", "#F0FDFA"],
  ["ink on page", "#0F172A", "#F8FAFC"],
  ["ink-secondary on white", "#475569", "#FFFFFF"],
  ["ink-muted on white", "#64748B", "#FFFFFF"],
  ["ink-muted on page", "#64748B", "#F8FAFC"],
  ["input text on input bg", "#111827", "#FFFFFF"],
  ["danger text on white", "#DC2626", "#FFFFFF"],
  ["success-ink on success-soft", "#15803D", "#F0FDF4"],
  ["warning-ink on warning-soft", "#B45309", "#FFFBEB"],
  ["danger-ink on danger-soft", "#B91C1C", "#FEF2F2"],
  ["info-ink on info-soft", "#1D4ED8", "#EFF6FF"],
  ["(raw) warning #F59E0B on white — why -ink exists", "#F59E0B", "#FFFFFF"],
];
let fails = 0;
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg); const ok = r >= 4.5;
  if (!ok && !name.startsWith("(raw)")) fails++;
  console.log(`  ${ok ? "PASS" : name.startsWith("(raw)") ? "info" : "FAIL"}  ${r.toFixed(2)}:1  ${name}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: "http://localhost:3000", viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const style = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
const expect = (label, got, want) => {
  const ok = got === want; if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${got}${ok ? "" : `  (want ${want})`}`);
};

console.log("\n=== rendered colors (proves the tokens compiled) ===");
await page.goto("/login", { waitUntil: "networkidle", timeout: 90000 });
expect("login button background", await style(page.getByRole("button", { name: "Sign in" }), "backgroundColor"), rgbStr("#0F766E"));
expect("login heading", await style(page.getByRole("heading"), "color"), rgbStr("#0F766E"));
expect("page background", await style(page.locator("main"), "backgroundColor"), rgbStr("#F8FAFC"));
const email = page.getByLabel("Email");
await email.fill(process.env.SEED_SUPER_ADMIN_EMAIL);
expect("typed input text", await style(email, "color"), rgbStr("#111827"));
expect("input background", await style(email, "backgroundColor"), rgbStr("#FFFFFF"));
expect("input border", await style(email, "borderTopColor"), rgbStr("#CBD5E1"));
await email.focus();
expect("input border on focus", await style(email, "borderTopColor"), rgbStr("#0F766E"));

await page.getByLabel("Password").fill(process.env.SEED_SUPER_ADMIN_PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/dashboard/, { timeout: 90000 });
await page.waitForLoadState("networkidle");

const active = page.locator('aside a[aria-current="page"]');
expect("active nav item", (await active.innerText()).trim(), "Dashboard");
expect("active nav text", await style(active, "color"), rgbStr("#0F766E"));
expect("active nav background", await style(active, "backgroundColor"), rgbStr("#F0FDFA"));
const inactive = page.locator("aside a", { hasText: "Patients" });
expect("inactive nav text", await style(inactive, "color"), rgbStr("#475569"));

await page.goto("/appointments", { waitUntil: "networkidle" });
const activeAppt = page.locator('aside a[aria-current="page"]');
expect("active nav follows page", (await activeAppt.innerText()).trim(), "Appointments");
const filter = page.getByRole("button", { name: "Filter" });
expect("secondary button border at rest", await style(filter, "borderTopColor"), rgbStr("#CBD5E1"));
await filter.hover();
await page.waitForTimeout(200);
expect("secondary button text on hover", await style(filter, "color"), rgbStr("#2563EB"));

console.log(`\nconsole/hydration errors: ${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log("  ! " + e.slice(0, 160)));
console.log(`\nRESULT: ${fails === 0 && errors.length === 0 ? "ALL CHECKS PASS" : `${fails} check failures, ${errors.length} errors`}`);
await browser.close();
