// 2026-09-14 문제 템플릿 ③ — 도형·그래프는 "그림 파일"이 아니라 **데이터**로 받아 우리가 SVG 로 그린다.
// AI 는 점·선·곡선·라벨만 내고, 축·눈금·격자·화살표는 여기서 그리므로 좌표의 정확성이 보장된다.
// (docs/2026-09-14-problem-template-design.md 2-2)

export type Point = [number, number];

export type PlaneItem =
  | { kind: "line"; through: [Point, Point]; label?: string; dashed?: boolean }
  | { kind: "line"; slope: number; intercept: number; label?: string; dashed?: boolean }
  | { kind: "segment"; from: Point; to: Point; label?: string }
  | { kind: "points"; points: Point[]; labels?: string[]; open?: boolean }
  | { kind: "function"; fn: "linear" | "quadratic" | "exponential" | "abs" | "sqrt" | "cubic"; params: number[]; label?: string; domain?: [number, number] }
  | { kind: "polyline"; points: Point[]; label?: string };

export type CoordinatePlaneSpec = {
  type: "coordinate_plane";
  xRange: [number, number];
  yRange: [number, number];
  xStep?: number;
  yStep?: number;
  /** 축 끝의 변수 이름(기본 x, y). */
  xLabel?: string;
  yLabel?: string;
  /** 축 설명(SAT 스타일: 아래 "Time (seconds)", 왼쪽 세로 "Height (meters)"). */
  xTitle?: string;
  yTitle?: string;
  items: PlaneItem[];
};

/** 평행선·횡단선 교점의 각 — 어느 선(y1|y2)의 교점인지, 어느 사분면(NE·NW·SE·SW)인지로 자리를 정한다. 호(arc)를 그린다. */
export type IntersectionAngle = { line: "y1" | "y2"; quadrant: "NE" | "NW" | "SE" | "SW"; text: string };

export type GeometryShape =
  | { kind: "polygon"; points: Point[]; vertexLabels?: string[]; sideLabels?: string[]; angleLabels?: { at: number; text: string }[]; rightAngleAt?: number[] }
  | { kind: "circle"; center: Point; radius: number; centerLabel?: string; radiusLabel?: string }
  | { kind: "segment"; from: Point; to: Point; label?: string; dashed?: boolean }
  | { kind: "parallel_lines"; y1: number; y2: number; transversal: [Point, Point]; labels?: [string, string, string]; angleLabels?: { at: Point; text: string }[]; angles?: IntersectionAngle[] }
  | { kind: "label"; at: Point; text: string };

export type GeometrySpec = {
  type: "geometry";
  /** 그림 좌표 범위(단위 없음). 없으면 도형에서 자동. */
  view?: { xRange: [number, number]; yRange: [number, number] };
  shapes: GeometryShape[];
  /** SAT 표기 "Note: Figure not drawn to scale." */
  notToScale?: boolean;
};

/** 올린 그림 파일(2026-09-14 ④). 비공개 버킷, 화면은 서명 URL 로 본다. */
export type ImageFigureSpec = {
  type: "image";
  bucket: string;
  path: string;
  alt?: string;
  /** 표시 최대 폭(px). 없으면 본문 폭. */
  width?: number;
};

import type { ParallelTransversalSpec } from "./templates/parallel-transversal";
import { validateParallelTransversal } from "./templates/parallel-transversal";
import type { TriangleSpec } from "./templates/triangle";
import { validateTriangle } from "./templates/triangle";
import type { PlaneSpec } from "./templates/coordinate-plane";
import { validatePlane } from "./templates/coordinate-plane";
import type { DataSpec } from "./templates/data";
import { validateData } from "./templates/data";
import type { CircleSpec } from "./templates/circle";
import { validateCircle } from "./templates/circle";
import type { PolygonSpec } from "./templates/polygon";
import { validatePolygon } from "./templates/polygon";
import type { SolidSpec } from "./templates/solid";
import { validateSolid } from "./templates/solid";

/**
 * 2026-09-14 표준 렌더링 엔진: `geometry`(좌표 자유 입력)는 **레거시** — 읽기·표시만 하고 새 저장·공개는 막는다(재생성 필요).
 * 새 도형은 템플릿(`parallel_transversal`, …)으로 관계만 받는다.
 */
export type FigureSpec = CoordinatePlaneSpec | GeometrySpec | ImageFigureSpec | ParallelTransversalSpec | TriangleSpec | PlaneSpec | DataSpec | CircleSpec | PolygonSpec | SolidSpec;
/** 표준 템플릿 — AI 가 낼 수 있는 도형·자료 데이터 type. */
export const TEMPLATE_FIGURE_TYPES: readonly string[] = ["parallel_transversal", "triangle", "circle", "polygon", "solid", "plane", "data"];
export const GEOMETRY_TEMPLATE_TYPES: readonly string[] = ["parallel_transversal", "triangle", "circle", "polygon", "solid"];
/** 레거시(좌표 자유 입력) — 표시만, 새 공개 불가(2026-09-14 템플릿 3 이후 coordinate_plane 도 레거시). */
export const LEGACY_FIGURE_TYPES: readonly string[] = ["geometry", "coordinate_plane"];

