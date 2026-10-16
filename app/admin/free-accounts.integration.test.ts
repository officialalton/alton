import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, TEACHER_ID, answer, asUser, assign, createRoutingSet, fails, psql, start, submitModule } from "../../test/mock-exam-routing-fixture";
import { factsFromRpcRows, type FactsRpcRow } from "@/lib/free-accounts/facts";
import { buildScorePoints, summarize } from "@/lib/mock-exam/score-aggregate";
import { computeMockStats } from "@/lib/student-stats/metrics";
import type { RawStatsAggregate } from "@/lib/student-stats/types";

// 2026-10-06 Free Accounts — 마이그레이션 20262100000020~26 DB 통합 테스트(공유 로컬 DB 54422).
// 실행 ID(RUN) 전용 계정만 만들고 종료 시 RUN 접두 행만 정리한다. 목록·분석 RPC는 p_cohort_ids 로 자기 학생 집합에 한정(병렬 세션 데이터 영향 제거).
const RUN = `fa-${randomUUID().slice(0, 8)}`;
const NOW_YEAR_DAY = new Date().toISOString().slice(0, 10);

function mkAuth(email: string, name: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}', 'x', now(), '{}', '{"name":"${name}"}', now(), now()) returning id;`,
  ).split("\n")[0];
}
function freeStudent(label: string, opts: { real?: boolean; type?: "free" | "tutoring" } = {}): { id: string; email: string; name: string } {
  const email = opts.real ? `${RUN}-${label}@customer.dev` : `${RUN}-${label}@example.com`;
  const name = `FA ${label} ${RUN}`;
  const id = mkAuth(email, name);
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${name}');`);
  psql(`insert into students (id, status, member_type) values ('${id}', 'active', '${opts.type ?? "free"}');`);
  return { id, email, name };
}
function staffProfile(role: "admin" | "consultant", label: string, tier?: string): string {
  const id = mkAuth(`${RUN}-${label}@example.com`, label);
  psql(`insert into profiles (id, role, name${tier ? ", admin_tier" : ""}) values ('${id}', '${role}', '${label}-${RUN}'${tier ? `, '${tier}'` : ""});`);
  return id;
}
const rpcAs = (uid: string, sql: string) => asUser(uid, sql);
const listRows = (uid: string, args: string) => rpcAs(uid, `select student_id, completed_tests, consult_stage, account_status, total_count from admin_free_accounts_list(${args});`).split("\n").filter(Boolean).map((l) => l.split("|"));
const jsonAs = (uid: string, sql: string) => JSON.parse(rpcAs(uid, `select (${sql})::text;`).split("\n").filter((l) => l.startsWith("{") || l.startsWith("["))[0]);

let consultant: string, supervisorNoCap: string, supervisorCap: string;
let A: ReturnType<typeof freeStudent>, B: ReturnType<typeof freeStudent>, D: ReturnType<typeof freeStudent>, E: ReturnType<typeof freeStudent>;
let attemptA = "", attemptB = "";
let ids: string[] = [];

beforeAll(() => {
  consultant = staffProfile("consultant", "consultant");
  supervisorNoCap = staffProfile("admin", "sup-nocap", "supervisor");
  supervisorCap = staffProfile("admin", "sup-cap", "supervisor");
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${supervisorCap}', '학생관리');`);
  A = freeStudent("a"); // 완주(graded) 응시 + 테스트 계정(패턴)
  B = freeStudent("b"); // 진행 중 응시 + 관심 등록
  D = freeStudent("d", { real: true }); // 실계정 형태(테스트 표식 없음)
  E = freeStudent("e"); // 상담 단계 매핑용
  ids = [A.id, B.id, D.id, E.id];

  const fx = createRoutingSet({ run: RUN, label: "fa" });
  attemptA = assign(A.id, fx.setId);
  start(A.id, attemptA);
  answer(A.id, attemptA, fx.ids.rw_m1, 4); submitModule(A.id, attemptA, "rw_m1");
  answer(A.id, attemptA, fx.ids.rw_higher, 1); submitModule(A.id, attemptA, "rw_m2");
  submitModule(A.id, attemptA, "break");
  answer(A.id, attemptA, fx.ids.math_m1, 2); submitModule(A.id, attemptA, "math_m1");
  answer(A.id, attemptA, fx.ids.math_higher, 2); submitModule(A.id, attemptA, "math_m2");
  attemptB = assign(B.id, fx.setId);
  start(B.id, attemptB);
  psql(`insert into student_consult_interests (student_id, status) values ('${B.id}', 'registered');`);
}, 180_000);

