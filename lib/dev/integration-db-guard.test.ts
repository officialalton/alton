import { describe, expect, it } from "vitest";
import { checkIntegrationTarget, isSharedStackUrl } from "./integration-db-guard";

const iso = { SUPABASE_TEST_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54522/postgres", SUPABASE_TEST_API_URL: "http://127.0.0.1:54521" };

describe("통합 테스트 대상 DB 가드", () => {
  it("미지정이면 차단(공유 폴백 방지)", () => {
    const r = checkIntegrationTarget({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toHaveLength(2);
    expect(checkIntegrationTarget({ SUPABASE_TEST_DB_URL: iso.SUPABASE_TEST_DB_URL }).ok).toBe(false);
  });
  it("공유 포트(54421/54422/54420/54429…)는 localhost·127.0.0.1 모두 차단", () => {
    for (const u of ["postgresql://postgres:postgres@127.0.0.1:54422/postgres", "postgresql://p:p@localhost:54420/postgres", "http://127.0.0.1:54421", "http://localhost:54429/"]) {
      expect(isSharedStackUrl(u)).toBe(true);
    }
    expect(checkIntegrationTarget({ ...iso, SUPABASE_TEST_DB_URL: "postgresql://postgres:postgres@localhost:54422/postgres" }).ok).toBe(false);
    expect(checkIntegrationTarget({ ...iso, SUPABASE_TEST_API_URL: "http://127.0.0.1:54421" }).ok).toBe(false);
  });
  it("격리 포트 둘 다 지정하면 통과", () => { expect(checkIntegrationTarget(iso)).toEqual({ ok: true }); expect(isSharedStackUrl(iso.SUPABASE_TEST_DB_URL)).toBe(false); });
  it("공유 허용은 표식 + 8자 이상 사유가 모두 있을 때만", () => {
    expect(checkIntegrationTarget({ ALLOW_SHARED_TEST_DB: "1" }).ok).toBe(false);
    expect(checkIntegrationTarget({ ALLOW_SHARED_TEST_DB: "1", SHARED_TEST_DB_NOTE: "short" }).ok).toBe(false);
    expect(checkIntegrationTarget({ SHARED_TEST_DB_NOTE: "조정 세션 전체 회귀 실행" }).ok).toBe(false);
    expect(checkIntegrationTarget({ ALLOW_SHARED_TEST_DB: "1", SHARED_TEST_DB_NOTE: "조정 세션 전체 회귀 실행" }).ok).toBe(true);
  });
});
