// two_variable_data 자료(그림·표) 원형 모음 — 파일럿 15항목(조사 문서 5-6): hard 60 + easy/medium 30.
// 항목 id = `<skill>.<kind>.<자료코드>.<위치 P|C>`; 원형 id = `tvd.<kind>.<자료코드>.<위치>.<연산자>`.
import type { Archetype } from "../types";
import { asLevel, type LArch } from "../levels-d";
import { FIG_LINE_HARD } from "./tvd-fig-lines";
import { FIG_TABLE_HARD } from "./tvd-fig-tables";
import { FIG_CHOICE_HARD } from "./tvd-fig-choice";
import { FIG_LEVELS } from "./tvd-fig-levels";

export const FTVD_HARD: Archetype[] = [...FIG_TABLE_HARD, ...FIG_LINE_HARD, ...FIG_CHOICE_HARD];
export const FTVD_ALL: LArch[] = [...FTVD_HARD.map((a) => asLevel(a)), ...FIG_LEVELS];
