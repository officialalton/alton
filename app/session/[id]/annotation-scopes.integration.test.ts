import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// P3 — 필기 범위 4분할의 권한을 실제 DB(RLS)로 검증한다.
// 확정 정책(2026-09-12):
//   ① 교사 공용 필기: 교사·학생이 함께 본다
//   ② 교재 학생 필기: 학생이 쓰고 학생·담당 교사·연결된 보호자가 본다(2026-09-12 확정)
//   ③ 문제 풀이: 학생 풀이와 교사 피드백이 **별도 레이어**, 교사는 학생 원본을 덮어쓰지 않는다
//   ④ 교사 준비 초안: 교사 전용, 명시적으로 공개해야 공용 필기가 된다
// 화면 규칙이 아니라 데이터 규칙이어야 하므로 RLS로 강제하고 여기서 못박는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const OTHER_STUDENT_ID = "cccccccc-0000-0000-0000-000000000002"; // 다른 학생(seed)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이 수업 담당이 아닌 교사(seed)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
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
      stdio: ["pipe", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
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

let sessionId: string;
let docId: string;
let problemId: string;
let problemId2: string;
let enrollmentId: string;

beforeAll(() => {
  // 같은 선생님으로 반복 실행할 때 이전 실행이 남긴 예약과 겹치지 않도록 먼 미래의
  // 임의 슬롯을 쓴다(reservations_no_overlap 배타 제약).
  // 다른 통합 테스트 파일과 겹치지 않는 날짜 구간(위 unit-prep 주석 참고).
  const slotOffsetDays = 5000 + Math.floor(Math.random() * 300);
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}',
             now() + interval '${slotOffsetDays} days', now() + interval '${slotOffsetDays} days 1 hour', 'confirmed')
     returning id;`
  );
  sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  docId = psql(
    `insert into curriculum_docs (title, subject_id, status, owner_type, owner_teacher_id)
     values ('필기 범위 테스트 교재', '${SUBJECT_ID}', 'published', 'teacher', '${TEACHER_ID}') returning id;`
  );
  const insertProblem = (label: string) =>
    psql(
      `insert into problems (format, passage, options, correct_index, explanation, difficulty, subject_id, status, created_by)
       values ('mc', '지문 ${label}', '["a","b"]'::jsonb, 0, '해설', 'medium', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}')
       returning id;`
    );
  problemId = insertProblem("1");
  problemId2 = insertProblem("2");
});

function insertEvent(actor: string, scope: string, extra: string): string {
  return `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id${extra ? ", " + extra.split("=")[0] : ""})
          values ('${sessionId}', '${actor}', 'stroke', '{"x":1}'::jsonb, '${scope}', '${docId}'${extra ? ", " + extra.split("=")[1] : ""});`;
}

describe("① 교사 공용 필기", () => {
  it("교사가 쓰고 학생도 본다", () => {
    asUser(TEACHER_ID, insertEvent(TEACHER_ID, "teacher_shared", ""));
    const seen = asUser(
      STUDENT_ID,
      `select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared';`
    );
    expect(Number(seen)).toBeGreaterThan(0);
  });

  // 2026-09-12 확정 — 교사 공용 필기는 교사가 작성한다. 학생이 설명 위에
  // 덧쓸 자리는 "나만 보는 교재 필기"와 문제별 풀이판이다.
  // 학생이 쓸 자리가 없어진 것이 아니다 — 학생에게는 교재 위 "학생 필기"
  // 레이어와 문제별 풀이판이 있다.
  it("학생은 선생님 필기 레이어에 쓸 수 없다", () => {
    expect(asUserExpectError(STUDENT_ID, insertEvent(STUDENT_ID, "teacher_shared", ""))).toMatch(
      /row-level security|policy/i
    );
    expect(
      asUser(
        TEACHER_ID,
        `select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared' and author_id = '${STUDENT_ID}';`
      )
    ).toBe("0");
  });

  it("교사는 공용 필기에 쓸 수 있다", () => {
    asUser(TEACHER_ID, insertEvent(TEACHER_ID, "teacher_shared", ""));
    expect(
      asUser(
        TEACHER_ID,
        `select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared' and author_id = '${TEACHER_ID}';`
      )
    ).not.toBe("0");
  });

  it("clear_all은 교사·관리자만 기록한다", () => {
    const stderr = asUserExpectError(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id)
       values ('${sessionId}', '${STUDENT_ID}', 'clear_all', '{}'::jsonb, 'teacher_shared', '${docId}');`
    );
    expect(stderr).toMatch(/row-level security|policy/i);
  });
});

describe("② 교재 학생 필기 레이어 — 수업 관계자가 함께 본다", () => {
  it("학생이 쓰면 학생 본인·담당 교사·연결된 보호자가 본다", () => {
    asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
       values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{"layer":1}'::jsonb, 'student_shared', '${docId}', '${STUDENT_ID}');`
    );
    const count = (who: string) =>
      asUser(
        who,
        `select count(*) from session_annotation_events where scope = 'student_shared' and session_id = '${sessionId}';`
      );
    expect(Number(count(STUDENT_ID))).toBe(1);
    expect(Number(count(TEACHER_ID))).toBe(1);
    const guardianId = psql(`select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`);
    if (guardianId) expect(Number(count(guardianId))).toBe(1);
  });

  it("담당이 아닌 교사·다른 학생에게는 보이지 않는다", () => {
    const count = (who: string) =>
      asUser(
        who,
        `select count(*) from session_annotation_events where scope = 'student_shared' and session_id = '${sessionId}';`
      );
    expect(count(OTHER_TEACHER_ID)).toBe("0");
    expect(count(OTHER_STUDENT_ID)).toBe("0");
  });

  it("교사가 학생 필기를 대신 쓸 수 없다", () => {
    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb, 'student_shared', '${docId}', '${STUDENT_ID}');`
    );
    expect(stderr).toMatch(/row-level security|policy/i);
  });
});

describe("③ 문제 풀이 화이트보드 — 풀이판 단위로 분리된다", () => {
  // 제품 오너 지적: scope만으로는 여러 문제와 재풀이를 구분할 수 없다.
  // 모든 문제 필기는 (수업, 학생, 문제, 회차) = 풀이판 하나를 가리킨다.
  // 케이스마다 자기 문제를 쓴다 — 풀이판은 (수업, 학생, 문제, 회차)라서 같은 문제를
  // 공유하면 앞 케이스가 만든 판이 재사용돼 카운트가 섞인다.
  function freshProblem(label: string): string {
    return psql(
      `insert into problems (format, passage, options, correct_index, explanation, difficulty, subject_id, status, created_by)
       values ('mc', '지문 ${label}', '["a","b"]'::jsonb, 0, '해설', 'medium', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}')
       returning id;`
    );
  }

  function work(problem: string, newAttempt = false): string {
    return psql(
      `select start_problem_work('${sessionId}'::uuid, '${STUDENT_ID}'::uuid, '${problem}'::uuid, ${newAttempt});`
    );
  }

  function drawAs(actor: string, scope: string, workId: string, problem: string, payload: string): string {
    return `insert into session_annotation_events
              (session_id, author_id, event_type, payload, scope, curriculum_doc_id, problem_id, owner_student_id, problem_work_id)
            values ('${sessionId}', '${actor}', 'stroke', '${payload}'::jsonb, '${scope}', '${docId}', '${problem}', '${STUDENT_ID}', '${workId}');`;
  }

  it("같은 수업에서 문제 1과 문제 2의 풀이판이 섞이지 않는다", () => {
    const w1 = work(problemId);
    const w2 = work(problemId2);
    expect(w1).not.toBe(w2);

    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", w1, problemId, '{"p":1}'));
    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", w2, problemId2, '{"p":2}'));

    expect(psql(`select count(*) from session_annotation_events where problem_work_id = '${w1}';`)).toBe("1");
    expect(psql(`select payload->>'p' from session_annotation_events where problem_work_id = '${w2}';`)).toBe("2");
  });

  it("같은 문제를 다시 풀면 이전 풀이와 새 풀이가 구분된다", () => {
    const target = freshProblem("retry");
    const first = work(target);
    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", first, target, '{"try":1}'));

    const second = work(target, true);
    expect(second).not.toBe(first);
    expect(psql(`select attempt_no from session_problem_work where id = '${second}';`)).toBe("2");

    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", second, target, '{"try":2}'));

    // 이전 풀이는 그대로 남는다.
    expect(psql(`select payload->>'try' from session_annotation_events where problem_work_id = '${first}' order by seq limit 1;`)).toBe("1");
    expect(psql(`select payload->>'try' from session_annotation_events where problem_work_id = '${second}';`)).toBe("2");
  });

  it("담당 교사는 학생 원본 풀이를 읽을 수 있지만 쓰지도 고치지도 지우지도 못한다", () => {
    const target = freshProblem("readonly");
    const w = work(target);
    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", w, target, '{"own":1}'));

    // 읽기는 된다.
    expect(
      asUser(TEACHER_ID, `select count(*) from session_annotation_events where problem_work_id = '${w}' and scope = 'problem_student';`)
    ).toBe("1");
    // 쓰기는 막힌다.
    expect(asUserExpectError(TEACHER_ID, drawAs(TEACHER_ID, "problem_student", w, target, '{"hack":1}'))).toMatch(
      /row-level security|policy/i
    );
    // 수정·삭제는 append-only 트리거가 막는다.
    expect(() => psql(`update session_annotation_events set payload = '{}'::jsonb where problem_work_id = '${w}';`)).toThrow(
      /append-only/
    );
    expect(() => psql(`delete from session_annotation_events where problem_work_id = '${w}';`)).toThrow(/append-only/);
  });

  it("교사 피드백은 같은 풀이판의 별도 레이어로 함께 보인다", () => {
    const target = freshProblem("feedback");
    const w = work(target);
    asUser(STUDENT_ID, drawAs(STUDENT_ID, "problem_student", w, target, '{"own":1}'));
    asUser(TEACHER_ID, drawAs(TEACHER_ID, "problem_teacher_feedback", w, target, '{"fb":1}'));

    const layers = asUser(
      STUDENT_ID,
      `select scope || ':' || count(*) from session_annotation_events
       where problem_work_id = '${w}' group by scope order by scope;`
    ).split("\n");
    expect(layers).toContain("problem_student:1");
    expect(layers).toContain("problem_teacher_feedback:1");
  });

  it("다른 학생·다른 교사·보호자는 어떤 풀이판도 볼 수 없다", () => {
    const w = work(freshProblem("isolation"));

    // 다른 교사(이 수업의 담당이 아님)
    expect(asUser(OTHER_TEACHER_ID, `select count(*) from session_problem_work where id = '${w}';`)).toBe("0");
    expect(
      asUser(OTHER_TEACHER_ID, `select count(*) from session_annotation_events where problem_work_id = '${w}';`)
    ).toBe("0");

    // 다른 학생
    expect(asUser(OTHER_STUDENT_ID, `select count(*) from session_problem_work where id = '${w}';`)).toBe("0");
    expect(
      asUser(OTHER_STUDENT_ID, `select count(*) from session_annotation_events where problem_work_id = '${w}';`)
    ).toBe("0");

    // 보호자(2026-09-12 정책 개정) — 연결된 자녀의 풀이는 읽기 전용으로 본다.
    const guardianId = psql(`select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`);
    if (guardianId) {
      expect(asUser(guardianId, `select count(*) from session_problem_work where id = '${w}';`)).toBe("1");
    }
  });

  it("보호자는 연결된 자녀의 공용 필기·문제 풀이·교사 피드백을 읽기 전용으로 본다", () => {
    const guardianId = psql(`select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`);
    if (!guardianId) return;

    asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{"x0":1,"y0":1,"x1":2,"y1":2,"color":"#000","tool":"pen"}'::jsonb, 'teacher_shared');`
    );
    const w = work(freshProblem("guardian-read"));
    asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', (select problem_id from session_problem_work where id = '${w}'), '${w}', '${STUDENT_ID}');`
    );
    asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb, 'problem_teacher_feedback', (select problem_id from session_problem_work where id = '${w}'), '${w}', '${STUDENT_ID}');`
    );

    expect(
      asUser(guardianId, `select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared';`)
    ).not.toBe("0");
    expect(
      asUser(guardianId, `select count(*) from session_annotation_events where problem_work_id = '${w}' and scope = 'problem_student';`)
    ).toBe("1");
    expect(
      asUser(guardianId, `select count(*) from session_annotation_events where problem_work_id = '${w}' and scope = 'problem_teacher_feedback';`)
    ).toBe("1");
  });

  it("보호자는 읽기 전용이다 — 어떤 범위에도 필기를 남길 수 없다", () => {
    const guardianId = psql(`select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`);
    if (!guardianId) return;
    const w = work(freshProblem("guardian-write"));

    // 공용 필기 — 예전에는 is_session_related_v3에 보호자가 포함돼 통과했다.
    expect(
      asUserExpectError(
        guardianId,
        `insert into session_annotation_events (session_id, author_id, event_type, payload, scope)
         values ('${sessionId}', '${guardianId}', 'stroke', '{}'::jsonb, 'teacher_shared');`
      )
    ).toMatch(/row-level security|policy/i);

    // 학생 풀이 레이어
    expect(
      asUserExpectError(
        guardianId,
        `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
         values ('${sessionId}', '${guardianId}', 'stroke', '{}'::jsonb, 'problem_student', (select problem_id from session_problem_work where id = '${w}'), '${w}', '${STUDENT_ID}');`
      )
    ).toMatch(/row-level security|policy/i);

    // 교사 피드백 레이어
    expect(
      asUserExpectError(
        guardianId,
        `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
         values ('${sessionId}', '${guardianId}', 'stroke', '{}'::jsonb, 'problem_teacher_feedback', (select problem_id from session_problem_work where id = '${w}'), '${w}', '${STUDENT_ID}');`
      )
    ).toMatch(/row-level security|policy/i);
  });

  it("연결되지 않은 자녀의 수업은 보호자에게도 보이지 않는다(자녀 간 분리)", () => {
    const guardianId = psql(`select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`);
    if (!guardianId) return;

    // 이 보호자와 연결되지 않은 다른 학생의 수업을 하나 만든다.
    const otherHousehold = psql(
      `select id from households where id <> '${HOUSEHOLD_ID}' limit 1;`
    );
    if (!otherHousehold) return;
    const otherSession = psql(
      `select s.id from sessions s
       join subject_enrollments se on se.id = s.subject_enrollment_id
       where se.child_id <> '${STUDENT_ID}' limit 1;`
    );
    if (!otherSession) return;

    expect(
      asUser(guardianId, `select count(*) from session_problem_work where session_id = '${otherSession}';`)
    ).toBe("0");
    expect(
      asUser(guardianId, `select count(*) from session_annotation_events where session_id = '${otherSession}';`)
    ).toBe("0");
  });

  // 2026-09-12 확정 — 쓰기 주체와 과거 기록 보존 규칙(조회 범위는 ②에서 확인).
  describe("교재 학생 필기 레이어 — 쓰기 주체와 과거 기록", () => {
    it("보호자는 어느 레이어에도 쓸 수 없다", () => {
      const guardianId = psql(
        `select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`
      );
      if (!guardianId) return;
      expect(
        asUserExpectError(
          guardianId,
          `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
           values ('${sessionId}', '${guardianId}', 'stroke', '{}'::jsonb, 'student_shared', '${docId}', '${guardianId}');`
        )
      ).toMatch(/row-level security|policy/i);
    });

    it("다른 학생의 명의로는 쓸 수 없다", () => {
      expect(
        asUserExpectError(
          STUDENT_ID,
          `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
           values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'student_shared', '${docId}', '${OTHER_STUDENT_ID}');`
        )
      ).toMatch(/row-level security|policy/i);
    });

    it("과거 비공개 기록은 보존되고, 자동으로 공개되지 않는다", () => {
      // 정책 변경 전 기록을 직접 심는다(이제 앱은 이 범위로 쓰지 않는다).
      psql(
        `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
         values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{"legacy":true}'::jsonb, 'student_private', '${docId}', '${STUDENT_ID}');`
      );
      const legacyCount = (who: string) =>
        asUser(
          who,
          `select count(*) from session_annotation_events where scope = 'student_private' and payload->>'legacy' = 'true';`
        );
      // 쓴 본인은 계속 본다.
      expect(legacyCount(STUDENT_ID)).toBe("1");
      // 교사·보호자에게는 여전히 보이지 않는다(자동 공개 아님).
      expect(legacyCount(TEACHER_ID)).toBe("0");
      const guardianId = psql(
        `select primary_guardian_id from households where id = '${HOUSEHOLD_ID}';`
      );
      if (guardianId) expect(legacyCount(guardianId)).toBe("0");
      // 삭제되지도 않는다.
      expect(
        psql(`select count(*) from session_annotation_events where payload->>'legacy' = 'true';`)
      ).toBe("1");
    });

    it("보존 범위에는 더 이상 새로 쓸 수 없다", () => {
      expect(
        asUserExpectError(
          STUDENT_ID,
          `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id, owner_student_id)
           values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'student_private', '${docId}', '${STUDENT_ID}');`
        )
      ).toMatch(/row-level security|policy/i);
    });
  });

  it("제출하면 답안과 '그때까지의 필기'가 함께 고정된다", () => {
    const problem = freshProblem("submit-freeze");
    const w = work(problem);
    asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', '${problem}', '${w}', '${STUDENT_ID}');`
    );
    const seqBefore = psql(
      `select max(seq) from session_annotation_events where problem_work_id = '${w}' and scope = 'problem_student';`
    );

    psql(`select submit_problem_attempt('${w}', '${STUDENT_ID}', 2, null);`);

    expect(psql(`select submitted_choice_index from session_problem_work where id = '${w}';`)).toBe("2");
    expect(psql(`select submitted_stroke_seq from session_problem_work where id = '${w}';`)).toBe(seqBefore);

    // 제출한 뒤 덧그린 필기는 경계 밖이라 "그때 낸 풀이"와 구분된다.
    asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', '${problem}', '${w}', '${STUDENT_ID}');`
    );
    expect(psql(`select submitted_stroke_seq from session_problem_work where id = '${w}';`)).toBe(seqBefore);
    expect(
      psql(
        `select count(*) from session_annotation_events
         where problem_work_id = '${w}' and scope = 'problem_student' and seq > ${seqBefore};`
      )
    ).toBe("1");
  });

  it("제출한 답안은 바뀌지 않는다", () => {
    const w = work(freshProblem("submit-immutable"));
    psql(`select submit_problem_attempt('${w}', '${STUDENT_ID}', 1, null);`);
    expect(
      psqlExpectError(`update session_problem_work set submitted_choice_index = 3 where id = '${w}';`)
    ).toMatch(/이미 제출한 풀이입니다/);
    expect(psql(`select submitted_choice_index from session_problem_work where id = '${w}';`)).toBe("1");
  });

  it("본인 풀이만 제출할 수 있고, 두 번 눌러도 한 번만 처리된다", () => {
    const w = work(freshProblem("submit-guard"));
    expect(psqlExpectError(`select submit_problem_attempt('${w}', '${TEACHER_ID}', 0, null);`)).toMatch(
      /본인 풀이만/
    );
    psql(`select submit_problem_attempt('${w}', '${STUDENT_ID}', 0, null);`);
    const at = psql(`select submitted_at from session_problem_work where id = '${w}';`);
    psql(`select submit_problem_attempt('${w}', '${STUDENT_ID}', 3, null);`);
    expect(psql(`select submitted_at from session_problem_work where id = '${w}';`)).toBe(at);
    expect(psql(`select submitted_choice_index from session_problem_work where id = '${w}';`)).toBe("0");
  });

  it("다시 풀면 새 시도가 생기고 이전 답안·풀이·피드백이 그대로 남는다", () => {
    const problem = freshProblem("reattempt-keeps");
    const first = work(problem);
    asUser(
      STUDENT_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', '${problem}', '${first}', '${STUDENT_ID}');`
    );
    asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb, 'problem_teacher_feedback', '${problem}', '${first}', '${STUDENT_ID}');`
    );
    psql(`select submit_problem_attempt('${first}', '${STUDENT_ID}', 1, null);`);

    const second = work(problem, true);
    expect(second).not.toBe(first);
    expect(psql(`select attempt_no from session_problem_work where id = '${second}';`)).toBe("2");

    // 1차 시도의 답안·풀이·피드백은 그대로다.
    expect(psql(`select submitted_choice_index from session_problem_work where id = '${first}';`)).toBe("1");
    expect(
      psql(`select count(*) from session_annotation_events where problem_work_id = '${first}';`)
    ).toBe("2");
    // 새 시도는 비어 있다.
    expect(
      psql(`select count(*) from session_annotation_events where problem_work_id = '${second}';`)
    ).toBe("0");
  });

  it("교사는 학생이 제출한 뒤에도 피드백을 계속 남길 수 있다", () => {
    const problem = freshProblem("feedback-after-submit");
    const w = work(problem);
    psql(`select submit_problem_attempt('${w}', '${STUDENT_ID}', 0, null);`);
    asUser(
      TEACHER_ID,
      `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, problem_id, problem_work_id, owner_student_id)
       values ('${sessionId}', '${TEACHER_ID}', 'stroke', '{}'::jsonb, 'problem_teacher_feedback', '${problem}', '${w}', '${STUDENT_ID}');`
    );
    expect(
      psql(`select count(*) from session_annotation_events where problem_work_id = '${w}' and scope = 'problem_teacher_feedback';`)
    ).toBe("1");
  });

  it("풀이판은 수업 시작 시 고정된 문제 버전과 연결된다", () => {
    const pinned = psql(`select published_version_id from problems where id = '${problemId}';`);
    psql(
      `insert into session_content_manifest (session_id, content_type, content_id, display_position, problem_version_id)
       values ('${sessionId}', 'problem', '${problemId}', 901, '${pinned}')
       on conflict do nothing;`
    );

    const w = psql(`select start_problem_work('${sessionId}'::uuid, '${STUDENT_ID}'::uuid, '${problemId}'::uuid, true);`);
    expect(psql(`select problem_version_id from session_problem_work where id = '${w}';`)).toBe(pinned);

    // 이후 새 버전을 공개해도 이 풀이판이 가리키는 버전은 바뀌지 않는다.
    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, '새 지문', '["a"]'::jsonb, 0, '새 해설', 'hard', '${ADMIN_ID}'::uuid);`
    );
    psql(`select submit_problem_version_for_review('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`select publish_problem_version('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select problem_version_id from session_problem_work where id = '${w}';`)).toBe(pinned);
    expect(psql(`select published_version_id from problems where id = '${problemId}';`)).toBe(draftId);
  });

  it("다른 학생의 풀이판에 필기를 쓰려 하면 데이터 레벨에서 막힌다", () => {
    const target = freshProblem("wrong-owner");
    const w = work(target);
    expect(() =>
      psql(
        `insert into session_annotation_events
           (session_id, author_id, event_type, payload, scope, curriculum_doc_id, problem_id, owner_student_id, problem_work_id)
         values ('${sessionId}', '${OTHER_STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', '${docId}', '${target}', '${OTHER_STUDENT_ID}', '${w}');`
      )
    ).toThrow(/풀이판의 학생과 필기의 소유 학생이 다릅니다/);
  });

  it("풀이판 없이 문제 필기를 남길 수 없다", () => {
    expect(() =>
      psql(
        `insert into session_annotation_events
           (session_id, author_id, event_type, payload, scope, curriculum_doc_id, problem_id, owner_student_id)
         values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'problem_student', '${docId}', '${problemId}', '${STUDENT_ID}');`
      )
    ).toThrow(/scope_shape_check/);
  });
});

