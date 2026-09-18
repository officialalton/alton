import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RoadmapData,
  AcademicProfile,
  TestRecord,
  ApExam,
  Demographics,
  CollegeInterests,
  ActivityAward,
  Award,
  PrepItem,
  Milestone,
  MonthlyReview,
} from "./types";

// P9 로드맵 V1 데이터 로더 — RLS(_roadmap_can_read)가 이미 학생 본인/담당
// 교사/보호자/관리자로 범위를 제한하므로 여기서는 추가 소유권 검증을 하지
// 않는다. 학생/보호자/교사/관리자 4개 진입점이 전부 이 로더를 공유한다.
export async function loadRoadmapData(
  supabase: SupabaseClient,
  studentId: string
): Promise<RoadmapData> {
  const [
    profileRes,
    studentRes,
    academicRes,
    testRes,
    apExamRes,
    demographicsRes,
    interestsRes,
    activitiesRes,
    awardsRes,
    prepRes,
    milestonesRes,
    reviewRes,
  ] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", studentId).maybeSingle(),
    supabase.from("students").select("grade, school_name, gpa, gpa_scale, class_rank, class_size").eq("id", studentId).maybeSingle(),
    supabase
      .from("student_academic_profile")
      .select(
        "graduation_year, curriculum_type, current_subjects, honors_count, ap_count, college_courses_count, ib_hl_count, ib_sl_count, school_ap_ib_offered_count"
      )
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_test_records")
      .select("id, test_type, record_kind, test_date, score, notes, score_math, score_reading_writing, score_english, score_science")
      .eq("student_id", studentId)
      .order("test_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("student_ap_courses")
      .select("id, course_name, status, exam_year, score")
      .eq("student_id", studentId)
      .order("exam_year", { ascending: false, nullsFirst: false }),
    supabase
      .from("student_demographics")
      .select(
        "home_country, zip_code, residency_status, gender, race_ethnicity, financial_aid_intent, max_annual_budget, household_income_range, first_generation, legacy_schools, religious_affiliation, recruited_athlete, special_school_interests"
      )
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_college_interests")
      .select(
        "intended_majors, career_interests, target_countries, target_college_types, target_colleges, target_application_timing"
      )
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_extracurricular_activities")
      .select(
        "id, activity_name, description, field, role, start_date, end_date, is_ongoing, total_hours, leadership_summary, achievement_summary, tier"
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_awards")
      .select("id, award_name, award_level, awarded_date, related_activity_id, notes")
      .eq("student_id", studentId)
      .order("awarded_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("student_prep_items")
      .select("id, item_type, custom_label, status, notes")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_roadmap_milestones")
      .select("id, title, description, target_period, target_date, status, notes, related_links")
      .eq("student_id", studentId)
      .order("target_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("student_roadmap_monthly_reviews")
      .select("id, period, status, content")
      .eq("student_id", studentId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const errors = [
    profileRes.error,
    studentRes.error,
    academicRes.error,
    testRes.error,
    apExamRes.error,
    demographicsRes.error,
    interestsRes.error,
    activitiesRes.error,
    awardsRes.error,
    prepRes.error,
    milestonesRes.error,
    reviewRes.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e!.message).join("; "));
  }

  const academicProfile: AcademicProfile = {
    graduationYear: academicRes.data?.graduation_year ?? null,
    curriculumType: academicRes.data?.curriculum_type ?? null,
    currentSubjects: academicRes.data?.current_subjects ?? [],
    honorsCount: academicRes.data?.honors_count ?? null,
    apCount: academicRes.data?.ap_count ?? null,
    collegeCoursesCount: academicRes.data?.college_courses_count ?? null,
    ibHlCount: academicRes.data?.ib_hl_count ?? null,
    ibSlCount: academicRes.data?.ib_sl_count ?? null,
    schoolApIbOfferedCount: academicRes.data?.school_ap_ib_offered_count ?? null,
  };

  const testRecords: TestRecord[] = (testRes.data ?? []).map((r) => ({
    id: r.id,
    testType: r.test_type,
    recordKind: r.record_kind,
    testDate: r.test_date,
    score: r.score,
    notes: r.notes,
    scoreMath: r.score_math,
    scoreReadingWriting: r.score_reading_writing,
    scoreEnglish: r.score_english,
    scoreScience: r.score_science,
  }));

  const apExams: ApExam[] = (apExamRes.data ?? []).map((a) => ({
    id: a.id,
    courseName: a.course_name,
    status: a.status,
    examYear: a.exam_year,
    score: a.score,
  }));

  const demographics: Demographics = {
    homeCountry: demographicsRes.data?.home_country ?? null,
    zipCode: demographicsRes.data?.zip_code ?? null,
    residencyStatus: demographicsRes.data?.residency_status ?? null,
    gender: demographicsRes.data?.gender ?? null,
    raceEthnicity: demographicsRes.data?.race_ethnicity ?? null,
    financialAidIntent: demographicsRes.data?.financial_aid_intent ?? null,
    maxAnnualBudget: demographicsRes.data?.max_annual_budget ?? null,
    householdIncomeRange: demographicsRes.data?.household_income_range ?? null,
    firstGeneration: demographicsRes.data?.first_generation ?? null,
    legacySchools: demographicsRes.data?.legacy_schools ?? [],
    religiousAffiliation: demographicsRes.data?.religious_affiliation ?? null,
    recruitedAthlete: demographicsRes.data?.recruited_athlete ?? null,
    specialSchoolInterests: demographicsRes.data?.special_school_interests ?? [],
  };

  const collegeInterests: CollegeInterests = {
    intendedMajors: interestsRes.data?.intended_majors ?? [],
    careerInterests: interestsRes.data?.career_interests ?? [],
    targetCountries: interestsRes.data?.target_countries ?? [],
    targetCollegeTypes: interestsRes.data?.target_college_types ?? [],
    targetColleges: interestsRes.data?.target_colleges ?? [],
    targetApplicationTiming: interestsRes.data?.target_application_timing ?? null,
  };

  const activities: ActivityAward[] = (activitiesRes.data ?? []).map((a) => ({
    id: a.id,
    activityName: a.activity_name,
    description: a.description,
    field: a.field,
    role: a.role,
    startDate: a.start_date,
    endDate: a.end_date,
    isOngoing: a.is_ongoing,
    totalHours: a.total_hours,
    leadershipSummary: a.leadership_summary,
    achievementSummary: a.achievement_summary,
    tier: a.tier,
  }));

  const awards: Award[] = (awardsRes.data ?? []).map((a) => ({
    id: a.id,
    awardName: a.award_name,
    awardLevel: a.award_level,
    awardedDate: a.awarded_date,
    relatedActivityId: a.related_activity_id,
    notes: a.notes,
  }));

  const prepItems: PrepItem[] = (prepRes.data ?? []).map((p) => ({
    id: p.id,
    itemType: p.item_type,
    customLabel: p.custom_label,
    status: p.status,
    notes: p.notes,
  }));

  const milestones: Milestone[] = (milestonesRes.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    targetPeriod: m.target_period,
    targetDate: m.target_date,
    status: m.status,
    notes: m.notes,
    relatedLinks: m.related_links ?? [],
  }));

  const latestMonthlyReview: MonthlyReview | null = reviewRes.data
    ? {
        id: reviewRes.data.id,
        period: reviewRes.data.period,
        status: reviewRes.data.status,
        content: reviewRes.data.content,
      }
    : null;

  const sectionFilled = [
    Boolean(
      academicProfile.graduationYear ||
        academicProfile.curriculumType ||
        academicProfile.currentSubjects.length > 0
    ),
    testRecords.length > 0,
    Boolean(
      collegeInterests.intendedMajors.length > 0 ||
        collegeInterests.targetColleges.length > 0 ||
        collegeInterests.careerInterests.length > 0
    ),
    activities.length > 0 || awards.length > 0,
    prepItems.length > 0,
  ];

  return {
    studentId,
    studentName: profileRes.data?.name ?? "학생",
    grade: studentRes.data?.grade ?? null,
    schoolName: studentRes.data?.school_name ?? null,
    gpa: studentRes.data?.gpa ?? null,
    gpaScale: studentRes.data?.gpa_scale ?? null,
    classRank: studentRes.data?.class_rank ?? null,
    classSize: studentRes.data?.class_size ?? null,
    academicProfile,
    testRecords,
    apExams,
    demographics,
    collegeInterests,
    activities,
    awards,
    prepItems,
    milestones,
    latestMonthlyReview,
    completeness: {
      filledSections: sectionFilled.filter(Boolean).length,
      totalSections: sectionFilled.length,
    },
  };
}
