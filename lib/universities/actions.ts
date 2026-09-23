"use server";

// 대학 진학 정보 DB Part 2 — 목록/검색 + 관리자 CRUD(마스터 정보/입시 사이클/업데이트).
// 스키마: supabase/migrations/20261421000000_college_db_p2_universities_foundation.sql
//
// 범위 밖(정책상 금지): 합격 확률/가능성 예측 기능은 여기 없다 — 실 결과 데이터와 검증된
// 모델이 갖춰지기 전까지 학생 로드맵 V1과 동일한 원칙으로 금지돼 있다.
//
// 통합 지점: `feature/student-roadmap-v1`(미병합)이 병합되면, 그 브랜치의
// `college_interests`(가칭) 테이블이 `university_id uuid references universities(id)`로
// 이 테이블을 참조할 수 있다. listUniversities()는 그 기능의 "대학 탐색" 서브탭이
// 그대로 재사용할 수 있는 형태로 이미 만들어 뒀다(관리자 화면에서 지금 이 함수를 쓴다).

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/utils/supabase/server";

export type UniversitySummary = {
  id: string;
  rankFinal: number | null;
  name: string;
  country: string;
  city: string | null;
  state: string | null;
  publicPrivate: string | null;
  applicationPlatform: string | null;
  urlVerificationStatus: string | null;
  latestCycleYear: number | null;
  /** 지시서 E: 'verified_pilot'(실제 재검증 완료)/'sources_pending_review'/'unconfirmed'(기본값). */
  dataCollectionStatus: "verified_pilot" | "sources_pending_review" | "unconfirmed";
};

export type UniversityListFilter = {
  search?: string;
  country?: string;
  minRank?: number;
  maxRank?: number;
};

/** 목록/검색 — 관리자 화면과, 병합 후 학생 로드맵의 "대학 탐색"이 함께 쓸 읽기 전용 함수. */
export async function listUniversities(filter: UniversityListFilter = {}): Promise<UniversitySummary[]> {
  const db = createAdminClient();
  let query = db
    .from("universities")
    .select("id, rank_final, name, country, city, state, public_private, application_platform, url_verification_status, data_collection_status")
    .order("rank_final", { ascending: true, nullsFirst: false });

  if (filter.search?.trim()) {
    query = query.ilike("name", `%${filter.search.trim()}%`);
  }
  if (filter.country?.trim()) {
    query = query.eq("country", filter.country.trim());
  }
  if (filter.minRank != null) {
    query = query.gte("rank_final", filter.minRank);
  }
  if (filter.maxRank != null) {
    query = query.lte("rank_final", filter.maxRank);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((u) => u.id);
  const latestYearByUniversity = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cycles } = await db
      .from("university_admission_cycles")
      .select("university_id, cycle_year")
      .in("university_id", ids)
      .order("cycle_year", { ascending: false });
    for (const c of cycles ?? []) {
      if (!latestYearByUniversity.has(c.university_id)) latestYearByUniversity.set(c.university_id, c.cycle_year);
    }
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    rankFinal: u.rank_final,
    name: u.name,
    country: u.country,
    city: u.city,
    state: u.state,
    publicPrivate: u.public_private,
    applicationPlatform: u.application_platform,
    urlVerificationStatus: u.url_verification_status,
    latestCycleYear: latestYearByUniversity.get(u.id) ?? null,
    dataCollectionStatus: u.data_collection_status ?? "unconfirmed",
  }));
}

export type UniversityDetail = UniversitySummary & {
  overviewText: string | null;
  strengthsPrograms: string[];
  admissionsHomepageUrl: string | null;
  commonDataSetUrl: string | null;
  catalogProgramsUrl: string | null;
  deadlinesUrl: string | null;
  rankConfidence: string | null;
  // Part 5(2026-09-19) — 캠퍼스 생활·학사 제도(자주 안 바뀌는 정보).
  setting: string | null;
  campusSizeAcres: number | null;
  ncaaDivision: string | null;
  religiousAffiliation: string | null;
  calendarSystem: string | null;
  honorsCollege: boolean | null;
};

