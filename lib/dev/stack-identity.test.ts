import { describe, expect, it } from "vitest";
import { mergeEnv, projectsPublishing, verifySameIsolatedStack } from "./stack-identity";

const ps = (rows: [string, string][]) => rows.map(([n, p]) => `${n}|${p}`).join("\n");
const SHARED = ps([["supabase_db_ALTON", "0.0.0.0:54422->5432/tcp, [::]:54422->5432/tcp"], ["supabase_kong_ALTON", "0.0.0.0:54421->8000/tcp"], ["supabase_rest_ALTON", "3000/tcp"]]);
const ISO = ps([["supabase_db_ALTON_apev1", "0.0.0.0:54522->5432/tcp"], ["supabase_kong_ALTON_apev1", "0.0.0.0:54521->8000/tcp"], ["supabase_db_ALTON_other", "0.0.0.0:54532->5432/tcp"], ["supabase_kong_ALTON_other", "0.0.0.0:54531->8000/tcp"]]);
const db = (p: number) => `postgresql://postgres:postgres@127.0.0.1:${p}/postgres`;
const api = (p: number) => `http://127.0.0.1:${p}`;

describe("스택 동일성(docker 출력 기반)", () => {
  it("같은 격리 project 의 db+kong 이면 통과하고 project id 를 돌려준다", () => {
    expect(verifySameIsolatedStack({ dbUrl: db(54522), apiUrls: [api(54521)], dockerPs: SHARED + "\n" + ISO })).toEqual({ ok: true, projectId: "ALTON_apev1" });
  });
  it("두 스택이 있을 때 DB 는 other, API 는 apev1 이면 차단(포트가 어떻게 생겼든 컨테이너 기준)", () => {
    expect(verifySameIsolatedStack({ dbUrl: db(54532), apiUrls: [api(54521)], dockerPs: ISO }).ok).toBe(false);
  });
  it("2026-10-09 사고 재현: DB 는 공유 54422, API 는 격리 54521 → 차단", () => {
    expect(verifySameIsolatedStack({ dbUrl: db(54422), apiUrls: [api(54521)], dockerPs: SHARED + "\n" + ISO }).ok).toBe(false);
  });
  it("API+1=DB 포트 관계를 만족해도 컨테이너가 다른 project 면 차단", () => {
    const swapped = ps([["supabase_db_ALTON_a", "0.0.0.0:54622->5432/tcp"], ["supabase_kong_ALTON_b", "0.0.0.0:54621->8000/tcp"]]);
    expect(verifySameIsolatedStack({ dbUrl: db(54622), apiUrls: [api(54621)], dockerPs: swapped }).ok).toBe(false);
  });
  it("둘 다 공유 스택이면 차단", () => {
    const r = verifySameIsolatedStack({ dbUrl: db(54422), apiUrls: [api(54421)], dockerPs: SHARED });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toContain("공유");
  });
  it("API 변수가 여러 개이면 모두 같은 project 여야 한다", () => {
    expect(verifySameIsolatedStack({ dbUrl: db(54522), apiUrls: [api(54521), api(54421)], dockerPs: SHARED + "\n" + ISO }).ok).toBe(false);
    expect(verifySameIsolatedStack({ dbUrl: db(54522), apiUrls: [api(54521), api(54521)], dockerPs: ISO }).ok).toBe(true);
  });
  it("컨테이너가 없거나(스택 중지) 원격 URL·누락이면 차단", () => {
    expect(verifySameIsolatedStack({ dbUrl: db(54522), apiUrls: [api(54521)], dockerPs: "" }).ok).toBe(false);
    expect(verifySameIsolatedStack({ dbUrl: "postgresql://u:p@db.example.com:5432/postgres", apiUrls: [api(54521)], dockerPs: ISO }).ok).toBe(false);
    expect(verifySameIsolatedStack({ dbUrl: undefined, apiUrls: [], dockerPs: ISO }).ok).toBe(false);
  });
  it("project id 가 ALTON_<이름> 형식이 아니면 차단(대소문자 변형·타 프로젝트 포함)", () => {
    const odd = ps([["supabase_db_alton", "0.0.0.0:54622->5432/tcp"], ["supabase_kong_alton", "0.0.0.0:54621->8000/tcp"]]);
    expect(verifySameIsolatedStack({ dbUrl: db(54622), apiUrls: [api(54621)], dockerPs: odd }).ok).toBe(false);
    const foreign = ps([["supabase_db_Essay_ERP", "0.0.0.0:54322->5432/tcp"], ["supabase_kong_Essay_ERP", "0.0.0.0:54321->8000/tcp"]]);
    expect(verifySameIsolatedStack({ dbUrl: db(54322), apiUrls: [api(54321)], dockerPs: foreign }).ok).toBe(false);
  });
  it("같은 포트를 게시하는 db 컨테이너가 둘이면 모호하므로 차단", () => {
    const dup = ps([["supabase_db_ALTON_a", "0.0.0.0:54522->5432/tcp"], ["supabase_db_ALTON_b", "0.0.0.0:54522->5432/tcp"], ["supabase_kong_ALTON_a", "0.0.0.0:54521->8000/tcp"]]);
    expect(verifySameIsolatedStack({ dbUrl: db(54522), apiUrls: [api(54521)], dockerPs: dup }).ok).toBe(false);
  });
  it("projectsPublishing 은 IPv6 병기 포트 목록도 읽는다", () => {
    expect(projectsPublishing(SHARED, "db", 54422)).toEqual(["ALTON"]);
    expect(projectsPublishing(SHARED, "kong", 54422)).toEqual([]);
  });
});

describe("env 병합(모든 env 파일을 읽은 뒤 결정)", () => {
  it("process env 가 .env.local 을, .env.local 이 .env 를 이긴다. 파일에만 있는 DB URL 도 효과적 값이 된다", () => {
    const m = mergeEnv({ A: "p" }, ["A=l\nSUPABASE_TEST_DB_URL=postgresql://x@127.0.0.1:54522/postgres\nC=1", "A=d\nC=2\nD=\"q\""]);
    expect(m.A).toBe("p");
    expect(m.C).toBe("1");
    expect(m.D).toBe("q");
    expect(m.SUPABASE_TEST_DB_URL).toContain("54522");
  });
});
