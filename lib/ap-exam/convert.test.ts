import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planConversion } from "./convert";
import { AP_LAYOUTS, sectionsForLabel, totalMinutes } from "./layouts";
import type { ApCandidateLike } from "../ap-figures/gate";

const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as (ApCandidateLike & { validation: string })[];

describe("planConversion on current stock", () => {
  it("every live (auto_passed + needs_revalidation) candidate converts (gate passes, English explanation, valid key)", () => {
    const bad: string[] = [];
    for (const c of items.filter((i) => i.validation === "auto_passed" || i.validation === "needs_revalidation")) {
      const p = planConversion(c);
      if (!p.ok) { bad.push(`${c.candidateKey}: ${p.reason}`); continue; }
      for (const it of p.items) {
        if (it.format === "mc" && (it.correctIndex === null || it.correctIndex >= (it.options?.length ?? 0))) bad.push(`${c.candidateKey}: bad key`);
        if (/[ㄱ-ㆎ가-힣]/.test([it.passage, it.question, ...(it.options ?? [])].join(" "))) bad.push(`${c.candidateKey}: hangul`);
        if (it.figure && !(it.renderCheck as { ok: boolean }).ok) bad.push(`${c.candidateKey}: render_check not ok`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("아키타입 생성 문항의 {text, why, value} 선택지는 text 로 변환된다(객체가 \"[object Object]\" 로 새지 않는다)", () => {
    const c = items.find((i) => Array.isArray(i.payload.options) && typeof (i.payload.options as unknown[])[0] === "object" && i.validation === "auto_passed")!;
    const p = planConversion(c);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.items[0].options!.every((o) => typeof o === "string" && !o.includes("[object"))).toBe(true);
  });
  it("FRQ conversion keeps parts and labels the reference as unofficial", () => {
    const f = items.find((i) => i.kind === "frq_bundle" && i.validation === "auto_passed")!;
    const p = planConversion(f);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.items[0].format).toBe("essay");
      expect((p.items[0].statements as unknown[]).length).toBeGreaterThan(0);
      expect(p.items[0].explanationEn).toContain("not official");
    }
  });
});

// 외부 감사(2026-10-08): 그래프 FRQ 의 초기값·함수 정의가 그림 스펙에만 없고 학생 화면에 안 나왔다(AB1 저축·AB2 태양광·BC1 f' 그래프).
describe("그래프 FRQ 의 context·given 이 학생 지문에 실린다", () => {
  const get = (key: string) => items.find((i) => i.candidateKey === key && i.kind === "frq_bundle")!;
  const passageOf = (key: string) => { const p = planConversion(get(key)); expect(p.ok).toBe(true); return p.ok ? (p.items[0].passage ?? "") : ""; };
  it("AB1 저축 그래프: f(0)=40 과 f 의 정의", () => {
    const t = passageOf("ap_calculus_ab-f02-k5");
    expect(t).toContain("cumulative net savings");
    expect(t).toContain("$f(0) = 40$");
  });
  it("AB2 태양광: S(0)=0, BC1 f' 그래프: f(0)=1 (문자열 given)", () => {
    expect(passageOf("ap_calculus_ab-f02-k9")).toContain("S(0)=0 dollars");
    expect(passageOf("ap_calculus_ab-f02-k10")).toContain("f(0)=1");
  });
  it("자료가 없는 그래프 FRQ 의 지문은 바뀌지 않는다", () => {
    const skip = ["ap_calculus_ab-f02-k5", "ap_calculus_ab-f02-k9", "ap_calculus_ab-f02-k10"];
    const g = items.filter((i) => i.kind === "frq_bundle" && i.validation === "auto_passed" && (i.payload.stimulus as { kind?: string } | undefined)?.kind === "graph" && !skip.includes(i.candidateKey));
    expect(g.length).toBeGreaterThan(0);
    for (const c of g) { const p = planConversion(c); if (p.ok) expect(p.items[0].passage).toBeNull(); }
  });
});

describe("layouts", () => {
  it("official structure and label rules", () => {
    expect(AP_LAYOUTS.ap_calculus_ab.reduce((a, s) => a + (s.kind === "mc" ? s.count : 0), 0)).toBe(42);
    expect(sectionsForLabel("ap_calculus_ab", "mc_practice").map((s) => s.key)).toEqual(["ap_mc_a", "ap_mc_b"]);
    expect(totalMinutes("ap_calculus_ab", "mc_practice")).toBe(100);
    expect(AP_LAYOUTS.ap_microeconomics[0].options).toBe(5);
  });
});

// ── FRQ 표·도식 자료의 stimulus.description(실험 설정) 이 학생 화면에서 사라지던 문제(감사 3라운드, 2026-10-13) ──
describe("FRQ 설정 지문(frqLostSetup)", () => {
  const SETUP = "A student measures the period $T$ of a block of mass $m$ hanging on a vertical spring of unknown spring constant $k$.";
  const frq = (stimulus: Record<string, unknown>, subject = "ap_physics_1"): ApCandidateLike => ({
    candidateKey: "t:frq", apSubjectCode: subject, kind: "frq_bundle",
    payload: {
      title: "Experiment: spring constant", total_points: 3, stimulus,
      parts: [{ label: "A", points: 3, prompt: "Describe an experimental procedure to collect the data.", response_mode: "explain", model_answer: "Time ten oscillations for several masses.", rubric_rows: [{ points: 3, criterion: "procedure" }] }],
    },
    keywordCode: "k", difficultyProvisional: "exam_prep",
  } as unknown as ApCandidateLike);
  const table = (description: string, extra: Record<string, unknown> = {}) => ({ kind: "table", description, data: { x_label: "Mass m (kg)", y_label: "Period T (s)", rows: [[0.1, 0.445], [0.2, 0.62], [0.3, 0.774]], ...extra } });

  it("표 자료의 실험 설정 서술문은 본문 지문으로 실린다(표만 보이던 화면 수정)", () => {
    const p = planConversion(frq(table(SETUP)));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.items[0].passage).toBe(SETUP);
  });
  it("같은 설명이 이미 그림 notes 에 있으면(phys-s4 방식) 지문으로 중복해서 싣지 않는다", () => {
    const p = planConversion(frq(table(SETUP, { notes: [SETUP] })));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.items[0].passage).toBeNull();
  });
  it("단순 그림 캡션은 건드리지 않는다(다른 과목의 기존 표시 유지)", () => {
    const p = planConversion(frq(table("Selected values of R(t), in gallons per minute"), "ap_calculus_ab"));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.items[0].passage).toBeNull();
  });
  it("설명의 수치(310 K)가 화면 어디에도 없으면 지문으로 싣는다", () => {
    const p = planConversion(frq(table("Concentration of A in the reaction A → products at 310 K"), "ap_chemistry"));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.items[0].passage).toBe("Concentration of A in the reaction A → products at 310 K.");
  });
  it("MC: 캡션 뒤 조건 문장(한계비용 $26)이 화면에 없으면 지문으로 싣고 금액 $ 는 이스케이프한다(라운드 4)", () => {
    const desc = "Marginal benefit (in dollars) that two people receive from each unit of a public good. The marginal cost of each unit is $26. A $5 fee applies and $3 refunds.";
    const mc = { candidateKey: "t:mc2", apSubjectCode: "ap_microeconomics", kind: "mc", payload: { stem: "What is the efficient quantity?", options: ["4", "3", "0", "6"], key_index: 0, explanation_en: "MSB exceeds MC for 4 units: 28 > $26 and $3.", stimulus: table(desc, { x_label: "Unit", y_label: "MB" }) }, keywordCode: "k", difficultyProvisional: "exam_prep" } as unknown as ApCandidateLike;
    const p = planConversion(mc);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.items[0].passage).toBe("Marginal benefit (in dollars) that two people receive from each unit of a public good. The marginal cost of each unit is \\$26. A \\$5 fee applies and \\$3 refunds.");
      expect(p.items[0].explanationEn).toBe("MSB exceeds MC for 4 units: 28 > \\$26 and \\$3.");
    }
  });
  it("MC: 한 줄 캡션(25 °C, 298 K)은 지문으로 싣지 않는다", () => {
    const mc = { candidateKey: "t:mc3", apSubjectCode: "ap_chemistry", kind: "mc", payload: { stem: "Which has the lowest pH?", options: ["a", "b", "c", "d"], key_index: 0, explanation_en: "Because.", stimulus: table("Acid dissociation constants at 25 °C") }, keywordCode: "k", difficultyProvisional: "exam_prep" } as unknown as ApCandidateLike;
    const p = planConversion(mc);
    if (p.ok) expect(p.items[0].passage).toBeNull();
  });
  it("MC 문항은 영향받지 않는다", () => {
    const mc = { candidateKey: "t:mc", apSubjectCode: "ap_physics_1", kind: "mc", payload: { stem: "Which graph?", options: ["a", "b", "c", "d"], key_index: 0, explanation_en: "Because.", stimulus: table(SETUP) }, keywordCode: "k", difficultyProvisional: "exam_prep" } as unknown as ApCandidateLike;
    const p = planConversion(mc);
    if (p.ok) expect(p.items[0].passage).toBeNull();
  });
});
