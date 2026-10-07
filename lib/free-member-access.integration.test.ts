import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FREE_FEATURE_KEYS, COMMON_FEATURE_KEYS, TUTORING_FEATURE_KEYS } from "./feature-access-keys";

// 2026-10-05 무료 학습 회원 S2 — 20262100000001(모의고사 티어·일일 상한·누적 약점 RPC) +
// 20262100000002(has_tutoring_access 축소·과외 쓰기 정책 가드) DB 검증. 브리프 9.1 항목 2·6·7·11.
// psql + set role 패턴(free-member-signup.integration.test.ts). 실행 ID(RUN) 접두 행만 만들고 끝에 지운다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // 시드: SEED_STUDENT 보호자
const SEED_STUDENT = "cccccccc-0000-0000-0000-000000000001"; // 시드: 과외 학생(지훈)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 시드: 선생님
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `fma${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function keys(userId: string, studentId = userId): string[] {
  const raw = asUser(userId, `select student_feature_access('${studentId}');`);
  const inner = raw.replace(/^\{|\}$/g, "");
  return inner ? inner.split(",") : [];
}
function createStudent(label: string, memberType: "free" | "tutoring"): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', '${memberType}', '${memberType === "free" ? "self_signup" : "admin_direct"}', '10학년', now());`);
  return id;
}
function createSet(label: string, opts: { status?: "draft" | "published"; tier?: "free" | "tutoring" } = {}): string {
  const status = opts.status ?? "published";
  return psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at, access_tier)
     values ('${RUN}-${label}', 'standard', '${status}', 'fixed', 'not_applicable', ${status === "published" ? "now()" : "null"}, '${opts.tier ?? "tutoring"}') returning id;`,
  );
}
const catalogIds = (userId: string) =>
  asUser(userId, `select coalesce(string_agg(x->>'examSetId', ',' order by x->>'name'), '') from jsonb_array_elements(mock_exam_open_catalog('${userId}')) x;`)
    .split(",")
    .filter(Boolean);

let freeA: string, freeB: string, tutoring: string;
let freeSet1: string, freeSet2: string, freeSet3: string, tutoringSet: string;

beforeAll(() => {
  freeA = createStudent("freeA", "free");
  freeB = createStudent("freeB", "free");
  tutoring = createStudent("tutoring", "tutoring");
  // 과외 관계: 레거시 활성 enrollment(has_tutoring_access 분기 중 하나).
  psql(`insert into enrollments (student_id, teacher_id, subject_id, status) values ('${tutoring}', '${TEACHER_ID}', '${SUBJECT_ID}', 'active');`);
  freeSet1 = createSet("free1", { tier: "free" });
  freeSet2 = createSet("free2", { tier: "free" });
  freeSet3 = createSet("free3", { tier: "free" });
  tutoringSet = createSet("tutoring1");
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from chat_threads where student_id in (select id from profiles where name like '${RUN}-%');
    delete from student_academic_profile where student_id in (select id from profiles where name like '${RUN}-%');
    delete from enrollments where student_id in (select id from profiles where name like '${RUN}-%');
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%';
    commit;`);
});

describe("기능 키(student_feature_access)", () => {
  it("무료 회원은 공통+무료 키만, 과외 키 없음", () => {
    expect(keys(freeA).sort()).toEqual([...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS].sort());
  });
  it("활성 과외 관계가 있는 과외 회원은 과외 키 포함; 관계가 끝나면 과외 키만 빠지고 무료/공통은 남는다", () => {
    expect(keys(tutoring).sort()).toEqual([...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS, ...TUTORING_FEATURE_KEYS].sort());
    psql(`update enrollments set status = 'cancelled' where student_id = '${tutoring}';`);
    expect(keys(tutoring).sort()).toEqual([...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS].sort());
    expect(psql(`select member_type from students where id = '${tutoring}';`)).toBe("tutoring");
    psql(`update enrollments set status = 'active' where student_id = '${tutoring}';`);
  });
  it("시드 과외 학생(지훈)은 종전대로 과외 키 전부 보유(회귀)", () => {
    expect(keys(SEED_STUDENT).sort()).toEqual([...COMMON_FEATURE_KEYS, ...FREE_FEATURE_KEYS, ...TUTORING_FEATURE_KEYS].sort());
    expect(psql(`select has_tutoring_access('${SEED_STUDENT}');`)).toBe("t");
  });
});

