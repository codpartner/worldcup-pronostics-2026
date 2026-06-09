import {
  buildMatchesByNum,
  FINAL_MATCH_NUM,
  getFinalMatch,
  resolveSlotLabel,
  type BracketMatchData,
  type BracketResolveContext,
} from "@/lib/bracket";
import {
  areAllBracketPicksComplete,
  getRequiredBracketMatchNums,
  isBracketPickComplete,
} from "@/lib/bracket-picks";
import {
  areAllGroupRankingsComplete,
  buildThirdPlaceAssignments,
  GROUP_LETTERS,
  standingsFromRankings,
  type GroupRankings,
} from "@/lib/group-standings";
import type { MatchPick } from "@/lib/picks";

interface BracketSnapshotMatch {
  id: number;
  round: string;
  num: number | null;
  group: string | null;
  team1: string;
  team2: string;
}

export interface ResolvedKnockoutPick {
  num: number;
  round: string;
  team1: string;
  team2: string;
  winner: string;
}

export interface BracketSubmissionSnapshot {
  userName: string;
  userEmail: string;
  submittedAt: string;
  rankings: GroupRankings;
  knockoutPicks: ResolvedKnockoutPick[];
  champion: string | null;
}

export function validateBracketReady(
  picksByNum: Map<number, MatchPick>,
  rankings: GroupRankings | null
): string | null {
  if (!rankings || !areAllGroupRankingsComplete(rankings)) {
    return "Complete all 12 group rankings before submitting.";
  }

  if (!areAllBracketPicksComplete(picksByNum)) {
    const missing = getRequiredBracketMatchNums().filter(
      (matchNum) => !isBracketPickComplete(picksByNum.get(matchNum))
    ).length;
    return `Complete all ${getRequiredBracketMatchNums().length} knockout picks before submitting (${missing} remaining).`;
  }

  return null;
}

export function buildBracketSubmissionSnapshot(input: {
  userName: string;
  userEmail: string;
  submittedAt: string;
  matches: BracketSnapshotMatch[];
  picksByNum: Map<number, MatchPick>;
  rankings: GroupRankings;
}): BracketSubmissionSnapshot {
  const { userName, userEmail, submittedAt, matches, picksByNum, rankings } =
    input;

  const standings = standingsFromRankings(rankings);
  if (!standings) {
    throw new Error("Group rankings are incomplete.");
  }

  const bracketMatches: BracketMatchData[] = matches
    .filter((match) => match.num !== null && match.num >= 73 && match.num <= 102)
    .map((match) => ({
      id: match.id,
      num: match.num!,
      team1: match.team1,
      team2: match.team2,
      round: match.round,
      prediction: picksByNum.has(match.num!)
        ? { pick: picksByNum.get(match.num!)! }
        : null,
    }));

  const matchesByNum = buildMatchesByNum(bracketMatches);

  const finalMatch = getFinalMatch(
    matches.map((match) => ({
      round: match.round,
      num: match.num,
      id: match.id,
      team1: match.team1,
      team2: match.team2,
      prediction: picksByNum.has(FINAL_MATCH_NUM)
        ? { pick: picksByNum.get(FINAL_MATCH_NUM)! }
        : null,
    }))
  );

  const r32Matches = bracketMatches
    .filter((match) => match.num >= 73 && match.num <= 88)
    .map((match) => ({ num: match.num, team1: match.team1, team2: match.team2 }));

  const thirdPlaceAssignments = buildThirdPlaceAssignments(r32Matches, standings);

  const resolveContext: BracketResolveContext = {
    matchesByNum,
    picksByNum,
    groupStandings: standings,
    thirdPlaceAssignments,
  };

  const knockoutPicks: ResolvedKnockoutPick[] = [];

  const orderedNums = [
    ...bracketMatches.map((match) => match.num).sort((a, b) => a - b),
    ...(finalMatch ? [FINAL_MATCH_NUM] : []),
  ];

  for (const num of orderedNums) {
    const match =
      num === FINAL_MATCH_NUM && finalMatch
        ? finalMatch
        : matchesByNum.get(num);
    if (!match) continue;

    const team1 = resolveSlotLabel(match.team1, resolveContext);
    const team2 = resolveSlotLabel(match.team2, resolveContext);
    const pick = picksByNum.get(num) ?? match.prediction?.pick ?? null;
    const winner =
      pick === "team1" ? team1 : pick === "team2" ? team2 : "—";

    knockoutPicks.push({
      num,
      round: match.round,
      team1,
      team2,
      winner,
    });
  }

  const champion = knockoutPicks.at(-1)?.winner ?? null;

  return {
    userName,
    userEmail,
    submittedAt,
    rankings,
    knockoutPicks,
    champion: champion && champion !== "—" ? champion : null,
  };
}
