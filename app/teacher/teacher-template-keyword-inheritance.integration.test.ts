import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 3차 — 관리자 기준본 → 선생님 기본 템플릿 → 학생별 운영본의 세 계층 상속.
//
// 이 파일이 지키는 것:
//   - 초기 상속은 자동, 보정은 수동
//   - 자동 갱신이 사람 손을 덮어쓰지 않는다 (선생님이 뺀 키워드는 되살아나지 않는다)
//   - 선생님 층에 연결된 회차가 없으면 종전대로 관리자 기준본에서 내려받는다

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

const uniq = () => `${Date.now()}_${Math.random()}`;

const cleanupKeywordIds: string[] = [];
const cleanupAdminUnitIds: string[] = [];
const cleanupTeacherUnitIds: string[] = [];
const cleanupContractIds: string[] = [];

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from curriculum_overlay_unit_keywords where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments se on se.id = o.subject_enrollment_id
        where se.contract_id = '${id}');
      delete from curriculum_overlay_unit_materials where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments se on se.id = o.subject_enrollment_id
        where se.contract_id = '${id}');
      delete from curriculum_overlay_units where overlay_id in (
        select o.id from student_curriculum_overlays o
        join subject_enrollments se on se.id = o.subject_enrollment_id
        where se.contract_id = '${id}');
      delete from student_curriculum_overlays where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
  for (const id of cleanupTeacherUnitIds.splice(0)) {
    psql(`delete from teacher_curriculum_template_units where id = '${id}';`);
  }
  for (const id of cleanupAdminUnitIds.splice(0)) {
    psql(`delete from subject_template_units where id = '${id}';`);
  }
  for (const id of cleanupKeywordIds.splice(0)) {
    psql(`delete from subject_keywords where id = '${id}';`);
  }
});

/** 이 과목에 새 키워드 하나. */
function makeKeyword(): string {
  const id = psql(
    `insert into subject_keywords (subject_id, label, normalized_label)
     values ('${SUBJECT_ID}', 'kw ${uniq()}', 'kw_${uniq()}') returning id;`
  );
  cleanupKeywordIds.push(id);
  return id;
}

/** 관리자 기준본 회차 하나 + 붙일 키워드들. */
function makeAdminUnit(keywordIds: string[]): { unitId: string; position: number } {
  const position = 900 + Math.floor(Math.random() * 90);
  const unitId = psql(
    `insert into subject_template_units (subject_id, position, unit_title)
     values ('${SUBJECT_ID}', ${position}, '기준본 회차 ${uniq()}') returning id;`
  );
  cleanupAdminUnitIds.push(unitId);
  for (const kid of keywordIds) {
    psql(
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${kid}');`
    );
  }
  return { unitId, position };
}

/**
 * 이 선생님·과목의 기본 템플릿. (teacher_id, subject_id)에 unique가 걸려 있어
 * 하나뿐이므로 이미 있으면 그것을 쓴다 — 템플릿 자체는 지우지 않고, 이 테스트가
 * 만든 회차만 정리한다.
 */
function makeTeacherTemplate(): string {
  psql(
    `insert into teacher_curriculum_templates (teacher_id, subject_id)
     values ('${TEACHER_ID}', '${SUBJECT_ID}') on conflict (teacher_id, subject_id) do nothing;`
  );
  return psql(
    `select id from teacher_curriculum_templates
     where teacher_id = '${TEACHER_ID}' and subject_id = '${SUBJECT_ID}';`
  );
}

function makeTeacherUnit(templateId: string, sourceUnitId: string | null, position: number): string {
  const id = psql(
    `insert into teacher_curriculum_template_units (template_id, source_unit_id, position, unit_title)
     values ('${templateId}', ${sourceUnitId ? `'${sourceUnitId}'` : "null"}, ${position}, '선생님 회차 ${uniq()}')
     returning id;`
  );
  cleanupTeacherUnitIds.push(id);
  return id;
}

function teacherKeywordIds(unitId: string): string[] {
  const out = psql(
    `select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = '${unitId}' order by keyword_id;`
  );
  return out ? out.split("\n") : [];
}

function overlayKeywordIds(overlayUnitId: string): string[] {
  const out = psql(
    `select keyword_id from curriculum_overlay_unit_keywords where overlay_unit_id = '${overlayUnitId}' order by keyword_id;`
  );
  return out ? out.split("\n") : [];
}

/** 이 선생님이 맡은 학생 과목 수강 하나 + 활성 오버레이. */
function makeEnrollmentWithOverlay(): { enrollmentId: string; overlayId: string } {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status)
     values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
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
  const overlayId = psql(
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  return { enrollmentId, overlayId };
}

function makeOverlayUnit(overlayId: string, sourceUnitId: string, position: number): string {
  return psql(
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${sourceUnitId}', ${position}, '학생 회차 ${uniq()}') returning id;`
  );
}

