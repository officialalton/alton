// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "../lib/ap-generation/data-fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { packApData } = require("./pack-ap-data.cjs") as { packApData: (root?: string) => { files: number; written: number } };

const root = fs.mkdtempSync(path.join(os.tmpdir(), "pack-"));
fs.mkdirSync(path.join(root, "data/ap/stock"), { recursive: true }); fs.mkdirSync(path.join(root, "data/ap/curriculum-2027"), { recursive: true });
fs.writeFileSync(path.join(root, "data/ap/stock/a.json"), JSON.stringify({ k: "값".repeat(100) }));
fs.writeFileSync(path.join(root, "data/ap/curriculum-2027/c.json"), "{}");
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("pack-ap-data", () => {
  it("writes .json.gz for the shim-read directories only, skips up-to-date files, and the shim can read the .gz alone", () => {
    expect(packApData(root)).toMatchObject({ files: 1, written: 1 });
    expect(fs.existsSync(path.join(root, "data/ap/curriculum-2027/c.json.gz"))).toBe(false);
    expect(packApData(root)).toMatchObject({ files: 1, written: 0 });
    const p = path.join(root, "data/ap/stock/a.json"); fs.rmSync(p);
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, "utf-8")).k).toBe("값".repeat(100));
  });
});
