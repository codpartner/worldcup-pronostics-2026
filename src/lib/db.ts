import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import tournamentData from "@/data/world-cup-2026.json";
import { maskName } from "./anonymize";
import {
  isEmailConfigured,
  sendCorrectPredictionEmail,
  sendPicksOpenEmail,
} from "./email";
import {
  calculatePickPoints,
  formatPick,
  isMatchPick,
  pickFromLegacyScores,
  type MatchPick,
} from "./picks";
import {
  formatPickWindowDate,
  getPicksCloseAt,
  getPicksOpenAt,
  getPicksOpenDaysBefore,
  getPickWindowStatus,
  getResultSyncAfter,
  isKnockoutMatch,
  isMatchLocked,
  isPicksOpen,
} from "./scoring";
import { LIVE_STATUSES } from "./api-football";
import { isValidBracketMatchNum } from "./bracket-picks";
import type {
  ActivityEntry,
  BracketPick,
  BracketSubmission,
  GroupRankingRecord,
  GroupRankings,
  LeaderboardEntry,
  LiveMatch,
  Match,
  MatchEmailStats,
  Prediction,
  PredictionHistoryEntry,
  ScoredPrediction,
  User,
} from "./types";

const DB_PATH = path.join(process.cwd(), "data", "pronostics.db");
const BRACKET_PDF_DIR = path.join(process.cwd(), "data", "bracket-submissions");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  migrateSchema(db);
  seedMatches(db);
  backfillSyncSchedule(db);

  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY,
      round TEXT NOT NULL,
      num INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      group_name TEXT,
      ground TEXT NOT NULL,
      score1 INTEGER,
      score2 INTEGER,
      live_score1 INTEGER,
      live_score2 INTEGER,
      match_status TEXT,
      elapsed INTEGER,
      api_fixture_id INTEGER,
      sync_after_utc TEXT,
      last_sync_at TEXT,
      sync_attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      match_id INTEGER NOT NULL,
      pick TEXT NOT NULL DEFAULT 'team1',
      score1 INTEGER,
      score2 INTEGER,
      points INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, match_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prediction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      match_id INTEGER NOT NULL,
      pick TEXT,
      score1 INTEGER,
      score2 INTEGER,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prediction_notifications (
      prediction_id INTEGER PRIMARY KEY,
      points INTEGER NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pick_window_notifications (
      match_id INTEGER PRIMARY KEY,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_rankings (
      user_id INTEGER PRIMARY KEY,
      rankings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bracket_submissions (
      user_id INTEGER PRIMARY KEY,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      pdf_path TEXT NOT NULL,
      email_sent_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bracket_picks (
      user_id INTEGER NOT NULL,
      match_num INTEGER NOT NULL,
      pick TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, match_num),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function migrateSchema(database: Database.Database) {
  const userColumns = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  const userColumnNames = new Set(userColumns.map((column) => column.name));

  if (!userColumnNames.has("email")) {
    database.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
  }
  if (!userColumnNames.has("password_hash")) {
    database.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  }

  const predictionColumns = database
    .prepare("PRAGMA table_info(predictions)")
    .all() as { name: string }[];
  const predictionColumnNames = new Set(
    predictionColumns.map((column) => column.name)
  );

  if (!predictionColumnNames.has("pick")) {
    database.exec(`ALTER TABLE predictions ADD COLUMN pick TEXT`);
  }

  const historyColumns = database
    .prepare("PRAGMA table_info(prediction_history)")
    .all() as { name: string }[];
  const historyColumnNames = new Set(
    historyColumns.map((column) => column.name)
  );

  if (!historyColumnNames.has("pick")) {
    database.exec(`ALTER TABLE prediction_history ADD COLUMN pick TEXT`);
  }

  migratePredictionsToPicks(database);

  const matchColumns = database
    .prepare("PRAGMA table_info(matches)")
    .all() as { name: string }[];
  const matchColumnNames = new Set(matchColumns.map((column) => column.name));

  if (!matchColumnNames.has("api_fixture_id")) {
    database.exec(`ALTER TABLE matches ADD COLUMN api_fixture_id INTEGER`);
  }
  if (!matchColumnNames.has("sync_after_utc")) {
    database.exec(`ALTER TABLE matches ADD COLUMN sync_after_utc TEXT`);
  }
  if (!matchColumnNames.has("last_sync_at")) {
    database.exec(`ALTER TABLE matches ADD COLUMN last_sync_at TEXT`);
  }
  if (!matchColumnNames.has("sync_attempts")) {
    database.exec(`ALTER TABLE matches ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0`);
  }
  if (!matchColumnNames.has("live_score1")) {
    database.exec(`ALTER TABLE matches ADD COLUMN live_score1 INTEGER`);
  }
  if (!matchColumnNames.has("live_score2")) {
    database.exec(`ALTER TABLE matches ADD COLUMN live_score2 INTEGER`);
  }
  if (!matchColumnNames.has("match_status")) {
    database.exec(`ALTER TABLE matches ADD COLUMN match_status TEXT`);
  }
  if (!matchColumnNames.has("elapsed")) {
    database.exec(`ALTER TABLE matches ADD COLUMN elapsed INTEGER`);
  }

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_prediction_history_user ON prediction_history(user_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_prediction_history_match ON prediction_history(match_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_sync_after ON matches(sync_after_utc);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
    CREATE TABLE IF NOT EXISTS bracket_picks (
      user_id INTEGER NOT NULL,
      match_num INTEGER NOT NULL,
      pick TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, match_num),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function scoresFromPick(pick: MatchPick): [number, number] {
  if (pick === "team1") return [1, 0];
  if (pick === "team2") return [0, 1];
  return [0, 0];
}

function readPickFromRow(row: {
  pick?: string | null;
  score1?: number | null;
  score2?: number | null;
}): MatchPick {
  if (row.pick && isMatchPick(row.pick)) {
    return row.pick;
  }

  if (row.score1 != null && row.score2 != null) {
    return pickFromLegacyScores(row.score1, row.score2);
  }

  return "team1";
}

function migratePredictionsToPicks(database: Database.Database) {
  const predictions = database
    .prepare(
      "SELECT id, pick, score1, score2, match_id FROM predictions WHERE pick IS NULL OR pick = ''"
    )
    .all() as {
    id: number;
    pick: string | null;
    score1: number | null;
    score2: number | null;
    match_id: number;
  }[];

  const updatePick = database.prepare(
    "UPDATE predictions SET pick = ? WHERE id = ?"
  );

  for (const row of predictions) {
    if (row.score1 == null || row.score2 == null) continue;
    updatePick.run(pickFromLegacyScores(row.score1, row.score2), row.id);
  }

  const history = database
    .prepare(
      "SELECT id, pick, score1, score2 FROM prediction_history WHERE pick IS NULL OR pick = ''"
    )
    .all() as {
    id: number;
    pick: string | null;
    score1: number | null;
    score2: number | null;
  }[];

  const updateHistoryPick = database.prepare(
    "UPDATE prediction_history SET pick = ? WHERE id = ?"
  );

  for (const row of history) {
    if (row.score1 == null || row.score2 == null) continue;
    updateHistoryPick.run(
      pickFromLegacyScores(row.score1, row.score2),
      row.id
    );
  }

  const finishedPredictions = database
    .prepare(
      `SELECT p.id, p.pick, p.score1, p.score2, m.score1 as actual1, m.score2 as actual2
       FROM predictions p
       JOIN matches m ON m.id = p.match_id
       WHERE m.score1 IS NOT NULL AND m.score2 IS NOT NULL`
    )
    .all() as {
    id: number;
    pick: string | null;
    score1: number | null;
    score2: number | null;
    actual1: number;
    actual2: number;
  }[];

  const updatePoints = database.prepare(
    "UPDATE predictions SET points = ? WHERE id = ?"
  );

  for (const row of finishedPredictions) {
    const pick = readPickFromRow(row);
    const points = calculatePickPoints(pick, row.actual1, row.actual2);
    updatePoints.run(points, row.id);
  }
}

function backfillSyncSchedule(database: Database.Database) {
  const rows = database
    .prepare("SELECT id, date, time, sync_after_utc FROM matches")
    .all() as { id: number; date: string; time: string; sync_after_utc: string | null }[];

  const update = database.prepare(
    "UPDATE matches SET sync_after_utc = ? WHERE id = ?"
  );

  for (const row of rows) {
    if (row.sync_after_utc) continue;
    update.run(getResultSyncAfter(row.date, row.time).toISOString(), row.id);
  }
}

function seedMatches(database: Database.Database) {
  const count = database.prepare("SELECT COUNT(*) as count FROM matches").get() as {
    count: number;
  };

  if (count.count > 0) return;

  const insert = database.prepare(`
    INSERT INTO matches (
      id, round, num, date, time, team1, team2, group_name, ground, sync_after_utc
    )
    VALUES (@id, @round, @num, @date, @time, @team1, @team2, @group, @ground, @syncAfterUtc)
  `);

  const seed = database.transaction(() => {
    tournamentData.matches.forEach((match, index) => {
      insert.run({
        id: index + 1,
        round: match.round,
        num: "num" in match ? match.num : null,
        date: match.date,
        time: match.time,
        team1: match.team1,
        team2: match.team2,
        group: "group" in match ? match.group : null,
        ground: match.ground,
        syncAfterUtc: getResultSyncAfter(match.date, match.time).toISOString(),
      });
    });
  });

  seed();
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    name: row.name as string,
    email: row.email as string,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at as string,
  };
}

function mapMatch(row: Record<string, unknown>): Match {
  const date = row.date as string;
  const time = row.time as string;
  const round = row.round as string;
  const num = row.num as number | null;
  const group = row.group_name as string | null;
  const score1 = row.score1 as number | null;
  const score2 = row.score2 as number | null;
  const hasResult = score1 !== null && score2 !== null;
  const knockout = isKnockoutMatch({ group, num, round });

  const picksOpenAt = getPicksOpenAt(date);
  const picksCloseAt = getPicksCloseAt(date);
  const pickWindowStatus = knockout
    ? hasResult
      ? "closed"
      : "open"
    : getPickWindowStatus(date);
  const picksOpen = knockout ? !hasResult : isPicksOpen(date);

  return {
    id: row.id as number,
    round,
    num,
    date,
    time,
    team1: row.team1 as string,
    team2: row.team2 as string,
    group,
    ground: row.ground as string,
    score1,
    score2,
    liveScore1: (row.live_score1 as number | null) ?? null,
    liveScore2: (row.live_score2 as number | null) ?? null,
    matchStatus: (row.match_status as string | null) ?? null,
    elapsed: (row.elapsed as number | null) ?? null,
    locked: knockout ? hasResult : isMatchLocked(date, time),
    picksOpen,
    pickWindowStatus,
    picksOpenAt: picksOpenAt.toISOString(),
    picksCloseAt: picksCloseAt.toISOString(),
    apiFixtureId: (row.api_fixture_id as number | null) ?? null,
    syncAfterUtc: (row.sync_after_utc as string | null) ?? null,
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    syncAttempts: (row.sync_attempts as number) ?? 0,
  };
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = getDb()
    .prepare(
      "SELECT id, name, email, password_hash, is_admin, created_at FROM users WHERE email = ?"
    )
    .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

  if (!row || !row.password_hash) return null;

  return {
    ...mapUser(row),
    passwordHash: row.password_hash as string,
  };
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  isAdmin = false
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = getDb()
    .prepare(
      "INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)"
    )
    .run(name.trim(), email.trim().toLowerCase(), passwordHash, isAdmin ? 1 : 0);

  return {
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    isAdmin,
    createdAt: new Date().toISOString(),
  };
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<User | null> {
  const user = findUserByEmail(email);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}

export function getUserById(id: number): User | null {
  const row = getDb()
    .prepare("SELECT id, name, email, is_admin, created_at FROM users WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  return row ? mapUser(row) : null;
}

export function invalidatePasswordResetTokens(userId: number): void {
  getDb()
    .prepare(
      "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"
    )
    .run(userId);
}

export function createPasswordResetTokenRecord(
  userId: number,
  tokenHash: string,
  expiresAt: string
): void {
  invalidatePasswordResetTokens(userId);
  getDb()
    .prepare(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
    )
    .run(userId, tokenHash, expiresAt);
}

export function findValidPasswordResetToken(tokenHash: string): {
  id: number;
  userId: number;
} | null {
  const row = getDb()
    .prepare(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > datetime('now')`
    )
    .get(tokenHash) as { id: number; user_id: number } | undefined;

  if (!row) return null;

  return { id: row.id, userId: row.user_id };
}

export function markPasswordResetTokenUsed(id: number): void {
  getDb()
    .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?")
    .run(id);
}

export async function updateUserPassword(
  userId: number,
  password: string
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, userId);
}

export function getAllMatches(): Match[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM matches
       ORDER BY date ASC,
         CASE
           WHEN time LIKE '%UTC-7%' THEN 1
           WHEN time LIKE '%UTC-6%' THEN 2
           WHEN time LIKE '%UTC-5%' THEN 3
           WHEN time LIKE '%UTC-4%' THEN 4
           ELSE 5
         END,
         id ASC`
    )
    .all() as Record<string, unknown>[];

  return rows.map(mapMatch);
}

export function getMatchById(id: number): Match | null {
  const row = getDb().prepare("SELECT * FROM matches WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;

  return row ? mapMatch(row) : null;
}

export function getMatchesWithoutResults(): Match[] {
  return getAllMatches().filter(
    (match) => match.score1 === null || match.score2 === null
  );
}

export function updateMatchLiveState(
  matchId: number,
  liveScore1: number,
  liveScore2: number,
  matchStatus: string,
  elapsed: number | null,
  apiFixtureId?: number
): void {
  const database = getDb();

  if (apiFixtureId != null) {
    database
      .prepare(
        `UPDATE matches
         SET live_score1 = ?, live_score2 = ?, match_status = ?, elapsed = ?,
             api_fixture_id = ?
         WHERE id = ? AND score1 IS NULL`
      )
      .run(liveScore1, liveScore2, matchStatus, elapsed, apiFixtureId, matchId);
    return;
  }

  database
    .prepare(
      `UPDATE matches
       SET live_score1 = ?, live_score2 = ?, match_status = ?, elapsed = ?
       WHERE id = ? AND score1 IS NULL`
    )
    .run(liveScore1, liveScore2, matchStatus, elapsed, matchId);
}

function toLiveMatch(match: Match): LiveMatch {
  const isLive = Boolean(
    match.matchStatus && LIVE_STATUSES.has(match.matchStatus)
  );
  const hasFinal = match.score1 !== null && match.score2 !== null;

  return {
    ...match,
    isLive,
    displayScore1: hasFinal
      ? match.score1
      : isLive
        ? match.liveScore1
        : null,
    displayScore2: hasFinal
      ? match.score2
      : isLive
        ? match.liveScore2
        : null,
  };
}

export function getLiveHubMatches(): LiveMatch[] {
  const today = new Date().toISOString().slice(0, 10);

  return getAllMatches()
    .filter((match) => {
      const isLive = Boolean(
        match.matchStatus && LIVE_STATUSES.has(match.matchStatus)
      );
      const hasFinalToday =
        match.score1 !== null &&
        match.score2 !== null &&
        match.date === today;
      const hasLiveScore =
        match.liveScore1 !== null && match.liveScore2 !== null;

      return isLive || hasFinalToday || hasLiveScore;
    })
    .map(toLiveMatch);
}

export function getMatchesDueForSync(now = new Date()): Match[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM matches
       WHERE score1 IS NULL
         AND sync_after_utc IS NOT NULL
         AND datetime(sync_after_utc) <= datetime(?)
       ORDER BY sync_after_utc ASC`
    )
    .all(now.toISOString()) as Record<string, unknown>[];

  return rows.map(mapMatch);
}

export function markMatchSyncAttempt(matchId: number) {
  getDb()
    .prepare(
      `UPDATE matches
       SET last_sync_at = datetime('now'), sync_attempts = sync_attempts + 1
       WHERE id = ?`
    )
    .run(matchId);
}

export function getPredictionsForUser(userId: number): Prediction[] {
  const rows = getDb()
    .prepare(
      "SELECT id, user_id, match_id, pick, score1, score2, points, updated_at FROM predictions WHERE user_id = ?"
    )
    .all(userId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as number,
    userId: row.user_id as number,
    matchId: row.match_id as number,
    pick: readPickFromRow({
      pick: row.pick as string | null,
      score1: row.score1 as number | null,
      score2: row.score2 as number | null,
    }),
    points: row.points as number | null,
    updatedAt: row.updated_at as string,
  }));
}

export function getGroupRankings(userId: number): GroupRankingRecord | null {
  const row = getDb()
    .prepare(
      "SELECT user_id, rankings_json, updated_at FROM group_rankings WHERE user_id = ?"
    )
    .get(userId) as
    | { user_id: number; rankings_json: string; updated_at: string }
    | undefined;

  if (!row) return null;

  return {
    userId: row.user_id,
    rankings: JSON.parse(row.rankings_json) as GroupRankings,
    updatedAt: row.updated_at,
  };
}

export function getBracketSubmission(userId: number): BracketSubmission | null {
  const row = getDb()
    .prepare(
      "SELECT user_id, submitted_at, pdf_path, email_sent_at FROM bracket_submissions WHERE user_id = ?"
    )
    .get(userId) as
    | {
        user_id: number;
        submitted_at: string;
        pdf_path: string;
        email_sent_at: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    userId: row.user_id,
    submittedAt: row.submitted_at,
    pdfPath: row.pdf_path,
    emailSentAt: row.email_sent_at,
  };
}

export function isBracketSubmitted(userId: number): boolean {
  return getBracketSubmission(userId) !== null;
}

function assertBracketEditable(userId: number) {
  if (isBracketSubmitted(userId)) {
    throw new Error("Your bracket is locked after submission.");
  }
}

export function createBracketSubmission(
  userId: number,
  pdfBuffer: Buffer
): BracketSubmission {
  if (isBracketSubmitted(userId)) {
    throw new Error("Your bracket has already been submitted.");
  }

  fs.mkdirSync(BRACKET_PDF_DIR, { recursive: true });
  const pdfPath = path.join(BRACKET_PDF_DIR, `${userId}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);

  getDb()
    .prepare(
      `INSERT INTO bracket_submissions (user_id, submitted_at, pdf_path)
       VALUES (?, datetime('now'), ?)`
    )
    .run(userId, pdfPath);

  return getBracketSubmission(userId)!;
}

export function markBracketSubmissionEmailSent(userId: number) {
  getDb()
    .prepare(
      `UPDATE bracket_submissions
       SET email_sent_at = datetime('now')
       WHERE user_id = ?`
    )
    .run(userId);
}

export function getBracketPicksForUser(userId: number): BracketPick[] {
  const rows = getDb()
    .prepare(
      "SELECT user_id, match_num, pick, updated_at FROM bracket_picks WHERE user_id = ? ORDER BY match_num ASC"
    )
    .all(userId) as {
    user_id: number;
    match_num: number;
    pick: string;
    updated_at: string;
  }[];

  return rows.map((row) => ({
    userId: row.user_id,
    matchNum: row.match_num,
    pick: row.pick as MatchPick,
    updatedAt: row.updated_at,
  }));
}

export function getBracketPicksByNum(userId: number): Map<number, MatchPick> {
  return new Map(
    getBracketPicksForUser(userId).map((pick) => [pick.matchNum, pick.pick])
  );
}

export function upsertBracketPick(
  userId: number,
  matchNum: number,
  pick: MatchPick
): BracketPick {
  assertBracketEditable(userId);

  if (!isValidBracketMatchNum(matchNum)) {
    throw new Error("Invalid bracket match.");
  }

  if (pick !== "team1" && pick !== "team2") {
    throw new Error("Bracket picks must choose a winning team.");
  }

  getDb()
    .prepare(
      `INSERT INTO bracket_picks (user_id, match_num, pick, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, match_num) DO UPDATE SET
         pick = excluded.pick,
         updated_at = datetime('now')`
    )
    .run(userId, matchNum, pick);

  const row = getDb()
    .prepare(
      "SELECT user_id, match_num, pick, updated_at FROM bracket_picks WHERE user_id = ? AND match_num = ?"
    )
    .get(userId, matchNum) as {
    user_id: number;
    match_num: number;
    pick: string;
    updated_at: string;
  };

  return {
    userId: row.user_id,
    matchNum: row.match_num,
    pick: row.pick as MatchPick,
    updatedAt: row.updated_at,
  };
}

export function upsertGroupRankings(
  userId: number,
  rankings: GroupRankings
): GroupRankingRecord {
  assertBracketEditable(userId);

  const database = getDb();
  const payload = JSON.stringify(rankings);

  database
    .prepare(
      `INSERT INTO group_rankings (user_id, rankings_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         rankings_json = excluded.rankings_json,
         updated_at = datetime('now')`
    )
    .run(userId, payload);

  const row = database
    .prepare(
      "SELECT user_id, rankings_json, updated_at FROM group_rankings WHERE user_id = ?"
    )
    .get(userId) as { user_id: number; rankings_json: string; updated_at: string };

  return {
    userId: row.user_id,
    rankings: JSON.parse(row.rankings_json) as GroupRankings,
    updatedAt: row.updated_at,
  };
}

export function upsertPrediction(
  userId: number,
  matchId: number,
  pick: MatchPick
): Prediction {
  const database = getDb();
  const match = getMatchById(matchId);
  if (!match) throw new Error("Match not found");
  if (match.score1 !== null && match.score2 !== null) {
    throw new Error("This match already has a result.");
  }
  if (!isKnockoutMatch(match)) {
    if (match.pickWindowStatus === "upcoming") {
      throw new Error(
        `Picks open on ${formatPickWindowDate(getPicksOpenAt(match.date))} (${getPicksOpenDaysBefore()} days before match day).`
      );
    }
    if (match.pickWindowStatus === "closed") {
      throw new Error("Picks are closed for this match (match day or later).");
    }
  }

  const [score1, score2] = scoresFromPick(pick);

  database
    .prepare(
      `INSERT INTO predictions (user_id, match_id, pick, score1, score2, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, match_id) DO UPDATE SET
         pick = excluded.pick,
         score1 = excluded.score1,
         score2 = excluded.score2,
         updated_at = datetime('now')`
    )
    .run(userId, matchId, pick, score1, score2);

  database
    .prepare(
      `INSERT INTO prediction_history (user_id, match_id, pick, score1, score2)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, matchId, pick, score1, score2);

  const row = database
    .prepare(
      "SELECT id, user_id, match_id, pick, score1, score2, points, updated_at FROM predictions WHERE user_id = ? AND match_id = ?"
    )
    .get(userId, matchId) as Record<string, unknown>;

  return {
    id: row.id as number,
    userId: row.user_id as number,
    matchId: row.match_id as number,
    pick: readPickFromRow({
      pick: row.pick as string | null,
      score1: row.score1 as number | null,
      score2: row.score2 as number | null,
    }),
    points: row.points as number | null,
    updatedAt: row.updated_at as string,
  };
}

export function setMatchResult(
  matchId: number,
  score1: number,
  score2: number,
  apiFixtureId?: number | null
): { match: Match; scoredPredictions: ScoredPrediction[] } {
  const database = getDb();

  if (apiFixtureId != null) {
    database
      .prepare(
        `UPDATE matches
         SET score1 = ?, score2 = ?, api_fixture_id = ?,
             live_score1 = NULL, live_score2 = NULL,
             match_status = 'FT', elapsed = NULL
         WHERE id = ?`
      )
      .run(score1, score2, apiFixtureId, matchId);
  } else {
    database
      .prepare(
        `UPDATE matches
         SET score1 = ?, score2 = ?,
             live_score1 = NULL, live_score2 = NULL,
             match_status = 'FT', elapsed = NULL
         WHERE id = ?`
      )
      .run(score1, score2, matchId);
  }

  const matchRow = database.prepare("SELECT * FROM matches WHERE id = ?").get(matchId) as
    | Record<string, unknown>
    | undefined;
  if (!matchRow) throw new Error("Match not found");

  const predictions = database
    .prepare(
      `SELECT p.id, p.user_id, p.pick, p.score1, p.score2, u.name, u.email
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       WHERE p.match_id = ?`
    )
    .all(matchId) as {
    id: number;
    user_id: number;
    pick: string | null;
    score1: number | null;
    score2: number | null;
    name: string;
    email: string;
  }[];

  const updatePoints = database.prepare(
    "UPDATE predictions SET points = ? WHERE id = ?"
  );

  const scoredPredictions: ScoredPrediction[] = [];

  for (const prediction of predictions) {
    const pick = readPickFromRow(prediction);
    const points = calculatePickPoints(pick, score1, score2);
    updatePoints.run(points, prediction.id);

    scoredPredictions.push({
      predictionId: prediction.id,
      userId: prediction.user_id,
      userName: prediction.name,
      userEmail: prediction.email,
      matchId,
      team1: matchRow.team1 as string,
      team2: matchRow.team2 as string,
      pick,
      actualScore1: score1,
      actualScore2: score2,
      points,
    });
  }

  const match = mapMatch(matchRow);
  return { match, scoredPredictions };
}

export function linkMatchToApiFixture(matchId: number, apiFixtureId: number) {
  getDb()
    .prepare("UPDATE matches SET api_fixture_id = ? WHERE id = ?")
    .run(apiFixtureId, matchId);
}

export function getLeaderboard(): LeaderboardEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT
         u.id as user_id,
         u.name,
         COALESCE(SUM(p.points), 0) as total_points,
         COALESCE(SUM(CASE WHEN p.points >= 1 THEN 1 ELSE 0 END), 0) as correct_picks,
         COUNT(p.id) as predictions_count
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       GROUP BY u.id
       ORDER BY total_points DESC, correct_picks DESC, u.name ASC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    userId: row.user_id as number,
    name: row.name as string,
    totalPoints: row.total_points as number,
    correctPicks: row.correct_picks as number,
    predictionsCount: row.predictions_count as number,
  }));
}

export function getAllUsers(): User[] {
  const rows = getDb()
    .prepare(
      "SELECT id, name, email, is_admin, created_at FROM users ORDER BY name ASC"
    )
    .all() as Record<string, unknown>[];

  return rows.map(mapUser);
}

export function getPredictionHistoryForAdmin(): PredictionHistoryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT
         h.id,
         h.user_id,
         u.name as user_name,
         u.email as user_email,
         h.match_id,
         m.team1,
         m.team2,
         m.date as match_date,
         h.pick,
         h.score1,
         h.score2,
         h.recorded_at
       FROM prediction_history h
       JOIN users u ON u.id = h.user_id
       JOIN matches m ON m.id = h.match_id
       ORDER BY h.recorded_at DESC, h.id DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as number,
    userId: row.user_id as number,
    userName: row.user_name as string,
    userEmail: row.user_email as string,
    matchId: row.match_id as number,
    matchLabel: `${row.team1 as string} vs ${row.team2 as string}`,
    matchDate: row.match_date as string,
    team1: row.team1 as string,
    team2: row.team2 as string,
    pick: readPickFromRow({
      pick: row.pick as string | null,
      score1: row.score1 as number | null,
      score2: row.score2 as number | null,
    }),
    recordedAt: row.recorded_at as string,
  }));
}

export function getAnonymizedActivity(): ActivityEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT
         u.name,
         p.match_id,
         m.team1,
         m.team2,
         m.date as match_date,
         m.round,
         m.group_name,
         p.updated_at
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       JOIN matches m ON m.id = p.match_id
       WHERE m.score1 IS NULL
       ORDER BY p.updated_at DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    maskedName: maskName(row.name as string),
    matchId: row.match_id as number,
    team1: row.team1 as string,
    team2: row.team2 as string,
    matchDate: row.match_date as string,
    round: row.round as string,
    group: (row.group_name as string | null) ?? null,
    predictedAt: row.updated_at as string,
  }));
}

export function wasNotificationSent(predictionId: number): boolean {
  const row = getDb()
    .prepare("SELECT prediction_id FROM prediction_notifications WHERE prediction_id = ?")
    .get(predictionId) as { prediction_id: number } | undefined;

  return Boolean(row);
}

export function markNotificationSent(predictionId: number, points: number) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO prediction_notifications (prediction_id, points)
       VALUES (?, ?)`
    )
    .run(predictionId, points);
}

export function getScoredPredictionsForMatch(matchId: number): ScoredPrediction[] {
  const match = getMatchById(matchId);
  if (!match || match.score1 === null || match.score2 === null) {
    return [];
  }

  const rows = getDb()
    .prepare(
      `SELECT p.id, p.user_id, p.pick, p.score1, p.score2, p.points, u.name, u.email
       FROM predictions p
       JOIN users u ON u.id = p.user_id
       WHERE p.match_id = ?`
    )
    .all(matchId) as {
    id: number;
    user_id: number;
    pick: string | null;
    score1: number | null;
    score2: number | null;
    points: number | null;
    name: string;
    email: string;
  }[];

  return rows
    .map((row) => {
      const pick = readPickFromRow(row);
      return {
        predictionId: row.id,
        userId: row.user_id,
        userName: row.name,
        userEmail: row.email,
        matchId,
        team1: match.team1,
        team2: match.team2,
        pick,
        actualScore1: match.score1 as number,
        actualScore2: match.score2 as number,
        points: row.points ?? 0,
      };
    })
    .filter((entry) => entry.points >= 1);
}

export function getMatchEmailStats(matchId: number): MatchEmailStats {
  const winners = getScoredPredictionsForMatch(matchId);
  const emailsSent = getDb()
    .prepare(
      `SELECT COUNT(*) as count
       FROM prediction_notifications pn
       JOIN predictions p ON p.id = pn.prediction_id
       WHERE p.match_id = ?`
    )
    .get(matchId) as { count: number };

  const sent = emailsSent.count;
  return {
    winnersCount: winners.length,
    emailsSent: sent,
    pendingEmails: Math.max(0, winners.length - sent),
  };
}

export async function notifyCorrectPredictions(
  scoredPredictions: ScoredPrediction[]
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] };

  if (!isEmailConfigured()) {
    return result;
  }

  for (const entry of scoredPredictions) {
    if (entry.points < 1) {
      result.skipped += 1;
      continue;
    }

    if (wasNotificationSent(entry.predictionId)) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendCorrectPredictionEmail({
        to: entry.userEmail,
        name: entry.userName,
        team1: entry.team1,
        team2: entry.team2,
        predictedPick: formatPick(entry.pick, entry.team1, entry.team2),
        actualScore: `${entry.actualScore1}-${entry.actualScore2}`,
        points: entry.points,
      });
      markNotificationSent(entry.predictionId, entry.points);
      result.sent += 1;
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? `${entry.userEmail}: ${error.message}`
          : `Failed to email ${entry.userEmail}.`
      );
    }
  }

  return result;
}

export async function notifyCorrectPredictionsForMatch(
  matchId: number
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  return notifyCorrectPredictions(getScoredPredictionsForMatch(matchId));
}

export function wasPickWindowNotificationSent(matchId: number): boolean {
  const row = getDb()
    .prepare(
      "SELECT match_id FROM pick_window_notifications WHERE match_id = ?"
    )
    .get(matchId) as { match_id: number } | undefined;

  return Boolean(row);
}

export function markPickWindowNotificationSent(matchId: number): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO pick_window_notifications (match_id)
       VALUES (?)`
    )
    .run(matchId);
}

export function getMatchesNeedingPickOpenNotification(): Match[] {
  return getAllMatches().filter((match) => {
    if (match.score1 !== null) return false;
    if (!match.picksOpen) return false;
    return !wasPickWindowNotificationSent(match.id);
  });
}

function getAppBaseUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function notifyPickWindowOpened(
  match: Match
): Promise<{ sent: number; errors: string[] }> {
  const result = { sent: 0, errors: [] as string[] };

  if (!isEmailConfigured()) {
    return result;
  }

  if (wasPickWindowNotificationSent(match.id)) {
    return result;
  }

  const users = getAllUsers();
  const picksUrl = `${getAppBaseUrl()}/matches`;
  const closesOn = formatPickWindowDate(getPicksCloseAt(match.date));

  for (const user of users) {
    try {
      await sendPicksOpenEmail({
        to: user.email,
        name: user.name,
        team1: match.team1,
        team2: match.team2,
        matchDate: match.date,
        ground: match.ground,
        round: match.group || match.round,
        closesOn,
        picksUrl,
      });
      result.sent += 1;
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? `${user.email}: ${error.message}`
          : `Failed to email ${user.email}.`
      );
    }
  }

  if (
    users.length === 0 ||
    (result.sent === users.length && result.errors.length === 0)
  ) {
    markPickWindowNotificationSent(match.id);
  }

  return result;
}

export async function runPickWindowNotifications(): Promise<{
  matches: number;
  emailsSent: number;
  errors: string[];
}> {
  const matches = getMatchesNeedingPickOpenNotification();
  const summary = { matches: 0, emailsSent: 0, errors: [] as string[] };

  for (const match of matches) {
    const result = await notifyPickWindowOpened(match);
    if (result.sent > 0) {
      summary.matches += 1;
      summary.emailsSent += result.sent;
    }
    summary.errors.push(...result.errors);
  }

  return summary;
}
