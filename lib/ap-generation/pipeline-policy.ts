// 승인된 생산 원칙(오너 확정 2026-10-08)을 코드로 고정한다. 파이프라인과 비교 실험은 이 설정과 판정 함수를 쓴다.
export const POLICY = {
  firstCandidatesPerCell: 1,          // 칸당 후보 1개로 시작하고 실패·부족한 칸에만 추가
  repairLimit: 1,                     // 부분 수선 기본 1회
  codeChecksBeforeLlm: true,          // 코드 검사(수치·키·보기·자료) 통과분만 LLM 검토로
  independentVerification: true,      // 생성 계산과 독립된 검증 경로(생성기 모듈과 코드 비공유)
  templateStop: { window: 4, maxSameReason: 2 }, // 첫 후보 4개 중 같은 사유 2개 이상 실패 → 템플릿 수정 전 생성 중단
  denominator: "first_candidates" as const,      // 분모 = 칸/템플릿의 최초 후보. 수선 시도는 별도 후보로 세지 않는다.
  manifestFile: "run_manifest.json",
} as const;

export type CandidateRecord = { templateId: string; cellId: string; attempt: 0 | 1; seed: number; passed: boolean; reasons: string[]; costUsd: number; calls: number };
/** 최초 후보(attempt 0)만 분모. */
export const firstCandidates = (rs: CandidateRecord[]) => rs.filter((r) => r.attempt === 0);
export const firstPassRate = (rs: CandidateRecord[]) => { const f = firstCandidates(rs); return f.length ? f.filter((r) => r.passed).length / f.length : 0; };
/** 수선(attempt 1) 후 통과 포함 비율. 분모는 여전히 최초 후보 수. */
export function postRepairPassRate(rs: CandidateRecord[]): number {
  const f = firstCandidates(rs); if (!f.length) return 0;
  const ok = f.filter((r) => r.passed || rs.some((x) => x.attempt === 1 && x.cellId === r.cellId && x.seed === r.seed && x.passed)).length;
  return ok / f.length;
}
export const primaryReason = (r: CandidateRecord) => (r.reasons[0] ?? "").replace(/\d+/g, "N").replace(/:.*/, "");
/** 템플릿 중단 규칙: 최초 후보 window 개 중 같은 1순위 사유가 maxSameReason 이상이면 true(수선은 세지 않는다). */
export function shouldStopTemplate(rs: CandidateRecord[], cfg: { window: number; maxSameReason: number } = POLICY.templateStop): { stop: boolean; reason: string | null } {
  const first = firstCandidates(rs).slice(0, cfg.window); const tally = new Map<string, number>();
  for (const r of first) if (!r.passed) { const k = primaryReason(r); tally.set(k, (tally.get(k) ?? 0) + 1); }
  for (const [k, n] of tally) if (n >= cfg.maxSameReason) return { stop: true, reason: k };
  return { stop: false, reason: null };
}
/** 수선은 칸당 repairLimit 회까지만. */
export const canRepair = (rs: CandidateRecord[], cellId: string, seed: number) => rs.filter((r) => r.cellId === cellId && r.seed === seed && r.attempt === 1).length < POLICY.repairLimit;
/** 사용 가능한 고유 문항당 총비용 = (생성+검토+수선) / 사용 가능 고유 문항. */
export const costPerUsableUnique = (totalCostUsd: number, usableUnique: number) => (usableUnique ? totalCostUsd / usableUnique : Infinity);

export type RunManifest = { run: string; subject: string; generatorCommit: string; gateVersion: string; reviewerPromptHash: string; difficultyPromptHash: string; models: Record<string, string>; policy: typeof POLICY; seeds: { first: number[]; note: string }; frozenAt: string; arm?: string; parserHash?: string; repairDefinition?: string; frozenWith?: string; generatorHash?: string; flags?: Record<string, unknown>; frozenConfig?: string; validity?: string };
export const manifestIssues = (m: Partial<RunManifest>): string[] => ["run", "subject", "generatorCommit", "gateVersion", "reviewerPromptHash", "difficultyPromptHash", "models", "frozenAt"].filter((k) => !(m as Record<string, unknown>)[k]).map((k) => `manifest missing ${k}`);

/** 비교 실험 보고용 집계. 최초 후보 수·최초 통과·수선 후 통과·사용 가능 고유 1건당 총비용을 분리해 보고한다(수선·재검토 호출은 최초 후보 수에 섞지 않는다).
 *  비용은 attempt 0/1 행의 costUsd 합(수선·재검토 호출 비용 포함), 분모는 최초 후보. 소표본에서는 통과율 하나로 판정하지 않고 이 표 전체를 본다. */
export type ArmGroupReport = { group: string; firstCandidates: number; firstPass: number; postRepairPass: number; calls: number; totalCostUsd: number; costPerUsableUnique: number };
export type ReportedRecord = CandidateRecord & { skill: string; structure: string };
export function armReport(rs: ReportedRecord[], by: "skill" | "structure" | "all"): ArmGroupReport[] {
  const groups = new Map<string, ReportedRecord[]>();
  for (const r of rs) { const g = by === "all" ? "all" : r[by]; (groups.get(g) ?? groups.set(g, []).get(g)!).push(r); }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, rows]) => {
    const f = firstCandidates(rows); const first = f.filter((r) => r.passed).length; const post = Math.round(postRepairPassRate(rows) * f.length);
    const cost = rows.reduce((a, r) => a + r.costUsd, 0);
    return { group, firstCandidates: f.length, firstPass: first, postRepairPass: post, calls: rows.reduce((a, r) => a + r.calls, 0), totalCostUsd: Math.round(cost * 1e4) / 1e4, costPerUsableUnique: costPerUsableUnique(cost, post) };
  });
}
