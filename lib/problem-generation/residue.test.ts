import { describe, it, expect } from "vitest";
import { findResidue, residueInText } from "./residue";

describe("생성 잔재 검사", () => {
  it("깨끗한 문항은 통과(밑줄 <u>·부등호 x < 3 허용)", () => {
    expect(findResidue({ passage: "The word <u>reveal</u> is used.", question: "If x < 3 and y > 2, what is x + y?", options: ["1", "2", "3", "4"], explanation: "정답은 B이다." })).toEqual([]);
  });
  it("</explanation>·<parameter name=…>·hard_design 를 해설에서 잡는다", () => {
    const r = findResidue({ explanation: '정답은 C이다.</explanation>\n<parameter name="hard_design">두 번째 반례</parameter>' });
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.every((x) => x.field === "explanation")).toBe(true);
  });
  it("작성 메모와 </passage>, </note> 를 본문·선택지에서도 잡는다", () => {
    expect(findResidue({ passage: "본문</passage>" }).length).toBe(1);
    expect(findResidue({ options: ["a", "필요 없으므로 4개만 유지", "c", "d"] })[0].field).toBe("options[1]");
    expect(residueInText("메모 </note>").length).toBe(1);
  });
  it("영어 해설도 검사", () => { expect(findResidue({ explanationEn: "text </explanation>" })[0].field).toBe("explanationEn"); });
});
