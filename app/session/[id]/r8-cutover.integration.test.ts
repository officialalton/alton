import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadNormalizedSession } from "./session-source-data";
import { createClient } from "@supabase/supabase-js";

// R8 1/N — cutover connection + material_version_id 불변식 통합 테스트.
// 이 저장소의 기존 패턴(app/admin/trial-sessions-guardian-consent.integration.test.ts
// 등)을 따라 psql로 직접 DB 상태를 준비/검증한다(트리거·RLS는 mocked client로는
// 검증 불가). UAT 실행 ID: r8cutover01 — 생성한 행은 전부 이 접두 id로 만들고
// afterAll에서 그 id들만 정리한다(고정 시드 계정/기존 데이터는 건드리지 않음).

const RUN_ID = "r8cutover01";
const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUPABASE_URL = "http://127.0.0.1:54421";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const STUDENT_ID = "cccccccc-0000-0000-0000-000000000002"; // 기존 시드 학생(household 소속)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 기존 시드 선생님
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

// UUID는 hex만 허용되므로 실행 ID(r8cutover01)는 값 자체에 못 넣는다 — 대신 이
// 테스트 파일의 afterAll이 아래 고정 id들만 정확히 지운다(운영 데이터 없음, 로컬
// 전용 시드 위에서만 실행).
const CONTRACT_ID = "a1111111-2222-3333-4444-555555555500";
const ENROLLMENT_ID = "a1111111-2222-3333-4444-555555555501";
const RESERVATION_ID = "a1111111-2222-3333-4444-555555555502";
const SESSION_ID = "a1111111-2222-3333-4444-555555555503";
const VERSION_A = "a1111111-2222-3333-4444-555555555504";
const VERSION_B = "a1111111-2222-3333-4444-555555555505";
const CURRICULUM_DOC_ID = "a1111111-2222-3333-4444-555555555506";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function cleanup() {
  psql(`
    delete from sessions where id = '${SESSION_ID}';
    delete from reservations where id = '${RESERVATION_ID}';
    delete from subject_enrollments where id = '${ENROLLMENT_ID}';
    delete from contract_versions where contract_id = '${CONTRACT_ID}';
    delete from contracts where id = '${CONTRACT_ID}';
    delete from curriculum_doc_versions where id in ('${VERSION_A}', '${VERSION_B}');
    delete from curriculum_docs where id = '${CURRICULUM_DOC_ID}';
  `);
}

