// nonlinear_functions.function_transformation.FN.B — B형: 기준 포물선 f 의 그래프(지문의 그림)와 말(식)로 주어진 변환 g 의 그래프를 같은 축의 그래프 4개 중에서 고른다(상하·좌우 이동, 대칭, 꼭짓점 주어짐).
// 정답은 기준 그림에서 읽은 꼭짓점 (H, K)·열린 방향 A 로 다시 계산하고, 오답은 선언한 규칙(방향 부호·순서·이동 방향 혼동)으로 진단한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { keyBundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { INTRO_TAILS, LEADS_G, QUAD_KEY_JS, parabola, quadSmall } from "../ln-b-kit";

const intro = (rng: Rng, extra = "") => `${rng.pick(LEADS_G)}${rng.pick([
  "The graph of the quadratic function $f$ is shown in the $xy$-plane.", "A parabola, the graph of a quadratic function $f$, is shown in the given figure.", "In the given figure, the graph of $y = f(x)$ is a parabola with three marked points.", "The function $f$ is quadratic, and its graph is shown in the $xy$-plane with three points marked on it.", "The first figure shows the graph of a quadratic function $f$ in the $xy$-plane.",
])} ${rng.pick(INTRO_TAILS)} ${rng.pick(TAILS)}${extra}`;
const rd: [string, string] = ["기준 그래프에서 꼭짓점 (H, K) 과 열린 방향(A 의 부호)을 읽는다.", "Read the vertex and the direction of opening."];
const Qg = (rng: Rng) => rng.pick(["Which graph shows the function $g$?", "Which of the following graphs is the graph of $g$?", "Which one of the four graphs represents $g$?"]);
const EXPQ = (e: string) => `const q=STEMQ(); const mk=(A,H,K)=>[A,-2*A*H,A*H*H+K].map(v=>Math.round(v*1e6)/1e6).join('|'); const EXPECT=${e};`;
function scene(rng: Rng) { return quadSmall(rng); }
const pc = (R: number, A: number, H: number, K: number) => parabola(R, A, H, K);

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.function_transformation.FN.B",
  hard: [
    {
      op: "repr_shift", structure: "g(x) = f(x) + s (위·아래 이동)에 해당하는 그래프를 4개 중에서 고름", extra: "f(x) + s 는 그래프를 위로 s 만큼(세로) 옮김을 알아야 함(좌우 이동이나 반대 방향으로 옮기는 함정) — medium 은 x 축 대칭", sprNo: SPR_NO_B,
      concepts: ["함수의 변환", "이차함수의 그래프", "꼭짓점"],
      gen(rng) {
        const q = scene(rng); const s = rng.pick([-3, -2, 2, 3]); const ok = pc(q.R, q.A, q.H, q.K + s), w1 = pc(q.R, q.A, q.H - s, q.K), w2 = pc(q.R, q.A, q.H, q.K - s), w3 = pc(q.R, -q.A, q.H, q.K + s);
        return keyBundle(rng, { stimulus: intro(rng, ` The function $g$ is defined so that the graph of $g$ is the graph of $y = f(x) ${s < 0 ? "-" : "+"} ${Math.abs(s)}$.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_HORIZ_SHIFT" }, { ...w2, rule: "FNB_OPPOSITE_SHIFT" }, { ...w3, rule: "FNB_REFLECTED" }], P: { s }, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(q.A,q.H,q.K+P.s)"),
          trace: [rd, [`f 의 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "The vertex of f."], [`f(x) ${s < 0 ? "-" : "+"} ${Math.abs(s)} 는 그래프를 ${s > 0 ? "위로" : "아래로"} ${Math.abs(s)} 옮긴다.`, "Adding a constant shifts the graph vertically."], [`g 의 꼭짓점은 (${q.H}, ${q.K + s}) 이고 열린 방향은 같다.`, "The vertex of g."], [`좌우로 옮기거나 반대 방향으로 옮기거나 뒤집은 그래프는 오답이다.`, "The others shift sideways, the wrong way, or flip."]], variant: "vertical_shift" });
      },
    },
    {
      op: "chain2", structure: "g(x) = f(x − s) + t (오른쪽 s, 위로 t 이동)에 해당하는 그래프를 고름", extra: "x − s 는 오른쪽으로, + t 는 위로 옮김을 모두 알아야 함(좌우 방향을 반대로 하거나 이동량을 바꿔 쓰는 함정) — medium 은 위·아래 이동", sprNo: SPR_NO_B,
      concepts: ["함수의 변환", "이차함수의 그래프", "평행이동"],
      gen(rng) {
        const q = scene(rng); const s = rng.pick([-3, -2, 2, 3]), t = rng.pick([-3, -2, 2, 3]); if (s === t) throw new GenFail("같음");
        const ok = pc(q.R, q.A, q.H + s, q.K + t), w1 = pc(q.R, q.A, q.H - s, q.K + t), w2 = pc(q.R, q.A, q.H + s, q.K - t), w3 = pc(q.R, q.A, q.H + t, q.K + s);
        return keyBundle(rng, { stimulus: intro(rng, ` The function $g$ is defined so that the graph of $g$ is the graph of $y = f(x ${s < 0 ? "+" : "-"} ${Math.abs(s)}) ${t < 0 ? "-" : "+"} ${Math.abs(t)}$.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_HORIZ_SIGN" }, { ...w2, rule: "FNB_VERT_SIGN" }, { ...w3, rule: "FNB_SWAPPED_SHIFTS" }], P: { s, t }, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(q.A,q.H+P.s,q.K+P.t)"),
          trace: [rd, [`f 의 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "The vertex of f."], [`f(x ${s < 0 ? "+" : "-"} ${Math.abs(s)}) 는 ${s > 0 ? "오른쪽" : "왼쪽"}으로 ${Math.abs(s)} 옮긴다.`, "Horizontal shift."], [`+ ${t} 는 ${t > 0 ? "위" : "아래"}로 ${Math.abs(t)} 옮긴다.`, "Vertical shift."], [`g 의 꼭짓점은 (${q.H + s}, ${q.K + t}) 이다.`, "The new vertex."]], variant: "horizontal_and_vertical_shift" });
      },
    },
    {
      op: "compose_kind", structure: "g(x) = −f(x) + t (x 축 대칭 후 위·아래 이동)에 해당하는 그래프를 고름", extra: "대칭을 먼저 하고 이동해야 함(이동 후 대칭을 하거나 대칭을 빠뜨리는 함정) — medium 은 x 축 대칭만", sprNo: SPR_NO_B,
      concepts: ["함수의 변환", "대칭이동", "이차함수의 그래프"],
      gen(rng) {
        const q = scene(rng); const t = rng.pick([-3, -2, 2, 3]); const ok = pc(q.R, -q.A, q.H, -q.K + t), w1 = pc(q.R, -q.A, q.H, -q.K), w2 = pc(q.R, -q.A, q.H, -q.K - t), w3 = pc(q.R, q.A, q.H, q.K + t);
        return keyBundle(rng, { stimulus: intro(rng, ` The function $g$ is defined so that the graph of $g$ is the graph of $y = -f(x) ${t < 0 ? "-" : "+"} ${Math.abs(t)}$.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_NO_SHIFT" }, { ...w2, rule: "FNB_SHIFT_BEFORE_REFLECT" }, { ...w3, rule: "FNB_NO_REFLECT" }], P: { t }, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(-q.A,q.H,-q.K+P.t)"),
          trace: [rd, [`−f(x) 는 x 축 대칭이므로 꼭짓점은 (${q.H}, ${-q.K}) 이고 열린 방향이 반대이다.`, "Reflect over the x-axis."], [`+ ${t} 는 ${t > 0 ? "위" : "아래"}로 ${Math.abs(t)} 옮긴다.`, "Then shift."], [`g 의 꼭짓점은 (${q.H}, ${-q.K + t}) 이다.`, "The new vertex."], [`이동을 먼저 하면 꼭짓점이 (${q.H}, ${-q.K - t}) 로 달라진다.`, "Order matters."]], variant: "reflect_then_shift" });
      },
    },
    {
      op: "inverse", structure: "g 가 f 와 같은 모양(열린 방향·폭)이고 꼭짓점의 x·y 좌표가 말로 주어질 때 그래프를 고름", extra: "꼭짓점의 좌표를 거꾸로 적용해야 함(좌표를 바꾸거나 열린 방향을 뒤집거나 폭을 바꾸는 함정) — medium 은 y 축 대칭", sprNo: SPR_NO_B,
      concepts: ["함수의 변환", "꼭짓점", "역산"],
      gen(rng) {
        const q = scene(rng); const p = rng.pick([-4, -3, -2, 2, 3, 4]), r = rng.pick([-4, -3, -2, 2, 3, 4]); if (p === r || (p === q.H && r === q.K)) throw new GenFail("같음");
        const ok = pc(q.R, q.A, p, r), w1 = pc(q.R, -q.A, p, r), w2 = pc(q.R, q.A, r, p), w3 = pc(q.R, 2 * q.A, p, r);
        return keyBundle(rng, { stimulus: intro(rng, ` The graph of $g$ is a parabola with the same shape and the same direction of opening as the graph of $f$. The vertex of the graph of $g$ has $x$-coordinate ${p} and $y$-coordinate ${r}.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_FLIPPED" }, { ...w2, rule: "FNB_VERTEX_SWAPPED" }, { ...w3, rule: "FNB_STRETCHED" }], P: { p, r }, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(q.A,P.p,P.r)"),
          trace: [rd, [`g 는 f 와 같은 모양이므로 a = ${q.A} 이다.`, "Same shape means the same a."], [`꼭짓점이 (${p}, ${r}) 이므로 g(x) = ${q.A}(x ${p < 0 ? "+" : "-"} ${Math.abs(p)})² ${r < 0 ? "-" : "+"} ${Math.abs(r)} 이다.`, "Vertex form."], [`그 꼭짓점을 갖는 그래프를 고른다.`, "Choose the graph."], [`열린 방향·폭이 다르거나 좌표를 바꾼 그래프는 오답이다.`, "Check direction, width, and coordinates."]], variant: "vertex_given" });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "shift_up", structure: "g(x) = f(x) + s 에 해당하는 그래프를 고름", extra: "easy: 위·아래 이동 한 번", sprNo: SPR_NO_B, concepts: ["함수의 변환", "이차함수의 그래프"],
      gen(rng) {
        const q = scene(rng); const s = rng.pick([-3, -2, 2, 3]); const ok = pc(q.R, q.A, q.H, q.K + s), w1 = pc(q.R, q.A, q.H + s, q.K), w2 = pc(q.R, q.A, q.H, q.K - s), w3 = pc(q.R, -q.A, q.H, q.K);
        return keyBundle(rng, { stimulus: intro(rng, ` The function $g$ is defined so that the graph of $g$ is the graph of $y = f(x) ${s < 0 ? "-" : "+"} ${Math.abs(s)}$.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_HORIZ_SHIFT" }, { ...w2, rule: "FNB_OPPOSITE_SHIFT" }, { ...w3, rule: "FNB_REFLECTED" }], P: { s }, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(q.A,q.H,q.K+P.s)"), trace: [rd, [`상수를 더하면 그래프가 ${s > 0 ? "위" : "아래"}로 ${Math.abs(s)} 움직인다.`, "Vertical shift."]], variant: "easy_vertical_shift" });
      },
    },
    {
      lv: "medium", name: "reflect_x", structure: "g(x) = −f(x) 에 해당하는 그래프를 고름", extra: "medium: x 축 대칭", sprNo: SPR_NO_B, concepts: ["함수의 변환", "대칭이동"],
      gen(rng) {
        const q = scene(rng); const ok = pc(q.R, -q.A, q.H, -q.K), w1 = pc(q.R, q.A, -q.H, q.K), w2 = pc(q.R, -q.A, -q.H, q.K), w3 = pc(q.R, q.A, q.H, -q.K);
        return keyBundle(rng, { stimulus: intro(rng, ` The function $g$ is defined so that the graph of $g$ is the graph of $y = -f(x)$.`), question: Qg(rng), stem: q.fig, correct: ok, wrongs: [{ ...w1, rule: "FNB_Y_AXIS" }, { ...w2, rule: "FNB_ORIGIN" }, { ...w3, rule: "FNB_VERTEX_ONLY" }], P: {}, keyJs: QUAD_KEY_JS, semanticJs: EXPQ("mk(-q.A,q.H,-q.K)"), trace: [rd, [`−f(x) 는 x 축 대칭이다.`, "Reflection over the x-axis."], [`꼭짓점은 (${q.H}, ${-q.K}) 이고 열린 방향이 반대이다.`, "The vertex flips."]], variant: "medium_reflect_x" });
      },
    },
  ],
});
