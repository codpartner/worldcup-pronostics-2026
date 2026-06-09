import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runManualResultSync } from "@/lib/match-sync";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runManualResultSync();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sync results.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
