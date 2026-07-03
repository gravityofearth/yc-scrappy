import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import playwright from "playwright";
import { connectDB } from "@/lib/mongodb";
import { launchBrowser } from "@/lib/playwright";
import { lastSeenToDaysAgo } from "@/lib/lastSeenUtils";
import { normalizeEducationAndEmployment } from "@/lib/profileUtils";
import { Profile } from "@/models/Profile";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.startupschool.org/cofounder-matching/candidate";

/**
 * POST /api/profiles/refresh-uncontacted
 * Get all profiles from DB, skip where contact===true, scrape and update each uncontacted profile.
 * Body: { ssoKey?, susSession? } (optional, uses env if not provided)
 */
export async function POST(request: Request) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error:
          "Refresh is not available on Vercel. Run locally or on a platform that supports Playwright.",
      },
      { status: 503 }
    );
  }

  console.log("Refreshing uncontacted profiles...");
  const body = await request.json().catch(() => ({}));
  const ssoKey = body.ssoKey || process.env.NEXT_PUBLIC_SSO_KEY;
  const susSession = body.susSession || process.env.NEXT_PUBLIC_SUS_SESSION;

  if (!ssoKey || !susSession) {
    return NextResponse.json(
      { error: "Missing ssoKey or susSession (or set in .env)" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    console.log("Connected to database");
    const uncontacted = await Profile.find({
      $or: [{ contact: { $ne: true } }, { contact: null }, { contact: { $exists: false } }],
    })
      .select("userId")
      .lean();

    if (uncontacted.length === 0) {
      return NextResponse.json({
        message: "No uncontacted profiles to update",
        total: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
      });
    }
    console.log("Found ", uncontacted.length, " uncontacted profiles");
    const browser = await launchBrowser();
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { "Accept-Encoding": "gzip, deflate, br" },
    });
    await context.addCookies([
      { name: "_sso.key", value: ssoKey, domain: ".startupschool.org", path: "/" },
      { name: "_sus_session", value: susSession, domain: ".startupschool.org", path: "/" },
    ]);

    const applyRoutes = async (p: playwright.Page) => {
      await p.route("**/*.{png,jpg,jpeg,gif,css}", (route) => route.abort());
      await p.route("**/*.{woff,woff2,ttf,otf}", (route) => route.abort());
      await p.route("**/{analytics,tracking,advertisement}/**", (route) => route.abort());
    };

    let page = await context.newPage();
    await applyRoutes(page);

    const results = { updated: 0, failed: 0, errors: [] as string[] };
    const PAGE_REFRESH_INTERVAL = 25;
    let count = 0;
    for (let i = 0; i < uncontacted.length; i++) {
      const profile = uncontacted[i];
      if (!profile.userId) continue;
      
      console.log("processing profile:", profile.userId);
      if (i > 0 && i % PAGE_REFRESH_INTERVAL === 0) {
        await page.close().catch(() => {});
        page = await context.newPage();
        await applyRoutes(page);
      }

      const profileUrl = `${BASE_URL}/${profile.userId}`;
      try {
        await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector(".css-139x40p", { timeout: 15000 });
      } catch (navErr) {
        results.failed++;
        const msg = navErr instanceof Error ? navErr.message : String(navErr);
        results.errors.push(`${profile.userId}: ${msg}`);
        continue;
      }

      const content = await page.content();
      const $ = cheerio.load(content);
      const mainContent = $(".css-139x40p");
      const age = mainContent.find('[title="Age"]').text().replace(/\D/g, "");
      const lastSeenRaw = mainContent
        .find('[title="Last seen on co-founder matching"]')
        .text()
        .replace("Last seen ", "")
        .trim();

      const updatedProfile = {
        userId: profile.userId,
        name: (() => {
          const a = mainContent.find(".css-1s8r69b").text().trim();
          if (a) return a;
          const b = mainContent.find(".css-y9z691").text().trim();
          if (b) return b;
          return mainContent.find("h1").first().text().trim();
        })(),
        location: mainContent.find('[title="Location"]').text().trim(),
        age: age ? parseInt(age, 10) : null,
        lastSeen: lastSeenRaw,
        lastSeenDays: lastSeenToDaysAgo(lastSeenRaw),
        avatar: mainContent.find(".css-1bm26bw").attr("src"),
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
        lifeStory: mainContent.find('span.css-19yrmx8:contains("Life Story")').next(".css-1tp1ukf").text().trim(),
        freeTime: mainContent.find('span.css-19yrmx8:contains("Free Time")').next(".css-1tp1ukf").text().trim(),
        other: mainContent.find('span.css-19yrmx8:contains("Other")').next(".css-1tp1ukf").text().trim(),
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
        updatedAt: new Date(),
      };

      try {
        const profileToSave = normalizeEducationAndEmployment(updatedProfile);
        await Profile.findOneAndUpdate({ userId: profile.userId }, profileToSave, { new: true });
        results.updated++;
      } catch (err) {
        results.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${profile.userId}: ${msg}`);
      }
      count ++;
      console.log("Updated profile successfully: ", count);
      await delay(1000);
    }

    await page.close().catch(() => {});
    await browser.close();

    return NextResponse.json({
      message: "Refresh uncontacted completed",
      total: uncontacted.length,
      updated: results.updated,
      failed: results.failed,
      skipped: 0,
      errors: results.errors.slice(0, 50),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Refresh uncontacted error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
