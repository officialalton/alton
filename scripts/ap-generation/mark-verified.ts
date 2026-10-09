// 렌더·화면 검증 표시(review_env_ready 의 두 조건). 기본 dry-run. 실행 대상은 허용 목록만(lib/ap-generation/verify-guard.ts):
//   --target local(기본) | --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq   (그 외 호스트·프로덕션은 거부)
// 접속 값은 환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 에서만 읽고 출력하지 않는다.
//   npx tsx scripts/ap-generation/mark-verified.ts --render [--report data/ap/render-check/report.json] [--execute]
//     렌더 게이트(lib/ap-figures/gate) 통과·해당 없음 + 렌더 보고서의 contentHash(자료+선지+정답)가 DB 후보 payload 해시와 같은 후보만 render_verified 로. 불일치는 건너뛰고 목록 출력.
//   npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence <evidence.json> [--execute]
//     증거 항목(content_hash·뷰포트·스크린샷·시각·점검자·필수 점검 결과)이 현재 DB 후보 내용 해시와 일치하고 모바일·데스크톱 모두 전 항목 통과한 후보만 screen_verified 로. 스키마: docs/ap/screen-evidence.schema.json. 증거 생성: scripts/ap-generation/screen-evidence.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { readKeysFile } from "./keys-file";
import { loadEnvLocal } from "../keywords/db";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { checkRenderedMatchesDb, AUTOMATED_LIMITATION, judgeScreenEntries, resolveVerifyTarget, type RenderReportRow, type ScreenEntry, type ScreenEvidence } from "../../lib/ap-generation/verify-guard";

