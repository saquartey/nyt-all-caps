import { XMLParser } from "fast-xml-parser";

// --- Types ---

export interface RawHeadline {
  headline: string;
  url: string;
  publishedAt: string;
  section: string | null;
}

export interface BannerResult {
  isActive: boolean;
  headline: string | null;
  bannerDisplay: string;
}

// --- Homepage Banner Scraper (the main detection method) ---

const NYT_HOMEPAGE_URL = "https://www.nytimes.com/";

/**
 * Scrape the NYT homepage to check if there's an ALL CAPS banner headline.
 *
 * Here's the key insight we discovered: the NYT doesn't store headlines
 * in ALL CAPS in their database. The all-caps display is a CSS styling
 * choice controlled by a field called "bannerDisplay" in the page data.
 *
 * When bannerDisplay is "NONE" — normal homepage, no all-caps banner.
 * When bannerDisplay is "LARGE" (or other non-NONE values) — there's
 * a big all-caps banner headline for breaking news.
 *
 * This function scrapes the homepage HTML and extracts that data.
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
  // We look for the bannerDisplay field that's NOT "NONE" —
  // that tells us there's an active all-caps banner.

  // Find all bannerDisplay values and their associated banner text
  const bannerPattern =
    /bannerDisplay[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*banner[\\]*":[\\]*"([^"\\]*)[\\]*"/g;

  let match;
  while ((match = bannerPattern.exec(html)) !== null) {
    const display = match[1];
    const bannerText = match[2];

    if (display !== "NONE" && bannerText) {
      return {
        isActive: true,
        headline: bannerText,
        bannerDisplay: display,
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
      return {
        isActive: true,
        headline: bannerText,
        bannerDisplay: display,
      };
    }
  }

  return {
    isActive: false,
    headline: null,
    bannerDisplay: "NONE",
  };
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
