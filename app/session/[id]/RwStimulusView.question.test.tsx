import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RwStimulusView from "./RwStimulusView";

// 2026-10-08: 질문이 지문과 따로 저장된 Words in Context 인용 단어형 문항은 대상 구절에 밑줄이 그려져야 한다(실제 게시 문항 사례).
const passage = "I bent my head, and seemed to receive the Atlantic on my back. The world seemed going to destruction.";
const question = "As used in the text, the phrase “receive the Atlantic on my back” most nearly suggests";

describe("RwStimulusView 인용 대상 밑줄", () => {
  it("question 속성으로 받은 인용 구절을 지문에서 밑줄로 그린다(비구조 지문 포함)", () => {
    const { container } = render(<RwStimulusView passage={passage} question={question} />);
    const u = container.querySelector("span.underline");
    expect(u?.textContent).toBe("receive the Atlantic on my back");
  });
  it("질문이 없으면 밑줄 없음, 데이터는 바뀌지 않는다", () => {
    const { container } = render(<RwStimulusView passage={passage} />);
    expect(container.querySelector("span.underline")).toBeNull();
  });
});
