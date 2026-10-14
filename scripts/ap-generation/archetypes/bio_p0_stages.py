"""AP Biology 파일럿·보충 단계 목록(2026-10-13). registry.py 가 STAGE_<이름> 을 bio_<이름> 으로 등록한다(AP_LIST=bio_p1_mc 등).
P1-a MC 파일럿 ≈ 22문항: 단독 18 + 세트 1(4문항). P1-b FRQ 파일럿: 6유형 각 1(공식 시험 구조 34점)."""
STAGE_P1_MC = [
    # 계산형(L) — 단원마다 1–2
    "bi_dehydration_count", "bi_sa_v_ratio", "bi_water_potential", "bi_enzyme_rate_calc", "bi_cell_cycle_time", "bi_chi_square", "bi_translation", "bi_hw_allele_freq", "bi_logistic", "bi_simpson",
    # 표·그래프·모형 읽기(M)
    "bi_transport_type", "bi_enzyme_inhibitor_data", "bi_pathway_mutant_table", "bi_mutation_effect", "bi_phylo_characters", "bi_selection_type", "bi_predator_prey_graph",
    # 개념형(B)과 P3 설계
    "bi_replication_enzymes", "bi_design_variable_enzyme", "bi_error_bars_overlap",
    # 세트(4문항)
    "bis_enzyme_set",
]
STAGE_P1_FRQ = ["bif_q1_inhibitor", "bif_q2_potato", "bif_q3_osmosis", "bif_q4_cyanide", "bif_q5_replication", "bif_q6_enzymeph"]