describe("모의고사 공개 티어·일일 상한", () => {
  it("무료 회원 카탈로그는 access_tier=free 세트만, 과외 회원은 전부", () => {
    const free = catalogIds(freeA);
    expect(free).toContain(freeSet1);
    expect(free).not.toContain(tutoringSet);
    const tut = catalogIds(tutoring);
    expect(tut).toContain(freeSet1);
    expect(tut).toContain(tutoringSet);
  });
  it("무료 회원은 과외 전용 세트를 시작할 수 없고, 과외 회원은 시작할 수 있다", () => {
    expect(fails(() => asUser(freeA, `select mock_exam_open_start('${tutoringSet}');`))).toContain("tutoring members only");
    expect(asUser(tutoring, `select mock_exam_open_start('${tutoringSet}');`)).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("무료 회원은 하루 2회까지 시작, 3번째는 거절, 이미 시작한 세트 재호출(멱등)은 통과", () => {
    const a1 = asUser(freeA, `select mock_exam_open_start('${freeSet1}');`);
    asUser(freeA, `select mock_exam_open_start('${freeSet2}');`);
    expect(fails(() => asUser(freeA, `select mock_exam_open_start('${freeSet3}');`))).toContain("Free members can start up to 2 mock exams per day. Please try again tomorrow.");
    expect(asUser(freeA, `select mock_exam_open_start('${freeSet1}');`)).toBe(a1);
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${freeA}';`)).toBe("2");
    // 과외 회원에게는 상한이 없다.
    asUser(tutoring, `select mock_exam_open_start('${freeSet1}'); select mock_exam_open_start('${freeSet2}'); select mock_exam_open_start('${freeSet3}');`);
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${tutoring}';`)).toBe("4");
  });
  it("access_tier=free 는 공개·보관 아님 세트만 — 초안은 거절, 보관되면 자동으로 tutoring", () => {
    expect(fails(() => createSet("draft-free", { status: "draft", tier: "free" }))).toContain("무료 공개는");
    const s = createSet("free-then-archive", { tier: "free" });
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${s}';`);
    expect(psql(`select access_tier from mock_exam_sets where id = '${s}';`)).toBe("tutoring");
    const d = createSet("draft-then-free", { status: "draft" });
    expect(fails(() => psql(`update mock_exam_sets set access_tier = 'free' where id = '${d}';`))).toContain("무료 공개는");
  });
});

describe("누적 약점 요약 RPC(mock_exam_weakness_summary)", () => {
  let setId: string;
  const attemptId = psql(`select gen_random_uuid();`);
  beforeAll(() => {
    // 채점 확정 응시 1건: 문항 3개(rw 도메인 A 2문항 중 0정답, math 도메인 B 1문항 정답). 기존 공개 문제를 재사용.
    const probs = psql(`select p.id || '|' || p.published_version_id from problems p where p.published_version_id is not null limit 3;`).split("\n");
    expect(probs.length).toBe(3);
    setId = createSet("weak", { tier: "free" });
    const plan = [
      { section: "rw", pos: 1, domain: "rw_craft_structure", skill: "CS-WIC", correct: false },
      { section: "rw", pos: 2, domain: "rw_craft_structure", skill: "CS-WIC", correct: false },
      { section: "math", pos: 1, domain: "algebra", skill: "ALG-LIN", correct: true },
    ];
    psql(`begin; set local session_replication_role = replica;
      ${plan
        .map((p, i) => {
          const [pid, vid] = probs[i].split("|");
          return `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
            values ('${setId}', '${p.section}', ${p.pos}, '${pid}', '${vid}', '${p.domain}', '${p.skill}', 'medium');`;
        })
        .join("\n")}
      insert into mock_exam_attempts (id, student_id, exam_set_id, exam_set_group_id, status, started_at, submitted_at, graded_at)
        select '${attemptId}', '${freeB}', id, set_group_id, 'graded', now(), now(), now() from mock_exam_sets where id = '${setId}';
      insert into mock_exam_answers (attempt_id, set_item_id, response, correct)
        select '${attemptId}', i.id, '0'::jsonb,
               case when i.section = 'math' then true else false end
        from mock_exam_set_items i where i.exam_set_id = '${setId}';
      commit;`);
  });

  it("본인: 응시 수·영역/세부기술 누적 정답률", () => {
    const out = asUser(freeB, `select s->>'gradedAttemptCount' || '|' || (select string_agg(d->>'key' || ':' || (d->>'correct') || '/' || (d->>'total'), ',' order by d->>'key') from jsonb_array_elements(s->'byDomain') d) || '|' || (select string_agg(k->>'key' || ':' || (k->>'correct') || '/' || (k->>'total'), ',' order by k->>'key') from jsonb_array_elements(s->'bySkill') k) from mock_exam_weakness_summary('${freeB}') s;`);
    expect(out).toBe("1|algebra:1/1,rw_craft_structure:0/2|ALG-LIN:1/1,CS-WIC:0/2");
  });
  it("다른 학생은 거절, 관리자·보호자(연결된 자녀)는 허용", () => {
    expect(fails(() => asUser(freeA, `select mock_exam_weakness_summary('${freeB}');`))).toContain("do not have permission");
    expect(asUser(ADMIN_ID, `select s->>'gradedAttemptCount' from mock_exam_weakness_summary('${freeB}') s;`)).toBe("1");
    expect(asUser(GUARDIAN_ID, `select s->>'attemptCount' from mock_exam_weakness_summary('${SEED_STUDENT}') s;`)).toMatch(/^\d+$/);
    expect(fails(() => asUser(GUARDIAN_ID, `select mock_exam_weakness_summary('${freeB}');`))).toContain("do not have permission");
  });
});

describe("과외 전용 쓰기 경로는 무료 회원을 거절(정책·RPC)", () => {
  it("chat_threads / household_inquiries / meeting_requests / parent_requests / 로드맵 insert 전부 거절", () => {
    const attempts = [
      `insert into chat_threads (student_id, teacher_id) values ('${freeA}', '${TEACHER_ID}');`,
      `insert into household_inquiries (household_id, opened_by, opened_by_role) values (gen_random_uuid(), '${freeA}', 'student');`,
      `insert into meeting_requests (household_id, child_id, content, requested_by) values (gen_random_uuid(), '${freeA}', 'x', '${freeA}');`,
      `insert into parent_requests (parent_id, student_id, text) values ('${GUARDIAN_ID}', '${freeA}', 'x');`,
      `insert into student_academic_profile (student_id, graduation_year) values ('${freeA}', 2030);`,
      `insert into student_college_interests (student_id, target_colleges) values ('${freeA}', array['MIT']);`,
    ];
    for (const sql of attempts) {
      const err = fails(() => asUser(freeA, sql));
      expect(err, sql).toMatch(/row-level security|violates|permission denied|does not exist|null value/);
    }
    expect(psql(`select count(*) from student_academic_profile where student_id = '${freeA}';`)).toBe("0");
    expect(fails(() => asUser(freeA, `select * from list_open_consultant_meeting_slots('${ADMIN_ID}', now(), now() + interval '7 days');`))).toContain("assigned consultant");
  });
  it("과외 회원(활성 관계)은 같은 로드맵·채팅 쓰기가 통과한다(회귀)", () => {
    asUser(tutoring, `insert into student_academic_profile (student_id, graduation_year) values ('${tutoring}', 2030);`);
    expect(psql(`select graduation_year from student_academic_profile where student_id = '${tutoring}';`)).toBe("2030");
    asUser(tutoring, `insert into chat_threads (student_id, teacher_id) values ('${tutoring}', '${TEACHER_ID}');`);
    expect(psql(`select count(*) from chat_threads where student_id = '${tutoring}';`)).toBe("1");
  });
});
