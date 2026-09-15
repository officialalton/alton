import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSessionProblems } from "./session-problem-data";

// 2026-09-14 UAT(학생 포털 문제 화면) — docs/2026-09-14-problem-answer-grading-and-pdf-text-notes.md
//   객관식은 클릭이 곧 답(자동 채점, 채점 전 재선택 가능), 정답·해설은 교사 채점 뒤에만 학생에게,
//   채점은 담당 교사만. PDF 페이지 전체 지우기는 clear_all 로 남는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = "http://127.0.0.1:54421";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
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
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let baseUnitId: string;
let hasOtherTeacher = false;
let offset = 8200 + Math.floor(Math.random() * 300) * 2;

beforeAll(() => {
  baseUnitId = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
  hasOtherTeacher = psql(`select count(*) from profiles where id = '${OTHER_TEACHER_ID}';`) === "1";
});

/** 객관식 1개(정답 1) · 서술형 1개를 고정한 채 시작된 수업. */
function startedSession(): { sessionId: string; mcId: string; essayId: string } {
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
  const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 1, '채점 회차') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '채점 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);

  function problem(format: "mc" | "essay", passage: string, correct: number | null): string {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by)
       values ('${format}', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
    psql(
      `update problem_versions set options = ${format === "mc" ? `'["가","나","다","라"]'::jsonb` : "null"},
       correct_index = ${correct === null ? "null" : correct}, explanation = '해설', difficulty = 'medium'
       where problem_id = '${id}';`
    );
    return id;
  }
  const mcId = problem("mc", "객관식 지문", 1);
  const essayId = problem("essay", "서술형 지문", null);

  const prepId = asUser(
    TEACHER_ID,
    `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values
     ('${prepId}', 'problem', '${mcId}', 1), ('${prepId}', 'problem', '${essayId}', 2);`
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
  return { sessionId, mcId, essayId };
}

function studentWork(sessionId: string, problemId: string): string {
  return psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${problemId}', false);`);
}
function studentClient() {
  // 학생 시점의 loadSessionProblems — RLS 아래에서 읽는다.
  return {
    load: (sessionId: string) =>
      loadSessionProblems(
        // psql 로는 서버 함수 경로를 못 타므로 admin 클라이언트로 읽되 자격은 학생으로 준다.
        admin,
        sessionId,
        { canSeeAnswers: false, studentId: STUDENT_ID }
      ),
  };
}

