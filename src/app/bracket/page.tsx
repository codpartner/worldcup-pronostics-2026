"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BracketStepper } from "@/components/BracketStepper";
import { BracketTree } from "@/components/BracketTree";
import { GroupPredictor } from "@/components/GroupPredictor";
import { PageHeader } from "@/components/PageHeader";
import {
  areAllBracketPicksComplete,
  bracketMatchNum,
} from "@/lib/bracket-picks";
import {
  areAllGroupRankingsComplete,
  standingsFromRankings,
  type GroupRankings,
} from "@/lib/group-standings";
import type { MatchPick } from "@/lib/picks";

interface ScheduleMatch {
  id: number;
  round: string;
  num: number | null;
  team1: string;
  team2: string;
  group: string | null;
}

interface MatchWithBracketPick extends ScheduleMatch {
  prediction: { pick: MatchPick } | null;
}

type BracketStep = "groups" | "knockout";

export default function BracketPage() {
  const router = useRouter();
  const [step, setStep] = useState<BracketStep>("groups");
  const [rankings, setRankings] = useState<GroupRankings>({});
  const [bracketGenerated, setBracketGenerated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [bracketPicks, setBracketPicks] = useState<Map<number, MatchPick>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [savingRankings, setSavingRankings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [matchesRes, rankingsRes, picksRes] = await Promise.all([
      fetch("/api/matches"),
      fetch("/api/group-rankings"),
      fetch("/api/bracket/picks"),
    ]);

    if (
      matchesRes.status === 401 ||
      rankingsRes.status === 401 ||
      picksRes.status === 401
    ) {
      router.push("/login");
      return;
    }

    if (!matchesRes.ok) {
      setError("Could not load matches.");
      setLoading(false);
      return;
    }

    const matchesData = await matchesRes.json();
    setSchedule(
      matchesData.matches.map(
        (match: ScheduleMatch & { prediction?: unknown }) => ({
          id: match.id,
          round: match.round,
          num: match.num,
          team1: match.team1,
          team2: match.team2,
          group: match.group,
        })
      )
    );

    if (picksRes.ok) {
      const picksData = await picksRes.json();
      setBracketPicks(
        new Map(
          Object.entries(picksData.picks ?? {}).map(([matchNum, pick]) => [
            Number(matchNum),
            pick as MatchPick,
          ])
        )
      );
    }

    if (rankingsRes.ok) {
      const rankingsData = await rankingsRes.json();
      setRankings(rankingsData.rankings ?? {});
      if (rankingsData.complete) {
        setBracketGenerated(true);
      }
      if (rankingsData.submitted) {
        setSubmitted(true);
        setSubmittedAt(rankingsData.submittedAt ?? null);
        setStep("knockout");
      }
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupStandings = useMemo(
    () => standingsFromRankings(rankings),
    [rankings]
  );

  const matches = useMemo<MatchWithBracketPick[]>(
    () =>
      schedule.map((match) => {
        const matchNum = bracketMatchNum(match);
        const pick = matchNum ? bracketPicks.get(matchNum) ?? null : null;
        return {
          ...match,
          prediction: pick ? { pick } : null,
        };
      }),
    [schedule, bracketPicks]
  );

  const canSubmit = useMemo(() => {
    if (submitted || !areAllGroupRankingsComplete(rankings)) return false;
    return areAllBracketPicksComplete(bracketPicks);
  }, [bracketPicks, rankings, submitted]);

  async function saveRankings(next: GroupRankings) {
    if (submitted) return false;

    setSavingRankings(true);
    setError(null);

    const response = await fetch("/api/group-rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rankings: next }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not save group predictions.");
      setSavingRankings(false);
      return false;
    }

    setRankings(data.rankings);
    setSavingRankings(false);
    return true;
  }

  async function handleGenerateBracket() {
    if (submitted || !areAllGroupRankingsComplete(rankings)) return;

    const saved = await saveRankings(rankings);
    if (saved) {
      setBracketGenerated(true);
      setStep("knockout");
    }
  }

  async function saveBracketPick(matchNum: number, pick: MatchPick) {
    if (submitted) {
      return "Your bracket is locked after submission.";
    }

    const response = await fetch("/api/bracket/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchNum, pick }),
    });
    const data = await response.json();
    if (!response.ok) {
      return data.error || "Could not save bracket pick.";
    }

    setBracketPicks((current) => new Map(current).set(matchNum, pick));
    return null;
  }

  async function handleSubmitBracket() {
    if (!canSubmit || submitted) return;

    setSubmitting(true);
    setError(null);
    setSubmitMessage(null);

    const response = await fetch("/api/bracket/submit", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not submit bracket.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmittedAt(data.submittedAt ?? null);
    setSubmitMessage(
      data.emailSent
        ? "Bracket locked. Check your email for the PDF."
        : "Bracket locked. Email is not configured, but your picks are saved."
    );
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-10 text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8">
      <PageHeader
        title="World Cup bracket"
        description={
          submitted
            ? "Your fantasy bracket is locked. Match picks on My picks are scored separately."
            : step === "groups"
              ? "Rank every group, then build your fantasy knockout bracket."
              : "Pick every knockout winner in your bracket, then submit to lock it."
        }
      />

      <BracketStepper
        step={step}
        onStepChange={setStep}
        knockoutEnabled={bracketGenerated && groupStandings !== null}
      />

      {error && <p className="mb-4 text-danger">{error}</p>}
      {submitMessage && <p className="mb-4 text-sm text-success">{submitMessage}</p>}

      {step === "groups" ? (
        <GroupPredictor
          rankings={rankings}
          onChange={submitted ? () => {} : setRankings}
          onGenerate={handleGenerateBracket}
          saving={savingRankings}
          locked={submitted}
        />
      ) : groupStandings ? (
        <BracketTree
          matches={matches}
          groupStandings={groupStandings}
          onSave={saveBracketPick}
          locked={submitted}
          canSubmit={canSubmit}
          submitting={submitting}
          onSubmit={handleSubmitBracket}
          submittedAt={submittedAt}
        />
      ) : (
        <div className="wc-glass rounded-2xl p-8 text-center">
          <p className="text-muted">
            Complete your group predictions first, then generate the bracket.
          </p>
          <button
            type="button"
            className="wc-btn mt-4"
            onClick={() => setStep("groups")}
          >
            Back to groups
          </button>
        </div>
      )}
    </div>
  );
}
