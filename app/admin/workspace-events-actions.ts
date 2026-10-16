"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  renewExpiringSubscriptions,
  disableSubscriptionForOrganizer,
  reconcileMissedSmartNotesEvents,
} from "@/lib/workspace-events/subscription-lifecycle";

// M1/R6 공통 blocker(2026-09-03) — Workspace Events 구독 수명주기 관리자 화면용 서버 액션.

export type WorkspaceEventsSubscriptionRow = {
  id: string;
  organizer_email: string;
  organizer_role: string;
  status: string;
  expires_at: string | null;
  last_verified_at: string | null;
  last_renewed_at: string | null;
  last_error: string | null;
};

export async function listWorkspaceEventsSubscriptions(): Promise<WorkspaceEventsSubscriptionRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_events_subscriptions")
    .select("id, organizer_email, organizer_role, status, expires_at, last_verified_at, last_renewed_at, last_error")
    .order("organizer_email", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceEventsSubscriptionRow[];
}

export async function retryExpiringWorkspaceEventsSubscriptions(): Promise<{ processed: number }> {
  await requireAdmin();
  return renewExpiringSubscriptions();
}

export async function disableWorkspaceEventsSubscriptionForOrganizer(organizerEmail: string, reason: string): Promise<void> {
  await requireAdmin();
  await disableSubscriptionForOrganizer(organizerEmail, reason);
}

/** 요구사항 1 — 구독 장애·이벤트 유실 대비 Meet API 사후 대조를 관리자가 수동으로 실행. */
export async function runSmartNotesReconciliation(): Promise<{ checked: number; relinked: number }> {
  await requireAdmin();
  return reconcileMissedSmartNotesEvents();
}