afterAll(() => {
  psql(`set session_replication_role = replica;
    delete from student_flag_events where student_id = any(array['${ids.join("','")}']::uuid[]);
    delete from staff_student_view_log where student_id = any(array['${ids.join("','")}']::uuid[]);
    delete from account_status_events where profile_id = any(array['${ids.join("','")}']::uuid[]);
    delete from guardian_link_invites where student_id = any(array['${ids.join("','")}']::uuid[]);
    delete from student_consult_interests where student_id = any(array['${ids.join("','")}']::uuid[]);
    delete from consultations where child_id = any(array['${ids.join("','")}']::uuid[]);
    delete from mock_exam_attempts where student_id = any(array['${ids.join("','")}']::uuid[]);
    delete from supervisor_capabilities where profile_id = '${supervisorCap}';
    delete from students where id = any(array['${ids.join("','")}']::uuid[]);
    delete from profiles where id = any(array['${[...ids, consultant, supervisorNoCap, supervisorCap].join("','")}']::uuid[]);
    delete from auth.users where email like '${RUN}-%';
    set session_replication_role = origin;`);
}, 60_000);

const cohort = () => `array['${ids.join("','")}']::uuid[]`;

describe("권한(RPC 내부 검사)", () => {
  const calls = (id: string) => [
    `select * from admin_free_accounts_list(p_cohort_ids => ${cohort()})`,
    `select admin_free_account_profile('${id}')`,
    `select * from admin_student_mock_attempt_facts('${id}')`,
    `select admin_free_account_learning_usage('${id}')`,
    `select admin_free_accounts_analytics(current_date - 1, current_date, true, ${cohort()})`,
    `select admin_set_test_account('${id}', true, 'x')`,
  ];
  it("컨설턴트·교사·학생·capability 없는 supervisor 는 모든 RPC 거절", () => {
    for (const uid of [consultant, TEACHER_ID, A.id, supervisorNoCap]) {
      for (const sql of calls(D.id)) expect(fails(() => rpcAs(uid, `${sql};`)), `${uid} ${sql}`).toContain("not_allowed");
    }
  });
  it("관리자와 학생관리 capability supervisor 는 통과", () => {
    for (const uid of [ADMIN_ID, supervisorCap]) {
      expect(rpcAs(uid, `select admin_free_account_profile('${D.id}') is not null;`)).toContain("t");
      expect(listRows(uid, `p_cohort_ids => ${cohort()}, p_include_test => true`).length).toBe(4);
    }
  });
  it("학생이 touch 는 가능하지만 관리자 RPC는 불가, 익명은 권한 오류", () => {
    expect(fails(() => psql(`begin; set local role anon; select admin_free_accounts_list(); commit;`))).toContain("permission denied");
  });
});

