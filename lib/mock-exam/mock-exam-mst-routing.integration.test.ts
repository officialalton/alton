import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  ADMIN_ID,
  SEED_STUDENT_ID,
  TEACHER_ID,
  answer,
  asUser,
  assign,
  createRoutingSet,
  createStudent,
  fails,
  psql,
  publishSet,
  routes,
  start,
  state,
  submitModule,
  validate,
  type RoutingFixture,
} from "../../test/mock-exam-routing-fixture";

// MST Phase 3 — 라우팅의 DB 레벨 검증(psql + set role authenticated, 모킹·외부 호출 없음).
// 재실행 안전: 실행마다 새 세트·문항·학생을 만들고 단언은 이 실행이 만든 행으로 한정한다.
// 정책 변경 테스트는 rw 정책에 새 버전을 잠시 넣고 finally/afterAll 에서 원래 활성 버전으로 복원한다.

const RUN = randomUUID().slice(0, 8);
let fx: RoutingFixture;
let originalRwActive: string; // 원래 활성 rw 정책 version

beforeAll(() => {
  originalRwActive = psql(`select version from mock_exam_routing_policies where section = 'rw' and active;`);
  fx = createRoutingSet({ run: RUN });
});

afterAll(() => {
  // 정책 복원(이 파일이 만든 버전만 삭제하고 원래 버전을 다시 활성으로).
  psql(
    `delete from mock_exam_routing_policies where section = 'rw' and version > ${originalRwActive} and note like 'R3 ${RUN}%';
     update mock_exam_routing_policies set active = true where section = 'rw' and version = ${originalRwActive}
       and not exists (select 1 from mock_exam_routing_policies where section = 'rw' and active);`,
  );
});

describe("기본 정책 시드", () => {
  it("섹션마다 활성 정책이 정확히 하나 있고 값은 데이터다", () => {
    expect(psql(`select count(*) from mock_exam_routing_policies where section = 'rw' and active;`)).toBe("1");
    expect(psql(`select count(*) from mock_exam_routing_policies where section = 'math' and active;`)).toBe("1");
    expect(psql(`select threshold_type || '|' || threshold_value from mock_exam_routing_policies where section = 'rw' and version = 1;`)).toBe("correct_ratio|0.65");
  });
  it("정책 행의 값은 수정할 수 없고(새 버전 발행), 활성은 섹션당 하나(부분 unique)", () => {
    expect(fails(() => psql(`update mock_exam_routing_policies set threshold_value = 0.1 where section = 'rw' and version = 1;`))).toContain("수정할 수 없습니다");
    expect(fails(() => psql(`insert into mock_exam_routing_policies (section, threshold_type, threshold_value, version, active) values ('rw', 'correct_count', 3, 9999, true);`))).toContain("duplicate key");
  });
});

