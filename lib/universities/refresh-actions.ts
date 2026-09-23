"use server";

// 대학 진학 정보 DB Part 9 — 정보 수집 봇(갱신 요청 큐) + 필드별 변경안 검토.
// 스키마: supabase/migrations/20261510000000_college_db_p9_refresh_bot_and_proposals.sql
// 순수 크롤링 로직(SSRF 방지/robots.txt/파싱)은 lib/universities/crawler.ts.
//
// 정책(중요, CLAUDE.md/지시서 그대로):
//   - 마감일/시험정책/에세이 문항·선택규칙/국제학생 요건은 자동승인 로직이 없다 — 이
//     파일의 모든 반영 경로는 관리자의 명시적 승인(reviewUpdateProposal) 뒤에만 실행된다.
//   - 크롤러(runRefreshJob)는 university_update_proposals에만 쓴다. 기존 공개 데이터
//     테이블(university_admission_metrics 등) UPDATE는 오직 applyApprovedProposal에서만
//     일어난다 — 크롤링 경로 자체에는 그 코드가 없다(설계로 보장).

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  safeFetch,
  extractHtmlText,
  extractDeadlineCandidates,
} from "./crawler";
import type { SourceUrlType } from "./actions";

// 대학당 완료 후 이 시간(ms) 이내 재요청은 새로 큐잉하지 않고 기존 결과 상태만 보여준다.
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6시간
// 동시에 'running' 상태일 수 있는 전역 작업 수(간단한 세마포어 — DB 카운트 체크).
const MAX_CONCURRENT_JOBS = 3;

export type RefreshJobStatus = "queued" | "running" | "succeeded" | "failed";

export type RefreshJob = {
  id: string;
  universityId: string;
  status: RefreshJobStatus;
  requestedBy: string | null;
  requestedRole: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorSummary: string | null;
  createdAt: string;
};

function mapJobRow(row: {
  id: string;
  university_id: string;
  status: RefreshJobStatus;
  requested_by: string | null;
  requested_role: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_summary: string | null;
  created_at: string;
}): RefreshJob {
  return {
    id: row.id,
    universityId: row.university_id,
    status: row.status,
    requestedBy: row.requested_by,
    requestedRole: row.requested_role,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorSummary: row.error_summary,
    createdAt: row.created_at,
  };
}

const JOB_COLUMNS =
  "id, university_id, status, requested_by, requested_role, started_at, finished_at, error_summary, created_at";

/**
 * "최신 정보 확인 요청" 버튼. 학생/보호자/컨설턴트/관리자 전원 호출 가능(requireUser로만
 * 로그인 확인, 역할 제한 없음). 대학별로 진행중/최근 완료 작업이 있으면 새로 큐잉하지
 * 않고 그 작업을 그대로 반환한다(중복 실행 방지 + 반복 요청 병합).
 */
export async function requestUniversityRefresh(universityId: string): Promise<RefreshJob> {
  const { user, profile, supabase } = await requireUser();
  const db = createAdminClient();

  // 1) 이미 진행중(queued/running)인 작업이 있으면 그걸 그대로 반환.
  const { data: active } = await db
    .from("university_refresh_jobs")
    .select(JOB_COLUMNS)
    .eq("university_id", universityId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) return mapJobRow(active);

  // 2) 최근 완료(succeeded/failed) 작업이 냉각 시간 이내면 그대로 반환(재실행 안 함).
  const { data: recent } = await db
    .from("university_refresh_jobs")
    .select(JOB_COLUMNS)
    .eq("university_id", universityId)
    .in("status", ["succeeded", "failed"])
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.finished_at) {
    const elapsed = Date.now() - new Date(recent.finished_at).getTime();
    if (elapsed < COOLDOWN_MS) return mapJobRow(recent);
  }

  // 3) 새 작업 큐잉 — RLS(requested_by = auth.uid())가 안전망이 되도록 본인 세션 클라이언트로 insert.
  const { data: inserted, error: insertError } = await supabase
    .from("university_refresh_jobs")
    .insert({ university_id: universityId, requested_by: user.id, requested_role: profile?.role ?? null })
    .select(JOB_COLUMNS)
    .single();
  if (insertError || !inserted) throw new Error(insertError?.message ?? "갱신 요청 생성 실패");

  // 4) 전역 동시 실행 수 제한 — 초과 시 'queued'로 남겨두고 여기서 실행하지 않는다
  //    (이 세션에는 별도 백그라운드 워커/폴러가 없다 — 다음 세션 결정 필요 항목 참고).
  const { count: runningCount } = await db
    .from("university_refresh_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running");
  if ((runningCount ?? 0) >= MAX_CONCURRENT_JOBS) {
    revalidatePath("/admin/universities");
    return mapJobRow(inserted);
  }

  // 5) 용량 있음 — 바로 실행(동기, 이번 세션 범위: 별도 워커 없이 요청 안에서 완료).
  const ran = await runRefreshJob(inserted.id, universityId);
  revalidatePath("/admin/universities");
  return ran;
}

