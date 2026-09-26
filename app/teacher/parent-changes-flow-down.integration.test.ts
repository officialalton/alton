import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 12차 — 상위 변경이 아래까지 온전히 내려간다.
//
// 20261346000000(표식) + 20261347000000(정책). '기본 구성 업데이트' 하나가
//   뺀다 · 받는다 · 순서 · 목표 · 다시 구성
// 을 순서대로 하고, 사람이 한 일(직접 담은 것·뺀 것·바꾼 순서·고친 목표)은 이긴다.
// 자동으로는 아무것도 돌지 않는다 — 여기서 부르는 것은 전부 사람이 누른 셈이다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

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

const uniq = () => `${Date.now()}_${Math.random()}`;

const cleanupContractIds: string[] = [];
const cleanupCatalogUnitIds: string[] = [];
const cleanupTeacherUnitIds: string[] = [];
const cleanupDocIds: string[] = [];
const cleanupProblemIds: string[] = [];
const cleanupKeywordIds: string[] = [];

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
  for (const id of cleanupTeacherUnitIds.splice(0)) {
    psql(`delete from teacher_curriculum_template_units where id = '${id}';`);
  }
  for (const id of cleanupCatalogUnitIds.splice(0)) {
    psql(`delete from subject_template_units where id = '${id}';`);
  }
  for (const id of cleanupProblemIds.splice(0)) {
    psql(`delete from problems where id = '${id}';`);
  }
  for (const id of cleanupDocIds.splice(0)) {
    psql(`delete from curriculum_docs where id = '${id}';`);
  }
  for (const id of cleanupKeywordIds.splice(0)) {
    psql(`delete from subject_keywords where id = '${id}';`);
  }
});

// ---------------------------------------------------------------- 픽스처

function makeKeyword(): string {
  const id = psql(
    `insert into subject_keywords (subject_id, label, normalized_label)
     values ('${SUBJECT_ID}', 'kw ${uniq()}', 'kw_${uniq()}') returning id;`
  );
  cleanupKeywordIds.push(id);
  return id;
}

function makeDoc(title = "교재"): string {
  const id = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('${title} ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  cleanupDocIds.push(id);
  return id;
}

/** 확정 + 공개 버전이 있는 문제. 그래야 구성에 담길 수 있다. */
function makeProblem(keywordId: string): string {
  const id = psql(
    `insert into problems (format, passage, difficulty, subject_id, status)
     values ('mc', '지문 ${uniq()}', 'medium', '${SUBJECT_ID}', 'confirmed') returning id;`
  );
  cleanupProblemIds.push(id);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
  psql(
    `update problem_versions set status = 'published', published_at = now()
     where problem_id = '${id}' and version_no = 1;`
  );
  return id;
}

/**
 * 관리자 기준본 회차 하나. 키워드 둘, 교재 둘(순서 1·2), 문제 둘(순서 1·2), 목표.
 * 키워드는 교재·문제와 연결하지 않는다 — 자동 구성(auto)이 끼어들면 "내려온 것"과
 * "키워드에서 들어온 것"이 섞여 무엇이 무엇을 했는지 읽기 어렵다.
 */
function makeCatalogUnit() {
  const unitId = psql(
    `insert into subject_template_units (subject_id, position, unit_title, goal)
     values ('${SUBJECT_ID}', ${700 + Math.floor(Math.random() * 90)}, '기준본 ${uniq()}', '기준 목표')
     returning id;`
  );
  cleanupCatalogUnitIds.push(unitId);

  const keywords = [makeKeyword(), makeKeyword()];
  for (const k of keywords) {
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${k}');`);
  }
  const docs = [makeDoc("A"), makeDoc("B")];
  psql(
    `insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position) values
       ('${unitId}', '${docs[0]}', 1), ('${unitId}', '${docs[1]}', 2);`
  );
  const problemKeyword = makeKeyword();
  const problems = [makeProblem(problemKeyword), makeProblem(problemKeyword)];
  psql(
    `insert into subject_template_unit_problems (unit_id, problem_id, position) values
       ('${unitId}', '${problems[0]}', 1), ('${unitId}', '${problems[1]}', 2);`
  );
  return { unitId, keywords, docs, problems };
}

function teacherTemplateId(): string {
  psql(
    `insert into teacher_curriculum_templates (teacher_id, subject_id)
     values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`
  );
  return psql(
    `select id from teacher_curriculum_templates
     where teacher_id = '${TEACHER_ID}' and subject_id = '${SUBJECT_ID}';`
  );
}

/** 기준본에서 갈라져 나온 교사 회차. 만들어지는 순간 상속이 끝난다. */
function makeTeacherUnit(catalogUnitId: string): string {
  const id = asUser(
    TEACHER_ID,
    `insert into teacher_curriculum_template_units (template_id, source_unit_id, position, unit_title)
     values ('${teacherTemplateId()}', '${catalogUnitId}', ${600 + Math.floor(Math.random() * 90)}, '교사 회차 ${uniq()}')
     returning id;`
  );
  cleanupTeacherUnitIds.push(id);
  return id;
}

/** 교사 회차를 상위로 갖는 학생 회차(매칭 시딩과 같은 모양). */
function makeStudentUnit(teacherUnitId: string): string {
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
    `insert into curriculum_overlay_units (overlay_id, source_teacher_template_unit_id, source_kind, position, unit_title)
     values ('${overlayId}', '${teacherUnitId}', 'teacher_template', 1, '회차 ${uniq()}') returning id;`
  );
}

