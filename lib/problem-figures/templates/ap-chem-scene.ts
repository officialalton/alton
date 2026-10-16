// AP Chemistry 그림(ap_diagram / chem_pes · chem_particles) — Python 장면 모델(scripts/ap-generation/archetypes/chem_figs.py)과 같은 기하의 결정적 SVG 렌더.
// 장면 모델 하나에서 본문 수치와 그림이 모두 나온다(LLM 은 그림을 그리지 않는다). 원자 번호 Z 같은 화면에 보이지 않는 값은 장면에 넣지 않는다(정답 누출 방지).
import { esc, FONT, type FigureIssue } from "./_layout";

export const CHEM_W = 360;
export const CHEM_H = 220;
export const CHEM_VARIANTS = ["chem_pes", "chem_particles"] as const;
export const CHEM_PHASES = ["solid", "liquid", "gas"] as const;
const PARTICLE_COLORS = ["#1f77b4", "#d62728", "#2ca02c", "#9467bd"];
const BOX = { x0: 20, y0: 15, x1: 340, y1: 175 };
const CELL = 26, COLS = 12, ROWS = 6, R_P = 9;

export type PesScene = { type: "pes"; peaks: { energy: number; electrons: number }[]; unit?: string };
export type ParticleGroup = { species: string; count: number };
export type ParticleScene = { type: "particles"; box?: ParticleGroup[]; phase?: (typeof CHEM_PHASES)[number]; arrangement?: string; packing_fraction?: number };
export type ChemPesSpec = { type: "ap_diagram"; variant: "chem_pes"; title?: string; scene: PesScene };
export type ChemParticlesSpec = { type: "ap_diagram"; variant: "chem_particles"; title?: string; scene: ParticleScene };
export type ChemSceneSpec = ChemPesSpec | ChemParticlesSpec;

type R = Record<string, unknown>;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is R => typeof v === "object" && v !== null && !Array.isArray(v);
const n1 = (v: number) => v.toFixed(1);
/** Python 의 `:g` 와 같은 짧은 숫자 표기. */
export const gfmt = (v: number) => String(Number(v.toPrecision(6)));

/** 장면 검증(구조·유한 수). 실패하면 사유를 돌려준다. */
export function validateChemScene(variant: string, scene: unknown): { ok: true; scene: PesScene | ParticleScene } | { ok: false; error: string } {
  if (!isObj(scene)) return { ok: false, error: "scene 이 객체가 아닙니다." };
  if (variant === "chem_pes") {
    const pk = scene.peaks;
    if (scene.type !== "pes" || !Array.isArray(pk) || pk.length < 1 || pk.length > 8) return { ok: false, error: "pes: peaks 1~8개가 필요합니다." };
    if (!pk.every((p) => isObj(p) && isNum(p.energy) && p.energy > 0 && isNum(p.electrons) && p.electrons >= 1)) return { ok: false, error: "pes: 각 봉우리는 energy(>0)와 electrons(>=1)가 필요합니다." };
    return { ok: true, scene: scene as unknown as PesScene };
  }
  if (variant === "chem_particles") {
    if (scene.type !== "particles") return { ok: false, error: "particles: type 이 particles 가 아닙니다." };
    if (Array.isArray(scene.box)) {
      const bx = scene.box;
      if (bx.length < 1 || bx.length > 4 || !bx.every((g) => isObj(g) && typeof g.species === "string" && g.species.trim() && isNum(g.count) && g.count >= 0 && Number.isInteger(g.count))) return { ok: false, error: "particles: box 는 {species, count} 1~4개여야 합니다." };
    } else if (!CHEM_PHASES.includes(scene.phase as never) && typeof scene.arrangement !== "string") return { ok: false, error: "particles: box 또는 phase/arrangement 가 필요합니다." };
    return { ok: true, scene: scene as unknown as ParticleScene };
  }
  return { ok: false, error: `알 수 없는 chem variant: ${variant}` };
}

const wrap = (body: string, alt: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHEM_W} ${CHEM_H}" width="${CHEM_W}" height="${CHEM_H}" style="max-width:100%;height:auto" role="img" aria-label="${esc(alt)}" font-family="${FONT}">${body}</svg>`;

/** Park–Miller 최소 표준 생성기(정수만 사용 — Python 과 같은 열). */
class Lcg {
  s: number;
  constructor(seed: number) { this.s = (Math.trunc(seed) % 2147483646) + 1; }
  next(): number { this.s = (this.s * 48271) % 2147483647; return this.s; }
  below(n: number): number { return this.next() % n; }
}

