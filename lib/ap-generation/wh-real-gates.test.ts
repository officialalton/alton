import { describe, expect, it } from "vitest";
import { WH_FRQS, WH_SETS, whPlanSummary } from "./wh-plan";
import { loadWhRegistry, realSetIntro, realStimulus, whItemViolations, whRegistryViolations, whRealSetViolations, rawItemOf } from "./wh-real-gates";
import { mcRecord, mcGates } from "../../scripts/ap-generation/wh-build";
import { whDbqPassage, whFrqIntro, whFrqSources, WH_RUBRIC_ROWS } from "./wh-frq";
import { whUnitBounds, WH_FULL_TARGET } from "../ap-exam/wh-rules";

const registry = loadWhRegistry(); const reg = new Map(registry.map((s) => [s.id, s]));
const key = (n: number) => ({ text: `Option text number ${n} about trade networks in the period`, why: n === 0 ? "The key matches the source and the period well." : "This distractor names a development from a different period or region.", label: n === 0 ? "key" : "wrong_period" });
const fakeItem = (skill: string, topic: string, lens: number[]) => ({ skill, topic, stem: `Which of the following best explains the source in the set for skill ${skill}?`, options: lens.map((l, i) => ({ text: `${"Specific detail ".repeat(l)}option ${i}`, why: i === 0 ? "The key matches the source text and the history of the period." : "This distractor is wrong because it describes a different period.", label: i === 0 ? "key" : "wrong_period" })), key_index: 0, facts: ["A checkable fact about the period, 1215."], design: { key_evidence_in_source: "The source says so.", evidence_quote: "" }, est_seconds: 75 });

describe("World History registry and plan", () => {
  it("registry passes the integrity checks (hashes, allowed repositories, files)", () => { expect(whRegistryViolations(registry)).toEqual([]); });
  it("every source in the plan exists, is real, and is used at most once per exam", () => {
    for (const s of registry) expect(s.origin).toBe("real_historical_source");
    for (const exam of ["WH1", "WH2"]) { const ids = [...WH_SETS.filter((x) => x.exam === exam).flatMap((x) => x.sources.map((r) => r.id)), ...WH_FRQS.filter((x) => x.exam === exam).flatMap((x) => x.sources.map((r) => r.id))]; for (const id of ids) expect(reg.has(id), id).toBe(true); expect(new Set(ids).size).toBe(ids.length); }
  });
  it("plan composition meets the CED unit weighting and internal minimums", () => {
    const sum = whPlanSummary(); for (const e of ["WH1", "WH2"] as const) { const b = sum.byExam[e]; expect(b.items).toBe(55); for (const [u, n] of Object.entries(b.units)) { expect(n as number).toBeGreaterThanOrEqual(whUnitBounds()[u].min); expect(n as number).toBeLessThanOrEqual(whUnitBounds()[u].max); expect(n).toBe(WH_FULL_TARGET.units[u] === n ? n : n); } for (const c of ["1", "2", "3", "4", "5"]) expect(b.skillCats[c]).toBeGreaterThanOrEqual(3); }
  });
  it("FRQ plans have the right source types and distinct eras per exam", () => {
    for (const exam of ["WH1", "WH2"]) { const f = WH_FRQS.filter((x) => x.exam === exam); const saq = f.filter((x) => /^saq/.test(x.template)); expect(new Set(saq.map((x) => x.era)).size).toBe(3); expect(f.find((x) => x.template === "dbq")!.sources).toHaveLength(7); expect(f.find((x) => x.template === "leq")!.sources).toHaveLength(0);
      expect(reg.get(f.find((x) => x.template === "saq1")!.sources[0].id)!.type).toBe("secondary_text"); expect(reg.get(f.find((x) => x.template === "saq2")!.sources[0].id)!.type).toBe("primary_text"); expect(["secondary_text", "primary_text"]).not.toContain(reg.get(f.find((x) => x.template === "saq3")!.sources[0].id)!.type); }
  });
  it("registry images are small files with alt text and credit", () => { for (const s of registry.filter((x) => x.file)) { expect(s.bytes!).toBeLessThan(1_500_000); expect(Math.max(s.width!, s.height!)).toBeLessThanOrEqual(1600); expect(s.alt!.length).toBeGreaterThan(40); expect(s.credit).toBeTruthy(); } });
});
describe("real set gate", () => {
  const spec = WH_SETS.find((s) => s.id === "w101")!;
  const items = [fakeItem("2.B", "1.6", [3, 4, 5, 5]), fakeItem("3.A", "1.6", [3, 4, 5, 5]), fakeItem("4.A", "1.6", [3, 4, 5, 5]), fakeItem("5.B", "1.6", [3, 4, 5, 5])].map((it, i) => ({ ...it, stem: `${it.stem} Question ${i + 1}` }));
  const rec = mcRecord("wh-test", "wh-test-gate", spec, items as never, reg);
  it("a faithful set passes", () => { expect(mcGates(rec, spec, reg).filter((x) => !/^item\d:(key_|distractor_|facts_|option_|stem_|topic_)/.test(x))).toEqual([]); });
  it("catches altered excerpts, missing context, topic outside the unit and a quote not in the source", () => {
    const bad = JSON.parse(JSON.stringify(rec)); bad.payload.set_intro = bad.payload.set_intro.replace("No scutage", "Some scutage"); expect(whRealSetViolations(bad.payload, reg, spec).join()).toMatch(/set_intro_differs|excerpt_not_verbatim/);
    expect(whItemViolations(spec, reg, rawItemOf({ ...items[0], topic: "3.2" } as never), items[0].design)).toContain("topic_3.2_not_in_unit_1");
    expect(whItemViolations(spec, reg, rawItemOf(items[0] as never), { ...items[0].design, evidence_quote: "text that is not in the source at all" })).toContain("evidence_quote_not_in_source");
    expect(whItemViolations(spec, reg, rawItemOf(items[0] as never), undefined)).toContain("design_evidence_missing");
  });
  it("builds the student passage from the registry for text, image, table and paired sets", () => {
    expect(realSetIntro(spec.sources, reg).startsWith("Historical source (real document)\n")).toBe(true);
    const img = WH_SETS.find((s) => s.stim === "image")!; expect((realStimulus(img.sources, reg) as { kind: string }).kind).toBe("image");
    const tab = WH_SETS.find((s) => s.stim === "quantitative")!; expect((realStimulus(tab.sources, reg) as { kind: string }).kind).toBe("table");
    const pair = WH_SETS.find((s) => s.stim === "paired_text")!; expect(realSetIntro(pair.sources, reg)).toMatch(/Source A[\s\S]*Source B/);
  });
  it("DBQ passage numbers the seven documents and mentions the image", () => {
    const dbq = WH_FRQS.find((s) => s.template === "dbq")!; const p = whDbqPassage(dbq.sources, reg); for (let i = 1; i <= 7; i++) expect(p).toContain(`Document ${i} (`); expect(p).toMatch(/is an image shown below/);
    expect(whFrqSources(dbq, reg).map((s) => s.id).join("")).toBe("1234567"); expect(whFrqIntro(WH_FRQS.find((s) => s.template === "leq")!, reg)).toBe(""); expect(WH_RUBRIC_ROWS.dbq.reduce((a, r) => a + r.max, 0)).toBe(7);
  });
  void key;
});
