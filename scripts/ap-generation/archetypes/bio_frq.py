from common import *
from calc_ab_frq import row, part

SCEN = [
    {"org": "pill bugs (isopods)", "iv": "relative humidity of the chamber half", "levels": ["30%", "60%", "90%"], "ctrl": 1, "dv": "number of pill bugs found in the test half of the chamber after 10 minutes (out of 20)", "unit": "pill bugs", "m0": 8.0, "eff": [-4.0, 0.0, 6.0], "sd": 2.2,
     "behavior": "kinesis or taxis"},
    {"org": "bean seedlings", "iv": "wavelength of light shone on one side of the shoot", "levels": ["no light (dark)", "red light", "blue light"], "ctrl": 0, "dv": "angle of stem curvature toward the light source after 24 hours", "unit": "degrees", "m0": 4.0, "eff": [0.0, 6.0, 38.0], "sd": 6.0,
     "behavior": "phototropism"},
    {"org": "zebrafish larvae", "iv": "water temperature", "levels": ["18 °C", "26 °C", "34 °C"], "ctrl": 1, "dv": "mean swimming speed during a 1-minute observation", "unit": "mm per second", "m0": 11.0, "eff": [-5.0, 0.0, 4.5], "sd": 2.4, "behavior": "response to temperature"},
]

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
    rows = [[s["levels"][i] + (" (control)" if i == ctrl else ""), f"{means[i]:.1f} ± {2*se[i]:.1f}", str(n)] for i in range(3)]
    stim = {"kind": "table", "description": f"Mean {s['dv']} (mean ± 2SE) for each group of {s['org']}", "data": {"columns": ["Group", f"Mean ({s['unit']}) ± 2SE", "Number of replicates"], "rows": rows}}
    iv_short = s["iv"]
    parts = [
        part("A", f"A student investigates how the {iv_short} affects the {s['org']}' response. Identify the independent variable in the investigation.", 1, "explain", ["3.C"], f"The independent variable is the {iv_short}.", [
            row("A1", 1, "Identifies the independent variable", [iv_short], opt=["the levels tested: " + ", ".join(s["levels"])])]),
        part("B", f"Identify the group that served as the control in the investigation, and explain why a control group is needed.", 1, "explain", ["3.C"], f"The control group was the {s['levels'][ctrl]} group, which provides a baseline for comparison.", [
            row("B1", 1, "Names the control group and states it provides a baseline/comparison for the effect of the variable", [f"{s['levels'][ctrl]}", "baseline for comparison"], both=True)]),
        part("C", "State a null hypothesis for the investigation.", 1, "explain", ["3.B"], f"There is no difference in the {s['dv'].split(' after')[0].split(' during')[0]} among the groups; the {iv_short} has no effect.", [
            row("C1", 1, "States no effect or no difference in the dependent variable among the groups", ["no difference", "no effect"], opt=["among the groups", "regardless of the " + iv_short.split(' of ')[0]])]),
        part("D", f"A student claims that {claim}. Using the data in the table, support the student's claim.", 1, "explain", ["6.B", "4.B"],
             f"{s['levels'][tgt]}: {means[tgt]:.1f} ± {2*se[tgt]:.1f} versus control {means[ctrl]:.1f} ± {2*se[ctrl]:.1f}; the ±2SE intervals do not overlap, so the difference is statistically supported.", [
            row("D1", 1, "Cites the group means and notes the error bars (±2SE) do not overlap (the difference is real)", [f"{means[tgt]:.1f}", f"{means[ctrl]:.1f}", "error bars do not overlap"], nums=True, both=True)])]
    for pt in parts: pt["topic_codes"] = ["8.1"]
    return {"archetype": "frq_bio_investigation", "template": "short_scientific_investigation", "topic": "8.1", "extra_topics": [], "skill": "3.C", "representative_skill": "3.C", "calculator": "allowed", "title": f"Investigation of {s['org']}",
            "stimulus": stim, "parts": parts, "total_points": 4, "est_minutes": 8,
            "facts": [f"means={means}", f"se={se}", f"ctrl={ctrl}", f"tgt={tgt}", f"overlap_pairs={[(i,j) for i in range(3) for j in range(i+1,3) if overlap(i,j)]}"], "context": f"{s['org']} / {s['behavior']}"}


