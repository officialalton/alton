// 5세트 채우기(2026-10-21 오너 정리) CS A·Psychology 부족분: 세트 간 금지 = 동일 문항 + 구조 look-alike(fam 군집, Psychology 는 같은 질문·정답 sig 포함). 원형 id 전체 차단은 하지 않는다.
//   npx tsx scripts/ap-generation/topup-structure-block.ts csa|psych --sets CS4,CS5 [--write-report <경로>]  (읽기 전용·무료·DB 없음)
import { readFileSync, writeFileSync } from "node:fs";
const subj = process.argv[2]; const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
type It = { key: string; kind: string; shared: boolean; fam: string; archetype: string; members: { topic?: string }[]; sig?: string };
async function main() {
  const pubKeys = new Set<string>((JSON.parse(readFileSync(`data/ap/stock/blocked-db-${subj}.json`, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets.flatMap((s) => [...(s.mcA ?? []), ...(s.frqA ?? [])]));
  const ids = arg("--sets").split(",");
  let all: It[]; let solve: (ids: string[], bl: Set<string>, sigs: Set<string>) => { out: any[]; x: number }; let verify: (r: any[], b: Set<string>) => string[]; let rep: (r: any) => unknown;
  if (subj === "csa") {
    const { loadCsPool } = await import("./cs-pool"); const m = await import("./cs-assign");
    all = loadCsPool({ requireScreen: false }).all as unknown as It[];
    solve = (i, bl) => { const o: any[] = []; const b = new Set(bl); const ba = new Set<string>(); for (const id of i) { const one = m.solveCsSets([id], all as any, { timeMs: 120000, blocked: b, blockedArchetypes: ba, preferExamPrep: true, disjoint: false }); o.push(...one.out); for (const it of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) b.add(it.key); for (const it of [...one.out[0].sets, ...one.out[0].frq]) ba.add(it.archetype); for (const a of one.out[0].virtualSetArchetypes) ba.add(a); for (const v of one.out[0].frqVirtual) if (v.archetype) ba.add(v.archetype); } return { out: o, x: 1 }; };
    verify = (r, b) => m.verifyCsAssignment(r, b, { disjoint: false }); rep = m.toReportSet;
  } else {
    const { loadPsychPool } = await import("./psych-pool"); const m = await import("./psych-assign");
    all = loadPsychPool({ requireScreen: false }).all as unknown as It[];
    solve = (i, bl, sigs) => { const o: any[] = []; const b = new Set(bl); const sg = new Set(sigs); const ba = new Set<string>(); for (const id of i) { const one = m.solvePsychSets([id], all as any, { timeMs: 120000, blocked: b, blockedArchetypes: ba, blockedSigs: sg, preferExamPrep: true }); o.push(...one.out); for (const it of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) { b.add(it.key); if (it.sig) sg.add(it.sig); } for (const it of [...one.out[0].sets, ...one.out[0].frq]) ba.add(it.archetype); for (const a of one.out[0].virtualSetArchetypes) ba.add(a); for (const v of one.out[0].frqVirtual) if (v.archetype) ba.add(v.archetype); } return { out: o, x: 1 }; };
    verify = (r, b) => m.verifyPsychAssignment(r, b); rep = m.toReportSet;
  }
  const pubItems = all.filter((c) => pubKeys.has(c.key));
  const atKey = (c: It) => (c.shared ? c.archetype : `${c.archetype}|${c.members[0]?.topic}`);
  const pubFam = new Set(pubItems.map((c) => c.fam)), pubAT = new Set(pubItems.map(atKey)), pubArch = new Set(pubItems.map((c) => c.archetype)), pubSig = new Set(pubItems.map((c) => c.sig).filter(Boolean) as string[]);
  const rest = all.filter((c) => !pubKeys.has(c.key));
  const look = rest.filter((c) => pubFam.has(c.fam) || (c.sig && pubSig.has(c.sig)));
  const sameKey = rest.filter((c) => !look.includes(c) && pubAT.has(atKey(c)));
  const archOnly = rest.filter((c) => !look.includes(c) && !sameKey.includes(c) && pubArch.has(c.archetype));
  console.log(`[${subj}] 공개 문항 ${pubItems.length}/${pubKeys.size}, 공개 군 ${pubFam.size}, 재고(공개 제외) ${rest.length}: 구조 동일(look-alike) ${look.length}, 원형+토픽 동일 ${sameKey.length}, 원형만 동일(구조·토픽 다름, 허용) ${archOnly.length}`);
  const ex = (t: string, xs: It[]) => { console.log(`## ${t}`); for (const c of xs.slice(0, 2)) { const p = pubItems.find((q) => q.fam === c.fam || (c.sig && q.sig === c.sig)) ?? pubItems.find((q) => q.archetype === c.archetype); console.log(`- ${c.key} [${c.archetype} ${c.members[0]?.topic}] ↔ 공개 ${p?.key} [${p?.archetype} ${p?.members[0]?.topic}]`); } };
  ex("구조 동일", look); ex("원형+토픽 동일", sameKey); ex("원형만 동일(허용)", archOnly);
  const recov = new Set<string>((JSON.parse(readFileSync(`data/ap/stock/lookalike-recheck-${subj}.json`, "utf-8")) as { recoverable: string[] }).recoverable); // lookalike-recheck.ts: 자료·조건·과제가 달라 복구된 후보
  const blocked = new Set<string>([...pubKeys, ...look.map((c) => c.key), ...sameKey.map((c) => c.key)].filter((k) => !recov.has(k)));
  const { out } = solve(ids, blocked, pubSig);
  const bad = verify(out, blocked);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of out) { console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}`); const by: Record<string, number> = {}; for (const v of r.virtual) by[v.archetype] = (by[v.archetype] ?? 0) + 1; console.log("    가상 MC 원형:", JSON.stringify(by)); for (const v of r.frqVirtual) console.log(`    가상 FRQ ${v.type}`); }
  const w = arg("--write-report"); if (w) writeFileSync(w, JSON.stringify({ sets: out.map(rep as any), policy: "structure-level block (fam + archetype|topic + sig), not archetype-wide" }, null, 1));
}
main();
