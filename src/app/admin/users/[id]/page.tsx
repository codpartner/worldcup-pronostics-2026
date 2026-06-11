"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MatchupInline } from "@/components/TeamDisplay";
import { formatPick, type MatchPick } from "@/lib/picks";

interface AdminUserPick {
  matchId: number;
  round: string;
  num: number | null;
  group: string | null;
  date: string;
  time: string;
  team1: string;
  team2: string;
  pick: MatchPick;
  points: number | null;
  hasResult: boolean;
  locked: boolean;
  updatedAt: string;
}

interface AdminUserDetail {
  user: { id: number; name: string; email: string; isAdmin: boolean; createdAt: string };
  picks: AdminUserPick[];
  groupRankingsSet: boolean;
  bracketSubmitted: boolean;
  bracketSubmittedAt: string | null;
  bracketPicksCount: number;
  totalPoints: number;
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<number | null>(null);
  const [resettingAll, setResettingAll] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/users/${userId}`);
    if (response.status === 404) {
      setError("User not found.");
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setError("Could not load user.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    setDetail(data.detail);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (!meData.user?.isAdmin) {
        router.push("/matches");
        return;
      }
      await load();
    }
    init();
  }, [router, load]);

  const scored = useMemo(
    () => detail?.picks.filter((p) => p.hasResult).length ?? 0,
    [detail]
  );

  function flash(msg: string) {
    setMessage(msg);
    setError(null);
    window.setTimeout(() => setMessage((m) => (m === msg ? null : m)), 4000);
  }

  async function resetOne(pick: AdminUserPick) {
    if (
      !window.confirm(
        `Reset ${detail?.user.name}'s pick for ${pick.team1} vs ${pick.team2}?`
      )
    ) {
      return;
    }
    setBusyMatchId(pick.matchId);
    setError(null);
    const response = await fetch(`/api/admin/users/${userId}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: pick.matchId }),
    });
    const data = await response.json();
    setBusyMatchId(null);
    if (!response.ok) {
      setError(data.error || "Could not reset pick.");
      return;
    }
    await load();
    flash("Pick reset.");
  }

  async function resetAll() {
    if (
      !window.confirm(
        `Reset ALL data for ${detail?.user.name}? This deletes every match pick, pick history, group rankings, and their submitted bracket. This cannot be undone.`
      )
    ) {
      return;
    }
    setResettingAll(true);
    setError(null);
    const response = await fetch(`/api/admin/users/${userId}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    setResettingAll(false);
    if (!response.ok) {
      setError(data.error || "Could not reset picks.");
      return;
    }
    await load();
    flash("All picks reset.");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-muted">
        Loading user...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-danger">{error || "User not found."}</p>
        <Link href="/admin/users" className="wc-btn-secondary mt-4 inline-block">
          Back to users
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wc-kicker">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            {" / "}
            <Link href="/admin/users" className="hover:underline">
              Users
            </Link>
            {" / "}
            {detail.user.name}
          </p>
          <h1 className="font-fifa wc-page-title mt-2">{detail.user.name}</h1>
          <p className="wc-page-desc">{detail.user.email}</p>
        </div>
        <button
          onClick={resetAll}
          disabled={resettingAll}
          className="rounded-full border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-400/10 disabled:opacity-50 dark:text-red-400"
        >
          {resettingAll ? "Resetting..." : "Reset all picks"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="wc-stat-card">
          <p className="text-xs uppercase tracking-wider text-muted">Picks</p>
          <p className="text-2xl font-bold text-foreground">{detail.picks.length}</p>
        </div>
        <div className="wc-stat-card">
          <p className="text-xs uppercase tracking-wider text-muted">Points</p>
          <p className="text-2xl font-bold text-foreground">{detail.totalPoints}</p>
        </div>
        <div className="wc-stat-card">
          <p className="text-xs uppercase tracking-wider text-muted">Scored</p>
          <p className="text-2xl font-bold text-foreground">{scored}</p>
        </div>
        <div className="wc-stat-card">
          <p className="text-xs uppercase tracking-wider text-muted">Bracket</p>
          <p className="text-sm font-semibold text-foreground">
            {detail.bracketSubmitted
              ? `Submitted (${detail.bracketPicksCount} picks)`
              : detail.bracketPicksCount > 0
                ? `Draft (${detail.bracketPicksCount} picks)`
                : "None"}
          </p>
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-success">{message}</p>}
      {error && <p className="mb-4 text-danger">{error}</p>}

      <div className="wc-glass overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="wc-table-head text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium">Pick</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {detail.picks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  This player has no match picks.
                </td>
              </tr>
            ) : (
              detail.picks.map((pick) => (
                <tr key={pick.matchId} className="border-t border-default">
                  <td className="px-4 py-3 text-foreground/80">
                    <MatchupInline team1={pick.team1} team2={pick.team2} />
                    <p className="mt-1 text-xs text-muted">
                      {pick.group || pick.round}
                      {pick.num ? ` · #${pick.num}` : ""} · {pick.date}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-success">
                    {formatPick(pick.pick, pick.team1, pick.team2)}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {pick.points ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {pick.hasResult ? (
                      <span className="text-muted">Finished</span>
                    ) : pick.locked ? (
                      <span className="text-amber-600 dark:text-amber-400">Locked</span>
                    ) : (
                      <span className="text-success">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => resetOne(pick)}
                      disabled={busyMatchId === pick.matchId}
                      className="rounded-full border border-amber-400/50 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-400/10 disabled:opacity-50 dark:text-amber-400"
                    >
                      {busyMatchId === pick.matchId ? "..." : "Reset"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
