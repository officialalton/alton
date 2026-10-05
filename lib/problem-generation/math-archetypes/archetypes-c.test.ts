// C 담당(percentages·area_volume·circles·ratios/probability easy·medium) 검증: lite 원형 시드 스윕·재현성·그룹 공급, 의미 일치 검사기 돌연변이.
import { describe, expect, it } from "vitest";
import { LITE_C_ARCHETYPES } from "./lite-c";
import { ARCHETYPES } from "./registry";
import { generateLite, sweepLite, verifyLite } from "./c-lite";
import { semanticIssues, forbidExcept, plural, semOf } from "./c-kit";
import { generateOne } from "./sweep";
import { mutantsOf } from "./figure-coverage-gate";
import { verifyInstance } from "./verify";
import type { Instance } from "./types";

const C_SKILLS = ["percentages", "area_volume", "circles"];
// 자료(표·그림) 원형(figureItem)은 조합 단위 게이트 G1~G10(figure-coverage.test.ts)이 개수·연산자·변조를 따로 검사한다 — 옛 원형의 개수 기대값(20·24·28)은 그대로 둔다.
const ALL_C = ARCHETYPES.filter((a) => C_SKILLS.includes(a.skill));
const HARD_C = ALL_C.filter((a) => !a.figureItem);
const FIG_C = ALL_C.filter((a) => a.figureItem);

describe("C 담당 hard 원형 구성", () => {
  it("percentages 20·area_volume 24·circles 28 개, 세부 패턴마다 4개이고 연산자가 모두 다르다", () => {
    const by = (s: string) => HARD_C.filter((a) => a.skill === s).length;
    expect(by("percentages")).toBe(20); expect(by("area_volume")).toBe(24); expect(by("circles")).toBe(28);
    const byKind = new Map<string, string[]>();
    for (const a of HARD_C) byKind.set(`${a.skill}.${a.kind}`, [...(byKind.get(`${a.skill}.${a.kind}`) ?? []), a.operator]);
    for (const [k, ops] of byKind) { expect(ops.length, k).toBe(4); expect(new Set(ops).size, k).toBe(4); }
  });
});

describe("lite(easy/medium) 원형 — 시드 스윕", () => {
  it("lite id 는 중복이 없고 틀(frame) 이름이 있으며 easy·medium 을 모두 낸다", () => {
    const ids = new Set<string>();
    for (const a of LITE_C_ARCHETYPES) { expect(ids.has(a.id), a.id).toBe(false); ids.add(a.id); expect(a.frame.length).toBeGreaterThan(0); expect(a.levels).toEqual(["easy", "medium"]); expect(a.structure.length).toBeGreaterThan(5); }
  });
  for (const a of LITE_C_ARCHETYPES) for (const lv of a.levels) {
    it(`${a.id} ${lv}: 400 시드 검증 실패 0, 예외 0, 독립 변형 30개 이상`, () => {
      const st = sweepLite(a, lv, 400);
      expect(st.thrown, st.thrownSamples.join("|")).toBe(0);
      expect(st.verifyFail, JSON.stringify(st.failSeeds[0])).toBe(0);
      expect(st.produced).toBeGreaterThan(100);
      expect(st.independent, "본문 유사도 0.6 미만 독립 변형 수").toBeGreaterThanOrEqual(30);
    }, 120_000);
    it(`${a.id} ${lv}: 같은 시드는 같은 문항(재현성), 변형 이름은 난이도로 시작`, () => {
      let n = 0; for (let s = 0; s < 40 && n < 3; s++) { const x = generateLite(a, lv, s), y = generateLite(a, lv, s); expect(JSON.stringify(x)).toBe(JSON.stringify(y)); if (x.ok) { n++; expect(x.inst.variant.startsWith(`${lv}.`)).toBe(true); } }
      expect(n).toBeGreaterThan(0);
    });
  }
});

