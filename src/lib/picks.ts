import { formatTeamLabel } from "./teams";

export type MatchPick = "team1" | "draw" | "team2";

export function isMatchPick(value: string): value is MatchPick {
  return value === "team1" || value === "draw" || value === "team2";
}

export function getMatchResult(
  score1: number,
  score2: number
): MatchPick {
  if (score1 > score2) return "team1";
  if (score1 < score2) return "team2";
  return "draw";
}

export function pickFromLegacyScores(score1: number, score2: number): MatchPick {
  return getMatchResult(score1, score2);
}

export function formatPick(
  pick: MatchPick,
  team1: string,
  team2: string
): string {
  if (pick === "team1") return formatTeamLabel(team1, "full");
  if (pick === "team2") return formatTeamLabel(team2, "full");
  return "Draw";
}

export function calculatePickPoints(
  pick: MatchPick,
  actual1: number,
  actual2: number
): number {
  return pick === getMatchResult(actual1, actual2) ? 1 : 0;
}
