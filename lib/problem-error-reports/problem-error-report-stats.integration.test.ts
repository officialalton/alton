import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, SEED_GUARDIAN_ID, SEED_STUDENT_ID, SUBJECT_ID, TEACHER_ID, createStudent, psql, rest } from "@/test/mock-exam-routing-fixture";

// 오류 신고 통계 집계 RPC(problem_error_report_stats)·신고 내역 필터 — 실제 로컬 DB/PostgREST.
// 공유 DB 에는 다른 신고가 있으므로 실행 ID 가 붙은 전용 skill_code(zz<RUN>) 칸으로 절대값을, 전체 합계는 전후 차이로 검증한다.
// 신고·판정은 추가 전용이라 afterAll 에서 replica 모드로 이 실행의 행만 지운다.

const RUN = randomUUID().slice(0, 8);
const SKILL = `zz${RUN}`;
let p: Record<"p1" | "p2" | "p3" | "p4" | "p5", string>;
let s1: string;
let s2: string;
let verdictId: string;

const mkProblem = (fmt: string, diff: string, via: string, archived = false) => {
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain, skill_code, created_via)
     values ('${fmt}', 'STAT ${RUN} ${randomUUID().slice(0, 6)}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', 'algebra', '${SKILL}', '${via}') returning id;`,
  ).split("\n")[0];
  psql(`update problem_versions set options = '["a","b"]'::jsonb, correct_index = 0, explanation = 'x', difficulty = '${diff}', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`);
  if (archived) psql(`update problems set archived_at = now(), archived_reason = 'test' where id = '${id}';`);
  return id;
};
const versionOf = (id: string) => psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
const report = (problem: string, reporter: string, role: string, type: string, daysAgo: number, source = "session_assignment", memo = "null") =>
  psql(
    `insert into problem_error_reports (problem_id, problem_version_id, source, session_source, reporter_id, reporter_role, report_type, memo, created_at)
     values ('${problem}', '${versionOf(problem)}', '${source}', ${source === "session_assignment" ? "'homework'" : "null"}, '${reporter}', '${role}', '${type}', ${memo}, now() - interval '${daysAgo} days');`,
  );

type Stats = {
  totals: { reports: number; reportedProblems: number; openReports: number; activeProblems: number; confirmed: number; notError: number };
  axes: Record<string, { key: string; reports: number; reportedProblems: number; active: number | null; rate: number | null }[]>;
  topCells: { skill: string; difficulty: string; reports: number; reportedProblems: number; active: number | null; rate: number | null }[];
  weekly: { weekStart: string; reports: number }[];
};
const stats = async (days: number | null = null, uid: string | null = ADMIN_ID) => rest(uid, "rpc/problem_error_report_stats", { method: "POST", body: { p_days: days } });
const okStats = async (days: number | null = null) => {
  const r = await stats(days);
  expect(r.status).toBe(200);
  return r.json as Stats;
};
const skillRow = (s: Stats) => s.axes.skill.find((x) => x.key === SKILL);

let before: Stats;

beforeAll(async () => {
  before = await okStats();
  psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${SKILL}', 'algebra', 'STAT ${RUN}', 9999);`);
  s1 = createStudent("stat1", RUN);
  s2 = createStudent("stat2", RUN);
  p = {
    p1: mkProblem("mc", "hard", "ai_generated"),
    p2: mkProblem("mc", "hard", "manual"),
    p3: mkProblem("spr", "easy", "compiler"),
    p4: mkProblem("mc", "hard", "manual"), // 신고 없음 — 분모에만 들어간다
    p5: mkProblem("mc", "hard", "manual", true), // 보관·신고 없음 — 분모 제외
  };
  report(p.p1, s1, "student", "wrong_key", 0);
  report(p.p1, s2, "student", "other", 10, "session_assignment", "'메모'");
  report(p.p1, TEACHER_ID, "teacher", "bad_explanation", 3);
  report(p.p2, s1, "student", "flawed_problem", 40);
  report(p.p3, s1, "student", "wrong_key", 1, "mock_exam");
  verdictId = psql(`insert into problem_error_verdicts (problem_id, problem_version_id, decision, decided_by) values ('${p.p3}', '${versionOf(p.p3)}', 'not_error', '${ADMIN_ID}') returning id;`).split("\n")[0];
  psql(`update problem_error_reports set resolved_verdict_id = '${verdictId}', resolved_at = now() where problem_id = '${p.p3}';`);
});

afterAll(() => {
  const ids = Object.values(p ?? {}).map((x) => `'${x}'`).join(",");
  if (!ids) return;
  psql(`set session_replication_role = replica;
    delete from problem_error_reports where problem_id in (${ids});
    delete from problem_error_verdicts where problem_id in (${ids});
    delete from problem_versions where problem_id in (${ids});
    delete from problems where id in (${ids});
    delete from problem_skill_codes where code = '${SKILL}';
    delete from students where id in ('${s1}','${s2}');
    delete from profiles where id in ('${s1}','${s2}');
    delete from auth.users where id in ('${s1}','${s2}');`);
});

