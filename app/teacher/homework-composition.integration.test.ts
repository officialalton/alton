import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

// R9(레슨 준비 Task 4) — session_homework_items/check_homework_item_problem_confirmed
// (supabase/migrations/20261235000000_r9_homework_composition.sql)의 DB 레벨
// 강제(confirmed 게이트, RLS)를 session-content-manifest.integration.test.ts와
// 동일한 psql 직접 검증 패턴으로 확인한다. composeHomeworkFromSession() 자체의
// 얇은 RPC 위임은 app/teacher/homework-composition-toggles.test.ts가 가짜
// supabase 클라이언트로 검증했다 — 이 파일은 "앱 코드를 우회해도 DB가
// 막는가"에 더해, R9 corrective(20261250000000)가 고친 compose_homework_from_session()
// DB 함수 자체(v3 제출 완료 제외, 재구성 시 중복 제외, 동시 호출 원자성/정직한
// issued_count)를 실제 DB로 겨냥한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 (seed, 지훈 담당)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 (seed, 무관한 제3자)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

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
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function asUserExpectError(userId: string, sql: string): string {
  return psqlExpectError(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

const cleanupContractIds: string[] = [];

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from session_homework_items where session_id in (select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}'));
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

let reservationOffsetDays = 3000;
function nextReservationOffsetDays(): number {
  reservationOffsetDays += 2;
  return reservationOffsetDays;
}

function makeEnrollmentWithSession(teacherId = TEACHER_ID): { enrollmentId: string; sessionId: string; contractId: string } {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  cleanupContractIds.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day');`
  );
  const offset = nextReservationOffsetDays();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${teacherId}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${teacherId}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  return { enrollmentId, sessionId, contractId };
}

function makeProblem(status: "confirmed" | "draft"): string {
  return psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', 'Task4 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', '${status}', '${TEACHER_ID}') returning id;`
  );
}

// RLS 테스트 전용: problems의 "문제 조회" 정책(20260828060000)상 created_by가
// 아닌 다른 선생님에게는 confirmed 단독으로는 보이지 않는다(section이 published
// 교재에 속해야 누구에게나 보인다) — session_homework_items 자체의 RLS(담당
// 선생님/관리자만)를 순수하게 겨냥하려면 problems 쪽 가시성부터 확보해야 한다.
function makeVisibleConfirmedProblem(): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('Task4 테스트 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '테스트 섹션', '<p>본문</p>') returning id;`
  );
  return psql(
    `insert into problems (format, passage, subject_id, section_id, status, created_by)
     values ('mc', 'Task4 테스트 문제(공개) ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', '${sectionId}', 'confirmed', '${ADMIN_ID}') returning id;`
  );
}

type ComposeResult = { issuedProblemIds: string[]; requestedCount: number; issuedCount: number };

function parseComposeRow(raw: string): ComposeResult {
  const [idsField, requestedField, issuedField] = raw.split("|");
  const idsStr = (idsField ?? "").trim();
  return {
    issuedProblemIds: idsStr.length > 0 ? idsStr.split(",") : [],
    requestedCount: Number(requestedField),
    issuedCount: Number(issuedField),
  };
}

function compose(
  userId: string,
  sessionId: string,
  keywordIds: string[],
  count: number,
  includeUsedInLesson: boolean,
  includeAlreadyAttempted: boolean
): ComposeResult {
  const kwArray = `array[${keywordIds.map((id) => `'${id}'`).join(",")}]::uuid[]`;
  const raw = asUser(
    userId,
    `select array_to_string(issued_problem_ids, ',') as ids, requested_count, issued_count
     from compose_homework_from_session('${sessionId}', ${kwArray}, ${count}, ${includeUsedInLesson}, ${includeAlreadyAttempted});`
  );
  return parseComposeRow(raw);
}

