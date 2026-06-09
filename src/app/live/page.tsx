"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveMatchCard } from "@/components/LiveMatchCard";
import { PageHeader } from "@/components/PageHeader";
import type { TeamHero } from "@/lib/team-heroes";
import type { LiveMatch } from "@/lib/types";

interface LiveMatchPayload extends LiveMatch {
  heroes: {
    team1: TeamHero;
    team2: TeamHero;
  };
}

const POLL_MS = 30_000;

export default function LivePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<LiveMatchPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiConfigured, setApiConfigured] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    const response = await fetch("/api/live");
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setLoading(false);
      return;
    }

    const data = await response.json();
    setMatches(data.matches || []);
    setApiConfigured(Boolean(data.apiConfigured));
    setLastSync(data.syncedAt || null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, POLL_MS);
    return () => clearInterval(interval);
  }, [loadLive]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading live matches...
      </div>
    );
  }

  const liveCount = matches.filter((match) => match.isLive).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Match hub"
          description="Live scores and today's results, refreshed every 30 seconds."
        />
        <div className="wc-stat-card text-left text-sm text-muted sm:text-center">
          {liveCount > 0 ? (
            <span className="font-semibold text-[color:var(--wc-red)]">
              {liveCount} live now
            </span>
          ) : (
            <span>No live matches right now</span>
          )}
          {lastSync && (
            <p className="mt-1 text-xs">
              Updated {new Date(lastSync).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {!apiConfigured && (
        <div className="mb-6 rounded-2xl border border-default bg-surface/80 p-4 text-sm text-muted">
          Add <code className="text-foreground">API_FOOTBALL_KEY</code> to{" "}
          <code className="text-foreground">.env.local</code> to pull live scores
          from API-Football. Until then, admins can still enter results manually.
        </div>
      )}

      {matches.length === 0 ? (
        <div className="wc-glass rounded-2xl p-8 text-center text-muted">
          No live or recently finished matches on the schedule right now.
        </div>
      ) : (
        <div className="grid gap-6">
          {matches.map((match) => (
            <LiveMatchCard key={match.id} match={match} heroes={match.heroes} />
          ))}
        </div>
      )}
    </div>
  );
}
