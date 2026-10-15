"""AP Psychology 고차 원형의 난이도 신호 선언(2026-10-15, psych-hard; AP Statistics S3 와 같은 방식, lib/ap-generation/stats-difficulty.ts).
이유: 난이도 라벨은 LLM 판정기(Sonnet)가 문항 겉모습만 보고 정하는데, 다단계 개념 문항도 "한 개념"이라며 basic_learning 이 된다(psych-hard-c 통과 23건 중 exam_prep 3건). 라벨을 올리는 규칙이 아니라
판정기가 못 보던 구조 사실(필수 단계 목록·결합 개념·자료 수·오답이 처음 틀어지는 단계)을 코드로 선언해 보여 준다. 결정적 게이트가 선언을 검증한다(단계마다 그 단계에서 틀어지는 오답이 있어야 한다 = 단계 부풀리기 방지).
FAILS[원형] = [변형 0 의 오답 3개가 처음 틀어지는 단계(오답 순서대로), 변형 1 의 …]. CONCEPTS[원형] = 한 문항에서 결합되는 서로 다른 CED 개념 2개. 판정 라벨과 구조 기준이 어긋나면 감사 표시만 남기고 라벨은 바꾸지 않는다."""

CONCEPTS = {
 "hd_r_design_fix": ["random assignment versus self-selection (confound)", "blinding of the person who scores outcomes"],
 "hd_r_correlation_claim": ["correlation does not show causation (third variable, direction)", "experimental design with random assignment"],
 "hd_r_placebo_double_blind": ["placebo control for expectations", "double-blind procedure for rater bias"],
 "hd_r_attrition_cohort": ["longitudinal versus cross-sectional design", "bias from attrition or cohort effects"],
 "hd_r_sampling_generalize": ["random assignment supports cause within a sample", "sampling limits how far findings generalize"],
 "hd_r_ethics_deception": ["institutional review and informed consent or assent", "deception, debriefing, and confidentiality"],
 "hd_r_opdef_validity": ["operational definition of a concept", "validity of a measure"],
 "hd_r_data_conclusion": ["random assignment and statistical significance support cause", "sample characteristics limit generalization"],
 "hd_r_replication": ["sample size and chance findings", "replication and operational definitions"],
 "hd_r_meta_effect": ["meta-analysis as a combination of studies", "effect size interpretation"],
 "hd_r_design_choice": ["matching a research design to a research goal", "limitations of that design"],
 "hd_c_synapse_drug": ["reuptake and receptor blocking at the synapse", "excitatory and inhibitory neurotransmitter effects"],
 "hd_c_brain_memory": ["brain structure function (hippocampus, amygdala)", "explicit versus implicit memory"],
 "hd_c_sleep_chain": ["melatonin and circadian timing of sleep", "sleep deprivation and REM rebound"],
 "hd_c_nervous_system": ["neuron types in a neural pathway", "sympathetic and parasympathetic divisions"],
 "hd_c_heredity_environment": ["twin and adoption evidence for heredity", "environmental contribution to a trait"],
 "hd_c_sensation_process": ["sensory adaptation and selective attention", "visual pathway and transduction"],
 "hd_c_study_plan": ["elaborative encoding and spaced practice", "retrieval practice"],
 "hd_c_retrieval_cues": ["context-dependent retrieval cues", "mood-congruent memory"],
 "hd_c_forgetting_chain": ["proactive and retroactive interference", "misinformation effect in eyewitness memory"],
 "hd_c_decision_bias": ["confirmation bias and overconfidence", "availability heuristic"],
 "hd_c_depth_cues": ["monocular depth cues", "Gestalt grouping principles"],
 "hd_c_intelligence_views": ["general ability versus specific abilities", "standardization and norms (Flynn effect)"],
 "hd_c_conditioning_chain": ["stimulus roles in classical conditioning", "generalization and biological predispositions"],
 "hd_c_operant_chain": ["type of reinforcement", "schedule of reinforcement and extinction"],
 "hd_c_cognitive_learning": ["vicarious reinforcement in observational learning", "latent learning and cognitive maps"],
 "hd_c_development_chain": ["Erikson's psychosocial stages and attachment", "parenting styles and caregiving patterns"],
 "hd_c_piaget_vygotsky": ["Piaget's stages and conservation", "Vygotsky's scaffolding and zone of proximal development"],
 "hd_c_attribution_chain": ["dispositional versus situational attribution", "actor-observer difference and cultural patterns"],
 "hd_c_social_influence": ["social facilitation and task difficulty", "group polarization"],
 "hd_c_persuasion_dissonance": ["cognitive dissonance reduction", "central and peripheral routes to persuasion"],
 "hd_c_personality_chain": ["reciprocal determinism and self-efficacy", "trait stability"],
 "hd_c_motivation_chain": ["arousal and performance", "intrinsic and extrinsic motivation"],
 "hd_c_stress_coping": ["stages of the general adaptation syndrome", "problem-focused and emotion-focused coping"],
 "hd_c_disorder_treatment": ["disorder category from described symptoms", "treatment approach for that category"],
 "hd_c_therapy_mechanism": ["therapy identified from its procedure", "learning principle or aim behind the therapy"],
 "hd_c_explanatory_style": ["pessimistic and optimistic explanatory style", "learned helplessness"],
 "hd_c_brain_imaging": ["requirement of a research question (timing or location)", "strengths of brain-imaging techniques"],
 "hd_c_hormones": ["hormones of hunger and fullness", "hormones of arousal and bonding"],
 "hd_c_memory_stages": ["sensory and short-term memory limits", "chunking as an encoding strategy"],
 "hd_c_group_influence": ["conformity and unanimity", "compliance techniques"],
 "hd_c_flow_wellbeing": ["flow (challenge matched to skill)", "biopsychosocial approach to disorders"],
 "hd_r_blinding": ["single-blind versus double-blind procedures", "expectancy bias that remains"],
 "hd_r_survey_bias": ["leading wording and nonresponse bias", "social desirability and unrepresentative samples"],
 "hd_r_generalize_culture": ["sample limits on generalization", "cross-cultural comparison and uncontrolled differences"],
 "hd_r_negative_corr": ["reading a negative correlation coefficient", "reverse causation and third variables"],
 "hd_c_neuron_signal": ["threshold and summation of inputs", "all-or-none action potential and myelin"],
 "hd_c_lobe_function": ["lobe functions (parietal, frontal, occipital)", "contralateral processing"],
 "hd_c_sleep_disorders": ["sleep disorder features", "effects of fragmented or disrupted sleep"],
 "hd_c_problem_obstacles": ["functional fixedness", "mental set"],
 "hd_c_language_rules": ["overregularization as evidence of rule learning", "stages of language development"],
 "hd_c_punishment_reinforcement": ["added versus removed stimulus", "reinforcement versus punishment"],
 "hd_c_piaget_processes": ["assimilation and accommodation", "object permanence in the sensorimotor stage"],
 "hd_c_emotion_culture": ["universal expressions and display rules", "cultural norms about showing emotion"],
 "hd_c_prejudice_chain": ["stereotype, prejudice, and discrimination", "in-group bias"],
 "hd_c_drug_treatment": ["reuptake blocking and receptor antagonism", "biomedical treatment"],
 "hd_r_ethics_animals": ["institutional review of animal research", "minimizing pain and humane care"],
}

