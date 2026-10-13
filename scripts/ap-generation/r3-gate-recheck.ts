// R3 해설 재작성 후 결정적 게이트 재확인(무료): 통과 후보의 gateMc 사유가 비어 있어야 한다.  npx tsx scripts/ap-generation/r3-gate-recheck.ts supp-r3a-ab ...
import { readFileSync } from "node:fs";
import path from "node:path";
import { gateMc, type McPack } from "../../lib/ap-generation/gates";
let n = 0, bad = 0;
for (const run of process.argv.slice(2)) {
  const cs = JSON.parse(readFileSync(path.resolve("data/ap/sample-2027", `${run}-final`, "candidates.json"), "utf-8")) as { candidateKey: string; reviewState: string; payload: McPack }[];
  for (const c of cs) { if (c.reviewState !== "auto_passed" || !c.payload.options) continue; n++; const r = gateMc("ap_calculus_ab", c.payload); if (r.length) { bad++; console.log(run, c.candidateKey, r.join(",")); } }
}
console.log(`통과 후보 ${n}건 중 게이트 사유 있는 것 ${bad}건`);
