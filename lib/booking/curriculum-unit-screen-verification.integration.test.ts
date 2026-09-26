import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPlannedMaterialData } from "@/app/session/[id]/material-data";
import { loadSessionSelection } from "@/app/teacher/session-prep-data";
import { loadLessonBookingData } from "@/app/student/lesson-booking-data";

// 2026-09-17(제품 오너 지시) — "DB 통합테스트만으로는 완료가 아니다. 학생·학부모·교사
// 화면에서 실제로 준비물과 진도가 보이는지까지 확인돼야 한다." 브라우저 로그인은 할 수
// 없으므로(정책상 비밀번호를 대신 입력할 수 없음), 그 화면들이 실제로 호출하는 서버
// 데이터 로더 함수를 실제 로컬 Postgres에 대고 직접 호출해 같은 결과를 검증한다:
//   - 학생/학부모 예정 수업 미리보기: loadPlannedMaterialData/loadPlannedProblems
//     (app/session/[id]/page.tsx가 그대로 씀)
//   - 교사 수업 준비 화면: loadSessionSelection(app/teacher/session-prep-data.ts)
//   - 학부모 "지난 수업": loadLessonBookingData의 pastSessionsForReport
// (app/student/lessons-data.ts의 loadLessons가 이 결과를 그대로 병합해 화면에 낸다)
//
// process.env가 vitest에서 .env.local을 자동 로드하지 않으므로 여기서 직접 읽는다.

process.loadEnvFile?.(".env.local");

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SAT_MATH_SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const FIXED_BOOKING_HOUR_UTC = 16;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

// unit_preview_for_viewer()는 auth.uid() 기반 신원 검사를 RPC 내부에서 직접 한다
// (RLS 우회와 무관 — service_role 클라이언트로는 auth.uid()가 항상 null이라 통과할 수
// 없다). loadPlannedProblems()는 그 RPC를 그대로 호출하는 얇은 래퍼이므로, 실제 학생
// 세션과 동등한 신원으로 같은 RPC를 직접 호출해 같은 결과가 나오는지 확인한다(다른
// 통합테스트 파일들의 asUser() 패턴 재사용).
function unitPreviewAsUser(userId: string, overlayUnitId: string): { problemId: string } | null {
  const json = psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    select unit_preview_for_viewer('${overlayUnitId}');
    reset role;
  `);
  const parsed = JSON.parse(json) as { problems?: { problemId: string }[] } | null;
  return parsed?.problems?.[0] ?? null;
}

function admin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function makeTeacher(label: string): string {
  const now = Date.now();
  const teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '${label} 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${teacherId}', 'active');`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
  return teacherId;
}

function makeChild(label: string): { childId: string; householdId: string } {
  const now = Date.now();
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-child-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '${label} 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  return { childId, householdId };
}

function makeEnrollment(childId: string, householdId: string, subjectId: string, teacherId: string): string {
  // guardian consent 트리거는 status='active' 계약에만 걸린다 — draft/planned로 우회.
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${subjectId}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day', 'app');`
  );
  return enrollmentId;
}

function grantEntitlement(childId: string, productCode: string, quantity: number, isPaid: boolean): void {
  const productId = psql(`select id from entitlement_products where code = '${productCode}';`);
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${productId}', null, ${quantity}, now() + interval '90 days', ${isPaid}) returning id;`
  );
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', ${quantity}, 'cusv-grant-${Date.now()}-${grantId}');`);
}

