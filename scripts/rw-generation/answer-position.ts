// 목표 정답 위치(2026-10-01): (skill x 난이도) 단위로 A~D 를 누적 균등하게 배정하고, 생성 프롬프트와 후처리 양쪽에서 강제한다.
// 이전 방식(skill 해시 + idx 순환)은 소량 배치·난이도별로는 쏠렸고(RW 정답 A 48%), 어긋나도 보정하지 못하는 경우가 있었다.
import { createHash } from "node:crypto";
import { enforceTarget } from "../mock-exam-generation/diversity";

export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];
export type PositionCounts = [number, number, number, number];
export type PositionKey = string; // `${skill}|${difficulty}`
export const positionKey = (skill: string, difficulty: string): PositionKey => `${skill}|${difficulty}`;

const hash4 = (s: string) => parseInt(createHash("md5").update(s).digest("hex").slice(0, 6), 16);

/**
 * 후보 목록(순서 고정)에 정답 위치를 배정한다. (skill x 난이도) 그룹마다 지금까지 가장 적게 쓰인 글자를 고르므로
 * 어느 시점에 끊어도 그룹 안 글자 수의 최대-최소 차이가 1 이하다(소량 배치 포함). 동률은 그룹 해시로 시작을 어긋나게 해 전체도 균등.
 * `prior` 는 이전 배치까지의 누적(배치를 나눠 생성해도 누적 균등). 호출자가 prior 를 직접 갱신하지 않도록 새 객체를 돌려준다.
 */
export function planAnswerPositions(
  items: { skill: string; difficulty: string }[],
  prior: Record<PositionKey, PositionCounts> = {},
): { letters: Letter[]; counts: Record<PositionKey, PositionCounts> } {
  const counts: Record<PositionKey, PositionCounts> = Object.fromEntries(Object.entries(prior).map(([k, v]) => [k, [...v] as PositionCounts]));
  const letters = items.map((it) => {
    const k = positionKey(it.skill, it.difficulty);
    const c = (counts[k] ??= [0, 0, 0, 0]);
    const start = hash4(k) % 4;
    const total = c[0] + c[1] + c[2] + c[3];
    // 최소 사용 글자 중 (start + total) 에 가장 가까운 순환 순서
    const min = Math.min(...c);
    let pick = 0;
    for (let step = 0; step < 4; step++) {
      const i = (start + total + step) % 4;
      if (c[i] === min) { pick = i; break; }
    }
    c[pick]++;
    return LETTERS[pick];
  });
  return { letters, counts };
}

/** 그룹별 글자 수 최대-최소 차이(균등성 검사). */
export function positionSpread(counts: Record<PositionKey, PositionCounts>): Record<PositionKey, number> {
  return Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, Math.max(...c) - Math.min(...c)]));
}

/** 생성 프롬프트에 넣을 지시 문장(한국어 프롬프트 관례). */
export const positionDirective = (letter: Letter) =>
  `정답 위치: 정답 선택지는 반드시 ${letter} 에 둔다. correct_letter 는 ${letter} 이고, 해설의 글자 참조도 이에 맞춘다. 정답을 ${letter} 로 정한 뒤 나머지 선택지를 채운다.`;

export type PositionOutcome =
  | { status: "as_is"; g: Gen }
  | { status: "permuted"; g: Gen }
  | { status: "rejected"; reason: string };
type Gen = { options: string[]; correct_letter: string; explanation: string };

/**
 * 후처리 강제: 모델이 어겨도 정답이 목표 위치가 아니면 선택지를 재배치하고 해설의 글자 참조를 치환한다(순열 보정).
 * 보정이 불가능한 문항(숫자 선택지·선택지 안 글자 참조·형식 오류)은 탈락시킨다 — 목표 위치 균등을 깨지 않기 위해 그대로 통과시키지 않는다.
 */
export function enforceAnswerPosition<G extends Gen>(g: G, target: Letter): { status: "as_is" | "permuted"; g: G } | { status: "rejected"; reason: string } {
  if (!Array.isArray(g.options) || g.options.length !== 4) return { status: "rejected", reason: "선택지가 4개가 아님" };
  if (!/^[ABCD]$/.test(g.correct_letter)) return { status: "rejected", reason: "정답 글자 형식 오류" };
  if (g.correct_letter === target) return { status: "as_is", g };
  const r = enforceTarget(g, target);
  if (r.changed) return { status: "permuted", g: r.g };
  return { status: "rejected", reason: `위치 보정 불가(${r.skipped ?? "알 수 없음"})` };
}
