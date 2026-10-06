import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
it("p", () => { const id = process.env.PID!; const a = figureArchetypes().find((x) => x.id === id)!; let out = ""; for (const s of (process.env.PSEEDS ?? "0,1,2").split(",").map(Number)) { const g = generateOne(a, s); out += JSON.stringify(g.ok ? { stim: g.inst.stimulus, q: g.inst.question, opts: g.inst.options, ans: g.inst.correctIndex } : g, null, 1) + "\n"; } writeFileSync(process.env.POUT!, out); });