describe("lite 검증기 — 돌연변이", () => {
  const a = LITE_C_ARCHETYPES.find((x) => x.id === "av.rectangle_area.floor")!;
  const good = (() => { for (let s = 0; s < 40; s++) { const g = generateLite(a, "easy", s); if (g.ok) return g.inst; } throw new Error("no"); })();
  it("원본은 통과", () => expect(verifyLite(a, good).ok).toBe(true));
  it("정답 키가 틀리면 실패", () => expect(verifyLite(a, { ...good, correctIndex: (good.correctIndex + 1) % 4 }).ok).toBe(false));
  it("선지가 겹치면 실패", () => { const o = [...good.options]; o[(good.correctIndex + 1) % 4] = o[good.correctIndex]; expect(verifyLite(a, { ...good, options: o }).ok).toBe(false); });
  it("verification_js 상수를 바꾸면 실패", () => expect(verifyLite(a, { ...good, verificationJs: good.verificationJs.replace(/"l":\d+/, '"l":999') }).ok).toBe(false));
});

describe("문장-변수 의미 일치 검사기(명사-수식 매핑)", () => {
  it("반지름 7 로 선언했는데 본문이 '지름 7' 이면 잡는다", () => {
    expect(semanticIssues("A can has a diameter of 7 centimeters and a height of 12 centimeters.", "What is the volume?", [{ v: 7, words: ["radius"] }, { v: 12, words: ["height"] }]).length).toBeGreaterThan(0);
    expect(semanticIssues("A can has a radius of 7 centimeters and a height of 12 centimeters.", "What is the volume?", [{ v: 7, words: ["radius"] }, { v: 12, words: ["height"] }])).toEqual([]);
  });
  it("지름 값이 반지름 자리에 쓰인 서술(둘레/넓이 혼동 포함)을 잡는다", () => {
    expect(semanticIssues("A circle has a circumference of 30 and an area of 50.", "x", [{ v: 30, words: ["area"] }, { v: 50, words: ["circumference"] }]).length).toBeGreaterThan(0);
    expect(semanticIssues("A circle has a circumference of 30 and an area of 50.", "x", [{ v: 30, words: ["circumference"] }, { v: 50, words: ["area"] }])).toEqual([]);
  });
  it("질문이 구하는 양이 아닌 다른 양의 명사를 섞으면 잡는다", () => {
    expect(semanticIssues("A box.", "What is the perimeter of the box?", [], { words: ["area"], forbid: forbidExcept("area") }).length).toBeGreaterThan(0);
    expect(semanticIssues("A box.", "What is the area of the box?", [], { words: ["area"], forbid: forbidExcept("area") })).toEqual([]);
    expect(semanticIssues("A box.", "What is the volume of the box?", [], { words: ["area"], forbid: forbidExcept("area") }).length).toBeGreaterThan(0);
  });
  it("증가·감소 방향어가 퍼센트와 어긋나면 잡는다", () => {
    expect(semanticIssues("The price was reduced by 20%.", "?", [{ v: 20, words: ["raised", "increase", "increased"], pct: true }]).length).toBeGreaterThan(0);
    expect(semanticIssues("The price was raised by 20%.", "?", [{ v: 20, words: ["raised", "increase", "increased"], pct: true }])).toEqual([]);
  });
  it("복수형 도우미", () => { expect(plural("box")).toBe("boxes"); expect(plural("crate")).toBe("crates"); expect(plural("pantry")).toBe("pantries"); });
});

