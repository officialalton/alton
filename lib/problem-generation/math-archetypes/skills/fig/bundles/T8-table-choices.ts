// 묶음 T8-table-choices — 표 선택지형 C 2항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as LI_TV } from "../items/linear_inequalities.table_verification.TB.C";
import { ITEM as NF_EXP } from "../items/nonlinear_functions.exponential_model.TB.C";

export const BUNDLE: LArch[] = [...LI_TV, ...NF_EXP];
