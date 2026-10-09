import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadChildren } from "./children-data";

// (2026-09-06 제품 오너 지시) 실제 앱 코드(app/parent/children-data.ts)를 로컬
// Postgres에 대고 그대로 호출해 확인한다(app/consult/student-kanban-cards.
// integration.test.ts와 같은 로컬 DB 대상이지만, DB 함수 재현이 아니라 앱
// 레이어 함수 자체를 호출한다는 점이 다르다 — service_role 키로 RLS를 우회해
// 애그리게이션 로직만 검증한다. RLS 자체는 기존 정책 스펙이 이미 커버한다).
//
// 상담이 "체험 없이 종료"/"체험 후 종료(미전환)"로 끝난 자녀는 active
// subject_enrollments가 없는 한 loadChildren이 숨겨야 하고, active가 있으면
// 숨기면 안 된다. 자녀가 1명뿐이고 그 자녀가 숨김 대상인 극단 케이스도 확인한다.
//
// 2026-09-28(초기 고객 절차 단순화) — "정규 진행 희망" 홈 배너/수강 과목 탭
// 기준 통일 테스트(loadPendingRegularIntentChoices/getProgressedTrialEnrollmentIds)는
// 그 기능 자체가 제거되어 함께 삭제했다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

const supabase = createClient(
  "http://127.0.0.1:54421",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createAuthProfile(role: "parent" | "student", label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${label}');`);
  if (role === "student") {
    psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  } else {
    psql(`insert into parents (id) values ('${id}');`);
  }
  return id;
}

function createHouseholdWithChild(guardianId: string, childId: string): string {
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values
       ('${householdId}', '${guardianId}', 'guardian', true),
       ('${householdId}', '${childId}', 'child', true);`
  );
  return householdId;
}

function createSubjectEnrollment(householdId: string, childId: string, status: string): string {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  return psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', '${status}') returning id;`
  );
}


describe("상담 중도 종료된 자녀는 보호자 포털 탭에서 숨긴다(실제 loadChildren 호출)", () => {
  it("체험 없이 종료(no_trial)되고 active 수강이 없으면 loadChildren 결과에서 빠진다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자1");
    const keptChildId = createAuthProfile("student", "탭자녀1유지");
    const hiddenChildId = createAuthProfile("student", "탭자녀1숨김");
    const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary) values
         ('${householdId}', '${guardianId}', 'guardian', true),
         ('${householdId}', '${keptChildId}', 'child', true),
         ('${householdId}', '${hiddenChildId}', 'child', false);`
    );

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀1숨김 보호자', 'tab1-${Date.now()}@example.com', '${hiddenChildId}', '${householdId}', 'no_trial', now(), '체험 전 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([keptChildId]);
  });

  it("체험 후 미전환(trial_no_convert)으로 종료돼도 active subject_enrollments가 있으면 숨기지 않는다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자2");
    const childId = createAuthProfile("student", "탭자녀2");
    const householdId = createHouseholdWithChild(guardianId, childId);
    createSubjectEnrollment(householdId, childId, "active");

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀2 보호자', 'tab2-${Date.now()}@example.com', '${childId}', '${householdId}', 'trial_no_convert', now(), '체험 후 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([childId]);
  });

  it("정규 계약 날인(contract_signed) 등 진행 중 종료 유형은 숨김 대상이 아니다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자3");
    const childId = createAuthProfile("student", "탭자녀3");
    const householdId = createHouseholdWithChild(guardianId, childId);

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀3 보호자', 'tab3-${Date.now()}@example.com', '${childId}', '${householdId}', 'contract_signed', now(), '계약 체결(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([childId]);
  });

  it("자녀가 1명뿐이고 그 자녀가 중도 종료된 극단 케이스 — loadChildren이 빈 배열을 반환하며 에러 없이 완료된다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자4단독");
    const childId = createAuthProfile("student", "탭자녀4단독");
    const householdId = createHouseholdWithChild(guardianId, childId);

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀4단독 보호자', 'tab4-${Date.now()}@example.com', '${childId}', '${householdId}', 'no_trial', now(), '체험 전 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children).toEqual([]);
  });
});
