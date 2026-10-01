import { describe, expect, it } from "vitest";
import { checkRwStructure, countBlanks, describeRwStructure, parseRwStimulus, rwSkillCode } from "./rw-stimulus";
import { splitLearningContent } from "./render-learning-content";
import { checkContent } from "./problem-content-check";

const WIC = `The committee's report was ______ in its treatment of the evidence: it addressed every objection raised during the hearings without omitting inconvenient details.

Which choice completes the text with the most logical and precise word or phrase?`;
const WIC_QUOTE = `In her 1921 essay, the critic argued that the novel's structure was deliberately "loose," allowing digressions that a stricter form would have excluded.

As used in the text, what does the word "loose" most nearly mean?`;
const TSP = `Many coral reefs appear healthy at a glance. __Yet beneath the surface, a slow chemical shift is eroding the skeletons that give reefs their shape.__ Researchers now measure this erosion directly.

Which choice best describes the function of the underlined sentence in the text as a whole?`;
const CROSS = `Text 1
Historians have long treated the printing press as the decisive cause of Europe's early modern information revolution, arguing that mechanical reproduction alone made wide circulation possible.

Text 2
Recent scholarship stresses that manuscript copying networks were already efficient; the press accelerated rather than created circulation, and its effects depended on existing literacy.

Based on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?`;
const RS = `While researching a topic, a student has taken the following notes:
- The Voyager 1 probe was launched in 1977.
- It entered interstellar space in 2012.
- It still transmits data using a 22-watt radio.
- Its signal takes over 22 hours to reach Earth.

The student wants to emphasize how long Voyager 1 has operated. Which choice most effectively uses relevant information from the notes to accomplish this goal?`;
const TRANS = `Solar panels convert sunlight directly into electricity. ______ their output drops sharply on overcast days, so most installations pair them with storage.

Which choice completes the text with the most logical transition?`;
const QUANT = `The table shows the number of species recorded in three survey plots in 2010 and 2020. A team of ecologists claims that plot diversity increased most where grazing was removed.

Which choice most effectively uses data from the table to complete the statement?`;
const opts4 = ["A", "B", "C", "D"];
const dataFig = { type: "data", kind: "table", columns: ["Plot", "2010", "2020"], rows: [["A", 12, 18], ["B", 9, 10], ["C", 15, 14]] };

describe("RW 구조화 자료 블록 — 해석", () => {
  it("Text 1/Text 2 를 제목 구역으로, 마지막 물음표 단락을 질문으로 뗀다", () => {
    const s = parseRwStimulus(CROSS);
    expect(s.texts).toEqual(["Text 1", "Text 2"]);
    expect(s.blocks.map((b) => b.kind)).toEqual(["text", "text", "question"]);
    expect(s.question).toMatch(/^Based on the texts/);
    expect(s.structured).toBe(true);
  });
  it("메모 소개 줄 + '- ' 목록 + 목표 질문", () => {
    const s = parseRwStimulus(RS);
    expect(s.notes?.items).toHaveLength(4);
    expect(s.notes?.intro).toMatch(/following notes:$/);
    expect(s.question).toMatch(/^The student wants to/);
  });
  it("빈칸·밑줄을 본문에서만 세고, 밑줄 토큰의 __ 는 빈칸으로 세지 않는다", () => {
    expect(parseRwStimulus(WIC).blanks).toBe(1);
    expect(parseRwStimulus(TSP).underlines).toBe(1);
    expect(parseRwStimulus(TSP).blanks).toBe(0);
    expect(countBlanks("__a sentence__ and ______")).toBe(1);
    expect(splitLearningContent("x ______ y").map((p) => p.kind)).toEqual(["text", "blank", "text"]);
  });
  it("본문과 질문 사이 빈 줄이 없어도 마지막 질문 문장부터 질문으로 나눈다; 물음표 없는 질문 단락도 본문이 따로 있으면 질문", () => {
    const s = parseRwStimulus("Coral reefs look healthy. __Yet erosion continues.__ Which choice best describes the function of the underlined sentence in the text as a whole?");
    expect(s.question).toMatch(/^Which choice best describes/);
    expect(s.underlines).toBe(1);
    expect(s.blocks.map((b) => b.kind)).toEqual(["paragraph", "question"]);
    const s2 = parseRwStimulus("Body sentence one. Body sentence two.\n\nWhich choice best states the main purpose of the text.");
    expect(s2.question).toMatch(/^Which choice/);
  });
  it("정량·텍스트 근거 문항은 문장 끝 빈칸 하나를 허용한다(둘은 거부)", () => {
    const withBlank = QUANT.replace("was removed.", "was removed. The largest increase was ______.");
    expect(checkRwStructure({ skillCode: "command_of_evidence_quant", passage: withBlank, options: opts4, figure: dataFig })).toEqual([]);
    expect(checkRwStructure({ skillCode: "command_of_evidence_quant", passage: withBlank.replace("The largest", "______ The largest"), options: opts4, figure: dataFig }).map((i) => i.code)).toContain("rw_target");
  });
  it("구조가 없는 한 단락 지문은 structured=false(레거시·수학 그대로)", () => {
    const s = parseRwStimulus("If $2x + 3 = 11$, what is $x$?");
    expect(s.structured).toBe(false);
    expect(s.texts).toEqual([]);
  });
  it("요약 문장 — 인용 단어형은 빈칸 없음이 정상이라고 말한다", () => {
    expect(describeRwStructure(parseRwStimulus(CROSS))).toBe("Text 1·Text 2 · 빈칸 0 · 밑줄 0 · 질문 인식됨");
    expect(describeRwStructure(parseRwStimulus(WIC_QUOTE))).toBe("지문 1개 · 인용 단어형(“loose”) · 빈칸 없음이 정상 · 밑줄 0 · 질문 인식됨");
    expect(describeRwStructure(parseRwStimulus(WIC))).toBe("지문 1개 · 빈칸 1 · 밑줄 0 · 질문 인식됨");
  });
  it("옛 rw.* 코드도 표준 코드로 읽고, 수학 코드는 null", () => {
    expect(rwSkillCode("rw.cross_text")).toBe("cross_text_connections");
    expect(rwSkillCode("words_in_context")).toBe("words_in_context");
    expect(rwSkillCode("linear_functions")).toBeNull();
    expect(rwSkillCode(null)).toBeNull();
  });
});

