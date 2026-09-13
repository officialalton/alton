import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// P2/P3 2차 — 회차 기본 구성의 상속.
//
// 확정 정책(2026-09-12): 새 회차는 키워드 없이 초안으로 존재할 수 있다. 기존
// 회차에 임의 키워드를 채우거나 지우지 않는다. 상속은 선생님이 눌러야 일어나고
// 이미 고른 것을 덮어쓰지 않는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const OTHER_SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000002";

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

const uniq = () => `${Date.now()}_${Math.random()}`;
const cleanupContractIds: string[] = [];
const cleanupTemplateUnitIds: string[] = [];
let templatePosition = 8000 + Math.floor(Math.random() * 300);

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
  for (const id of cleanupTemplateUnitIds.splice(0)) {
    psql(`delete from subject_template_units where id = '${id}';`);
  }
});

/** 관리자가 잡아 둔 기본 구성이 있는 템플릿 단원 하나. */
function makeTemplateUnit(): { unitId: string; keywordIds: string[]; docIds: string[] } {
  templatePosition += 1;
  const unitId = psql(
    `insert into subject_template_units (subject_id, position, unit_title)
     values ('${SUBJECT_ID}', ${templatePosition}, '기본구성 단원 ${uniq()}') returning id;`
  );
  cleanupTemplateUnitIds.push(unitId);

  const keywordIds = [1, 2].map((n) =>
    psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '기본구성 ${n} ${uniq()}') returning id;`
    )
  );
  for (const k of keywordIds) {
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${k}');`);
  }

  // position 순서가 그대로 내려오는지 보려고 제목 순서와 어긋나게 심는다.
  const docIds = ["ㄴ두번째", "ㄱ첫번째"].map((title) =>
    psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('${title} ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    )
  );
  psql(
    `insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position) values
       ('${unitId}', '${docIds[0]}', 1), ('${unitId}', '${docIds[1]}', 2);`
  );
  return { unitId, keywordIds, docIds };
}

function makeOverlayUnit(sourceUnitId: string | null): string {
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
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const overlayId = asUser(
    TEACHER_ID,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  return asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', ${sourceUnitId ? `'${sourceUnitId}'` : "null"}, 1, '회차 ${uniq()}') returning id;`
  );
}

const keywordsOf = (u: string) =>
  asUser(TEACHER_ID, `select count(*) from curriculum_overlay_unit_keywords where overlay_unit_id = '${u}';`);
const materialsOf = (u: string) =>
  asUser(
    TEACHER_ID,
    `select string_agg(curriculum_doc_id::text, ',' order by position)
     from curriculum_overlay_unit_materials where overlay_unit_id = '${u}';`
  );

describe("새 회차는 키워드 없는 초안으로 존재한다", () => {
  it("회차를 만들어도 키워드·교재가 자동으로 채워지지 않는다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    // 템플릿에 기본 구성이 있어도 만들기만으로는 내려오지 않는다.
    expect(keywordsOf(overlayUnitId)).toBe("0");
    expect(materialsOf(overlayUnitId)).toBe("");
  });
});

describe("물려받기는 선생님이 부를 때만 돈다", () => {
  it("관리자 기본 키워드·교재가 순서대로 내려온다", () => {
    const { unitId, keywordIds, docIds } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);

    const result = asUser(
      TEACHER_ID,
      `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
    );
    expect(result).toBe("2/2");
    expect(keywordsOf(overlayUnitId)).toBe("2");
    // 관리자가 정한 position 순서 그대로 — 제목 순이 아니다.
    expect(materialsOf(overlayUnitId)).toBe(`${docIds[0]},${docIds[1]}`);
    expect(keywordIds.length).toBe(2);
  });

  it("두 번 불러도 중복되지 않는다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    asUser(TEACHER_ID, `select * from inherit_unit_defaults_from_template('${overlayUnitId}');`);
    const second = asUser(
      TEACHER_ID,
      `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
    );
    expect(second).toBe("0/0");
    expect(keywordsOf(overlayUnitId)).toBe("2");
  });

  it("선생님이 이미 고른 것을 덮어쓰거나 지우지 않는다", () => {
    const { unitId, docIds } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);

    // 선생님이 관리자 기본에 없는 교재를 먼저 담아 둔다.
    const ownDocId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('선생님 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position)
       values ('${overlayUnitId}', '${ownDocId}', 1);`
    );

    asUser(TEACHER_ID, `select * from inherit_unit_defaults_from_template('${overlayUnitId}');`);

    // 선생님이 먼저 고른 것이 1번을 지키고, 물려받은 것이 뒤에 붙는다.
    expect(materialsOf(overlayUnitId)).toBe(`${ownDocId},${docIds[0]},${docIds[1]}`);
  });

  it("템플릿에서 갈라져 나오지 않은 회차는 물려받을 기본이 없다", () => {
    const overlayUnitId = makeOverlayUnit(null);
    expect(
      asUser(
        TEACHER_ID,
        `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
      )
    ).toBe("0/0");
  });

  it("담당이 아닌 선생님은 남의 학생 회차에 아무것도 넣지 못한다", () => {
    const { unitId, keywordIds } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);

    // 함수는 오류가 아니라 0/0을 돌려준다 — 남의 회차는 읽을 수조차 없어서
    // source_unit_id가 보이지 않기 때문이다. 있는지 없는지를 알려주지 않는 쪽이
    // 맞다("권한 없음"은 그 회차가 존재한다는 사실을 흘린다).
    expect(
      asUser(
        OTHER_TEACHER_ID,
        `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
      )
    ).toBe("0/0");
    expect(keywordsOf(overlayUnitId)).toBe("0");

    // 회차 id를 알아내 직접 넣으려 해도 막힌다. 남의 회차는 보이지 않으므로
    // 같은-과목 검사 트리거가 먼저 "존재하지 않는다"고 끊는다 — 정책 위반보다
    // 먼저 걸리지만, 존재 여부를 흘리지 않는다는 점에서 더 낫다.
    const stderr = asUserExpectError(
      OTHER_TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordIds[0]}');`
    );
    expect(stderr).toMatch(/row-level security|policy|존재하지 않는/i);
    expect(keywordsOf(overlayUnitId)).toBe("0");
  });
});

describe("교재 1개 : 대표 키워드 1개", () => {
  it("같은 과목 키워드는 대표로 붙는다", () => {
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '대표 ${uniq()}') returning id;`
    );
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('대표교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${keywordId}') returning id;`
    );
    expect(psql(`select primary_keyword_id from curriculum_docs where id = '${docId}';`)).toBe(keywordId);
  });

  it("다른 과목 키워드는 대표로 붙지 않는다", () => {
    const foreignKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${OTHER_SUBJECT_ID}', '남의과목 ${uniq()}') returning id;`
    );
    const stderr = psqlExpectError(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('대표교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${foreignKeywordId}');`
    );
    expect(stderr).toContain("같은 과목의 키워드여야 합니다");
  });

  it("마이그레이션이 기존 교재의 대표 키워드를 임의로 채우지 않았다", () => {
    // 대표 키워드는 관리자가 뜻을 담아 고르는 값이지 추정할 값이 아니다.
    // 이 파일이 직접 심은 교재('대표교재 …')만 값을 가져야 한다.
    const backfilled = psql(
      `select count(*) from curriculum_docs
       where primary_keyword_id is not null and title not like '대표교재 %';`
    );
    expect(backfilled).toBe("0");
  });
});
