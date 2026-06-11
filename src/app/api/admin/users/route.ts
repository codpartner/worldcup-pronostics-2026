import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminUserSummaries } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ users: getAdminUserSummaries() });
}