// ---------------------------------------------------------------- 읽기

const update = (layer: string, unitId: string) =>
  JSON.parse(asUser(TEACHER_ID, `select update_unit_composition('${layer}', '${unitId}');`));
const preview = (layer: string, unitId: string) =>
  JSON.parse(asUser(TEACHER_ID, `select preview_unit_composition_update('${layer}', '${unitId}');`));

const teacherMaterials = (u: string) =>
  psql(`select string_agg(curriculum_doc_id::text, ',' order by position)
        from teacher_curriculum_template_unit_materials where unit_id = '${u}';`);
const teacherKeywords = (u: string) =>
  psql(`select count(*) from teacher_curriculum_template_unit_keywords where unit_id = '${u}';`);
const teacherProblems = (u: string) =>
  psql(`select string_agg(problem_id::text, ',' order by position)
        from teacher_curriculum_template_unit_problems where unit_id = '${u}';`);
const teacherGoal = (u: string) =>
  psql(`select goal from teacher_curriculum_template_units where id = '${u}';`);

const studentMaterials = (u: string) =>
  psql(`select string_agg(curriculum_doc_id::text, ',' order by position)
        from curriculum_overlay_unit_materials where overlay_unit_id = '${u}';`);
const studentProblems = (u: string) =>
  psql(`select string_agg(i.content_id::text, ',' order by i.position)
        from curriculum_unit_prep_items i join curriculum_unit_preps p on p.id = i.prep_id
        where p.overlay_unit_id = '${u}' and i.content_type = 'problem';`);
const studentGoal = (u: string) =>
  psql(`select goal from curriculum_unit_preps where overlay_unit_id = '${u}';`);

const pending = (layer: string, unitId: string) =>
  psql(`select string_agg(kind || ':' || change, ',' order by kind, change)
        from unit_parent_pending_updates where layer = '${layer}' and unit_id = '${unitId}';`);

// ================================================================ 표식

