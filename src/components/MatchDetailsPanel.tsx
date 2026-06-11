"use client";

import { useCallback, useEffect, useState } from "react";
import { LineupPitch } from "@/components/LineupPitch";
import { MatchEventsTimeline } from "@/components/MatchEventsTimeline";
import type { MatchDetails, TeamLineup } from "@/lib/types";

interface MatchDetailsPanelProps {
  matchId: number;
  isLive: boolean;
}

interface DetailsResponse {
  apiConfigured: boolean;
  linked: boolean;
  details: MatchDetails;
}

type Tab = "events" | "lineups";

/** Auto-refresh interval for live matches; long enough to respect API quota. */
const LIVE_REFRESH_MS = 60_000;

export function MatchDetailsPanel({ matchId, isLive }: MatchDetailsPanelProps) {
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("events");

  const load = useCallback(
    async (refresh: boolean) => {
      try {
        const url = `/api/live/${matchId}/details${refresh ? "?refresh=1" : ""}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Could not load match details.");
        }
        setData(await response.json());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [matchId]
  );

  async function refresh() {
    setRefreshing(true);
    await load(true);
  }

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => load(false), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isLive, load]);

  if (loading) {
    return (
      <div className="border-t border-default px-4 py-5 text-sm text-muted">
        Loading match details…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-default px-4 py-5">
        <p className="text-sm text-danger">{error}</p>
        <button
          onClick={refresh}
          className="wc-btn-secondary mt-3 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.apiConfigured) {
    return (
      <div className="border-t border-default px-4 py-5 text-sm text-muted">
        API-Football is not configured, so live events and lineups are
        unavailable.
      </div>
    );
  }

  if (!data.linked) {
    return (
      <div className="border-t border-default px-4 py-5 text-sm text-muted">
        This match isn&apos;t linked to an API fixture yet. Details appear once
        the match is matched during a sync.
      </div>
    );
  }

  const details = data.details;
  const home = details.lineups.find((l: TeamLineup) => l.side === 1) ?? null;
  const away = details.lineups.find((l: TeamLineup) => l.side === 2) ?? null;
  const hasLineups = Boolean(home || away);

  return (
    <div className="border-t border-default px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-surface-secondary p-1 text-sm">
          <button
            onClick={() => setTab("events")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              tab === "events"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted"
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setTab("lineups")}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              tab === "lineups"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted"
            }`}
          >
            Lineups
          </button>
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          className="wc-btn-secondary text-sm disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {tab === "events" ? (
        <MatchEventsTimeline events={details.events} />
      ) : hasLineups ? (
        <LineupPitch home={home} away={away} />
      ) : (
        <p className="text-sm text-muted">
          Lineups aren&apos;t available yet. They&apos;re usually published
          20–40 minutes before kickoff.
        </p>
      )}
    </div>
  );
}
