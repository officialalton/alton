// AP 검증 기록 스크립트(mark-verified.ts)의 실행 대상 허용 목록과 증거·해시 검사(순수 함수, DB 접근 없음).
// 허용 대상은 둘뿐: 로컬 Supabase(127.0.0.1/localhost), 비프로덕션 프로젝트 ref NONPROD_REF(명시 확인 플래그가 있을 때만). 그 외·프로덕션은 거부.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

export const NONPROD_REF = "worpsqwqgnspddnrtnvq";

export type VerifyTarget = { kind: "local" } | { kind: "nonprod"; ref: string };

/** --target local(기본) | --target <ref> (+ --i-know-nonprod <ref>). URL 호스트가 대상과 정확히 일치해야 한다. 키는 다루지 않는다. */
export function resolveVerifyTarget(opts: { url: string | undefined; target?: string; confirm?: string }): VerifyTarget {
  const { url } = opts;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  let host: string;
  try { host = new URL(url).hostname; } catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다."); }
  const target = opts.target ?? "local";
  const isLocalHost = host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  if (target === "local") {
    if (!isLocalHost) throw new Error(`--target local 인데 URL 이 로컬이 아닙니다(호스트: ${host}). 비프로덕션은 --target ${NONPROD_REF} --i-know-nonprod ${NONPROD_REF} 가 필요합니다.`);
    return { kind: "local" };
  }
  if (target !== NONPROD_REF) throw new Error(`허용되지 않은 대상: ${target} (허용: local | ${NONPROD_REF}).`);
  if (opts.confirm !== NONPROD_REF) throw new Error(`비프로덕션 실행에는 --i-know-nonprod ${NONPROD_REF} 확인 플래그가 필요합니다.`);
  if (host !== `${NONPROD_REF}.supabase.co`) throw new Error(`URL 호스트(${host})가 허용된 비프로덕션 ref(${NONPROD_REF})와 다릅니다. 실행 거부.`);
  return { kind: "nonprod", ref: NONPROD_REF };
}

function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]));
  return v;
}

/** 렌더된 문항 버전의 내용 해시: 자료(stimulus: 데이터·그림 명세)·선지·정답·FRQ 파트. 후보 payload(재고 items.json 또는 DB)에서 같은 방식으로 계산한다. */
export function itemContentHash(payload: Record<string, unknown> | null | undefined): string {
  const p = payload ?? {};
  const pick = { stimulus: p.stimulus ?? null, stem: p.stem ?? null, options: p.options ?? null, key_index: p.key_index ?? null, key_index_final: p.key_index_final ?? null, parts: p.parts ?? null };
  return createHash("sha256").update(JSON.stringify(canon(pick))).digest("hex");
}

export type RenderReportRow = { key: string; status: string; contentHash?: string };
export type HashCheck = { ok: true } | { ok: false; reason: string };

/** report.json 행(렌더 당시 해시)과 DB 후보 payload 해시 비교. 해시 없음·불일치는 모두 건너뛴다. */
export function checkRenderedMatchesDb(row: RenderReportRow | undefined, dbPayload: Record<string, unknown>): HashCheck {
  if (!row) return { ok: false, reason: "렌더 보고서(report.json)에 없는 후보" };
  if (!row.contentHash) return { ok: false, reason: "보고서에 contentHash 가 없음(render-check 재실행 필요)" };
  if (row.status !== "pass" && row.status !== "not_applicable") return { ok: false, reason: `렌더 결과 ${row.status}` };
  return itemContentHash(dbPayload) === row.contentHash ? { ok: true } : { ok: false, reason: "렌더한 버전과 DB 후보 내용이 다름(해시 불일치)" };
}

export type ScreenEntry = { candidate_key: string; viewport: string; screenshot: string; timestamp: string; checker: string };
export type ScreenEvidence = { checker?: string; checks?: string[]; entries: ScreenEntry[] };

/** 증거 항목 검증: 필수 필드·스크린샷 파일 실존·시각 형식(미래 아님). baseDir 기준 상대경로. */
export function validateScreenEntry(e: Partial<ScreenEntry>, baseDir: string, now = Date.now()): string | null {
  for (const f of ["candidate_key", "viewport", "screenshot", "timestamp", "checker"] as const) if (!e[f] || typeof e[f] !== "string" || !String(e[f]).trim()) return `증거 필드 누락: ${f}`;
  const t = Date.parse(e.timestamp!);
  if (Number.isNaN(t)) return "timestamp 형식 오류";
  if (t > now + 5 * 60_000) return "timestamp 가 미래";
  const shot = path.resolve(baseDir, e.screenshot!);
  if (!existsSync(shot)) return `스크린샷 파일 없음: ${e.screenshot}`;
  return null;
}