describe("R8 cutover: v3 sessions <-> /session/[id]", () => {
  beforeAll(() => {
    cleanup();
    psql(`
      insert into contracts (id, household_id, child_id, status)
      values ('${CONTRACT_ID}', '${HOUSEHOLD_ID}', '${STUDENT_ID}', 'active');
      insert into subject_enrollments (id, child_id, subject_id, contract_id, status)
      values ('${ENROLLMENT_ID}', '${STUDENT_ID}', '${SUBJECT_ID}', '${CONTRACT_ID}', 'active');
      insert into reservations (id, kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
      values ('${RESERVATION_ID}', 'lesson', '${ENROLLMENT_ID}', '${TEACHER_ID}', now() - interval '10 minutes', now() + interval '50 minutes', 'confirmed');
      insert into sessions (id, reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status)
      select '${SESSION_ID}', '${RESERVATION_ID}', '${ENROLLMENT_ID}', '${TEACHER_ID}', id, 60, 'live'
      from lesson_types where code = 'regular';
      insert into curriculum_docs (id, title, subject_id, owner_type, status)
      values ('${CURRICULUM_DOC_ID}', '${RUN_ID} 교재', '${SUBJECT_ID}', 'admin', 'published');
      insert into curriculum_doc_versions (id, curriculum_doc_id, version_number, snapshot)
      values ('${VERSION_A}', '${CURRICULUM_DOC_ID}', 1, '{}'::jsonb);
      insert into curriculum_doc_versions (id, curriculum_doc_id, version_number, snapshot)
      values ('${VERSION_B}', '${CURRICULUM_DOC_ID}', 2, '{}'::jsonb);
    `);
  });

  afterAll(() => {
    cleanup();
  });

  it("v3 sessions row로 들어오는 id를 legacy_sessions에 없어도 정규화해서 읽는다(학생 뷰어)", async () => {
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {},
      },
    });
    // service_role로 RLS 우회 없이 학생 본인 조회 흉내: request.jwt.claim.sub를
    // psql 세션에서 직접 세팅하는 대신, 여기서는 순수 데이터 정규화 로직만
    // (SupabaseClient 대신 postgres 직접 조회 결과와 동등한) service-role client로
    // 검증한다 — RLS 자체는 기존 R1 "sessions_v3 조회" 정책 테스트가 이미 커버.
    const admin = createClient(
      SUPABASE_URL,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    );
    const result = await loadNormalizedSession(admin, SESSION_ID, STUDENT_ID, "student");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("v3");
    expect(result?.viewerRole).toBe("student");
    expect(result?.teacherId).toBe(TEACHER_ID);
    expect(result?.status).toBe("upcoming"); // final_status='live' -> "upcoming" 매핑

    void supabase;
  });

  it("teacher_id로 조회하면 teacher 뷰어로 판정된다", async () => {
    const admin = createClient(
      SUPABASE_URL,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    );
    const result = await loadNormalizedSession(admin, SESSION_ID, TEACHER_ID, "teacher");
    expect(result?.viewerRole).toBe("teacher");
  });

  it("관계 없는 사용자는 null(notFound 처리 대상)", async () => {
    const admin = createClient(
      SUPABASE_URL,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    );
    const result = await loadNormalizedSession(
      admin,
      SESSION_ID,
      "99999999-0000-0000-0000-000000000099",
      "student"
    );
    expect(result).toBeNull();
  });

  it("완료 상태(final_status=company_cancelled)면 completed로 잠긴다", async () => {
    psql(`update sessions set final_status = 'company_cancelled' where id = '${SESSION_ID}';`);
    const admin = createClient(
      SUPABASE_URL,
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    );
    const result = await loadNormalizedSession(admin, SESSION_ID, STUDENT_ID, "student");
    expect(result?.status).toBe("completed");
    psql(
      `select set_config('app.bypass_session_lock', 'true', false); update sessions set final_status = 'live' where id = '${SESSION_ID}';`
    );
  });

  it("material_version_id는 최초 배정 후 재배정이 트리거로 차단된다", () => {
    psql(`update sessions set material_version_id = '${VERSION_A}' where id = '${SESSION_ID}';`);
    expect(() =>
      psql(`update sessions set material_version_id = '${VERSION_B}' where id = '${SESSION_ID}';`)
    ).toThrow(/재배정할 수 없습니다/);
  });

  it("scheduled 상태에서 최초 배정(null -> 값)은 허용된다", () => {
    // 이전 테스트가 이미 VERSION_A를 배정했으므로, 트리거 우회 설정(app.bypass_session_lock)으로
    // 먼저 null로 되돌린 뒤(같은 psql 연결 안에서, 테스트 픽스처 리셋 용도) 최초 배정을 재검증한다.
    psql(
      `select set_config('app.bypass_session_lock', 'true', false); update sessions set material_version_id = null where id = '${SESSION_ID}';`
    );
    expect(() =>
      psql(`update sessions set material_version_id = '${VERSION_A}' where id = '${SESSION_ID}';`)
    ).not.toThrow();
  });

  it("completed 세션은 material_version_id 변경 자체가 차단된다(값이 같아도 무관하게 완료 후 UPDATE 시도 차단 확인은 재배정 케이스로 이미 커버, 여기서는 final_status 완료 후 재배정 재확인)", () => {
    psql(`update sessions set final_status = 'completed' where id = '${SESSION_ID}';`);
    expect(() =>
      psql(`update sessions set material_version_id = '${VERSION_B}' where id = '${SESSION_ID}';`)
    ).toThrow(/재배정할 수 없습니다|변경할 수 없습니다/);
  });
});
