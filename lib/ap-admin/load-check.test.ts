import { describe, expect, it } from "vitest";
import { computeLoadCheck } from "./load-check";

const row = (k: string, render: boolean, screen: boolean, ready: boolean) => ({ candidate_key: k, review_state: "auto_passed", render_verified: render, screen_verified: screen, review_env_ready: ready });
describe("computeLoadCheck", () => {
  it("배치별 적재·렌더·화면·준비 수와 부족 표시(불일치 강조용)를 센다", () => {
    const r = computeLoadCheck([{ id: "a", label: "A", keys: ["k1", "k2", "k3"] }, { id: "b", label: "B", keys: ["k4"] }], [row("k1", true, true, true), row("k2", true, false, false), row("k4", true, true, true), row("zz", true, true, true)]);
    expect(r.batches[0]).toMatchObject({ keys: 3, loaded: 2, render: 2, screen: 1, ready: 1, short: true, missingKeys: ["k3"] });
    expect(r.batches[1]).toMatchObject({ short: false, ready: 1 });
    expect(r.totals).toEqual({ keys: 4, ready: 2, shortBatches: 1, dbRows: 4 });
  });
  it("빈 입력", () => { expect(computeLoadCheck([], []).totals).toEqual({ keys: 0, ready: 0, shortBatches: 0, dbRows: 0 }); });
});
