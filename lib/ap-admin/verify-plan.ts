// 렌더·화면 검증 기록 판정(순수 함수). scripts/ap-generation/mark-verified.ts 와 관리자 화면이 같은 판정을 쓴다.
// 규칙(변경 금지): 렌더 보고서 contentHash·화면 증거 content_hash 는 현재 DB payload 해시와 같아야 하고, 화면 증거는 모바일·데스크톱 전 항목 통과.
import { gateCandidate } from "../ap-figures/gate";
import { AUTOMATED_LIMITATION, checkRenderedMatchesDb, judgeScreenEntries, type RenderReportRow, type ScreenEntry, type ScreenEvidence } from "../ap-generation/verify-guard";

export type VerifyDbRow = { candidate_key: string; ap_subject_code: string; kind: string; payload: Record<string, unknown>; render_verified: boolean; screen_verified: boolean; screen_evidence?: unknown; defect_flags?: unknown };

export type RenderDecision = { action: "mark" | "already" | "skip"; reason?: string; evidence?: Record<string, unknown> };
export function decideRender(r: VerifyDbRow, reportRow: RenderReportRow | undefined, reportLabel: string, at = new Date().toISOString()): RenderDecision {
  if (r.render_verified) return { action: "already" };
  if (Array.isArray(r.defect_flags) && r.defect_flags.length) return { action: "skip", reason: `생성기 결함 플래그(${r.defect_flags.join(", ")}) — 렌더 검증 대상 아님` };
  const g = gateCandidate({ candidateKey: r.candidate_key, apSubjectCode: r.ap_subject_code, kind: r.kind as "mc" | "frq_bundle", payload: r.payload });
  if (g.status === "fail") return { action: "skip", reason: `렌더 게이트 실패(${g.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")})` };
  const m = checkRenderedMatchesDb(reportRow, r.payload);
  if (!m.ok) return { action: "skip", reason: m.reason };
  return { action: "mark", evidence: { gate: "ap-figures/gate", status: g.status, renderType: g.renderType, need: g.need, contentHash: reportRow!.contentHash, report: reportLabel, at } };
}

export type ScreenDecision = { action: "new" | "relabel" | "already" | "skip"; reason?: string; evidence?: Record<string, unknown> };
export function decideScreen(r: VerifyDbRow, es: ScreenEntry[], ev: Pick<ScreenEvidence, "schema" | "generator">, baseDir: string, o: { skipScreenshotFiles?: boolean; at?: string } = {}): ScreenDecision {
  if (!r.render_verified) return { action: "skip", reason: "렌더 검증이 먼저입니다." };
  const v = judgeScreenEntries(es, r.payload, baseDir, { requireResult: ev.schema === "ap-screen-evidence/v2" || ev.schema === "ap-screen-evidence/v3", requireStimulus: ev.schema === "ap-screen-evidence/v3", skipScreenshotFiles: o.skipScreenshotFiles });
  if (!v.ok) return { action: "skip", reason: v.reason };
  const kind = es.every((e) => e.checker_kind === "automated") ? "automated" : es.every((e) => e.checker_kind === "human") ? "human" : "mixed";
  const prev = r.screen_evidence as { checkerKind?: string; contentHash?: string; evidenceSchema?: string } | null;
  if (r.screen_verified && prev?.checkerKind === kind && prev?.contentHash === es[0].content_hash && prev?.evidenceSchema === (ev.schema ?? null)) return { action: "already" };
  const evidence = { evidenceSchema: ev.schema ?? null, checkerKind: kind, contentHash: es[0].content_hash, limitations: kind === "human" ? null : AUTOMATED_LIMITATION, entries: es.map((e) => ({ checker_kind: e.checker_kind, viewport: e.viewport, screenshot: e.screenshot, timestamp: e.timestamp, checker: e.checker, checks: e.checks })), generator: ev.generator ?? null, at: o.at ?? new Date().toISOString() };
  return { action: r.screen_verified ? "relabel" : "new", evidence };
}
