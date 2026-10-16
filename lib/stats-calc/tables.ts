import { chiInv, normCdf, normInv, tInv } from "./dist";

/** 상대오차 비교 시 0으로 나누는 것을 막는 하한(테스트용). */
export const ABSOLUTE_FLOOR = 1e-300;

export type RefTable = { id: "z" | "t" | "chi"; title: string; note: string; columns: string[]; rows: { label: string; cells: string[] }[] };

// 표는 College Board 문서에서 옮기지 않고, 수치 함수(dist.ts)로 직접 계산해 만든다.
// 값이 필요할 때 한 번 계산해 메모해 둔다(네트워크·서버 불필요).
const memo: Partial<Record<RefTable["id"], RefTable>> = {};

/** 표준정규 누적확률 Φ(z) — z = 행 + 열(음수 행은 열을 뺀다). 행 -3.4…-0.0, 0.0…3.4. */
export function zTable(): RefTable {
  if (memo.z) return memo.z;
  const columns = Array.from({ length: 10 }, (_, c) => `.0${c}`);
  const rows: RefTable["rows"] = [];
  for (let i = -34; i <= 34; i++) {
    const negative = i < 0 || Object.is(i, -0);
    const base = Math.abs(i) / 10;
    const label = `${negative ? "-" : ""}${base.toFixed(1)}`;
    rows.push({ label, cells: columns.map((_, c) => normCdf((negative ? -1 : 1) * (base + c / 100)).toFixed(4)) });
  }
  // -0.0 행(−0.09…0)을 0.0 행 앞에 둔다.
  const negZero = { label: "-0.0", cells: columns.map((_, c) => normCdf(-c / 100).toFixed(4)) };
  const at = rows.findIndex((r) => r.label === "0.0");
  rows.splice(at, 0, negZero);
  return (memo.z = {
    id: "z", title: "Standard normal: P(Z < z)",
    note: "Row = z to one decimal, column = second decimal. For negative rows the column is subtracted: row -1.6, column .04 is z = -1.64.",
    columns, rows,
  });
}

const TAILS = ["0.25", "0.20", "0.15", "0.10", "0.05", "0.025", "0.02", "0.01", "0.005", "0.0025", "0.001", "0.0005"];

export function tTable(): RefTable {
  if (memo.t) return memo.t;
  const dfs: (number | "∞")[] = [...Array.from({ length: 30 }, (_, i) => i + 1), 40, 50, 60, 80, 100, 120, "∞"];
  const rows = dfs.map((df) => ({ label: String(df), cells: TAILS.map((p) => (df === "∞" ? normInv(1 - Number(p)) : tInv(1 - Number(p), df)).toFixed(3)) }));
  return (memo.t = {
    id: "t", title: "t critical values t*: upper-tail area",
    note: "Columns are the area to the right of t*. A two-sided confidence level C uses the column with area (1 − C)/2: 95% → 0.025. For a df not listed, use the next smaller df (conservative) or the Statistics tab of the calculator (invT).",
    columns: TAILS, rows,
  });
}

export function chiTable(): RefTable {
  if (memo.chi) return memo.chi;
  const dfs = [...Array.from({ length: 30 }, (_, i) => i + 1), 40, 50, 60, 80, 100];
  const rows = dfs.map((df) => ({ label: String(df), cells: TAILS.map((p) => chiInv(1 - Number(p), df).toFixed(3)) }));
  return (memo.chi = {
    id: "chi", title: "Chi-square critical values: upper-tail area",
    note: "Columns are the area to the right of the value. For an exact p-value use the Statistics tab (χ² cdf).",
    columns: TAILS, rows,
  });
}

export const REF_TABLES = { z: zTable, t: tTable, chi: chiTable } as const;
