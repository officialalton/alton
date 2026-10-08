// 생성기 결함 전수 점검(무료): data/ap/stock/items.json(현재 재고) + 추가 후보 파일들. 결과: data/ap/stock/defect-scan.json
//   npx tsx scripts/ap-generation/defect-scan.ts [--extra data/ap/stock/s1a-items.json]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
const files = ["data/ap/stock/items.json", ...process.argv.slice(2).filter((a, i, arr) => arr[i - 1] === "--extra")];
type It = { stockKey: string; apSubjectCode: string; kind: string; validation: string; payload: Record<string, unknown> };
const res: { key: string; subject: string; kind: string; validation: string; flags: { code: string; where: string }[] }[] = [];
for (const f of files) if (existsSync(f)) for (const it of JSON.parse(readFileSync(f, "utf-8")) as It[]) { const fl = generatorDefects(it.payload); if (fl.length) res.push({ key: it.stockKey, subject: it.apSubjectCode, kind: it.kind, validation: it.validation, flags: fl }); }
writeFileSync("data/ap/stock/defect-scan.json", JSON.stringify(res, null, 1));
const tally: Record<string, number> = {}; res.forEach((r) => r.flags.forEach((x) => (tally[x.code] = (tally[x.code] ?? 0) + 1)));
console.log(`결함 후보 ${res.length}건`, tally); const live = res.filter((r) => ["auto_passed", "needs_revalidation"].includes(r.validation)); console.log(`그중 게시 후보 상태(auto_passed/needs_revalidation) ${live.length}건: auto_passed ${live.filter((r) => r.validation === "auto_passed").length}`);
