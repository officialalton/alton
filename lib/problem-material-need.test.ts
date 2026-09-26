import { describe, expect, it } from "vitest";
import { figureSatisfies, judgeMaterialNeed, materialBlocker, materialStatusLines } from "./problem-material-need";
import { composeProblemText, effectiveQuestion, hasQuestion, splitLegacyQuestion } from "./problem-question";

describe("자료 필요성 판정", () => {
  it("질문 문장의 단서가 우선한다 — 그래프·표·도형·그래프 선택지", () => {
    const plane = judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_equations_one_var", text: "The graph of line k in the xy-plane is shown. What is the slope of line k?" });
    expect(plane.level).toBe("required");
    expect(plane.kind).toBe("plane");
    expect(plane.reason).toMatch(/좌표평면 자료가 필요/);
    const data = judgeMaterialNeed({ examSystem: "sat_math", skillCode: "percentages", text: "The table shows the number of students. What percent…?" });
    expect(data).toMatchObject({ level: "required", kind: "data" });
    const geo = judgeMaterialNeed({ examSystem: "sat_math", skillCode: "area_volume", text: "In the figure, a circle is inscribed in a square. What is the area of the shaded region?" });
    expect(geo).toMatchObject({ level: "required", kind: "geometry" });
    expect(geo.geometry).toEqual(expect.arrayContaining(["composite", "circle", "polygon"]));
    const fc = judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_functions", text: "Which of the following graphs represents y = 2x + 1?" });
    expect(fc).toMatchObject({ level: "required", kind: "figure_choice" });
  });
  it("'The graph shows' 는 세부 기술로 가른다 — 함수 기술은 좌표평면, 자료 기술·R&W 는 표·그래프", () => {
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_functions", text: "The graph shows the line y = 2x + 1. What is the y-intercept?" })).toMatchObject({ level: "required", kind: "plane" });
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "two_variable_data", text: "The graph shows the heights of 20 plants. What is the median?" })).toMatchObject({ level: "required", kind: "data" });
    expect(judgeMaterialNeed({ examSystem: "sat_rw", skillCode: "command_of_evidence_quant", text: "The graph shows annual rainfall…" })).toMatchObject({ level: "required", kind: "data" });
  });
  it("단서가 없으면 세부 기술의 기본 판정 — 필수/권장/불필요", () => {
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "lines_angles_triangles", text: "Two angles are supplementary…" })).toMatchObject({ level: "required", kind: "geometry" });
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_functions", text: "f(x) = 3x - 2. What is f(4)?" })).toMatchObject({ level: "recommended", kind: "plane" });
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_equations_one_var", text: "If 2x + 3 = 11, what is x?" })).toMatchObject({ level: "none", kind: null });
    expect(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "one_variable_data", text: "The mean of a data set…" }).level).toBe("required");
  });
  it("Reading & Writing 도 판정한다 — Command of Evidence (Quantitative) 는 표·그래프 필수, 그 외 유형은 불필요", () => {
    const quant = judgeMaterialNeed({ examSystem: "sat_rw", skillCode: "command_of_evidence_quant", text: "Researchers measured… Which choice most effectively uses data to complete the statement?" });
    expect(quant).toMatchObject({ level: "required", kind: "data" });
    expect(quant.reason).toMatch(/표·그래프/);
    expect(judgeMaterialNeed({ examSystem: "sat_rw", skillCode: "words_in_context", text: "The report was ______ … Which choice…?" })).toMatchObject({ level: "none", kind: null });
    // RW 지문 안의 'figure' 같은 낱말은 도형 단서로 보지 않는다.
    expect(judgeMaterialNeed({ examSystem: "sat_rw", skillCode: "central_ideas_details", text: "A public figure argued that… Which choice best states the main idea?" }).kind).toBeNull();
  });
  it("AP 와 미분류는 판정하지 않는다(이유 표시)", () => {
    expect(judgeMaterialNeed({ examSystem: "ap", skillCode: null, text: "anything" }).reason).toMatch(/준비 중/);
    expect(judgeMaterialNeed({ examSystem: null, skillCode: null, text: "If 2x = 4?" }).reason).toMatch(/세부 기술을 고르면/);
  });
  it("자료 필수인데 자료가 없으면 저장·공개 사유를 돌려주고, 맞는 자료·올린 그림이면 통과", () => {
    const need = judgeMaterialNeed({ examSystem: "sat_math", skillCode: "right_triangles_trigonometry", text: "In right triangle ABC…" });
    expect(materialBlocker(need, null)).toMatch(/자료 필수 문항/);
    expect(materialBlocker(need, { type: "triangle" })).toBeNull();
    expect(materialBlocker(need, { type: "image", alt: "x" })).toBeNull();
    expect(materialBlocker(need, { type: "data", kind: "table" })).toMatch(/자료 필수/);
    expect(figureSatisfies("data", { type: "figure_set" })).toBe(true);
    expect(materialBlocker(judgeMaterialNeed({ examSystem: "sat_math", skillCode: "linear_functions", text: "f(x)=x" }), null)).toBeNull();
  });
  it("회차 구성 안내 문장", () => {
    const lines = materialStatusLines([
      { skillCode: "lines_angles_triangles", text: "Triangle ABC…", figure: null },
      { skillCode: "percentages", text: "The table shows…", figure: { type: "data" } },
      { skillCode: "percentages", text: "The table shows…", figure: null },
    ]);
    expect(lines).toEqual(expect.arrayContaining([expect.stringMatching(/도형 자료 필수 문제 1개 \(자료 없음 1\)/), expect.stringMatching(/표·그래프 자료 필수 문제 2개 \(자료 없음 1\) · 표·그래프 자료 있는 문제 1개/)]));
  });
});

describe("질문 분리", () => {
  it("합치기·갈라내기·유무", () => {
    expect(composeProblemText("Body.", "What is x?")).toBe("Body.\n\nWhat is x?");
    expect(composeProblemText("", "What is x?")).toBe("What is x?");
    expect(splitLegacyQuestion("Body one.\n\nWhich choice best states the main idea?")).toEqual({ passage: "Body one.", question: "Which choice best states the main idea?" });
    expect(splitLegacyQuestion("If 2x = 4, what is x?")).toEqual({ passage: "", question: "If 2x = 4, what is x?" });
    expect(splitLegacyQuestion("Just a paragraph with no question.")).toEqual({ passage: "Just a paragraph with no question.", question: null });
    expect(hasQuestion("Just a paragraph.", null)).toBe(false);
    expect(hasQuestion("Just a paragraph.", "What is it?")).toBe(true);
    expect(hasQuestion("The value is 3?", null)).toBe(true);
    expect(effectiveQuestion("Body.\n\nWhat is x?", null)).toBe("What is x?");
    expect(effectiveQuestion("Body.", "Q?")).toBe("Q?");
  });
});
