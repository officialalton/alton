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

/**
 * 후보가 되려면 세 가지가 모두 맞아야 한다:
 * 확정(problems.status) · 미보관 · **공개된 버전이 있음**(problem_versions).
 * 검수 중이거나 AI가 만든 초안은 사람이 공개를 누르기 전까지 들어오지 않는다.
 */
function makeProblem(
  keywordId: string,
  opts: {
    format?: string;
    difficulty?: string;
    confirmed?: boolean;
    /** 공개된 버전을 만들지 않는다 — 검수 중이거나 초안인 문제. */
    unpublished?: boolean;
  } = {}
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
  // 문제를 만들면 1번 버전이 자동으로 생긴다(초안). 공개 상태만 바꾼다 —
  // 새 버전을 끼워 넣으면 "문제당 공개본 하나" 규칙과 부딪힌다.
  psql(
    `update problem_versions
     set status = '${opts.unpublished ? "in_review" : "published"}',
         published_at = ${opts.unpublished ? "null" : "now()"}
     where problem_id = '${id}' and version_no = 1;`
  );
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

  it("공개된 버전이 없으면 후보가 아니다 — 검수 중·AI 초안은 들어오지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw, { unpublished: true });
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("0");
  });

  it("형식·난이도 조건이 후보를 좁힌다", () => {
    const kw = makeKeyword();
    const mc = makeProblem(kw, { format: "mc", difficulty: "easy" });
    makeProblem(kw, { format: "essay", difficulty: "hard" });
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("2");

    // 2026-09-13 확정(A안): 조건을 바꿔도 자동으로 다시 뽑지 않는다. 다시 구성할 때다.
    setCriteria(unitId, `array['mc'], array['easy'], null`);
    expect(countOf(unitId)).toBe("2");
    psql(`select recompose_unit('catalog', '${unitId}');`);
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
    psql(`select recompose_unit('catalog', '${unitId}');`);
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

  const teacherTarget = (unitId: string) =>
    psql(
      `select coalesce(target_count::text, '(없음)') from
       teacher_curriculum_template_unit_problem_criteria where unit_id = '${unitId}';`
    );

  // 확정 정책: 최초 상속은 **자동**이다. 회차가 만들어지는 순간 위층 조건이 내려온다.
  it("회차를 만들면 상위 조건이 자동으로 내려온다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `null, null, 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    expect(teacherTarget(teacherUnit)).toBe("3");
  });

  it("선생님이 고친 조건을 수동 보정이 덮어쓰지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `null, null, 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    // 선생님이 자기 값으로 고쳤다.
    psql(
      `update teacher_curriculum_template_unit_problem_criteria
       set target_count = 1 where unit_id = '${teacherUnit}';`
    );

    psql(`select inherit_teacher_unit_problem_defaults('${teacherUnit}');`);
    expect(teacherTarget(teacherUnit)).toBe("1");
  });

  it("상위가 나중에 바뀌어도 저절로 내려오지 않는다", () => {
    const kw = makeKeyword();
    makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    setCriteria(catalogUnit, `null, null, 3`);

    const teacherUnit = makeTeacherUnit(catalogUnit);
    expect(teacherTarget(teacherUnit)).toBe("3");

    // 관리자가 나중에 조건을 바꾼다 — 하위 조정을 덮어쓰지 않으려면 내려가면 안 된다.
    setCriteria(catalogUnit, `null, null, 9`);
    expect(teacherTarget(teacherUnit)).toBe("3");
  });
});

