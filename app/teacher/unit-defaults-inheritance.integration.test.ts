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

// 이 파일이 심는 교재와 원래 있던 교재를 가르는 기준선. 백필 여부는 "원래 있던
// 교재"에 대해서만 물어야 한다.
let preexistingDocIds: string[] = [];
beforeAll(() => {
  preexistingDocIds = psql(`select id from curriculum_docs;`).split("\n").filter(Boolean);
});
const cleanupContractIds: string[] = [];
// 이 파일이 심는 교재도 치운다. 안 치우면 다음 실행에서 "원래 있던 교재"로
// 둔갑해, 마이그레이션이 백필했는지 묻는 검사를 오염시킨다.
const cleanupDocIds: string[] = [];
function newDoc(sql: string): string {
  const id = psql(sql);
  cleanupDocIds.push(id);
  return id;
}
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
  for (const id of cleanupDocIds.splice(0)) {
    psql(`delete from curriculum_docs where id = '${id}';`);
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
    newDoc(
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

// 2026-09-12 정정: 초기 상속과 기존 데이터 보정은 다른 이야기다.
//   초기 상속 = 관리자 기준본에서 회차를 **처음 만들 때** 자동으로 내려온다.
//   보정      = 이미 있는 회차를 나중에 채우는 것. 자동으로 하지 않는다.
describe("초기 상속은 회차가 만들어질 때 자동으로 일어난다", () => {
  it("관리자 기준본에서 갈라져 나온 회차는 만들어질 때 기본 키워드·교재를 받는다", () => {
    const { unitId, docIds } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    expect(keywordsOf(overlayUnitId)).toBe("2");
    expect(materialsOf(overlayUnitId)).toBe(`${docIds[0]},${docIds[1]}`);
  });

  it("기준본에서 갈라져 나오지 않은 회차는 빈 초안으로 남는다", () => {
    const overlayUnitId = makeOverlayUnit(null);
    expect(keywordsOf(overlayUnitId)).toBe("0");
    expect(materialsOf(overlayUnitId)).toBe("");
  });

  it("이미 있는 회차는 관리자 기본이 바뀌어도 저절로 변하지 않는다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    const before = materialsOf(overlayUnitId);

    // 관리자가 나중에 교재를 하나 더 붙인다.
    const lateDocId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('나중 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position)
       values ('${unitId}', '${lateDocId}', 9);`
    );

    // 이미 운영 중인 회차는 그대로다 — 보정은 선생님이 부를 때만 일어난다.
    expect(materialsOf(overlayUnitId)).toBe(before);
  });
});

describe("물려받기는 선생님이 부를 때만 돈다", () => {
  it("이미 상속받은 회차에서 다시 불러도 중복되지 않는다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    const again = asUser(
      TEACHER_ID,
      `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
    );
    expect(again).toBe("0/0");
    expect(keywordsOf(overlayUnitId)).toBe("2");
  });

  it("나중에 추가된 관리자 기본을 보충해 가져온다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    const before = materialsOf(overlayUnitId);

    const lateDocId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('보충 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position)
       values ('${unitId}', '${lateDocId}', 9);`
    );

    asUser(TEACHER_ID, `select * from inherit_unit_defaults_from_template('${overlayUnitId}');`);
    expect(materialsOf(overlayUnitId)).toBe(`${before},${lateDocId}`);
  });

  it("선생님이 이미 고른 것을 덮어쓰거나 지우지 않는다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    const before = materialsOf(overlayUnitId);

    const ownDocId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('선생님 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id)
       values ('${overlayUnitId}', '${ownDocId}');`
    );

    asUser(TEACHER_ID, `select * from inherit_unit_defaults_from_template('${overlayUnitId}');`);
    // 상속받은 것이 앞 순서를 지키고, 선생님이 담은 것은 그대로 뒤에 남는다.
    expect(materialsOf(overlayUnitId)).toBe(`${before},${ownDocId}`);
  });

  it("담당이 아닌 선생님은 남의 학생 회차에 아무것도 넣지 못한다", () => {
    const { unitId } = makeTemplateUnit();
    const overlayUnitId = makeOverlayUnit(unitId);
    const foreignKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '침입 ${uniq()}') returning id;`
    );

    // 함수는 오류가 아니라 0/0을 돌려준다 — 남의 회차는 읽을 수조차 없어서
    // source_unit_id가 보이지 않기 때문이다. 있는지 없는지를 알려주지 않는 쪽이
    // 맞다("권한 없음"은 그 회차가 존재한다는 사실을 흘린다).
    expect(
      asUser(
        OTHER_TEACHER_ID,
        `select keywords_added || '/' || materials_added from inherit_unit_defaults_from_template('${overlayUnitId}');`
      )
    ).toBe("0/0");

    // 회차 id를 알아내 직접 넣으려 해도 막힌다. 남의 회차는 보이지 않으므로
    // 같은-과목 검사 트리거가 먼저 "존재하지 않는다"고 끊는다 — 정책 위반보다
    // 먼저 걸리지만, 존재 여부를 흘리지 않는다는 점에서 더 낫다.
    const stderr = asUserExpectError(
      OTHER_TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${foreignKeywordId}');`
    );
    expect(stderr).toMatch(/row-level security|policy|존재하지 않는/i);
  });
});

