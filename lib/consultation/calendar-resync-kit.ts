import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-29 — Calendar 동기화 재시도 공통 뼈대. 미팅(meeting_requests)과 첫 상담(consultations)이 테이블·claim RPC·
// 실제 동기화 함수만 다르게 주입해 같은 규칙을 공유한다.
//  - 실제 Google 호출은 CALENDAR_SYNC_ALLOW_REAL_CALLS=true 일 때만(fail-closed) — 꺼져 있으면 아무것도 claim 하지 않는다.
//  - claim 은 DB RPC(for update skip locked + 10분 임대)라 즉시 재시도와 크론이 같은 행을 동시에 처리하지 못한다.
//  - 시도는 google_sync_retry_count 로 세고 5회에서 멈춘다(reconciliation_needed = 자동 재시도 중단, 관리자 확인 필요).
//  - 실제 동기화(syncOne)는 호출부가 멱등하게 구현한다(이벤트 없음→생성 / 있음→PATCH / 취소됨+이벤트 있음→삭제).

export const CALENDAR_SYNC_MAX_ATTEMPTS = 5;

export function isCalendarSyncEnabled(): boolean {
  return process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS === "true";
}

export type SyncOutcome = "synced" | "failed" | "permanent" | "skipped";

export type ResyncKitConfig<Row extends { id: string; google_sync_retry_count: number | null }> = {
  table: string;
  claimRpc: string;
  /** claim RPC 의 단일 행 파라미터 이름(p_meeting_request_id / p_consultation_id). */
  claimIdParam: string;
  /** 성공 시 google_sync_status 값(미팅 'succeeded' / 상담 'synced'). */
  successStatus: string;
  logPrefix: string;
  syncOne: (admin: SupabaseClient, row: Row) => Promise<void>;
  /** 5회 실패로 자동 재시도가 멈출 때 한 번 호출(예: fallback 안내 메일). 실패해도 삼킨다. */
  onPermanent?: (admin: SupabaseClient, row: Row, message: string) => Promise<void>;
};

export function createCalendarResyncKit<Row extends { id: string; google_sync_retry_count: number | null }>(
  cfg: ResyncKitConfig<Row>
) {
  /** claim 된 행 하나를 처리하고 결과를 기록한다. 절대 throw 하지 않는다. */
  async function processClaimed(admin: SupabaseClient, row: Row): Promise<SyncOutcome> {
    const now = new Date().toISOString();
    try {
      await cfg.syncOne(admin, row);
      await admin
        .from(cfg.table)
        .update({
          google_sync_status: cfg.successStatus,
          google_sync_last_error: null,
          google_sync_last_attempt_at: now,
          google_sync_claimed_at: null,
        })
        .eq("id", row.id);
      return "synced";
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const attempts = (row.google_sync_retry_count ?? 0) + 1;
      const permanent = attempts >= CALENDAR_SYNC_MAX_ATTEMPTS;
      await admin
        .from(cfg.table)
        .update({
          google_sync_status: permanent ? "reconciliation_needed" : "failed",
          google_sync_retry_count: attempts,
          google_sync_last_error: message,
          google_sync_last_attempt_at: now,
          google_sync_claimed_at: null,
        })
        .eq("id", row.id);
      console.error(JSON.stringify({ event: `${cfg.logPrefix}_resync_failed`, id: row.id, attempts, permanent, error: message }));
      if (permanent && cfg.onPermanent) {
        try {
          await cfg.onPermanent(admin, row, message);
        } catch (hookError) {
          console.error(JSON.stringify({ event: `${cfg.logPrefix}_permanent_hook_failed`, id: row.id, error: hookError instanceof Error ? hookError.message : String(hookError) }));
        }
      }
      return permanent ? "permanent" : "failed";
    }
  }

  async function claim(admin: SupabaseClient, limit: number, id?: string): Promise<Row[]> {
    const { data, error } = await admin.rpc(cfg.claimRpc, {
      p_limit: limit,
      [cfg.claimIdParam]: id ?? null,
      p_max_attempts: CALENDAR_SYNC_MAX_ATTEMPTS,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  }

  /** 특정 행 하나를 지금 재시도한다. 기본은 게이트가 꺼져 있으면 아무것도 하지 않는다(skipGate 는 호출부가 이미 실행을 결정한 경로용). */
  async function resyncNow(id: string, opts: { skipGate?: boolean } = {}): Promise<SyncOutcome> {
    if (!opts.skipGate && !isCalendarSyncEnabled()) return "skipped";
    const admin = createAdminClient();
    const [row] = await claim(admin, 1, id);
    if (!row) return "skipped";
    return processClaimed(admin, row);
  }

  async function runBatch(limit = 20): Promise<{ claimed: number; synced: number; failed: number; permanent: number; enabled: boolean }> {
    if (!isCalendarSyncEnabled()) return { claimed: 0, synced: 0, failed: 0, permanent: 0, enabled: false };
    const admin = createAdminClient();
    const rows = await claim(admin, limit);
    const out = { claimed: rows.length, synced: 0, failed: 0, permanent: 0, enabled: true };
    for (const row of rows) {
      const r = await processClaimed(admin, row);
      if (r === "synced") out.synced += 1;
      else if (r === "permanent") out.permanent += 1;
      else out.failed += 1;
    }
    return out;
  }

  /** 실패한 액션 직후 호출 — 응답을 막지 않고(after) 어떤 오류도 삼킨다. */
  function schedule(id: string): void {
    const run = async () => {
      try {
        await resyncNow(id);
      } catch (e) {
        console.error(JSON.stringify({ event: `${cfg.logPrefix}_immediate_resync_failed`, error: e instanceof Error ? e.message : String(e) }));
      }
    };
    try {
      if (!isCalendarSyncEnabled()) return;
      try {
        after(run);
      } catch {
        void run();
      }
    } catch (e) {
      console.error(JSON.stringify({ event: `${cfg.logPrefix}_immediate_resync_failed`, error: e instanceof Error ? e.message : String(e) }));
    }
  }

  /** 관리자 수동 재동기화 — 자동 재시도 중단(5회)도 횟수를 0으로 되돌려 다시 시도한다. */
  async function forceResync(id: string): Promise<SyncOutcome> {
    if (!isCalendarSyncEnabled()) {
      throw new Error("실제 Google 호출이 꺼져 있어(CALENDAR_SYNC_ALLOW_REAL_CALLS) 재동기화할 수 없습니다.");
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(cfg.table)
      .update({ google_sync_status: "failed", google_sync_retry_count: 0, google_sync_claimed_at: null })
      .eq("id", id)
      .in("google_sync_status", ["failed", "reconciliation_needed"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("재동기화가 필요한 상태가 아닙니다.");
    return resyncNow(id);
  }

  return { processClaimed, claim, resyncNow, runBatch, schedule, forceResync };
}
