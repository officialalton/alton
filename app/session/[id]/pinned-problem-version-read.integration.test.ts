import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSessionProblems } from "./session-problem-data";

// P2 3단계 — 제품 오너 피드백 3: 버전을 저장하는 것으로 끝내지 않고, 수업·복습
// 화면이 실제로 그 버전의 지문·보기·정답·해설을 읽는지 확인한다. 한 수업에
// 여러 문제를 넣고, 수업이 끝난 뒤 새 버전을 공개해도 과거 수업이 유지되는지까지
// 본다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = "http://127.0.0.1:54421";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let baseUnitId: string;
let offset = 1500 + Math.floor(Math.random() * 300) * 2;

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
});

/** 문제 2개를 고정한 채 시작된 수업 하나를 만든다. */
function startedSessionWithTwoProblems(): {
  sessionId: string;
  firstProblemId: string;
  secondProblemId: string;
} {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const overlayId = asUser(
    TEACHER_ID,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 1, '버전 읽기 회차') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '버전읽기 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );

  function problem(passage: string, correct: number, explanation: string): string {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by)
       values ('mc', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
    // 최초 버전은 트리거가 만든다 — 내용만 채워 넣는다.
    psql(
      `update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = ${correct},
       explanation = ${quote(explanation)}, difficulty = 'medium'
       where problem_id = '${id}';`
    );
    return id;
  }

  const firstProblemId = problem("첫 번째 문제의 지문", 1, "첫 번째 해설");
  const secondProblemId = problem("두 번째 문제의 지문", 3, "두 번째 해설");

  const prepId = asUser(
    TEACHER_ID,
    `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values
     ('${prepId}', 'problem', '${firstProblemId}', 1),
     ('${prepId}', 'problem', '${secondProblemId}', 2);`
  );

  offset += 2;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);

  return { sessionId, firstProblemId, secondProblemId };
}

function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

describe("고정된 문제 버전을 화면이 실제로 읽는다", () => {
  it("한 수업의 여러 문제를 번호 순서대로, 고정된 버전의 내용으로 읽는다", async () => {
    const { sessionId } = startedSessionWithTwoProblems();
    const problems = await loadSessionProblems(admin, sessionId, {
      canSeeAnswers: true,
      studentId: STUDENT_ID,
    });

    expect(problems.map((p) => p.number)).toEqual([1, 2]);
    expect(problems.map((p) => p.passage)).toEqual(["첫 번째 문제의 지문", "두 번째 문제의 지문"]);
    expect(problems.map((p) => p.correctIndex)).toEqual([1, 3]);
    expect(problems.map((p) => p.explanation)).toEqual(["첫 번째 해설", "두 번째 해설"]);
    expect(problems[0].options).toEqual(["가", "나", "다", "라"]);
    expect(problems[0].difficulty).toBe("medium");
  });

  it("수업 뒤에 새 버전을 공개해도 그 수업의 화면 내용은 그대로다", async () => {
    const { sessionId, firstProblemId } = startedSessionWithTwoProblems();

    const newVersionId = psql(
      `select create_problem_draft_version('${firstProblemId}', '고쳐 쓴 새 지문', '["A","B"]'::jsonb, 0, '새 해설', 'hard', '${ADMIN_ID}');`
    );
    psql(`select submit_problem_version_for_review('${newVersionId}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${newVersionId}', '${ADMIN_ID}');`);

    const problems = await loadSessionProblems(admin, sessionId, {
      canSeeAnswers: true,
      studentId: STUDENT_ID,
    });
    expect(problems[0].passage).toBe("첫 번째 문제의 지문");
    expect(problems[0].correctIndex).toBe(1);
    expect(problems[0].explanation).toBe("첫 번째 해설");
    expect(problems[0].difficulty).toBe("medium");
  });

  it("보관된 과거 버전도 그 수업 당사자는 읽을 수 있다(공개 버전만 읽히면 과거 수업이 비어버린다)", () => {
    const { sessionId, firstProblemId } = startedSessionWithTwoProblems();
    const pinnedVersionId = psql(
      `select problem_version_id from session_content_manifest
       where session_id = '${sessionId}' and content_id = '${firstProblemId}';`
    );

    const newVersionId = psql(
      `select create_problem_draft_version('${firstProblemId}', '새 지문', null, null, null, null, '${ADMIN_ID}');`
    );
    psql(`select submit_problem_version_for_review('${newVersionId}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${newVersionId}', '${ADMIN_ID}');`);
    expect(psql(`select status from problem_versions where id = '${pinnedVersionId}';`)).toBe("archived");

    // 학생·교사 모두 보관된 그 버전을 여전히 읽는다.
    expect(asUser(STUDENT_ID, `select passage from problem_versions where id = '${pinnedVersionId}';`)).toBe(
      "첫 번째 문제의 지문"
    );
    expect(asUser(TEACHER_ID, `select passage from problem_versions where id = '${pinnedVersionId}';`)).toBe(
      "첫 번째 문제의 지문"
    );
  });

  it("학생은 자기 풀이를 제출하기 전에는 정답·해설을 받지 않는다", async () => {
    const { sessionId, firstProblemId } = startedSessionWithTwoProblems();

    const asStudent = await loadSessionProblems(admin, sessionId, {
      canSeeAnswers: false,
      studentId: STUDENT_ID,
    });
    expect(asStudent[0].passage).toBe("첫 번째 문제의 지문");
    expect(asStudent[0].correctIndex).toBeNull();
    expect(asStudent[0].explanation).toBeNull();
    expect(asStudent[0].solved).toBe(false);

    // 풀이를 제출하면 그때 열린다.
    const workId = psql(
      `select start_problem_work('${sessionId}', '${STUDENT_ID}', '${firstProblemId}', false);`
    );
    psql(`update session_problem_work set submitted_at = now() where id = '${workId}';`);

    const afterSubmit = await loadSessionProblems(admin, sessionId, {
      canSeeAnswers: false,
      studentId: STUDENT_ID,
    });
    expect(afterSubmit[0].solved).toBe(true);
    expect(afterSubmit[0].correctIndex).toBe(1);
    expect(afterSubmit[0].explanation).toBe("첫 번째 해설");
    // 아직 풀지 않은 두 번째 문제는 여전히 가려져 있다.
    expect(afterSubmit[1].correctIndex).toBeNull();
  });
});