describe("객관식 — 클릭이 곧 답, 자동 채점", () => {
  it("선택지를 고르면 제출되고 정답과 비교한 자동 채점이 남는다. 채점 전엔 바꿀 수 있다", () => {
    const { sessionId, mcId } = startedSession();
    const workId = studentWork(sessionId, mcId);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 0, null);`);
    expect(psql(`select submitted_choice_index || ',' || auto_correct from session_problem_work where id = '${workId}';`)).toBe("0,false");

    // 채점 전 재선택 — 제출 시점은 그대로, 답과 자동 채점만 바뀐다.
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 1, null);`);
    expect(psql(`select submitted_choice_index || ',' || auto_correct from session_problem_work where id = '${workId}';`)).toBe("1,true");
  });

  it("채점이 끝나면 답을 바꿀 수 없다", () => {
    const { sessionId, mcId } = startedSession();
    const workId = studentWork(sessionId, mcId);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 0, null);`);
    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', null, null);`);
    // 객관식은 비워 보내면 자동 채점대로 확정된다.
    expect(psql(`select grade from session_problem_work where id = '${workId}';`)).toBe("incorrect");
    const err = fails(() => psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 1, null);`));
    expect(err).toContain("채점이 끝난 문제의 답은 바꿀 수 없습니다");
  });
});

describe("정답·해설은 교사 채점 뒤에만 학생에게", () => {
  it("답을 저장했어도 채점 전엔 학생 payload 에 정답·해설·자동 채점이 없고, 채점 뒤엔 있다", async () => {
    const { sessionId, mcId, essayId } = startedSession();
    const workId = studentWork(sessionId, mcId);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 1, null);`);

    let problems = await studentClient().load(sessionId);
    const mc = problems.find((p) => p.problemId === mcId)!;
    expect(mc.format).toBe("mc");
    expect(mc.myChoice).toBe(1);
    expect(mc.solved).toBe(true);
    expect(mc.graded).toBe(false);
    expect(mc.correctIndex).toBeNull();
    expect(mc.explanation).toBeNull();
    expect(mc.autoCorrect).toBeNull();
    expect(mc.latestWorkId).toBe(workId);
    expect(problems.find((p) => p.problemId === essayId)!.format).toBe("essay");

    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', null, '잘했다');`);
    problems = await studentClient().load(sessionId);
    const graded = problems.find((p) => p.problemId === mcId)!;
    expect(graded.graded).toBe(true);
    expect(graded.grade).toBe("correct");
    expect(graded.gradeComment).toBe("잘했다");
    expect(graded.correctIndex).toBe(1);
    expect(graded.explanation).toBe("해설");
    expect(graded.autoCorrect).toBe(true);
  });

  it("교사는 채점 전에도 정답과 자동 채점 결과를 본다", async () => {
    const { sessionId, mcId } = startedSession();
    const workId = studentWork(sessionId, mcId);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 0, null);`);
    const problems = await loadSessionProblems(admin, sessionId, { canSeeAnswers: true, studentId: STUDENT_ID });
    const mc = problems.find((p) => p.problemId === mcId)!;
    expect(mc.correctIndex).toBe(1);
    expect(mc.autoCorrect).toBe(false);
    expect(mc.graded).toBe(false);
  });
});

describe("채점은 담당 교사만", () => {
  it("서술형은 결과를 골라야 하고, 학생·다른 교사는 채점할 수 없다", () => {
    const { sessionId, essayId } = startedSession();
    const workId = studentWork(sessionId, essayId);

    expect(fails(() => asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', null, null);`))).toContain("채점 결과(정답/부분/오답)를 골라 주세요");
    expect(fails(() => asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', 'great', null);`))).toContain("정답/부분/오답 중 하나");
    expect(fails(() => asUser(STUDENT_ID, `select grade_problem_attempt('${workId}', 'correct', null);`))).toContain("담당 선생님만 채점");
    if (hasOtherTeacher) {
      expect(fails(() => asUser(OTHER_TEACHER_ID, `select grade_problem_attempt('${workId}', 'correct', null);`))).toContain("담당 선생님만 채점");
    }

    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', 'partial', '  근거 보강  ');`);
    expect(psql(`select grade || '|' || grade_comment || '|' || graded_by from session_problem_work where id = '${workId}';`)).toBe(
      `partial|근거 보강|${TEACHER_ID}`
    );
    // 다시 채점
    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', 'correct', null);`);
    expect(psql(`select grade || '|' || coalesce(grade_comment, '-') from session_problem_work where id = '${workId}';`)).toBe("correct|-");
  });

  it("문제 유형은 수업 관계자에게만 열린다", () => {
    const { sessionId } = startedSession();
    expect(asUser(STUDENT_ID, `select count(*) from session_problem_formats('${sessionId}');`)).toBe("2");
    expect(asUser(TEACHER_ID, `select string_agg(format, ',' order by format) from session_problem_formats('${sessionId}');`)).toBe("essay,mc");
    if (hasOtherTeacher) {
      expect(asUser(OTHER_TEACHER_ID, `select count(*) from session_problem_formats('${sessionId}');`)).toBe("0");
    }
  });
});