/** 'SO42-' → ['SO4','2-'], 'Ca2+' → ['Ca','2+'], 'Na+' → ['Na','+'], 'H2' → ['H2','']. NH4+/H3O+ 는 전하 숫자를 읽지 않는다. */
export function prettySpecies(sp: string): [string, string] {
  if (sp === "NH4+" || sp === "H3O+") return [sp.slice(0, -1), "+"];
  if (!/[+-]$/.test(sp)) return [sp, ""];
  const rest = sp.slice(0, -1), sign = sp.slice(-1);
  if (rest && /\d$/.test(rest)) return [rest.slice(0, -1), rest.slice(-1) + sign];
  return [rest, sign];
}

function label(x: number, y: number, sp: string, size = 11, anchor = "start"): string {
  const [base, charge] = prettySpecies(sp);
  const parts: string[] = [];
  for (const tok of base.match(/\d+|[^\d]+/g) ?? []) parts.push(/^\d+$/.test(tok) ? `<tspan baseline-shift="sub" font-size="${size - 3}">${tok}</tspan>` : esc(tok));
  if (charge) parts.push(`<tspan baseline-shift="super" font-size="${size - 3}">${esc(charge)}</tspan>`);
  return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${anchor}" fill="#111">${parts.join("")}</text>`;
}

// ---------------- PES ----------------
const PES = { x0: 56, x1: 340, yb: 150, yt: 20, rowY: [166, 179, 192], titleY: 212 };

function pesXpos(scene: PesScene): (e: number) => number {
  const es = scene.peaks.map((p) => p.energy);
  const emin = Math.min(...es) / 1.6, emax = Math.max(...es) * 1.6;
  return (e) => PES.x0 + ((PES.x1 - PES.x0) * (Math.log(emax) - Math.log(e))) / (Math.log(emax) - Math.log(emin));
}

/** 봉우리 값 글자를 왼쪽부터 놓되 겹치면 아래 줄로(최대 3줄). 겹침을 풀 수 없으면 row=-1. */
export function pesLabelRows(scene: PesScene): { x: number; row: number; text: string }[] {
  const xp = pesXpos(scene), out: { x: number; row: number; text: string }[] = [], right = [-1e9, -1e9, -1e9];
  for (const p of [...scene.peaks].sort((a, b) => b.energy - a.energy)) {
    const x = xp(p.energy), t = gfmt(p.energy), w = 5.8 * t.length;
    let row = -1;
    for (let r = 0; r < 3; r++) if (x - w / 2 >= right[r] + 3) { row = r; right[r] = x + w / 2; break; }
    out.push({ x, row, text: t });
  }
  return out;
}

export function altPes(scene: PesScene): string {
  const pk = [...scene.peaks].sort((a, b) => b.energy - a.energy), unit = scene.unit ?? "MJ/mol";
  return `Photoelectron spectrum with ${pk.length} peaks on a logarithmic binding-energy axis with the highest energy at the left. Peaks (binding energy in ${unit}, relative number of electrons): ${pk.map((p) => `${gfmt(p.energy)}, ${p.electrons}`).join("; ")}. Peak heights are proportional to the relative number of electrons.`;
}

