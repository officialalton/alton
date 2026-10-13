"""R3 구조 판정(보수, "애매하면 같은 군") 반영: 새 아키타입을 기존 묶음에 합류시키거나 새 묶음을 만든다(멱등).
사용: python3 scripts/ap-generation/r3-merge-groups.py  → data/ap/stock/structure-groups.conservative.json 갱신. 근거는 docs/ap/reserve-r3-report.md."""
import json
from pathlib import Path

P = Path(__file__).resolve().parents[2] / "data/ap/stock/structure-groups.conservative.json"
# (새 아키타입, 같은 구조인 기존·신규 앵커, 근거)
MERGES = [
    ("c_trapezoid_formula_calc", "c_midpoint_sum_calc", "R3-A: 4 등분 리만·사다리꼴 합(식, 계산기): 좌/우/중점/사다리꼴만 다름"),
    ("g_chain_graph_outer_calc", "g_chain_two_graphs", "R3-A: 합성함수 h(x)=f(g(x)) 의 h'(a)=f'(g(a))g'(a), 값을 읽는 자료(그래프/식)만 다름"),
    ("g_chain_exp_graph_calc", "g_chain_mixed_calc", "R3-A: 합성함수 도함수, 바깥 e^{u}·안쪽 그래프(연쇄법칙 한 번)"),
    ("g_exp_time_graph_calc", "g_exp_value_calc", "R3-A: 그래프 두 점으로 지수 모형 k 를 정하고 값/시각을 구함"),
    ("c_decay_two_points_calc", "g_exp_value_calc", "R3-A: 두 자료로 지수 감소 모형을 정해 나중 값을 구함"),
    ("g_net_amount_formula_graph_calc", "accum_context_calc", "R3-A: 초기량 + 유입률 적분 - 유출률 적분(식+그래프)"),
    ("g_area_sin_line_calc", "c_area_between_calc", "R3-A: 곡선과 직선 사이의 넓이(교점은 계산기)"),
    ("c_linearization_error_calc", "c_linear_approx_overunder_calc", "R3-A: 접선 근사값과 참값의 비교(오차 크기)"),
    ("c_second_deriv_test_justify_calc", "c_relative_min_justify_calc", "R3-A: 임계점에서 극값 판정 문장 선택(일차/이차 판정법 중 어느 것인지만 다름)"),
    ("g_relative_max_graph_formula_calc", "g_critical_point_graph_formula_calc", "R3-A: h=f∓g, f' 그래프 + g 식에서 h' 의 영점/부호 변화"),
]
d = json.loads(P.read_text())
groups = d["groups"]
for new, anchor, basis in MERGES:
    g = next((x for x in groups if anchor in x["archetypes"]), None)
    if g is None:
        g = {"archetypes": [anchor], "basis": basis}
        groups.append(g)
    if new not in g["archetypes"]:
        g["archetypes"].append(new)
P.write_text(json.dumps(d, ensure_ascii=False))
print("groups", len(groups))