const has = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
async function main() {
  const execute = has("execute");
  if (!has("render") && !has("screen")) throw new Error("--render 또는 --screen 이 필요합니다.");
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY 환경변수가 없습니다.");
  const target = resolveVerifyTarget({ url, target: arg("target"), confirm: arg("i-know-nonprod") });
  const label = target.kind === "local" ? "local" : `nonprod(${target.ref})`;
  console.log(`대상: ${label} / ${execute ? "EXECUTE" : "dry-run"}`);
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url!, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: admin } = await db.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const { data, error } = await db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, payload, render_verified, screen_verified, screen_evidence, defect_flags").eq("is_current", true).eq("review_state", "auto_passed").is("problem_id", null);
  if (error) throw new Error(error.message);
  // --keys-file <JSON 배열 또는 줄 단위 후보 키>: 선택된 후보만 대상으로 한다(예: AB 풀 세트 선택 48건).
  const keysFile = arg("keys-file");
  const only = keysFile ? new Set(readKeysFile(keysFile).keys) : null;
  const rows = (data ?? []).filter((r) => !only || only.has(r.candidate_key));
  if (only) console.log(`선택 목록 ${only.size}건 중 DB 대상 ${rows.length}건`);
  if (has("render")) {
    const reportPath = path.resolve(process.cwd(), arg("report") ?? "data/ap/render-check/report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf-8")) as { results: RenderReportRow[] };
    const byKey = new Map(report.results.map((r) => [r.key, r]));
    let ok = 0, already = 0; const skipped: string[] = [];
    for (const r of rows) {
      if (r.render_verified) { already++; continue; }
      if (Array.isArray(r.defect_flags) && r.defect_flags.length) { skipped.push(`${r.candidate_key}: 생성기 결함 플래그(${r.defect_flags.join(", ")}) — 렌더 검증 대상 아님`); continue; }
      const g = gateCandidate({ candidateKey: r.candidate_key, apSubjectCode: r.ap_subject_code, kind: r.kind, payload: r.payload });
      if (g.status === "fail") { skipped.push(`${r.candidate_key}: 렌더 게이트 실패(${g.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")})`); continue; }
      const m = checkRenderedMatchesDb(byKey.get(r.candidate_key), r.payload);
      if (!m.ok) { skipped.push(`${r.candidate_key}: ${m.reason}`); continue; }
      ok++;
      if (execute) { const { error: e } = await db.rpc("ap_set_verification", { p_candidate_key: r.candidate_key, p_render: true, p_screen: null, p_evidence: { gate: "ap-figures/gate", status: g.status, renderType: g.renderType, need: g.need, contentHash: byKey.get(r.candidate_key)!.contentHash, report: path.relative(process.cwd(), reportPath), at: new Date().toISOString() }, p_actor: admin?.id }); if (e) throw new Error(e.message); }
    }
    for (const s of skipped) console.log(`- 건너뜀 ${s}`);
    console.log(`렌더 검증 ${execute ? "기록" : "대상"} ${ok}건, 건너뜀 ${skipped.length}건, 이미 검증됨 ${already}건 (후보 ${rows.length}건)`);
  }
  if (has("screen")) {
    const file = arg("evidence"); if (!file) throw new Error("--evidence <json> 이 필요합니다(증거 없이는 화면 검증을 기록하지 않습니다).");
    const evPath = path.resolve(process.cwd(), file);
    const ev = JSON.parse(readFileSync(evPath, "utf-8")) as ScreenEvidence;
    if (!Array.isArray(ev.entries) || !ev.entries.length) throw new Error("증거 파일에 entries 가 없습니다.");
    const byCand = new Map<string, ScreenEntry[]>();
    for (const e of ev.entries) (byCand.get(e.candidate_key) ?? byCand.set(e.candidate_key, []).get(e.candidate_key)!).push(e);
    const skipped: string[] = [];
    const known = new Set(rows.map((r) => r.candidate_key));
    for (const k of byCand.keys()) if (!known.has(k)) skipped.push(`${k}: 대상 후보 아님(DB 에 없거나 auto_passed 아님/이미 변환)`);
    let n = 0, relabeled = 0, already = 0;
    for (const r of rows) {
      const es = byCand.get(r.candidate_key);
      if (!es) continue;
      if (!r.render_verified) { skipped.push(`${r.candidate_key}: 렌더 검증이 먼저입니다.`); continue; }
      const v = judgeScreenEntries(es, r.payload, process.cwd(), { requireResult: ev.schema === "ap-screen-evidence/v2" || ev.schema === "ap-screen-evidence/v3", requireStimulus: ev.schema === "ap-screen-evidence/v3" }); // screenshot 은 저장소 루트 기준 상대경로
      if (!v.ok) { skipped.push(`${r.candidate_key}: ${v.reason}`); continue; }
      const kind = es.every((e) => e.checker_kind === "automated") ? "automated" : es.every((e) => e.checker_kind === "human") ? "human" : "mixed";
      const prev = r.screen_evidence as { checkerKind?: string; contentHash?: string; evidenceSchema?: string } | null;
      if (r.screen_verified && prev?.checkerKind === kind && prev?.contentHash === es[0].content_hash && prev?.evidenceSchema === (ev.schema ?? null)) { already++; continue; }
      if (r.screen_verified) relabeled++; else n++; // 이미 검증된 후보는 해시를 바꾸지 않고 증거 라벨만 갱신한다(멱등)
      const evidence = { evidenceSchema: ev.schema ?? null, checkerKind: kind, contentHash: es[0].content_hash, limitations: kind === "human" ? null : AUTOMATED_LIMITATION, entries: es.map((e) => ({ checker_kind: e.checker_kind, viewport: e.viewport, screenshot: e.screenshot, timestamp: e.timestamp, checker: e.checker, checks: e.checks })), generator: ev.generator ?? null, at: new Date().toISOString() };
      if (execute) { const { error: x } = await db.rpc("ap_set_verification", { p_candidate_key: r.candidate_key, p_render: null, p_screen: true, p_evidence: evidence, p_actor: admin?.id }); if (x) throw new Error(x.message); }
    }
    console.log(`화면 검증(${execute ? "기록" : "대상"}) 신규 ${n}건, 라벨 갱신 ${relabeled}건, 이미 같은 증거 ${already}건`);
    for (const s of skipped) console.log(`- 건너뜀 ${s}`);
    console.log(`건너뜀 ${skipped.length}건`);
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
