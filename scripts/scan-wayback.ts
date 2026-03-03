/**
 * Wayback Machine Scanner
 *
 * Scans archived NYT homepage snapshots for ALL CAPS (MEGA) banner headlines.
 *
 * How it works:
 *   1. For each major news event date, asks the Wayback CDX API for snapshots
 *   2. Fetches the archived HTML from the Wayback Machine
 *   3. Extracts bannerDisplay and banner text from embedded JSON
 *   4. Checks if the banner text is ALL CAPS using our isAllCaps() function
 *
 * Usage:
 *   npx tsx scripts/scan-wayback.ts
 */

import { isAllCaps } from "../lib/detect";

// --- Configuration ---

// Pause between Wayback fetches to be respectful (milliseconds)
const FETCH_DELAY = 2000;

// Major news events from mid-2022 to late 2024 that might have triggered
// ALL CAPS headlines. We check a window of dates around each event.
const EVENT_DATES: { date: string; label: string }[] = [
  // 2022 (after the Twitter bot went dormant)
  { date: "20220808", label: "FBI searches Mar-a-Lago" },
  { date: "20220809", label: "FBI searches Mar-a-Lago (day after)" },
  { date: "20220908", label: "Queen Elizabeth II dies" },
  { date: "20220909", label: "Queen Elizabeth II (day after)" },
  { date: "20221108", label: "Midterm elections" },
  { date: "20221109", label: "Midterm elections (day after)" },

  // 2023
  { date: "20230106", label: "Jan 6 anniversary / McCarthy speaker vote" },
  { date: "20230107", label: "McCarthy elected speaker" },
  { date: "20230330", label: "Trump indicted (Manhattan DA)" },
  { date: "20230331", label: "Trump indicted (day after)" },
  { date: "20230401", label: "Trump indicted (two days after)" },
  { date: "20230608", label: "Trump indicted (federal classified docs)" },
  { date: "20230609", label: "Trump indicted federal (day after)" },
  { date: "20230814", label: "Trump indicted (Georgia)" },
  { date: "20230815", label: "Trump indicted Georgia (day after)" },
  { date: "20231003", label: "McCarthy ousted as speaker" },
  { date: "20231007", label: "Hamas attacks Israel" },
  { date: "20231008", label: "Hamas attacks Israel (day after)" },
  { date: "20231009", label: "Israel responds" },
  { date: "20231025", label: "Mike Johnson elected speaker" },

  // 2024
  { date: "20240305", label: "Super Tuesday" },
  { date: "20240530", label: "Trump convicted (34 counts)" },
  { date: "20240531", label: "Trump convicted (day after)" },
  { date: "20240627", label: "Biden-Trump debate" },
  { date: "20240628", label: "Biden debate fallout" },
  { date: "20240713", label: "Trump assassination attempt" },
  { date: "20240714", label: "Trump assassination attempt (day after)" },
  { date: "20240721", label: "Biden drops out / endorses Harris" },
  { date: "20240722", label: "Biden drops out (day after)" },
  { date: "20240822", label: "Harris accepts nomination" },
  { date: "20240910", label: "Harris-Trump debate" },
  { date: "20241105", label: "Election day 2024" },
  { date: "20241106", label: "Election results 2024" },
];

// --- Wayback CDX API ---

interface CdxEntry {
  timestamp: string;
  statusCode: string;
}

