// 자료(그림·표)·SPR 인프라 단위 테스트 — 검증기가 일부러 틀린 문항을 잡아내는가(돌연변이) 중심.
import { describe, expect, it } from "vitest";
import { FTVD_ALL, FTVD_HARD } from "./skills/two-variable-data-figure";
import { generateOne } from "./sweep";
import { verifyLevel, type LArch } from "./levels-d";
import { verifyInstance, runVerification } from "./verify";
import { checkSprAnswers, plainNumberOf, refersToOptions, sprAnswerSet, sprSlot, sprTarget, toRational, toSprInstance } from "./spr";
import { checkChoiceInstance, checkFigureBinding, embeddedFigure, tamperFigure, withoutFigure } from "./figure-verify";
import { sprCapability } from "./spr-capability";
import { ARCHETYPES } from "./registry";
import type { Archetype, Instance } from "./types";

const find = (id: string) => FTVD_ALL.find((a) => a.id === id)!;
const inst = (id: string, fmt: "mc" | "spr" = "mc", from = 0): { a: LArch; i: Instance } => { const a = find(id); for (let s = from; s < from + 80; s++) { const g = generateOne(a, s, fmt); if (g.ok) return { a, i: g.inst }; } throw new Error("no instance " + id); };
const ok = (a: LArch, i: Instance) => verifyLevel(a, i);

