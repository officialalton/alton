import { describe, expect, it } from "vitest";
import { escapeCurrencyDollars, hasUnescapedCurrency } from "./currency-dollars";
import { splitLearningContent } from "./render-learning-content";
import { mathToPlain } from "./math-plain";
import { checkContent } from "./problem-content-check";

// 화면에 그려지는 모양(글 조각은 이어 붙이고 수식은 html)
const view = (s: string) => {
  const out: string[] = [];
  for (const p of splitLearningContent(s)) {
    const piece = p.kind === "text" ? p.value : p.kind === "math" ? `<M:${p.html}>` : `<${p.kind}>`;
    if (p.kind === "text" && out.length && !out[out.length - 1].startsWith("<")) out[out.length - 1] += piece; else out.push(piece);
  }
  return out;
};
const plain = (s: string) => view(s).join("");

describe("escapeCurrencyDollars", () => {
  it("'$3 and $55' 는 글 그대로 보이고 \\$ 로 저장된다", () => {
    expect(escapeCurrencyDollars("at $3 each and a wage of $55 per day.")).toBe("at \\$3 each and a wage of \\$55 per day.");
    expect(plain("at \\$3 each and a wage of \\$55 per day.")).toBe("at $3 each and a wage of $55 per day.");
  });
  it("화면 모양은 바뀌지 않는다(이스케이프 전후 동일)", () => {
    for (const s of [
      "MP of the third worker = 70 - 52 = 18; MRP = 18 x $3 = $54.",
      "The price is $3. The cost is $55.",
      "cost $3, $55, and $7",
      "Let $x$ cost $5 and $y$ cost $6",
      "The total cost is the $12 daily rate times the number of rental days $d$, plus the $20 fee, so $12d+20 \\le 120$.",
      "it is ($3) versus ($55)",
    ]) expect(plain(escapeCurrencyDollars(s))).toBe(plain(s));
  });
  it("진짜 수식·이미 이스케이프된 달러·코드는 건드리지 않는다", () => {
    for (const s of ["Find $3x+1$ when $x=2$.", "$$\\frac{1}{2}$$", "costs \\$5 and \\$6", "`int a = $5;` and `$7`", "$f(x)=3$ and $g(x)=4$", "A $5$ B"]) expect(escapeCurrencyDollars(s)).toBe(s);
  });
  it("멱등", () => {
    const once = escapeCurrencyDollars("at $3 each and $55 per day, plus $x$.");
    expect(escapeCurrencyDollars(once)).toBe(once);
  });
  it("문장에 맨 $숫자 가 하나뿐이면 그대로 둔다(짝이 될 수 없음)", () => {
    expect(escapeCurrencyDollars("The marginal cost of each unit is $26.")).toBe("The marginal cost of each unit is $26.");
  });
  it("force 는 맨 $숫자 하나도 이스케이프한다(새 지문용)", () => {
    expect(escapeCurrencyDollars("The marginal cost of each unit is $26.", { force: true })).toBe("The marginal cost of each unit is \\$26.");
    expect(escapeCurrencyDollars("Find $3x+1$ at $5.", { force: true })).toBe("Find $3x+1$ at \\$5.");
  });
  it("짝 없이 남은 금액이 둘 이상이면 모두 이스케이프", () => {
    expect(escapeCurrencyDollars("Costs rise from $4 to $6 per unit")).toBe("Costs rise from \\$4 to \\$6 per unit");
  });
  it("hasUnescapedCurrency", () => {
    expect(hasUnescapedCurrency("at $3 and $55")).toBe(true);
    expect(hasUnescapedCurrency("at \\$3 and \\$55")).toBe(false);
  });
});

describe("통화 $ 가 모든 표시 경로에서 글로 보인다", () => {
  const S = "$3 and $55";
  it("본문 렌더러", () => { expect(plain(S)).toBe("$3 and $55"); expect(plain("\\$3 and \\$55")).toBe("$3 and $55"); });
  it("목록 제목용 평문 변환(mathToPlain)", () => {
    expect(mathToPlain("\\$3 and \\$55")).toBe("$3 and $55");
    expect(mathToPlain("costs \\$3 and \\$55 for $x$")).toBe("costs $3 and $55 for x");
  });
  it("게시 검사는 통화 $ 를 '닫히지 않은 수식'으로 보지 않는다", () => {
    const base = { format: "essay", options: null, correctIndex: null, explanation: "" } as never;
    for (const passage of [S, "\\$3 and \\$55", "wage of $55: 2 workers and $3 each"]) {
      expect(checkContent({ ...(base as object), passage } as never).filter((i) => i.code === "math_unclosed")).toEqual([]);
    }
  });
});
