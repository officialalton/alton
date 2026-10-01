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
export const DATA_CTX = ["", "", "A researcher is analyzing survey results. ", "A school counselor reviews some data. ", "A town planner collects information from residents. ", "A club treasurer summarizes the records. ", "A teacher is looking at class results. ", "A store manager studies sales records. "];

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
