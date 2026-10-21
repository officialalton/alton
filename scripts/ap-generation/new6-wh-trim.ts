// WH3 세트 크기 조정(2026-10-19, LLM·DB 없음): 단원 상한(U7·U8 ≤ 6문항) 때문에 4문항 세트 2개를 같은 단원에 둘 수 없으므로, 지정한 세트에서 지정한 문항을 빼 3문항 세트로 만든다.
// 빠진 문항은 payload.excluded_items 에 reason 과 함께 남긴다(원본 파일은 *.full.json 에 보존).
//   npx tsx scripts/ap-generation/new6-wh-trim.ts w312:3,w313:3,w314:3,w315:3      (세트id:뺄 문항 인덱스)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const f = "data/ap/stock/wh-r19-m-items.json"; const full = "data/ap/stock/wh-r19-m-items.full.json"; if (!existsSync(full)) copyFileSync(f, full);
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const items = JSON.parse(readFileSync(full, "utf-8")) as J[]; const drops = Object.fromEntries(process.argv[2].split(",").map((x) => x.split(":")).map(([id, i]) => [id, Number(i)]));
for (const r of items) {
  const id = String(r.stockKey).split("-").slice(-2)[0].replace(/^.*(w\d{3}).*$/, "$1"); const m = /(w\d{3})/.exec(String(r.stockKey))?.[1] ?? id;
  if (drops[m] === undefined) continue;
  const its = r.payload.items as J[]; const [gone] = its.splice(drops[m], 1); r.payload.excluded_items = [...(r.payload.excluded_items ?? []), { skill: gone.skill, stem: gone.stem, reason: "trimmed_for_exam_composition(unit cap)" }];
  if (Array.isArray(r.difficulty)) r.difficulty.splice(drops[m], 1);
  r.skillPrimary = its[0].skill; console.log(m, "now", its.length, "items; dropped", gone.skill);
}
writeFileSync(f, JSON.stringify(items));
