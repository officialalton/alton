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
