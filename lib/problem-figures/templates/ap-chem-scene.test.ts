import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AP_PYTHON as PY } from "../../../scripts/ap-generation/py";
import { altParticles, altPes, checkChemScene, particlePositions, pesLabelRows, prettySpecies, renderChemSceneSpec, validateChemScene, type ChemSceneSpec, type ParticleScene, type PesScene } from "./ap-chem-scene";
import { renderApDiagram, validateApDiagram } from "./ap-diagrams";
import { renderAp } from "./ap-figures";
import { normalizeStimulus } from "../../ap-figures/normalize";
import { gateCandidate } from "../../ap-figures/gate";
import { validateFigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";

const pes = (peaks: [number, number][], unit = "MJ/mol"): PesScene => ({ type: "pes", peaks: peaks.map(([energy, electrons]) => ({ energy, electrons })), unit });
const SODIUM = pes([[150.21, 2], [15.39, 2], [14.18, 6], [0.91, 1]]);
const SAMPLE: { variant: "chem_pes" | "chem_particles"; scene: PesScene | ParticleScene }[] = [
  { variant: "chem_pes", scene: SODIUM },
  { variant: "chem_particles", scene: { type: "particles", box: [{ species: "H2", count: 7 }, { species: "N2", count: 3 }] } },
  { variant: "chem_particles", scene: { type: "particles", box: [{ species: "Al3+", count: 2 }, { species: "Cl-", count: 6 }] } },
  { variant: "chem_particles", scene: { type: "particles", phase: "solid" } },
  { variant: "chem_particles", scene: { type: "particles", phase: "liquid" } },
  { variant: "chem_particles", scene: { type: "particles", phase: "gas" } },
];

describe("ap_diagram chem_pes / chem_particles (TS 렌더)", () => {
  it("renders every sample to a valid SVG with alt text and passes the deterministic check", () => {
    for (const { variant, scene } of SAMPLE) {
      expect(validateChemScene(variant, scene).ok).toBe(true);
      const spec = { type: "ap_diagram", variant, scene } as ChemSceneSpec;
      expect(validateApDiagram(spec as never).ok).toBe(true);
      const r = renderAp(spec as never);
      expect(r.svg.startsWith("<svg")).toBe(true);
      expect(r.svg).toContain('role="img"');
      expect(r.svg).not.toMatch(/NaN|undefined/);
      expect(r.alt.length).toBeGreaterThan(40);
      expect({ variant, issues: checkChemScene(variant, scene) }).toEqual({ variant, issues: [] });
      expect(renderApDiagram(spec as never).issues).toEqual([]);
    }
  });
  it("is deterministic and the box counts are drawn exactly (no particle lost or overlapping)", () => {
    const sc: ParticleScene = { type: "particles", box: [{ species: "H2", count: 7 }, { species: "N2", count: 3 }] };
    expect(particlePositions(sc)).toEqual(particlePositions(sc));
    const pos = particlePositions(sc);
    expect(pos.filter((p) => p[2] === 0)).toHaveLength(7);
    expect(pos.filter((p) => p[2] === 1)).toHaveLength(3);
    expect(new Set(pos.map((p) => `${p[0]},${p[1]}`)).size).toBe(10);
    expect(renderChemSceneSpec({ type: "ap_diagram", variant: "chem_particles", scene: sc }).svg.match(/<circle/g)?.length).toBe(10 + 2); // 입자 10 + 범례 견본 2
  });
  it("phases look different: solid is a full lattice, liquid is dense and random, gas is sparse", () => {
    const n = (ph: "solid" | "liquid" | "gas") => particlePositions({ type: "particles", phase: ph }).length;
    expect(n("solid")).toBeGreaterThan(100);
    expect(n("liquid")).toBeGreaterThan(50);
    expect(n("gas")).toBeLessThanOrEqual(12);
    for (const ph of ["liquid", "gas"] as const) { const p = particlePositions({ type: "particles", phase: ph }); for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1])).toBeGreaterThanOrEqual(18.99); }
  });
  it("PES: peaks are drawn with heights proportional to electron counts and labels never overlap", () => {
    const svg = renderChemSceneSpec({ type: "ap_diagram", variant: "chem_pes", scene: SODIUM }).svg;
    expect(svg).toContain("Binding energy (MJ/mol, log scale)");
    expect(svg).toContain("Relative number of electrons");
    expect(pesLabelRows(SODIUM).every((r) => r.row >= 0)).toBe(true);
    expect(altPes(SODIUM)).toContain("150.21, 2");
    // 6 전자 봉우리 높이가 2 전자 봉우리의 3 배
    const hs = [...svg.matchAll(/<line x1="([0-9.]+)" y1="150" x2="\1" y2="([0-9.]+)" stroke="#111" stroke-width="3"\/>/g)].map((m) => 150 - Number(m[2]));
    expect(hs).toHaveLength(4);
    expect(hs[2] / hs[0]).toBeCloseTo(3, 1);
  });
  it("rejects malformed scenes and flags broken geometry", () => {
    expect(validateChemScene("chem_pes", { type: "pes", peaks: [] }).ok).toBe(false);
    expect(validateChemScene("chem_particles", { type: "particles" }).ok).toBe(false);
    expect(validateChemScene("chem_particles", { type: "particles", box: [{ species: "X", count: 1.5 }] }).ok).toBe(false);
    expect(validateApDiagram({ type: "ap_diagram", variant: "chem_pes", scene: { type: "pes", peaks: [{ energy: -1, electrons: 2 }] } }).ok).toBe(false);
    expect(checkChemScene("chem_pes", pes([[1, 2], [2, 2]]))).toContain("energies_not_decreasing");
    expect(checkChemScene("chem_particles", { type: "particles", box: [{ species: "A", count: 40 }, { species: "B", count: 40 }] })).toContain("too_many_particles");
    expect(checkChemScene("chem_particles", { type: "particles", box: [{ species: "A", count: 2 }, { species: "A", count: 3 }] })).toContain("duplicate_species");
  });
  it("species labels use sub/superscripts and are escaped", () => {
    expect(prettySpecies("SO42-")).toEqual(["SO4", "2-"]);
    expect(prettySpecies("Ca2+")).toEqual(["Ca", "2+"]);
    expect(prettySpecies("Cl-")).toEqual(["Cl", "-"]);
    expect(prettySpecies("NH4+")).toEqual(["NH4", "+"]);
    expect(prettySpecies("H2")).toEqual(["H2", ""]);
    const svg = renderChemSceneSpec({ type: "ap_diagram", variant: "chem_particles", scene: { type: "particles", box: [{ species: "A<b>", count: 1 }, { species: "SO42-", count: 1 }] } }).svg;
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("baseline-shift=\"super\"");
    expect(altParticles({ type: "particles", box: [{ species: "Ca2+", count: 1 }] })).toContain("1 particle of Ca2+");
  });
  it("normalizes stimulus data: PES drops hidden atomic-number data, particle scenes pass through, both flow through the figure gate", () => {
    const n1 = normalizeStimulus({ kind: "diagram", description: "d", data: { variant: "chem_pes", peaks: [{ energy: 150.21, electrons: 2 }, { energy: 14.18, electrons: 6 }], unit: "MJ/mol", z: 11 } } as never, { subject: "ap_chemistry", visibleText: "" });
    expect(n1.spec?.type).toBe("ap_diagram");
    expect(JSON.stringify(n1.spec)).not.toContain('"z"');
    const n2 = normalizeStimulus({ kind: "diagram", description: "d", data: { variant: "chem_particles", scene: { type: "particles", box: [{ species: "H2", count: 4 }] } } } as never, { subject: "ap_chemistry", visibleText: "" });
    expect(n2.spec?.type).toBe("ap_diagram");
    const g = gateCandidate({ candidateKey: "k1", apSubjectCode: "ap_chemistry", payload: { stem: "The photoelectron spectrum of a neutral atom of element X is shown. Which element is X?", options: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }], stimulus: { kind: "diagram", description: "PES", data: { variant: "chem_pes", peaks: [{ energy: 150.21, electrons: 2 }, { energy: 15.39, electrons: 2 }, { energy: 14.18, electrons: 6 }, { energy: 0.91, electrons: 1 }], unit: "MJ/mol" } } } } as never);
    expect({ status: g.status, renderType: g.renderType, issues: g.issues.filter((i) => i.level === "error") }).toEqual({ status: "pass", renderType: "ap_diagram:chem_pes", issues: [] });
    expect(g.output).toContain("<svg");
    const spec = { type: "figure_choice", choices: SAMPLE.slice(3, 6).map((s) => ({ type: "ap_diagram", variant: s.variant, scene: s.scene })) };
    expect(validateFigureSpec(spec).ok).toBe(true);
    expect(renderFigureSvg(spec as never)).toContain("<svg");
    void figureAlt;
  });
});

