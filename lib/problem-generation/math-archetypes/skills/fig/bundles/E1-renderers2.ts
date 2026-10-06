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
import { ITEM as sxPrism } from "../items/area_volume.prism_volume.SX.P";
import { ITEM as sxCylR } from "../items/area_volume.cylinder_volume_radius.SX.P";
import { ITEM as sxCylD } from "../items/area_volume.cylinder_volume_diameter.SX.P";
import { ITEM as sxComp } from "../items/area_volume.composite_solid.SX.P";
import { ITEM as lsArea } from "../items/area_volume.rectangle_area.LS.P";
import { ITEM as p3Item } from "../items/lines_angles_triangles.parallel_lines_transversal_angles.P3.P";
import { ITEM as trbSim } from "../items/lines_angles_triangles.similar_triangles.TR.B";
import { ITEM as trbCong } from "../items/lines_angles_triangles.congruent_triangles.TR.B";
import { ITEM as lnB } from "../items/linear_functions.construct_equation_from_graph.LN.B";
import { ITEM as fnB } from "../items/nonlinear_functions.function_transformation.FN.B";

export const BUNDLE: LArch[] = [...ucTrig, ...ucRad, ...ucRadC, ...tcTrig, ...tcSin, ...tcSinC, ...vtSimple, ...vtCond, ...vtSeq, ...tnSim, ...tnNest, ...tnAlt, ...sxPyth, ...sxSpace, ...sxPrism, ...sxCylR, ...sxCylD, ...sxComp, ...lsArea, ...p3Item, ...trbSim, ...trbCong, ...lnB, ...fnB];
