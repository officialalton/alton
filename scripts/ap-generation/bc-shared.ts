// BC 샘플에 재사용(태깅)할 AB 채택 문항을 BC 단원 비중에 맞춰 고른다. 새로 생성하지 않는다(content_key 공유, 같은 세트 안 중복 0).
//   npx tsx scripts/ap-generation/bc-shared.ts --ab run2 --bc run2bc  → data/ap/sample-2027/<bc>/shared_from_ab.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ab = arg("--ab", "run2"), bc = arg("--bc", "run2bc");
const ROOT = path.resolve(process.cwd(), "data/ap/sample-2027");
type C = { candidateKey: string; kind: string; unitCode: string; keywordCode: string; archetype: string; reviewState: string; reserve: boolean; difficultyProvisional: string | null; calculator: string };
const cands = JSON.parse(readFileSync(path.join(ROOT, ab, "candidates.json"), "utf-8")) as C[];
const adopted = cands.filter((c) => (c.reviewState === "pending_expert_review" || c.reviewState === "auto_passed") && !c.reserve);
const quota: Record<string, number> = { "1": 2, "2": 2, "3": 2, "4": 2, "5": 3, "6": 2, "8": 1 }; // BC MC 비중에 맞춘 공유분(BC 전용 칸은 별도 생성)
const mc = adopted.filter((c) => c.kind === "mc"); const picked: string[] = [];
for (const [u, n] of Object.entries(quota)) mc.filter((c) => c.unitCode === u).sort((a, b) => Number(b.difficultyProvisional === "exam_prep") - Number(a.difficultyProvisional === "exam_prep")).slice(0, n).forEach((c) => picked.push(c.candidateKey));
const frq = adopted.filter((c) => c.kind !== "mc").sort((a, b) => a.candidateKey.localeCompare(b.candidateKey)).slice(0, 2).map((c) => c.candidateKey);
mkdirSync(path.join(ROOT, bc), { recursive: true });
const out = { from: ab, quota, mcShared: picked, frqShared: frq, note: "AB 채택 문항을 BC 문항으로도 태깅(공통 토픽 content_key calculus:<코드>). 같은 BC 세트에서는 한 번만 사용." };
writeFileSync(path.join(ROOT, bc, "shared_from_ab.json"), JSON.stringify(out, null, 1));
console.log(`공유 MC ${picked.length}, 공유 FRQ ${frq.length}`, out);
