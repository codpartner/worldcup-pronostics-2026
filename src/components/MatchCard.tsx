"use client";

import { useMemo, useState } from "react";
import { formatPick, type MatchPick } from "@/lib/picks";
import { getTeamOrPlaceholder } from "@/lib/teams";
import { TeamDisplay } from "@/components/TeamDisplay";

interface MatchWithPrediction {
  id: number;
  round: string;
  num: number | null;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group: string | null;
  ground: string;
  score1: number | null;
  score2: number | null;
  locked: boolean;
  picksOpen: boolean;
  pickWindowStatus: "upcoming" | "open" | "closed";
  picksOpenAt: string;
  prediction: {
    pick: MatchPick;
    points: number | null;
  } | null;
}

interface MatchCardProps {
  match: MatchWithPrediction;
  onSave: (matchId: number, pick: MatchPick) => Promise<string | null>;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "Open":
      return "wc-badge wc-badge-open";
    case "Saved":
      return "wc-badge wc-badge-saved";
    case "Upcoming":
      return "wc-badge wc-badge-saved";
    case "Locked":
      return "wc-badge wc-badge-locked";
    default:
      return "wc-badge wc-badge-finished";
  }
}

function formatOpensAt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pickButtonClass(selected: boolean, disabled: boolean) {
  if (disabled) {
    return selected
      ? "border-[color:var(--wc-lime)] bg-[color:var(--wc-lime)]/20 text-foreground"
      : "border-default bg-surface/50 text-muted";
  }

  return selected
    ? "border-[color:var(--wc-red)] bg-[color:var(--wc-red)] text-white shadow-md"
    : "border-default bg-field text-field-foreground hover:border-[color:var(--wc-red)]/40";
}

export function MatchCard({ match, onSave }: MatchCardProps) {
  const [pick, setPick] = useState<MatchPick | null>(
    match.prediction?.pick ?? null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasResult = match.score1 !== null && match.score2 !== null;
  const canPick = match.picksOpen && !hasResult;
  const isLocked = !canPick;

  const status = useMemo(() => {
    if (hasResult) return "Finished";
    if (match.pickWindowStatus === "upcoming") return "Upcoming";
    if (match.pickWindowStatus === "closed") return "Locked";
    if (match.prediction) return "Saved";
    return "Open";
  }, [hasResult, match.pickWindowStatus, match.prediction]);

  const activePick = pick ?? match.prediction?.pick ?? null;

  const team1 = getTeamOrPlaceholder(match.team1);
  const team2 = getTeamOrPlaceholder(match.team2);

  async function handlePick(nextPick: MatchPick) {
    if (isLocked || saving) return;

    setPick(nextPick);
    setSaving(true);
    setError(null);
    setMessage(null);

    const saveError = await onSave(match.id, nextPick);
    if (saveError) {
      setError(saveError);
      setPick(match.prediction?.pick ?? null);
    } else {
      setMessage("Pick saved.");
    }
    setSaving(false);
  }

  const roundLabel = (match.group || match.round).toUpperCase();

  return (
    <article className="wc-match-card">
      <div className="wc-match-header px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-fifa text-lg leading-none tracking-wide">
              {roundLabel}
              {match.num ? ` · #${match.num}` : ""}
            </p>
            <p className="mt-2 text-xs text-white/80">
              {formatDate(match.date)} · {match.time}
            </p>
            <span className="wc-venue-pill">{match.ground}</span>
          </div>
          <span className={statusBadgeClass(status)}>{status}</span>
        </div>
      </div>

      <div className="wc-curve-accent px-4 py-5">
        <div className="mb-5 flex items-center justify-center gap-4">
          <TeamDisplay name={match.team1} variant="compact" align="center" />
          {hasResult ? (
            <div className="wc-score-display rounded-2xl bg-foreground px-4 py-2 text-background">
              {match.score1}:{match.score2}
            </div>
          ) : (
            <span className="font-fifa text-lg text-muted">VS</span>
          )}
          <TeamDisplay name={match.team2} variant="compact" align="center" />
        </div>

        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {canPick ? "Who wins?" : hasResult ? "Your pick" : "Pick window"}
        </p>

        {match.pickWindowStatus === "upcoming" && !hasResult && (
          <p className="mb-3 text-center text-sm text-muted">
            Picks open on{" "}
            <span className="font-semibold text-foreground">
              {formatOpensAt(match.picksOpenAt)}
            </span>
          </p>
        )}

        {match.pickWindowStatus === "closed" && !hasResult && (
          <p className="mb-3 text-center text-sm text-muted">
            Picks closed — match day has started.
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { value: "team1" as const, team: team1 },
              { value: "draw" as const, team: null },
              { value: "team2" as const, team: team2 },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={isLocked || saving}
              onClick={() => handlePick(option.value)}
              className={`rounded-2xl border px-3 py-3 transition ${pickButtonClass(
                activePick === option.value,
                isLocked || saving
              )}`}
            >
              {option.value === "draw" ? (
                <span className="font-fifa block text-base tracking-wide">
                  Draw
                </span>
              ) : option.team?.isPlaceholder ? (
                <span className="font-fifa block text-base tracking-wide">
                  {option.team.displayName}
                </span>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl leading-none" aria-hidden>
                    {option.team?.flag}
                  </span>
                  <span className="font-fifa text-sm font-bold tracking-[0.12em]">
                    {option.team?.fifaCode}
                  </span>
                  <span className="text-[0.65rem] font-medium opacity-80">
                    {option.team?.displayName}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {isLocked && activePick && (
          <p className="mt-4 text-center text-sm text-muted">
            Picked{" "}
            <span className="font-semibold text-foreground">
              {formatPick(activePick, match.team1, match.team2)}
            </span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted">
            {match.prediction?.points != null && match.prediction.points > 0 && (
              <span className="font-fifa font-semibold text-[color:var(--wc-lime)]">
                +{match.prediction.points} PT
              </span>
            )}
            {message && (
              <span className="ml-2 font-semibold text-[color:var(--wc-green)]">
                {message}
              </span>
            )}
            {error && <span className="text-danger">{error}</span>}
            {saving && !error && (
              <span className="text-muted">Saving...</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
