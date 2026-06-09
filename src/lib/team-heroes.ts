import heroesData from "@/data/team-heroes.json";
import { getTeamOrPlaceholder } from "./teams";

export interface TeamHero {
  player: string;
  image: string | null;
  flag: string;
  fifaCode: string;
  teamName: string;
  accent: string;
}

interface HeroRecord {
  player: string;
  image: string | null;
}

const heroes = heroesData as Record<string, HeroRecord>;

const CONFED_ACCENT: Record<string, string> = {
  UEFA: "#5b2a86",
  CONMEBOL: "#0d5c2e",
  CONCACAF: "#e31937",
  CAF: "#d4af37",
  AFC: "#b8f032",
  OFC: "#1e88e5",
};

export function getTeamHero(teamName: string): TeamHero {
  const team = getTeamOrPlaceholder(teamName);
  const hero = team.isPlaceholder
    ? null
    : heroes[team.fifaCode] ?? null;

  return {
    player: hero?.player ?? team.displayName,
    image: hero?.image ?? null,
    flag: team.flag,
    fifaCode: team.fifaCode,
    teamName: team.displayName,
    accent: team.confed
      ? (CONFED_ACCENT[team.confed] ?? "#5b2a86")
      : "#5b2a86",
  };
}