async function composeAsync(
  userId: string,
  sessionId: string,
  keywordIds: string[],
  count: number,
  includeUsedInLesson: boolean,
  includeAlreadyAttempted: boolean
): Promise<ComposeResult> {
  const kwArray = `array[${keywordIds.map((id) => `'${id}'`).join(",")}]::uuid[]`;
  const sql = `
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    select array_to_string(issued_problem_ids, ',') as ids, requested_count, issued_count
    from compose_homework_from_session('${sessionId}', ${kwArray}, ${count}, ${includeUsedInLesson}, ${includeAlreadyAttempted});
    reset role;
  `;
  const { stdout } = await execFileAsync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql]);
  return parseComposeRow(stdout.trim());
}

function makeKeyword(): string {
  return psql(
    `insert into subject_keywords (subject_id, label, normalized_label)
     values ('${SUBJECT_ID}', '키워드 ${Date.now()}_${Math.random()}', 'kw-${Date.now()}-${Math.random()}') returning id;`
  );
}

function tagProblemWithKeyword(problemId: string, keywordId: string): void {
  psql(
    `insert into problem_keywords (problem_id, keyword_id, created_by) values ('${problemId}', '${keywordId}', '${ADMIN_ID}');`
  );
}

// 담당 선생님 명의로 session_homework_items에 직접 발급한 항목을 만든다(테스트
// 픽스처 — compose 함수 자체를 쓰지 않고 "이미 발급됨" 상태를 준비할 때).
function issueHomeworkItemDirect(sessionId: string, problemId: string, studentId: string, position: number): string {
  return asUser(
    TEACHER_ID,
    `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
     values ('${sessionId}', '${problemId}', '${studentId}', ${position}, '${TEACHER_ID}') returning id;`
  );
}

function submitHomeworkAttempt(homeworkItemId: string, studentId: string, submitted: boolean): void {
  psql(
    `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
     values ('${homeworkItemId}', '${studentId}', '{"type":"text","text":"x"}'::jsonb, ${submitted});`
  );
}

describe("session_homework_items — confirmed 게이트(DB 레벨, 앱 코드 우회해도 막힘)", () => {
  it("confirmed 문제는 정상적으로 insert된다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeProblem("confirmed");

    const id = asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}') returning id;`
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    void contractId;
  });

  it("confirmed가 아닌 문제를 담당 선생님이 직접 SQL로 insert 시도해도 트리거가 거부한다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const draftProblemId = makeProblem("draft");

    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${draftProblemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    expect(stderr).toMatch(/confirmed 상태가 아닌 문제는 과제로 발급할 수 없습니다/);

    const count = psql(`select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(count).toBe("0");
    void contractId;
  });

  it("존재하지 않는 문제 id는 거부한다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', gen_random_uuid(), '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    expect(stderr).toMatch(/존재하지 않는 문제입니다/);
    void contractId;
  });
});

describe("session_homework_items — RLS(세션 담당 선생님/관리자만 쓰기·읽기)", () => {
  it("담당이 아닌 다른 선생님은 insert할 수 없다(RLS)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeVisibleConfirmedProblem();

    const stderr = asUserExpectError(
      OTHER_TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${OTHER_TEACHER_ID}');`
    );
    expect(stderr).toMatch(/row-level security|policy/i);
    void contractId;
  });

  it("담당이 아닌 다른 선생님은 조회할 수도 없다(RLS)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeVisibleConfirmedProblem();
    asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );

    const rows = asUser(OTHER_TEACHER_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("0");
    void contractId;
  });

  it("관리자는 조회·쓰기 모두 가능하다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeProblem("confirmed");

    const id = asUser(
      ADMIN_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${ADMIN_ID}') returning id;`
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const rows = asUser(ADMIN_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("1");
    void contractId;
  });

  it("담당 선생님은 조회·쓰기 모두 가능하다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeProblem("confirmed");

    asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    const rows = asUser(TEACHER_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("1");
    void contractId;
  });
});

