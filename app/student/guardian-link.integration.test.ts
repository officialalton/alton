import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-10-05 무료 회원 S4 — 관심 등록·보호자 초대·수락(20262100000004/0005) DB 통합 테스트.
// 브리프 §8 엣지 케이스 매트릭스 + §3.4-9 "하지 않는 것" 고정. 공유 로컬 DB(54422)에 실행 ID가 붙은
// 전용 계정만 만들고 psqlAsUser(request.jwt.claims)로 RLS·auth.uid()를 실제로 태운다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `glink-${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlAsUser(userId: string | null, sql: string): string {
  const claims = userId ? `'{"sub":"${userId}","role":"authenticated"}'` : `'{"role":"anon"}'`;
  const wrapped = `begin; set local role ${userId ? "authenticated" : "anon"}; set local request.jwt.claims = ${claims}; ${sql} commit;`;
  return psql(wrapped);
}
function authUser(email: string, name: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{"name":"${name}"}', now(), now()) returning id;`,
  );
}
function freeStudent(label: string, opts?: { dob?: string; name?: string }): { id: string; email: string } {
  const email = `${RUN}-${label}@example.com`;
  const id = authUser(email, label);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${opts?.name ?? `Student ${label}`}', ${opts?.dob ? `'${opts.dob}'` : "null"});`);
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
function invite(studentId: string, email: string): { inviteId: string; token: string; outcome: string } {
  const row = psqlAsUser(studentId, `select outcome, invite_id, raw_token from create_guardian_link_invite('${email}');`);
  const [outcome, inviteId, token] = row.split("|");
  return { outcome, inviteId, token };
}
function accept(parentId: string, token: string): Record<string, string> {
  const row = psqlAsUser(parentId, `select outcome, invite_id, student_id, household_id, consultation_id, coalesce(scheduling_token,''), booked, coalesce(manual_review_reason,'') from accept_guardian_link_invite('${token}');`);
  const [outcome, inviteId, studentId, householdId, consultationId, schedulingToken, booked, reason] = row.split("|");
  return { outcome, inviteId, studentId, householdId, consultationId, schedulingToken, booked, reason };
}
const count = (sql: string) => Number(psql(sql));

let consultantId = "";
let ADMIN = "";
let autoAssignWas = "";

beforeAll(() => {
  ADMIN = psql(`select id from profiles where role = 'admin' order by created_at limit 1`);
  // 자동배정 후보 1명 보장(실행 전용). 설정이 꺼져 있으면 켜고 종료 시 원복.
  consultantId = authUser(`${RUN}-consultant@example.com`, "consultant");
  psql(`insert into profiles (id, role, name) values ('${consultantId}', 'consultant', 'Consultant ${RUN}');`);
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${consultantId}', 'manage_consultation_intake') on conflict do nothing;`);
  autoAssignWas = psql(`select auto_assign_enabled from consultant_assignment_settings where id = true;`);
  if (autoAssignWas !== "t") psql(`update consultant_assignment_settings set auto_assign_enabled = true where id = true;`);
});
afterAll(() => {
  if (autoAssignWas === "f") psql(`update consultant_assignment_settings set auto_assign_enabled = false where id = true;`);
  psql(`delete from supervisor_capabilities where profile_id = '${consultantId}';`);
});

describe("register_consult_interest / create_guardian_link_invite", () => {
  it("관심 등록은 학생당 열린 1개(멱등), 무료 회원만", () => {
    const s = freeStudent("interest");
    const a = psqlAsUser(s.id, `select id from register_consult_interest('result_page');`);
    const b = psqlAsUser(s.id, `select id from register_consult_interest('home');`);
    expect(a).toBe(b);
    expect(count(`select count(*) from student_consult_interests where student_id = '${s.id}'`)).toBe(1);
    // 동시 등록(Promise.all) → 행 1
    const s2 = freeStudent("interest-concurrent");
    return Promise.all([1, 2, 3].map(() => Promise.resolve().then(() => psqlAsUser(s2.id, `select register_consult_interest();`)).catch(() => null))).then(() => {
      expect(count(`select count(*) from student_consult_interests where student_id = '${s2.id}'`)).toBe(1);
    });
  });

  it("학생 본인 이메일 초대 거절, 잘못된 이메일 거절, 열린 초대 3개 상한", () => {
    const s = freeStudent("limits");
    expect(() => invite(s.id, s.email.toUpperCase())).toThrow(/own_email/);
    expect(() => invite(s.id, "not-an-email")).toThrow(/invalid_email/);
    invite(s.id, `${RUN}-p1@example.com`);
    invite(s.id, `${RUN}-p2@example.com`);
    invite(s.id, `${RUN}-p3@example.com`);
    expect(() => invite(s.id, `${RUN}-p4@example.com`)).toThrow(/too_many_open_invites/);
    expect(psql(`select status from student_consult_interests where student_id = '${s.id}'`)).toBe("invite_sent");
  });

  it("같은 이메일 재초대는 이전 토큰을 superseded로 만들고 세대를 올린다(이전 토큰 수락 불가)", () => {
    const s = freeStudent("supersede");
    const p = parent("supersede-parent");
    const first = invite(s.id, p.email);
    psql(`update guardian_link_invites set last_sent_at = now() - interval '11 minutes' where id = '${first.inviteId}';`);
    const second = invite(s.id, p.email);
    expect(second.inviteId).not.toBe(first.inviteId);
    expect(psql(`select status, token_generation from guardian_link_invites where id = '${first.inviteId}'`)).toBe("superseded|1");
    expect(psql(`select status, token_generation from guardian_link_invites where id = '${second.inviteId}'`)).toBe("pending|2");
    expect(() => accept(p.id, first.token)).toThrow(/superseded/);
    expect(psqlAsUser(null, `select status from claim_guardian_link_invite('${first.token}');`)).toBe("superseded");
  });

  it("재발송 쿨다운 10분·일 3회", () => {
    const s = freeStudent("resend");
    const first = invite(s.id, `${RUN}-resend-parent@example.com`);
    expect(() => psqlAsUser(s.id, `select resend_guardian_link_invite('${first.inviteId}');`)).toThrow(/resend_cooldown/);
    let current = first.inviteId;
    for (let i = 0; i < 3; i++) {
      psql(`update guardian_link_invites set last_sent_at = now() - interval '11 minutes' where id = '${current}';`);
      current = psqlAsUser(s.id, `select invite_id from resend_guardian_link_invite('${current}');`);
    }
    psql(`update guardian_link_invites set last_sent_at = now() - interval '11 minutes' where id = '${current}';`);
    expect(() => psqlAsUser(s.id, `select resend_guardian_link_invite('${current}');`)).toThrow(/resend_daily_limit/);
  });

  it("초대 취소 → revoked, 수락 불가, 관심은 registered로 복귀; 타인 초대는 보이지도 취소되지도 않는다", () => {
    const s = freeStudent("revoke");
    const other = freeStudent("revoke-other");
    const p = parent("revoke-parent");
    const inv = invite(s.id, p.email);
    expect(psqlAsUser(other.id, `select count(*) from guardian_link_invites where id = '${inv.inviteId}';`)).toBe("0");
    expect(() => psqlAsUser(other.id, `select revoke_guardian_link_invite('${inv.inviteId}');`)).toThrow(/not_found/);
    psqlAsUser(s.id, `select revoke_guardian_link_invite('${inv.inviteId}');`);
    expect(psql(`select status from guardian_link_invites where id = '${inv.inviteId}'`)).toBe("revoked");
    expect(psql(`select status from student_consult_interests where student_id = '${s.id}'`)).toBe("registered");
    expect(() => accept(p.id, inv.token)).toThrow(/revoked/);
  });

  it("만료는 시간으로 즉시 판정(크론 전)되고, 크론이 expired로 바꾼다", () => {
    const s = freeStudent("expire");
    const p = parent("expire-parent");
    const inv = invite(s.id, p.email);
    psql(`update guardian_link_invites set expires_at = now() - interval '1 minute' where id = '${inv.inviteId}';`);
    expect(psqlAsUser(null, `select status from claim_guardian_link_invite('${inv.token}');`)).toBe("expired");
    expect(() => accept(p.id, inv.token)).toThrow(/expired/);
    psqlAsUser(ADMIN, `select mark_expired_guardian_link_invites();`);
    expect(psql(`select status from guardian_link_invites where id = '${inv.inviteId}'`)).toBe("expired");
    expect(psql(`select status from student_consult_interests where student_id = '${s.id}'`)).toBe("expired");
  });
});

describe("accept_guardian_link_invite", () => {
  it("기존 보호자 계정: 로그인 없이는 불가, 이메일 불일치 거절, 일치하면 household·상담·배정·예약 링크·요약 동의 생성 — 과외 객체는 0건", () => {
    const s = freeStudent("accept");
    const p = parent("accept-parent");
    const wrong = parent("accept-wrong");
    const inv = invite(s.id, p.email);

    expect(() => psqlAsUser(null, `select accept_guardian_link_invite('${inv.token}');`)).toThrow(/login_required|permission denied/);
    expect(() => accept(wrong.id, inv.token)).toThrow(/email_mismatch/);
    // claim은 부작용 없음 — 여전히 pending, 계정 존재 표시
    expect(psqlAsUser(null, `select status, account_exists from claim_guardian_link_invite('${inv.token}');`)).toBe("pending|t");

    const consultationsBefore = count(`select count(*) from consultations`);
    const r = accept(p.id, inv.token);
    expect(r.outcome).toBe("accepted");
    expect(r.booked).toBe("f");
    expect(r.schedulingToken).not.toBe("");
    expect(count(`select count(*) from consultations`)).toBe(consultationsBefore + 1);
    expect(psql(`select source, status, child_id, household_id, admissions_consultant_id is not null, outcome is null from consultations where id = '${r.consultationId}'`))
      .toBe(`free_member|requested|${s.id}|${r.householdId}|t|t`);
    expect(psql(`select primary_guardian_id from households where id = '${r.householdId}'`)).toBe(p.id);
    expect(psql(`select count(*) from household_members where household_id = '${r.householdId}' and profile_id = '${s.id}' and role = 'child'`)).toBe("1");
    expect(psql(`select converted_guardian_id from prospect_contacts where id = (select prospect_contact_id from consultations where id = '${r.consultationId}')`)).toBe(p.id);
    expect(psql(`select count(*) from consultation_scheduling_links where consultation_id = '${r.consultationId}' and token = '${r.schedulingToken}' and used_at is null`)).toBe("1");
    expect(psql(`select count(*) from learning_summary_grants where student_id = '${s.id}' and guardian_id = '${p.id}' and revoked_at is null`)).toBe("1");
    expect(psql(`select status, guardian_id, consultation_id from student_consult_interests where student_id = '${s.id}'`)).toBe(`consultation_requested|${p.id}|${r.consultationId}`);

    // §3.4-9 하지 않는 것
    expect(psql(`select member_type from students where id = '${s.id}'`)).toBe("free");
    expect(count(`select count(*) from consultant_assignments where student_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from entitlement_grants where child_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from subject_enrollments where child_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from teacher_assignments ta join subject_enrollments se on se.id = ta.subject_enrollment_id where se.child_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from contracts where child_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from contract_dispatch_jobs where child_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from consultations where is_child_onboarding_card and child_id = '${s.id}'`)).toBe(0);
    // 무료 키 유지, 과외 키 없음
    expect(psqlAsUser(s.id, `select array_to_string(student_feature_access('${s.id}'), ',');`)).not.toMatch(/class|lesson_booking/);

    // 멱등: 재수락은 같은 결과, 행 수 불변
    const r2 = accept(p.id, inv.token);
    expect(r2.consultationId).toBe(r.consultationId);
    expect(r2.schedulingToken).toBe(r.schedulingToken);
    expect(count(`select count(*) from consultations`)).toBe(consultationsBefore + 1);
    expect(count(`select count(*) from household_members where profile_id = '${s.id}'`)).toBe(1);
    // 수락자가 아닌 보호자는 같은 토큰 재사용 불가
    expect(() => accept(wrong.id, inv.token)).toThrow(/accepted_by_other/);
    // claim: 수락자에게만 예약 토큰 노출
    expect(psqlAsUser(p.id, `select status, scheduling_token from claim_guardian_link_invite('${inv.token}');`)).toBe(`accepted|${r.schedulingToken}`);
    expect(psqlAsUser(null, `select status, coalesce(scheduling_token,'') from claim_guardian_link_invite('${inv.token}');`)).toBe("accepted|");
    // 보호자 포털 상태
    expect(psqlAsUser(p.id, `select consultation_id, child_id, status, assigned, has_valid_link from family_free_member_consult_status();`))
      .toBe(`${r.consultationId}|${s.id}|requested|t|t`);
  });

  it("동시 수락 더블클릭(Promise.all) → household_members·consultations 각 1건", async () => {
    const s = freeStudent("race");
    const p = parent("race-parent");
    const inv = invite(s.id, p.email);
    const results = await Promise.all([1, 2, 3].map(() => new Promise<string>((res) => res(accept(p.id, inv.token).consultationId)).catch(() => "err")));
    const ids = new Set(results.filter((r) => r !== "err"));
    expect(ids.size).toBe(1);
    expect(count(`select count(*) from household_members where profile_id = '${s.id}'`)).toBe(1);
    expect(count(`select count(*) from consultations where child_id = '${s.id}'`)).toBe(1);
  });

  it("다자녀: 한 보호자가 두 자녀 초대를 수락하면 같은 household에 child 2건, 상담은 자녀별", () => {
    const a = freeStudent("multi-a");
    const b = freeStudent("multi-b");
    const p = parent("multi-parent");
    const ra = accept(p.id, invite(a.id, p.email).token);
    const rb = accept(p.id, invite(b.id, p.email).token);
    expect(ra.householdId).toBe(rb.householdId);
    expect(count(`select count(*) from household_members where household_id = '${ra.householdId}' and role = 'child'`)).toBe(2);
    expect(ra.consultationId).not.toBe(rb.consultationId);
    expect(count(`select count(*) from households where primary_guardian_id = '${p.id}'`)).toBe(1);
  });

  it("이미 연결된 학생: 초대 0건, 연결된 보호자 안내 1회(should_notify), 중복 호출 시 추가 안내 없음", () => {
    const s = freeStudent("linked");
    const p = parent("linked-parent");
    accept(p.id, invite(s.id, p.email).token);
    // 다시 초대 시도(다른 이메일이라도) → already_linked
    const r1 = psqlAsUser(s.id, `select outcome, coalesce(invite_id::text,''), guardian_email, should_notify from create_guardian_link_invite('${RUN}-someone-else@example.com');`);
    expect(r1).toBe(`already_linked||${p.email}|t`);
    const r2 = psqlAsUser(s.id, `select outcome, should_notify from create_guardian_link_invite('${RUN}-someone-else@example.com');`);
    expect(r2).toBe("already_linked|f");
    expect(count(`select count(*) from guardian_link_invites where student_id = '${s.id}' and status = 'pending'`)).toBe(0);
  });

  it("보호자가 먼저 같은 아이(이름·생년월일 동일, 이메일 다름)를 상담 경로로 등록 → manual_review, 데이터 미이동", () => {
    const p = parent("dup-parent");
    const existingChild = authUser(`${RUN}-dup-existing@example.com`, "dup");
    psql(`insert into profiles (id, role, name, date_of_birth) values ('${existingChild}', 'student', 'Jane  Doe', '2010-05-05');`);
    psql(`insert into students (id, grade, status) values ('${existingChild}', '10', 'pending');`);
    const hh = psql(`insert into households (primary_guardian_id) values ('${p.id}') returning id;`);
    psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${hh}', '${p.id}', 'guardian', true), ('${hh}', '${existingChild}', 'child', true);`);

    const s = freeStudent("dup-free", { dob: "2010-05-05", name: "jane doe" });
    const inv = invite(s.id, p.email);
    const r = accept(p.id, inv.token);
    expect(r.outcome).toBe("manual_review");
    expect(r.reason).toBe("possible_duplicate_child");
    expect(psql(`select status from guardian_link_invites where id = '${inv.inviteId}'`)).toBe("manual_review");
    expect(count(`select count(*) from household_members where profile_id = '${s.id}'`)).toBe(0);
    expect(count(`select count(*) from consultations where child_id = '${s.id}'`)).toBe(0);
    // 재호출은 같은 결과(멱등)
    expect(accept(p.id, inv.token).outcome).toBe("manual_review");
    // 학생이 철회 가능
    psqlAsUser(s.id, `select revoke_guardian_link_invite('${inv.inviteId}');`);
    expect(psql(`select status from guardian_link_invites where id = '${inv.inviteId}'`)).toBe("revoked");
  });

  it("학생이 이미 다른 household에 있음(두 번째 보호자) → manual_review", () => {
    const s = freeStudent("second-guardian");
    const p1 = parent("second-p1");
    const p2 = parent("second-p2");
    const i1 = invite(s.id, p1.email);
    const i2 = invite(s.id, p2.email);
    expect(accept(p1.id, i1.token).outcome).toBe("accepted");
    // 수락되면 같은 학생의 다른 pending 초대는 superseded
    expect(psql(`select status from guardian_link_invites where id = '${i2.inviteId}'`)).toBe("superseded");
    // 그래도 p2가 새 초대로 들어오는 경우(관리자가 재초대 등) → 다른 household라 manual_review
    psql(`update guardian_link_invites set status = 'pending' where id = '${i2.inviteId}';`);
    const r = accept(p2.id, i2.token);
    expect(r.outcome).toBe("manual_review");
    expect(r.reason).toBe("student_in_other_household");
  });

  it("보호자가 랜딩 폼으로 먼저 상담 신청함 → 기존 열린 상담 재사용(행 수 불변), child_id/household_id만 채움", () => {
    const s = freeStudent("reuse");
    const p = parent("reuse-parent");
    const existing = psql(
      `select id from submit_homepage_consult_request('Parent reuse', '${p.email}', '010-0000-0000', null, '10', 'landing', '${RUN}-idem');`,
    );
    const before = count(`select count(*) from consultations`);
    const r = accept(p.id, invite(s.id, p.email).token);
    expect(r.consultationId).toBe(existing);
    expect(count(`select count(*) from consultations`)).toBe(before);
    expect(psql(`select child_id, household_id, source from consultations where id = '${existing}'`)).toBe(`${s.id}|${r.householdId}|homepage`);
    // prospect도 랜딩 것 재사용(이메일 동일) + converted_guardian_id 명시 설정
    expect(count(`select count(*) from prospect_contacts where primary_email_normalized = '${p.email}'`)).toBe(1);
    expect(psql(`select converted_guardian_id from prospect_contacts where primary_email_normalized = '${p.email}'`)).toBe(p.id);
  });

  it("자동배정 꺼짐 → 상담은 미배정 requested, 예약 토큰 없음, 재발급도 not_assigned", () => {
    psql(`update consultant_assignment_settings set auto_assign_enabled = false where id = true;`);
    try {
      const s = freeStudent("noassign");
      const p = parent("noassign-parent");
      const r = accept(p.id, invite(s.id, p.email).token);
      expect(r.outcome).toBe("accepted");
      expect(r.schedulingToken).toBe("");
      expect(psql(`select admissions_consultant_id is null from consultations where id = '${r.consultationId}'`)).toBe("t");
      expect(() => psqlAsUser(p.id, `select reissue_consult_scheduling_link_for_parent('${r.consultationId}');`)).toThrow(/not_assigned/);
    } finally {
      psql(`update consultant_assignment_settings set auto_assign_enabled = true where id = true;`);
    }
  });

  it("수락 후 예약 이탈: 링크 만료 → 보호자가 재발급(기존 유효 링크면 같은 토큰), 다른 보호자는 불가", () => {
    const s = freeStudent("reissue");
    const p = parent("reissue-parent");
    const other = parent("reissue-other");
    const r = accept(p.id, invite(s.id, p.email).token);
    expect(psqlAsUser(p.id, `select reissue_consult_scheduling_link_for_parent('${r.consultationId}');`)).toBe(r.schedulingToken);
    psql(`update consultation_scheduling_links set expires_at = now() - interval '1 hour' where token = '${r.schedulingToken}';`);
    const fresh = psqlAsUser(p.id, `select reissue_consult_scheduling_link_for_parent('${r.consultationId}');`);
    expect(fresh).not.toBe(r.schedulingToken);
    expect(() => psqlAsUser(other.id, `select reissue_consult_scheduling_link_for_parent('${r.consultationId}');`)).toThrow(/not_found/);
    // 예약 확정 후에는 already_scheduled
    const slot = psql(`select (date_trunc('hour', now()) + interval '2 days')::timestamptz;`);
    psql(`select redeem_consultation_scheduling_link('${fresh}', '${slot}');`);
    expect(() => psqlAsUser(p.id, `select reissue_consult_scheduling_link_for_parent('${r.consultationId}');`)).toThrow(/already_scheduled/);
    expect(psqlAsUser(p.id, `select status from family_free_member_consult_status();`)).toBe("scheduled");
    expect(psql(`select status from student_consult_interests where student_id = '${s.id}'`)).toBe("booked");
  });

  it("리마인더 후보: 초대 3일 미수락 / 수락 2일 미예약 각 1회, 기록 후 재후보 아님", () => {
    const s = freeStudent("remind");
    const p = parent("remind-parent");
    const inv = invite(s.id, p.email);
    psql(`update guardian_link_invites set last_sent_at = now() - interval '4 days' where id = '${inv.inviteId}';`);
    expect(psqlAsUser(ADMIN, `select kind from list_guardian_link_reminder_candidates() where invite_id = '${inv.inviteId}';`)).toBe("unaccepted");
    // 리마인더 토큰 회전: 이전 토큰 superseded, 새 토큰은 같은 만료·last_sent_at, 학생 쿼터 미소비, 재후보 아님
    const [newId, newToken] = psqlAsUser(ADMIN, `select invite_id, raw_token from issue_guardian_link_reminder_token('${inv.inviteId}');`).split("|");
    expect(psql(`select status from guardian_link_invites where id = '${inv.inviteId}'`)).toBe("superseded");
    expect(psql(`select (a.expires_at = b.expires_at) and (a.last_sent_at = b.last_sent_at) from guardian_link_invites a, guardian_link_invites b where a.id = '${inv.inviteId}' and b.id = '${newId}'`)).toBe("t");
    expect(count(`select count(*) from guardian_link_invite_events e join guardian_link_invites i on i.id = e.invite_id where i.student_id = '${s.id}' and e.event_type = 'resent'`)).toBe(0);
    expect(psqlAsUser(ADMIN, `select count(*) from list_guardian_link_reminder_candidates() where invite_id in ('${inv.inviteId}', '${newId}');`)).toBe("0");
    expect(psqlAsUser(null, `select status from claim_guardian_link_invite('${inv.token}');`)).toBe("superseded");
    accept(p.id, newToken);
    psql(`update guardian_link_invites set accepted_at = now() - interval '3 days' where id = '${newId}';`);
    expect(psqlAsUser(ADMIN, `select kind, scheduling_token is not null from list_guardian_link_reminder_candidates() where invite_id = '${newId}';`)).toBe("unbooked|t");
    psqlAsUser(ADMIN, `select mark_guardian_link_reminder_sent('${newId}', 'unbooked');`);
    expect(psqlAsUser(ADMIN, `select count(*) from list_guardian_link_reminder_candidates() where invite_id = '${newId}';`)).toBe("0");
  });
});

describe("free_member_learning_summary (…0005)", () => {
  it("담당 컨설턴트만 집계 열람(감사 기록), 학생·보호자·다른 컨설턴트·교사는 거절, 철회 후 거절", () => {
    const s = freeStudent("summary");
    const p = parent("summary-parent");
    psql(`insert into vocab_words (student_id, word, definition) values ('${s.id}', 'alpha', 'a'), ('${s.id}', 'beta', 'b');`);
    const r = accept(p.id, invite(s.id, p.email).token);
    const assigned = psql(`select admissions_consultant_id from consultations where id = '${r.consultationId}'`);
    const otherConsultant = authUser(`${RUN}-other-consultant@example.com`, "oc");
    psql(`insert into profiles (id, role, name) values ('${otherConsultant}', 'consultant', 'Other');`);

    const json = psqlAsUser(assigned, `select free_member_learning_summary('${s.id}')::text;`);
    const parsed = JSON.parse(json);
    expect(parsed.vocabWordCount).toBe(2);
    expect(parsed.attemptCount).toBe(0);
    expect(Object.keys(parsed).sort()).toEqual(["attemptCount", "gradedAttemptCount", "lastActivityAt", "recentAttempts", "scope", "vocabWordCount", "weakestDomains", "weakestSkills"]);
    expect(json).not.toMatch(/alpha|beta|response|note|annotation/);
    expect(count(`select count(*) from learning_summary_access_audit where student_id = '${s.id}' and viewer_id = '${assigned}'`)).toBe(1);

    expect(() => psqlAsUser(s.id, `select free_member_learning_summary('${s.id}');`)).toThrow(/not_assigned_consultant/);
    expect(() => psqlAsUser(p.id, `select free_member_learning_summary('${s.id}');`)).toThrow(/not_assigned_consultant/);
    expect(() => psqlAsUser(otherConsultant, `select free_member_learning_summary('${s.id}');`)).toThrow(/not_assigned_consultant/);
    // 컨설턴트 배정이 생기지 않았으므로 기존 상세 열람 권한도 열리지 않는다
    expect(psqlAsUser(assigned, `select _mock_exam_can_view('${s.id}');`)).toBe("f");

    psqlAsUser(p.id, `select revoke_learning_summary_grant('${s.id}');`);
    expect(() => psqlAsUser(assigned, `select free_member_learning_summary('${s.id}');`)).toThrow(/no_active_grant/);
  });
});

describe("has_tutoring_access — 초대(account_invites)로 생성된 학생", () => {
  it("accepted account_invite 학생은 household 없이도 과외 키를 유지한다", () => {
        const id = authUser(`${RUN}-invited@example.com`, "invited");
    psql(`insert into profiles (id, role, name) values ('${id}', 'student', 'Invited');`);
    psql(`insert into students (id, grade, status, member_type) values ('${id}', '9', 'active', 'tutoring');`);
    expect(psql(`select has_tutoring_access('${id}')`)).toBe("f");
    const hh = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
    psql(`set session_replication_role = replica; insert into account_invites (email_normalized, email_original, invitee_name, role, household_id, invited_by, status, token_hash, expires_at, target_profile_id)
      values ('${RUN}-invited@example.com', '${RUN}-invited@example.com', 'Invited', 'student', '${hh}', '${ADMIN}', 'accepted', '${RUN}-hash', now() + interval '1 day', '${id}');`);
    expect(psql(`select has_tutoring_access('${id}')`)).toBe("t");
    expect(psqlAsUser(id, `select array_to_string(student_feature_access('${id}'), ',');`)).toMatch(/class/);
  });
});
