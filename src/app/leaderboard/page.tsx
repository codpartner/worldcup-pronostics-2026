"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { PageHeader } from "@/components/PageHeader";

const REFRESH_MS = 60_000;

interface LeaderboardEntry {
  userId: number;
  name: string;
  totalPoints: number;
  correctPicks: number;
  predictionsCount: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number>();
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    const res = await fetch("/api/leaderboard");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setEntries(data.leaderboard || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    async function loadMe() {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user?.id);
      }
    }

    loadMe();
    loadLeaderboard();

    const interval = setInterval(loadLeaderboard, REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading leaderboard...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Leaderboard"
        description="Rankings refresh automatically as results come in."
      />

      <LeaderboardTable entries={entries} currentUserId={currentUserId} />
    </div>
  );
}