// 지시 2번 — 후보 목록을 좁히는 것만으로는 부족하다. 화면을 거치지 않고 문제 id 를
// 직접 넣는 경로가 있으므로 **쓰기 시점에** 거부해야 한다. 경로마다 막으면 새 경로가
// 생길 때 또 빠지므로 테이블에 건다.
describe("사용할 수 없는 문제는 쓰기에서 거부한다", () => {
  const rejects = (sql: string) => {
    expect(() => psql(sql)).toThrow();
  };

  it("공개된 버전이 없는 문제는 담기지 않는다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw, { unpublished: true });
    const unitId = makeCatalogUnit([]);
    rejects(
      `insert into subject_template_unit_problems (unit_id, problem_id, position)
       values ('${unitId}', '${p}', 1);`
    );
  });

  it("확정되지 않은 문제는 담기지 않는다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw, { confirmed: false });
    const unitId = makeCatalogUnit([]);
    rejects(
      `insert into subject_template_unit_problems (unit_id, problem_id, position)
       values ('${unitId}', '${p}', 1);`
    );
  });

  it("보관된 문제는 새로 담기지 않는다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    psql(`update problems set archived_at = now() where id = '${p}';`);
    const unitId = makeCatalogUnit([]);
    rejects(
      `insert into subject_template_unit_problems (unit_id, problem_id, position)
       values ('${unitId}', '${p}', 1);`
    );
  });

  it("선생님 층에서도 같게 막는다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw, { unpublished: true });
    const admin = makeCatalogUnit([]);
    psql(
      `insert into teacher_curriculum_templates (teacher_id, subject_id)
       values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`
    );
    const templateId = psql(
      `select id from teacher_curriculum_templates
       where teacher_id = '${TEACHER_ID}' and subject_id = '${SUBJECT_ID}';`
    );
    const unitId = psql(
      `insert into teacher_curriculum_template_units (template_id, source_unit_id, position, unit_title)
       values ('${templateId}', '${admin}', ${940 + Math.floor(Math.random() * 20)}, '선생님 ${uniq()}')
       returning id;`
    );
    cleanupTeacherUnitIds.push(unitId);
    rejects(
      `insert into teacher_curriculum_template_unit_problems (unit_id, problem_id, position)
       values ('${unitId}', '${p}', 1);`
    );
  });

  it("이미 담긴 문제는 나중에 보관돼도 빠지지 않는다", () => {
    // 가드는 **새로 담는 것**만 본다. 과거 구성이 보관 때문에 사라지면 안 된다.
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("1");

    psql(`update problems set archived_at = now() where id = '${p}';`);
    expect(countOf(unitId)).toBe("1");
  });
});

// 지시 3번 — 새로 담는 검증과 이미 담긴 항목을 정리하는 동작은 다르다. 이미 담긴
// 문제가 나중에 비공개·보관이 됐을 때 정렬·제외까지 막히면 시작 차단을 해소할 길이
// 없어진다.
describe("이미 담긴 항목의 정리는 막지 않는다", () => {
  function attachedThenUnusable(): { unitId: string; problemId: string } {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);
    expect(countOf(unitId)).toBe("1");
    // 담긴 뒤에 보관됐다.
    psql(`update problems set archived_at = now() where id = '${p}';`);
    return { unitId, problemId: p };
  }

  it("보관된 뒤에도 순서를 바꿀 수 있다", () => {
    const { unitId, problemId } = attachedThenUnusable();
    expect(() =>
      psql(
        `update subject_template_unit_problems set position = 99
         where unit_id = '${unitId}' and problem_id = '${problemId}';`
      )
    ).not.toThrow();
  });

  it("보관된 뒤에도 뺄 수 있다", () => {
    const { unitId, problemId } = attachedThenUnusable();
    expect(() =>
      psql(
        `delete from subject_template_unit_problems
         where unit_id = '${unitId}' and problem_id = '${problemId}';`
      )
    ).not.toThrow();
    expect(countOf(unitId)).toBe("0");
  });

  it("보관된 뒤에도 제외 기록을 남길 수 있다", () => {
    const { unitId, problemId } = attachedThenUnusable();
    expect(() =>
      psql(
        `insert into subject_template_unit_problem_exclusions (unit_id, problem_id)
         values ('${unitId}', '${problemId}');`
      )
    ).not.toThrow();
  });

  it("다른 문제로 바꾸는 것은 여전히 검증한다", () => {
    const { unitId, problemId } = attachedThenUnusable();
    const kw2 = makeKeyword();
    const unusable = makeProblem(kw2, { unpublished: true });
    // 교체는 "새로 담기"다 — 사용할 수 없는 문제로는 바꿀 수 없다.
    expect(() =>
      psql(
        `update subject_template_unit_problems set problem_id = '${unusable}'
         where unit_id = '${unitId}' and problem_id = '${problemId}';`
      )
    ).toThrow();
  });
});

