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
