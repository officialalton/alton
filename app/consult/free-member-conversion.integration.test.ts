import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-10-05 무료 회원 S5 — 무료 회원 → 보호자 초대 수락 → 상담 → 관리자 체험 온보딩(existing_child_id) → finalize →
// member_type free->tutoring 전체 전환을 DB 레이어에서 검증한다(20262100000006). 공유 로컬 DB(54422)에 실행 ID가 붙은
// 전용 계정만 만든다. 앱 레이어(createUser)는 기존 자녀 행(status=created)을 건너뛰므로 finalize RPC 입력은 그대로 재현한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `fmconv-${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlAsUser(userId: string, sql: string): string {
  return psql(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}'; ${sql} commit;`);
}
function authUser(email: string, name: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{"name":"${name}"}', now(), now()) returning id;`,
  );
}
function freeStudent(label: string): { id: string; email: string } {
  const email = `${RUN}-${label}@example.com`;
  const id = authUser(email, label);
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', 'Student ${label}');`);
  psql(`insert into students (id, grade, status, member_type, signup_source, profile_completed_at) values ('${id}', '10', 'active', 'free', 'self_signup', now());`);
  return { id, email };
}
function parent(label: string): { id: string; email: string } {
  const email = `${RUN}-${label}@example.com`;
  const id = authUser(email, label);
  psql(`insert into profiles (id, role, name) values ('${id}', 'parent', 'Parent ${label}');`);
  psql(`insert into parents (id) values ('${id}');`);
  return { id, email };
}
const count = (sql: string) => Number(psql(sql));

let ADMIN = "";
let consultantId = "";
let autoAssignWas = "";
let examSetId = "";

beforeAll(() => {
  ADMIN = psql(`select id from profiles where role = 'admin' order by created_at limit 1`);
  consultantId = authUser(`${RUN}-consultant@example.com`, "consultant");
  psql(`insert into profiles (id, role, name) values ('${consultantId}', 'consultant', 'Consultant ${RUN}');`);
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${consultantId}', 'manage_consultation_intake') on conflict do nothing;`);
  autoAssignWas = psql(`select auto_assign_enabled from consultant_assignment_settings where id = true;`);
  if (autoAssignWas !== "t") psql(`update consultant_assignment_settings set auto_assign_enabled = true where id = true;`);
  examSetId = psql(`insert into mock_exam_sets (name, difficulty_tier, status) values ('${RUN} set', 'standard', 'draft') returning id;`);
});
afterAll(() => {
  if (autoAssignWas === "f") psql(`update consultant_assignment_settings set auto_assign_enabled = false where id = true;`);
  psql(`delete from supervisor_capabilities where profile_id = '${consultantId}';`);
  if (!examSetId) return;
  psql(`delete from mock_exam_attempts where exam_set_id = '${examSetId}';`);
  psql(`delete from mock_exam_sets where id = '${examSetId}';`);
});

function acceptedFreeMember(label: string) {
  const s = freeStudent(label);
  const p = parent(`${label}-parent`);
  psql(`insert into vocab_words (student_id, word, definition) values ('${s.id}', 'alpha', 'a'), ('${s.id}', 'beta', 'b');`);
  const groupId = psql(`select set_group_id from mock_exam_sets where id = '${examSetId}'`);
  psql(`insert into mock_exam_attempts (exam_set_id, exam_set_group_id, student_id, status) values ('${examSetId}', '${groupId}', '${s.id}', 'assigned');`);
  psqlAsUser(s.id, `select register_consult_interest('result_page');`);
  const row = psqlAsUser(s.id, `select outcome, invite_id, raw_token from create_guardian_link_invite('${p.email}');`);
  const token = row.split("|")[2];
  const acc = psqlAsUser(p.id, `select outcome, consultation_id from accept_guardian_link_invite('${token}');`).split("|");
  const consultationId = acc[1];
  psql(`update consultations set trial_intent_confirmed_at = now() where id = '${consultationId}';`);
  return { s, p, consultationId };
}