describe("compose_homework_from_session — Gap 1: v3 제출 완료(submitted=true)도 '이미 풀어봄'으로 친다", () => {
  it("시나리오 1: 제출된 v3 과제 문제는 새 세션 재구성 시 기본값(끔)에서 제외되고, 토글을 켜면 다시 나타난다", () => {
    const { sessionId: sessionA, contractId } = makeEnrollmentWithSession();
    const keywordId = makeKeyword();
    const problemId = makeProblem("confirmed");
    tagProblemWithKeyword(problemId, keywordId);

    // 세션 A에서 이 문제를 과제로 발급하고, 학생이 "제출"까지 마친 상태를 만든다.
    const itemId = issueHomeworkItemDirect(sessionA, problemId, STUDENT_ID, 1);
    submitHomeworkAttempt(itemId, STUDENT_ID, true);

    // 같은 과목/키워드의 새 세션 B에서 재구성 — 기본값(끔)이면 제외되어야 한다.
    const { sessionId: sessionB } = makeEnrollmentWithSession();
    const excluded = compose(TEACHER_ID, sessionB, [keywordId], 10, false, false);
    expect(excluded.issuedProblemIds).not.toContain(problemId);
    expect(excluded.issuedCount).toBe(0);
    expect(excluded.requestedCount).toBe(10);

    // includeAlreadyAttempted=true로 켜면 다시 후보에 포함되어 발급된다.
    const included = compose(TEACHER_ID, sessionB, [keywordId], 10, false, true);
    expect(included.issuedProblemIds).toContain(problemId);
    expect(included.issuedCount).toBe(1);

    void contractId;
  });

  it("시나리오 2: 초안(submitted=false)뿐인 v3 과제 문제는 기본값(끔)에서도 여전히 후보로 남는다", () => {
    const { sessionId: sessionA, contractId } = makeEnrollmentWithSession();
    const keywordId = makeKeyword();
    const problemId = makeProblem("confirmed");
    tagProblemWithKeyword(problemId, keywordId);

    const itemId = issueHomeworkItemDirect(sessionA, problemId, STUDENT_ID, 1);
    submitHomeworkAttempt(itemId, STUDENT_ID, false); // draft — 제출 아님

    const { sessionId: sessionB } = makeEnrollmentWithSession();
    const result = compose(TEACHER_ID, sessionB, [keywordId], 10, false, false);
    expect(result.issuedProblemIds).toContain(problemId);
    expect(result.issuedCount).toBe(1);
    expect(result.requestedCount).toBe(10);

    void contractId;
  });

  it("legacy session_problem_attempts로 '이미 풀어봄'인 문제도 여전히 정상적으로 제외/포함된다(회귀)", () => {
    const { sessionId: sessionA, contractId } = makeEnrollmentWithSession();
    const keywordId = makeKeyword();
    const problemId = makeProblem("confirmed");
    tagProblemWithKeyword(problemId, keywordId);
    // legacy 경로: session_problem_attempts에 학생의 시도 기록을 직접 남긴다.
    psql(
      `insert into session_problem_attempts (session_id, student_id, problem_id, response, saved)
       values ((select id from legacy_sessions limit 1), '${STUDENT_ID}', '${problemId}', '{}'::jsonb, true);`
    );

    const excluded = compose(TEACHER_ID, sessionA, [keywordId], 10, false, false);
    expect(excluded.issuedProblemIds).not.toContain(problemId);

    const included = compose(TEACHER_ID, sessionA, [keywordId], 10, false, true);
    expect(included.issuedProblemIds).toContain(problemId);

    void contractId;
  });
});

