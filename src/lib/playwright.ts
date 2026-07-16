import { chromium as playwrightChromium, type Browser } from "playwright-core";

const isServerless =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  try {
    const playwright = (await import("playwright")).default;
    return await playwright.chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Executable doesn't exist")) {
      throw error;
    }

    console.warn("Playwright Chromium not found; falling back to system Chrome.");
    return playwrightChromium.launch({ channel: "chrome", headless: true });
  }
}