export type AdmissionCycle = {
  id: string;
  cycleYear: number;
  testPolicy: string | null;
  satEbrw25: number | null;
  satEbrw75: number | null;
  satMath25: number | null;
  satMath75: number | null;
  actComposite25: number | null;
  actComposite75: number | null;
  toeflMin: number | null;
  ieltsMin: number | null;
  gpa25: number | null;
  gpa75: number | null;
  gpaAverage: number | null;
  recommendedCoursework: string | null;
  apIbPolicy: string | null;
  edDeadline: string | null;
  eaDeadline: string | null;
  rdDeadline: string | null;
  edDecisionDate: string | null;
  eaDecisionDate: string | null;
  rdDecisionDate: string | null;
  applicationFee: number | null;
  essayCount: number | null;
  essayTopics: string | null;
  recommendationLetterCount: number | null;
  portfolioRequired: boolean;
  interviewRequired: boolean | null;
  acceptanceRate: number | null;
  // Part 3(2026-09-19) — 재학생/입시 통계. 합격 확률 예측 필드는 의도적으로 없음(정책상 금지).
  pellGrantPct: number | null;
  studentFacultyRatio: string | null;
  gradRate4yr: number | null;
  gradRate6yr: number | null;
  retentionRate: number | null;
  totalApplicants: number | null;
  yieldRate: number | null;
  internationalPct: number | null;
  womenPct: number | null;
  // Part 5(2026-09-19) — 비용/재정지원, ED/EA 제도 세부, 학사 상세, 합격자 학업 프로필.
  tuitionInState: number | null;
  tuitionOutState: number | null;
  roomBoardCost: number | null;
  avgNetPrice: number | null;
  pctReceivingAid: number | null;
  avgAidAward: number | null;
  eaRestrictive: boolean | null;
  ed2Deadline: string | null;
  ed2DecisionDate: string | null;
  classSizeUnder20Pct: number | null;
  classSizeOver50Pct: number | null;
  studyAbroadPct: number | null;
  admittedAvgApExams: number | null;
  admittedWeightedGpaAvg: number | null;
  admittedTop10pctClassRankPct: number | null;
};

export type UniversityMajor = { id: string; name: string; category: string | null };
export type EssayPrompt = { id: string; cycleYear: number; promptText: string; wordLimit: number | null; isRequired: boolean };

export type UniversityUpdateEntry = {
  id: string;
  title: string;
  updateDate: string;
  summary: string | null;
  sourceUrl: string | null;
};

