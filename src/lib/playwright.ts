import { chromium as playwrightChromium, type Browser } from "playwright-core";

const isServerless =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Hosted Chromium pack for Vercel (downloaded to /tmp at runtime).
// Must match the installed @sparticuz/chromium-min version.
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ||
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

export async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
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
