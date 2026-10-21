// BC4 로컬 선검증(읽기 전용): 관리자 화면 '독립 검증'과 같은 planDraftSet 코드 경로. 사용: npx tsx scripts/ap-generation/bc4-preverify.ts <배정.json> <원격 세트-키 SELECT.json> <원격 후보 상태 SELECT.json>
import { readFileSync } from "node:fs";
import { planDraftSet, stockItems, type FullSetUsage, type PoolRow } from "../../lib/ap-admin/assemble-draft";
import { published } from "./assign-pool";

const rows = (f: string) => { const t = readFileSync(f, "utf-8"); const s = t.slice(t.indexOf("{")); let d = 0, e = 0; for (let i = 0; i < s.length; i++) { if (s[i] === "{") d++; else if (s[i] === "}" && --d === 0) { e = i + 1; break; } } return JSON.parse(s.slice(0, e)).rows as Record<string, unknown>[]; };
const [rep, setsF, stF] = process.argv.slice(2);
const set = (JSON.parse(readFileSync(rep, "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] }[] }).sets[0];
const by = new Map<string, FullSetUsage>();
for (const r of rows(setsF)) { if (r.status === "archived" || r.ap_label !== "full_practice") continue; const id = `${r.name}#${r.version_no}`; const u = by.get(id) ?? { id, name: r.name as string, status: r.status as string, problemIds: [], candidateKeys: [] }; u.problemIds.push(r.k as string); u.candidateKeys.push(r.k as string); by.set(id, u); }
const pool: PoolRow[] = rows(stF).map((r) => ({ candidate_key: r.candidate_key as string, kind: "", keyword_code: "x", difficulty_provisional: null, purpose: r.purpose as string, is_current: r.is_current as boolean, render_verified: r.render_verified as boolean, screen_verified: r.screen_verified as boolean, ap_candidate_problems: Array.from({ length: Number(r.np) }, (_, i) => ({ item_index: i, problem_id: r.candidate_key as string, problem_version_id: "v" })) }));
const pub = published();
const plan = planDraftSet({ setId: set.id, keys: set, hasVirtual: false, pool, existingFullSets: [...by.values()], publishedKeys: new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]), stock: stockItems() });
console.log(`${plan.name}: 구성 ${JSON.stringify(plan.composition)}, 기존 풀 세트 ${by.size}개, 위반 ${plan.problems.length}`);
for (const p of plan.problems) console.log(" -", p);
process.exit(plan.ok ? 0 : 1);