describe("compose_homework_from_session — Gap 2: 같은 세션 재구성 시 중복 제외 + position 연속 + 정직한 issued_count", () => {
  it("시나리오 3: 같은 세션에 두 번 구성해도 이미 발급된 문제가 재선택되지 않고, position이 이어진다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const keywordId = makeKeyword();
    const problemA = makeProblem("confirmed");
    const problemB = makeProblem("confirmed");
    tagProblemWithKeyword(problemA, keywordId);
    tagProblemWithKeyword(problemB, keywordId);

    const first = compose(TEACHER_ID, sessionId, [keywordId], 1, false, false);
    expect(first.issuedCount).toBe(1);
    expect(first.issuedProblemIds.length).toBe(1);
    const firstIssuedId = first.issuedProblemIds[0];
    expect([problemA, problemB]).toContain(firstIssuedId);

    const firstPosition = Number(
      psql(`select position from session_homework_items where session_id = '${sessionId}' and problem_id = '${firstIssuedId}';`)
    );
    expect(firstPosition).toBe(1);

    // 두 번째 구성: count=5를 요청하지만 남은 후보는 하나뿐 — 첫 번째로 발급된
    // 문제는 다시 뽑히지 않고, 나머지 하나만 발급되며 position은 2로 이어진다.
    const second = compose(TEACHER_ID, sessionId, [keywordId], 5, false, false);
    expect(second.issuedCount).toBe(1);
    expect(second.requestedCount).toBe(5);
    expect(second.issuedProblemIds).not.toContain(firstIssuedId);
    const secondIssuedId = second.issuedProblemIds[0];
    expect([problemA, problemB]).toContain(secondIssuedId);
    expect(secondIssuedId).not.toBe(firstIssuedId);

    const secondPosition = Number(
      psql(`select position from session_homework_items where session_id = '${sessionId}' and problem_id = '${secondIssuedId}';`)
    );
    expect(secondPosition).toBe(2);

    // 총 발급 행 수는 정확히 2, 중복 problem_id 없음.
    const totalCount = psql(`select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(totalCount).toBe("2");
    const distinctCount = psql(
      `select count(distinct problem_id) from session_homework_items where session_id = '${sessionId}';`
    );
    expect(distinctCount).toBe("2");

    // 후보가 완전히 소진된 세 번째 호출은 정직하게 issued_count=0을 반환한다
    // (요청한 개수인 것처럼 속이지 않음).
    const third = compose(TEACHER_ID, sessionId, [keywordId], 3, false, false);
    expect(third.issuedCount).toBe(0);
    expect(third.requestedCount).toBe(3);
    expect(third.issuedProblemIds).toEqual([]);

    void contractId;
  });
});

describe("compose_homework_from_session — 시나리오 4: 동시 호출 원자성/직렬화", () => {
  it("같은 세션에 대한 두 동시 호출이 중복 problem_id/position 충돌 없이, 후보 소진분만큼만 정직하게 나눠 발급한다", async () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const keywordId = makeKeyword();
    // 후보를 정확히 3개만 준비 — 두 동시 호출이 각각 count=3을 요청하면 합쳐서
    // 최대 3개만 발급될 수 있어야 한다(3+3=6이 아니라).
    const problemIds = [makeProblem("confirmed"), makeProblem("confirmed"), makeProblem("confirmed")];
    for (const p of problemIds) tagProblemWithKeyword(p, keywordId);

    const [resultA, resultB] = await Promise.all([
      composeAsync(TEACHER_ID, sessionId, [keywordId], 3, false, false),
      composeAsync(TEACHER_ID, sessionId, [keywordId], 3, false, false),
    ]);

    const allIssuedIds = [...resultA.issuedProblemIds, ...resultB.issuedProblemIds];
    // 합쳐서 정확히 후보 수(3)만큼만 발급됐고, 중복이 없다.
    expect(allIssuedIds.length).toBe(3);
    expect(new Set(allIssuedIds).size).toBe(3);
    expect(resultA.issuedCount + resultB.issuedCount).toBe(3);

    // DB에도 정확히 3행, problem_id 중복 없음, position 충돌(같은 세션 내 같은
    // position 두 번) 없음.
    const totalRows = Number(psql(`select count(*) from session_homework_items where session_id = '${sessionId}';`));
    expect(totalRows).toBe(3);
    const distinctProblems = Number(
      psql(`select count(distinct problem_id) from session_homework_items where session_id = '${sessionId}';`)
    );
    expect(distinctProblems).toBe(3);
    const distinctPositions = Number(
      psql(`select count(distinct position) from session_homework_items where session_id = '${sessionId}';`)
    );
    expect(distinctPositions).toBe(3);
    const positions = psql(
      `select string_agg(position::text, ',' order by position) from session_homework_items where session_id = '${sessionId}';`
    );
    expect(positions).toBe("1,2,3");

    void contractId;
  });
});

