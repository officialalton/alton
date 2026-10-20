"""AP Statistics 연습 시험 3(2026-10-19 추가 라운드) 공유 자료 세트 2개(각 3문항). 기존 공개 세트(이항 확률분포 표, 컴퓨터 출력의 회귀 해석)와 틀이 다르다:
단원 2 = 이산 확률분포 표(사건 확률 · 기댓값 · 표준편차 해석), 단원 5 = 자료표 + 주어진 회귀직선(잔차 · 예측과 외삽 · 영향점 제거의 효과).
세트의 세 문항은 서로의 정답에 의존하지 않는다. 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def _member(arch, j, topic, skill, concept, steps, key, wrongs, rng, stem, how, judgment, est=85, facts=None, sig=None):
    p = mc(f"{arch}_q{j}", topic, skill, concept, steps, key, wrongs, rng, stem, how, judgment, None, None, est, facts, None, sig)
    p.pop("stimulus", None)
    return p


def _set_pack(arch, intro, stim, members, facts):
    return {"archetype": arch, "topic": members[0]["topic"], "skill": members[0]["skill"], "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": members,
            "set_size": len(members), "est_seconds": sum(m["est_seconds"] for m in members), "facts": facts}


# ======================= 세트 A (단원 2): 이산 확률분포 표 =======================
PD_CTX = [dict(sc="A delivery company records the number of late deliveries that a truck makes in one day.", var="late deliveries", unit1="late delivery", per="in a day", subj="truck"),
          dict(sc="A software team records the number of serious bugs that testers find in one module.", var="serious bugs", unit1="serious bug", per="in a module", subj="module")]


def st_set_pd_table(rng):
    c = pick(rng, PD_CTX)
    for _ in forever():
        raw = [rng.randint(8, 38) for _ in range(5)]
        tot = sum(raw)
        pr = [round(v / tot, 2) for v in raw]
        pr[0] = round(1 - sum(pr[1:]), 2)
        if abs(sum(pr) - 1) < 1e-9 and min(pr) >= 0.05 and len(set(pr)) == 5:
            break
    xs = list(range(5)); ex = sum(x * p for x, p in zip(xs, pr)); ex2 = sum(x * x * p for x, p in zip(xs, pr)); var = ex2 - ex * ex; sd = math.sqrt(var)
    # 독립 경로: 표를 10000 명의 합성 모집단으로 전개해 평균·표준편차 재계산
    pop = np.repeat(xs, [int(round(p * 10000)) for p in pr]); agree(pop.mean(), ex, tol=1e-3, name="mean"); agree(pop.std(), sd, tol=1e-3, name="sd")
    rows = [[str(x), f"{p:.2f}"] for x, p in zip(xs, pr)]
    stim = stat_stim(f"Probability distribution of X, the number of {c['var']} {c['per']}", "table", title=f"Probability distribution of X ({c['var']})", columns=["x", "P(X = x)"], rows=rows)
    intro = f"{c['sc']} Let $X$ be the number of {c['var']} for a randomly selected {c['subj']}. The probability distribution of $X$ is shown in the table."
    # Q1: 사건 확률(적어도 k / 많아야 k)
    atl = pick(rng, [True, False]); k = pick(rng, [2, 3]) if atl else pick(rng, [1, 2])
    ev = sum(pr[k:]) if atl else sum(pr[:k + 1])
    agree(ev, 1 - sum(pr[:k]) if atl else 1 - sum(pr[k + 1:]), tol=1e-9, name="event")
    off = sum(pr[k + 1:]) if atl else sum(pr[:k])
    comp = sum(pr[:k]) if atl else sum(pr[k + 1:])
    fmt = lambda v: f"${v:.2f}$"
    phrase = f"at least ${k}$" if atl else f"at most ${k}$"
    vals1 = [ev, off, comp, pr[k]]
    if not gaps_ok(vals1, 0.03):
        raise ValueError("q1_options_close")
    key1 = (fmt(ev), f"The probability of {phrase} adds the probabilities of the values that satisfy the event: ${ev:.2f}$.", round(ev, 2))
    wr1 = [(fmt(off), f"Leaves out the value ${k}$ itself, which is included in the event ({phrase}).", "boundary_excluded", round(off, 2), 1), (fmt(comp), "Gives the probability of the complement of the event.", "complement_given", round(comp, 2), 1), (fmt(pr[k]), f"Gives only the probability that $X = {k}$ instead of the probability of {phrase}.", "single_value", round(pr[k], 2), 1)]
    m1 = _member("st_set_pd_table", 1, "2.8", "3.C", "Find the probability of an event for a discrete random variable from its distribution table",
                 ["Identify the values of $X$ that satisfy the event, including or excluding the boundary value correctly", "Add the probabilities of those values from the table"],
                 key1, wr1, rng, f"What is the probability that $X$ is {phrase}? (Give the answer as a decimal rounded to two decimal places.)", "the probability is recomputed by adding the table entries and by the complement rule", ["representation_reading", "calculated_value_decision", "procedure_choice"], 80, [f"k={k}", f"atl={atl}"])
    # Q2: 평균
    unw = sum(xs) / 5; mode = xs[int(np.argmax(pr))]
    vals2 = [ex, unw, float(mode), ex2]
    if not gaps_ok([round(v, 2) for v in vals2], 0.05):
        raise ValueError("q2_options_close")
    key2 = (fmt(ex), f"The mean is the sum of each value times its probability: ${ex:.2f}$.", round(ex, 2))
    wr2 = [(fmt(unw), "Averages the possible values $0$ through $4$ without weighting them by their probabilities.", "unweighted_mean", round(unw, 2), 1), (fmt(mode), "Reports the most likely value of $X$, which is the mode and not the mean.", "mode_not_mean", round(float(mode), 2), 1), (fmt(ex2), "Weights the squares of the values by their probabilities, which is the mean of $X^2$.", "mean_of_squares", round(ex2, 2), 2)]
    m2 = _member("st_set_pd_table", 2, "2.9", "3.D", "Find the mean of a discrete random variable from its probability distribution",
                 ["Multiply each value of $X$ by its probability", "Add the products and distinguish the result from the unweighted average, the mode and the mean of the squares"],
                 key2, wr2, rng, "What is the mean (expected value) of $X$? (Give the answer as a decimal rounded to two decimal places.)", "the mean is recomputed from the table and from a synthetic population of 10000 individuals", ["procedure_choice", "calculated_value_decision", "interpretation"], 85, [f"ex={ex:.3f}"],
                 sig=(["expected value", "weighting by probabilities"], 1, "light"))
    # Q3: 표준편차 해석
    S = f"${sd:.2f}$"
    key3 = (f"A typical value of $X$ is about {S} away from the mean of ${ex:.2f}$ {c['var']}.", "The standard deviation measures the typical distance of the values of the variable from its mean.")
    wr3 = [(f"No {c['subj']} has a number of {c['var']} that differs from the mean by more than {S}.", "Treats the standard deviation as the largest possible distance from the mean; values can be farther away.", "max_deviation", None, 1),
           (f"The mean number of {c['var']} per {c['subj']} is {S}.", "Confuses the standard deviation with the mean; they are different summaries of the distribution.", "sd_as_mean", None, 1),
           (f"The average of the squared distances of the values from the mean is {S}.", "Describes the variance; the standard deviation is the square root of that average.", "variance_not_sd", None, 2)]
    m3 = _member("st_set_pd_table", 3, "2.9", "4.D", "Interpret the standard deviation of a discrete random variable in context",
                 ["Recall that the standard deviation describes the typical distance of the values from the mean", "Reject statements that treat it as a maximum, as a mean or as a variance"],
                 key3, wr3, rng, f"The standard deviation of $X$ is {S} {c['var']}. Which of the following is the correct interpretation of the standard deviation in this context?", "the standard deviation is recomputed from the table and from a synthetic population; the stated value equals it to two decimals", ["interpretation", "claim_justification"], 80, [f"sd={sd:.3f}"])
    return _set_pack("st_set_pd_table", intro, stim, [m1, m2, m3], [f"pr={pr}"])


# ======================= 세트 B (단원 5): 자료표 + 주어진 회귀직선, 영향점 =======================
LV_CTX = [dict(intro="A dispatcher records the distance and the delivery time for nine randomly selected delivery routes of a courier company.", x="Distance (km)", y="Delivery time (minutes)", xr=(4, 20), a=8.0, b=2.4, xu="kilometers", yu="minutes", xd="distance", yd="delivery time", sub="route"),
          dict(intro="A hiker records the elevation and the temperature at nine randomly selected points along a mountain trail.", x="Elevation (hundreds of meters)", y="Temperature (degrees Celsius)", xr=(4, 30), a=24.0, b=-0.62, xu="hundred meters", yu="degrees Celsius", xd="elevation", yd="temperature", sub="point")]


def st_set_reg_leverage(rng):
    c = pick(rng, LV_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        xs = np.sort(np.round(gen.uniform(c["xr"][0], c["xr"][1], 8), 0));
        if len(set(xs)) < 8:
            continue
        ys = np.round(c["a"] + c["b"] * xs + gen.normal(0, abs(c["b"]) * 1.6, 8), 1)
        xl = float(round(xs.max() + (c["xr"][1] - c["xr"][0]) * 0.6))
        trend = c["a"] + c["b"] * xl
        yl = round(trend - np.sign(c["b"]) * abs(c["b"]) * (c["xr"][1] - c["xr"][0]) * 0.55, 1)
        X = np.append(xs, xl); Y = np.append(ys, yl)
        b_all, a_all = np.polyfit(X, Y, 1); r_all = float(np.corrcoef(X, Y)[0, 1])
        b_wo, a_wo = np.polyfit(xs, ys, 1); r_wo = float(np.corrcoef(xs, ys)[0, 1])
        dr = abs(r_wo) - abs(r_all); db = abs(b_wo) - abs(b_all)
        if abs(dr) >= 0.04 and abs(db) / abs(b_all) >= 0.1 and abs(b_all) > 0.05 and abs(round(float(a_all), 2) + round(float(b_all), 3) * float(X[3]) - float(Y[3]) + 0.0) > 0.0:
            break
    # 독립 경로: 정규방정식
    sxx = ((X - X.mean()) ** 2).sum(); sxy = ((X - X.mean()) * (Y - Y.mean())).sum(); agree(sxy / sxx, b_all, tol=1e-8, name="slope")
    ar, br = round(float(a_all), 2), round(float(b_all), 3)
    rr = round(r_all, 2)
    rows = [[f"{int(x)}", f"{y:g}"] for x, y in zip(X, Y)]
    stim = stat_stim(f"Data on {c['xd']} and {c['yd']}", "table", title=f"{c['x'].split(' (')[0]} and {c['y'].split(' (')[0].lower()} of nine observations", columns=[c["x"], c["y"]], rows=rows)
    sgn = "+" if br >= 0 else "-"
    intro = f"{c['intro']} The table shown gives the data. The least-squares regression line for all nine observations is $\\hat{{y}} = {ar:g} {sgn} {abs(br):g}x$, where $x$ is the {c['xd']} and $\\hat{{y}}$ is the predicted {c['yd']}, and the correlation is $r = {rr}$."
    fm2 = lambda v: f"${v:.2f}$"
    # Q1: 잔차(중간 관측)
    i = 3; x0, y0 = float(X[i]), float(Y[i])
    yh = ar + br * x0; res = y0 - yh
    vals = [res, -res, y0 - br * x0, yh]
    if not gaps_ok([round(v, 2) for v in vals], 0.08) or abs((abs(res) * 100) % 1 - 0.5) < 0.12:
        raise ValueError("q1_close_or_tie")
    key1 = (fm2(res), f"The residual is the actual value minus the predicted value: ${y0:g} - ({yh:.2f}) = {res:.2f}$.", round(res, 2))
    wr1 = [(fm2(-res), "Subtracts in the wrong order; the residual is the actual value minus the predicted value.", "sign_reversed", round(-res, 2), 1), (fm2(y0 - br * x0), "Leaves the intercept out of the predicted value before subtracting.", "intercept_left_out", round(y0 - br * x0, 2), 2), (fm2(yh), "Reports the predicted value instead of the residual.", "prediction_not_residual", round(yh, 2), 2)]
    m1 = _member("st_set_reg_leverage", 1, "5.4", "3.B", "Calculate a residual for an observation from the table and the given line",
                 ["Find the predicted value from the line for the observation's x", "Subtract the predicted value from the actual value"],
                 key1, wr1, rng, f"What is the residual for the observation with {c['xd']} equal to ${x0:g}$ {c['xu']}? (Use the given line and round to two decimal places.)", "the predicted value and the residual are recomputed from the given coefficients and the table row", ["procedure_choice", "calculated_value_decision", "representation_reading"], 90, [f"x0={x0}"],
                 sig=(["predicted value from a line", "residual as actual minus predicted"], 1, "light"))
    # Q2: 예측과 외삽
    inside = pick(rng, [True, False])
    lo = float(xs.min())
    if inside:
        cand = [float(v) for v in range(int(lo) + 1, int(xs.max())) if float(v) not in set(float(t) for t in X)]
        if not cand:
            raise ValueError("no_inside_x")
        xn = pick(rng, cand)
    else:
        xn = float(round(xl + (c["xr"][1] - c["xr"][0]) * 0.35))
    inside = xn <= xl
    vp = ar + br * xn; vsw = br * xn
    if not gaps_ok([round(vp, 2), round(vsw, 2)], 0.2):
        raise ValueError("q2_close")
    rel = ("reasonable", f"within the range of the {c['xd']} values in the data, so the line is used between observed values") if inside else ("not reliable", f"outside the range of the {c['xd']} values in the data, so the prediction is an extrapolation")
    oth = ("not reliable", f"outside the range of the {c['xd']} values in the data, so the prediction is an extrapolation") if inside else ("reasonable", f"within the range of the {c['xd']} values in the data, so the line is used between observed values")
    T2 = lambda v, r_: f"The predicted {c['yd']} is ${v:.2f}$ {c['yu']}, and this prediction is {r_[0]}, because the {c['xd']} of ${xn:g}$ {c['xu']} is {r_[1].split('data, ')[0]}data, {r_[1].split('data, ')[1]}."
    key2 = (T2(vp, rel), f"Substituting ${xn:g}$ gives ${vp:.2f}$; the prediction is {rel[0]} because ${xn:g}$ is {'inside' if inside else 'beyond'} the observed range of ${lo:g}$ to ${xl:g}$.", None)
    wr2 = [(T2(vp, oth), f"Gets the predicted value right but misjudges its reliability: ${xn:g}$ is {'within' if inside else 'outside'} the range of the data.", "reliability_reversed", None, 2), (T2(vsw, rel), "Leaves the intercept out when substituting into the line, so the value is only the slope times the given value.", "intercept_left_out", None, 1), (T2(vsw, oth), "Leaves the intercept out of the prediction and also misjudges the reliability of the prediction.", "intercept_left_out_and_reversed", None, 1)]
    m2 = _member("st_set_reg_leverage", 2, "5.3", "3.B", "Predict a response from the line and judge whether the prediction is an extrapolation",
                 ["Substitute the given value into the line, including both the intercept and the slope term", "Compare the value with the range of the data to decide whether the prediction is an extrapolation"],
                 key2, wr2, rng, f"The line is used to predict the {c['yd']} of a {c['sub']} whose {c['xd']} is ${xn:g}$ {c['xu']}. Which of the following statements is correct?", "the prediction is recomputed from the given line and the range is read from the table, so the reliability follows from whether the value exceeds the largest observed x", ["procedure_choice", "calculated_value_decision", "claim_justification"], 100, [f"xn={xn}", f"inside={inside}"],
                 sig=(["predicted value from a line", "extrapolation"], 1, "light"))
    # Q3: 영향점 제거의 효과
    rd = "increase" if abs(r_wo) > abs(r_all) else "decrease"; sd_ = "increase" if abs(b_wo) > abs(b_all) else "decrease"
    combos = [(a_, b_) for a_ in ("increase", "decrease") for b_ in ("increase", "decrease")]
    desc = lambda a_, b_: f"The correlation would {a_} in strength and the slope would {b_} in size."
    key3 = (desc(rd, sd_), f"With the last observation removed, $|r|$ changes from ${abs(r_all):.2f}$ to ${abs(r_wo):.2f}$ and the size of the slope changes from ${abs(b_all):.3f}$ to ${abs(b_wo):.3f}$.")
    whys = {("increase", "increase"): "The correlation and the slope would both be larger in size when the last observation is removed.", ("increase", "decrease"): "The correlation would be larger in strength but the slope would be smaller in size.",
            ("decrease", "increase"): "The correlation would be weaker but the slope would be larger in size.", ("decrease", "decrease"): "The correlation would be weaker and the slope would be smaller in size."}
    def why3(a_, b_):
        parts_ = []
        if a_ != rd:
            parts_.append(f"the strength of the correlation goes from $|r| = {abs(r_all):.2f}$ to ${abs(r_wo):.2f}$, which is an {rd}, not a {a_}")
        if b_ != sd_:
            parts_.append(f"the size of the slope goes from ${abs(b_all):.3f}$ to ${abs(b_wo):.3f}$, which is an {sd_}, not a {b_}")
        return "Does not match the recalculated values: " + " and ".join(parts_) + "."
    wr3 = [(desc(a_, b_), why3(a_, b_), f"change_{a_}_{b_}", None, 1 + (i % 2)) for i, (a_, b_) in enumerate([x for x in combos if x != (rd, sd_)])]
    m3 = _member("st_set_reg_leverage", 3, "5.2", "4.D", "Judge how removing a high-leverage observation changes the correlation and the slope",
                 ["Notice that the last observation lies far to the right of the other observations and away from their trend", "Decide how removing it changes the strength of the correlation and the size of the slope, and match both changes to one option"],
                 key3, wr3, rng, f"The observation with the largest {c['xd']} is removed, and the least-squares line and the correlation are recalculated from the other eight observations. Which of the following describes the change?", "the line and correlation are recomputed with and without the last observation by two methods and the four combinations of changes are exhaustive, so one is true", ["interpretation", "claim_justification", "representation_reading"], 110, [f"rd={rd}", f"sd={sd_}"],
                 sig=(["influential point", "effect on correlation and slope"], 1, "none"))
    return _set_pack("st_set_reg_leverage", intro, stim, [m1, m2, m3], [f"a={ar}", f"b={br}", f"r={rr}"])


STAGE_SETS = ["st_set_pd_table", "st_set_reg_leverage"]

# 첫 세트 런(stats-r19-p3-b)에서 반려된 세트(범위 표기 오류·동점 잔차·일반적 오답 설명·기존 문항과 유사한 맥락)를 고친 뒤 다시 돌린다
STAGE_FIXSETS = ["st_set_reg_leverage"]
