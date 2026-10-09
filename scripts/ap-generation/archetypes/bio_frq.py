from common import *
from calc_ab_frq import row, part
from bp import frq_blueprint

SCEN = [
    {"org": "pill bugs (isopods)", "iv": "relative humidity of the chamber half", "levels": ["30%", "60%", "90%"], "ctrl": 1, "ctrl_why": "the standard laboratory humidity used as the reference condition", "dv": "number of pill bugs found in the test half of the chamber after 10 minutes (out of 20)", "unit": "pill bugs", "m0": 8.0, "eff": [-4.0, 0.0, 6.0], "sd": 2.2,
     "behavior": "kinesis or taxis"},
    {"org": "bean seedlings", "iv": "wavelength of light shone on one side of the shoot", "levels": ["white light (control)", "red light", "blue light"], "ctrl": 0, "ctrl_why": "unfiltered white light is the reference condition containing all wavelengths", "dv": "angle of stem curvature toward the light source after 24 hours", "unit": "degrees", "m0": 4.0, "eff": [0.0, 6.0, 38.0], "sd": 6.0,
     "behavior": "phototropism"},
    {"org": "zebrafish larvae", "iv": "water temperature", "levels": ["18 °C", "26 °C", "34 °C"], "ctrl": 1, "ctrl_why": "26 °C is the standard rearing temperature used as the reference condition", "dv": "swimming speed during a 1-minute observation", "unit": "mm per second", "m0": 11.0, "eff": [-5.0, 0.0, 4.5], "sd": 2.4, "behavior": "response to temperature"},
]

from bp import meaning as _meaning

