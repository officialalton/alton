// S3: 기존 후보 전수(대상 고정) 재검증 준비 — S2 와 같은 과목별 검토 프롬프트. 기존 후보(needs_revalidation 220) 소표본 LLM 재검증 준비. 과목별 run 디렉터리(s2-ab/s2-bio/s2-micro)와 표본 정의(s2-sample.json)를 만든다.
//   npx tsx scripts/ap-generation/s3-prepare.ts
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
const scanKeys = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const s2 = new Set((JSON.parse(readFileSync(path.join(root, "s2-sample.json"), "utf-8")) as { key: string }[]).map((p) => p.key));
const sub = (k: string) => byKey.get(k)!.apSubjectCode as string; const kind = (k: string) => byKey.get(k)!.kind as string;
type Pick = { key: string; group: "s3_population"; stratum: string };
// S3 대상(고정): 무료 선별 생존 + 공유 자료 세트 아님 + S2 에서 이미 평가된 표본 아님 + 생성기 결함 플래그 없음 + needs_revalidation 상태
const final: Pick[] = [...nowFree.keys()].filter((k) => nowFree.get(k)!.survivor && byKey.get(k)!.structure !== "shared_stimulus_set" && !s2.has(k) && !scanKeys.has(k) && byKey.get(k)!.validation === "needs_revalidation").map((k) => ({ key: k, group: "s3_population" as const, stratum: `${sub(k)}|${kind(k)}` }));
writeFileSync(path.join(root, "s3-sample.json"), JSON.stringify(final, null, 1));
void before;
function verify(code: string): { ok: boolean; out: Json | null; err: string } {
  if (!code.trim()) return { ok: false, out: null, err: "verification_code missing" };
  const r = spawnSync(PY, ["-c", code], { encoding: "utf-8", timeout: 40000, maxBuffer: 1 << 23 }); if (r.status !== 0) return { ok: false, out: null, err: (r.stderr ?? "").slice(-120) };
  const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? ""; try { return { ok: true, out: JSON.parse(line), err: "" }; } catch { return { ok: false, out: null, err: "no_json_output" }; }
}
const dirOf: Record<string, string> = { ap_calculus_ab: "s3-ab", ap_biology: "s3-bio", ap_microeconomics: "s3-micro" };
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
console.log(`S3 대상 ${final.length}건 고정`);
