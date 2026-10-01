// 담당 D skill 공용 조각 — 오답 후보 생성기와 장면(scene) 풀.
import type { DistractorKind } from "../../review";
import type { Wrong } from "../text";

export const W = (v: number, kind: DistractorKind, reason: string): Wrong => ({ v, kind, reason });
export const NAMES3: [string, string, string][] = [["A", "B", "C"], ["P", "Q", "R"], ["X", "Y", "Z"], ["D", "E", "F"], ["K", "L", "M"], ["G", "H", "J"], ["S", "T", "U"], ["N", "L", "M"]];
/** 서수·배수 표현 */
export const TIMES: Record<number, string> = { 2: "twice", 3: "three times", 4: "four times", 5: "five times" };
export const WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };
/** [a,b] 닫힌 구간의 배수 개수 */
export const countMult = (lo: number, hi: number, m: number) => (hi < lo ? 0 : Math.floor(hi / m) - Math.floor((lo - 1) / m));

/** 도입 문장(수치 없음) — 같은 틀의 본문을 서로 다른 장면으로 분산해 독립 변형을 늘린다. 뒤에 공백 포함, 빈 문자열은 도입 없음. */
export const GEO_CTX = ["", "", "A geometry teacher describes a triangle to the class. ", "A designer is planning a triangular logo. ", "An architect sketches a triangular window. ", "A student is working on a triangle problem from a practice set. ", "A map maker marks out a triangular region. ", "A carpenter is cutting a triangular brace. "];
export const DATA_CTX = ["", "", "Consider the following data. ", "Here is a question about a data set. ", "A student is analyzing some data. ", "Read the information below. ", "A teacher poses a statistics problem. ", "A data analyst is summarizing results. "];

import { finish, type Draft } from "../text";
import type { Rng } from "../rng";
import type { Instance } from "../types";
/** 각·길이·개수처럼 0 이하가 의미 없는 양: 오답 후보에서 0 이하를 제외하고 finish 한다. */
export function fin(rng: Rng, d: Draft): Instance { return finish(rng, { ...d, wrongs: d.wrongs?.filter((w) => w.v > 0) }); }

/** 도형 종류를 가정하지 않는 도입 문장. */
export const NEUTRAL_CTX = ["", "", "A student is working on a geometry problem. ", "A teacher writes a problem on the board. ", "Here is a question from a practice set. ", "Consider the following situation. ", "An engineer is checking some measurements. ", "A builder is planning a small project. "];
/** 숫자 앞 부정관사: art(8) -> "an", art(7) -> "a". */
export const art = (n: number) => (/^(8\d*|11|18)$/.test(String(n)) ? "an" : "a");
export const SING: Record<string, string> = { feet: "foot", meters: "meter", inches: "inch", yards: "yard", centimeters: "centimeter", miles: "mile", kilometers: "kilometer" };

// ── 자료 해석 계열 공용: 장면과 자료 나열 문장 ──
export type Scene = { measure: string; ent: string; unit: string };
export const SCENES: Scene[] = [
  { measure: "daily high temperatures (in degrees Fahrenheit)", ent: "days", unit: "degrees" },
  { measure: "quiz scores (in points)", ent: "students", unit: "points" },
  { measure: "minutes spent on homework", ent: "students", unit: "minutes" },
  { measure: "points scored", ent: "basketball games", unit: "points" },
  { measure: "numbers of books read", ent: "club members", unit: "books" },
  { measure: "numbers of customers served", ent: "days", unit: "customers" },
  { measure: "lap times (in seconds)", ent: "runners", unit: "seconds" },
  { measure: "weekly savings (in dollars)", ent: "weeks", unit: "dollars" },
  { measure: "numbers of push-ups completed", ent: "athletes", unit: "push-ups" },
  { measure: "heights (in centimeters)", ent: "seedlings", unit: "centimeters" },
  { measure: "numbers of emails received", ent: "workdays", unit: "emails" },
  { measure: "waiting times (in minutes)", ent: "patients", unit: "minutes" },
];
/** 자료 나열 문장(표현 4가지). 명사(measure)와 값 목록이 같은 문장에 놓인다. */
export function listSentence(rng: Rng, sc: Scene, list: (number | string)[], n = list.length): string {
  const l = list.join(", ");
  return rng.pick([
    `The ${sc.measure} for ${n} ${sc.ent} are ${l}.`,
    `A researcher records the ${sc.measure} of ${n} ${sc.ent}: ${l}.`,
    `Here are the ${sc.measure} for ${n} ${sc.ent}: ${l}.`,
    `${n} ${sc.ent} were observed, and the ${sc.measure} were ${l}.`,
  ]);
}
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export function rndList(rng: Rng, n: number, lo: number, hi: number): number[] { return Array.from({ length: n }, () => rng.int(lo, hi)); }
export const medianOf = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const DATA_CTX_X = DATA_CTX;
