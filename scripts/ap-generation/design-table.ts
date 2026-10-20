// 확대 세트 문항 설계표(내용·기능·표현·추론·중복) JSON 생성(무료·읽기 전용). 배정 보고서의 모든 문항에 대해 후보 payload 의 설계도(blueprint)와 자료 형태를 모으고,
// 공개된 같은 과목 세트들의 문항과 문장 겹침(자카드)·원형 겹침을 계산해 '중복' 칸을 채운다.
//   npx tsx scripts/ap-generation/design-table.ts --report data/ap/stock/exact-assign-micro-mi3.json --published data/ap/stock/assembled/micro-mi1-mi2.json --subject ap_microeconomics --out data/ap/stock/design-table-micro-mi3.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "./keys-file";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SUBJECT = arg("--subject"); const OUT = arg("--out");
type Raw = { stockKey: string; apSubjectCode: string; kind: string; keywordCode?: string; skillPrimary?: string; itemFamilyId?: string; payload: Record<string, any> };
const rows = new Map<string, Raw>();
for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) if (SUBJECT.split(",").includes(r.apSubjectCode) && !rows.has(r.stockKey)) rows.set(r.stockKey, r); }
const keysOf = (file: string) => { const o = JSON.parse(readFileSync(file, "utf-8")) as { sets: { id: string; mcA?: string[]; mcB?: string[]; frqA?: string[]; frqB?: string[] }[] }; return o.sets.flatMap((s) => [...(s.mcA ?? []), ...(s.mcB ?? []), ...(s.frqA ?? []), ...(s.frqB ?? [])].map((k) => ({ set: s.id, key: k }))); };
const target = keysOf(arg("--report"));
const published = arg("--published").split(",").filter(Boolean).flatMap(keysOf);
const tok = (r: Raw) => {
  const p = r.payload; const parts = [String(p.stem ?? ""), ...((p.options as { text?: string }[] | undefined) ?? []).map((o) => o.text ?? ""), ...((p.parts as { prompt?: string }[] | undefined) ?? []).map((x) => x.prompt ?? ""), String(p.title ?? "")];
  return new Set(parts.join(" ").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
};
const jac = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / Math.max(1, a.size + b.size - i); };
const pubRows = published.map((p) => rows.get(p.key)).filter((r): r is Raw => !!r);
const pubArch = new Set(pubRows.map((r) => String(r.payload.archetype ?? "")).filter(Boolean));
const pubFam = new Set(pubRows.map((r) => r.itemFamilyId ?? "").filter(Boolean));
const pubTok = pubRows.map((r) => ({ key: r.stockKey, t: tok(r) }));
const stimKind = (r: Raw) => String((r.payload.stimulus as { kind?: string } | undefined)?.kind ?? "none");
const table = target.map(({ set, key }, i) => {
  const r = rows.get(key); if (!r) return { set, key, error: "재고에 없음" };
  const p = r.payload; const b = (p.blueprint ?? {}) as Record<string, any>; const t = tok(r);
  let best = { key: "", score: 0 }; for (const q of pubTok) { const s = jac(t, q.t); if (s > best.score) best = { key: q.key, score: Number(s.toFixed(3)) }; }
  const arch = String(p.archetype ?? "");
  return {
    position: i + 1, set, key, kind: r.kind,
    content: { unit: String(p.topic ?? r.keywordCode ?? "").split(".")[0], topic: p.topic ?? r.keywordCode, concept: b.concept ?? b.concept_tested ?? null },
    function: { skill: p.skill ?? r.skillPrimary, response: r.kind === "mc" ? "multiple choice" : "free response", judgment: b.judgment_demand ?? null },
    representation: { stimulus: stimKind(r), options: Array.isArray(p.options) ? p.options.length : null, parts: Array.isArray(p.parts) ? p.parts.length : null },
    reasoning: { student_thinking: b.student_thinking ?? null, verification: b.verification?.independent_path ?? null },
    duplication: { archetype: arch || null, family: r.itemFamilyId ?? null, archetype_in_published: arch ? pubArch.has(arch) : null, family_in_published: r.itemFamilyId ? pubFam.has(r.itemFamilyId) : null, nearest_published: best.key || null, nearest_similarity: best.score, siblings_in_new_set: 0 },
  };
});
for (const x of table as { duplication?: { archetype: string | null; siblings_in_new_set: number } }[]) if (x.duplication?.archetype) x.duplication.siblings_in_new_set = (table as { duplication?: { archetype: string | null } }[]).filter((y) => y.duplication?.archetype === x.duplication!.archetype).length - 1;
const summary = {
  items: table.length, publishedCompared: pubRows.length,
  archetypeSharedWithPublished: (table as { duplication?: { archetype_in_published: boolean | null } }[]).filter((x) => x.duplication?.archetype_in_published).length,
  familySharedWithPublished: (table as { duplication?: { family_in_published: boolean | null } }[]).filter((x) => x.duplication?.family_in_published).length,
  maxNearestSimilarity: Math.max(...(table as { duplication?: { nearest_similarity: number } }[]).map((x) => x.duplication?.nearest_similarity ?? 0)),
  siblingsInsideNewSet: (table as { duplication?: { siblings_in_new_set: number } }[]).filter((x) => (x.duplication?.siblings_in_new_set ?? 0) > 0).length,
  unitCounts: Object.fromEntries(Object.entries((table as { content?: { unit: string } }[]).reduce<Record<string, number>>((a, x) => { const u = x.content?.unit ?? "?"; a[u] = (a[u] ?? 0) + 1; return a; }, {})).sort()),
  stimulusCounts: (table as { representation?: { stimulus: string } }[]).reduce<Record<string, number>>((a, x) => { const u = x.representation?.stimulus ?? "?"; a[u] = (a[u] ?? 0) + 1; return a; }, {}),
};
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), subject: SUBJECT, report: arg("--report"), published: arg("--published"), summary, items: table }, null, 1));
console.log(JSON.stringify(summary));
