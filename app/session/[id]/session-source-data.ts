import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionViewViewer } from "@/lib/auth";

// R8 1/N — cutover connection: `/session/[id]`는 원래 `legacy_sessions`(R6 이전
// 레거시 세션뷰 테이블)만 조회했고 R6~R7이 실제 예약에 쓰는 v3 `sessions`/
// `reservations`와는 연결이 없었다. 이 모듈이 두 원본을 판별·정규화해서
// page.tsx가 어느 쪽이든 같은 SessionShell 렌더 경로를 타게 한다.
//
// 판별 순서: legacy_sessions 먼저 조회(기존 레거시 테스트 데이터·화면 그대로 유지),
// 없으면 v3 sessions로 폴백. 두 id 공간은 서로 다른 테이블의 PK라 충돌 가능성은
// 이론상 있으나(둘 다 gen_random_uuid()) 실질적으로 0에 가깝고, 설령 충돌해도
// legacy 우선이 기존 동작을 보존한다.

export type NormalizedSession = {
  source: "legacy" | "v3";
  id: string;
  studentId: string;
  teacherId: string;
  subjectName: string;
  studentName: string;
  sessionNumber: number;
  viewerRole: SessionViewViewer;
  status: string; // computeSessionViewState가 받는 "upcoming"/그 외
  scheduledAt: string | null;
  durationMinutes: number;
  curriculumDocId: string | null;
  subjectId: string;
  whiteboardStrokesRaw: unknown;
  unitTitle: string | null;
};

function resolveViewerRole(
  userId: string,
  profileRole: string | undefined,
  studentId: string,
  teacherId: string
): SessionViewViewer | null {
  if (userId === studentId) return "student";
  if (userId === teacherId) return "teacher";
  // P3 4단계 개정(2026-09-12) — 보호자는 연결된 자녀의 학생 화면을 읽기
  // 전용으로 본다. 여기서 "parent"를 돌려주는 것은 화면 재사용을 위한 것이고,
  // 실제 차단은 두 겹이다: (1) 조회 범위는 RLS가 판단하므로 연결되지 않은
  // 자녀의 수업은 아무것도 반환되지 않고(20261300000000), (2) 쓰기는 범위별
  // INSERT 정책이 보호자를 전부 거부한다 — 버튼을 숨기는 것에 의존하지 않는다.
  if (profileRole === "parent") return "parent";
  if (profileRole === "admin") return "admin";
  return null;
}

export async function loadLegacySession(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  profileRole: string | undefined
): Promise<NormalizedSession | null> {
  const { data: session } = await supabase
    .from("legacy_sessions")
    .select(
      "id, session_number, unit_title, status, scheduled_at, duration_minutes, enrollment_id, curriculum_doc_id, whiteboard_strokes"
    )
    .eq("id", id)
    .maybeSingle();
  if (!session) return null;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("student_id, teacher_id, subject_id, subject:subjects(name)")
    .eq("id", session.enrollment_id)
    .single();
  if (!enrollment) return null;

  const { data: people } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", [enrollment.student_id, enrollment.teacher_id]);
  const studentName =
    people?.find((p) => p.id === enrollment.student_id)?.name ?? "학생";

  const viewerRole = resolveViewerRole(
    userId,
    profileRole,
    enrollment.student_id,
    enrollment.teacher_id
  );
  if (!viewerRole) return null;

  const subjectRow = Array.isArray(enrollment.subject)
    ? enrollment.subject[0]
    : enrollment.subject;

  return {
    source: "legacy",
    id: session.id,
    studentId: enrollment.student_id,
    teacherId: enrollment.teacher_id,
    subjectName: (subjectRow as { name?: string } | null)?.name ?? "",
    studentName,
    sessionNumber: session.session_number,
    viewerRole,
    status: session.status,
    scheduledAt: session.scheduled_at,
    durationMinutes: session.duration_minutes,
    curriculumDocId: session.curriculum_doc_id,
    subjectId: enrollment.subject_id,
    whiteboardStrokesRaw: session.whiteboard_strokes,
    unitTitle: session.unit_title,
  };
}

// v3 final_status → 레거시 스타일 "upcoming"/그 외 매핑. computeSessionViewState는
// "upcoming"이 아니면 전부 "completed"(잠금)로 취급하고, "upcoming"이면 scheduledAt+
// durationMinutes로 직접 live/prep을 계산한다 — v3의 'scheduled'/'live'는 둘 다
// "upcoming"으로 넘겨서 그 시간 기반 판정을 그대로 재사용한다.
const V3_ACTIVE_FINAL_STATUSES = new Set(["scheduled", "live"]);

export async function loadV3Session(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  profileRole: string | undefined
): Promise<NormalizedSession | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, teacher_id, final_status, scheduled_duration_minutes, material_version_id, subject_enrollment_id, reservation:reservations!sessions_reservation_id_fkey(starts_at), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child_id, subject_id, subject:subjects(name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!session) return null;

  const reservation = Array.isArray(session.reservation)
    ? session.reservation[0]
    : session.reservation;
  const subjectEnrollment = Array.isArray(session.subject_enrollment)
    ? session.subject_enrollment[0]
    : session.subject_enrollment;
  if (!subjectEnrollment) return null;
  const subjectRow = Array.isArray(subjectEnrollment.subject)
    ? subjectEnrollment.subject[0]
    : subjectEnrollment.subject;

  const studentId = (subjectEnrollment as { child_id?: string }).child_id ?? "";
  const teacherId = session.teacher_id as string;

  const viewerRole = resolveViewerRole(userId, profileRole, studentId, teacherId);
  if (!viewerRole) return null;

  const { data: student } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  // v3는 회차 번호 개념이 없다(레거시 enrollments.session_number와 달리 매 세션이
  // reservation 1:1). 세션뷰 표시용으로 시작 시각 순번을 별도로 매기지 않고 1로
  // 고정한다 — 실제 "N회차" 표시가 필요해지면 R9에서 subject_enrollment 단위
  // 세션 카운트를 계산하는 뷰/쿼리를 추가할 것(이번 라운드 범위 아님).
  return {
    source: "v3",
    id: session.id as string,
    studentId,
    teacherId,
    subjectName: (subjectRow as { name?: string } | null)?.name ?? "",
    studentName: student?.name ?? "학생",
    sessionNumber: 1,
    viewerRole,
    status: V3_ACTIVE_FINAL_STATUSES.has(session.final_status as string)
      ? "upcoming"
      : "completed",
    scheduledAt: (reservation as { starts_at?: string } | null)?.starts_at ?? null,
    durationMinutes: session.scheduled_duration_minutes as number,
    // material_version_id 배정 메커니즘은 R9 범위(과목 템플릿 기반) — 아직 없으므로
    // 항상 null을 넘겨 "교재 미배정" 빈 상태로 렌더링한다. 값이 채워지면(R9 이후)
    // curriculum_doc_versions에서 curriculum_doc_id를 역참조해 여기서 넘기면 된다.
    curriculumDocId: null,
    subjectId: (subjectEnrollment as { subject_id?: string }).subject_id ?? "",
    // v3 세션에는 화이트보드 필드가 아직 없다(레거시 전용 컬럼) — 항상 빈 값.
    whiteboardStrokesRaw: null,
    unitTitle: null,
  };
}

export async function loadNormalizedSession(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  profileRole: string | undefined
): Promise<NormalizedSession | null> {
  const legacy = await loadLegacySession(supabase, id, userId, profileRole);
  if (legacy) return legacy;
  return loadV3Session(supabase, id, userId, profileRole);
}
