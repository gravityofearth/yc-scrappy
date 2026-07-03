import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import playwright from "playwright";
import { connectDB } from "@/lib/mongodb";
import { launchBrowser } from "@/lib/playwright";
import { lastSeenToDaysAgo } from "@/lib/lastSeenUtils";
import { normalizeEducationAndEmployment } from "@/lib/profileUtils";
import { Profile } from "@/models/Profile";

type SendProgress = (obj: { type: string; scrapedCount?: number; message?: string; error?: string }) => void;

async function runScrapeWithProgress(
  opts: { body: Record<string, unknown>; url: string; ssoKey: string; susSession: string },
  send: SendProgress
): Promise<void> {
  const { body, url, ssoKey, susSession } = opts;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  try {
    await connectDB();
    browser = await launchBrowser();
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    const applyPageRoutes = async (p: playwright.Page) => {
      await p.route("**/*.{png,jpg,jpeg,gif,css}", (route) => route.abort());
      await p.route("**/*.{woff,woff2,ttf,otf}", (route) => route.abort());
      await p.route("**/{analytics,tracking,advertisement}/**", (route) =>
        route.abort()
      );
    };

    let page = await context.newPage();
    await applyPageRoutes(page);

    // Set cookies before navigation
    await context.addCookies([
      {
        name: "_sso.key",
        value: ssoKey,
        domain: ".startupschool.org",
        path: "/",
      },
      {
        name: "_sus_session",
        value: susSession,
        domain: ".startupschool.org",
        path: "/",
      },
    ]);

    const PAGE_REFRESH_INTERVAL = 30;
    let iteration = 0;
    let scrapedCount = 0;

    while (1) {
      try {
      if (iteration > 0 && iteration % PAGE_REFRESH_INTERVAL === 0) {
        await page.close().catch(() => {});
        page = await context.newPage();
        await applyPageRoutes(page);
      }
      iteration++;

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 300000,
      });

      const selectorTimeout = 20000;
      try {
        await page.waitForSelector(".css-139x40p", { timeout: selectorTimeout });
      } catch (waitErr) {
        const msg = waitErr instanceof Error ? waitErr.message : String(waitErr);
        if (msg.includes("Timeout") || msg.includes("waitForSelector")) {
          console.log("Profile content not found (timeout or end of list), finishing scrape. Profiles saved:", scrapedCount);
          break;
        }
        throw waitErr;
      }

      const content = await page.content();
      const $ = cheerio.load(content);

      const mainContent = $(".css-139x40p");
      // console.log("mainContent: ", mainContent);

      const age = mainContent.find('[title="Age"]').text().replace(/\D/g, "");

      let profile: Record<string, unknown>;
      try {
      profile = {
        userId: page.url().split("/").pop(),
        name: (() => {
          const a = mainContent.find(".css-y9z691").text().trim();
          if (a) return a;
          const b = mainContent.find(".css-1s8r69b").text().trim();
          if (b) return b;
          return mainContent.find("h1").first().text().trim();
        })(),
        location: mainContent.find('[title="Location"]').text().trim(),
        age: age ? parseInt(age) : null,
        lastSeen: mainContent
          .find('[title="Last seen on co-founder matching"]')
          .text()
          .replace("Last seen ", "")
          .trim(),
        lastSeenDays: (() => {
          const raw = mainContent
            .find('[title="Last seen on co-founder matching"]')
            .text()
            .replace("Last seen ", "")
            .trim();
          return lastSeenToDaysAgo(raw);
        })(),
        avatar: mainContent.find(".css-1bm26bw").attr("src")?.replace(/^\/\//, 'https://'),
        statusLine: mainContent.find(".css-cyoc3t").map((_, el) => $(el).text().trim()).get().filter(Boolean).join("\n"),
        sumary: mainContent.find(".css-cyoc3t").map((_, el) => $(el).text().trim()).get().filter(Boolean).join("\n"),
        lookingFor: (() => {
          const what = mainContent.find('span.css-19yrmx8:contains("What I\'m looking for in a co-founder")').next(".css-1tp1ukf").text().trim();
          const ideal = mainContent.find('span.css-19yrmx8:contains("Ideal co-founder")').next(".css-1tp1ukf").text().trim();
          return [what, ideal].filter(Boolean).join("\n\n");
        })(),
        intro: (() => {
          const label = mainContent.find('span.css-19yrmx8:contains("Intro")');
          const block = label.length ? (label.next(".css-1tp1ukf").length ? label.next(".css-1tp1ukf") : label.next()) : $();
          return block.text().trim();
        })(),
        lifeStory: mainContent
          .find('span.css-19yrmx8:contains("Life Story")')
          .next(".css-1tp1ukf")
          .text()
          .trim(),
        freeTime: mainContent
          .find('span.css-19yrmx8:contains("Free Time")')
          .next(".css-1tp1ukf")
          .text()
          .trim(),
        other: mainContent
          .find('span.css-19yrmx8:contains("Other")')
          .next(".css-1tp1ukf")
          .text()
          .trim(),

        accomplishments: mainContent
          .find('span.css-19yrmx8:contains("Impressive accomplishment")')
          .next(".css-1tp1ukf")
          .text()
          .trim(),

        education: (() => {
          const label = mainContent.find('span.css-19yrmx8:contains("Education")');
          const section = label.length ? label.next() : $();
          let items = section.find(".css-kaq1dv").map((_, el) => $(el).text().trim()).get();
          if (items.length === 0) items = section.children("div").map((_, el) => $(el).text().trim()).get().filter(Boolean);
          if (items.length === 0) items = section.text().split(/\n/).map((s) => s.trim()).filter(Boolean);
          return items;
        })(),

        employment: (() => {
          const label = mainContent.find('span.css-19yrmx8:contains("Employment")');
          const section = label.length ? label.next() : $();
          let items = section.find(".css-kaq1dv").map((_, el) => $(el).text().trim()).get();
          if (items.length === 0) items = section.children("div").map((_, el) => $(el).text().trim()).get().filter(Boolean);
          if (items.length === 0) items = section.text().split(/\n/).map((s) => s.trim()).filter(Boolean);
          return items;
        })(),

        startup: (() => {
          const startupNameEl = mainContent.find(".css-bcaew0 b").first();
          const name = startupNameEl.text().trim() || "Potential Idea";
          const descFromNext = mainContent.find(".css-bcaew0").first().next(".css-1tp1ukf").text().trim();
          const description = descFromNext || mainContent.find("div.css-1hla380").text().trim();
          return {
            name,
            description,
            progress: mainContent
              .find('span.css-19yrmx8:contains("Progress")')
              .next(".css-1tp1ukf")
              .text()
              .trim(),
            funding: mainContent
              .find('span.css-19yrmx8:contains("Funding Status")')
              .next(".css-1tp1ukf")
              .text()
              .trim(),
          };
        })(),

        cofounderPreferences: {
          requirements: mainContent
            .find(".css-1hla380 p")
            .map((_, el) => $(el).text().trim())
            .get(),
          idealPersonality: mainContent
            .find('span.css-19yrmx8:contains("Ideal co-founder")')
            .next(".css-1tp1ukf")
            .text()
            .trim(),
          equity: mainContent
            .find('span.css-19yrmx8:contains("Equity expectations")')
            .next(".css-1tp1ukf")
            .text()
            .trim(),
        },

        interests: {
          shared: (() => {
            const label = mainContent.find('span.css-19yrmx8:contains("Our shared interests")').length
              ? mainContent.find('span.css-19yrmx8:contains("Our shared interests")')
              : mainContent.find('span.css-19yrmx8:contains("Shared")');
            const section = label.length ? label.next() : $();
            let items = section.find(".css-1iujaz8").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = section.find("div.ejh47h00").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = mainContent.find(".css-1v9f1hn").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = section.find("div, li, span").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            return items;
          })(),
          personal: (() => {
            const label = mainContent.find('span.css-19yrmx8:contains("My interests")').length
              ? mainContent.find('span.css-19yrmx8:contains("My interests")')
              : mainContent.find('span.css-19yrmx8:contains("Personal")');
            const section = label.length ? label.next() : $();
            let items = section.find(".css-17813s4").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = section.find("div.ejh47h00").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = mainContent.find(".css-1lw35t7").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            if (items.length === 0) items = section.find("div, li, span").map((_, el) => $(el).text().trim()).get().filter(Boolean);
            return items;
          })(),
        },

        linkedIn: mainContent.find(".css-107cmgv").attr("title"),
      };

      const exists = await Profile.exists({ userId: profile.userId });
      if (exists) {
        console.log("skipped, already in DB:", profile.userId);
        continue;
      }

      const loc = profile.location as string;
      if (loc && (loc.includes("India") || loc.includes("Nigeria") || loc.includes("Pakistan") || loc.includes("Bangladesh"))) {
        console.log("skipped, in India:", profile.userId);
        continue;
      }

      // If user already contacted these candidates, mark as read
      if (body.markAsRead) {
        (profile as Record<string, unknown>).readAt = new Date();
      }

      // Normalize and store so education/employment are saved correctly as arrays of strings
      const profileToSave = normalizeEducationAndEmployment(profile);
      await Profile.findOneAndUpdate({ userId: profileToSave.userId }, profileToSave, {
        upsert: true,
        new: true,
      });
      scrapedCount++;
      send({ type: "progress", scrapedCount });
      console.log(`Scraped profile count: ${scrapedCount}`);
      } catch (profileError) {
        const msg = profileError instanceof Error ? profileError.message : String(profileError);
        console.error("Profile parse/save error, skipping:", page.url(), msg);
        continue;
      }
      } catch (loopError) {
        const msg = loopError instanceof Error ? loopError.message : String(loopError);
        if (msg.includes("Timeout") || msg.includes("waitForSelector") || msg.includes("Target closed")) {
          console.log("Page/selector timeout or navigation error, finishing scrape. Profiles saved:", scrapedCount);
          break;
        }
        throw loopError;
      }
    }

    send({ type: "done", scrapedCount, message: "Profile scraped successfully" });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorStack = error instanceof Error ? error.stack : "";

    console.error("Scraping error details:", {
      message: errorMessage,
      stack: errorStack,
      url,
    });

    send({ type: "error", error: errorMessage });
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = process.env.NEXT_PUBLIC_FETCH_URL;
  const ssoKey = body.ssoKey || process.env.NEXT_PUBLIC_SSO_KEY;
  const susSession = body.susSession || process.env.NEXT_PUBLIC_SUS_SESSION;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid URL format" + String(err) },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendProgress = (obj) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        await runScrapeWithProgress(
          { body, url, ssoKey, susSession },
          send
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