describe("④ 교사 준비 초안 — 명시적으로 공개해야 공용 필기가 된다", () => {
  it("초안은 회차에 귀속되고 세션이 없어도 만들 수 있다", () => {
    // 시드 학생에게 이미 active overlay가 있을 수 있어 이 스펙 전용 수강 건에 만든다
    // (student_curriculum_overlays_one_active: 수강 건당 active 1개).
    const overlayId = psql(
      `insert into student_curriculum_overlays (subject_enrollment_id, status, created_by)
       values ('${enrollmentId}', 'active', '${TEACHER_ID}') returning id;`
    );
    const unitId = psql(
      `insert into curriculum_overlay_units (overlay_id, unit_title, position, source_kind, created_by)
       values ('${overlayId}', '1회차', 1, 'student_added', '${TEACHER_ID}') returning id;`
    );
    const draftId = psql(
      `insert into curriculum_unit_annotation_drafts (overlay_unit_id, curriculum_doc_id, author_id, strokes)
       values ('${unitId}', '${docId}', '${TEACHER_ID}', '[{"d":1},{"d":2}]'::jsonb) returning id;`
    );
    expect(draftId).not.toBe("");

    // 공개 전에는 세션 공용 필기에 아무것도 없다(자동 공개 금지).
    const before = Number(
      psql(`select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared';`)
    );

    const copied = psql(`select publish_teacher_draft_to_session('${draftId}'::uuid, '${sessionId}'::uuid, '${TEACHER_ID}'::uuid);`);
    expect(copied).toBe("2");

    const after = Number(
      psql(`select count(*) from session_annotation_events where session_id = '${sessionId}' and scope = 'teacher_shared';`)
    );
    expect(after - before).toBe(2);
    // 초안 자체는 남는다 — 다음 수업에서 다시 쓸 수 있어야 한다.
    expect(psql(`select count(*) from curriculum_unit_annotation_drafts where id = '${draftId}';`)).toBe("1");
  });

  it("학생은 교사 준비 초안을 볼 수 없다", () => {
    expect(asUser(STUDENT_ID, `select count(*) from curriculum_unit_annotation_drafts;`)).toBe("0");
  });
});

describe("범위 형태 제약", () => {
  it("개인 범위인데 주인이 없으면 거부한다", () => {
    expect(() =>
      psql(
        `insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id)
         values ('${sessionId}', '${STUDENT_ID}', 'stroke', '{}'::jsonb, 'student_private', '${docId}');`
      )
    ).toThrow(/scope_shape_check/);
  });


});