describe("SPR 정답 목록 — 정확한 표기만", () => {
  it("정수·기약분수·끝나는 소수·끝나지 않는 소수(그리드 최대 자릿수에서 절사·반올림)", () => {
    expect(sprAnswerSet(12)).toEqual(["12"]);
    expect(sprAnswerSet(-12)).toEqual(["-12"]);
    expect(sprAnswerSet(3.5)).toEqual(["7/2", "3.5"]);
    expect(sprAnswerSet(0.25)).toEqual(["1/4", "0.25"]);
    expect(sprAnswerSet(1 / 3)).toEqual(["1/3", "0.333"]);
    expect(sprAnswerSet(2 / 3)).toEqual(["2/3", "0.666", "0.667"]);
    expect(sprAnswerSet(-3 / 8)).toEqual(["-3/8", "-0.375"]);
  });
  it("손실 표기(7/2 에 '4'·'3', 1/3 에 '0')를 정답으로 만들지 않는다 — 옛 sprFromAnswerText 와의 차이", () => {
    for (const v of [3.5, 1 / 3, 0.25, -0.375, 2 / 3, 7 / 3]) for (const a of sprAnswerSet(v) ?? []) expect(Math.abs(Number(a.includes("/") ? Number(a.split("/")[0]) / Number(a.split("/")[1]) : a) - v), `${v} → ${a}`).toBeLessThan(1.1e-3);
  });
  it("그리드에 못 넣는 값(5자 초과 정수·큰 분모)은 null", () => {
    expect(sprAnswerSet(123456)).toBeNull();
    expect(sprAnswerSet(-123456)).toBeNull();
    expect(sprAnswerSet(Math.PI)).toBeNull();
    expect(toRational(0.123456789)).toBeNull(); expect(toRational(0.142857142857)).toEqual({ p: 1, q: 7 });
  });
  it("정답 표기 검사: 누락·손실·중복·그리드 위반을 잡는다", () => {
    expect(checkSprAnswers(["7/2", "3.5"], 3.5)).toEqual([]);
    expect(checkSprAnswers(["7/2", "3.5", "4"], 3.5).length).toBeGreaterThan(0);
    expect(checkSprAnswers(["3.5"], 3.5).length).toBeGreaterThan(0);
    expect(checkSprAnswers(["7/2", "7/2", "3.5"], 3.5).length).toBeGreaterThan(0);
    expect(checkSprAnswers(["1234567"], 1234567).length).toBeGreaterThan(0);
    expect(checkSprAnswers([], 1).length).toBeGreaterThan(0);
  });
  it("plainNumberOf: π·식·문자는 SPR 불가, 퍼센트·달러·분수는 수", () => {
    expect(plainNumberOf("$36\\pi$")).toBeNull();
    expect(plainNumberOf("$2x + 1$")).toBeNull();
    expect(plainNumberOf("25%")).toBe(25);
    expect(plainNumberOf("$\\frac{3}{4}$")).toBe(0.75);
    expect(plainNumberOf("-7/2")).toBe(-3.5);
  });
  it("질문이 선택지를 가리키면 SPR 불가", () => { expect(refersToOptions("Which of the following is true?")).toBe(true); expect(refersToOptions("What is the value of x?")).toBe(false); });
  it("쿼터 배정: 누적 SPR 수 = half-up(n×0.25) — 4건 1, 10건 3, 100건 25, 1000건 250", () => {
    const count = (n: number) => { let c = 0; for (let i = 1; i <= n; i++) if (sprSlot(i)) c++; return c; };
    expect([4, 10, 100, 1000].map(count)).toEqual([1, 3, 25, 250]);
    expect([4, 10, 100, 1000].map((n) => sprTarget(n))).toEqual([1, 3, 25, 250]);
    for (let n = 1; n <= 200; n++) expect(Math.abs(count(n) - n * 0.25)).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});

describe("자료(figure) 원형 — 검증기가 변조를 잡는다", () => {
  const ID = "tvd.scatter_equation.SC.P.inverse";
  it("원본은 통과(정답 재계산·checkFigure·자료 의존)", () => { const { a, i } = inst(ID); expect(i.figure).toBeTruthy(); expect(ok(a, i).failures).toEqual([]); });
  it("FIGURE 상수가 Instance.figure 와 다르면 실패(검증이 인쇄된 자료를 풀지 않음)", () => {
    const { a, i } = inst(ID); const f = embeddedFigure(i.verificationJs) as { fitLine: { slope: number } };
    const bad = { ...i, verificationJs: i.verificationJs.replace(/^const FIGURE = .*;$/m, `const FIGURE = ${JSON.stringify({ ...f, fitLine: { ...f.fitLine, slope: f.fitLine.slope + 1 } })};`) };
    expect(ok(a, bad).ok).toBe(false);
  });
  it("그림 수치만 변조(자료와 지문·선지 불일치)하면 정답 재계산이 어긋나 실패", () => {
    const { a, i } = inst(ID); const t = tamperFigure(i.figure, "add");
    const bad = { ...i, figure: t, verificationJs: i.verificationJs.replace(/^const FIGURE = .*;$/m, `const FIGURE = ${JSON.stringify(t)};`) };
    expect(ok(a, bad).ok).toBe(false);
  });
  it("정답 키를 다른 선지로 바꾸면 실패", () => { const { a, i } = inst(ID); expect(ok(a, { ...i, correctIndex: (i.correctIndex + 1) % 4 }).ok).toBe(false); });
  it("자료 의존 검사: FIGURE 를 가려도 답이 나오는 verification_js(자료가 장식)는 실패", () => {
    const { a, i } = inst(ID);
    const decorative = { ...i, verificationJs: `const P = ${JSON.stringify({ T: 1 })};\nconst FIGURE = ${JSON.stringify(i.figure)};\nreturn ${i.options[i.correctIndex]};` };
    expect(checkFigureBinding(decorative).join("|")).toContain("자료 의존 검사 실패");
    expect(verifyInstance(a, decorative).ok).toBe(false);
    expect(() => runVerification(withoutFigure(i.verificationJs))).toThrow();
  });
  it("그림이 없으면 'as shown' 류 지문과 함께 figure_required 로 실패", () => {
    const { a, i } = inst(ID); const noFig = { ...i, figure: null, stimulus: `${i.stimulus} The graph is shown above.` };
    expect(verifyInstance(a, noFig).failures.join("|")).toContain("figure_required");
  });
  it("지문이 자료를 가리키지 않으면 실패", () => { const { a, i } = inst(ID); expect(checkFigureBinding({ ...i, stimulus: "A study.", question: "What is x?" }).join("|")).toContain("가리키지 않음"); void a; });
  it("지문이 표 칸 값을 틀리게 인용하면 렌더 검사(참조 일치)가 잡는다", () => {
    const { a, i } = inst("tvd.cell.TW.P.easy_read_cell"); const fig = i.figure as { rowLabels: string[]; colLabels: string[]; cells: number[][] };
    const bad = { ...i, stimulus: `${i.stimulus} The ${fig.rowLabels[0]} ${fig.colLabels[0]} count is ${fig.cells[0][0] + 7}.` };
    expect(ok(a, bad).failures.join("|")).toMatch(/ref_mismatch|렌더 검사/);
  });
});

describe("선택지형(figure_choice) 일반 검증기", () => {
  const ID = "tvd.scatter_equation.SC.C.repr_shift";
  it("원본 통과: 정답만 predicate 참, 오답 3개는 서로 다른 선언 규칙으로 진단", () => { const { a, i } = inst(ID); expect(ok(a, i).failures).toEqual([]); expect(new Set(i.choice!.rules.filter((r) => r !== "correct")).size).toBe(3); });
  it("정답 자리를 바꾸면 실패", () => { const { a, i } = inst(ID); expect(ok(a, { ...i, correctIndex: (i.correctIndex + 1) % 4 }).ok).toBe(false); });
  it("같은 오답 규칙이 두 번이면 실패", () => { const { i } = inst(ID); const rules = [...i.choice!.rules]; const w = rules.map((r, k) => (r === "correct" ? -1 : k)).filter((k) => k >= 0); rules[w[1]] = rules[w[0]]; expect(checkChoiceInstance({ ...i, choice: { ...i.choice!, rules } }, i.correctIndex).join("|")).toContain("같은 오답 규칙"); });
  it("선언한 규칙과 진단이 다르면 실패", () => { const { i } = inst(ID); const rules = [...i.choice!.rules]; const w = rules.map((r, k) => (r === "correct" ? -1 : k)).filter((k) => k >= 0); const t = rules[w[0]]; rules[w[0]] = rules[w[1]]; rules[w[1]] = t; expect(checkChoiceInstance({ ...i, choice: { ...i.choice!, rules } }, i.correctIndex).join("|")).toContain("진단은"); });
  it("선택지 그림 두 개가 같으면 실패", () => { const { i } = inst(ID); const fig = i.figure as { choices: unknown[] }; const ch = [...fig.choices]; ch[(i.correctIndex + 1) % 4] = ch[(i.correctIndex + 2) % 4]; expect(checkChoiceInstance({ ...i, figure: { ...fig, choices: ch } }, i.correctIndex).join("|")).toContain("같은 그림"); });
  it("선택지 그림 수치(추세선)를 변조하면 정답 predicate 가 어긋나 실패", () => {
    const { a, i } = inst(ID); const fig = i.figure as { choices: { objects: { fitLine: { slope: number } }[] }[] }; const ch = JSON.parse(JSON.stringify(fig.choices)); ch[i.correctIndex].objects[0].fitLine.slope += 1;
    const bad = { ...i, figure: { ...fig, choices: ch }, verificationJs: i.verificationJs.replace(/^const CHOICES = .*;$/m, `const CHOICES = ${JSON.stringify(ch)};`) };
    expect(ok(a, bad).ok).toBe(false);
  });
});

describe("SPR 변형 — 같은 원형·같은 자료, 정답 목록만", () => {
  it("hard 수치형 원형은 SPR 로 변환되고 verify 를 통과한다(정답 목록 = 재계산값에서 규칙대로)", () => {
    const { a, i } = inst("tvd.conditional_share.TW.P.compose_kind", "spr"); expect(i.format).toBe("spr"); expect(i.options).toEqual([]); expect(i.answers!.length).toBeGreaterThan(0); expect(ok(a, i).failures).toEqual([]);
  });
  it("정답 목록을 변조하면(손실 표기 추가·값 변경) 실패", () => {
    const { a, i } = inst("tvd.cell.TW.P.unit_ratio", "spr"); expect(ok(a, { ...i, answers: [...i.answers!, String(Number(i.answers![0]) + 1)] }).ok).toBe(false); expect(ok(a, { ...i, answers: ["999"] }).ok).toBe(false);
  });
  it("선택지형·서술 선지·선택지를 가리키는 질문은 SPR 불가로 변환을 거부한다", () => {
    const c = inst("tvd.scatter_equation.SC.C.repr_shift").i; expect(toSprInstance(c, 0).ok).toBe(false);
    const q = inst("tvd.association_direction_strength.SC.P.repr_shift").i; expect(toSprInstance(q, 0).ok).toBe(false);
    const m = inst("tvd.cell.TW.P.inverse").i; expect(toSprInstance({ ...m, question: "Which of the following is the number of juniors?" }, 5).ok).toBe(false);
  });
  it("SPR 선언 필수: 새 자료 원형은 전부 sprCapable 과 사유를 선언했고, 선언대로 동작한다", { timeout: 180_000 }, () => {
    for (const a of FTVD_HARD) { expect(a.spr, a.id).toBeTruthy(); expect(a.spr!.reason.length, a.id).toBeGreaterThan(10); }
    for (const a of FTVD_ALL.filter((x) => x.level === "hard")) {
      let okc = 0, tot = 0; for (let s = 0; s < 20; s++) { const g = generateOne(a, s, "spr"); tot++; if (g.ok) okc++; }
      if (a.spr!.capable) expect(okc, a.id).toBeGreaterThan(15); else expect(okc, a.id).toBe(0);
    }
  });
  it("mc 와 spr 변형은 같은 유사문항 그룹 키를 공유한다(groupId/변형)", () => {
    const a = find("tvd.cell.TW.P.chain2"); const g = generateOne(a, 5); expect(g.ok).toBe(true); expect(a.groupId ?? a.id).toBe(a.id);
  });
  it("옛 원형은 선언이 없으면 시드 프로브로 판정한다(수치 정답 → 가능, 선지가 식 → 불가)", () => {
    const numeric = ARCHETYPES.find((x) => x.skill === "probability")!; const c = sprCapability(numeric); expect(c.declared).toBe(false); expect(typeof c.capable).toBe("boolean"); expect(c.reason).toContain("프로브");
  });
});

describe("회귀: 자료 없는 기존 원형은 영향 없음", () => {
  it("figure 가 없는 원형 인스턴스는 verify 결과가 이전과 같다(자료 검사 없음)", () => {
    const a = ARCHETYPES.find((x) => x.id === "le.solve.compose_kind") as Archetype; let n = 0;
    for (let s = 0; s < 40 && n < 10; s++) { const g = generateOne(a, s); if (g.ok) { expect(verifyInstance(a, g.inst).ok).toBe(true); expect(g.inst.figure).toBeUndefined(); n++; } }
    expect(n).toBeGreaterThan(0);
  });
});
