import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { FEATURE_KEYS, COMMON_FEATURE_KEYS, FREE_FEATURE_KEYS, TUTORING_FEATURE_KEYS } from "./feature-access";

// 2026-10-05 무료 학습 회원 S1 — 20262100000000_free_member_foundation.sql DB 검증.
// psql + set role authenticated 패턴(mock-exam-guessed.integration.test.ts와 동일). 격리 스택에서는
// SUPABASE_TEST_DB_URL로 대상 DB를 지정한다(CLAUDE.md "작업 위치").

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SEED_STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const RUN_ID = `freesig-${Date.now()}`;
const createdAuthUsers: string[] = [];

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asRole(role: "authenticated" | "anon", userId: string | null, sql: string): string {
  return psql(`
    set role ${role};
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId ?? ""}', false); end $$;
    ${sql}
    reset role;
  `);
}
function asUser(userId: string, sql: string): string {
  return asRole("authenticated", userId, sql);
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}

function createAuthUser(opts: { confirmed: boolean; selfSignup: boolean; label: string }): string {
  const meta = opts.selfSignup
    ? `'{"signup_source":"self_signup","name":"${opts.label}","birthdate":"2010-05-01","grade":"10학년","terms_version":"2026-10-05"}'`
    : `'{"name":"${opts.label}"}'`;
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
             '${RUN_ID}-${opts.label}-${Math.random().toString(36).slice(2)}@example.com', 'x',
             ${opts.confirmed ? "now()" : "null"}, '{}', ${meta}::jsonb, now(), now())
     returning id;`,
  );
  createdAuthUsers.push(id);
  return id;
}

const PROVISION = (name = "김학생", birthdate = "2010-05-01", grade = "10학년", school: string | null = null, terms = "2026-10-05") =>
  `select provision_free_member('${name}', '${birthdate}', '${grade}', ${school === null ? "null" : `'${school}'`}, '${terms}');`;

function parseTextArray(raw: string): string[] {
  const inner = raw.replace(/^\{|\}$/g, "");
  return inner ? inner.split(",").map((s) => s.replace(/^"|"$/g, "")) : [];
}

afterAll(() => {
  if (createdAuthUsers.length > 0) {
    // profiles/students/student_terms_acceptances는 on delete cascade.
    psql(`delete from auth.users where id in (${createdAuthUsers.map((id) => `'${id}'`).join(",")});`);
  }
});

describe("provision_free_member", () => {
  it("이메일 미확인 계정은 거절", () => {
    const uid = createAuthUser({ confirmed: false, selfSignup: true, label: "unconfirmed" });
    expect(fails(() => asUser(uid, PROVISION()))).toContain("이메일 확인이 필요합니다");
    expect(psql(`select count(*) from profiles where id = '${uid}';`)).toBe("0");
  });

  it("셀프 가입 표식 없는 프로필 없는 Auth 계정(고아)은 거절 — 기존 fail-closed 유지", () => {
    const uid = createAuthUser({ confirmed: true, selfSignup: false, label: "orphan" });
    expect(fails(() => asUser(uid, PROVISION()))).toContain("셀프 가입 경로");
    expect(psql(`select count(*) from profiles where id = '${uid}';`)).toBe("0");
    // 게이트 함수도 종전대로 unknown.
    expect(asUser(uid, `select current_account_status();`)).toBe("unknown");
  });

  it("만 13세 미만은 거절(생년월일 null도 거절)", () => {
    const uid = createAuthUser({ confirmed: true, selfSignup: true, label: "under13" });
    const young = new Date();
    young.setUTCFullYear(young.getUTCFullYear() - 12);
    expect(fails(() => asUser(uid, PROVISION("어린이", young.toISOString().slice(0, 10))))).toContain("만 13세 미만");
    expect(fails(() => asUser(uid, `select provision_free_member('어린이', null, '7학년', null, '2026-10-05');`))).toContain("생년월일은 필수");
    expect(psql(`select count(*) from profiles where id = '${uid}';`)).toBe("0");
  });

  it("anon은 실행 불가", () => {
    expect(fails(() => asRole("anon", null, PROVISION()))).toMatch(/permission denied|로그인이 필요/);
  });

  it("이미 등록된(과외) 학생이 호출하면 거절하고 아무것도 바꾸지 않는다", () => {
    const before = psql(`select member_type || '|' || status from students where id = '${SEED_STUDENT_ID}';`);
    expect(fails(() => asUser(SEED_STUDENT_ID, PROVISION()))).toContain("이미 등록된 계정");
    expect(psql(`select member_type || '|' || status from students where id = '${SEED_STUDENT_ID}';`)).toBe(before);
    expect(before.startsWith("tutoring|")).toBe(true);
  });

  describe("정상 가입", () => {
    const uid = createAuthUser({ confirmed: true, selfSignup: true, label: "ok" });

    it("profiles(student)+students(active/free/self_signup)+약관 동의가 생기고 역할은 항상 student", () => {
      expect(asUser(uid, PROVISION("  김학생 ", "2010-05-01", "10학년", "  ", "2026-10-05"))).toBe(uid);
      expect(psql(`select role || '|' || name || '|' || date_of_birth from profiles where id = '${uid}';`)).toBe("student|김학생|2010-05-01");
      expect(
        psql(
          `select status || '|' || member_type || '|' || signup_source || '|' || grade || '|' || coalesce(school_name, '<null>') || '|' || (profile_completed_at is not null) from students where id = '${uid}';`,
        ),
      ).toBe("active|free|self_signup|10학년|<null>|true");
      expect(psql(`select terms_version || '|' || source from student_terms_acceptances where student_id = '${uid}';`)).toBe("2026-10-05|self_signup");
    });

    it("멱등: 두 번째 호출은 같은 id를 돌려주고 행 수가 늘지 않는다", () => {
      expect(asUser(uid, PROVISION())).toBe(uid);
      expect(psql(`select count(*) from student_terms_acceptances where student_id = '${uid}';`)).toBe("1");
      expect(psql(`select count(*) from profiles where id = '${uid}';`)).toBe("1");
    });

    it("로그인 게이트를 통과한다(active·프로필 완성·13세 이상)", () => {
      expect(asUser(uid, `select current_account_status();`)).toBe("active");
      expect(asUser(uid, `select current_student_profile_completed();`)).toBe("t");
      expect(asUser(uid, `select current_account_access_allowed();`)).toBe("t");
    });

    it("기능 키 = 공통 ∪ 무료, 과외 키 없음. is_free_member=t, has_tutoring_access=f", () => {
      const keys = parseTextArray(asUser(uid, `select student_feature_access('${uid}');`));
      expect([...keys].sort()).toEqual([...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS].sort());
      for (const k of TUTORING_FEATURE_KEYS) expect(keys).not.toContain(k);
      for (const k of keys) expect(FEATURE_KEYS).toContain(k);
      expect(asUser(uid, `select is_free_member('${uid}');`)).toBe("t");
      expect(asUser(uid, `select has_tutoring_access('${uid}');`)).toBe("f");
    });

    it("인수 기준: 무료 가입은 과외 자동동작 0건", () => {
      const counts = {
        contracts: psql(`select count(*) from contracts where child_id = '${uid}';`),
        contract_dispatch_jobs: psql(`select count(*) from contract_dispatch_jobs where child_id = '${uid}';`),
        entitlement_grants: psql(`select count(*) from entitlement_grants where child_id = '${uid}';`),
        entitlement_ledger: psql(`select count(*) from entitlement_ledger l join entitlement_grants g on g.id = l.grant_id where g.child_id = '${uid}';`),
        subject_enrollments: psql(`select count(*) from subject_enrollments where child_id = '${uid}';`),
        teacher_assignments: psql(`select count(*) from teacher_assignments ta join subject_enrollments se on se.id = ta.subject_enrollment_id where se.child_id = '${uid}';`),
        consultations: psql(`select count(*) from consultations where child_id = '${uid}';`),
        consultant_assignments: psql(`select count(*) from consultant_assignments where student_id = '${uid}';`),
        household_members: psql(`select count(*) from household_members where profile_id = '${uid}';`),
        enrollments_legacy: psql(`select count(*) from enrollments where student_id = '${uid}';`),
      };
      expect(counts).toEqual(Object.fromEntries(Object.keys(counts).map((k) => [k, "0"])));
    });

    it("학생 본인은 member_type/signup_source를 바꿀 수 없다(권한 상승 차단), 관리자는 가능", () => {
      expect(fails(() => asUser(uid, `update students set member_type = 'tutoring' where id = '${uid}';`))).toContain("member_type/signup_source");
      expect(fails(() => asUser(uid, `update students set signup_source = 'admin_direct' where id = '${uid}';`))).toContain("member_type/signup_source");
      expect(psql(`select member_type || '|' || signup_source from students where id = '${uid}';`)).toBe("free|self_signup");
      // 본인 행의 다른 컬럼 수정은 종전대로 허용된다(기존 UPDATE 정책 회귀 없음).
      asUser(uid, `update students set school_name = '테스트 고등학교' where id = '${uid}';`);
      expect(psql(`select school_name from students where id = '${uid}';`)).toBe("테스트 고등학교");
      asUser(ADMIN_ID, `update students set member_type = 'tutoring' where id = '${uid}';`);
      expect(psql(`select member_type from students where id = '${uid}';`)).toBe("tutoring");
      psql(`update students set member_type = 'free' where id = '${uid}';`);
    });

    it("student_feature_access는 self-only(다른 학생이 조회하면 빈 배열), 관리자는 타인 조회 가능", () => {
      const other = createAuthUser({ confirmed: true, selfSignup: true, label: "other" });
      asUser(other, PROVISION("박학생"));
      expect(parseTextArray(asUser(other, `select student_feature_access('${uid}');`))).toEqual([]);
      expect(parseTextArray(asUser(ADMIN_ID, `select student_feature_access('${uid}');`)).length).toBeGreaterThan(0);
      // anon은 execute 권한이 없다(revoke) — 호출 자체가 거부된다.
      expect(fails(() => asRole("anon", null, `select student_feature_access('${uid}');`))).toContain("permission denied");
    });
  });

  it("기존 과외 학생(시드)은 기본값 tutoring이고 키 집합이 has_tutoring_access와 일치한다(회귀 0)", () => {
    expect(psql(`select member_type from students where id = '${SEED_STUDENT_ID}';`)).toBe("tutoring");
    const keys = parseTextArray(asUser(SEED_STUDENT_ID, `select student_feature_access('${SEED_STUDENT_ID}');`));
    const status = psql(`select status from students where id = '${SEED_STUDENT_ID}';`);
    if (status !== "active") {
      expect(keys).toEqual([]);
      return;
    }
    for (const k of [...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS]) expect(keys).toContain(k);
    const hasTutoring = asUser(SEED_STUDENT_ID, `select has_tutoring_access('${SEED_STUDENT_ID}');`) === "t";
    expect(keys.includes("class")).toBe(hasTutoring);
  });

  it("스키마: consult_slot_source에 free_member, mock_exam_sets.access_tier 기본 tutoring + check", () => {
    expect(psql(`select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'consult_slot_source' and e.enumlabel = 'free_member';`)).toBe("1");
    expect(psql(`select column_default from information_schema.columns where table_name = 'mock_exam_sets' and column_name = 'access_tier';`)).toContain("tutoring");
    expect(
      fails(() =>
        psql(`insert into mock_exam_sets (name, difficulty_tier, status, access_tier, created_by) values ('${RUN_ID}-bad', 'standard', 'draft', 'premium', '${ADMIN_ID}');`),
      ),
    ).toContain("mock_exam_sets_access_tier_check");
    expect(fails(() => psql(`update students set member_type = 'vip' where id = '${SEED_STUDENT_ID}';`))).toContain("students_member_type_check");
  });
});
