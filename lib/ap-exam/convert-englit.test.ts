import { describe, expect, it } from "vitest";
import { planConversion } from "./convert";
import { gateCandidate, type ApCandidateLike } from "../ap-figures/gate";
import { itemContentHash } from "../ap-generation/verify-guard";
import { apPassageForDisplay } from "./stimulus-display";
import { litPassageDisplay } from "./passage-lines";

// AP English Literature 후보 → 문제은행 변환: 줄 번호 지문(펜스)이 set_intro 로 모든 문항에 같은 지문으로 붙고, 에세이 FRQ 는 지문·루브릭·샘플 참고 답안을 싣는다.
const DISPLAY = litPassageDisplay({ title: "Last Crossing", attribution: "by Ines Calder", stanzas: [["The ferry leaves before the light,", "its engine clearing a throat,"], ["and I count the rope coils twice."]] });
const opt = (text: string, why: string) => ({ text, why, value: null, label: "x" });
const item = (stem: string, key: number) => ({ topic: "U5.3", skill: "6.A", stem, key_index: key, explanation_en: 'The correct answer is "a".\n"b" is incorrect: because.', options: [opt("a", "right because the simile compares"), opt("b", "wrong because it reverses"), opt("c", "wrong because unsupported"), opt("d", "wrong because lexical trap")] });
const mc = (): ApCandidateLike => ({ candidateKey: "ap_english_literature-p01-k0", apSubjectCode: "ap_english_literature", kind: "mc", keywordCode: "U5.3", difficultyProvisional: "exam_prep",
  payload: { archetype: "lt_poetry_p01", topic: "U5.3", skill: "6.A", calculator: "na", set_intro: DISPLAY, items: [item("The comparison in (line 2) suggests the engine is", 0), item("The final line mainly shows that the speaker", 1)] } } as unknown as ApCandidateLike);

describe("AP English Literature conversion", () => {
  it("MC set: passes the render gate, items share the numbered-line passage", () => {
    expect(gateCandidate(mc()).status).not.toBe("fail"); const p = planConversion(mc()); expect(p.ok).toBe(true);
    if (p.ok) { expect(p.items).toHaveLength(2); expect(new Set(p.items.map((i) => i.passage)).size).toBe(1); expect(p.items[0].passage).toContain("```passage"); expect(p.items.map((i) => i.correctIndex)).toEqual([0, 1]); }
  });
  it("the passage is shown verbatim (not hidden as a stem duplicate, no math conversion)", () => {
    expect(apPassageForDisplay(DISPLAY, "The ferry leaves before the light, its engine clearing a throat")).toBe(DISPLAY);
  });
  it("content hash covers set_intro and items for lt_ archetypes (two different sets never collide)", () => {
    const a = (mc().payload as Record<string, unknown>); const b = { ...a, set_intro: DISPLAY.replace("Last Crossing", "Other") };
    expect(itemContentHash(a)).not.toBe(itemContentHash(b)); expect(itemContentHash({ ...a, archetype: "lt_poetry_p99" })).toBe(itemContentHash(a));
  });
  it("FRQ bundle: essay item with the passage, reference text carries rubric and samples", () => {
    const frq = { candidateKey: "ap_english_literature-fa1-k0", apSubjectCode: "ap_english_literature", kind: "frq_bundle", keywordCode: "U9.4", difficultyProvisional: "exam_prep",
      payload: { archetype: "ltfrq_fa1", template: "q1", topic: "U9.4", skill: "6.B", calculator: "na", title: "Last Crossing", set_intro: DISPLAY, reference_text: "Reference answer and scoring notes (ALTON-authored).\nSample essay (high; scored 6/6)", lit_frq: { schema_version: "lit-frq-1" },
        parts: [{ label: "A", prompt: "Read the poem closely. Then write an essay...", points: 6, response_mode: "essay", skill_codes: ["6.B"], topic_codes: ["U9.4"], model_answer: "A strong essay.", rubric_rows: [{ row_id: "A", points: 1, criterion: "A thesis", required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false }] }] } } as unknown as ApCandidateLike;
    const p = planConversion(frq); expect(p.ok).toBe(true);
    if (p.ok) { expect(p.items).toHaveLength(1); expect(p.items[0].format).toBe("essay"); expect(p.items[0].passage).toContain("```passage"); expect(p.items[0].explanation).toContain("Sample essay (high; scored 6/6)"); expect((p.items[0].statements as { mode: string }[])[0].mode).toBe("essay"); }
  });
});