describe("교재 1개 : 대표 키워드 1개", () => {
  it("같은 과목 키워드는 대표로 붙는다", () => {
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '대표 ${uniq()}') returning id;`
    );
    const docId = newDoc(
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
    const idList = preexistingDocIds.map((id) => `'${id}'`).join(",");
    expect(preexistingDocIds.length).toBeGreaterThan(0);
    const backfilled = psql(
      `select count(*) from curriculum_docs
       where primary_keyword_id is not null and id in (${idList});`
    );
    expect(backfilled).toBe("0");
  });
});

// P2 2차 — 키워드를 붙이면 그 키워드의 기본 교재가 자동으로 구성에 들어온다.
// 선생님이 눌러야만 들어오는 구조로는 요구를 충족하지 못한다.
describe("키워드 → 교재 자동 구성", () => {
  const sourceOf = (u: string, d: string) =>
    asUser(
      TEACHER_ID,
      `select source from curriculum_overlay_unit_materials
       where overlay_unit_id = '${u}' and curriculum_doc_id = '${d}';`
    );

  /** 그 키워드를 대표 키워드로 갖는 공개 교재 하나. */
  function makeKeywordDefaultDoc(keywordId: string, position: number): string {
    return newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id, primary_keyword_position)
       values ('기본교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}', ${position})
       returning id;`
    );
  }

  function bareUnitAndKeyword(): { overlayUnitId: string; keywordId: string } {
    const overlayUnitId = makeOverlayUnit(null);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '자동 ${uniq()}') returning id;`
    );
    return { overlayUnitId, keywordId };
  }

  it("키워드를 붙이는 것만으로 기본 교재가 들어온다", () => {
    const { overlayUnitId, keywordId } = bareUnitAndKeyword();
    const docB = makeKeywordDefaultDoc(keywordId, 2);
    const docA = makeKeywordDefaultDoc(keywordId, 1);

    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );

    // 관리자가 정한 키워드 안 순서대로.
    expect(materialsOf(overlayUnitId)).toBe(`${docA},${docB}`);
    expect(sourceOf(overlayUnitId, docA)).toBe("auto");
  });

  it("공개되지 않은 교재는 자동으로 들어오지 않는다", () => {
    const { overlayUnitId, keywordId } = bareUnitAndKeyword();
    newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('초안교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${keywordId}') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );
    expect(materialsOf(overlayUnitId)).toBe("");
  });

  it("키워드를 떼면 자동으로 들어온 것만 빠지고 직접 담은 것은 남는다", () => {
    const { overlayUnitId, keywordId } = bareUnitAndKeyword();
    const autoDoc = makeKeywordDefaultDoc(keywordId, 1);
    const ownDoc = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('직접 담은 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );

    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, source)
       values ('${overlayUnitId}', '${ownDoc}', 'manual');`
    );
    expect(materialsOf(overlayUnitId)).toBe(`${autoDoc},${ownDoc}`);

    asUser(
      TEACHER_ID,
      `delete from curriculum_overlay_unit_keywords
       where overlay_unit_id = '${overlayUnitId}' and keyword_id = '${keywordId}';`
    );
    expect(materialsOf(overlayUnitId)).toBe(ownDoc);
  });

  it("선생님이 뺀 자동 자료는 다시 들어오지 않는다", () => {
    const { overlayUnitId, keywordId } = bareUnitAndKeyword();
    const autoDoc = makeKeywordDefaultDoc(keywordId, 1);
    const otherKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '자동2 ${uniq()}') returning id;`
    );

    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );
    // 선생님이 뺀다 — 뺐다는 사실을 기억해야 다음 동기화가 되돌리지 않는다.
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_material_exclusions (overlay_unit_id, curriculum_doc_id)
       values ('${overlayUnitId}', '${autoDoc}');
       delete from curriculum_overlay_unit_materials
       where overlay_unit_id = '${overlayUnitId}' and curriculum_doc_id = '${autoDoc}';`
    );

    // 다른 키워드를 붙여 동기화를 다시 돌려도 되돌아오지 않는다.
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${otherKeywordId}');`
    );
    expect(materialsOf(overlayUnitId)).toBe("");
  });

  it("자동 갱신이 선생님이 맞춰 둔 순서를 흔들지 않는다", () => {
    const { overlayUnitId, keywordId } = bareUnitAndKeyword();
    const firstDoc = makeKeywordDefaultDoc(keywordId, 1);
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );

    const ownDoc = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('맨 앞 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    // 선생님이 자기 교재를 맨 앞으로 올린다.
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, source)
       values ('${overlayUnitId}', '${ownDoc}', 0, 'manual');`
    );
    expect(materialsOf(overlayUnitId)).toBe(`${ownDoc},${firstDoc}`);

    // 새 키워드가 붙어 자동분이 더 들어와도 앞 순서는 그대로, 새 것은 뒤에.
    const secondKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '자동3 ${uniq()}') returning id;`
    );
    const lateDoc = makeKeywordDefaultDoc(secondKeywordId, 1);
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${secondKeywordId}');`
    );
    expect(materialsOf(overlayUnitId)).toBe(`${ownDoc},${firstDoc},${lateDoc}`);
  });

  it("기존 회차의 구성은 전부 manual로 남아 자동 회수 대상이 아니다", () => {
    // 마이그레이션이 source 기본값을 manual로 뒀다는 것 — 이미 운영 중이던
    // 구성이 키워드 변경만으로 사라지면 안 된다.
    expect(
      psql(`select count(*) from curriculum_overlay_unit_materials where source not in ('auto','manual');`)
    ).toBe("0");
  });
});

