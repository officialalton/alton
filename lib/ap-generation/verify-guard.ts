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

// ── 화면 검증 증거 ─────────────────────────────────────────────────────────
// 증거 JSON 스키마(docs/ap/screen-evidence.schema.json): { schema: "ap-screen-evidence/v1", checker, generator, generatedAt, entries: ScreenEntry[] }
// 항목은 (후보, 뷰포트) 한 건. 후보마다 모바일(폭 <= 430) 과 데스크톱(폭 >= 1024) 항목이 모두 통과해야 한다.
// 스크린샷 파일의 존재는 증거가 아니다 — 필수 점검 항목의 실제 결과(pass/fail/na + 메모)가 있어야 한다.
export const SCREEN_CHECKS = ["options_visible", "figure_rendered", "no_clipping", "no_answer_before_submit", "frq_input_works"] as const;
export type ScreenCheckName = (typeof SCREEN_CHECKS)[number];
export type ScreenCheck = { result: "pass" | "fail" | "na"; note?: string };
export type ScreenEntry = {
  candidate_key: string; content_hash: string; problem_version_id?: string; kind: "mc" | "frq_bundle";
  viewport: string; screenshot: string; timestamp: string; checker: string; checks: Partial<Record<ScreenCheckName, ScreenCheck>>;
};
export type ScreenEvidence = { schema?: string; checker?: string; generator?: string; generatedAt?: string; entries: ScreenEntry[] };

export function viewportWidth(v: string): number { const m = /^(\d+)x(\d+)$/.exec(v); return m ? Number(m[1]) : 0; }

/** 항목 검증: 필수 필드·해시 형식·스크린샷 실존·시각·필수 점검 결과(실패·미점검·사유 없는 na 는 거부). */
export function validateScreenEntry(e: Partial<ScreenEntry>, baseDir: string, now = Date.now()): string | null {
  for (const f of ["candidate_key", "content_hash", "viewport", "screenshot", "timestamp", "checker"] as const) if (!e[f] || typeof e[f] !== "string" || !String(e[f]).trim()) return `증거 필드 누락: ${f}`;
  if (!/^[0-9a-f]{64}$/.test(e.content_hash!)) return "content_hash 형식 오류(sha256 hex)";
  if (e.kind !== "mc" && e.kind !== "frq_bundle") return "kind 누락(mc|frq_bundle)";
  if (!viewportWidth(e.viewport!)) return "viewport 형식 오류(예: 390x844)";
  const t = Date.parse(e.timestamp!);
  if (Number.isNaN(t)) return "timestamp 형식 오류";
  if (t > now + 5 * 60_000) return "timestamp 가 미래";
  if (!existsSync(path.resolve(baseDir, e.screenshot!))) return `스크린샷 파일 없음: ${e.screenshot}`;
  const c = e.checks;
  if (!c || typeof c !== "object") return "checks 누락(실제 점검 결과 필요)";
  for (const name of SCREEN_CHECKS) {
    const r = c[name];
    if (!r || !["pass", "fail", "na"].includes(r.result)) return `점검 미실시: ${name}`;
    if (r.result === "fail") return `점검 실패: ${name}${r.note ? ` (${r.note})` : ""}`;
    if (r.result === "na") {
      if (name === "options_visible" || name === "no_clipping" || name === "no_answer_before_submit") return `${name} 은 na 불가`;
      if (name === "frq_input_works" && e.kind !== "frq_bundle") continue; // 객관식은 na
      if (name === "frq_input_works") return "FRQ 는 frq_input_works 가 필요";
      if (!r.note?.trim()) return `${name} na 에는 사유(note) 필요`;
    }
  }
  if (e.kind === "frq_bundle" && c.frq_input_works?.result !== "pass") return "FRQ 입력 점검 미통과";
  return null;
}

export type ScreenCandidateVerdict = { ok: true } | { ok: false; reason: string };
/** 후보 하나의 항목들(여러 뷰포트)과 DB 후보 payload 대조: 해시 일치 + 모바일·데스크톱 모두 통과. */
export function judgeScreenEntries(entries: ScreenEntry[], dbPayload: Record<string, unknown>, baseDir: string): ScreenCandidateVerdict {
  const hash = itemContentHash(dbPayload);
  const stale = entries.find((e) => e.content_hash !== hash);
  if (stale) return { ok: false, reason: "증거의 content_hash 가 현재 DB 후보 내용과 다름(검증 후 문항 변경 — 재검증 필요)" };
  for (const e of entries) { const bad = validateScreenEntry(e, baseDir); if (bad) return { ok: false, reason: bad }; }
  if (!entries.some((e) => viewportWidth(e.viewport) <= 430)) return { ok: false, reason: "모바일(<=430px) 점검 항목 없음" };
  if (!entries.some((e) => viewportWidth(e.viewport) >= 1024)) return { ok: false, reason: "데스크톱(>=1024px) 점검 항목 없음" };
  return { ok: true };
}
