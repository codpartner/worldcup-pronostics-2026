interface LeaderboardEntry {
  userId: number;
  name: string;
  totalPoints: number;
  correctPicks: number;
  predictionsCount: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
}

export function LeaderboardTable({
  entries,
  currentUserId,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="wc-glass rounded-2xl p-8 text-center text-muted">
        No players yet. Be the first to join the pool.
      </div>
    );
  }

  return (
    <div className="wc-glass overflow-hidden rounded-2xl">
      <table className="min-w-full text-left text-sm">
        <thead className="wc-table-head text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Points</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">
              Correct
            </th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">
              Picks
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const isCurrent = entry.userId === currentUserId;
            return (
              <tr
                key={entry.userId}
                className={`border-t border-default ${
                  isCurrent ? "bg-[color:var(--wc-lime)]/10" : ""
                }`}
              >
                <td className="px-4 py-3 font-semibold text-foreground/80">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-foreground">
                    {entry.name}
                    {isCurrent && (
                      <span className="ml-2 text-xs font-normal text-success">
                        you
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 font-fifa text-lg font-black text-[color:var(--wc-lime)]">
                  {entry.totalPoints}
                </td>
                <td className="hidden px-4 py-3 text-foreground/80 sm:table-cell">
                  {entry.correctPicks}
                </td>
                <td className="hidden px-4 py-3 text-foreground/80 lg:table-cell">
                  {entry.predictionsCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
