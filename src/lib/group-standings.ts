import type { MatchPick } from "@/lib/picks";
import { getTeamsByGroup } from "@/lib/teams";

export const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

export type GroupLetter = (typeof GROUP_LETTERS)[number];
export type GroupRankings = Partial<Record<GroupLetter, string[]>>;

export interface GroupStanding {
  group: string;
  first: string;
  second: string;
  third: string;
  fourth: string;
  thirdStats: TeamStandingStats;
}

export interface TeamStandingStats {
  name: string;
  points: number;
  gd: number;
  gf: number;
}

interface GroupMatchInput {
  team1: string;
  team2: string;
  group: string | null;
  score1: number | null;
  score2: number | null;
  prediction: { pick: MatchPick } | null;
}

interface MutableTeamStats {
  name: string;
  played: number;
  points: number;
  gf: number;
  ga: number;
}

function groupLetter(group: string | null): string | null {
  if (!group) return null;
  const match = group.match(/Group\s+([A-L])/i);
  return match ? match[1].toUpperCase() : null;
}

function simulateScore(pick: MatchPick): [number, number] {
  if (pick === "team1") return [1, 0];
  if (pick === "team2") return [0, 1];
  return [1, 1];
}

function compareTeams(a: MutableTeamStats, b: MutableTeamStats): number {
  const gdA = a.gf - a.ga;
  const gdB = b.gf - b.ga;
  if (b.points !== a.points) return b.points - a.points;
  if (gdB !== gdA) return gdB - gdA;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}

function defaultStanding(group: string): GroupStanding {
  const teams = getTeamsByGroup(group);
  const names = teams.map((t) => t.name);
  const pad = (index: number) => names[index] ?? names[names.length - 1];

  return {
    group,
    first: pad(0),
    second: pad(1),
    third: pad(2),
    fourth: pad(3),
    thirdStats: {
      name: pad(2),
      points: 0,
      gd: 0,
      gf: 0,
    },
  };
}

function buildStanding(group: string, stats: MutableTeamStats[]): GroupStanding {
  const sorted = [...stats].sort(compareTeams);
  const third = sorted[2];

  return {
    group,
    first: sorted[0].name,
    second: sorted[1].name,
    third: sorted[2].name,
    fourth: sorted[3].name,
    thirdStats: {
      name: third.name,
      points: third.points,
      gd: third.gf - third.ga,
      gf: third.gf,
    },
  };
}

export function computeGroupStandings(
  matches: GroupMatchInput[]
): Map<string, GroupStanding> {
  const standings = new Map<string, GroupStanding>();
  const statsByGroup = new Map<string, Map<string, MutableTeamStats>>();

  for (const letter of "ABCDEFGHIJKL") {
    const teams = getTeamsByGroup(letter);
    const groupStats = new Map<string, MutableTeamStats>();
    for (const team of teams) {
      groupStats.set(team.name, {
        name: team.name,
        played: 0,
        points: 0,
        gf: 0,
        ga: 0,
      });
    }
    statsByGroup.set(letter, groupStats);
  }

  for (const match of matches) {
    const letter = groupLetter(match.group);
    if (!letter) continue;

    const groupStats = statsByGroup.get(letter);
    if (!groupStats) continue;

    let score1: number | null = match.score1;
    let score2: number | null = match.score2;

    if (score1 === null || score2 === null) {
      const pick = match.prediction?.pick;
      if (!pick) continue;
      [score1, score2] = simulateScore(pick);
    }

    const team1 = groupStats.get(match.team1);
    const team2 = groupStats.get(match.team2);
    if (!team1 || !team2) continue;

    team1.played += 1;
    team2.played += 1;
    team1.gf += score1;
    team1.ga += score2;
    team2.gf += score2;
    team2.ga += score1;

    if (score1 > score2) {
      team1.points += 3;
    } else if (score2 > score1) {
      team2.points += 3;
    } else {
      team1.points += 1;
      team2.points += 1;
    }
  }

  for (const letter of "ABCDEFGHIJKL") {
    const groupStats = statsByGroup.get(letter);
    if (!groupStats) {
      standings.set(letter, defaultStanding(letter));
      continue;
    }

    const stats = [...groupStats.values()];
    const hasResults = stats.some((team) => team.played > 0);
    standings.set(
      letter,
      hasResults ? buildStanding(letter, stats) : defaultStanding(letter)
    );
  }

  return standings;
}

