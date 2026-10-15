import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlan } from "./plan";
import { buildLessonPlan } from "./lessons";
import { buildSeedPayload, generateRollbackSql, generateSeedSql, generateVerifySql } from "./seed-sql";
import type { ApCurriculumFile } from "./types";

const load = (c: string) => JSON.parse(readFileSync(path.resolve(__dirname, `../../data/ap/curriculum-2027/${c}.json`), "utf-8")) as ApCurriculumFile;
const f = load("ap_psychology");

describe("seed-sql generator", () => {
  it("payload matches seed.ts planning functions", () => {
    const p = buildSeedPayload(f);
    const plan = buildPlan(f);
    const lessons = buildLessonPlan(f, { track: "compact" });
    expect(p.keywords).toEqual(plan.keywords);
    expect(p.units).toHaveLength(plan.units.length);
    expect(p.lessons.map((l) => l.code)).toEqual(lessons.map((l) => l.code));
    expect(p.lessons.every((l) => l.scheduledMinutes === 120)).toBe(true);
  });
  it("is one transaction, additive and deterministic", () => {
    const sql = generateSeedSql(f);
    expect(sql.startsWith("-- ")).toBe(true);
    expect(sql).toMatch(/\nbegin;\ndo \$do\$/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).not.toMatch(/\bdrop table\b|\btruncate\b/i);
    expect(sql).toContain("ap_subject_code 충돌");
    expect(generateSeedSql(f)).toBe(sql);
  });
  it("never embeds keys", () => {
    expect(generateSeedSql(f)).not.toMatch(/service_role|SERVICE_ROLE|sb_secret|eyJ/);
  });
  it("full track sets scheduled minutes to lesson length", () => {
    const p = buildSeedPayload(f, "full");
    expect(p.lessons.every((l) => l.scheduledMinutes === l.estMinutes)).toBe(true);
  });
  it("verify + rollback reference the subject code", () => {
    expect(generateVerifySql(f)).toContain("ap_psychology");
    expect(generateRollbackSql(f)).toContain("delete from subjects where ap_subject_code = 'ap_psychology'");
  });
});
