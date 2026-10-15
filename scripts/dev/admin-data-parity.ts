// /admin 람다 모사 검증: 같은 읽기 경로(배치 레지스트리·적재 항목·배정 보고서·부분 계획·스왑 계획·모든 과목 재고 풀)를 돌려 섹션별 해시를 낸다.
//   (1) 저장소에서:            npx tsx scripts/dev/admin-data-parity.ts
//   (2) .gz 만 있는 폴더에서:  cd <tmp> && npx tsx --tsconfig <repo>/tsconfig.json <repo>/scripts/dev/admin-data-parity.ts   (tmp/data/ap 에 .json.gz 와 curriculum-2027 만 둔다)
// 두 출력이 같아야 .gz 전용 배포가 동작이 같다. 쓰기·네트워크 없음.
import { createHash } from "node:crypto";
import { STOCK_BATCHES, batchArtifactsPresent, listAssignReports, listPartialPlans, readAssignReport, readDefectScan, readEvidence, readItems, readPassKeys, readRenderReport } from "../../lib/ap-admin/batches";
import { listSwapPlans, readSwapPlan } from "../../lib/ap-admin/new-version";
import { loadPool } from "../ap-generation/assign-pool";
import { loadBioPool } from "../ap-generation/bio-pool";
import { loadChemPool } from "../ap-generation/chem-pool";
import { loadCsPool } from "../ap-generation/cs-pool";
import { loadElPool } from "../ap-generation/el-pool";
import { loadLtPool } from "../ap-generation/lt-pool";
import { loadMacroPool } from "../ap-generation/macro-pool";
import { loadMicroPool } from "../ap-generation/micro-pool";
import { loadPhysPool } from "../ap-generation/phys-pool";
import { loadPsychPool } from "../ap-generation/psych-pool";
import { loadStatsPool } from "../ap-generation/stats-pool";
import { loadUshPool } from "../ap-generation/ush-pool";
import { STOCK_FILES } from "../ap-generation/keys-file";

const h = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 12);
const out: Record<string, string> = {};
const sec = (name: string, f: () => unknown) => { try { const v = f(); out[name] = `${h(v)}${Array.isArray(v) ? ` n=${v.length}` : ""}`; } catch (e) { out[name] = `ERR ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}`; } };

sec("stockFiles", () => STOCK_FILES);
sec("batchArtifacts", () => STOCK_BATCHES.map((b) => [b.id, batchArtifactsPresent(b)]));
sec("items", () => STOCK_BATCHES.filter((b) => b.itemsFile && batchArtifactsPresent(b).items).map((b) => [b.id, readItems(b).length, h(readItems(b))]));
sec("passKeys", () => STOCK_BATCHES.filter((b) => batchArtifactsPresent(b).passKeys).map((b) => [b.id, readPassKeys(b).length]));
sec("evidence", () => STOCK_BATCHES.filter((b) => batchArtifactsPresent(b).evidence).map((b) => [b.id, h(readEvidence(b))]));
sec("defectScan", () => readDefectScan());
sec("renderReport", () => readRenderReport());
sec("assignReports", () => listAssignReports().map((f) => [f, h(readAssignReport(f))]));
sec("partialPlans", () => listPartialPlans());
sec("newVersionPlans", () => listSwapPlans().map((p) => [p.file, p.set, p.swapCount, h(readSwapPlan(p.file))]));
const pools: [string, () => { pool: unknown[] }][] = [["ab", () => loadPool({ strictFamilies: true })], ["bio", () => loadBioPool()], ["chem", () => loadChemPool()], ["csa", () => loadCsPool()], ["el", () => loadElPool()], ["lt", () => loadLtPool()], ["macro", () => loadMacroPool()], ["micro", () => loadMicroPool()], ["phys", () => loadPhysPool()], ["psych", () => loadPsychPool()], ["stats", () => loadStatsPool()], ["ush", () => loadUshPool()]];
for (const [n, f] of pools) sec(`pool:${n}`, () => { const p = f(); return p.pool.map((x) => x); });
console.log(`cwd=${process.cwd()}`);
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(16)} ${v}`);
