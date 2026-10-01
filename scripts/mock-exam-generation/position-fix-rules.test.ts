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

const fx2 = JSON.parse(readFileSync(path.join(__dirname, "fixtures/position-fix-failures-round2.json"), "utf-8")) as (typeof fx[number] & { cat: string })[];
const mk = (f: (typeof fx2)[number], ko?: string, en?: string | null) => ({ options: f.options, origIndex: f.origIndex, newIndex: f.newIndex, perm: f.perm, before: { options: f.options, explanation: f.explanation, explanationEn: f.explanationEn }, after: { options: f.perm.map((o) => f.options[o]), correctIndex: f.newIndex, explanation: ko ?? remapAll(f.explanation, f.perm).text, explanationEn: f.explanationEn === null ? null : en ?? remapAll(f.explanationEn, f.perm).text } });
const safe = (f: (typeof fx2)[number]) => {
  const unc = [...analyze(f.explanation).uncertain, ...analyze(f.explanationEn ?? "").uncertain];
  return { unc, fails: staticAudit(mk(f)) };
};

describe("2차 보강 — 서브 에이전트 blocking 이슈 고정 사례", () => {
  it("fixtures 16건", () => expect(fx2.length).toBe(16));
  it("고정 사례의 결정: 불확실은 생략, 그 밖은 정적 감사 통과(치환 정합)", () => {
    const skipIds = ["06a3ced4", "a19ad79c", "b43c5755", "7f8bd0b4", "9d4af989", "9d9f0889", "bbd97b1b", "9cedb4e8", "4eaf03a4", "021df67e"];
    for (const f of fx2) {
      const { unc, fails } = safe(f);
      if (skipIds.includes(f.id)) expect(unc.length, f.id).toBeGreaterThan(0);
      else { expect(unc, f.id).toEqual([]); expect(fails, f.id).toEqual([]); }
    }
  });
  it("(a) 인덱스 N 은 새 위치로 치환, 'N번' 숫자 지칭은 불확실로 생략", () => {
    expect(remapAll("정답은 B(인덱스 0)이다.", [1, 0, 2, 3]).text).toBe("정답은 A(인덱스 1)이다.");
    expect(analyze("정답은 0번이다.").uncertain.length).toBe(1);
    expect(analyze("정답은 3번이다.").uncertain.length).toBe(1);
  });
  it("(b) '선택지 3·4' 서수 나열은 불확실", () => { expect(analyze("선택지 3은 틀리고 선택지 4는 정답이다.").uncertain.length).toBe(1); expect(analyze("선택지 3·4가 오답이다.").uncertain.length).toBe(1); });
  it("(c) 관사 A 는 치환하지 않는다: 'A box', 'A 95% confidence interval', 'A $5 fee'", () => {
    const perm = [1, 2, 3, 0];
    expect(remapAll("(Only when it holds, A box from a rival workshop)", perm).text).toBe("(Only when it holds, A box from a rival workshop)");
    expect(remapAll("A 95% confidence interval is found. A $5 fee applies.", perm).text).toBe("A 95% confidence interval is found. A $5 fee applies.");
    expect(remapAll("Choice A is wrong, so A box is not it.", perm).text).toBe("Choice D is wrong, so A box is not it.");
  });
  it("(d) 소유격·조사: B's 43%, Choice B's value, A는", () => {
    const perm = [1, 2, 3, 0];
    expect(remapAll("B's 43% exceeds. Choice C's value of 500. 정답은 A이다. A는 틀렸다.", perm).text).toBe("A's 43% exceeds. Choice B's value of 500. 정답은 D이다. D는 틀렸다.");
  });
  it("(e) 새 정답을 오답처럼 서술하면 감사 실패, 존재하지 않는 Choice E 는 불확실", () => {
    const f = fx2.find((x) => x.cat === "letterForm")!;
    const e = mk(f);
    const L = LETTERS_FOR_TEST[f.newIndex];
    const bad = { ...e, after: { ...e.after, explanation: e.after.explanation + ` ${L}는 오답이다.` } };
    expect(staticAudit(bad).length).toBeGreaterThan(0);
    expect(analyze("Choice E is added.").uncertain.length).toBe(1);
  });
  it("홀수 따옴표는 불확실", () => { expect(analyze('He said "A is right. Choice B.').uncertain.length).toBe(1); });
});
const LETTERS_FOR_TEST = "ABCD";

