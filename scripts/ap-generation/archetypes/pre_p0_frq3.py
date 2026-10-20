"""AP Precalculus FRQ 원형 3차 — Function Concepts(fc) 시나리오 2개 추가(4세트 이상에 fc 4개 이상 필요). 구조·검증은 pre_p0_frq.py 와 같다."""
from pre_common import *
from pre_common import _O
from calc_ab_frq import part
from pre_p0_frq import R, _ev, _pack, _txt

PI = sp.pi
STAGE_FRQ3 = ["pref_fc_sin_harbor", "pref_fc_exp_decay_context", "pref_mp_tide_depth", "pref_mp_spring_cos", "pref_mp_daylight", "pref_mp_body_temperature"]


@retry_sep
def pref_fc_sin_harbor(rng):
    for _ in forever():
        a = pick(rng, [10, 12, 15]); b = pick(rng, [3, 4, 5]); P = 12; w = 2 * math.pi / P; f = lambda t_: a + b * math.sin(w * t_)  # noqa: E731
        t1, t2 = 1, 4; roc = (f(t2) - f(t1)) / (t2 - t1); k = a + b * pick(rng, [0.4, 0.6]); thr = a + b * 0.5
        first = math.asin((k - a) / b) / w; chk = _O.brentq(lambda v: f(v) - k, 0, P / 4, xtol=1e-12); agree(first, chk, 1e-8, "t")
        rts = solve_all(lambda v: f(v) - thr, 0, P, 20000)
        if len(rts) == 2 and abs(roc) > 0.3 and 0.2 < first < 2.9:
            break
    dur = rts[1] - rts[0]
    stim = _txt(f"The depth of water at a dock, in feet, at time $t$ hours after midnight is modeled by $D(t)={a}+{b}\\sin\\left(\\dfrac{{\\pi}}{{6}}t\\right)$ for $0\\le t\\le 12$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find the average rate of change of $D$ over the interval ${t1}\\le t\\le {t2}$. Using correct units, interpret the meaning of your answer in the context of the problem.", 2, "calculate", ["1", "2"], f"$\\dfrac{{D({t2})-D({t1})}}{{{t2 - t1}}}\\approx{roc:.3f}$ feet per hour.", [R("A1", "Average rate of change value", [f"{roc:.3f}"], nums=True, tol="±0.001"), R("A2", "Interpretation with units: average change in depth per hour over the interval", ["feet per hour", "average change in depth"], units=True)]),
        part("B", f"Find the first time $t>0$ at which the depth is ${k:g}$ feet.", 2, "calculate", ["1", "2"], f"Solving $D(t)={k:g}$ gives $t\\approx{first:.3f}$ hours.", [R("B1", "Equation setting the model equal to the depth", [f"D(t)={k:g}"]), R("B2", "Solution value of the first time", [f"{first:.3f}"], requires="B1", nums=True, tol="±0.01", units=True)]),
        part("C", f"For how many hours during $0\\le t\\le 12$ is the depth greater than ${thr:g}$ feet?", 1, "calculate", ["1"], f"The depth crosses ${thr:g}$ feet at $t\\approx{rts[0]:.3f}$ and $t\\approx{rts[1]:.3f}$, so the duration is about {dur:.3f} hours.", [R("C1", "Duration value with units", [f"{dur:.3f}"], nums=True, tol="±0.01", units=True)]),
        part("D", "What is the period of $D$, and what does it mean in the context of the problem?", 1, "explain", ["3"], "The period is 12 hours: the depth pattern repeats every 12 hours.", [R("D1", "States the period of 12 hours and that the depth pattern repeats every 12 hours", ["12 hours", "pattern repeats"])]),
    ]
    return _pack("pref_fc_sin_harbor", "fc", "3.7", ["3.4", "3.10", "1.2"], "2", "required", "Dock water depth modeled by a sinusoidal function", stim, parts, 17,
                 [f"a={a}", f"b={b}", f"t1={t1}", f"t2={t2}", f"k={k:g}", f"thr={thr:g}", f"roc={roc:.4f}", f"first={first:.4f}", f"r0={rts[0]:.4f}", f"r1={rts[1]:.4f}", f"dur={dur:.4f}", "P=12"],
                 [_ev("A", "average rate of change", roc, 0.001, "ft/h"), _ev("B", "first time", first, 0.01, "h"), _ev("C", "duration", dur, 0.01, "h")],
                 ("A sinusoidal model analyzed with a graphing calculator: rate of change, solving for a time, a duration and the period", ["Compute the average rate of change from two function values in radian mode", "Solve for the time and the duration from the graph", "Interpret the period"], [("t is between 0 and 12", "the stem states 0 <= t <= 12")], {"type": "text", "must_include": ["the model D(t)"]},
                  "floating-point evaluation versus exact trigonometric evaluation; brentq recomputes the solution times"), ["symbolic_reasoning", "representation_reading", "justification"])