def frq_bio_investigation(rng):
    s = rng.choice(SCEN); n = rng.choice([8, 10, 12])
    means = [round(s["m0"] + e + rng.uniform(-0.4, 0.4), 1) for e in s["eff"]]
    se = [round(s["sd"] / math.sqrt(n) * rng.uniform(0.85, 1.15), 1) for _ in means]
    ctrl = s["ctrl"]
    lo = [m - 2 * e for m, e in zip(means, se)]; hi = [m + 2 * e for m, e in zip(means, se)]
    def overlap(i, j): return not (hi[i] < lo[j] or hi[j] < lo[i])
    diffs = [(abs(means[i] - means[ctrl]), i) for i in range(3) if i != ctrl and not overlap(i, ctrl)]
    if not diffs: raise ValueError("no_clear_effect")
    tgt = max(diffs)[1]
    direction = "greater" if means[tgt] > means[ctrl] else "less"
    verb = "increases" if direction == "greater" else "decreases"
    claim = f"{s['levels'][tgt]} {verb} the {s['dv'].split(' after')[0].split(' during')[0]} compared with {s['levels'][ctrl]}"
    rows = [[s["levels"][i] + (" (control)" if i == ctrl and "(control)" not in s["levels"][i] else ""), f"{means[i]:.1f} ± {2*se[i]:.1f}", str(n)] for i in range(3)]
    stim = {"kind": "table", "description": f"Mean {s['dv']} (mean ± 2SE) for each group of {s['org']}", "data": {"columns": ["Group", f"Mean ({s['unit']}) ± 2SE", "Number of replicates"], "rows": rows}}
    iv_short = s["iv"]
    parts = [
        part("A", f"A student investigates how the {iv_short} affects the {s['org']}' response. Identify the independent variable in the investigation.", 1, "explain", ["3.C"], f"The independent variable is the {iv_short}.", [
            row("A1", 1, "Identifies the independent variable", [iv_short], opt=["the levels tested: " + ", ".join(s["levels"])])]),
        part("B", f"Identify the group that served as the control in the investigation, and explain why a control group is needed.", 1, "explain", ["3.C"], f"The control group was the {s['levels'][ctrl].replace(' (control)', '')} group, which provides a baseline for comparison.", [
            row("B1", 1, "Names the control group and states it provides a baseline/comparison for the effect of the variable", [f"{s['levels'][ctrl].replace(' (control)', '')}", "baseline for comparison"], both=True)]),
        part("C", "State a null hypothesis for the investigation.", 1, "explain", ["3.B"], f"There is no difference in the {s['dv'].split(' after')[0].split(' during')[0]} among the groups; the {iv_short} has no effect.", [
            row("C1", 1, "States no effect or no difference in the dependent variable among the groups", ["no difference", "no effect"], opt=["among the groups", "regardless of the " + iv_short.split(' of ')[0]])]),
        part("D", f"A student claims that {claim}. Using the data in the table, support the student's claim.", 1, "explain", ["6.B", "4.B"],
             f"{s['levels'][tgt]}: {means[tgt]:.1f} ± {2*se[tgt]:.1f} versus control {means[ctrl]:.1f} ± {2*se[ctrl]:.1f}; the ±2SE intervals do not overlap, so the difference is statistically supported.", [
            row("D1", 1, "Cites the group means and notes the error bars (±2SE) do not overlap (the difference is real)", [f"{means[tgt]:.1f}", f"{means[ctrl]:.1f}", "error bars do not overlap"], nums=True, both=True)])]
    for pt in parts: pt["topic_codes"] = ["8.1"]
    pk = {"archetype": "frq_bio_investigation", "template": "short_scientific_investigation", "topic": "8.1", "extra_topics": [], "skill": "3.C", "representative_skill": "3.C", "calculator": "allowed", "title": f"Investigation of {s['org']}",
            "stimulus": stim, "parts": parts, "total_points": 4, "est_minutes": 8,
            "facts": [f"means={means}", f"se={se}", f"ctrl={ctrl}", f"tgt={tgt}", f"overlap_pairs={[(i,j) for i in range(3) for j in range(i+1,3) if overlap(i,j)]}"], "context": f"{s['org']} / {s['behavior']}"}
    _meaning(pk, {"A1": {"elements": ["Names the factor the investigator deliberately varied (the independent variable), not the measured response"], "alt": ["the factor the experimenter deliberately changed", "the manipulated variable", iv_short], "err": ["names the measured response (dependent variable)", "names the organism"]},
               "B1": {"elements": ["Identifies the reference (baseline) group as the control", "Explains that it allows the effect of the independent variable to be isolated by comparison"], "alt": ["the group kept at the standard condition", "serves as a point of comparison so any change can be attributed to the variable"], "err": ["names a treated group as the control", "says a control makes the results larger or more reliable without a comparison"]},
               "C1": {"elements": ["States that the independent variable has no effect on (or no difference in) the measured response among the groups"], "alt": ["any differences among groups are due to chance", "the variable does not affect the response"], "err": ["states a predicted difference instead of no effect"]},
               "D1": {"elements": ["Uses the group means to show the difference from the control", "Uses the ±2SE intervals to argue the difference is unlikely to be due to chance"], "alt": ["the means differ by more than the variability", "the error bars are separated"], "err": ["cites the means but ignores the error bars", "claims the variable proves causation without comparing to the control"]}})
    pk["blueprint"] = frq_blueprint("frq_bio_investigation", "ap_biology", pk, "Experimental design: variables, control, null hypothesis, and data-supported claim",
        ["Identify the manipulated (independent) variable and the measured (dependent) variable", "Recognize which group is the control and why a baseline is needed", "State a null hypothesis and support a claim by comparing means with +/-2SE intervals"],
        [("One variable differs among groups; control group present; n replicates per group", "the table lists the groups, the control, and the number of replicates")], {"type": "experiment_table", "must_include": ["group names", "mean +/- 2SE", "replicates per group"]},
        "means and standard errors are generated from the scenario parameters; overlap of +/-2SE intervals is re-derived by the separate bio_checks module",
        extra={"experiment": {"fictional": True, "design": "experimental", "independent_variables": [s["iv"]], "dependent_variable": s["dv"], "controls": [s["levels"][ctrl] + " group"], "control_rationale": s["ctrl_why"], "replicates_per_group": n, "measurement": {"variable": s["dv"], "unit": s["unit"]},
                              "claims": [{"text": claim, "scope": "causation"}], "ced_topics_used": ["8.1"]}})
    return pk


