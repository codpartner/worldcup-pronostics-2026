import {
  fetchFixtureEvents,
  fetchFixtureLineups,
  isApiFootballConfigured,
  LIVE_STATUSES,
  syncLiveScoresFromApiFootball,
} from "./api-football";
import {
  getMatchById,
  getMatchDetails,
  getMatchesDueForSync,
  getMatchesWithoutResults,
  linkMatchToApiFixture,
  markMatchSyncAttempt,
  notifyCorrectPredictionsForMatch,
  saveMatchEvents,
  saveMatchLineups,
  setMatchResult,
  updateMatchLiveState,
} from "./db";
import { getResultSyncUntil } from "./scoring";
import type { Match, MatchDetails } from "./types";

const MIN_RETRY_MINUTES = 5;

function shouldRetrySync(match: Match, now: Date): boolean {
  if (match.score1 !== null) return false;

  const syncUntil = getResultSyncUntil(match.date, match.time);
  if (now > syncUntil) return false;

  if (!match.lastSyncAt) return true;

  const lastSync = new Date(match.lastSyncAt);
  const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / 60000;
  return minutesSinceLastSync >= MIN_RETRY_MINUTES;
}

interface SyncRunResult {
  checked: number;
  updated: number;
  skipped: number;
  emailsSent: number;
  errors: string[];
}

/** Email winners for matches that were just finalized in this sync run. */
async function notifyFinishedMatches(
  matchIds: Iterable<number>,
  result: SyncRunResult
) {
  for (const matchId of new Set(matchIds)) {
    try {
      const emailResult = await notifyCorrectPredictionsForMatch(matchId);
      result.emailsSent += emailResult.sent;
      result.errors.push(...emailResult.errors);
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? `Winner email for match ${matchId}: ${error.message}`
          : `Winner email failed for match ${matchId}.`
      );
    }
  }
}

export async function runLiveScoreSync(): Promise<SyncRunResult> {
  const pending = getMatchesWithoutResults();
  const result: SyncRunResult = {
    checked: pending.length,
    updated: 0,
    skipped: 0,
    emailsSent: 0,
    errors: [],
  };

  if (pending.length === 0) return result;

  const finishedMatchIds: number[] = [];

  try {
    const syncResult = await syncLiveScoresFromApiFootball(
      pending,
      (matchId, update) => {
        updateMatchLiveState(
          matchId,
          update.homeGoals,
          update.awayGoals,
          update.status,
          update.elapsed,
          update.apiFixtureId
        );
      },
      (matchId, score1, score2, apiFixtureId) => {
        setMatchResult(matchId, score1, score2, apiFixtureId);
        finishedMatchIds.push(matchId);
      },
      linkMatchToApiFixture
    );

    result.updated = syncResult.updated;
    result.skipped = syncResult.skipped;
    result.errors.push(...syncResult.errors);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Live sync failed."
    );
  }

  await notifyFinishedMatches(finishedMatchIds, result);

  return result;
}

export async function runScheduledResultSync(
  now = new Date()
): Promise<SyncRunResult> {
  const dueMatches = getMatchesDueForSync(now).filter((match) =>
    shouldRetrySync(match, now)
  );

  const result: SyncRunResult = {
    checked: dueMatches.length,
    updated: 0,
    skipped: 0,
    emailsSent: 0,
    errors: [],
  };

  if (dueMatches.length === 0) return result;

  for (const match of dueMatches) {
    markMatchSyncAttempt(match.id);
  }

  const finishedMatchIds: number[] = [];

  try {
    const syncResult = await syncLiveScoresFromApiFootball(
      dueMatches,
      (matchId, update) => {
        updateMatchLiveState(
          matchId,
          update.homeGoals,
          update.awayGoals,
          update.status,
          update.elapsed,
          update.apiFixtureId
        );
      },
      (matchId, score1, score2, apiFixtureId) => {
        setMatchResult(matchId, score1, score2, apiFixtureId);
        result.updated += 1;
        finishedMatchIds.push(matchId);
      },
      linkMatchToApiFixture
    );

    result.skipped += syncResult.skipped;
    result.errors.push(...syncResult.errors);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Scheduled sync failed."
    );
  }

  await notifyFinishedMatches(finishedMatchIds, result);

  return result;
}