// ------------------------------------------------------------ PDF 페이지 필기 — 전체 지우기·텍스트
describe("PDF 페이지 필기 — 전체 지우기(clear_all)와 텍스트 조각", () => {
  function sessionWithPdf(): { sessionId: string; docId: string; versionId: string } {
    const { sessionId } = startedSession();
    const docId = asUser(
      ADMIN_ID,
      `insert into curriculum_docs (title, subject_id, owner_type, status, kind, source_drive_file_id, source_mime_type)
       values ('PDF ${Date.now()}', '${SUBJECT_ID}', 'admin', 'draft', 'pdf', 'drive_${Math.random()}', 'application/pdf') returning id;`
    );
    const asset = JSON.stringify({
      bucket: "curriculum-assets", path: "x/y.pdf", bytes: 1234, sha256: "a".repeat(64),
      mimeType: "application/pdf", pageCount: 3,
    });
    const versionId = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${docId}', '${asset}'::jsonb);`);
    // 이 수업의 자료로 고정한다.
    psql(
      `insert into session_content_manifest (session_id, content_type, content_id, display_position, curriculum_doc_version_id)
       values ('${sessionId}', 'material_doc', '${docId}', 99, '${versionId}');`
    );
    return { sessionId, docId, versionId };
  }
  const seg = (o: Record<string, unknown>) =>
    JSON.stringify({ x0: 1, y0: 1, x1: 2, y1: 2, color: "#000", tool: "pen", ...o }).replace(/'/g, "''");

  it("tool:'clear' 는 clear_all 로 남고, 그 전 획은 화면 재구성에서 빠진다. 상대 레이어는 그대로", () => {
    const { sessionId, docId, versionId } = sessionWithPdf();
    const call = (who: string, scope: string, segs: string[]) =>
      asUser(
        who,
        `select count(*) from append_page_stroke_events('${sessionId}', '[${segs.join(",")}]'::jsonb, '${scope}', '${docId}', '${versionId}', 2);`
      );
    expect(call(TEACHER_ID, "teacher_shared", [seg({ x0: 10 }), seg({ x0: 11 })])).toBe("2");
    expect(call(STUDENT_ID, "student_shared", [seg({ x0: 20 })])).toBe("1");
    expect(call(TEACHER_ID, "teacher_shared", [seg({ tool: "clear", x0: 0 })])).toBe("1");
    expect(call(TEACHER_ID, "teacher_shared", [seg({ x0: 12, tool: "text", text: "핵심", size: 18 })])).toBe("1");

    const rows = psql(
      `select scope || ':' || event_type || ':' || coalesce(payload->>'tool', '-') from session_annotation_events
       where session_id = '${sessionId}' and page_number = 2 order by seq;`
    ).split("\n");
    expect(rows).toEqual([
      "teacher_shared:stroke:pen",
      "teacher_shared:stroke:pen",
      "student_shared:stroke:pen",
      "teacher_shared:clear_all:clear",
      "teacher_shared:stroke:text",
    ]);
    // 학생 레이어는 지워지지 않았다.
    expect(psql(`select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'student_shared' and event_type = 'clear_all';`)).toBe("0");
  });

  it("글이 없는 텍스트 조각은 거부한다", () => {
    const { sessionId, docId, versionId } = sessionWithPdf();
    const err = fails(() =>
      asUser(
        TEACHER_ID,
        `select count(*) from append_page_stroke_events('${sessionId}', '[${seg({ tool: "text", text: "  " })}]'::jsonb, 'teacher_shared', '${docId}', '${versionId}', 1);`
      )
    );
    expect(err).toContain("텍스트 필기에 글이 없습니다");
  });
});

// ------------------------------------------------------------ 진행 중 수업 다시 고정 (2026-09-14)
describe("repin_live_session_content — 진행 중 수업을 지금 구성으로 다시 고정", () => {
  function publishedPdfDoc(): string {
    const docId = asUser(
      ADMIN_ID,
      `insert into curriculum_docs (title, subject_id, owner_type, status, kind, source_drive_file_id, source_mime_type)
       values ('재고정 PDF ${Math.random()}', '${SUBJECT_ID}', 'admin', 'draft', 'pdf', 'drive_${Math.random()}', 'application/pdf') returning id;`
    );
    const asset = JSON.stringify({ bucket: "curriculum-assets", path: "x/y.pdf", bytes: 1, sha256: "a".repeat(64), mimeType: "application/pdf", pageCount: 1 });
    asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${docId}', '${asset}'::jsonb);`);
    return docId;
  }
  const manifest = (sessionId: string) =>
    psql(`select string_agg(content_type || ':' || content_id, ',' order by display_position) from session_content_manifest where session_id = '${sessionId}';`);

  it("시작 뒤 구성에서 뺀 교재는 사라지고 새로 담은 교재가 들어온다. 사용 기록이 있는 항목은 남는다", () => {
    const { sessionId, mcId, essayId } = startedSession();
    const unit = psql(`select overlay_unit_id from session_curriculum_units where session_id = '${sessionId}' and role = 'primary';`);
    expect(manifest(sessionId)).toBe(`problem:${mcId},problem:${essayId}`);

    // 수업 중: 준비안에서 서술형을 빼고, 교재를 하나 담는다.
    asUser(TEACHER_ID, `delete from curriculum_unit_prep_items where content_type = 'problem' and content_id = '${essayId}';`);
    const docId = publishedPdfDoc();
    asUser(TEACHER_ID, `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, source, created_by) values ('${unit}', '${docId}', 1, 'manual', '${TEACHER_ID}');`);
    // 매니페스트는 아직 시작 시점 그대로다(정책).
    expect(manifest(sessionId)).toBe(`problem:${mcId},problem:${essayId}`);

    // 학생·다른 사람은 못 한다.
    expect(fails(() => psql(`select repin_live_session_content('${sessionId}', '${STUDENT_ID}');`))).toContain("담당 선생님만");

    expect(psql(`select repin_live_session_content('${sessionId}', '${TEACHER_ID}');`)).toBe("2");
    expect(manifest(sessionId)).toBe(`material_doc:${docId},problem:${mcId}`);
    // 교재 고정 버전이 채워졌다(fill 트리거).
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}' and content_type = 'material_doc' and curriculum_doc_version_id is not null;`)).toBe("1");
  });

  it("학생이 이미 사용한 항목은 구성에서 빠져도 지우지 않고 뒤로 보낸다", () => {
    const { sessionId, mcId, essayId } = startedSession();
    psql(`insert into session_content_use_events (session_id, content_type, content_id, recorded_by) values ('${sessionId}', 'problem', '${essayId}', '${STUDENT_ID}');`);
    asUser(TEACHER_ID, `delete from curriculum_unit_prep_items where content_type = 'problem' and content_id = '${essayId}';`);
    expect(psql(`select repin_live_session_content('${sessionId}', '${TEACHER_ID}');`)).toBe("2");
    expect(manifest(sessionId)).toBe(`problem:${mcId},problem:${essayId}`);
  });

  it("진행 중이 아닌 수업·빈 구성은 거절한다", () => {
    const { sessionId } = startedSession();
    psql(`update sessions set final_status = 'completed' where id = '${sessionId}';`);
    expect(fails(() => psql(`select repin_live_session_content('${sessionId}', '${TEACHER_ID}');`))).toContain("진행 중인 수업만");
  });
});

