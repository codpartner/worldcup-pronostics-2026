import { NextResponse } from "next/server";
import { runScheduledResultSync } from "@/lib/match-sync";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = new URL(request.url).searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledResultSync();
    return NextResponse.json({
      ok: true,
      serverTimeUtc: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
