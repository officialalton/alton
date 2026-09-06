import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-06(제품 오너 최종 확정안) — 복수 자녀 온보딩의 DB 레이어를 로컬
// Postgres에 직접 psql로 검증한다(app/consult/existing-guardian-reconsult.
// integration.test.ts와 동일한 패턴). 앱 레이어(Auth 계정 생성 자체)는 Node의
// admin.auth.admin.createUser()가 담당하므로 여기서는 그 결과로 이미 Auth
// 계정이 존재한다고 가정하고 finalize_trial_onboarding_students()/
// retry_trial_onboarding_student()가 올바르게 동작하는지만 검증한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createAuthUser(label: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
}

function createConsultationWithProspect(label: string, guardianEmail: string): { consultationId: string; prospectContactId: string } {
  const prospectContactId = psql(
    `insert into prospect_contacts (full_name, primary_email) values ('${label}', '${guardianEmail}') returning id;`
  );
  const consultationId = psql(
    `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
     values ('homepage', 'completed', 'trial_recommended', '${label}', '${guardianEmail}', now(), now() + interval '30 minutes', '${prospectContactId}', now())
     returning id;`
  );
  return { consultationId, prospectContactId };
}

function createLinkWithStudents(
  consultationId: string,
  prospectContactId: string,
  guardianEmail: string,
  guardianName: string,
  students: { name: string; email: string; grade?: string }[]
): { linkId: string; studentLinkIds: string[] } {
  const linkId = psql(
    `insert into trial_onboarding_links (consultation_id, prospect_contact_id, guardian_email, guardian_name, token_hash, expires_at)
     values ('${consultationId}', '${prospectContactId}', '${guardianEmail}', '${guardianName}', 'unused-hash-${Date.now()}-${Math.random()}', now() + interval '72 hours')
     returning id;`
  );
  const studentLinkIds = students.map((s) =>
    psql(
      `insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade)
       values ('${linkId}', '${s.name}', '${s.email}', ${s.grade ? `'${s.grade}'` : "null"})
       returning id;`
    )
  );
  return { linkId, studentLinkIds };
}

describe("finalize_trial_onboarding_students() — 신규 보호자, 학생 1명(기존 단일 자녀 흐름 회귀 없음)", () => {
  it("신규 보호자 계정·household를 1회 생성하고 학생 1명을 연결한다", () => {
    const guardianAuthId = createAuthUser("new-guardian-single");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("단일자녀상담", guardianEmail);
    const childAuthId = createAuthUser("single-child");
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "단일보호자", [
      { name: "학생1", email: `s1-${Date.now()}@example.com`, grade: "9학년" },
    ]);

    const result = psql(
      `select household_id, guardian_id, created_count, failed_count from finalize_trial_onboarding_students(
         '${linkId}', true, '${guardianAuthId}', '단일보호자',
         '[{"link_student_id":"${studentLinkIds[0]}","child_auth_user_id":"${childAuthId}"}]'::jsonb
       );`
    );
    const [householdId, returnedGuardianId, createdCount, failedCount] = result.split("|");
    expect(returnedGuardianId).toBe(guardianAuthId);
    expect(createdCount).toBe("1");
    expect(failedCount).toBe("0");

    const householdCount = psql(`select count(*) from households where primary_guardian_id = '${guardianAuthId}';`);
    expect(householdCount).toBe("1");
    const childRole = psql(`select role from household_members where household_id = '${householdId}' and profile_id = '${childAuthId}';`);
    expect(childRole).toBe("child");
    const linkStatus = psql(`select status from trial_onboarding_links where id = '${linkId}';`);
    expect(linkStatus).toBe("redeemed");
    const studentStatus = psql(`select status from trial_onboarding_link_students where id = '${studentLinkIds[0]}';`);
    expect(studentStatus).toBe("created");
  });
});

