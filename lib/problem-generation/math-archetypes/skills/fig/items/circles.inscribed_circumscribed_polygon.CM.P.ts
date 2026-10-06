// circles.inscribed_circumscribed_polygon.CM.P — 원에 내접한 정사각형 그림의 반지름·지름·변 라벨에서 정사각형의 넓이(대각선 = 지름)·원의 넓이를 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { piFmt } from "../ci-kit";
import { CIRC_SQ, CM_JS, Q_AREA, Q_PI, SPR_NO_CM, cmIntro, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const cs = (o: { radius?: string; diameter?: string }, innerSide?: string): CmFig => ({ type: "composite", outer: { kind: "circle", ...o }, inner: { kind: "square", ...(innerSide ? { height: innerSide } : {}) }, shaded: "none", notToScale: !!innerSide });

const RAW = defineItem({
  prefix: "ci", itemId: "circles.inscribed_circumscribed_polygon.CM.P",
  hard: [
    {
      op: "compose_kind", structure: "원의 반지름이 그림에 라벨되고 정사각형이 내접할 때 정사각형의 대각선 = 지름 = 2r 로 정사각형의 넓이 2r² 을 구함", extra: "정사각형의 대각선이 원의 지름이므로 넓이 = 대각선²/2 = 2r² 임을 알아야 함(반지름을 변으로 쓰면 오답) — medium 은 대각선",
      concepts: ["내접한 정사각형", "대각선", "정사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 16); const f = cs({ radius: String(r) });
        return geoInst(rng, {
          stimulus: cmIntro(rng, CIRC_SQ), question: Q_AREA(rng, "area of the square"), correct: 2 * r * r,
          wrongs: pos([W(r * r, "geometry_misapplied", "반지름을 변으로 썼다."), W(4 * r * r, "geometry_misapplied", "지름을 변으로 썼다."), W(r * r * 2 + 2, "other", "계산 중 어긋났다."), W(8 * r, "formula_misuse", "둘레를 답했다."), W(r * r * 3, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== 2 * r * r),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square') throw new Error('원·정사각형 필요'); const r=on('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return 2*r*r;`),
          trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`정사각형의 대각선 = 원의 지름 = ${2 * r} 이다.`, "The diagonal of the inscribed square is the diameter."], [`정사각형의 넓이 = 대각선² ÷ 2 = ${(2 * r) ** 2} ÷ 2 이다.`, "Area from the diagonal."], [`= ${2 * r * r} 이다.`, "Compute."], [`따라서 ${2 * r * r} 이다.`, "State the area."]], variant: "inscribed_square_area_from_radius",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_CM, structure: "내접한 정사각형의 변 s 가 그림에 라벨될 때 대각선² = 2s² = 지름² 으로 원의 넓이 (s²/2)π 를 구함", extra: "대각선(= 지름)을 s√2 로 구하고 반지름으로 바꿔 πr² = (s²/2)π 를 계산해야 함(변을 지름으로 쓰면 오답) — medium 은 반지름",
      concepts: ["내접한 정사각형", "대각선", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 10); const f = cs({}, String(s)); const c = (s * s) / 2;
        return geoInst(rng, {
          stimulus: cmIntro(rng, CIRC_SQ), question: Q_PI(rng, "area of the circle"), correct: c, fmt: piFmt,
          wrongs: pos([W((s * s) / 4, "geometry_misapplied", "변을 지름으로 썼다."), W(s * s, "geometry_misapplied", "변을 반지름으로 썼다."), W(c * 2, "formula_misuse", "배로 계산했다."), W(s, "step_missing", "변을 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square') throw new Error('원·정사각형 필요'); const s=inn('height'); if (!(s>0)) throw new Error('변 라벨 없음'); return s*s/2;`),
          trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the square's side."], [`대각선² = ${s}² + ${s}² = ${2 * s * s} 이고 대각선 = 원의 지름이다.`, "The diagonal is the diameter."], [`반지름² = 지름² ÷ 4 = ${2 * s * s} ÷ 4 = ${c} 이다.`, "Radius squared."], [`원의 넓이 = π × ${c} 이다.`, "Circle area."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "circle_area_from_inscribed_square",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "원의 지름이 그림에 라벨되고 정사각형이 내접할 때 지름을 정사각형의 대각선으로 옮겨 정사각형의 넓이 d²/2 를 구함", extra: "지름이 곧 대각선임을 옮겨 넓이 = d²/2 를 구해야 함(지름을 변으로 쓰면 오답) — medium 은 반지름",
      concepts: ["내접한 정사각형", "지름", "대각선"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 15), d = 2 * r; const f = cs({ diameter: String(d) });
        return geoInst(rng, {
          stimulus: cmIntro(rng, CIRC_SQ), question: Q_AREA(rng, "area of the square"), correct: 2 * r * r,
          wrongs: pos([W(d * d, "geometry_misapplied", "지름을 변으로 썼다."), W(r * r, "geometry_misapplied", "반지름을 변으로 썼다."), W(d * d / 4, "formula_misuse", "계산을 잘못했다."), W(4 * d, "formula_misuse", "둘레를 답했다."), W(2 * r * r + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== 2 * r * r),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square') throw new Error('원·정사각형 필요'); const d=on('diameter'); if (!(d>0)) throw new Error('지름 라벨 없음'); return d*d/2;`),
          trace: [[`그림에서 원의 지름 ${d} 를 읽는다.`, "Read the diameter."], [`내접한 정사각형의 대각선 = 지름 = ${d} 이다.`, "The diagonal equals the diameter."], [`정사각형의 넓이 = 대각선² ÷ 2 = ${d * d} ÷ 2 이다.`, "Area from the diagonal."], [`= ${2 * r * r} 이다.`, "Compute."], [`따라서 ${2 * r * r} 이다.`, "State the area."]], variant: "inscribed_square_area_from_diameter",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "원의 반지름이 그림에 라벨되고 지문에서 '반지름이 절반인 원에 내접한 정사각형' 의 넓이를 물을 때 거꾸로 새 반지름 r/2 로 넓이를 구함", extra: "새 반지름 r/2 를 구해 2(r/2)² = r²/2 를 계산해야 함(원래 반지름으로 계산하면 오답) — medium 은 원래 반지름",
      concepts: ["내접한 정사각형", "비", "정사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(1, 8); const f = cs({ radius: String(r) }); const c = (r * r) / 2;
        return geoInst(rng, {
          stimulus: cmIntro(rng, CIRC_SQ, " A second square is inscribed in a circle whose radius is half the radius of the circle shown."), question: Q_AREA(rng, "area of the second square"), correct: c,
          wrongs: pos([W(2 * r * r, "step_missing", "원래 정사각형의 넓이를 답했다."), W(r * r / 4, "geometry_misapplied", "새 반지름을 변으로 썼다."), W(r * r, "geometry_misapplied", "원래 반지름을 변으로 썼다."), W(c + 1, "other", "계산 중 어긋났다."), W(r * r * 2 / 4 + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square') throw new Error('원·정사각형 필요'); const r=on('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const r2=r/2; return 2*r2*r2;`),
          trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`둘째 원의 반지름 = ${r} ÷ 2 = ${r / 2} 이다.`, "The new radius is half."], [`내접한 정사각형의 대각선 = 지름 = ${r} 이다.`, "The diagonal equals the new diameter."], [`넓이 = 대각선² ÷ 2 = ${r * r} ÷ 2 이다.`, "Area from the diagonal."], [`따라서 ${c} 이다.`, "State the area."]], variant: "second_square_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "square_area_radius", structure: "원의 반지름이 그림에 있고 정사각형이 내접할 때 정사각형의 넓이를 구함", extra: "easy: 2r²", concepts: ["내접한 정사각형"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 16); const f = cs({ radius: String(r) });
        return geoInst(rng, { stimulus: cmIntro(rng, CIRC_SQ), question: Q_AREA(rng, "area of the square"), correct: 2 * r * r, wrongs: pos([W(r * r, "geometry_misapplied", "반지름을 변으로 썼다."), W(4 * r * r, "geometry_misapplied", "지름을 변으로 썼다."), W(8 * r, "formula_misuse", "둘레를 답했다."), W(2 * r * r + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== 2 * r * r), verificationJs: figJs({}, f, `${CM_JS}const r=on('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return 2*r*r;`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`대각선 = 지름 = ${2 * r}, 넓이 = ${(2 * r) ** 2} ÷ 2 = ${2 * r * r} 이다.`, "Area from the diagonal."]], variant: "square_area_radius_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "circle_area_radius", sprNo: SPR_NO_CM, structure: "원의 반지름이 그림에 있을 때 원의 넓이를 π 로 구함", extra: "medium: πr²(내접한 정사각형은 무관)", concepts: ["원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 16); const f = cs({ radius: String(r) });
        return geoInst(rng, { stimulus: cmIntro(rng, CIRC_SQ), question: Q_PI(rng, "area of the circle"), correct: r * r, fmt: piFmt, wrongs: pos([W(2 * r, "formula_misuse", "둘레의 계수를 답했다."), W(2 * r * r, "formula_misuse", "정사각형의 넓이를 답했다."), W(r, "step_missing", "반지름을 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r * r), verificationJs: figJs({}, f, `${CM_JS}const r=on('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return r*r;`), trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`넓이 = π × ${r}² = ${r * r}π 이다.`, "Area = πr²."], [`정사각형은 이 문제와 무관하다.`, "The inscribed square is not needed."]], variant: "circle_area_radius_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
