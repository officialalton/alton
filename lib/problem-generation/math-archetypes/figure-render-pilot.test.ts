// 파일럿 15항목의 그림·표가 앱의 렌더 경로(ProblemFigure → renderFigureSvg)에서 실제로 그려지는가 — 순수 컴포넌트 테스트(DB·서버 불필요).
import { describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { checkFigure } from "@/lib/problem-figures/check";
import type { FigureSpec } from "@/lib/problem-figures/spec";

vi.mock("../../../app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: async () => ({ ok: false, error: "mock" }) }));
import ProblemFigure from "../../../app/session/[id]/ProblemFigure";

const items = [...new Set(figureArchetypes().map((a) => a.figureItem!))];
const sample = (item: string, n = 3) => { const out: { id: string; fig: Record<string, unknown> }[] = []; for (const a of figureArchetypes().filter((x) => x.figureItem === item && x.level === "hard")) for (let s = 0; s < 6 && out.length < n; s++) { const g = generateOne(a, s); if (g.ok && g.inst.figure) out.push({ id: a.id, fig: g.inst.figure as Record<string, unknown> }); } return out; };

describe("자료 원형(파일럿 15항목 + 1단계 조합) — 앱 렌더 경로에서 그림·표가 보인다", () => {
  for (const item of items) {
    it(`${item}: ProblemFigure 가 오류 없이 그리고 값이 화면에 있다`, () => {
      const ss = sample(item); expect(ss.length).toBeGreaterThan(0);
      for (const { fig } of ss) {
        const { container, queryByTestId, unmount } = render(createElement(ProblemFigure, { spec: fig }));
        expect(queryByTestId("problem-figure-error")).toBeNull(); const box = queryByTestId("problem-figure"); expect(box).toBeTruthy();
        const html = container.innerHTML; const t = fig.type as string;
        if (t === "data" && fig.kind === "table") { expect(container.querySelectorAll("table").length).toBe(1); for (const c of fig.columns as string[]) expect(container.textContent).toContain(c); for (const row of fig.rows as (string | number)[][]) for (const v of row) expect(container.textContent).toContain(typeof v === "number" && Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : String(v)); }
        if (t === "data" && fig.kind === "two_way") { expect(container.querySelectorAll("table").length).toBe(1); for (const row of fig.cells as number[][]) for (const v of row) expect(container.textContent).toContain(String(v)); expect(container.textContent).toContain("Total"); }
        if (t === "data" && fig.kind === "scatter") { expect(container.querySelectorAll("svg circle").length).toBe((fig.points as unknown[]).length); if (fig.fitLine) expect(html).toContain("#C8102E"); }
        if (t === "data" && fig.kind === "line") { expect(container.querySelectorAll("svg circle").length).toBe(((fig.series as { values: number[] }[])[0].values).length); }
        if (t === "figure_choice") { const ch = fig.choices as { type: string }[]; expect(ch).toHaveLength(4); expect(container.querySelectorAll("figure").length).toBe(4); for (const L of ["A", "B", "C", "D"]) expect(container.textContent).toContain(L); if (ch[0].type === "plane") expect(container.querySelectorAll("svg").length).toBe(4); if (ch[0].type === "data") expect(container.querySelectorAll("table").length).toBe(4); }
        if (t === "figure_set") { expect(container.querySelectorAll("figure").length).toBe(2); expect(container.textContent).toContain("Plot A"); expect(container.textContent).toContain("Plot B"); }
        unmount(); cleanup();
      }
    });
    it(`${item}: renderFigureSvg 가 비어 있지 않고 alt 가 있으며 checkFigure 렌더 이슈가 없다`, () => {
      for (const { fig } of sample(item)) {
        const markup = renderFigureSvg(fig as unknown as FigureSpec); expect(markup.length).toBeGreaterThan(200);
        const choice = fig.type === "figure_choice"; const c = checkFigure(fig, "The figure is shown.", choice ? ["A", "B", "C", "D"] : null, choice ? 0 : null);
        expect((c.alt ?? "").length, "alt").toBeGreaterThan(5); expect(c.issues.filter((i) => !["answer_mismatch"].includes(i.code)), item).toEqual([]);
      }
    });
  }
});