describe("finalize_trial_onboarding_students() — 신규 보호자, 학생 3명", () => {
  it("household·보호자 profile은 1개만 생성하고 학생 3명 모두 같은 household에 연결한다", () => {
    const guardianAuthId = createAuthUser("new-guardian-triple");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("삼자녀상담", guardianEmail);
    const childIds = [createAuthUser("triple-a"), createAuthUser("triple-b"), createAuthUser("triple-c")];
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "삼자녀보호자", [
      { name: "학생A", email: `ta-${Date.now()}@example.com` },
      { name: "학생B", email: `tb-${Date.now()}@example.com` },
      { name: "학생C", email: `tc-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify(
      studentLinkIds.map((id, i) => ({ link_student_id: id, child_auth_user_id: childIds[i] }))
    ).replace(/'/g, "''");

    const result = psql(
      `select household_id, created_count, failed_count from finalize_trial_onboarding_students(
         '${linkId}', true, '${guardianAuthId}', '삼자녀보호자', '${studentsJson}'::jsonb
       );`
    );
    const [householdId, createdCount, failedCount] = result.split("|");
    expect(createdCount).toBe("3");
    expect(failedCount).toBe("0");

    const householdCount = psql(`select count(*) from households where primary_guardian_id = '${guardianAuthId}';`);
    expect(householdCount).toBe("1");
    const childCount = psql(`select count(*) from household_members where household_id = '${householdId}' and role = 'child';`);
    expect(childCount).toBe("3");
  });
});

describe("finalize_trial_onboarding_students() — 기존 보호자, 새 자녀 3명", () => {
  it("기존 household를 재사용하고(새 household 미생성) 자녀 3명을 추가한다", () => {
    const guardianAuthId = createAuthUser("existing-guardian-triple");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    psql(`insert into profiles (id, role, name) values ('${guardianAuthId}', 'parent', '기존보호자');`);
    psql(`insert into parents (id) values ('${guardianAuthId}');`);
    const existingHouseholdId = psql(`insert into households (primary_guardian_id) values ('${guardianAuthId}') returning id;`);
    psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${existingHouseholdId}', '${guardianAuthId}', 'guardian', true);`);

    const { consultationId, prospectContactId } = createConsultationWithProspect("재상담삼자녀", guardianEmail);
    const childIds = [createAuthUser("re-a"), createAuthUser("re-b"), createAuthUser("re-c")];
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "재상담보호자", [
      { name: "재학생A", email: `ra-${Date.now()}@example.com` },
      { name: "재학생B", email: `rb-${Date.now()}@example.com` },
      { name: "재학생C", email: `rc-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify(
      studentLinkIds.map((id, i) => ({ link_student_id: id, child_auth_user_id: childIds[i] }))
    ).replace(/'/g, "''");

    const householdCountBefore = psql(`select count(*) from households where primary_guardian_id = '${guardianAuthId}';`);
    expect(householdCountBefore).toBe("1");

    const result = psql(
      `select household_id, created_count, failed_count from finalize_trial_onboarding_students(
         '${linkId}', false, '${guardianAuthId}', '재상담보호자', '${studentsJson}'::jsonb
       );`
    );
    const [householdId, createdCount, failedCount] = result.split("|");
    expect(householdId).toBe(existingHouseholdId);
    expect(createdCount).toBe("3");
    expect(failedCount).toBe("0");

    const householdCountAfter = psql(`select count(*) from households where primary_guardian_id = '${guardianAuthId}';`);
    expect(householdCountAfter).toBe("1");
    const childCount = psql(`select count(*) from household_members where household_id = '${existingHouseholdId}' and role = 'child';`);
    expect(childCount).toBe("3");
  });
});

describe("finalize_trial_onboarding_students() — 부분 실패 후 해당 자녀만 재시도", () => {
  it("학생 1명 처리가 실패해도 형제자매는 정상 처리되고, 실패한 학생만 재시도로 성공시킬 수 있다", () => {
    const guardianAuthId = createAuthUser("partial-fail-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("부분실패상담", guardianEmail);
    const okChildId = createAuthUser("partial-ok-child");
    // 일부러 잘못된(존재하지 않는) auth user id를 넘겨 students 테이블 FK 없이도
    // profiles insert가 학생 이름 자체는 통과하지만, 두 번째 학생은 아예 실패하는
    // 경우를 흉내내기 위해 이미 다른 곳에서 studetns 행으로 쓰인 child_auth_user_id를
    // 중복 사용해 유니크 제약 위반을 일으킨다(현실적인 실패 시나리오 — 동시 처리
    // 중 같은 auth id가 이미 다른 학생에 연결된 경우).
    const alreadyUsedChildId = createAuthUser("partial-conflict-child");
    const conflictConsultation = createConsultationWithProspect("선점용상담", `preholder-${Date.now()}@example.com`);
    const preLink = createLinkWithStudents(
      conflictConsultation.consultationId,
      conflictConsultation.prospectContactId,
      `preholder-${Date.now()}@example.com`,
      "선점보호자",
      [{ name: "선점학생", email: `pre-${Date.now()}@example.com` }]
    );
    psql(
      `select finalize_trial_onboarding_students('${preLink.linkId}', true, '${createAuthUser("preholder-guardian")}', '선점보호자',
        '[{"link_student_id":"${preLink.studentLinkIds[0]}","child_auth_user_id":"${alreadyUsedChildId}"}]'::jsonb);`
    );

    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "부분실패보호자", [
      { name: "성공학생", email: `ok-${Date.now()}@example.com` },
      { name: "실패학생", email: `fail-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([
      { link_student_id: studentLinkIds[0], child_auth_user_id: okChildId },
      { link_student_id: studentLinkIds[1], child_auth_user_id: alreadyUsedChildId }, // 유니크 제약 위반 유도
    ]).replace(/'/g, "''");

    const result = psql(
      `select household_id, created_count, failed_count from finalize_trial_onboarding_students(
         '${linkId}', true, '${guardianAuthId}', '부분실패보호자', '${studentsJson}'::jsonb
       );`
    );
    const [householdId, createdCount, failedCount] = result.split("|");
    expect(createdCount).toBe("1");
    expect(failedCount).toBe("1");

    // 성공한 형제(성공학생)는 롤백되지 않았어야 한다.
    const okStatus = psql(`select status from trial_onboarding_link_students where id = '${studentLinkIds[0]}';`);
    expect(okStatus).toBe("created");
    const failStatus = psql(`select status from trial_onboarding_link_students where id = '${studentLinkIds[1]}';`);
    expect(failStatus).toBe("failed");
    const failError = psql(`select error from trial_onboarding_link_students where id = '${studentLinkIds[1]}';`);
    expect(failError.length).toBeGreaterThan(0);
    // 링크 자체는 household가 확정됐으므로 redeemed로 남는다(재시도 가능해야 함).
    const linkStatus = psql(`select status from trial_onboarding_links where id = '${linkId}';`);
    expect(linkStatus).toBe("redeemed");

    // 이제 실패한 학생만 새 Auth id로 재시도한다(다른 형제 재처리 없음).
    const retryChildId = createAuthUser("partial-retry-child");
    const retryResult = psql(
      `select child_id, status from retry_trial_onboarding_student('${linkId}', '${studentLinkIds[1]}', '${retryChildId}');`
    );
    const [retriedChildId, retriedStatus] = retryResult.split("|");
    expect(retriedChildId).toBe(retryChildId);
    expect(retriedStatus).toBe("created");

    const childCount = psql(`select count(*) from household_members where household_id = '${householdId}' and role = 'child';`);
    expect(childCount).toBe("2"); // 성공학생 + 재시도로 성공한 실패학생.

    // 재시도 후 성공학생은 다시 처리되지 않는다(멱등) — 여전히 1건만 연결.
    const okMemberCount = psql(`select count(*) from household_members where profile_id = '${okChildId}';`);
    expect(okMemberCount).toBe("1");
  });
});

describe("finalize_trial_onboarding_students() — 동시 재시도 시 중복 생성 안 됨", () => {
  it("같은 링크·같은 학생에 finalize를 두 번 호출해도(멱등) 학생 계정 연결이 중복되지 않는다", () => {
    const guardianAuthId = createAuthUser("concurrent-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("동시성상담", guardianEmail);
    const childId = createAuthUser("concurrent-child");
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "동시성보호자", [
      { name: "동시성학생", email: `conc-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkIds[0], child_auth_user_id: childId }]).replace(/'/g, "''");

    // 첫 번째 호출(성공).
    const first = psql(
      `select created_count from finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '동시성보호자', '${studentsJson}'::jsonb);`
    );
    expect(first).toBe("1");

    // 재시도(같은 파라미터로 다시 호출 — 네트워크 재시도를 흉내) — status='created'
    // 확인으로 재처리를 건너뛰므로 중복 household_members insert가 발생하지 않는다.
    const second = psql(
      `select created_count from finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '동시성보호자', '${studentsJson}'::jsonb);`
    );
    expect(second).toBe("1");

    const memberCount = psql(`select count(*) from household_members where profile_id = '${childId}';`);
    expect(memberCount).toBe("1");

    // DB 유니크 제약 자체도 이중 방어로 살아있는지 직접 확인 — 이미 created인
    // child_auth_user_id를 다른 학생 항목에 억지로 연결하려 하면 거부돼야 한다.
    const otherStudentLinkId = psql(
      `insert into trial_onboarding_link_students (link_id, student_name, student_email)
       values ('${linkId}', '다른학생', 'other-${Date.now()}@example.com') returning id;`
    );
    expect(() =>
      psql(`update trial_onboarding_link_students set status = 'created', child_auth_user_id = '${childId}' where id = '${otherStudentLinkId}';`)
    ).toThrow();
  });
});
