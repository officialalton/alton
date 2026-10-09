// 무료(LLM 없음): 데이터형 원형의 결정적 검사를 시드 범위에 돌리고, 저장된 번들(v8/v9)에 같은 설계 검사를 적용한다. npx tsx scripts/ap-generation/bio-data-free-check.ts [n] [seed0]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gateBioFrq } from "../../lib/ap-generation/bio-frq-checks";
import { bioDataShortDesignChecks } from "../../lib/ap-generation/archetype-checks/bio-data-short";
import { bundleReferenceChecks } from "../../lib/ap-generation/part-refine";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
const PY = process.env.AP_PY ?? "python3";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const n = Number(process.argv[2] ?? 100), seed = Number(process.argv[3] ?? 3000);
const cur = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_biology.json", "utf-8")) as ApCurriculumFile; const topics = new Set(cur.units.flatMap((u) => u.topics.map((t) => t.code)));
const check = (p: Json) => [...gateBioFrq(p, { topics }), ...bioDataShortDesignChecks(p), ...bundleReferenceChecks(p as never)].map((x: Json) => x.code);
const many = JSON.parse(execFileSync(PY, ["-B", "registry.py", "batch", "frq_bio_data_short", String(n), String(seed)], { cwd: "scripts/ap-generation/archetypes", encoding: "utf-8", maxBuffer: 1 << 29 })) as Json[];
const bad = many.map((p, i) => [seed + i, check(p)] as const).filter(([, c]) => c.length);
console.log(`신규 시드 ${n}개(${seed}~): 실패 ${bad.length}`, JSON.stringify(bad.slice(0, 5)));
for (const run of ["v8-bio", "v9-bio"]) { const packs = (JSON.parse(readFileSync(`data/ap/sample-2027/${run}/packs.json`, "utf-8")) as Json)["ap_biology-f01"] as Json[]; packs.forEach((x, i) => { const pk = x.pack ?? x; console.log(run, i, pk.context, "방향 불일치:", check(pk).filter((c) => c.includes("temp_direction")).length ? "있음" : "없음"); }); }
