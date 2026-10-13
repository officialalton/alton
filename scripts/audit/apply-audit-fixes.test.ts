// 쓰기 가드 + 계획 구성 테스트. 이 스크립트는 DB 에 쓰지 않는다: 원격 읽기는 SELECT 한 문장만 허용한다.
import { describe, expect, it } from "vitest";
import { assertSelectOnly, buildApPatches, loadPatches, AP_FRQ_KEYS } from "./apply-audit-fixes";

describe("assertSelectOnly", () => {
  it("SELECT/WITH 는 허용한다(문자열 리터럴 안의 쓰기 단어는 무시)", () => {
    expect(() => assertSelectOnly("select 1")).not.toThrow();
    expect(() => assertSelectOnly("with m as (select 1) select * from m")).not.toThrow();
    expect(() => assertSelectOnly("select 'delete from x; drop table y' as t")).not.toThrow();
    expect(() => assertSelectOnly("select $q$update problems set x=1;$q$ as t")).not.toThrow();
    expect(() => assertSelectOnly("select s.set_group_id, created_at, published_at from mock_exam_sets s where s.set_status = 'x'")).not.toThrow();
  });
  it("쓰기·DDL·여러 문장은 거부한다", () => {
    for (const bad of ["insert into t values (1)", "update t set a=1", "delete from t", "drop table t", "alter table t add column a int", "truncate t", "create table t(a int)", "select 1; select 2", "select 1; delete from t", "with x as (delete from t returning *) select * from x", "do $$ begin end $$", "grant all on t to x", "select pg_sleep(1) ; update t set a=1"]) {
      expect(() => assertSelectOnly(bad), bad).toThrow();
    }
  });
});

describe("계획 입력", () => {
  it("SAT 패치 목록 + 영어 해설 수동 패치(E-*)를 읽고, 패치 id 는 겹치지 않는다", () => {
    const { patches, overrides } = loadPatches({ includeScan: false });
    expect(patches.length).toBe(67 + 8);
    expect(new Set(patches.map((p) => p.id)).size).toBe(patches.length);
    for (const id of ["S-01", "S-03", "S-07", "S-13"]) expect(overrides[id]).toBeTruthy();
  });
  it("AP FRQ 패치는 변환기가 만드는 초기값 지문을 싣는다(정확히 3건)", () => {
    const ap = buildApPatches();
    expect(ap.map((p) => p.apCandidateKey)).toEqual(AP_FRQ_KEYS);
    const passage = (k: string) => String(ap.find((p) => p.apCandidateKey === k)!.changes[0].new);
    expect(passage("run1:ap_calculus_ab-f02-k5")).toContain("f(0) = 40");
    expect(passage("run1:ap_calculus_ab-f02-k9")).toContain("S(0)=0");
    expect(passage("run1:ap_calculus_ab-f02-k10")).toContain("f(0)=1");
  });
});
