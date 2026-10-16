"use server";

// 관리자 'AB/AP 세트 새 버전' + 공개 범위 서버 액션(2026-10-12 오너 승인). 모든 액션은 requireAdmin() 뒤에서 실행된다.
// 새 버전 초안 만들기는 기존 createMockExamNewVersionAction, 공개는 기존 publishMockExamSet(원자적 RPC)을 그대로 호출한다 — 이 파일은 계획 해석·미리보기·환경 가드·감사 로그만 얹는다.
// 쓰기는 환경 가드(허용 목록의 비프로덕션 ref)를 통과하고 미리보기와 같은 계획 해시일 때만. 공개본(v1)·응시·답안·결과는 쓰지 않는다. 문서: docs/ap/set-new-version-design.md
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { resolveStockTarget } from "@/lib/ap-admin/env-guard";
import { recordRun, type Ctx, type StepResult } from "@/lib/ap-admin/service";
import { listSwapPlans, readSwapPlan, type NewVersionPreview, type PlanListing, type PlanSwapInput } from "@/lib/ap-admin/new-version";
import { runNewVersionDraft, runNewVersionPreview, runNewVersionPublish, runSetAccessTier } from "@/lib/ap-admin/new-version-service";
import { createMockExamNewVersionAction, publishMockExamSet } from "./mock-exam-actions";

export type ApSetRow = { id: string; name: string; versionNo: number; status: "draft" | "published"; accessTier: "free" | "tutoring"; plannedTier: "free" | "tutoring" | null; apLabel: string | null; apSubject: string | null; groupId: string };
export type ApNewVersionOverview = { target: { ref: string; kind: string; canWrite: boolean; reason: string | null }; sets: ApSetRow[]; plans: PlanListing[] };
export type ApSwapSource = { planFile?: string; manual?: { section: string; position: number; addKey: string }[] };
export type ApResult = StepResult & { auditWarning?: string };

const target = () => resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, AP_STOCK_ADMIN_ALLOWED_REFS: process.env.AP_STOCK_ADMIN_ALLOWED_REFS, AP_STOCK_ADMIN_BLOCKED_REFS: process.env.AP_STOCK_ADMIN_BLOCKED_REFS, VERCEL_ENV: process.env.VERCEL_ENV });
const inputsOf = (src: ApSwapSource): PlanSwapInput[] => {
  if (src.planFile) return readSwapPlan(src.planFile).swaps;
  if (src.manual?.length) return src.manual.map((m) => ({ section: m.section, position: m.position, addKey: m.addKey.trim() }));
  return [];
};

/** 감사 기록 + 오류를 사용자 문구로 변환(비밀값은 오류에 담기지 않는다). */
async function guarded(c: Ctx, fallback: Pick<StepResult, "action" | "mode" | "scope">, run: () => Promise<StepResult>): Promise<ApResult> {
  let r: StepResult;
  try { r = await run(); }
  catch (e) {
    const msg = e instanceof Error ? e.message : "실패";
    r = { ...fallback, target: { ref: c.target.ref, kind: c.target.kind, canWrite: c.target.canWrite, reason: c.target.reason }, executed: false, counts: {}, lines: [], planHash: null, blocked: msg, ok: false };
    await recordRun(c, r, "error", msg);
    return r;
  }
  const status = r.blocked && r.mode === "execute" ? "refused" : r.ok || r.mode === "dry_run" ? "ok" : "refused";
  const warn = await recordRun(c, r, status);
  return warn ? { ...r, auditWarning: `작업 이력 기록 실패: ${warn}` } : r;
}

export async function getApNewVersionOverviewAction(): Promise<ApNewVersionOverview> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.from("mock_exam_sets").select("id, name, version_no, status, access_tier, planned_access_tier, ap_label, ap_subject, set_group_id").eq("exam_program", "ap").in("status", ["draft", "published"]).order("name").order("version_no", { ascending: false });
  if (error) throw new Error(error.message);
  const t = target();
  return {
    target: { ref: t.ref, kind: t.kind, canWrite: t.canWrite, reason: t.reason },
    sets: (data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, versionNo: s.version_no as number, status: s.status as "draft" | "published", accessTier: s.access_tier as "free" | "tutoring", plannedTier: (s.planned_access_tier as "free" | "tutoring" | null) ?? null, apLabel: (s.ap_label as string | null) ?? null, apSubject: (s.ap_subject as string | null) ?? null, groupId: s.set_group_id as string })),
    plans: listSwapPlans(),
  };
}

export async function apNewVersionPreviewAction(input: { sourceSetId: string } & ApSwapSource): Promise<ApResult & { preview: NewVersionPreview | null }> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  let preview: NewVersionPreview | null = null;
  const r = await guarded(c, { action: "new_version_preview", mode: "dry_run", scope: { sourceSetId: input.sourceSetId, planFile: input.planFile ?? null } }, async () => {
    const out = await runNewVersionPreview(c, input.sourceSetId, inputsOf(input)); preview = out.preview;
    return { ...out, scope: { ...out.scope, planFile: input.planFile ?? null } };
  });
  return { ...r, preview };
}

export async function apNewVersionDraftAction(input: { sourceSetId: string; planHash: string | null } & ApSwapSource): Promise<ApResult> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "new_version_draft", mode: "execute", scope: { sourceSetId: input.sourceSetId, planFile: input.planFile ?? null } }, async () => {
    const r = await runNewVersionDraft(c, input.sourceSetId, inputsOf(input), input.planHash, createMockExamNewVersionAction);
    return { ...r, scope: { ...r.scope, planFile: input.planFile ?? null } };
  });
}

export async function apNewVersionPublishAction(input: { newSetId: string; execute: boolean; planHash?: string | null }): Promise<ApResult> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "new_version_publish", mode: input.execute ? "execute" : "dry_run", scope: { newSetId: input.newSetId } }, () => runNewVersionPublish(c, input.newSetId, input.execute, input.planHash, publishMockExamSet));
}

export async function apSetAccessTierAction(input: { setId: string; tier: "free" | "tutoring"; execute: boolean; planHash?: string | null }): Promise<ApResult> {
  const { adminUserId } = await requireAdmin();
  const c: Ctx = { db: createAdminClient(), target: target(), actorId: adminUserId };
  return guarded(c, { action: "set_access_tier", mode: input.execute ? "execute" : "dry_run", scope: { setId: input.setId, tier: input.tier } }, () => runSetAccessTier(c, input.setId, input.tier, input.execute, input.planHash));
}