describe("선생님 기본 템플릿의 키워드 상속", () => {
  it("회차를 만들면 관리자 기준본의 키워드가 자동으로 내려온다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const admin = makeAdminUnit([kwA, kwB]);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, admin.unitId, admin.position);

    expect(teacherKeywordIds(teacherUnitId).sort()).toEqual([kwA, kwB].sort());
  });

  it("기준본과 연결되지 않은 보충 회차는 아무것도 물려받지 않는다", () => {
    const kwA = makeKeyword();
    makeAdminUnit([kwA]);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, null, 995);

    expect(teacherKeywordIds(teacherUnitId)).toEqual([]);
  });

  it("선생님이 뺀 키워드를 자동 상속이 되살리지 않는다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const admin = makeAdminUnit([kwA, kwB]);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, admin.unitId, admin.position);

    // 선생님이 B를 뺀다.
    psql(
      `delete from teacher_curriculum_template_unit_keywords
       where unit_id = '${teacherUnitId}' and keyword_id = '${kwB}';`
    );
    // 회차 제목을 고쳐도(=UPDATE) 상속이 다시 돌지 않는다 — 트리거는 INSERT에서만 돈다.
    psql(
      `update teacher_curriculum_template_units set unit_title = '고친 제목' where id = '${teacherUnitId}';`
    );

    expect(teacherKeywordIds(teacherUnitId)).toEqual([kwA]);
  });

  it("보정은 수동으로 부를 때만 채우고, 이미 있는 것은 건드리지 않는다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const admin = makeAdminUnit([kwA, kwB]);

    const templateId = makeTeacherTemplate();
    // 연결은 나중에 붙인 상황 — 만들 때는 연결이 없어 상속이 돌지 않았다.
    const teacherUnitId = makeTeacherUnit(templateId, null, 996);
    psql(
      `update teacher_curriculum_template_units set source_unit_id = '${admin.unitId}' where id = '${teacherUnitId}';`
    );
    expect(teacherKeywordIds(teacherUnitId)).toEqual([]);

    psql(`select inherit_teacher_unit_defaults_from_template('${teacherUnitId}');`);
    expect(teacherKeywordIds(teacherUnitId).sort()).toEqual([kwA, kwB].sort());

    // 두 번 불러도 중복되지 않는다.
    psql(`select inherit_teacher_unit_defaults_from_template('${teacherUnitId}');`);
    expect(teacherKeywordIds(teacherUnitId).sort()).toEqual([kwA, kwB].sort());
  });
});

describe("학생 운영본은 선생님 기본 구성을 거쳐 내려받는다", () => {
  it("선생님이 정한 키워드만 내려오고, 선생님이 뺀 기준본 키워드는 오지 않는다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const admin = makeAdminUnit([kwA, kwB]);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, admin.unitId, admin.position);
    // 선생님이 자기 기본 구성에서 B를 뺀다.
    psql(
      `delete from teacher_curriculum_template_unit_keywords
       where unit_id = '${teacherUnitId}' and keyword_id = '${kwB}';`
    );

    const { overlayId } = makeEnrollmentWithOverlay();
    const overlayUnitId = makeOverlayUnit(overlayId, admin.unitId, 901);

    expect(overlayKeywordIds(overlayUnitId)).toEqual([kwA]);
  });

  it("선생님이 더 붙인 키워드도 학생에게 내려온다", () => {
    const kwA = makeKeyword();
    const kwExtra = makeKeyword();
    const admin = makeAdminUnit([kwA]);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, admin.unitId, admin.position);
    psql(
      `insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id)
       values ('${teacherUnitId}', '${kwExtra}');`
    );

    const { overlayId } = makeEnrollmentWithOverlay();
    const overlayUnitId = makeOverlayUnit(overlayId, admin.unitId, 902);

    expect(overlayKeywordIds(overlayUnitId).sort()).toEqual([kwA, kwExtra].sort());
  });

  it("선생님 층에 연결된 회차가 없으면 종전대로 관리자 기준본에서 내려온다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const admin = makeAdminUnit([kwA, kwB]);

    // 선생님 템플릿을 만들지 않는다.
    const { overlayId } = makeEnrollmentWithOverlay();
    const overlayUnitId = makeOverlayUnit(overlayId, admin.unitId, 903);

    expect(overlayKeywordIds(overlayUnitId).sort()).toEqual([kwA, kwB].sort());
  });
});

