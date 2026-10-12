// 재고 배치 레지스트리와 저장소 산출물 읽기. 배치 정의는 scripts/ap-generation/owner-load.sh(graph|siblings|supp)와 owner-run-bc-topup-load.md 의 값을 그대로 옮긴 것이다.
// 산출물(data/ap/stock/*, data/ap/screen-evidence/*.json, data/ap/render-check/report.json)은 배포 번들에 포함돼(next.config.ts outputFileTracingIncludes)
// 서버가 파일 시스템에서 읽는다. 업로드 경로는 없다 — 임의 파일을 올려 DB 에 쓰는 통로를 만들지 않는다. 새 배치는 저장소 커밋 → 배포로만 들어온다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RenderReportRow, ScreenEvidence } from "../ap-generation/verify-guard";
import type { StockItem } from "../ap-generation/stock";

export type StockBatch = {
  id: string;
  /** 사람이 읽는 이름 */
  title: string;
  /** 후보 적재 대상 파일(data/ap/stock/<file>). 없으면 이미 적재된 배치(형제 21건 등)로 렌더·화면 기록만. */
  itemsFile: string | null;
  /** ap_load_batches.label (적재 시 새로 만든다) */
  loadLabel: string | null;
  /** 보조 적재 여부(--supplement) */
  supplement: boolean;
  passKeysFile: string;
  evidenceFile: string;
};

const GRAPH: [string, string][] = [["s1", "graph-s1-ab"], ["s2a", "graph-s2-ab"], ["s2b", "graph-s2-bc"], ["s3a", "graph-s3a-ab"], ["s3b", "graph-s3a-bc"], ["s3c", "graph-s3b-ab"], ["s3d", "graph-s3b-bc"], ["s3e", "graph-s3c-ab"], ["s3f", "graph-s3c-bc"], ["s3g", "graph-s3d-bc"]];
const SUPP = ["b1", "b2ab", "b2bc", "b3ab", "b3bc", "b4ab", "b5bc", "b6ab"];

export const STOCK_BATCHES: StockBatch[] = [
  ...GRAPH.map(([f, b]): StockBatch => ({ id: `graph-${f}`, title: `그래프 배치 ${f} (${b})`, itemsFile: `graph-${f}-items.json`, loadLabel: `${b}-2026-10-09`, supplement: true, passKeysFile: `graph-${f}-pass-keys.json`, evidenceFile: "evidence-graph-s1s3.json" })),
  { id: "siblings", title: "형제 21건 (이미 적재, 검증 기록만)", itemsFile: null, loadLabel: null, supplement: false, passKeysFile: "v1v45-siblings-keys.json", evidenceFile: "evidence-v1v45-siblings.json" },
  ...SUPP.map((n): StockBatch => ({ id: `supp-${n}`, title: `보강 배치 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-09`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-supp.json" })),
  { id: "bc-topup", title: "BC 보충 (bc-topup)", itemsFile: "bc-topup-items.json", loadLabel: "bc-topup-2026-10-09", supplement: true, passKeysFile: "bc-topup-pass-keys.json", evidenceFile: "evidence-bc-topup.json" },
];

export const batchById = (id: string): StockBatch => {
  const b = STOCK_BATCHES.find((x) => x.id === id);
  if (!b) throw new Error(`알 수 없는 배치: ${id}`);
  return b;
};

const root = () => process.cwd();
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(path.join(root(), rel), "utf-8")) as T;
const has = (rel: string) => existsSync(path.join(root(), rel));

export const stockFileExists = (f: string) => has(`data/ap/stock/${f}`);
export function readPassKeys(b: StockBatch): string[] {
  const raw = readJson<string[] | { keys?: string[] }>(`data/ap/stock/${b.passKeysFile}`);
  return Array.isArray(raw) ? raw : raw.keys ?? [];
}
export const readItems = (b: StockBatch): StockItem[] => (b.itemsFile ? readJson<StockItem[]>(`data/ap/stock/${b.itemsFile}`) : []);
export const readDefectScan = () => (has("data/ap/stock/defect-scan.json") ? readJson<{ key: string; flags: { code: string }[] }[]>("data/ap/stock/defect-scan.json") : []);
export const readRenderReport = () => readJson<{ results: RenderReportRow[] }>("data/ap/render-check/report.json");
export const readEvidence = (b: StockBatch) => readJson<ScreenEvidence>(`data/ap/screen-evidence/${b.evidenceFile}`);
export const batchArtifactsPresent = (b: StockBatch) => ({ items: b.itemsFile ? stockFileExists(b.itemsFile) : true, passKeys: stockFileExists(b.passKeysFile), evidence: has(`data/ap/screen-evidence/${b.evidenceFile}`) });

/** 배정 보고서(data/ap/stock/exact-assign-*.json): 미리 계산된 세트 배정. 무거운 ILP 는 서버에서 돌리지 않는다. */
export type AssignReport = { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[]; virtual?: unknown[]; frqVirtual?: unknown[] }[] };
export function listAssignReports(): string[] {
  // 목록은 고정 접두어 파일만(경로 주입 방지). 실제 읽기는 아래 readAssignReport 가 같은 규칙으로 검사한다.
  return readdirSync(path.join(root(), "data/ap/stock")).filter((f) => /^exact-assign-[A-Za-z0-9.-]+\.json$/.test(f)).sort();
}
export function readAssignReport(file: string): AssignReport {
  if (!/^exact-assign-[A-Za-z0-9.-]+\.json$/.test(file)) throw new Error("배정 보고서 파일 이름이 올바르지 않습니다.");
  const r = readJson<AssignReport>(`data/ap/stock/${file}`);
  if (!Array.isArray(r.sets)) throw new Error("배정 보고서 형식 오류(sets 없음).");
  return r;
}
