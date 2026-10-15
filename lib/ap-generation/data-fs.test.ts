// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "./data-fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "datafs-"));
const dir = path.join(tmp, "data", "ap", "stock"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "only-gz.json.gz"), zlib.gzipSync(JSON.stringify({ a: "한글" })));
fs.writeFileSync(path.join(dir, "both.json"), JSON.stringify({ src: "plain" })); fs.writeFileSync(path.join(dir, "both.json.gz"), zlib.gzipSync(JSON.stringify({ src: "gz" })));
fs.writeFileSync(path.join(dir, "plain.json"), JSON.stringify({ p: 1 }));
fs.mkdirSync(path.join(tmp, "other"), { recursive: true }); fs.writeFileSync(path.join(tmp, "other", "x.json.gz"), zlib.gzipSync("{}"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("data-fs: .json.gz fallback for data/ap files (the /admin bundle ships only .gz)", () => {
  it("reads a file that exists only as .gz, as utf-8 text or a Buffer", () => {
    const p = path.join(dir, "only-gz.json");
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, "utf-8"))).toEqual({ a: "한글" });
    expect(Buffer.isBuffer(readFileSync(p))).toBe(true);
  });
  it("prefers the plain original when both exist, and passes through plain files", () => {
    expect(JSON.parse(readFileSync(path.join(dir, "both.json"), "utf-8"))).toEqual({ src: "plain" });
    expect(JSON.parse(readFileSync(path.join(dir, "plain.json"), { encoding: "utf-8" }))).toEqual({ p: 1 });
  });
  it("lists .json.gz as .json without duplicates", () => {
    expect(readdirSync(dir).sort()).toEqual(["both.json", "only-gz.json", "plain.json"]);
  });
  it("does not rewrite anything outside data/ap", () => {
    const p = path.join(tmp, "other", "x.json");
    expect(existsSync(p)).toBe(false);
    expect(() => readFileSync(p, "utf-8")).toThrow();
    expect(readdirSync(path.join(tmp, "other"))).toEqual(["x.json.gz"]);
  });
});
