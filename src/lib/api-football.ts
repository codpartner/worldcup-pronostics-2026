const API_BASE = "https://v3.football.api-sports.io";

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

async function fetchFixtures(
  apiKey: string,
  params: Record<string, string>
): Promise<ApiFixture[]> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${API_BASE}/fixtures?${query.toString()}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed (${response.status}).`);
  }

  const payload = await response.json();
  return (payload.response || []) as ApiFixture[];
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

function mapFixtureToUpdate(
  fixture: ApiFixture,
  localTeam1: string
): LiveFixtureUpdate | null {
  const homeIsTeam1 = teamsMatch(localTeam1, fixture.teams.home.name);
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

export async function syncLiveScoresFromApiFootball(
  localMatches: {
    id: number;
    date: string;
    team1: string;
    team2: string;
    score1: number | null;
    apiFixtureId: number | null;
  }[],
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
      result.skipped += 1;
      continue;
    }

    linkFixture(localMatch.id, fixture.fixture.id);

    const update = mapFixtureToUpdate(fixture, localMatch.team1);
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

export async function syncResultsFromApiFootball(
  localMatches: {
    id: number;
    date: string;
    team1: string;
    team2: string;
    score1: number | null;
    score2: number | null;
    apiFixtureId: number | null;
  }[],
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

  const dates = [...new Set(pending.map((match) => match.date))];

  for (const date of dates) {
    let fixtures: ApiFixture[] = [];

    try {
      fixtures = await fetchFixtures(apiKey, {
        league: "1",
        season: "2026",
        date,
      });
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : `Failed to fetch ${date}.`
      );
      continue;
    }

    const dayMatches = pending.filter((match) => match.date === date);

    for (const localMatch of dayMatches) {
      const fixture = findFixtureForMatch(
        fixtures,
        localMatch.team1,
        localMatch.team2
      );

      if (!fixture) {
        result.skipped += 1;
        continue;
      }

      linkFixture(localMatch.id, fixture.fixture.id);

      if (!FINISHED_STATUSES.has(fixture.fixture.status.short)) {
        result.skipped += 1;
        continue;
      }

      if (fixture.goals.home === null || fixture.goals.away === null) {
        result.skipped += 1;
        continue;
      }

      const update = mapFixtureToUpdate(fixture, localMatch.team1);
      if (!update) {
        result.skipped += 1;
        continue;
      }

      applyResult(
        localMatch.id,
        update.homeGoals,
        update.awayGoals,
        update.apiFixtureId
      );
      result.updated += 1;
    }
  }

  return result;
}

export function isApiFootballConfigured(): boolean {
  return Boolean(getApiKey());
}
