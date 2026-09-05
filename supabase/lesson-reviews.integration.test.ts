import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M4(2026-09-05 통합) — 체험/정규 공용 lesson_reviews/lesson_review_category_notes/
// review_categories의 SECURITY DEFINER 함수를 로컬 Postgres에 직접 psql로
// 검증한다(mocked Supabase 클라이언트로는 RLS/제약을 검증할 수 없음 —
// lib/booking/trial-entitlement-and-cancellation.integration.test.ts,
// app/admin/trial-sessions-guardian-consent.integration.test.ts와 동일 패턴).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현(담당 아님 검증용)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

// set_config(...)도 select라서 그 결과(설정한 id 값)가 출력 맨 앞줄에 섞여
// 나온다 — 실제 쿼리 결과만 남기려면 그 첫 줄(항상 id와 동일)을 제거한다.
function asUser(id: string, sql: string): string {
  const output = psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${id}', false);
    ${sql}
    reset role;
  `);
  const lines = output.split("\n");
  if (lines[0] === id) lines.shift();
  return lines.join("\n");
}

function asUserExpectError(id: string, sql: string): string {
  try {
    execFileSync(
      "psql",
      [
        DB_URL,
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-t",
        "-A",
        "-c",
        `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false); ${sql} reset role;`,
      ],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    throw new Error("expected psql to fail but it succeeded");
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

let childId: string;
let guardianId: string;
let subjectEnrollmentId: string;
let sessionId: string;

beforeAll(() => {
  const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);

  const now = Date.now();
  const authEmail = `m4-lesson-review-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M4 리뷰 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const guardianAuthEmail = `m4-lesson-review-guardian-${now}@example.com`;
  guardianId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${guardianAuthEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${guardianId}', 'parent', 'M4 리뷰 통합테스트 보호자');
    insert into parents (id) values ('${guardianId}');
  `);

  const householdId = psql(
    `insert into households (primary_guardian_id) values ('${guardianId}') returning id;`
  );
  psql(`
    insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);
    insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${guardianId}', 'guardian', true);
  `);
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'integration-review-${now}');`
  );

  // 같은 로컬 DB를 공유하는 다른 통합 테스트(lib/booking/trial-entitlement-and-
  // cancellation.integration.test.ts)가 이 선생님으로 now()+2~+16일대를 예약한다
  // — 병렬 실행 시 겹치면 teacher_buffer_violation이 나므로(2026-09-05 실측
  // 발견) 겹치지 않게 충분히 떨어뜨리되, is_within_booking_window() 상한(8주)
  // 안에 들어오게 +40일로 예약한다.
  const startsAt = new Date(now + 40 * 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
  sessionId = psql(
    `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-review-booking-${now}');`
  );
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("review_categories — 하드코딩 없는 참조 테이블", () => {
  it("5개 기본 카테고리가 활성 상태로 순서대로 시드돼 있다", () => {
    const rows = psql(
      `select key from review_categories where active order by display_order;`
    ).split("\n");
    expect(rows).toEqual(["attitude", "comprehension", "participation", "homework", "overall"]);
  });
});

describe("lesson_reviews — 체험 리뷰 작성/확정(카테고리별 의견 + AI 요약 자리)", () => {
  it("담당 선생님이 아니면 초안 저장이 거부된다", () => {
    const stderr = asUserExpectError(
      OTHER_TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', null, '초안', '[]'::jsonb);`
    );
    expect(stderr).toMatch(/담당 선생님만/);
  });

  it("담당 선생님이 AI 요약 + 카테고리별 의견을 담아 초안을 저장할 수 있다", () => {
    const reviewId = asUser(
      TEACHER_ID,
      `select save_lesson_review_draft(
        '${sessionId}', 'AI 미팅록 자동 요약 텍스트', '학생 초안 종합의견',
        '[{"category_key":"attitude","note":"성실함"},{"category_key":"comprehension","note":"빠른 이해"}]'::jsonb
      );`
    );
    expect(reviewId).toMatch(/^[0-9a-f-]{36}$/);

    const lessonType = psql(`select lesson_type from lesson_reviews where id = '${reviewId}';`);
    expect(lessonType).toBe("trial");
    const status = psql(`select status from lesson_reviews where id = '${reviewId}';`);
    expect(status).toBe("draft");
    const aiSummary = psql(`select ai_summary from lesson_reviews where id = '${reviewId}';`);
    expect(aiSummary).toBe("AI 미팅록 자동 요약 텍스트");

    const noteCount = psql(
      `select count(*) from lesson_review_category_notes where review_id = '${reviewId}';`
    );
    expect(noteCount).toBe("2");
  });

  it("확정 전에는 가족이 아무것도 조회할 수 없다(빈 결과 — 권한없음과 구분 안 함)", () => {
    const rows = asUser(
      guardianId,
      `select review_id from get_lesson_reviews_for_family('${subjectEnrollmentId}');`
    );
    expect(rows).toBe("");
  });

  it("빈 텍스트로는 확정할 수 없고, 확정 후에는 가족이 카테고리별 의견과 함께 조회할 수 있다", () => {
    const emptyErr = asUserExpectError(
      TEACHER_ID,
      `select finalize_lesson_review('${sessionId}', '   ');`
    );
    expect(emptyErr).toMatch(/빈 리뷰는 확정할 수 없습니다/);

    asUser(TEACHER_ID, `select finalize_lesson_review('${sessionId}', '학생 종합 의견 확정');`);

    const familyRows = asUser(
      guardianId,
      `select category_key, category_note from get_lesson_reviews_for_family('${subjectEnrollmentId}') order by category_key;`
    );
    expect(familyRows).toContain("attitude|성실함");
    expect(familyRows).toContain("comprehension|빠른 이해");
  });

  it("확정된 리뷰는 다시 초안으로 저장할 수 없다(관리자 정정 함수만 가능)", () => {
    const stderr = asUserExpectError(
      TEACHER_ID,
      `select save_lesson_review_draft('${sessionId}', null, '다시 초안', '[]'::jsonb);`
    );
    expect(stderr).toMatch(/이미 확정된 리뷰는 초안으로 되돌릴 수 없습니다/);
  });

  it("관리자는 확정된 리뷰를 finalized_at을 보존한 채 정정할 수 있다", () => {
    const finalizedAtBefore = psql(
      `select finalized_at from lesson_reviews where trial_session_id = '${sessionId}';`
    );

    asUser(
      ADMIN_ID,
      `select admin_edit_lesson_review('${sessionId}', '관리자 정정 종합의견', '[{"category_key":"attitude","note":"관리자 정정 태도"}]'::jsonb);`
    );

    const finalizedAtAfter = psql(
      `select finalized_at from lesson_reviews where trial_session_id = '${sessionId}';`
    );
    expect(finalizedAtAfter).toBe(finalizedAtBefore);

    const adminEditedBy = psql(
      `select admin_edited_by from lesson_reviews where trial_session_id = '${sessionId}';`
    );
    expect(adminEditedBy).toBe(ADMIN_ID);

    const familyRows = asUser(
      guardianId,
      `select final_text, category_note from get_lesson_reviews_for_family('${subjectEnrollmentId}') where category_key = 'attitude';`
    );
    expect(familyRows).toBe("관리자 정정 종합의견|관리자 정정 태도");
  });

  it("본인 가족이 아닌 보호자는 조회할 수 없다", () => {
    const rows = asUser(
      "bbbbbbbb-0000-0000-0000-000000000001",
      `select review_id from get_lesson_reviews_for_family('${subjectEnrollmentId}');`
    );
    expect(rows).toBe("");
  });
});
