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
