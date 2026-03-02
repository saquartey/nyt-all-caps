import Database from "better-sqlite3";
import path from "path";

// The database is just a file in the project folder
const DB_PATH = path.join(process.cwd(), "nyt-caps.db");

// Keep one connection open (instead of opening a new one every time)
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);

    // WAL mode = better performance for reading while writing
    db.pragma("journal_mode = WAL");

    // Create the headlines table if it doesn't exist yet.
    // Think of this as defining the columns of a spreadsheet:
    //   - id: auto-generated unique number for each row
    //   - headline: the actual headline text
    //   - url: link to the NYT article
    //   - published_at: when the article was published
    //   - section: which NYT section (Politics, World, etc.)
    //   - source: how we found it ("rss" or "archive")
    //   - detected_at: when our app first spotted it
    //   - UNIQUE constraint: prevents duplicate entries
    db.exec(`
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
  }
  return db;
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

/**
 * Save a headline to the database.
 * Returns true if it was new, false if it was a duplicate (already existed).
 */
export function insertHeadline(
  headline: string,
  url: string | null,
  publishedAt: string,
  section: string | null,
  source: string = "rss"
): boolean {
  const db = getDb();
  // INSERT OR IGNORE = if this headline already exists, just skip it
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO headlines (headline, url, published_at, section, source)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(headline, url, publishedAt, section, source);
  return result.changes > 0;
}

/**
 * Get all headlines, newest first.
 */
export function getAllHeadlines(limit: number = 500): Headline[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM headlines
    ORDER BY published_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Headline[];
}

/**
 * Get the total number of headlines in the database.
 */
export function getHeadlineCount(): number {
  const db = getDb();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM headlines");
  const row = stmt.get() as { count: number };
  return row.count;
}
