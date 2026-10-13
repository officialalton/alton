// AP 재고 전수 원문 수식 점검 보고(파일만 읽음 — DB·네트워크 없음). CLI: scripts/ap-generation/tex-audit.ts
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { auditPayload, type TexHit } from "./tex-audit";

type StockItem = { stockKey: string; candidateKey?: string; kind: string; apSubjectCode?: string; validation?: string; payload: Record<string, unknown> };
/** 학생·관리자가 화면에서 실제로 읽는 필드(본문·선지·해설·FRQ 문제·모범 답안·자료). 블루프린트·루브릭·검증 메모는 내부용. */
export const isVisibleNorm = (norm: string) => /^(stem|title|explanation_en|options\[\]\.text|parts\[\]\.(prompt|model_answer)|stimulus(\..*)?)$/.test(norm);
export type AuditRow = { stockKey: string; kind: string; archetype: string; membership: string[]; fields: { path: string; norm: string; stored: TexHit[]; display: TexHit[] }[] };
export type AuditReport = {
  generatedFrom: string; totalItems: number; scannedItems: number; storedAffected: number; displayAffected: number; visibleStoredAffected: number; visibleDisplayAffected: number;
  byField: Record<string, { stored: number; display: number; visible: boolean }>; byArchetype: Record<string, { stored: number; display: number }>;
  byKind: Record<string, number>; membership: Record<string, { stored: number; display: number; items: number }>; rows: AuditRow[];
};

const readJson = <T>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;

/** 게시·조립 단위별 소속 키 집합(저장소 계획 파일 기준). */
export function loadMembership(dir: string): Record<string, Set<string>> {
  const m: Record<string, Set<string>> = {};
  const flat = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(flat) : o && typeof o === "object" ? Object.values(o as object).flatMap(flat) : []);
  const sel = readJson<{ keys: Record<string, string[]> }>(path.join(dir, "ab-full-set-selection.json")).keys;
  const swaps = readJson<{ swaps: { removeKey?: string; addKey: string }[] }>(path.join(dir, "ab1-v2-swap-plan.json")).swaps;
  const v1 = new Set(flat(sel)); m["AB1 v1(공개본)"] = v1;
  const v2 = new Set(v1); for (const s of swaps) { if (s.removeKey) v2.delete(s.removeKey); v2.add(s.addKey); } m["AB1 v2(계획 적용)"] = v2;
  for (const s of readJson<{ sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] }[] }>(path.join(dir, "exact-assign-5sets-cons.json")).sets) m[`${s.id}(5세트 계획)`] = new Set(flat([s.mcA, s.mcB, s.frqA, s.frqB]));
  const pp = path.join(dir, "assembled/partial-rebuild-ab-plan.json");
  if (existsSync(pp)) for (const s of readJson<{ sets: { id: string; keys: Record<string, string[]> }[] }>(pp).sets) m[`부분 연습 ${s.id}`] = new Set(flat(s.keys));
  const up = path.join(dir, "published-usage.json");
  if (existsSync(up)) for (const u of readJson<{ stockKey: string; practice?: string[]; fullMock?: boolean }[]>(up)) for (const n of [...(u.practice ?? []), ...(u.fullMock ? ["게시 중 풀 모의고사(published-usage)"] : [])]) (m[`게시 중: ${n}`] ??= new Set()).add(u.stockKey);
  return m;
}

export function buildAuditReport(dir = "data/ap/stock"): AuditReport {
  const files = readdirSync(dir).filter((f) => /items\.json$/.test(f) && !f.includes("pass-keys"));
  const byKey = new Map<string, StockItem>();
  for (const f of files) for (const it of readJson<StockItem[]>(path.join(dir, f))) if (it.stockKey && !byKey.has(it.stockKey)) byKey.set(it.stockKey, it);
  const mem = loadMembership(dir);
  const rep: AuditReport = { generatedFrom: files.sort().join(","), totalItems: byKey.size, scannedItems: 0, storedAffected: 0, displayAffected: 0, visibleStoredAffected: 0, visibleDisplayAffected: 0, byField: {}, byArchetype: {}, byKind: {}, membership: {}, rows: [] };
  for (const k of Object.keys(mem)) rep.membership[k] = { stored: 0, display: 0, items: mem[k].size };
  rep.membership["재고(어느 세트에도 없음, 예비)"] = { stored: 0, display: 0, items: 0 };
  const inAny = new Set(Object.values(mem).flatMap((s) => [...s]));
  for (const it of byKey.values()) {
    if (it.validation && it.validation !== "auto_passed") continue; // 거절·중복 후보는 게시 대상이 아님
    rep.scannedItems++;
    const names = Object.keys(mem).filter((k) => mem[k].has(it.stockKey)); const reserve = !inAny.has(it.stockKey);
    if (reserve) rep.membership["재고(어느 세트에도 없음, 예비)"].items++;
    const all = auditPayload(it.payload); const fields = all.filter((f) => isVisibleNorm(f.norm));
    if (all.length) rep.storedAffected++;
    if (!fields.length) continue;
    const arche = String((it.payload as { archetype?: string }).archetype ?? "(archetype 없음)");
    const st = true, dp = fields.some((f) => f.display.length > 0);
    rep.visibleStoredAffected += st ? 1 : 0; rep.visibleDisplayAffected += dp ? 1 : 0;
    rep.byKind[it.kind] = (rep.byKind[it.kind] ?? 0) + 1;
    (rep.byArchetype[arche] ??= { stored: 0, display: 0 }).stored++; if (dp) rep.byArchetype[arche].display++;
    for (const f of fields) { const b = (rep.byField[f.norm] ??= { stored: 0, display: 0, visible: isVisibleNorm(f.norm) }); b.stored++; if (f.display.length) b.display++; }
    for (const n of reserve ? ["재고(어느 세트에도 없음, 예비)"] : names) { rep.membership[n].stored++; if (dp) rep.membership[n].display++; }
    rep.rows.push({ stockKey: it.stockKey, kind: it.kind, archetype: arche, membership: reserve ? ["예비"] : names, fields });
  }
  return rep;
}