describe("돌연변이 — C 담당 모든 원형(hard·lite)에서 검증기가 변조를 잡는가", () => {
  const firstOk = (gen: (s: number) => { ok: boolean; inst?: Instance }) => { for (let s = 0; s < 60; s++) { const g = gen(s); if (g.ok) return g.inst!; } throw new Error("생성 실패"); };
  const mutations = (inst: Instance, check: (i: Instance) => { ok: boolean; failures: string[] }, figure = false) => {
    expect(check(inst).ok, JSON.stringify(check(inst).failures)).toBe(true);
    expect(check({ ...inst, correctIndex: (inst.correctIndex + 1) % 4 }).ok, "정답 키 변조").toBe(false);
    const o = [...inst.options]; o[(inst.correctIndex + 1) % 4] = o[inst.correctIndex]; expect(check({ ...inst, options: o }).ok, "선지 겹침").toBe(false);
    if (figure) { expect(mutantsOf(inst).some((mm) => !check(mm).ok), "자료(FIGURE) 변조").toBe(true); expect(check({ ...inst, stimulus: `${inst.stimulus} $x` }).ok, "$ 짝").toBe(false); return; }
    const m = inst.verificationJs.match(/^const P = (\{.*\});/)!; const P = JSON.parse(m[1]) as Record<string, unknown>; let caught = false;
    for (const [k, v] of Object.entries(P)) { if (typeof v !== "number" || !Number.isInteger(v)) continue; for (const d of [1, -1, 2, 7, -3]) { const js = inst.verificationJs.replace(/^const P = \{.*\};/, `const P = ${JSON.stringify({ ...P, [k]: v + d })};`); const r = check({ ...inst, verificationJs: js }); if (!r.ok && r.failures.some((f) => f.includes("정답 재계산") || f.includes("verification_js 실패") || f.includes("정답 키 불일치"))) { caught = true; break; } } if (caught) break; }
    expect(caught, "verification_js 상수 변조").toBe(true);
    expect(check({ ...inst, stimulus: `${inst.stimulus} $x` }).ok, "$ 짝").toBe(false);
  };
  for (const a of HARD_C) it(`${a.id}: 변조를 잡는다`, () => { const inst = firstOk((s) => { const g = generateOne(a, s); return g.ok ? { ok: true, inst: g.inst } : { ok: false }; }); mutations(inst, (i) => verifyInstance(a, i)); });
  // 자료 원형: 값은 FIGURE 에 있으므로 P 상수 대신 자료(셀·점) 변조(게이트 G6 와 같은 tamperFigure)가 잡히는지 본다.
  for (const a of FIG_C) it(`${a.id}: 자료 변조를 잡는다`, () => { const inst = firstOk((s) => { const g = generateOne(a, s); return g.ok ? { ok: true, inst: g.inst } : { ok: false }; }); mutations(inst, (i) => verifyInstance(a, i), true); });
  for (const a of LITE_C_ARCHETYPES) for (const lv of a.levels) it(`${a.id} ${lv}: 변조를 잡는다`, () => { const inst = firstOk((s) => { const g = generateLite(a, lv, s); return g.ok ? { ok: true, inst: g.inst } : { ok: false }; }); mutations(inst, (i) => verifyLite(a, i)); });

  const SWAP: Record<string, string> = { radius: "diameter", diameter: "radius", circumference: "area", area: "perimeter", volume: "area", height: "width", length: "width", width: "length", base: "height", perimeter: "area", raised: "reduced", increased: "decreased", increase: "decrease", discount: "markup", reduced: "raised" };
  it("의미 불일치 돌연변이: 선언한 수량 명사를 다른 명사로 바꾸면 의미 검사가 잡는다(기하·퍼센트 원형 다수)", () => {
    let tested = 0, caught = 0; const misses: string[] = [];
    const all: { id: string; gen: (s: number) => Instance | null }[] = [
      ...HARD_C.map((a) => ({ id: a.id, gen: (s: number) => { const g = generateOne(a, s); return g.ok ? g.inst : null; } })),
      ...LITE_C_ARCHETYPES.flatMap((a) => a.levels.map((lv) => ({ id: `${a.id}#${lv}`, gen: (s: number) => { const g = generateLite(a, lv, s); return g.ok ? g.inst : null; } }))),
    ];
    for (const { id, gen } of all) {
      for (let s = 0; s < 30; s++) {
        const inst = gen(s); if (!inst) continue; const { semBinds, semAsk } = semOf(inst); if (!semBinds?.length) continue;
        const b = semBinds.find((x) => x.words.some((w) => SWAP[w] && new RegExp(`\\b${w}\\b`, "i").test(inst.stimulus))); if (!b) continue;
        const w = b.words.find((x) => SWAP[x] && new RegExp(`\\b${x}\\b`, "i").test(inst.stimulus))!;
        const mutated = inst.stimulus.replace(new RegExp(`\\b${w}\\b`, "gi"), SWAP[w]); tested++;
        if (semanticIssues(mutated, inst.question, semBinds, semAsk).length > 0) caught++; else misses.push(`${id}:${w}`);
        break;
      }
    }
    expect(tested).toBeGreaterThan(40);
    expect(misses.length, `놓친 변조: ${misses.slice(0, 8).join(", ")}`).toBeLessThanOrEqual(Math.floor(tested * 0.1));
    expect(caught).toBeGreaterThan(tested * 0.9);
  });
});
