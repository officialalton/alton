// 원(CI) 계열 자료 원형 공용 키트 — 조합 파일(items/<조합ID>.ts)이 함께 쓴다.
// 규칙: 길이·각은 그림의 라벨에만 있고 지문은 "the circle shown" 으로 가리킨다. 원 위의 점은 각도로 놓이므로 중심각·원주각·호는 라벨값 그대로 그려진다(점 각도 = 라벨).
// 반지름은 항상 화면 100px 이라 길이 라벨이 있는 원은 notToScale 이 아니어도 '한 원'만 그려지면 비율 문제가 없다(두 원을 비교하는 그림은 만들지 않는다).
import { fmtNum } from "../../text";
import type { Rng } from "../../rng";
import { NUM_JS, pickN } from "./geo-kit";

export type CircFig = {
  type: "circle"; center?: string | null; points: { id: string; angle: number }[]; radii?: { to: string; label?: string }[]; chords?: { between: [string, string]; label?: string; diameter?: boolean }[]; arcs?: { from: string; to: string; label?: string }[];
  sector?: { from: string; to: string; label?: string }; centralAngles?: { between: [string, string]; label?: string; right?: boolean }[]; inscribedAngles?: { at: string; between: [string, string]; label?: string }[]; tangents?: { at: string; label?: string; external?: string }[]; notToScale?: boolean;
};
/** π 계수 → "$k\pi$" 형식(정답·오답 선지 공통). */
export const piFmt = (v: number) => (v === 1 ? "$\\pi$" : `$${fmtNum(v)}\\pi$`);
/** 점 이름 n 개(중심 O 와 겹치지 않는 대문자, 알파벳 순). */
export const circNames = (rng: Rng, n: number): string[] => pickN(rng, n + 1).filter((x) => x !== "O").slice(0, n);
/** 라벨을 숫자로(NaN 이면 미지수) + 그림 요소 찾기 도우미(JS). */
export const CI_JS = `${NUM_JS}const CEN=FIGURE.center===undefined?'O':FIGURE.center; const RAD=FIGURE.radii||[], CHD=FIGURE.chords||[], ARC=FIGURE.arcs||[], CAN=FIGURE.centralAngles||[], INS=FIGURE.inscribedAngles||[], TAN=FIGURE.tangents||[]; const PT=FIGURE.points||[]; const ang=(id)=>{ const p=PT.find(q=>q.id===id); if(!p) throw new Error('점 없음: '+id); return p.angle; }; const radiusLabel=()=>{ const r=RAD.map(q=>num(q.label)).filter(n=>n>0); if(!r.length) throw new Error('반지름 라벨 없음'); if (r.some(n=>n!==r[0])) throw new Error('반지름 라벨 불일치'); return r[0]; };
`;
export const CIRC_LEAD = ["", "", "A student is studying the circle shown. ", "A designer plans a circular logo. ", "A groundskeeper marks a circular flower bed. ", "An engineer sketches a circular gear. ", "A teacher draws the circle below on the board. ", "A baker decorates a round cake as shown. "];
export const CIRC_UNITS = ["", "All lengths are in centimeters. ", "All lengths are in meters. ", "All lengths shown are in feet. ", "Lengths are in inches. ", "Lengths are given in the same unit. "];
/** 중심각 θ(도) 를 만드는 두 점 각도: A = a0, B = a0 + θ(반시계). */
export const arcPts = (A: string, B: string, a0: number, theta: number) => [{ id: A, angle: a0 }, { id: B, angle: a0 + theta }];
export const CIRC_CTX = ["", "", "Answers that involve $\\pi$ are left in terms of $\\pi$. ", "Use the labels in the figure rather than measuring. ", "The figure is not needed to be measured; every needed length is labeled. ", "Check which label belongs to which part of the circle. ", "Round shapes like this appear on many practical plans. ", "Read each label carefully before computing. ", "A calculator is not necessary. ", "Think about which circle formula applies. "];
export const SPR_NO_PI = "정답이 π 를 포함한 식(kπ)이라 순수한 수 하나로 낼 수 없다";
/** (θ°, r) 중 θ·r/180 (호 길이 계수)가 정수인 조합 후보. */
export const ARC_COMBOS = (): [number, number][] => { const out: [number, number][] = []; for (const th of [30, 45, 60, 72, 90, 120, 135, 150, 40, 80, 100]) for (let r = 3; r <= 24; r++) if ((th * r) % 180 === 0) out.push([th, r]); return out; };
/** (θ°, r) 중 θ·r²/360 (부채꼴 넓이 계수)가 정수인 조합 후보. */
export const SECTOR_COMBOS = (): [number, number][] => { const out: [number, number][] = []; for (const th of [30, 45, 60, 72, 90, 120, 135, 150, 180, 40, 80]) for (let r = 3; r <= 20; r++) if ((th * r * r) % 360 === 0) out.push([th, r]); return out; };
/** 라벨(°·라디안 "π/3", "2π/3")을 도(degree)로 읽는 JS — NaN 이면 형식 오류. */
export const ANG_LABEL_JS = "const degOf=(l)=>{ const t=String(l).replace(/[°\\s]/g,''); let m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return Number(m[1]); m=/^(\\d*)π\\/(\\d+)$/.exec(t); if (m) return (m[1]===''?1:Number(m[1]))*180/Number(m[2]); m=/^(\\d*)π$/.exec(t); if (m) return (m[1]===''?1:Number(m[1]))*180; throw new Error('각 라벨 형식 오류: '+l); };\n";
