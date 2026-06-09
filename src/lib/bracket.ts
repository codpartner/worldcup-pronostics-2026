import type { MatchPick } from "@/lib/picks";
import {
  parseThirdPlaceCombo,
  resolveGroupPosition,
  type GroupStanding,
} from "@/lib/group-standings";

export interface BracketMatchData {
  id: number;
  num: number;
  team1: string;
  team2: string;
  round: string;
  prediction: { pick: MatchPick } | null;
}

export interface BracketSlot {
  num: number;
  rowStart: number;
  rowEnd: number;
}

/** 16-row grid; each knockout match spans rows so pairs converge toward the center. */
const LEFT_R32: BracketSlot[] = [
  { num: 74, rowStart: 1, rowEnd: 3 },
  { num: 77, rowStart: 3, rowEnd: 5 },
  { num: 73, rowStart: 5, rowEnd: 7 },
  { num: 75, rowStart: 7, rowEnd: 9 },
  { num: 83, rowStart: 9, rowEnd: 11 },
  { num: 84, rowStart: 11, rowEnd: 13 },
  { num: 81, rowStart: 13, rowEnd: 15 },
  { num: 82, rowStart: 15, rowEnd: 17 },
];

const LEFT_R16: BracketSlot[] = [
  { num: 89, rowStart: 1, rowEnd: 5 },
  { num: 90, rowStart: 5, rowEnd: 9 },
  { num: 93, rowStart: 9, rowEnd: 13 },
  { num: 94, rowStart: 13, rowEnd: 17 },
];

const LEFT_QF: BracketSlot[] = [
  { num: 97, rowStart: 1, rowEnd: 9 },
  { num: 98, rowStart: 9, rowEnd: 17 },
];

const LEFT_SF: BracketSlot[] = [{ num: 101, rowStart: 1, rowEnd: 17 }];

const RIGHT_R32: BracketSlot[] = [
  { num: 76, rowStart: 1, rowEnd: 3 },
  { num: 78, rowStart: 3, rowEnd: 5 },
  { num: 79, rowStart: 5, rowEnd: 7 },
  { num: 80, rowStart: 7, rowEnd: 9 },
  { num: 86, rowStart: 9, rowEnd: 11 },
  { num: 88, rowStart: 11, rowEnd: 13 },
  { num: 85, rowStart: 13, rowEnd: 15 },
  { num: 87, rowStart: 15, rowEnd: 17 },
];

const RIGHT_R16: BracketSlot[] = [
  { num: 91, rowStart: 1, rowEnd: 5 },
  { num: 92, rowStart: 5, rowEnd: 9 },
  { num: 95, rowStart: 9, rowEnd: 13 },
  { num: 96, rowStart: 13, rowEnd: 17 },
];

const RIGHT_QF: BracketSlot[] = [
  { num: 99, rowStart: 1, rowEnd: 9 },
  { num: 100, rowStart: 9, rowEnd: 17 },
];

const RIGHT_SF: BracketSlot[] = [{ num: 102, rowStart: 1, rowEnd: 17 }];

export const BRACKET_GRID_ROWS = 16;

export const BRACKET_ROUNDS = {
  left: [
    { label: "Round of 32", slots: LEFT_R32 },
    { label: "Round of 16", slots: LEFT_R16 },
    { label: "Quarter-final", slots: LEFT_QF },
    { label: "Semi-final", slots: LEFT_SF },
  ],
  right: [
    { label: "Semi-final", slots: RIGHT_SF },
    { label: "Quarter-final", slots: RIGHT_QF },
    { label: "Round of 16", slots: RIGHT_R16 },
    { label: "Round of 32", slots: RIGHT_R32 },
  ],
} as const;

const WINNER_RE = /^W(\d+)$/;
const LOSER_RE = /^L(\d+)$/;

export function parseWinnerRef(slot: string): number | null {
  const match = slot.match(WINNER_RE);
  return match ? Number(match[1]) : null;
}

export function parseLoserRef(slot: string): number | null {
  const match = slot.match(LOSER_RE);
  return match ? Number(match[1]) : null;
}

export function getWinnerName(
  match: BracketMatchData,
  pick: MatchPick | null | undefined
): string | null {
  if (!pick || pick === "draw") return null;
  return pick === "team1" ? match.team1 : match.team2;
}

export interface BracketResolveContext {
  matchesByNum: Map<number, BracketMatchData>;
  picksByNum: Map<number, MatchPick>;
  groupStandings: Map<string, GroupStanding>;
  thirdPlaceAssignments: Map<string, string>;
}

export function resolveSlotLabel(
  slot: string,
  context: BracketResolveContext
): string {
  const { matchesByNum, picksByNum, groupStandings, thirdPlaceAssignments } =
    context;

  const groupTeam = resolveGroupPosition(slot, groupStandings);
  if (groupTeam) return groupTeam;

  if (parseThirdPlaceCombo(slot)) {
    return thirdPlaceAssignments.get(slot) ?? slot;
  }

  const winnerRef = parseWinnerRef(slot);
  if (winnerRef !== null) {
    const source = matchesByNum.get(winnerRef);
    if (!source) return slot;
    const pick = picksByNum.get(winnerRef) ?? source.prediction?.pick;
    const winner = getWinnerName(source, pick);
    if (!winner) return slot;
    return resolveSlotLabel(winner, context);
  }

  const loserRef = parseLoserRef(slot);
  if (loserRef !== null) {
    const source = matchesByNum.get(loserRef);
    if (!source) return slot;
    const pick = picksByNum.get(loserRef) ?? source.prediction?.pick;
    if (!pick || pick === "draw") return slot;
    const loser = pick === "team1" ? source.team2 : source.team1;
    return resolveSlotLabel(loser, context);
  }

  return slot;
}

export function buildMatchesByNum(
  matches: BracketMatchData[]
): Map<number, BracketMatchData> {
  return new Map(matches.filter((m) => m.num != null).map((m) => [m.num, m]));
}

/** Virtual match number for the Final (no num in schedule data). */
export const FINAL_MATCH_NUM = 103;

export function getFinalMatch(
  allMatches: { round: string; num: number | null; id: number; team1: string; team2: string; prediction: { pick: MatchPick } | null }[]
): BracketMatchData | null {
  const final = allMatches.find((m) => m.round === "Final");
  if (!final) return null;
  return {
    id: final.id,
    num: FINAL_MATCH_NUM,
    team1: final.team1,
    team2: final.team2,
    round: final.round,
    prediction: final.prediction,
  };
}

export function isKnockoutMatch(round: string, num: number | null): boolean {
  return num !== null && num >= 73 && num <= 102;
}
