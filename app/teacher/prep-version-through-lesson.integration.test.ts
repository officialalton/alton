import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// P2 9차 — 준비안 유지 → 다시 구성 → 수업 시작 고정.
//
// 2026-09-13 제품 오너:
//   "공개 문제 v1을 준비안에 담은 뒤 v2를 공개해도 기존 준비안이 v1을 유지하고,
//    명시적으로 다시 구성했을 때 변경 내용을 확인해 적용할 수 있어야 합니다.
//    수업 시작 후에는 이후 재공개·재구성과 무관하게 당시 버전과 답안·풀이 기록을
//    유지해주세요."

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
  }
}

const uniq = () => `${Date.now()}_${Math.random()}`;

const cleanupContracts: string[] = [];
const cleanupProblems: string[] = [];
const cleanupKeywords: string[] = [];

let baseUnitId: string;
let reservationOffsetDays = 5000;

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
});

afterEach(() => {
  for (const id of cleanupContracts.splice(0)) {
    // session_replication_role = replica 는 FK 의 cascade 까지 끄므로, 지워야 할
    // 것을 전부 이름으로 적는다. 고정된 준비 선택을 막는 쓰기 가드를 넘기 위한
    // 테스트 전용 경로다 — 제품 코드는 이 길을 쓰지 않는다.
    psql(`
      set session_replication_role = replica;
      delete from session_content_manifest where session_id in (
        select s.id from sessions s join subject_enrollments e on e.id = s.subject_enrollment_id
        where e.contract_id = '${id}');
      delete from session_problem_attempts where session_id in (
        select s.id from sessions s join subject_enrollments e on e.id = s.subject_enrollment_id
        where e.contract_id = '${id}');
      delete from session_curriculum_units where session_id in (
        select s.id from sessions s join subject_enrollments e on e.id = s.subject_enrollment_id
        where e.contract_id = '${id}');
      delete from session_prepared_selection_content_items where prepared_selection_id in (
        select ps.id from session_prepared_selections ps
        join subject_enrollments e on e.id = ps.subject_enrollment_id where e.contract_id = '${id}');
      delete from session_prepared_selection_unit_keywords where prepared_selection_unit_id in (
        select u.id from session_prepared_selection_units u
        join session_prepared_selections ps on ps.id = u.prepared_selection_id
        join subject_enrollments e on e.id = ps.subject_enrollment_id where e.contract_id = '${id}');
      delete from session_prepared_selection_units where prepared_selection_id in (
        select ps.id from session_prepared_selections ps
        join subject_enrollments e on e.id = ps.subject_enrollment_id where e.contract_id = '${id}');
      delete from session_prepared_selections where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from curriculum_unit_prep_items where prep_id in (
        select p.id from curriculum_unit_preps p
        join curriculum_overlay_units u on u.id = p.overlay_unit_id
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_unit_preps where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_unit_keywords where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_unit_materials where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_units where overlay_id in (
        select o.id from student_curriculum_overlays o
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from student_curriculum_overlays where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
      set session_replication_role = origin;
    `);
  }
  for (const id of cleanupProblems.splice(0)) {
    psql(`set session_replication_role = replica;
          update problems set published_version_id = null where id = '${id}';
          delete from problem_versions where problem_id = '${id}';
          delete from problem_keywords where problem_id = '${id}';
          delete from problems where id = '${id}';
          set session_replication_role = origin;`);
  }
  for (const id of cleanupKeywords.splice(0)) {
    psql(`delete from subject_keywords where id = '${id}';`);
  }
});

/** 키워드가 붙고 v1 이 공개된 문제 하나. */
function publishedProblem(keywordId: string): { problemId: string; v1: string } {
  const problemId = psql(
    `select create_bank_problem('${SUBJECT_ID}', 'mc', '', '', 'medium', '${ADMIN_ID}');`
  );
  cleanupProblems.push(problemId);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  const v1 = psql(
    `select save_problem_draft_version('${problemId}', '1판 지문 ${uniq()}', '["가","나","다","라"]'::jsonb, 0, '1판 해설', 'medium', '${ADMIN_ID}');`
  );
  psql(`select confirm_and_publish_problem_version('${v1}', '${ADMIN_ID}');`);
  return { problemId, v1 };
}

