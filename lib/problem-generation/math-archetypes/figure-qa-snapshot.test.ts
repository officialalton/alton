// 시각 검수 스냅샷 생성(HTML + 메타) — 평소에는 건너뛰고 FIGURE_QA_SNAPSHOT=1 일 때만 data/mock-exam-generation/figure-qa/ 에 쓴다.
//   1) FIGURE_QA_SNAPSHOT=1 npx vitest run lib/problem-generation/math-archetypes/figure-qa-snapshot.test.ts --project unit
//   2) node scripts/mock-exam-generation/figure-qa-render.mjs      (Playwright 로 HTML → PNG: <조합ID>.png 데스크톱 720px, <조합ID>.m375.png 모바일 375px)
// 그림은 앱의 렌더 경로(ProblemFigure → renderFigureSvg)로 그린다.
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QA_DIR, QA_HTML_DIR, codeHash, metaPath, type QaMeta } from "./figure-qa-hash";
import { qaItemIds, qaSamples } from "./figure-qa-samples";
import { checkInstanceFigureQa } from "./figure-qa";
import { problemText } from "../../problem-figures/label-rule";

vi.mock("../../../app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: async () => ({ ok: false, error: "mock" }) }));
import ProblemFigure from "../../../app/session/[id]/ProblemFigure";

/** 본문의 $…$ 수식은 앱에서 KaTeX 로 그려진다 — 스냅샷에서는 흔한 기호만 유니코드로 바꿔 검수자가 원문 LaTeX 를 결함으로 오인하지 않게 한다. */
const texLite = (s: string) => s.replace(/\\(ge|geq)\b/g, "≥").replace(/\\(le|leq)\b/g, "≤").replace(/\\ne\b/g, "≠").replace(/\\cdot\b/g, "·").replace(/\\times\b/g, "×").replace(/\\ell\b/g, "ℓ").replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\(?:left|right)\b/g, "");
const esc = (s: string) => texLite(s).replace(/\$/g, "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const page = (stimulus: string, figure: string, question: string, options: string[], title: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;padding:16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.5;color:#111;background:#fff}main{max-width:688px}.q{font-weight:600}ol{list-style:upper-alpha;padding-left:24px}</style></head><body><main><p>${esc(stimulus)}</p>${figure}<p class="q">${esc(question)}</p><ol>${options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol></main></body></html>`;

describe.skipIf(!process.env.FIGURE_QA_SNAPSHOT)("시각 검수 스냅샷(HTML·메타)", () => {
  it("조합마다 고정 시드 샘플을 앱 렌더 경로로 그려 HTML·메타를 쓴다", () => {
    mkdirSync(path.join(process.cwd(), QA_HTML_DIR), { recursive: true }); let n = 0;
    for (const itemId of qaItemIds()) {
      const samples = qaSamples(itemId); expect(samples.length, itemId).toBeGreaterThan(0);
      const types = [...new Set(samples.flatMap((s) => s.types))]; const { hash, files } = codeHash(itemId, types);
      const meta: QaMeta = { itemId, generatedAt: new Date().toISOString(), codeHash: hash, sources: files, samples: [] };
      for (const s of samples) {
        const markup = renderToStaticMarkup(createElement(ProblemFigure, { spec: s.inst.figure, text: problemText(s.inst.stimulus, s.inst.question, s.inst.options) }));
        const base = s.file.replace(/\.png$/, ""); writeFileSync(path.join(process.cwd(), QA_HTML_DIR, `${base}.html`), page(s.inst.stimulus, markup, s.inst.question, s.inst.options.length ? (s.inst.answerKind === "index" && ["figure_choice", "figure_bundle"].includes((s.inst.figure as { type?: string } | null)?.type ?? "") ? s.inst.options.map((o) => `Choice ${o}`) : s.inst.options) : [], base));
        const answer = s.inst.format === "spr" ? (s.inst.answers ?? []).join(" / ") : s.inst.options[s.inst.correctIndex];
        meta.samples.push({ file: s.file, mobileFile: `${base}.m375.png`, archetypeId: s.a.id, seed: s.seed, signature: s.signature, stimulus: s.inst.stimulus, question: s.inst.question, options: s.inst.options, correctIndex: s.inst.correctIndex, answer, explanation: s.inst.explanation, structuralIssues: checkInstanceFigureQa(s.inst) });
        n++;
      }
      writeFileSync(path.join(process.cwd(), metaPath(itemId)), JSON.stringify(meta, null, 1));
    }
    expect(n).toBeGreaterThanOrEqual(15); void QA_DIR;
  });
});