// 지시 2·3번 — 준비안은 "무엇을"뿐 아니라 "어떤 버전을" 쓸지까지 저장한다. 상속은
// 조건만 내려보내 다시 뽑는 것이 아니라 실제 선택 결과·버전·출처·제외·순서를
// 그대로 이어받는다.
describe("준비안이 버전을 못 박고, 상속이 그대로 이어받는다", () => {
  const versionOf = (unitId: string, problemId: string) =>
    psql(
      `select coalesce(problem_version_id::text, '(없음)')
       from subject_template_unit_problems
       where unit_id = '${unitId}' and problem_id = '${problemId}';`
    );

  const publishedVersionOf = (problemId: string) =>
    psql(`select published_version_id from problems where id = '${problemId}';`);

  it("담는 순간의 공개 버전이 박힌다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);

    expect(versionOf(unitId, p)).toBe(publishedVersionOf(p));
  });

  it("나중에 새 버전이 공개돼도 준비안의 버전은 그대로다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const unitId = makeCatalogUnit([kw]);
    const before = versionOf(unitId, p);

    // 새 버전을 공개한다 — 이전 공개본은 물러난다.
    psql(`update problem_versions set status = 'archived' where problem_id = '${p}';`);
    psql(
      `insert into problem_versions (problem_id, version_no, passage, status, published_at)
       values ('${p}', 2, '고친 본문 ${uniq()}', 'published', now());`
    );
    psql(
      `update problems set published_version_id =
         (select id from problem_versions where problem_id = '${p}' and version_no = 2)
       where id = '${p}';`
    );

    expect(versionOf(unitId, p)).toBe(before);
    expect(versionOf(unitId, p)).not.toBe(publishedVersionOf(p));
  });

  it("상속은 상위가 쓰던 버전을 그대로 물려준다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);
    const catalogVersion = versionOf(catalogUnit, p);

    // 상위가 담은 뒤에 새 버전이 공개됐다.
    psql(`update problem_versions set status = 'archived' where problem_id = '${p}';`);
    psql(
      `insert into problem_versions (problem_id, version_no, passage, status, published_at)
       values ('${p}', 2, '새 본문 ${uniq()}', 'published', now());`
    );
    psql(
      `update problems set published_version_id =
         (select id from problem_versions where problem_id = '${p}' and version_no = 2)
       where id = '${p}';`
    );

    const teacherUnit = makeTeacherUnitFor(catalogUnit);
    // 하위가 최신본을 새로 집으면 상위와 다른 내용으로 시작하게 된다.
    expect(
      psql(
        `select coalesce(problem_version_id::text, '(없음)')
         from teacher_curriculum_template_unit_problems
         where unit_id = '${teacherUnit}' and problem_id = '${p}';`
      )
    ).toBe(catalogVersion);
  });

  it("상위에서 뺀 문제는 하위에서 되살아나지 않는다", () => {
    const kw = makeKeyword();
    const p = makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);

    // 상위에서 뺀다(제외 기록 포함).
    psql(`delete from subject_template_unit_problems where unit_id = '${catalogUnit}';`);
    psql(
      `insert into subject_template_unit_problem_exclusions (unit_id, problem_id)
       values ('${catalogUnit}', '${p}');`
    );

    const teacherUnit = makeTeacherUnitFor(catalogUnit);
    expect(
      psql(
        `select count(*) from teacher_curriculum_template_unit_problems where unit_id = '${teacherUnit}';`
      )
    ).toBe("0");
  });

  it("상위의 순서와 출처 구분이 그대로 이어진다", () => {
    const kw = makeKeyword();
    const a = makeProblem(kw);
    const b = makeProblem(kw);
    const catalogUnit = makeCatalogUnit([kw]);

    // 상위에서 순서를 뒤집고 하나를 직접 담은 것으로 바꿔 둔다.
    psql(
      `update subject_template_unit_problems set position = 50, source = 'manual'
       where unit_id = '${catalogUnit}' and problem_id = '${a}';`
    );
    psql(
      `update subject_template_unit_problems set position = 10
       where unit_id = '${catalogUnit}' and problem_id = '${b}';`
    );

    const teacherUnit = makeTeacherUnitFor(catalogUnit);
    expect(
      psql(
        `select string_agg(problem_id::text || ':' || source, ',' order by position)
         from teacher_curriculum_template_unit_problems where unit_id = '${teacherUnit}';`
      )
    ).toBe(`${b}:auto,${a}:manual`);
  });

  function makeTeacherUnitFor(sourceUnitId: string): string {
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
       values ('${templateId}', '${sourceUnitId}', ${900 + Math.floor(Math.random() * 30)}, '선생님 ${uniq()}')
       returning id;`
    );
    cleanupTeacherUnitIds.push(id);
    return id;
  }
});
