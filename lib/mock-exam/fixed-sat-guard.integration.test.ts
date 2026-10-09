import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN_ID, createStudent, psql } from "../../test/mock-exam-routing-fixture";

// 활성화 차단 가드(마이그레이션 410): 서버가 시간 제한을 강제하지 않는 비 AP 고정형 SAT 세트는 공개·시작할 수 없다. 다른 통합 테스트는 레거시 고정형 픽스처가 필요해 vitest 설정이 우회 설정을 켠다 —
// 이 테스트는 우회를 끄고(세션 설정 off) 가드 자체를 검증한다. 가드는 서버 강제 구현 뒤 제거할 수 있다.
const DB = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const guarded = (sql: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", `set alton.allow_fixed_sat_without_time_limit = 'off'; ${sql}`], { encoding: "utf-8", env: { ...process.env, PGOPTIONS: "" } }).trim();
const fails = (fn: () => unknown) => { try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); } return ""; };
const run = `fg${Date.now().toString(36)}`;

afterAll(() => { psql(`delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${run}-%'); delete from mock_exam_sets where name like '${run}-%'; delete from students where id in (select id from profiles where name like 'mxr3-%-${run}'); delete from profiles where name like 'mxr3-%-${run}'; delete from auth.users where email like 'mxr3-%-${run}-%';`); });

describe("고정형 SAT 서버 시간 제한 미구현 → 공개·시작 차단(활성화 차단 가드)", () => {
  it("고정형 SAT 세트는 공개할 수 없다(draft 는 가능)", () => {
    const id = guarded(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, created_by) values ('${run}-fixed', 'standard', 'draft', 'fixed', 'not_applicable', '${ADMIN_ID}') returning id;`);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fails(() => guarded(`update mock_exam_sets set status = 'published', published_at = now() where id = '${id}';`))).toMatch(/cannot be published yet/);
    expect(guarded(`select status from mock_exam_sets where id = '${id}';`)).toBe("draft");
    expect(fails(() => guarded(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at, created_by) values ('${run}-fixed2', 'standard', 'published', 'fixed', 'not_applicable', now(), '${ADMIN_ID}');`))).toMatch(/cannot be published yet/);
  });
  it("이미 공개돼 있던 고정형 세트라도 새 응시는 시작할 수 없다(기존 응시는 건드리지 않음)", () => {
    const stu = createStudent("fg", run);
    const id = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at, access_tier, created_by) values ('${run}-legacy', 'standard', 'published', 'fixed', 'not_applicable', now(), 'free', '${ADMIN_ID}') returning id;`); // 우회 설정이 켜진 세션 = 레거시 상태 재현
    expect(fails(() => guarded(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${stu}', '${id}', 'assigned');`))).toMatch(/cannot be started yet/);
  });
  it("MST·AP 는 영향이 없다", () => {
    const mst = guarded(`insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, created_by) values ('${run}-mst', 'standard', 'draft', 'mst', '{"rw_m1":1,"rw_m2":1,"math_m1":1,"math_m2":1}', '${ADMIN_ID}') returning id;`);
    expect(mst).toMatch(/^[0-9a-f-]{36}$/);
    expect(fails(() => guarded(`update mock_exam_sets set readiness_status = 'ready' where id = '${mst}'; update mock_exam_sets set status = 'published' where id = '${mst}';`))).not.toMatch(/cannot be published yet/);
  });
});
