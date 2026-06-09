"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { PageHeader } from "@/components/PageHeader";

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

  useEffect(() => {
    async function load() {
      const [leaderboardRes, meRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/auth/me"),
      ]);

      if (leaderboardRes.status === 401) {
        router.push("/login");
        return;
      }

      const leaderboardData = await leaderboardRes.json();
      setEntries(leaderboardData.leaderboard || []);

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user?.id);
      }

      setLoading(false);
    }

    load();
  }, [router]);

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
        description="Rankings update automatically when admins enter match results."
      />

      <LeaderboardTable entries={entries} currentUserId={currentUserId} />
    </div>
  );
}
