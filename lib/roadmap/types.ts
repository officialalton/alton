// P9 학생 프로필·로드맵 V1 — 공유 타입. supabase/migrations/20261420000000 스키마와 1:1 대응.

export type TestType = "SAT" | "ACT";
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
  essay: "에세이",
  recommendation: "추천서",
  portfolio: "포트폴리오",
  volunteering: "봉사 활동",
  internship: "인턴십",
  other: "기타",
};

export const PREP_STATUS_LABELS: Record<PrepStatus, string> = {
  not_started: "시작 전",
  in_progress: "진행 중",
  done: "완료",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  todo: "예정",
  in_progress: "진행 중",
  done: "완료",
};

export interface AcademicProfile {
  graduationYear: number | null;
  curriculumType: string | null;
  currentSubjects: string[];
}

export interface TestRecord {
  id: string;
  testType: TestType;
  recordKind: TestRecordKind;
  testDate: string | null;
  score: number | null;
  notes: string | null;
}

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
  schoolName: string | null;
  gpa: number | null;
  academicProfile: AcademicProfile;
  testRecords: TestRecord[];
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
