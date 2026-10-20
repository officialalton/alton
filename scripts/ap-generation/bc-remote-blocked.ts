// 읽기 전용 SELECT: 원격 비프로덕션의 모든 AP Calculus 세트(공개·초안, 모든 버전)에 들어 있는 후보 키를 모은다. 사용: npx tsx scripts/ap-generation/bc-remote-blocked.ts <출력.json> [제외 세트 이름 정규식]
import { writeFileSync } from "node:fs";
import { connect } from "../keywords/db";

async function main() {
  const c = await connect(); if (!c) throw new Error("env 없음");
  const { db, target } = c; console.error("대상", target);
  const sets: { id: string; name: string; status: string }[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await db.from("mock_exam_sets").select("id,name,status").ilike("name", "AP Calculus%").range(f, f + 999); if (error) throw error; sets.push(...(data ?? [])); if ((data ?? []).length < 1000) break; }
  console.error("세트", sets.length, [...new Set(sets.map((s) => `${s.name}:${s.status}`))].slice(0, 40).join(" | "));
  const skip = process.argv[3] ? new RegExp(process.argv[3]) : null;
  const keys = new Set<string>(); const per: Record<string, number> = {};
  for (const s of sets) {
    if (skip && skip.test(s.name)) continue;
    const { data: items, error } = await db.from("mock_exam_set_items").select("problem_id").eq("exam_set_id", s.id); if (error) throw error;
    const ids = (items ?? []).map((i) => i.problem_id as string);
    for (let i = 0; i < ids.length; i += 100) { const { data: ps, error: e2 } = await db.from("problems").select("ap_candidate_key").in("id", ids.slice(i, i + 100)); if (e2) throw e2; for (const p of ps ?? []) if (p.ap_candidate_key) { keys.add(p.ap_candidate_key as string); per[`${s.name}:${s.status}`] = (per[`${s.name}:${s.status}`] ?? 0) + 1; } }
  }
  console.error(per);
  writeFileSync(process.argv[2], JSON.stringify({ keys: { mcA: [...keys].sort(), mcB: [], frqA: [], frqB: [] } }));
  console.error("차단 키", keys.size);
}
main().catch((e) => { console.error(e); process.exit(1); });
