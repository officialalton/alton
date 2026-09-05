import { NextResponse } from "next/server";
import { ensureSubscriptionForOrganizer } from "@/lib/workspace-events/subscription-lifecycle";
import {
  listWorkspaceEventsSubscriptionsForTarget,
  deleteWorkspaceEventsSubscription,
} from "@/lib/google-workspace-events-subscriptions";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") ?? "teacher1@alton.education";
  const googleUserId = new URL(req.url).searchParams.get("googleUserId");
  const deleted: string[] = [];
  let error: string | null = null;
  try {
    if (googleUserId) {
      const existing = await listWorkspaceEventsSubscriptionsForTarget({
        organizerEmail: email,
        targetResource: `//cloudidentity.googleapis.com/users/${googleUserId}`,
      });
      for (const sub of existing) {
        await deleteWorkspaceEventsSubscription({ organizerEmail: email, subscriptionName: sub.name });
        deleted.push(sub.name);
      }
    }
    await ensureSubscriptionForOrganizer(email, "teacher");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_events_subscriptions")
    .select("organizer_email, status, subscription_name, last_error, organizer_workspace_user_id")
    .eq("organizer_email", email);
  return NextResponse.json({ error, deleted, subscriptions: data });
}
