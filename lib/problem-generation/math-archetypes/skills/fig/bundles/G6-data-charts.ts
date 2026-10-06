// 묶음 G6 — 막대·히스토그램·상자·점도표(BR·HG·BX·DP 30조합) — data.bar/histogram/boxplot/dot_plot. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as ovdMeanDP } from "../items/one_variable_data.mean.DP.P";
import { ITEM as ovdMedianDP } from "../items/one_variable_data.median.DP.P";
import { ITEM as ovdRangeDP } from "../items/one_variable_data.range.DP.P";

export const BUNDLE: LArch[] = [...ovdMeanDP, ...ovdMedianDP, ...ovdRangeDP];
