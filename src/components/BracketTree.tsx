"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BRACKET_GRID_ROWS,
  BRACKET_ROUNDS,
  buildMatchesByNum,
  getFinalMatch,
  resolveSlotLabel,
  type BracketMatchData,
  type BracketResolveContext,
  type BracketSlot,
} from "@/lib/bracket";
import {
  buildThirdPlaceAssignments,
  type GroupStanding,
} from "@/lib/group-standings";
import { getTeamOrPlaceholder } from "@/lib/teams";
import type { MatchPick } from "@/lib/picks";
import { BracketMatchSlot } from "@/components/BracketMatchSlot";

interface MatchWithPrediction {
  id: number;
  round: string;
  num: number | null;
  team1: string;
  team2: string;
  prediction: { pick: MatchPick } | null;
}

interface BracketTreeProps {
  matches: MatchWithPrediction[];
  groupStandings: Map<string, GroupStanding>;
  onSave: (matchNum: number, pick: MatchPick) => Promise<string | null>;
  locked?: boolean;
  canSubmit?: boolean;
  submitting?: boolean;
  onSubmit?: () => void;
  submittedAt?: string | null;
}

function BracketRoundColumn({
  label,
  slots,
  resolveContext,
  onPick,
  savingNum,
  side,
  locked = false,
}: {
  label: string;
  slots: readonly BracketSlot[];
  resolveContext: BracketResolveContext;
  onPick: (num: number, pick: "team1" | "team2") => void;
  savingNum: number | null;
  side: "left" | "right";
  locked?: boolean;
}) {
  const { matchesByNum, picksByNum } = resolveContext;
  return (
    <div className={`bracket-round bracket-round-${side}`}>
      <p className="bracket-round-label">{label}</p>
      <div
        className="bracket-round-grid"
        style={{ gridTemplateRows: `repeat(${BRACKET_GRID_ROWS}, 1fr)` }}
      >
        {slots.map((slot) => {
          const match = matchesByNum.get(slot.num);
          if (!match) return null;

          const team1 = resolveSlotLabel(match.team1, resolveContext);
          const team2 = resolveSlotLabel(match.team2, resolveContext);
          const pick =
            picksByNum.get(slot.num) ?? match.prediction?.pick ?? null;
          const knockoutPick =
            pick === "team1" || pick === "team2" ? pick : null;

          return (
            <div
              key={slot.num}
              className="bracket-slot"
              style={{ gridRow: `${slot.rowStart} / ${slot.rowEnd}` }}
            >
              <BracketMatchSlot
                team1={team1}
                team2={team2}
                pick={knockoutPick}
                onPick={(p) => onPick(slot.num, p)}
                disabled={locked || savingNum === slot.num}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BracketTree({
  matches,
  groupStandings,
  onSave,
  locked = false,
  canSubmit = false,
  submitting = false,
  onSubmit,
  submittedAt = null,
}: BracketTreeProps) {
  const knockoutMatches = useMemo(
    () =>
      matches
        .filter((m) => m.num !== null && m.num >= 73)
        .map((m) => ({
          id: m.id,
          num: m.num!,
          team1: m.team1,
          team2: m.team2,
          round: m.round,
          prediction: m.prediction,
        })),
    [matches]
  );

  const matchesByNum = useMemo(
    () => buildMatchesByNum(knockoutMatches),
    [knockoutMatches]
  );

  const [localPicks, setLocalPicks] = useState<Map<number, MatchPick>>(
    () => new Map()
  );

  useEffect(() => {
    const initial = new Map<number, MatchPick>();
    for (const m of knockoutMatches) {
      if (m.prediction?.pick) initial.set(m.num, m.prediction.pick);
    }
    const final = getFinalMatch(matches);
    if (final?.prediction?.pick) initial.set(final.num, final.prediction.pick);
    setLocalPicks(initial);
  }, [matches, knockoutMatches]);

  const [savingNum, setSavingNum] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const picksByNum = localPicks;

  const r32Matches = useMemo(
    () =>
      knockoutMatches
        .filter((m) => m.num >= 73 && m.num <= 88)
        .map((m) => ({ num: m.num, team1: m.team1, team2: m.team2 })),
    [knockoutMatches]
  );

  const thirdPlaceAssignments = useMemo(
    () => buildThirdPlaceAssignments(r32Matches, groupStandings),
    [r32Matches, groupStandings]
  );

  const resolveContext = useMemo<BracketResolveContext>(
    () => ({
      matchesByNum,
      picksByNum,
      groupStandings,
      thirdPlaceAssignments,
    }),
    [matchesByNum, picksByNum, groupStandings, thirdPlaceAssignments]
  );

  const finalMatch = useMemo(() => getFinalMatch(matches), [matches]);

  const finalResolved = useMemo(() => {
    if (!finalMatch) return null;
    const team1 = resolveSlotLabel(finalMatch.team1, resolveContext);
    const team2 = resolveSlotLabel(finalMatch.team2, resolveContext);
    const pick =
      picksByNum.get(finalMatch.num) ?? finalMatch.prediction?.pick ?? null;
    return { ...finalMatch, team1, team2, pick };
  }, [finalMatch, resolveContext, picksByNum]);

  const champion = useMemo(() => {
    if (!finalResolved) return null;
    const pick = finalResolved.pick;
    if (pick !== "team1" && pick !== "team2") return null;
    return pick === "team1" ? finalResolved.team1 : finalResolved.team2;
  }, [finalResolved]);

  const handlePick = useCallback(
    async (num: number, pick: "team1" | "team2") => {
      if (locked) return;
      const match = matchesByNum.get(num);
      if (!match) return;

      setLocalPicks((prev) => new Map(prev).set(num, pick));
      setSavingNum(num);
      setError(null);

      const saveError = await onSave(num, pick);
      if (saveError) {
        setError(saveError);
        setLocalPicks((prev) => {
          const next = new Map(prev);
          const original = knockoutMatches.find((m) => m.num === num);
          if (original?.prediction?.pick) {
            next.set(num, original.prediction.pick);
          } else {
            next.delete(num);
          }
          return next;
        });
      }
      setSavingNum(null);
    },
    [matchesByNum, onSave, knockoutMatches, locked]
  );

  const handleFinalPick = useCallback(
    async (pick: "team1" | "team2") => {
      if (locked || !finalMatch) return;

      setLocalPicks((prev) => new Map(prev).set(finalMatch.num, pick));
      setSavingNum(finalMatch.num);
      setError(null);

      const saveError = await onSave(finalMatch.num, pick);
      if (saveError) {
        setError(saveError);
        setLocalPicks((prev) => {
          const next = new Map(prev);
          if (finalMatch.prediction?.pick) {
            next.set(finalMatch.num, finalMatch.prediction.pick);
          } else {
            next.delete(finalMatch.num);
          }
          return next;
        });
      }
      setSavingNum(null);
    },
    [finalMatch, onSave, locked]
  );

  const knockoutPickCount = useMemo(() => {
    const nums = new Set([
      ...knockoutMatches.map((m) => m.num),
      ...(finalMatch ? [finalMatch.num] : []),
    ]);
    let count = 0;
    for (const [num, pick] of picksByNum) {
      if (nums.has(num) && (pick === "team1" || pick === "team2")) count++;
    }
    return count;
  }, [knockoutMatches, finalMatch, picksByNum]);

  const totalKnockout = knockoutMatches.length + (finalMatch ? 1 : 0);

  return (
    <div className="bracket-container">
      {locked && (
        <div className="bracket-locked-banner">
          <p className="font-semibold text-foreground">Bracket submitted and locked</p>
          <p className="text-sm text-muted">
            {submittedAt
              ? `Submitted ${formatSubmittedAt(submittedAt)}. A PDF copy was emailed to you.`
              : "Your picks can no longer be edited."}
          </p>
        </div>
      )}

      <div className="bracket-scroll">
        <div className="bracket-tree">
          <div className="bracket-half bracket-half-left">
            {BRACKET_ROUNDS.left.map((round) => (
              <BracketRoundColumn
                key={round.label}
                label={round.label}
                slots={round.slots}
                resolveContext={resolveContext}
                onPick={handlePick}
                savingNum={savingNum}
                side="left"
                locked={locked}
              />
            ))}
          </div>

          <div className="bracket-center">
            <p className="bracket-round-label">Final</p>
            <div className="bracket-center-match">
              {finalResolved ? (
                <BracketMatchSlot
                  team1={finalResolved.team1}
                  team2={finalResolved.team2}
                  pick={
                    finalResolved.pick === "team1" ||
                    finalResolved.pick === "team2"
                      ? finalResolved.pick
                      : null
                  }
                  onPick={handleFinalPick}
                  disabled={locked || savingNum === finalResolved.num}
                />
              ) : null}
            </div>

            <div className="bracket-champion">
              <span className="bracket-trophy" aria-hidden>
                🏆
              </span>
              <p className="bracket-champion-label font-fifa">Champion</p>
              <div className="bracket-champion-box">
                {champion ? (
                  <ChampionDisplay name={champion} />
                ) : (
                  <span className="text-sm text-muted">Pick your winner</span>
                )}
              </div>
            </div>
          </div>

          <div className="bracket-half bracket-half-right">
            {BRACKET_ROUNDS.right.map((round) => (
              <BracketRoundColumn
                key={round.label}
                label={round.label}
                slots={round.slots}
                resolveContext={resolveContext}
                onPick={handlePick}
                savingNum={savingNum}
                side="right"
                locked={locked}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="bracket-footer">
        <p className="text-sm text-muted">
          {knockoutPickCount} of {totalKnockout} knockout picks made
        </p>
        {champion && (
          <p className="text-sm font-semibold text-[color:var(--wc-lime)]">
            Champion selected — {getTeamOrPlaceholder(champion).displayName}
          </p>
        )}
        {!locked && canSubmit && onSubmit && (
          <button
            type="button"
            className="wc-btn mt-2"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? "Submitting..." : "Submit bracket & lock picks"}
          </button>
        )}
        {!locked && canSubmit && (
          <p className="text-xs text-muted">
            Submitting sends a PDF to your email and locks your bracket forever.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function formatSubmittedAt(value: string) {
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }
  );
}

function ChampionDisplay({ name }: { name: string }) {
  const team = getTeamOrPlaceholder(name);
  return (
    <div className="bracket-champion-team">
      {team.isPlaceholder ? (
        <span className="bracket-team-flag bracket-team-flag-placeholder bracket-team-flag-lg" aria-hidden />
      ) : (
        <span className="bracket-team-flag bracket-team-flag-lg" aria-hidden>
          {team.flag}
        </span>
      )}
      <span className="bracket-champion-name">
        {team.displayName}
      </span>
    </div>
  );
}
