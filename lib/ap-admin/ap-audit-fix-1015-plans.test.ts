// 외부 AP 전체 검수(2026-10-15) 확정 수정본: 수정본 후보(supp-fix1015)와 새 버전 교체안의 정합성. DB 없음.
// 후보는 게시 문항의 복제본이라 (1) 지적된 결함이 실제로 사라졌는지, (2) 게이트(렌더·변환·결정적 검사)를 통과하는지, (3) 교체안이 독립 검증기 위반을 늘리지 않는지 본다.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "../ap-exam/convert";
import { STOCK_BATCHES } from "./batches";
import { parseSwapPlan, resolveSwaps } from "./new-version";
import { FIXES, RUN, buildRecord, runGates } from "../../scripts/audit/ap-audit-fix-1015";
import { PLANS, SUBJ, buildPlan, compose } from "../../scripts/audit/ap-audit-fix-1015-plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const rd = (p: string): J => JSON.parse(readFileSync(p, "utf-8"));
const items: J[] = rd("data/ap/stock/supp-fix1015-items.json");
const byNew = new Map(items.map((r) => [r.candidateKey, r]));
const optTexts = (p: J) => (p.options as J[]).map((o) => o.text as string);

describe("수정본 배치 등록·재현", () => {
  it("배치 등록·통과 키·증거 파일 이름", () => {
    expect(STOCK_BATCHES.find((b) => b.id === "supp-fix1015")).toMatchObject({ itemsFile: "supp-fix1015-items.json", passKeysFile: "supp-fix1015-pass-keys.json", evidenceFile: "evidence-fix1015.json", supplement: true });
    const pass = new Set(rd("data/ap/stock/supp-fix1015-pass-keys.json") as string[]);
    expect(pass.size).toBe(items.length);
    for (const r of items) { expect(pass.has(r.stockKey)).toBe(true); expect(r.validation).toBe("auto_passed"); expect(r.stockKey).toBe(`${RUN}:${r.candidateKey}`); }
  });
  it("저장된 후보는 생성기 출력과 같다(손으로 고친 흔적 없음)", () => {
    expect(items.map((r) => r.stockKey)).toEqual(FIXES.map((f) => `${RUN}:${f.newKey}`));
    for (const f of FIXES) expect(byNew.get(f.newKey)!.payload).toEqual(buildRecord(f).payload);
  });
  it("모든 후보가 렌더·변환·결정적 게이트를 통과하고 원본 대비 새 위반이 없다", () => {
    for (const r of items) {
      const g = gateCandidate(r); expect(["pass", "not_applicable"], r.stockKey).toContain(g.status);
      expect(planConversion(r).ok, r.stockKey).toBe(true);
      const x = runGates(r); expect(x.defects, r.stockKey).toEqual([]);
    }
  });
});

