"""AP Chemistry 5세트 채우기(2026-10-21) 신규 원형 단계 목록. STAGE_T5_MC = 계산 1차(반려 대체 전 목록), STAGE_T5_MC2 = 1차 반려 8개(주제 코드 정정) + 3부 계산 15개, STAGE_T5_BANK = 개념 문항 57개(Practice 1·2·4·6), STAGE_T5_SETS = 공유 세트 4개."""
STAGE_T5_MC = ['ch_t5_beer_lambert_conc', 'ch_t5_buffer_ratio_for_ph', 'ch_t5_cell_potential_sum', 'ch_t5_combined_gas_volume', 'ch_t5_common_ion_solubility', 'ch_t5_coulomb_ratio', 'ch_t5_dalton_partial', 'ch_t5_delta_g_from_k', 'ch_t5_faraday_mass', 'ch_t5_first_order_fraction_left', 'ch_t5_first_order_k_from_halflife', 'ch_t5_gas_molar_mass_density', 'ch_t5_graham_ratio', 'ch_t5_ice_hi_formation', 'ch_t5_ideal_gas_moles', 'ch_t5_k_reverse_doubled', 'ch_t5_kc_from_concentrations', 'ch_t5_kp_from_kc', 'ch_t5_percent_ionization', 'ch_t5_ph_after_dilution', 'ch_t5_ph_weak_acid', 'ch_t5_ph_weak_base', 'ch_t5_photon_energy_wavelength', 'ch_t5_poh_to_h', 'ch_t5_qsp_after_mixing', 'ch_t5_rate_factor_order', 'ch_t5_rate_from_law', 'ch_t5_stock_dilution_volume', 'ch_t5_titration_equivalence_volume', 'ch_t5_zero_order_time']
STAGE_T5_MC2 = ['ch_t5_first_order_fraction_left', 'ch_t5_first_order_k_from_halflife', 'ch_t5_gas_molar_mass_density', 'ch_t5_ph_weak_acid', 'ch_t5_cell_potential_sum', 'ch_t5_coulomb_ratio', 'ch_t5_faraday_mass', 'ch_t5_photon_energy_wavelength', 'ch_t5_atoms_from_mass', 'ch_t5_buffer_after_base', 'ch_t5_delta_g_from_e', 'ch_t5_delta_g_hs', 'ch_t5_first_order_conc_after', 'ch_t5_first_order_time', 'ch_t5_isotope_abundance_from_avg', 'ch_t5_k_from_initial_and_one', 'ch_t5_ka_from_ph', 'ch_t5_mass_percent_solution', 'ch_t5_nernst_cell', 'ch_t5_percent_composition', 'ch_t5_q_value', 'ch_t5_second_order_halflife', 'ch_t5_strong_base_ph']
STAGE_T5_BANK = ['ch_t5_p1_buffer_particles', 'ch_t5_p1_conjugate_pairs', 'ch_t5_p1_effective_charge', 'ch_t5_p1_imf_picture', 'ch_t5_p1_ionic_lattice', 'ch_t5_p1_lewis_electron_count', 'ch_t5_p1_mass_spectrum_peaks', 'ch_t5_p1_metal_particles', 'ch_t5_p1_mole_particles', 'ch_t5_p1_pes_subshell_count', 'ch_t5_p1_reaction_energy', 'ch_t5_p1_solution_particles', 'ch_t5_p1_strong_acid_particles', 'ch_t5_p1_titration_particles', 'ch_t5_p1_vsepr_shape', 'ch_t5_p1_weak_base_particles', 'ch_t5_p2_beer_procedure', 'ch_t5_p2_calorimetry_error', 'ch_t5_p2_calorimetry_procedure', 'ch_t5_p2_chromatography_predict', 'ch_t5_p2_density_procedure', 'ch_t5_p2_empirical_procedure', 'ch_t5_p2_gas_error', 'ch_t5_p2_gas_question', 'ch_t5_p2_pes_predict', 'ch_t5_p2_redox_procedure', 'ch_t5_p2_solubility_procedure', 'ch_t5_p2_stoich_question', 'ch_t5_p2_titration_procedure', 'ch_t5_p4_acid_strength_structure', 'ch_t5_p4_bond_enthalpy', 'ch_t5_p4_cell_direction', 'ch_t5_p4_energy_diagram', 'ch_t5_p4_entropy_sign', 'ch_t5_p4_imf_ranking', 'ch_t5_p4_k_magnitude', 'ch_t5_p4_k_temperature', 'ch_t5_p4_kinetic_control', 'ch_t5_p4_net_ionic', 'ch_t5_p4_nonideal_gas', 'ch_t5_p4_ph_pka_species', 'ch_t5_p4_phase_heat', 'ch_t5_p4_phase_particles', 'ch_t5_p4_reaction_type', 'ch_t5_p4_solid_properties', 'ch_t5_p4_solution_representation', 'ch_t5_p4_specific_heat', 'ch_t5_p4_spontaneity_signs', 'ch_t5_p6_acid_strength_claim', 'ch_t5_p6_buffer_claim', 'ch_t5_p6_calorimetry_claim', 'ch_t5_p6_hess_claim', 'ch_t5_p6_imf_claim', 'ch_t5_p6_kmt_claim', 'ch_t5_p6_solubility_claim', 'ch_t5_p6_titration_claim']
STAGE_T5_SETS = ['chs_t5_equilibrium_table_set', 'chs_t5_hess_table_set', 'chs_t5_ksp_table_set', 'chs_t5_metal_specific_heat_set']
STAGE_T5_BANK2 = ['ch_t5_p2_change_test', 'ch_t5_p2_cold_pack_predict', 'ch_t5_p2_formation_procedure', 'ch_t5_p2_heat_phase_procedure', 'ch_t5_p2_hess_question', 'ch_t5_p2_yield_procedure', 'ch_t5_p4_limiting_model', 'ch_t5_p4_redox_model', 'ch_t5_p6_endothermic_claim', 'ch_t5_p6_formation_claim']  # CH5 에 남은 칸 보충(1차 실행 뒤)