describe("집계 정확성", () => {
  it("전체 기간: 축별 신고 수·신고 문항·활성 문항·신고율(실행 전용 skill 칸 절대값)", async () => {
    const s = await okStats();
    expect(skillRow(s)).toMatchObject({ reports: 5, reportedProblems: 3, active: 4, rate: 0.75 });
    // 활성 문항 = 공개 버전이 있고 보관 안 된 문항(p1~p4). p5(보관·신고 없음)는 제외.
    expect(s.totals.reports - before.totals.reports).toBe(5);
    expect(s.totals.reportedProblems - before.totals.reportedProblems).toBe(3);
    expect(s.totals.openReports - before.totals.openReports).toBe(4);
    expect(s.totals.notError - before.totals.notError).toBe(1);
    expect(s.totals.confirmed - before.totals.confirmed).toBe(0);
  });

  it("유형·출처·판정·난이도·형식·생성 경로 축이 전후 차이로 맞는다", async () => {
    const s = await okStats();
    const delta = (axis: string, key: string) =>
      (s.axes[axis]?.find((x) => x.key === key)?.reports ?? 0) - (before.axes[axis]?.find((x) => x.key === key)?.reports ?? 0);
    expect(delta("reportType", "wrong_key")).toBe(2);
    expect(delta("reportType", "other")).toBe(1);
    expect(delta("reportType", "flawed_problem")).toBe(1);
    expect(delta("reportType", "bad_explanation")).toBe(1);
    expect(delta("source", "mock_exam")).toBe(1);
    expect(delta("source", "session_assignment")).toBe(4);
    expect(delta("verdict", "not_error")).toBe(1);
    expect(delta("verdict", "pending")).toBe(4);
    expect(delta("difficulty", "hard")).toBe(4);
    expect(delta("difficulty", "easy")).toBe(1);
    expect(delta("format", "spr")).toBe(1);
    const month = psql(`select to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');`);
    expect(delta("batch", `ai_generated|${month}`)).toBe(3);
    expect(delta("batch", `compiler|${month}`)).toBe(1);
    expect(s.axes.domain.find((x) => x.key === "algebra")).toBeTruthy();
  });

  it("기간 필터: 최근 30일·7일", async () => {
    const d30 = await okStats(30);
    expect(skillRow(d30)).toMatchObject({ reports: 4, reportedProblems: 2, active: 4, rate: 0.5 });
    const d7 = await okStats(7);
    expect(skillRow(d7)).toMatchObject({ reports: 3, reportedProblems: 2 });
  });

  it("상위 칸(skill×난이도)·주별 추이", async () => {
    const s = await okStats();
    const hard = s.topCells.find((c) => c.skill === SKILL && c.difficulty === "hard");
    const easy = s.topCells.find((c) => c.skill === SKILL && c.difficulty === "easy");
    expect(hard).toMatchObject({ reports: 4, reportedProblems: 2, active: 3, rate: 0.6667 });
    expect(easy).toMatchObject({ reports: 1, reportedProblems: 1, active: 1, rate: 1 });
    expect(s.weekly).toHaveLength(12);
    const total = s.weekly.reduce((a, w) => a + w.reports, 0);
    expect(total).toBeGreaterThanOrEqual(3); // 이번 주·지난주 포함(40일 전은 12주 안이라 더 많을 수 있음)
  });

  it("잘못된 기간은 거절한다", async () => {
    const r = await stats(0);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("권한 매트릭스 — 관리자만", () => {
  it.each([
    ["학생", () => SEED_STUDENT_ID],
    ["학부모", () => SEED_GUARDIAN_ID],
    ["선생님", () => TEACHER_ID],
    ["익명", () => null],
  ])("%s 는 통계 RPC 를 호출할 수 없다", async (_n, who) => {
    const r = await stats(null, who());
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.json)).not.toContain("totals");
  });

  it("비관리자는 REST 로 신고 원본 전체를 읽을 수 없다(학생은 본인 신고만)", async () => {
    const r = await rest(s2, "problem_error_reports?select=id");
    expect(r.status).toBe(200);
    expect((r.json as unknown[]).length).toBe(1); // s2 가 낸 신고 1건뿐
    const t = await rest(null, "problem_error_reports?select=id");
    expect(t.status === 200 ? (t.json as unknown[]).length : 0).toBe(0);
  });
});

describe("신고 내역 필터(상위 칸 이동)", () => {
  const groups = async (body: Record<string, unknown>) => {
    const r = await rest(ADMIN_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "all", p_skill: SKILL, ...body } });
    expect(r.status).toBe(200);
    return r.json as { total: number; rows: { problemId: string; reportCount: number }[] };
  };
  it("skill·난이도·기간·상태 필터가 문항 묶음 단위로 적용된다", async () => {
    expect((await groups({})).total).toBe(3);
    expect((await groups({ p_difficulty: "hard" })).total).toBe(2);
    expect((await groups({ p_difficulty: "easy" })).total).toBe(1);
    expect((await groups({ p_days: 30 })).total).toBe(2);
    expect((await groups({ p_status: "open" })).total).toBe(2); // p3 는 판정으로 닫힘
    const hard = await groups({ p_difficulty: "hard" });
    expect(hard.rows.map((r) => r.problemId).sort()).toEqual([p.p1, p.p2].sort());
    expect(hard.rows.find((r) => r.problemId === p.p1)?.reportCount).toBe(3);
  });
  it("필터 없는 기존 호출(p_status/p_limit/p_offset)은 그대로 동작, 비관리자는 거절", async () => {
    const r = await rest(ADMIN_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "all", p_limit: 5, p_offset: 0 } });
    expect(r.status).toBe(200);
    const d = await rest(SEED_STUDENT_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "all" } });
    expect(d.status).toBeGreaterThanOrEqual(400);
  });
});
