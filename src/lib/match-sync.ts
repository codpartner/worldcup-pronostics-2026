import {
  syncLiveScoresFromApiFootball,
  syncResultsFromApiFootball,
} from "./api-football";
import {
  getMatchesDueForSync,
  getMatchesWithoutResults,
  linkMatchToApiFixture,
  markMatchSyncAttempt,
  setMatchResult,
  updateMatchLiveState,
} from "./db";
import { getResultSyncUntil } from "./scoring";
import type { Match } from "./types";

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

export async function runLiveScoreSync() {
  const pending = getMatchesWithoutResults();
  const result = {
    checked: pending.length,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  if (pending.length === 0) return result;

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

  return result;
}

export async function runScheduledResultSync(now = new Date()) {
  const dueMatches = getMatchesDueForSync(now).filter((match) =>
    shouldRetrySync(match, now)
  );

  if (dueMatches.length === 0) {
    return {
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };
  }

  const result = {
    checked: dueMatches.length,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const match of dueMatches) {
    markMatchSyncAttempt(match.id);
  }

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

  return result;
}

export async function runManualResultSync() {
  const pending = getMatchesWithoutResults();
  const result = {
    checked: pending.length,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  if (pending.length === 0) return result;

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
    },
    linkMatchToApiFixture
  );

  result.skipped = syncResult.skipped;
  result.errors.push(...syncResult.errors);

  return result;
}
