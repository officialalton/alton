// 렌더·화면 검증 표시(review_env_ready 의 두 조건). 기본 dry-run, --execute 는 로컬 DB 에서만(원격은 총괄).
//   npx tsx scripts/ap-generation/mark-verified.ts --render [--execute]                       # 렌더 게이트(lib/ap-figures/gate) 통과·해당 없음 후보를 render_verified 로
//   npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence docs/ap/screen-evidence.json [--execute]   # 학생 화면 검증 증거가 있는 후보만 screen_verified 로
// 화면 검증은 사람이 학생 화면(영어 UI·계산기·타이머·모바일)에서 확인한 뒤 증거 파일(후보 키 목록 + 확인 내용)을 남겨야만 올라간다 — 코드가 자동으로 true 로 만들지 않는다.
import { readFileSync } from "node:fs";
import { connect } from "../keywords/db";
import { gateCandidate } from "../../lib/ap-figures/gate";

const has = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
async function main() {
  const execute = has("execute");
  const conn = await connect(); if (!conn) throw new Error("DB 환경변수가 없습니다.");
  if (execute && conn.target !== "local") throw new Error(`--execute 는 로컬 DB 에서만 허용됩니다(대상: ${conn.target}).`);
  const { db } = conn;
  const { data: admin } = await db.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const { data, error } = await db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, payload, render_verified, screen_verified").eq("is_current", true).eq("review_state", "auto_passed").is("problem_id", null);
  if (error) throw new Error(error.message);
  if (has("render")) {
    let n = 0, skip = 0;
    for (const r of data ?? []) {
      if (r.render_verified) continue;
      const g = gateCandidate({ candidateKey: r.candidate_key, apSubjectCode: r.ap_subject_code, kind: r.kind, payload: r.payload });
      if (g.status === "fail") { skip++; console.log(`- ${r.candidate_key}: 렌더 게이트 실패(${g.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")})`); continue; }
      n++;
      if (execute) { const { error: e } = await db.rpc("ap_set_verification", { p_candidate_key: r.candidate_key, p_render: true, p_screen: null, p_evidence: { gate: "ap-figures/gate", status: g.status, renderType: g.renderType, need: g.need, at: new Date().toISOString() }, p_actor: admin?.id }); if (e) throw new Error(e.message); }
    }
    console.log(`렌더 검증 ${execute ? "기록" : "대상"} ${n}건, 게이트 실패 ${skip}건`);
  }
  if (has("screen")) {
    const file = arg("evidence"); if (!file) throw new Error("--evidence <json> 이 필요합니다.");
    const ev = JSON.parse(readFileSync(file, "utf-8")) as { verifiedAt: string; checks: string[]; candidateKeys: string[] };
    const keys = new Set(ev.candidateKeys);
    let n = 0;
    for (const r of data ?? []) {
      if (!keys.has(r.candidate_key) || r.screen_verified) continue;
      if (!r.render_verified) { console.log(`- ${r.candidate_key}: 렌더 검증이 먼저입니다.`); continue; }
      n++;
      if (execute) { const { error: e } = await db.rpc("ap_set_verification", { p_candidate_key: r.candidate_key, p_render: null, p_screen: true, p_evidence: { verifiedAt: ev.verifiedAt, checks: ev.checks }, p_actor: admin?.id }); if (e) throw new Error(e.message); }
    }
    console.log(`화면 검증 ${execute ? "기록" : "대상"} ${n}건`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
