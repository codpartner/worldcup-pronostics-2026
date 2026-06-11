"use client";

import type { LineupPlayer, TeamLineup } from "@/lib/types";

interface LineupPitchProps {
  home: TeamLineup | null;
  away: TeamLineup | null;
}

const SIDE_COLORS: Record<1 | 2, { jersey: string; ring: string }> = {
  1: { jersey: "bg-sky-500 text-white", ring: "ring-sky-300/60" },
  2: { jersey: "bg-[color:var(--wc-red)] text-white", ring: "ring-red-300/60" },
};

function buildRows(players: LineupPlayer[]): LineupPlayer[][] {
  const haveGrid = players.length > 0 && players.every((p) => p.grid);

  if (haveGrid) {
    const byRow = new Map<number, LineupPlayer[]>();
    for (const player of players) {
      const [row] = player.grid!.split(":").map(Number);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(player);
    }
    return [...byRow.keys()]
      .sort((a, b) => a - b)
      .map((row) =>
        byRow.get(row)!.sort((a, b) => {
          const colA = Number(a.grid!.split(":")[1]);
          const colB = Number(b.grid!.split(":")[1]);
          return colA - colB;
        })
      );
  }

  const order = ["G", "D", "M", "F"];
  const groups: Record<string, LineupPlayer[]> = {};
  for (const player of players) {
    const key = (player.pos || "M").charAt(0).toUpperCase();
    (groups[key] ||= []).push(player);
  }
  return order.filter((key) => groups[key]?.length).map((key) => groups[key]);
}

function Jersey({
  player,
  side,
}: {
  player: LineupPlayer;
  side: 1 | 2;
}) {
  const colors = SIDE_COLORS[side];
  const lastName = player.name.split(" ").slice(-1)[0];

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ${colors.jersey} ${colors.ring}`}
      >
        {player.number ?? "–"}
      </div>
      <span className="max-w-full truncate text-[10px] font-medium text-white drop-shadow">
        {lastName}
      </span>
    </div>
  );
}

function HalfPitch({
  lineup,
  isTop,
}: {
  lineup: TeamLineup;
  isTop: boolean;
}) {
  const rows = buildRows(lineup.startXI);
  // Top half rows run GK→attack downward; bottom half mirrors upward.
  const ordered = isTop ? rows : [...rows].reverse();

  return (
    <div className="flex flex-1 flex-col justify-between py-3">
      {ordered.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center justify-evenly gap-1"
        >
          {row.map((player, playerIndex) => (
            <Jersey
              key={player.id ?? `${rowIndex}-${playerIndex}`}
              player={player}
              side={lineup.side}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SubstitutesList({ lineup }: { lineup: TeamLineup }) {
  if (lineup.substitutes.length === 0) return null;
  const dot = lineup.side === 1 ? "bg-sky-500" : "bg-[color:var(--wc-red)]";

  return (
    <div className="flex-1">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {lineup.teamName}
      </p>
      <ul className="space-y-1 text-sm">
        {lineup.substitutes.map((player, index) => (
          <li
            key={player.id ?? index}
            className="flex items-center gap-2 text-muted"
          >
            <span className="w-5 text-right text-xs tabular-nums text-foreground/70">
              {player.number ?? "–"}
            </span>
            <span className="truncate text-foreground/90">{player.name}</span>
            {player.pos && (
              <span className="ml-auto text-[10px] uppercase text-muted">
                {player.pos}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineupPitch({ home, away }: LineupPitchProps) {
  if (!home && !away) return null;

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-emerald-900/30"
        style={{
          background:
            "repeating-linear-gradient(180deg, #15803d 0 36px, #166534 36px 72px)",
        }}
      >
        {/* Pitch markings */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30" />
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-white/30" />
          <div className="absolute left-1/2 top-0 h-16 w-40 -translate-x-1/2 border-2 border-t-0 border-white/25" />
          <div className="absolute bottom-0 left-1/2 h-16 w-40 -translate-x-1/2 border-2 border-b-0 border-white/25" />
        </div>

        <div className="relative flex min-h-[420px] flex-col">
          {home ? (
            <HalfPitch lineup={home} isTop />
          ) : (
            <div className="flex-1" />
          )}
          {away ? (
            <HalfPitch lineup={away} isTop={false} />
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Formation badges */}
        {home?.formation && (
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold text-white">
            {home.formation}
          </span>
        )}
        {away?.formation && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold text-white">
            {away.formation}
          </span>
        )}
      </div>

      {(home?.coach || away?.coach) && (
        <div className="flex justify-between text-xs text-muted">
          {home?.coach && <span>Coach: {home.coach}</span>}
          {away?.coach && <span>Coach: {away.coach}</span>}
        </div>
      )}

      {((home?.substitutes.length ?? 0) > 0 ||
        (away?.substitutes.length ?? 0) > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Substitutes
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            {home && <SubstitutesList lineup={home} />}
            {away && <SubstitutesList lineup={away} />}
          </div>
        </div>
      )}
    </div>
  );
}
