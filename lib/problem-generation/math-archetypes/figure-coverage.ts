// 자료 원형 커버리지 게이트 — 보고서 형식과 대량 생성 실행기용 가드.
// 게이트 테스트(figure-coverage.test.ts, WRITE_GATE_REPORT=1)가 coverage-gate-report.json 을 쓰고, 대량 생성기는 시작할 때 이 보고서를 읽는다.
// 기본은 전 범위 게이트(ok=true 여야 시작). 오너가 승인한 항목 부분집합(allowItems)만 별도로 열 수 있다 — 그 항목들이 보고서에서 pass 여야 한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Archetype } from "./types";

export type ItemStatus = "pass" | "fail" | "unimplemented" | "blocked_renderer";
export type QaStatus = { state: string; detail: string };
export type ItemResult = { status: ItemStatus; hard: number; em: number; operators: string[]; sprHard: number; failures: string[]; /** 시각 검수 상태(G9) — 현재 생성기·렌더 코드 해시 기준 */ qa?: QaStatus };
export type GateReport = {
  version: 1; generatedAt: string; seedsPerArchetype: number; ok: boolean;
  summary: { items: number; pass: number; fail: number; unimplemented: number; blockedRenderer: number; waived: number };
  gates: Record<string, { ok: boolean; note: string }>;
  items: Record<string, ItemResult>;
  /** 매니페스트의 검수 상태 열 — 조합 303개 전체(미구현은 unimplemented). 상태는 코드가 바뀔 때마다 달라지는 파생값이라 보고서에 기록한다. */
  qaByItem: Record<string, QaStatus>;
  spr: { requiredHardSprFor30Sets: number; supplyImplemented: number; sprCapableItems: number; sprIncapableItems: number; byItem: Record<string, number> };
};
export const GATE_REPORT_PATH = path.join("lib", "problem-generation", "math-archetypes", "coverage-gate-report.json");
export class CoverageGateError extends Error {}

export function loadGateReport(): GateReport | null {
  try { return JSON.parse(readFileSync(path.join(process.cwd(), GATE_REPORT_PATH), "utf-8")) as GateReport; } catch { return null; }
}

/** 자료 원형(figureItem 선언)이 하나라도 있으면 게이트를 통과해야 대량 생성을 시작한다. */
export function assertCoverageGate(archetypes: Archetype[], opts: { report?: GateReport | null; allowItems?: string[] } = {}): void {
  const items = [...new Set(archetypes.map((a) => a.figureItem).filter((x): x is string => !!x))];
  if (!items.length) return;
  const report = opts.report === undefined ? loadGateReport() : opts.report;
  if (!report) throw new CoverageGateError("커버리지 게이트 보고서(coverage-gate-report.json)가 없다 — figure-coverage 게이트 테스트를 먼저 실행해야 자료 원형 대량 생성을 시작할 수 있다.");
  if (report.ok) return;
  const allow = new Set(opts.allowItems ?? []);
  const blocked = items.filter((id) => !(allow.has(id) && report.items[id]?.status === "pass"));
  if (blocked.length) throw new CoverageGateError(`커버리지 게이트 미통과(전체 ok=false, 통과 ${report.summary.pass}/${report.summary.items}) — 대량 생성 거부. 허용되지 않았거나 게이트를 통과하지 못한 항목 ${blocked.length}개: ${blocked.slice(0, 5).join(", ")}${blocked.length > 5 ? " …" : ""}. 부분 생성은 오너 승인 항목을 allowItems 로 지정해야 한다.`);
}
