// 묶음 T1 — 일차 관계 값표(linear_functions 6 · linear_equations_two_var 2). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다(이 묶음 담당 에이전트만 고친다).
import type { LArch } from "../../../levels-d";
import { ITEM as lfEvaluate } from "../items/linear_functions.evaluate.TB.P";
import { ITEM as lfFindX } from "../items/linear_functions.find_x_for_value.TB.P";
import { ITEM as lfSlope } from "../items/linear_functions.slope_from_two_points.TB.P";
import { ITEM as lfInterpSlope } from "../items/linear_functions.interpret_slope.TB.P";
import { ITEM as lfInterpIntercept } from "../items/linear_functions.interpret_intercept.TB.P";
import { ITEM as lfConstruct } from "../items/linear_functions.construct_equation_from_graph.TB.P";
import { ITEM as l2Slope } from "../items/linear_equations_two_var.slope.TB.P";
import { ITEM as l2Intersect } from "../items/linear_equations_two_var.intersection_x.TB.P";

export const BUNDLE: LArch[] = [...lfEvaluate, ...lfFindX, ...lfSlope, ...lfInterpSlope, ...lfInterpIntercept, ...lfConstruct, ...l2Slope, ...l2Intersect];
