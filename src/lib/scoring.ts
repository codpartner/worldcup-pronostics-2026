export {
  calculatePickPoints,
  formatPick,
  getMatchResult,
  type MatchPick,
} from "./picks";

export type PickWindowStatus = "upcoming" | "open" | "closed";

export function getPicksOpenDaysBefore(): number {
  const configured = Number(process.env.PICKS_OPEN_DAYS_BEFORE || 4);
  return Number.isFinite(configured) && configured > 0 ? configured : 4;
}

export function parseKickoff(date: string, time: string): Date {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)/);
  if (!match) {
    return new Date(`${date}T12:00:00Z`);
  }

  const [, hours, minutes, offsetHours] = match;
  const utcHours = parseInt(hours, 10) - parseInt(offsetHours, 10);
  const utcMinutes = parseInt(minutes, 10);

  const kickoff = new Date(`${date}T00:00:00Z`);
  kickoff.setUTCHours(utcHours, utcMinutes, 0, 0);
  return kickoff;
}

export function getPicksOpenAt(date: string): Date {
  const matchDay = new Date(`${date}T00:00:00Z`);
  const opens = new Date(matchDay);
  opens.setUTCDate(opens.getUTCDate() - getPicksOpenDaysBefore());
  return opens;
}

export function getPicksCloseAt(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function getPickWindowStatus(
  date: string,
  now = new Date()
): PickWindowStatus {
  const openAt = getPicksOpenAt(date);
  const closeAt = getPicksCloseAt(date);

  if (now < openAt) return "upcoming";
  if (now >= closeAt) return "closed";
  return "open";
}

export function isPicksOpen(date: string, now = new Date()): boolean {
  return getPickWindowStatus(date, now) === "open";
}

export function isMatchLocked(
  date: string,
  _time: string,
  now = new Date()
): boolean {
  return !isPicksOpen(date, now);
}

const KNOCKOUT_ROUNDS = new Set([
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Final",
  "Match for third place",
]);

export function isKnockoutMatch(match: {
  group: string | null;
  num: number | null;
  round: string;
}): boolean {
  if (match.group) return false;
  if (match.num !== null && match.num >= 73) return true;
  return KNOCKOUT_ROUNDS.has(match.round);
}

export function formatPickWindowDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function getResultSyncAfter(date: string, time: string): Date {
  const kickoff = parseKickoff(date, time);
  return new Date(kickoff.getTime() + 10 * 60 * 1000);
}

export function getResultSyncUntil(date: string, time: string): Date {
  const kickoff = parseKickoff(date, time);
  return new Date(kickoff.getTime() + 3 * 60 * 60 * 1000);
}
