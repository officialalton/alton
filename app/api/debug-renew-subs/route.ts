import { NextResponse } from "next/server";
import { ensureSubscriptionForOrganizer } from "@/lib/workspace-events/subscription-lifecycle";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") ?? "teacher1@alton.education";
  let error: string | null = null;
  try {
    await ensureSubscriptionForOrganizer(email, "teacher");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_events_subscriptions")
    .select("organizer_email, status, subscription_name, last_error, organizer_workspace_user_id")
    .eq("organizer_email", email);
  return NextResponse.json({ error, subscriptions: data });
}
