// 재고 배치 레지스트리와 저장소 산출물 읽기. 배치 정의는 scripts/ap-generation/owner-load.sh(graph|siblings|supp)와 owner-run-bc-topup-load.md 의 값을 그대로 옮긴 것이다.
// 산출물(data/ap/stock/*, data/ap/screen-evidence/*.json, data/ap/render-check/report.json)은 배포 번들에 포함돼(next.config.ts outputFileTracingIncludes)
// 서버가 파일 시스템에서 읽는다. 업로드 경로는 없다 — 임의 파일을 올려 DB 에 쓰는 통로를 만들지 않는다. 새 배치는 저장소 커밋 → 배포로만 들어온다.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RenderReportRow, ScreenEvidence } from "../ap-generation/verify-guard";
import type { StockItem } from "../ap-generation/stock";
import { PARTIAL_PLAN_FILE_RE, type PartialPlanFile } from "./partial-draft";

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
  // 2026-10-12 예비 보충 2차(docs/ap/reserve-topup-2.md): 두 배치가 한 증거 파일을 공유한다.
  ...(["t2a", "t2b"] as const).map((n): StockBatch => ({ id: `supp-${n}`, title: `예비 보충 2차 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-12`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-topup2.json" })),
  // 2026-10-12 예비 3차(docs/ap/reserve-r3-report.md): 다섯 배치(R3-A·B·B2·C·C2)가 한 증거 파일을 공유한다.
  ...(["r3a", "r3b", "r3b2", "r3c", "r3c2"] as const).map((n): StockBatch => ({ id: `supp-${n}`, title: `예비 3차 ${n}`, itemsFile: `supp-${n}-items.json`, loadLabel: `supp-${n}-2026-10-12`, supplement: true, passKeysFile: `supp-${n}-pass-keys.json`, evidenceFile: "evidence-r3.json" })),
  // 2026-10-12 AP Statistics S1 파일럿(docs/ap/statistics-pilot-report.md): 원형 20개 × 1(L 10·M 6·H 4), 세 런(stats-s1-l/m/h-final)이 한 증거 파일을 공유한다.
  { id: "stats-s1", title: "AP Statistics 파일럿 S1 (원형 20)", itemsFile: "stats-s1-items.json", loadLabel: "stats-s1-2026-10-12", supplement: true, passKeysFile: "stats-s1-pass-keys.json", evidenceFile: "evidence-stats-s1.json" },
  // 2026-10-12 AP Statistics S2-a(docs/ap/statistics-s2a-report.md): 단독 15 + 공유 자료 세트 2(3문항씩) + FRQ 2 후보, 세 런(stats-s2a-a/b/c)이 한 증거 파일을 공유한다.
  { id: "stats-s2a", title: "AP Statistics S2-a (단독 15 + 공유 세트 2 + FRQ 2)", itemsFile: "stats-s2a-items.json", loadLabel: "stats-s2a-2026-10-12", supplement: true, passKeysFile: "stats-s2a-pass-keys.json", evidenceFile: "evidence-stats-s2a.json" },
  // 2026-10-12 AP Statistics S2-b(docs/ap/statistics-s2b-report.md): 첫 풀 세트 마무리 — 단독 12 + 공유 세트 2(이항, 같은 원형 예비 1) + FRQ 6 후보(Q1·Q2·Q4 각 2), 세 런(stats-s2b-a/b/c)이 한 증거 파일을 공유한다.
  { id: "stats-s2b", title: "AP Statistics S2-b (단독 12 + 공유 세트 2 + FRQ 6)", itemsFile: "stats-s2b-items.json", loadLabel: "stats-s2b-2026-10-12", supplement: true, passKeysFile: "stats-s2b-pass-keys.json", evidenceFile: "evidence-stats-s2b.json" },
  // 2026-10-12 AP Statistics S3-a(docs/ap/statistics-s3a-report.md): 다단계 신규 MC 원형 10개 x 시드 2 = 단독 20 후보.
  { id: "stats-s3a", title: "AP Statistics S3-a (다단계 단독 20)", itemsFile: "stats-s3a-items.json", loadLabel: "stats-s3a-2026-10-12", supplement: true, passKeysFile: "stats-s3a-pass-keys.json", evidenceFile: "evidence-stats-s3a.json" },
  // 2026-10-13 AP Statistics S3-b(docs/ap/statistics-s3b-report.md): ST2 부족분 — 단독 37 후보(통과 34) + 단원 5 회귀 공유 세트 3 + FRQ 12(통과 5).
  { id: "stats-s3b", title: "AP Statistics S3-b (ST2 부족분: 단독 34 + 회귀 세트 3 + FRQ 5)", itemsFile: "stats-s3b-items.json", loadLabel: "stats-s3b-2026-10-13", supplement: true, passKeysFile: "stats-s3b-pass-keys.json", evidenceFile: "evidence-stats-s3b.json" },
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

/** 부분 연습 세트 재구성 계획(data/ap/stock/assembled/partial-rebuild-*.json, scripts/ap-generation/partial-rebuild-plan.ts 산출). 목록은 고정 접두어 파일만. */
export function listPartialPlans(): { file: string; sets: { id: string; name: string; partial: string }[] }[] {
  const dir = path.join(root(), "data/ap/stock/assembled");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => PARTIAL_PLAN_FILE_RE.test(f)).sort().map((f) => ({ file: f, sets: readPartialPlan(f).sets.map((s) => ({ id: s.id, name: s.name, partial: s.partial })) }));
}
export function readPartialPlan(file: string): PartialPlanFile {
  if (!PARTIAL_PLAN_FILE_RE.test(file)) throw new Error("부분 세트 계획 파일 이름이 올바르지 않습니다.");
  const r = readJson<PartialPlanFile>(`data/ap/stock/assembled/${file}`);
  if (r.kind !== "ap_partial_rebuild_plan" || !Array.isArray(r.sets)) throw new Error("부분 세트 계획 형식 오류.");
  return r;
}