describe("상속 경로는 '위에서 내려온 것' 표식을 남긴다", () => {
  it("교사 회차가 만들어질 때 내려온 행은 전부 inherited 이고 상위 순서를 기억한다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);

    expect(
      psql(`select count(*) filter (where inherited) || '/' || count(*)
            from teacher_curriculum_template_unit_materials where unit_id = '${tu}';`)
    ).toBe("2/2");
    expect(
      psql(`select string_agg(inherited_position::text, ',' order by position)
            from teacher_curriculum_template_unit_materials where unit_id = '${tu}';`)
    ).toBe("1,2");
    expect(
      psql(`select count(*) filter (where inherited) from teacher_curriculum_template_unit_keywords where unit_id = '${tu}';`)
    ).toBe("2");
    expect(
      psql(`select count(*) filter (where inherited) from teacher_curriculum_template_unit_problems where unit_id = '${tu}';`)
    ).toBe("2");
    expect(psql(`select inherited_goal from teacher_curriculum_template_units where id = '${tu}';`)).toBe("기준 목표");
  });

  it("사람이 직접 담은 행은 inherited 가 아니다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const own = makeDoc("직접");
    asUser(
      TEACHER_ID,
      `insert into teacher_curriculum_template_unit_materials (unit_id, curriculum_doc_id, position, source)
       values ('${tu}', '${own}', 3, 'manual');`
    );
    expect(
      psql(`select inherited from teacher_curriculum_template_unit_materials
            where unit_id = '${tu}' and curriculum_doc_id = '${own}';`)
    ).toBe("f");
  });

  it("학생 회차도 같다 — 준비안의 문제까지 표식과 목표 기준값을 받는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);

    expect(
      psql(`select count(*) filter (where i.inherited) || '/' || count(*)
            from curriculum_unit_prep_items i join curriculum_unit_preps p on p.id = i.prep_id
            where p.overlay_unit_id = '${su}' and i.content_type = 'problem';`)
    ).toBe("2/2");
    expect(psql(`select inherited_goal from curriculum_unit_preps where overlay_unit_id = '${su}';`)).toBe("기준 목표");
  });
});

// ================================================================ 뺀다

describe("상위에서 빠진 것은 아래에서도 빠진다 — 사람이 담은 것은 남는다", () => {
  it("기준본에서 뺀 교재·키워드·문제가 교사 회차에서 빠진다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const own = makeDoc("직접");
    asUser(
      TEACHER_ID,
      `insert into teacher_curriculum_template_unit_materials (unit_id, curriculum_doc_id, position, source)
       values ('${tu}', '${own}', 3, 'manual');`
    );

    // 관리자가 기준본에서 B 교재, 키워드 하나, 문제 하나를 뺀다.
    psql(`delete from subject_template_unit_materials where unit_id = '${cat.unitId}' and curriculum_doc_id = '${cat.docs[1]}';`);
    psql(`delete from subject_template_unit_keywords where unit_id = '${cat.unitId}' and keyword_id = '${cat.keywords[1]}';`);
    psql(`delete from subject_template_unit_problems where unit_id = '${cat.unitId}' and problem_id = '${cat.problems[1]}';`);

    // 누르기 전에는 아무것도 변하지 않는다 — 화면에 '업데이트 있음'만 뜬다.
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${cat.docs[1]},${own}`);
    expect(pending("teacher", tu)).toBe("keyword:remove,material:remove,problem:remove");

    const r = update("teacher", tu);
    expect(r.withdrawnMaterials).toBe(1);
    expect(r.withdrawnKeywords).toBe(1);
    expect(r.withdrawnProblems).toBe(1);

    // 내려온 B는 빠졌고, 직접 담은 것은 남았다.
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${own}`);
    expect(teacherKeywords(tu)).toBe("1");
    expect(teacherProblems(tu)).toBe(cat.problems[0]);
    expect(pending("teacher", tu)).toBe("");
  });

  it("사람이 직접 담은 것과 같은 것을 상위가 뺐어도 남는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    // 선생님이 내려온 B를 뺀 뒤 스스로 다시 담았다(inherited=false 로 새로 들어간다).
    asUser(TEACHER_ID, `delete from teacher_curriculum_template_unit_materials where unit_id = '${tu}' and curriculum_doc_id = '${cat.docs[1]}';`);
    asUser(
      TEACHER_ID,
      `insert into teacher_curriculum_template_unit_materials (unit_id, curriculum_doc_id, position, source)
       values ('${tu}', '${cat.docs[1]}', 2, 'manual');`
    );
    psql(`delete from subject_template_unit_materials where unit_id = '${cat.unitId}' and curriculum_doc_id = '${cat.docs[1]}';`);

    const r = update("teacher", tu);
    expect(r.withdrawnMaterials).toBe(0);
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${cat.docs[1]}`);
  });

  it("뺐다가 상위가 다시 담으면 다시 내려온다 — 제외 기록을 남기지 않기 때문이다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    psql(`delete from subject_template_unit_materials where unit_id = '${cat.unitId}' and curriculum_doc_id = '${cat.docs[1]}';`);
    update("teacher", tu);
    expect(teacherMaterials(tu)).toBe(cat.docs[0]);

    psql(`insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position) values ('${cat.unitId}', '${cat.docs[1]}', 2);`);
    const r = update("teacher", tu);
    expect(r.inheritedMaterials).toBe(1);
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${cat.docs[1]}`);
  });

  it("사람이 뺀 것(제외 기록)은 상위에 있어도 되살리지 않는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    asUser(TEACHER_ID, `delete from teacher_curriculum_template_unit_problems where unit_id = '${tu}' and problem_id = '${cat.problems[0]}';`);
    asUser(TEACHER_ID, `insert into teacher_curriculum_template_unit_problem_exclusions (unit_id, problem_id) values ('${tu}', '${cat.problems[0]}');`);

    expect(pending("teacher", tu)).toBe("");
    const r = update("teacher", tu);
    expect(r.inheritedProblems).toBe(0);
    expect(teacherProblems(tu)).toBe(cat.problems[1]);
  });
});