# 변형 0, 변형 1 순서. 각 목록은 그 변형의 오답 3개가 처음 틀어지는 단계(오답 순서대로, 1-3).
FAILS = {
 "hd_r_design_fix": [[3, 1, 3], [2, 3, 3]], "hd_r_correlation_claim": [[2, 2, 3], [3, 2, 1]], "hd_r_placebo_double_blind": [[1, 1, 2], [1, 3, 2]],
 "hd_r_attrition_cohort": [[1, 3, 2], [1, 3, 2]], "hd_r_sampling_generalize": [[2, 1, 1], [2, 1, 3]], "hd_r_ethics_deception": [[2, 1, 1], [1, 2, 3]],
 "hd_r_opdef_validity": [[2, 3, 3], [2, 3, 3]], "hd_r_data_conclusion": [[3, 2, 1], [2, 3, 3]], "hd_r_replication": [[3, 3, 2], [1, 3, 3]],
 "hd_r_meta_effect": [[2, 1, 2], [1, 3, 1]], "hd_r_design_choice": [[2, 1, 2], [2, 2, 1]],
 "hd_c_synapse_drug": [[2, 1, 1], [1, 3, 1]], "hd_c_brain_memory": [[2, 3, 2], [1, 2, 2]], "hd_c_sleep_chain": [[1, 2, 3], [2, 1, 3]],
 "hd_c_nervous_system": [[2, 1, 2], [3, 1, 2]], "hd_c_heredity_environment": [[2, 3, 1], [1, 3, 3]], "hd_c_sensation_process": [[2, 1, 2], [2, 3, 3]],
 "hd_c_study_plan": [[1, 1, 2], [1, 3, 2]], "hd_c_retrieval_cues": [[1, 2, 3], [2, 2, 3]], "hd_c_forgetting_chain": [[3, 2, 2], [2, 2, 1]],
 "hd_c_decision_bias": [[2, 2, 3], [2, 2, 1]], "hd_c_depth_cues": [[3, 2, 3], [1, 1, 2]], "hd_c_intelligence_views": [[2, 1, 3], [3, 3, 1]],
 "hd_c_conditioning_chain": [[1, 3, 1], [1, 2, 1]], "hd_c_operant_chain": [[2, 1, 1], [1, 2, 1]], "hd_c_cognitive_learning": [[1, 3, 2], [1, 1, 2]],
 "hd_c_development_chain": [[1, 2, 1], [2, 2, 3]], "hd_c_piaget_vygotsky": [[2, 3, 1], [3, 3, 2]], "hd_c_attribution_chain": [[1, 2, 1], [1, 1, 3]],
 "hd_c_social_influence": [[3, 3, 2], [3, 3, 2]], "hd_c_persuasion_dissonance": [[3, 2, 3], [2, 1, 1]], "hd_c_personality_chain": [[3, 2, 3], [2, 1, 3]],
 "hd_c_motivation_chain": [[2, 3, 3], [3, 3, 2]], "hd_c_stress_coping": [[2, 2, 3], [1, 2, 1]], "hd_c_disorder_treatment": [[2, 1, 1], [1, 1, 2]],
 "hd_c_therapy_mechanism": [[2, 1, 1], [2, 3, 2]], "hd_c_explanatory_style": [[2, 1, 1], [2, 3, 3]],
 "hd_c_brain_imaging": [[2, 2, 3], [2, 2, 1]], "hd_c_hormones": [[1, 1, 2], [1, 2, 1]], "hd_c_memory_stages": [[3, 2, 3], [2, 2, 3]],
 "hd_c_group_influence": [[2, 2, 3], [3, 3, 1]], "hd_c_flow_wellbeing": [[2, 1, 1], [2, 3, 3]], "hd_r_blinding": [[2, 2, 1], [2, 3, 1]],
 "hd_r_survey_bias": [[2, 1, 2], [1, 1, 3]], "hd_r_generalize_culture": [[3, 2, 3], [2, 3, 3]], "hd_r_negative_corr": [[1, 1, 3], [1, 1, 3]],
 "hd_c_neuron_signal": [[1, 2, 3], [3, 1, 1]], "hd_c_lobe_function": [[2, 3, 2], [1, 3, 2]], "hd_c_sleep_disorders": [[1, 1, 3], [1, 1, 3]],
 "hd_c_problem_obstacles": [[2, 3, 3], [2, 2, 3]], "hd_c_language_rules": [[1, 2, 3], [2, 2, 3]], "hd_c_punishment_reinforcement": [[2, 1, 1], [1, 2, 1]],
 "hd_c_piaget_processes": [[3, 2, 1], [3, 2, 1]], "hd_c_emotion_culture": [[1, 3, 2], [2, 3, 3]], "hd_c_prejudice_chain": [[2, 3, 1], [3, 3, 1]],
 "hd_c_drug_treatment": [[1, 2, 1], [1, 2, 1]], "hd_r_ethics_animals": [[1, 2, 3], [2, 1, 3]],
}
# 표(자료)가 있는 변형 = 읽어야 할 자료 2(시나리오 문장 + 표)
TABLE_ARCHS = {"hd_r_data_conclusion"}

