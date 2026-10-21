import type { createAdminClient } from "@/lib/supabase-admin";
import { RUBRIC_VERSION } from "./rubric"; // 키에 rubricVersion 이 없으면 영어
import type { EssayKey, EssayStore, Finish, Row } from "./queue";
import type { Usage } from "./costs";

type Admin = ReturnType<typeof createAdminClient>;
const T = "mock_exam_essay_scores";
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();

/** service_role 저장소. claim 은 (1) 행 없으면 pending 으로 삽입(unique 충돌 무시) (2) pending/재시도 가능 failed 일 때만 단일 UPDATE 로 processing 전환 — 동시 호출 중 하나만 claimed=true. */
export function createSupabaseEssayStore(admin: Admin, now: () => Date = () => new Date()): EssayStore {
  const match = (q: any, k: EssayKey) => q.eq("attempt_id", k.attemptId).eq("set_item_id", k.setItemId).eq("part_label", k.partLabel).eq("rubric_version", k.rubricVersion ?? RUBRIC_VERSION); // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    async claim(k) {
      await admin.from(T).upsert({ attempt_id: k.attemptId, set_item_id: k.setItemId, part_label: k.partLabel, student_id: k.studentId, rubric_version: k.rubricVersion ?? RUBRIC_VERSION, status: "pending" }, { onConflict: "attempt_id,set_item_id,part_label,rubric_version", ignoreDuplicates: true });
      const t = now().toISOString();
      const { data: got } = await match(admin.from(T).update({ status: "processing", updated_at: t }).or(`status.eq.pending,and(status.eq.failed,next_retry_at.lte.${t})`), k).select("status, attempts_made, next_retry_at");
      if (got && got.length === 1) return { claimed: true, row: { status: "pending", attemptsMade: got[0].attempts_made, nextRetryAt: got[0].next_retry_at } as Row };
      const { data: cur } = await match(admin.from(T).select("status, attempts_made, next_retry_at"), k).maybeSingle();
      return { claimed: false, row: { status: (cur?.status ?? "failed") as Row["status"], attemptsMade: cur?.attempts_made ?? 0, nextRetryAt: cur?.next_retry_at ?? null } };
    },
    async usage(k): Promise<Usage> {
      const d = now();
      const [a, day, month] = await Promise.all([
        admin.from(T).select("set_item_id, part_label", { count: "exact", head: true }).eq("attempt_id", k.attemptId).neq("status", "skipped").neq("status", "pending").neq("set_item_id", k.setItemId).or("last_error.is.null,last_error.not.in.(daily_cap,monthly_budget,no_reference_answers)"),
        admin.from(T).select("id", { count: "exact", head: true }).eq("student_id", k.studentId).gte("created_at", dayStart(d)).neq("status", "skipped").or("last_error.is.null,last_error.not.in.(daily_cap,monthly_budget,no_reference_answers)"),
        admin.from(T).select("cost_usd").gte("created_at", monthStart(d)),
      ]);
      const spend = (month.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
      return { attemptEssays: a.count ?? 0, accountEssaysToday: Math.max(0, (day.count ?? 0) - 1), monthSpendUsd: spend };
    },
    async finish(k, f: Finish) {
      const patch: Record<string, unknown> = { status: f.status, updated_at: now().toISOString() };
      const map: [keyof Finish, string][] = [["model", "model"], ["scores", "scores"], ["rationale", "rationale"], ["attemptsMade", "attempts_made"], ["nextRetryAt", "next_retry_at"], ["lastError", "last_error"], ["inputTokens", "input_tokens"], ["outputTokens", "output_tokens"], ["costUsd", "cost_usd"]];
      for (const [from, to] of map) if (f[from] !== undefined) patch[to] = f[from];
      await match(admin.from(T).update(patch), k);
    },
  };
}