// ================================================================ 순서

describe("상위 순서를 따라간다 — 사람이 순서를 바꾼 적이 없을 때만", () => {
  it("관리자가 순서를 바꾸면 손대지 않은 교사 회차가 따라간다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${cat.docs[1]}`);

    psql(`update subject_template_unit_materials set position = case curriculum_doc_id when '${cat.docs[0]}' then 2 else 1 end where unit_id = '${cat.unitId}';`);
    psql(`update subject_template_unit_problems set position = case problem_id when '${cat.problems[0]}' then 2 else 1 end where unit_id = '${cat.unitId}';`);

    const r = update("teacher", tu);
    expect(r.reordered).toBe(4);
    expect(r.orderKeptByChoice).toBe(0);
    expect(teacherMaterials(tu)).toBe(`${cat.docs[1]},${cat.docs[0]}`);
    expect(teacherProblems(tu)).toBe(`${cat.problems[1]},${cat.problems[0]}`);
  });

  it("교사가 순서를 바꿔 두었으면 그대로 두고 숫자로만 알린다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    // 교사가 교재 순서를 뒤집었다.
    asUser(TEACHER_ID, `update teacher_curriculum_template_unit_materials set position = case curriculum_doc_id when '${cat.docs[0]}' then 2 else 1 end where unit_id = '${tu}';`);
    // 관리자도 (다른 이유로) 뒤집었다. 결과가 우연히 같더라도 사람의 손길은 그대로다.
    psql(`update subject_template_unit_materials set position = case curriculum_doc_id when '${cat.docs[0]}' then 2 else 1 end where unit_id = '${cat.unitId}';`);

    const r = update("teacher", tu);
    expect(r.orderKeptByChoice).toBe(1);
    expect(teacherMaterials(tu)).toBe(`${cat.docs[1]},${cat.docs[0]}`);
    // 문제는 손대지 않았으니 (상위도 그대로라) 움직일 것이 없다.
    expect(teacherProblems(tu)).toBe(`${cat.problems[0]},${cat.problems[1]}`);
  });

  it("직접 담은 것은 자리를 잃지 않는다 — 내려온 것들이 차지한 자리 안에서만 바뀐다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const own = makeDoc("직접");
    // 직접 담은 것을 맨 앞(0)에 끼웠다. 내려온 둘은 1·2.
    asUser(
      TEACHER_ID,
      `insert into teacher_curriculum_template_unit_materials (unit_id, curriculum_doc_id, position, source)
       values ('${tu}', '${own}', 0, 'manual');`
    );
    psql(`update subject_template_unit_materials set position = case curriculum_doc_id when '${cat.docs[0]}' then 2 else 1 end where unit_id = '${cat.unitId}';`);

    update("teacher", tu);
    expect(teacherMaterials(tu)).toBe(`${own},${cat.docs[1]},${cat.docs[0]}`);
  });
});

// ================================================================ 목표