describe("지적 결함이 실제로 고쳐졌다", () => {
  it("AP-002 Micro: 한계비용 $26 이 학생이 보는 문항 본문에 있다", () => {
    const p = byNew.get("ap_microeconomics-fx01-k0")!.payload; expect(p.stem).toContain("marginal cost of providing each unit of the public good is $26");
    const ma = p.facts.find((f: string) => f.startsWith("ma="))!, mb = p.facts.find((f: string) => f.startsWith("mb="))!;
    const A: number[] = JSON.parse(ma.slice(3)), B: number[] = JSON.parse(mb.slice(3));
    const q = A.map((a, i) => a + B[i]).filter((s) => s > 26).length; expect(optTexts(p)[p.key_index]).toBe(String(q));
  });
  it("AP-001 Bio: 복제분기점 진행 방향이 제목과 A 파트 문장에 있다", () => {
    const p = byNew.get("ap_biology-fx02-k0")!.payload;
    expect(p.title).toContain("moves toward the right"); expect(p.parts[0].prompt).toContain("moving toward the right side");
    expect(p.parts[0].model_answer).toContain("bottom"); // 오른쪽으로 가는 분기점 + 위 5'→3'(왼→오) = 아래 가닥이 선도 가닥 주형
  });
  it("AP-003/004 Stats: 한 문항 안에 서로 동치인 귀무가설 보기가 없다(동질성·독립성 동시 출제 금지)", () => {
    for (const k of ["ap_statistics-fx03-k0", "ap_statistics-fx04-k0", "ap_statistics-fx05-k0"]) {
      const t = optTexts(byNew.get(k)!.payload); const indep = t.filter((x) => /independent/.test(x) && !/in the sample/.test(x) && !/df = 11/.test(x)).length;
      const same = t.filter((x) => /is the same for all/.test(x) && !/df = 11/.test(x)).length;
      expect(Math.max(indep, same), k).toBeLessThanOrEqual(1);
      expect(indep + same, k).toBe(1); // 키 하나만 귀무가설의 올바른 서술(동일 분포 또는 독립 중 설계에 맞는 쪽)
      expect(t.filter((x) => /not the same|are associated/.test(x)), k).toHaveLength(1);
    }
  });
  it("AP-067 Stats: p-hat 0.46 = 92/200, z=1.732, 상측 P=0.0416 -> 0.042 와 보기·곡선이 일치", () => {
    const p = byNew.get("ap_statistics-fx67-k0")!.payload; const n = 200, p0 = 0.4, ph = 0.46;
    expect(Number.isInteger(ph * n)).toBe(true);
    const z = (ph - p0) / Math.sqrt((p0 * (1 - p0)) / n); const tail = 0.5 * (1 - erf(z / Math.SQRT2)); expect(tail.toFixed(3)).toBe("0.042");
    expect(JSON.stringify(p)).not.toMatch(/0\.459|0\.044/); expect(p.stimulus.data.curve.shades[0].from).toBe(0.46);
  });
  it("AP-006/008/010 Bio FRQ: 용질 퍼텐셜은 lower, UV 는 비치사 조건, 제목은 완결 문장", () => {
    const potato = JSON.stringify(byNew.get("ap_biology-fx06-k0")!.payload);
    expect(potato).not.toMatch(/solute potential, Ψ_S = -iCRT with i = 2\) is greater/); expect(potato).toContain("lower (more negative)");
    expect(byNew.get("ap_biology-fx06-k0")!.payload.title).not.toMatch(/equal i$/);
    const uv = byNew.get("ap_biology-fx08-k0")!.payload; expect(uv.stimulus.description).toContain("most of the exposed cells survive"); expect(uv.parts[2].model_answer).toContain("most cells survive");
    const af = byNew.get("ap_biology-fx10-k0")!.payload; expect(af.title).toMatch(/^In an isolated population of insects, an allele that provides resistance/); expect(af.title).not.toMatch(/an$/);
  });
  it("AP-012 Bio: 798 -> 800 인데 '멈췄다'고 쓰지 않는다", () => { const s = JSON.stringify(byNew.get("ap_biology-fx12-k0")!.payload); expect(s).not.toContain("stops changing"); expect(s).toContain("changes very little"); });
  it("AP-058 Physics: 표시 속도 0.2·0.4 m/s 로 운동량 1, 운동량 보존, KE 0.5 -> 0.18 J 가 정확히 맞다", () => {
    const p = byNew.get("ap_physics_1-fx58-k0")!.payload; expect(p.stem).toContain("0.2\\text{ m/s}"); expect(p.stem).toContain("0.4\\text{ m/s}");
    const pa = 1 * 0.2 + 2 * 0.4, ke = 0.5 * 1 * 0.2 ** 2 + 0.5 * 2 * 0.4 ** 2; expect(pa).toBeCloseTo(1, 12); expect(ke).toBeCloseTo(0.18, 12);
    expect(JSON.stringify(p)).not.toMatch(/0\.19\d|0\.133|0\.433/);
  });
  it("AP-027 Chem: CH2 용 반전 문항 — 키 하나만 '높아지는' 오차(물 질량 과기록)", () => {
    const p = byNew.get("ap_chemistry-fx27-k0")!.payload; expect(p.stem).toContain("higher than the true value"); expect(optTexts(p)[p.key_index]).toContain("recorded water mass is 110 g");
    expect(p.options.filter((o: J) => /ΔH,? (is|are) too high/.test(o.why))).toHaveLength(1); expect(p.options.filter((o: J) => /ΔH,? (is|are) too low/.test(o.why))).toHaveLength(3);
  });
});

function erf(x: number) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

describe("교체안", () => {
  const gens: Record<string, ReturnType<(typeof SUBJ)["stats"]>> = {};
  for (const def of PLANS) {
    describe(def.file, () => {
      const file = `data/ap/stock/${def.file}`;
      it("파일 형식·원본·교체 수·교체 대상이 현재 구성(정확 배정 + 앞선 교체안)에 있다", () => {
        expect(existsSync(file)).toBe(true); const raw = rd(file); const plan = parseSwapPlan(raw);
        expect(plan.set).toBe(def.set); expect(plan.sourceSetName).toBe(def.name); expect(plan.sourceVersionNo).toBe(def.src); expect(plan.swaps).toHaveLength(def.swaps.length);
        const comp = compose(def.assign, def.set, def.basePlans); const slots = [...comp.mc.map((k, i) => ({ section: "ap_mc", position: i + 1, candidateKey: k })), ...comp.frq.map((k, i) => ({ section: "ap_frq", position: i + 1, candidateKey: k }))];
        expect(resolveSwaps(plan.swaps, slots).problems).toEqual([]);
      });
      it("교체 뒤 두 시험의 독립 검증기 위반이 늘지 않고, 추가 후보는 수정본이거나 같은 부류 재고다", () => {
        const g = (gens[def.subj] ??= SUBJ[def.subj]()); const r = buildPlan(def, g);
        expect(r.introduced).toEqual([]); expect(r.after).toEqual([]);
        const raw = rd(file); expect(raw.swaps.map((s: J) => [s.section, s.removeKey, s.addKey])).toEqual(r.swaps.map((s) => [s.section, s.removeKey, s.addKey]));
        for (const s of r.swaps) { expect(s.add.shared, s.addKey).toBe(s.remove.shared); expect(s.add.unit, s.addKey).toBe(s.remove.unit); }
        for (const s of def.swaps) if (s.addKey.startsWith(`${RUN}:`)) expect(byNew.has(s.addKey.slice(RUN.length + 1)), s.addKey).toBe(true);
      });
    });
  }
});
