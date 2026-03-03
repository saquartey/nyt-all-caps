/**
 * Historical Seed Script
 *
 * Loads confirmed ALL CAPS headlines from the curated data file
 * into the database. These were recovered from:
 *   - The @NYTIMESALLCAPS Twitter bot's tweet archive (via Wayback Machine)
 *   - Verified Wayback Machine snapshots of the NYT homepage
 *
 * Safe to re-run — duplicates are automatically skipped.
 *
 * Usage:
 *   npx tsx scripts/seed-historical.ts
 */

import { insertHeadline } from "../lib/db";
import historicalData from "../data/historical-headlines.json";

interface HistoricalHeadline {
  headline: string;
  date: string;
  source: string;
  notes: string;
}

const headlines = historicalData as HistoricalHeadline[];

let inserted = 0;
let skipped = 0;

console.log(`\n📰 NYT ALL CAPS — Historical Seed`);
console.log(`   Loading ${headlines.length} confirmed headlines...\n`);

for (const item of headlines) {
  const wasInserted = insertHeadline(
    item.headline,
    null, // No article URLs for historical data
    new Date(item.date).toISOString(),
    null, // No section info
    item.source
  );

  if (wasInserted) {
    inserted++;
    console.log(`   ✅ ${item.date} — "${item.headline}"`);
  } else {
    skipped++;
    console.log(`   ⏭️  ${item.date} — "${item.headline}" (already in database)`);
  }
}

console.log(`\n✅ Seed complete!`);
console.log(`   Added: ${inserted} new headlines`);
console.log(`   Skipped: ${skipped} duplicates`);
console.log(`   Total in file: ${headlines.length}\n`);
