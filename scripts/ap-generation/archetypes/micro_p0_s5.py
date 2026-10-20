"""AP Microeconomics 확대(2026-10-19, MI3 신규 세트): 공개 세트 MI1·MI2 와 풀이 틀·자료 형태가 달라야 한다는 엄격 규칙.
재고 중 공개 세트와 문항군이 겹치는 것을 모두 막으면 남는 것은 재고 55 + 한 번도 쓰이지 않은 라이브러리 원형 29 뿐이고, 단원·스킬 범주 범위를 맞추려면 신규 원형이 필요하다(아래 신규 원형)."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401

# 런 S5-B: 신규 원형 31(micro_p0_s5a·s5b·s5c.py) — 단원·스킬 범주 범위를 맞추는 데 필요한 칸(고정 문장 비교·식별 18, 수치 13). 후보 3씩.
STAGE_S5_B = [
    "mi_ppc_inside_point", "mi_trade_specialize_table", "mi_marginal_decision_sunk", "mi_mu_per_dollar_table", "mi_incentives_opp_cost", "mi_substitute_complement_id", "mi_elasticity_type_identify", "mi_elasticity_compare",
    "mi_policy_compare", "mi_model_limitations", "mi_surplus_compare", "mi_cost_definitions", "mi_returns_scale_id", "mi_explicit_implicit_cost", "mi_short_long_run_id", "mi_scale_source_id", "mi_atc_mc_compare",
    "mi_profit_measures_compare", "mi_shutdown_exit_compare", "mi_merger_hhi_change", "mi_mr_table_profit", "mi_mc_tangency_table", "mi_price_discrim_numeric", "mi_monopoly_tax_effect", "mi_entry_mc_shift",
    "mi_price_discrim_effect", "mi_hire_table_wage_change", "mi_labor_shift_numeric", "mi_mc_from_mp_wage", "mi_mrp_price_change", "mi_natural_monopoly_pricing",
]

# 런 S5-C: 단원 5 스킬 2.B 보충 원형 2 + 새 짧은 FRQ(단기 가동 중단) — 후보 3씩.
STAGE_S5_C = ["mi_labor_forces_both_shift", "mi_input_price_effect", "mif_short_shutdown"]

# 런 S5-D: 단원 1 보충 원형 2(스킬 1.B·2.B), 후보 3씩.
STAGE_S5_D = ["mi_concept_scenario_id", "mi_absolute_vs_comparative"]

# 런 S5-A: 공개 세트·재고 어디에도 쓰이지 않은 라이브러리 원형(후보 3씩) + MI3 짧은 FRQ(노동시장) 후보
STAGE_S5_A = [
    "mi_ppc_opp_cost", "mi_ppc_shift", "mi_trade_terms", "mi_cross_price", "mi_demand_shift_graph", "mi_dwl_floor_graph", "mi_dwl_tax", "mi_equilibrium_numeric", "mi_import_numeric", "mi_income_elasticity",
    "mi_pe_pct", "mi_price_floor_surplus", "mi_shortage_numeric", "mi_tax_graph_read", "mi_tax_incidence_numeric", "mi_cost_atc_avc", "mi_diminishing_onset", "mi_fixed_cost_effect", "mi_pc_demand_shift", "mi_profit_numeric",
    "mi_monopoly_dwl", "mi_least_cost", "mi_mfc_numeric", "mi_monopsony_graph", "mi_monopsony_numeric", "mi_msb_msc_table", "mi_natural_monopoly", "mi_pos_ext_graph", "mi_tax_progressive",
    "mif_short_labor",
]