// 키워드는 그대로인데 교재 쪽이 바뀌는 경우. 키워드를 붙이는 순간에만 동작하면
// 이후에 배포된 교재가 영원히 누락된다.
describe("교재 쪽이 바뀌어도 자동 구성이 따라온다", () => {
  function unitWithKeyword(): { overlayUnitId: string; keywordId: string } {
    const overlayUnitId = makeOverlayUnit(null);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '추적 ${uniq()}') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );
    return { overlayUnitId, keywordId };
  }

  it("나중에 배포된 교재가 이미 키워드가 붙은 회차로 들어온다", () => {
    const { overlayUnitId, keywordId } = unitWithKeyword();
    expect(materialsOf(overlayUnitId)).toBe("");

    // 초안으로 만들어 두고 — 아직 들어오면 안 된다.
    const docId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('나중 배포 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${keywordId}') returning id;`
    );
    expect(materialsOf(overlayUnitId)).toBe("");

    // 배포하는 순간 들어온다.
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);
    expect(materialsOf(overlayUnitId)).toBe(docId);
  });

  it("배포를 내리면 자동분에서 빠진다", () => {
    const { overlayUnitId, keywordId } = unitWithKeyword();
    const docId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('내릴 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}') returning id;`
    );
    expect(materialsOf(overlayUnitId)).toBe(docId);

    psql(`update curriculum_docs set status = 'draft' where id = '${docId}';`);
    expect(materialsOf(overlayUnitId)).toBe("");
  });

  it("대표 키워드를 옮기면 옛 회차에서 빠지고 새 회차로 들어온다", () => {
    const a = unitWithKeyword();
    const b = unitWithKeyword();
    const docId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('옮길 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${a.keywordId}') returning id;`
    );
    expect(materialsOf(a.overlayUnitId)).toBe(docId);
    expect(materialsOf(b.overlayUnitId)).toBe("");

    psql(`update curriculum_docs set primary_keyword_id = '${b.keywordId}' where id = '${docId}';`);
    expect(materialsOf(a.overlayUnitId)).toBe("");
    expect(materialsOf(b.overlayUnitId)).toBe(docId);
  });

  it("갱신이 수동 구성·제외·순서를 보존한다", () => {
    const { overlayUnitId, keywordId } = unitWithKeyword();

    // 선생님이 직접 담은 교재를 맨 앞에 둔다.
    const ownDoc = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('내 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, source)
       values ('${overlayUnitId}', '${ownDoc}', 0, 'manual');`
    );

    // 선생님이 뺀 자동 교재.
    const excludedDoc = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('뺀 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_material_exclusions (overlay_unit_id, curriculum_doc_id)
       values ('${overlayUnitId}', '${excludedDoc}');
       delete from curriculum_overlay_unit_materials
       where overlay_unit_id = '${overlayUnitId}' and curriculum_doc_id = '${excludedDoc}';`
    );

    // 교재가 새로 배포돼 갱신이 돈다.
    const lateDoc = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('늦은 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}') returning id;`
    );

    // 수동분은 맨 앞 그대로, 뺀 것은 돌아오지 않고, 새 것만 뒤에 붙는다.
    expect(materialsOf(overlayUnitId)).toBe(`${ownDoc},${lateDoc}`);
  });

  it("이미 시작한 수업의 고정 내용은 갱신에 흔들리지 않는다", () => {
    const { overlayUnitId, keywordId } = unitWithKeyword();
    const docId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('고정 확인 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}') returning id;`
    );
    expect(materialsOf(overlayUnitId)).toBe(docId);

    // 과거 수업이 읽는 것은 session_content_manifest 스냅샷이지 회차 구성이
    // 아니다 — 회차 구성이 바뀌어도 고정된 매니페스트 행은 그대로다.
    const before = psql(`select count(*) from session_content_manifest;`);
    psql(`update curriculum_docs set status = 'draft' where id = '${docId}';`);
    expect(materialsOf(overlayUnitId)).toBe("");
    expect(psql(`select count(*) from session_content_manifest;`)).toBe(before);
  });
});

// 서버가 마지막 방어선이다 — 목록을 연 사이에 배포가 내려갈 수 있다.
describe("배포되지 않은 교재는 구성에 들어가지 않는다", () => {
  it("초안 교재는 키워드를 통해서도 들어오지 않는다", () => {
    const overlayUnitId = makeOverlayUnit(null);
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '초안확인 ${uniq()}') returning id;`
    );
    newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('초안 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${keywordId}') returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
       values ('${overlayUnitId}', '${keywordId}');`
    );
    expect(materialsOf(overlayUnitId)).toBe("");
  });

  it("키워드 기본 교재 뷰는 배포된 것만 돌려준다", () => {
    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '뷰확인 ${uniq()}') returning id;`
    );
    newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('초안 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${keywordId}') returning id;`
    );
    const publishedId = newDoc(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('배포 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}') returning id;`
    );
    expect(
      psql(`select string_agg(curriculum_doc_id::text, ',') from keyword_default_materials
            where keyword_id = '${keywordId}';`)
    ).toBe(publishedId);
  });
});
