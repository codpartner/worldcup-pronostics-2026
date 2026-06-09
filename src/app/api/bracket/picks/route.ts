import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isValidBracketMatchNum } from "@/lib/bracket-picks";
import {
  getBracketPicksForUser,
  isBracketSubmitted,
  upsertBracketPick,
} from "@/lib/db";
import { isMatchPick } from "@/lib/picks";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const picks = getBracketPicksForUser(session.id);
  return NextResponse.json({
    picks: Object.fromEntries(picks.map((pick) => [pick.matchNum, pick.pick])),
    submitted: isBracketSubmitted(session.id),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const matchNum = Number(body.matchNum);
    const pick = String(body.pick || "");

    if (!isValidBracketMatchNum(matchNum)) {
      return NextResponse.json({ error: "Invalid bracket match." }, { status: 400 });
    }

    if (!isMatchPick(pick) || pick === "draw") {
      return NextResponse.json(
        { error: "Bracket picks must choose team1 or team2." },
        { status: 400 }
      );
    }

    const saved = upsertBracketPick(session.id, matchNum, pick);
    return NextResponse.json({ pick: saved });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save bracket pick.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