// 마이그레이션 이전에 만들어진 템플릿은 연결만 복원되고 키워드는 비어 있다.
// 회차마다 하나씩 누르게 하면 "다시 지정하는 흐름"과 같아지므로 한 번에 부른다.
describe("템플릿 전체 보정", () => {
  /** 연결은 있지만 키워드가 비어 있는 회차 — 마이그레이션 이전 템플릿의 모습. */
  function makeLinkedButEmptyUnit(templateId: string, sourceUnitId: string, position: number) {
    const id = makeTeacherUnit(templateId, null, position);
    psql(
      `update teacher_curriculum_template_units set source_unit_id = '${sourceUnitId}' where id = '${id}';`
    );
    return id;
  }

  it("기준본과 이어진 회차를 한 번에 채운다", () => {
    const kwA = makeKeyword();
    const kwB = makeKeyword();
    const first = makeAdminUnit([kwA]);
    const second = makeAdminUnit([kwB]);

    const templateId = makeTeacherTemplate();
    const u1 = makeLinkedButEmptyUnit(templateId, first.unitId, 971);
    const u2 = makeLinkedButEmptyUnit(templateId, second.unitId, 972);
    expect(teacherKeywordIds(u1)).toEqual([]);
    expect(teacherKeywordIds(u2)).toEqual([]);

    psql(`select inherit_teacher_template_defaults('${templateId}');`);

    expect(teacherKeywordIds(u1)).toEqual([kwA]);
    expect(teacherKeywordIds(u2)).toEqual([kwB]);
  });

  it("기준본과 이어지지 않은 보충 회차는 건너뛴다", () => {
    const kwA = makeKeyword();
    const admin = makeAdminUnit([kwA]);

    const templateId = makeTeacherTemplate();
    const linked = makeLinkedButEmptyUnit(templateId, admin.unitId, 973);
    const supplement = makeTeacherUnit(templateId, null, 974);

    psql(`select inherit_teacher_template_defaults('${templateId}');`);

    expect(teacherKeywordIds(linked)).toEqual([kwA]);
    expect(teacherKeywordIds(supplement)).toEqual([]);
  });

  it("두 번 불러도 중복되지 않고 아무것도 지우지 않는다", () => {
    const kwA = makeKeyword();
    const kwExtra = makeKeyword();
    const admin = makeAdminUnit([kwA]);

    const templateId = makeTeacherTemplate();
    const unitId = makeLinkedButEmptyUnit(templateId, admin.unitId, 975);
    // 선생님이 기준본에 없는 키워드를 직접 붙여 뒀다.
    psql(
      `insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id)
       values ('${unitId}', '${kwExtra}');`
    );

    psql(`select inherit_teacher_template_defaults('${templateId}');`);
    psql(`select inherit_teacher_template_defaults('${templateId}');`);

    // 기준본 키워드가 들어오되, 선생님이 직접 붙인 것은 그대로 남는다.
    expect(teacherKeywordIds(unitId).sort()).toEqual([kwA, kwExtra].sort());
  });
});

// 4절 "세 계층은 같은 UI를 재사용한다"의 전제 — 세 층이 같은 규칙으로 움직여야
// 한 화면으로 다룰 수 있다. 관리자 기준본만 자동 구성이 없으면 같은 화면이
// "자동으로 들어온 것"과 "직접 담은 것"을 구분해 보여줄 수 없다.
describe("키워드 → 기본 교재 자동 구성은 세 계층에서 같게 동작한다", () => {
  const cleanupDocIds: string[] = [];

  afterEach(() => {
    for (const id of cleanupDocIds.splice(0)) {
      psql(`delete from curriculum_docs where id = '${id}';`);
    }
  });

  /** 이 키워드를 대표 키워드로 가진 공개 교재 하나. */
  function makeDefaultMaterial(keywordId: string): string {
    const id = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status, primary_keyword_id)
       values ('기본 교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published', '${keywordId}')
       returning id;`
    );
    cleanupDocIds.push(id);
    return id;
  }

  it("관리자 기준본: 키워드를 붙이면 기본 교재가 auto로 들어오고, 떼면 빠진다", () => {
    const kw = makeKeyword();
    const docId = makeDefaultMaterial(kw);
    const admin = makeAdminUnit([]);

    psql(
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${admin.unitId}', '${kw}');`
    );
    expect(
      psql(
        `select source from subject_template_unit_materials
         where unit_id = '${admin.unitId}' and curriculum_doc_id = '${docId}';`
      )
    ).toBe("auto");

    psql(
      `delete from subject_template_unit_keywords where unit_id = '${admin.unitId}' and keyword_id = '${kw}';`
    );
    expect(
      psql(`select count(*) from subject_template_unit_materials where unit_id = '${admin.unitId}';`)
    ).toBe("0");
  });

  it("관리자가 직접 담은 교재는 키워드를 떼도 남는다", () => {
    const kw = makeKeyword();
    const docId = makeDefaultMaterial(kw);
    const admin = makeAdminUnit([]);

    // 관리자가 손으로 담았다 — source 기본값은 manual 이다.
    psql(
      `insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position)
       values ('${admin.unitId}', '${docId}', 1);`
    );
    psql(
      `insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${admin.unitId}', '${kw}');`
    );
    psql(
      `delete from subject_template_unit_keywords where unit_id = '${admin.unitId}' and keyword_id = '${kw}';`
    );

    expect(
      psql(
        `select source from subject_template_unit_materials
         where unit_id = '${admin.unitId}' and curriculum_doc_id = '${docId}';`
      )
    ).toBe("manual");
  });

  it("선생님 기본 템플릿에서도 같게 동작한다", () => {
    const kw = makeKeyword();
    const docId = makeDefaultMaterial(kw);
    const admin = makeAdminUnit([]);
    const templateId = makeTeacherTemplate();
    const unitId = makeTeacherUnit(templateId, admin.unitId, 981);

    psql(
      `insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id) values ('${unitId}', '${kw}');`
    );
    expect(
      psql(
        `select source from teacher_curriculum_template_unit_materials
         where unit_id = '${unitId}' and curriculum_doc_id = '${docId}';`
      )
    ).toBe("auto");
  });
});

