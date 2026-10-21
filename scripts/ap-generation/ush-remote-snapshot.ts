// 읽기 전용 SELECT(쓰기 없음): 원격 비프로덕션에 있는 모든 AP U.S. History 모의고사 세트(공개·초안, 모든 버전)에 들어 있는 후보 키·문제 id 를 모아 스냅샷으로 저장한다.
//   npx tsx scripts/ap-generation/ush-remote-snapshot.ts data/ap/stock/ush-remote-snapshot-2026-10-21.json --remote-ref worpsqwqgnspddnrtnvq
// US3 exact-assign 이 공개된 US1·US2(및 모든 기존 세트)와 키·문제 id·문항군이 겹치지 않는지 로컬 파일이 아니라 이 원격 스냅샷 기준으로 확인하는 데 쓴다. 값은 환경변수에서만 읽고 출력하지 않는다.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { connect } from "../keywords/db";

/** 원격 프로젝트 ref 를 주면 Supabase CLI 의 로그인 권한으로 service_role 키를 프로세스 메모리에서만 받아 읽기 전용 SELECT 에 쓴다(출력·저장하지 않음). 쓰기 호출은 이 파일에 없다. */
function remoteClient(ref: string) {
  const keys = JSON.parse(execFileSync("npx", ["supabase", "projects", "api-keys", "--project-ref", ref, "-o", "json"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })) as { name: string; api_key: string }[];
  const key = keys.find((k) => k.name === "service_role")?.api_key; if (!key) throw new Error("service_role 키를 받지 못했습니다.");
  return { db: createClient(`https://${ref}.supabase.co`, key, { auth: { autoRefreshToken: false, persistSession: false } }), target: `${ref}.supabase.co` };
}

async function main() {
  const out = process.argv[2]; if (!out) throw new Error("출력 경로가 필요합니다.");
  const ref = process.argv.includes("--remote-ref") ? process.argv[process.argv.indexOf("--remote-ref") + 1] : "";
  const c = ref ? remoteClient(ref) : await connect(); if (!c) throw new Error("env 없음");
  const { db, target } = c; console.error("대상(읽기 전용)", target);
  const sets: { id: string; name: string; status: string }[] = [];
  for (let f = 0; ; f += 1000) { const { data, error } = await db.from("mock_exam_sets").select("id,name,status").ilike("name", "AP U.S. History%").range(f, f + 999); if (error) throw error; sets.push(...((data ?? []) as typeof sets)); if (!data || data.length < 1000) break; }
  console.error("세트", sets.length, [...new Set(sets.map((s) => `${s.name}:${s.status}`))].join(" | "));
  const bySet: Record<string, { status: string; keys: string[]; problemIds: string[] }> = {}; const keys = new Set<string>(); const ids = new Set<string>();
  for (const s of sets) {
    const { data: items, error } = await db.from("mock_exam_set_items").select("problem_id").eq("exam_set_id", s.id); if (error) throw error;
    const pids = [...new Set((items ?? []).map((i) => i.problem_id as string))]; const ks = new Set<string>();
    for (let i = 0; i < pids.length; i += 100) { const { data: ps, error: e2 } = await db.from("problems").select("id,ap_candidate_key").in("id", pids.slice(i, i + 100)); if (e2) throw e2; for (const p of ps ?? []) { ids.add(p.id as string); if (p.ap_candidate_key) { ks.add(p.ap_candidate_key as string); keys.add(p.ap_candidate_key as string); } } }
    const e = bySet[s.name] ?? (bySet[s.name] = { status: s.status, keys: [], problemIds: [] }); e.keys = [...new Set([...e.keys, ...ks])].sort(); e.problemIds = [...new Set([...e.problemIds, ...pids])].sort();
    if (e.status !== s.status) e.status = `${e.status}+${s.status}`;
  }
  writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), target, setCount: sets.length, sets: bySet, keys: [...keys].sort(), problemIds: [...ids].sort() }, null, 1));
  console.error("후보 키", keys.size, "문제 id", ids.size);
}
main().catch((e) => { console.error(e); process.exit(1); });
