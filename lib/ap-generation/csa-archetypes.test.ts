import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gateCandidate } from "../ap-figures/gate";
import { planConversion } from "../ap-exam/convert";
import { AP_PYTHON as PY } from "../../scripts/ap-generation/py";
import { validateBlueprint, type Blueprint } from "./blueprint";
import { calibrateFrq, calibrateMc, gateMc, gateFrq, NOT_ASSESSED_MC, OPTION_COUNT, CSA_FRQ_PROFILE, type McPack, type FrqPack } from "./gates";
import { gateGuideMc, gateGuideFrq } from "./guide-gates";
import { generatorDefects } from "./generator-defects";
import { csaGuide, csaWordingRules } from "./subjects/csa";
import { setSizeOf } from "./stats-set";
import { subjectToolsConfig } from "../exam-tools/subject-tools";
import { AP_FRQ_DELIVERY } from "../ap-exam/frq-delivery";
import { apSectionLayout } from "../ap-exam/layouts";
import type { ApCurriculumFile } from "../ap-curriculum/types";

// AP Computer Science A P0 원형 테스트(무료: 네트워크·DB·LLM 없음, JDK 필요). 정답 실행·독립 Python 경로·결정성·코드 안전·범위 정수계획은 Python unittest(test_csa_p0.py)가 하고,
// 여기서는 TS 게이트·가이드 일관성·렌더 게이트·변환·도구 구성을 확인한다.
const SEEDS = Number(process.env.CSA_SEEDS ?? 2);
const ARCH = path.resolve(__dirname, "../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const haveJdk = havePy && spawnSync(PY, ["-B", "-c", "import csa_java as J,sys; sys.exit(0 if J.java_available() else 1)"], { cwd: ARCH, encoding: "utf-8" }).status === 0;
const d = haveJdk ? describe : describe.skip;
const curriculum = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/ap/curriculum-2027/ap_computer_science_a.json"), "utf-8")) as ApCurriculumFile;
const skills = new Set(curriculum.skills.map((s) => s.code));
const topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

type Pk = McPack & { blueprint: Partial<Blueprint>; items?: (McPack & { blueprint: Partial<Blueprint> })[] };
const expl = (p: McPack) => `The correct answer is ${p.options[p.key_index].text}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${x.text} is incorrect: ${x.why}`).join("\n");

