"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "@/components/MatchCard";
import { PageHeader } from "@/components/PageHeader";
import type { MatchPick } from "@/lib/picks";

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

const PHASES = [
  {
    id: "group",
    label: "Group stage",
    matchesInPhase: (match: MatchWithPrediction) => Boolean(match.group),
  },
  {
    id: "r32",
    label: "Round of 32",
    matchesInPhase: (match: MatchWithPrediction) => match.round === "Round of 32",
  },
  {
    id: "r16",
    label: "Round of 16",
    matchesInPhase: (match: MatchWithPrediction) => match.round === "Round of 16",
  },
  {
    id: "qf",
    label: "Quarter-final",
    matchesInPhase: (match: MatchWithPrediction) => match.round === "Quarter-final",
  },
  {
    id: "sf",
    label: "Semi-final",
    matchesInPhase: (match: MatchWithPrediction) => match.round === "Semi-final",
  },
  {
    id: "final",
    label: "Final",
    matchesInPhase: (match: MatchWithPrediction) =>
      match.round === "Final" || match.round === "Match for third place",
  },
] as const;

type PhaseId = (typeof PHASES)[number]["id"];

function getDefaultExpandedPhases(matches: MatchWithPrediction[]): Set<PhaseId> {
  const open = new Set<PhaseId>();
  for (const phase of PHASES) {
    const phaseMatches = matches.filter(phase.matchesInPhase);
    if (phaseMatches.some((match) => match.pickWindowStatus === "open")) {
      open.add(phase.id);
    }
  }
  if (open.size > 0) return open;

  const upcoming = matches
    .filter((match) => match.pickWindowStatus === "upcoming" && match.score1 === null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length > 0) {
    const phase = PHASES.find((item) => item.matchesInPhase(upcoming[0]));
    if (phase) return new Set([phase.id]);
  }

  return new Set(["group"]);
}

export default function MatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithPrediction[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseId>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    const response = await fetch("/api/matches");
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setError("Could not load matches.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    const nextMatches = data.matches as MatchWithPrediction[];
    setMatches(nextMatches);
    setExpandedPhases(getDefaultExpandedPhases(nextMatches));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const matchesByPhase = useMemo(
    () =>
      PHASES.map((phase) => ({
        ...phase,
        matches: matches.filter(phase.matchesInPhase),
      })).filter((phase) => phase.matches.length > 0),
    [matches]
  );

  function togglePhase(phaseId: PhaseId) {
    setExpandedPhases((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  const stats = useMemo(() => {
    const open = matches.filter(
      (match) => match.picksOpen && match.score1 === null
    ).length;
    const saved = matches.filter((match) => match.prediction).length;
    const points = matches.reduce(
      (total, match) => total + (match.prediction?.points || 0),
      0
    );
    return { open, saved, points };
  }, [matches]);

  async function savePrediction(matchId: number, pick: MatchPick) {
    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, pick }),
    });
    const data = await response.json();
    if (!response.ok) {
      return data.error || "Could not save prediction.";
    }

    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...match, prediction: data.prediction }
          : match
      )
    );
    return null;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading matches...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="My picks"
          description="Picks open 4 days before match day and close at midnight on match day (UTC)."
        />
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Open" value={stats.open} />
          <StatCard label="Saved" value={stats.saved} />
          <StatCard label="Points" value={stats.points} accent />
        </div>
      </div>

      {error && <p className="mb-4 text-danger">{error}</p>}

      <div className="grid gap-4">
        {matchesByPhase.map((phase) => {
          const expanded = expandedPhases.has(phase.id);
          const openCount = phase.matches.filter(
            (match) => match.picksOpen && match.score1 === null
          ).length;

          return (
            <section key={phase.id} className="wc-phase-section">
              <button
                type="button"
                className="wc-phase-header"
                aria-expanded={expanded}
                onClick={() => togglePhase(phase.id)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`wc-phase-chevron ${expanded ? "wc-phase-chevron-open" : ""}`}
                    aria-hidden
                  >
                    ›
                  </span>
                  <div className="text-left">
                    <h2 className="wc-phase-title">{phase.label}</h2>
                    <p className="wc-phase-meta">
                      {phase.matches.length} match
                      {phase.matches.length === 1 ? "" : "es"}
                      {openCount > 0 ? ` · ${openCount} open for picks` : ""}
                    </p>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="wc-phase-body grid gap-4">
                  {phase.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onSave={savePrediction}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="wc-stat-card">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-black font-fifa ${
          accent ? "text-[color:var(--wc-lime)]" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
