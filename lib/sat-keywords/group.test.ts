import { describe, it, expect } from "vitest";
import { groupKeywordsByDomain, hasDomainGroups, keywordDomainCode } from "./group";
import { SAT_KEYWORDS } from "./taxonomy";

const kw = (id: string, label: string, domainCode?: string | null, skillCode?: string | null) => ({ id, label, domainCode, skillCode });

describe("groupKeywordsByDomain", () => {
  it("도메인 순서(College Board)대로 묶고 구 키워드는 Other 맨 뒤", () => {
    const g = groupKeywordsByDomain([kw("a", "Old"), kw("b", "Geo", "geometry_trig"), kw("c", "Alg", "algebra")]);
    expect(g.map((x) => x.label)).toEqual(["Algebra", "Geometry and Trigonometry", "Other"]);
    expect(g[2].items.map((k) => k.id)).toEqual(["a"]);
  });
  it("domainCode 가 없으면 skillCode 로 추론, 값은 그대로", () => {
    const s = SAT_KEYWORDS[0];
    const item = kw("x", s.label, null, s.skillCode);
    expect(keywordDomainCode(item)).toBe(s.domainCode);
    expect(groupKeywordsByDomain([item])[0].items[0]).toBe(item);
  });
  it("SAT 30개 전부 8개 도메인에 들어가고 Other 가 없다", () => {
    const g = groupKeywordsByDomain(SAT_KEYWORDS.map((k) => kw(k.skillCode, k.label, k.domainCode, k.skillCode)));
    expect(g).toHaveLength(8);
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(SAT_KEYWORDS.length);
  });
  it("otherLabel 지정, 모르는 도메인은 Other, 전부 구 키워드면 헤더 없음", () => {
    const g = groupKeywordsByDomain([kw("a", "A", "weird")], "기타");
    expect(g[0].label).toBe("기타");
    expect(hasDomainGroups(g)).toBe(false);
  });
});

describe("groupKeywordsByDomain — 폴더 모드(2026-10-08)", () => {
  const f = (id: string, label: string, folderId: string | null, extra: Record<string, unknown> = {}) => ({
    id, label, folderId, folderName: folderId ? `폴더 ${folderId}` : null, folderPosition: folderId === "b" ? 0 : 1, sortOrder: 0, ...extra,
  });
  it("folderId가 정의돼 있으면 도메인 대신 폴더(position 순)로 묶고 폴더 없는 키워드는 마지막 기타", () => {
    const groups = groupKeywordsByDomain(
      [f("1", "Z", "a", { domainCode: "algebra" }), f("2", "Y", "b"), f("3", "X", null, { domainCode: "algebra" })],
      "기타",
    );
    expect(groups.map((g) => g.label)).toEqual(["폴더 b", "폴더 a", "기타"]);
    expect(groups[2].items.map((k) => k.id)).toEqual(["3"]);
  });
  it("폴더 안은 sortOrder → 이름 순", () => {
    const groups = groupKeywordsByDomain([f("1", "B", "a", { sortOrder: 2 }), f("2", "C", "a", { sortOrder: 1 }), f("3", "A", "a", { sortOrder: 2 })]);
    expect(groups[0].items.map((k) => k.id)).toEqual(["2", "3", "1"]);
  });
  it("모든 폴더를 지워 전부 기타여도 도메인 그룹이 되살아나지 않는다", () => {
    const groups = groupKeywordsByDomain([f("1", "A", null, { domainCode: "algebra" })]);
    expect(groups).toHaveLength(1);
    expect(hasDomainGroups(groups)).toBe(false);
  });
  it("folderId가 undefined인 구 데이터는 기존 도메인 그룹핑", () => {
    const groups = groupKeywordsByDomain([{ id: "1", label: "A", domainCode: "algebra" }]);
    expect(groups[0].key).toBe("algebra");
  });
});
