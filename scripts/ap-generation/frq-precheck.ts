// FRQ 원형 무료 사전 점검(LLM·DB 없음): npx tsx scripts/ap-generation/frq-precheck.ts --name frq_polar_region --subject ap_calculus_bc [--seed0 3900]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { calibrateFrq, gateFrq, type FrqPack } from "../../lib/ap-generation/gates";
import { gateGuideFrq } from "../../lib/ap-generation/guide-gates";
import { bundleReferenceChecks } from "../../lib/ap-generation/part-refine";
import { GUIDES } from "../../lib/ap-generation/subjects/calc-bc";
import { validateBlueprint, type Blueprint } from "../../lib/ap-generation/blueprint";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg("--name"); const SUBJECT = arg("--subject", "ap_calculus_bc"); const SEED0 = arg("--seed0", "3900");
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const r = spawnSync(PY, ["-B", "registry.py", "batch", NAME, "1", SEED0], { cwd: path.resolve("scripts/ap-generation/archetypes"), encoding: "utf-8" });
const p = (JSON.parse(r.stdout) as FrqPack[])[0];
const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const skills = new Set(cur.skills.map((s) => s.code)); const topics = new Map(cur.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const reasons = [...gateFrq(SUBJECT, p, skills, { topics: new Set(topics.keys()) }), ...calibrateFrq(p, SUBJECT), ...gateGuideFrq(GUIDES[SUBJECT as keyof typeof GUIDES] as never, p), ...bundleReferenceChecks(p),
  ...validateBlueprint((p as unknown as { blueprint: Partial<Blueprint> }).blueprint, { skills, topicUnit: topics as Map<string, string> }).map((x) => `blueprint:${x.code}`), ...generatorDefects(p as unknown as Record<string, unknown>).map((d) => `generator_defect:${d.code}`)];
console.log(NAME, reasons.length ? "FAIL " + reasons.join(",") : "ok");
