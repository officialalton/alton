import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// R9(Task 3) — 학생별 운영 커리큘럼 오버레이(supabase/migrations/
// 20261229000000_r9_student_curriculum_overlay.sql)를 로컬 Postgres에 직접
// psql로 검증한다(session-annotation-events.integration.test.ts 등과 동일한
// 패턴 — RLS/트리거/RPC 원자성은 mocked 클라이언트로는 검증할 수 없다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 관리자 (seed)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 선생님 (seed, 지훈 담당)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 선생님 (seed, 무관한 제3자)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001"; // 지훈 household (seed)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)

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

let baseUnitId: string;

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
});

// 오버레이는 subject_enrollment당 active 1개로 제한되므로(unique 부분 인덱스),
// 테스트마다 독립된 enrollment(=계약 1건)를 새로 만들어 서로 간섭하지 않게 한다.
function makeEnrollment(): string {
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
  return enrollmentId;
}

function createOverlay(): string {
  const enrollmentId = makeEnrollment();
  return asUser(
    TEACHER_ID,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
}

describe("student_curriculum_overlays — subject_enrollment당 활성 오버레이 1개", () => {
  it("같은 subject_enrollment에 두 번째 active 오버레이를 만들 수 없다", () => {
    const enrollmentId = makeEnrollment();
    asUser(
      TEACHER_ID,
      `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}');`
    );
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}');`
    );
    expect(err).toMatch(/duplicate key|unique/i);
  });
});

describe("담당 선생님만 학생 오버레이를 조정할 수 있다", () => {
  it("담당 선생님은 단원 인스턴스를 추가할 수 있다", () => {
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '함수의 기초와 그래프 해석') returning id;`
    );
    expect(unitId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("담당이 아닌 제3자 선생님은 같은 학생의 오버레이를 조정할 수 없다(RLS 거부)", () => {
    const overlayId = createOverlay();
    const err = asUserExpectError(
      OTHER_TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '무단 시도') returning id;`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });

  it("학생 본인은 오버레이를 조회할 수 있지만 쓸 수는 없다", () => {
    const overlayId = createOverlay();
    const readBack = asUser(
      STUDENT_ID,
      `select id from student_curriculum_overlays where id = '${overlayId}';`
    );
    expect(readBack).toBe(overlayId);

    const err = asUserExpectError(
      STUDENT_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '학생 시도') returning id;`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });
});

describe("기본 원본(subject_template_units)은 오버레이 조작으로 바뀌지 않는다", () => {
  it("단원 추가/제외/재정렬을 해도 subject_template_units 원본 행은 그대로다", () => {
    const before = psql(
      `select position, unit_title from subject_template_units where id = '${baseUnitId}';`
    );
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '오버레이 전용 제목') returning id;`
    );
    asUser(TEACHER_ID, `update curriculum_overlay_units set position = 2 where id = '${unitId}';`);
    asUser(TEACHER_ID, `delete from curriculum_overlay_units where id = '${unitId}';`);

    const after = psql(
      `select position, unit_title from subject_template_units where id = '${baseUnitId}';`
    );
    expect(after).toBe(before);
  });
});

