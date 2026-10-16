"use server";

import { requireAdmin } from "@/lib/admin-auth";
import {
  HOLD_SUBJECT_TYPES,
  isUuid,
  reasonError,
  reviewByError,
  type ActionResult,
  type DeletionQueueView,
  type DeletionTargetRow,
  type HoldEventRow,
  type HoldRequestRow,
  type HoldRow,
  type HoldSubjectType,
  type LegalHoldsView,
} from "./retention-data";

// 2026-10-07 — 관리자 '보존' 화면 서버 액션. 쓰기는 전부 기존 SECURITY DEFINER 함수
// (place/extend/release/request/decide_legal_hold*, retention_retry_deletion_target)만 호출한다 —
// 테이블 직접 INSERT/UPDATE 없음. 지정자·마스터 판정은 DB 함수가 최종 방어선이고, 여기서는 빠른 오류용.
// 조회는 사용자 클라이언트(RLS: is_admin())만 쓴다 — service-role 미사용.

type Sb = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const HOLD_LIMIT = 200;
const QUEUE_LIMIT = 300;

async function isHolder(supabase: Sb): Promise<boolean> {
  const { data } = await supabase.rpc("is_legal_hold_holder");
  return data === true;
}

async function isMaster(supabase: Sb, uid: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("admin_tier").eq("id", uid).single();
  return data?.admin_tier === "master";
}

function fail(e: unknown): ActionResult {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "처리하지 못했습니다.";
  return { ok: false, error: msg };
}

function validSubject(type: string, id: string | null): string | null {
  if (!(HOLD_SUBJECT_TYPES as readonly string[]).includes(type)) return "대상 종류가 올바르지 않습니다.";
  if (type === "global") return null;
  if (!id || !isUuid(id)) return "대상을 선택해 주세요.";
  return null;
}