describe("목표는 아무도 손대지 않았을 때만 상위를 따라간다", () => {
  it("관리자가 목표를 고치면 손대지 않은 교사 회차가 따라간다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    expect(teacherGoal(tu)).toBe("기준 목표");

    psql(`update subject_template_units set goal = '바뀐 목표' where id = '${cat.unitId}';`);
    const r = update("teacher", tu);
    expect(r.goalUpdated).toBe(1);
    expect(teacherGoal(tu)).toBe("바뀐 목표");
    // 두 번째 업데이트에서는 더 바꿀 것이 없다 — 기준값도 함께 올라갔다.
    expect(update("teacher", tu).goalUpdated).toBe(0);
  });

  it("교사가 고친 목표는 그대로 두고 숫자로만 알린다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    asUser(TEACHER_ID, `update teacher_curriculum_template_units set goal = '내 목표' where id = '${tu}';`);
    psql(`update subject_template_units set goal = '바뀐 목표' where id = '${cat.unitId}';`);

    const r = update("teacher", tu);
    expect(r.goalUpdated).toBe(0);
    expect(r.goalKeptByChoice).toBe(1);
    expect(teacherGoal(tu)).toBe("내 목표");
  });

  it("일부러 비운 목표(빈 문자열)도 사람의 선택이다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    asUser(TEACHER_ID, `update teacher_curriculum_template_units set goal = '' where id = '${tu}';`);
    psql(`update subject_template_units set goal = '바뀐 목표' where id = '${cat.unitId}';`);

    const r = update("teacher", tu);
    expect(r.goalUpdated).toBe(0);
    expect(teacherGoal(tu)).toBe("");
  });

  it("상위 목표가 비면 아래 목표를 지우지 않는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    psql(`update subject_template_units set goal = null where id = '${cat.unitId}';`);
    update("teacher", tu);
    expect(teacherGoal(tu)).toBe("기준 목표");
  });
});

// ================================================================ 학생 층

describe("학생 회차는 교사 회차의 변경을 같은 규칙으로 받는다", () => {
  it("교사 기본 구성에서 뺀 문제·교재가 학생 준비안에서도 빠진다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);
    expect(studentProblems(su)).toBe(`${cat.problems[0]},${cat.problems[1]}`);

    asUser(TEACHER_ID, `delete from teacher_curriculum_template_unit_problems where unit_id = '${tu}' and problem_id = '${cat.problems[1]}';`);
    asUser(TEACHER_ID, `delete from teacher_curriculum_template_unit_materials where unit_id = '${tu}' and curriculum_doc_id = '${cat.docs[0]}';`);

    expect(pending("student", su)).toBe("material:remove,problem:remove");
    const r = update("student", su);
    expect(r.withdrawnProblems).toBe(1);
    expect(r.withdrawnMaterials).toBe(1);
    expect(studentProblems(su)).toBe(cat.problems[0]);
    expect(studentMaterials(su)).toBe(cat.docs[1]);
  });

  it("학생 층에서 뺀 문제는 제외 기록으로 남아 되살아나지 않는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);

    asUser(
      TEACHER_ID,
      `delete from curriculum_unit_prep_items where content_type = 'problem' and content_id = '${cat.problems[0]}'
         and prep_id in (select id from curriculum_unit_preps where overlay_unit_id = '${su}');
       insert into curriculum_overlay_unit_problem_exclusions (overlay_unit_id, problem_id) values ('${su}', '${cat.problems[0]}');`
    );

    expect(pending("student", su)).toBe("");
    const r = update("student", su);
    expect(r.inheritedProblems).toBe(0);
    expect(studentProblems(su)).toBe(cat.problems[1]);
  });

  it("교사가 순서와 목표를 바꾸면 손대지 않은 학생 회차가 따라간다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);

    asUser(TEACHER_ID, `update teacher_curriculum_template_unit_problems set position = case problem_id when '${cat.problems[0]}' then 2 else 1 end where unit_id = '${tu}';`);
    asUser(TEACHER_ID, `update teacher_curriculum_template_units set goal = '교사 목표' where id = '${tu}';`);

    const r = update("student", su);
    expect(r.reordered).toBe(2);
    expect(r.goalUpdated).toBe(1);
    expect(studentProblems(su)).toBe(`${cat.problems[1]},${cat.problems[0]}`);
    expect(studentGoal(su)).toBe("교사 목표");
  });

  it("교사 기본 구성에 새로 담은 것은 '업데이트 있음'으로 보이고 받아온다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);
    const extra = makeDoc("추가");
    asUser(
      TEACHER_ID,
      `insert into teacher_curriculum_template_unit_materials (unit_id, curriculum_doc_id, position, source)
       values ('${tu}', '${extra}', 3, 'manual');`
    );
    expect(pending("student", su)).toBe("material:add");
    const r = update("student", su);
    expect(r.inheritedMaterials).toBe(1);
    expect(studentMaterials(su)).toBe(`${cat.docs[0]},${cat.docs[1]},${extra}`);
    expect(pending("student", su)).toBe("");
  });
});

