// 묶음 E1 — 신규 렌더러 2차(단위원·삼각함수 곡선·벤/수형도·삼각형 중첩·입체 확장 …). 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as ucTrig } from "../items/right_triangles_trigonometry.trig_ratio.UC.P";
import { ITEM as ucRad } from "../items/right_triangles_trigonometry.unit_circle_radian.UC.P";
import { ITEM as ucRadC } from "../items/right_triangles_trigonometry.unit_circle_radian.UC.C";
import { ITEM as tcTrig } from "../items/right_triangles_trigonometry.trig_ratio.TC.P";
import { ITEM as tcSin } from "../items/right_triangles_trigonometry.sinusoid_graph.TC.P";
import { ITEM as tcSinC } from "../items/right_triangles_trigonometry.sinusoid_graph.TC.C";
import { ITEM as vtSimple } from "../items/probability.simple.VT.P";
import { ITEM as vtCond } from "../items/probability.conditional.VT.P";
import { ITEM as vtSeq } from "../items/probability.sequential_without_replacement.VT.P";
import { ITEM as tnSim } from "../items/lines_angles_triangles.similar_triangles.TN.P";
import { ITEM as tnNest } from "../items/lines_angles_triangles.nested_similar_parallel.TN.P";
import { ITEM as tnAlt } from "../items/right_triangles_trigonometry.similar_right_triangle_altitude.TN.P";
import { ITEM as sxPyth } from "../items/right_triangles_trigonometry.pythagorean_hypotenuse.SX.P";
import { ITEM as sxSpace } from "../items/area_volume.space_diagonal.SX.P";

export const BUNDLE: LArch[] = [...ucTrig, ...ucRad, ...ucRadC, ...tcTrig, ...tcSin, ...tcSinC, ...vtSimple, ...vtCond, ...vtSeq, ...tnSim, ...tnNest, ...tnAlt, ...sxPyth, ...sxSpace];
