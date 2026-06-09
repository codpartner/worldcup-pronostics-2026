import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAllMatches,
  getMatchEmailStats,
  setMatchResult,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matches = getAllMatches().map((match) => ({
    ...match,
    emailStats: getMatchEmailStats(match.id),
  }));

  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const matchId = Number(body.matchId);
    const score1 = Number(body.score1);
    const score2 = Number(body.score2);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match." }, { status: 400 });
    }

    if (
      !Number.isInteger(score1) ||
      !Number.isInteger(score2) ||
      score1 < 0 ||
      score2 < 0
    ) {
      return NextResponse.json({ error: "Invalid scores." }, { status: 400 });
    }

    const { match } = setMatchResult(matchId, score1, score2);

    return NextResponse.json({
      match,
      emailStats: getMatchEmailStats(matchId),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save result.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
