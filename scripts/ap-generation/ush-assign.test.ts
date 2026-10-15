import { describe, expect, it } from "vitest";
import { ushUnitBounds } from "../../lib/ap-exam/ush-rules";
import { solveUshSets, verifyUshAssignment } from "./ush-assign";
import type { UshItem } from "./ush-pool";

// 합성 재고(단원 1–9 세트 + 토픽 단원과 후보 keyword_code 단원이 어긋난 미끼 세트). 관리자 점검은 keyUnit 으로 센다.
let n = 0; const stims = ["primary_text", "secondary_text", "paired_text", "quantitative"];
const mk = (keyUnit: string, topicUnit: string, size: number): UshItem => {
  const i = n++;
  return { keyUnit, key: `s${i}`, kind: "mc", members: Array.from({ length: size }, (_, m) => { const cat = String(((i + m) % 5) + 1); return { skill: `${cat}.A`, cat, topic: `${topicUnit}.1`, unit: topicUnit }; }), fam: `f${i}`, template: "", period: 0, stim: stims[i % stims.length], theme: `t${i}`, screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 };
};
const frq = (template: string, period: number): UshItem => { const i = n++; return { keyUnit: "", key: `q${i}`, kind: "frq", members: [], fam: `q${i}`, template, period, stim: "", theme: "", screen: true, batch: "t", renderType: "text", stimKind: "text", exam: 0 }; };
const stock = () => {
  n = 0; const out: UshItem[] = [];
  for (const u of Object.keys(ushUnitBounds())) for (const size of [3, 3, 4, 4]) out.push(mk(u, u, size));
  for (const [k, t] of [["3", "4"], ["3", "4"], ["4", "3"], ["9", "1"], ["1", "9"]]) out.push(mk(k, t, 4)); // 미끼: 토픽 단원 ≠ DB 단원
  out.push(frq("saq1", 1), frq("saq2", 2), frq("saq3", 3), frq("dbq", 4), frq("leq", 5));
  return out;
};
const dbCounts = (sets: UshItem[]) => { const c: Record<string, number> = {}; for (const s of sets) c[s.keyUnit] = (c[s.keyUnit] ?? 0) + s.members.length; return c; };

describe("US History exact assignment constrains on the DB (keyword_code) unit", () => {
  it("the chosen exam stays inside the unit bounds as the admin check counts them (set key unit x members), and the verifier flags a DB-unit violation", () => {
    const { res, out } = solveUshSets(["US1"], stock(), { timeMs: 20000 });
    expect(["optimal", "limit"]).toContain(res.status); expect(out[0].sets.length).toBeGreaterThan(0);
    const c = dbCounts(out[0].sets);
    for (const [u, b] of Object.entries(ushUnitBounds())) { expect(c[u] ?? 0).toBeGreaterThanOrEqual(b.min); expect(c[u] ?? 0).toBeLessThanOrEqual(b.max); }
    expect(verifyUshAssignment(out)).toEqual([]);
    const bad = { ...out[0], sets: out[0].sets.map((s, i) => (i < 3 ? { ...s, keyUnit: "9" } : s)) };
    expect(verifyUshAssignment([bad]).some((v) => /db_unit_/.test(v))).toBe(true);
  }, 60000);
});
