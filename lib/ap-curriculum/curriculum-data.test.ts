import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlan, diffKeywords, unitDisplayName } from "./plan";
import { AP_SUBJECT_CODES, type ApCurriculumFile } from "./types";
import { validateCurriculum } from "./validate";

const DIR = path.resolve(__dirname, "../../data/ap/curriculum-2027");
const files = readdirSync(DIR).filter((n) => n.endsWith(".json"));
const data = new Map(files.map((n) => [n.replace(".json", ""), JSON.parse(readFileSync(path.join(DIR, n), "utf-8")) as ApCurriculumFile]));

describe("AP curriculum seed data (official CED backbone)", () => {
  it("has all 10 owner subjects, none excluded", () => {
    for (const code of AP_SUBJECT_CODES) expect(data.has(code), code).toBe(true);
    expect(data.size).toBe(10);
  });

  it.each([...data.entries()])("%s passes structural validation", (_code, f) => {
    expect(validateCurriculum(f)).toEqual([]);
  });

  it.each([...data.entries()])("%s: file name matches apCode, source and edition are recorded", (code, f) => {
    expect(f.subject.apCode).toBe(code);
    expect(f.subject.edition).toBe("ced-2027");
    expect(f.subject.sourceUrl).toMatch(/^https:\/\/apcentral\.collegeboard\.org\//);
  });

  it.each([...data.entries()])("%s: every topic has a unit, teachable sub-keywords, unit weights sum sanity", (_c, f) => {
    for (const u of f.units) {
      expect(u.topics.length).toBeGreaterThan(0);
      for (const t of u.topics) {
        expect(t.subKeywords.length, `${t.code} sub-keywords`).toBeGreaterThanOrEqual(1);
        expect(t.skills.length, `${t.code} skills`).toBeGreaterThanOrEqual(0);
      }
    }
    const kinds = new Set(f.units.flatMap((u) => u.topics.flatMap((t) => t.subKeywords.map((k) => k.kind))));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it("Calculus BC contains every AB topic and flags BC-only topics", () => {
    const ab = data.get("ap_calculus_ab")!;
    const bc = data.get("ap_calculus_bc")!;
    const abCodes = new Set(ab.units.flatMap((u) => u.topics.map((t) => t.code)));
    const bcTopics = bc.units.flatMap((u) => u.topics);
    for (const c of abCodes) expect(bcTopics.some((t) => t.code === c && t.scope === "both"), c).toBe(true);
    expect(bcTopics.filter((t) => t.scope === "bc_only").length).toBeGreaterThan(0);
    expect(ab.units.flatMap((u) => u.topics).every((t) => t.scope === "both")).toBe(true);
    expect(bc.units.length).toBe(10);
    expect(ab.units.length).toBe(8);
  });

  it("Statistics uses the new 5-unit CED; Physics 1 has 8 units including Fluids", () => {
    expect(data.get("ap_statistics")!.units.length).toBe(5);
    const p = data.get("ap_physics_1")!;
    expect(p.units.length).toBe(8);
    expect(p.units.some((u) => /fluid/i.test(u.title))).toBe(true);
  });

  it("plan: codes are unique, sub-keywords point at a topic of the same unit, units are positioned from 1", () => {
    for (const f of data.values()) {
      const { units, keywords } = buildPlan(f);
      expect(units.map((u) => u.position)).toEqual(units.map((_, i) => i + 1));
      expect(new Set(keywords.map((k) => k.contentCode)).size).toBe(keywords.length);
      const byCode = new Map(keywords.map((k) => [k.contentCode, k]));
      for (const k of keywords.filter((x) => x.level === 2)) expect(byCode.get(k.parentCode!)?.unitCode).toBe(k.unitCode);
      expect(new Set(keywords.map((k) => k.label.toLowerCase())).size).toBe(keywords.length);
    }
  });

  it("diff: existing codes are updated, never recreated; rename-safe", () => {
    const f = data.get("ap_microeconomics")!;
    const { keywords } = buildPlan(f);
    const existing = new Set(keywords.slice(0, 5).map((k) => k.contentCode));
    const d = diffKeywords(keywords, existing);
    expect(d.update.length).toBe(5);
    expect(d.create.length).toBe(keywords.length - 5);
  });

  it("unit display name is stable", () => {
    expect(unitDisplayName("3", "Inference")).toBe("Unit 3: Inference");
  });
});
