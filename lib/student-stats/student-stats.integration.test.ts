import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TEACHER_ID, answer, assign, createRoutingSet, createStudent, psql, start, submitModule, type RoutingFixture,
} from "../../test/mock-exam-routing-fixture";
import { buildExtendedStats } from "./metrics";
import type { RawStatsAggregate } from "./types";

// 학생 통계 집계 RPC(student_stats_aggregate, 20261960000000) — 실제 DB. 실행 ID(RUN) 전용 학생·문제·과제·세트만
// 만들고 다른 실행과 겹치지 않는다(재실행 안전, 공용 계정은 읽기만). 대상 DB 는 SUPABASE_TEST_DB_URL.
const RUN = randomUUID().slice(0, 8);
let student: string;
let fx: RoutingFixture;
let agg: RawStatsAggregate;

function asService(sql: string): string {
  return execFileSync(
    "psql",
    [process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c",
      `begin; select set_config('request.jwt.claims','{"role":"service_role"}',true); ${sql}; commit;`],
    { encoding: "utf-8" },
  ).trim().split("\n").filter((l) => l.startsWith("{") || l.startsWith("[")).pop() ?? "";
}
const statsJson = (id: string, staff = false) => JSON.parse(asService(`select public.student_stats_aggregate('${id}', ${staff})::text`)) as RawStatsAggregate;
const probIds: string[] = [];
const prob = (skill: string) => {
  const id = psql(`insert into problems (format, skill_code, status) values ('mc', '${skill}', 'confirmed') returning id;`).split("\n")[0];
  probIds.push(id);
  return id;
};
const iso = (d: number) => `now() - interval '${d} days'`;

beforeAll(() => {
  student = createStudent("stats", RUN);
  const [p1, p2, p3, p4] = [prob("linear_functions"), prob("linear_functions"), prob("linear_functions"), prob("probability")];
  const item = (id: string, pos: number, extra: string) =>
    `jsonb_build_object('problemId','${id}','position',${pos},'format','mc'${extra})`;
  psql(`insert into homework_batches (teacher_id, student_id, label, due_at, items) values ('${TEACHER_ID}', '${student}', 'stats-${RUN}', ${iso(2)},
    jsonb_build_array(
      ${item(p1, 1, `,'submittedAt',(${iso(3)})::text,'graded',true,'gradedAt',(${iso(3)})::text,'grade','correct','autoCorrect',true`)},
      ${item(p2, 2, `,'submittedAt',(${iso(1)})::text,'graded',true,'gradedAt',(${iso(1)})::text,'grade','incorrect','autoCorrect',false`)},
      ${item(p3, 3, `,'graded',false`)},
      ${item(p4, 4, `,'submittedAt',(${iso(1)})::text,'graded',false,'autoCorrect',true`)}));`);
  psql(`insert into vocab_quizzes (owner_id, created_by, source, items, status, score, total, submitted_at) values ('${student}','${student}','{}'::jsonb,'[]'::jsonb,'completed',7,10, ${iso(2)});
        insert into vocab_quizzes (owner_id, created_by, source, items, status, due_at) values ('${student}','${student}','{}'::jsonb,'[]'::jsonb,'pending', ${iso(1)});
        insert into vocab_words (student_id, word, definition) values ('${student}', 'stat-${RUN}', 'x');
        insert into board_manual_tasks (student_id, title, status, due_at, created_by, created_by_role) values
          ('${student}','late-${RUN}','backlog',${iso(1)},'${student}','student'),
          ('${student}','done-${RUN}','done',${iso(1)},'${student}','student');`);
  const prod = psql(`select id from entitlement_products where code = 'lesson_pack_1' limit 1;`);
  const grant = psql(`insert into entitlement_grants (child_id, entitlement_product_id, original_quantity, expires_at) values ('${student}','${prod}',5, now() + interval '7 days') returning id;`).split("\n")[0];
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grant}','grant',5,'stats-${RUN}');`);

  // 모의고사 MST 한 번 완주(R&W higher·Math higher) → graded.
  fx = createRoutingSet({ run: RUN, label: "stats" });
  const att = assign(student, fx.setId);
  start(student, att);
  answer(student, att, fx.ids.rw_m1, 4);
  submitModule(student, att, "rw_m1");
  answer(student, att, fx.ids.rw_higher, 1);
  submitModule(student, att, "rw_m2");
  submitModule(student, att, "break");
  answer(student, att, fx.ids.math_m1, 2);
  submitModule(student, att, "math_m1");
  answer(student, att, fx.ids.math_higher, 2);
  submitModule(student, att, "math_m2");
  agg = statsJson(student, true);
}, 120_000);

// 정리: 이 실행이 만든 과제·단어·보드·수업권·문제 행만 지운다(학생·모의고사 세트는 공용 픽스처 정책대로 남긴다).
afterAll(() => {
  psql(`set session_replication_role = replica;
    delete from homework_batches where student_id = '${student}';
    delete from vocab_quizzes where owner_id = '${student}';
    delete from vocab_words where student_id = '${student}';
    delete from board_manual_tasks where student_id = '${student}';
    delete from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id = '${student}');
    delete from entitlement_grants where child_id = '${student}';
    delete from problems where id = any(array['${probIds.join("','")}']::uuid[]);
    set session_replication_role = origin;`);
}, 60_000);

