import { parseKickoff } from "./scoring";
import type {
  LineupPlayer,
  MatchEvent,
  MatchEventType,
  TeamLineup,
} from "./types";

const API_BASE = "https://v3.football.api-sports.io";

/** Max gap between a local kickoff and an API fixture kickoff for the
 * time-based knockout fallback to consider them the same match. */
const KICKOFF_MATCH_TOLERANCE_MS = 75 * 60 * 1000;
/** Minimum gap to the next-closest fixture; below this the match is
 * considered ambiguous and skipped (admin enters it manually). */
const KICKOFF_AMBIGUITY_MS = 30 * 60 * 1000;

const TEAM_ALIASES: Record<string, string[]> = {
  usa: ["usa", "united states", "united states of america"],
  "ivory coast": ["ivory coast", "cote d'ivoire", "côte d'ivoire"],
  "south korea": ["south korea", "korea republic", "republic of korea"],
  "bosnia & herzegovina": [
    "bosnia & herzegovina",
    "bosnia and herzegovina",
    "bosnia-herzegovina",
  ],
  "dr congo": ["dr congo", "congo dr", "democratic republic of the congo"],
  "czech republic": ["czech republic", "czechia"],
  "cape verde": ["cape verde", "cabo verde"],
  curacao: ["curacao", "curaçao"],
  "new zealand": ["new zealand"],
};

export const LIVE_STATUSES = new Set([
  "1H",
  "2H",
  "HT",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
]);

export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface LiveFixtureUpdate {
  apiFixtureId: number;
  homeGoals: number;
  awayGoals: number;
  status: string;
  elapsed: number | null;
  homeTeam: string;
  awayTeam: string;
}

