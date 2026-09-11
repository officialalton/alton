import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
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
const OTHER_STUDENT_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아 (seed, 무관한 제3자 학생)
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

  // Acceptance gate(계획서 §Acceptance gate) — "학생은 다른 선생님의 준비
  // 데이터를 볼 수 없다"의 학생 축: 다른 학생(무관한 제3자)의 오버레이/오버레이
  // 단원은 조회조차 되지 않아야 한다. 위 "학생 본인은 조회할 수 있지만..."
  // 테스트는 본인 오버레이만 다뤘으므로, 여기서 교차 학생 차단을 명시적으로 검증한다.
  it("다른 학생은 이 학생의 오버레이를 조회할 수 없다(RLS 거부 — 빈 결과)", () => {
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '지훈 전용 단원') returning id;`
    );

    const overlayReadByOther = asUser(
      OTHER_STUDENT_ID,
      `select id from student_curriculum_overlays where id = '${overlayId}';`
    );
    expect(overlayReadByOther).toBe("");

    const unitReadByOther = asUser(
      OTHER_STUDENT_ID,
      `select id from curriculum_overlay_units where id = '${unitId}';`
    );
    expect(unitReadByOther).toBe("");
  });
});

// v3 커리큘럼 열람 결함 수정(2026-09-11, 마이그레이션
// 20261275000000_v3_curriculum_overlay_guardian_read.sql) — 학생 본인뿐 아니라
// 그 가구의 보호자도 오버레이/오버레이 단원을 조회할 수 있어야 한다(학생
// 포털·학부모 포털 공용 읽기 전용 커리큘럼 열람). subject_enrollments/
// teacher_assignments가 이미 쓰는 is_enrollment_child_or_guardian()을 그대로
// 재사용했으므로, 보호자 쓰기는 여전히 불가함도 함께 확인한다.
describe("보호자도 자녀의 오버레이를 조회할 수 있다(쓰기는 여전히 불가)", () => {
  const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // 지훈 모 (seed, HOUSEHOLD_ID 소속)

  it("연결된 보호자는 오버레이와 오버레이 단원을 조회할 수 있다", () => {
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '보호자 열람 확인용 단원') returning id;`
    );

    const overlayRead = asUser(
      GUARDIAN_ID,
      `select id from student_curriculum_overlays where id = '${overlayId}';`
    );
    expect(overlayRead).toBe(overlayId);

    const unitRead = asUser(
      GUARDIAN_ID,
      `select id from curriculum_overlay_units where id = '${unitId}';`
    );
    expect(unitRead).toBe(unitId);
  });

  it("연결된 보호자도 오버레이 단원을 쓸 수는 없다(읽기 전용)", () => {
    const overlayId = createOverlay();
    const err = asUserExpectError(
      GUARDIAN_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '보호자 쓰기 시도') returning id;`
    );
    expect(err).toMatch(/row-level security|policy/i);
  });

  it("가구와 무관한 제3자는 여전히 조회할 수 없다", () => {
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '무관한 제3자 차단 확인용 단원') returning id;`
    );

    const overlayReadByOther = asUser(
      OTHER_TEACHER_ID,
      `select id from student_curriculum_overlays where id = '${overlayId}';`
    );
    expect(overlayReadByOther).toBe("");

    const unitReadByOther = asUser(
      OTHER_TEACHER_ID,
      `select id from curriculum_overlay_units where id = '${unitId}';`
    );
    expect(unitReadByOther).toBe("");
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

// Acceptance gate(계획서 §Acceptance gate) — "a teacher can add a published
// canonical unit or compose a supplement unit without changing any canonical
// row". 모든 정본(canonical) 테이블의 (행 수, md5 체크섬)을 오버레이 조작 전후로
// 비교해 0 diff를 증명한다 — subject-curriculum-actions.ts의 addCanonicalUnit/
// createSupplementUnit이 실제로 쓰는 것과 동일한 curriculum_overlay_units insert를
// 그대로 재현한다.
const CANONICAL_TABLES = [
  "curriculum_docs",
  "curriculum_doc_sections",
  "problems",
  "subject_template_units",
  "subject_keywords",
  "subject_template_unit_keywords",
  "curriculum_doc_section_keywords",
  "problem_keywords",
] as const;

function canonicalChecksums(): string {
  const selects = CANONICAL_TABLES.map(
    (t) => `select '${t}' as tbl, count(*) as n, coalesce(md5(string_agg(t.*::text, '' order by t.*::text)), '') as sum from ${t} t`
  ).join(" union all ");
  return psql(`${selects} order by tbl;`);
}

describe("정본(canonical) 테이블 무변경 — 오버레이 조작은 원본을 절대 바꾸지 않는다", () => {
  it("공개 단원을 오버레이에 추가해도 모든 정본 테이블의 행수/체크섬이 그대로다", () => {
    const before = canonicalChecksums();
    const overlayId = createOverlay();
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, '정본 무변경 확인용 단원') returning id;`
    );
    const after = canonicalChecksums();
    expect(after).toBe(before);
  });

  it("보강(supplement) 단원을 조립해도(참고 교재/키워드 연결 포함) 모든 정본 테이블이 그대로다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('보강용 공개 교재 ${Date.now()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '보강테스트키워드 ${Date.now()}') returning id;`
    );

    const before = canonicalChecksums();
    const overlayId = createOverlay();
    const supplementUnitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title, note)
       values ('${overlayId}', null, 1, '보강 단원', '조합 테스트') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id)
       values ('${supplementUnitId}', '${docId}');`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${supplementUnitId}', '${keywordId}');`
    );
    const after = canonicalChecksums();
    expect(after).toBe(before);
  });
});

