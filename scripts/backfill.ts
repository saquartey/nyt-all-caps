/**
 * Historical Backfill Script
 *
 * Fetches articles from the NYT Archive API month by month,
 * checks each headline for ALL CAPS, and saves matches to the database.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts              (defaults: 2020 to now)
 *   npx tsx scripts/backfill.ts 2018 2025    (custom range)
 *
 * This is safe to re-run — duplicates are automatically skipped.
 */

import { fetchArchiveHeadlines } from "../lib/nyt";
import { isAllCaps } from "../lib/detect";
import { insertHeadline } from "../lib/db";

// Load the .env.local file so we can access the NYT API key
// (Next.js does this automatically for the web app, but standalone
// scripts need to do it manually)
import { config } from "dotenv";
config({ path: ".env.local" });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfill(startYear: number, endYear: number) {
  let totalFound = 0;
  let totalInserted = 0;
  const now = new Date();

  console.log(`\n📰 NYT ALL CAPS Backfill`);
  console.log(`   Scanning ${startYear} through ${endYear}...\n`);

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      // Don't try to fetch future months
      if (year === now.getFullYear() && month > now.getMonth() + 1) {
        break;
      }

      const label = `${year}-${String(month).padStart(2, "0")}`;
      process.stdout.write(`${label}...`);

      try {
        const headlines = await fetchArchiveHeadlines(year, month);
        let monthFound = 0;
        let monthInserted = 0;

        for (const item of headlines) {
          if (isAllCaps(item.headline)) {
            monthFound++;
            totalFound++;
            const wasInserted = await insertHeadline(
              item.headline,
              item.url,
              item.publishedAt,
              item.section,
              "archive"
            );
            if (wasInserted) {
              monthInserted++;
              totalInserted++;
              console.log(`\n   🔥 "${item.headline}"`);
              process.stdout.write(`   `);
            }
          }
        }

        console.log(
          ` ${headlines.length} articles, ${monthFound} ALL CAPS` +
            (monthInserted > 0 ? ` (${monthInserted} new)` : "")
        );

        // Wait 6 seconds between requests to respect rate limits
        await sleep(6000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(` ERROR: ${msg}`);

        if (msg.includes("429") || msg.includes("rate")) {
          console.log("   Waiting 60 seconds for rate limit...");
          await sleep(60000);
          month--; // Retry this month
        } else {
          // Wait a bit and continue to next month
          await sleep(10000);
        }
      }
    }
  }

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Total ALL CAPS found: ${totalFound}`);
  console.log(`   New headlines added: ${totalInserted}\n`);
}

// Read command-line arguments (or use defaults)
const args = process.argv.slice(2);
const startYear = args[0] ? parseInt(args[0]) : 2020;
const endYear = args[1] ? parseInt(args[1]) : new Date().getFullYear();

backfill(startYear, endYear);
