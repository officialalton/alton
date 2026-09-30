import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  ADMIN_ID,
  SEED_GUARDIAN_ID,
  SEED_STUDENT_ID,
  TEACHER_ID,
  answer,
  assign,
  createRoutingSet,
  createStudent,
  psql,
  rest,
  routes,
  start,
  submitModule,
  type RoutingFixture,
} from "../../test/mock-exam-routing-fixture";

// MST Phase 3 — 경로 비노출 감사. 실제 PostgREST(REST/RPC)를 학생·보호자·교사·관리자 JWT 로 호출한다(모킹·외부 호출 없음).
// 학생 A(seed 학생, 보호자 연결)는 M1 만점 → higher, 학생 B(실행별 신규)는 M1 1/4 → lower.
// 학생·보호자 응답에는 route/routing/policy/threshold 정보와 변형 단서(난이도 라벨·변형별 position)가 없어야 하고,
// 두 학생의 payload 모양은 동일해야 한다. 직원(교사·관리자)은 RPC 로 경로·정책 버전을 본다.

const RUN = randomUUID().slice(0, 8);
let fx: RoutingFixture;
let studentB: string;
let attemptA: string;
let attemptB: string;

const keys = (o: unknown) => Object.keys(o as object).sort();
const itemKeys = (d: { items: object[] }) => [...new Set(d.items.flatMap((i) => Object.keys(i)))].sort();
const LEAK = /route|routing|higher|lower|policy|threshold|assembly_rules|readiness/i;

beforeAll(() => {
  fx = createRoutingSet({ run: RUN, label: "nondisclosure" });
  studentB = createStudent("ndB", RUN);
  attemptA = assign(SEED_STUDENT_ID, fx.setId);
  attemptB = assign(studentB, fx.setId);
  start(SEED_STUDENT_ID, attemptA);
  start(studentB, attemptB);
  answer(SEED_STUDENT_ID, attemptA, fx.ids.rw_m1, 4);
  answer(studentB, attemptB, fx.ids.rw_m1, 1);
  submitModule(SEED_STUDENT_ID, attemptA, "rw_m1");
  submitModule(studentB, attemptB, "rw_m1");
});

describe("전제: 두 학생은 서로 다른 경로·문항을 받았다", () => {
  it("A=higher, B=lower (서버 내부 기록)", () => {
    expect(routes(attemptA).rw).toBe("higher");
    expect(routes(attemptB).rw).toBe("lower");
  });
});

