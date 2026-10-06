import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { evaluateSessionCapture } from "./recording-gate-data";

// The capture gate reads EXISTING records only. This test drives it against the real schema (column names, RPCs, status
// semantics) with a per-run teacher/student, using the same psql shell-out pattern as the other booking integration tests.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const lastLine = (o: string) => o.split("\n").filter((l) => l.trim()).pop()?.trim() ?? "";

let teacherId: string;
let childId: string;
let contractId: string;
let sessionId: string;
let minorChildId: string;
let minorSessionId: string;
const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });
const codes = async (id: string = sessionId) => (await evaluateSessionCapture(admin, id)).reasons.map((r) => r.code);


function makeChild(label: string, dob: string, daysFromNow: number, lessonTypeId: string, productId: string) {
  const now = Date.now() + daysFromNow;
  const child = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'gate-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${child}', 'student', '게이트 통합테스트 학생(${label})', '${dob}'); insert into students (id, grade, status) values ('${child}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${child}', 'child', true);`);
  const contract = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${child}', 'draft') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${child}', '${SUBJECT_ID}', '${contract}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source) values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day', 'app');`);
  const grantId = psql(`insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid) values ('${child}', '${productId}', null, 1, now() + interval '120 days', true) returning id;`);
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'gate-grant-${label}-${now}');`);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysFromNow);
  start.setUTCHours(17, 0, 0, 0);
  const end = new Date(start.getTime() + 120 * 60000);
  const session = lastLine(
    psql(`select reservation_id, session_id from confirm_lesson_booking('${child}', '${enrollmentId}', '${teacherId}', '${lessonTypeId}', '${start.toISOString()}', '${end.toISOString()}', 'gate-book-${label}-${now}');`)
  ).split("|")[1];
  return { child, contract, session };
}

beforeAll(() => {
  const now = Date.now();
  const lessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  const productId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'gate-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', '게이트 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status, hourly_rate_krw) values ('${teacherId}', 'active', 3000000);`);
  psql(`insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
        select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`);
  const adult = makeChild("adult", "2008-01-01", 9, lessonTypeId, productId);
  childId = adult.child;
  contractId = adult.contract;
  sessionId = adult.session;
  const minor = makeChild("minor", "2018-01-01", 11, lessonTypeId, productId);
  minorChildId = minor.child;
  minorSessionId = minor.session;
});

afterAll(() => {
  // the re-consent policy row would otherwise supersede every guardian consent in the shared local database
  psql(`delete from consent_policy_versions where version like 'gate-test-%' and id not in (select policy_version_id from guardian_consents);`);
  psql(`delete from teacher_availability_rules where teacher_id = '${teacherId}' and created_by = '${ADMIN_ID}';`);
});

describe("evaluateSessionCapture() against the real records", () => {
  it("blocks while neither the family contract nor the teacher agreement is signed", async () => {
    expect(await codes()).toEqual(["customer_agreement_not_signed", "provider_agreement_not_signed"]);
  });

  it("flags agreements signed on a version without the four items, then allows once current versions are signed", async () => {
    psql(`update contracts set status = 'active' where id = '${contractId}';`);
    psql(`insert into contract_versions (contract_id, version_number, price_policy_snapshot, template_version, docusign_envelope_status) values ('${contractId}', 1, '{}'::jsonb, '0.1-OLD', 'completed');`);
    const oldTeacher = psql(`insert into teacher_contracts (teacher_id, doc_type, status, signed_at, agreement_form, template_version) values ('${teacherId}', 'non_us_services', 'signed', now() - interval '1 day', 'non_us_services', '0.1-OLD') returning id;`);
    expect(await codes()).toEqual(["customer_agreement_scope_outdated", "provider_agreement_scope_outdated"]);

    // amended agreements are NEW records; the old signed rows are never rewritten
    psql(`insert into contract_versions (contract_id, version_number, price_policy_snapshot, template_version, docusign_envelope_status) values ('${contractId}', 2, '{}'::jsonb, '0.3-EN-CA', 'completed');`);
    psql(`insert into teacher_contracts (teacher_id, doc_type, status, signed_at, agreement_form, template_version) values ('${teacherId}', 'non_us_services', 'signed', now(), 'non_us_services', '0.2-EN');`);
    expect(await codes()).toEqual([]);
    expect(psql(`select template_version from teacher_contracts where id = '${oldTeacher}';`)).toBe("0.1-OLD");
  });

  it("an additional attendee without recorded consent blocks capture until notice and consent are recorded", async () => {
    const attendee = psql(`insert into lesson_additional_attendees (session_id, display_name, notice_given_at) values ('${sessionId}', 'Younger sibling', now()) returning id;`);
    expect(await codes()).toEqual(["additional_attendee_consent_incomplete"]);
    psql(`update lesson_additional_attendees set consent_recorded_at = now() where id = '${attendee}';`);
    expect(await codes()).toEqual([]);
  });

  it("under 13: blocked without guardian consent, allowed with a verified current consent, blocked again once re-consent is required", async () => {
    expect(await codes(minorSessionId)).toEqual(["customer_agreement_not_signed", "under13_guardian_consent_missing"]);

    // the database itself refuses to activate a contract for a child under 13 without a guardian consent, so consent comes first
    const policyId = psql(`select id from consent_policy_versions where retired_at is null order by effective_from desc limit 1;`);
    psql(`insert into guardian_consents (student_id, policy_version_id, consented_by, verification_method, verification_reference) values ('${minorChildId}', '${policyId}', '${teacherId}', 'manual_admin_verification', 'gate-test');`);
    expect(await codes(minorSessionId)).toEqual(["customer_agreement_not_signed"]);

    const minorContract = psql(`select contract_id from subject_enrollments where child_id = '${minorChildId}';`);
    psql(`update contracts set status = 'active' where id = '${minorContract}';`);
    psql(`insert into contract_versions (contract_id, version_number, price_policy_snapshot, template_version, docusign_envelope_status) values ('${minorContract}', 1, '{}'::jsonb, '0.3-EN-CA', 'completed');`);
    expect(await codes(minorSessionId)).toEqual([]);

    // a newer re-consent policy version supersedes the earlier consent (earlier rows stay untouched)
    psql(`insert into consent_policy_versions (version, title, content_hash, effective_from, requires_reconsent) values ('gate-test-${Date.now()}', 'gate test', 'x', now() + interval '1 second', true);`);
    psql(`select pg_sleep(1.2);`);
    expect(await codes(minorSessionId)).toEqual(["under13_guardian_consent_outdated"]);
  });
});