/** 최소한의 모양 검사 — 렌더러가 던지지 않게, 그리고 AI 출력이 이상하면 초안에 경고를 남기게. */
export function validateFigureSpec(input: unknown): { ok: true; spec: FigureSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  const isPoint = (p: unknown): p is Point => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));
  const isRange = (r: unknown): r is [number, number] => isPoint(r) && r[0] < r[1];
  if (s.type === "coordinate_plane") {
    if (!isRange(s.xRange) || !isRange(s.yRange)) return { ok: false, error: "xRange/yRange 는 [작은 수, 큰 수] 여야 합니다." };
    if (!Array.isArray(s.items)) return { ok: false, error: "items 배열이 없습니다." };
    for (const it of s.items as Record<string, unknown>[]) {
      if (!it || typeof it !== "object") return { ok: false, error: "items 항목이 객체가 아닙니다." };
      if (it.kind === "line") {
        if (!(Array.isArray(it.through) && it.through.length === 2 && it.through.every(isPoint)) && !(typeof it.slope === "number" && typeof it.intercept === "number")) {
          return { ok: false, error: "line 은 through 두 점 또는 slope/intercept 가 필요합니다." };
        }
      } else if (it.kind === "segment") {
        if (!isPoint(it.from) || !isPoint(it.to)) return { ok: false, error: "segment 는 from/to 점이 필요합니다." };
      } else if (it.kind === "points" || it.kind === "polyline") {
        if (!Array.isArray(it.points) || !it.points.every(isPoint) || it.points.length === 0) return { ok: false, error: `${it.kind} 는 points 가 필요합니다.` };
      } else if (it.kind === "function") {
        if (!["linear", "quadratic", "exponential", "abs", "sqrt", "cubic"].includes(String(it.fn)) || !Array.isArray(it.params) || !it.params.every((n) => typeof n === "number")) {
          return { ok: false, error: "function 은 fn(linear|quadratic|exponential|abs|sqrt|cubic) 과 params 숫자 배열이 필요합니다." };
        }
      } else {
        return { ok: false, error: `알 수 없는 items.kind: ${String(it.kind)}` };
      }
    }
    return { ok: true, spec: s as unknown as CoordinatePlaneSpec };
  }
  if (s.type === "image") {
    if (typeof s.bucket !== "string" || typeof s.path !== "string" || !s.path || s.path.includes("..")) {
      return { ok: false, error: "image 는 bucket 과 path 가 필요합니다." };
    }
    return { ok: true, spec: s as unknown as ImageFigureSpec };
  }
  if (s.type === "parallel_transversal") return validateParallelTransversal(s);
  if (s.type === "triangle") return validateTriangle(s);
  if (s.type === "plane") return validatePlane(s);
  if (s.type === "data") return validateData(s);
  if (s.type === "circle") return validateCircle(s);
  if (s.type === "polygon") return validatePolygon(s);
  if (s.type === "solid") return validateSolid(s);
  if (s.type === "geometry") {
    if (!Array.isArray(s.shapes) || s.shapes.length === 0) return { ok: false, error: "shapes 배열이 없습니다." };
    for (const sh of s.shapes as Record<string, unknown>[]) {
      if (sh.kind === "polygon") {
        if (!Array.isArray(sh.points) || sh.points.length < 3 || !sh.points.every(isPoint)) return { ok: false, error: "polygon 은 점 3개 이상이 필요합니다." };
      } else if (sh.kind === "circle") {
        if (!isPoint(sh.center) || typeof sh.radius !== "number" || sh.radius <= 0) return { ok: false, error: "circle 은 center 와 radius(>0) 가 필요합니다." };
      } else if (sh.kind === "segment") {
        if (!isPoint(sh.from) || !isPoint(sh.to)) return { ok: false, error: "segment 는 from/to 가 필요합니다." };
      } else if (sh.kind === "parallel_lines") {
        if (typeof sh.y1 !== "number" || typeof sh.y2 !== "number" || !Array.isArray(sh.transversal) || !sh.transversal.every(isPoint)) return { ok: false, error: "parallel_lines 는 y1, y2, transversal 두 점이 필요합니다." };
        if (sh.angles !== undefined) {
          if (!Array.isArray(sh.angles) || !(sh.angles as Record<string, unknown>[]).every((a) => a && ["y1", "y2"].includes(String(a.line)) && ["NE", "NW", "SE", "SW"].includes(String(a.quadrant)) && typeof a.text === "string")) {
            return { ok: false, error: "parallel_lines.angles 는 {line:'y1'|'y2', quadrant:'NE'|'NW'|'SE'|'SW', text} 목록이어야 합니다." };
          }
        }
      } else if (sh.kind === "label") {
        if (!isPoint(sh.at) || typeof sh.text !== "string") return { ok: false, error: "label 은 at 과 text 가 필요합니다." };
      } else {
        return { ok: false, error: `알 수 없는 shapes.kind: ${String(sh.kind)}` };
      }
    }
    return { ok: true, spec: s as unknown as GeometrySpec };
  }
  return { ok: false, error: `알 수 없는 그림 type: ${String(s.type)}` };
}
