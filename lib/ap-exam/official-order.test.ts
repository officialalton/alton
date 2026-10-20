import { describe, expect, it } from "vitest";
import { frqOrderComplies, sortFrqByOfficialOrder } from "./official-order";

const T: Record<string, string> = { a: "bio_q3_investigation", b: "bio_q1_results", c: "bio_q2_graphing", d: "bio_q6_data", e: "bio_q4_conceptual", f: "bio_q5_model" };

describe("공식 FRQ 번호 순", () => {
  it("Biology: Q1~Q6 순으로 정렬한다", () => {
    expect(sortFrqByOfficialOrder("ap_biology", ["a", "b", "c", "d", "e", "f"], (k) => T[k])).toEqual(["b", "c", "a", "e", "f", "d"]);
  });
  it("Economics: Long 이 먼저, Short 둘은 입력 순서를 유지한다", () => {
    const t: Record<string, string> = { x: "short_trade", y: "long_pc_firm", z: "short_game_theory" };
    expect(sortFrqByOfficialOrder("ap_microeconomics", ["x", "y", "z"], (k) => t[k])).toEqual(["y", "x", "z"]);
  });
  it("Physics 1 / Psychology / Language 순서", () => {
    const p: Record<string, string> = { a: "qqt", b: "mr", c: "lab", d: "tbr" };
    expect(sortFrqByOfficialOrder("ap_physics_1", ["a", "b", "c", "d"], (k) => p[k])).toEqual(["b", "d", "c", "a"]);
    expect(sortFrqByOfficialOrder("ap_psychology", ["x", "y"], (k) => ({ x: "ebq", y: "aaq" }[k]))).toEqual(["y", "x"]);
    expect(sortFrqByOfficialOrder("ap_english_language", ["x", "y", "z"], (k) => ({ x: "q3", y: "q1", z: "q2" }[k]))).toEqual(["y", "z", "x"]);
  });
  it("규칙이 없는 과목(Chemistry)이나 유형을 모르는 키가 있으면 입력 순서를 바꾸지 않는다", () => {
    expect(sortFrqByOfficialOrder("ap_chemistry", ["b", "a"], () => "long")).toEqual(["b", "a"]);
    expect(sortFrqByOfficialOrder("ap_biology", ["b", "a"], (k) => (k === "a" ? undefined : "bio_q1_results"))).toEqual(["b", "a"]);
  });
  it("frqOrderComplies", () => {
    expect(frqOrderComplies("ap_computer_science_a", ["q1", "q2", "q3", "q4"])).toBe(true);
    expect(frqOrderComplies("ap_computer_science_a", ["q2", "q1", "q3", "q4"])).toBe(false);
    expect(frqOrderComplies("ap_chemistry", ["long"])).toBeNull();
  });
});
