import { describe, expect, it } from "vitest";
import { chooseTrim, type TrimSet } from "./englang-trim";
import { verifyElangFullComposition, elangCategoryOf, type ElangSetItem } from "../ap-exam/elang-rules";

const mk = (id: string, section: "reading" | "writing", base: string[], extra: string[]): TrimSet => ({ id, section, baseCats: base, cands: extra.map((cat, i) => ({ cat, score: 0.8 + (i % 3) / 20 })) });
describe("chooseTrim", () => {
  const R = ["RS-R", "CE-R", "RO-R", "S-R"], W = ["RS-W", "CE-W", "RO-W", "S-W"];
  const rep = (c: string[], n: number) => Array.from({ length: n }, (_, i) => c[i % c.length]);
  it("picks new items so the full exam is official-shaped and inside every category range", () => {
    const sets = [mk("r1", "reading", rep(R, 5), rep(R, 10)), mk("r2", "reading", ["CE-R", "RO-R", "RO-R", "S-R", "RS-R"], rep(R, 10)), mk("w1", "writing", rep(W, 6), rep(W, 4)), mk("w2", "writing", rep(W, 6), rep(W, 4))];
    const r = chooseTrim({ sets, fixedCats: W });
    expect(r.ok).toBe(true);
    // 검증기로 다시 본다: 읽기 묶음 11-14, 글쓰기 큰 묶음 7-9, 짧은 묶음 4(고정), 범주 범위
    const toSkills = (cats: string[]) => cats.map((c) => ({ "RS-R": "1.A", "CE-R": "3.A", "RO-R": "5.A", "S-R": "7.A", "RS-W": "2.A", "CE-W": "4.A", "RO-W": "6.A", "S-W": "8.A" } as Record<string, string>)[c]);
    const items: ElangSetItem[] = []; let pos = 1;
    for (const s of sets) { const cats = [...s.baseCats, ...r.keep[s.id].map((i) => s.cands[i].cat)]; for (const sk of toSkills(cats)) items.push({ kind: "mc", skill: sk, candidateKey: s.id, position: pos++ }); }
    for (const sk of toSkills(W)) items.push({ kind: "mc", skill: sk, candidateKey: "short", position: pos++ });
    for (const [i, k] of ["a", "b", "c"].entries()) items.push({ kind: "frq", skill: null, candidateKey: k, position: i + 1 });
    expect(verifyElangFullComposition(items)).toEqual([]);
    void elangCategoryOf;
  });
  it("reports infeasible when too few new items passed", () => {
    expect(chooseTrim({ sets: [mk("r1", "reading", rep(R, 5), ["RS-R"]), mk("r2", "reading", rep(R, 5), []), mk("w1", "writing", rep(W, 6), []), mk("w2", "writing", rep(W, 6), [])], fixedCats: W }).ok).toBe(false);
  });
});
