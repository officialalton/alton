"""AP Statistics 연습 시험 4(2026-10-19 추가 라운드) 공유 자료 세트 2개(각 3문항). 기존 공개 세트(이항 확률분포 표, 컴퓨터 출력 회귀)와 연습 시험 3 세트(이산 분포 표, 자료표 + 주어진 직선)와 틀이 다르다:
단원 2 = 정규곡선 + 표본평균의 분포(한 값의 확률 · 표본평균의 표준편차 · 표본평균의 확률), 단원 5 = 두 회귀 모형의 요약표 비교(예측 · R^2 와 s 비교 · 잔차 형태로 모형 선택).
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


# ======================= 세트 A (단원 2): 정규곡선과 표본평균 =======================
NM_CTX = [dict(what="the weight of an apple", measure="weight", unit="grams", mu=(150, 190), sd=(12, 20), thing="apple", pl="apples", W="apples from an orchard"), dict(what="the time that a student needs to finish a quiz", measure="completion time", unit="minutes", mu=(24, 34), sd=(4, 7), thing="student", pl="students", W="students in a large course"),
          dict(what="the length of a bolt", measure="length", unit="millimeters", mu=(80, 100), sd=(2, 4), thing="bolt", pl="bolts", W="bolts from a factory")]


def st_set_normal_means(rng):
    c = pick(rng, NM_CTX)
    for _ in forever():
        mu = rng.randint(*c["mu"]); sd = rng.randint(*c["sd"]); n = rng.choice([16, 25, 36]); k = pick(rng, [-1.0, -0.5, 0.5, 1.0, 1.5])
        cut = mu + k * sd
        if abs(cut - round(cut)) < 1e-9 or True:
            cut = round(cut, 1)
        sem = sd / math.sqrt(n)
        z1 = (cut - mu) / sd; z2 = (cut - mu) / sem
        up = k > 0  # 질문은 항상 "cut 보다 큰 값" 확률(상위 꼬리)
        pa = 1 - ncdf(z1); pb = 1 - ncdf(z2)
        agree(pa, ss.norm.sf(cut, mu, sd), tol=1e-9, name="pa"); agree(pb, ss.norm.sf(cut, mu, sem), tol=1e-9, name="pb")
        vals = [pa, 1 - pa, pb, 2 * (1 - ncdf(abs(z1)))]
        if 0.05 < pa < 0.95 and 0.01 < pb < 0.99 and gaps_ok([round(v, 3) for v in vals], 0.04) and abs(pa - pb) > 0.06:
            break
    ticks = [round(mu + j * sd, 1) for j in range(-3, 4)]
    stim = stat_stim(f"Normal curve for {c['what']}", "curve", **normal_curve(mu, sd, ticks, f"{c['what'].capitalize()} ({c['unit']})", marks=[{"at": float(mu), "label": f"{mu}"}], z=False, title=f"Distribution of {c['what']}"))
    intro = f"The distribution of {c['what']} for {c['W']} is approximately normal with mean ${mu}$ {c['unit']} and standard deviation ${sd}$ {c['unit']}, as shown in the graph."
    P3 = lambda v: f"${v:.3f}$"
    key1 = (P3(pa), f"$z = ({cut:g} - {mu})/{sd} = {z1:.2f}$, and the probability of a value greater than ${cut:g}$ is $1 - \\Phi({z1:.2f}) \\approx {pa:.3f}$.", round(pa, 3))
    wr1 = [(P3(1 - pa), "Gives the probability of a value less than the cutoff instead of greater than it.", "wrong_tail", round(1 - pa, 3), 1), (P3(2 * (1 - ncdf(abs(z1)))), "Doubles the smaller tail area as for a two-sided region, but the question is about one side only.", "two_sided_area", round(2 * (1 - ncdf(abs(z1))), 3), 2), (P3(pb), "Uses the standard deviation of a sample mean in a question about a single value.", "uses_mean_distribution", round(pb, 3), 1)]
    m1 = _member("st_set_normal_means", 1, "2.11", "3.C", "Find the probability that a single value exceeds a cutoff from a normal model",
                 ["Standardize the cutoff using the mean and the standard deviation of the individual values", "Find the area of the upper tail of the standard normal distribution"],
                 key1, wr1, rng, f"What is the probability that a randomly selected {c['thing']} has a {c['measure']} greater than ${cut:g}$ {c['unit']}? (Give the answer as a decimal rounded to three decimal places.)", "the probability is recomputed with math.erf and with scipy's normal survival function", ["procedure_choice", "calculated_value_decision", "representation_reading"], 90, [f"mu={mu}", f"sd={sd}", f"cut={cut}"])
    # Q2
    f3 = lambda v: f"${v:.2f}$ {c['unit']}"
    wr_v = [(sd, "Reports the standard deviation of the individual values, which does not shrink with the sample size.", "population_sd", 1), (sd / n, f"Divides by ${n}$ instead of by $\\sqrt{{{n}}}$.", "divides_by_n", 2), (sd * math.sqrt(n), "Multiplies by the square root of the sample size, which would make the spread of the sample means larger.", "multiplies_by_root_n", 2)]
    vals2 = [sem] + [w[0] for w in wr_v]
    if not gaps_ok([round(v, 2) for v in vals2], 0.05):
        raise ValueError("q2_close")
    key2 = (f3(sem), f"The standard deviation of the sampling distribution of $\\bar x$ is $\\sigma/\\sqrt{{n}} = {sd}/\\sqrt{{{n}}} = {sem:.2f}$.", round(sem, 2))
    wr2 = [(f3(v), w, m_, round(v, 2), st) for v, w, m_, st in wr_v]
    m2 = _member("st_set_normal_means", 2, "2.12", "3.D", "Find the standard deviation of the sampling distribution of the sample mean",
                 ["Recall that the standard deviation of the sample mean is the population standard deviation divided by the square root of the sample size", "Substitute the given values and reject the unshrunk and wrongly scaled values"],
                 key2, wr2, rng, f"A random sample of ${n}$ {c['pl']} is selected from the population, and the sample mean is calculated. What is the standard deviation of the sampling distribution of the sample mean? (Round to two decimal places.)", "the standard deviation is recomputed as sigma over the square root of n", ["procedure_choice", "calculated_value_decision", "interpretation"], 80, [f"n={n}"],
                 sig=(["sampling distribution of a mean", "standard deviation of a sample mean"], 1, "light"))
    # Q3
    key3 = (P3(pb), f"The sample mean is approximately normal with mean ${mu}$ and standard deviation ${sem:.3f}$, so $z = ({cut:g} - {mu})/{sem:.3f} = {z2:.2f}$ and $P(\\bar x > {cut:g}) \\approx {pb:.3f}$.", round(pb, 3))
    wr3 = [(P3(pa), "Uses the standard deviation of the individual values, which gives the probability for one value instead of for a sample mean.", "individual_sd", round(pa, 3), 1), (P3(1 - pb), "Gives the probability of a sample mean less than the cutoff instead of greater than it.", "wrong_tail", round(1 - pb, 3), 2), (P3(2 * (1 - ncdf(abs(z2)))), "Doubles the smaller tail area as for a two-sided region, but the question is about one side only.", "two_sided_area", round(2 * (1 - ncdf(abs(z2))), 3), 2)]
    m3 = _member("st_set_normal_means", 3, "2.12", "3.C", "Find a probability for a sample mean from the normal model of its sampling distribution",
                 ["Describe the sampling distribution of the sample mean with its mean and its standard deviation", "Standardize the cutoff with that standard deviation and find the upper tail area"],
                 key3, wr3, rng, f"A random sample of ${n}$ {c['pl']} is selected. What is the probability that the mean {c['measure']} of the sample is greater than ${cut:g}$ {c['unit']}? (Give the answer as a decimal rounded to three decimal places.)", "the probability is recomputed with math.erf and with scipy's normal survival function for the standard deviation of the sample mean", ["procedure_choice", "calculated_value_decision", "interpretation"], 95, [f"n={n}"],
                 sig=(["sampling distribution of a mean", "normal probability"], 1, "light"))
    return _set_pack("st_set_normal_means", intro, stim, [m1, m2, m3], [f"mu={mu}", f"sd={sd}", f"n={n}", f"cut={cut}"])


# ======================= 세트 B (단원 5): 두 회귀 모형의 요약표 비교 =======================
MM_CTX = [dict(y="the selling price of a used car", yu="thousand dollars", x="the age of the car in years", xs_="age", xu="years", xr=(1, 12), sub="car", yd="selling price"), dict(y="the number of calories burned in a workout", yu="calories", x="the length of the workout in minutes", xs_="length", xu="minutes", xr=(10, 60), sub="workout", yd="number of calories burned"),
          dict(y="the monthly electricity bill of a household", yu="dollars", x="the household's monthly use in kilowatt-hours", xs_="monthly use", xu="kilowatt-hours", xr=(200, 900), sub="household", yd="monthly bill")]


def st_set_model_compare(rng):
    c = pick(rng, MM_CTX)
    for _ in forever():
        n = pick(rng, [24, 30, 36, 40])
        aA = round(rng.uniform(20, 40), 1); bA = round(rng.choice([-1, 1]) * rng.uniform(0.6, 2.2), 2) if c["xr"][1] <= 12 else round(rng.uniform(0.04, 0.2), 3)
        aB = round(aA + rng.uniform(-3, 3), 1); bB = round(bA * rng.uniform(0.85, 1.15), 3 if c["xr"][1] > 12 else 2)
        r2A = rng.choice([0.88, 0.90, 0.92, 0.94]); r2B = round(r2A - rng.choice([0.04, 0.05, 0.06]), 2)
        sA = round(rng.uniform(1.0, 2.2), 1); sB = round(sA + rng.uniform(0.3, 0.9), 1)
        x0 = rng.randint(c["xr"][0] + 1, c["xr"][1] - 1)
        yA = aA + bA * x0; yB = aB + bB * x0
        vals = [yA, yB, bA * x0, aA + bA]
        if gaps_ok([round(v, 2) for v in vals], 0.2) and r2A > r2B:
            break
    sa = "+" if bA >= 0 else "-"; sb = "+" if bB >= 0 else "-"
    EA = f"$\\hat y = {aA:g} {sa} {abs(bA):g}x$"; EB = f"$\\hat y = {aB:g} {sb} {abs(bB):g}x$"
    stim = stat_stim(f"Two regression models for {c['y']}", "table", title="Summary of two regression models", columns=["Model", "Equation", "R-squared", "S", "Residual plot"],
                     rows=[["Model A", f"y-hat = {aA:g} {sa} {abs(bA):g}x", f"{r2A * 100:.0f}%", f"{sA}", "Curved (U-shaped) pattern"], ["Model B", f"y-hat = {aB:g} {sb} {abs(bB):g}x", f"{r2B * 100:.0f}%", f"{sB}", "No pattern"]])
    intro = f"A researcher used data from ${n}$ randomly selected {c['sub']}s to build two regression models for predicting {c['y']} (in {c['yu']}) from {c['x']}. The table shown summarizes both models, where $x$ is {c['x']}."
    f2 = lambda v: f"${v:.2f}$ {c['yu']}"
    key1 = (f2(yA), f"Model A predicts ${aA:g} {sa} {abs(bA):g}({x0}) = {yA:.2f}$.", round(yA, 2))
    wr1 = [(f2(yB), "Uses the equation of Model B instead of the equation of Model A.", "wrong_model", round(yB, 2), 1), (f2(bA * x0), "Leaves the intercept out of the prediction.", "intercept_left_out", round(bA * x0, 2), 2), (f2(aA + bA), "Substitutes $x = 1$ instead of the given value of $x$.", "wrong_x", round(aA + bA, 2), 2)]
    m1 = _member("st_set_model_compare", 1, "5.4", "3.B", "Calculate a predicted value from one of two given regression equations",
                 ["Select the equation of Model A from the table", "Substitute the given value of x into the equation, using both the intercept and the slope term"],
                 key1, wr1, rng, f"What does Model A predict for the {c['yd']} of a {c['sub']} whose {c['xs_']} is ${x0}$ {c['xu']}? (Round to two decimal places.)", "the prediction is recomputed from the coefficients in the table and the three wrong values are the named slips", ["procedure_choice", "calculated_value_decision", "representation_reading"], 85, [f"x0={x0}"],
                 sig=(["predicted value", "reading a summary table"], 1, "light"))
    key2 = (f"Model A explains a larger percent of the variation in {c['yd']} (${r2A * 100:.0f}\\%$ compared with ${r2B * 100:.0f}\\%$), and its predictions are typically closer to the actual values ($S = {sA}$ compared with ${sB}$).", "A larger R-squared means more of the variation is explained by the linear model, and a smaller S means that the actual values typically differ less from the predictions.")
    wr2 = [(f"Model B explains a larger percent of the variation in {c['yd']} than Model A, and its predictions are typically closer to the actual values.", "Reverses the comparison: Model A has the larger R-squared and the smaller $S$ in the table.", "models_reversed", None, 1),
           (f"Model A explains a larger percent of the variation in {c['yd']}, but its predictions are typically farther from the actual values than those of Model B.", "A larger R-squared goes with a smaller $S$ here; the table shows Model A with the smaller $S$, so its predictions are typically closer.", "s_misread", None, 2),
           (f"The two models explain the same percent of the variation in {c['yd']}, because both use the same variables.", "Using the same variables does not give the same R-squared; the table shows different values.", "same_variables_same_fit", None, 1)]
    m2 = _member("st_set_model_compare", 2, "5.5", "4.A", "Compare two regression models by R-squared and S from a summary table",
                 ["Read R-squared and S for both models in the table", "State which model has the larger percent of variation explained and which has the typically smaller prediction errors"],
                 key2, wr2, rng, "Which of the following statements about the two models is supported by the values of R-squared and $S$ in the table?", "each statement is checked against the R-squared and S values that are generated so that Model A has the larger R-squared and the smaller S", ["representation_reading", "interpretation", "claim_justification"], 90, [f"r2A={r2A}", f"r2B={r2B}"])
    key3 = ("Model B, because the residual plot for Model A has a curved pattern while the residual plot for Model B has no pattern.", "An appropriate linear model leaves residuals with no pattern; a curved pattern in the residuals shows that a linear model is not appropriate even when R-squared is large.")
    wr3 = [(f"Model A, because it has the larger R-squared and the smaller $S$, so its predictions are typically closer to the actual values.", "Judges the models by R-squared and $S$ alone; a curved pattern in a residual plot shows that the linear model is not appropriate.", "r2_only", None, 1),
           ("Neither model, because the residual plots show that the data cannot be modeled with a line.", "Model B's residual plot has no pattern, which supports a linear model; only Model A's residual plot shows a problem.", "neither_model", None, 2),
           ("Both models are equally appropriate, because both use a straight line.", "A straight-line model can be inappropriate; the residual plot shows whether the line describes the relationship.", "straight_line_enough", None, 1)]
    m3 = _member("st_set_model_compare", 3, "5.4", "4.D", "Choose a regression model using the pattern in the residual plot",
                 ["Read the description of each residual plot in the table", "Choose the model whose residuals show no pattern and explain why a curved pattern is a problem even when R-squared is large"],
                 key3, wr3, rng, "Which model is more appropriate for describing the relationship, and why?", "the residual pattern of each model is stated in the table and Model A is generated with the curved pattern and the larger R-squared so the choice depends on the pattern", ["claim_justification", "representation_reading", "interpretation"], 95, ["pattern=A_curved"],
                 sig=(["residual plot pattern", "R-squared and model choice"], 1, "none"))
    return _set_pack("st_set_model_compare", intro, stim, [m1, m2, m3], [f"aA={aA}", f"bA={bA}", f"x0={x0}"])


STAGE_SETS = ["st_set_normal_means", "st_set_model_compare"]
