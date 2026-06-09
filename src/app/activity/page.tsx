"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { MatchupDisplay } from "@/components/TeamDisplay";

interface ActivityEntry {
  maskedName: string;
  matchId: number;
  team1: string;
  team2: string;
  matchDate: string;
  round: string;
  group: string | null;
  predictedAt: string;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ActivityPage() {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/activity");
      if (response.status === 401) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      setActivity(data.activity || []);
      setLoading(false);
    }

    load();
  }, [router]);

  const groupedByMatch = useMemo(() => {
    const groups = new Map<number, ActivityEntry[]>();

    for (const entry of activity) {
      const existing = groups.get(entry.matchId) || [];
      existing.push(entry);
      groups.set(entry.matchId, existing);
    }

    return [...groups.entries()].map(([matchId, entries]) => ({
      matchId,
      entry: entries[0],
      count: entries.length,
      players: entries.map((item) => item.maskedName),
    }));
  }, [activity]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading activity...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Team activity"
        description="See who has already locked in a pick — scores stay hidden until kickoff."
      />

      {groupedByMatch.length === 0 ? (
        <div className="wc-glass rounded-2xl p-8 text-center text-muted">
          No picks yet on upcoming matches. Be the first!
        </div>
      ) : (
        <div className="grid gap-4">
          {groupedByMatch.map(({ matchId, entry, count, players }) => (
            <article key={matchId} className="wc-match-card">
              <div className="wc-match-header px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/85">
                  {entry.group || entry.round}
                </p>
                <div className="mt-2">
                  <MatchupDisplay
                    team1={entry.team1}
                    team2={entry.team2}
                    size="sm"
                    className="text-white [&_.font-fifa]:text-white [&_span]:text-white/90"
                  />
                </div>
                <p className="mt-1 text-sm text-white/75">
                  {formatDate(entry.matchDate)}
                </p>
              </div>
              <div className="wc-curve-accent p-5">
                <span className="wc-badge wc-badge-open">
                  {count} pick{count === 1 ? "" : "s"}
                </span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {players.map((player, index) => (
                    <span
                      key={`${matchId}-${player}-${index}`}
                      className="rounded-full border border-default bg-surface px-3 py-1 text-sm text-foreground/80"
                    >
                      {player} picked this match
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
