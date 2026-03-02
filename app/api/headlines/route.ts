import { NextResponse } from "next/server";
import { getAllHeadlines, getHeadlineCount } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/headlines
 *
 * Returns all stored headlines as JSON. The dashboard calls this
 * to refresh its display after checking for new headlines.
 */
export async function GET() {
  const headlines = getAllHeadlines(500);
  const count = getHeadlineCount();
  return NextResponse.json({ headlines, count });
}