/** 관리자 상세/편집 화면용 — 대학 기본정보 + 연도별 사이클 전체 + 업데이트 타임라인. */
async function loadUniversityDetail(
  db: ReturnType<typeof createAdminClient>,
  universityId: string,
): Promise<{
  university: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  majors: UniversityMajor[];
  essayPrompts: EssayPrompt[];
  sourceUrls: UniversitySourceUrl[];
}> {
  const { data: u, error: uErr } = await db.from("universities").select("*").eq("id", universityId).single();
  if (uErr) throw new Error(uErr.message);

  const { data: cycleRows, error: cErr } = await db
    .from("university_admission_cycles")
    .select("*")
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false });
  if (cErr) throw new Error(cErr.message);

  const { data: updateRows, error: upErr } = await db
    .from("university_updates")
    .select("*")
    .eq("university_id", universityId)
    .order("update_date", { ascending: false });
  if (upErr) throw new Error(upErr.message);

  const { data: majorRows, error: mErr } = await db
    .from("university_majors")
    .select("*")
    .eq("university_id", universityId)
    .order("name", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const { data: essayRows, error: eErr } = await db
    .from("university_essay_prompts")
    .select("*")
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false });
  if (eErr) throw new Error(eErr.message);

  // 공개 화면에는 관리자가 승인한 공식/참고 출처만 노출한다(pending/rejected 제외).
  const { data: sourceUrlRows, error: sErr } = await db
    .from("university_source_urls")
    .select("id, university_id, url, source_type, cycle_year, is_official, status, submitted_by, reviewed_by, reviewed_at, review_note, created_at")
    .eq("university_id", universityId)
    .eq("status", "approved")
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false });
  if (sErr) throw new Error(sErr.message);

  return {
    university: {
      id: u.id,
      rankFinal: u.rank_final,
      name: u.name,
      country: u.country,
      city: u.city,
      state: u.state,
      publicPrivate: u.public_private,
      applicationPlatform: u.application_platform,
      urlVerificationStatus: u.url_verification_status,
      dataCollectionStatus: u.data_collection_status ?? "unconfirmed",
      latestCycleYear: cycleRows?.[0]?.cycle_year ?? null,
      strengthsPrograms: u.strengths_programs ?? [],
      admissionsHomepageUrl: u.admissions_homepage_url,
      commonDataSetUrl: u.common_data_set_url,
      catalogProgramsUrl: u.catalog_programs_url,
      deadlinesUrl: u.deadlines_url,
      rankConfidence: u.rank_confidence,
      overviewText: u.overview_text,
      setting: u.setting,
      campusSizeAcres: u.campus_size_acres,
      ncaaDivision: u.ncaa_division,
      religiousAffiliation: u.religious_affiliation,
      calendarSystem: u.calendar_system,
      honorsCollege: u.honors_college,
    },
    cycles: (cycleRows ?? []).map((c) => ({
      id: c.id,
      cycleYear: c.cycle_year,
      testPolicy: c.test_policy,
      satEbrw25: c.sat_ebrw_25,
      satEbrw75: c.sat_ebrw_75,
      satMath25: c.sat_math_25,
      satMath75: c.sat_math_75,
      actComposite25: c.act_composite_25,
      actComposite75: c.act_composite_75,
      toeflMin: c.toefl_min,
      ieltsMin: c.ielts_min,
      gpa25: c.gpa_25,
      gpa75: c.gpa_75,
      gpaAverage: c.gpa_average,
      recommendedCoursework: c.recommended_coursework,
      apIbPolicy: c.ap_ib_policy,
      edDeadline: c.ed_deadline,
      eaDeadline: c.ea_deadline,
      rdDeadline: c.rd_deadline,
      edDecisionDate: c.ed_decision_date,
      eaDecisionDate: c.ea_decision_date,
      rdDecisionDate: c.rd_decision_date,
      applicationFee: c.application_fee,
      essayCount: c.essay_count,
      essayTopics: c.essay_topics,
      recommendationLetterCount: c.recommendation_letter_count,
      portfolioRequired: c.portfolio_required,
      interviewRequired: c.interview_required,
      acceptanceRate: c.acceptance_rate,
      pellGrantPct: c.pell_grant_pct,
      studentFacultyRatio: c.student_faculty_ratio,
      gradRate4yr: c.grad_rate_4yr,
      gradRate6yr: c.grad_rate_6yr,
      retentionRate: c.retention_rate,
      totalApplicants: c.total_applicants,
      yieldRate: c.yield_rate,
      internationalPct: c.international_pct,
      womenPct: c.women_pct,
      tuitionInState: c.tuition_in_state,
      tuitionOutState: c.tuition_out_state,
      roomBoardCost: c.room_board_cost,
      avgNetPrice: c.avg_net_price,
      pctReceivingAid: c.pct_receiving_aid,
      avgAidAward: c.avg_aid_award,
      eaRestrictive: c.ea_restrictive,
      ed2Deadline: c.ed2_deadline,
      ed2DecisionDate: c.ed2_decision_date,
      classSizeUnder20Pct: c.class_size_under_20_pct,
      classSizeOver50Pct: c.class_size_over_50_pct,
      studyAbroadPct: c.study_abroad_pct,
      admittedAvgApExams: c.admitted_avg_ap_exams,
      admittedWeightedGpaAvg: c.admitted_weighted_gpa_avg,
      admittedTop10pctClassRankPct: c.admitted_top10pct_class_rank_pct,
    })),
    updates: (updateRows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      updateDate: r.update_date,
      summary: r.summary,
      sourceUrl: r.source_url,
    })),
    majors: (majorRows ?? []).map((m) => ({ id: m.id, name: m.name, category: m.category })),
    essayPrompts: (essayRows ?? []).map((e) => ({ id: e.id, cycleYear: e.cycle_year, promptText: e.prompt_text, wordLimit: e.word_limit, isRequired: e.is_required })),
    sourceUrls: (sourceUrlRows ?? []).map(mapSourceUrlRow),
  };
}

/** 관리자 상세/편집 화면용. */
export async function getUniversityDetail(
  universityId: string,
): Promise<{
  university: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  majors: UniversityMajor[];
  essayPrompts: EssayPrompt[];
  sourceUrls: UniversitySourceUrl[];
}> {
  await requireAdmin();
  return loadUniversityDetail(createAdminClient(), universityId);
}

/**
 * 학생·학부모·교사용 읽기 전용 — 로그인만 확인하고(관리자 권한 불필요) 관리자 클라이언트로
 * 조회한다. RLS가 이미 "인증 사용자 전원 읽기 가능"으로 열어 뒀으므로 이 함수는 그 정책을
 * 그대로 대변한다(합격 확률/가능성 예측 필드는 없음 — 정책상 금지).
 */