interface SyncResult {
  updated: number;
  skipped: number;
  errors: string[];
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(localName: string, apiName: string): boolean {
  const local = normalizeTeamName(localName);
  const remote = normalizeTeamName(apiName);

  if (local === remote) return true;
  if (local.includes(remote) || remote.includes(local)) return true;

  for (const aliases of Object.values(TEAM_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeTeamName);
    if (
      normalizedAliases.includes(local) &&
      normalizedAliases.includes(remote)
    ) {
      return true;
    }
  }

  return false;
}

function getApiKey(): string | null {
  return process.env.API_FOOTBALL_KEY?.trim() || null;
}

interface ApiCallResult<T> {
  response: T[];
  /** Remaining daily quota reported by `x-ratelimit-requests-remaining`. */
  remaining: number | null;
}

async function fetchApi<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string>
): Promise<ApiCallResult<T>> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API_BASE}${endpoint}?${query.toString()}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed (${response.status}).`);
  }

  const remainingHeader = response.headers.get(
    "x-ratelimit-requests-remaining"
  );
  const remaining = remainingHeader ? Number(remainingHeader) : null;

  const payload = await response.json();
  return { response: (payload.response || []) as T[], remaining };
}

async function fetchFixtures(
  apiKey: string,
  params: Record<string, string>
): Promise<ApiFixture[]> {
  const { response } = await fetchApi<ApiFixture>(apiKey, "/fixtures", params);
  return response;
}

function findFixtureForMatch(
  fixtures: ApiFixture[],
  team1: string,
  team2: string
): ApiFixture | undefined {
  return (
    fixtures.find(
      (entry) =>
        teamsMatch(team1, entry.teams.home.name) &&
        teamsMatch(team2, entry.teams.away.name)
    ) ||
    fixtures.find(
      (entry) =>
        teamsMatch(team1, entry.teams.away.name) &&
        teamsMatch(team2, entry.teams.home.name)
    )
  );
}

/** Knockout slots are stored as placeholders (e.g. "2A", "W74", "L101",
 * "3A/B/C/D/F") until the real teams are known. Team-name matching can never
 * resolve these, so we fall back to kickoff-time matching for them. */
function looksLikePlaceholder(name: string): boolean {
  const trimmed = name.trim();
  return (
    /^[1-3][A-L](\/[A-L])*$/i.test(trimmed) ||
    /^W\d+$/i.test(trimmed) ||
    /^L\d+$/i.test(trimmed)
  );
}

function isKnockoutPlaceholderMatch(team1: string, team2: string): boolean {
  return looksLikePlaceholder(team1) || looksLikePlaceholder(team2);
}

/** Find the single fixture whose kickoff is closest to the local kickoff,
 * within tolerance and unambiguously closer than any other candidate. */
function findFixtureByKickoff(
  fixtures: ApiFixture[],
  localKickoffMs: number,
  usedFixtureIds: Set<number>
): ApiFixture | undefined {
  const candidates = fixtures
    .filter((entry) => !usedFixtureIds.has(entry.fixture.id))
    .map((entry) => ({
      entry,
      diff: Math.abs(new Date(entry.fixture.date).getTime() - localKickoffMs),
    }))
    .filter((candidate) => candidate.diff <= KICKOFF_MATCH_TOLERANCE_MS)
    .sort((a, b) => a.diff - b.diff);

  if (candidates.length === 0) return undefined;
  if (
    candidates.length > 1 &&
    candidates[1].diff - candidates[0].diff < KICKOFF_AMBIGUITY_MS
  ) {
    return undefined;
  }

  return candidates[0].entry;
}

function mapFixtureToUpdate(
  fixture: ApiFixture,
  homeIsTeam1: boolean
): LiveFixtureUpdate | null {
  const homeGoals = fixture.goals.home;
  const awayGoals = fixture.goals.away;

  if (homeGoals === null || awayGoals === null) {
    return null;
  }

  return {
    apiFixtureId: fixture.fixture.id,
    homeGoals: homeIsTeam1 ? homeGoals : awayGoals,
    awayGoals: homeIsTeam1 ? awayGoals : homeGoals,
    status: fixture.fixture.status.short,
    elapsed: fixture.fixture.status.elapsed,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
  };
}

export async function fetchLiveFixtures(): Promise<ApiFixture[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  return fetchFixtures(apiKey, {
    league: "1",
    season: "2026",
    live: "all",
  });
}

interface SyncLocalMatch {
  id: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score1: number | null;
  apiFixtureId: number | null;
}

export async function syncLiveScoresFromApiFootball(
  localMatches: SyncLocalMatch[],
  applyLive: (matchId: number, update: LiveFixtureUpdate) => void,
  applyResult: (
    matchId: number,
    score1: number,
    score2: number,
    apiFixtureId: number
  ) => void,
  linkFixture: (matchId: number, apiFixtureId: number) => void
): Promise<SyncResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "API_FOOTBALL_KEY is not configured. Get a free key at api-football.com."
    );
  }

  const result: SyncResult = { updated: 0, skipped: 0, errors: [] };
  const pending = localMatches.filter((match) => match.score1 === null);

  if (pending.length === 0) {
    return result;
  }

  let liveFixtures: ApiFixture[] = [];
  try {
    liveFixtures = await fetchLiveFixtures();
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Failed to fetch live fixtures."
    );
  }

  const dates = [...new Set(pending.map((match) => match.date))];
  const fixturesByDate = new Map<string, ApiFixture[]>();

  for (const date of dates) {
    try {
      fixturesByDate.set(
        date,
        await fetchFixtures(apiKey, {
          league: "1",
          season: "2026",
          date,
        })
      );
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : `Failed to fetch ${date}.`
      );
    }
  }

  const usedFixtureIds = new Set<number>();
  const resolved = new Map<
    number,
    { fixture: ApiFixture; homeIsTeam1: boolean }
  >();
  const unresolved: SyncLocalMatch[] = [];

  // Pass 1: match by linked fixture id, then by team names.
  for (const localMatch of pending) {
    const dayFixtures = fixturesByDate.get(localMatch.date) ?? [];
    const fixture =
      (localMatch.apiFixtureId
        ? liveFixtures.find(
            (entry) => entry.fixture.id === localMatch.apiFixtureId
          ) ||
          dayFixtures.find(
            (entry) => entry.fixture.id === localMatch.apiFixtureId
          )
        : undefined) ||
      findFixtureForMatch(liveFixtures, localMatch.team1, localMatch.team2) ||
      findFixtureForMatch(dayFixtures, localMatch.team1, localMatch.team2);

    if (!fixture) {
      unresolved.push(localMatch);
      continue;
    }

    usedFixtureIds.add(fixture.fixture.id);
    resolved.set(localMatch.id, {
      fixture,
      homeIsTeam1: teamsMatch(localMatch.team1, fixture.teams.home.name),
    });
  }

  // Pass 2: knockout placeholders can't be name-matched, so fall back to
  // kickoff-time matching against that day's fixtures.
  for (const localMatch of unresolved) {
    if (!isKnockoutPlaceholderMatch(localMatch.team1, localMatch.team2)) {
      result.skipped += 1;
      continue;
    }

    const dayFixtures = fixturesByDate.get(localMatch.date) ?? [];
    const kickoffMs = parseKickoff(localMatch.date, localMatch.time).getTime();
    const fixture = findFixtureByKickoff(dayFixtures, kickoffMs, usedFixtureIds);

    if (!fixture) {
      result.skipped += 1;
      continue;
    }

    usedFixtureIds.add(fixture.fixture.id);
    // The official schedule lists the home team first, matching the API's
    // home/away orientation, so team1 maps to the fixture's home side.
    resolved.set(localMatch.id, { fixture, homeIsTeam1: true });
  }

  for (const localMatch of pending) {
    const match = resolved.get(localMatch.id);
    if (!match) continue;

    linkFixture(localMatch.id, match.fixture.fixture.id);

    const update = mapFixtureToUpdate(match.fixture, match.homeIsTeam1);
    if (!update) {
      result.skipped += 1;
      continue;
    }

    if (FINISHED_STATUSES.has(update.status)) {
      applyResult(
        localMatch.id,
        update.homeGoals,
        update.awayGoals,
        update.apiFixtureId
      );
      result.updated += 1;
      continue;
    }

    if (LIVE_STATUSES.has(update.status)) {
      applyLive(localMatch.id, update);
      result.updated += 1;
      continue;
    }

    result.skipped += 1;
  }

  return result;
}

function sideForTeamName(
  apiName: string,
  team1: string,
  team2: string
): 1 | 2 | null {
  if (teamsMatch(team1, apiName)) return 1;
  if (teamsMatch(team2, apiName)) return 2;
  return null;
}

interface RawLineupPlayer {
  player: {
    id: number | null;
    name: string | null;
    number: number | null;
    pos: string | null;
    grid: string | null;
  };
}

interface RawLineup {
  team: { id: number; name: string };
  formation: string | null;
  coach: { id: number | null; name: string | null } | null;
  startXI: RawLineupPlayer[];
  substitutes: RawLineupPlayer[];
}

interface RawEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

function mapLineupPlayer(entry: RawLineupPlayer): LineupPlayer {
  return {
    id: entry.player.id ?? null,
    name: entry.player.name ?? "—",
    number: entry.player.number ?? null,
    pos: entry.player.pos ?? null,
    grid: entry.player.grid ?? null,
  };
}

interface FixtureDetailFetch {
  remaining: number | null;
}

export interface FixtureLineupsFetch extends FixtureDetailFetch {
  lineups: TeamLineup[];
  /** Maps API team id to local side, derived from the lineup order. */
  sideByTeamId: Map<number, 1 | 2>;
}

export async function fetchFixtureLineups(
  fixtureId: number,
  team1: string,
  team2: string
): Promise<FixtureLineupsFetch> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY is not configured.");
  }

  const { response, remaining } = await fetchApi<RawLineup>(
    apiKey,
    "/fixtures/lineups",
    { fixture: String(fixtureId) }
  );

  const sideByTeamId = new Map<number, 1 | 2>();
  const lineups: TeamLineup[] = response.map((raw, index) => {
    const matched = sideForTeamName(raw.team.name, team1, team2);
    // The API lists the home team first; use that as the fallback when team
    // names can't be matched (e.g. transliteration differences).
    const side: 1 | 2 = matched ?? (index === 0 ? 1 : 2);
    sideByTeamId.set(raw.team.id, side);

    return {
      side,
      teamName: raw.team.name,
      formation: raw.formation ?? null,
      coach: raw.coach?.name ?? null,
      startXI: (raw.startXI || []).map(mapLineupPlayer),
      substitutes: (raw.substitutes || []).map(mapLineupPlayer),
    };
  });

  lineups.sort((a, b) => a.side - b.side);
  return { lineups, sideByTeamId, remaining };
}

function mapEventType(rawType: string): MatchEventType {
  const type = rawType.toLowerCase();
  if (type === "goal") return "goal";
  if (type === "card") return "card";
  if (type === "subst") return "subst";
  if (type === "var") return "var";
  return "other";
}

export interface FixtureEventsFetch extends FixtureDetailFetch {
  events: MatchEvent[];
}

export async function fetchFixtureEvents(
  fixtureId: number,
  team1: string,
  team2: string,
  sideByTeamId?: Map<number, 1 | 2>
): Promise<FixtureEventsFetch> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY is not configured.");
  }

  const { response, remaining } = await fetchApi<RawEvent>(
    apiKey,
    "/fixtures/events",
    { fixture: String(fixtureId) }
  );

  const events: MatchEvent[] = response.map((raw) => {
    const side: 1 | 2 =
      sideByTeamId?.get(raw.team.id) ??
      sideForTeamName(raw.team.name, team1, team2) ??
      1;

    return {
      side,
      teamName: raw.team.name,
      elapsed: raw.time.elapsed ?? 0,
      extra: raw.time.extra ?? null,
      type: mapEventType(raw.type),
      detail: raw.detail,
      player: raw.player?.name ?? null,
      assist: raw.assist?.name ?? null,
    };
  });

  events.sort((a, b) => {
    const aTime = a.elapsed + (a.extra ?? 0);
    const bTime = b.elapsed + (b.extra ?? 0);
    return aTime - bTime;
  });

  return { events, remaining };
}

export function isApiFootballConfigured(): boolean {
  return Boolean(getApiKey());
}
