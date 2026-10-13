import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AP_PYTHON as PY } from "../../../scripts/ap-generation/py";
import { checkPhysScene, physChoiceIssues, renderPhysScene, validatePhysScene, type PhysScene } from "./ap-phys-scene";
import { validateApDiagram, renderApDiagram } from "./ap-diagrams";
import { renderAp } from "./ap-figures";
import { validateFigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { checkFigure } from "../check";
import { figureAlt } from "../alt";

const fbd = (forces: { label: string; angle: number; mag: number }[], extra: object = {}): PhysScene => ({ type: "fbd", body: "box", forces: forces.map((f) => ({ id: f.label, ...f })), scale: 95 / Math.max(...forces.map((f) => f.mag)), equilibrium: null, ...extra }) as PhysScene;
const SAMPLE: PhysScene[] = [
  fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 20 }, { label: "Fp", angle: 0, mag: 10 }, { label: "Ff", angle: 180, mag: 10 }], { equilibrium: true }),
  { type: "energy_bars", states: [{ name: "Initial", bars: { K: 0, Ug: 10 } }, { name: "Final", bars: { K: 10, Ug: 0 } }], unit: "J", conserved: true, ymax: 10 },
  { type: "vector", vectors: [{ label: "A", dx: 3, dy: 0 }, { label: "B", dx: 0, dy: 4 }], resultant: true },
  { type: "motion_diagram", xs: [0, 1, 3, 6], vs: [1, 2, 3, 4] },
  { type: "incline", theta: 30, m: 2, mu: null, kind: "block" },
  { type: "atwood", m1: 2, m2: 3, table: false, mu: null },
  { type: "atwood", m1: 2, m2: 3, table: true, mu: 0.2 },
  { type: "collision", before: [{ m: 2, v: 3 }, { m: 1, v: -2 }], after: null },
  { type: "beam", length: 4, pivot: 2, forces: [{ x: 1, mag: 10, dir: "down", label: "W1" }, { x: 3, mag: 10, dir: "up", label: "F" }] },
  { type: "utube", h1: 10, h2: 8, rho1: 1000, rho2: 800 },
  { type: "tank_hole", depth: 3, hole_height: 2, tank_height: 6 },
];