/** 대학별 현재/최근 작업 상태만 가볍게 조회(폴링용). */
export async function getLatestRefreshJob(universityId: string): Promise<RefreshJob | null> {
  await requireUser();
  const db = createAdminClient();
  const { data } = await db
    .from("university_refresh_jobs")
    .select(JOB_COLUMNS)
    .eq("university_id", universityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapJobRow(data) : null;
}

/**
 * 실제 크롤러 실행 — 승인된(status='approved') 출처 URL만 방문한다. 접근/파싱 실패는
 * result_type='fetch_failed' 변경안으로 남기고, 기존 공개 데이터는 절대 건드리지 않는다
 * (이 함수는 university_update_proposals에만 insert한다).
 */
export async function runRefreshJob(jobId: string, universityId: string): Promise<RefreshJob> {
  const db = createAdminClient();
  await db
    .from("university_refresh_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const { data: sourceUrls, error } = await db
      .from("university_source_urls")
      .select("id, url, source_type, cycle_year")
      .eq("university_id", universityId)
      .eq("status", "approved");
    if (error) throw new Error(error.message);

    for (const src of sourceUrls ?? []) {
      await crawlOneSource(db, {
        universityId,
        jobId,
        sourceUrlId: src.id,
        url: src.url,
        sourceType: src.source_type as SourceUrlType,
        cycleYear: src.cycle_year,
      });
    }

    const { data: finished } = await db
      .from("university_refresh_jobs")
      .update({ status: "succeeded", finished_at: new Date().toISOString() })
      .eq("id", jobId)
      .select(JOB_COLUMNS)
      .single();
    return mapJobRow(finished!);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { data: failed } = await db
      .from("university_refresh_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error_summary: message.slice(0, 500) })
      .eq("id", jobId)
      .select(JOB_COLUMNS)
      .single();
    return mapJobRow(failed!);
  }
}

function fieldAreaForSourceType(sourceType: SourceUrlType): string {
  switch (sourceType) {
    case "deadlines":
      return "deadline";
    case "admitted_profile":
      return "admission_metric";
    case "essay_prompts":
      return "essay";
    case "common_data_set":
      return "admissions";
    case "financial_aid":
      return "cost_aid";
    default:
      return "other";
  }
}

async function crawlOneSource(
  db: ReturnType<typeof createAdminClient>,
  input: { universityId: string; jobId: string; sourceUrlId: string; url: string; sourceType: SourceUrlType; cycleYear: number | null },
): Promise<void> {
  const fieldArea = fieldAreaForSourceType(input.sourceType);
  const outcome = await safeFetch(input.url);

  if (!outcome.ok) {
    await db.from("university_update_proposals").insert({
      university_id: input.universityId,
      refresh_job_id: input.jobId,
      source_url_id: input.sourceUrlId,
      field_area: fieldArea,
      target_table: "other",
      target_record_key: {},
      cycle_year: input.cycleYear,
      result_type: "fetch_failed",
      status: "pending",
      evidence_location: input.url,
      evidence_excerpt: outcome.reason,
    });
    return;
  }

  const text = outcome.isPdf ? outcome.body : extractHtmlText(outcome.body);
  const candidates = extractDeadlineCandidates(text);

  if (candidates.length === 0) {
    // 접근은 됐지만 알려진 패턴을 못 찾음 — 사람이 원문을 봐야 하므로 evidence만 남긴다.
    await db.from("university_update_proposals").insert({
      university_id: input.universityId,
      refresh_job_id: input.jobId,
      source_url_id: input.sourceUrlId,
      field_area: fieldArea,
      target_table: "other",
      target_record_key: {},
      cycle_year: input.cycleYear,
      result_type: "no_change",
      status: "pending",
      evidence_location: input.url,
      evidence_excerpt: text.slice(0, 300) || "(빈 응답)",
    });
    return;
  }

  for (const candidate of candidates) {
    await db.from("university_update_proposals").insert({
      university_id: input.universityId,
      refresh_job_id: input.jobId,
      source_url_id: input.sourceUrlId,
      field_area: "deadline",
      target_table: "other", // university_admission_cycles는 flat 컬럼 구조라 이번 세션은 자동반영 미지원(결정 필요 참고)
      target_record_key: { label: candidate.label },
      cycle_year: input.cycleYear,
      result_type: "new",
      status: "pending",
      evidence_location: input.url,
      evidence_excerpt: candidate.excerpt,
      proposed_value: { label: candidate.label, excerpt: candidate.excerpt },
    });
  }
}

// --- 관리자 검토 화면 -----------------------------------------------------------

export type UpdateProposal = {
  id: string;
  universityId: string;
  refreshJobId: string | null;
  sourceUrlId: string | null;
  fieldArea: string;
  targetTable: string;
  targetRecordKey: Record<string, unknown>;
  cycleYear: number | null;
  cohort: string | null;
  currentValue: Record<string, unknown> | null;
  proposedValue: Record<string, unknown> | null;
  evidenceExcerpt: string | null;
  evidenceLocation: string | null;
  resultType: "no_change" | "new" | "changed" | "source_conflict" | "fetch_failed";
  status: "pending" | "approved" | "approved_with_edit" | "held" | "rejected";
  reviewReason: string | null;
  appliedAt: string | null;
  createdAt: string;
};

const PROPOSAL_COLUMNS =
  "id, university_id, refresh_job_id, source_url_id, field_area, target_table, target_record_key, cycle_year, cohort, current_value, proposed_value, evidence_excerpt, evidence_location, result_type, status, review_reason, applied_at, created_at";

function mapProposalRow(row: Record<string, unknown>): UpdateProposal {
  return {
    id: row.id as string,
    universityId: row.university_id as string,
    refreshJobId: (row.refresh_job_id as string) ?? null,
    sourceUrlId: (row.source_url_id as string) ?? null,
    fieldArea: row.field_area as string,
    targetTable: row.target_table as string,
    targetRecordKey: (row.target_record_key as Record<string, unknown>) ?? {},
    cycleYear: (row.cycle_year as number) ?? null,
    cohort: (row.cohort as string) ?? null,
    currentValue: (row.current_value as Record<string, unknown>) ?? null,
    proposedValue: (row.proposed_value as Record<string, unknown>) ?? null,
    evidenceExcerpt: (row.evidence_excerpt as string) ?? null,
    evidenceLocation: (row.evidence_location as string) ?? null,
    resultType: row.result_type as UpdateProposal["resultType"],
    status: row.status as UpdateProposal["status"],
    reviewReason: (row.review_reason as string) ?? null,
    appliedAt: (row.applied_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** 관리자 — 대학 하나의 변경안 전체(모든 상태) 조회, 최신순. */
export async function listUpdateProposals(universityId: string): Promise<UpdateProposal[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("university_update_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("university_id", universityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProposalRow);
}

/** 대상 테이블에 실제로 반영 가능한 target_table만 자동 upsert를 지원한다.
 * 그 외(university_admission_cycles/other)는 승인은 기록하되 반영은 관리자가 수동으로 한다
 * (flat 컬럼 구조라 이번 세션에서는 범용 upsert 대상에서 제외 — 결정 필요 문서 참고). */
async function applyProposalToTarget(
  db: ReturnType<typeof createAdminClient>,
  proposal: { targetTable: string; targetRecordKey: Record<string, unknown>; universityId: string; cycleYear: number | null; cohort: string | null },
  value: Record<string, unknown>,
): Promise<{ applied: boolean; previousValue: Record<string, unknown> | null }> {
  if (proposal.targetTable === "university_admission_metrics") {
    const key = {
      university_id: proposal.universityId,
      cycle_year: proposal.targetRecordKey.cycle_year ?? proposal.cycleYear,
      cohort: proposal.targetRecordKey.cohort ?? proposal.cohort,
      metric_key: proposal.targetRecordKey.metric_key,
    };
    const { data: existing } = await db
      .from("university_admission_metrics")
      .select("*")
      .match(key)
      .maybeSingle();
    const { error } = await db
      .from("university_admission_metrics")
      .upsert(
        { ...key, ...value, updated_at: new Date().toISOString() },
        { onConflict: "university_id,cycle_year,cohort,metric_key" },
      );
    if (error) throw new Error(error.message);
    return { applied: true, previousValue: existing ?? null };
  }

  if (proposal.targetTable === "university_essay_prompts") {
    const id = proposal.targetRecordKey.id as string | undefined;
    if (id) {
      const { data: existing } = await db.from("university_essay_prompts").select("*").eq("id", id).maybeSingle();
      const { error } = await db
        .from("university_essay_prompts")
        .update({ ...value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { applied: true, previousValue: existing ?? null };
    }
    const { error } = await db.from("university_essay_prompts").insert({
      university_id: proposal.universityId,
      cycle_year: proposal.cycleYear,
      ...value,
    });
    if (error) throw new Error(error.message);
    return { applied: true, previousValue: null };
  }

  return { applied: false, previousValue: null };
}

/** 관리자 — 변경안 승인/수정후승인/보류/거절. 승인된 것만 대상 테이블에 실제로 반영한다. */
export async function reviewUpdateProposal(input: {
  proposalId: string;
  decision: "approved" | "approved_with_edit" | "held" | "rejected";
  editedValue?: Record<string, unknown>;
  reviewReason?: string | null;
}): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();

  const { data: proposal, error: loadError } = await db
    .from("university_update_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("id", input.proposalId)
    .single();
  if (loadError || !proposal) throw new Error(loadError?.message ?? "변경안을 찾을 수 없습니다.");
  const mapped = mapProposalRow(proposal);

  const nowIso = new Date().toISOString();

  if (input.decision === "held" || input.decision === "rejected") {
    const { error } = await db
      .from("university_update_proposals")
      .update({
        status: input.decision,
        reviewed_by: adminUserId,
        reviewed_at: nowIso,
        review_reason: input.reviewReason ?? null,
      })
      .eq("id", input.proposalId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/universities");
    return;
  }

  // approved / approved_with_edit — 실제 반영 시도.
  const valueToApply =
    input.decision === "approved_with_edit" ? input.editedValue ?? mapped.proposedValue ?? {} : mapped.proposedValue ?? {};
  const { applied, previousValue } = await applyProposalToTarget(
    db,
    { targetTable: mapped.targetTable, targetRecordKey: mapped.targetRecordKey, universityId: mapped.universityId, cycleYear: mapped.cycleYear, cohort: mapped.cohort },
    valueToApply,
  );

  const { error } = await db
    .from("university_update_proposals")
    .update({
      status: input.decision,
      reviewed_by: adminUserId,
      reviewed_at: nowIso,
      review_reason: input.reviewReason ?? null,
      current_value: previousValue,
      proposed_value: valueToApply,
      applied_at: applied ? nowIso : null,
    })
    .eq("id", input.proposalId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 관리자 — 승인·반영된 변경안을 되돌린다(current_value로 대상 테이블 복원). */
export async function rollbackAppliedProposal(proposalId: string): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();

  const { data: proposal, error: loadError } = await db
    .from("university_update_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("id", proposalId)
    .single();
  if (loadError || !proposal) throw new Error(loadError?.message ?? "변경안을 찾을 수 없습니다.");
  const mapped = mapProposalRow(proposal);
  if (!mapped.appliedAt) throw new Error("아직 반영되지 않은 변경안은 되돌릴 수 없습니다.");

  if (mapped.currentValue) {
    await applyProposalToTarget(
      db,
      { targetTable: mapped.targetTable, targetRecordKey: mapped.targetRecordKey, universityId: mapped.universityId, cycleYear: mapped.cycleYear, cohort: mapped.cohort },
      mapped.currentValue,
    );
  }

  const { error } = await db
    .from("university_update_proposals")
    .update({
      status: "held",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_reason: "롤백됨(승인 취소, 이전 값으로 복원)",
      applied_at: null,
    })
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}
