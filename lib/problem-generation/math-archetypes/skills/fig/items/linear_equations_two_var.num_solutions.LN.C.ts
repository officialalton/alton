// linear_equations_two_var.num_solutions.LN.C — 주어진 직선과 함께 해가 없는 연립을 이루는 직선 그래프(평행·다른 절편)를 4개 중에서 고른다.
import { lineCItem } from "../lnc-kit";
export const ITEM = lineCItem({ itemId: "linear_equations_two_var.num_solutions.LN.C", prefix: "l2nc", menu: ["noSolution", "parallel", "slopeYint", "standard"], easy: "slopeYint", med: "noSolution", what: "l2v_num_solutions", concepts: ["직선 그래프", "해의 개수", "평행"] });
