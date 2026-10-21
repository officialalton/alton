"""AP Macroeconomics 5세트 채우기(MA4·MA5, 2026-10-21) 생성 단계 목록. 이미 있는 원형의 공개 안 된 변형·FRQ 시드만 새로 만든다(새 원형 없음)."""
STAGE_T_A = ['ma_auto_stabilizers', 'ma_fiscal_policy_compare', 'ma_inflation_explain', 'ma_lras_shift', 'ma_lras_vs_sras', 'ma_money_functions', 'ma_nominal_vs_real',
             'ma_policy_goal_conflict', 'ma_policy_mix', 'ma_realnominal_explain', 'ma_sras_slope', 'ma_stagflation', 'ma_unemp_measure']
STAGE_T_F = ['maf_short_lf_crowding']

# 2차: 1차 뒤에도 부족한 칸(단원 3·4·5)의 공개 안 된 변형과 FRQ 전 유형 새 시드.
STAGE_T2_A = ['ma_lf_capital_inflow', 'ma_lf_events', 'ma_lf_graph', 'ma_lf_investment', 'ma_lras_vs_sras', 'ma_money_market_graph', 'ma_money_market_shift', 'ma_omo_effects', 'ma_sras_slope', 'ma_stagflation']
STAGE_T2_F = ['maf_long_adas_policy', 'maf_long_money_market', 'maf_long_open_economy', 'maf_short_fiscal_multiplier', 'maf_short_fx_trade', 'maf_short_gdp_data', 'maf_short_lf_crowding', 'maf_short_money_banking', 'maf_short_phillips', 'maf_short_ppc_trade']

# 3차: 공개 안 된 변형이 남은 원형(재고 보강).
STAGE_T4_A = ['ma_financial_assets', 'ma_lrpc', 'ma_money_functions', 'ma_supply_self_correction', 'ma_trade_explain']

# 5차: 선택지 문장 길이 보정 뒤 다시 생성(ma_t_xrate_nx_explain 의 옛 후보는 superseded).
STAGE_T5_A = ['ma_t_xrate_nx_explain']