// ---------------------------------------------------------------------------
// 조회 — 호출 1회당 쿼리: 프로필(권한) 1 + rpc 1 + holds 1 + events 1 + requests 1 + 이름 1 = 6 (+ 대상 라벨 0: 이름 쿼리에 합침).
export async function loadLegalHoldsAction(): Promise<LegalHoldsView> {
  const { supabase, adminUserId } = await requireAdmin();
  const [holder, holdsRes, reqRes] = await Promise.all([
    isHolder(supabase),
    supabase
      .from("legal_holds")
      .select("id, subject_type, subject_id, scope, reason, set_by, set_at, review_by, released_by, released_at, release_note")
      .order("released_at", { ascending: false, nullsFirst: true })
      .order("review_by", { ascending: true })
      .limit(HOLD_LIMIT),
    supabase
      .from("legal_hold_requests")
      .select("id, subject_type, subject_id, scope, reason, requested_by, requested_at, status, decided_by, decided_at, decision_note")
      .order("requested_at", { ascending: false })
      .limit(HOLD_LIMIT),
  ]);
  if (holdsRes.error) throw new Error(holdsRes.error.message);
  if (reqRes.error) throw new Error(reqRes.error.message);
  const holds = holdsRes.data ?? [];
  // 비지정 관리자는 본인 요청만(지정자는 전체). 승인·반려 큐는 지정자 전용.
  const requests = (reqRes.data ?? []).filter((r) => holder || r.requested_by === adminUserId);

  const holdIds = holds.map((h) => h.id as string);
  const eventsRes = holdIds.length
    ? await supabase
        .from("legal_hold_events")
        .select("id, hold_id, event_type, actor_id, review_by, note, created_at")
        .in("hold_id", holdIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const events = eventsRes.data ?? [];

  const profileIds = new Set<string>();
  for (const h of holds) {
    for (const v of [h.set_by, h.released_by]) if (v) profileIds.add(v as string);
    if ((h.subject_type === "profile" || h.subject_type === "student") && h.subject_id) profileIds.add(h.subject_id as string);
  }
  for (const r of requests) {
    for (const v of [r.requested_by, r.decided_by]) if (v) profileIds.add(v as string);
    if ((r.subject_type === "profile" || r.subject_type === "student") && r.subject_id) profileIds.add(r.subject_id as string);
  }
  for (const e of events) if (e.actor_id) profileIds.add(e.actor_id as string);

  const names = new Map<string, string>();
  if (profileIds.size) {
    const { data } = await supabase.from("profiles").select("id, name").in("id", [...profileIds]);
    for (const p of data ?? []) names.set(p.id as string, (p.name as string | null) ?? "");
  }
  const nm = (id: unknown) => (id ? names.get(id as string) || null : null);
  const label = (type: string, id: unknown): string | null =>
    type === "global" ? "전체" : type === "profile" || type === "student" ? nm(id) : null;

  const eventsByHold = new Map<string, HoldEventRow[]>();
  for (const e of events) {
    const list = eventsByHold.get(e.hold_id as string) ?? [];
    list.push({
      id: e.id as string,
      eventType: e.event_type as HoldEventRow["eventType"],
      actorName: nm(e.actor_id),
      reviewBy: (e.review_by as string | null) ?? null,
      note: (e.note as string | null) ?? null,
      createdAt: e.created_at as string,
    });
    eventsByHold.set(e.hold_id as string, list);
  }

  const holdRows: HoldRow[] = holds.map((h) => ({
    id: h.id as string,
    subjectType: h.subject_type as HoldSubjectType,
    subjectId: (h.subject_id as string | null) ?? null,
    subjectLabel: label(h.subject_type as string, h.subject_id),
    scope: (h.scope as string[]) ?? [],
    reason: h.reason as string,
    setByName: nm(h.set_by),
    setAt: h.set_at as string,
    reviewBy: h.review_by as string,
    releasedAt: (h.released_at as string | null) ?? null,
    releasedByName: nm(h.released_by),
    releaseNote: (h.release_note as string | null) ?? null,
    events: eventsByHold.get(h.id as string) ?? [],
  }));

  const requestRows: HoldRequestRow[] = requests.map((r) => ({
    id: r.id as string,
    subjectType: r.subject_type as HoldSubjectType,
    subjectId: (r.subject_id as string | null) ?? null,
    subjectLabel: label(r.subject_type as string, r.subject_id),
    scope: (r.scope as string[]) ?? [],
    reason: r.reason as string,
    requestedByName: nm(r.requested_by),
    requestedByMe: r.requested_by === adminUserId,
    requestedAt: r.requested_at as string,
    status: r.status as HoldRequestRow["status"],
    decidedByName: nm(r.decided_by),
    decidedAt: (r.decided_at as string | null) ?? null,
    decisionNote: (r.decision_note as string | null) ?? null,
  }));

  return { isHolder: holder, holds: holdRows, requests: requestRows };
}

// 대상 검색(선택 시 1회성 요청). 이름 검색은 계정·학생, 그 외 종류는 UUID 존재 확인.
const EXISTENCE_TABLE: Partial<Record<HoldSubjectType, string>> = {
  household: "households",
  consultation: "consultations",
  enrollment: "subject_enrollments",
  session: "sessions",
  prospect_contact: "prospect_contacts",
  consult_request: "consult_requests",
};

export async function searchHoldTargetsAction(type: string, query: string): Promise<{ id: string; label: string }[]> {
  const { supabase } = await requireAdmin();
  const q = query.trim();
  if (!q || q.length > 100) return [];
  if (type === "profile" || type === "student") {
    const safe = q.replace(/[%_,()]/g, " ").trim();
    if (!safe) return [];
    const { data } = await supabase.from("profiles").select("id, name, role").ilike("name", `%${safe}%`).limit(10);
    return (data ?? []).map((p) => ({ id: p.id as string, label: `${(p.name as string) || "(이름 없음)"} · ${p.role as string}` }));
  }
  const table = EXISTENCE_TABLE[type as HoldSubjectType];
  if (!table || !isUuid(q)) return [];
  const { data } = await supabase.from(table).select("id").eq("id", q.trim()).limit(1);
  return (data ?? []).map((r) => ({ id: r.id as string, label: `${r.id as string}` }));
}

// ---------------------------------------------------------------------------
// 쓰기 — 지정자 전용
async function requireHolder() {
  const ctx = await requireAdmin();
  if (!(await isHolder(ctx.supabase))) throw new Error("지정된 legal hold 담당자만 사용할 수 있습니다.");
  return ctx;
}

export async function placeLegalHoldAction(input: {
  subjectType: string;
  subjectId: string | null;
  reason: string;
  reviewBy: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireHolder();
    const err = validSubject(input.subjectType, input.subjectId) ?? reasonError(input.reason) ?? reviewByError(input.reviewBy);
    if (err) return { ok: false, error: err };
    const { error } = await supabase.rpc("place_legal_hold", {
      p_subject_type: input.subjectType,
      p_subject_id: input.subjectType === "global" ? null : input.subjectId,
      p_scope: ["all"],
      p_reason: input.reason.trim(),
      p_review_by: input.reviewBy,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function extendLegalHoldAction(holdId: string, note: string, newReviewBy: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireHolder();
    const err = (isUuid(holdId) ? null : "보류를 찾을 수 없습니다.") ?? reasonError(note, "연장 사유") ?? reviewByError(newReviewBy);
    if (err) return { ok: false, error: err };
    const { error } = await supabase.rpc("extend_legal_hold", { p_hold_id: holdId, p_new_review_by: newReviewBy, p_note: note.trim() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function releaseLegalHoldAction(holdId: string, note: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireHolder();
    const err = (isUuid(holdId) ? null : "보류를 찾을 수 없습니다.") ?? reasonError(note, "해제 사유");
    if (err) return { ok: false, error: err };
    const { error } = await supabase.rpc("release_legal_hold", { p_hold_id: holdId, p_note: note.trim() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function decideLegalHoldRequestAction(
  requestId: string,
  approve: boolean,
  note: string,
  reviewBy: string | null
): Promise<ActionResult> {
  try {
    const { supabase } = await requireHolder();
    if (!isUuid(requestId)) return { ok: false, error: "요청을 찾을 수 없습니다." };
    if (approve) {
      const err = reviewByError(reviewBy ?? "");
      if (err) return { ok: false, error: `승인하려면 재검토일이 필요합니다. ${err}` };
    }
    const { error } = await supabase.rpc("decide_legal_hold_request", {
      p_request_id: requestId,
      p_approve: approve,
      p_note: note.trim() || (approve ? "approved" : "rejected"),
      p_review_by: approve ? reviewBy : null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// 일반 관리자도 가능(지정자 포함 — 지정자는 직접 설정하는 편이 빠르지만 막지 않는다).
export async function requestLegalHoldAction(input: {
  subjectType: string;
  subjectId: string | null;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const err = validSubject(input.subjectType, input.subjectId) ?? reasonError(input.reason);
    if (err) return { ok: false, error: err };
    const { error } = await supabase.rpc("request_legal_hold", {
      p_subject_type: input.subjectType,
      p_subject_id: input.subjectType === "global" ? null : input.subjectId,
      p_scope: ["all"],
      p_reason: input.reason.trim(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// 삭제 대기열 — 조회는 관리자 전원(RLS), '지금 재시도'는 지정자·마스터만.
// 쿼리: 프로필 1 + rpc 1 + 마스터 프로필 1 + 미완료(대기·실패) 1 + 최근 삭제 완료 1 = 5.
const QUEUE_COLS =
  "id, category, source_table, drive_file_id, status, attempts, last_error, first_failed_at, escalated_at, due_at, next_attempt_at, deleted_at";
const RECENT_DELETED = 30;

export async function loadDeletionQueueAction(): Promise<DeletionQueueView> {
  const { supabase, adminUserId } = await requireAdmin();
  const [holder, master, openRes, doneRes] = await Promise.all([
    isHolder(supabase),
    isMaster(supabase, adminUserId),
    supabase
      .from("retention_deletion_targets")
      .select(QUEUE_COLS)
      .in("status", ["pending", "failed"])
      .order("next_attempt_at", { ascending: true })
      .limit(QUEUE_LIMIT + 1),
    supabase
      .from("retention_deletion_targets")
      .select(QUEUE_COLS)
      .eq("status", "deleted")
      .order("deleted_at", { ascending: false })
      .limit(RECENT_DELETED),
  ]);
  if (openRes.error) throw new Error(openRes.error.message);
  if (doneRes.error) throw new Error(doneRes.error.message);
  const open = openRes.data ?? [];
  const toRow = (r: Record<string, unknown>): DeletionTargetRow => ({
    id: r.id as string,
    category: r.category as string,
    sourceTable: r.source_table as string,
    driveFileId: r.drive_file_id as string,
    status: r.status as DeletionTargetRow["status"],
    attempts: r.attempts as number,
    lastError: (r.last_error as string | null) ?? null,
    firstFailedAt: (r.first_failed_at as string | null) ?? null,
    escalatedAt: (r.escalated_at as string | null) ?? null,
    dueAt: r.due_at as string,
    nextAttemptAt: r.next_attempt_at as string,
    deletedAt: (r.deleted_at as string | null) ?? null,
  });
  return {
    canRetry: holder || master,
    rows: [...open.slice(0, QUEUE_LIMIT), ...(doneRes.data ?? [])].map(toRow),
    truncated: open.length > QUEUE_LIMIT,
  };
}

export async function retryDeletionTargetAction(targetId: string, note?: string): Promise<ActionResult> {
  try {
    const { supabase, adminUserId } = await requireAdmin();
    if (!isUuid(targetId)) return { ok: false, error: "대상을 찾을 수 없습니다." };
    if (!(await isHolder(supabase)) && !(await isMaster(supabase, adminUserId))) {
      return { ok: false, error: "지정된 legal hold 담당자 또는 마스터 관리자만 재시도할 수 있습니다." };
    }
    const { error } = await supabase.rpc("retention_retry_deletion_target", { p_id: targetId, p_note: note?.trim() || null });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
