import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyze, remapAll, staticAudit, statedCorrect } from "./position-fix-rules";
import { reorder } from "./shuffle-adopted";

const fx = JSON.parse(readFileSync(path.join(__dirname, "fixtures/position-fix-failures.json"), "utf-8")) as { id: string; perm: number[]; origIndex: number; newIndex: number; explanation: string; explanationEn: string | null; options: string[] }[];
const entryOf = (f: (typeof fx)[number], mutate?: (en: string, ko: string) => [string, string]) => {
  const ko = remapAll(f.explanation, f.perm).text, en = f.explanationEn ? remapAll(f.explanationEn, f.perm).text : null;
  const [k2, e2] = mutate ? mutate(en ?? "", ko) : [ko, en ?? ""];
  return { options: f.options, origIndex: f.origIndex, newIndex: f.newIndex, perm: f.perm, before: { options: f.options, explanation: f.explanation, explanationEn: f.explanationEn }, after: { options: f.perm.map((o) => f.options[o]), correctIndex: f.newIndex, explanation: k2, explanationEn: f.explanationEn ? e2 : null } };
};

describe("서수·관사 규칙", () => {
  it("한국어·영어 서수를 새 순서로 치환", () => {
    const perm = [1, 2, 3, 0]; // 옛 0 → 새 3, 옛 1 → 새 0 …
    expect(remapAll("첫 번째 선택지가 정답. 두 번째 선택지는 틀림. 네 번째 선택지도 틀림.", perm).text).toBe("네 번째 선택지가 정답. 첫 번째 선택지는 틀림. 세 번째 선택지도 틀림.");
    expect(remapAll("The first option is right; the Second option fails; the fourth choice is wrong.", perm).text).toBe("The fourth option is right; the First option fails; the third choice is wrong.");
  });
  it("'making A correct'·'A the'·'A as'·'A misrepresents' 는 참조, 'A single boat'·'A colon' 은 관사", () => {
    const perm = [1, 2, 3, 0];
    expect(remapAll("This is why, making A correct.", perm).text).toBe("This is why, making D correct.");
    expect(remapAll("So C is correct. A misrepresents Text 2. A the claim.", perm).text).toBe("So B is correct. D misrepresents Text 2. D the claim.");
    expect(remapAll("A single boat. A colon is used. Choice A is wrong.", perm).text).toBe("A single boat. A colon is used. Choice D is wrong.");
  });
  it("따옴표 안 글자는 건드리지 않고, '마지막 선택지' 는 불확실로 표시", () => {
    expect(remapAll('The label "A" stays. Choice A changes.', [1, 2, 3, 0]).text).toBe('The label "A" stays. Choice D changes.');
    expect(analyze("The last option is wrong.").uncertain.length).toBe(1);
  });
  it("정답 지목 추출", () => {
    expect(statedCorrect("따라서 정답은 A이다.")).toEqual([0]);
    expect(statedCorrect("...making A the correct answer.")).toEqual([0]);
    expect(statedCorrect("정답은 두 번째 선택지이다.")).toEqual([1]);
  });
});

describe("표본 검증에서 실패한 13건 — 보강 규칙 고정 사례", () => {
  it("13건 모두 정적 감사를 통과하거나 규칙이 불확실로 판정해 생략한다(통과하면 치환 결과가 순열과 정합)", () => {
    expect(fx.length).toBe(13);
    for (const f of fx) {
      const fails = staticAudit(entryOf(f));
      const uncertainBefore = [...analyze(f.explanation).uncertain, ...analyze(f.explanationEn ?? "").uncertain];
      expect(fails.length === 0 || uncertainBefore.length > 0 || fails.some((x) => x.includes("기존 결함")), `${f.id}: ${fails.join(" / ")}`).toBe(true);
    }
  });
  it("서수 해설 사례(0e9a6d0b·00371549·5bf69abf·4e5c16c7)는 서수가 새 순서로 바뀐다", () => {
    for (const id of ["0e9a6d0b", "00371549", "5bf69abf", "4e5c16c7"]) {
      const f = fx.find((x) => x.id === id)!;
      const ko = remapAll(f.explanation, f.perm).text;
      expect(ko).not.toBe(f.explanation);
      expect(staticAudit(entryOf(f))).toEqual([]);
    }
  });
  it("영어 'making A correct' 사례(241ae323·02a126a6·048df914·90f4fae1)는 영어 해설 글자가 바뀐다", () => {
    for (const id of ["241ae323", "02a126a6", "048df914", "90f4fae1"]) {
      const f = fx.find((x) => x.id === id)!;
      expect(remapAll(f.explanationEn!, f.perm).text).not.toBe(f.explanationEn);
      expect(staticAudit(entryOf(f))).toEqual([]);
    }
  });
});

describe("돌연변이 테스트 — 감사가 잘못된 치환을 잡아낸다", () => {
  const f = fx.find((x) => x.id === "4e5c16c7")!;
  it("서수를 치환하지 않은 해설은 실패", () => {
    const e = entryOf(f, () => [f.explanation, remapAll(f.explanationEn!, f.perm).text]);
    expect(staticAudit(e).length).toBeGreaterThan(0);
  });
  it("영어 해설을 치환하지 않으면 실패", () => {
    const g = fx.find((x) => x.id === "241ae323")!;
    const e = entryOf(g, (_en, ko) => [ko, g.explanationEn!]);
    expect(staticAudit(e).length).toBeGreaterThan(0);
  });
  it("글자를 하나 잘못 바꾸면 실패", () => {
    const g = fx.find((x) => x.id === "81df28e6")!;
    const e = entryOf(g, (en, ko) => [ko.replace("B는", "C는"), en]);
    expect(staticAudit(e).length).toBeGreaterThan(0);
  });
  it("선택지가 순열이 아니거나 정답 내용이 달라지면 실패", () => {
    const g = fx[0]; const e = entryOf(g);
    expect(staticAudit({ ...e, after: { ...e.after, options: [...e.after.options.slice(0, 3), "다른 내용"] } }).length).toBeGreaterThan(0);
    const wrong = reorder(g.options, g.origIndex, (g.newIndex + 1) % 4);
    expect(staticAudit({ ...e, after: { ...e.after, options: wrong.options } }).length).toBeGreaterThan(0);
  });
  it("본문을 건드리면 실패", () => {
    const g = fx.find((x) => x.id === "81df28e6")!;
    const e = entryOf(g, (en, ko) => [ko + " 추가 문장.", en]);
    expect(staticAudit(e).length).toBeGreaterThan(0);
  });
});
