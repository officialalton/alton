import { createAdminClient } from "@/lib/supabase-admin";
import {
  createWorkspaceEventsSubscription,
  renewWorkspaceEventsSubscription,
  deleteWorkspaceEventsSubscription,
} from "@/lib/google-workspace-events-subscriptions";
import { getWorkspaceUserByEmail } from "@/lib/google-workspace-directory-readonly";
import { findRecentSmartNoteForMeetingCode } from "@/lib/google-meet";

// M1/R6 공통 blocker(2026-09-03, 같은 날 네 번째 후속에서 모델 정정) — Workspace Events
// 구독 생성·조회·갱신·정지·만료·재생성·삭제의 실제 오케스트레이션.
// lib/google-workspace-events-subscriptions.ts(순수 API 클라이언트)와 supabase
// workspace_events_subscriptions(상태 저장소)를 잇는다.
//
// **정정 이력**: 최초 구현은 (1) organizer 이메일을 그대로 target resource에 쓰고,
// (2) 웹훅 HTTP URL을 그대로 pubsubTopic에 넣는 임시 fallback(WORKSPACE_EVENTS_
// PUBSUB_TOPIC 없으면 NEXT_PUBLIC_SITE_URL 기반 URL 사용)이 있었다 — 둘 다 실제
// Google API 요구사항과 맞지 않아 제거했다. 이제 (1) organizer의 Directory API 불변
// 사용자 ID를 조회·캐시해서만 구독을 만들고, (2) WORKSPACE_EVENTS_PUBSUB_TOPIC이
// 없거나 형식이 틀리면 실제 API를 호출하기 전에 fail-closed로 즉시 실패한다(웹훅 HTTP
// URL로 대체하지 않음).
//
// 원칙(기존 Calendar/Meet 동기화와 동일): 이 흐름의 어떤 실패도 상담·예약 확정 자체를
// 막거나 되돌리지 않는다. 구독이 끊겼다고 Smart Notes 원본·이벤트를 유실 처리하거나
// 상담·수업을 자동 완료 처리하지 않는다 — reconcileMissedSmartNotesEvents()가 별도
// 사후 대조로 복구를 시도할 뿐, 실패해도 조용히 재처리 대상으로 남는다.

const RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 만료 24시간 전부터 갱신 대상
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // Workspace Events 구독 최대 ttl은 7일(공개 문서 기준)

/**
 * organizer의 Directory API 불변 사용자 ID를 resolve한다 — DB에 캐시된 값이 있으면
 * 그대로 재사용하고(Directory API를 매번 다시 호출하지 않음), 없으면 조회 후 그
 * 자리에서 캐시해 반환한다. 이메일을 리소스 이름에 직접 쓰지 않기 위한 유일한 경로.
 */
async function resolveOrganizerWorkspaceUserId(
  admin: ReturnType<typeof createAdminClient>,
  organizerEmail: string,
  cachedUserId: string | null,
  rowId: string | null
): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const user = await getWorkspaceUserByEmail(organizerEmail);
  if (!user) {
    throw new Error(`Directory API에서 ${organizerEmail} 사용자를 찾을 수 없습니다.`);
  }
  if (rowId) {
    await admin.from("workspace_events_subscriptions").update({ organizer_workspace_user_id: user.googleUserId }).eq("id", rowId);
  }
  return user.googleUserId;
}

/**
 * WORKSPACE_EVENTS_PUBSUB_TOPIC을 읽고 형식을 검증한다 — 웹훅 HTTP URL로 대체하지
 * 않는다. 값이 없거나 형식이 틀리면 실제 API를 호출하기 전에 여기서 즉시 실패한다
 * (fail-closed). 웹훅 URL(app/api/webhooks/workspace-events)은 이 토픽에 대한 별도
 * Pub/Sub push subscription의 엔드포인트로 GCP 콘솔에서 직접 연결하는 것이지, 이
 * 코드가 만드는 값이 아니다(개념 분리 — 문서 참고).
 */
const PUBSUB_TOPIC_PATTERN = /^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/[A-Za-z0-9_.~+%-]{3,255}$/;

function resolvePubsubTopic(): string {
  const topic = process.env.WORKSPACE_EVENTS_PUBSUB_TOPIC;
  if (!topic || !PUBSUB_TOPIC_PATTERN.test(topic)) {
    throw new Error(
      "WORKSPACE_EVENTS_PUBSUB_TOPIC이 없거나 형식이 올바르지 않습니다 — 'projects/{project}/topics/{topic}' 형식의 실제 Pub/Sub 토픽이 필요합니다(웹훅 URL 아님)."
    );
  }
  return topic;
}

