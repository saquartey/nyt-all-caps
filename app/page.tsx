import { getAllHeadlines, getHeadlineCount } from "@/lib/db";
import { HeadlineList } from "@/components/headline-list";

// Re-check the data every 60 seconds so the page stays fresh
export const revalidate = 60;

export default async function Home() {
  const headlines = await getAllHeadlines(500);
  const count = await getHeadlineCount();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-5xl font-black tracking-tight mb-2">
          NYT ALL CAPS
        </h1>
        <p className="text-gray-500 text-lg">
          Tracking when The New York Times uses ALL CAPS headlines.
        </p>
      </header>

      {/* The main content — headline list with check button */}
      <HeadlineList initialHeadlines={headlines} initialCount={count} />

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-400">
        <p>
          Inspired by{" "}
          <a
            href="https://twitter.com/nytimesallcaps"
            className="underline hover:text-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            @NYTIMESALLCAPS
          </a>
          . Data from NYT RSS feeds and Archive API.
        </p>
      </footer>
    </main>
  );
}
