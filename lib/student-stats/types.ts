// 학생 통계 확장 — 화면으로 내려가는 데이터 모양(역할별로 서버가 필드를 아예 빼고 내려준다).
// 모의고사 경로·난이도·정책 버전은 이 타입 어디에도 없다.

/** 열람 등급. 학생 본인 = 학부모(동일 범위), 컨설턴트 = 직원, 관리자 = 직원 + 선생님 운영 지표. */
export type StatsTier = "family" | "staff" | "admin";

export type SkillStat = {
  code: string;
  label: string;
  domain: string | null;
  total: number;
  correct: number;
  recentTotal: number;
  recentCorrect: number;
  priorTotal: number;
  priorCorrect: number;
};
export type WeekPoint = { week: string; total: number; correct: number };

export type WeakSkill = {
  code: string;
  label: string;
  total: number;
  correct: number;
  pct: number;
  /** 최근 4주 vs 그 이전 정답률 변화(%p). 양쪽 표본이 3개 미만이면 null. */
  delta: number | null;
};

export type SkillStats = {
  totalAnswered: number;
  overallPct: number | null;
  weak: WeakSkill[];
  weekly: { week: string; pct: number | null; total: number }[];
};

export type EntitlementStats = {
  remaining: number;
  expiringSoon: number;
  nextExpiresAt: string | null;
  groups: { label: string; remaining: number; expiresAt: string | null; isPaid: boolean }[];
};

export type ScoreRangeOut = { low: number; high: number };
export type MockPoint = {
  gradedAt: string;
  /** 채점 완료 응시의 전체 정답률(%). */
  accuracyPct: number | null;
  /** 예상 점수 범위(내부 추정). 적응형 모의고사이고 두 섹션이 모두 채점된 경우만. */
  total: ScoreRangeOut | null;
  rw: ScoreRangeOut | null;
  math: ScoreRangeOut | null;
};
export type MockStats = {
  points: MockPoint[];
  /** 직원 전용 — 섹션별·영역별 강약(누적). */
  strengths?: {
    sections: { key: "rw" | "math"; label: string; total: number; correct: number; pct: number }[];
    domains: { label: string; total: number; correct: number; pct: number }[];
  };
};

export type HomeworkStats = {
  assigned: number;
  submitted: number;
  completionPct: number | null;
  onTimePct: number | null;
  accuracyPct: number | null;
  weekly: { week: string; accuracyPct: number | null; graded: number }[];
  overdue: { total: number; homework: number; vocabQuiz: number; mockExam: number; manual: number };
};

export type HabitStats = {
  weekly: { week: string; homework: number; lesson: number; vocab: number; total: number }[];
  vocabQuizzes: { at: string; pct: number; score: number; total: number }[];
};

export type OpsStats = {
  months: { month: string; completed: number; noShow: number; late: number; cancelled: number; lateCancel: number }[];
  totals: { completed: number; noShow: number; late: number; cancelled: number; lateCancel: number };
};

/** 관리자 전용 — 선생님 운영 지표. */
export type TeacherOpsStats = {
  reviews: { teacherName: string; sessions: number; finalized: number; draft: number; missing: number; avgHoursToFinalize: number | null }[];
  grading: { pending: number; oldestPendingAt: string | null; avgHoursToGrade: number | null };
};

export type ExtendedStats = {
  tier: StatsTier;
  skills: SkillStats;
  entitlements: EntitlementStats;
  mock: MockStats;
  homework: HomeworkStats;
  habits: HabitStats;
  ops: OpsStats;
  /** 직원·관리자만(학생 본인·학부모에는 키 자체가 없다). */
  teacherOps?: TeacherOpsStats;
};

/** 집계 RPC 원본(서비스 롤 전용). 경로가 들어 있으므로 서버 밖으로 내보내지 않는다. */
export type RawStatsAggregate = {
  skills: SkillStat[];
  skillWeekly: WeekPoint[];
  entitlements: { remaining: number | string; expiringSoon: number | string; nextExpiresAt: string | null; groups: { label: string; remaining: number | string; expiresAt: string | null; isPaid: boolean }[] } | null;
  mock: {
    attemptId: string;
    gradedAt: string;
    format: string;
    rwRoute: "higher" | "lower" | null;
    mathRoute: "higher" | "lower" | null;
    sections: { section: "rw" | "math"; total: number; correct: number; answered?: number }[];
    domains: { domain: string; total: number; correct: number }[];
  }[];
  homework: {
    assigned: number; submitted: number; onTime: number; graded: number; correct: number;
    weekly: { week: string; assigned: number; submitted: number; graded: number; correct: number }[];
  };
  overdue: { homework: number; vocabQuiz: number; mockExam: number; manual: number };
  habits: { week: string; homework: number; lesson: number; vocab: number }[];
  vocabQuizzes: { at: string; score: number; total: number }[];
  ops: { month: string; completed: number; noShow: number; late: number; cancelled: number; lateCancel: number }[];
  staff: {
    reviewsByTeacher: { teacherId: string; teacherName: string | null; sessions: number; finalized: number; draft: number; missing: number; avgHoursToFinalize: number | null }[];
    grading: { pending: number; oldestPendingAt: string | null; avgHoursToGrade: number | null };
  } | null;
};