/** How long live events stay fresh before another API call is allowed. */
const EVENTS_MIN_REFRESH_MS = 60_000;
/** If a lineup fetch returned empty (no coverage yet), wait before retrying. */
const LINEUPS_EMPTY_RETRY_MS = 10 * 60_000;

/** datetime('now') stores UTC as "YYYY-MM-DD HH:MM:SS"; parse it back. */
function ageMs(isoLike: string | null): number {
  if (!isoLike) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${isoLike.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Date.now() - parsed;
}

/**
 * Fetch and cache match events + lineups from API-Football, mindful of the
 * free-tier quota (100 requests/day):
 *  - Lineups are static once published, so they are fetched at most once
 *    (retried only if a previous fetch came back empty).
 *  - Events are refreshed while the match is live, throttled by a cooldown,
 *    and fetched once when a match has finished.
 */
export async function syncMatchDetails(
  matchId: number,
  options: { force?: boolean } = {}
): Promise<MatchDetails> {
  const match = getMatchById(matchId);
  if (!match || !match.apiFixtureId || !isApiFootballConfigured()) {
    return getMatchDetails(matchId);
  }

  const cached = getMatchDetails(matchId);
  const force = Boolean(options.force);
  const isLive = Boolean(
    match.matchStatus && LIVE_STATUSES.has(match.matchStatus)
  );
  const finished = match.score1 !== null && match.score2 !== null;

  const hasLineups = cached.lineups.length > 0;
  const shouldFetchLineups =
    !hasLineups &&
    (force ||
      cached.lineupsFetchedAt === null ||
      ageMs(cached.lineupsFetchedAt) > LINEUPS_EMPTY_RETRY_MS);

  let sideByTeamId: Map<number, 1 | 2> | undefined;

  if (shouldFetchLineups) {
    try {
      const result = await fetchFixtureLineups(
        match.apiFixtureId,
        match.team1,
        match.team2
      );
      sideByTeamId = result.sideByTeamId;
      saveMatchLineups(matchId, match.apiFixtureId, result.lineups);
    } catch {
      // Keep whatever is cached; transient API errors shouldn't break the page.
    }
  }

  const hasEvents = cached.events.length > 0;
  const eventsFresh = ageMs(cached.eventsFetchedAt) <= EVENTS_MIN_REFRESH_MS;
  const shouldFetchEvents =
    (force || isLive || (finished && !hasEvents)) && (force || !eventsFresh);

  if (shouldFetchEvents) {
    try {
      const result = await fetchFixtureEvents(
        match.apiFixtureId,
        match.team1,
        match.team2,
        sideByTeamId
      );
      saveMatchEvents(matchId, match.apiFixtureId, result.events);
    } catch {
      // Ignore; serve cached events.
    }
  }

  return getMatchDetails(matchId);
}

export async function runManualResultSync(): Promise<SyncRunResult> {
  const pending = getMatchesWithoutResults();
  const result: SyncRunResult = {
    checked: pending.length,
    updated: 0,
    skipped: 0,
    emailsSent: 0,
    errors: [],
  };

  if (pending.length === 0) return result;

  const finishedMatchIds: number[] = [];

  const syncResult = await syncLiveScoresFromApiFootball(
    pending,
    (matchId, update) => {
      updateMatchLiveState(
        matchId,
        update.homeGoals,
        update.awayGoals,
        update.status,
        update.elapsed,
        update.apiFixtureId
      );
      result.updated += 1;
    },
    (matchId, score1, score2, apiFixtureId) => {
      setMatchResult(matchId, score1, score2, apiFixtureId);
      result.updated += 1;
      finishedMatchIds.push(matchId);
    },
    linkMatchToApiFixture
  );

  result.skipped = syncResult.skipped;
  result.errors.push(...syncResult.errors);

  await notifyFinishedMatches(finishedMatchIds, result);

  return result;
}
