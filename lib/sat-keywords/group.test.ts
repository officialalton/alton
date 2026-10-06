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
