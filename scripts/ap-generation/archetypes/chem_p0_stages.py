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

# S2 FRQ 보충 런(2026-10-13): 첫 두 런에서 통과하지 못한 두 유형만(수정 후)
STAGE_S2_FRQ_B = ["chf_short_bonding", "chf_short_equilibrium"]
# S2 FRQ 런 4: 7유형 전부(여유분·평형 둘째 문항)
STAGE_S2_FRQ_C = ["chf_long_titration", "chf_long_thermo", "chf_long_kinetics", "chf_short_pes", "chf_short_stoich", "chf_short_bonding", "chf_short_equilibrium"]
# S2 MC 런 A: 두 풀 세트(CH1·CH2)의 정확 배정이 가상 칸으로 남긴 원형 전부(52개), 칸당 후보 2. 런 B: 두 시험 모두에 필요한 원형(29개)에 후보 1을 더해 합계 3 후보로 둔다.
STAGE_S2_MC_A = [
 "ch_acid_strength",
 "ch_beer_procedure",
 "ch_buffer_choice",
 "ch_chromatography",
 "ch_entropy_sign",
 "ch_formation_enthalpy",
 "ch_gas_deviation",
 "ch_gas_vapor_error",
 "ch_gibbs_sign",
 "ch_gibbs_temperature",
 "ch_heating_curve",
 "ch_hess_law",
 "ch_ie_trend",
 "ch_ion_conductivity",
 "ch_k_manipulation",
 "ch_ksp_solubility",
 "ch_le_chatelier",
 "ch_lewis_electron_check",
 "ch_lewis_lone_pairs",
 "ch_mechanism_consistent",
 "ch_miscibility",
 "ch_mixture_mass_percent",
 "ch_model_conductivity",
 "ch_needed_dh",
 "ch_needed_dumas",
 "ch_nernst",
 "ch_order_plot",
 "ch_partial_pressure",
 "ch_particulate_limiting",
 "ch_pes_identify",
 "ch_pes_subshell",
 "ch_ph_ranking",
 "ch_photon_energy",
 "ch_precipitate_claim",
 "ch_procedure_rate",
 "ch_procedure_titration",
 "ch_rate_prediction",
 "ch_redox_agent",
 "ch_resonance_lengths",
 "ch_species_ratio",
 "ch_testable_question",
 "ch_testable_variables",
 "ch_titrant_change",
 "ch_titration_conc",
 "ch_titration_conclusion",
 "ch_titration_error",
 "ch_unit_cell_ratio",
 "ch_vapor_pressure_graph",
 "ch_variable_gas",
 "ch_viscosity_trend",
 "ch_vsepr_shape",
 "chs_equilibrium_set"
]
# 런 B(수정 후 재배정): run A 통과분(54)을 재고로 넣고 CH1·CH2 를 다시 배정했을 때 가상 칸으로 남은 원형 26개, 칸당 후보 3.
STAGE_S2_MC_B = [
 "ch_acid_strength",
 "ch_buffer_data_conclusion",
 "ch_buret_data",
 "ch_calorimetry_error",
 "ch_claim_from_data",
 "ch_gas_deviation",
 "ch_gas_vapor_error",
 "ch_gibbs_temperature",
 "ch_ie_trend",
 "ch_indicator",
 "ch_ion_conductivity",
 "ch_lattice_energy",
 "ch_le_chatelier",
 "ch_miscibility",
 "ch_mixture_mass_percent",
 "ch_needed_dh",
 "ch_particle_phase",
 "ch_particle_solution_formula",
 "ch_particulate_limiting",
 "ch_pes_subshell",
 "ch_ph_ranking",
 "ch_resonance_lengths",
 "ch_titrant_change",
 "ch_titration_conclusion",
 "ch_viscosity_trend",
 "chs_rate_set"
]
