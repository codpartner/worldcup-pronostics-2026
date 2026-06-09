import teamsData from "@/data/teams.json";

export interface TeamInfo {
  name: string;
  displayName: string;
  flag: string;
  fifaCode: string;
  group: string | null;
  confed: string | null;
  isPlaceholder: boolean;
}

interface TeamRecord {
  name: string;
  name_normalised?: string;
  flag_icon: string;
  fifa_code: string;
  group?: string;
  confed?: string;
}

const teams = teamsData as TeamRecord[];

const byName = new Map<string, TeamRecord>();
const byAlias = new Map<string, TeamRecord>();

for (const team of teams) {
  byName.set(normalizeKey(team.name), team);
  if (team.name_normalised) {
    byAlias.set(normalizeKey(team.name_normalised), team);
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function getTeam(name: string): TeamInfo | null {
  const key = normalizeKey(name);
  const record = byName.get(key) ?? byAlias.get(key);
  if (!record) return null;

  return {
    name: record.name,
    displayName: record.name,
    flag: record.flag_icon,
    fifaCode: record.fifa_code,
    group: record.group ?? null,
    confed: record.confed ?? null,
    isPlaceholder: false,
  };
}

export function getTeamOrPlaceholder(name: string): TeamInfo {
  const team = getTeam(name);
  if (team) return team;

  return {
    name,
    displayName: name,
    flag: "",
    fifaCode: name,
    group: null,
    confed: null,
    isPlaceholder: true,
  };
}

export function getTeamsByGroup(group: string): TeamInfo[] {
  const letter = group.replace(/^Group\s+/i, "").toUpperCase();
  return teams
    .filter((team) => team.group?.toUpperCase() === letter)
    .map((record) => ({
      name: record.name,
      displayName: record.name,
      flag: record.flag_icon,
      fifaCode: record.fifa_code,
      group: record.group ?? null,
      confed: record.confed ?? null,
      isPlaceholder: false,
    }));
}

export function formatTeamLabel(
  name: string,
  style: "full" | "code" | "flag-code" = "full"
): string {
  const team = getTeamOrPlaceholder(name);

  if (team.isPlaceholder) {
    return team.displayName;
  }

  switch (style) {
    case "code":
      return team.fifaCode;
    case "flag-code":
      return `${team.flag} ${team.fifaCode}`;
    default:
      return `${team.flag} ${team.displayName}`;
  }
}
