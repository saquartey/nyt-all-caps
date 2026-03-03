import { XMLParser } from "fast-xml-parser";
import { isAllCaps } from "./detect";

// --- Types ---

export interface RawHeadline {
  headline: string;
  url: string;
  publishedAt: string;
  section: string | null;
}

export interface BannerResult {
  hasBanner: boolean; // Is there any banner at all? (LARGE, MEGA, etc.)
  isAllCaps: boolean; // Is the banner text actually ALL CAPS?
  headline: string | null;
  bannerDisplay: string; // The raw value: "NONE", "LARGE", "MEGA", etc.
  bannerDeck: string | null; // Secondary text (subtitle) under the banner
}

// --- Homepage Banner Scraper (the main detection method) ---

const NYT_HOMEPAGE_URL = "https://www.nytimes.com/";

/**
 * Scrape the NYT homepage to check if there's an ALL CAPS banner headline.
 *
 * What we learned: the NYT has multiple banner styles:
 *   - "NONE"  = no banner at all (normal homepage)
 *   - "LARGE" = big centered headline, but normal title case (NOT all caps)
 *   - "MEGA"  = the full-width all-caps treatment for huge breaking news
 *
 * The ALL CAPS effect isn't CSS — the editors actually type the headline
 * in uppercase when they want the mega treatment. So we check the text itself
 * using isAllCaps() rather than relying only on the bannerDisplay value.
 *
 * We also extract bannerDeck (the subtitle text under the main banner),
 * which is also typed in ALL CAPS during mega events.
 */
export async function checkHomepageBanner(): Promise<BannerResult> {
  const response = await fetch(NYT_HOMEPAGE_URL, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await response.text();

  // The NYT embeds page data as escaped JSON in the HTML.
  // We extract bannerDisplay, banner (headline text), and bannerDeck (subtitle).

  // Find all bannerDisplay values and their associated banner text
  const bannerPattern =
    /bannerDisplay[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*banner[\\]*":[\\]*"([^"\\]*)[\\]*"/g;

  let match;
  while ((match = bannerPattern.exec(html)) !== null) {
    const display = match[1];
    const bannerText = match[2];

    if (display !== "NONE" && bannerText) {
      const deck = extractBannerDeck(html);
      return {
        hasBanner: true,
        isAllCaps: isAllCaps(bannerText),
        headline: bannerText,
        bannerDisplay: display,
        bannerDeck: deck,
      };
    }
  }

  // Also try the reverse order (banner before bannerDisplay)
  const reversePattern =
    /banner[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*bannerDisplay[\\]*":[\\]*"([^"\\]+)[\\]*"/g;

  while ((match = reversePattern.exec(html)) !== null) {
    const bannerText = match[1];
    const display = match[2];

    if (display !== "NONE" && bannerText) {
      const deck = extractBannerDeck(html);
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

/**
 * Extract the bannerDeck (subtitle) from the page HTML.
 * During MEGA events, this contains a secondary ALL CAPS line like
 * "VICTORY CHANGES NATION'S SENSE OF ITSELF"
 */
function extractBannerDeck(html: string): string | null {
  const deckPattern =
    /bannerDeck[\\]*":[\\]*"([^"\\]+)[\\]*"/g;
  const match = deckPattern.exec(html);
  return match ? match[1] : null;
}

// --- RSS Feed (for getting article URLs and metadata) ---

const NYT_RSS_URL =
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml";

/**
 * Fetch current headlines from the NYT homepage RSS feed.
 * Used to find the URL for a banner headline (since the banner data
 * doesn't always include a direct link).
 */
export async function fetchRssHeadlines(): Promise<RawHeadline[]> {
  const response = await fetch(NYT_RSS_URL, {
    cache: "no-store",
  });
  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  if (!Array.isArray(items)) return [];

  return items.map((item: Record<string, unknown>) => ({
    headline: String(item.title || ""),
    url: String(item.link || ""),
    publishedAt: String(item.pubDate || new Date().toISOString()),
    section:
      typeof item.category === "string"
        ? item.category
        : Array.isArray(item.category)
          ? String(item.category[0])
          : null,
  }));
}

// --- Archive API (historical headlines, requires API key) ---

/**
 * Fetch all articles from a given month using the NYT Archive API.
 * Note: This returns headline TEXT, which is always in title case.
 * It cannot detect all-caps banner display since that's a CSS choice.
 * Kept for potential future use.
 */
export async function fetchArchiveHeadlines(
  year: number,
  month: number
): Promise<RawHeadline[]> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NYT_API_KEY not found in environment variables. Add it to .env.local"
    );
  }

  const url =
    `https://api.nytimes.com/svc/archive/v1/${year}/${month}.json` +
    `?api-key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Archive API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const docs = data?.response?.docs;

  if (!Array.isArray(docs)) return [];

  return docs
    .filter((doc: Record<string, unknown>) => {
      return doc.document_type === "article";
    })
    .map((doc: Record<string, unknown>) => {
      const headline = doc.headline as Record<string, unknown> | undefined;
      return {
        headline: String(headline?.main || headline?.print_headline || ""),
        url: String(doc.web_url || ""),
        publishedAt: String(doc.pub_date || ""),
        section: String(doc.section_name || ""),
      };
    });
}