describe("2차 돌연변이", () => {
  it("인덱스를 치환하지 않으면 실패", () => {
    const f = fx2.find((x) => x.cat === "index" && /인덱스/.test(x.explanation));
    if (!f) return;
    const good = remapAll(f.explanation, f.perm).text;
    const stale = good.replace(/인덱스\s*\d/g, (m) => m.replace(/\d/, String(f.origIndex)));
    expect(stale === good ? true : staticAudit(mk(f, stale)).length > 0).toBe(true);
  });
  it("관사 A 를 잘못 치환하면 실패", () => {
    const f = fx2.find((x) => x.id === "4eaf03a4")!;
    const wrong = f.explanationEn!.replace("A 95%", "D 95%");
    expect(staticAudit(mk(f, undefined, wrong)).length).toBeGreaterThan(0);
  });
});

const fx3 = JSON.parse(readFileSync(path.join(__dirname, "fixtures/position-fix-failures-round3.json"), "utf-8")) as (typeof fx2)[number][];
describe("3차 보강 — 보수 정책(모르는 글자 토큰이 있으면 생략)", () => {
  it("makes/make/made A correct 와 문자 그대로의 \\n 뒤 'A는' 을 참조로 치환", () => {
    const perm = [1, 0, 2, 3];
    expect(remapAll("This makes A correct. B is wrong.", perm).text).toBe("This makes B correct. A is wrong.");
    expect(remapAll("That made A correct and make B wrong.", perm).text).toBe("That made B correct and make A wrong.");
    expect(remapAll("정답은 B이다.\\n\\nA는 틀렸다.", perm).text).toBe("정답은 A이다.\\n\\nB는 틀렸다.");
  });
  it("확정되지 않는 토큰이 하나라도 있으면 불확실: 문맥 없는 B, 수식 밖 변수 E", () => {
    expect(analyze("Overall then B wins the day.").uncertain.length).toBe(1);
    expect(analyze("The vector E points north.").uncertain.length).toBe(1);
    expect(analyze("Vitamin C helps; Plan B fails.").uncertain.length).toBe(0);
    expect(analyze("수식 $A + B$ 에서 값을 구한다.").uncertain.length).toBe(0);
  });
  it("이번 3건: 치환 정합이거나 생략", () => {
    expect(fx3.length).toBe(3);
    for (const f of fx3) {
      const { unc, fails } = safe(f);
      expect(unc.length > 0 || fails.length === 0, f.id).toBe(true);
      if (unc.length === 0) { const e = mk(f); expect(staticAudit(e)).toEqual([]); }
    }
    const a = fx3.find((x) => x.id === "92641ca8")!;
    const en = remapAll(a.explanationEn!, a.perm).text;
    expect(en).toContain("makes B correct");
    const b = fx3.find((x) => x.id === "078f6eba")!;
    expect(remapAll(b.explanationEn!, b.perm).text).toContain("This makes C correct");
  });
  it("돌연변이: makes A correct 를 치환하지 않으면 실패, 정답 글자를 오답 문장으로 서술하면 실패", () => {
    const a = fx3.find((x) => x.id === "92641ca8")!;
    const stale = remapAll(a.explanationEn!, a.perm).text.replace("makes B correct", "makes A correct");
    expect(staticAudit(mk(a, undefined, stale)).length).toBeGreaterThan(0);
    const b = fx3.find((x) => x.id === "078f6eba")!;
    const e = mk(b);
    expect(staticAudit({ ...e, after: { ...e.after, explanation: e.after.explanation + " C번은 잘못된 설명이다." } }).length).toBeGreaterThan(0);
  });
});
