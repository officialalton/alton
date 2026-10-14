"use server";

// 관리자 'AP 재고 관리' 서버 액션(2026-10-12 오너 승인). 터미널 스크립트(서비스 키 직접 입력)를 대체한다.
// 접속은 앱 서버의 기존 service-role 클라이언트(createAdminClient)만 쓰고, 사용자가 키를 입력하는 경로는 없다.
// 모든 액션은 requireAdmin() 뒤에서 실행되며, 쓰기는 환경 가드(허용 목록의 비프로덕션 ref)를 통과하고 미리보기와 같은 계획 해시일 때만 한다.
// 문서: docs/ap/admin-stock-screen.md
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { resolveStockTarget } from "@/lib/ap-admin/env-guard";
import { STOCK_BATCHES, batchArtifactsPresent, batchById, listPartialPlans, readPassKeys } from "@/lib/ap-admin/batches";
import { fetchReviewRows, listAssignments, loadCheck, recordRun, runAssemble, runAssemblePartial, runConvert, runImport, runVerify, type Ctx, type StepResult } from "@/lib/ap-admin/service";
import type { BatchCheck } from "@/lib/ap-admin/load-check";
import { computeBatchStatus, loadBatch, type BatchRun, type BatchStatus } from "@/lib/ap-admin/load-batch";
import { fetchLaunchGateReport, type LaunchGateReport } from "@/lib/ap-admin/launch-gate";

export type ApStockOverview = {
  target: { ref: string; kind: string; canWrite: boolean; reason: string | null };
  batches: { id: string; title: string; hasLoadStep: boolean; artifactsOk: boolean }[];
  assignments: { file: string; sets: { id: string; virtual: number; saveable: boolean }[] }[];
  partialPlans?: { file: string; sets: { id: string; name: string; partial: string }[] }[];
  history: { id: string; createdAt: string; actor: string; action: string; mode: string; status: string; targetRef: string; scope: Record<string, unknown>; counts: Record<string, number>; note: string | null }[];
};
export type ApStockStepInput = { step: "import" | "render" | "screen" | "convert"; batchId: string; execute: boolean; planHash?: string | null };
export type ApStockPartialInput = { planFile: string; setId: string; execute: boolean; planHash?: string | null; tier?: "free" | "tutoring" };
export type ApStockAssembleInput = { reportFile: string; setId: string; name?: string; execute: boolean; planHash?: string | null; tier?: "free" | "tutoring" };

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
    partialPlans: listPartialPlans(),
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

/** 단일 단계·배치 전체 적재가 같이 쓰는 한 단계 실행(감사 기록·환경 가드 포함). */
function runStepGuarded(c: Ctx, input: ApStockStepInput) {
  const mode = input.execute ? "execute" : "dry_run";
  const action = ({ import: "import", render: "render_verify", screen: "screen_verify", convert: "convert" } as const)[input.step];
  if (!action) throw new Error("알 수 없는 단계입니다.");
  return guarded(c, { action, mode, scope: { batchId: input.batchId } }, () => {
    if (input.step === "import") return runImport(c, input.batchId, input.execute, input.planHash);
    if (input.step === "convert") return runConvert(c, input.batchId, input.execute, input.planHash);
    return runVerify(c, input.step, input.batchId, input.execute, input.planHash);
  });
}

export async function apStockStepAction(input: ApStockStepInput): Promise<StepResult & { auditWarning?: string }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return runStepGuarded(c, input);
}

/** '배치 전체 적재': 한 배치의 ①→④ 를 기존 단계 함수 그대로(같은 가드·해시·감사 기록) 이어서 실행. 배치당 한 번 호출(서버 시간 제한 때문에 여러 배치는 화면이 순서대로 호출). */
export async function apStockLoadBatchAction(input: { batchId: string; execute: boolean; previewHash?: string | null }): Promise<BatchRun> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  batchById(input.batchId); // 알 수 없는 배치면 여기서 오류
  return loadBatch({ step: (i) => runStepGuarded(c, i), canWrite: c.target.canWrite, hasLoadStep: (id) => !!batchById(id).itemsFile }, input.batchId, input.execute, input.previewHash);
}

/** 배치별 적재 현황(읽기 전용): 기존 점검(ap_item_review_status_v) + 변환된 후보 수. 쿼리 ≈ ⌈DB행/1000⌉ + ⌈변환행/1000⌉. */
export async function apStockBatchStatusAction(): Promise<BatchStatus[]> {
  await requireAdmin();
  const db = createAdminClient();
  const rows = await fetchReviewRows(db);
  const converted = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("ap_candidate_items").select("candidate_key").not("problem_id", "is", null).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const x of data ?? []) converted.add(x.candidate_key as string);
    if (!data || data.length < 1000) break;
  }
  const batches = STOCK_BATCHES.filter((b) => batchArtifactsPresent(b).passKeys).map((b) => ({ id: b.id, keys: readPassKeys(b) }));
  return computeBatchStatus(batches, rows, converted);
}

export async function apStockAssembleAction(input: ApStockAssembleInput): Promise<StepResult & { auditWarning?: string }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "assemble_draft", mode: input.execute ? "execute" : "dry_run", scope: { reportFile: input.reportFile, setId: input.setId, tier: input.tier ?? "free" } }, () => runAssemble(c, input.reportFile, input.setId, input.name, input.execute, input.planHash, input.tier ?? "free"));
}

/** 부분 연습 세트(Non-Calculator / Calculator / Free-Response) 초안 저장 — 풀·부분 세트 전체와 겹침 0 검증. 공개·보관은 하지 않는다(보관은 기존 공개 탭). */
export async function apStockAssemblePartialAction(input: ApStockPartialInput): Promise<StepResult & { auditWarning?: string }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "assemble_draft", mode: input.execute ? "execute" : "dry_run", scope: { planFile: input.planFile, setId: input.setId, tier: input.tier ?? "free", partial: true } }, () => runAssemblePartial(c, input.planFile, input.setId, input.execute, input.planHash, input.tier ?? "free"));
}

/** 출시 차단·검증 현황(읽기 전용): 비보관 AP 세트 문항 중 ap_launch_ready_v 에 없는 것과 사유, 세트별 출시 게이트 판정. 쓰기·감사 기록 없음. */
export async function apLaunchGateStatusAction(): Promise<LaunchGateReport> {
  await requireAdmin();
  return fetchLaunchGateReport(createAdminClient());
}
