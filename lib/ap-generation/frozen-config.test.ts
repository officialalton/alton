import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileSetHash, isRunValidForPromotion, verifyFrozen, type FrozenExpected } from "./frozen-config";

const exp: FrozenExpected = { generatorHash: "a", reviewerPromptHash: "b", difficultyPromptHash: "c", parserHash: "d", models: { review: "m1" }, flags: { flatReview: true, repair: false } };
describe("frozen config", () => {
  it("identical -> no mismatch", () => expect(verifyFrozen(exp, structuredClone(exp))).toEqual([]));
  it("detects hash, model and flag drift", () => {
    const bad = { ...structuredClone(exp), generatorHash: "x", models: { review: "m2" }, flags: { flatReview: false, repair: false } };
    expect(verifyFrozen(exp, bad).length).toBeGreaterThanOrEqual(3);
  });
  it("fileSetHash changes with content and flags missing files", () => {
    const a = fileSetHash(["f1"], () => Buffer.from("one")), b = fileSetHash(["f1"], () => Buffer.from("two"));
    expect(a).not.toBe(b); expect(fileSetHash(["f1"], () => null)).not.toBe(a);
  });
  it("invalid run is excluded from promotion", () => {
    expect(isRunValidForPromotion(path.resolve("data/ap/sample-2027/v8-bio-r"))).toBe(false);
  });
  it("tampered config aborts with exit 2 before any paid call", () => {
    const cfg = JSON.parse(readFileSync("config/ap-frozen/bio-data-short.v9.json", "utf-8"));
    cfg.expected.generatorHash = "tampered";
    const f = path.join(mkdtempSync(path.join(tmpdir(), "fz-")), "cfg.json"); writeFileSync(f, JSON.stringify(cfg));
    const r = spawnSync("npx", ["tsx", "scripts/ap-generation/run-frozen.ts", "--config", f, "--check-only"], { encoding: "utf-8" });
    expect(r.status).toBe(2); expect(r.stderr).toContain("ABORT");
  }, 120000);
});
