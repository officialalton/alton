// P9 학생 프로필·로드맵 V1 — 공유 타입. supabase/migrations/20261420000000 스키마와 1:1 대응.

export type TestType = "SAT" | "ACT" | "PSAT";
export type TestRecordKind = "actual" | "target" | "planned";
export type PrepItemType =
  | "essay"
  | "recommendation"
  | "portfolio"
  | "volunteering"
  | "internship"
  | "other";
export type PrepStatus = "not_started" | "in_progress" | "done";
export type MilestoneStatus = "todo" | "in_progress" | "done";

export const PREP_ITEM_LABELS: Record<PrepItemType, string> = {
  essay: "Essay",
  recommendation: "Recommendation letter",
  portfolio: "Portfolio",
  volunteering: "Volunteering",
  internship: "Internship",
  other: "Other",
};

export const PREP_STATUS_LABELS: Record<PrepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  todo: "Planned",
  in_progress: "In progress",
  done: "Done",
};

export interface AcademicProfile {
  graduationYear: number | null;
  curriculumType: string | null;
  currentSubjects: string[];
  // 2026-09-19 확장(CollegeVine Coursework 탭 동등 항목).
  honorsCount: number | null;
  apCount: number | null;
  collegeCoursesCount: number | null;
  ibHlCount: number | null;
  ibSlCount: number | null;
  schoolApIbOfferedCount: number | null;
  // 2026-09-22 확장(사용자 지시 — "목표 설정" 서브탭).
  targetGpa: number | null;
  targetSat: number | null;
  targetApCount: number | null;
  targetExtracurricular: string | null;
}

export interface Course {
  id: string;
  courseName: string;
  status: "taking" | "completed";
  score: string | null;
  academicYear: number | null;
  gradeLevel: string | null;
}

export interface TestRecord {
  id: string;
  testType: TestType;
  recordKind: TestRecordKind;
  testDate: string | null;
  score: number | null;
  notes: string | null;
  // 2026-09-19 확장 — SAT/PSAT: scoreMath+scoreReadingWriting. ACT: scoreMath+scoreReadingWriting(Reading)+scoreEnglish+scoreScience.
  scoreMath: number | null;
  scoreReadingWriting: number | null;
  scoreEnglish: number | null;
  scoreScience: number | null;
}

export type FinancialAidIntent = "planning" | "not_planning" | "not_sure";
export type FirstGeneration = "yes" | "no" | "prefer_not_to_say";
export type RecruitedAthlete = "yes" | "maybe" | "no";
export type ResidencyStatus = "us_resident" | "international";

export interface Demographics {
  homeCountry: string | null;
  zipCode: string | null;
  residencyStatus: ResidencyStatus | null;
  gender: string | null;
  raceEthnicity: string | null;
  financialAidIntent: FinancialAidIntent | null;
  maxAnnualBudget: number | null;
  householdIncomeRange: string | null;
  firstGeneration: FirstGeneration | null;
  legacySchools: string[];
  religiousAffiliation: string | null;
  recruitedAthlete: RecruitedAthlete | null;
  specialSchoolInterests: string[];
}

export type ActivityTier = "exceptional" | "strong" | "solid" | "standard";
export const ACTIVITY_TIER_LABELS: Record<ActivityTier, string> = {
  exceptional: "Exceptional — top national/international achievement",
  strong: "Strong — top state/regional results or highest school leadership role",
  solid: "Solid — consistent participation with some achievements",
  standard: "Standard — general participation",
};

export interface CollegeInterests {
  intendedMajors: string[];
  careerInterests: string[];
  targetCountries: string[];
  targetCollegeTypes: string[];
  targetColleges: string[];
  targetApplicationTiming: string | null;
}

export interface ActivityAward {
  id: string;
  activityName: string;
  description: string | null;
  field: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  totalHours: number | null;
  leadershipSummary: string | null;
  achievementSummary: string | null;
  tier: ActivityTier | null;
}

export interface ApExam {
  id: string;
  courseName: string;
  status: "planned" | "taking" | "completed";
  examYear: number | null;
  score: number | null;
}

export interface Award {
  id: string;
  awardName: string;
  awardLevel: string | null;
  awardedDate: string | null;
  relatedActivityId: string | null;
  notes: string | null;
}

export interface PrepItem {
  id: string;
  itemType: PrepItemType;
  customLabel: string | null;
  status: PrepStatus;
  notes: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  targetPeriod: string | null;
  targetDate: string | null;
  status: MilestoneStatus;
  notes: string | null;
  relatedLinks: string[];
}

export interface MonthlyReview {
  id: string;
  period: string;
  status: "not_generated" | "generated";
  content: string | null;
}

export interface RoadmapData {
  studentId: string;
  studentName: string;
  grade: string | null;
  /** 2026-10-05 무료 회원 S2 — 관리자·컨설턴트 화면 배지용(무료 회원은 로드맵 쓰기 불가, _roadmap_can_write). */
  memberType: "free" | "tutoring";
  schoolName: string | null;
  gpa: number | null;
  gpaScale: string | null;
  classRank: number | null;
  classSize: number | null;
  academicProfile: AcademicProfile;
  testRecords: TestRecord[];
  apExams: ApExam[];
  courses: Course[];
  demographics: Demographics;
  collegeInterests: CollegeInterests;
  activities: ActivityAward[];
  awards: Award[];
  prepItems: PrepItem[];
  milestones: Milestone[];
  latestMonthlyReview: MonthlyReview | null;
  completeness: {
    filledSections: number;
    totalSections: number;
  };
}
