// 보강(supplement) 배치별 통과 키 파일과 기대 건수 표(무료·읽기 전용). 실행: npx tsx scripts/ap-generation/supp-pass-keys.ts
// data/ap/stock/<배치 파일 접두>-pass-keys.json (JSON 배열: 자동 통과·결함 0·완전 중복 아님) + supp-load-summary.json(배치별 행·통과·MC/FRQ 건수)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SUPP_BATCHES } from "./supp-batches";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";

type Raw = { stockKey: string; kind: string; validation: string; duplicateOf?: string | null; payload: Record<string, unknown> };
const summary: { file: string; run: string; rows: number; pass: number; mc: number; frq: number; rejected: number; passKeysFile: string }[] = [];
for (const b of SUPP_BATCHES) {
  const f = `data/ap/stock/${b.file}`;
  if (!existsSync(f)) continue;
  const rows = JSON.parse(readFileSync(f, "utf-8")) as Raw[];
  const pass = rows.filter((r) => r.validation === "auto_passed" && !r.duplicateOf && generatorDefects(r.payload).length === 0);
  const out = `data/ap/stock/${b.file.replace(/-items\.json$/, "-pass-keys.json")}`;
  writeFileSync(out, "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");
  summary.push({ file: b.file, run: b.run, rows: rows.length, pass: pass.length, mc: pass.filter((r) => r.kind === "mc").length, frq: pass.filter((r) => r.kind !== "mc").length, rejected: rows.length - pass.length, passKeysFile: out.replace("data/ap/stock/", "") });
}
writeFileSync("data/ap/stock/supp-load-summary.json", JSON.stringify(summary, null, 1));
const tot = summary.reduce((a, s) => ({ rows: a.rows + s.rows, pass: a.pass + s.pass, mc: a.mc + s.mc, frq: a.frq + s.frq }), { rows: 0, pass: 0, mc: 0, frq: 0 });
for (const s of summary) console.log(`${s.file.padEnd(24)} 행 ${String(s.rows).padStart(2)} 통과 ${String(s.pass).padStart(2)} (MC ${s.mc}, FRQ ${s.frq}) 반려 ${s.rejected}`);
console.log(`합계 행 ${tot.rows}, 통과 ${tot.pass} (MC ${tot.mc}, FRQ ${tot.frq})`);
