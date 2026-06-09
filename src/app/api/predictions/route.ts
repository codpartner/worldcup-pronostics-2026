import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertPrediction } from "@/lib/db";
import { isMatchPick } from "@/lib/picks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const matchId = Number(body.matchId);
    const pick = String(body.pick || "");

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match." }, { status: 400 });
    }

    if (!isMatchPick(pick)) {
      return NextResponse.json(
        { error: "Pick must be team1, draw, or team2." },
        { status: 400 }
      );
    }

    const prediction = upsertPrediction(session.id, matchId, pick);
    return NextResponse.json({ prediction });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save prediction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