describe("목록", () => {
  it("테스트 계정은 기본 제외, 토글로 포함", () => {
    const def = listRows(ADMIN_ID, `p_cohort_ids => ${cohort()}`);
    expect(def.map((r) => r[0])).toEqual([D.id]);
    expect(listRows(ADMIN_ID, `p_cohort_ids => ${cohort()}, p_include_test => true`).length).toBe(4);
  });
  it("검색·필터·정렬·페이지·total_count", () => {
    const inc = `p_cohort_ids => ${cohort()}, p_include_test => true`;
    expect(listRows(ADMIN_ID, `${inc}, p_search => '${RUN}-A@EXAMPLE'`).map((r) => r[0])).toEqual([A.id]); // 이메일 부분일치(대소문자 무시)
    expect(listRows(ADMIN_ID, `${inc}, p_search => 'fa b ${RUN}'`).map((r) => r[0])).toEqual([B.id]); // 이름
    expect(listRows(ADMIN_ID, `${inc}, p_has_attempts => true`).map((r) => r[0])).toEqual([A.id]); // 완료 응시 ≥1
    expect(listRows(ADMIN_ID, `${inc}, p_has_attempts => false`).length).toBe(3);
    expect(listRows(ADMIN_ID, `${inc}, p_consult_stage => 'requested'`).map((r) => r[0])).toEqual([B.id]);
    const page = listRows(ADMIN_ID, `${inc}, p_sort => 'name', p_dir => 'asc', p_limit => 2, p_offset => 0`);
    expect(page.length).toBe(2);
    expect(page[0][4]).toBe("4"); // total_count
    const page2 = listRows(ADMIN_ID, `${inc}, p_sort => 'name', p_dir => 'asc', p_limit => 2, p_offset => 2`);
    expect(new Set([...page, ...page2].map((r) => r[0])).size).toBe(4);
    expect(fails(() => rpcAs(ADMIN_ID, `select * from admin_free_accounts_list(p_sort => 'name; drop table students');`))).toContain("invalid_sort");
  });
  it("completed_tests 는 카운트만 — 응시 이력 행·문항 데이터를 반환하는 열이 없다", () => {
    const result = psql(`select pg_get_function_result('admin_free_accounts_list'::regproc);`);
    expect(result).not.toMatch(/attempt_id|answers|items|exam_name/);
    expect(listRows(ADMIN_ID, `p_cohort_ids => ${cohort()}, p_include_test => true, p_search => 'fa a ${RUN}'`)[0][1]).toBe("1");
  });
  it("closed 계정은 기본 제외, 'any' 로 포함", () => {
    psql(`set session_replication_role = replica; update students set status = 'closed' where id = '${E.id}'; set session_replication_role = origin;`);
    expect(listRows(ADMIN_ID, `p_cohort_ids => ${cohort()}, p_include_test => true`).map((r) => r[0])).not.toContain(E.id);
    expect(listRows(ADMIN_ID, `p_cohort_ids => ${cohort()}, p_include_test => true, p_account_status => 'any'`).map((r) => r[0])).toContain(E.id);
    psql(`set session_replication_role = replica; update students set status = 'active' where id = '${E.id}'; set session_replication_role = origin;`);
  });
});

describe("점수 원자료와 공유 모듈", () => {
  const facts = (id: string) => factsFromRpcRows(JSON.parse(rpcAs(ADMIN_ID, `select coalesce(json_agg(f), '[]'::json)::text from admin_student_mock_attempt_facts('${id}') f;`).split("\n").filter((l) => l.startsWith("["))[0]) as FactsRpcRow[]);
  const aggregate = (id: string) =>
    JSON.parse(
      psql(`begin; select set_config('request.jwt.claims','{"role":"service_role"}',true); select public.student_stats_aggregate('${id}', true)::text; commit;`)
        .split("\n").filter((l) => l.startsWith("{")).pop() ?? "{}",
    ) as RawStatsAggregate;

  it("완주 응시: 섹션 정답·문항·경로가 기존 통계 집계와 같고, 공유 모듈 총점 범위가 학생 통계(computeMockStats)와 일치", () => {
    const f = facts(A.id);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ status: "graded", format: "mst", track: "sat", attemptSeq: 1 });
    expect(f[0].sections.rw).toMatchObject({ total: 6, correct: 5, complete: true, route: "higher" });
    const agg = aggregate(A.id);
    const rw = agg.mock[0].sections.find((s) => s.section === "rw")!;
    expect(f[0].sections.rw).toMatchObject({ total: Number(rw.total), correct: Number(rw.correct) });
    const mine = buildScorePoints(f)[0];
    const student = computeMockStats(agg.mock, "admin").points[0];
    expect(mine.total).toEqual(student.total);
    expect(mine.rw).toEqual(student.rw);
    expect(mine.math).toEqual(student.math);
    expect(summarize(buildScorePoints(f), "total").sampleSize).toBe(1);
  });
  it("진행 중 응시는 점수 없음(정답 null·완료 false) — 0점으로 취급하지 않는다", () => {
    const f = facts(B.id);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ status: "in_progress" });
    expect(f[0].sections.rw).toMatchObject({ correct: null, complete: false });
    expect(buildScorePoints(f)).toEqual([]);
    expect(summarize(buildScorePoints(f), "total")).toMatchObject({ sampleSize: 0, latest: null });
  });
  it("응시 없는 학생은 빈 배열", () => {
    expect(facts(D.id)).toEqual([]);
  });
});

