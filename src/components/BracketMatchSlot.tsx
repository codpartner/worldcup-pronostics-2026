"use client";

import { getTeamOrPlaceholder, type TeamInfo } from "@/lib/teams";
import type { MatchPick } from "@/lib/picks";

interface BracketMatchSlotProps {
  team1: string;
  team2: string;
  pick: MatchPick | null;
  onPick: (pick: "team1" | "team2") => void;
  disabled?: boolean;
  compact?: boolean;
}

function FlagBadge({ team }: { team: TeamInfo }) {
  if (team.isPlaceholder) {
    return (
      <span className="bracket-team-flag bracket-team-flag-placeholder" aria-hidden />
    );
  }

  return (
    <span className="bracket-team-flag" aria-hidden>
      {team.flag}
    </span>
  );
}

function TeamRow({
  name,
  selected,
  onClick,
  disabled,
  compact,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const team = getTeamOrPlaceholder(name);
  const label = team.isPlaceholder
    ? team.displayName
    : compact
      ? team.fifaCode
      : team.displayName;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`bracket-team ${selected ? "bracket-team-selected" : ""} ${disabled ? "bracket-team-disabled" : ""}`}
    >
      <FlagBadge team={team} />
      <span className="bracket-team-name">{label}</span>
    </button>
  );
}

export function BracketMatchSlot({
  team1,
  team2,
  pick,
  onPick,
  disabled = false,
  compact = false,
}: BracketMatchSlotProps) {
  return (
    <div className="bracket-match">
      <TeamRow
        name={team1}
        selected={pick === "team1"}
        onClick={() => onPick("team1")}
        disabled={disabled}
        compact={compact}
      />
      <TeamRow
        name={team2}
        selected={pick === "team2"}
        onClick={() => onPick("team2")}
        disabled={disabled}
        compact={compact}
      />
    </div>
  );
}
