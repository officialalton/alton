// 주입 결함 탐지 보고(무료 계층, LLM 호출 없음): npx tsx scripts/ap-generation/inject-defects.ts [--per-item]
import { readFileSync } from "node:fs";
import { runInjection, summarizeInjection } from "../../lib/ap-generation/defect-injection";
const items = (JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as { stockKey: string; apSubjectCode: string; kind: string; validation: string; payload: any }[])
  .filter((i) => i.kind === "mc" && i.validation === "auto_passed" && i.payload.explanation_en && i.payload.archetype).map((i) => ({ key: i.stockKey, subject: i.apSubjectCode, pack: i.payload }));
const rs = runInjection(items); const s = summarizeInjection(rs);
console.log(`정상 문항 ${s.goodItems}개, 오탐(false reject) ${s.falseRejects}`);
for (const [k, v] of Object.entries(s.byDefect)) console.log(`${k}: 적용 ${v.applicable}, 탐지 ${v.detected}, 미탐지 ${v.missed.length}`);
if (process.argv.includes("--per-item")) for (const r of rs) console.log([r.key, r.defect, r.applicable ? (r.detected ? "detected" : "MISSED") : "n/a", r.gates.join("|")].join("\t"));