describe("상담 단계 매핑·상세 프로필", () => {
  const stageOf = (id: string) => jsonAs(ADMIN_ID, `admin_free_account_profile('${id}')`).consultStage as string;
  it("none -> requested -> invitation_pending -> parent_linked -> booked -> closed(관심 취소)", () => {
    expect(stageOf(E.id)).toBe("none");
    psql(`insert into student_consult_interests (student_id, status) values ('${E.id}', 'registered');`);
    expect(stageOf(E.id)).toBe("requested");
    const setInterest = (s: string) => psql(`update student_consult_interests set status = '${s}' where student_id = '${E.id}' and status not in ('cancelled','expired');`);
    setInterest("invite_sent"); expect(stageOf(E.id)).toBe("invitation_pending");
    setInterest("parent_linked"); expect(stageOf(E.id)).toBe("parent_linked");
    setInterest("booked"); expect(stageOf(E.id)).toBe("booked");
    psql(`update student_consult_interests set status = 'cancelled' where student_id = '${E.id}';`);
    expect(stageOf(E.id)).toBe("closed");
  });
  it("수동 검토 초대는 플래그, 상담 상태별(scheduled/completed/cancelled) 단계", () => {
    psql(`insert into guardian_link_invites (student_id, email_normalized, email_original, status, manual_review_reason, token_hash, expires_at)
          values ('${E.id}', '${RUN}-g@example.com', '${RUN}-g@example.com', 'manual_review', 'x', '${RUN}-th', now() + interval '1 day');`);
    const p = jsonAs(ADMIN_ID, `admin_free_account_profile('${E.id}')`);
    expect(p.consultFlags).toContain("invite_needs_review");
    expect(p.consultStage).toBe("invitation_pending");
    const mk = (status: string) =>
      psql(`insert into consultations (source, status, contact_name, contact_email, child_id, admissions_consultant_id, starts_at, ends_at)
            values ('free_member', '${status}', 'g', '${RUN}-g@example.com', '${E.id}', '${consultant}', now(), now() + interval '30 minutes') returning id;`).split("\n")[0];
    const c1 = mk("scheduled"); expect(stageOf(E.id)).toBe("booked");
    psql(`update consultations set status = 'cancelled', cancelled_at = now() where id = '${c1}';`); expect(stageOf(E.id)).toBe("booking_cancelled");
    psql(`set session_replication_role = replica; update consultations set created_at = now() - interval '1 hour' where id = '${c1}'; set session_replication_role = origin;`);
    const c2 = mk("completed"); void c2; expect(stageOf(E.id)).toBe("completed");
  });
  it("프로필 jsonb 는 연락처 PII(전화번호)를 담지 않는다", () => {
    const p = jsonAs(ADMIN_ID, `admin_free_account_profile('${E.id}')`);
    expect(JSON.stringify(p)).not.toMatch(/phone/i);
    expect(p).toMatchObject({ memberType: "free", name: E.name });
  });
  it("열람 감사: free_profile 은 10분 디듀프", () => {
    expect(rpcAs(ADMIN_ID, `select record_staff_student_view('${D.id}', 'free_profile');`)).toBe("t");
    expect(rpcAs(ADMIN_ID, `select record_staff_student_view('${D.id}', 'free_profile');`)).toBe("f");
    expect(fails(() => rpcAs(supervisorNoCap, `select record_staff_student_view('${D.id}', 'free_profile');`))).toContain("권한");
  });
});

