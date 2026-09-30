import { describe, it, expect } from "vitest";
import { verifyExcerpt, verifyInsideExcerpt, normalize } from "./quote-verify";

// 테스트용 가짜 원문(실제 작품 문장 아님).
const SRC = "The harbor was quiet that morning.  A single boat, weathered and low, drifted near the pier.\nNobody on the shore spoke of the weather; it was enough to watch the tide return.";
describe("인용 일치 검증", () => {
  it("공백·개행·따옴표 차이만 있으면 일치", () => {
    expect(verifyExcerpt(SRC, "A single boat, weathered and low, drifted near the pier. Nobody on the shore spoke of the weather;").ok).toBe(true);
    expect(normalize("“Hi” — it’s")).toBe("\"Hi\" - it's");
  });
  it("철자·구두점·단어가 다르면 불일치(AI 가 인용을 고쳐 쓴 경우)", () => {
    expect(verifyExcerpt(SRC, "A single boat, weathered and low, drifted near the dock.").ok).toBe(false);
    expect(verifyExcerpt(SRC, "A single boat weathered and low drifted near the pier.").ok).toBe(false);
  });
  it("생략 표기 [...] 는 앞뒤 구간이 각각 원문에 차례대로 있어야 한다", () => {
    expect(verifyExcerpt(SRC, "The harbor was quiet that morning. […] it was enough to watch the tide return.").ok).toBe(true);
    expect(verifyExcerpt(SRC, "it was enough to watch the tide return. […] The harbor was quiet that morning.").ok).toBe(false);
    expect(verifyExcerpt(SRC, "The harbor was quiet… that morning.").ok).toBe(false); // 줄임표 단독 금지
  });
  it("문항의 밑줄·인용은 지문 안에 그대로 있어야 한다", () => {
    const ex = "A single boat, weathered and low, drifted near the pier.";
    expect(verifyInsideExcerpt(ex, "weathered and low")).toBe(true);
    expect(verifyInsideExcerpt(ex, "worn and low")).toBe(false);
  });
});
