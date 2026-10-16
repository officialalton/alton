// R3 TeX 위생(무료, LLM·DB 없음): 예전 해설 생성기가 선택지 텍스트의 $ 를 벗겨 수식이 $...$ 밖에 노출됐다. R3 런의 MC 후보에서 해설이
// "옛 생성기 출력과 정확히 같을 때만"(= 코드가 만든 해설일 때만) 새 생성기(pipeline2.ts structuredExplanation) 출력으로 다시 쓴다.
//   npx tsx scripts/ap-generation/r3-rewrap-explanations.ts supp-r3a-ab supp-r3b-ab ...   (각 run 과 run-final 두 디렉터리를 갱신)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
type Opt = { text: string; why: string };
const plain = (t: string) => t.replace(/\$/g, "");
const build = (o: Opt[], k: number, pl: (t: string) => string) => `The correct answer is ${pl(o[k].text)}. ${o[k].why}\n` + o.filter((_, i) => i !== k).map((x) => `${pl(x.text)} is incorrect: ${x.why}`).join("\n");
let changed = 0, kept = 0;
for (const run of process.argv.slice(2)) for (const d of [run, `${run}-final`]) {
  const f = path.resolve("data/ap/sample-2027", d, "candidates.json"); if (!existsSync(f)) continue;
  const cs = JSON.parse(readFileSync(f, "utf-8")) as { payload: { options?: Opt[]; key_index?: number; explanation_en?: string } }[];
  for (const c of cs) {
    const p = c.payload; if (!p.options || typeof p.key_index !== "number" || typeof p.explanation_en !== "string") continue;
    if (p.explanation_en === build(p.options, p.key_index, plain)) { p.explanation_en = build(p.options, p.key_index, (t) => t); changed++; } else kept++;
  }
  writeFileSync(f, JSON.stringify(cs, null, 1));
}
console.log(`다시 쓴 해설 ${changed}건(두 디렉터리 합), 코드 생성 해설이 아니어서 유지 ${kept}건`);