// Acceptance gate — "the existing personal vocabulary table is untouched by
// keyword operations". Task 1-4가 vocab_words에 FK/트리거/코드 경로를 전혀
// 추가하지 않았음을 스키마 레벨로 확인하고, 키워드 카탈로그 조작이 실제로
// vocab_words 행을 건드리지 않는다는 것도 행수/체크섬으로 증명한다.
describe("vocab_words — 키워드 카탈로그 조작에 완전히 무관하다", () => {
  it("어떤 R9 키워드/오버레이 테이블도 vocab_words를 참조하는 FK/트리거를 갖지 않는다", () => {
    const fkCount = psql(`
      select count(*) from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name and tc.constraint_schema = ccu.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'vocab_words'
        and tc.table_name in (
          'subject_keywords','subject_template_unit_keywords','curriculum_doc_section_keywords',
          'problem_keywords','student_curriculum_overlays','curriculum_overlay_units',
          'curriculum_overlay_unit_keywords','curriculum_overlay_unit_materials'
        );
    `);
    expect(fkCount).toBe("0");

    const triggerCount = psql(`
      select count(*) from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where c.relname = 'vocab_words' and not t.tgisinternal;
    `);
    expect(triggerCount).toBe("0");
  });

  it("키워드/오버레이 조작을 한 차례 수행해도 vocab_words 행수와 체크섬이 그대로다", () => {
    const before = psql(
      `select count(*) as n, coalesce(md5(string_agg(t.*::text, '' order by t.*::text)), '') as sum from vocab_words t;`
    );

    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'vocab무변경확인 ${Date.now()}') returning id;`
    );
    const overlayId = createOverlay();
    const unitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayId}', '${baseUnitId}', 1, 'vocab 무변경 확인용 단원') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${unitId}', '${keywordId}');`
    );

    const after = psql(
      `select count(*) as n, coalesce(md5(string_agg(t.*::text, '' order by t.*::text)), '') as sum from vocab_words t;`
    );
    expect(after).toBe(before);
  });
});

// R9 corrective 1 — ensure_active_curriculum_overlay(supabase/migrations/
// 20261230000000_r9_corrective_overlay_baseline_seed.sql): 오버레이가 처음
// 만들어질 때 과목 기본(canonical) 단원 전체 + 단원별 기본 키워드 스냅샷으로
// 베이스라인을 시딩하고, 동시 호출에도 활성 오버레이 1개·베이스라인 시딩 1회만
// 보장한다. 진짜 동시성(Promise.all)은 동기 execFileSync(psql)로는 재현할 수
// 없으므로, parent-home-lessons-parallel-regression.integration.test.ts와 같은
// 패턴으로 supabase-js 서비스롤 클라이언트(REST 경유, 실제 비동기 I/O)를 쓴다.
const DB_URL_API = "http://127.0.0.1:54421";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const adminClient = createClient(DB_URL_API, SERVICE_ROLE_KEY);

function countSubjectTemplateUnits(): number {
  return Number(psql(`select count(*) from subject_template_units where subject_id = '${SUBJECT_ID}';`));
}

