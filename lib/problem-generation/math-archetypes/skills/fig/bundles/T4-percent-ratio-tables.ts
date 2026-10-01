// 묶음 T4-percent-ratio-tables — percentages·ratios·linear_equations_one_var 8항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as pctOf } from "../items/percentages.percent_of.TB.P";
import { ITEM as pctWhole } from "../items/percentages.find_whole.TB.P";
import { ITEM as pctChange } from "../items/percentages.percent_change.TB.P";
import { ITEM as pctFind } from "../items/percentages.find_percent.TB.P";
import { ITEM as pctCompound } from "../items/percentages.compound_change.TB.P";
import { ITEM as rruProp } from "../items/ratios_rates_units.proportion.TB.P";
import { ITEM as rruChain } from "../items/ratios_rates_units.chained_conversion.TB.P";
import { ITEM as le1Word } from "../items/linear_equations_one_var.word_problem_translate.TB.P";

export const BUNDLE: LArch[] = [...pctOf, ...pctWhole, ...pctChange, ...pctFind, ...pctCompound, ...rruProp, ...rruChain, ...le1Word];
