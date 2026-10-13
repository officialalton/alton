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
    # R3-B(계산기 불가): 질문·풀이 골격이 기존 문항군과 같으면 합류(애매하면 같은 군)
    ("c_cont_three_pieces_two_unknowns", "cont_piece", "R3-B: 조각 함수가 연속이 되는 상수 찾기(조각 수·미지수 수만 다름)"),
    ("c_piecewise_differentiable_two_constants", "cont_piece", "R3-B: 조각 함수가 연결점에서 연속·미분 가능이 되는 상수 찾기"),
    ("c_ivt_root_interval_polynomial", "ivt", "R3-B: 중간값 정리 적용(끝점 값의 부호/범위로 보장되는 값·구간 선택)"),
    ("c_squeeze_polynomial_bounds", "g_squeeze_graph", "R3-B: 조임 정리로 극한 구하기(경계 함수 자료 표현만 다름)"),
    ("c_quotient_rule_trig_exp_value", "quotient_rule_eval", "R3-B: 몫의 법칙으로 한 점의 도함수 값(자료 표현만 다름)"),
    ("c_product_power_times_unknown_function", "product_table", "R3-B: 곱의 법칙으로 한 점의 도함수 값(주어진 값 표현만 다름)"),
    ("c_limit_two_point_difference_quotient", "c_limit_def_derivative_calc", "R3-B: 차분 몫의 극한을 도함수 값으로 인식"),
    ("c_tangent_y_intercept_power_exp", "c_tangent_x_intercept_calc", "R3-B: 접선과 축의 절편"),
    ("c_tangent_x_intercept", "c_tangent_x_intercept_calc", "R3-B: 접선과 축의 절편"),
    ("c_related_rates_ladder", "c_related_rates_distance_calc", "R3-B: 피타고라스 관계의 관련 변화율"),
    ("c_speeding_up_intervals", "g_speed_increasing", "R3-B: v 와 a 의 부호로 속력 증가 구간"),
    ("c_roc_meaning_polynomial", "g_context_roc_meaning", "R3-B: 도함수의 맥락 의미(단위·부호)"),
    ("c_lhopital_twice_zero", "lhopital", "R3-B: 0/0 극한을 로피탈로 계산"),
    ("c_abs_extremum_cubic", "c_abs_max_candidates_calc", "R3-B: 닫힌 구간의 절대 최대·최소(후보 비교)"),
    ("c_box_min_surface", "optimization", "R3-B: 제약 조건 아래 최적화(식 세우기 → 도함수 0)"),
    ("c_decreasing_rational", "c_increasing_interval_calc", "R3-B: f' 의 부호로 증가·감소 구간"),
    ("c_concave_xnlnx", "c_inflection_calc", "R3-B: f'' 의 부호로 오목성 구간·변곡점"),
    ("c_second_deriv_test_quartic", "c_second_deriv_test_calc", "R3-B: 이차 도함수 판정법"),
    ("c_chain_exp_cos_point", "g_chain_two_graphs", "R3-B: 합성함수 도함수 값(한 점)"),
    ("c_product_sqrt_chain_value", "g_chain_two_graphs", "R3-B: 합성함수 도함수 값(한 점)"),
    ("c_inverse_deriv_formula", "g_inverse_deriv_graph", "R3-B: 역함수의 도함수 1/f'(g(b))"),
    ("c_second_deriv_product_exp", "g_second_deriv_mixed_calc", "R3-B: 이계도함수 값(한 점)"),
    ("c_implicit_tangent_line_eq", "implicit_slope", "R3-B: 음함수 미분으로 기울기/접선"),
    ("c_implicit_cubic_horizontal_x", "c_implicit_horizontal_tangent_calc", "R3-B: 음함수 곡선의 수평 접선"),
    ("c_usub_ln_definite", "usub_integral", "R3-B: 치환적분의 정적분 값"),
    ("c_trapezoid_table_initial", "riemann_table", "R3-B: 표의 값으로 구간 합(리만/사다리꼴) 근사"),
    ("c_washer_about_line", "g_volume_axis_shift_calc", "R3-B: 축 이동 회전체의 부피(와셔)"),
    ("c_xsection_nonstandard", "volume_calc", "R3-B: 단면 도형 부피"),
    ("c_position_from_velocity", "accum_context_calc", "R3-B: 초기값 + 속도(변화율)의 적분"),
    ("c_distance_minus_displacement", "c_total_distance_calc", "R3-B: 속도의 적분으로 이동 거리·변위"),
    ("c_area_exp_between", "c_area_between_calc", "R3-B: 두 곡선 사이의 넓이"),
    ("c_area_crossing_setup", "area_setup", "R3-B: 곡선 사이 넓이의 적분식 세우기"),
    ("c_volume_disc_y_axis", "c_disc_volume_calc", "R3-B: 원판법 부피"),
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