// Python 기준 구현(chem_figs.py)과 같은 기하인지: 두 렌더의 모든 숫자(좌표·치수)와 텍스트를 순서대로 비교한다.
const ARCH = path.resolve(__dirname, "../../../scripts/ap-generation/archetypes");
const havePy = spawnSync(PY, ["-c", "import scipy, numpy, sympy"], { encoding: "utf-8" }).status === 0;
const dp = havePy ? describe : describe.skip;
dp("TS render parity with the Python reference renderer", () => {
  const code = "import json,registry as R,chem_figs as F\nout={}\nfor n in ['ch_pes_identify','ch_pes_subshell','ch_particulate_limiting','ch_particle_phase','ch_particle_solution_formula']:\n  for p in R.batch(n,12,700):\n    for q in (p.get('items') or [p]):\n      st=q.get('stimulus') or p.get('stimulus') or {}\n      d=st['data']; sc=F.scene_of(d['variant'],d)\n      out[json.dumps(sc,sort_keys=True)]={'variant':d['variant'],'scene':sc,'svg':F.render(d['variant'],d),'issues':F.check_pes(sc) if d['variant']=='chem_pes' else F.check_particles(sc)}\nfor ph in F.PHASES:\n  sc={'type':'particles','phase':ph}\n  out[json.dumps(sc,sort_keys=True)]={'variant':'chem_particles','scene':sc,'svg':F.render_particles(sc),'issues':F.check_particles(sc)}\nprint(json.dumps(list(out.values())))";
  const r = spawnSync(PY, ["-B", "-c", code], { cwd: ARCH, encoding: "utf-8", maxBuffer: 128 * 1024 * 1024, timeout: 170000 });
  const rows = (r.status === 0 ? JSON.parse(r.stdout) : []) as { variant: "chem_pes" | "chem_particles"; scene: PesScene | ParticleScene; svg: string; issues: string[] }[];
  const tokens = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/ font-family="[^"]*"/g, "").replace(/-?\d+(?:\.\d+)?/g, (m) => Number(m).toFixed(1));
  it("covers both variants and all three phases", () => {
    expect(r.status).toBe(0);
    expect(rows.some((x) => x.variant === "chem_pes")).toBe(true);
    expect(rows.filter((x) => x.variant === "chem_particles").length).toBeGreaterThanOrEqual(5);
  });
  it("produces the same drawing, the same alt text and the same check verdict for every Python scene", () => {
    for (const row of rows) {
      const ts = renderChemSceneSpec({ type: "ap_diagram", variant: row.variant, scene: row.scene } as ChemSceneSpec);
      expect({ v: row.variant, t: tokens(ts.svg) }).toEqual({ v: row.variant, t: tokens(row.svg) });
      expect({ v: row.variant, issues: checkChemScene(row.variant, row.scene) }).toEqual({ v: row.variant, issues: row.issues });
      expect(row.issues).toEqual([]);
    }
  });
});
