// 묶음 T3-probability-tables — probability 6항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as SIMPLE_TW } from "../items/probability.simple.TW.P";
import { ITEM as SIMPLE_FQ } from "../items/probability.simple.FQ.P";
import { ITEM as COND_TW } from "../items/probability.conditional.TW.P";
import { ITEM as COND_FQ } from "../items/probability.conditional.FQ.P";
import { ITEM as SEQ_TB } from "../items/probability.sequential_without_replacement.TB.P";
import { ITEM as SPIN_TB } from "../items/probability.spinner_expected_value.TB.P";

export const BUNDLE: LArch[] = [...SIMPLE_TW, ...SIMPLE_FQ, ...COND_TW, ...COND_FQ, ...SEQ_TB, ...SPIN_TB];
