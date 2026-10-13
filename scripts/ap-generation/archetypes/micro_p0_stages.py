"""AP Microeconomics 파일럿·보충 단계 목록(2026-10-13). registry.py 가 STAGE_<이름> 을 micro_<이름> 으로 등록한다(AP_LIST=micro_p1_mc 등).
P1-a MC 파일럿: 22 원형(단원 U1 5·U2 6·U3 5·U4 3·U5 1·U6 2, 그림 유형: 그래프 5·표 7·보수행렬 1 혼합). P1-b FRQ 파일럿: 8유형 각 1(긴 3 + 짧은 5)."""
STAGE_P1_MC = [
    # L (값 계산)
    "mi_opp_cost_choice", "mi_pe_midpoint", "mi_per_unit_tax", "mi_cost_table_mc", "mi_profit_max_table", "mi_mb_mc_table", "mi_monopoly_numeric", "mi_hire_table", "mi_pigou_numeric", "mi_surplus_numeric",
    # 그래프·표 읽기
    "mi_price_control_graph", "mi_cost_graph_min", "mi_pc_graph_profit", "mi_monopoly_graph", "mi_ext_graph", "mi_comp_adv_table",
    # M (고정 문장·개념 적용)
    "mi_shift_demand", "mi_double_shift", "mi_shutdown_decision", "mi_entry_exit", "mi_game_nash", "mi_economic_systems",
]
STAGE_P1_FRQ = ["mif_long_pc_firm", "mif_long_market_policy", "mif_long_monopoly", "mif_short_externality", "mif_short_labor", "mif_short_trade", "mif_short_elasticity", "mif_short_mc"]

# 2026-10-13 P2(부족분 생성): P1 통과 재고(MC 32 + FRQ 4)로 MI1·MI2 를 정확 배정(micro-assign.ts, 가상 칸 계산)했을 때 가상 칸으로 남은 원형.
# 런 A = 가상 칸 1개인 원형(후보 2씩, 1.3배 예비 / 통과율 0.72 → 2), 런 B = 가상 칸 2개인 원형(후보 4씩). 합계 MC 후보 76 + 100 = 176.
STAGE_P2_A = ['mi_barriers', 'mi_cartel_cheat', 'mi_consumer_rule', 'mi_cr4', 'mi_demand_determinant', 'mi_economic_systems', 'mi_efficiency_types', 'mi_factor_derived', 'mi_firm_supply', 'mi_fixed_variable', 'mi_free_rider', 'mi_game_dominant', 'mi_hhi', 'mi_lorenz_gini', 'mi_lr_economies', 'mi_mc_excess_capacity', 'mi_mc_graph_longrun', 'mi_min_wage_monopsony', 'mi_monopoly_graph', 'mi_monopoly_numeric', 'mi_monopoly_vs_pc', 'mi_monopsony_concept', 'mi_mr_demand', 'mi_mrp_value', 'mi_normal_profit', 'mi_pc_graph_decision', 'mi_pc_longrun', 'mi_pd_conditions', 'mi_pd_perfect', 'mi_pe_revenue', 'mi_profit_max_table', 'mi_public_good_efficient', 'mi_related_market', 'mi_subsidy_effect', 'mi_sunk_cost', 'mi_surplus_concept', 'mi_tax_incidence_elasticity', 'mi_utility_rule']
STAGE_P2_B = ['mi_cost_curve_relation_graph', 'mi_cost_graph_min', 'mi_cost_relationships', 'mi_elasticity_graph', 'mi_factor_substitutes', 'mi_factors_production', 'mi_game_pareto', 'mi_hire_rule', 'mi_labor_market_shift', 'mi_lorenz_graph', 'mi_mc_short_long', 'mi_movement_vs_shift', 'mi_mp_numeric', 'mi_mr_mc_rule', 'mi_neg_externality', 'mi_pd_markets', 'mi_pes_determinant', 'mi_ppc_graph_points', 'mi_profit_types', 'mi_public_good', 'mi_scarcity_concept', 'mi_shift_supply', 'mi_shutdown_rule', 'mi_structure_identify', 'mi_tariff_effects']
# FRQ: P1-b 에서 반려된 유형(시장 정책·무역·탄력성·독점적 경쟁; 검토기 지적 반영 수정본) + 공식 샘플 형태의 보수행렬 짧은 문항(frq_micro_game). 후보 2씩.
STAGE_P2_F = ["mif_long_market_policy", "mif_short_trade", "mif_short_elasticity", "mif_short_mc", "frq_micro_game"]
