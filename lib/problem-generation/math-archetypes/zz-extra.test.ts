import { it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
import { problemText } from "../../problem-figures/label-rule";
vi.mock("../../../app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: async () => ({ ok: false, error: "mock" }) }));
import ProblemFigure from "../../../app/session/[id]/ProblemFigure";
const esc = (s: string) => s.replace(/\$/g, "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
it("extra", () => {
  const ids = (process.env.XIDS ?? "").split(","); const seeds = (process.env.XSEEDS ?? "3,4").split(",").map(Number);
  const dir = path.join(process.cwd(), "data/mock-exam-generation/figure-qa/_html"); mkdirSync(dir, { recursive: true });
  for (const id of ids) { const a = figureArchetypes().find((x) => x.id === id)!; for (const s of seeds) { const g = generateOne(a, s); if (!g.ok) continue; const i = g.inst;
    const m = renderToStaticMarkup(createElement(ProblemFigure, { spec: i.figure, text: problemText(i.stimulus, i.question, i.options) }));
    writeFileSync(path.join(dir, `zz-${id}-${s}.html`), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Georgia,serif;font-size:16px;line-height:1.5}main{max-width:688px}ol{list-style:upper-alpha;padding-left:24px}</style></head><body><main><p>${esc(i.stimulus)}</p>${m}<p><b>${esc(i.question)}</b></p><ol>${i.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol><p style="color:#888;font-size:12px">ANS idx ${i.correctIndex}: ${esc(i.options[i.correctIndex] ?? "")} | ${esc(i.explanation)}</p></main></body></html>`); } }
});