# CH5 세트 재작성(검토기 지적: 오답 설명이 값과 맞지 않음 → 설명·오답 수정): chem-t5-sets2 실행 대상
STAGE_T5_SETS2 = ['chs_t5_hess_table_set', 'chs_t5_ksp_table_set', 'chs_t5_metal_specific_heat_set']

# CH4 새 시나리오 FRQ 7종: chem-t5-frq 실행 대상
STAGE_T5_FRQ = ['chf_long_redox_titration', 'chf_long_electrolysis', 'chf_long_initial_rates', 'chf_short_ionization_energy', 'chf_short_precip_limiting', 'chf_short_imf_dissolving', 'chf_short_ice_table']

# CH5 새 시나리오 FRQ 7종: chem-t5-frq2 실행 대상
STAGE_T5_FRQ2 = ['chf_long_redox_titration', 'chf_long_electrolysis', 'chf_long_initial_rates', 'chf_short_ionization_energy', 'chf_long_gravimetric', 'chf_long_nernst_cell', 'chf_long_mechanism_halflife', 'chf_short_configuration_ions', 'chf_short_empirical_formula', 'chf_short_solid_types', 'chf_short_weak_acid_ka']

# 2차 FRQ 재작성(수치 비교 기대값 정리·표현 수정): chem-t5-frq3 실행 대상
STAGE_T5_FRQ3 = ['chf_long_redox_titration', 'chf_long_initial_rates', 'chf_long_gravimetric', 'chf_short_weak_acid_ka', 'chf_short_solid_types', 'chf_short_imf_dissolving', 'chf_short_ice_table']

# 3차 FRQ(분자간 힘 표·고체 유형 재작성): chem-t5-frq4 실행 대상
STAGE_T5_FRQ4 = ['chf_short_imf_dissolving', 'chf_short_solid_types']

# 4차 FRQ(CH5 bonding 칸 대체): chem-t5-frq5 실행 대상
STAGE_T5_FRQ5 = ['chf_short_resonance_bond_order']

# CH5 단독 4칸 대체: chem-t5-mc3 실행 대상
STAGE_T5_MC3 = ['ch_t5i_p2_oxide_formula_procedure', 'ch_t5i_p4_evaporation_forces', 'ch_t5i_p4_heating_curve', 'ch_t5i_ka_from_ph']

# CH5 단독 6칸 대체 2부: chem-t5-mc4 실행 대상
STAGE_T5_MC4 = ['ch_t5j_p6_ionization_anomaly', 'ch_t5j_p2_standard_solution_procedure', 'ch_t5j_p4_displacement_model', 'ch_t5j_ka_from_titration_table', 'ch_t5j_ammonium_ph', 'ch_t5j_equivalence_ph']

# CH5 3.4 기체 단독 1칸 대체: chem-t5-mc5 실행 대상
STAGE_T5_MC5 = ['ch_t5k_valve_mixing']
