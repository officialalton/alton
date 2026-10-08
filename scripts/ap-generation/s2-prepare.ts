// S2: 기존 후보(needs_revalidation 220) 소표본 LLM 재검증 준비. 과목별 run 디렉터리(s2-ab/s2-bio/s2-micro)와 표본 정의(s2-sample.json)를 만든다.
//   npx tsx scripts/ap-generation/s2-prepare.ts
// 표본 48 = 무작위(생존 163 중 층화) 28 + 의심 오탐 20(교정으로 복구된 22 중 12 + 교정 후에도 규칙 탈락한 35 중 8). 공유 자료 세트(3)는 파이프라인이 다루지 못해 제외.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { SAMPLE_PLAN } from "./cells";

const root = path.resolve("data/ap/sample-2027");
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const items = JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as Json[]; const byKey = new Map(items.map((i) => [i.stockKey as string, i]));
const nowFree = new Map((JSON.parse(readFileSync("data/ap/stock/revalidation-free.json", "utf-8")) as Json[]).map((r) => [r.stockKey as string, r]));
const before = new Map((JSON.parse(execFileSync("git", ["show", "4d72024e:data/ap/stock/revalidation-free.json"], { encoding: "utf-8", maxBuffer: 1 << 26 })) as Json[]).map((r) => [r.stockKey as string, r]));
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const keys = [...nowFree.keys()].filter((k) => byKey.get(k)!.structure !== "shared_stimulus_set"); // 공유 자료 세트 3건 제외
const surv = (k: string) => nowFree.get(k)!.survivor as boolean;
const recovered = keys.filter((k) => surv(k) && !before.get(k)!.survivor); const stillFail = keys.filter((k) => !surv(k)); const random = keys.filter((k) => surv(k) && before.get(k)!.survivor && byKey.get(k)!.structure !== "shared_stimulus_set");
const sub = (k: string) => byKey.get(k)!.apSubjectCode as string; const kind = (k: string) => byKey.get(k)!.kind as string;
const pick = (pool: string[], s: string, kd: string, n: number) => shuffle(pool.filter((k) => sub(k) === s && kind(k) === kd)).slice(0, n);
const ruleOf = (k: string) => (nowFree.get(k)!.fails.structure as string[])[0] ?? (nowFree.get(k)!.fails.computation as string[])[0] ?? "";
type Pick = { key: string; group: "random" | "recovered_fp" | "rule_fail"; stratum: string };
const picks: Pick[] = [];
const add = (g: Pick["group"], ks: string[]) => ks.forEach((k) => picks.push({ key: k, group: g, stratum: `${sub(k)}|${kind(k)}|${g === "rule_fail" ? ruleOf(k) : g}` }));
add("random", [...pick(random, "ap_calculus_ab", "mc", 8), ...pick(random, "ap_calculus_ab", "frq_bundle", 2), ...pick(random, "ap_biology", "mc", 8), ...pick(random, "ap_microeconomics", "mc", 10)]);
add("recovered_fp", [...pick(recovered, "ap_microeconomics", "frq_bundle", 3), ...pick(recovered, "ap_calculus_ab", "frq_bundle", 2), ...pick(recovered, "ap_biology", "mc", 2), ...pick(recovered, "ap_microeconomics", "mc", 2), ...pick(recovered, "ap_biology", "frq_bundle", 2), ...pick(recovered, "ap_calculus_ab", "mc", 1)]);
// 규칙 탈락은 사유별로 고르게(AB MC: 서로 다른 사유 우선)
const abFail = stillFail.filter((k) => sub(k) === "ap_calculus_ab" && kind(k) === "mc"); const byRule = new Map<string, string[]>(); for (const k of abFail) (byRule.get(ruleOf(k)) ?? byRule.set(ruleOf(k), []).get(ruleOf(k))!).push(k);
const abPick: string[] = []; for (let r = 0; abPick.length < 5 && r < 5; r++) for (const l of byRule.values()) if (abPick.length < 5 && shuffle(l)[r]) abPick.push(shuffle(l)[r]);
add("rule_fail", [...new Set(abPick)].slice(0, 5)); add("rule_fail", [...pick(stillFail, "ap_biology", "mc", 1), ...pick(stillFail, "ap_microeconomics", "frq_bundle", 2)]);
const uniq = new Map(picks.map((p) => [p.key, p])); const final = [...uniq.values()];
writeFileSync(path.join(root, "s2-sample.json"), JSON.stringify(final, null, 1));