# 코드 계산 원형: 원형 -> (결합 개념 2, 오답 3개가 처음 틀어지는 단계(wr 순서), 읽어야 할 자료 수)
CODE_SIG = {
 "ps_hd_s_did": (["control group comparison", "pretest-posttest change"], [2, 1, 3], 2),
 "ps_hd_s_zcompare": (["standard scores (z) on different scales", "normal curve 68-95-99.7 rule"], [1, 3, 3], 2),
 "ps_hd_s_counts": (["percentages from counts", "bystander effect and diffusion of responsibility"], [3, 1, 2], 2),
 "ps_hd_s_placebo3": (["placebo effect", "comparison groups in treatment research"], [3, 2, 1], 2),
 "ps_hd_s_corr": (["sign versus strength of a correlation", "correlation does not show causation"], [2, 1, 3], 2),
 "ps_hd_s_skew": (["mean versus median", "skew from the mean-median gap"], [2, 2, 3], 2),
 "ps_hd_s_pvalue": (["statistical significance (p-value)", "effect size and sample size"], [2, 1, 1], 2),
 "ps_hd_s_reliab": (["reliability of a test", "predictive validity of a test"], [3, 2, 1], 2),
 "ps_hd_s_normal_count": (["standard deviations from the mean", "68-95-99.7 rule applied to a count"], [2, 2, 1], 1),
 "ps_hd_s_spacing": (["spacing effect", "comparing differences across delays"], [2, 2, 1], 2),
 "ps_hd_s_twins": (["concordance in twin studies", "heredity and environment"], [2, 3, 1], 2),
 "ps_hd_s_relative": (["percentage-point change", "relative percent change"], [3, 3, 1], 2),
 "ps_hd_s_twoway": (["effects of two independent variables", "random assignment in an experiment"], [2, 1, 1], 2),
}


def code_signals(arch, thinking, wr):
    """코드 계산 원형의 difficulty_signals(선언). wr = [(오답 문장, 설명) x 3]."""
    concepts, fails, reps = CODE_SIG[arch]
    return {"steps": list(thinking), "concepts": list(concepts), "representations": reps, "distractor_fail_step": {w[0]: f for w, f in zip(wr, fails)}, "arithmetic": "light"}
