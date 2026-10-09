// 묶음 G9 — 좌표기하(CG 14조합) — plane.polygon/circle/transform. 조합 파일(items/<조합ID>.ts)의 ITEM 을 여기에 펼친다.
import type { LArch } from "../../../levels-d";
import { ITEM as cgDistMid } from "../items/coordinate_geometry.distance_midpoint.CG.P";
import { ITEM as cgHyp } from "../items/right_triangles_trigonometry.pythagorean_hypotenuse.CG.P";
import { ITEM as cgLeg } from "../items/right_triangles_trigonometry.pythagorean_leg.CG.P";
import { ITEM as cgTriArea } from "../items/area_volume.triangle_area.CG.P";
import { ITEM as cgPolyArea } from "../items/coordinate_geometry.polygon_area_on_plane.CG.P";
import { ITEM as cgSimilar } from "../items/lines_angles_triangles.similar_triangles.CG.P";
import { ITEM as cgTransImg } from "../items/coordinate_geometry.transformation_image.CG.P";
import { ITEM as cgCircGraph } from "../items/nonlinear_equations_systems.circle_equation_graph.CG.P";
import { ITEM as cgCircTrans } from "../items/circles.circle_equation_transform.CG.P";
import { ITEM as cgCircCs } from "../items/circles.circle_equation_complete_square.CG.P";
import { ITEM as cgCircGraphC } from "../items/nonlinear_equations_systems.circle_equation_graph.CG.C";
import { ITEM as cgCircTransC } from "../items/circles.circle_equation_transform.CG.C";
import { ITEM as cgCircCsC } from "../items/circles.circle_equation_complete_square.CG.C";
import { ITEM as cgTransImgC } from "../items/coordinate_geometry.transformation_image.CG.C";

export const BUNDLE: LArch[] = [...cgDistMid, ...cgHyp, ...cgLeg, ...cgTriArea, ...cgPolyArea, ...cgSimilar, ...cgTransImg, ...cgCircGraph, ...cgCircTrans, ...cgCircCs, ...cgCircGraphC, ...cgCircTransC, ...cgCircCsC, ...cgTransImgC];
