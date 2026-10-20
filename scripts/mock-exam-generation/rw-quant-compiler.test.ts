import { describe, expect, it } from "vitest";
import { buildAll } from "./rw-quant-compiler";
import { verifyItem } from "./rw-quant-verify";
import { validateFigureSpec } from "../../lib/problem-figures/spec";
import { checkFigure } from "../../lib/problem-figures/check";
import { checkQuantEvidenceFields } from "../../lib/problem-generation/quant-evidence-check";

describe("SAT quant-evidence compiler (A4)", () => {
  const items = buildAll(36);
  it("36개를 만들고 5개 틀·세 가지 자료를 모두 쓴다", () => {
    expect(items).toHaveLength(36);
    expect(new Set(items.map((b) => b.family)).size).toBe(5);
    expect(new Set(items.map((b) => b.figureKind))).toEqual(new Set(["table", "bar", "line"]));
  });
  it("독립 검증기: 인용 값이 자료와 같고 뒷받침하는 선택지가 정확히 하나(정답과 일치)", () => {
    for (const b of items) expect(verifyItem(b), b.gid).toEqual([]);
  });
  it("기존 figure·정량 근거 검사를 통과한다", () => {
    for (const b of items) {
      expect(validateFigureSpec(b.figure).ok, b.gid).toBe(true);
      const text = `${b.passage}\n\n${b.question}`;
      expect(checkFigure(b.figure, text, b.options, b.correctIndex).ok, b.gid).toBe(true);
      const dis = b.options.filter((_, i) => i !== b.correctIndex);
      expect(checkQuantEvidenceFields("command_of_evidence_quant", { operation: b.evidenceTarget, answerRationale: b.answerRationale, distractorErrorTypes: b.distractorErrorTypes }, b.figure, b.options[b.correctIndex], dis, b.passage), b.gid).toEqual({ ok: true });
    }
  });
});
