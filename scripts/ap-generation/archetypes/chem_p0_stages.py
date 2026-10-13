"""AP Chemistry 파일럿·보충 단계 목록(2026-10-13). registry.py 가 STAGE_<이름> 을 chem_<이름> 으로 등록한다(AP_LIST=chem_p1_mc 등).
P1-a MC 파일럿: 20 단독 + 2문항 세트 1 = 22문항(9단원 전부, 그림 유형·문장 유형·계산 유형 혼합, 오차 방향·실험 스킬 포함). P1-b FRQ 파일럿: 긴 문항 3 + 짧은 문항 4 = 7종 각 1(공식 시험 구조 46점)."""
STAGE_P1_MC = [
    # L (값 계산, 해석 문장 없음)
    "ch_moles_of_atoms", "ch_ideal_gas", "ch_beer_lambert", "ch_limiting_reagent", "ch_rate_law_initial", "ch_calorimetry", "ch_ice_table", "ch_weak_acid_ph", "ch_buffer_ph", "ch_cell_potential",
    # M (표현 선택·고정 문장·오차 방향)
    "ch_pes_identify", "ch_bond_polarity", "ch_vsepr_shape", "ch_imf_boiling", "ch_mb_curves", "ch_titration_error", "ch_mechanism_consistent", "ch_calorimetry_error", "ch_q_vs_k", "ch_gibbs_sign",
    # 세트(2문항)
    "chs_titration_set",
]
STAGE_P1_FRQ = ["chf_long_titration", "chf_long_thermo", "chf_long_kinetics", "chf_short_pes", "chf_short_stoich", "chf_short_bonding", "chf_short_equilibrium"]