type SubscriptionRow = {
  id: string;
  organizer_email: string;
  organizer_role: string;
  subscription_name: string | null;
  status: string;
  expires_at: string | null;
  last_error: string | null;
  organizer_workspace_user_id: string | null;
};

export type EnsureSubscriptionResult = {
  organizerEmail: string;
  status: "active" | "expiring" | "expired" | "error" | "disabled";
  action: "reused" | "created" | "renewed" | "recreated" | "skipped_disabled" | "failed";
};

/**
 * organizer(상담 관리자 또는 정규수업 담당 선생님)의 구독을 멱등하게 보장한다 —
 * 이미 유효하면 그대로 두고(중복 구독 방지), 만료 임박이면 갱신하고, 없거나
 * 만료/오류 상태면 새로 만든다. `disabled`(관리자가 수동으로 끈 상태)는 자동으로
 * 다시 켜지 않는다. 어떤 실패도 예외를 밖으로 던지지 않는다(best-effort — 호출부가
 * 예약/상담 확정 흐름과 무관하게 fire-and-forget으로 부를 수 있게).
 */
export async function ensureSubscriptionForOrganizer(
  organizerEmail: string,
  organizerRole: "consult_organizer" | "teacher"
): Promise<EnsureSubscriptionResult> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: existing } = await admin
    .from("workspace_events_subscriptions")
    .select("id, organizer_email, organizer_role, subscription_name, status, expires_at, last_error, organizer_workspace_user_id")
    .eq("organizer_email", organizerEmail)
    .maybeSingle();
  const row = existing as SubscriptionRow | null;

  if (row?.status === "disabled") {
    return { organizerEmail, status: "disabled", action: "skipped_disabled" };
  }

  const expiresAtMs = row?.expires_at ? new Date(row.expires_at).getTime() : null;
  const isFreshlyActive = row?.status === "active" && expiresAtMs !== null && expiresAtMs - now > RENEWAL_THRESHOLD_MS;
  if (isFreshlyActive) {
    await admin.from("workspace_events_subscriptions").update({ last_verified_at: new Date().toISOString() }).eq("id", row!.id);
    return { organizerEmail, status: "active", action: "reused" };
  }

  const needsRenewal = row?.status === "active" && row.subscription_name && expiresAtMs !== null && expiresAtMs - now <= RENEWAL_THRESHOLD_MS;
  if (needsRenewal) {
    try {
      const renewed = await renewWorkspaceEventsSubscription({
        organizerEmail,
        subscriptionName: row!.subscription_name!,
        ttlSeconds: DEFAULT_TTL_SECONDS,
      });
      await admin
        .from("workspace_events_subscriptions")
        .update({
          status: "active",
          expires_at: renewed.expireTime ?? new Date(now + DEFAULT_TTL_SECONDS * 1000).toISOString(),
          last_renewed_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row!.id);
      return { organizerEmail, status: "active", action: "renewed" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin
        .from("workspace_events_subscriptions")
        .update({ status: "error", last_error: message.slice(0, 500), last_verified_at: new Date().toISOString() })
        .eq("id", row!.id);
      return { organizerEmail, status: "error", action: "failed" };
    }
  }

  // 없거나(row null) expired/error 상태 — 새로 만든다(기존 행이 있으면 갱신, 없으면 삽입).
  // resolveOrganizerWorkspaceUserId()에 캐시할 rowId가 아직 없으면(row null) 이번 조회
  // 결과는 아래 upsert가 행을 만든 뒤에야 캐시된다 — 최초 1회는 캐시 없이 조회하고,
  // 성공하면 이번 upsert의 organizer_workspace_user_id 필드로 함께 저장한다.
  try {
    const organizerWorkspaceUserId = await resolveOrganizerWorkspaceUserId(admin, organizerEmail, row?.organizer_workspace_user_id ?? null, row?.id ?? null);
    const pubsubTopic = resolvePubsubTopic();
    const created = await createWorkspaceEventsSubscription({
      organizerEmail,
      organizerWorkspaceUserId,
      pubsubTopic,
      ttlSeconds: DEFAULT_TTL_SECONDS,
    });
    const payload = {
      organizer_email: organizerEmail,
      organizer_role: organizerRole,
      subscription_name: created.name,
      status: "active" as const,
      expires_at: created.expireTime ?? new Date(now + DEFAULT_TTL_SECONDS * 1000).toISOString(),
      organizer_workspace_user_id: organizerWorkspaceUserId,
      last_renewed_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      last_error: null,
    };
    if (row) {
      await admin.from("workspace_events_subscriptions").update(payload).eq("id", row.id);
    } else {
      await admin.from("workspace_events_subscriptions").insert(payload);
    }
    return { organizerEmail, status: "active", action: row ? "recreated" : "created" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const payload = {
      organizer_email: organizerEmail,
      organizer_role: organizerRole,
      status: "error" as const,
      last_error: message.slice(0, 500),
      last_verified_at: new Date().toISOString(),
    };
    if (row) {
      await admin.from("workspace_events_subscriptions").update(payload).eq("id", row.id);
    } else {
      await admin.from("workspace_events_subscriptions").insert(payload);
    }
    return { organizerEmail, status: "error", action: "failed" };
  }
}

/** 배치 워커 — 만료 임박/오류/만료된 구독 전부를 대상으로 ensureSubscriptionForOrganizer()를 재실행. */
export async function renewExpiringSubscriptions(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("workspace_events_subscriptions")
    .select("organizer_email, organizer_role")
    .neq("status", "disabled")
    .lte("expires_at", new Date(Date.now() + RENEWAL_THRESHOLD_MS).toISOString());

  for (const row of candidates ?? []) {
    await ensureSubscriptionForOrganizer(row.organizer_email as string, row.organizer_role as "consult_organizer" | "teacher");
  }
  return { processed: (candidates ?? []).length };
}

/** 관리자 수동 정지 — 이후 ensureSubscriptionForOrganizer()가 자동으로 다시 켜지 않는다. */
export async function disableSubscriptionForOrganizer(organizerEmail: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("workspace_events_subscriptions")
    .select("id, subscription_name")
    .eq("organizer_email", organizerEmail)
    .maybeSingle();
  if (!row) return;

  if (row.subscription_name) {
    try {
      await deleteWorkspaceEventsSubscription({ organizerEmail, subscriptionName: row.subscription_name });
    } catch (e) {
      // 삭제 실패해도 로컬 상태는 disabled로 남긴다 — 다음 관리자 재활성화 시도 때
      // 어차피 재생성 경로를 타므로 Google 쪽 잔여 구독은 별도 정리 대상으로만 기록.
      console.error(
        JSON.stringify({ type: "workspace_events_subscription_disable_delete_failed", organizerEmail, error: e instanceof Error ? e.message : String(e) })
      );
    }
  }
  await admin
    .from("workspace_events_subscriptions")
    .update({ status: "disabled", last_error: reason.slice(0, 500) })
    .eq("id", row.id);
}

type ReconciliationCandidate = { table: "consultations" | "sessions"; id: string; meetingCode: string; organizerEmail: string };

/**
 * 구독 장애·이벤트 유실 대비 Meet API 사후 대조(요구사항 1) — 이미 지난 상담·수업 중
 * Smart Notes 원본이 아직 연결되지 않은 것들을 골라 findRecentSmartNoteForMeetingCode()로
 * 다시 찾는다. 실패해도(찾지 못해도) 상담·수업을 자동 완료 처리하지 않는다 — 다음
 * 재처리 대상으로 그대로 남긴다.
 */
export async function reconcileMissedSmartNotesEvents(): Promise<{ checked: number; relinked: number }> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 시작 2시간 지난 것만(Smart Notes 생성 여유)

  const { data: consultCandidates } = await admin
    .from("consultations")
    .select("id, google_meeting_code")
    .is("smart_notes_drive_file_id", null)
    .not("google_meeting_code", "is", null)
    .lt("starts_at", cutoff)
    .in("status", ["scheduled", "completed"]);

  const candidates: ReconciliationCandidate[] = ((consultCandidates ?? []) as Array<{ id: string; google_meeting_code: string }>).map((c) => ({
    table: "consultations",
    id: c.id,
    meetingCode: c.google_meeting_code,
    organizerEmail: process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education",
  }));

  let relinked = 0;
  for (const candidate of candidates) {
    try {
      const found = await findRecentSmartNoteForMeetingCode({ teacherWorkspaceEmail: candidate.organizerEmail, meetingCode: candidate.meetingCode });
      if (found?.driveFileId) {
        await admin.from(candidate.table).update({ smart_notes_drive_file_id: found.driveFileId }).eq("id", candidate.id);
        relinked += 1;
      }
    } catch (e) {
      console.error(
        JSON.stringify({ type: "workspace_events_reconciliation_failed", table: candidate.table, id: candidate.id, error: e instanceof Error ? e.message : String(e) })
      );
    }
  }
  return { checked: candidates.length, relinked };
}
