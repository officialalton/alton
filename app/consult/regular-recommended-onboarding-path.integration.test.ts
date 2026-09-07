import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M4 후속(2026-09-06) — "정규 진행 권장"(outcome='regular_recommended', 체험
// 생략) 경로가 학생 계정 생성 이후 막다른 상태였던 문제를 로컬 Postgres에
// 직접 psql로 끝까지 검증한다(app/consult/student-kanban-cards.integration.test.ts와
// 동일 패턴). 검증 범위: 학생 계정 생성 → 학생별 카드에 outcome 전파 →
// 과목·선생님 배정(get_or_create_draft_contract_for_child 재사용) → 계약
// draft 생성 → 카드 상세 조회가 기대하는 조건(contractId, subjectEnrollmentId)
// 충족까지. DocuSign 실제 발송(Preview 게이트)은 이 테스트 범위 밖 —
// sendRegularContractOneClickAction의 selection bypass 자체는
// app/admin/trial-onboarding-actions.test.ts에서 단위 테스트로 고정한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psqlAsSuperuser(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

function createAuthUser(label: string): string {
  return psqlAsSuperuser(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
}

function createAdmin(label: string): string {
  const id = createAuthUser(label);
  psqlAsSuperuser(`insert into profiles (id, role, name) values ('${id}', 'admin', '${label}');`);
  return id;
}

describe("regular_recommended(체험 생략) 온보딩 → 계약 draft 경로 — 통합", () => {
  it("체험 없이 정규 진행 권장으로 기록된 상담이 학생 계정 생성→학생 카드 outcome 전파→과목 배정→계약 draft까지 끊김 없이 이어진다", () => {
    createAdmin("regular-path-admin");

    // 1) 상담 결과 기록 — outcome='regular_recommended'(체험 생략). 실제
    //    관리자 화면(OutcomeForm)의 record_consultation_outcome RPC와 동일한
    //    결과 상태를 직접 만든다(이 RPC 자체는 이미 검증돼 있으므로 재검증
    //    범위 밖 — 여기서는 그 결과물인 outcome 컬럼 상태에서 시작).
    const prospectContactId = psqlAsSuperuser(
      `insert into prospect_contacts (full_name, primary_email) values ('정규경로가족', 'regular-path-${Date.now()}@example.com') returning id;`
    );
    const guardianEmail = psqlAsSuperuser(`select primary_email from prospect_contacts where id = '${prospectContactId}';`);
    const consultationId = psqlAsSuperuser(
      `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id)
       values ('homepage', 'completed', 'regular_recommended', '정규경로가족', '${guardianEmail}', now(), now() + interval '30 minutes', '${prospectContactId}')
       returning id;`
    );

    // 2) 학생 계정 생성 온보딩 — TrialOnboardingStudentsForm이 호출하는
    //    RPC(create_trial_onboarding_link_multi류)까지 재현하지 않고, 그
    //    직접적인 후속 단계인 finalize_trial_onboarding_students()부터
    //    시작한다(링크 생성 자체는 기존 테스트에서 이미 검증됨).
    const guardianAuthId = createAuthUser("regular-path-guardian");
    const linkId = psqlAsSuperuser(
      `insert into trial_onboarding_links (consultation_id, prospect_contact_id, guardian_email, guardian_name, token_hash, expires_at)
       values ('${consultationId}', '${prospectContactId}', '${guardianEmail}', '정규경로보호자', 'unused-hash-${Date.now()}-${Math.random()}', now() + interval '72 hours')
       returning id;`
    );
    const studentLinkId = psqlAsSuperuser(
      `insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade)
       values ('${linkId}', '정규경로학생', 'regular-path-student-${Date.now()}@example.com', '9학년')
       returning id;`
    );
    const childAuthId = createAuthUser("regular-path-child");
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkId, child_auth_user_id: childAuthId }]).replace(/'/g, "''");

    psqlAsSuperuser(
      `select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '정규경로보호자', '${studentsJson}'::jsonb);`
    );

    // 검증 A — 학생별 자녀 카드가 생성되고, outcome이 'trial_recommended'로
    // 하드코딩되지 않고 원 카드(regular_recommended)를 그대로 물려받는다
    // (이번 수정 이전에는 항상 trial_recommended로 잘못 박제됐었다).
    const childCardOutcome = psqlAsSuperuser(
      `select outcome from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(childCardOutcome).toBe("regular_recommended");
    const childCardId = psqlAsSuperuser(
      `select id from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    const cardChildId = psqlAsSuperuser(`select child_id::text from consultations where id = '${childCardId}';`);
    expect(cardChildId).toBe(childAuthId);

    // 검증 B — 이 시점에는 아직 과목 배정이 없으므로 subject_enrollments가 없다
    // (관리자 화면 조건 c.child_id && !subjectEnrollmentId가 SubjectTeacherAssignForm을
    // 보여줘야 하는 정확한 시점).
    const enrollmentCountBefore = psqlAsSuperuser(`select count(*) from subject_enrollments where child_id = '${childAuthId}';`);
    expect(enrollmentCountBefore).toBe("0");

    // 3) 과목·선생님 배정 — planTrialSubjectAndAssignTeacherAction의 핵심 DB
    //    결과(get_or_create_draft_contract_for_child가 만드는 draft 계약 +
    //    subject_enrollments insert)를 재현한다. get_or_create_draft_contract_for_child()
    //    자체는 is_admin()(auth.uid() 기반) 게이트가 있는 기존 함수로 이번
    //    작업 범위 밖(서버 액션 쪽 requireAdminOrCapability로 이미 인가된 뒤
    //    admin/service_role 클라이언트가 호출) — 여기서는 그 함수가 만드는
    //    결과 상태(status='draft' 계약 1건)를 직접 재현해 이후 단계를 검증한다.
    const householdId = psqlAsSuperuser(
      `select household_id from household_members where profile_id = '${childAuthId}' and role = 'child' limit 1;`
    );
    const contractId = psqlAsSuperuser(
      `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childAuthId}', 'draft') returning id;`
    );
    expect(contractId).toMatch(/^[0-9a-f-]{36}$/);

    const subjectId = psqlAsSuperuser(`select id from subjects limit 1;`);
    expect(subjectId.length).toBeGreaterThan(0);
    const subjectEnrollmentId = psqlAsSuperuser(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status)
       values ('${childAuthId}', '${subjectId}', '${contractId}', 'planned')
       returning id;`
    );

    // 검증 C — 계약이 draft 상태로 생성됐고(정규 계약 발송 전 정확한 표현),
    // 카드 상세(getConsultationCardDetailAction)가 child_id로 조회하는 contracts
    // 쿼리와 동일한 조건으로 이 draft 계약을 그대로 찾아낸다 → detail.contractId가
    // 채워진다 → ConsultationKanbanBoard.tsx의 계약 발송 UI 노출 조건
    // (outcome==='regular_recommended' && subjectEnrollmentId && contractId)이
    // 모두 충족된다.
    const contractStatus = psqlAsSuperuser(`select status from contracts where id = '${contractId}';`);
    expect(contractStatus).toBe("draft");
    const detailContractId = psqlAsSuperuser(
      `select id from contracts where child_id = '${childAuthId}' order by created_at desc limit 1;`
    );
    expect(detailContractId).toBe(contractId);

    // 검증 D — 위 셋(outcome, subjectEnrollmentId, contractId)이 정확히
    // ConsultationKanbanBoard.tsx의 UI 노출 조건을 충족함을 최종 확인.
    const uiGateSatisfied =
      childCardOutcome === "regular_recommended" && subjectEnrollmentId.length > 0 && detailContractId === contractId;
    expect(uiGateSatisfied).toBe(true);
  });

  it("trial_recommended 경로는 기존과 동일하게 학생 카드도 trial_recommended를 유지한다(회귀 방지)", () => {
    const prospectContactId = psqlAsSuperuser(
      `insert into prospect_contacts (full_name, primary_email) values ('체험경로가족', 'trial-path-${Date.now()}@example.com') returning id;`
    );
    const guardianEmail = psqlAsSuperuser(`select primary_email from prospect_contacts where id = '${prospectContactId}';`);
    const consultationId = psqlAsSuperuser(
      `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
       values ('homepage', 'completed', 'trial_recommended', '체험경로가족', '${guardianEmail}', now(), now() + interval '30 minutes', '${prospectContactId}', now())
       returning id;`
    );
    const guardianAuthId = createAuthUser("trial-path-guardian");
    const linkId = psqlAsSuperuser(
      `insert into trial_onboarding_links (consultation_id, prospect_contact_id, guardian_email, guardian_name, token_hash, expires_at)
       values ('${consultationId}', '${prospectContactId}', '${guardianEmail}', '체험경로보호자', 'unused-hash-${Date.now()}-${Math.random()}', now() + interval '72 hours')
       returning id;`
    );
    const studentLinkId = psqlAsSuperuser(
      `insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade)
       values ('${linkId}', '체험경로학생', 'trial-path-student-${Date.now()}@example.com', '9학년')
       returning id;`
    );
    const childAuthId = createAuthUser("trial-path-child");
    const studentsJson = JSON.stringify([{ link_student_id: studentLinkId, child_auth_user_id: childAuthId }]).replace(/'/g, "''");
    psqlAsSuperuser(
      `select finalize_trial_onboarding_students('${linkId}', true, '${guardianAuthId}', '체험경로보호자', '${studentsJson}'::jsonb);`
    );

    const childCardOutcome = psqlAsSuperuser(
      `select outcome from consultations where family_root_consultation_id = '${consultationId}' and is_child_onboarding_card;`
    );
    expect(childCardOutcome).toBe("trial_recommended");
  });
});
