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
