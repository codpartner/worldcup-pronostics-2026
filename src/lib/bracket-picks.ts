import { FINAL_MATCH_NUM } from "@/lib/bracket";
import type { MatchPick } from "@/lib/picks";

export { FINAL_MATCH_NUM };

export function isValidBracketMatchNum(matchNum: number): boolean {
  return (
    Number.isInteger(matchNum) &&
    ((matchNum >= 73 && matchNum <= 102) || matchNum === FINAL_MATCH_NUM)
  );
}

export function getRequiredBracketMatchNums(): number[] {
  const nums: number[] = [];
  for (let num = 73; num <= 102; num += 1) {
    nums.push(num);
  }
  nums.push(FINAL_MATCH_NUM);
  return nums;
}

export function bracketMatchNum(input: {
  round: string;
  num: number | null;
}): number | null {
  if (input.round === "Final") return FINAL_MATCH_NUM;
  if (input.num !== null && input.num >= 73) return input.num;
  return null;
}

export function isBracketPickComplete(
  pick: MatchPick | null | undefined
): boolean {
  return pick === "team1" || pick === "team2";
}

export function areAllBracketPicksComplete(
  picksByNum: Map<number, MatchPick>
): boolean {
  return getRequiredBracketMatchNums().every((matchNum) =>
    isBracketPickComplete(picksByNum.get(matchNum))
  );
}
