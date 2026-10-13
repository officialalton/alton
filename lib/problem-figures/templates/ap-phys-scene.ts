// AP Physics 1 장면 그림(ap_diagram / phys_scene) — Python 장면 모델(scripts/ap-generation/archetypes/phys_figs.py)과 같은 기하의 결정적 SVG 렌더.
// 장면 모델 하나에서 본문 수치와 그림이 모두 나온다(LLM 은 그림을 그리지 않는다). 지원 type: fbd, energy_bars, vector, motion_diagram, incline, atwood, collision, beam, utube, tank_hole.
import { esc, FONT, type FigureIssue } from "./_layout";

export const PHYS_W = 360;
export const PHYS_H = 240;
export const PHYS_SCENE_TYPES = ["fbd", "energy_bars", "vector", "motion_diagram", "incline", "atwood", "collision", "beam", "utube", "tank_hole"] as const;
export const BAR_KEYS = ["K", "Ug", "Us", "Eint"] as const;

export type PhysScene = { type: (typeof PHYS_SCENE_TYPES)[number]; note?: string; allow_overlap?: boolean } & Record<string, unknown>;
export type PhysSceneSpec = { type: "ap_diagram"; variant: "phys_scene"; title?: string; scene: PhysScene };

type R = Record<string, unknown>;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is R => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): R[] => (Array.isArray(v) ? (v as R[]) : []);
const n1 = (v: number) => v.toFixed(1);
/** Python 의 `:g` 와 같은 짧은 숫자 표기. */
export const gfmt = (v: number) => String(Number(v.toPrecision(6)));
const sceneNum = (o: R, k: string): number => (isNum(o[k]) ? (o[k] as number) : NaN);

/** 장면 모델 검증(구조·유한 수). 실패하면 사유를 돌려준다. */
export function validatePhysScene(scene: unknown): { ok: true; scene: PhysScene } | { ok: false; error: string } {
  if (!isObj(scene)) return { ok: false, error: "scene 이 객체가 아닙니다." };
  const t = scene.type;
  if (!PHYS_SCENE_TYPES.includes(t as never)) return { ok: false, error: `알 수 없는 scene.type: ${String(t)}` };
  const bad = (m: string) => ({ ok: false as const, error: `${String(t)}: ${m}` });
  if (t === "fbd") {
    const fs = arr(scene.forces);
    if (!fs.length || fs.length > 8) return bad("forces 1~8개가 필요합니다.");
    if (!isNum(scene.scale) || scene.scale <= 0) return bad("scale(>0)이 필요합니다.");
    if (!fs.every((f) => typeof f.label === "string" && f.label.trim() && isNum(f.angle) && isNum(f.mag) && f.mag > 0)) return bad("각 힘은 label/angle/mag(>0)가 필요합니다.");
    if (scene.body !== "box" && scene.body !== "dot") return bad("body 는 box|dot 입니다.");
  } else if (t === "energy_bars") {
    const ss = arr(scene.states);
    if (ss.length < 1 || ss.length > 4 || !isNum(scene.ymax) || scene.ymax <= 0) return bad("states 1~4개와 ymax(>0)가 필요합니다.");
    if (!ss.every((s) => typeof s.name === "string" && isObj(s.bars) && Object.values(s.bars).every((v) => isNum(v)))) return bad("각 state 는 name/bars(수)가 필요합니다.");
  } else if (t === "vector") {
    const vs = arr(scene.vectors);
    if (!vs.length || vs.length > 6 || !vs.every((v) => typeof v.label === "string" && isNum(v.dx) && isNum(v.dy))) return bad("vectors 1~6개(label/dx/dy)가 필요합니다.");
  } else if (t === "motion_diagram") {
    const xs = scene.xs, vs = scene.vs;
    if (!Array.isArray(xs) || !Array.isArray(vs) || xs.length < 2 || xs.length > 12 || xs.length !== vs.length || !xs.every(isNum) || !vs.every(isNum)) return bad("xs/vs 는 같은 길이(2~12)의 수 배열이어야 합니다.");
  } else if (t === "incline") {
    if (!isNum(scene.theta) || scene.theta <= 0 || scene.theta >= 90 || !isNum(scene.m) || scene.m <= 0) return bad("theta(0~90)와 m(>0)이 필요합니다.");
  } else if (t === "atwood") {
    if (!isNum(scene.m1) || !isNum(scene.m2) || scene.m1 <= 0 || scene.m2 <= 0) return bad("m1, m2(>0)가 필요합니다.");
  } else if (t === "collision") {
    for (const row of [scene.before, scene.after]) {
      if (row === null || row === undefined) continue;
      if (!Array.isArray(row) || row.length < 1 || row.length > 3 || !row.every((o) => isObj(o) && isNum(o.m) && isNum(o.v))) return bad("before/after 는 {m, v} 1~3개이거나 null 이어야 합니다.");
    }
    if (!Array.isArray(scene.before)) return bad("before 가 필요합니다.");
  } else if (t === "beam") {
    if (!isNum(scene.length) || scene.length <= 0 || !isNum(scene.pivot)) return bad("length(>0)와 pivot 이 필요합니다.");
    if (!arr(scene.forces).every((f) => isNum(f.x) && (f.dir === "up" || f.dir === "down") && typeof f.label === "string")) return bad("forces 는 {x, dir, label} 이어야 합니다.");
  } else if (t === "utube") {
    if (![scene.h1, scene.h2, scene.rho1, scene.rho2].every((v) => isNum(v) && v > 0)) return bad("h1, h2, rho1, rho2(>0)가 필요합니다.");
  } else if (t === "tank_hole") {
    if (![scene.depth, scene.hole_height, scene.tank_height].every((v) => isNum(v) && v >= 0) || (scene.tank_height as number) <= 0) return bad("depth, hole_height, tank_height 가 필요합니다.");
  }
  return { ok: true, scene: scene as PhysScene };
}

