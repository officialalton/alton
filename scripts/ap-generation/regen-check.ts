// 재생성 일치 검사(코드 우선 문항 전용, 결정적): 보관된 문항의 자료(stimulus)·키·보기 값이 같은 원형·같은 시드로 코드가 다시 만든 결과와 같은지 본다.
// 렌더가 되는가와 자료가 정확한가를 분리하는 검사: 표/그래프 자료가 변조되거나 생성기 버그로 어긋나면 풀이에 쓰이지 않는 칸이어도 잡힌다.
//   npx tsx scripts/ap-generation/regen-check.ts [--inject]    # --inject: 새 변조 사례(표 칸 값 변경 12)로 탐지율 측정
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const ARCH = path.resolve("scripts/ap-generation/archetypes");
const regen = (arch: string, seed: number): Json | null => { const r = spawnSync(PY, ["-B", "registry.py", "batch", arch, "1", String(seed)], { cwd: ARCH, encoding: "utf-8", timeout: 60000, maxBuffer: 1 << 26 }); if (r.status !== 0) return null; try { return (JSON.parse(r.stdout) as Json[])[0]; } catch { return null; } };
const canon = (v: unknown): unknown => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Json).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)])) : v);
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
export function regenIssues(p: Json): string[] | null {
  const m = String(p.pack_id ?? "").match(/^(.*)-s(\d+)$/); if (!m || !p.archetype) return null; const g = regen(p.archetype, Number(m[2])); if (!g) return ["regen_failed"];
  const r: string[] = []; if (!same(g.stimulus?.data, p.stimulus?.data)) r.push("stimulus_data_differs_from_regeneration"); if (g.key_index !== p.key_index) r.push("key_differs_from_regeneration");
  if (JSON.stringify((g.options ?? []).map((o: Json) => o.value)) !== JSON.stringify((p.options ?? []).map((o: Json) => o.value))) r.push("option_values_differ_from_regeneration"); return r;
}
if (require.main === module) {
  const items = [...JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")), ...JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8"))] as Json[];
  const code = items.filter((i) => i.pipeline === "code_first_v2" && i.kind === "mc" && i.validation !== "rejected" && i.payload.pack_id);
  let bad = 0, n = 0; const flagged: string[] = []; for (const i of code) { const r = regenIssues(i.payload); if (r === null) continue; n++; if (r.length) { bad++; flagged.push(`${i.stockKey}:${r.join(",")}`); } }
  console.log(`코드 우선 MC ${code.length}개 중 검사 ${n}, 재생성 불일치 ${bad}`, flagged.slice(0, 8));
  if (process.argv.includes("--inject")) {
    const truth = JSON.parse(readFileSync("data/ap/sample-2027/s1c-fig2/truth.json", "utf-8")) as Record<string, Json>; const byKey = new Map(items.map((i) => [i.stockKey as string, i]));
    let det = 0, tested = 0, noArch = 0; for (const t of Object.values(truth)) { if (t.defect === "none") continue; const it = byKey.get(t.source); if (!it) continue; const p = JSON.parse(JSON.stringify(it.payload)) as Json; const rows = p.stimulus?.data?.rows; const mc = t.mutatedCell as Json; if (!rows || !mc) continue; if (!p.pack_id) { noArch++; continue; } rows[mc.row][mc.col] = mc.to; tested++; if ((regenIssues(p) ?? []).length) det++; }
    console.log(`표 칸 값 변조(새 사례 12 중 코드 우선 ${tested}, 레거시(재생성 불가) ${noArch}): 재생성 불일치로 탐지 ${det}/${tested}`);
  }
}
