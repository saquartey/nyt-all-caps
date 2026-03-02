"use client";

// ^^^ This line tells Next.js: "this component runs in the browser."
// By default, Next.js components run on the server. But this one needs
// to respond to button clicks and update the display, so it must be
// a "client component."

import { useState } from "react";
import type { Headline } from "@/lib/db";
import { HeadlineCard } from "./headline-card";

interface Props {
  initialHeadlines: Headline[];
  initialCount: number;
}

export function HeadlineList({ initialHeadlines, initialCount }: Props) {
  // "State" = data that can change over time and triggers a re-render.
  // useState gives us a value and a function to update it.
  const [headlines, setHeadlines] = useState(initialHeadlines);
  const [count, setCount] = useState(initialCount);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    try {
      // Call our /api/check endpoint to scrape the NYT homepage
      const res = await fetch("/api/check");
      const data = await res.json();

      if (data.success) {
        // Refresh the headline list from the database
        const pageRes = await fetch("/api/headlines");
        const pageData = await pageRes.json();
        setHeadlines(pageData.headlines);
        setCount(pageData.count);

        // Update the current banner status
        setCurrentBanner(data.bannerActive ? data.currentBanner : null);

        if (data.newAllCaps > 0) {
          setLastCheck(
            `NEW ALL CAPS HEADLINE DETECTED: "${data.newHeadlines[0]}"`
          );
        } else if (data.bannerActive) {
          setLastCheck(
            `Active banner found: "${data.currentBanner}" (already tracked)`
          );
        } else {
          setLastCheck("No all-caps banner on the NYT homepage right now.");
        }
      } else {
        setLastCheck(`Error: ${data.error}`);
      }
    } catch {
      setLastCheck("Failed to check headlines. Is the server running?");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      {/* Live banner alert */}
      {currentBanner && (
        <div className="mb-8 p-6 bg-black text-white rounded-lg">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Live on NYT Homepage
          </p>
          <p className="text-2xl font-black tracking-wide">{currentBanner}</p>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <p className="text-gray-500">
          <span className="text-2xl font-black text-black">{count}</span>{" "}
          ALL CAPS headline{count !== 1 ? "s" : ""} tracked
        </p>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium
                     hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors cursor-pointer"
        >
          {checking ? "Checking..." : "Check for new headlines"}
        </button>
      </div>

      {/* Status message */}
      {lastCheck && (
        <div className="mb-6 px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          {lastCheck}
        </div>
      )}

      {/* Headlines timeline */}
      {headlines.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-3xl font-black mb-4">NO ALL CAPS YET</p>
          <p className="text-sm max-w-md mx-auto">
            Click &quot;Check for new headlines&quot; to scan the NYT
            homepage. The NYT only uses all-caps banners for major breaking
            news, so it may be empty for now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {headlines.map((h) => (
            <HeadlineCard key={h.id} headline={h} />
          ))}
        </div>
      )}
    </div>
  );
}