// ---------- 그리기 도우미 ----------
function arrow(x0: number, y0: number, x1: number, y1: number, color = "#111", w = 2.2): string {
  const a = Math.atan2(y1 - y0, x1 - x0), hx = 8, hy = 4;
  const p1 = [x1 - hx * Math.cos(a) + hy * Math.sin(a), y1 - hx * Math.sin(a) - hy * Math.cos(a)];
  const p2 = [x1 - hx * Math.cos(a) - hy * Math.sin(a), y1 - hx * Math.sin(a) + hy * Math.cos(a)];
  return `<line x1="${n1(x0)}" y1="${n1(y0)}" x2="${n1(x1)}" y2="${n1(y1)}" stroke="${color}" stroke-width="${w}"/><polygon points="${n1(x1)},${n1(y1)} ${n1(p1[0])},${n1(p1[1])} ${n1(p2[0])},${n1(p2[1])}" fill="${color}"/>`;
}
const text = (x: number, y: number, s: unknown, size = 13, anchor = "middle", color = "#111") => `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${anchor}" fill="${color}">${esc(String(s))}</text>`;
const wrap = (body: string, alt: string, w = PHYS_W, h = PHYS_H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:100%;height:auto" role="img" aria-label="${esc(alt)}" font-family="${FONT}">${body}</svg>`;
const rad = (d: number) => (d * Math.PI) / 180;

export function fbdVectors(scene: R): { f: R; dx: number; dy: number }[] {
  return arr(scene.forces).map((f) => { const L = (f.mag as number) * (scene.scale as number), a = rad(f.angle as number); return { f, dx: L * Math.cos(a), dy: -L * Math.sin(a) }; });
}

// ---------- 장면별 렌더 ----------
function renderFbd(sc: R): { body: string; alt: string } {
  const cx = PHYS_W / 2, cy = PHYS_H / 2, box = sc.body === "box";
  const parts: string[] = [box ? `<rect x="${cx - 18}" y="${cy - 18}" width="36" height="36" fill="#eee" stroke="#111"/>` : `<circle cx="${cx}" cy="${cy}" r="5" fill="#111"/>`];
  for (const { f, dx, dy } of fbdVectors(sc)) {
    const ang = rad(f.angle as number);
    const x0 = cx + (box ? 18 * Math.cos(ang) : 0), y0 = cy - (box ? 18 * Math.sin(ang) : 0);
    parts.push(arrow(x0, y0, x0 + dx, y0 + dy));
    parts.push(text(x0 + dx + (Math.abs(dx) > Math.abs(dy) * 0.5 ? (dx >= 0 ? 12 : -12) : 0), y0 + dy + (dy < 0 ? -6 : 14), f.label));
  }
  const dirName = (a: number) => { const d = ((a % 360) + 360) % 360; return d === 0 ? "right" : d === 90 ? "up" : d === 180 ? "left" : d === 270 ? "down" : `${gfmt(d)} degrees`; };
  const alt = `Free-body diagram of a ${box ? "box" : "point object"} with ${arr(sc.forces).length} force arrows (${arr(sc.forces).map((f) => `${String(f.label)} pointing ${dirName(f.angle as number)}`).join(", ")}). Arrow lengths are proportional to the force magnitudes.`;
  return { body: parts.join(""), alt };
}

function renderBars(sc: R): { body: string; alt: string } {
  const states = arr(sc.states), n = states.length, gw = (PHYS_W - 40) / n, base = PHYS_H - 40, scY = (base - 20) / (sc.ymax as number);
  const parts = [`<line x1="20" y1="${base}" x2="${PHYS_W - 10}" y2="${base}" stroke="#111"/>`];
  states.forEach((s, i) => {
    const x0 = 20 + gw * i + 10, bw = (gw - 20) / 4, bars = s.bars as R;
    BAR_KEYS.forEach((k, j) => {
      const v = isNum(bars[k]) ? (bars[k] as number) : 0, h = v * scY;
      parts.push(`<rect x="${n1(x0 + bw * j)}" y="${n1(base - h)}" width="${n1(bw - 3)}" height="${n1(h)}" fill="#999" stroke="#111"/>`, text(x0 + bw * j + bw / 2 - 1.5, base + 13, k, 10));
    });
    parts.push(text(x0 + (gw - 20) / 2, base + 28, s.name, 11));
  });
  return { body: parts.join(""), alt: `Energy bar charts for ${states.map((s) => String(s.name)).join(" and ")} on the same scale, with bars for kinetic (K), gravitational (Ug), spring (Us) and internal (Eint) energy.` };
}

function renderVectors(sc: R): { body: string; alt: string } {
  const vs = arr(sc.vectors), mx = Math.max(...vs.map((v) => Math.max(Math.abs(v.dx as number), Math.abs(v.dy as number)))) || 1, k = 70 / mx;
  let x = 60, y = PHYS_H - 60; const parts: string[] = [];
  for (const v of vs) { const x1 = x + (v.dx as number) * k, y1 = y - (v.dy as number) * k; parts.push(arrow(x, y, x1, y1), text((x + x1) / 2, (y + y1) / 2 - 7, v.label)); x = x1; y = y1; }
  if (sc.resultant) parts.push(arrow(60, PHYS_H - 60, x, y, "#b00"));
  return { body: parts.join(""), alt: `Vectors ${vs.map((v) => String(v.label)).join(", ")} drawn tail to head${sc.resultant ? ", with the resultant from the first tail to the last head" : ""}.` };
}

function renderMotion(sc: R): { body: string; alt: string } {
  const xs = sc.xs as number[], vs = sc.vs as number[], lo = Math.min(...xs), hi = Math.max(...xs), sx = (PHYS_W - 100) / (hi - lo || 1), vm = Math.max(...vs.map(Math.abs)) || 1;
  const parts = [`<line x1="20" y1="150" x2="${PHYS_W - 20}" y2="150" stroke="#bbb"/>`];
  xs.forEach((x, i) => { const px = 50 + (x - lo) * sx; parts.push(`<circle cx="${n1(px)}" cy="150" r="4" fill="#111"/>`); if (vs[i]) parts.push(arrow(px, 130, px + (36 * vs[i]) / vm, 130)); });
  return { body: parts.join(""), alt: `Motion diagram: ${xs.length} dots at equal time intervals along a line, each with a velocity arrow whose length is proportional to the speed.` };
}

function renderIncline(sc: R): { body: string; alt: string } {
  const th = rad(sc.theta as number), L = 220, bx = 40 + L * Math.cos(th), by = PHYS_H - 30, th2 = L * Math.sin(th);
  const parts = [`<polygon points="40,${PHYS_H - 30} ${n1(bx)},${n1(by)} ${n1(bx)},${n1(by - th2)}" fill="#ddd" stroke="#111"/>`, text(70, PHYS_H - 36, `${gfmt(sc.theta as number)}°`, 12), text(bx - 60, by - th2 / 2, `${gfmt(sc.m as number)} kg`, 12)];
  return { body: parts.join(""), alt: `A ${gfmt(sc.theta as number)} degree incline with a ${gfmt(sc.m as number)} kg block.` };
}

function renderAtwood(sc: R): { body: string; alt: string } {
  const m1 = gfmt(sc.m1 as number), m2 = gfmt(sc.m2 as number);
  if (sc.table) {
    const parts = ['<rect x="60" y="70" width="140" height="10" fill="#ccc" stroke="#111"/><circle cx="215" cy="75" r="12" fill="#eee" stroke="#111"/>',
      '<rect x="110" y="48" width="30" height="22" fill="#eee" stroke="#111"/><line x1="140" y1="59" x2="203" y2="59" stroke="#111"/><line x1="227" y1="75" x2="227" y2="150" stroke="#111"/>',
      '<rect x="212" y="150" width="30" height="30" fill="#eee" stroke="#111"/>', text(125, 64, `${m1} kg`, 10), text(227, 170, `${m2} kg`, 10)];
    return { body: parts.join(""), alt: `A ${m1} kg block on a table connected over a pulley at the table edge to a ${m2} kg block hanging below.` };
  }
  const parts = ['<circle cx="180" cy="50" r="18" fill="#eee" stroke="#111"/>', '<line x1="162" y1="50" x2="162" y2="140" stroke="#111"/><line x1="198" y1="50" x2="198" y2="170" stroke="#111"/>',
    '<rect x="147" y="140" width="30" height="30" fill="#eee" stroke="#111"/><rect x="183" y="170" width="30" height="30" fill="#eee" stroke="#111"/>', text(162, 160, m1, 11), text(198, 190, m2, 11)];
  return { body: parts.join(""), alt: `Two blocks of mass ${m1} kg and ${m2} kg hanging from the two sides of a pulley.` };
}

function renderCollision(sc: R): { body: string; alt: string } {
  const parts: string[] = []; const desc: string[] = [];
  [["Before", sc.before], ["After", sc.after]].forEach(([lab, objs], row) => {
    if (!Array.isArray(objs)) return;
    const y = 70 + row * 100;
    parts.push(text(30, y - 25, lab as string, 11, "start"));
    (objs as R[]).forEach((o, i) => {
      const x = 90 + 150 * i, v = o.v as number;
      parts.push(`<rect x="${x - 20}" y="${y - 16}" width="40" height="32" fill="#eee" stroke="#111"/>`, text(x, y + 4, `${gfmt(o.m as number)} kg`, 10));
      if (v) parts.push(arrow(x, y - 24, x + (v > 0 ? 50 : -50) * Math.min(1, Math.abs(v) / 5), y - 24), text(x, y - 32, `${gfmt(Math.abs(v))} m/s`, 10));
    });
    desc.push(`${lab as string}: ${(objs as R[]).map((o) => `${gfmt(o.m as number)} kg${o.v ? ` moving ${(o.v as number) > 0 ? "right" : "left"} at ${gfmt(Math.abs(o.v as number))} m/s` : " at rest"}`).join(" and ")}`);
  });
  return { body: parts.join(""), alt: `Collision diagram. ${desc.join(". ")}.` };
}

function renderBeam(sc: R): { body: string; alt: string } {
  const len = sc.length as number, k = 280 / len, x0 = 40, y = 120, pv = x0 + (sc.pivot as number) * k;
  const parts = [`<rect x="${x0}" y="${y - 4}" width="${n1(len * k)}" height="8" fill="#ddd" stroke="#111"/>`, `<polygon points="${n1(pv)},${y + 4} ${n1(pv - 10)},${y + 26} ${n1(pv + 10)},${y + 26}" fill="#999" stroke="#111"/>`];
  for (const f of arr(sc.forces)) {
    const px = x0 + (f.x as number) * k, down = f.dir === "down";
    parts.push(arrow(px, down ? y - 44 : y + 44, px, down ? y - 4 : y + 4), text(px, down ? y - 50 : y + 60, f.label, 11));
  }
  return { body: parts.join(""), alt: `A ${gfmt(len)} m beam on a pivot at ${gfmt(sc.pivot as number)} m from its left end, with ${arr(sc.forces).length} forces: ${arr(sc.forces).map((f) => `${String(f.label)} ${String(f.dir)} at ${gfmt(f.x as number)} m`).join(", ")}.` };
}

function renderUtube(sc: R): { body: string; alt: string } {
  const h1 = sc.h1 as number, h2 = sc.h2 as number;
  const parts = ['<path d="M110,40 V200 H250 V40" fill="none" stroke="#111" stroke-width="3"/>', `<rect x="113" y="${n1(200 - h1 * 10)}" width="34" height="${n1(h1 * 10)}" fill="#bcd"/>`, `<rect x="213" y="${n1(200 - h2 * 10)}" width="34" height="${n1(h2 * 10)}" fill="#dcb"/>`,
    text(130, 30, `${gfmt(sc.rho1 as number)} kg/m³`, 10), text(230, 30, `${gfmt(sc.rho2 as number)} kg/m³`, 10)];
  return { body: parts.join(""), alt: `A U-shaped tube holding two liquids of density ${gfmt(sc.rho1 as number)} and ${gfmt(sc.rho2 as number)} kg/m³ in the left and right arms.` };
}

function renderTank(sc: R): { body: string; alt: string } {
  const th = sc.tank_height as number, k = 170 / th, base = 210, top = base - th * k, wl = base - ((sc.hole_height as number) + (sc.depth as number)) * k, hy = base - (sc.hole_height as number) * k;
  const body = `<rect x="100" y="${n1(top)}" width="90" height="${n1(base - top)}" fill="none" stroke="#111" stroke-width="3"/><rect x="102" y="${n1(wl)}" width="86" height="${n1(base - wl - 1.5)}" fill="#bcd"/><circle cx="190" cy="${n1(hy)}" r="4" fill="#111"/>${text(150, wl - 6, `depth ${gfmt(sc.depth as number)} m`, 10)}`;
  return { body, alt: `An open tank filled to a depth of ${gfmt(sc.depth as number)} m above a small hole in its side, ${gfmt(sc.hole_height as number)} m above the ground.` };
}

const RENDER: Record<string, (sc: R) => { body: string; alt: string }> = { fbd: renderFbd, energy_bars: renderBars, vector: renderVectors, motion_diagram: renderMotion, incline: renderIncline, atwood: renderAtwood, collision: renderCollision, beam: renderBeam, utube: renderUtube, tank_hole: renderTank };

// ---------- 결정적 검사 ----------
/** 렌더가 만든 모든 좌표가 viewBox 안(여유 1)인지, NaN 이 없는지. */
function viewBoxIssues(svg: string): string[] {
  const out: string[] = [];
  if (/NaN|Infinity/.test(svg)) out.push("svg_nonfinite");
  for (const m of svg.matchAll(/\b(?:x|y|x1|x2|y1|y2|cx|cy)="(-?[0-9.]+)"/g)) { const v = Number(m[1]); if (v < -1 || v > Math.max(PHYS_W, PHYS_H) + 1) { out.push("outside_viewbox"); break; } }
  return out;
}

/** Python `check_scene` 와 같은 규칙. 빈 배열이면 통과. */
export function checkPhysScene(scene: PhysScene): string[] {
  const issues: string[] = [];
  const v = validatePhysScene(scene);
  if (!v.ok) return [v.error.includes("알 수 없는") ? "unknown_scene_type" : "scene_invalid"];
  const sc = scene as R;
  if (scene.type === "fbd") {
    const vec = fbdVectors(sc), forces = arr(sc.forces), maxMag = Math.max(...forces.map((f) => f.mag as number));
    for (const { f, dx, dy } of vec) { if (Math.abs(Math.hypot(dx, dy) - (f.mag as number) * (sc.scale as number)) > 1e-6) issues.push("arrow_length_not_proportional"); if (Math.hypot(dx, dy) < 6) issues.push("arrow_too_short"); }
    if (sc.equilibrium) {
      const sx = forces.reduce((a, f) => a + (f.mag as number) * Math.cos(rad(f.angle as number)), 0), sy = forces.reduce((a, f) => a + (f.mag as number) * Math.sin(rad(f.angle as number)), 0);
      if (Math.hypot(sx, sy) > 1e-6 * maxMag) issues.push("equilibrium_sum_not_zero");
    }
    const labels = forces.map((f) => String(f.label));
    if (new Set(labels).size !== labels.length) issues.push("duplicate_force_label");
    const ends = vec.map(({ dx, dy }) => `${Math.round(dx)},${Math.round(dy)}`);
    if (new Set(ends).size !== ends.length && !scene.allow_overlap) issues.push("arrow_overlap");
  } else if (scene.type === "energy_bars") {
    const states = arr(sc.states), tots = states.map((s) => BAR_KEYS.reduce((a, k) => a + (isNum((s.bars as R)[k]) ? ((s.bars as R)[k] as number) : 0), 0));
    if (sc.conserved && Math.max(...tots) - Math.min(...tots) > 1e-6 * Math.max(...tots)) issues.push("energy_not_conserved");
    if (states.some((s) => Object.values(s.bars as R).some((x) => (x as number) < 0))) issues.push("negative_bar");
  } else if (scene.type === "collision") {
    for (const row of [sc.before, sc.after]) if (Array.isArray(row) && (row as R[]).some((o) => (o.m as number) <= 0)) { issues.push("nonpositive_mass"); break; }
  }
  issues.push(...viewBoxIssues(renderPhysScene(scene).svg));
  return issues;
}

/** 선택지가 장면 그림인 문항: 같은 type, 서로 구별, 정답만 보조 요소(note)가 없고, FBD 는 요소 수로 정답이 드러나지 않는다. */
export function physChoiceIssues(scenes: PhysScene[], correctIndex?: number | null): string[] {
  const issues: string[] = [];
  if (new Set(scenes.map((s) => s.type)).size !== 1) issues.push("mixed_scene_types");
  const sig = (s: PhysScene) => JSON.stringify(Object.entries(s).filter(([k]) => k !== "note").map(([k, v]) => [k, String(typeof v === "object" ? JSON.stringify(v) : v)]).sort());
  if (new Set(scenes.map(sig)).size !== scenes.length) issues.push("duplicate_choice_scene");
  if (scenes.some((s) => "note" in s && s.note !== undefined && s.note !== null)) issues.push("choice_has_note");
  if (scenes[0]?.type === "fbd" && correctIndex !== null && correctIndex !== undefined && scenes[correctIndex]) {
    const n = scenes.map((s) => arr(s.forces).length), mx = Math.max(...n);
    if (n[correctIndex] === mx && n.filter((x) => x === mx).length === 1) issues.push("correct_has_most_elements");
  }
  return issues;
}

export function renderPhysScene(scene: PhysScene): { svg: string; alt: string; issues: FigureIssue[] } {
  const fn = RENDER[scene.type];
  const { body, alt } = fn(scene as R);
  return { svg: wrap(body, alt), alt, issues: [] };
}

export function renderPhysSceneSpec(spec: PhysSceneSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const r = renderPhysScene(spec.scene);
  const issues: FigureIssue[] = checkPhysScene(spec.scene).map((code) => ({ code, message: `장면 그림 검사 실패: ${code}` }));
  return { ...r, issues };
}

/** LLM 풀이자·검토자에게 주는 "학생이 보는 그림" 텍스트 설명(결정적, 장면 모델에서만 파생). 화면에 보이지 않는 값(예: 미지 질량의 크기)은 쓰지 않는다. */
export function describePhysSceneForReview(scene: PhysScene): string {
  const sc = scene as R, t = scene.type;
  if (t === "fbd") {
    const vec = fbdVectors(sc), mx = Math.max(...vec.map((v) => Math.hypot(v.dx, v.dy)));
    const dirName = (a: number) => { const d = ((a % 360) + 360) % 360; return d === 0 ? "right" : d === 90 ? "up" : d === 180 ? "left" : d === 270 ? "down" : `${gfmt(d)} degrees counterclockwise from right`; };
    return `Free-body diagram of a ${sc.body === "box" ? "box" : "point object"}. Arrows (label, direction, length relative to the longest arrow): ${vec.map(({ f, dx, dy }) => `${String(f.label)}: ${dirName(f.angle as number)}, ${gfmt(Math.round((Math.hypot(dx, dy) / mx) * 100) / 100)}`).join("; ")}. Arrow lengths are proportional to the force magnitudes.`;
  }
  if (t === "energy_bars") {
    const ymax = sc.ymax as number;
    return `Energy bar charts on one common scale (tallest possible bar = 1.0). ${arr(sc.states).map((s) => `${String(s.name)}: ${BAR_KEYS.map((k) => `${k}=${gfmt(Math.round(((isNum((s.bars as R)[k]) ? ((s.bars as R)[k] as number) : 0) / ymax) * 100) / 100)}`).join(", ")}`).join("; ")}.`;
  }
  if (t === "motion_diagram") {
    const vs = sc.vs as number[], xs = sc.xs as number[], vm = Math.max(...vs.map(Math.abs)) || 1;
    return `Motion diagram at equal time intervals along a line. Positions (relative spacing): ${xs.map((x) => gfmt(x)).join(", ")}. Velocity arrow at each position (negative = pointing left), relative to the longest arrow: ${vs.map((v) => gfmt(Math.round((v / vm) * 100) / 100)).join(", ")}.`;
  }
  return renderPhysScene(scene).alt;
}