function renderPes(scene: PesScene): { svg: string; alt: string } {
  const maxn = Math.max(...scene.peaks.map((p) => p.electrons)), xp = pesXpos(scene), unit = scene.unit ?? "MJ/mol";
  const out: string[] = [`<line x1="${PES.x0 - 8}" y1="${PES.yb}" x2="${PES.x1 + 8}" y2="${PES.yb}" stroke="#111" stroke-width="1.5"/>`, `<line x1="${PES.x0 - 8}" y1="${PES.yt - 6}" x2="${PES.x0 - 8}" y2="${PES.yb}" stroke="#111" stroke-width="1.5"/>`];
  for (let k = 1; k <= maxn; k++) {
    const yy = PES.yb - ((PES.yb - PES.yt) * k) / maxn;
    out.push(`<line x1="${PES.x0 - 8}" y1="${n1(yy)}" x2="${PES.x1 + 8}" y2="${n1(yy)}" stroke="#ddd" stroke-width="0.6"/><text x="${PES.x0 - 12}" y="${n1(yy + 3)}" font-size="9" text-anchor="end" fill="#555">${k}</text>`);
  }
  const mid = Math.floor((PES.yb + PES.yt) / 2);
  out.push(`<text x="14" y="${mid}" font-size="10" text-anchor="middle" fill="#111" transform="rotate(-90 14 ${mid})">Relative number of electrons</text>`);
  for (const p of scene.peaks) {
    const x = xp(p.energy), h = ((PES.yb - PES.yt) * p.electrons) / maxn;
    out.push(`<line x1="${n1(x)}" y1="${PES.yb}" x2="${n1(x)}" y2="${n1(PES.yb - h)}" stroke="#111" stroke-width="3"/>`);
  }
  for (const { x, row, text } of pesLabelRows(scene)) {
    const yy = PES.rowY[Math.max(row, 0)];
    out.push(`<line x1="${n1(x)}" y1="${PES.yb}" x2="${n1(x)}" y2="${yy - 10}" stroke="#888" stroke-width="0.8"/><text x="${n1(x)}" y="${yy}" font-size="10" text-anchor="middle" fill="#111">${text}</text>`);
  }
  out.push(`<text x="${Math.floor((PES.x0 + PES.x1) / 2)}" y="${PES.titleY}" font-size="12" text-anchor="middle" fill="#111">Binding energy (${esc(unit)}, log scale)</text>`);
  const alt = altPes(scene);
  return { svg: wrap(out.join(""), alt), alt };
}

// ---------------- 입자 ----------------
function phaseOf(scene: ParticleScene): (typeof CHEM_PHASES)[number] {
  if (scene.phase && CHEM_PHASES.includes(scene.phase)) return scene.phase;
  const a = scene.arrangement ?? "";
  return a.startsWith("regular") ? "solid" : a.includes("gaps") ? "gas" : "liquid";
}

function rsa(rng: Lcg, n: number, mind: number, attempts: number): [number, number][] {
  const { x0, y0, x1, y1 } = BOX, pts: [number, number][] = [];
  for (let i = 0; i < attempts; i++) {
    if (pts.length >= n) break;
    const x = x0 + R_P + 1 + rng.below(x1 - x0 - 2 * R_P - 1), y = y0 + R_P + 1 + rng.below(y1 - y0 - 2 * R_P - 1);
    if (pts.every(([a, b]) => (x - a) ** 2 + (y - b) ** 2 >= mind * mind)) pts.push([x, y]);
  }
  return pts;
}