describe("RW 구조화 자료 블록 — 검증", () => {
  const ok = (skillCode: string, passage: string, figure: unknown = null) => checkRwStructure({ skillCode, passage, options: opts4, figure });
  it("대표 유형 6개 정상 통과", () => {
    expect(ok("words_in_context", WIC)).toEqual([]);
    expect(ok("words_in_context", WIC_QUOTE)).toEqual([]);
    expect(ok("text_structure_purpose", TSP)).toEqual([]);
    expect(ok("cross_text_connections", CROSS)).toEqual([]);
    expect(ok("rhetorical_synthesis", RS)).toEqual([]);
    expect(ok("transitions", TRANS)).toEqual([]);
    expect(ok("command_of_evidence_quant", QUANT, dataFig)).toEqual([]);
  });
  it("세부 기술이 없으면(옛 문제) 검사하지 않는다", () => {
    expect(checkRwStructure({ skillCode: null, passage: "anything", options: ["a"] })).toEqual([]);
  });
  it("빈칸은 정확히 하나 — 0개·2개·선택지 안 빈칸 거부, 질문 문구 불일치 거부", () => {
    expect(ok("words_in_context", WIC.replace("______", "vague")).map((i) => i.code)).toContain("rw_target");
    expect(ok("transitions", TRANS.replace("Solar panels", "______ Solar panels")).map((i) => i.code)).toContain("rw_target");
    expect(checkRwStructure({ skillCode: "boundaries", passage: TRANS, options: ["a ______", "b", "c", "d"] }).map((i) => i.code)).toContain("rw_target");
    expect(ok("boundaries", TRANS).map((i) => i.code)).toContain("rw_question");
  });
  it("인용 단어형은 그 단어가 지문에 있어야 하고, 지문에 다른 인용 표시가 있으면 대상이 모호해 거부한다", () => {
    expect(ok("words_in_context", WIC_QUOTE.replace('"loose,"', '"tight,"')).map((i) => i.code)).toContain("rw_target");
    // 지문 자체에 "loose," 라고 따옴표가 있는 WIC_QUOTE 는 대상 단어라 통과(위 대표 유형 테스트). 다른 낱말이 따옴표면 거부.
    const other = WIC_QUOTE.replace("allowing digressions", 'praising "progress" and allowing digressions');
    const issues = ok("words_in_context", other);
    expect(issues.some((i) => i.code === "rw_target" && /progress/.test(i.message))).toBe(true);
  });
  it("밑줄: 질문이 underlined 를 가리키면 정확히 하나, 아니면 없어야 한다; 다른 유형의 밑줄 거부", () => {
    expect(ok("text_structure_purpose", TSP.replace(/__/g, "")).map((i) => i.code)).toContain("rw_target");
    expect(ok("text_structure_purpose", TSP.replace("underlined sentence in the text as a whole", "main purpose of the text")).map((i) => i.code)).toContain("rw_target");
    expect(ok("inferences", TSP).map((i) => i.code)).toContain("rw_target");
  });
  it("Text 1/Text 2: 둘 다 순서대로, 질문이 텍스트를 가리켜야 하고, 다른 유형의 Text 구조는 거부", () => {
    expect(ok("cross_text_connections", CROSS.replace("Text 2\n", "")).map((i) => i.code)).toContain("rw_texts");
    expect(ok("cross_text_connections", CROSS.replace("Based on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?", "Which choice best states the main idea?")).map((i) => i.code)).toContain("rw_texts");
    expect(ok("central_ideas_details", CROSS).map((i) => i.code)).toContain("rw_texts");
  });
  it("메모: 목록·개수·목표 문장·notes 참조", () => {
    expect(ok("rhetorical_synthesis", RS.replace(/^- .*\n/gm, "")).map((i) => i.code)).toContain("rw_notes");
    expect(ok("rhetorical_synthesis", RS.replace("- It entered interstellar space in 2012.\n", "").replace("- It still transmits data using a 22-watt radio.\n", "")).map((i) => i.code)).toContain("rw_notes");
    expect(ok("rhetorical_synthesis", RS.replace("The student wants to emphasize how long Voyager 1 has operated. ", "")).map((i) => i.code)).toContain("rw_notes");
    expect(ok("transitions", RS).map((i) => i.code)).toContain("rw_notes");
  });
  it("정량 근거: 마크다운 표 거부, figure(type:'data') 없으면 거부", () => {
    const md = `| Plot | 2010 |\n|---|---|\n| A | 12 |\n\n${QUANT}`;
    expect(ok("command_of_evidence_quant", md, dataFig).map((i) => i.code)).toContain("rw_table");
    expect(ok("command_of_evidence_quant", QUANT).map((i) => i.code)).toContain("rw_data");
    expect(ok("command_of_evidence_quant", QUANT, { type: "triangle" }).map((i) => i.code)).toContain("rw_data");
    expect(ok("central_ideas_details", md).map((i) => i.code)).toContain("rw_table");
  });
  it("질문 미인식·선택지 4개 아님", () => {
    expect(ok("central_ideas_details", "A paragraph with no question at all.").map((i) => i.code)).toContain("rw_question");
    expect(checkRwStructure({ skillCode: "central_ideas_details", passage: "Body.\n\nWhich choice best states the main idea of the text?", options: ["a", "b", "c"] }).map((i) => i.code)).toContain("rw_options");
  });
  it("checkContent 가 RW 검사를 함께 싣는다(수학 코드·코드 없음은 영향 없음)", () => {
    const base = { format: "mc", passage: CROSS, options: opts4, correctIndex: 0, explanation: "해설" };
    expect(checkContent({ ...base, skillCode: "cross_text_connections" })).toEqual([]);
    expect(checkContent({ ...base, skillCode: "central_ideas_details" }).some((i) => i.code === "rw_texts")).toBe(true);
    expect(checkContent({ ...base, skillCode: "linear_functions" })).toEqual([]);
    expect(checkContent(base)).toEqual([]);
  });
});