// ================================================================ 미리보기

describe("미리보기는 같은 것을 보여주되 아무것도 바꾸지 않는다", () => {
  it("빠질 것·바뀔 순서·목표를 미리 보여주고, 취소하면 그대로다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    psql(`delete from subject_template_unit_materials where unit_id = '${cat.unitId}' and curriculum_doc_id = '${cat.docs[1]}';`);
    psql(`update subject_template_units set goal = '바뀐 목표' where id = '${cat.unitId}';`);

    const p = preview("teacher", tu);
    expect(p.preview).toBe(true);
    expect(p.withdrawnMaterials).toBe(1);
    expect(p.goalUpdated).toBe(1);

    // 아무것도 바뀌지 않았다.
    expect(teacherMaterials(tu)).toBe(`${cat.docs[0]},${cat.docs[1]}`);
    expect(teacherGoal(tu)).toBe("기준 목표");

    // 적용하면 미리 본 그대로다.
    const r = JSON.parse(
      asUser(TEACHER_ID, `select apply_unit_composition_update('teacher', '${tu}', '${p.fingerprint}');`)
    );
    expect(r.withdrawnMaterials).toBe(1);
    expect(teacherMaterials(tu)).toBe(cat.docs[0]);
    expect(teacherGoal(tu)).toBe("바뀐 목표");
  });
});

// 2026-09-14 Preview 재현 — 관리자 기준본 층에서 업데이트가 "record is not assigned yet" 로 깨졌다.
describe("관리자 기준본 층의 업데이트", () => {
  it("상위가 없어도 미리보기·적용이 돌고, 키워드 기본 교재가 들어온다", () => {
    const cat = makeCatalogUnit();
    const kw = makeKeyword();
    const doc = makeDoc("키워드 기본");
    psql(`update curriculum_docs set primary_keyword_id = '${kw}', primary_keyword_position = 1 where id = '${doc}';`);
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${cat.unitId}', '${kw}');`);

    const admin = "aaaaaaaa-0000-0000-0000-000000000001";
    const p = JSON.parse(asUser(admin, `select preview_unit_composition_update('catalog', '${cat.unitId}');`));
    expect(p.materialsAdded).toBe(1);
    expect(p.inheritedMaterials).toBe(0);
    const r = JSON.parse(asUser(admin, `select apply_unit_composition_update('catalog', '${cat.unitId}', '${p.fingerprint}');`));
    expect(r.materialsAdded).toBe(1);
    expect(
      psql(`select source from subject_template_unit_materials where unit_id = '${cat.unitId}' and curriculum_doc_id = '${doc}';`)
    ).toBe("auto");
  });
});