function createLink(consultationId: string, parentEmail: string, students: unknown[]): { linkId: string } {
  const json = JSON.stringify(students).replace(/'/g, "''");
  const linkId = psql(`select link_id from create_trial_onboarding_link_multi('${consultationId}', '${parentEmail}', 'Guardian', '${json}'::jsonb, '${ADMIN}');`);
  return { linkId };
}

function finalize(linkId: string, guardianId: string, items: { linkStudentId: string; childId: string }[]) {
  const json = JSON.stringify(items.map((i) => ({ link_student_id: i.linkStudentId, child_auth_user_id: i.childId })));
  return psql(`select household_id, created_count, failed_count from finalize_trial_onboarding_students('${linkId}', false, '${guardianId}', 'Guardian', '${json}'::jsonb);`);
}

describe("무료 회원 → 과외 전환(상담 경로 재사용)", () => {
  it("existing_child_id 링크 → finalize 후 member_type=tutoring, 같은 students.id, 기록 불변, household 1행", () => {
    const { s, p, consultationId } = acceptedFreeMember("full");
    const attemptIdsBefore = psql(`select string_agg(id::text, ',' order by id) from mock_exam_attempts where student_id = '${s.id}'`);
    const vocabIdsBefore = psql(`select string_agg(id::text, ',' order by id) from vocab_words where student_id = '${s.id}'`);
    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("free");
    expect(psqlAsUser(s.id, `select array_to_string(student_feature_access('${s.id}'), ',');`)).not.toMatch(/teacher_chat/);
    expect(count(`select count(*) from household_members where profile_id = '${s.id}' and role = 'child'`)).toBe(1);

    const { linkId } = createLink(consultationId, p.email, [{ name: "ignored", email: "ignored@example.com", existing_child_id: s.id }]);
    const row = psql(`select id, status, child_auth_user_id, is_existing_child, student_email from trial_onboarding_link_students where link_id = '${linkId}'`).split("|");
    expect(row.slice(1, 4)).toEqual(["created", s.id, "t"]);
    expect(row[4]).toBe(s.email); // 계정 이메일을 그대로 사용(입력값 무시)

    const out = finalize(linkId, p.id, [{ linkStudentId: row[0], childId: s.id }]).split("|");
    expect(out.slice(1)).toEqual(["1", "0"]);

    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("tutoring");
    expect(psql(`select string_agg(id::text, ',' order by id) from mock_exam_attempts where student_id = '${s.id}'`)).toBe(attemptIdsBefore);
    expect(psql(`select string_agg(id::text, ',' order by id) from vocab_words where student_id = '${s.id}'`)).toBe(vocabIdsBefore);
    expect(count(`select count(*) from household_members where profile_id = '${s.id}' and role = 'child'`)).toBe(1);
    expect(count(`select count(*) from students where id = '${s.id}'`)).toBe(1);
    // 튜터링 키 개방
    const keys = psqlAsUser(s.id, `select array_to_string(student_feature_access('${s.id}'), ',');`);
    expect(keys).toMatch(/teacher_chat/);
    expect(keys).toMatch(/roadmap/);
    expect(psql(`select has_tutoring_access('${s.id}')`)).toBe("t");
    // 칸반 카드 1장(멱등), 링크 redeemed
    expect(count(`select count(*) from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card and child_id = '${s.id}'`)).toBe(1);
    expect(psql(`select status from trial_onboarding_links where id = '${linkId}'`)).toBe("redeemed");

    // 재호출은 멱등(전환·카드·household 중복 없음)
    finalize(linkId, p.id, [{ linkStudentId: row[0], childId: s.id }]);
    expect(count(`select count(*) from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card and child_id = '${s.id}'`)).toBe(1);
    expect(count(`select count(*) from household_members where profile_id = '${s.id}' and role = 'child'`)).toBe(1);
    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("tutoring");
  });

  it("existing_child_id 가 상담 child_id 와 다르면 링크 발급 거절, 이미 과외 회원이어도 거절", () => {
    const a = acceptedFreeMember("mismatch-a");
    const other = freeStudent("mismatch-other");
    expect(() => createLink(a.consultationId, a.p.email, [{ name: "x", email: "x@example.com", existing_child_id: other.id }])).toThrow(/일치하지 않습니다/);
    psql(`update students set member_type = 'tutoring' where id = '${a.s.id}'`);
    expect(() => createLink(a.consultationId, a.p.email, [{ name: "x", email: "x@example.com", existing_child_id: a.s.id }])).toThrow(/무료 회원/);
  });

  it("직접생성 경로(consultation_id 없음)는 기존 자녀 행을 거절하고 전환하지 않는다", () => {
    const s = freeStudent("direct");
    const p = parent("direct-parent");
    const prospect = psql(`insert into prospect_contacts (full_name, primary_email) values ('direct', '${p.email}') returning id;`);
    const linkId = psql(`insert into trial_onboarding_links (prospect_contact_id, guardian_email, guardian_name, token_hash, expires_at) values ('${prospect}', '${p.email}', 'G', 'h-${RUN}-direct', now() + interval '72 hours') returning id;`);
    const ls = psql(`insert into trial_onboarding_link_students (link_id, student_name, student_email, status, child_auth_user_id, is_existing_child) values ('${linkId}', 'S', '${s.email}', 'created', '${s.id}', true) returning id;`);
    psql(`insert into households (primary_guardian_id) values ('${p.id}');`);
    expect(() => finalize(linkId, p.id, [{ linkStudentId: ls, childId: s.id }])).toThrow(/existing_child_not_allowed_in_direct_path/);
    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("free");
  });

  it("existing_child_id 가 없는 기존 경로는 이전과 동일(pending 행, 전환 없음)", () => {
    const p = parent("old-route");
    const prospect = psql(`insert into prospect_contacts (full_name, primary_email) values ('old', '${p.email}') returning id;`);
    const consultationId = psql(
      `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
       values ('homepage', 'completed', 'trial_recommended', 'old', '${p.email}', now(), now() + interval '30 minutes', '${prospect}', now()) returning id;`,
    );
    const { linkId } = createLink(consultationId, p.email, [{ name: "New Kid", email: `${RUN}-newkid@example.com`, grade: "9" }]);
    expect(psql(`select status, child_auth_user_id is null, is_existing_child from trial_onboarding_link_students where link_id = '${linkId}'`)).toBe("pending|t|f");
    // existing_child_id 없이 child_id 가 없는 상담에 existing_child_id 를 주면 거절
    const s = freeStudent("old-route-free");
    expect(() => createLink(consultationId, p.email, [{ name: "x", email: "x@example.com", existing_child_id: s.id }])).toThrow(/일치하지 않습니다/);
  });

  it("convert_free_member_to_tutoring: 상담이 해당 학생의 free_member 상담이 아니면 거절", () => {
    const s = freeStudent("convert-guard");
    const p = parent("convert-guard-parent");
    const prospect = psql(`insert into prospect_contacts (full_name, primary_email) values ('g', '${p.email}') returning id;`);
    const consultationId = psql(
      `insert into consultations (source, status, contact_name, contact_email, prospect_contact_id, child_id)
       values ('homepage', 'requested', 'g', '${p.email}', '${prospect}', '${s.id}') returning id;`,
    );
    expect(() => psql(`select convert_free_member_to_tutoring('${s.id}', '${consultationId}')`)).toThrow(/무료 회원 연결 상담이 아닙니다/);
    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("free");
    // 학생 본인(authenticated)은 직접 호출 불가
    expect(() => psqlAsUser(s.id, `select convert_free_member_to_tutoring('${s.id}', '${consultationId}');`)).toThrow(/permission denied/);
  });
});