function verify(code: string): { ok: boolean; out: Json | null; err: string } {
  if (!code.trim()) return { ok: false, out: null, err: "verification_code missing" };
  const r = spawnSync(PY, ["-c", code], { encoding: "utf-8", timeout: 40000, maxBuffer: 1 << 23 }); if (r.status !== 0) return { ok: false, out: null, err: (r.stderr ?? "").slice(-120) };
  const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? ""; try { return { ok: true, out: JSON.parse(line), err: "" }; } catch { return { ok: false, out: null, err: "no_json_output" }; }
}
const dirOf: Record<string, string> = { ap_calculus_ab: "s2-ab", ap_biology: "s2-bio", ap_microeconomics: "s2-micro" };
for (const [s, dir] of Object.entries(dirOf)) {
  const mine = final.filter((p) => sub(p.key) === s); const cells: Json[] = []; const packs: Record<string, Json[]> = {}; const extra: Record<string, string[]> = {}; const truth: Json = {};
  mine.forEach((p, n) => {
    const it = byKey.get(p.key)!; const pl = it.payload as Json; const cellId = `${dir}-${String(n + 1).padStart(2, "0")}`; const key = `${cellId}-k0`;
    cells.push({ cellId, archetype: "legacy", kind: it.kind, unitCode: it.unitCode, topic: it.keywordCode, skill: it.skillPrimary, calculator: it.calculator ?? pl.calculator_part ?? "na", candidates: 1, extraTopics: [] });
    const why: string[] = []; // 키 인덱스는 생성 뒤 보기 섞기로 바뀌었으므로 검증 코드 재실행 비교는 오탐이 된다(무료 검사에서 이미 수행) → 재실행하지 않는다
    if (it.kind === "mc") {
      packs[cellId] = [{ archetype: "legacy", topic: it.keywordCode, skill: it.skillPrimary, calculator: pl.calculator_part ?? it.calculator ?? "na", stem: pl.stem, stimulus: pl.stimulus ?? { kind: "none", description: "", data: {} }, options: (pl.options as string[]).map((t, i) => ({ text: String(t), why: (pl.option_rationale ?? [])[i] ?? null, value: null })), key_index: pl.key_index, est_seconds: pl.est_seconds, facts: [], explanation_en: pl.explanation_en }];
    } else {
      const stim = typeof pl.stimulus === "string" ? { kind: "text", description: pl.stimulus, data: {} } : pl.stimulus;
      packs[cellId] = [{ archetype: "legacy", template: pl.template ?? "", topic: it.keywordCode, skill: it.skillPrimary, calculator: pl.calculator_part ?? "na", title: pl.title ?? "", stimulus: stim, parts: (pl.parts as Json[]).map((x) => ({ ...x, skill_codes: x.skill_codes ?? [] })), total_points: pl.total_points, est_minutes: pl.est_minutes ?? 15, facts: [] }];
    }
    if (why.length) extra[key] = why; truth[key] = { stockKey: p.key, group: p.group, stratum: p.stratum, structure: it.structure };
  });
  mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, dir, "cells.json"), JSON.stringify(cells, null, 1)); writeFileSync(path.join(root, dir, "packs.json"), JSON.stringify(packs)); writeFileSync(path.join(root, dir, "extra_reasons.json"), JSON.stringify(extra, null, 1)); writeFileSync(path.join(root, dir, "truth.json"), JSON.stringify(truth, null, 1));
  console.log(`${dir}: ${cells.length}건(MC ${cells.filter((c) => c.kind === "mc").length}, FRQ ${cells.filter((c) => c.kind !== "mc").length}), 자체 검증 코드 불일치/오류 ${Object.keys(extra).length}`);
}
const g = (x: string) => final.filter((p) => p.group === x).length; console.log(`표본 ${final.length}: 무작위 ${g("random")}, 복구된 오탐 의심 ${g("recovered_fp")}, 교정 후에도 규칙 탈락 ${g("rule_fail")}`);
void SAMPLE_PLAN;
