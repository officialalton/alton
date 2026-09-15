// 그림 데이터의 대체 설명 — 렌더러들이 만든 alt 를 한 곳에서 꺼낸다(figure_set 캡션·검증 결과용).
import type { FigureSpec } from "./spec";
import { renderParallelTransversal } from "./templates/parallel-transversal";
import { renderTriangle } from "./templates/triangle";
import { renderPlane } from "./templates/coordinate-plane";
import { renderData } from "./templates/data";
import { renderCircle } from "./templates/circle";
import { renderPolygon } from "./templates/polygon";
import { renderSolid } from "./templates/solid";

export function figureAlt(spec: FigureSpec): string | undefined {
  switch (spec.type) {
    case "parallel_transversal": return renderParallelTransversal(spec).alt;
    case "triangle": return renderTriangle(spec).alt;
    case "plane": return renderPlane(spec).alt;
    case "data": return renderData(spec).alt;
    case "circle": return renderCircle(spec).alt;
    case "polygon": return renderPolygon(spec).alt;
    case "solid": return renderSolid(spec).alt;
    case "image": return spec.alt;
    default: return undefined;
  }
}
