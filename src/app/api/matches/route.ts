import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllMatches, getPredictionsForUser } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = getAllMatches();
  const predictions = getPredictionsForUser(session.id);
  const predictionMap = Object.fromEntries(
    predictions.map((prediction) => [prediction.matchId, prediction])
  );

  return NextResponse.json({
    matches: matches.map((match) => ({
      ...match,
      prediction: predictionMap[match.id] || null,
    })),
  });
}
