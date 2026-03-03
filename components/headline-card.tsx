import type { Headline } from "@/lib/db";

/**
 * Displays a single ALL CAPS headline.
 *
 * In React, this is a "component" — a reusable building block.
 * It takes a headline object and renders it as a clickable card.
 */
export function HeadlineCard({ headline }: { headline: Headline }) {
  const date = new Date(headline.published_at);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow bg-white">
      <a
        href={headline.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <h2 className="text-xl font-black tracking-wide leading-tight mb-3 hover:underline">
          {headline.headline}
        </h2>
      </a>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <time dateTime={headline.published_at}>{formattedDate}</time>
        {headline.section && (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
            {headline.section}
          </span>
        )}
        {headline.source === "twitter-archive" && (
          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">
            from @NYTIMESALLCAPS
          </span>
        )}
        {headline.source === "wayback-verified" && (
          <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-xs">
            Wayback Machine
          </span>
        )}
      </div>
    </article>
  );
}