async function getSnapshots(dateStr: string): Promise<CdxEntry[]> {
  const url =
    `https://web.archive.org/cdx/search/cdx` +
    `?url=https://www.nytimes.com/` +
    `&output=json&limit=5` +
    `&from=${dateStr}000000&to=${dateStr}235959` +
    `&filter=statuscode:200`;

  const response = await fetch(url);
  if (!response.ok) {
    console.log(`   ⚠️  CDX API error for ${dateStr}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  // First row is header: ["urlkey", "timestamp", "original", "mimetype", ...]
  if (!Array.isArray(data) || data.length < 2) return [];

  return data.slice(1).map((row: string[]) => ({
    timestamp: row[1],
    statusCode: row[4],
  }));
}

// --- Banner extraction (same logic as lib/nyt.ts but for raw HTML) ---

interface BannerInfo {
  hasBanner: boolean;
  isAllCaps: boolean;
  headline: string | null;
  bannerDisplay: string;
  bannerDeck: string | null;
}

function extractBanner(html: string): BannerInfo {
  // Try bannerDisplay before banner
  const pattern1 =
    /bannerDisplay[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*?banner[\\]*":[\\]*"([^"\\]*)[\\]*"/g;
  let match;
  while ((match = pattern1.exec(html)) !== null) {
    const display = match[1];
    const bannerText = match[2];
    if (display !== "NONE" && bannerText) {
      const deck = extractDeck(html);
      return {
        hasBanner: true,
        isAllCaps: isAllCaps(bannerText),
        headline: bannerText,
        bannerDisplay: display,
        bannerDeck: deck,
      };
    }
  }

  // Try banner before bannerDisplay (some pages have different ordering)
  const pattern2 =
    /banner[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*?bannerDisplay[\\]*":[\\]*"([^"\\]+)[\\]*"/g;
  while ((match = pattern2.exec(html)) !== null) {
    const bannerText = match[1];
    const display = match[2];
    if (display !== "NONE" && bannerText) {
      const deck = extractDeck(html);
      return {
        hasBanner: true,
        isAllCaps: isAllCaps(bannerText),
        headline: bannerText,
        bannerDisplay: display,
        bannerDeck: deck,
      };
    }
  }

  return {
    hasBanner: false,
    isAllCaps: false,
    headline: null,
    bannerDisplay: "NONE",
    bannerDeck: null,
  };
}

function extractDeck(html: string): string | null {
  const deckPattern = /bannerDeck[\\]*":[\\]*"([^"\\]+)[\\]*"/;
  const match = deckPattern.exec(html);
  return match ? match[1] : null;
}

// --- Fetch a Wayback snapshot ---

async function fetchSnapshot(timestamp: string): Promise<string | null> {
  const url = `https://web.archive.org/web/${timestamp}/https://www.nytimes.com/`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(timestamp: string): string {
  // timestamp is like "20220808123456"
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
}

// --- Main ---

interface Finding {
  date: string;
  timestamp: string;
  headline: string;
  bannerDisplay: string;
  bannerDeck: string | null;
  eventLabel: string;
}

async function main() {
  console.log(`\n🔍 NYT ALL CAPS — Wayback Machine Scanner`);
  console.log(`   Scanning ${EVENT_DATES.length} event dates for MEGA banners...\n`);

  const allCapsFindings: Finding[] = [];
  const bannerFindings: Finding[] = []; // Non-all-caps banners (for reference)

  for (const event of EVENT_DATES) {
    console.log(`📅 ${event.date.slice(0, 4)}-${event.date.slice(4, 6)}-${event.date.slice(6, 8)} — ${event.label}`);

    // Get available snapshots for this date
    const snapshots = await getSnapshots(event.date);

    if (snapshots.length === 0) {
      console.log(`   No snapshots found\n`);
      await sleep(500);
      continue;
    }

    console.log(`   Found ${snapshots.length} snapshot(s)`);

    // Check a few snapshots (not all — we just need to detect the banner)
    const toCheck = snapshots.slice(0, 3); // Check up to 3 per date
    let foundBanner = false;

    for (const snap of toCheck) {
      await sleep(FETCH_DELAY);

      console.log(`   Fetching ${snap.timestamp}...`);
      const html = await fetchSnapshot(snap.timestamp);

      if (!html) {
        console.log(`   ⚠️  Failed to fetch`);
        continue;
      }

      const banner = extractBanner(html);

      if (banner.isAllCaps && banner.headline) {
        console.log(`   🚨 ALL CAPS: "${banner.headline}" [${banner.bannerDisplay}]`);
        if (banner.bannerDeck) {
          console.log(`      Deck: "${banner.bannerDeck}"`);
        }
        allCapsFindings.push({
          date: formatDate(snap.timestamp),
          timestamp: snap.timestamp,
          headline: banner.headline,
          bannerDisplay: banner.bannerDisplay,
          bannerDeck: banner.bannerDeck,
          eventLabel: event.label,
        });
        foundBanner = true;
        break; // Found it, no need to check more snapshots for this date
      } else if (banner.hasBanner && banner.headline) {
        console.log(`   📰 Banner (not all caps): "${banner.headline}" [${banner.bannerDisplay}]`);
        bannerFindings.push({
          date: formatDate(snap.timestamp),
          timestamp: snap.timestamp,
          headline: banner.headline,
          bannerDisplay: banner.bannerDisplay,
          bannerDeck: banner.bannerDeck,
          eventLabel: event.label,
        });
        foundBanner = true;
        break;
      }
    }

    if (!foundBanner) {
      console.log(`   No banner detected`);
    }

    console.log();
  }

  // --- Summary ---
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 SCAN RESULTS`);
  console.log(`${"=".repeat(60)}\n`);

  if (allCapsFindings.length > 0) {
    console.log(`🚨 ALL CAPS HEADLINES FOUND: ${allCapsFindings.length}\n`);
    for (const f of allCapsFindings) {
      console.log(`   ${f.date} — "${f.headline}"`);
      console.log(`     Event: ${f.eventLabel}`);
      console.log(`     Display: ${f.bannerDisplay}`);
      if (f.bannerDeck) console.log(`     Deck: "${f.bannerDeck}"`);
      console.log();
    }
  } else {
    console.log(`   No ALL CAPS headlines found in this scan.\n`);
  }

  if (bannerFindings.length > 0) {
    console.log(`📰 Non-ALL-CAPS banners found: ${bannerFindings.length}\n`);
    for (const f of bannerFindings) {
      console.log(`   ${f.date} — "${f.headline}" [${f.bannerDisplay}]`);
    }
    console.log();
  }

  console.log(`Dates scanned: ${EVENT_DATES.length}`);
  console.log(`ALL CAPS found: ${allCapsFindings.length}`);
  console.log(`Other banners: ${bannerFindings.length}`);
  console.log();
}

main().catch(console.error);
