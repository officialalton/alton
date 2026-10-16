// systems_linear.param_no_solution.LN.C — 해가 없는 연립을 이루는 둘째 직선(평행·다른 절편) 그래프를 4개 중에서 고른다.
import { lineCItem } from "../lnc-kit";
export const ITEM = lineCItem({ itemId: "systems_linear.param_no_solution.LN.C", prefix: "spnc", menu: ["noSolution", "standard", "slopePoint", "parallel"], easy: "slopeYint", med: "noSolution", what: "param_no_solution", concepts: ["직선 그래프", "해가 없을 조건"] });
