import type { SupabaseClient } from "@supabase/supabase-js";

// R6 10/N — 지각·노쇼 "신고" 제출/조회(순수 데이터 계층). 최종 판정·수업권 소진·정산은
// R7 범위이므로 여기서는 session_incident_reports에 append만 한다(5/N에서 만든 테이블,
// RLS가 "is_session_related_v3(session_id) or is_admin() or capability"로 이미 제한).

export type IncidentReportType = "teacher_late" | "student_no_show_reported" | "teacher_no_show_reported";

export async function submitIncidentReport(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    reportType: IncidentReportType;
    minutesLate?: number;
    notes?: string;
  }
): Promise<void> {
  if (params.reportType === "teacher_late" && (params.minutesLate === undefined || params.minutesLate === null)) {
    throw new Error("선생님 지각 신고는 지각 시간(분)이 필요합니다.");
  }
  const { error } = await supabase.from("session_incident_reports").insert({
    session_id: params.sessionId,
    report_type: params.reportType,
    minutes_late: params.minutesLate ?? null,
    notes: params.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export type IncidentReportRow = {
  id: string;
  sessionId: string;
  reportType: IncidentReportType;
  reportedByName: string | null;
  minutesLate: number | null;
  notes: string | null;
  reportedAt: string;
};

function extractName(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? null;
}

export async function listIncidentReportsForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<IncidentReportRow[]> {
  const { data, error } = await supabase
    .from("session_incident_reports")
    .select("id, session_id, report_type, minutes_late, notes, reported_at, reporter:profiles!session_incident_reports_reported_by_fkey(name)")
    .eq("session_id", sessionId)
    .order("reported_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    sessionId: r.session_id as string,
    reportType: r.report_type as IncidentReportType,
    reportedByName: extractName(r.reporter),
    minutesLate: (r.minutes_late as number) ?? null,
    notes: (r.notes as string) ?? null,
    reportedAt: r.reported_at as string,
  }));
}
