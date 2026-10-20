// A6 — 신규 AP 세트(BI3/4, PH3/4, MI3, CS3, MA3)의 문항을 같은 과목 기존 공개 세트 문항과 비교해 유사도 상위 쌍의 발췌를 나란히 담은 사람용 검토 문서를 만든다.
//   npx tsx scripts/audit/ap-new-set-similarity.ts   → docs/qa/ap-new-set-similarity-review-2026-10-19.md
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const D = "data/ap/stock/";
const pool = new Map<string, J>();
for (const f of readdirSync(D).filter((x) => /items\.json$/.test(x)).sort()) {
  let d: J; try { d = JSON.parse(readFileSync(D + f, "utf-8")); } catch { continue; }
  if (Array.isArray(d)) for (const r of d) if (r?.stockKey && !pool.has(r.stockKey)) pool.set(r.stockKey, r);
}
const asg = (f: string): J[] => JSON.parse(readFileSync(`${D}exact-assign-${f}.json`, "utf-8")).sets;
const keysOf = (s: J): string[] => Object.entries(s).filter(([k, v]) => k !== "id" && Array.isArray(v) && v.every((x) => typeof x === "string")).flatMap(([, v]) => v as string[]);

// [과목, 신규 배정(파일, 세트 id 목록), 비교 대상 공개 세트(파일)]
const SUBJECTS: { name: string; fresh: [string, string[]][]; pub: [string, string[] | null][] }[] = [
  { name: "AP Biology (BI3, BI4)", fresh: [["bio-bi3-bi4-r2", ["BI3", "BI4"]]], pub: [["bio-bi1-bi2-v4", null]] },
  { name: "AP Physics 1 (PH3, PH4)", fresh: [["phys-ph3-ph4", ["PH3", "PH4"]]], pub: [["phys-ph1-ph2", null]] },
  { name: "AP Microeconomics (MI3)", fresh: [["micro-mi3", ["MI3"]]], pub: [["micro-mi1-mi2", null]] },
  { name: "AP Computer Science A (CS3)", fresh: [["csa-cs3", ["CS3"]]], pub: [["csa-cs1-cs2", null]] },
  { name: "AP Macroeconomics (MA3)", fresh: [["macro-ma3-v2", ["MA3"]]], pub: [["macro-ma1-ma2-v3", null]] },
];

const textOf = (r: J): string => {
  const p = r.payload ?? {};
  const opts = Array.isArray(p.options) ? p.options.map((o: J) => (typeof o === "string" ? o : o?.text ?? "")).join(" ") : "";
  return [p.passage, p.question, p.stem, opts, p.prompt].filter((x) => typeof x === "string").join(" ");
};
const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣.%]+/g, " ").split(/\s+/).filter(Boolean);
const shingles = (t: string[]) => { const o = new Set<string>(); for (let i = 0; i + 3 <= t.length; i++) o.add(t.slice(i, i + 3).join(" ")); return o; };
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
const excerpt = (r: J) => { const p = r.payload ?? {}; const q = String(p.question ?? p.stem ?? p.prompt ?? "").replace(/\s+/g, " "); const ps = String(p.passage ?? "").replace(/\s+/g, " "); const opts = Array.isArray(p.options) ? p.options.map((o: J, i: number) => `(${"ABCDE"[i]}) ${typeof o === "string" ? o : o?.text ?? ""}`).join(" ") : ""; return [ps && `[자료] ${ps.slice(0, 260)}${ps.length > 260 ? "…" : ""}`, `[문제] ${q.slice(0, 320)}${q.length > 320 ? "…" : ""}`, opts && `[보기] ${opts.slice(0, 260)}${opts.length > 260 ? "…" : ""}`].filter(Boolean).join("<br>").replace(/\|/g, "\\|"); };

let md = `# AP 신규 세트 유사도 검토 (2026-10-19)\n\n"풀이 틀이 다르다"는 판정이 원형 id·임계값 기반이라 사람이 직접 확인할 수 있도록, 과목별로 신규 세트 문항과 기존 공개 세트 문항 사이의 단어 3-gram Jaccard 유사도가 가장 높은 5쌍을 나란히 싣는다. 자료·문제·보기를 합친 텍스트 기준이며 숫자만 다른 형제 문항이면 높게 나온다. 생성기: \`scripts/audit/ap-new-set-similarity.ts\`.\n\n`;
for (const s of SUBJECTS) {
  const fresh: { set: string; key: string }[] = [];
  for (const [f, ids] of s.fresh) for (const set of asg(f)) if (ids.includes(set.id)) for (const key of keysOf(set)) fresh.push({ set: set.id, key });
  const pubKeys = new Set<string>();
  for (const [f] of s.pub) for (const set of asg(f)) for (const key of keysOf(set)) pubKeys.add(key);
  const freshKeys = new Set(fresh.map((x) => x.key));
  const pubSh = [...pubKeys].filter((k) => pool.has(k) && !freshKeys.has(k)).map((k) => ({ k, sh: shingles(tok(textOf(pool.get(k)))) }));
  const pairs: { j: number; set: string; a: string; b: string }[] = [];
  let nFresh = 0;
  for (const f of fresh) { const r = pool.get(f.key); if (!r) continue; nFresh++; const sh = shingles(tok(textOf(r))); let best = { j: -1, k: "" }; for (const p of pubSh) { const j = jac(sh, p.sh); if (j > best.j) best = { j, k: p.k }; } if (best.k) pairs.push({ j: best.j, set: f.set, a: f.key, b: best.k }); }
  pairs.sort((x, y) => y.j - x.j);
  md += `## ${s.name}\n\n비교: 신규 문항 ${nFresh}개 × 공개 세트 문항 ${pubSh.length}개. 신규 문항별 최근접 공개 문항의 유사도 중앙값 ${(pairs.map((p) => p.j).sort((a, b) => a - b)[Math.floor(pairs.length / 2)] ?? 0).toFixed(3)}, 최대 ${(pairs[0]?.j ?? 0).toFixed(3)}.\n\n| # | 유사도 | 신규(세트·키) | 신규 발췌 | 공개 키 | 공개 발췌 |\n|---|---|---|---|---|---|\n`;
  pairs.slice(0, 5).forEach((p, i) => { md += `| ${i + 1} | ${p.j.toFixed(3)} | ${p.set} · ${p.a} | ${excerpt(pool.get(p.a))} | ${p.b} | ${excerpt(pool.get(p.b))} |\n`; });
  md += `\n`;
}
md += `## 검토 소견 (2026-10-19 생성 시점)\n\n- Physics 1 1위 쌍(유사도 0.49): 같은 원형 m40의 k0/k1로 숫자만 다른 형제 문항(부력, 같은 문장). 신규 PH4 쪽 문항이 공개 문항과 같은 틀이므로 교체 후보다.\n- 그 외 과목은 최대 유사도가 0.31 이하이며, 상위 쌍도 같은 단원의 다른 상황·자료로 읽힌다(위 발췌로 직접 확인).\n- CS A는 코드 문항이 공통 어휘(public static, return 등)를 많이 공유해 중앙값이 높게 나온다. 어휘 중복이지 풀이 틀 중복이 아님을 발췌로 확인할 것.\n`;
writeFileSync("docs/qa/ap-new-set-similarity-review-2026-10-19.md", md);
console.log("wrote docs/qa/ap-new-set-similarity-review-2026-10-19.md");
