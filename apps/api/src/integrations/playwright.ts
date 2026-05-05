import { chromium } from "playwright";

export interface ConfirmationResult {
  success: boolean;
  screenshot: Buffer | null;
  error: string | null;
}

export async function confirmViaLink(url: string): Promise<ConfirmationResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Try common confirmation button patterns
    const selectors = [
      'button:has-text("Confirm")',
      'button:has-text("Confirmar")',
      'button:has-text("Accept")',
      'button:has-text("Approve")',
      'input[type="submit"][value*="Confirm" i]',
      'a:has-text("Confirm")',
      '[data-action="confirm"]',
    ];

    let clicked = false;
    for (const selector of selectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.click();
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      throw new Error("Could not locate a confirmation button on the page");
    }

    const screenshot = await page.screenshot({ fullPage: true });
    return { success: true, screenshot, error: null };
  } catch (err) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    return {
      success: false,
      screenshot,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await browser.close();
  }
}