describe("검증(readiness): 변형 완성도", () => {
  it("정상 라우팅 세트는 ready, 변형 정원·모양 위반 없음", () => {
    const v = validate(fx.setId);
    expect(v.ready).toBe(true);
    expect(v.routing).toBe(true);
    expect(v.routeShapeViolationCount).toBe(0);
    expect(v.routingPolicyMissing).toEqual([]);
    const m2 = v.modules.filter((m: { moduleKey: string }) => m.moduleKey === "rw_m2");
    expect(m2.map((m: { route: string; found: number }) => `${m.route}:${m.found}`).sort()).toEqual(["higher:2", "lower:2"]);
  });

  it("한 변형이 비어 있으면(higher 하나 삭제) not ready + 해당 변형 found<needed", () => {
    const bad = createRoutingSet({ run: RUN, publish: false, label: "incomplete" });
    psql(`delete from mock_exam_set_items where id = '${bad.ids.rw_higher[0]}';`);
    const v = validate(bad.setId);
    expect(v.ready).toBe(false);
    expect(v.modules.find((m: { moduleKey: string; route: string }) => m.moduleKey === "rw_m2" && m.route === "higher")).toMatchObject({ found: 1, needed: 2, ok: false });
    // ready 가 아니면 배정·공개가 막힌다.
    psql(`update mock_exam_sets set readiness_status = 'incomplete' where id = '${bad.setId}';`);
    expect(fails(() => publishSet(bad.setId))).toContain("공개할 수 없습니다");
  });

  it("higher 변형이 통째로 없으면(lower만 존재) not ready", () => {
    const bad = createRoutingSet({ run: RUN, publish: false, label: "no-higher" });
    psql(`delete from mock_exam_set_items where id in ('${bad.ids.math_higher.join("','")}');`);
    const v = validate(bad.setId);
    expect(v.ready).toBe(false);
    expect(v.modules.find((m: { moduleKey: string; route: string }) => m.moduleKey === "math_m2" && m.route === "higher")).toMatchObject({ found: 0, ok: false });
  });

  it("변형 배정 불가 난이도(lower 에 hard, higher 에 easy)와 경로 없는 M2 문항은 not ready", () => {
    const a = createRoutingSet({ run: RUN, publish: false, label: "elig" });
    psql(`update mock_exam_set_items set difficulty = 'hard' where id = '${a.ids.rw_lower[0]}';`);
    const va = validate(a.setId);
    expect(va.ready).toBe(false);
    expect(va.variantEligibilityViolations).toHaveLength(1);
    const b = createRoutingSet({ run: RUN, publish: false, label: "shape" });
    psql(`update mock_exam_set_items set route = null where id = '${b.ids.rw_lower[0]}';`);
    const vb = validate(b.setId);
    expect(vb.ready).toBe(false);
    expect(vb.routeShapeViolationCount).toBe(1);
  });

  it("스냅샷 누락은 여전히 not ready(변경 불가 트리거를 우회해 null 로 만들 수 없으므로 존재 확인만)", () => {
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${fx.setId}' and content_snapshot is null;`)).toBe("0");
    expect(validate(fx.setId).missingSnapshotCount).toBe(0);
  });

  it("skill 균형은 경고 전용 — 쏠려도 라우팅 세트가 ready 를 잃지 않는다(하드 게이트 OFF 유지)", () => {
    const v = validate(fx.setId);
    expect(v.skillViolations).toEqual([]);
    expect(Array.isArray(v.skillWarnings)).toBe(true);
  });
});

