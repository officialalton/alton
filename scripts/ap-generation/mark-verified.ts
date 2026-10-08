// 렌더·화면 검증 표시(review_env_ready 의 두 조건). 기본 dry-run. 실행 대상은 허용 목록만(lib/ap-generation/verify-guard.ts):
//   --target local(기본) | --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq   (그 외 호스트·프로덕션은 거부)
// 접속 값은 환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 에서만 읽고 출력하지 않는다.
//   npx tsx scripts/ap-generation/mark-verified.ts --render [--report data/ap/render-check/report.json] [--execute]
//     렌더 게이트(lib/ap-figures/gate) 통과·해당 없음 + 렌더 보고서의 contentHash(자료+선지+정답)가 DB 후보 payload 해시와 같은 후보만 render_verified 로. 불일치는 건너뛰고 목록 출력.
//   npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence <evidence.json> [--execute]
//     증거 파일의 항목({candidate_key, viewport, screenshot, timestamp, checker})이 모두 있고 스크린샷 파일이 실존하는 후보만 screen_verified 로. 증거 없이는 기록하지 않는다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "../keywords/db";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { checkRenderedMatchesDb, resolveVerifyTarget, validateScreenEntry, type RenderReportRow, type ScreenEntry, type ScreenEvidence } from "../../lib/ap-generation/verify-guard";

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
  const { data, error } = await db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, payload, render_verified, screen_verified").eq("is_current", true).eq("review_state", "auto_passed").is("problem_id", null);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (has("render")) {
    const reportPath = path.resolve(process.cwd(), arg("report") ?? "data/ap/render-check/report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf-8")) as { results: RenderReportRow[] };
    const byKey = new Map(report.results.map((r) => [r.key, r]));
    let ok = 0, already = 0; const skipped: string[] = [];
    for (const r of rows) {
      if (r.render_verified) { already++; continue; }
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
    const entries = new Map<string, ScreenEntry>();
    const skipped: string[] = [];
    for (const e of ev.entries) {
      const err = validateScreenEntry(e, process.cwd()); // screenshot 은 저장소 루트 기준 상대경로
      if (err) { skipped.push(`${e.candidate_key ?? "(키 없음)"}: ${err}`); continue; }
      entries.set(e.candidate_key, e);
    }
    let n = 0;
    for (const r of rows) {
      const e = entries.get(r.candidate_key);
      if (!e || r.screen_verified) continue;
      if (!r.render_verified) { skipped.push(`${r.candidate_key}: 렌더 검증이 먼저입니다.`); continue; }
      n++;
      if (execute) { const { error: x } = await db.rpc("ap_set_verification", { p_candidate_key: r.candidate_key, p_render: null, p_screen: true, p_evidence: { viewport: e.viewport, screenshot: e.screenshot, timestamp: e.timestamp, checker: e.checker, checks: ev.checks ?? [], at: new Date().toISOString() }, p_actor: admin?.id }); if (x) throw new Error(x.message); }
    }
    for (const s of skipped) console.log(`- 건너뜀 ${s}`);
    console.log(`화면 검증 ${execute ? "기록" : "대상"} ${n}건, 건너뜀 ${skipped.length}건`);
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "실패"); process.exit(1); });
