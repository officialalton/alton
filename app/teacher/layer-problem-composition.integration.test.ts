import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 5차 — 관리자 기준본·선생님 기본 템플릿의 문제 구성.
//
// 제품 오너 정정: 이 두 층은 "미리보기"가 아니라 **구성**할 수 있어야 한다.
// 이 파일이 지키는 것:
//   - 조건(형식·난이도·개수)이 자동 구성에 적용된다
//   - 다시 계산해도 사람이 담은 것·뺀 것·맞춘 순서가 보존된다
//   - 부족해도 채우지 않고 고를 수 있는 수를 알려준다
//   - 최초 상속과 상위 변경 반영은 다르다

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

const uniq = () => `${Date.now()}_${Math.random()}`;

const cleanupKeywordIds: string[] = [];
const cleanupUnitIds: string[] = [];
const cleanupProblemIds: string[] = [];
const cleanupTeacherUnitIds: string[] = [];

afterEach(() => {
  for (const id of cleanupTeacherUnitIds.splice(0)) {
    psql(`delete from teacher_curriculum_template_units where id = '${id}';`);
  }
  for (const id of cleanupUnitIds.splice(0)) {
    psql(`delete from subject_template_units where id = '${id}';`);
  }
  for (const id of cleanupProblemIds.splice(0)) {
    psql(`delete from problems where id = '${id}';`);
  }
  for (const id of cleanupKeywordIds.splice(0)) {
    psql(`delete from subject_keywords where id = '${id}';`);
  }
});

function makeKeyword(): string {
  const id = psql(
    `insert into subject_keywords (subject_id, label, normalized_label)
     values ('${SUBJECT_ID}', 'kw ${uniq()}', 'kw_${uniq()}') returning id;`
  );
  cleanupKeywordIds.push(id);
  return id;
}

/** 확정된 문제 하나 + 키워드 연결. 확정이 아니면 후보가 아니다. */
function makeProblem(
  keywordId: string,
  opts: { format?: string; difficulty?: string; confirmed?: boolean } = {}
): string {
  const format = opts.format ?? "mc";
  const difficulty = opts.difficulty ?? "medium";
  const status = opts.confirmed === false ? "draft" : "confirmed";
  const id = psql(
    `insert into problems (format, passage, difficulty, subject_id, status)
     values ('${format}', '지문 ${uniq()}', '${difficulty}', '${SUBJECT_ID}', '${status}')
     returning id;`
  );
  cleanupProblemIds.push(id);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
  return id;
}

function makeCatalogUnit(keywordIds: string[]): string {
  const unitId = psql(
    `insert into subject_template_units (subject_id, position, unit_title)
     values ('${SUBJECT_ID}', ${800 + Math.floor(Math.random() * 90)}, '기준본 ${uniq()}')
     returning id;`
  );
  cleanupUnitIds.push(unitId);
  for (const k of keywordIds) {
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${k}');`);
  }
  return unitId;
}

const problemsOf = (unitId: string) =>
  psql(
    `select coalesce(string_agg(problem_id::text || ':' || source, ',' order by position), '')
     from subject_template_unit_problems where unit_id = '${unitId}';`
  );

const countOf = (unitId: string) =>
  psql(`select count(*) from subject_template_unit_problems where unit_id = '${unitId}';`);

const setCriteria = (unitId: string, sql: string) =>
  psql(
    `insert into subject_template_unit_problem_criteria (unit_id, formats, difficulties, target_count)
     values ('${unitId}', ${sql})
     on conflict (unit_id) do update set formats = excluded.formats,
       difficulties = excluded.difficulties, target_count = excluded.target_count;`
  );

describe("관리자 기준본 문제 자동 구성", () => {
  it("키워드를 붙이면 확정된 문제가 auto 로 들어온다", () => {
    const kw = makeKeyword();
    const p1 = makeProblem(kw);
    const unitId = makeCatalogUnit([]);

    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${kw}');`);
    expect(problemsOf(unitId)).toBe(`${p1}:auto`);
  });

  it("확정되지 않은 문제는 후보가 아니다", () => {
    const kw = makeKeyword();
    makeProblem(kw, { confirmed: false });
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("0");
  });

  it("형식·난이도 조건이 후보를 좁힌다", () => {
    const kw = makeKeyword();
    const mc = makeProblem(kw, { format: "mc", difficulty: "easy" });
    makeProblem(kw, { format: "essay", difficulty: "hard" });
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("2");

    setCriteria(unitId, `array['mc'], array['easy'], null`);
    expect(problemsOf(unitId)).toBe(`${mc}:auto`);
  });

  it("개수 조건은 자동분만 제한한다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    makeProblem(kw);
    makeProblem(kw);
    const unitId = makeCatalogUnit([]);
    setCriteria(unitId, `null, null, 2`);
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${kw}');`);
    expect(countOf(unitId)).toBe("2");
  });

  it("고를 수 있는 수를 돌려준다 — 모자라도 채우지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);
    setCriteria(unitId, `null, null, 5`);

    const available = psql(`select available from sync_catalog_unit_auto_problems('${unitId}');`);
    expect(available).toBe("1");
    // 5개를 원했지만 1개뿐이다. 없는 것을 만들어 채우지 않는다.
    expect(countOf(unitId)).toBe("1");
  });
});

