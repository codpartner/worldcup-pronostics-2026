"use client";

import {
  countCompletedGroups,
  GROUP_LETTERS,
  type GroupLetter,
  type GroupRankings,
} from "@/lib/group-standings";
import { getTeamsByGroup } from "@/lib/teams";

const HOST_TEAMS = new Set(["Mexico", "Canada", "USA"]);
const DEBUT_TEAMS = new Set(["Curaçao", "Cape Verde"]);

interface GroupPredictorProps {
  rankings: GroupRankings;
  onChange: (rankings: GroupRankings) => void;
  onGenerate: () => void;
  saving?: boolean;
  locked?: boolean;
}

function rankLabel(position: number): string {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return "4th";
}

export function GroupPredictor({
  rankings,
  onChange,
  onGenerate,
  saving = false,
  locked = false,
}: GroupPredictorProps) {
  const completed = countCompletedGroups(rankings);
  const allDone = completed === GROUP_LETTERS.length;

  function handleTeamClick(group: GroupLetter, teamName: string) {
    const current = rankings[group] ?? [];
    const index = current.indexOf(teamName);

    if (index >= 0) {
      onChange({ ...rankings, [group]: current.slice(0, index) });
      return;
    }

    if (current.length < 4) {
      onChange({ ...rankings, [group]: [...current, teamName] });
    }
  }

  return (
    <div className="group-predictor">
      <div className="group-predictor-header">
        <div>
          <h2 className="group-predictor-title">Predict the group stage</h2>
          <p className="group-predictor-desc">
            Click teams in order to rank them 1st to 4th. Top 2 advance, best
            3rd-place teams also qualify.
          </p>
        </div>
        <div className="group-predictor-progress">
          <p className="group-predictor-progress-label">
            {completed} of {GROUP_LETTERS.length} groups predicted
          </p>
          <div className="group-predictor-progress-bar">
            <div
              className="group-predictor-progress-fill"
              style={{
                width: `${(completed / GROUP_LETTERS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="group-predictor-grid">
        {GROUP_LETTERS.map((group) => (
          <GroupCard
            key={group}
            group={group}
            ranking={rankings[group] ?? []}
            onTeamClick={(team) => handleTeamClick(group, team)}
            locked={locked}
          />
        ))}
      </div>

      {!locked && (
        <div className="group-predictor-footer">
          <button
            type="button"
            className="wc-btn group-predictor-generate"
            disabled={!allDone || saving}
            onClick={onGenerate}
          >
            {saving ? "Saving..." : "Generate knockout bracket"}
          </button>
          {!allDone && (
            <p className="text-sm text-muted">
              Complete all 12 groups to generate your bracket.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  ranking,
  onTeamClick,
  locked = false,
}: {
  group: GroupLetter;
  ranking: string[];
  onTeamClick: (team: string) => void;
  locked?: boolean;
}) {
  const teams = getTeamsByGroup(group);
  const done = ranking.length === 4;
  const rankByTeam = new Map(ranking.map((name, index) => [name, index + 1]));

  return (
    <div className={`group-card ${done ? "group-card-done" : ""}`}>
      <div className="group-card-header">
        <h3 className="group-card-title">Group {group}</h3>
        {done && <span className="group-card-done-badge">Done</span>}
      </div>

      <div className="group-card-teams">
        {teams.map((team) => {
          const position = rankByTeam.get(team.name);
          const isRanked = position !== undefined;

          return (
            <button
              key={team.name}
              type="button"
              disabled={locked}
              onClick={() => onTeamClick(team.name)}
              className={`group-team-row ${isRanked ? `group-team-ranked group-team-rank-${position}` : ""} ${locked ? "group-team-row-locked" : ""}`}
            >
              <span
                className={`group-team-rank ${isRanked ? `group-team-rank-badge-${position}` : "group-team-rank-empty"}`}
              >
                {position ?? "·"}
              </span>
              <span className="group-team-flag" aria-hidden>
                {team.flag}
              </span>
              <span className="group-team-name">{team.displayName}</span>
              <span className="group-team-badges">
                {HOST_TEAMS.has(team.name) && (
                  <span className="group-team-tag group-team-tag-host">Host</span>
                )}
                {DEBUT_TEAMS.has(team.name) && (
                  <span className="group-team-tag group-team-tag-debut">Debut</span>
                )}
              </span>
              {isRanked && (
                <span className="group-team-rank-label">{rankLabel(position)}</span>
              )}
            </button>
          );
        })}
      </div>

      {ranking.length > 0 && ranking.length < 4 && (
        <p className="group-card-hint">
          Pick {rankLabel(ranking.length + 1)}…
        </p>
      )}
    </div>
  );
}
