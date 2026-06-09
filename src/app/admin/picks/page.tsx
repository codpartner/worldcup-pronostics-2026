"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MatchupInline } from "@/components/TeamDisplay";
import { formatPick, type MatchPick } from "@/lib/picks";

interface HistoryEntry {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  matchId: number;
  matchLabel: string;
  matchDate: string;
  team1: string;
  team2: string;
  pick: MatchPick;
  recordedAt: string;
}

function formatDateTime(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function AdminPicksPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
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

      const response = await fetch("/api/admin/picks");
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();
      setHistory(data.history || []);
      setLoading(false);
    }

    load();
  }, [router]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return history;

    return history.filter(
      (entry) =>
        entry.userName.toLowerCase().includes(query) ||
        entry.userEmail.toLowerCase().includes(query) ||
        entry.matchLabel.toLowerCase().includes(query)
    );
  }, [filter, history]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading pick history...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wc-kicker">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            {" / "}Pick history
          </p>
          <h1 className="font-fifa wc-page-title mt-2">Pick history</h1>
          <p className="wc-page-desc">
            Full audit trail of every prediction change, visible to admins only.
          </p>
        </div>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search player or match..."
          className="w-full rounded-xl border border-field-border bg-field text-field-foreground px-4 py-3 text-foreground outline-none ring-emerald-400/40 focus:ring-2 sm:max-w-xs"
        />
      </div>

      <div className="wc-glass overflow-hidden rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="wc-table-head text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium">Pick</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No pick history yet.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="border-t border-default">
                  <td className="px-4 py-3 text-muted">
                    {formatDateTime(entry.recordedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{entry.userName}</p>
                    <p className="text-xs text-muted">{entry.userEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    <MatchupInline team1={entry.team1} team2={entry.team2} />
                    <p className="mt-1 text-xs text-muted">{entry.matchDate}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-success">
                    {formatPick(entry.pick, entry.team1, entry.team2)}
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
