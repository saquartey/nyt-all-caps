import { NextRequest, NextResponse } from "next/server";
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
 * 2. Checks if the banner text is actually ALL CAPS (not just a large banner)
 *    — "LARGE" banners are big but normal case, "MEGA" banners are ALL CAPS
 *    — We verify by checking the text itself, not just the display mode
 * 3. If it IS all caps, tries to match it with an RSS feed article to get the URL
 * 4. Saves it to the database (skips duplicates)
 *
 * Security: When CRON_SECRET is set, requests must include it as a bearer token
 * OR come from the same origin (the dashboard's "Check" button). This prevents
 * random people from spamming the endpoint on the deployed site.
 */
export async function GET(request: NextRequest) {
  // If a CRON_SECRET is configured, verify the request is authorized
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const isVercelCron = authHeader === `Bearer ${cronSecret}`;
    const isFromDashboard = request.headers.get("referer")?.includes(request.headers.get("host") || "");
    if (!isVercelCron && !isFromDashboard) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    // Check the homepage for an active banner
    const banner = await checkHomepageBanner();

    let newCount = 0;
    const newHeadlines: string[] = [];

    // Only save if the banner text is genuinely ALL CAPS
    if (banner.isAllCaps && banner.headline) {
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

      const wasInserted = await insertHeadline(
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

    const totalCount = await getHeadlineCount();

    return NextResponse.json({
      success: true,
      // Banner info (is there ANY banner on the homepage?)
      hasBanner: banner.hasBanner,
      bannerDisplay: banner.bannerDisplay,
      currentBanner: banner.headline,
      bannerDeck: banner.bannerDeck,
      // ALL CAPS info (is it actually ALL CAPS?)
      isAllCaps: banner.isAllCaps,
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