const GROUP_POSITION_RE = /^([123])([A-L])$/;
const THIRD_COMBO_RE = /^3([A-L](?:\/[A-L])+)$/;

export function parseGroupPositionSlot(
  slot: string
): { position: 1 | 2 | 3; group: string } | null {
  const match = slot.match(GROUP_POSITION_RE);
  if (!match) return null;
  return {
    position: Number(match[1]) as 1 | 2 | 3,
    group: match[2],
  };
}

export function parseThirdPlaceCombo(slot: string): string[] | null {
  if (!THIRD_COMBO_RE.test(slot)) return null;
  return slot.slice(1).split("/");
}

export function resolveGroupPosition(
  slot: string,
  standings: Map<string, GroupStanding>
): string | null {
  const parsed = parseGroupPositionSlot(slot);
  if (!parsed) return null;

  const standing = standings.get(parsed.group);
  if (!standing) return null;

  switch (parsed.position) {
    case 1:
      return standing.first;
    case 2:
      return standing.second;
    case 3:
      return standing.third;
    default:
      return null;
  }
}

export function resolveThirdPlaceCombo(
  slot: string,
  standings: Map<string, GroupStanding>,
  usedThirds: Set<string>
): string | null {
  const groups = parseThirdPlaceCombo(slot);
  if (!groups) return null;

  const candidates = groups
    .map((group) => standings.get(group))
    .filter((standing): standing is GroupStanding => !!standing)
    .map((standing) => standing.thirdStats)
    .filter((stats) => !usedThirds.has(stats.name))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });

  const winner = candidates[0]?.name ?? null;
  if (winner) usedThirds.add(winner);
  return winner;
}

/** Simulate group table from user click-order (1st beats 2nd beats 3rd beats 4th). */
export function simulateStandingFromRanking(
  group: string,
  orderedTeams: [string, string, string, string]
): GroupStanding {
  const stats = orderedTeams.map((name) => ({
    name,
    played: 0,
    points: 0,
    gf: 0,
    ga: 0,
  }));
  const byName = new Map(stats.map((entry) => [entry.name, entry]));

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const winner = byName.get(orderedTeams[i])!;
      const loser = byName.get(orderedTeams[j])!;
      winner.played += 1;
      loser.played += 1;
      winner.points += 3;
      winner.gf += 1;
      loser.ga += 1;
    }
  }

  return buildStanding(group, stats);
}

export function isGroupRankingComplete(
  rankings: GroupRankings,
  group: GroupLetter
): boolean {
  return rankings[group]?.length === 4;
}

export function areAllGroupRankingsComplete(rankings: GroupRankings): boolean {
  return GROUP_LETTERS.every((group) => isGroupRankingComplete(rankings, group));
}

export function countCompletedGroups(rankings: GroupRankings): number {
  return GROUP_LETTERS.filter((group) =>
    isGroupRankingComplete(rankings, group)
  ).length;
}

export function standingsFromRankings(
  rankings: GroupRankings
): Map<string, GroupStanding> | null {
  if (!areAllGroupRankingsComplete(rankings)) return null;

  const standings = new Map<string, GroupStanding>();
  for (const group of GROUP_LETTERS) {
    const ordered = rankings[group] as [string, string, string, string];
    standings.set(group, simulateStandingFromRanking(group, ordered));
  }
  return standings;
}

/** Pre-assign third-place teams to R32 slots (matches 73–88, ascending). */
export function buildThirdPlaceAssignments(
  r32Matches: { num: number; team1: string; team2: string }[],
  standings: Map<string, GroupStanding>
): Map<string, string> {
  const usedThirds = new Set<string>();
  const assignments = new Map<string, string>();

  const sorted = [...r32Matches].sort((a, b) => a.num - b.num);
  for (const match of sorted) {
    for (const slot of [match.team1, match.team2]) {
      if (!assignments.has(slot) && parseThirdPlaceCombo(slot)) {
        const team = resolveThirdPlaceCombo(slot, standings, usedThirds);
        if (team) assignments.set(slot, team);
      }
    }
  }

  return assignments;
}
