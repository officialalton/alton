// 보강(supplement) 재고 파일 전체의 생성기 결함 점검(무료·읽기 전용): npx tsx scripts/ap-generation/supp-defect-check.ts
import { readdirSync, readFileSync } from "node:fs";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";

let n = 0, bad = 0;
for (const f of readdirSync("data/ap/stock").filter((x) => /^supp-.*-items\.json$/.test(x))) {
  for (const it of JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")) as { stockKey: string; validation: string; payload: Record<string, unknown> }[]) {
    n++; const fl = generatorDefects(it.payload);
    if (fl.length) { bad++; console.log(it.stockKey, it.validation, JSON.stringify(fl)); }
  }
}
console.log(`checked ${n}, with defects ${bad}`);