/** [x, y, 종 번호] — 결정적. box 가 있으면 종별 개수를 격자 칸에 무작위로 놓고, 없으면 상(solid/liquid/gas)에 맞게 놓는다. */
export function particlePositions(scene: ParticleScene): [number, number, number][] {
  const { x0, y0, x1, y1 } = BOX;
  if (scene.box && scene.box.length) {
    const groups = scene.box, total = groups.reduce((a, g) => a + g.count, 0);
    const rng = new Lcg(total * 13 + groups.length * 7 + groups.reduce((a, g, i) => a + g.count * (i + 3), 0));
    const cells = Array.from({ length: COLS * ROWS }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) { const j = rng.below(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const pos: [number, number, number][] = []; let k = 0;
    groups.forEach((g, gi) => { for (let q = 0; q < g.count; q++) { const c = cells[k++]; pos.push([x0 + 14 + (c % COLS) * CELL, y0 + 14 + Math.floor(c / COLS) * CELL, gi]); } });
    return pos;
  }
  const ph = phaseOf(scene);
  if (ph === "solid") {
    const pos: [number, number, number][] = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 15; c++) { const x = x0 + 10 + c * 20 + (r % 2) * 10, y = y0 + 10 + r * 17; if (x <= x1 - 10 && y <= y1 - 9) pos.push([x, y, 0]); }
    return pos;
  }
  const rng = new Lcg(ph === "liquid" ? 911 : 313);
  return (ph === "liquid" ? rsa(rng, 90, 19, 9000) : rsa(rng, 12, 52, 2000)).map(([x, y]) => [x, y, 0]);
}

export function altParticles(scene: ParticleScene): string {
  if (scene.box && scene.box.length) {
    const parts = scene.box.map((g) => { const [base, charge] = prettySpecies(g.species); return `${g.count} particle${g.count !== 1 ? "s" : ""} of ${base}${charge}`; });
    return `Particulate diagram of a box containing ${parts.join(", ")}. The key below the box shows which color is which species.`;
  }
  const d = { solid: "particles in a regular repeating pattern, all touching their neighbors", liquid: "particles in a random arrangement, close together and touching", gas: "a few particles in a random arrangement with large gaps between them" }[phaseOf(scene)];
  return `Particulate diagram of one pure substance: ${d}.`;
}

function renderParticles(scene: ParticleScene): { svg: string; alt: string } {
  const { x0, y0, x1, y1 } = BOX, hasBox = !!(scene.box && scene.box.length);
  const out: string[] = [`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#111" stroke-width="1.5"/>`];
  for (const [x, y, gi] of particlePositions(scene)) out.push(`<circle cx="${x}" cy="${y}" r="${hasBox ? 8 : R_P}" fill="${PARTICLE_COLORS[gi % 4]}" stroke="#111" stroke-width="0.6"/>`);
  if (hasBox) {
    const groups = scene.box!, step = (CHEM_W - 40) / groups.length;
    groups.forEach((g, gi) => {
      const lx = 20 + step * gi;
      out.push(`<circle cx="${n1(lx + 8)}" cy="196" r="6" fill="${PARTICLE_COLORS[gi % 4]}" stroke="#111" stroke-width="0.6"/>`, label(lx + 20, 200, g.species, 12));
    });
  }
  const alt = altParticles(scene);
  return { svg: wrap(out.join(""), alt), alt };
}

// ---------------- 결정적 검사 ----------------
function viewBoxIssues(svg: string): string[] {
  const out: string[] = [];
  if (/NaN|Infinity/.test(svg)) out.push("svg_nonfinite");
  for (const m of svg.matchAll(/\b(?:x|x1|x2|cx)="(-?[0-9.]+)"/g)) { const v = Number(m[1]); if (v < -1 || v > CHEM_W + 1) { out.push("outside_viewbox"); break; } }
  for (const m of svg.matchAll(/\b(?:y|y1|y2|cy)="(-?[0-9.]+)"/g)) { const v = Number(m[1]); if (v < -1 || v > CHEM_H - 3) { out.push("outside_viewbox"); break; } }
  return out;
}

/** Python `check_pes`/`check_particles` 와 같은 규칙(Z 합 검사는 TS 에 없음 — Z 는 화면 데이터에 없다). 빈 배열이면 통과. */
export function checkChemScene(variant: string, scene: PesScene | ParticleScene): string[] {
  const v = validateChemScene(variant, scene);
  if (!v.ok) return ["scene_invalid"];
  const issues: string[] = [];
  if (variant === "chem_pes") {
    const sc = scene as PesScene, es = sc.peaks.map((p) => p.energy);
    for (let i = 0; i < es.length - 1; i++) if (es[i] <= es[i + 1]) { issues.push("energies_not_decreasing"); break; }
    if (sc.peaks.some((p) => p.electrons < 1 || !Number.isInteger(p.electrons))) issues.push("electron_counts");
    if (sc.peaks.length > 8) issues.push("too_many_peaks");
    if (pesLabelRows(sc).some((r) => r.row === -1)) issues.push("peak_labels_overlap");
    issues.push(...viewBoxIssues(renderPes(sc).svg));
  } else {
    const sc = scene as ParticleScene;
    if (sc.box && sc.box.length) {
      if (sc.box.reduce((a, g) => a + g.count, 0) > COLS * ROWS) issues.push("too_many_particles");
      if (new Set(sc.box.map((g) => g.species)).size !== sc.box.length) issues.push("duplicate_species");
    } else if (typeof sc.packing_fraction === "number" && !(sc.packing_fraction > 0 && sc.packing_fraction < 0.8)) issues.push("packing_fraction");
    issues.push(...viewBoxIssues(renderParticles(sc).svg));
  }
  return issues;
}

export function renderChemSceneSpec(spec: ChemSceneSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const r = spec.variant === "chem_pes" ? renderPes(spec.scene) : renderParticles(spec.scene);
  const issues: FigureIssue[] = checkChemScene(spec.variant, spec.scene).map((code) => ({ code, message: `화학 그림 검사 실패: ${code}` }));
  return { ...r, issues };
}

/** LLM 풀이자·검토자에게 주는 "학생이 보는 그림" 텍스트 설명(결정적, 장면 모델에서만 파생). */
export function describeChemSceneForReview(variant: string, scene: PesScene | ParticleScene): string {
  return variant === "chem_pes" ? altPes(scene as PesScene) : altParticles(scene as ParticleScene);
}
