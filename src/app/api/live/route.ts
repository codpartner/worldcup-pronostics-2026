import { NextResponse } from "next/server";
import { isApiFootballConfigured } from "@/lib/api-football";
import { getSession } from "@/lib/auth";
import { getLiveHubMatches } from "@/lib/db";
import { runLiveScoreSync } from "@/lib/match-sync";
import { getTeamHero } from "@/lib/team-heroes";

export const runtime = "nodejs";

const SYNC_COOLDOWN_MS = 30_000;
let lastSyncAt = 0;
let syncInFlight: Promise<void> | null = null;

async function maybeSyncLiveScores() {
  if (!isApiFootballConfigured()) return;

  const now = Date.now();
  if (now - lastSyncAt < SYNC_COOLDOWN_MS) return;

  if (syncInFlight) {
    await syncInFlight;
    return;
  }

  syncInFlight = (async () => {
    try {
      await runLiveScoreSync();
      lastSyncAt = Date.now();
    } finally {
      syncInFlight = null;
    }
  })();

  await syncInFlight;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await maybeSyncLiveScores();

  const matches = getLiveHubMatches().map((match) => ({
    ...match,
    heroes: {
      team1: getTeamHero(match.team1),
      team2: getTeamHero(match.team2),
    },
  }));

  return NextResponse.json({
    matches,
    syncedAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
    apiConfigured: isApiFootballConfigured(),
  });
}