describe("경로 결정 — M1 성과에 따라 M2 문항 집합이 다르다", () => {
  let hi: string; // 높은 성과 학생
  let lo: string;
  let hiAttempt: string;
  let loAttempt: string;

  beforeAll(() => {
    hi = createStudent("hi", RUN);
    lo = createStudent("lo", RUN);
    hiAttempt = assign(hi, fx.setId);
    loAttempt = assign(lo, fx.setId);
    start(hi, hiAttempt);
    start(lo, loAttempt);
  });

  it("시작 시 정책 버전이 응시에 고정되고 경로는 아직 없다", () => {
    const r = routes(hiAttempt);
    expect(r.rw).toBe("-");
    expect(r.math).toBe("-");
    expect(r.rwV).not.toBe("-");
    expect(r.mathV).not.toBe("-");
    // M2 모듈 정원(item_count)은 변형 하나 기준
    expect(psql(`select item_count from mock_exam_attempt_modules where attempt_id = '${hiAttempt}' and module_key = 'rw_m2';`)).toBe("2");
  });

  it("M1 제출 → 4/4 는 higher, 1/4 는 lower(정책 v 기록), 노출 M2 문항이 서로 다르고 정원은 같다", () => {
    const m1 = fx.ids.rw_m1;
    answer(hi, hiAttempt, m1, 4);
    answer(lo, loAttempt, m1, 1);
    submitModule(hi, hiAttempt, "rw_m1");
    submitModule(lo, loAttempt, "rw_m1");
    expect(routes(hiAttempt).rw).toBe("higher");
    expect(routes(loAttempt).rw).toBe("lower");
    expect(routes(hiAttempt).rwV).toBe(originalRwActive);
    const sh = state(hi, hiAttempt);
    const sl = state(lo, loAttempt);
    expect(sh.currentModule).toBe("rw_m2");
    expect(sl.currentModule).toBe("rw_m2");
    expect(sh.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_higher].sort());
    expect(sl.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_lower].sort());
    expect(sh.items).toHaveLength(sl.items.length);
    // 학생에게는 난이도 라벨이 없다(변형 추정 차단), position·moduleSeq 는 변형과 무관하게 동일(5,6 / 1,2)
    expect(sh.items.every((i) => i.difficulty === null)).toBe(true);
    expect(sh.items.map((i) => [i.position, i.moduleSeq])).toEqual(sl.items.map((i) => [i.position, i.moduleSeq]));
    expect(sh.items.map((i) => i.position)).toEqual([5, 6]);
  });

  it("중복 M1 제출은 재라우팅하지 않는다(멱등), 경로·버전은 직접 수정도 불가", () => {
    const before = routes(hiAttempt);
    submitModule(hi, hiAttempt, "rw_m1"); // 현재 모듈이 아니므로 no-op
    submitModule(hi, hiAttempt, "rw_m1");
    expect(routes(hiAttempt)).toEqual(before);
    // M1 답을 바꾸려 해도 잠김 → 거부(성과가 바뀌어 재라우팅되는 경로 없음)
    expect(fails(() => asUser(hi, `select mock_exam_save_answer('${hiAttempt}', '${fx.ids.rw_m1[0]}', '1', 1);`))).toContain("already been submitted");
    // 결정된 경로는 postgres/service 도 바꿀 수 없다.
    expect(fails(() => psql(`update mock_exam_attempts set rw_m2_route = 'lower' where id = '${hiAttempt}';`))).toContain("cannot be changed");
    // 학생은 UPDATE 정책 자체가 없어 0행(변화 없음) — 아래 routes() 로 확인.
    asUser(hi, `update mock_exam_attempts set rw_m2_route = 'lower' where id = '${hiAttempt}';`);
    // 2026-10-01: 교사 배정 RLS 가 제거돼 교사 UPDATE 는 0행(변화 없음), INSERT 는 거절된다. 경로·정책 버전 트리거는 서비스 롤에 대한 최종 방어로 남는다.
    const guardSet = createRoutingSet({ run: RUN, label: "guard" });
    const guardAttempt = assign(SEED_STUDENT_ID, guardSet.setId);
    asUser(TEACHER_ID, `update mock_exam_attempts set rw_m2_route = 'higher' where id = '${guardAttempt}';`);
    asUser(TEACHER_ID, `update mock_exam_attempts set math_m2_route_policy_version = 7 where id = '${guardAttempt}';`);
    const guardSet2 = createRoutingSet({ run: RUN, label: "guard2" });
    expect(fails(() => asUser(TEACHER_ID, `insert into mock_exam_attempts (student_id, exam_set_id, assigned_by, rw_m2_route) values ('${SEED_STUDENT_ID}', '${guardSet2.setId}', '${TEACHER_ID}', 'higher');`))).toContain("cannot be set directly");
    expect(routes(guardAttempt)).toMatchObject({ rw: "-", math: "-" });
    expect(routes(hiAttempt)).toEqual(before);
  });

  it("다른 변형 문항 답 저장·표시는 '문항 없음'과 같은 메시지로 거부(경로 비노출), 자기 변형은 허용", () => {
    expect(fails(() => asUser(hi, `select mock_exam_save_answer('${hiAttempt}', '${fx.ids.rw_lower[0]}', '0', 1);`))).toContain("Question not found.");
    expect(fails(() => asUser(hi, `select mock_exam_toggle_flag('${hiAttempt}', '${fx.ids.rw_lower[0]}', true);`))).toContain("Question not found.");
    expect(fails(() => asUser(lo, `select mock_exam_save_answer('${loAttempt}', '${fx.ids.rw_higher[0]}', '0', 1);`))).toContain("Question not found.");
    asUser(hi, `select mock_exam_save_answer('${hiAttempt}', '${fx.ids.rw_higher[0]}', '0', 1);`);
    expect(psql(`select count(*) from mock_exam_answers where attempt_id = '${hiAttempt}' and set_item_id = '${fx.ids.rw_lower[0]}';`)).toBe("0");
  });

  it("Math 는 섹션별로 독립 경로 — R&W higher 학생도 Math 1/2 이면 lower, 전체 완주 후 문항 수·position 은 경로와 무관하게 동일", () => {
    answer(hi, hiAttempt, fx.ids.rw_higher, 1);
    answer(lo, loAttempt, fx.ids.rw_lower, 2);
    submitModule(hi, hiAttempt, "rw_m2");
    submitModule(lo, loAttempt, "rw_m2");
    submitModule(hi, hiAttempt, "break");
    submitModule(lo, loAttempt, "break");
    answer(hi, hiAttempt, fx.ids.math_m1, 1); // 1/2 = 0.5 < 0.65 → lower
    answer(lo, loAttempt, fx.ids.math_m1, 2); // 2/2 → higher
    submitModule(hi, hiAttempt, "math_m1");
    submitModule(lo, loAttempt, "math_m1");
    expect(routes(hiAttempt)).toMatchObject({ rw: "higher", math: "lower" });
    expect(routes(loAttempt)).toMatchObject({ rw: "lower", math: "higher" });
    expect(state(hi, hiAttempt).items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.math_lower].sort());
    expect(state(lo, loAttempt).items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.math_higher].sort());
    answer(hi, hiAttempt, fx.ids.math_lower, 2);
    answer(lo, loAttempt, fx.ids.math_higher, 2);
    submitModule(hi, hiAttempt, "math_m2");
    submitModule(lo, loAttempt, "math_m2");
    expect(psql(`select status from mock_exam_attempts where id = '${hiAttempt}';`)).toBe("graded");
    for (const [s, a] of [[hi, hiAttempt], [lo, loAttempt]] as const) {
      const d = JSON.parse(asUser(s, `select mock_exam_attempt_detail('${a}')::text;`));
      // 풀지 않은 다른 변형 문항은 결과에도 없다: R&W 4+2, Math 2+2 = 10
      expect(d.items).toHaveLength(10);
      expect(d.items.filter((i: { section: string }) => i.section === "rw").map((i: { position: number }) => i.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(d.items.filter((i: { section: string }) => i.section === "math").map((i: { position: number }) => i.position)).toEqual([1, 2, 3, 4]);
      const summary = JSON.parse(asUser(s, `select mock_exam_attempt_summaries('${s}')::text;`)).find((x: { id: string }) => x.id === a);
      expect(summary.totalCount).toBe(10);
    }
  });
});

