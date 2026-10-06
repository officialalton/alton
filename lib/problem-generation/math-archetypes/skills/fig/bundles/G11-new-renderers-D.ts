// 묶음 G11 — 새 렌더러(math-D): 줄기-잎(SL)·원그래프(PI)·수직선(NL)·도수다각형/누적도수곡선(FO)·누적 막대(SB). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as slMean } from "../items/one_variable_data.mean.SL.P";
import { ITEM as slMedian } from "../items/one_variable_data.median.SL.P";
import { ITEM as slRange } from "../items/one_variable_data.range.SL.P";
import { ITEM as slOutlier } from "../items/one_variable_data.outlier_effect.SL.P";
import { ITEM as slQuartile } from "../items/one_variable_data.quartile_percentile_from_plot.SL.P";
import { ITEM as pi_prop } from "../items/ratios_rates_units.proportion.PI.P";
import { ITEM as pi_ps } from "../items/probability.simple.PI.P";
import { ITEM as pi_sw } from "../items/probability.sequential_without_replacement.PI.P";
import { ITEM as pi_po } from "../items/percentages.percent_of.PI.P";
import { ITEM as pi_fw } from "../items/percentages.find_whole.PI.P";
import { ITEM as pi_fp } from "../items/percentages.find_percent.PI.P";
import { ITEM as pi_sa } from "../items/circles.sector_area.PI.P";
import { ITEM as pi_sv } from "../items/probability.spinner_expected_value.PI.P";
import { ITEM as nl_solveP } from "../items/linear_inequalities.solve_one_var.NL.P";
import { ITEM as nl_solveC } from "../items/linear_inequalities.solve_one_var.NL.C";
import { ITEM as nl_cmpP } from "../items/linear_inequalities.compound_inequality_number_line.NL.P";
import { ITEM as nl_cmpC } from "../items/linear_inequalities.compound_inequality_number_line.NL.C";

export const BUNDLE: LArch[] = [...slMean, ...slMedian, ...slRange, ...slOutlier, ...slQuartile, ...pi_prop, ...pi_ps, ...pi_sw, ...pi_po, ...pi_fw, ...pi_fp, ...pi_sa, ...pi_sv, ...nl_solveP, ...nl_solveC, ...nl_cmpP, ...nl_cmpC];