describe("전환·이력 보존", () => {
  it("convert 는 converted_at 을 최초 1회만 기록하고(멱등) 학생 id·응시·계정 이력은 보존된다", () => {
    const c = psql(`insert into consultations (source, status, contact_name, contact_email, child_id) values ('free_member', 'requested', 'g', '${RUN}-g2@example.com', '${B.id}') returning id;`).split("\n")[0];
    const svc = (sql: string) => psql(`begin; select set_config('request.jwt.claims','{"role":"service_role"}',true); ${sql} commit;`).split("\n").filter(Boolean).pop();
    const before = psql(`select converted_at is null from students where id = '${B.id}'`);
    expect(before).toBe("t");
    expect(svc(`select convert_free_member_to_tutoring('${B.id}', '${c}');`)).toBe("t");
    const t1 = psql(`select converted_at from students where id = '${B.id}'`);
    expect(t1).not.toBe("");
    expect(svc(`select convert_free_member_to_tutoring('${B.id}', '${c}');`)).toBe("f");
    expect(psql(`select converted_at from students where id = '${B.id}'`)).toBe(t1);
    expect(psql(`select member_type from students where id = '${B.id}'`)).toBe("tutoring");
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${B.id}'`)).toBe("1"); // 학습 기록 보존
    const inc = `p_cohort_ids => ${cohort()}, p_include_test => true`;
    expect(listRows(ADMIN_ID, `${inc}, p_scope => 'free'`).map((r) => r[0])).not.toContain(B.id);
    expect(listRows(ADMIN_ID, `${inc}, p_scope => 'converted'`).map((r) => r[0])).toEqual([B.id]);
    expect(listRows(ADMIN_ID, `${inc}, p_scope => 'converted'`)[0][2]).toBe("converted");
    expect(listRows(ADMIN_ID, `${inc}, p_scope => 'all'`).map((r) => r[0])).toContain(B.id);
  });
});

describe("테스트 계정 표식·마지막 활동·계정 상태", () => {
  it("이메일 패턴 함수와 신규 학생 트리거(example.com·uat- 는 표식, 실도메인은 아님)", () => {
    const t = (e: string) => psql(`select _email_is_test('${e}')`);
    expect(t("a@example.com")).toBe("t");
    expect(t("uat-x@gmail.com")).toBe("t");
    expect(t("x@school.test")).toBe("t");
    expect(t("parent@gmail.com")).toBe("f");
    expect(psql(`select is_test_account, test_account_source from students where id = '${A.id}'`)).toBe("t|pattern");
    expect(psql(`select is_test_account from students where id = '${D.id}'`)).toBe("f");
  });
  it("admin_set_test_account: 사유 필수·감사 기록·같은 값 재호출은 이력 없음", () => {
    expect(fails(() => rpcAs(ADMIN_ID, `select admin_set_test_account('${D.id}', true, '  ');`))).toContain("reason_required");
    rpcAs(ADMIN_ID, `select admin_set_test_account('${D.id}', true, 'qa dummy');`);
    rpcAs(ADMIN_ID, `select admin_set_test_account('${D.id}', true, 'again');`);
    expect(psql(`select count(*) from student_flag_events where student_id = '${D.id}'`)).toBe("1");
    expect(psql(`select is_test_account, test_account_source from students where id = '${D.id}'`)).toBe("t|manual");
    rpcAs(ADMIN_ID, `select admin_set_test_account('${D.id}', false, 'real user');`);
    expect(psql(`select is_test_account, test_account_source is null from students where id = '${D.id}'`)).toBe("f|t");
    expect(psql(`select count(*) from student_flag_events where student_id = '${D.id}'`)).toBe("2");
  });
  it("touch_student_activity: 10분 쓰로틀, 활동 일은 학생당 하루 1행", () => {
    expect(psql(`select last_active_at is null from students where id = '${D.id}'`)).toBe("t");
    asUser(D.id, `select touch_student_activity();`);
    const first = psql(`select last_active_at from students where id = '${D.id}'`);
    asUser(D.id, `select touch_student_activity();`);
    expect(psql(`select last_active_at from students where id = '${D.id}'`)).toBe(first);
    expect(psql(`select count(*) from student_activity_days where student_id = '${D.id}'`)).toBe("1");
    psql(`update students set last_active_at = now() - interval '11 minutes' where id = '${D.id}'`);
    asUser(D.id, `select touch_student_activity();`);
    expect(psql(`select last_active_at > now() - interval '1 minute' from students where id = '${D.id}'`)).toBe("t");
    expect(psql(`select count(*) from student_activity_days where student_id = '${D.id}'`)).toBe("1");
  });
  it("계정 상태 변경은 기존 RPC·감사 이력을 쓰고 프로필 이력에 보인다", () => {
    for (const s of ["suspended", "closure_pending"]) rpcAs(ADMIN_ID, `select transition_account_status('${D.id}', '${s}', 'fa test');`);
    const p = jsonAs(ADMIN_ID, `admin_free_account_profile('${D.id}')`);
    expect(p.accountStatus).toBe("closure_pending");
    expect(p.statusHistory.map((h: { new: string }) => h.new)).toEqual(["closure_pending", "suspended"]);
    expect(fails(() => rpcAs(consultant, `select transition_account_status('${D.id}', 'closed', 'x');`))).toContain("관리자만");
  });
});