// 2026-09-14 Preview 재현 — 회차가 없는 교사 템플릿으로 매칭되면 학생 커리큘럼이 비었다.
describe("매칭 시딩 — 교사 템플릿이 비어 있으면 기준본에서 온다", () => {
  it("빈 템플릿이면 기준본 회차를 복사하고, 회차가 있는 템플릿이면 그것을 쓴다", () => {
    const cat = makeCatalogUnit();
    // 이 과목의 기준본 회차가 하나 이상 있다(위에서 만든 것 포함).
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
    // 회차가 하나도 없는 교사 템플릿 — 이 테스트의 교사 회차는 만들지 않는다.
    const templateId = teacherTemplateId();
    psql(`delete from teacher_curriculum_template_units where template_id = '${templateId}';`);

    psql(`select seed_curriculum_overlay_for_match('${enrollmentId}', '${TEACHER_ID}', '${SUBJECT_ID}');`);
    const count = psql(
      `select count(*) from curriculum_overlay_units u join student_curriculum_overlays o on o.id = u.overlay_id
       where o.subject_enrollment_id = '${enrollmentId}';`
    );
    expect(Number(count)).toBeGreaterThan(0);
    expect(
      psql(`select count(*) from curriculum_overlay_units u join student_curriculum_overlays o on o.id = u.overlay_id
            where o.subject_enrollment_id = '${enrollmentId}' and u.source_unit_id = '${cat.unitId}';`)
    ).toBe("1");
  });

  it("교사 회차가 기준본에서 갈라질 때 교재는 inherited 로 남는다(키워드보다 먼저 복사)", () => {
    const cat = makeCatalogUnit();
    const kw = makeKeyword();
    const doc = makeDoc("키워드 기본");
    psql(`update curriculum_docs set primary_keyword_id = '${kw}', primary_keyword_position = 1 where id = '${doc}';`);
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${cat.unitId}', '${kw}');`);
    psql(`select update_unit_composition('catalog', '${cat.unitId}');`); // PDF/키워드 교재가 auto 로 들어온다
    const tu = makeTeacherUnit(cat.unitId);
    expect(
      psql(`select inherited from teacher_curriculum_template_unit_materials where unit_id = '${tu}' and curriculum_doc_id = '${doc}';`)
    ).toBe("t");
  });
});

// 2026-09-14 Preview 재현 — 기준본에 보관 교재가 담겨 있으면 학생 회차 생성이 통째로 실패했다.
describe("상속은 보관된 교재를 건너뛴다", () => {
  it("보관 교재가 담긴 기준본에서도 학생 회차·교사 회차가 만들어지고, 보관 교재만 빠진다", () => {
    const cat = makeCatalogUnit();
    psql(`update curriculum_docs set archived_at = now(), archived_reason = '검증' where id = '${cat.docs[1]}';`);

    const tu = makeTeacherUnit(cat.unitId);
    expect(teacherMaterials(tu)).toBe(cat.docs[0]);

    const su = makeStudentUnit(tu);
    expect(studentMaterials(su)).toBe(cat.docs[0]);
  });
});

// 2026-09-14 성능 — '업데이트 있음' 계산을 회차 하나짜리 정의자 함수로.
describe("unit_composition_counts", () => {
  it("담당 선생님은 자기 학생 회차의 어긋난 항목 수를 받고, 남은 0/0 을 받는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    const su = makeStudentUnit(tu);
    // 교사 기본 구성에서 교재 하나를 빼면 학생 회차에 '빠질 것' 1개
    asUser(TEACHER_ID, `delete from teacher_curriculum_template_unit_materials where unit_id = '${tu}' and curriculum_doc_id = '${cat.docs[0]}';`);

    expect(
      asUser(TEACHER_ID, `select drift_count || '/' || parent_pending_count from unit_composition_counts('student', '${su}');`)
    ).toBe("0/1");
    expect(
      asUser(OTHER_TEACHER_ID, `select drift_count || '/' || parent_pending_count from unit_composition_counts('student', '${su}');`)
    ).toBe("0/0");
    // 뷰를 직접 센 값과 같다(관리자 권한으로 대조).
    expect(
      asUser("aaaaaaaa-0000-0000-0000-000000000001", `select count(*) from unit_parent_pending_updates where layer = 'student' and unit_id = '${su}';`)
    ).toBe("1");
  });

  it("교사 층은 템플릿 주인만, 기준본 층은 선생님이면 읽는다", () => {
    const cat = makeCatalogUnit();
    const tu = makeTeacherUnit(cat.unitId);
    expect(asUser(TEACHER_ID, `select parent_pending_count from unit_composition_counts('teacher', '${tu}');`)).toBe("0");
    expect(asUser(OTHER_TEACHER_ID, `select drift_count || '/' || parent_pending_count from unit_composition_counts('teacher', '${tu}');`)).toBe("0/0");
    expect(asUser(TEACHER_ID, `select drift_count || '/' || parent_pending_count from unit_composition_counts('catalog', '${cat.unitId}');`)).toBe("0/0");
  });
});
