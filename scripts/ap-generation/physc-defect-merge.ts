// AP Physics C: Mechanics 재고(physc-*-items.json)의 생성기 결함 후보를 data/ap/stock/defect-scan.json 에 병합한다(무료·읽기/쓰기는 이 파일 하나).
// defect-scan.ts 는 items.json + 지정한 추가 파일로 결과 전체를 다시 쓰기 때문에, 다른 과목 항목의 기존 결과를 지우지 않도록 이 스크립트가 같은 키만 갱신해 병합한다.
//   npx tsx scripts/ap-generation/physc-defect-merge.ts physc-a-items.json physc-s-items.json …
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";

const root = "data/ap/stock/";
type Entry = { key: string; subject: string; kind: string; validation: string; flags: { code: string; where: string }[] };
const scan = JSON.parse(readFileSync(root + "defect-scan.json", "utf-8")) as Entry[];
const mine = new Set<string>(); const fresh: Entry[] = []; let total = 0;
for (const f of process.argv.slice(2)) {
  if (!existsSync(root + f)) continue;
  for (const it of JSON.parse(readFileSync(root + f, "utf-8")) as { stockKey: string; apSubjectCode: string; kind: string; validation: string; payload: Record<string, unknown> }[]) {
    total++; mine.add(it.stockKey); const fl = generatorDefects(it.payload);
    if (fl.length) fresh.push({ key: it.stockKey, subject: it.apSubjectCode, kind: it.kind, validation: it.validation, flags: fl.map((x) => ({ code: x.code, where: x.where })) });
  }
}
const out = [...scan.filter((e) => !mine.has(e.key)), ...fresh];
writeFileSync(root + "defect-scan.json", JSON.stringify(out, null, 1));
console.log(`physc 재고 ${total}건 점검, 결함 후보 ${fresh.length}건(기존 ${scan.length}건 → ${out.length}건)`);
