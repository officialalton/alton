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
    return {"archetype": "frq_bio_investigation", "template": "short_scientific_investigation", "topic": "8.1", "extra_topics": [], "skill": "3.C", "calculator": "allowed", "title": f"Investigation of {s['org']}",
            "stimulus": stim, "parts": parts, "total_points": 4, "est_minutes": 8,
            "facts": [f"means={means}", f"se={se}", f"ctrl={ctrl}", f"tgt={tgt}", f"overlap_pairs={[(i,j) for i in range(3) for j in range(i+1,3) if overlap(i,j)]}"], "context": f"{s['org']} / {s['behavior']}"}
