// 묶음 G1 — 직선 그래프(LN·지문형 25조합) — plane.scatter(점)+fitLine(직선). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as lfEvaluate } from "../items/linear_functions.evaluate.LN.P";
import { ITEM as lfFindX } from "../items/linear_functions.find_x_for_value.LN.P";
import { ITEM as lfSlope } from "../items/linear_functions.slope_from_two_points.LN.P";
import { ITEM as lfInterpSlope } from "../items/linear_functions.interpret_slope.LN.P";
import { ITEM as lfInterpIntercept } from "../items/linear_functions.interpret_intercept.LN.P";
import { ITEM as lfConstruct } from "../items/linear_functions.construct_equation_from_graph.LN.P";
import { ITEM as l2IntersectX } from "../items/linear_equations_two_var.intersection_x.LN.P";
import { ITEM as l2IntersectY } from "../items/linear_equations_two_var.intersection_y.LN.P";
import { ITEM as l2IntersectSum } from "../items/linear_equations_two_var.intersection_sum.LN.P";
import { ITEM as l2NumSol } from "../items/linear_equations_two_var.num_solutions.LN.P";
import { ITEM as l2gSlope } from "../items/linear_equations_two_var.slope.LN.P";
import { ITEM as l2gIntercept } from "../items/linear_equations_two_var.intercept.LN.P";

export const BUNDLE: LArch[] = [...lfEvaluate, ...lfFindX, ...lfSlope, ...lfInterpSlope, ...lfInterpIntercept, ...lfConstruct, ...l2IntersectX, ...l2IntersectY, ...l2IntersectSum, ...l2NumSol, ...l2gSlope, ...l2gIntercept];
