/**
 * One-time bulk scrape: read a list of profile URLs (already contacted candidates),
 * scrape each, save to DB, and set readAt so they show as "read" in the app.
 *
 * Usage:
 *   1. Put your URLs in scripts/contacted-urls.txt (one URL per line).
 *   2. Set .env.local with MONGODB_URI, NEXT_PUBLIC_SSO_KEY, NEXT_PUBLIC_SUS_SESSION.
 *   3. Run: npx tsx scripts/bulk-scrape-contacted.ts [path-to-urls.txt]
 *
 * Default URL file: scripts/contacted-urls.txt
 * Optional delay between requests (ms): set DELAY_MS in env (default 2000).
 */

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import playwright from "playwright";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/mongodb";
import { launchBrowser } from "../src/lib/playwright";
import { normalizeEducationAndEmployment } from "../src/lib/profileUtils";
import { Profile } from "../src/models/Profile";



function lastSeenToDaysAgo(lastSeen: string): number | null {
  if (!lastSeen || typeof lastSeen !== "string") return null;
  const s = lastSeen.trim().toLowerCase();
  if (!s) return null;
  if (/^today$/i.test(s)) return 0;
  if (/^yesterday$/i.test(s)) return 1;
  const hoursMatch = s.match(/^(\d+)\s*hour(s)?\s*ago$/);
  if (hoursMatch) {
    const h = parseInt(hoursMatch[1], 10);
    return Math.max(0, Math.ceil(h / 24));
  }
  const dayMatch = s.match(/^(?:a\s+)?(\d+)\s*day(s)?\s*ago$/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  if (/^a day ago$/i.test(s)) return 1;
  const weekMatch = s.match(/^(?:a\s+)?(\d+)\s*week(s)?\s*ago$/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  if (/^a week ago$/i.test(s)) return 7;
  const monthMatch = s.match(/^(?:a\s+)?(\d+)\s*month(s)?\s*ago$/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  if (/^a month ago$/i.test(s)) return 30;
  const yearMatch = s.match(/^(?:a\s+)?(\d+)\s*year(s)?\s*ago$/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 365;
  if (/^a year ago$/i.test(s)) return 365;
  return null;
}

function buildProfileFromHtml(
  html: string,
  pageUrl: string
): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const mainContent = $(".css-139x40p");
  if (!mainContent.length) return null;

  const ageText = mainContent.find('[title="Age"]').text().replace(/\D/g, "");
  const lastSeenRaw = mainContent
    .find('[title="Last seen on co-founder matching"]')
    .text()
    .replace("Last seen ", "")
    .trim();

  const profile: Record<string, unknown> = {
    userId: pageUrl.split("/").pop(),
    name: (() => {
      const a = mainContent.find(".css-1s8r69b").text().trim();
      if (a) return a;
      const b = mainContent.find(".css-y9z691").text().trim();
      if (b) return b;
      return mainContent.find("h1").first().text().trim();
    })(),
    location: mainContent.find('[title="Location"]').text().trim(),
    age: ageText ? parseInt(ageText, 10) : null,
    lastSeen: lastSeenRaw,
    lastSeenDays: lastSeenToDaysAgo(lastSeenRaw),
    readAt: new Date(),
    contact: true,
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
    updatedAt: new Date(),
  };
  return profile;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // loadEnv();

  const urlFile =
    process.argv[2] ||
    path.resolve(process.cwd(), "scripts", "contacted-urls.txt");
  console.log("********urlFile: ", urlFile);
  const delayMs = 3;
  const ssoKey = process.env.NEXT_PUBLIC_SSO_KEY || 'JwpZvDmqDKI7EA0HV60G0aZP76rZKl-G';
  const susSession = process.env.NEXT_PUBLIC_SUS_SESSION || 'wEWju3%2BOTmklD6JZtQZ69fE4zycsDlMRMyq4gYvSWXYVv5VRxe3eyrom2ycyLYiX5F1DEXEJ48oxaEuMxgsWg%2FmOzEZ9h9l8kqaamKXcIoVllzK7NL0keHKfaQgAIyBr6hBvSt4vRXDJZVJFOupUTGN1zfX0KxpUxlfu%2BZWzefFC1fzjfAZilqfODrIy%2BfjA%2BlcYlHbDEf8BVMkS9vufZTQFIPyg%2BmRo2N%2B2sOQtJRREh7Af5loiwH54MJiYDCdMkI9Lq1nyhiXaScI4MzRTKC21KdY%3D--sqLXmXVoUu74u0yV--86rb7Vswa7f%2BYEw5HdIHkA%3D%3D';

  if (!ssoKey || !susSession) {
    console.error(
      "Missing NEXT_PUBLIC_SSO_KEY or NEXT_PUBLIC_SUS_SESSION in .env.local"
    );
    process.exit(1);
  }

  if (!fs.existsSync(urlFile)) {
    console.error(
      `URL file not found: ${urlFile}\nCreate it with one profile URL per line (e.g. https://www.startupschool.org/cofounder-matching/candidate/xxx)`
    );
    process.exit(1);
  }

  const urlContent = fs.readFileSync(urlFile, "utf8");
  const urls = urlContent
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u && u.startsWith("http"));
  console.log(`Found ${urls.length} URLs in ${urlFile}`);
  if (urls.length === 0) {
    console.error("No valid URLs found.");
    process.exit(1);
  }

  await connectDB();
  console.log("Connected to MongoDB");

  const browser = await launchBrowser();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "Accept-Encoding": "gzip, deflate, br" },
  });
  await context.route("**/*.{png,jpg,jpeg,gif,css}", (route) => route.abort());
  await context.route("**/*.{woff,woff2,ttf,otf}", (route) => route.abort());
  await context.addCookies([
    { name: "_sso.key", value: ssoKey, domain: ".startupschool.org", path: "/" },
    {
      name: "_sus_session",
      value: susSession,
      domain: ".startupschool.org",
      path: "/",
    },
  ]);

  let ok = 0;
  let fail = 0;
  const errors: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(".css-139x40p", { timeout: 15000 });
      const content = await page.content();
      const profile = buildProfileFromHtml(content, page.url());
      if (!profile || !profile.userId) {
        throw new Error("Could not parse profile");
      }
      const existing = await Profile.findOne({ userId: profile.userId }).lean();
      if (existing) {
        await Profile.updateOne(
          { userId: profile.userId },
          { $set: { readAt: new Date(), contact: true } }
        );
        console.log(`[${i + 1}/${urls.length}] OK (updated) ${profile.userId} (${profile.name})`);
      } else {
        const profileToSave = normalizeEducationAndEmployment(profile);
        await Profile.findOneAndUpdate(
          { userId: profileToSave.userId },
          profileToSave,
          { upsert: true, new: true }
        );
        console.log(`[${i + 1}/${urls.length}] OK (inserted) ${profileToSave.userId} (${profileToSave.name})`);
      }
      ok++;
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${url}: ${msg}`);
      console.error(`[${i + 1}/${urls.length}] FAIL ${url}: ${msg}`);
    } finally {
      await page.close();
    }
    if (i < urls.length - 1) await delay(delayMs);
  }

  await browser.close();
  await mongoose.disconnect();

  console.log("\n--- Done ---");
  console.log(`Saved: ${ok}, Failed: ${fail}`);
  if (errors.length > 0 && errors.length <= 20) {
    errors.forEach((e) => console.error(e));
  } else if (errors.length > 20) {
    console.error("First 20 errors:", errors.slice(0, 20));
    console.error(`... and ${errors.length - 20} more.`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
