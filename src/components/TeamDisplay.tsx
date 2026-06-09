import { getTeamOrPlaceholder } from "@/lib/teams";

interface TeamDisplayProps {
  name: string;
  variant?: "compact" | "full" | "placeholder";
  align?: "left" | "center" | "right";
  className?: string;
}

export function TeamDisplay({
  name,
  variant = "full",
  align = "left",
  className = "",
}: TeamDisplayProps) {
  const team = getTeamOrPlaceholder(name);
  const alignClass =
    align === "right"
      ? "items-end text-right"
      : align === "center"
        ? "items-center text-center"
        : "items-start text-left";

  if (team.isPlaceholder) {
    return (
      <div className={`flex flex-col ${alignClass} ${className}`}>
        <span className="font-fifa text-sm font-semibold tracking-wide text-muted">
          {team.displayName}
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex flex-col gap-1 ${alignClass} ${className}`}>
        <span className="text-2xl leading-none" aria-hidden>
          {team.flag}
        </span>
        <span className="font-fifa text-sm font-bold tracking-[0.12em] text-foreground">
          {team.fifaCode}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${alignClass} ${className}`}>
      <span className="text-2xl leading-none" aria-hidden>
        {team.flag}
      </span>
      <span className="font-fifa text-base font-semibold tracking-wide text-foreground sm:text-lg">
        {team.fifaCode}
      </span>
      <span className="text-xs font-medium text-muted">{team.displayName}</span>
    </div>
  );
}

interface MatchupDisplayProps {
  team1: string;
  team2: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MatchupDisplay({
  team1,
  team2,
  size = "md",
  className = "",
}: MatchupDisplayProps) {
  const gap = size === "lg" ? "gap-4" : size === "sm" ? "gap-2" : "gap-3";
  const vsSize =
    size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={`flex flex-wrap items-center justify-center ${gap} ${className}`}
    >
      <TeamDisplay name={team1} variant="compact" align="center" />
      <span className={`font-fifa font-bold text-muted ${vsSize}`}>VS</span>
      <TeamDisplay name={team2} variant="compact" align="center" />
    </div>
  );
}

interface MatchupInlineProps {
  team1: string;
  team2: string;
  className?: string;
}

export function MatchupInline({ team1, team2, className = "" }: MatchupInlineProps) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span>{formatTeamInline(team1)}</span>
      <span className="text-muted">vs</span>
      <span>{formatTeamInline(team2)}</span>
    </span>
  );
}

function formatTeamInline(name: string): string {
  const team = getTeamOrPlaceholder(name);
  if (team.isPlaceholder) return team.displayName;
  return `${team.flag} ${team.displayName}`;
}
