import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 10차 — 학생·보호자의 수업 전 열람.
//
// 2026-09-13 확정: 예습을 허용한다. 다만 **지문·선택지를 보는 것과 정답·해설을
// 보는 것은 구분한다** — 정답·해설은 화면이 아니라 응답 데이터에서 빠진다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const OTHER_STUDENT_ID = "cccccccc-0000-0000-0000-000000000002";
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
const cleanupContracts: string[] = [];
const cleanupProblems: string[] = [];
const cleanupKeywords: string[] = [];

afterEach(() => {
  for (const id of cleanupContracts.splice(0)) {
    psql(`
      set session_replication_role = replica;
      delete from curriculum_unit_prep_items where prep_id in (
        select p.id from curriculum_unit_preps p
        join curriculum_overlay_units u on u.id = p.overlay_unit_id
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_unit_preps where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_unit_keywords where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_unit_materials where overlay_unit_id in (
        select u.id from curriculum_overlay_units u
        join student_curriculum_overlays o on o.id = u.overlay_id
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from curriculum_overlay_units where overlay_id in (
        select o.id from student_curriculum_overlays o
        join subject_enrollments e on e.id = o.subject_enrollment_id where e.contract_id = '${id}');
      delete from student_curriculum_overlays where subject_enrollment_id in (
        select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
      set session_replication_role = origin;
    `);
  }
  for (const id of cleanupProblems.splice(0)) {
    psql(`set session_replication_role = replica;
          update problems set published_version_id = null where id = '${id}';
          delete from problem_versions where problem_id = '${id}';
          delete from problem_keywords where problem_id = '${id}';
          delete from problems where id = '${id}';
          set session_replication_role = origin;`);
  }
  for (const id of cleanupKeywords.splice(0)) {
    psql(`delete from subject_keywords where id = '${id}';`);
  }
});

function newKeyword(): string {
  const id = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '예습 ${uniq()}') returning id;`
  );
  cleanupKeywords.push(id);
  return id;
}

function publishedProblem(keywordId: string): string {
  const problemId = psql(
    `select create_bank_problem('${SUBJECT_ID}', 'mc', '', '', 'medium', '${ADMIN_ID}');`
  );
  cleanupProblems.push(problemId);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  const v = psql(
    `select save_problem_draft_version('${problemId}', '예습용 지문 ${uniq()}', '["가","나","다","라"]'::jsonb, 2, '이건 해설이다', 'medium', '${ADMIN_ID}');`
  );
  psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
  return problemId;
}

/** 학생 회차 + 준비안에 담긴 문제 하나. */
function makeUnit(problemId: string, keywordId: string) {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  cleanupContracts.push(contractId);
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
  const overlayUnitId = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title)
     values ('${overlayId}', 1, '예습 회차') returning id;`
  );
  psql(
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );
  const prepId = psql(
    `insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
     values ('${overlayUnitId}', '예습 목표', '${TEACHER_ID}')
     on conflict (overlay_unit_id) do update set goal = excluded.goal returning id;`
  );
  psql(
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
     values ('${prepId}', 'problem', '${problemId}', 1);`
  );
  return { overlayUnitId, enrollmentId, contractId };
}

const previewAs = (userId: string, unitId: string) =>
  asUser(userId, `select unit_preview_for_viewer('${unitId}')::text;`);

describe("학생은 예약·수업 시작 전에도 미리 본다", () => {
  it("준비안에 담긴 문제의 지문과 선택지를 본다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    const out = previewAs(STUDENT_ID, overlayUnitId);
    expect(out).toContain("예습용 지문");
    expect(out).toContain("가");
    // 예약도 수업도 없는데 열린다.
    expect(out).toContain('"frozen": false');
  });

  it("정답과 해설은 응답에 담기지 않는다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    const out = previewAs(STUDENT_ID, overlayUnitId);
    expect(out).not.toContain("이건 해설이다");
    expect(out).not.toContain("correctIndex");
    expect(out).not.toContain("correct_index");
    expect(out).not.toContain("explanation");
  });

  it("준비 구성을 바꾸면 미리보기에도 반영된다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);
    expect(previewAs(STUDENT_ID, overlayUnitId)).toContain("예습용 지문");

    psql(`delete from curriculum_unit_prep_items where content_id = '${problemId}';`);
    expect(previewAs(STUDENT_ID, overlayUnitId)).not.toContain("예습용 지문");
  });

  it("담을 때의 버전을 읽는다 — 재공개해도 미리보기는 그대로다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);
    const before = previewAs(STUDENT_ID, overlayUnitId);
    expect(before).toContain("예습용 지문");

    const v2 = psql(
      `select save_problem_draft_version('${problemId}', '고친 지문 ${uniq()}', '["ㄱ","ㄴ","ㄷ","ㄹ"]'::jsonb, 0, '새 해설', 'medium', '${ADMIN_ID}');`
    );
    psql(`select confirm_and_publish_problem_version('${v2}', '${ADMIN_ID}');`);

    const after = previewAs(STUDENT_ID, overlayUnitId);
    expect(after).toContain("예습용 지문");
    expect(after).not.toContain("고친 지문");
  });
});

describe("볼 수 있는 사람만 본다", () => {
  it("보호자도 같은 범위로 읽는다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    const guardianId = psql(
      `select profile_id from household_members
       where household_id = '${HOUSEHOLD_ID}' and role = 'guardian' limit 1;`
    );
    if (!guardianId) return;

    const out = asUser(guardianId, `select unit_preview_for_viewer('${overlayUnitId}')::text;`);
    expect(out).toContain("예습용 지문");
    expect(out).not.toContain("이건 해설이다");
  });

  it("다른 학생은 아무것도 읽지 못한다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    expect(previewAs(OTHER_STUDENT_ID, overlayUnitId).trim()).toBe("");
  });

  it("담당이 아닌 선생님도 읽지 못한다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    expect(previewAs(OTHER_TEACHER_ID, overlayUnitId).trim()).toBe("");
  });

  it("담당 선생님과 관리자는 읽는다", () => {
    const keywordId = newKeyword();
    const problemId = publishedProblem(keywordId);
    const { overlayUnitId } = makeUnit(problemId, keywordId);

    expect(previewAs(TEACHER_ID, overlayUnitId)).toContain("예습용 지문");
    expect(previewAs(ADMIN_ID, overlayUnitId)).toContain("예습용 지문");
  });
});
