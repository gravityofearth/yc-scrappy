# Bulk scrape: already-contacted candidates (one-time)

This script scrapes a list of profile URLs (candidates you’ve already contacted), saves each to the DB, and sets `readAt` so they show as “read” in the app.

## 1. Prepare the URL file

- Put your URLs in **`scripts/contacted-urls.txt`** (one URL per line).
- Lines starting with `#` and empty lines are ignored.
- Example:
  ```
  https://www.startupschool.org/cofounder-matching/candidate/abc123
  https://www.startupschool.org/cofounder-matching/candidate/def456
  ```

## 2. Environment

In **`.env.local`** set:

- `MONGODB_URI` – your MongoDB connection string
- `NEXT_PUBLIC_SSO_KEY` – Startup School SSO key (for auth)
- `NEXT_PUBLIC_SUS_SESSION` – Startup School session cookie

Optional:

- `DELAY_MS` – delay between requests in ms (default: 2000). Increase if you hit rate limits.

## 3. Run the script

From the project root:

```bash
npm run bulk-scrape
```

Or with a custom URL file:

```bash
npx tsx scripts/bulk-scrape-contacted.ts path/to/my-urls.txt
```

The script will:

- Load `.env.local`
- Connect to MongoDB
- Open one browser and visit each URL
- Parse the profile, save it, and set `readAt` so it appears as read in the app
- Log progress and a final summary (saved / failed)

For ~1600 URLs at 2s delay, expect about 1–1.5 hours. You can stop with Ctrl+C and re-run later; already-saved profiles will be updated (upsert by `userId`).
