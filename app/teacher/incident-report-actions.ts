"use server";

// R6 10/N — 선생님이 지난 수업의 본인 지각 또는 학생 노쇼를 신고한다. 최종 판정·수업권
// 소진·정산은 R7 범위 — 이 액션은 신고 기록만 남긴다.

import { requireUser } from "@/lib/auth";
import { submitIncidentReport, type IncidentReportType } from "@/lib/booking/incident-reports";

export async function reportSessionIssue(params: {
  sessionId: string;
  reportType: Extract<IncidentReportType, "teacher_late" | "student_no_show_reported">;
  minutesLate?: number;
  notes?: string;
}): Promise<void> {
  const { supabase } = await requireUser();
  await submitIncidentReport(supabase, params);
}
