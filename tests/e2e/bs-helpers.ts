import { expect, type Page } from "@playwright/test";
import bikramSambat from "bikram-sambat";

/** Month names as the UI renders them — a mismatch here should fail the test. */
const BS_MONTHS = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कात्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
];

const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toNepaliNumerals(value: string | number): string {
  return String(value).replace(/\d/g, (d) => NEPALI_DIGITS[Number(d)]);
}

function fromNepaliNumerals(value: string): number {
  return Number(value.replace(/[०-९]/g, (d) => String(NEPALI_DIGITS.indexOf(d))));
}

/**
 * Drives the BS date picker to select the BS date equivalent to `adDate`
 * ("YYYY-MM-DD"), navigating months as a real user would.
 */
export async function pickBSDate(page: Page, triggerLabel: string | RegExp, adDate: string) {
  const target = bikramSambat.toBik(adDate);

  await page.getByLabel(triggerLabel).click();
  const dialog = page.getByRole("dialog", { name: "Bikram Sambat date picker" });
  await expect(dialog).toBeVisible();

  const header = dialog.locator("div.text-sm.font-semibold").first();

  for (let guard = 0; guard < 240; guard++) {
    const text = (await header.innerText()).trim();
    const [monthName, yearText] = text.split(" ");
    const viewMonth = BS_MONTHS.indexOf(monthName) + 1;
    const viewYear = fromNepaliNumerals(yearText);

    if (viewMonth < 1) throw new Error(`Unrecognised BS month in picker header: "${text}"`);
    if (viewYear === target.year && viewMonth === target.month) break;

    const viewIndex = viewYear * 12 + viewMonth;
    const targetIndex = target.year * 12 + target.month;
    const forward = targetIndex > viewIndex;
    const jumpYear = Math.abs(targetIndex - viewIndex) >= 12;

    const label = jumpYear
      ? forward
        ? "अर्को वर्ष"
        : "अघिल्लो वर्ष"
      : forward
        ? "अर्को महिना"
        : "अघिल्लो महिना";

    await dialog.getByRole("button", { name: label }).click();
  }

  await dialog
    .getByRole("button", { name: `${target.day} ${BS_MONTHS[target.month - 1]} ${target.year}`, exact: true })
    .click();

  await expect(dialog).toBeHidden();
}

/** The BS rendering the UI should show for an AD date, e.g. "३० भदौ २०८३". */
export function expectedBSText(adDate: string): string {
  const bs = bikramSambat.toBik(adDate);
  return `${toNepaliNumerals(bs.day)} ${BS_MONTHS[bs.month - 1]} ${toNepaliNumerals(bs.year)}`;
}
