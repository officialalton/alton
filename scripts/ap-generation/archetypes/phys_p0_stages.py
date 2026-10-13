"""AP Physics 1 파일럿 단계 목록(2026-10-13). registry.py 가 STAGE_<이름> 을 phys_<이름> 으로 등록한다(AP_LIST=phys_p1_mc 등). 위험 오름차순(L → M)으로 나열한다.
P1-a MC 파일럿: 단원 균등 20 원형 + 세트 1 = 22 문항(그림 유형: 그래프·장면·FBD 선택지·에너지 막대·운동 도해). P1-b FRQ 파일럿: 4유형 각 1."""
STAGE_P1_MC = [
    # L (값 계산, 해석 문장 없음)
    "ph_vt_displacement", "ph_kinematics_time", "ph_projectile_range", "ph_atwood_tension", "ph_incline_friction", "ph_circular_tension", "ph_track_energy", "ph_spring_launch",
    "ph_ft_impulse", "ph_inelastic_collision", "ph_beam_balance", "ph_alpha_hanging", "ph_rolling_incline", "ph_shm_vmax", "ph_gauge_pressure", "ph_torricelli_range",
    # M (표현 선택·고정 문장)
    "ph_motion_diagram", "ph_fbd_choice", "ph_energy_bar_choice", "ph_collision_type",
    # 세트(2문항)
    "phs_vt_set",
]
STAGE_P1_FRQ = ["phf_mr_table_block", "phf_tbr_spring_shm", "phf_lab_spring_k", "phf_qqt_collision"]

# 2026-10-13 확장 원형(phys_p0_d / phys_p0_e) 단계 목록: phys-s2 부족분 생성의 후보 풀. 실제 실행 목록은 P1-a v2 결과를 본 뒤 동결 구성이 고른다.
STAGE_S2_U3 = ["ph_w_angle_force", "ph_net_work_speed", "ph_vert_spring_compress", "ph_pendulum_bottom", "ph_ux_force_graph", "ph_vt_work_energy", "ph_power_accel", "ph_fx_speed_graph", "ph_bounce_energy_loss",
               "ph_ramp_friction_energy", "ph_gravity_work_path", "ph_pt_graph_speed", "ph_spring_energy_graph", "ph_bars_statement", "ph_coaster_speed", "ph_proj_speed_height", "ph_pulley_energy",
               "ph_loop_release_height", "ph_power_efficiency", "ph_zero_work_cases", "ph_ramps_compare"]
STAGE_S2_OTHER = ["ph_xt_signs", "ph_three_stage_motion", "ph_contact_force_blocks", "ph_incline_pulley", "ph_push_angle_normal", "ph_crate_stop_distance", "ph_pt_slope_force", "ph_three_body_explosion", "ph_wall_bounce_impulse",
                  "ph_wt_angle_graph", "ph_rim_acceleration", "ph_net_torque_alpha", "ph_inertia_scaling", "ph_rot_kin_stop", "ph_flywheel_ke", "ph_torque_work_power", "ph_skater_ke_change", "ph_orbit_speed_ratio",
                  "ph_pendulum_moon", "ph_shm_signs", "ph_t2_m_graph", "ph_vertical_spring_period", "ph_xt_max_accel", "ph_density_weighing", "ph_hatch_force", "ph_buoyant_tension", "ph_bernoulli_height"]
STAGE_S2_SETS = ["phs_vt_set", "phs_collision_set", "phs_fx_set", "phs_wt_set", "phs_spring_set"]
