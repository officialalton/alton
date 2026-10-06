// 묶음 G3 — 함수 곡선 그래프(FN·지문형 23조합) — plane.function. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as nfVertexX } from "../items/nonlinear_functions.vertex_x.FN.P";
import { ITEM as nfVertexY } from "../items/nonlinear_functions.vertex_y.FN.P";
import { ITEM as nfEval } from "../items/nonlinear_functions.evaluate.FN.P";
import { ITEM as nfFindX } from "../items/nonlinear_functions.find_x_for_value.FN.P";
import { ITEM as nesRoot } from "../items/nonlinear_equations_systems.root.FN.P";
import { ITEM as nesSum } from "../items/nonlinear_equations_systems.sum_of_roots.FN.P";
import { ITEM as nesProd } from "../items/nonlinear_equations_systems.product_of_roots.FN.P";
import { ITEM as nesNum } from "../items/nonlinear_equations_systems.num_real_solutions.FN.P";
import { ITEM as nesISum } from "../items/nonlinear_equations_systems.irrational_sum_of_roots.FN.P";
import { ITEM as nesIProd } from "../items/nonlinear_equations_systems.irrational_product_of_roots.FN.P";
import { ITEM as nesLQ } from "../items/nonlinear_equations_systems.linear_quadratic_intersection.FN.P";
import { ITEM as nfIa } from "../items/nonlinear_functions.interpret_a.FN.P";
import { ITEM as nfIb } from "../items/nonlinear_functions.interpret_b.FN.P";
import { ITEM as nesPD } from "../items/nonlinear_equations_systems.parameter_discriminant.FN.P";
import { ITEM as nesRad } from "../items/nonlinear_equations_systems.irrational_root_radical_form.FN.P";
import { ITEM as cgPP } from "../items/coordinate_geometry.parallel_perpendicular_slopes.LN.P";
import { ITEM as sysFG } from "../items/systems_linear.system_from_graph.LN.P";
import { ITEM as liFG } from "../items/linear_inequalities.inequality_from_graph.LN.P";
import { ITEM as liPS } from "../items/linear_inequalities.point_in_solution.LN.P";

export const BUNDLE: LArch[] = [...nfVertexX, ...nfVertexY, ...nfEval, ...nfFindX, ...nesRoot, ...nesSum, ...nesProd, ...nesNum, ...nesISum, ...nesIProd, ...nesLQ, ...nfIa, ...nfIb, ...nesPD, ...nesRad, ...cgPP, ...sysFG, ...liFG, ...liPS];