describe("ap_diagram phys_scene (TS 렌더)", () => {
  it("renders every scene type to a valid SVG with a long alt text and passes the deterministic scene check", () => {
    for (const sc of SAMPLE) {
      expect(validatePhysScene(sc).ok).toBe(true);
      const v = validateApDiagram({ type: "ap_diagram", variant: "phys_scene", scene: sc });
      expect(v.ok).toBe(true);
      const r = renderAp({ type: "ap_diagram", variant: "phys_scene", scene: sc });
      expect(r.svg.startsWith("<svg")).toBe(true);
      expect(r.svg).toContain('role="img"');
      expect(r.svg).not.toMatch(/NaN|undefined/);
      expect(r.alt.length).toBeGreaterThan(30);
      expect({ t: sc.type, issues: checkPhysScene(sc) }).toEqual({ t: sc.type, issues: [] });
    }
  });
  it("rejects malformed scenes", () => {
    expect(validatePhysScene({ type: "nope" }).ok).toBe(false);
    expect(validatePhysScene({ type: "incline", theta: 120, m: 2 }).ok).toBe(false);
    expect(validatePhysScene({ type: "fbd", body: "box", scale: 1, forces: [] }).ok).toBe(false);
    expect(validateApDiagram({ type: "ap_diagram", variant: "phys_scene", scene: { type: "beam" } }).ok).toBe(false);
  });
  it("flags broken geometry: unbalanced equilibrium, non-conserved bars, arrow overlap", () => {
    expect(checkPhysScene(fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 10 }], { equilibrium: true }))).toContain("equilibrium_sum_not_zero");
    expect(checkPhysScene({ type: "energy_bars", states: [{ name: "a", bars: { K: 5 } }, { name: "b", bars: { K: 6 } }], unit: "J", conserved: true, ymax: 6 })).toContain("energy_not_conserved");
    expect(checkPhysScene(fbd([{ label: "A", angle: 0, mag: 10 }, { label: "B", angle: 0, mag: 10 }]))).toContain("arrow_overlap");
  });
  it("escapes label text", () => {
    const sc = fbd([{ label: "<b>", angle: 0, mag: 1 }, { label: "F&G", angle: 90, mag: 2 }]);
    const svg = renderPhysScene(sc).svg;
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("F&amp;G");
  });
  it("choice rules: same type, distinct, no note, FBD correct answer must not be the only one with the most arrows", () => {
    const a = fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 20 }]);
    const b = fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 12 }]);
    const c = fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 20 }, { label: "Fx", angle: 0, mag: 5 }]);
    expect(physChoiceIssues([a, b, a], 0)).toContain("duplicate_choice_scene");
    expect(physChoiceIssues([a, b, { ...b, note: "hint" } as PhysScene], 0)).toContain("choice_has_note");
    expect(physChoiceIssues([a, b, { type: "incline", theta: 30, m: 1 } as PhysScene], 0)).toContain("mixed_scene_types");
    expect(physChoiceIssues([a, b, c], 2)).toContain("correct_has_most_elements");
    expect(physChoiceIssues([a, b, c], 0)).toEqual([]);
  });
  it("figure_choice accepts ap_diagram children and renders them as a captioned A-D grid with one svg per choice", () => {
    const choices = [0, 1, 2, 3].map((i) => ({ type: "ap_diagram", variant: "phys_scene", scene: fbd([{ label: "Fg", angle: 270, mag: 20 }, { label: "N", angle: 90, mag: 20 - i * 3 }]) }));
    const spec = { type: "figure_choice", choices };
    const v = validateFigureSpec(spec);
    expect(v.ok).toBe(true);
    const html = renderFigureSvg(spec as never);
    expect((html.match(/<svg /g) ?? []).length).toBe(4);
    expect(html).toContain('data-testid="figure-choice"');
    for (const L of ["A", "B", "C", "D"]) expect(html).toContain(`data-choice="${L}"`);
    expect(checkFigure(spec, "Which free-body diagram is correct?", ["Diagram A", "Diagram B", "Diagram C", "Diagram D"], 0).ok).toBe(true);
    expect(figureAlt(spec as never)).toBeUndefined(); // figure_choice 의 alt 는 check 결과에서 온다
    const mixed = validateFigureSpec({ type: "figure_choice", choices: [choices[0], { type: "ap_diagram", variant: "phys_scene", scene: SAMPLE[1] }] });
    expect(mixed.ok).toBe(true); // 유형 혼합은 lint 가 막는다(스키마는 type 만 본다)
    expect(checkFigure({ type: "figure_choice", choices: [choices[0], { type: "ap_diagram", variant: "phys_scene", scene: SAMPLE[1] }] }, "", null, null).ok).toBe(false);
  });
  it("renderApDiagram dispatches to phys_scene and keeps the Bio variants working", () => {
    expect(renderApDiagram({ type: "ap_diagram", variant: "phys_scene", scene: SAMPLE[4] }).svg).toContain("30°");
    expect(renderApDiagram({ type: "ap_diagram", variant: "ribosome", codons: ["AUG", "GCU"], leftEnd: "5'", rightEnd: "3'", sites: [{ site: "P", codonIndex: 0 }] }).svg).toContain("Ribosome");
  });
});

// Python 기준 구현(phys_figs.py)과 같은 기하인지: 두 렌더의 모든 숫자(좌표·치수)와 텍스트를 순서대로 비교한다.
const ARCH = path.resolve(__dirname, "../../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const dp = havePy ? describe : describe.skip;
dp("TS render parity with the Python reference renderer", () => {
  const code = "import json,registry as R,phys_figs as F\nout={}\nfor k in R.PHYS_STAGES['phys_mc_all']+R.PHYS_STAGES['phys_sets']:\n  for p in R.batch(k,3,500):\n    for q in (p.get('items') or [p]):\n      scs=[]\n      st=q.get('stimulus') or p.get('stimulus') or {}\n      if st.get('kind')=='diagram': scs.append(st['data']['scene'])\n      scs+=q.get('option_scenes',[])\n      for sc in scs: out[json.dumps(sc,sort_keys=True)]={'scene':sc,'svg':F.render_svg(sc),'issues':F.check_scene(sc)}\nprint(json.dumps(list(out.values())))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 128 * 1024 * 1024, timeout: 170000 });
  const rows = (r.status === 0 ? JSON.parse(r.stdout) : []) as { scene: PhysScene; svg: string; issues: string[] }[];
  const tokens = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/ font-family="[^"]*"/g, "").replace(/-?\d+(?:\.\d+)?/g, (m) => Number(m).toFixed(1));
  it("covers all ten scene types", () => {
    expect(r.status).toBe(0);
    expect(new Set(rows.map((x) => x.scene.type)).size).toBeGreaterThanOrEqual(8);
  });
  it("produces the same drawing and the same check verdict for every Python scene", () => {
    for (const row of rows) {
      const ts = renderPhysScene(row.scene).svg;
      expect({ t: row.scene.type, t1: tokens(ts) }).toEqual({ t: row.scene.type, t1: tokens(row.svg) });
      const tsIssues = checkPhysScene(row.scene);
      expect({ t: row.scene.type, tsIssues }).toEqual({ t: row.scene.type, tsIssues: row.issues });
    }
  });
});
