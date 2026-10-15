"""AP Psychology 파일럿·본 실행 단계 목록(2026-10-14). registry.py 가 STAGE_<이름> 을 psych_<이름> 으로 등록한다(AP_LIST=psych_p1_mc 등).
P1 파일럿: 단원마다 개념·연구 방법 원형을 섞은 단독 문항 + 코드 계산 통계·자료 문항 + 대표 세트 5 + FRQ 2(AAQ·EBQ 각 1)."""
STAGE_P1_MC = [
    # 단원 1
    "ps_u1_nature_nurture", "ps_u1_lobes", "ps_u1_sleep_stages", "ps_u1_drug_action", "ps_r_corr_causation_brain",
    # 단원 2
    "ps_u2_gestalt", "ps_u2_algorithm_heuristic", "ps_u2_explicit_implicit", "ps_u2_interference", "ps_r_confound_forgetting",
    # 단원 3
    "ps_u3_classical_elements", "ps_u3_operant_basics", "ps_u3_parenting_styles", "ps_u3_cross_longitudinal", "ps_r_ethics_conditioning",
    # 단원 4
    "ps_u4_attribution_biases", "ps_u4_conformity_obedience", "ps_u4_defense_mechanisms", "ps_u4_persuasion", "ps_r_deception_debrief",
    # 단원 5
    "ps_u5_gas", "ps_u5_anxiety", "ps_u5_psychotherapies", "ps_u5_schizophrenia", "ps_r_therapy_placebo",
    # 코드 계산 통계·고정 자료 문항
    "ps_stat_mean", "ps_stat_median", "ps_stat_outlier", "ps_stat_percentile", "ps_stat_corr_r", "ps_stat_pvalue", "ps_data_conditioning", "ps_data_age_reaction",
    # 공유 세트(문항 3개)
    "pss_u1_caffeine", "pss_u2_spacing_spanish", "pss_u3_attachment_style", "pss_u4_bystander_lab", "pss_u5_cbt_trial",
]
STAGE_P1_FRQ = ["psf_aaq_retrieval", "psf_ebq_phones"]