function bookSession(childId: string, enrollmentId: string, teacherId: string, lessonTypeId: string, daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${enrollmentId}', '${teacherId}', '${lessonTypeId}', '${startsAt}', '${endsAt}', 'cusv-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

function completeSession(sessionId: string, teacherId: string): void {
  psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
  psql(`update sessions set actual_start_at = now() - interval '70 minutes' where id = '${sessionId}';`);
  psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '통합테스트 정상 완료', null, 'student_reason');`);
}

/** 순서 있는 회차 커리큘럼(실제 교재 문서·섹션·문제 포함)을 새로 만든다. 과목 자체는
 * 새로 만들지 않고 이미 실제 확정 문제가 있는 과목(subjectId)을 그대로 쓴다 —
 * "새 커리큘럼"이 검증하려는 것은 회차·구성·진도 파이프라인이지, subjects 테이블
 * 신규 행 여부가 아니다(신규 subjects 행은 problems/problem_versions 같은 확정
 * 콘텐츠가 없어 실제 문제 없이는 selectable 검증을 통과할 수 없다). */
function makeSubjectWithCurriculum(subjectId: string, label: string, unitCount: number): {
  subjectId: string;
  overlayFor: (enrollmentId: string) => { overlayId: string; unitIds: string[] };
  materialDocId: string;
  problemId: string;
  keywordId: string;
} {
  const now = Date.now();
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label, normalized_label) values ('${subjectId}', 'kw-${now}', 'kw-${now}') returning id;`
  );
  const problemId = psql(
    `select id from problems where subject_id = '${subjectId}' and status = 'confirmed' and archived_at is null
       and exists (select 1 from problem_versions v where v.problem_id = problems.id and v.status = 'published')
     limit 1;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);

  const materialDocId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status) values ('${label} 교재 ${now}', '${subjectId}', 'admin', 'published') returning id;`
  );
  psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body) values ('${materialDocId}', 1, '섹션1', '${label} 본문 ${now}');`
  );

  return {
    subjectId,
    materialDocId,
    problemId,
    keywordId,
    overlayFor: (enrollmentId: string) => {
      const overlayId = psql(`insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
      const unitIds: string[] = [];
      for (let i = 1; i <= unitCount; i++) {
        const unitId = psql(
          `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', ${i}, '${label} ${i}회차') returning id;`
        );
        unitIds.push(unitId);
        // 실제 제품 흐름에서는 회차를 만들 때 "회차 준비" 화면이 항상 빈 준비 행을
        // 함께 만든다(app/lesson-prep/actions.ts의 prepIdFor). 상위 템플릿이 없는
        // 단독 회차(inherit_unit_defaults_from_template이 아무것도 안 함)라도 빈
        // curriculum_unit_preps는 있어야 refresh_staged_selection_from_unit_prep()이
        // 수업 시작 시점에 실패하지 않는다 — 테스트 픽스처도 그 전제를 맞춘다.
        psql(`insert into curriculum_unit_preps (overlay_unit_id) values ('${unitId}') on conflict do nothing;`);
      }
      // 1회차에만 실제 구성을 심는다 — "예약 확정 시 자동 복사"를 검증하는 데 필요한
      // 최소 구성. 2회차 이후는 비어 있어도(진도 전진 검증만 필요) 무방하다.
      const firstUnitId = unitIds[0];
      psql(`insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${firstUnitId}', '${keywordId}');`);
      psql(`insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position) values ('${firstUnitId}', '${materialDocId}', 1);`);
      const prepId = psql(`select id from curriculum_unit_preps where overlay_unit_id = '${firstUnitId}';`);
      psql(`insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);
      return { overlayId, unitIds };
    },
  };
}

describe("일반 커리큘럼 — 예약부터 완료·진도전진까지 실제 화면 로더로 검증", () => {
  let db: SupabaseClient;
  let teacherId: string;
  let childId: string;
  let householdId: string;
  let enrollmentId: string;
  let unitIds: string[];
  let problemId: string;
  let regularLessonTypeId: string;

  beforeAll(() => {
    db = admin();
    regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
    teacherId = makeTeacher("일반");
    const child = makeChild("일반");
    childId = child.childId;
    householdId = child.householdId;

    const curriculum = makeSubjectWithCurriculum(SAT_MATH_SUBJECT_ID, "일반검증", 2);
    problemId = curriculum.problemId;
    enrollmentId = makeEnrollment(childId, householdId, curriculum.subjectId, teacherId);
    const overlay = curriculum.overlayFor(enrollmentId);
    unitIds = overlay.unitIds;

    grantEntitlement(childId, "lesson_pack_10", 10, true);
  });

  it("1. 예약 확정 직후 — 학생/학부모 화면(loadPlannedMaterialData/loadPlannedProblems)과 교사 수업 준비 화면(loadSessionSelection)에 1회차 구성이 그대로 보인다", async () => {
    const { sessionId, reservationId } = bookSession(childId, enrollmentId, teacherId, regularLessonTypeId, 10, 60);

    const material = await loadPlannedMaterialData(db, sessionId);
    expect(material).not.toBeNull();
    expect(material?.sections.some((s) => s.title === "섹션1")).toBe(true);

    // loadPlannedProblems()가 그대로 호출하는 unit_preview_for_viewer()는 auth.uid()로
    // 신원을 직접 확인한다 — 실제 학생 세션과 동등하게 학생 본인 신원으로 호출한다.
    const previewProblem = unitPreviewAsUser(childId, unitIds[0]);
    expect(previewProblem?.problemId).toBe(problemId);

    const teacherSelection = await loadSessionSelection(db, sessionId);
    expect(teacherSelection).not.toBeNull();
    expect(teacherSelection?.units.map((u) => u.overlayUnitId)).toContain(unitIds[0]);
    expect(teacherSelection?.contentItems.map((c) => c.contentId)).toContain(problemId);

    // 이 예약을 scheduled로 남겨두면 다음 테스트가 1회차를 "이미 차지된 회차"로
    // 보고 건너뛴다 — 취소해서 1회차를 다시 미배정 상태로 되돌린다.
    psql(`select cancel_lesson_booking('${reservationId}', 'student', '${childId}', '통합테스트 정리');`);
  });

  it("2. 완료 뒤 — 학부모 '지난 수업'(loadLessonBookingData)에 반영되고, 다음 예약은 2회차 구성을 자동으로 받는다", async () => {
    const first = bookSession(childId, enrollmentId, teacherId, regularLessonTypeId, 11, 60);
    completeSession(first.sessionId, teacherId);

    const unit1Status = psql(`select status from curriculum_overlay_units where id = '${unitIds[0]}';`);
    expect(unit1Status).toBe("completed");

    const bookingData = await loadLessonBookingData(db, childId);
    expect(bookingData.pastSessionsForReport.map((s) => s.sessionId)).toContain(first.sessionId);

    const second = bookSession(childId, enrollmentId, teacherId, regularLessonTypeId, 12, 60);
    const secondLinkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${second.sessionId}' and role = 'primary';`
    );
    expect(secondLinkedUnitId).toBe(unitIds[1]);
  });
});

