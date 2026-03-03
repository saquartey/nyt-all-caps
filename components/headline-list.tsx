import type { Headline } from "@/lib/db";
import { HeadlineCard } from "./headline-card";

interface Props {
  headlines: Headline[];
  count: number;
}

export function HeadlineList({ headlines, count }: Props) {
  return (
    <div>
      {/* Headline count */}
      <div className="mb-8">
        <p className="text-gray-500">
          <span className="text-2xl font-black text-black">{count}</span>{" "}
          ALL CAPS headline{count !== 1 ? "s" : ""} tracked
        </p>
      </div>

      {/* Headlines timeline */}
      {headlines.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-3xl font-black mb-4">NO ALL CAPS YET</p>
          <p className="text-sm max-w-md mx-auto">
            The NYT only uses ALL CAPS banners for major breaking news.
            This page checks automatically every 15 minutes.
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
