// AP Chemistry 화면 증거 대상 키 목록(무료·읽기 전용): 새 배치의 통과 문항 중 (a) 그림이 있는 문항(그래프·장면·선택지 그림) 전부 + (b) 배정 보고서에 들어간 문항 중 화면 증거가 아직 없는 것.
//   npx tsx scripts/ap-generation/chem-evidence-keys.ts --report data/ap/stock/exact-assign-chem-ch1-ch2.json [--all] [--out tmp/chem-evidence-keys.txt]
import { readFileSync, writeFileSync } from "node:fs";
import { loadChemPool } from "./chem-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const { all } = loadChemPool({ requireScreen: false });
const used = new Set<string>();
if (arg("--report")) for (const st of (JSON.parse(readFileSync(arg("--report"), "utf-8")) as { sets: { mcA: string[]; frqA: string[] }[] }).sets) for (const k of [...st.mcA, ...st.frqA]) used.add(k);
const ALL = process.argv.includes("--all"); // 그림 없는 미사용 문항까지 전부(모든 통과 문항이 화면 증거를 갖도록)
const need = all.filter((c) => !c.screen && (ALL || c.renderType !== "none" || c.stimKind !== "none" || used.has(c.key)));
const keys = need.map((c) => c.key);
const by: Record<string, number> = {}; for (const c of need) by[c.renderType] = (by[c.renderType] ?? 0) + 1;
console.error(`증거 필요 ${keys.length}건 (그림 문항 ${need.filter((c) => c.renderType !== "none").length}, 배정 사용 ${need.filter((c) => used.has(c.key)).length}) 렌더 유형: ${JSON.stringify(by)}`);
writeFileSync(arg("--out", "tmp/chem-evidence-keys.txt"), keys.join("\n") + "\n");