describe("체험 수업 — 별도 코드 경로 없이 같은 자동 연결·구성 복사를 탄다", () => {
  it("체험 전용 과목·1회차 커리큘럼을 만들고 체험 예약을 하면 일반 수업과 동일하게 회차가 연결·복사된다", async () => {
    const db2 = admin();
    const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
    const teacherId = makeTeacher("체험");
    const { childId, householdId } = makeChild("체험");

    // 실무에서는 관리자가 실제 "체험 관리" 과목을 별도로 만들지만, 이 통합테스트는
    // 코드 경로가 일반/체험 사이에 갈라지지 않는다는 것을 확인하는 것이 목적이라
    // 실제 확정 문제가 있는 기존 과목을 그대로 재사용한다(견고성 노트 참고).
    const curriculum = makeSubjectWithCurriculum(SAT_MATH_SUBJECT_ID, "체험전용", 1);
    const enrollmentId = makeEnrollment(childId, householdId, curriculum.subjectId, teacherId);
    const { unitIds } = curriculum.overlayFor(enrollmentId);

    grantEntitlement(childId, "trial_lesson_grant", 1, false);

    const { sessionId } = bookSession(childId, enrollmentId, teacherId, trialLessonTypeId, 13, 60);

    const linkedUnitId = psql(
      `select overlay_unit_id from session_curriculum_units where session_id = '${sessionId}' and role = 'primary';`
    );
    expect(linkedUnitId).toBe(unitIds[0]);

    const material = await loadPlannedMaterialData(db2, sessionId);
    expect(material).not.toBeNull();

    const previewProblem = unitPreviewAsUser(childId, unitIds[0]);
    expect(previewProblem?.problemId).toBe(curriculum.problemId);
  });
});