describe("student_stats_aggregate 권한", () => {
  it("authenticated·anon 은 직접 실행할 수 없다(서버·서비스 롤 전용)", () => {
    for (const role of ["authenticated", "anon"]) {
      let err = "";
      try {
        psql(`begin; set local role ${role}; select public.student_stats_aggregate('${student}', false); commit;`);
      } catch (e) { err = String((e as { stderr?: string }).stderr ?? e); }
      expect(err).toContain("permission denied");
    }
  });
  it("service_role 이 아닌 호출은 함수 안에서도 거절", () => {
    let err = "";
    try { psql(`select public.student_stats_aggregate('${student}', false);`); } catch (e) { err = String((e as { stderr?: string }).stderr ?? e); }
    expect(err).toContain("서버에서만");
  });
  it("관리자 전용 블록은 p_include_staff=true 일 때만", () => {
    expect(statsJson(student, false).staff).toBeNull();
    expect(agg.staff).not.toBeNull();
  });
});

describe("집계 값", () => {
  it("skill 정답률은 채점 확정된 응답만(미확정 문항·미제출 제외)", () => {
    expect(agg.skills).toHaveLength(1);
    expect(agg.skills[0]).toMatchObject({ code: "linear_functions", total: 2, correct: 1 });
  });
  it("과제: 배정 4·제출 3·기한 내 1·채점 2·정답 1, 기한 초과 1건", () => {
    expect(agg.homework).toMatchObject({ assigned: 4, submitted: 3, onTime: 1, graded: 2, correct: 1 });
    expect(agg.overdue).toMatchObject({ homework: 1, vocabQuiz: 1, manual: 1, mockExam: 0 });
  });
  it("학습 습관·단어 시험·수업권", () => {
    const week = agg.habits.reduce((a, h) => ({ hw: a.hw + h.homework, v: a.v + h.vocab }), { hw: 0, v: 0 });
    expect(week).toEqual({ hw: 3, v: 1 });
    expect(agg.vocabQuizzes).toHaveLength(1);
    expect(agg.vocabQuizzes[0]).toMatchObject({ score: 7, total: 10 });
    expect(Number(agg.entitlements?.remaining)).toBe(5);
    expect(Number(agg.entitlements?.expiringSoon)).toBe(5);
  });
  it("모의고사: 채점 완료 1건, 섹션·영역 집계(R&W 6문항 중 5 정답)", () => {
    expect(agg.mock).toHaveLength(1);
    const rw = agg.mock[0].sections.find((s) => s.section === "rw")!;
    expect(rw).toMatchObject({ total: 6, correct: 5 });
    expect(agg.mock[0].rwRoute).toBe("higher");
  });
  it("주·월 배열은 항상 12주·6개월", () => {
    expect(agg.habits).toHaveLength(12);
    expect(agg.skillWeekly).toHaveLength(12);
    expect(agg.ops).toHaveLength(6);
  });
  it("다른 학생의 데이터는 섞이지 않는다", () => {
    const other = statsJson(createStudent("statsOther", RUN));
    expect(other.skills).toHaveLength(0);
    expect(other.homework.assigned).toBe(0);
    expect(other.mock).toHaveLength(0);
  });
});

describe("등급별 화면 데이터 — 경로·정책·직원 전용 정보 비노출", () => {
  const LEAK = /route|routing|higher|lower|policy|threshold|difficult|modelVersion|satisfaction|teacherOps|strengths/i;
  it("family(학생 본인=학부모): 예상 점수 범위 총점만, 위 키 전혀 없음", () => {
    const fam = buildExtendedStats(agg, "family");
    expect(fam.mock.points[0].total).toMatchObject({ low: expect.any(Number), high: expect.any(Number) });
    expect(fam.mock.points[0].rw).toBeNull();
    expect(JSON.stringify(fam)).not.toMatch(LEAK);
  });
  it("staff: 섹션 범위·강약은 있지만 경로·정책 버전은 없다", () => {
    const st = buildExtendedStats(agg, "staff");
    expect(st.mock.strengths).toBeDefined();
    expect(st.mock.points[0].rw).not.toBeNull();
    expect(st.teacherOps).toBeUndefined();
    expect(JSON.stringify(st).replace(/strengths/g, "")).not.toMatch(/route|routing|higher|lower|policy|difficult|modelVersion/i);
  });
  it("admin: 선생님 운영 지표 포함, 경로는 여전히 없다", () => {
    const ad = buildExtendedStats(agg, "admin");
    expect(ad.teacherOps).toBeDefined();
    expect(JSON.stringify(ad).replace(/strengths|teacherOps/g, "")).not.toMatch(/route|routing|higher|lower|policy|difficult|modelVersion/i);
  });
});

