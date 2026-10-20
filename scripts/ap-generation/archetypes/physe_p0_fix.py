"""AP Physics C: E&M — 1차 검토 반영으로 다시 생성하는 원형 목록(수선한 원형·세트·FRQ). 함수는 없고 STAGE 목록만 둔다."""
STAGE_FIX1 = ["pe_coulomb_scaling", "pe_field_two_charges_midpoint", "pe_connected_spheres_field_ratio", "pe_cap_energy", "pe_cap_dielectric_factor", "pe_resistance_geometry", "pe_rc_initial_final_current", "pe_solenoid_inductance", "pe_rl_initial_final", "pe_inductor_energy",
              "pes_vx_graph_set", "pes_gauss_er_set", "pes_bt_graph_set", "pef_qqt_closest_approach", "pef_mr_rc_circuit", "pef_lab_capacitor_gap"]

# 2026-10-20 2차 라운드 검토 반영(physe-b 미통과 원형 + fix1 에서도 못 채운 원형)
STAGE_FIX2 = ["pe_induced_charge_claim", "pe_pe_square_four", "pe_rc_energy_time", "pe_two_loops_claim", "pe_cap_dielectric_factor", "pe_rc_initial_final_current", "pe_rl_initial_final",
              "pes_coulomb_table_set", "pes_vr_graph_set", "pef_mr_wire_ampere", "pef_lab_resistivity", "pef_qqt_shell_field", "pef_qqt_closest_approach"]

# 2026-10-20 3차 라운드 검토 반영: lab 5종은 표 설명의 LaTeX 를 일반 텍스트로 고쳐 다시 생성한다.
STAGE_FIX3 = ["pef_lab_rc_time_constant", "pef_lab_capacitor_gap", "pef_lab_resistivity", "pef_lab_magnetic_force", "pef_lab_rl_decay", "pef_mr_wire_ampere", "pef_mr_capacitor_dielectric", "pes_ohm_table_set", "pe_solenoid_energy", "pef_qqt_closest_approach"]
