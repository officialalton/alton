// A4 독립 검증기: 컴파일러가 만든 내부 정보(선택지 인용 메타·정답 계산)를 쓰지 않고, 문항 텍스트(선택지)와 figure 데이터만 읽어
//  (1) 선택지가 인용한 모든 값이 자료와 정확히 같은지, (2) 주장을 실제로 뒷받침하는 선택지가 정확히 하나이고 그것이 정답 표시와 같은지 다시 판정한다.
//   npx tsx scripts/mock-exam-generation/rw-quant-verify.ts [--in data/mock-exam-generation/sat-quant-20261020/final/built-all.json]
import { readFileSync } from "node:fs";
import path from "node:path";

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (s: string) => Number(s.replace(/,/g, ""));
const numsIn = (t: string) => Array.from(t.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)).map((m) => ({ v: num(m[0]), i: m.index ?? 0 }));

type Rows = Map<string, number[]>;
function rowsOf(fig: J): { rows: Rows; order: string[]; cats: string[] | null } {
  const rows: Rows = new Map(); const order: string[] = [];
  if (fig.kind === "table") { for (const r of fig.rows) { const k = String(r[0]); order.push(k); rows.set(k, r.slice(1).map(Number)); } return { rows, order, cats: null }; }
  const cats: string[] = fig.categories; cats.forEach((c, i) => { order.push(c); rows.set(c, fig.series.map((s: J) => s.values[i])); });
  return { rows, order, cats: fig.kind === "line" ? cats : null };
}

export function verifyItem(b: J): string[] {
  const errs: string[] = []; const { rows, order, cats } = rowsOf(b.figure);
  const supports: boolean[] = []; const claim = b.claim;
  b.options.forEach((opt: string, oi: number) => {
    const low = opt.toLowerCase();
    if (cats) {
      // 선그래프: 기간(범주)·값을 구분해 읽는다.
      const nums = numsIn(opt).map((x) => x.v);
      const periods = nums.filter((n) => cats.includes(String(n)));
      const vals = nums.filter((n) => !cats.includes(String(n)) || false);
      if (periods.length !== 2 || vals.length !== 2) { errs.push(`opt${oi}: 기간 2개·값 2개가 아님`); supports.push(false); return; }
      const [p1, p2] = periods.map((p) => cats.indexOf(String(p)));
      const sv = (rows.get(cats[p1]) ?? [NaN])[0], ev = (rows.get(cats[p2]) ?? [NaN])[0];
      if (vals[0] !== sv || vals[1] !== ev) errs.push(`opt${oi}: 인용 값이 자료와 다름`);
      supports.push(p2 === p1 + 1 && ev - sv > claim.threshold); return;
    }
    // 표·막대: 선택지에 나온 항목 이름을 순서대로 찾고, 뒤따르는 숫자를 그 행의 값과 비교한다.
    const hits = order.map((k) => ({ k, i: low.indexOf(k.toLowerCase()) })).filter((h) => h.i >= 0).sort((a, b2) => a.i - b2.i);
    const nums = numsIn(opt);
    const cited: string[] = [];
    hits.forEach((h, hi) => {
      const end = hi + 1 < hits.length ? hits[hi + 1].i : opt.length;
      const got = nums.filter((n) => n.i > h.i && n.i < end).map((n) => n.v);
      const want = rows.get(h.k)!;
      if (JSON.stringify(got) !== JSON.stringify(want)) errs.push(`opt${oi}: ${h.k} 인용 ${JSON.stringify(got)} ≠ 자료 ${JSON.stringify(want)}`);
      cited.push(h.k);
    });
    const covered = hits.reduce((s, h, hi) => s + (nums.filter((n) => n.i > h.i && n.i < (hi + 1 < hits.length ? hits[hi + 1].i : opt.length)).length), 0);
    if (covered !== nums.length) errs.push(`opt${oi}: 항목에 귀속되지 않는 숫자가 있음`);
    const val = (k: string, j = 0) => rows.get(k)![j];
    let ok = false;
    if (claim.type === "PAIR") ok = cited.includes(claim.p) && cited.includes(claim.q);
    else if (claim.type === "RATIO") { const others = cited.filter((k) => k !== claim.q); ok = cited.includes(claim.q) && others.length === 1 && val(others[0]) > claim.factor * val(claim.q); }
    else if (claim.type === "TARGET") ok = cited.length === 1 && val(cited[0], 1) >= val(cited[0], 0);
    else if (claim.type === "CHANGE") ok = cited.length === 1 && val(cited[0], 1) - val(cited[0], 0) > claim.threshold;
    supports.push(ok);
  });
  const n = supports.filter(Boolean).length;
  if (n !== 1) errs.push(`주장을 뒷받침하는 선택지가 ${n}개`);
  else if (supports.indexOf(true) !== b.correctIndex) errs.push(`정답 표시(${b.correctIndex})와 독립 판정(${supports.indexOf(true)})이 다름`);
  if (new Set(b.options).size !== b.options.length) errs.push("중복 선택지");
  return errs;
}

if (new RegExp("rw-quant-verify\\.ts$").test(process.argv[1] ?? "")) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const items = JSON.parse(readFileSync(path.resolve(arg("--in") ?? "data/mock-exam-generation/sat-quant-20261020/final/built-all.json"), "utf8")) as J[];
  let bad = 0;
  for (const b of items) { const e = verifyItem(b); if (e.length) { bad++; console.log(b.gid, e.join(" | ")); } }
  console.log(`independent verify: ${items.length - bad}/${items.length} pass`);
  process.exit(bad ? 1 : 0);
}
