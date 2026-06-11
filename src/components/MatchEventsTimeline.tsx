"use client";

import type { MatchEvent } from "@/lib/types";

interface MatchEventsTimelineProps {
  events: MatchEvent[];
}

function eventIcon(event: MatchEvent) {
  if (event.type === "goal") {
    return <span aria-hidden>⚽</span>;
  }
  if (event.type === "card") {
    const isRed = event.detail.toLowerCase().includes("red");
    return (
      <span
        aria-hidden
        className={`inline-block h-3 w-2.5 rounded-[2px] ${
          isRed ? "bg-red-600" : "bg-yellow-400"
        }`}
      />
    );
  }
  if (event.type === "subst") {
    return <span aria-hidden className="text-emerald-600">⇄</span>;
  }
  if (event.type === "var") {
    return <span aria-hidden className="text-[10px] font-bold">VAR</span>;
  }
  return <span aria-hidden>•</span>;
}

function eventText(event: MatchEvent) {
  if (event.type === "subst") {
    return (
      <span className="text-sm">
        <span className="text-foreground">{event.assist ?? "—"}</span>
        <span className="text-muted"> ↑ / ↓ </span>
        <span className="text-muted">{event.player ?? "—"}</span>
      </span>
    );
  }

  return (
    <span className="text-sm">
      <span className="text-foreground">{event.player ?? event.detail}</span>
      {event.assist && (
        <span className="text-muted"> ({event.assist})</span>
      )}
      <span className="block text-[11px] text-muted">{event.detail}</span>
    </span>
  );
}

function minuteLabel(event: MatchEvent) {
  if (event.extra) return `${event.elapsed}+${event.extra}'`;
  return `${event.elapsed}'`;
}

export function MatchEventsTimeline({ events }: MatchEventsTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">No match events recorded yet.</p>
    );
  }

  return (
    <ol className="space-y-2">
      {events.map((event, index) => {
        const isHome = event.side === 1;
        return (
          <li
            key={index}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
          >
            <div className={isHome ? "flex justify-end text-right" : ""}>
              {isHome && (
                <div className="flex items-center gap-2">
                  {eventText(event)}
                  {eventIcon(event)}
                </div>
              )}
            </div>

            <span className="min-w-[44px] rounded-full bg-surface-secondary px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-muted">
              {minuteLabel(event)}
            </span>

            <div className={!isHome ? "flex justify-start" : ""}>
              {!isHome && (
                <div className="flex items-center gap-2">
                  {eventIcon(event)}
                  {eventText(event)}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