d("AP Computer Science A P0 archetypes (Python generators run against the JDK, 2 seeds each)", () => {
  const code = "import json,registry as R\nn=R.CSA_STAGES['csa_mc_all']+R.CSA_STAGES['csa_sets']\nf=R.CSA_STAGES['csa_frq']\nprint(json.dumps({'names':n,'frq':f,'packs':{k:R.batch(k," + SEEDS + ",500) for k in n},'frqPacks':{k:R.batch(k,1,500) for k in f}}))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: 420000 });
  const out = (r.status === 0 ? JSON.parse(r.stdout) : { names: [], frq: [], packs: {}, frqPacks: {} }) as { names: string[]; frq: string[]; packs: Record<string, Pk[]>; frqPacks: Record<string, (FrqPack & { self_check_tests: unknown[]; blueprint: Partial<Blueprint> })[]> };
  const flat = (n: string) => out.packs[n].flatMap((p) => (p.items ?? [p]).map((q) => ({ ...q, stimulus: q.stimulus ?? p.stimulus, set_intro: (p as unknown as { set_intro?: string }).set_intro })));

  it("registers the singles and the two-item sets (4 original + 3 added for CS3 + 4 added for CS4/CS5), covers all 4 units, and the guide JSON lists the same ids", () => {
    expect(r.status).toBe(0);
    expect(out.names.filter((n) => n.startsWith("cs_")).length).toBeGreaterThanOrEqual(80);
    expect(out.names.filter((n) => n.startsWith("css_"))).toHaveLength(11);
    const ids = csaGuide.archetypes.map((a) => a.id).sort();
    const expected = out.names.flatMap((n) => flat(n).slice(0, out.packs[n][0].items ? 2 : 1).map((q) => q.archetype)).sort();
    expect(ids).toEqual(expected);
    const units = new Set(out.names.flatMap((n) => flat(n).map((q) => String(q.topic).split(".")[0])));
    expect([...units].sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("every MC pack passes the deterministic gates, the guide and the blueprint", () => {
    for (const n of out.names) for (const p of flat(n)) {
      const mp = { ...p, explanation_en: expl(p) } as McPack;
      const reasons = [...gateMc("ap_computer_science_a", mp), ...calibrateMc("ap_computer_science_a", mp), ...gateGuideMc(csaGuide, mp),
        ...validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code), ...generatorDefects(mp as unknown as Record<string, unknown>).map((x) => x.code)];
      expect({ n, reasons }).toEqual({ n, reasons: [] });
      expect(p.options).toHaveLength(OPTION_COUNT.ap_computer_science_a);
      expect(NOT_ASSESSED_MC.ap_computer_science_a ?? []).not.toContain(p.skill);
    }
  });

  it("code stimuli pass the render gate as text stimuli (no figure needed) and convert to bank items with a fenced code passage", () => {
    let withCode = 0, converted = 0;
    for (const n of out.names) for (const p of out.packs[n]) {
      const items = p.items ?? [p];
      const payload = { ...(p as unknown as Record<string, unknown>), ...(p.items ? { items: p.items.map((q) => ({ ...q, explanation_en: expl(q) })) } : { explanation_en: expl(p) }) };
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_computer_science_a", kind: "mc", payload });
      expect({ n, status: g.status, errors: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, status: "not_applicable", errors: [] });
      const plan = planConversion({ candidateKey: n, apSubjectCode: "ap_computer_science_a", kind: "mc", payload });
      expect({ n, ok: plan.ok, reason: plan.ok ? "" : plan.reason }).toEqual({ n, ok: true, reason: "" });
      if (plan.ok) {
        converted += plan.items.length;
        if (plan.items.some((it) => (it.passage ?? "").includes("```java"))) withCode++;
        expect(plan.items).toHaveLength(items.length);
        if (p.items) expect({ n, shared: plan.items.every((it) => (it.passage ?? "").includes("```java") && (it.passage ?? "").startsWith("Consider the following")) }).toEqual({ n, shared: true }); // 세트의 공통 코드가 학생 지문에 실린다
      }
    }
    expect(withCode).toBeGreaterThanOrEqual(60);
    expect(converted).toBeGreaterThanOrEqual(out.names.length);
  });

  it("registers the 4 official FRQ types (7/7/5/6 points, 25 total) and passes the FRQ gates", () => {
    const byTemplate: Record<string, number> = {};
    let total = 0;
    for (const n of out.frq) for (const p of out.frqPacks[n]) {
      byTemplate[p.template] = (byTemplate[p.template] ?? 0) + 1;
      expect(p.total_points).toBe(CSA_FRQ_PROFILE[p.template].points);
      expect(validateBlueprint(p.blueprint, { skills, topicUnit: topicUnit as Map<string, string> }).map((x) => x.code)).toEqual([]);
      expect(gateGuideFrq(csaGuide, p)).toEqual([]);
      expect({ n, reasons: [...gateFrq("ap_computer_science_a", p, skills, { requirePartTopics: false }), ...calibrateFrq(p, "ap_computer_science_a")] }).toEqual({ n, reasons: [] });
      expect(p.self_check_tests.length).toBeGreaterThanOrEqual(6);
      const g = gateCandidate({ candidateKey: n, apSubjectCode: "ap_computer_science_a", kind: "frq", payload: p as unknown as Record<string, unknown> });
      expect({ n, errors: g.issues.filter((i) => i.level === "error").map((i) => i.code) }).toEqual({ n, errors: [] });
      const plan = planConversion({ candidateKey: n, apSubjectCode: "ap_computer_science_a", kind: "frq", payload: p as unknown as Record<string, unknown> });
      expect(plan.ok).toBe(true);
      if (plan.ok) expect((plan.items[0].statements as { mode: string }[]).every((s) => s.mode === "code")).toBe(true);
    }
    expect(byTemplate).toEqual({ q1: 4, q2: 4, q3: 4, q4: 4 });
    for (const t of ["q1", "q2", "q3", "q4"]) total += out.frqPacks[out.frq.find((n) => out.frqPacks[n][0].template === t)!][0].total_points;
    expect(total).toBe(25);
    expect(csaGuide.frqTemplates.map((t) => t.id).sort()).toEqual([...out.frq].sort());
  });

  it("the Python suite (JDK harness safety, determinism, independent-path rejection, screen-code re-execution, FRQ verification, skill/unit range ILP) passes", () => {
    const t = spawnSync(PY, ["-B", "-m", "unittest", "test_csa_p0"], { cwd: ARCH, encoding: "utf-8", timeout: 590000 });
    expect({ status: t.status, tail: (t.stderr || "").split("\n").slice(-6).join("\n") }).toEqual({ status: 0, tail: expect.stringContaining("OK") });
  }, 600000);
});

describe("csaGuide and exam configuration", () => {
  it("lists 4 units whose MC weights bracket 100 percent and the 12 CED skill codes", () => {
    expect(csaGuide.units).toHaveLength(4);
    expect(csaGuide.units.reduce((a, u) => a + u.mcWeight[0], 0)).toBeLessThanOrEqual(100);
    expect(csaGuide.units.reduce((a, u) => a + u.mcWeight[1], 0)).toBeGreaterThanOrEqual(100);
    expect(csaGuide.skills.map((s) => s.code)).toEqual([...skills]);
    expect(csaGuide.units.find((u) => u.unit === "4")?.mcWeight).toEqual([30, 40]);
    expect(csaGuide.units.find((u) => u.unit === "3")?.mcWeight).toEqual([10, 18]);
  });
  it("is a fully digital subject: typed FRQ, two-item sets, 42 MC + 4 FRQ, no calculator, a Java reference panel", () => {
    expect(AP_FRQ_DELIVERY.ap_computer_science_a).toBe("digital");
    expect(setSizeOf("ap_computer_science_a")).toBe(2);
    expect(subjectToolsConfig("ap_computer_science_a")).toEqual({ calculatorTabs: [], reference: "java" });
    const layout = apSectionLayout("ap_computer_science_a");
    expect(layout.map((s) => [s.kind, s.count, s.minutes])).toEqual([["mc", 42, 90], ["frq", 4, 90]]);
    expect(layout.every((s) => s.calculator === "na")).toBe(true);
  });
  it("wording rules mention the code-safety notation and the 9-point FRQ structure", () => {
    const w = csaWordingRules();
    expect(w).toMatch(/fenced code block/);
    expect(w).toMatch(/7\/7\/5\/6 points/);
  });
});
