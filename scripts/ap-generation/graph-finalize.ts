// 단계 실행 마무리(무료): report 단계로 candidates.json 을 만들고 <run>-final 로 복사한다. LLM·DB 호출 없음.
//   npx tsx scripts/ap-generation/graph-finalize.ts <run> <subject> <seed0>
import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
const [run, subject, seed0] = process.argv.slice(2);
const env = { ...process.env, AP_REQUIRE_BLUEPRINT: "1", AP_SUBJECT_NOTES: "1", AP_FLAT_REVIEW: "1", AP_MC_CANDS: "1" };
const r = spawnSync("npx", ["tsx", "scripts/ap-generation/pipeline2.ts", "report", "--run", run, "--subject", subject, "--seed0", seed0], { env, encoding: "utf-8" });
if (r.status !== 0) { console.error(r.stderr.slice(-300)); process.exit(1); }
const root = path.resolve("data/ap/sample-2027");
if (!existsSync(path.join(root, run, "candidates.json"))) { console.error("candidates.json 없음"); process.exit(1); }
cpSync(path.join(root, run), path.join(root, `${run}-final`), { recursive: true }); console.log(`${run}-final 생성`);