describe("REST 테이블 읽기: 학생·보호자 JWT 는 경로·정책을 읽을 수 없다", () => {
  for (const [label, uid] of [
    ["학생", SEED_STUDENT_ID],
    ["보호자", SEED_GUARDIAN_ID],
  ] as const) {
    it(`${label}: mock_exam_attempts 의 경로·정책 버전 컬럼은 명시해도 select=* 로도 거부(42501)`, async () => {
      for (const col of ["rw_m2_route", "math_m2_route", "rw_m2_route_policy_version", "math_m2_route_policy_version", "*"]) {
        const r = await rest(uid, `mock_exam_attempts?select=${encodeURIComponent(col)}&limit=1`);
        expect([401, 403]).toContain(r.status);
        expect(JSON.stringify(r.json)).toContain("42501");
      }
      // 나머지 컬럼은 정상 조회(회귀: 컬럼 회수가 기존 화면을 깨지 않는다)
      const ok = await rest(uid, `mock_exam_attempts?select=id,status,exam_set_id,student_id,current_module&id=eq.${attemptA}`);
      expect(ok.status).toBe(200);
      expect((ok.json as unknown[]).length).toBe(1);
    });

    it(`${label}: 정책 테이블은 읽기·쓰기 모두 거부`, async () => {
      const r = await rest(uid, "mock_exam_routing_policies?select=*");
      expect([401, 403]).toContain(r.status);
      expect(JSON.stringify(r.json)).toContain("42501");
      const w = await rest(uid, "mock_exam_routing_policies", { method: "POST", body: { section: "rw", threshold_type: "correct_count", threshold_value: 0, version: 999 } });
      expect([401, 403]).toContain(w.status);
    });

    it(`${label}: 세트 행의 조립 규칙·검증 보고서(변형 목록)와 세트 문항의 route 는 읽히지 않는다`, async () => {
      for (const col of ["assembly_rules", "readiness_report", "*"]) {
        const r = await rest(uid, `mock_exam_sets?select=${col}&id=eq.${fx.setId}`);
        expect([401, 403]).toContain(r.status);
      }
      const sets = await rest(uid, `mock_exam_sets?select=id,name,format,status&id=eq.${fx.setId}`);
      expect(sets.status).toBe(200);
      const items = await rest(uid, `mock_exam_set_items?select=route,module_key,difficulty&exam_set_id=eq.${fx.setId}`);
      expect(items.status).toBe(200);
      expect(items.json).toEqual([]); // RLS: 관리자 전용
    });

    it(`${label}: 모듈 행에는 경로 컬럼이 없고 raw_correct_count 는 여전히 거부`, async () => {
      const m = await rest(uid, `mock_exam_attempt_modules?select=*&attempt_id=eq.${attemptA}`);
      expect([401, 403]).toContain(m.status); // select=* 는 raw_correct_count 때문에 거부(20261909)
      const ok = await rest(uid, `mock_exam_attempt_modules?select=module_key,item_count,locked&attempt_id=eq.${attemptA}`);
      expect(ok.status).toBe(200);
      expect(JSON.stringify(ok.json)).not.toMatch(LEAK);
    });

    it(`${label}: 검증 RPC 는 호출할 수 없다`, async () => {
      const r = await rest(uid, "rpc/mock_exam_validate_mst_set", { method: "POST", body: { p_exam_set_id: fx.setId } });
      expect([401, 403]).toContain(r.status);
    });
  }
});

describe("RPC 응답: 학생·보호자에게 경로 단서가 없고 두 학생의 payload 모양이 같다", () => {
  it("mock_exam_mst_state: 키 집합·position·moduleSeq 동일, 난이도 라벨 null, LEAK 패턴 없음, 문항 집합은 서로 다름", async () => {
    const a = await rest(SEED_STUDENT_ID, "rpc/mock_exam_mst_state", { method: "POST", body: { p_attempt_id: attemptA } });
    const b = await rest(studentB, "rpc/mock_exam_mst_state", { method: "POST", body: { p_attempt_id: attemptB } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const da = a.json as { items: { setItemId: string; position: number; moduleSeq: number; difficulty: string | null }[] };
    const db = b.json as typeof da;
    expect(keys(da)).toEqual(keys(db));
    expect(itemKeys(da)).toEqual(itemKeys(db));
    expect(da.items.map((i) => [i.position, i.moduleSeq])).toEqual(db.items.map((i) => [i.position, i.moduleSeq]));
    expect(da.items.every((i) => i.difficulty === null) && db.items.every((i) => i.difficulty === null)).toBe(true);
    expect(a.text).not.toMatch(LEAK);
    expect(b.text).not.toMatch(LEAK);
    // 실제로는 서로 다른 M2 문항을 받았다
    expect(da.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_higher].sort());
    expect(db.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_lower].sort());
    expect(da.items).toHaveLength(db.items.length);
  });

  it("mock_exam_attempt_detail: 학생·보호자에게 routing 키 없음, 키 집합 동일, 난이도 null", async () => {
    const sa = await rest(SEED_STUDENT_ID, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    const sb = await rest(studentB, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptB } });
    const pa = await rest(SEED_GUARDIAN_ID, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    for (const r of [sa, sb, pa]) {
      expect(r.status).toBe(200);
      expect(r.text).not.toMatch(LEAK);
      expect(Object.keys(r.json as object)).not.toContain("routing");
    }
    expect(keys(sa.json)).toEqual(keys(sb.json));
    expect(itemKeys(sa.json as { items: object[] })).toEqual(itemKeys(sb.json as { items: object[] }));
    const items = (sa.json as { items: { difficulty: string | null }[] }).items;
    expect(items.every((i) => i.difficulty === null)).toBe(true);
    // 진행 중에는 현재 모듈(M2) 문항만
    expect((sa.json as { items: unknown[] }).items).toHaveLength(2);
  });

  it("요약(mock_exam_attempt_summaries): 학생·보호자 모두 경로 키 없음, totalCount 는 응시자가 풀 문항 수(변형 하나)", async () => {
    for (const [uid, sid] of [
      [SEED_STUDENT_ID, SEED_STUDENT_ID],
      [SEED_GUARDIAN_ID, SEED_STUDENT_ID],
      [studentB, studentB],
    ] as const) {
      const r = await rest(uid, "rpc/mock_exam_attempt_summaries", { method: "POST", body: { p_student_id: sid } });
      expect(r.status).toBe(200);
      expect(r.text).not.toMatch(LEAK);
      const row = (r.json as { id: string; totalCount: number }[]).find((x) => x.id === attemptA || x.id === attemptB);
      expect(row?.totalCount).toBe(10);
    }
  });

  it("다른 변형 문항 답 저장 시도는 학생에게 '없는 문항'과 같은 오류(경로·변형 존재 비노출)", async () => {
    const wrong = await rest(SEED_STUDENT_ID, "rpc/mock_exam_save_answer", {
      method: "POST",
      body: { p_attempt_id: attemptA, p_set_item_id: fx.ids.rw_lower[0], p_response: "0" },
    });
    const missing = await rest(SEED_STUDENT_ID, "rpc/mock_exam_save_answer", {
      method: "POST",
      body: { p_attempt_id: attemptA, p_set_item_id: randomUUID(), p_response: "0" },
    });
    expect(wrong.status).toBe(missing.status);
    expect((wrong.json as { message: string }).message).toBe((missing.json as { message: string }).message);
  });
});