describe("Analytics(코호트 한정)", () => {
  it("테스트 계정 기본 제외·표본 분모", () => {
    // D 는 위 테스트에서 closure_pending, B 는 전환됨 → 무료·열린 계정은 A(test)·E(test)
    const a = (inc: boolean) => jsonAs(ADMIN_ID, `admin_free_accounts_analytics(current_date - 1, current_date + 1, ${inc}, ${cohort()})`);
    const excl = a(false), incl = a(true);
    expect(excl.signups.totalFreeAccounts).toBe(1); // D(실계정, closure_pending 은 열린 계정) — A·E 는 테스트, B 는 전환
    expect(excl.testAccountsExcluded).toBeGreaterThanOrEqual(2);
    expect(incl.signups.totalFreeAccounts).toBe(3); // A, D, E
    expect(incl.testAccountsExcluded).toBe(0);
    expect(incl.learning.testsStarted).toBe(2); // A·B 응시 시작
    expect(incl.learning.testsCompleted).toBe(1); // A graded
    expect(incl.learning.startedCohortSize).toBe(2);
    expect(incl.learning.startedCohortCompleted).toBe(1);
    expect(incl.conversion.tutoringConversions).toBe(1); // B
    expect(incl.conversion.cohort.size).toBe(4);
    expect(incl.conversion.cohort.converted).toBe(1);
    expect(incl.conversion.consultRequests).toBeGreaterThanOrEqual(2);
    expect(incl.period.timezone).toBe("Asia/Seoul");
    expect(NOW_YEAR_DAY).toBeTruthy();
  });
  it("기간 밖은 0 이고 잘못된 기간은 거절", () => {
    const out = jsonAs(ADMIN_ID, `admin_free_accounts_analytics(date '2020-01-01', date '2020-01-31', true, ${cohort()})`);
    expect(out.signups.newInPeriod).toBe(0);
    expect(out.learning.testsStarted).toBe(0);
    expect(fails(() => rpcAs(ADMIN_ID, `select admin_free_accounts_analytics(current_date, current_date - 5, true);`))).toContain("invalid_period");
  });
});

describe("학습 사용 지표", () => {
  it("저장되지 않는 항목은 not_tracked 마커, 저장된 값은 실제 집계", () => {
    psql(`insert into vocab_words (student_id, word, definition) values ('${A.id}', 'fa-${RUN}', 'x');`);
    const u = jsonAs(ADMIN_ID, `admin_free_account_learning_usage('${A.id}')`);
    expect(u.vocabulary).toMatchObject({ wordsSaved: 1, flashcardStudy: "not_tracked" });
    expect(u.mistakeNotebook.reviewed).toBe("not_tracked");
    expect(u.materials).toMatchObject({ views: "not_tracked", timeSpent: "not_tracked" });
    expect(u.tracking.learningEventsSince).toBeNull();
    psql(`delete from vocab_words where student_id = '${A.id}'`);
  });
});