// 지시 3번 — 목표도 3계층 상속. 의도적으로 비운 값과 아직 상속되지 않은 값을
// 구분해 보존한다.
describe("회차 목표의 상속과 수정 범위", () => {
  it("회차를 만들면 기준본의 목표가 자동으로 내려온다", () => {
    const admin = makeAdminUnit([]);
    psql(`update subject_template_units set goal = '이차방정식 풀이' where id = '${admin.unitId}';`);

    const templateId = makeTeacherTemplate();
    const unitId = makeTeacherUnit(templateId, admin.unitId, admin.position);

    expect(
      psql(`select goal from teacher_curriculum_template_units where id = '${unitId}';`)
    ).toBe("이차방정식 풀이");
  });

  it("선생님이 일부러 비운 목표를 보정이 되살리지 않는다", () => {
    const admin = makeAdminUnit([]);
    psql(`update subject_template_units set goal = '기준본 목표' where id = '${admin.unitId}';`);

    const templateId = makeTeacherTemplate();
    const unitId = makeTeacherUnit(templateId, admin.unitId, admin.position);
    // 빈 문자열 = 일부러 비움. null = 아직 아무도 정하지 않음. 둘은 다르다.
    psql(`update teacher_curriculum_template_units set goal = '' where id = '${unitId}';`);

    psql(`select inherit_teacher_unit_goal('${unitId}');`);

    expect(
      psql(`select goal = '' from teacher_curriculum_template_units where id = '${unitId}';`)
    ).toBe("t");
  });

  it("아직 상속되지 않은 목표는 보정으로 채운다", () => {
    const admin = makeAdminUnit([]);
    const templateId = makeTeacherTemplate();
    // 연결만 있고 목표는 비어 있는 상태(마이그레이션 이전 템플릿의 모습).
    const unitId = makeTeacherUnit(templateId, null, 991);
    psql(
      `update teacher_curriculum_template_units set source_unit_id = '${admin.unitId}' where id = '${unitId}';`
    );
    psql(`update subject_template_units set goal = '나중에 적은 목표' where id = '${admin.unitId}';`);

    psql(`select inherit_teacher_unit_goal('${unitId}');`);

    expect(
      psql(`select goal from teacher_curriculum_template_units where id = '${unitId}';`)
    ).toBe("나중에 적은 목표");
  });

  it("상위가 나중에 바뀌어도 저절로 내려오지 않는다", () => {
    const admin = makeAdminUnit([]);
    psql(`update subject_template_units set goal = '처음 목표' where id = '${admin.unitId}';`);

    const templateId = makeTeacherTemplate();
    const unitId = makeTeacherUnit(templateId, admin.unitId, admin.position);
    psql(`update subject_template_units set goal = '바뀐 목표' where id = '${admin.unitId}';`);

    expect(
      psql(`select goal from teacher_curriculum_template_units where id = '${unitId}';`)
    ).toBe("처음 목표");
  });

  it("학생 운영본은 선생님의 목표를 받는다", () => {
    const admin = makeAdminUnit([]);
    psql(`update subject_template_units set goal = '기준본 목표' where id = '${admin.unitId}';`);

    const templateId = makeTeacherTemplate();
    const teacherUnitId = makeTeacherUnit(templateId, admin.unitId, admin.position);
    psql(
      `update teacher_curriculum_template_units set goal = '선생님이 고친 목표' where id = '${teacherUnitId}';`
    );

    const { overlayId } = makeEnrollmentWithOverlay();
    const overlayUnitId = makeOverlayUnit(overlayId, admin.unitId, 904);

    expect(
      psql(`select goal from curriculum_unit_preps where overlay_unit_id = '${overlayUnitId}';`)
    ).toBe("선생님이 고친 목표");
  });
});