function republish(problemId: string, passage: string): string {
  const v = psql(
    `select save_problem_draft_version('${problemId}', '${passage}', '["가","나","다","라"]'::jsonb, 1, '고친 해설', 'medium', '${ADMIN_ID}');`
  );
  psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
  return v;
}

function newKeyword(): string {
  const id = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '9차키워드 ${uniq()}') returning id;`
  );
  cleanupKeywords.push(id);
  return id;
}

/** 학생 회차 + 준비안 + 예약된 수업 하나. */
function makeUnitWithPrep(keywordId: string, problemId: string) {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  cleanupContracts.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  reservationOffsetDays += 2;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${reservationOffsetDays} days', now() + interval '${reservationOffsetDays} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  const overlayId = psql(
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const overlayUnitId = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title)
     values ('${overlayId}', 1, '9차 테스트 회차') returning id;`
  );
  psql(
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );
  const prepId = psql(
    `insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
     values ('${overlayUnitId}', '9차 목표', '${TEACHER_ID}')
     on conflict (overlay_unit_id) do update set goal = excluded.goal returning id;`
  );
  psql(
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
     values ('${prepId}', 'problem', '${problemId}', 1);`
  );
  return { contractId, enrollmentId, sessionId, overlayUnitId, prepId };
}

function startLesson(sessionId: string): void {
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
}

describe("준비안은 담을 때의 버전을 유지한다", () => {
  it("v1 을 담은 뒤 v2 를 공개해도 준비안은 v1 을 가리킨다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    const { prepId } = makeUnitWithPrep(keywordId, problemId);

    expect(
      psql(`select problem_version_id from curriculum_unit_prep_items where prep_id = '${prepId}';`)
    ).toBe(v1);

    const v2 = republish(problemId, `2판 지문 ${uniq()}`);
    expect(v2).not.toBe(v1);

    expect(
      psql(`select problem_version_id from curriculum_unit_prep_items where prep_id = '${prepId}';`)
    ).toBe(v1);
  });

  it("낡은 버전을 가리킨다는 사실이 드러난다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnitWithPrep(keywordId, problemId);
    const v2 = republish(problemId, `2판 ${uniq()}`);

    const row = psql(
      `select pinned_version_id || '|' || current_version_id
       from unit_composition_drift
       where layer = 'student' and unit_id = '${overlayUnitId}' and kind = 'problem';`
    );
    expect(row).toBe(`${v1}|${v2}`);
  });
});

describe("자동 재계산은 하지 않고 표시만 한다", () => {
  it("키워드를 더해도 구성은 그대로이고 '변경 있음'만 켜진다", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnitWithPrep(keywordId, problemId);

    // 구성이 한 번 만들어졌다고 표시한다(최초 구성은 자동, 이후는 아니다).
    psql(`update curriculum_overlay_units set composed_at = now(), composition_dirty = false
          where id = '${overlayUnitId}';`);
    const before = psql(
      `select count(*) from curriculum_overlay_unit_materials where overlay_unit_id = '${overlayUnitId}';`
    );

    const other = newKeyword();
    psql(
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${other}');`
    );

    expect(
      psql(`select composition_dirty from curriculum_overlay_units where id = '${overlayUnitId}';`)
    ).toBe("t");
    expect(
      psql(`select count(*) from curriculum_overlay_unit_materials where overlay_unit_id = '${overlayUnitId}';`)
    ).toBe(before);
  });

  it("미리보기는 아무것도 바꾸지 않는다 — 취소하면 기존 구성이 남는다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    const { overlayUnitId, prepId } = makeUnitWithPrep(keywordId, problemId);
    republish(problemId, `2판 ${uniq()}`);

    const preview = psql(
      `select preview_unit_recomposition('student', '${overlayUnitId}')::text;`
    );
    expect(preview).toContain('"versionsUpdated": 1');

    // 미리보기 뒤에도 준비안은 그대로 v1 이다.
    expect(
      psql(`select problem_version_id from curriculum_unit_prep_items where prep_id = '${prepId}';`)
    ).toBe(v1);
  });

  it("다시 구성을 부르면 그때 적용된다", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId, prepId } = makeUnitWithPrep(keywordId, problemId);
    const v2 = republish(problemId, `2판 ${uniq()}`);

    psql(`update curriculum_overlay_units set composition_dirty = true where id = '${overlayUnitId}';`);
    const applied = psql(`select recompose_unit('student', '${overlayUnitId}')::text;`);
    expect(applied).toContain('"versionsUpdated": 1');

    expect(
      psql(`select problem_version_id from curriculum_unit_prep_items where prep_id = '${prepId}';`)
    ).toBe(v2);
    expect(
      psql(`select composition_dirty from curriculum_overlay_units where id = '${overlayUnitId}';`)
    ).toBe("f");
  });
});