describe("시간 만료 자동 제출도 라우팅한다", () => {
  it("M1 을 제출하지 않고 만료 → 상태 조회가 자동 잠금·경로 결정(3/4 → higher), 무응답 만료 → lower", () => {
    const s1 = createStudent("exp1", RUN);
    const s2 = createStudent("exp2", RUN);
    const a1 = assign(s1, fx.setId);
    const a2 = assign(s2, fx.setId);
    start(s1, a1);
    start(s2, a2);
    answer(s1, a1, fx.ids.rw_m1, 3);
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '1 second' where attempt_id in ('${a1}','${a2}') and module_key = 'rw_m1';`);
    const st1 = state(s1, a1);
    const st2 = state(s2, a2);
    expect(st1.currentModule).toBe("rw_m2");
    expect(routes(a1).rw).toBe("higher");
    expect(routes(a2).rw).toBe("lower");
    expect(psql(`select auto_submitted from mock_exam_attempt_modules where attempt_id = '${a1}' and module_key = 'rw_m1';`)).toBe("t");
    expect(st1.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_higher].sort());
    expect(st2.items.map((i) => i.setItemId).sort()).toEqual([...fx.ids.rw_lower].sort());
    // 다시 조회해도(재정산) 경로 불변
    state(s1, a1);
    expect(routes(a1).rw).toBe("higher");
  });

  it("오래 이탈해 M1·M2·휴식이 연쇄 만료돼도 각 섹션 경로는 한 번씩만 정해진다", () => {
    const s = createStudent("chain", RUN);
    const a = assign(s, fx.setId);
    start(s, a);
    answer(s, a, fx.ids.rw_m1, 4);
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '2 hour' where attempt_id = '${a}' and module_key = 'rw_m1';`);
    state(s, a); // → rw_m2 시작
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '1 second' where attempt_id = '${a}' and module_key = 'rw_m2';`);
    state(s, a); // rw_m2 만료 → 휴식 시작
    expect(routes(a).rw).toBe("higher");
    expect(psql(`select current_module from mock_exam_attempts where id = '${a}';`)).toBe("break");
  });
});

describe("레거시(라우팅 아님) 세트는 이전 그대로", () => {
  it("route 문항이 없고 M2 는 제한 없이 전부 노출, 경로·정책 버전은 null", () => {
    const legacy = createRoutingSet({ run: RUN, routing: false, label: "legacy" });
    const v = validate(legacy.setId);
    expect(v.ready).toBe(true);
    expect(v.routing).toBe(false);
    const s = createStudent("legacy", RUN);
    const a = assign(s, legacy.setId);
    start(s, a);
    expect(routes(a)).toEqual({ rw: "-", math: "-", rwV: "-", mathV: "-" });
    answer(s, a, legacy.ids.rw_m1, 4);
    submitModule(s, a, "rw_m1");
    const st = state(s, a);
    expect(st.items).toHaveLength(4); // lower 2 + higher 2 문항이 route 없이 rw_m2 하나로
    expect(routes(a).rw).toBe("-");
    // 난이도 라벨은 legacy 세트에서는 이전처럼 보이는 것이 아니라(학생 payload) — 라우팅 세트만 제거. 여기서는 위치가 원래대로.
    expect(st.items.map((i) => i.position)).toEqual([5, 6, 7, 8]);
    // 레거시 세트에 route 문항을 몰래 넣으면 not ready
    psql(`update mock_exam_set_items set route = 'higher' where id = '${legacy.ids.rw_higher[0]}';`);
    expect(validate(legacy.setId).ready).toBe(false);
  });
});

describe("정책 값·버전 — 데이터로 바꾸고 새 응시에만 적용", () => {
  it("경계값(이상 = higher)과 정책 버전 변경은 이미 시작한 응시에 영향이 없다", () => {
    const setId = createRoutingSet({ run: RUN, label: "policy" });
    const sA = createStudent("polA", RUN);
    const sB = createStudent("polB", RUN);
    const sC = createStudent("polC", RUN);
    const sD = createStudent("polD", RUN);
    const aA = assign(sA, setId.setId);
    start(sA, aA); // v(original) 고정
    // 더 엄격한 새 버전: 4문항 중 4개 정답 필요
    const v2 = Number(psql(`select mock_exam_set_routing_policy('rw', 'correct_count', 4, 'R3 ${RUN} strict', null);`));
    try {
      expect(v2).toBeGreaterThan(Number(originalRwActive));
      expect(psql(`select count(*) from mock_exam_routing_policies where section = 'rw' and active;`)).toBe("1");
      const aB = assign(sB, setId.setId);
      const aC = assign(sC, setId.setId);
      start(sB, aB); // v2 고정
      start(sC, aC);
      expect(routes(aB).rwV).toBe(String(v2));
      answer(sA, aA, setId.ids.rw_m1, 3);
      answer(sB, aB, setId.ids.rw_m1, 3);
      answer(sC, aC, setId.ids.rw_m1, 4);
      submitModule(sA, aA, "rw_m1");
      submitModule(sB, aB, "rw_m1");
      submitModule(sC, aC, "rw_m1");
      // A: 시작 때 고정된 기존 활성 정책(0.70)으로 3/4 → higher / B: 새 정책(4개 필요)로 3/4 → lower / C: 4/4 → 경계 이상 higher
      expect(routes(aA)).toMatchObject({ rw: "higher", rwV: originalRwActive });
      expect(routes(aB)).toMatchObject({ rw: "lower", rwV: String(v2) });
      expect(routes(aC)).toMatchObject({ rw: "higher", rwV: String(v2) });
      // 새 비율 정책 v3: 0.75 는 3/4 와 정확히 같아 higher(경계 포함)
      const v3 = Number(psql(`select mock_exam_set_routing_policy('rw', 'correct_ratio', 0.75, 'R3 ${RUN} boundary', null);`));
      const aD = assign(sD, setId.setId);
      start(sD, aD);
      answer(sD, aD, setId.ids.rw_m1, 3);
      submitModule(sD, aD, "rw_m1");
      expect(routes(aD)).toMatchObject({ rw: "higher", rwV: String(v3) });
      // 임계값 바로 아래(0.76)는 lower
      const v4 = Number(psql(`select mock_exam_set_routing_policy('rw', 'correct_ratio', 0.76, 'R3 ${RUN} above', null);`));
      const sE = createStudent("polE", RUN);
      const aE = assign(sE, setId.setId);
      start(sE, aE);
      answer(sE, aE, setId.ids.rw_m1, 3);
      submitModule(sE, aE, "rw_m1");
      expect(routes(aE)).toMatchObject({ rw: "lower", rwV: String(v4) });
    } finally {
      psql(
        `delete from mock_exam_routing_policies where section = 'rw' and version > ${originalRwActive} and note like 'R3 ${RUN}%';
         update mock_exam_routing_policies set active = true where section = 'rw' and version = ${originalRwActive};`,
      );
    }
    expect(psql(`select version from mock_exam_routing_policies where section = 'rw' and active;`)).toBe(originalRwActive);
  });

  it("정책 테이블은 학생·교사 API 역할이 직접 읽거나 쓸 수 없다", () => {
    const s = createStudent("polRead", RUN);
    expect(fails(() => asUser(s, `select * from mock_exam_routing_policies;`))).toContain("permission denied");
    expect(fails(() => asUser(TEACHER_ID, `select count(*) from mock_exam_routing_policies;`))).toContain("permission denied");
    expect(fails(() => asUser(TEACHER_ID, `update mock_exam_routing_policies set active = false;`))).toContain("permission denied");
    expect(fails(() => asUser(s, `select mock_exam_set_routing_policy('rw','correct_count',1,null,null);`))).toContain("permission denied");
    expect(ADMIN_ID).toBeTruthy();
  });
});
