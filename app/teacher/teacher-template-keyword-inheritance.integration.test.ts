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
