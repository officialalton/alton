// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { autoMathExplanation } from "./explanation-math";
import { apPassageForDisplay } from "./stimulus-display";
import { scanRawMath } from "./raw-math-scan";

// 재고 전수: 학생 화면이 쓰는 변환(autoMath·자료 중복 숨김)을 거친 뒤, $...$ 밖에 렌더되지 않은 원문 수식이 남는 문항이 없어야 한다(토큰 단위 점검).
type It = { stockKey: string; validation: string; payload: { stem?: string; options?: string[]; explanation_en?: string; stimulus?: unknown; parts?: { prompt?: string; model_answer?: string }[] } };
const items = [...JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")), ...JSON.parse(readFileSync("data/ap/stock/s1a-items.json", "utf-8"))] as It[];
const outside = (t: string) => t.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, " ");
describe("재고 전수 — 학생 화면 변환 뒤 원문 수식 없음", () => {
  it("auto_passed 문항의 자료 텍스트·본문·선지·해설·FRQ 파트", () => {
    const bad: string[] = [];
    for (const i of items.filter((x) => x.validation === "auto_passed")) {
      const p = i.payload;
      const st = typeof p.stimulus === "string" ? (() => { try { return JSON.parse(p.stimulus as string); } catch { return null; } })() : p.stimulus;
      const desc = st && typeof st === "object" && (st as { kind?: string }).kind === "text" ? String((st as { description?: string }).description ?? "") : "";
      const texts: [string, string][] = [["stem", autoMathExplanation(p.stem ?? "")], ["passage", apPassageForDisplay(desc, p.stem ?? "") ?? ""], ["explanation", autoMathExplanation(p.explanation_en ?? "")],
        ...(p.options ?? []).map((o, k): [string, string] => [`option${k}`, autoMathExplanation(String(o))]), ...(p.parts ?? []).flatMap((x, k): [string, string][] => [[`part${k}prompt`, autoMathExplanation(x.prompt ?? "")], [`part${k}ref`, autoMathExplanation(x.model_answer ?? "")]])];
      for (const [where, t] of texts) {
        if (!t) continue;
        const d = document.createElement("div"); d.textContent = outside(t); document.body.appendChild(d);
        const hits = scanRawMath(d); d.remove();
        if (hits.length) bad.push(`${i.stockKey} ${where}: ${hits[0].kind} "${hits[0].token}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});
