// AP Statistics FRQ 원형 무료 사전 점검(LLM·DB·네트워크 없음): 유형별 후보 팩 n 개에 결정적 게이트·설계도·번들 일관성·그림 게이트·FRQ 설계 검사를 돌린다.
//   npx tsx scripts/ap-generation/stats-frq-precheck.ts [--list stats_s2a_frq] [--seed0 8000] [--n 3]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { calibrateFrq, gateFrq, type FrqPack } from "../../lib/ap-generation/gates";
import { gateMathWrapping } from "../../lib/ap-generation/math-wrapping";
import { gateGuideFrq } from "../../lib/ap-generation/guide-gates";
import { statsGuide } from "../../lib/ap-generation/subjects/stats";
import { validateBlueprint, type Blueprint } from "../../lib/ap-generation/blueprint";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { bundleReferenceChecks } from "../../lib/ap-generation/part-refine";
import { gateStatsFrq } from "../../lib/ap-generation/stats-frq-checks";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { AP_PYTHON as PY } from "./py";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIST = arg("--list", "stats_s2a_frq"), SEED0 = Number(arg("--seed0", "8000")), N = Number(arg("--n", "3"));
const SUBJECT = "ap_statistics";
const ARCH = path.resolve("scripts/ap-generation/archetypes");
const py = (a: string[]): unknown => { const r = spawnSync(PY, ["-B", "registry.py", ...a], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr.slice(-400)); return JSON.parse(r.stdout); };
const curriculum = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const skillSet = new Set(curriculum.skills.map((s) => s.code)), topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const names = (py(["list", LIST]) as { frq: string[] }).frq;
let ok = 0, total = 0;
for (const n of names) {
  const packs = py(["batch", n, String(N), String(SEED0)]) as unknown as (FrqPack & { seed: number; blueprint: Partial<Blueprint> })[];
  if (!packs.length) { console.log(`FAIL ${n} no_pack`); total++; continue; }
  for (const p of packs) {
    total++;
    const reasons = [...gateFrq(SUBJECT, p, skillSet, { requirePartTopics: true, topics: new Set(topicUnit.keys()) }), ...calibrateFrq(p, SUBJECT), ...gateGuideFrq(statsGuide, p), ...gateMathWrapping(p as never), ...gateStatsFrq(p), ...bundleReferenceChecks(p).map((x) => `bundle_ref:${x}`)];
    reasons.push(...validateBlueprint(p.blueprint, { skills: skillSet, topicUnit: topicUnit as Map<string, string> }).map((x) => `blueprint:${x.code}`));
    reasons.push(...generatorDefects(p as unknown as Record<string, unknown>).map((d) => `generator_defect:${d.code}`));
    const g = gateCandidate({ stockKey: `new:${n}:${p.seed}`, candidateKey: `new:${n}:${p.seed}`, apSubjectCode: SUBJECT, kind: "frq_bundle", payload: p as unknown as Record<string, unknown> });
    for (const i of g.issues) if (i.level === "error") reasons.push(`figure:${i.code}`);
    if (g.status === "fail") reasons.push("figure_status_fail");
    const bad = [...new Set(reasons)];
    if (!bad.length) ok++;
    console.log(`${bad.length ? "FAIL" : "ok  "} ${n.padEnd(22)} s${String(p.seed).padEnd(6)} topic=${p.topic} skill=${p.skill} rows=${p.parts.reduce((a, x) => a + x.rubric_rows.length, 0)} fig=${g.status}/${g.stimKind} ${bad.join(",")}`);
  }
}
console.log(`packs ${total}, clean ${ok}, archetypes ${names.length}`);
