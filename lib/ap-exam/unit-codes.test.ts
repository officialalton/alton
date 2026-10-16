import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { apUnitsFromDomains } from "./layouts";

// 학생 화면의 "Covers Units 5, 6, 7" 는 문항 sat_domain("ap:5.3")의 앞자리다. 그 번호가 최신 CED 단원 번호(커리큘럼 파일 units[].code)와 일치하는지,
// 재고 문항의 키워드 코드가 모두 커리큘럼 토픽에 있고 토픽이 속한 단원 번호와 같은지 확인한다(내부 코드 ↔ 학생 표기 불일치 방지).
type Cur = { units: { code: string; title: string; topics: { code: string }[] }[] };
type It = { stockKey: string; apSubjectCode: string; validation: string; keywordCode: string };
const items = [...JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")), ...JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8"))] as It[];
describe.each(["ap_calculus_ab", "ap_calculus_bc", "ap_biology", "ap_microeconomics"])("%s 단원 번호", (subject) => {
  const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${subject}.json`, "utf-8")) as Cur;
  const unitOf = new Map(cur.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
  it("재고의 모든 키워드 코드는 커리큘럼 토픽이고 학생에게 보이는 단원 번호 = CED 단원 번호", () => {
    const bad: string[] = [];
    for (const i of items.filter((x) => x.apSubjectCode === subject && x.validation === "auto_passed")) {
      const u = unitOf.get(i.keywordCode);
      if (!u) bad.push(`${i.stockKey}: 토픽 ${i.keywordCode} 없음`);
      else if (apUnitsFromDomains([`ap:${i.keywordCode}`])[0] !== u) bad.push(`${i.stockKey}: 표기 단원 ${apUnitsFromDomains([`ap:${i.keywordCode}`])[0]} ≠ CED 단원 ${u}`);
    }
    expect(bad).toEqual([]);
  });
  it("단원 제목이 비어 있지 않다", () => { expect(cur.units.every((u) => u.title.trim().length > 0)).toBe(true); });
});