# ---- 코드 우선 원형 2: 짧은 데이터 분석(공식 Q6형): 4×1점, 추세 서술 / 퍼센트 변화 계산 / 통계적으로 같은 쌍 판정 / 주장 뒷받침
CONCEPT_PH = "pH far from the enzyme's optimum changes the shape of the enzyme (denaturation), so the active site binds substrate less effectively"
CONCEPT_T = "temperature far from the enzyme's optimum reduces activity (too cold: fewer effective collisions; too hot: denaturation changes the active site)"
# 시나리오마다 두 수준 구성: spread(세 수준이 멀리 떨어짐 → ±2SE 범위가 겹치지 않음) / near(최적 근처 두 수준이 가까움 → 범위가 겹칠 수 있음). 통계 파트의 정답이 한쪽으로 치우치지 않게 한다.
DATA_SCEN = [  # 한 원형 = 한 토픽(3.2 효소 기능에 대한 환경 영향)
    {"sys": "an amylase-catalyzed reaction", "x": "pH", "dv": "initial reaction rate", "unit": "micromoles per minute", "topic": "3.2", "concept": CONCEPT_PH, "variants": {"spread": (["pH 4", "pH 7", "pH 10"], [6.0, 18.0, 9.0]), "near": (["pH 5", "pH 7", "pH 9"], [14.0, 18.0, 8.0])}},
    {"sys": "a catalase-catalyzed reaction", "x": "temperature", "dv": "oxygen released in 2 minutes", "unit": "milliliters", "topic": "3.2", "concept": CONCEPT_T, "variants": {"spread": (["10 °C", "37 °C", "70 °C"], [5.0, 16.0, 2.5]), "near": (["30 °C", "37 °C", "70 °C"], [14.5, 16.0, 2.5])}},
    {"sys": "a pepsin-catalyzed reaction", "x": "pH", "dv": "protein digested in 10 minutes", "unit": "milligrams", "topic": "3.2", "concept": CONCEPT_PH, "variants": {"spread": (["pH 2", "pH 7", "pH 12"], [14.0, 4.0, 1.5]), "near": (["pH 1", "pH 2", "pH 7"], [13.0, 14.0, 4.0])}},
]
def frq_bio_data_short(rng):
    """데이터형 v2: 파트마다 평가 목적을 분리한다 — A 표 해석(4.B), B 정량 분석(5.A), C 통계적 추론(5.B), D 생물학적 설명(6.B + 토픽 개념). 개념(효소 구조·활성)은 D 에서만 필요하다(키워드를 모든 파트에 넣지 않는다)."""
    sc0 = rng.choice(DATA_SCEN); variant = rng.choice(["spread", "near"]); levels, base = sc0["variants"][variant]; sc = {**sc0, "levels": levels, "base": base}; n = rng.choice([8, 10, 12])
    means = [round(b * rng.uniform(0.96, 1.04), 1) for b in sc["base"]]; se = [round(m * rng.uniform(0.04, 0.08), 2) for m in means]
    lo = [m - 2 * e for m, e in zip(means, se)]; hi = [m + 2 * e for m, e in zip(means, se)]
    ov = lambda i, j: not (hi[i] < lo[j] or hi[j] < lo[i])
    trend = "increases" if means[0] < means[1] < means[2] else ("decreases" if means[0] > means[1] > means[2] else "peaks" if means[1] > max(means[0], means[2]) else "dips")
    top = max(range(3), key=lambda i: means[i]); second = sorted([i for i in range(3) if i != top], key=lambda i: -means[i])[0]; low_i = [i for i in range(3) if i != top and i != second][0]
    d01 = (means[top] - means[low_i]) / means[low_i] * 100       # 정량 파트: 가장 낮은 수준 → 가장 높은 수준의 퍼센트 변화(항상 큰 변화)
    if abs(d01) < 20: raise ValueError("small_change")
    supported = not ov(top, second)                      # 최고 수준과 두 번째 수준의 차이가 ±2SE 범위로 지지되는가(범위 비중첩)
    stim = {"kind": "table", "description": f"Mean {sc['dv']} ({sc['unit']}) ± 2SE for {sc['sys']} at three levels of {sc['x']}. n = {n} replicates per level.", "data": {"columns": [sc["x"][0].upper() + sc["x"][1:] if sc["x"][:1].islower() and sc["x"][1:2].islower() else sc["x"], f"Mean ({sc['unit']}) ± 2SE", "n"], "rows": [[sc["levels"][i], f"{means[i]:.1f} ± {2*se[i]:.2f}", str(n)] for i in range(3)]}}
    L = sc["levels"]; claim = f"{sc['dv']} is greatest at {L[top]}"
    syn = {"increases": ["goes up as the level increases", "rises across the levels"], "decreases": ["goes down as the level increases", "falls across the levels"], "peaks": ["rises then falls", "highest at the middle level"], "dips": ["falls then rises", "lowest at the middle level"]}
    parts = [
        part("A", f"Describe how the {sc['dv']} changes across the three levels of {sc['x']}, and identify the level with the greatest {sc['dv']}. Use values from the table to support your description.", 1, "explain", ["4.B"], f"The {sc['dv']} {trend} across the levels ({', '.join(f'{m:.1f}' for m in means)}); it is greatest at {L[top]} ({means[top]:.1f}).", [row("A1", 1, "Describes the direction of change across all three levels, identifies the level with the greatest value, and cites table values", [trend])]),
        part("B", f"Calculate the percent change in the {sc['dv']} from {L[low_i]} to {L[top]}. Show your work.", 1, "calculate", ["5.A"], f"(({means[top]:.1f} - {means[low_i]:.1f}) / {means[low_i]:.1f}) x 100 = {d01:.1f}%.", [row("B1", 1, "Percent change with work shown (answer)", [f"{d01:.1f}%"], nums=True, tol=f"{abs(d01)*0.01:.2f}")]),
        part("C", f"Using the ±2SE values, determine whether the difference between the mean {sc['dv']} at {L[top]} and at {L[second]} is statistically supported. Justify your answer with the ±2SE ranges.", 1, "explain", ["5.B"], f"{L[top]}: {means[top]-2*se[top]:.2f} to {means[top]+2*se[top]:.2f}; {L[second]}: {means[second]-2*se[second]:.2f} to {means[second]+2*se[second]:.2f}. The ranges {'do not overlap, so the difference is supported' if supported else 'overlap, so the difference is not supported'}.", [row("C1", 1, "States whether the difference is supported and justifies it by comparing the ±2SE ranges of the two levels", [("supported" if supported else "not supported")])]),
        part("D", f"A student claims that {claim}. Use the data to support the claim, and explain a biological reason why the {sc['dv']} is lower at {L[low_i]} than at {L[top]}.", 1, "explain", ["6.B", "4.B"], f"The mean at {L[top]} ({means[top]:.1f} ± {2*se[top]:.2f}) is the highest; at {L[low_i]} the mean is {means[low_i]:.1f}. {sc['concept']}.", [row("D1", 1, "Supports the claim with data and explains the lower value by the effect of the condition on enzyme structure and function", [f"{means[top]:.1f}"])]),
    ]
    for pt in parts: pt["topic_codes"] = [sc["topic"]]
    for pt, pur, cn in zip(parts, ["table_interpretation", "quantitative_analysis", "statistical_reasoning", "biological_explanation"], [False, False, False, True]): pt["purpose"] = pur; pt["concept_needed"] = cn
    pk = {"archetype": "frq_bio_data_short", "template": "short_data_analysis", "topic": sc["topic"], "extra_topics": [], "skill": "4.B", "representative_skill": "4.B", "calculator": "allowed", "title": f"Data analysis: {sc['sys']}",
            "stimulus": stim, "parts": parts, "total_points": 4, "est_minutes": 10, "facts": [f"means={means}", f"se={se}", f"d01={d01}", f"top={top}", f"second={second}", f"supported={supported}", f"variant={variant}"], "context": sc["sys"],
            "expected_values": [{"part": "B", "quantity": "percent change", "value": round(d01, 1), "unit": "%", "tolerance": round(max(0.1, abs(d01) * 0.01), 2)}, {"part": "A", "quantity": f"greatest mean at {L[top]}", "value": means[top], "unit": sc["unit"], "tolerance": 0.05}]}
    _meaning(pk, {"A1": {"elements": ["Describes the direction of change of the mean across the three levels consistent with the data", "Identifies the level with the greatest mean and cites at least one table value"], "alt": syn[trend], "err": ["describes only one pair of levels", "describes a trend the data do not show", "names a level that is not the greatest"], "note": "Table interpretation (skill 4.B): no biology concept is required for this point."},
               "B1": {"elements": ["Computes the percent change correctly with a valid method (new minus old, divided by old, times 100)"], "alt": ["percent change = (new - old) / old x 100"], "err": ["divides by the new value", "forgets to multiply by 100"], "note": "Quantitative analysis (skill 5.A): award for the correct value with a valid method; equivalent forms and rounding within the tolerance are accepted. No biology concept is required.", "keep_nums": False},
               "C1": {"elements": ["Correctly states whether the difference between the two levels is statistically supported", "Justifies by comparing the ±2SE ranges of the two levels (overlap or separation)"], "alt": ["the ranges overlap so the difference is not supported" if not supported else "the ranges are separated so the difference is supported", "compares the mean ± 2SE intervals of the two levels"], "err": ["compares only the means", "states the wrong conclusion for the ranges"], "note": "Statistical reasoning (skill 5.B): no biology concept is required for this point."},
               "D1": {"elements": ["Supports the claim with data from the table (the highest mean compared with the others)", "Explains that a condition away from the optimum alters the enzyme's shape (active site), lowering activity"], "alt": ["the condition changes the enzyme's shape so substrate binds less well", "denaturation of the enzyme reduces the rate away from the optimum"], "err": ["cites the highest mean but gives no structural explanation", "attributes the change to the substrate running out"], "uses_concept": True, "note": "Biological explanation (skill 6.B and the topic 3.2 concept): this is the point that requires the enzyme concept. Award both elements for the point."}})
    pk["blueprint"] = frq_blueprint("frq_bio_data_short", "ap_biology", pk, "Data analysis: trend, percent change, statistical overlap, and a supported claim",
        ["Describe the trend across the three levels from the table values", "Compute a percent change between two means", "Use +/-2SE overlap to judge whether differences are supported and support a claim with the data"],
        [("Means with +/-2SE reported for the same number of replicates per level", "the table gives mean +/- 2SE and n")], {"type": "experiment_table", "must_include": ["levels of the variable", "mean +/- 2SE", "n"]},
        "percent change and interval overlap re-computed by the separate bio_checks module from the table strings",
        extra={"experiment": {"fictional": True, "design": "experimental", "independent_variables": [sc["x"]], "dependent_variable": sc["dv"], "controls": [], "control_not_applicable": "enzyme-rate comparison across levels of one condition; each level is measured under identical other conditions, no untreated reference group is claimed", "replicates_per_group": n, "measurement": {"variable": sc["dv"], "unit": sc["unit"]},
                              "claims": [{"text": claim, "scope": "causation"}], "ced_topics_used": [sc["topic"]]}})
    return pk