describe("직원(교사·관리자)은 RPC 로 경로와 정책 버전을 본다", () => {
  it("담당 교사·관리자: mock_exam_attempt_detail.routing 에 route·policyVersion, 직접 컬럼 읽기는 교사도 거부(RPC 전용)", async () => {
    for (const uid of [TEACHER_ID, ADMIN_ID]) {
      const r = await rest(uid, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
      expect(r.status).toBe(200);
      const d = r.json as { routing: { rw: { route: string; policyVersion: number }; math: { route: string | null } }; items: { difficulty: string | null }[] };
      expect(d.routing.rw.route).toBe("higher");
      expect(Number(d.routing.rw.policyVersion)).toBe(Number(routes(attemptA).rwV));
      expect(d.routing.math.route).toBeNull();
      expect(d.items.some((i) => i.difficulty !== null)).toBe(true); // 직원은 난이도 라벨 확인 가능
    }
    const direct = await rest(TEACHER_ID, `mock_exam_attempts?select=rw_m2_route&id=eq.${attemptA}`);
    expect([401, 403]).toContain(direct.status);
    // 관리자 서버 화면은 service_role 로 컬럼을 직접 읽는다(회귀 확인은 관리자 통합 테스트 + 여기서 psql owner 조회)
    expect(psql(`select rw_m2_route from mock_exam_attempts where id = '${attemptA}';`)).toBe("higher");
  });

  it("교사 배정 흐름 회귀: 담당 교사가 새 세트를 학생에게 배정(insert)·재배정(update)할 수 있다(컬럼 회수 후에도)", async () => {
    const newSet = createRoutingSet({ run: RUN, label: "teacher-assign" });
    const ins = await rest(TEACHER_ID, "mock_exam_attempts?select=id", {
      method: "POST",
      body: { student_id: SEED_STUDENT_ID, exam_set_id: newSet.setId, assigned_by: TEACHER_ID },
    });
    expect([200, 201]).toContain(ins.status);
    const id = (ins.json as { id: string }[])[0].id;
    const upd = await rest(TEACHER_ID, `mock_exam_attempts?id=eq.${id}&select=id`, { method: "PATCH", body: { max_attempts: 1 } });
    expect(upd.status).toBe(200);
  });
});
