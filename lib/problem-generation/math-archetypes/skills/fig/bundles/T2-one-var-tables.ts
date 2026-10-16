// 묶음 T2-one-var-tables — one_variable_data 6항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as meanFq } from "../items/one_variable_data.mean.FQ.P";
import { ITEM as meanTb } from "../items/one_variable_data.mean.TB.P";
import { ITEM as medianFq } from "../items/one_variable_data.median.FQ.P";
import { ITEM as rangeTb } from "../items/one_variable_data.range.TB.P";
import { ITEM as groupedMedian } from "../items/one_variable_data.grouped_median_interval.FQ.P";
import { ITEM as relCum } from "../items/one_variable_data.relative_cumulative_frequency.FQ.P";

export const BUNDLE: LArch[] = [...meanFq, ...meanTb, ...medianFq, ...rangeTb, ...groupedMedian, ...relCum];
