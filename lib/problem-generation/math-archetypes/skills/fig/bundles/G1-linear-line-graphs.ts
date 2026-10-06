// 묶음 G1 — 직선 그래프(LN·지문형 25조합) — plane.scatter(점)+fitLine(직선). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as lfEvaluate } from "../items/linear_functions.evaluate.LN.P";
import { ITEM as lfFindX } from "../items/linear_functions.find_x_for_value.LN.P";
import { ITEM as lfSlope } from "../items/linear_functions.slope_from_two_points.LN.P";
import { ITEM as lfInterpSlope } from "../items/linear_functions.interpret_slope.LN.P";

export const BUNDLE: LArch[] = [...lfEvaluate, ...lfFindX, ...lfSlope, ...lfInterpSlope];
