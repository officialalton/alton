// AP Statistics 원형 무료 사전 점검(LLM·DB·네트워크 없음, 디스크 무변경): 원형별 후보 팩 n 개에 결정적 게이트·설계도·그림 게이트·생성기 결함·look-alike(전체 재고 + 이번 배치)를 돌린다.
//   npx tsx scripts/ap-generation/stats-precheck.ts --list stats_s1_all [--seed0 7000] [--n 3] [--svg-dir <경로>]
// --svg-dir: 렌더한 그림(SVG/HTML)을 그 폴더에 쓴다(렌더 눈 검수용; 저장소 밖 경로 권장).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { lookAlikeReason } from "../../lib/ap-exam/look-alike";
import { calibrateMc, gateMc, gateNoCalcExact, wordingPreserves, type McPack } from "../../lib/ap-generation/gates";
import { answerTextForExplanation, gateMathWrapping } from "../../lib/ap-generation/math-wrapping";
import { gateGuideMc } from "../../lib/ap-generation/guide-gates";
import { statsGuide } from "../../lib/ap-generation/subjects/stats";
import { flattenSet, gateStatsSet, isSetPack } from "../../lib/ap-generation/stats-set";
import { validateBlueprint, type Blueprint } from "../../lib/ap-generation/blueprint";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { AP_PYTHON as PY } from "./py";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIST = arg("--list", "stats_s1_all"), SEED0 = Number(arg("--seed0", "7000")), N = Number(arg("--n", "3")), SVG = arg("--svg-dir", "");
const SUBJECT = "ap_statistics";
const ARCH = path.resolve("scripts/ap-generation/archetypes");
const py = (a: string[]): unknown => { const r = spawnSync(PY, ["-B", "registry.py", ...a], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr.slice(-400)); return JSON.parse(r.stdout); };
const curriculum = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const skillSet = new Set(curriculum.skills.map((s) => s.code)), topicUnit = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));
const expl = (p: McPack) => `The correct answer is ${answerTextForExplanation(p.options[p.key_index].text)}. ${p.options[p.key_index].why}\n` + p.options.filter((_, i) => i !== p.key_index).map((x) => `${answerTextForExplanation(x.text)} is incorrect: ${x.why}`).join("\n");

// look-alike 기준: 기존 재고 전체(모든 과목 MC)
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; itemFamilyId: string; payload: Record<string, unknown>; duplicateOf?: string | null };
const P = (r: { payload: Record<string, unknown> }) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const files = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items"];
const raws = files.flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Raw[]).filter((i) => i.validation === "auto_passed" && !i.duplicateOf && i.kind === "mc");
const stockIn = raws.map((i) => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking }));

const names = (py(["list", LIST]) as { mc: string[] }).mc;
const rows: { name: string; seed: number; reasons: string[]; fig: string; need: string; pack: Record<string, unknown>; lens: string }[] = [];
if (SVG) mkdirSync(SVG, { recursive: true });
for (const n of names) {
  const packs = py(["batch", n, String(N), String(SEED0)]) as Record<string, unknown>[];
  if (!packs.length) { rows.push({ name: n, seed: -1, reasons: ["no_pack"], fig: "-", need: "-", pack: {}, lens: "" }); continue; }
  for (const sp of packs) {
    const setReasons = isSetPack(sp) ? gateStatsSet(sp) : [];
    const members = isSetPack(sp) ? flattenSet(sp, `${n}-s${sp.seed}`).map((m) => ({ ...(m as unknown as Record<string, unknown>), seed: sp.seed, set_reasons: setReasons, member_key: `${n}-s${sp.seed}-q${m.set.index + 1}` })) : [{ ...sp, set_reasons: [] as string[], member_key: `${n}-s${sp.seed}` }];
    for (const p of members as Record<string, unknown>[]) {
      const mp = { ...(p as unknown as McPack) }; mp.explanation_en = expl(mp);
      const reasons = [...gateMc(SUBJECT, mp), ...calibrateMc(SUBJECT, mp), ...gateGuideMc(statsGuide, mp), ...gateNoCalcExact(mp), ...gateMathWrapping(mp), ...(p.set_reasons as string[])];
      reasons.push(...validateBlueprint(p.blueprint as Partial<Blueprint>, { skills: skillSet, topicUnit: topicUnit as Map<string, string> }).map((x) => `blueprint:${x.code}`));
      reasons.push(...generatorDefects(mp as unknown as Record<string, unknown>).map((d) => `generator_defect:${d.code}`));
      reasons.push(...wordingPreserves(mp.stem, mp.stem));
      const g = gateCandidate({ stockKey: `new:${p.member_key}`, candidateKey: `new:${p.member_key}`, apSubjectCode: SUBJECT, kind: "mc", payload: { ...p, stimulus: p.stimulus } as Record<string, unknown> });
      for (const i of g.issues) if (i.level === "error") reasons.push(`figure:${i.code}`);
      if (g.status === "fail") reasons.push("figure_status_fail");
      if (SVG && g.output) writeFileSync(path.join(SVG, `${p.member_key}.${g.output.startsWith("<svg") ? "svg" : "html"}`), g.output.startsWith("<svg") ? g.output : `<!doctype html><meta charset="utf-8"><body style="font-family:Georgia;margin:16px">${g.output}`);
      const lens = mp.options.map((o) => o.text.replace(/\$/g, "").length);
      rows.push({ name: String(p.member_key), seed: Number(p.seed), reasons: [...new Set(reasons)], fig: `${g.status}/${g.stimKind}${g.issues.filter((i) => i.level === "warn").length ? "+" + g.issues.filter((i) => i.level === "warn").map((i) => i.code).join(",") : ""}`, need: g.need, pack: p, lens: lens.join("/") });
    }
  }
}
const newIn = rows.filter((r) => r.pack.stem).map((r) => ({ key: `new:${r.name}:${r.seed}`, family: `new:${(r.pack.set as { base?: string } | undefined)?.base ?? String(r.pack.archetype)}`, archetype: String(r.pack.archetype), topic: String(r.pack.topic), stimKind: String((r.pack.stimulus as { kind?: string })?.kind ?? "none"), stem: String(r.pack.stem), thinking: ((r.pack.blueprint as Blueprint | undefined)?.student_thinking) }));
const hits: string[] = [];
for (const a of newIn) for (const b of [...stockIn, ...newIn]) { if (a.key === b.key || (b.key.startsWith("new:") && b.key < a.key) || (a.family === b.family)) continue; const r = lookAlikeReason(a, b); if (r) hits.push(`${a.key} ~ ${b.key} (${r})`); }
let ok = 0;
for (const r of rows) { const bad = r.reasons.length > 0 || hits.some((h) => h.startsWith(`new:${r.name}:${r.seed} `) || h.includes(`~ new:${r.name}:${r.seed} `)); if (!bad) ok++; console.log(`${bad ? "FAIL" : "ok  "} ${r.name.padEnd(26)} s${String(r.seed).padEnd(6)} ${String(r.pack.topic ?? "").padEnd(5)} ${String(r.pack.skill ?? "").padEnd(4)} fig=${r.fig.padEnd(26)} need=${r.need.padEnd(10)} len=${r.lens.padEnd(14)} ${r.reasons.join(",")}`); }
console.log(`packs ${rows.length}, clean ${ok}, archetypes ${names.length}`);
if (hits.length) console.log("look-alike hits:\n" + hits.join("\n"));
