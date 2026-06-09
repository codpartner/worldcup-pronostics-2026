"use client";

import { MatchHeroBanner } from "@/components/MatchHero";
import { TeamDisplay } from "@/components/TeamDisplay";
import type { TeamHero } from "@/lib/team-heroes";

interface LiveMatchCardProps {
  match: {
    id: number;
    round: string;
    num: number | null;
    date: string;
    time: string;
    team1: string;
    team2: string;
    group: string | null;
    ground: string;
    isLive: boolean;
    matchStatus: string | null;
    elapsed: number | null;
    displayScore1: number | null;
    displayScore2: number | null;
    score1: number | null;
    score2: number | null;
  };
  heroes: {
    team1: TeamHero;
    team2: TeamHero;
  };
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: string | null, elapsed: number | null) {
  if (!status) return null;
  if (status === "HT") return "Half-time";
  if (status === "1H" || status === "2H" || status === "LIVE") {
    return elapsed != null ? `${elapsed}'` : "Live";
  }
  if (status === "FT") return "Full-time";
  return status;
}

export function LiveMatchCard({ match, heroes }: LiveMatchCardProps) {
  const hasScore =
    match.displayScore1 !== null && match.displayScore2 !== null;
  const finished = match.score1 !== null && match.score2 !== null;

  return (
    <article className="wc-match-card overflow-hidden">
      <MatchHeroBanner team1={heroes.team1} team2={heroes.team2} />

      <div className="wc-curve-accent px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="wc-kicker">
              {match.group || match.round}
              {match.num ? ` · #${match.num}` : ""}
            </p>
            <p className="text-sm text-muted">
              {formatDate(match.date)} · {match.ground}
            </p>
          </div>

          {match.isLive && (
            <span className="wc-badge wc-badge-finished animate-pulse">
              Live
            </span>
          )}
          {finished && !match.isLive && (
            <span className="wc-badge wc-badge-locked">FT</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <TeamDisplay name={match.team1} variant="compact" align="center" />
          <div className="text-center">
            {hasScore ? (
              <p className="wc-score-display text-foreground">
                {match.displayScore1}:{match.displayScore2}
              </p>
            ) : (
              <p className="font-fifa text-2xl text-muted">VS</p>
            )}
            {match.isLive && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--wc-red)]">
                {statusLabel(match.matchStatus, match.elapsed)}
              </p>
            )}
          </div>
          <TeamDisplay name={match.team2} variant="compact" align="center" />
        </div>
      </div>
    </article>
  );
}
