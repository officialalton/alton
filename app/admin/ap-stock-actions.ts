"use server";

// 관리자 'AP 재고 관리' 서버 액션(2026-10-12 오너 승인). 터미널 스크립트(서비스 키 직접 입력)를 대체한다.
// 접속은 앱 서버의 기존 service-role 클라이언트(createAdminClient)만 쓰고, 사용자가 키를 입력하는 경로는 없다.
// 모든 액션은 requireAdmin() 뒤에서 실행되며, 쓰기는 환경 가드(허용 목록의 비프로덕션 ref)를 통과하고 미리보기와 같은 계획 해시일 때만 한다.
// 문서: docs/ap/admin-stock-screen.md
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { resolveStockTarget } from "@/lib/ap-admin/env-guard";
import { STOCK_BATCHES, batchArtifactsPresent } from "@/lib/ap-admin/batches";
import { listAssignments, loadCheck, recordRun, runAssemble, runConvert, runImport, runVerify, type Ctx, type StepResult } from "@/lib/ap-admin/service";
import type { BatchCheck } from "@/lib/ap-admin/load-check";

export type ApStockOverview = {
  target: { ref: string; kind: string; canWrite: boolean; reason: string | null };
  batches: { id: string; title: string; hasLoadStep: boolean; artifactsOk: boolean }[];
  assignments: { file: string; sets: { id: string; virtual: number; saveable: boolean }[] }[];
  history: { id: string; createdAt: string; actor: string; action: string; mode: string; status: string; targetRef: string; scope: Record<string, unknown>; counts: Record<string, number>; note: string | null }[];
};
export type ApStockStepInput = { step: "import" | "render" | "screen" | "convert"; batchId: string; execute: boolean; planHash?: string | null };
export type ApStockAssembleInput = { reportFile: string; setId: string; name?: string; execute: boolean; planHash?: string | null };

const target = () => resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, AP_STOCK_ADMIN_ALLOWED_REFS: process.env.AP_STOCK_ADMIN_ALLOWED_REFS, AP_STOCK_ADMIN_BLOCKED_REFS: process.env.AP_STOCK_ADMIN_BLOCKED_REFS, VERCEL_ENV: process.env.VERCEL_ENV });

/** 감사 기록 + 오류를 사용자 문구로 변환하는 공통 래퍼(비밀값은 오류에 담기지 않는다). */
async function guarded(c: Ctx, fallback: Omit<StepResult, "lines" | "ok" | "blocked" | "planHash" | "executed" | "counts" | "target">, run: () => Promise<StepResult>): Promise<StepResult & { auditWarning?: string }> {
  let r: StepResult;
  try { r = await run(); }
  catch (e) {
    const msg = e instanceof Error ? e.message : "실패";
    r = { ...fallback, target: { ref: c.target.ref, kind: c.target.kind, canWrite: c.target.canWrite, reason: c.target.reason }, executed: false, counts: {}, lines: [], planHash: null, blocked: msg, ok: false };
    await recordRun(c, r, "error", msg);
    return r;
  }
  // 로그: 실행(execute)은 항상, 미리보기도 기록한다(누가 무엇을 봤는지). 거부된 실행은 refused.
  const status = r.blocked && r.mode === "execute" ? "refused" : r.ok || r.mode === "dry_run" ? "ok" : "refused";
  const warn = await recordRun(c, r, status);
  return warn ? { ...r, auditWarning: `작업 이력 기록 실패: ${warn}` } : r;
}

export async function getApStockOverviewAction(): Promise<ApStockOverview> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: runs } = await db.from("ap_stock_admin_runs").select("id, created_at, actor_id, action, mode, status, target_ref, scope, counts, note").order("created_at", { ascending: false }).limit(30);
  const ids = [...new Set((runs ?? []).map((r) => r.actor_id as string | null).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) { const { data } = await db.from("profiles").select("id, name").in("id", ids); for (const p of data ?? []) names.set(p.id as string, (p.name as string) ?? ""); }
  const t = target();
  return {
    target: { ref: t.ref, kind: t.kind, canWrite: t.canWrite, reason: t.reason },
    batches: STOCK_BATCHES.map((b) => { const a = batchArtifactsPresent(b); return { id: b.id, title: b.title, hasLoadStep: !!b.itemsFile, artifactsOk: a.items && a.passKeys && a.evidence }; }),
    assignments: listAssignments(),
    history: (runs ?? []).map((r) => ({ id: r.id as string, createdAt: r.created_at as string, actor: names.get(r.actor_id as string) || (r.actor_id ? String(r.actor_id).slice(0, 8) : "-"), action: r.action as string, mode: r.mode as string, status: r.status as string, targetRef: r.target_ref as string, scope: (r.scope ?? {}) as Record<string, unknown>, counts: (r.counts ?? {}) as Record<string, number>, note: (r.note as string | null) ?? null })),
  };
}

export async function apStockLoadCheckAction(): Promise<{ result: StepResult; batches: BatchCheck[]; totals: { keys: number; ready: number; shortBatches: number; dbRows: number } }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  const out = await loadCheck(c);
  await recordRun(c, out.result, "ok");
  return { result: out.result, batches: out.check.batches, totals: out.check.totals };
}

export async function apStockStepAction(input: ApStockStepInput): Promise<StepResult & { auditWarning?: string }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  const mode = input.execute ? "execute" : "dry_run";
  const action = ({ import: "import", render: "render_verify", screen: "screen_verify", convert: "convert" } as const)[input.step];
  if (!action) throw new Error("알 수 없는 단계입니다.");
  return guarded(c, { action, mode, scope: { batchId: input.batchId } }, () => {
    if (input.step === "import") return runImport(c, input.batchId, input.execute, input.planHash);
    if (input.step === "convert") return runConvert(c, input.batchId, input.execute, input.planHash);
    return runVerify(c, input.step, input.batchId, input.execute, input.planHash);
  });
}

export async function apStockAssembleAction(input: ApStockAssembleInput): Promise<StepResult & { auditWarning?: string }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "assemble_draft", mode: input.execute ? "execute" : "dry_run", scope: { reportFile: input.reportFile, setId: input.setId } }, () => runAssemble(c, input.reportFile, input.setId, input.name, input.execute, input.planHash));
}
