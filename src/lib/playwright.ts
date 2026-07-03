import playwright from "playwright";

type Browser = Awaited<ReturnType<typeof playwright.chromium.launch>>;

export async function launchBrowser(): Promise<Browser> {
  try {
    return await playwright.chromium.launch();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Executable doesn't exist")) {
      throw error;
    }

    console.warn("Playwright Chromium not found; falling back to system Chrome.");
    return playwright.chromium.launch({ channel: "chrome", headless: true });
  }
}
