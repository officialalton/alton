import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-06(제품 오너 검수 지적 반영) — 학생 계정 생성 성공한 자녀마다 기존
// 단일 칸반에 독립 카드가 실제로 생기는지 로컬 Postgres에 직접 psql로
// 검증한다(app/consult/multichild-trial-onboarding.integration.test.ts와 동일
// 패턴 — DB 레이어만 검증, Auth 계정 생성 자체는 Node가 담당한다고 가정).
//
// 정책 재확인: 별도 관리자 보드 신설 없음(consultations 테이블 그대로 재사용),
// 원 상담(가족) 카드는 이력으로 남고 child_id가 절대 설정되지 않아 더 이상
// 단계 이동하지 않는다(자동으로 달성 — getTrialOnboardingPipelineAction이
// child_id=null이면 account_linked=false로 영원히 고정).

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

describe("finalize_trial_onboarding_students() — 학생별 칸반 카드 생성", () => {
  it("신규 보호자·학생 3명 모두 계정 생성 성공하면 consultations에 학생별 카드가 3건 생기고 원 상담은 이력으로 멈춘다", () => {
    const guardianAuthId = createAuthUser("card-new-guardian-triple");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("카드삼자녀상담", guardianEmail);
    const childIds = [createAuthUser("card-a"), createAuthUser("card-b"), createAuthUser("card-c")];
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "카드삼자녀보호자", [
      { name: "카드학생A", email: `cka-${Date.now()}@example.com` },
      { name: "카드학생B", email: `ckb-${Date.now()}@example.com` },
      { name: "카드학생C", email: `ckc-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify(
      studentLinkIds.map((id, i) => ({ link_student_id: id, child_auth_user_id: childIds[i] }))
    ).replace(/'/g, "''");

    psql(
      `select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드삼자녀보호자', '${studentsJson}'::jsonb);`
    );

    // 학생별 카드 3건 — 실측(추정 아님).
    const cardCount = psql(
      `select count(*) from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(cardCount).toBe("3");

    const cardChildIds = psql(
      `select child_id::text from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card order by child_id;`
    ).split("\n");
    expect(new Set(cardChildIds)).toEqual(new Set(childIds));

    // 원 상담(가족) 카드는 child_id가 절대 설정되지 않아 이력으로 멈춘다.
    const rootChildId = psql(`select coalesce(child_id::text, 'null') from consultations where id = '${consultationId}';`);
    expect(rootChildId).toBe("null");
    const rootIsChildCard = psql(`select is_child_onboarding_card from consultations where id = '${consultationId}';`);
    expect(rootIsChildCard).toBe("f");

    // 총 카드 수는 원 카드 1 + 학생 카드 3 = 4.
    const totalRelatedCards = psql(
      `select count(*) from consultations where id = '${consultationId}' or family_root_consultation_id = '${consultationId}';`
    );
    expect(totalRelatedCards).toBe("4");
  });

  it("동일 상담·동일 자녀로 finalize를 재호출해도(멱등) 카드가 중복 생성되지 않는다", () => {
    const guardianAuthId = createAuthUser("card-idem-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("카드멱등상담", guardianEmail);
    const childId = createAuthUser("card-idem-child");
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "카드멱등보호자", [
      { name: "카드멱등학생", email: `ckidem-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkIds[0], child_auth_user_id: childId }]).replace(/'/g, "''");

    psql(`select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드멱등보호자', '${studentsJson}'::jsonb);`);
    psql(`select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드멱등보호자', '${studentsJson}'::jsonb);`);

    const cardCount = psql(
      `select count(*) from consultations where source_link_child_id = '${studentLinkIds[0]}';`
    );
    expect(cardCount).toBe("1");
  });

  it("동시(직렬로 흉내낸) 재호출에도 unique 제약이 카드 중복을 막는다 — source_link_child_id에 직접 카드를 2번째로 insert하면 거부된다", () => {
    const guardianAuthId = createAuthUser("card-concurrent-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("카드동시성상담", guardianEmail);
    const childId = createAuthUser("card-concurrent-child");
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "카드동시성보호자", [
      { name: "카드동시성학생", email: `ckconc-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkIds[0], child_auth_user_id: childId }]).replace(/'/g, "''");
    psql(`select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드동시성보호자', '${studentsJson}'::jsonb);`);

    expect(() =>
      psql(
        `insert into consultations (contact_name, contact_email, status, outcome, source_link_child_id)
         values ('중복카드', '${guardianEmail}', 'completed', 'trial_recommended', '${studentLinkIds[0]}');`
      )
    ).toThrow();
  });

  it("부분 실패 후 재시도로 성공한 학생만 그 시점에 카드가 생긴다(실패 형제자매 카드 없음, 재시도 성공 후 카드 1건 추가)", () => {
    const guardianAuthId = createAuthUser("card-partial-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("카드부분실패상담", guardianEmail);
    const okChildId = createAuthUser("card-partial-ok-child");
    const alreadyUsedChildId = createAuthUser("card-partial-conflict-child");
    const conflictConsultation = createConsultationWithProspect("카드선점용상담", `card-preholder-${Date.now()}@example.com`);
    const preLink = createLinkWithStudents(
      conflictConsultation.consultationId,
      conflictConsultation.prospectContactId,
      `card-preholder-${Date.now()}@example.com`,
      "카드선점보호자",
      [{ name: "카드선점학생", email: `ckpre-${Date.now()}@example.com` }]
    );
    psql(
      `select finalize_trial_onboarding_students('${preLink.linkId}', true, '${createAuthUser("card-preholder-guardian")}', '카드선점보호자',
        '[{"link_student_id":"${preLink.studentLinkIds[0]}","child_auth_user_id":"${alreadyUsedChildId}"}]'::jsonb);`
    );

    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "카드부분실패보호자", [
      { name: "카드성공학생", email: `ckok-${Date.now()}@example.com` },
      { name: "카드실패학생", email: `ckfail-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([
      { link_student_id: studentLinkIds[0], child_auth_user_id: okChildId },
      { link_student_id: studentLinkIds[1], child_auth_user_id: alreadyUsedChildId },
    ]).replace(/'/g, "''");

    psql(
      `select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드부분실패보호자', '${studentsJson}'::jsonb);`
    );

    // 성공 학생만 카드 1건 — 실패 학생은 아직 카드 없음.
    let cardCount = psql(
      `select count(*) from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(cardCount).toBe("1");

    // 실패한 학생만 재시도(형제자매는 건드리지 않음).
    const retryChildId = createAuthUser("card-partial-retry-child");
    psql(`select retry_trial_onboarding_student('${linkId}', '${studentLinkIds[1]}', '${retryChildId}');`);

    cardCount = psql(
      `select count(*) from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(cardCount).toBe("2");

    // 성공했던 형제자매의 카드는 그대로(재생성/중복 없음).
    const okCardCount = psql(`select count(*) from consultations where source_link_child_id = '${studentLinkIds[0]}';`);
    expect(okCardCount).toBe("1");
  });

  it("계정 생성 실패 재시도(p_stage='account', 기본값)와 초대만 재시도(p_stage='invite')는 서로 독립적이다", () => {
    const guardianAuthId = createAuthUser("card-stage-guardian");
    const guardianEmail = psql(`select email from auth.users where id = '${guardianAuthId}';`);
    const { consultationId, prospectContactId } = createConsultationWithProspect("카드단계상담", guardianEmail);
    const childId = createAuthUser("card-stage-child");
    const { linkId, studentLinkIds } = createLinkWithStudents(consultationId, prospectContactId, guardianEmail, "카드단계보호자", [
      { name: "카드단계학생", email: `ckstage-${Date.now()}@example.com` },
    ]);
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkIds[0], child_auth_user_id: childId }]).replace(/'/g, "''");
    psql(`select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '카드단계보호자', '${studentsJson}'::jsonb);`);

    // 계정은 이미 created 상태 — invite 재시도는 invite_retry_count만 올리고 계정/카드는 건드리지 않는다.
    psql(`select retry_trial_onboarding_student('${linkId}', '${studentLinkIds[0]}', '${childId}', 'invite');`);
    const retryCount = psql(`select invite_retry_count from trial_onboarding_link_students where id = '${studentLinkIds[0]}';`);
    expect(retryCount).toBe("1");
    const cardCountAfterInviteRetry = psql(`select count(*) from consultations where source_link_child_id = '${studentLinkIds[0]}';`);
    expect(cardCountAfterInviteRetry).toBe("1");

    // 같은(이미 redeemed된) 링크에 아직 계정이 없는 학생을 추가하고 invite 재시도를
    // 요청하면 거부된다(계정 생성이 먼저 필요).
    const pendingStudentId = psql(
      `insert into trial_onboarding_link_students (link_id, student_name, student_email)
       values ('${linkId}', '카드단계학생2', 'ckstage2-${Date.now()}@example.com') returning id;`
    );
    expect(() =>
      psql(`select retry_trial_onboarding_student('${linkId}', '${pendingStudentId}', '${createAuthUser("card-stage-child2")}', 'invite');`)
    ).toThrow(/계정 생성 재시도가 먼저 필요/);
  });
});
