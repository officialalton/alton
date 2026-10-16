// 묶음 T5-nonlinear-tables — nonlinear·equivalent_expressions 11항목. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as eePoly } from "../items/equivalent_expressions.polynomial_distribution.TB.P";
import { ITEM as nesRoot } from "../items/nonlinear_equations_systems.root.TB.P";
import { ITEM as nesSum } from "../items/nonlinear_equations_systems.sum_of_roots.TB.P";
import { ITEM as nesLq } from "../items/nonlinear_equations_systems.linear_quadratic_intersection.TB.P";
import { ITEM as nfContext } from "../items/nonlinear_functions.context_graph_features.TB.P";
import { ITEM as nfEvaluate } from "../items/nonlinear_functions.evaluate.TB.P";
import { ITEM as nfExpModel } from "../items/nonlinear_functions.exponential_model.TB.P";
import { ITEM as nfExpLin } from "../items/nonlinear_functions.exponential_vs_linear_growth.TB.P";
import { ITEM as nfFindX } from "../items/nonlinear_functions.find_x_for_value.TB.P";
import { ITEM as nfVertexX } from "../items/nonlinear_functions.vertex_x.TB.P";
import { ITEM as nfVertexY } from "../items/nonlinear_functions.vertex_y.TB.P";

export const BUNDLE: LArch[] = [...nesRoot, ...nesSum, ...nesLq, ...nfEvaluate, ...nfFindX, ...nfExpModel, ...nfExpLin, ...nfContext, ...nfVertexX, ...nfVertexY, ...eePoly];
