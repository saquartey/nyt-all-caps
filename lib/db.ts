import { createClient, type Client } from "@libsql/client";

// Connect to Turso (cloud-hosted SQLite)
// The URL and token come from environment variables set in .env.local
// (and later in Vercel's dashboard for the deployed version)
//
// Both the client and the table are created on first use (not at import time)
// so this file works both in Next.js and in standalone scripts that load
// env vars with dotenv.
let db: Client | null = null;
let initialized = false;

function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

async function ensureTable() {
  if (initialized) return;
  await getDb().execute(`
    CREATE TABLE IF NOT EXISTS headlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      headline TEXT NOT NULL,
      url TEXT,
      published_at TEXT NOT NULL,
      section TEXT,
      source TEXT DEFAULT 'rss',
      detected_at TEXT DEFAULT (datetime('now')),
      UNIQUE(headline)
    );
  `);
  initialized = true;
}

// --- Types ---

export interface Headline {
  id: number;
  headline: string;
  url: string | null;
  published_at: string;
  section: string | null;
  source: string;
  detected_at: string;
}

// --- Functions that other files can use ---
// (Same functions as before, but now async — they talk to a remote database
//  over the internet instead of reading a file on your computer)

/**
 * Save a headline to the database.
 * Returns true if it was new, false if it was a duplicate (already existed).
 */
export async function insertHeadline(
  headline: string,
  url: string | null,
  publishedAt: string,
  section: string | null,
  source: string = "rss"
): Promise<boolean> {
  await ensureTable();
  const result = await getDb().execute({
    sql: `INSERT OR IGNORE INTO headlines (headline, url, published_at, section, source)
          VALUES (?, ?, ?, ?, ?)`,
    args: [headline, url, publishedAt, section, source],
  });
  return result.rowsAffected > 0;
}

/**
 * Get all headlines, newest first.
 */
export async function getAllHeadlines(
  limit: number = 500
): Promise<Headline[]> {
  await ensureTable();
  const result = await getDb().execute({
    sql: `SELECT * FROM headlines ORDER BY published_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as Headline[];
}

/**
 * Get the total number of headlines in the database.
 */
export async function getHeadlineCount(): Promise<number> {
  await ensureTable();
  const result = await getDb().execute("SELECT COUNT(*) as count FROM headlines");
  return result.rows[0].count as number;
}