// ------------------------------------------------------------ 과제 v3 통일 (2026-09-14)
describe("issue_homework_items / withdraw_homework_item — 교사가 골라 발급, 학생은 수업 문제와 같은 흐름", () => {
  it("범위 안 확정 문제만 발급되고 버전이 고정되며, 이미 발급된 건 건너뛴다", () => {
    const { sessionId, mcId, essayId } = startedSession();
    expect(asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${mcId}','${essayId}']::uuid[]);`)).toBe("2");
    expect(asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${mcId}']::uuid[]);`)).toBe("0");
    expect(
      psql(`select count(*) from session_homework_items h join problem_versions v on v.id = h.problem_version_id where h.session_id = '${sessionId}';`)
    ).toBe("2");
    // 수업에서 다룬 문제라는 표시가 남는다(고정본에 있으므로).
    expect(psql(`select bool_and(was_used_in_lesson) from session_homework_items where session_id = '${sessionId}';`)).toBe("t");
    // 유형 조회가 과제 문제도 준다(같은 문제라 2개).
    expect(asUser(STUDENT_ID, `select count(*) from session_problem_formats('${sessionId}');`)).toBe("2");
  });

  it("학생·범위 밖 문제는 거절한다", () => {
    const { sessionId, mcId } = startedSession();
    expect(fails(() => asUser(STUDENT_ID, `select issue_homework_items('${sessionId}', array['${mcId}']::uuid[]);`))).toContain("담당 학생의 수업에만");
    const outside = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('mc', '범위 밖', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    expect(fails(() => asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${outside}']::uuid[]);`))).toContain("키워드 범위 밖");
  });

  it("학생이 풀이판을 열면 과제 발급본 버전으로 풀고, 그 뒤엔 회수할 수 없다", () => {
    const { sessionId, mcId } = startedSession();
    asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${mcId}']::uuid[]);`);
    const itemId = psql(`select id from session_homework_items where session_id = '${sessionId}' and problem_id = '${mcId}';`);
    // 과제 풀이판은 과제 발급본 버전을 쓴다(2026-09-14: 수업 풀이판과 따로).
    const workId = psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${mcId}', false, 'homework');`);
    expect(psql(`select problem_version_id from session_problem_work where id = '${workId}';`)).toBe(
      psql(`select problem_version_id from session_homework_items where id = '${itemId}';`)
    );
    expect(fails(() => asUser(TEACHER_ID, `select withdraw_homework_item('${itemId}');`))).toContain("이미 풀기 시작한 과제");
  });

  it("시작 전 항목은 담당 교사가 회수할 수 있고, 학생은 못 한다", () => {
    const { sessionId, essayId } = startedSession();
    asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${essayId}']::uuid[]);`);
    const itemId = psql(`select id from session_homework_items where session_id = '${sessionId}' and problem_id = '${essayId}';`);
    expect(fails(() => asUser(STUDENT_ID, `select withdraw_homework_item('${itemId}');`))).toContain("담당 선생님만");
    asUser(TEACHER_ID, `select withdraw_homework_item('${itemId}');`);
    expect(psql(`select count(*) from session_homework_items where id = '${itemId}';`)).toBe("0");
  });
});

describe("issue_homework_by_keywords — 키워드별 개수로 무작위 발급 (2026-09-14 UAT)", () => {
  function keywordOf(sessionId: string): string {
    return psql(
      `select k.keyword_id from session_curriculum_units u
       join curriculum_overlay_unit_keywords k on k.overlay_unit_id = u.overlay_unit_id
       where u.session_id = '${sessionId}' and u.role = 'primary' limit 1;`
    );
  }
  it("수업에서 다룬 문제는 기본으로 제외하고, 포함하면 요청 수만큼(있는 만큼만) 뽑는다. 중복 발급은 없다", () => {
    const { sessionId } = startedSession();
    const kw = keywordOf(sessionId);
    // 고정본의 두 문제가 이 키워드의 후보 전부 → 기본(제외)에서는 0.
    expect(asUser(TEACHER_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${kw}","count":5}]'::jsonb);`)).toBe("0");
    expect(asUser(TEACHER_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${kw}","count":1}]'::jsonb, false);`)).toBe("1");
    // 남은 1개만 더 — 5개를 청해도 있는 만큼.
    expect(asUser(TEACHER_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${kw}","count":5}]'::jsonb, false);`)).toBe("1");
    expect(psql(`select count(*) from session_homework_items where session_id = '${sessionId}';`)).toBe("2");
    expect(psql(`select count(distinct problem_id) from session_homework_items where session_id = '${sessionId}';`)).toBe("2");
  });

  it("회차 밖 키워드·학생 호출·0개 요청은 각각 거절·0", () => {
    const { sessionId } = startedSession();
    const kw = keywordOf(sessionId);
    const other = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '밖 ${Date.now()}_${Math.random()}') returning id;`);
    expect(fails(() => asUser(TEACHER_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${other}","count":1}]'::jsonb, false);`))).toContain("이 회차의 키워드가 아닙니다");
    expect(fails(() => asUser(STUDENT_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${kw}","count":1}]'::jsonb, false);`))).toContain("담당 학생의 수업에만");
    expect(asUser(TEACHER_ID, `select issue_homework_by_keywords('${sessionId}', '[{"keyword_id":"${kw}","count":0}]'::jsonb, false);`)).toBe("0");
  });
});

describe("표준 렌더링 검증 공개 게이트 (20261365) — 검증 통과 + 미리보기 확인 없이는 공개되지 않는다", () => {
  function draftWithFigure(figure: string, passage = "Lines m and n are parallel. What is x?"): string {
    // status 'confirmed' 로 만들면 1번 버전이 곧바로 공개된다 — 초안 게이트를 보려면 'draft' 로 만든다.
    const pid = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('mc', ${quote(passage)}, '${SUBJECT_ID}', 'draft', '${ADMIN_ID}') returning id;`
    );
    return psql(
      `update problem_versions set options = '["1","2","3","4"]'::jsonb, correct_index = 0, explanation = 'e', passage = ${quote(passage)}, figure = ${figure}::jsonb
       where problem_id = '${pid}' and version_no = 1 returning id;`
    );
  }
  const PT = `'{"type":"parallel_transversal","parallel":["m","n"],"transversals":[{"id":"k"}],"angles":[{"at":["m","k"],"region":"NW","label":"x°"},{"at":["n","k"],"region":"SE","label":"37°"}],"notToScale":true}'`;

  it("검증 기록 없음 → 거절, 검증 실패 → 사유와 함께 거절, 통과 + 확인 → 공개", () => {
    const v = draftWithFigure(PT);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("검증 기록이 없습니다");
    psql(`select set_problem_render_check('${v}', '{"ok":false,"renderer":"std-1","issues":[{"code":"ref_missing","message":"지문의 선 q 가 도형 데이터에 없습니다."}]}'::jsonb);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("지문의 선 q");
    psql(`select set_problem_render_check('${v}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("미리보기에서 그림을 확인");
    psql(`select mark_problem_figure_checked('${v}', true);`);
    psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
    expect(psql(`select status from problem_versions where id = '${v}';`)).toBe("published");
  });

  it("검증 뒤 그림이 바뀌면 해시가 달라 거절한다", () => {
    const v = draftWithFigure(PT);
    psql(`select set_problem_render_check('${v}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    psql(`select mark_problem_figure_checked('${v}', true);`);
    psql(`update problem_versions set figure = jsonb_set(figure, '{notToScale}', 'false') where id = '${v}';`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("검증 뒤 그림이 바뀌었습니다");
  });

  it("좌표형 geometry 는 재생성 필요로 공개 불가, 올린 그림은 alt 없이는 공개 불가", () => {
    const legacy = draftWithFigure(`'{"type":"geometry","shapes":[{"kind":"segment","from":[0,0],"to":[1,1]}]}'`);
    psql(`select set_problem_render_check('${legacy}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    psql(`select mark_problem_figure_checked('${legacy}', true);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${legacy}', '${ADMIN_ID}');`))).toContain("재생성 필요");
    const img = draftWithFigure(`'{"type":"image","bucket":"problem-assets","path":"p/a.png"}'`);
    psql(`select set_problem_render_check('${img}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    psql(`select mark_problem_figure_checked('${img}', true);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${img}', '${ADMIN_ID}');`))).toContain("대체 설명");
  });

  it("그림이 없는 문제는 검증 기록 없이도 공개된다(기존 흐름 유지)", () => {
    const v = draftWithFigure("null", "What is 2 + 2?");
    psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
    expect(psql(`select status from problem_versions where id = '${v}';`)).toBe("published");
  });
});

// ------------------------------------------------------------ 문제 한 장 위 공유 필기 (2026-09-14)
describe("append_problem_page_stroke_events — 문제 위 교사·학생 공유 필기(수업 문제·과제 모두)", () => {
  const seg = (o: Record<string, unknown>) =>
    JSON.stringify({ x0: 1, y0: 1, x1: 2, y1: 2, color: "#000", tool: "pen", ...o }).replace(/'/g, "''");

  it("수업 문제와 과제 문제 위에 쓰고, 이 수업 문제가 아니면 거절한다. clear·text 도 같은 규약", () => {
    const { sessionId, mcId } = startedSession();
    const call = (who: string, scope: string, problemId: string, segs: string[], context = "lesson") =>
      asUser(who, `select count(*) from append_problem_page_stroke_events('${sessionId}', '[${segs.join(",")}]'::jsonb, '${scope}', '${problemId}', '${context}');`);
    expect(call(TEACHER_ID, "teacher_shared", mcId, [seg({ x0: 10 })])).toBe("1");
    expect(call(STUDENT_ID, "student_shared", mcId, [seg({ x0: 20 }), seg({ tool: "text", text: "메모", size: 18 })])).toBe("2");
    expect(call(TEACHER_ID, "teacher_shared", mcId, [seg({ tool: "clear" })])).toBe("1");
    // 학생은 교사 레이어에 못 쓴다(RLS).
    expect(fails(() => call(STUDENT_ID, "teacher_shared", mcId, [seg({})]))).not.toBe("");

    // 과제로 낸 문제(고정본에는 없는)도 이 수업의 문제다.
    const hw = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('essay', '과제 전용', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    const kw = psql(`select keyword_id from curriculum_overlay_unit_keywords k join session_curriculum_units s on s.overlay_unit_id = k.overlay_unit_id where s.session_id = '${sessionId}' limit 1;`);
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${hw}', '${kw}');`);
    asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${hw}']::uuid[]);`);
    expect(call(TEACHER_ID, "teacher_shared", hw, [seg({ x0: 30 })], "homework")).toBe("1");
    // 과제 전용 문제는 수업 문맥으로는 못 쓴다 — 수업 문제 필기와 과제 필기는 따로다.
    expect(fails(() => call(TEACHER_ID, "teacher_shared", hw, [seg({ x0: 31 })], "lesson"))).toContain("이 수업의 문제가 아닙니다");
    // 같은 수업 문제도 과제 문맥이면 과제 발급이 있어야 한다.
    expect(fails(() => call(TEACHER_ID, "teacher_shared", mcId, [seg({ x0: 32 })], "homework"))).toContain("이 수업의 과제가 아닙니다");

    const stranger = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('mc', '남의 문제', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    expect(fails(() => call(TEACHER_ID, "teacher_shared", stranger, [seg({})]))).toContain("이 수업의 문제가 아닙니다");

    const rows = psql(
      `select scope || ':' || event_type from session_annotation_events
       where session_id = '${sessionId}' and problem_id = '${mcId}' and problem_work_id is null order by seq;`
    ).split("\n");
    expect(rows).toEqual(["teacher_shared:stroke", "student_shared:stroke", "student_shared:stroke", "teacher_shared:clear_all"]);
    expect(psql(`select count(distinct problem_context) from session_annotation_events where session_id = '${sessionId}' and problem_id = '${mcId}' and problem_work_id is null;`)).toBe("1");
  });
});

// ------------------------------------------------------------ 과제 답안은 수업 답안과 따로 (2026-09-14)
describe("session_problem_work.source — 같은 문제라도 과제는 처음부터, 채점도 따로", () => {
  it("수업에서 채점한 문제를 과제로 내도 과제 쪽은 채점 전이다", async () => {
    const { sessionId, mcId } = startedSession();
    const lessonWork = studentWork(sessionId, mcId);
    psql(`select submit_problem_attempt('${lessonWork}', '${STUDENT_ID}', 1, null);`);
    asUser(TEACHER_ID, `select grade_problem_attempt('${lessonWork}', null, null);`);

    asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${mcId}']::uuid[]);`);
    const homeworkWork = psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${mcId}', false, 'homework');`);
    expect(homeworkWork).not.toBe(lessonWork);
    expect(psql(`select source || ':' || coalesce(graded_at::text, 'none') from session_problem_work where id = '${homeworkWork}';`)).toBe("homework:none");

    const lesson = await loadSessionProblems(admin, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    const { loadHomeworkProblems } = await import("./session-problem-data");
    const homework = await loadHomeworkProblems(admin, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    expect(lesson.find((p) => p.problemId === mcId)?.graded).toBe(true);
    expect(homework.find((p) => p.problemId === mcId)?.graded).toBe(false);
    expect(homework.find((p) => p.problemId === mcId)?.correctIndex).toBeNull();
    // 과제 쪽 회수는 과제 풀이판이 있으니 거절, 수업 풀이판만 있었다면 가능했을 것.
    const itemId = psql(`select id from session_homework_items where session_id = '${sessionId}' and problem_id = '${mcId}';`);
    expect(fails(() => asUser(TEACHER_ID, `select withdraw_homework_item('${itemId}');`))).toContain("이미 풀기 시작한");
  });
});

// ------------------------------------------------------------ SPR 숫자 입력 (2026-09-14)
describe("spr — 숫자 답 자동 채점·재입력·공개 검사", () => {
  function sprProblem(sessionId: string, answers: string[]): string {
    const kw = psql(`select keyword_id from curriculum_overlay_unit_keywords k join session_curriculum_units s on s.overlay_unit_id = k.overlay_unit_id where s.session_id = '${sessionId}' limit 1;`);
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('spr', 'x + 3 = 10', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${kw}');`);
    psql(`update problem_versions set answers = '${JSON.stringify(answers)}'::jsonb, explanation = 'x = 7' where problem_id = '${id}';`);
    return id;
  }

  it("정규화 비교: 분수·소수·쉼표·반올림을 같은 답으로 본다", () => {
    expect(psql(`select spr_answer_matches('7/2', '["3.5"]');`)).toBe("t");
    expect(psql(`select spr_answer_matches('1,440', '["1440"]');`)).toBe("t");
    expect(psql(`select spr_answer_matches('.6667', '["2/3"]');`)).toBe("t");
    expect(psql(`select spr_answer_matches(' -0.25 ', '["-1/4"]');`)).toBe("t");
    expect(psql(`select spr_answer_matches('3.4', '["3.5"]');`)).toBe("f");
    expect(psql(`select spr_answer_matches('abc', '["1"]');`)).toBe("f");
  });

  it("학생이 숫자 답을 저장하면 자동 채점되고, 채점 전엔 바꿀 수 있고, 채점 뒤엔 정답이 열린다", async () => {
    const { sessionId } = startedSession();
    const problemId = sprProblem(sessionId, ["7", "7.0"]);
    asUser(TEACHER_ID, `select issue_homework_items('${sessionId}', array['${problemId}']::uuid[]);`);
    const workId = psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${problemId}', false, 'homework');`);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', null, '6');`);
    expect(psql(`select submitted_text || ':' || auto_correct from session_problem_work where id = '${workId}';`)).toBe("6:false");
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', null, ' 7 ');`);
    expect(psql(`select auto_correct from session_problem_work where id = '${workId}';`)).toBe("t");

    const { loadHomeworkProblems } = await import("./session-problem-data");
    let hw = await loadHomeworkProblems(admin, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    let p = hw.find((x) => x.problemId === problemId)!;
    expect(p.format).toBe("spr");
    expect(p.myText).toBe(" 7 ");
    expect(p.acceptedAnswers).toBeNull();
    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', null, null);`);
    expect(psql(`select grade from session_problem_work where id = '${workId}';`)).toBe("correct");
    hw = await loadHomeworkProblems(admin, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    p = hw.find((x) => x.problemId === problemId)!;
    expect(p.acceptedAnswers).toEqual(["7", "7.0"]);
    expect(fails(() => psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', null, '8');`))).toContain("채점이 끝난 문제의 답은 바꿀 수 없습니다");
  });

  it("정답 목록이 없는 spr 초안은 공개할 수 없다", () => {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('spr', '빈 정답', '${SUBJECT_ID}', 'draft', '${TEACHER_ID}') returning id;`
    );
    const v = psql(`select id from problem_versions where problem_id = '${id}' order by version_no desc limit 1;`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("정답을 하나 이상");
    psql(`select save_problem_draft_version('${id}', '빈 정답', null, null, '풀이', 'medium', '${ADMIN_ID}', '["7"]'::jsonb);`);
    expect(psql(`select answers::text from problem_versions where id = '${v}';`)).toBe('["7"]');
  });
});

// ------------------------------------------------------------ 그림 확인 게이트 (2026-09-14 ③)
describe("figure — 그림이 있는 초안은 확인해야 공개된다", () => {
  it("figure_checked 없이 공개 거절, 확인 뒤 공개, 그림을 바꾸면 확인이 풀린다", () => {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('mc', '그래프', '${SUBJECT_ID}', 'draft', '${TEACHER_ID}') returning id;`
    );
    const fig = `{"type":"coordinate_plane","xRange":[-2,8],"yRange":[-2,8],"items":[{"kind":"line","slope":1,"intercept":0}]}`;
    const v = psql(`select save_problem_draft_version('${id}', '그래프', '["a","b","c","d"]'::jsonb, 1, '해설', 'medium', '${ADMIN_ID}', null, '${fig}'::jsonb, false);`);
    // 2026-09-14 표준 렌더링 검증(20261365): 검증 기록이 먼저다. 그 다음 미리보기 확인.
    psql(`select set_problem_render_check('${v}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("그림을 확인해야");
    psql(`select mark_problem_figure_checked('${v}', true);`);
    // 그림 데이터를 바꾸면 확인이 풀리고, 검증 해시도 어긋난다.
    const fig2 = `{"type":"coordinate_plane","xRange":[-2,8],"yRange":[-2,8],"items":[{"kind":"line","slope":2,"intercept":1}]}`;
    psql(`select save_problem_draft_version('${id}', '그래프', '["a","b","c","d"]'::jsonb, 1, '해설', 'medium', '${ADMIN_ID}', null, '${fig2}'::jsonb, true);`);
    expect(psql(`select figure_checked from problem_versions where id = '${v}';`)).toBe("f");
    psql(`select mark_problem_figure_checked('${v}', true);`);
    expect(fails(() => psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`))).toContain("검증 뒤 그림이 바뀌었습니다");
    psql(`select set_problem_render_check('${v}', '{"ok":true,"renderer":"std-1","issues":[]}'::jsonb);`);
    psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
    expect(psql(`select status from problem_versions where id = '${v}';`)).toBe("published");
  });
});