export async function getUniversityDetailForStudent(
  universityId: string,
): Promise<{
  university: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  majors: UniversityMajor[];
  essayPrompts: EssayPrompt[];
  sourceUrls: UniversitySourceUrl[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return loadUniversityDetail(createAdminClient(), universityId);
}

export type UpsertAdmissionCycleInput = {
  universityId: string;
  cycleYear: number;
  testPolicy?: string | null;
  satEbrw25?: number | null;
  satEbrw75?: number | null;
  satMath25?: number | null;
  satMath75?: number | null;
  actComposite25?: number | null;
  actComposite75?: number | null;
  toeflMin?: number | null;
  ieltsMin?: number | null;
  gpa25?: number | null;
  gpa75?: number | null;
  gpaAverage?: number | null;
  recommendedCoursework?: string | null;
  apIbPolicy?: string | null;
  edDeadline?: string | null;
  eaDeadline?: string | null;
  rdDeadline?: string | null;
  edDecisionDate?: string | null;
  eaDecisionDate?: string | null;
  rdDecisionDate?: string | null;
  applicationFee?: number | null;
  essayCount?: number | null;
  essayTopics?: string | null;
  recommendationLetterCount?: number | null;
  portfolioRequired?: boolean;
  interviewRequired?: boolean | null;
  acceptanceRate?: number | null;
  // Part 3(2026-09-19) — 재학생/입시 통계.
  pellGrantPct?: number | null;
  studentFacultyRatio?: string | null;
  gradRate4yr?: number | null;
  gradRate6yr?: number | null;
  retentionRate?: number | null;
  totalApplicants?: number | null;
  yieldRate?: number | null;
  internationalPct?: number | null;
  womenPct?: number | null;
  // Part 5(2026-09-19) — 비용/재정지원, ED/EA 제도 세부, 학사 상세, 합격자 학업 프로필.
  tuitionInState?: number | null;
  tuitionOutState?: number | null;
  roomBoardCost?: number | null;
  avgNetPrice?: number | null;
  pctReceivingAid?: number | null;
  avgAidAward?: number | null;
  eaRestrictive?: boolean | null;
  ed2Deadline?: string | null;
  ed2DecisionDate?: string | null;
  classSizeUnder20Pct?: number | null;
  classSizeOver50Pct?: number | null;
  studyAbroadPct?: number | null;
  admittedAvgApExams?: number | null;
  admittedWeightedGpaAvg?: number | null;
  admittedTop10pctClassRankPct?: number | null;
};

/** 연도별 입시 사이클을 새로 만들거나(있으면) 갱신한다 — (university_id, cycle_year) unique. */
export async function upsertAdmissionCycle(input: UpsertAdmissionCycleInput): Promise<void> {
  await requireAdmin();
  if (!input.universityId) throw new Error("대학을 선택하세요.");
  if (!Number.isInteger(input.cycleYear) || input.cycleYear < 2000 || input.cycleYear > 2100) {
    throw new Error("입시 연도가 올바르지 않습니다.");
  }
  const db = createAdminClient();
  const { error } = await db.from("university_admission_cycles").upsert(
    {
      university_id: input.universityId,
      cycle_year: input.cycleYear,
      test_policy: input.testPolicy ?? null,
      sat_ebrw_25: input.satEbrw25 ?? null,
      sat_ebrw_75: input.satEbrw75 ?? null,
      sat_math_25: input.satMath25 ?? null,
      sat_math_75: input.satMath75 ?? null,
      act_composite_25: input.actComposite25 ?? null,
      act_composite_75: input.actComposite75 ?? null,
      toefl_min: input.toeflMin ?? null,
      ielts_min: input.ieltsMin ?? null,
      gpa_25: input.gpa25 ?? null,
      gpa_75: input.gpa75 ?? null,
      gpa_average: input.gpaAverage ?? null,
      recommended_coursework: input.recommendedCoursework ?? null,
      ap_ib_policy: input.apIbPolicy ?? null,
      ed_deadline: input.edDeadline ?? null,
      ea_deadline: input.eaDeadline ?? null,
      rd_deadline: input.rdDeadline ?? null,
      ed_decision_date: input.edDecisionDate ?? null,
      ea_decision_date: input.eaDecisionDate ?? null,
      rd_decision_date: input.rdDecisionDate ?? null,
      application_fee: input.applicationFee ?? null,
      essay_count: input.essayCount ?? null,
      essay_topics: input.essayTopics ?? null,
      recommendation_letter_count: input.recommendationLetterCount ?? null,
      portfolio_required: input.portfolioRequired ?? false,
      interview_required: input.interviewRequired ?? null,
      acceptance_rate: input.acceptanceRate ?? null,
      pell_grant_pct: input.pellGrantPct ?? null,
      student_faculty_ratio: input.studentFacultyRatio ?? null,
      grad_rate_4yr: input.gradRate4yr ?? null,
      grad_rate_6yr: input.gradRate6yr ?? null,
      retention_rate: input.retentionRate ?? null,
      total_applicants: input.totalApplicants ?? null,
      yield_rate: input.yieldRate ?? null,
      international_pct: input.internationalPct ?? null,
      women_pct: input.womenPct ?? null,
      tuition_in_state: input.tuitionInState ?? null,
      tuition_out_state: input.tuitionOutState ?? null,
      room_board_cost: input.roomBoardCost ?? null,
      avg_net_price: input.avgNetPrice ?? null,
      pct_receiving_aid: input.pctReceivingAid ?? null,
      avg_aid_award: input.avgAidAward ?? null,
      ea_restrictive: input.eaRestrictive ?? null,
      ed2_deadline: input.ed2Deadline ?? null,
      ed2_decision_date: input.ed2DecisionDate ?? null,
      class_size_under_20_pct: input.classSizeUnder20Pct ?? null,
      class_size_over_50_pct: input.classSizeOver50Pct ?? null,
      study_abroad_pct: input.studyAbroadPct ?? null,
      admitted_avg_ap_exams: input.admittedAvgApExams ?? null,
      admitted_weighted_gpa_avg: input.admittedWeightedGpaAvg ?? null,
      admitted_top10pct_class_rank_pct: input.admittedTop10pctClassRankPct ?? null,
    },
    { onConflict: "university_id,cycle_year" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 대학별 뉴스/정책변경 타임라인 항목 추가. */
export async function addUniversityUpdate(input: {
  universityId: string;
  title: string;
  updateDate: string;
  summary?: string | null;
  sourceUrl?: string | null;
}): Promise<void> {
  await requireAdmin();
  if (!input.title.trim()) throw new Error("제목을 입력하세요.");
  if (!input.updateDate) throw new Error("날짜를 입력하세요.");
  const db = createAdminClient();
  const { error } = await db.from("university_updates").insert({
    university_id: input.universityId,
    title: input.title.trim(),
    update_date: input.updateDate,
    summary: input.summary ?? null,
    source_url: input.sourceUrl ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 마스터 정보(기본 정보) 수정 — 랭킹/소재지/공사립/지원플랫폼/강점전공 등. */
export async function updateUniversityBasics(input: {
  universityId: string;
  applicationPlatform?: string | null;
  strengthsPrograms?: string[];
  overviewText?: string | null;
  setting?: string | null;
  campusSizeAcres?: number | null;
  ncaaDivision?: string | null;
  religiousAffiliation?: string | null;
  calendarSystem?: string | null;
  honorsCollege?: boolean | null;
}): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("universities")
    .update({
      application_platform: input.applicationPlatform ?? null,
      strengths_programs: input.strengthsPrograms ?? [],
      overview_text: input.overviewText ?? null,
      setting: input.setting ?? null,
      campus_size_acres: input.campusSizeAcres ?? null,
      ncaa_division: input.ncaaDivision ?? null,
      religious_affiliation: input.religiousAffiliation ?? null,
      calendar_system: input.calendarSystem ?? null,
      honors_college: input.honorsCollege ?? null,
    })
    .eq("id", input.universityId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

// --- 출처 URL 레지스트리(Part 6) ---------------------------------------------
// 스키마: supabase/migrations/20261473000000_college_db_p6_source_urls_and_reports.sql

export type SourceUrlType =
  | "admissions_homepage"
  | "common_data_set"
  | "catalog_programs"
  | "deadlines"
  | "essay_prompts"
  | "admitted_profile"
  | "financial_aid"
  | "other";

export type UniversitySourceUrl = {
  id: string;
  universityId: string;
  url: string;
  sourceType: SourceUrlType;
  cycleYear: number | null;
  isOfficial: boolean;
  status: "pending" | "approved" | "rejected";
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

function mapSourceUrlRow(row: {
  id: string;
  university_id: string;
  url: string;
  source_type: SourceUrlType;
  cycle_year: number | null;
  is_official: boolean;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}): UniversitySourceUrl {
  return {
    id: row.id,
    universityId: row.university_id,
    url: row.url,
    sourceType: row.source_type,
    cycleYear: row.cycle_year,
    isOfficial: row.is_official,
    status: row.status,
    submittedBy: row.submitted_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

/** 관리자 화면 — 대학 하나의 출처 URL 전체(모든 상태) 조회. */
export async function listUniversitySourceUrls(universityId: string): Promise<UniversitySourceUrl[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("university_source_urls")
    .select(
      "id, university_id, url, source_type, cycle_year, is_official, status, submitted_by, reviewed_by, reviewed_at, review_note, created_at",
    )
    .eq("university_id", universityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSourceUrlRow);
}

/** 관리자 — 출처 URL 직접 등록(이미 승인 상태로). */
export async function addUniversitySourceUrl(input: {
  universityId: string;
  url: string;
  sourceType: SourceUrlType;
  cycleYear?: number | null;
  isOfficial: boolean;
}): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("university_source_urls").insert({
    university_id: input.universityId,
    url: input.url,
    source_type: input.sourceType,
    cycle_year: input.cycleYear ?? null,
    is_official: input.isOfficial,
    status: "approved",
    submitted_by: adminUserId,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 관리자 — 컨설턴트가 제안한(pending) 출처 URL을 승인/반려. */
export async function reviewUniversitySourceUrl(input: {
  sourceUrlId: string;
  approve: boolean;
  reviewNote?: string | null;
}): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("university_source_urls")
    .update({
      status: input.approve ? "approved" : "rejected",
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sourceUrlId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

// --- 오류 신고함(공개 화면 어디서나) -----------------------------------------

export type UniversityDataReport = {
  id: string;
  universityId: string | null;
  fieldPath: string | null;
  reportedValue: string | null;
  message: string;
  reporterId: string | null;
  reporterRole: string | null;
  status: "open" | "in_review" | "resolved" | "dismissed";
  resolutionNote: string | null;
  createdAt: string;
};

/** 관리자 처리함 — 전체 신고 목록(최신순), 상태 필터 옵션. */
export async function listUniversityDataReports(status?: UniversityDataReport["status"]): Promise<UniversityDataReport[]> {
  await requireAdmin();
  const db = createAdminClient();
  let query = db
    .from("university_data_reports")
    .select("id, university_id, field_path, reported_value, message, reporter_id, reporter_role, status, resolution_note, created_at")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    universityId: r.university_id,
    fieldPath: r.field_path,
    reportedValue: r.reported_value,
    message: r.message,
    reporterId: r.reporter_id,
    reporterRole: r.reporter_role,
    status: r.status,
    resolutionNote: r.resolution_note,
    createdAt: r.created_at,
  }));
}

/** 관리자 — 신고 처리(상태 변경 + 메모). */
export async function resolveUniversityDataReport(input: {
  reportId: string;
  status: "in_review" | "resolved" | "dismissed";
  resolutionNote?: string | null;
}): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("university_data_reports")
    .update({
      status: input.status,
      resolved_by: input.status === "resolved" || input.status === "dismissed" ? adminUserId : null,
      resolved_at: input.status === "resolved" || input.status === "dismissed" ? new Date().toISOString() : null,
      resolution_note: input.resolutionNote ?? null,
    })
    .eq("id", input.reportId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

// --- 합격·등록 학생 학업 지표(Admitted Student Profile, P7 2026-09-23) ------------
//
// 정책: 개인 합격확률 계산/변환 기능은 여기 없다(정책상 금지, 기존 원칙과 동일).
// 스키마: supabase/migrations/20261490000000_college_db_p7_admission_metrics.sql

export type AdmissionMetricCohort = "applicant" | "admitted" | "enrolled";
export type AdmissionMetricKey =
  | "sat_total_25"
  | "sat_total_75"
  | "sat_ebrw_25"
  | "sat_ebrw_75"
  | "sat_math_25"
  | "sat_math_75"
  | "act_composite_25"
  | "act_composite_75"
  | "gpa_average"
  | "top10pct_pct"
  | "ap_ib_indicator"
  | "applicants_count"
  | "admitted_count"
  | "enrolled_count"
  | "admit_rate"
  | "yield_rate";
export type AdmissionMetricVerificationStatus = "official" | "secondary" | "unverified";

export type AdmissionMetric = {
  id: string;
  universityId: string;
  cycleYear: number;
  cohort: AdmissionMetricCohort;
  metricKey: AdmissionMetricKey;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  submittersOnly: boolean;
  gpaWeighted: boolean | null;
  verificationStatus: AdmissionMetricVerificationStatus;
  sourceUrlId: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
};

function mapAdmissionMetricRow(row: {
  id: string;
  university_id: string;
  cycle_year: number;
  cohort: AdmissionMetricCohort;
  metric_key: AdmissionMetricKey;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  submitters_only: boolean;
  gpa_weighted: boolean | null;
  verification_status: AdmissionMetricVerificationStatus;
  source_url_id: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}): AdmissionMetric {
  return {
    id: row.id,
    universityId: row.university_id,
    cycleYear: row.cycle_year,
    cohort: row.cohort,
    metricKey: row.metric_key,
    value: row.value,
    valueText: row.value_text,
    unit: row.unit,
    submittersOnly: row.submitters_only,
    gpaWeighted: row.gpa_weighted,
    verificationStatus: row.verification_status,
    sourceUrlId: row.source_url_id,
    verifiedAt: row.verified_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const ADMISSION_METRIC_COLUMNS =
  "id, university_id, cycle_year, cohort, metric_key, value, value_text, unit, submitters_only, gpa_weighted, verification_status, source_url_id, verified_at, notes, created_at";

/** 관리자 화면 — 대학 하나의 학업 지표 전체(모든 연도·대상집단) 조회, 편집 화면용. */
export async function listAdmissionMetrics(universityId: string): Promise<AdmissionMetric[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("university_admission_metrics")
    .select(ADMISSION_METRIC_COLUMNS)
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false })
    .order("cohort", { ascending: true })
    .order("metric_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAdmissionMetricRow);
}

/**
 * 공개 조회 — 학생/보호자/컨설턴트 화면용. 미검증(unverified) 포함 전부 반환한다
 * (정책상 숨기지 않음 — 화면에서 검증상태 배지로 명시). cycle_year 내림차순, cohort/metric_key
 * 순으로 정렬해 반환하므로 화면은 그대로 그룹핑해서 쓰면 된다.
 */
export async function loadAdmissionMetrics(universityId: string): Promise<AdmissionMetric[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("university_admission_metrics")
    .select(ADMISSION_METRIC_COLUMNS)
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false })
    .order("cohort", { ascending: true })
    .order("metric_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAdmissionMetricRow);
}

export type UpsertAdmissionMetricInput = {
  universityId: string;
  cycleYear: number;
  cohort: AdmissionMetricCohort;
  metricKey: AdmissionMetricKey;
  value?: number | null;
  valueText?: string | null;
  unit?: string | null;
  submittersOnly?: boolean;
  gpaWeighted?: boolean | null;
  verificationStatus: AdmissionMetricVerificationStatus;
  sourceUrlId?: string | null;
  notes?: string | null;
};

/** 관리자 — 지표 추가/수정(연도×대상집단×지표 unique 키 기준 upsert). */
export async function upsertAdmissionMetric(input: UpsertAdmissionMetricInput): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("university_admission_metrics").upsert(
    {
      university_id: input.universityId,
      cycle_year: input.cycleYear,
      cohort: input.cohort,
      metric_key: input.metricKey,
      value: input.value ?? null,
      value_text: input.valueText ?? null,
      unit: input.unit ?? null,
      submitters_only: input.submittersOnly ?? false,
      gpa_weighted: input.gpaWeighted ?? null,
      verification_status: input.verificationStatus,
      source_url_id: input.sourceUrlId ?? null,
      verified_at: input.verificationStatus === "official" ? new Date().toISOString() : null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "university_id,cycle_year,cohort,metric_key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 관리자 — 지표 삭제. */
export async function deleteAdmissionMetric(metricId: string): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("university_admission_metrics").delete().eq("id", metricId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

// --- 지원요강·에세이 문항(Essay Prompts, P8 2026-09-23) ----------------------
//
// 스키마: supabase/migrations/20261500000000_college_db_p8_essay_prompts.sql
// (원본 테이블: P5 20261428000000 — 자체 supplement 에세이만 표현하던 레거시를 additive 확장)

export type UniversityEssayPromptType = "common_app" | "school_specific" | "short_answer" | "program_conditional";
export type UniversityEssayPromptStatus = "confirmed_current_year" | "unconfirmed_current_year" | "prior_year_reference";

export type UniversityEssayPrompt = {
  id: string;
  universityId: string;
  cycleYear: number;
  promptType: UniversityEssayPromptType;
  title: string | null;
  promptText: string | null;
  topicSummary: string | null;
  selectionGroupId: string | null;
  selectCount: number | null;
  groupSize: number | null;
  isRequired: boolean;
  appliesToSchool: string | null;
  appliesToMajors: string[] | null;
  applicationPaths: string[] | null;
  wordLimitMin: number | null;
  wordLimitMax: number | null;
  charLimit: number | null;
  sourceUrlId: string | null;
  promptStatus: UniversityEssayPromptStatus;
  lastVerifiedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  notes: string | null;
  createdAt: string;
};

const ESSAY_PROMPT_COLUMNS =
  "id, university_id, cycle_year, prompt_type, title, prompt_text, topic_summary, selection_group_id, select_count, group_size, is_required, applies_to_school, applies_to_majors, application_paths, word_limit_min, word_limit_max, char_limit, source_url_id, prompt_status, last_verified_at, reviewed_by, reviewed_at, review_note, notes, created_at";

function mapUniversityEssayPromptRow(row: {
  id: string;
  university_id: string;
  cycle_year: number;
  prompt_type: UniversityEssayPromptType;
  title: string | null;
  prompt_text: string | null;
  topic_summary: string | null;
  selection_group_id: string | null;
  select_count: number | null;
  group_size: number | null;
  is_required: boolean;
  applies_to_school: string | null;
  applies_to_majors: string[] | null;
  application_paths: string[] | null;
  word_limit_min: number | null;
  word_limit_max: number | null;
  char_limit: number | null;
  source_url_id: string | null;
  prompt_status: UniversityEssayPromptStatus;
  last_verified_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  notes: string | null;
  created_at: string;
}): UniversityEssayPrompt {
  return {
    id: row.id,
    universityId: row.university_id,
    cycleYear: row.cycle_year,
    promptType: row.prompt_type,
    title: row.title,
    promptText: row.prompt_text,
    topicSummary: row.topic_summary,
    selectionGroupId: row.selection_group_id,
    selectCount: row.select_count,
    groupSize: row.group_size,
    isRequired: row.is_required,
    appliesToSchool: row.applies_to_school,
    appliesToMajors: row.applies_to_majors,
    applicationPaths: row.application_paths,
    wordLimitMin: row.word_limit_min,
    wordLimitMax: row.word_limit_max,
    charLimit: row.char_limit,
    sourceUrlId: row.source_url_id,
    promptStatus: row.prompt_status,
    lastVerifiedAt: row.last_verified_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** 관리자 화면 — 대학 하나의 에세이 문항 전체(모든 연도·유형) 조회, 편집 화면용. */
export async function listUniversityEssayPrompts(universityId: string): Promise<UniversityEssayPrompt[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("university_essay_prompts")
    .select(ESSAY_PROMPT_COLUMNS)
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false })
    .order("prompt_type", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUniversityEssayPromptRow);
}

/**
 * 공개 조회 — 학생/보호자/컨설턴트 화면용. 미확인/지난연도 포함 전부 반환한다(정책상
 * 숨기지 않음 — 화면에서 확인상태 배지로 명시). cycle_year 내림차순 정렬로 반환하므로
 * 화면에서 지원연도 선택 필터로 그대로 쓰면 된다.
 */
export async function loadUniversityEssayPrompts(universityId: string, cycleYear?: number): Promise<UniversityEssayPrompt[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const db = createAdminClient();
  let query = db
    .from("university_essay_prompts")
    .select(ESSAY_PROMPT_COLUMNS)
    .eq("university_id", universityId)
    .order("cycle_year", { ascending: false })
    .order("prompt_type", { ascending: true })
    .order("created_at", { ascending: true });
  if (cycleYear != null) query = query.eq("cycle_year", cycleYear);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapUniversityEssayPromptRow);
}

export type UpsertUniversityEssayPromptInput = {
  id?: string;
  universityId: string;
  cycleYear: number;
  promptType: UniversityEssayPromptType;
  title?: string | null;
  promptText?: string | null;
  topicSummary?: string | null;
  selectionGroupId?: string | null;
  selectCount?: number | null;
  groupSize?: number | null;
  isRequired?: boolean;
  appliesToSchool?: string | null;
  appliesToMajors?: string[] | null;
  applicationPaths?: string[] | null;
  wordLimitMin?: number | null;
  wordLimitMax?: number | null;
  charLimit?: number | null;
  sourceUrlId?: string | null;
  promptStatus: UniversityEssayPromptStatus;
  notes?: string | null;
};

/** 관리자 — 문항 추가(id 없음) 또는 수정(id 있음). */
export async function upsertUniversityEssayPrompt(input: UpsertUniversityEssayPromptInput): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const payload = {
    university_id: input.universityId,
    cycle_year: input.cycleYear,
    prompt_type: input.promptType,
    title: input.title ?? null,
    prompt_text: input.promptText ?? null,
    topic_summary: input.topicSummary ?? null,
    selection_group_id: input.selectionGroupId ?? null,
    select_count: input.selectCount ?? null,
    group_size: input.groupSize ?? null,
    is_required: input.isRequired ?? true,
    applies_to_school: input.appliesToSchool ?? null,
    applies_to_majors: input.appliesToMajors ?? null,
    application_paths: input.applicationPaths ?? null,
    word_limit_min: input.wordLimitMin ?? null,
    word_limit_max: input.wordLimitMax ?? null,
    char_limit: input.charLimit ?? null,
    source_url_id: input.sourceUrlId ?? null,
    prompt_status: input.promptStatus,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db.from("university_essay_prompts").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("university_essay_prompts").insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/universities");
}

/** 관리자 — 문항 검토(확인상태 갱신 + 확인일 기록). */
export async function reviewUniversityEssayPrompt(input: {
  promptId: string;
  promptStatus: UniversityEssayPromptStatus;
  reviewNote?: string | null;
}): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("university_essay_prompts")
    .update({
      prompt_status: input.promptStatus,
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
      last_verified_at: input.promptStatus === "confirmed_current_year" ? new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.promptId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}

/** 관리자 — 문항 삭제. */
export async function deleteUniversityEssayPrompt(promptId: string): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("university_essay_prompts").delete().eq("id", promptId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/universities");
}