describe("수업 시작은 준비안의 버전을 그대로 고정한다", () => {
  it("시작 전에 새 버전이 공개돼도 준비안이 정한 버전이 고정된다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);

    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    // 연결한 뒤, 시작 전에 새 버전이 공개된다.
    const v2 = republish(problemId, `2판 ${uniq()}`);
    startLesson(sessionId);

    const pinned = psql(
      `select problem_version_id from session_content_manifest
       where session_id = '${sessionId}' and content_type = 'problem';`
    );
    expect(pinned).toBe(v1);
    expect(pinned).not.toBe(v2);
  });

  it("시작한 뒤의 재공개·다시 구성은 고정된 버전을 바꾸지 않는다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    startLesson(sessionId);

    republish(problemId, `3판 ${uniq()}`);
    psql(`select recompose_unit('student', '${overlayUnitId}');`);

    expect(
      psql(`select problem_version_id from session_content_manifest
            where session_id = '${sessionId}' and content_type = 'problem';`)
    ).toBe(v1);
  });

  it("답안 기록은 이후 재공개와 무관하게 남는다", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    startLesson(sessionId);

    psql(
      `insert into session_problem_attempts (session_id, student_id, problem_id, correct, response)
       values ('${sessionId}', '${STUDENT_ID}', '${problemId}', true, '"0"'::jsonb);`
    );
    republish(problemId, `4판 ${uniq()}`);

    expect(
      psql(`select correct from session_problem_attempts
            where session_id = '${sessionId}' and problem_id = '${problemId}';`)
    ).toBe("t");
  });
});

describe("쓸 수 없는 항목은 사유를 붙여 시작을 막는다", () => {
  it("보관된 문제가 담겨 있으면 사유와 함께 막힌다", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);

    psql(`update problems set archived_at = now() where id = '${problemId}';`);
    const err = psqlExpectError(
      `select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`
    );
    expect(err).toContain("보관된 문제입니다");
  });

  it("막힐 때 매니페스트를 한 줄도 쓰지 않는다 — 부분 고정 없음", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    psql(`update problems set archived_at = now() where id = '${problemId}';`);

    psqlExpectError(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);

    expect(
      psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)
    ).toBe("0");
    // 시작도 되지 않았다 — 같은 트랜잭션이라 함께 되돌아간다.
    expect(psql(`select final_status from sessions where id = '${sessionId}';`)).toBe("scheduled");
  });

  it("준비안이 가리키는 버전은 지울 수 없다 — 참조가 끊기지 않는다", () => {
    const keywordId = newKeyword();
    const { problemId, v1 } = publishedProblem(keywordId);
    makeUnitWithPrep(keywordId, problemId);
    republish(problemId, `2판 ${uniq()}`);

    // 지난 공개본이 됐어도 준비안이 그것을 가리키고 있으면 지워지지 않는다.
    // '가리키는 버전을 찾을 수 없습니다' 는 그래서 정상 경로에서는 나오지 않는다 —
    // 외래키가 먼저 막는다.
    const err = psqlExpectError(`delete from problem_versions where id = '${v1}';`);
    expect(err).toContain("curriculum_unit_prep_items_problem_version_id_fkey");
  });

  it("두 번째 시작 시도는 이미 시작됐다고 알린다", () => {
    const keywordId = newKeyword();
    const { problemId } = publishedProblem(keywordId);
    const { overlayUnitId, sessionId } = makeUnitWithPrep(keywordId, problemId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    startLesson(sessionId);

    const err = psqlExpectError(
      `select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`
    );
    expect(err).toContain("이미 시작됐거나 종료된 세션입니다");
    // 매니페스트가 두 벌 쌓이지 않는다.
    expect(
      psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)
    ).toBe("1");
  });
});
