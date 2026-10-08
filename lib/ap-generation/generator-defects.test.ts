import { describe, expect, it } from "vitest";
import { generatorDefects } from "./generator-defects";
const base = { stem: "What is $f'(1)$?", options: [{ text: "$4$" }, { text: "$3$" }, { text: "$0$" }, { text: "$-4$" }], key_index: 0, stimulus: { kind: "none", description: "", data: {} } };
describe("생성기 결함 탐지", () => {
  it("정상 문항은 결함이 없다", () => { expect(generatorDefects(base)).toEqual([]); });
  it("문자열 stimulus 의 중괄호 미닫힘을 잡는다", () => { expect(generatorDefects({ ...base, stimulus: '{"kind":"graph","data":{"x_axis":{"l' }).map((d) => d.code)).toContain("unbalanced_braces"); });
  it("[object Object] 보기를 잡는다", () => { expect(generatorDefects({ ...base, options: [{ text: "[object Object]" }, { text: "$3$" }] }).map((d) => d.code)).toContain("object_object_option"); });
  it("표 본문 누락·행 폭 불일치·빈 칸을 잡는다", () => {
    expect(generatorDefects({ ...base, stimulus: { kind: "table", description: "t", data: { columns: ["x", "f(x)"], rows: [] } } }).map((d) => d.code)).toContain("table_body_missing");
    expect(generatorDefects({ ...base, stimulus: { kind: "table", description: "t", data: { columns: ["x", "f(x)"], rows: [["1", "2", "3"]] } } }).map((d) => d.code)).toContain("table_row_width_mismatch");
    expect(generatorDefects({ ...base, stimulus: { kind: "table", description: "t", data: { columns: ["x", "f(x)"], rows: [["1", ""]] } } }).map((d) => d.code)).toContain("table_empty_cell");
  });
  it("2열 표에서 같은 입력의 값이 모순이면 잡는다", () => { expect(generatorDefects({ ...base, stimulus: { kind: "table", description: "t", data: { columns: ["x", "f(x)"], rows: [["1", "2"], ["1", "5"]] } } }).map((d) => d.code)).toContain("table_contradictory_rows"); });
  it("\\begin 환경 미닫힘과 \\left/\\right 불균형을 잡는다", () => { const c = generatorDefects({ ...base, stem: "Let $f(x)=\\begin{cases} x & x<1 \\\\ 2 & x\\ge 1$ and $\\left(x$" }).map((d) => d.code); expect(c).toContain("unclosed_latex_environment"); expect(c).toContain("unbalanced_left_right"); });
});
