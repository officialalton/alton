import type { AttemptFacts } from "@/lib/mock-exam/score-aggregate";

export type FreeAccountsListParams = {
  search?: string;
  joinedFrom?: string; joinedTo?: string;
  activeFrom?: string; activeTo?: string;
  hasAttempts?: boolean | null;
  consultStage?: string | null;
  accountStatus?: string | null; // null: closed 제외 / 'any'
  scope?: "free" | "converted" | "all";
  includeTest?: boolean;
  sort?: "joined_at" | "last_active_at" | "completed_tests" | "name" | "email" | "consult_stage";
  dir?: "asc" | "desc";
  limit?: number; offset?: number;
};

export type FreeAccountRow = {
  studentId: string; name: string; email: string; joinedAt: string; lastActiveAt: string | null;
  completedTests: number; inProgressTests: number; consultStage: string; consultFlags: string[];
  accountStatus: string; memberType: string; convertedAt: string | null; isTestAccount: boolean;
};
export type FreeAccountsPage = { rows: FreeAccountRow[]; total: number };

export type FreeAccountProfile = {
  studentId: string; name: string; email: string | null; grade: string | null; schoolName: string | null;
  joinedAt: string; lastActiveAt: string | null; lastSignInAt: string | null;
  accountStatus: string; memberType: string; signupSource: string | null;
  isTestAccount: boolean; testAccountSource: string | null; convertedAt: string | null;
  featureKeys: string[]; hasTutoringAccess: boolean;
  guardians: { id: string; name: string; email: string | null; linkedAt: string }[];
  invite: { status: string; sentAt: string | null; acceptedAt: string | null; needsReview: boolean; reason: string | null } | null;
  interest: { status: string; entryPoint: string | null; createdAt: string } | null;
  consultations: { id: string; status: string; startsAt: string | null; completedAt: string | null; cancelledAt: string | null; noShowAt: string | null; closedAt: string | null; consultantName: string | null; createdAt: string }[];
  consultStage: string; consultFlags: string[];
  statusHistory: { previous: string | null; new: string; changedBy: string | null; reason: string | null; at: string }[];
};

/** 응시 이력 한 행: 점수 환산용 AttemptFacts + 화면 표시용 부가 필드. */
export type AttemptHistoryRow = AttemptFacts & { difficultyTier: string; submittedAt: string | null; scoreAdjusted: boolean; createdAtOrder: number };

export type UsageEvents = { opens: number; lastAt: string | null };
export type NotTracked = "not_tracked";
export type LearningUsage = {
  mistakeNotebook: { savedCount: number; lastUpdatedAt: string | null; reviewed: NotTracked | UsageEvents };
  vocabulary: { wordsSaved: number; lastWordAt: string | null; quizzesCompleted: number; avgQuizPct: number | null; lastQuizAt: string | null; flashcardStudy: NotTracked | UsageEvents };
  materials: { docsOpened: number; lastReadAt: string | null; views: NotTracked | UsageEvents; timeSpent: NotTracked };
  tracking: { learningEventsSince: string | null };
};

export type FreeAccountsAnalytics = {
  period: { from: string; to: string; timezone: string };
  testAccountsExcluded: number;
  signups: { totalFreeAccounts: number; newInPeriod: number; activeLast7Days: number; activeInPeriod: number; convertedTotal: number };
  learning: {
    testsStarted: number; testsCompleted: number; startedCohortSize: number; startedCohortCompleted: number;
    satStarted: number; apStarted: number; mistakeNotebookSavedTotal: number; mistakeNotebookStudentsTotal: number;
    vocabWordsAdded: number; vocabWordStudents: number; mistakeReviewOpens: number; mistakeReviewStudents: number; vocabStudyOpens: number; materialOpens: number; materialStudents: number; trackingSince: string | null; vocabQuizzesCompleted: number; vocabQuizStudents: number; materialsDocsOpened: number;
  };
  conversion: {
    consultRequests: number; invitesSent: number; invitesAccepted: number; bookings: number; completions: number; tutoringConversions: number;
    cohort: { size: number; requested: number; inviteAccepted: number; booked: number; completed: number; converted: number };
  };
};
