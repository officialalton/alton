import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { DB_URL, answer, asUser, createRoutingSet, createStudent, fails, psql, start, state, submitModule } from "../../test/mock-exam-routing-fixture";

// 서버 기준 시간·중복 제출 방지 감사(2026-10-09). 화면(브라우저)이 아니라 DB RPC 를 학생 JWT 로 직접 호출해 서버가 막는지만 본다.
//  AP 쪽(만료·settle·멱등 제출·동시 제출·동시 시작)은 lib/ap-exam/ap-exam.integration.test.ts "AP 시간 제한은 서버가 정한다".
//  SAT 고정형의 서버 만료 거절은 구현돼 있지 않다 — 아래 it.todo 로 남기고 보고서의 "미검증/미구현" 목록에 둔다.
const run = `ti${Date.now().toString(36)}`;
const exec = promisify(execFile);
const asUserAsync = (uid: string, sql: string) => exec("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", `set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${uid}', false); end $$; ${sql} reset role;`]).then((r) => r.stdout.trim(), (e) => { throw new Error(String(e.stderr ?? e)); });

describe("SAT MST(서버): 만료·이전 모듈 재진입·중복 제출", () => {
  const fx = createRoutingSet({ run });
  const stu = createStudent("a", run);
  let attempt: string;
  it("준비: 응시 시작(M1)", () => {
    attempt = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${stu}', '${fx.setId}', 'assigned') returning id;`);
    start(stu, attempt);
    expect(state(stu, attempt).currentModule).toBe("rw_m1");
  });
  it("[더블클릭·재시도] 같은 모듈을 두 번 제출해도 한 번만 잠기고 다음 모듈이 한 번만 시작된다(잠금 행·모듈 행 중복 없음)", () => {
    answer(stu, attempt, fx.ids.rw_m1, 3);
    submitModule(stu, attempt, "rw_m1"); submitModule(stu, attempt, "rw_m1"); submitModule(stu, attempt, "rw_m1");
    expect(psql(`select count(*) filter (where locked) || '|' || count(*) from mock_exam_attempt_modules where attempt_id = '${attempt}';`).split("|")[0]).toBe("1");
    expect(psql(`select current_module from mock_exam_attempts where id = '${attempt}';`)).toBe("rw_m2");
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${stu}' and exam_set_id = '${fx.setId}';`)).toBe("1");
  });
  it("[이전 모듈 재진입 차단] 제출한 M1 의 답은 바꿀 수 없고, 현재 상태 응답에 M1 문항이 없으며, 다시 시작·재제출해도 M1 이 열리지 않고 경로가 바뀌지 않는다", () => {
    const route0 = psql(`select coalesce(rw_m2_route::text, '-') from mock_exam_attempts where id = '${attempt}';`);
    for (const id of fx.ids.rw_m1) expect(fails(() => asUser(stu, `select mock_exam_save_answer('${attempt}', '${id}', '1', 1);`))).toMatch(/already been submitted|not found|cannot be saved/i);
    const st = state(stu, attempt);
    expect(st.currentModule).toBe("rw_m2");
    expect(st.items.some((i) => fx.ids.rw_m1.includes(i.setItemId))).toBe(false);
    expect(fails(() => asUser(stu, `select mock_exam_start_mst('${attempt}');`)) === "" || true).toBe(true); // 멱등 또는 거절 — 어느 쪽이든 아래 상태가 불변이어야 한다
    submitModule(stu, attempt, "rw_m1");
    expect(psql(`select current_module from mock_exam_attempts where id = '${attempt}';`)).toBe("rw_m2");
    expect(psql(`select coalesce(rw_m2_route::text, '-') from mock_exam_attempts where id = '${attempt}';`)).toBe(route0);
    expect(psql(`select locked from mock_exam_attempt_modules where attempt_id = '${attempt}' and module_key = 'rw_m1';`)).toBe("t");
    expect(fails(() => asUser(stu, `select mock_exam_submit('${attempt}');`))).toMatch(/submitted module by module/);
  });
  it("[서버 만료 뒤 저장 거절] M2 의 ends_at 이 지나면 답 저장이 거절되고 모듈이 자동 제출·잠금(한 번)된다", () => {
    const m2 = state(stu, attempt).items.map((i) => i.setItemId);
    psql(`update mock_exam_attempt_modules set ends_at = now() - interval '2 seconds' where attempt_id = '${attempt}' and module_key = 'rw_m2';`);
    expect(fails(() => asUser(stu, `select mock_exam_save_answer('${attempt}', '${m2[0]}', '1', 1);`))).toMatch(/already been submitted|cannot be saved|not found/i);
    // 거절된 호출은 트랜잭션째 롤백되므로 잠금은 그 호출이 아니라 다음 상태 조회(settle)에서 확정된다 — 저장 거절 자체는 settle 에 의존하지 않는다.
    asUser(stu, `select (mock_exam_mst_state('${attempt}')->>'currentModule');`); asUser(stu, `select (mock_exam_mst_state('${attempt}')->>'currentModule');`); // 상태 재조회(새로고침) 반복
    expect(psql(`select locked || '|' || auto_submitted from mock_exam_attempt_modules where attempt_id = '${attempt}' and module_key = 'rw_m2';`)).toBe("true|true");
    expect(psql(`select count(*) filter (where locked) from mock_exam_attempt_modules where attempt_id = '${attempt}';`)).toBe("2");
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${stu}' and exam_set_id = '${fx.setId}';`)).toBe("1");
  });
  it("[두 탭 동시 제출] 같은 모듈 제출을 동시에 8번 호출해도 잠금은 한 번, 응시 행은 하나", async () => {
    const stu2 = createStudent("b", run);
    const att2 = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${stu2}', '${fx.setId}', 'assigned') returning id;`);
    start(stu2, att2); answer(stu2, att2, fx.ids.rw_m1, 2);
    const rs = await Promise.allSettled(Array.from({ length: 8 }, () => asUserAsync(stu2, `select mock_exam_submit_module('${att2}', 'rw_m1');`)));
    expect(rs.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(psql(`select count(*) filter (where locked) || '|' || count(*) from mock_exam_attempt_modules where attempt_id = '${att2}' and module_key = 'rw_m1';`)).toBe("1|1");
    expect(psql(`select current_module from mock_exam_attempts where id = '${att2}';`)).toBe("rw_m2");
    expect(psql(`select count(*) from mock_exam_attempts where student_id = '${stu2}' and exam_set_id = '${fx.setId}';`)).toBe("1");
  });
  it.todo("SAT 고정형(비 MST): 서버 시간 만료 뒤 답 저장 거절 — 현재 서버는 고정형 시간 제한을 강제하지 않는다(클라이언트 타이머만). 미구현");
});
