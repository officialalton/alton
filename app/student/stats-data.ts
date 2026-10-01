import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/select-in-chunks";
import { buildExtendedStats } from "@/lib/student-stats/metrics";
import type { ExtendedStats, RawStatsAggregate, StatsTier } from "@/lib/student-stats/types";

export type SubjectAttendance = {
  subjectName: string;
  pct: number;
};

export type StatsData = {
  attendanceRate: number | null;
  /** 학생이 선생님 수업에 준 만족도 — 직원(컨설턴트·관리자)에게만 내려간다. 학생 본인·학부모 응답에는 키 자체가 없다. */
  satisfactionAvg?: number | null;
  bySubject: SubjectAttendance[];
  /** 확장 통계(skill·수업권·모의고사·과제·습관·운영). 없으면 기존 요약만 보여준다. */
  extended?: ExtendedStats;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadStats(
  supabase: SupabaseClient,
  studentId: string,
  opts: { includeSatisfaction?: boolean } = {}
): Promise<StatsData> {
  const includeSatisfaction = opts.includeSatisfaction ?? true;
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [e.id, extractName(e.subject)])
  );

  const { data: sessions } = enrollmentIds.length
    ? await selectInChunks(enrollmentIds, (chunk) => supabase
        .from("legacy_sessions")
        .select("id, enrollment_id, status")
        .in("enrollment_id", chunk))
    : { data: [] as never[] };

  const countsBySubject = new Map<string, { completed: number; noShow: number }>();
  let totalCompleted = 0;
  let totalNoShow = 0;

  for (const s of sessions ?? []) {
    if (s.status !== "completed" && s.status !== "no_show") continue;
    const subjectName = subjectByEnrollment.get(s.enrollment_id) ?? "";
    const counts = countsBySubject.get(subjectName) ?? { completed: 0, noShow: 0 };
    if (s.status === "completed") {
      counts.completed++;
      totalCompleted++;
    } else {
      counts.noShow++;
      totalNoShow++;
    }
    countsBySubject.set(subjectName, counts);
  }

  const attendanceDenominator = totalCompleted + totalNoShow;
  const attendanceRate =
    attendanceDenominator > 0
      ? Math.round((totalCompleted / attendanceDenominator) * 100)
      : null;

  const bySubject: SubjectAttendance[] = Array.from(countsBySubject.entries()).map(
    ([subjectName, counts]) => {
      const denom = counts.completed + counts.noShow;
      return {
        subjectName,
        pct: denom > 0 ? Math.round((counts.completed / denom) * 100) : 0,
      };
    }
  );

  const sessionIds = (sessions ?? []).map((x) => x.id as string);

  const { data: feedback } = includeSatisfaction && sessionIds.length
    ? await selectInChunks(sessionIds, (chunk) => supabase
        .from("session_student_feedback")
        .select("rating")
        .eq("student_id", studentId)
        .in("session_id", chunk)
        .not("rating", "is", null))
    : { data: [] as { rating: number }[] };

  const ratings = (feedback ?? []).map((f) => f.rating).filter((r): r is number => r !== null);
  const satisfactionAvg =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return includeSatisfaction ? { attendanceRate, satisfactionAvg, bySubject } : { attendanceRate, bySubject };
}

/** 통계 탭 전체(요약 + 확장). 호출부가 권한 검사(assertCanViewStudent/학생 본인/보호자)를 이미 통과시킨 뒤
 * 서비스 클라이언트로 부른다. 조회 = legacy 요약 3~4개 + 집계 RPC 1개(병렬). 등급별로 필드를 서버에서 뺀다. */
export async function loadStudentStats(
  admin: SupabaseClient,
  studentId: string,
  tier: StatsTier
): Promise<StatsData> {
  const [base, agg] = await Promise.all([
    loadStats(admin, studentId, { includeSatisfaction: tier !== "family" }),
    admin.rpc("student_stats_aggregate", { p_student_id: studentId, p_include_staff: tier === "admin" }),
  ]);
  if (agg.error) throw new Error("통계를 집계하지 못했습니다.");
  return { ...base, extended: buildExtendedStats(agg.data as RawStatsAggregate, tier) };
}
