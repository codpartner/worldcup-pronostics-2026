"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TeamDisplay } from "@/components/TeamDisplay";

interface MatchEmailStats {
  winnersCount: number;
  emailsSent: number;
  pendingEmails: number;
}

interface Match {
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
  emailStats?: MatchEmailStats;
}

export default function AdminPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { s1: string; s2: string }>>(
    {}
  );
  const [savingId, setSavingId] = useState<number | null>(null);
  const [sendingEmailsId, setSendingEmailsId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

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

      const response = await fetch("/api/admin/results");
      if (!response.ok) {
        setError("Could not load admin data.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setMatches(data.matches);
      setDrafts(
        Object.fromEntries(
          data.matches.map((match: Match) => [
            match.id,
            {
              s1: match.score1?.toString() ?? "",
              s2: match.score2?.toString() ?? "",
            },
          ])
        )
      );
      setLoading(false);
    }

    load();
  }, [router]);

  const pending = useMemo(
    () => matches.filter((match) => match.score1 === null).length,
    [matches]
  );

  async function syncFromApi() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);

    const response = await fetch("/api/admin/sync-results", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Sync failed.");
      setSyncing(false);
      return;
    }

    setSyncMessage(
      `Synced ${data.updated} result(s). Skipped ${data.skipped} match(es). Review results and send winner emails when ready.`
    );

    const reload = await fetch("/api/admin/results");
    if (reload.ok) {
      const reloadData = await reload.json();
      setMatches(reloadData.matches);
    }

    setSyncing(false);
  }

  async function saveResult(matchId: number) {
    const draft = drafts[matchId];
    if (!draft?.s1 || !draft?.s2) {
      setError("Enter both scores before saving.");
      return;
    }

    setSavingId(matchId);
    setError(null);
    setEmailMessage(null);

    const response = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        score1: Number(draft.s1),
        score2: Number(draft.s2),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not save result.");
      setSavingId(null);
      return;
    }

    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...data.match, emailStats: data.emailStats }
          : match
      )
    );
    setSavingId(null);
  }

  async function sendWinnerEmails(matchId: number) {
    setSendingEmailsId(matchId);
    setError(null);
    setEmailMessage(null);

    const response = await fetch("/api/admin/send-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not send emails.");
      setSendingEmailsId(null);
      return;
    }

    setEmailMessage(
      `Sent ${data.sent} email(s) for this match. Skipped ${data.skipped}.`
    );

    setMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...match, emailStats: data.emailStats }
          : match
      )
    );
    setSendingEmailsId(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted">
        Loading admin panel...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Admin results"
          description="Enter scores manually or sync from API-Football. After a result is saved, send winner emails when you're ready."
        />
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="wc-stat-card text-sm text-muted">
            {pending} matches still need results
          </div>
          <button
            onClick={syncFromApi}
            disabled={syncing}
            className="wc-btn-secondary disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync from API-Football"}
          </button>
        </div>
      </div>

      {syncMessage && (
        <p className="mb-4 text-sm text-success">{syncMessage}</p>
      )}
      {emailMessage && (
        <p className="mb-4 text-sm text-success">{emailMessage}</p>
      )}
      {error && <p className="mb-4 text-danger">{error}</p>}

      <div className="grid gap-4">
        {matches.map((match) => {
          const stats = match.emailStats;
          const hasResult = match.score1 !== null && match.score2 !== null;

          return (
            <article
              key={match.id}
              className="wc-match-card p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 dark:text-success/80">
                    {match.group || match.round}
                    {match.num ? ` · #${match.num}` : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {match.date} · {match.time}
                  </p>
                </div>
                {hasResult && (
                  <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs text-muted">
                    Result saved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamDisplay
                  name={match.team1}
                  variant="full"
                  align="right"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={drafts[match.id]?.s1 ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [match.id]: {
                          ...current[match.id],
                          s1: event.target.value,
                        },
                      }))
                    }
                    className="w-14 rounded-xl border border-field-border bg-field text-field-foreground px-2 py-2 text-center text-foreground outline-none ring-emerald-400/40 focus:ring-2"
                  />
                  <span className="text-muted">-</span>
                  <input
                    type="number"
                    min={0}
                    value={drafts[match.id]?.s2 ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [match.id]: {
                          ...current[match.id],
                          s2: event.target.value,
                        },
                      }))
                    }
                    className="w-14 rounded-xl border border-field-border bg-field text-field-foreground px-2 py-2 text-center text-foreground outline-none ring-emerald-400/40 focus:ring-2"
                  />
                </div>
                <TeamDisplay name={match.team2} variant="full" align="left" />
              </div>

              {hasResult && stats && (
                <p className="mt-3 text-sm text-muted">
                  {stats.winnersCount} winner{stats.winnersCount === 1 ? "" : "s"}
                  {" · "}
                  {stats.emailsSent} email{stats.emailsSent === 1 ? "" : "s"} sent
                  {stats.pendingEmails > 0 &&
                    ` · ${stats.pendingEmails} pending`}
                </p>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => saveResult(match.id)}
                  disabled={savingId === match.id}
                  className="wc-btn disabled:cursor-not-allowed"
                >
                  {savingId === match.id ? "Saving..." : "Save result"}
                </button>

                {hasResult && stats && stats.winnersCount > 0 && (
                  <button
                    onClick={() => sendWinnerEmails(match.id)}
                    disabled={
                      sendingEmailsId === match.id || stats.pendingEmails === 0
                    }
                    className="wc-btn-secondary disabled:opacity-50"
                  >
                    {sendingEmailsId === match.id
                      ? "Sending..."
                      : stats.pendingEmails > 0
                        ? `Send winner emails (${stats.pendingEmails})`
                        : "All emails sent"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
