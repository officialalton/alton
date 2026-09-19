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
    .select("id, rank_final, name, country, city, state, public_private, application_platform, url_verification_status")
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
): Promise<{ university: UniversityDetail; cycles: AdmissionCycle[]; updates: UniversityUpdateEntry[]; majors: UniversityMajor[]; essayPrompts: EssayPrompt[] }> {
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
  };
}

/** 관리자 상세/편집 화면용. */
export async function getUniversityDetail(
  universityId: string,
): Promise<{ university: UniversityDetail; cycles: AdmissionCycle[]; updates: UniversityUpdateEntry[]; majors: UniversityMajor[]; essayPrompts: EssayPrompt[] }> {
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
): Promise<{ university: UniversityDetail; cycles: AdmissionCycle[]; updates: UniversityUpdateEntry[]; majors: UniversityMajor[]; essayPrompts: EssayPrompt[] }> {
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