describe("ensure_active_curriculum_overlay — 최초 베이스라인 시딩", () => {
  it("처음 호출하면 과목의 기본 단원 전체가 source_unit_id로 참조된 오버레이 단원으로 시딩된다", async () => {
    const enrollmentId = makeEnrollment();
    const expectedUnitCount = countSubjectTemplateUnits();

    const { data: overlayId, error } = await adminClient.rpc("ensure_active_curriculum_overlay", {
      p_subject_enrollment_id: enrollmentId,
    });
    expect(error).toBeNull();
    expect(overlayId).toMatch(/^[0-9a-f-]{36}$/);

    const seededCount = psql(
      `select count(*) from curriculum_overlay_units where overlay_id = '${overlayId}';`
    );
    expect(Number(seededCount)).toBe(expectedUnitCount);

    const canonicalUntouched = psql(
      `select count(*) from subject_template_units where subject_id = '${SUBJECT_ID}';`
    );
    expect(Number(canonicalUntouched)).toBe(expectedUnitCount);

    const sourceRefs = psql(
      `select count(*) from curriculum_overlay_units ou
       join subject_template_units u on u.id = ou.source_unit_id
       where ou.overlay_id = '${overlayId}';`
    );
    expect(Number(sourceRefs)).toBe(expectedUnitCount);
  });

  // R9 corrective 1(추가분) — 20261231000000_r9_corrective_overlay_baseline_materials.sql:
  // corrective 1의 원래 시딩이 단원/키워드는 스냅샷했지만 단원별 참고 교재
  // (subject_template_unit_materials)는 빠뜨렸던 것을 확장한다. 여기서는
  // baseUnitId에 공개(published) 교재를 하나 연결해두고, 시딩된 오버레이 단원의
  // curriculum_overlay_unit_materials 행이 정확히 그 교재 하나(다른 단원과 섞이지
  // 않고)로 채워지는지 정확한 개수로 확인한다.
  it("처음 호출하면 각 베이스라인 단원의 공개(published) 참고 교재가 curriculum_overlay_unit_materials로 정확히 시딩된다", async () => {
    const enrollmentId = makeEnrollment();
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('베이스라인 참고교재 ${Date.now()}', '${SUBJECT_ID}', '${baseUnitId}', 'admin', 'published') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id) values ('${baseUnitId}', '${docId}');`
    );

    try {
      const { data: overlayId, error } = await adminClient.rpc("ensure_active_curriculum_overlay", {
        p_subject_enrollment_id: enrollmentId,
      });
      expect(error).toBeNull();

      // 이 원본 단원(baseUnitId)에 연결된 오버레이 단원 인스턴스는 정확히 그
      // 하나의 published 교재만 참고 교재로 갖는다.
      const materialsForBaseUnit = psql(
        `select count(*) from curriculum_overlay_units ou
         join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
         where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
      );
      expect(Number(materialsForBaseUnit)).toBe(1);

      const materialDocId = psql(
        `select m.curriculum_doc_id from curriculum_overlay_units ou
         join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
         where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
      );
      expect(materialDocId).toBe(docId);

      // 전체 오버레이의 참고 교재 총 개수는 과목 전체 canonical
      // subject_template_unit_materials 행 수와 정확히 같아야 한다(단원 간 교재가
      // 섞이지 않고, 하나도 빠짐없이 복사됐다는 것을 동시에 증명).
      const expectedTotalMaterials = Number(
        psql(
          `select count(*) from subject_template_unit_materials tum
           join subject_template_units u on u.id = tum.unit_id
           join curriculum_docs d on d.id = tum.curriculum_doc_id
           where u.subject_id = '${SUBJECT_ID}' and d.status = 'published';`
        )
      );
      const overlayTotalMaterials = Number(
        psql(
          `select count(*) from curriculum_overlay_units ou
           join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
           where ou.overlay_id = '${overlayId}';`
        )
      );
      expect(overlayTotalMaterials).toBe(expectedTotalMaterials);
    } finally {
      // 정리: 다음 테스트에 영향 주지 않도록 이 테스트가 만든 canonical 교재
      // 연결과 교재 자체를 되돌린다.
      psql(
        `delete from subject_template_unit_materials where unit_id = '${baseUnitId}' and curriculum_doc_id = '${docId}';`
      );
      psql(`delete from curriculum_docs where id = '${docId}';`);
    }
  });

  // draft 교재는 절대 시딩되면 안 된다 — check_overlay_unit_material_published
  // 트리거(Task 3, corrective 2가 그대로 둔 쓰기 시점 published 게이트)와 시딩
  // SELECT의 published 필터가 이중으로 이를 보장한다.
  it("draft 상태인 참고 교재는 절대 시딩되지 않는다(published인 것만 시딩)", async () => {
    const enrollmentId = makeEnrollment();
    const publishedDocId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('공개교재 ${Date.now()}', '${SUBJECT_ID}', '${baseUnitId}', 'admin', 'published') returning id;`
    );
    const draftDocId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('초안교재 ${Date.now()}', '${SUBJECT_ID}', '${baseUnitId}', 'admin', 'draft') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id) values ('${baseUnitId}', '${publishedDocId}');`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id) values ('${baseUnitId}', '${draftDocId}');`
    );

    try {
      const { data: overlayId, error } = await adminClient.rpc("ensure_active_curriculum_overlay", {
        p_subject_enrollment_id: enrollmentId,
      });
      expect(error).toBeNull();

      const seededDocIds = psql(
        `select coalesce(string_agg(m.curriculum_doc_id::text, ',' order by m.curriculum_doc_id), '')
         from curriculum_overlay_units ou
         join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
         where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
      );
      expect(seededDocIds).toBe(publishedDocId);
      expect(seededDocIds).not.toMatch(draftDocId);
    } finally {
      psql(
        `delete from subject_template_unit_materials where unit_id = '${baseUnitId}' and curriculum_doc_id in ('${publishedDocId}', '${draftDocId}');`
      );
      psql(`delete from curriculum_docs where id in ('${publishedDocId}', '${draftDocId}');`);
    }
  });

  // 스냅샷 불변성: 오버레이가 이미 만들어진 뒤 canonical 단원↔교재 관계가
  // 바뀌어도(새 교재 추가) 이미 시딩된 학생 오버레이의
  // curriculum_overlay_unit_materials 행은 절대 소급 변경되지 않는다 — 재호출은
  // 이미 활성 오버레이가 있으므로 조기 반환하고 재시딩하지 않기 때문이다.
  it("오버레이 생성 후 canonical 단원-교재 관계가 바뀌어도 이미 시딩된 학생 오버레이는 변하지 않는다(스냅샷 불변성)", async () => {
    const enrollmentId = makeEnrollment();

    const { data: overlayId, error: firstError } = await adminClient.rpc(
      "ensure_active_curriculum_overlay",
      { p_subject_enrollment_id: enrollmentId }
    );
    expect(firstError).toBeNull();

    const beforeCount = Number(
      psql(
        `select count(*) from curriculum_overlay_units ou
         join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
         where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
      )
    );

    // 오버레이가 이미 만들어진 "뒤에" canonical 관계를 바꾼다.
    const newDocId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('사후추가교재 ${Date.now()}', '${SUBJECT_ID}', '${baseUnitId}', 'admin', 'published') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id) values ('${baseUnitId}', '${newDocId}');`
    );

    try {
      // 같은 enrollment에 재호출 — 이미 활성 오버레이가 있으므로 조기 반환,
      // 재시딩하지 않는다.
      const { data: secondOverlayId, error: secondError } = await adminClient.rpc(
        "ensure_active_curriculum_overlay",
        { p_subject_enrollment_id: enrollmentId }
      );
      expect(secondError).toBeNull();
      expect(secondOverlayId).toBe(overlayId);

      const afterCount = Number(
        psql(
          `select count(*) from curriculum_overlay_units ou
           join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
           where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
        )
      );
      // canonical 쪽에 교재가 새로 하나 추가됐어도, 이미 만들어진 학생
      // 오버레이의 시딩된 교재 개수는 그대로여야 한다(소급 반영 없음).
      expect(afterCount).toBe(beforeCount);

      const hasNewDoc = psql(
        `select count(*) from curriculum_overlay_units ou
         join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
         where ou.overlay_id = '${overlayId}' and m.curriculum_doc_id = '${newDocId}';`
      );
      expect(Number(hasNewDoc)).toBe(0);
    } finally {
      psql(
        `delete from subject_template_unit_materials where unit_id = '${baseUnitId}' and curriculum_doc_id = '${newDocId}';`
      );
      psql(`delete from curriculum_docs where id = '${newDocId}';`);
    }
  });

  it("시딩 시점의 단원 기본 키워드가 오버레이 단원 키워드로 스냅샷 복사된다", async () => {
    const enrollmentId = makeEnrollment();
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '베이스라인키워드 ${Date.now()}') returning id;`
    );
    psql(
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${baseUnitId}', '${keywordId}');`
    );

    const { data: overlayId, error } = await adminClient.rpc("ensure_active_curriculum_overlay", {
      p_subject_enrollment_id: enrollmentId,
    });
    expect(error).toBeNull();

    const overlayKeyword = psql(
      `select k.keyword_id from curriculum_overlay_units ou
       join curriculum_overlay_unit_keywords k on k.overlay_unit_id = ou.id
       where ou.overlay_id = '${overlayId}' and ou.source_unit_id = '${baseUnitId}';`
    );
    expect(overlayKeyword).toBe(keywordId);

    // 정리: 다음 테스트에 영향 주지 않도록 이 테스트가 만든 단원-키워드 관계를 되돌린다.
    psql(
      `delete from subject_template_unit_keywords where unit_id = '${baseUnitId}' and keyword_id = '${keywordId}';`
    );
  });

  it("이미 활성 오버레이가 있으면 재호출해도 재시딩하지 않고 같은 오버레이 id를 반환한다", async () => {
    const enrollmentId = makeEnrollment();
    const expectedUnitCount = countSubjectTemplateUnits();

    const { data: first } = await adminClient.rpc("ensure_active_curriculum_overlay", {
      p_subject_enrollment_id: enrollmentId,
    });
    const { data: second } = await adminClient.rpc("ensure_active_curriculum_overlay", {
      p_subject_enrollment_id: enrollmentId,
    });
    expect(second).toBe(first);

    const seededCount = psql(
      `select count(*) from curriculum_overlay_units where overlay_id = '${first}';`
    );
    expect(Number(seededCount)).toBe(expectedUnitCount);
  });

  it("동시 호출(Promise.all)해도 정확히 활성 오버레이 1개 + 베이스라인 단원 N개만 존재한다(N * 동시호출수가 아니다)", async () => {
    const enrollmentId = makeEnrollment();
    const expectedUnitCount = countSubjectTemplateUnits();
    const CONCURRENCY = 8;

    // 동시성 테스트에도 참고 교재 시딩이 있는 상태에서 정확히 한 번만 일어나는지
    // 확인하기 위해 baseUnitId에 published 교재 하나를 연결해둔다.
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, unit_id, owner_type, status)
       values ('동시성 참고교재 ${Date.now()}', '${SUBJECT_ID}', '${baseUnitId}', 'admin', 'published') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id) values ('${baseUnitId}', '${docId}');`
    );
    const expectedTotalMaterials = Number(
      psql(
        `select count(*) from subject_template_unit_materials tum
         join subject_template_units u on u.id = tum.unit_id
         join curriculum_docs d on d.id = tum.curriculum_doc_id
         where u.subject_id = '${SUBJECT_ID}' and d.status = 'published';`
      )
    );

    try {
      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          adminClient.rpc("ensure_active_curriculum_overlay", {
            p_subject_enrollment_id: enrollmentId,
          })
        )
      );

      for (const r of results) {
        expect(r.error).toBeNull();
      }
      const overlayIds = new Set(results.map((r) => r.data));
      // 모든 동시 호출이 정확히 같은 오버레이 id 하나로 수렴해야 한다.
      expect(overlayIds.size).toBe(1);

      const activeOverlayCount = psql(
        `select count(*) from student_curriculum_overlays
         where subject_enrollment_id = '${enrollmentId}' and status = 'active';`
      );
      expect(Number(activeOverlayCount)).toBe(1);

      const [overlayId] = overlayIds;
      const seededCount = psql(
        `select count(*) from curriculum_overlay_units where overlay_id = '${overlayId}';`
      );
      // CONCURRENCY번 동시 호출됐어도 베이스라인은 정확히 한 번만 시딩되어야
      // 한다 — expectedUnitCount * CONCURRENCY가 아니라 expectedUnitCount여야 한다.
      expect(Number(seededCount)).toBe(expectedUnitCount);

      const seededMaterialsCount = Number(
        psql(
          `select count(*) from curriculum_overlay_units ou
           join curriculum_overlay_unit_materials m on m.overlay_unit_id = ou.id
           where ou.overlay_id = '${overlayId}';`
        )
      );
      // 참고 교재도 마찬가지로 CONCURRENCY배가 아니라 정확히
      // expectedTotalMaterials(= N)여야 한다.
      expect(seededMaterialsCount).toBe(expectedTotalMaterials);
    } finally {
      psql(
        `delete from subject_template_unit_materials where unit_id = '${baseUnitId}' and curriculum_doc_id = '${docId}';`
      );
      psql(`delete from curriculum_docs where id = '${docId}';`);
    }
  });
});