describe("자동 갱신이 사람 손을 덮어쓰지 않는다", () => {
  it("직접 담은 문제는 조건에 맞지 않아도 남는다", () => {
    const kw = makeKeyword();
    const essay = makeProblem(kw, { format: "essay" });
    const unitId = makeCatalogUnit([kw]);

    // 사람이 직접 담았다(기본값 manual).
    psql(
      `insert into subject_template_unit_problems (unit_id, problem_id, position)
       values ('${unitId}', '${essay}', 100) on conflict (unit_id, problem_id)
       do update set source = 'manual', position = 100;`
    );
    // 조건을 mc 로 좁힌다 — essay 는 조건에 맞지 않는다.
    setCriteria(unitId, `array['mc'], null, null`);

    expect(
      psql(
        `select source from subject_template_unit_problems
         where unit_id = '${unitId}' and problem_id = '${essay}';`
      )
    ).toBe("manual");
  });

  it("뺀 문제는 다시 들어오지 않는다", () => {
    const kw = makeKeyword();
    const p1 = makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("1");

    psql(`delete from subject_template_unit_problems where unit_id = '${unitId}' and problem_id = '${p1}';`);
    psql(
      `insert into subject_template_unit_problem_exclusions (unit_id, problem_id)
       values ('${unitId}', '${p1}');`
    );
    psql(`select sync_catalog_unit_auto_problems('${unitId}');`);

    expect(countOf(unitId)).toBe("0");
  });

  it("다시 계산해도 이미 담긴 것의 순서가 흔들리지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);

    const before = problemsOf(unitId);
    psql(`select sync_catalog_unit_auto_problems('${unitId}');`);
    psql(`select sync_catalog_unit_auto_problems('${unitId}');`);
    expect(problemsOf(unitId)).toBe(before);
  });
});

describe("최초 상속과 상위 변경 반영은 다르다", () => {
  function makeTeacherUnit(sourceUnitId: string): string {
    psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id)
       values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`
    );
    const templateId = psql(
      `select id from teacher_curriculum_templates
       where teacher_id = '${TEACHER_ID}' and subject_id = '${SUBJECT_ID}';`
    );
    const id = psql(
      `insert into teacher_curriculum_template_units (template_id, source_unit_id, position, unit_title)
       values ('${templateId}', '${sourceUnitId}', ${960 + Math.floor(Math.random() * 30)}, '선생님 ${uniq()}')
       returning id;`
    );
    cleanupTeacherUnitIds.push(id);
    return id;
  }

  it("상위 조건은 부를 때만 내려오고, 이미 정한 조건을 덮어쓰지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `array['mc'], array['easy'], 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    // 선생님이 먼저 자기 조건을 정해 뒀다.
    psql(
      `insert into teacher_curriculum_template_unit_problem_criteria (unit_id, target_count)
       values ('${teacherUnit}', 1);`
    );

    psql(`select inherit_teacher_unit_problem_defaults('${teacherUnit}');`);

    expect(
      psql(
        `select target_count from teacher_curriculum_template_unit_problem_criteria
         where unit_id = '${teacherUnit}';`
      )
    ).toBe("1");
  });

  it("조건이 없으면 상위에서 받아 온다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `null, null, 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    psql(`select inherit_teacher_unit_problem_defaults('${teacherUnit}');`);

    expect(
      psql(
        `select target_count from teacher_curriculum_template_unit_problem_criteria
         where unit_id = '${teacherUnit}';`
      )
    ).toBe("3");
  });

  it("상위가 나중에 바뀌어도 저절로 내려오지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `null, null, 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    psql(`select inherit_teacher_unit_problem_defaults('${teacherUnit}');`);

    // 관리자가 나중에 조건을 바꾼다.
    setCriteria(catalogUnit, `null, null, 9`);

    expect(
      psql(
        `select target_count from teacher_curriculum_template_unit_problem_criteria
         where unit_id = '${teacherUnit}';`
      )
    ).toBe("3");
  });
});