@retry_sep
def pref_fc_exp_decay_context(rng):
    for _ in forever():
        a = pick(rng, [60, 80, 100]); b = pick(rng, [0.82, 0.88, 0.9]); c = pick(rng, [20, 25, 30]); f = lambda t_: a * b ** t_ + c  # noqa: E731
        k = c + pick(rng, [8, 10, 12]); t0 = pick(rng, [3, 5]); tk = math.log((k - c) / a) / math.log(b); chk = _O.brentq(lambda v: f(v) - k, 0, 400, xtol=1e-12); agree(tk, chk, 1e-8, "t")
        t1, t2 = 2, 8; roc = (f(t2) - f(t1)) / (t2 - t1)
        if 2 < tk < 60:
            break
    stim = _txt(f"The temperature of a cup of tea, in degrees Celsius, $t$ minutes after it is poured is modeled by $T(t)={a}\\cdot ({b})^t+{c}$ for $t\\ge 0$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find $T({t0})$.", 1, "calculate", ["1"], f"$T({t0})={a}\\cdot ({b})^{{{t0}}}+{c}\\approx{f(t0):.3f}$ degrees Celsius.", [R("A1", "Value of the function with units", [f"{f(t0):.3f}"], nums=True, tol="±0.001", units=True)]),
        part("B", f"Find the average rate of change of $T$ over the interval ${t1}\\le t\\le {t2}$, and use its sign to describe how the temperature changes on the interval.", 2, "calculate", ["1", "3"], f"$\\dfrac{{T({t2})-T({t1})}}{{{t2 - t1}}}\\approx{roc:.3f}$ degrees per minute; the negative value means the temperature decreases on average.", [R("B1", "Average rate of change value", [f"{roc:.3f}"], nums=True, tol="±0.001"), R("B2", "Uses the sign to state that the temperature is decreasing on average", ["negative", "decreasing"])]),
        part("C", f"At what time $t$ is the temperature of the tea ${k}$ degrees Celsius?", 2, "calculate", ["1", "2"], f"Solving $T(t)={k}$ gives $t\\approx{tk:.3f}$ minutes.", [R("C1", "Equation setting the model equal to the temperature", [f"T(t)={k}"]), R("C2", "Solution value of the time", [f"{tk:.3f}"], requires="C1", nums=True, tol="±0.01", units=True)]),
        part("D", "As $t$ increases without bound, what value does $T(t)$ approach, and what does it mean in the context of the problem?", 1, "explain", ["3"], f"$T(t)$ approaches {c} degrees Celsius, the temperature of the room that the tea cools toward.", [R("D1", f"States the value {c} and interprets it as the temperature the tea approaches", [f"{c}", "approaches"])]),
    ]
    return _pack("pref_fc_exp_decay_context", "fc", "2.5", ["2.13", "2.3", "1.2"], "1", "required", "Tea temperature modeled by a shifted exponential function", stim, parts, 17,
                 [f"a={a}", f"b={b}", f"c={c}", f"t0={t0}", f"t1={t1}", f"t2={t2}", f"k={k}", f"v0={f(t0):.4f}", f"roc={roc:.4f}", f"tk={tk:.4f}"],
                 [_ev("A", "T(t0)", f(t0), 0.001, "C"), _ev("B", "average rate of change", roc, 0.001, "C/min"), _ev("C", "time", tk, 0.01, "min"), _ev("D", "limit", c, 0.001, "C")],
                 ("A shifted exponential model: evaluation, rate of change with its sign, solving for time and the horizontal asymptote", ["Evaluate the model", "Interpret the sign of an average rate of change", "Solve for the time and interpret the horizontal asymptote"], [("t is at least 0", "the stem states t >= 0")], {"type": "text", "must_include": ["the model T(t)"]},
                  "floating-point evaluation versus exact evaluation; closed-form logarithm and brentq recompute the time"), ["symbolic_reasoning", "representation_reading", "justification"])