describe("boundaries/form_structure_sense 구조적 구분(2026-09-17)", () => {
  const BOUND = `The museum's new wing ______ visitors from three continents last year.\n\nWhich choice completes the text so that it conforms to the conventions of Standard English?`;
  it("structuredTag 를 안 넘기면(기존 호출자) 검사하지 않는다 — 하위 호환", () => {
    expect(checkRwStructure({ skillCode: "boundaries", passage: BOUND, options: ["welcomed", "welcomed,", "welcome", "welcoming"] }).map((i) => i.code)).not.toContain("rw_grammar_rule");
  });
  it("boundaries 태그가 없으면 거부한다", () => {
    expect(checkRwStructure({ skillCode: "boundaries", passage: BOUND, options: ["welcomed", "welcomed,", "welcome", "welcoming"], structuredTag: "" }).map((i) => i.code)).toContain("rw_grammar_rule");
  });
  it("boundaries에 form_structure_sense taxonomy 태그를 붙이면 거부한다(구조적 구분)", () => {
    expect(checkRwStructure({ skillCode: "boundaries", passage: BOUND, options: ["welcomed", "welcomed,", "welcome", "welcoming"], structuredTag: "DANGLING_MODIFIER" }).map((i) => i.code)).toContain("rw_grammar_rule");
  });
  it("boundaries에 자기 taxonomy의 태그를 붙이면 통과한다", () => {
    expect(checkRwStructure({ skillCode: "boundaries", passage: BOUND, options: ["welcomed", "welcomed,", "welcome", "welcoming"], structuredTag: "SUBJECT_VERB_AGREEMENT" }).map((i) => i.code)).not.toContain("rw_grammar_rule");
  });
  it("form_structure_sense에 boundaries taxonomy 태그를 붙이면 거부한다", () => {
    expect(checkRwStructure({ skillCode: "form_structure_sense", passage: BOUND, options: ["a", "b", "c", "d"], structuredTag: "COMMA_SPLICE" }).map((i) => i.code)).toContain("rw_grammar_rule");
  });
});
