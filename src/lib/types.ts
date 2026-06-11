export interface UpdateMatchDetailsInput {
  round: string;
  num: number | null;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group: string | null;
  ground: string;
  apiFixtureId: number | null;
}

export interface Match {
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
  liveScore1: number | null;
  liveScore2: number | null;
  matchStatus: string | null;
  elapsed: number | null;
  locked: boolean;
  picksOpen: boolean;
  pickWindowStatus: "upcoming" | "open" | "closed";
  picksOpenAt: string;
  picksCloseAt: string;
  apiFixtureId: number | null;
  syncAfterUtc: string | null;
  lastSyncAt: string | null;
  syncAttempts: number;
}

export interface LiveMatch extends Match {
  isLive: boolean;
  displayScore1: number | null;
  displayScore2: number | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

export type MatchPick = "team1" | "draw" | "team2";

export interface Prediction {
  id: number;
  userId: number;
  matchId: number;
  pick: MatchPick;
  points: number | null;
  updatedAt: string;
}

export interface PredictionHistoryEntry {
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

export interface AdminUserSummary {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  predictionsCount: number;
  totalPoints: number;
  groupRankingsSet: boolean;
  bracketSubmitted: boolean;
}

export interface AdminUserPick {
  matchId: number;
  round: string;
  num: number | null;
  group: string | null;
  date: string;
  time: string;
  team1: string;
  team2: string;
  pick: MatchPick;
  points: number | null;
  hasResult: boolean;
  locked: boolean;
  updatedAt: string;
}

export interface AdminUserDetail {
  user: User;
  picks: AdminUserPick[];
  groupRankingsSet: boolean;
  bracketSubmitted: boolean;
  bracketSubmittedAt: string | null;
  bracketPicksCount: number;
  totalPoints: number;
}

export interface ActivityEntry {
  maskedName: string;
  matchId: number;
  team1: string;
  team2: string;
  matchDate: string;
  round: string;
  group: string | null;
  predictedAt: string;
}

export interface LeaderboardEntry {
  userId: number;
  name: string;
  totalPoints: number;
  correctPicks: number;
  predictionsCount: number;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface ScoredPrediction {
  predictionId: number;
  userId: number;
  userName: string;
  userEmail: string;
  matchId: number;
  team1: string;
  team2: string;
  pick: MatchPick;
  actualScore1: number;
  actualScore2: number;
  points: number;
}

export type GroupLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type GroupRankings = Partial<Record<GroupLetter, string[]>>;

export interface GroupRankingRecord {
  userId: number;
  rankings: GroupRankings;
  updatedAt: string;
}

export interface BracketSubmission {
  userId: number;
  submittedAt: string;
  pdfPath: string;
  emailSentAt: string | null;
}

export interface BracketPick {
  userId: number;
  matchNum: number;
  pick: MatchPick;
  updatedAt: string;
}

export interface MatchEmailStats {
  winnersCount: number;
  emailsSent: number;
  pendingEmails: number;
}

export type MatchEventType = "goal" | "card" | "subst" | "var" | "other";

export interface MatchEvent {
  /** Side the event belongs to: 1 = team1 (home), 2 = team2 (away). */
  side: 1 | 2;
  teamName: string;
  elapsed: number;
  extra: number | null;
  type: MatchEventType;
  detail: string;
  player: string | null;
  assist: string | null;
}

export interface LineupPlayer {
  id: number | null;
  name: string;
  number: number | null;
  pos: string | null;
  /** API-Football grid position "row:col" (null for substitutes). */
  grid: string | null;
}

export interface TeamLineup {
  side: 1 | 2;
  teamName: string;
  formation: string | null;
  coach: string | null;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface MatchDetails {
  matchId: number;
  apiFixtureId: number | null;
  events: MatchEvent[];
  lineups: TeamLineup[];
  eventsFetchedAt: string | null;
  lineupsFetchedAt: string | null;
}
