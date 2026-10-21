import type { createAdminClient } from "@/lib/supabase-admin";
import { RUBRIC_VERSION } from "./rubric"; // 키에 rubricVersion 이 없으면 영어
import type { EssayKey, EssayStore, Finish, Row } from "./queue";
import type { Usage } from "./costs";

type Admin = ReturnType<typeof createAdminClient>;
const T = "mock_exam_essay_scores";
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
const noRpc = (e: { code?: string } | null) => e?.code === "PGRST202" || e?.code === "42883"; // 마이그레이션 20261101100000 미적용(함수 없음)
const EV = "essay_ai_cost_events"; // 비용 원장(마이그레이션 20261101100000): 호출 실행마다 발생 시각과 함께 기록. 월·일 귀속은 여기서만 정한다.
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();

/** service_role 저장소. claim 은 (1) 행 없으면 pending 으로 삽입(unique 충돌 무시) (2) pending/재시도 가능 failed 일 때만 단일 UPDATE 로 processing 전환 — 동시 호출 중 하나만 claimed=true. */
export function createSupabaseEssayStore(admin: Admin, now: () => Date = () => new Date()): EssayStore {
  const match = (q: any, k: EssayKey) => q.eq("attempt_id", k.attemptId).eq("set_item_id", k.setItemId).eq("part_label", k.partLabel).eq("rubric_version", k.rubricVersion ?? RUBRIC_VERSION); // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    async claim(k) {
      await admin.from(T).upsert({ attempt_id: k.attemptId, set_item_id: k.setItemId, part_label: k.partLabel, student_id: k.studentId, rubric_version: k.rubricVersion ?? RUBRIC_VERSION, status: "pending" }, { onConflict: "attempt_id,set_item_id,part_label,rubric_version", ignoreDuplicates: true });
      const t = now().toISOString();
      const { data: got } = await match(admin.from(T).update({ status: "processing" }).or(`status.eq.pending,and(status.eq.failed,next_retry_at.lte.${t})`), k).select("status, attempts_made, next_retry_at");
      if (got && got.length === 1) return { claimed: true, row: { status: "pending", attemptsMade: got[0].attempts_made, nextRetryAt: got[0].next_retry_at } as Row };
      const { data: cur } = await match(admin.from(T).select("status, attempts_made, next_retry_at"), k).maybeSingle();
      return { claimed: false, row: { status: (cur?.status ?? "failed") as Row["status"], attemptsMade: cur?.attempts_made ?? 0, nextRetryAt: cur?.next_retry_at ?? null } };
    },
    async usage(k): Promise<Usage> {
      const d = now();
      const [a, day, month] = await Promise.all([
        admin.from(T).select("set_item_id, part_label", { count: "exact", head: true }).eq("attempt_id", k.attemptId).neq("status", "skipped").neq("status", "pending").neq("set_item_id", k.setItemId).or("last_error.is.null,last_error.not.in.(daily_cap,monthly_budget,no_reference_answers)"),
        admin.from(T).select("id", { count: "exact", head: true }).eq("student_id", k.studentId).gte("created_at", dayStart(d)).neq("status", "skipped").or("last_error.is.null,last_error.not.in.(daily_cap,monthly_budget,no_reference_answers)"),
        admin.rpc("essay_ai_month_spend", { p_now: d.toISOString() }), // 이번 달(UTC) 실행에서 발생한 비용(확정 + 유효 예약)만. 행 누적값·updated_at 은 쓰지 않는다
      ]);
      // 마이그레이션 미적용이면 예전 근사(행 updated_at 월)로 대체 — 예산 집계가 0 으로 무너지지 않게 한다. 적용 후에는 원장만 쓴다.
      const spend = noRpc(month.error)
        ? ((await admin.from(T).select("cost_usd").gte("updated_at", monthStart(d))).data ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0)
        : Number(month.data ?? 0);
      return { attemptEssays: a.count ?? 0, accountEssaysToday: Math.max(0, (day.count ?? 0) - 1), monthSpendUsd: spend };
    },
    async reserveBudget(k, amountUsd, budgetUsd) {
      const { data: row } = await match(admin.from(T).select("id"), k).maybeSingle();
      if (!row) return { ok: false };
      const { data, error } = await admin.rpc("reserve_essay_ai_budget", { p_score_id: row.id, p_student_id: k.studentId, p_amount: amountUsd, p_budget: budgetUsd, p_now: now().toISOString() });
      if (noRpc(error)) return { ok: true, reservationId: "" }; // 미적용 환경: 예약 없이 진행(사전 검사만 — 소프트 한도)
      return error || !data ? { ok: false } : { ok: true, reservationId: String(data) };
    },
    async finish(k, f: Finish) {
      const patch: Record<string, unknown> = { status: f.status, updated_at: now().toISOString() };
      const map: [keyof Finish, string][] = [["model", "model"], ["scores", "scores"], ["rationale", "rationale"], ["attemptsMade", "attempts_made"], ["nextRetryAt", "next_retry_at"], ["lastError", "last_error"], ["inputTokens", "input_tokens"], ["outputTokens", "output_tokens"], ["costUsd", "cost_usd"]];
      for (const [from, to] of map) if (f[from] !== undefined) patch[to] = f[from];
      // 비용·토큰은 호출 단위 증분이다 — 행에는 응답별 누적으로 합산하고(덮어쓰면 재시도 때 과거 지출이 사라진다), 월 귀속은 원장 이벤트(이번 실행분만)로 따로 기록한다.
      // claim 한 하나의 작업자만 processing 행을 쓰므로 읽고-더하기는 안전하다.
      const { data: prev } = await match(admin.from(T).select("id, cost_usd, input_tokens, output_tokens, updated_at"), k).maybeSingle();
      if (prev?.id && Number(prev.cost_usd ?? 0) > 0) {
        // 원장 이전에 쌓인 누적 비용(이벤트 없음)은 이 갱신이 updated_at 을 바꾸기 전에 마지막 갱신 시각의 legacy 이벤트로 고정한다 — 비용 0 인 상태 갱신도 그 월을 옮기지 못한다.
        const { count } = await admin.from(EV).select("id", { count: "exact", head: true }).eq("essay_score_id", prev.id).in("state", ["settled", "legacy"]);
        if (!count) await admin.from(EV).insert({ essay_score_id: prev.id, student_id: k.studentId, state: "legacy", model: f.model ?? null, input_tokens: Number(prev.input_tokens ?? 0), output_tokens: Number(prev.output_tokens ?? 0), cost_usd: Number(prev.cost_usd), occurred_at: prev.updated_at });
      }
      if (f.costUsd !== undefined || f.inputTokens !== undefined || f.outputTokens !== undefined || f.reservationId) {
        const cost = f.costUsd ?? 0, inT = f.inputTokens ?? 0, outT = f.outputTokens ?? 0;
        patch.cost_usd = Math.round((Number(prev?.cost_usd ?? 0) + cost) * 100_000) / 100_000;
        patch.input_tokens = Number(prev?.input_tokens ?? 0) + inT;
        patch.output_tokens = Number(prev?.output_tokens ?? 0) + outT;
        if (prev?.id && (cost > 0 || f.reservationId)) {
          const ev = { state: "settled", model: f.model ?? null, input_tokens: inT, output_tokens: outT, cost_usd: cost };
          if (f.reservationId) await admin.from(EV).update(ev).eq("id", f.reservationId); // 예약 → 실비 정산(발생 시각은 실행 시작 시각 유지, 비용 0 이면 해제)
          else await admin.from(EV).insert({ ...ev, essay_score_id: prev.id, student_id: k.studentId, occurred_at: now().toISOString() });
        }
      }
      await match(admin.from(T).update(patch), k);
    },
  };
}
