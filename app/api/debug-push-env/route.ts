import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    audience: process.env.WORKSPACE_EVENTS_PUSH_AUDIENCE ?? null,
    serviceAccount: process.env.WORKSPACE_EVENTS_PUSH_SERVICE_ACCOUNT_EMAIL ?? null,
  });
}
