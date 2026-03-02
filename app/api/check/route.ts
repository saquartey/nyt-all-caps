import { NextResponse } from "next/server";
import { checkHomepageBanner, fetchRssHeadlines } from "@/lib/nyt";
import { insertHeadline, getHeadlineCount } from "@/lib/db";

// Tell Next.js: never cache this endpoint — always run it fresh
export const dynamic = "force-dynamic";

/**
 * GET /api/check
 *
 * Checks the NYT homepage for an active ALL CAPS banner headline.
 *
 * How it works:
 * 1. Scrapes the NYT homepage and looks for "bannerDisplay" in the page data
 * 2. If bannerDisplay is not "NONE", there's an active all-caps banner
 * 3. Grabs the banner headline text
 * 4. Tries to match it with an RSS feed article to get the URL
 * 5. Saves it to the database (skips duplicates)
 */
export async function GET() {
  try {
    // Check the homepage for an active banner
    const banner = await checkHomepageBanner();

    let newCount = 0;
    const newHeadlines: string[] = [];

    if (banner.isActive && banner.headline) {
      // Try to find the matching article URL from the RSS feed
      let articleUrl: string | null = null;
      let articleSection: string | null = null;

      try {
        const rssHeadlines = await fetchRssHeadlines();
        // Look for an RSS item whose title overlaps with the banner text.
        // Banner headlines are often shortened versions of the full headline,
        // so we check for keyword overlap rather than exact match.
        const bannerWords = banner
          .headline!.toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3); // Skip short words like "the", "and"

        const match = rssHeadlines.find((item) => {
          const titleLower = item.headline.toLowerCase();
          // Count how many significant banner words appear in this title
          const matchCount = bannerWords.filter((w) =>
            titleLower.includes(w)
          ).length;
          // If more than half the banner words match, it's likely the same story
          return matchCount >= Math.ceil(bannerWords.length / 2);
        });
        if (match) {
          articleUrl = match.url;
          articleSection = match.section;
        }
      } catch {
        // RSS fetch failed — that's OK, we still have the headline
      }

      const wasInserted = insertHeadline(
        banner.headline,
        articleUrl,
        new Date().toISOString(),
        articleSection,
        "homepage"
      );

      if (wasInserted) {
        newCount++;
        newHeadlines.push(banner.headline);
      }
    }

    const totalCount = getHeadlineCount();

    return NextResponse.json({
      success: true,
      bannerActive: banner.isActive,
      bannerDisplay: banner.bannerDisplay,
      currentBanner: banner.headline,
      newAllCaps: newCount,
      newHeadlines,
      totalInDatabase: totalCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