# ---- 코드 우선 원형 2: 짧은 데이터 분석(공식 Q6형): 4×1점, 추세 서술 / 퍼센트 변화 계산 / 통계적으로 같은 쌍 판정 / 주장 뒷받침
DATA_SCEN = [
    {"sys": "an enzyme-catalyzed reaction", "x": "pH", "levels": ["pH 4", "pH 7", "pH 10"], "dv": "initial reaction rate", "unit": "micromoles per minute", "base": [6.0, 18.0, 9.0], "topic": "3.2", "topic_title": "environmental impacts on enzyme function"},
    {"sys": "yeast populations", "x": "sugar concentration", "levels": ["0.5%", "2%", "8%"], "dv": "carbon dioxide produced in 20 minutes", "unit": "milliliters", "base": [4.0, 11.0, 19.0], "topic": "3.5", "topic_title": "cellular respiration"},
    {"sys": "tomato plants", "x": "daily light exposure", "levels": ["4 hours", "10 hours", "16 hours"], "dv": "dry biomass per plant", "unit": "grams", "base": [3.1, 7.4, 12.2], "topic": "3.7", "topic_title": "photosynthesis"},
]
def frq_bio_data_short(rng):
    sc = rng.choice(DATA_SCEN); n = rng.choice([8, 10, 12])
    means = [round(b * rng.uniform(0.92, 1.08), 1) for b in sc["base"]]; se = [round(m * rng.uniform(0.03, 0.07), 2) for m in means]
    lo = [m - 2 * e for m, e in zip(means, se)]; hi = [m + 2 * e for m, e in zip(means, se)]
    ov = lambda i, j: not (hi[i] < lo[j] or hi[j] < lo[i])
    pairs = [(i, j) for i in range(3) for j in range(i + 1, 3)]; same = [(i, j) for i, j in pairs if ov(i, j)]
    if len(same) > 1: raise ValueError("ambiguous_overlap_pattern")
    d01 = (means[1] - means[0]) / means[0] * 100
    if abs(d01) < 20: raise ValueError("small_change")
    trend = "increases" if means[0] < means[1] < means[2] else ("decreases" if means[0] > means[1] > means[2] else "peaks" if means[1] > max(means[0], means[2]) else "dips")
    stim = {"kind": "table", "description": f"Mean {sc['dv']} ({sc['unit']}) ± 2SE for {sc['sys']} at three levels of {sc['x']}", "data": {"columns": [sc["x"].capitalize(), f"Mean ({sc['unit']}) ± 2SE", "n"], "rows": [[sc["levels"][i], f"{means[i]:.1f} ± {2*se[i]:.2f}", str(n)] for i in range(3)]}}
    same_txt = "none of the pairs" if not same else f"{sc['levels'][same[0][0]]} and {sc['levels'][same[0][1]]}"
    top = max(range(3), key=lambda i: means[i]); claim = f"{sc['dv']} is greatest at {sc['levels'][top]}"
    others = [i for i in range(3) if i != top]; nonover = all(not ov(top, i) for i in others)
    parts = [
        part("A", f"Based on the data, describe the relationship between {sc['x']} and the {sc['dv']} across the three levels.", 1, "explain", ["4.B"], f"The {sc['dv']} {trend} across the levels ({', '.join(f'{m:.1f}' for m in means)}).", [row("A1", 1, "Describes the trend using the values (or direction) from the table", [trend, *[f"{m:.1f}" for m in means]], both=True, nums=True)]),
        part("B", f"Calculate the percent change in the mean {sc['dv']} from {sc['levels'][0]} to {sc['levels'][1]}. Show your work.", 1, "calculate", ["5.A"], f"(({means[1]:.1f} - {means[0]:.1f}) / {means[0]:.1f}) x 100 = {d01:.1f}%", [row("B1", 1, "Percent change with work shown (answer)", [f"{d01:.1f}%"], nums=True, tol=f"{d01-0.6:.1f} to {d01+0.6:.1f}")]),
        part("C", f"Using the error bars (±2SE), identify the pair of levels, if any, for which the mean {sc['dv']} is not statistically different.", 1, "explain", ["5.B"], f"Answer: {same_txt}.", [row("C1", 1, "Identifies the pair whose ±2SE intervals overlap (or states none) (answer)", [same_txt], nums=True)]),
        part("D", f"A student claims that {claim}. Use the data to support the claim and describe what the error bars indicate about it.", 1, "explain", ["6.B", "4.B"], f"{means[top]:.1f} ± {2*se[top]:.2f} at {sc['levels'][top]} is higher than the other levels; the ±2SE intervals {'do not overlap' if nonover else 'overlap for at least one other level, so the claim is only partly supported'}.", [row("D1", 1, "Cites the highest mean and states what the non-overlap/overlap of error bars shows (support)", [f"{means[top]:.1f}", "do not overlap" if nonover else "overlap"], both=True, nums=True)])]
    for pt in parts: pt["topic_codes"] = [sc["topic"]]
    return {"archetype": "frq_bio_data_short", "template": "short_data_analysis", "topic": sc["topic"], "extra_topics": [], "skill": "4.B", "representative_skill": "4.B", "calculator": "allowed", "title": f"Data analysis: {sc['sys']}",
            "stimulus": stim, "parts": parts, "total_points": 4, "est_minutes": 10, "facts": [f"means={means}", f"se={se}", f"d01={d01}", f"overlapping_pairs={same}", f"top={top}"], "context": sc["sys"]}