describe("재정렬(reorder_curriculum_overlay_units) — 단일 RPC로 원자 처리", () => {
  it("정상 목록을 넘기면 요청한 순서대로 position이 재배정된다", () => {
    const overlayId = createOverlay();
    const u1 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '단원A') returning id;`
    );
    const u2 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 2, '단원B') returning id;`
    );
    const u3 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 3, '단원C') returning id;`
    );

    asUser(
      TEACHER_ID,
      `select reorder_curriculum_overlay_units('${overlayId}', array['${u3}','${u1}','${u2}']::uuid[]);`
    );

    const rows = psql(
      `select id, position from curriculum_overlay_units where overlay_id = '${overlayId}' order by position;`
    )
      .split("\n")
      .map((line) => line.split("|"));
    expect(rows.map((r) => r[0])).toEqual([u3, u1, u2]);
    expect(rows.map((r) => r[1])).toEqual(["1", "2", "3"]);
  });

  it("일부만 넘기면(개수 불일치) 실패하고 기존 position은 전혀 바뀌지 않는다(원자성)", () => {
    const overlayId = createOverlay();
    const u1 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '단원A') returning id;`
    );
    const u2 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 2, '단원B') returning id;`
    );

    const before = psql(
      `select id, position from curriculum_overlay_units where overlay_id = '${overlayId}' order by position;`
    );

    const err = asUserExpectError(
      TEACHER_ID,
      `select reorder_curriculum_overlay_units('${overlayId}', array['${u1}']::uuid[]);`
    );
    expect(err).toMatch(/일치하지 않습니다/);

    const after = psql(
      `select id, position from curriculum_overlay_units where overlay_id = '${overlayId}' order by position;`
    );
    expect(after).toBe(before);
    void u2;
  });

  it("담당이 아닌 선생님은 재정렬 RPC를 호출할 수 없다", () => {
    const overlayId = createOverlay();
    const u1 = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '단원A') returning id;`
    );
    const err = asUserExpectError(
      OTHER_TEACHER_ID,
      `select reorder_curriculum_overlay_units('${overlayId}', array['${u1}']::uuid[]);`
    );
    expect(err).toMatch(/권한이 없습니다/);
  });
});

describe("보강 단원의 참고 콘텐츠 — 공개된 교재만 연결 가능", () => {
  it("공개(published)되지 않은 교재는 오버레이 보강 단원에 연결할 수 없다", () => {
    const overlayId = createOverlay();
    const supplementUnitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', null, 1, '보강 단원') returning id;`
    );
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('미공개 교재', '${SUBJECT_ID}', 'admin', 'draft') returning id;`
    );
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id)
       values ('${supplementUnitId}', '${docId}');`
    );
    // 미공개 교재는 curriculum_docs 자체 RLS("배포된 문서는 전체, 초안은
    // 작성자/관리자만")가 담당 선생님에게도 안 보이므로, 트리거 관점에서는
    // "존재하지 않음"으로 보인다 — 관리자로 시도하면 실제 "공개되지 않음"
    // 메시지를 그대로 받는다(둘 다 같은 목적: 삽입 거부).
    expect(err).toMatch(/존재하지 않는 교재입니다|공개\(published\)되지 않은/);

    const errAsAdmin = asUserExpectError(
      ADMIN_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id)
       values ('${supplementUnitId}', '${docId}');`
    );
    expect(errAsAdmin).toMatch(/공개\(published\)되지 않은/);
  });

  it("공개된 교재는 보강 단원에 연결할 수 있다", () => {
    const overlayId = createOverlay();
    const supplementUnitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', null, 1, '보강 단원') returning id;`
    );
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('공개 교재', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    const rowId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id)
       values ('${supplementUnitId}', '${docId}') returning overlay_unit_id;`
    );
    expect(rowId).toBe(supplementUnitId);
  });
});

describe("완료 상태 전이 — 선생님 명시적 행동으로만", () => {
  it("상태를 바꾸면 status_changed_by/at이 행위자(선생님)로 기록된다", () => {
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '단원') returning id;`
    );
    asUser(TEACHER_ID, `update curriculum_overlay_units set status = 'completed' where id = '${unitId}';`);
    const changedBy = psql(`select status_changed_by from curriculum_overlay_units where id = '${unitId}';`);
    expect(changedBy).toBe(TEACHER_ID);
  });

  it("session_problem_attempts가 아무리 쌓여도 오버레이 단원 상태는 자동으로 바뀌지 않는다", () => {
    // 오버레이 스키마에는애초에 session_problem_attempts를 읽어 상태를 자동
    // 전이시키는 트리거/함수가 전혀 없다 — 이 통합 테스트는 그 부재를
    // 명시적으로 확인한다(자동 전이 코드가 나중에 실수로 추가되면 이 값이 더
    // 이상 0으로 나오지 않아 실패한다).
    const triggerCount = psql(
      `select count(*) from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       where c.relname = 'session_problem_attempts' and not t.tgisinternal;`
    );
    expect(triggerCount).toBe("0");
  });
});
