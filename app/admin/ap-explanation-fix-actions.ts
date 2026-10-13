"use server";

// 관리자 'AP 설명 수정 새 버전' 서버 액션. 모든 액션은 requireAdmin() 뒤에서 실행된다. 교정 파일은 저장소의 data/ap/stock/tex-corrections.json(변환 전 해시에 묶임).
// 쓰기는 환경 가드(허용 목록의 비프로덕션 ref) + 미리보기와 같은 계획 해시일 때만, 모든 단계는 감사 기록(ap_stock_admin_runs). 응시·답안·결과·공개본은 쓰지 않는다.
// 세트 새 버전의 공개는 기존 'AB/AP 세트 새 버전' 패널(apNewVersionPublishAction)을 그대로 쓴다. 문서: docs/ap/tex-audit.md
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { resolveStockTarget } from "@/lib/ap-admin/env-guard";
import { recordRun, type Ctx, type StepResult } from "@/lib/ap-admin/service";
import { readCorrectionFile, runExplanationFix, runExplanationFixPreview, runRefreshDraft } from "@/lib/ap-admin/explanation-fix";

export type ApFixResult = StepResult & { auditWarning?: string };
const target = () => resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, AP_STOCK_ADMIN_ALLOWED_REFS: process.env.AP_STOCK_ADMIN_ALLOWED_REFS, AP_STOCK_ADMIN_BLOCKED_REFS: process.env.AP_STOCK_ADMIN_BLOCKED_REFS, VERCEL_ENV: process.env.VERCEL_ENV });

async function guarded(c: Ctx, fallback: Pick<StepResult, "action" | "mode" | "scope">, run: () => Promise<StepResult>): Promise<ApFixResult> {
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
const ctx = async (): Promise<Ctx> => { const { adminUserId } = await requireAdmin(); return { db: createAdminClient(), target: target(), actorId: adminUserId }; };

export async function apExplanationFixPreviewAction(): Promise<ApFixResult> {
  const c = await ctx();
  return guarded(c, { action: "explanation_fix_preview", mode: "dry_run", scope: {} }, () => runExplanationFixPreview(c, readCorrectionFile()));
}
export async function apExplanationFixExecuteAction(input: { planHash: string | null }): Promise<ApFixResult> {
  const c = await ctx();
  return guarded(c, { action: "explanation_fix", mode: "execute", scope: {} }, () => runExplanationFix(c, readCorrectionFile(), input.planHash));
}

export async function apRefreshDraftAction(input: { sourceSetId: string; execute: boolean; planHash?: string | null }): Promise<ApFixResult> {
  const c = await ctx();
  return guarded(c, { action: "set_refresh_draft", mode: input.execute ? "execute" : "dry_run", scope: { sourceSetId: input.sourceSetId } }, () =>
    runRefreshDraft(c, input.sourceSetId, input.execute, input.planHash, async (sourceSetId) => {
      const { data, error } = await c.db.rpc("mock_exam_refresh_explanations", { p_source_set_id: sourceSetId, p_actor_id: c.actorId });
      if (error) throw new Error(error.message);
      return data as { newSetId: string; versionNo: number; refreshed: number };
    }));
}
