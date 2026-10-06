// 묶음 G5 — 산점도·선그래프 나머지(SC·LG 중 미구현 9조합, 경계 포함). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as pctChangeLG } from "../items/percentages.percent_change.LG.P";
import { ITEM as pctCompLG } from "../items/percentages.compound_change.LG.P";
import { ITEM as nfExpLG } from "../items/nonlinear_functions.exponential_vs_linear_growth.LG.P";
import { ITEM as tvdResid1 } from "../items/two_variable_data.intercept_residual_interpretation.SC.P_1";
import { ITEM as tvdResid2 } from "../items/two_variable_data.intercept_residual_interpretation.SC.P_2";
import { ITEM as tvdOutlierP } from "../items/two_variable_data.outlier_influence_on_fit.SC.P";
import { ITEM as tvdOutlierC } from "../items/two_variable_data.outlier_influence_on_fit.SC.C";
import { ITEM as tvdModelP } from "../items/two_variable_data.model_choice_linear_quadratic_exponential.SC.P";

export const BUNDLE: LArch[] = [...tvdModelP, ...tvdOutlierC, ...tvdOutlierP, ...tvdResid1, ...tvdResid2, ...nfExpLG, ...pctCompLG, ...pctChangeLG];
