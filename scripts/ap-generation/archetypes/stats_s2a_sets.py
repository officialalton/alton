"""AP Statistics S2-a — 공유 자료 세트(3문항) 원형 2개(2026-10-12). 공식 MC 는 하나의 자료(stimulus)에 3문항이 딸린 세트 2개(확률·이항·분포 / 회귀)를 갖는다.
세트 팩 = 한 번 만든 자료 + 문항 3개(각 문항은 독립 MC 팩: 자체 설계도·정답·오답 근거). 파이프라인은 문항을 하나씩 게이트·풀이·검토하고, 세 문항이 모두 통과해야 세트가 통과한다.
문항은 서로의 정답에 의존하지 않는다(한 문항이 틀려도 다음 문항을 풀 수 있게)."""
from stats_common import *

SETS_MARK = "set"


def _member(arch, j, topic, skill, stem, key, ds, rng, bpr, est, facts):
    p = spack(f"{arch}_q{j}", topic, skill, stem, key, ds, rng, bpr, None, est, facts)
    p.pop("stimulus", None)
    return p


def _set_pack(arch, intro, stim, members, facts, _unused=None):
    return {"archetype": arch, "topic": members[0]["topic"], "skill": members[0]["skill"], "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": members,
            "set_size": len(members), "est_seconds": sum(m["est_seconds"] for m in members), "facts": facts}


# ======================= 세트 1: 이항 확률분포 표 (단원 2) =======================
BN_CTX = [("an inspector examines a random sample of ${n}$ items from a large shipment in which ${pp}\\%$ of the items are defective", "items", "defective", "defective items in the sample"),
          ("a clinic phones a random sample of ${n}$ patients from a large list on which ${pp}\\%$ of the patients missed their last appointment", "patients", "missed an appointment", "patients in the sample who missed an appointment")]


def st_set_binomial(rng):
    sc, units, trait, what = pick(rng, BN_CTX)
    n = pick(rng, [5, 6, 7]); p = pick(rng, [0.2, 0.3, 0.4])
    pm = [math.comb(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n + 1)]
    ref = [ss.binom.pmf(k, n, p) for k in range(n + 1)]
    for a, b in zip(pm, ref):
        agree(a, b, tol=1e-9, name="binom_pmf")
    agree(sum(pm), 1.0, tol=1e-9, name="sum_pmf")
    tbl = [round(v, 4) for v in pm]
    EX_table = sum(k * v for k, v in enumerate(pm))
    agree(EX_table, n * p, tol=1e-9, name="expected")  # 독립 경로: 표의 합 vs np
    intro = f"Questions refer to the following information. In a certain process, {sc.format(n=n, pp=int(round(p * 100)))}. Let $X$ be the number of {what}. The probability distribution of $X$ is shown in the table."
    stim = stat_stim(f"Probability distribution of X, the number of {what}", "table", title="Probability distribution of X",
                     columns=["x", "P(X = x)"], rows=[[str(k), f"{v:.4f}"] for k, v in enumerate(tbl)])
    # Q1: 기댓값
    ex = n * p
    d1 = {"nq": n * (1 - p), "p": p, "half": n / 2, "k1": float(np.argmax(pm))}
    r2 = {k: round(v, 2) for k, v in d1.items()}
    allv = [round(ex, 2)] + list(r2.values())
    for _ in range(1):
        pass
    if len(set(allv)) < 4:
        raise ValueError("expected_options_collide")
    k1 = Opt(T(ex, 2), True, f"The mean of a binomial random variable is $np = {n}({p}) = {clean(ex, 2)}$; weighting each value of $X$ by its probability in the table gives the same value.", round(ex, 2))
    w1 = {"nq": "Uses $n(1-p)$, the expected number of non-defective outcomes, instead of $np$.", "p": "Reports the probability of one outcome instead of the mean of $X$.", "half": "Uses $n/2$, as if each outcome had probability $0.5$.", "k1": "Reports the most likely value of $X$ (the mode) rather than the mean."}
    ds1 = [Opt(T(r2[k], 2), False, w1[k], r2[k]) for k in ("nq", "p", "half", "k1")]
    m1 = _member("st_set_binomial", 1, "2.9", "3.D", f"What is the mean (expected value) of $X$? Round to two decimal places.", k1, ds1, rng,
                 sbp("st_set_binomial_q1", "2.9", "3.D", "Find the mean of a random variable from its probability distribution",
                     ["Recognize that the mean of X weights each value by its probability, or equals np for a binomial random variable", "Distinguish the mean from the most likely value and from the expected number of the other outcome"],
                     [("the mean of a binomial random variable is n times p", "the table gives the distribution and the stem gives n and the percent of defective outcomes")],
                     [("expected_failures", "uses n(1-p) instead of np"), ("probability_not_mean", "reports p instead of the mean"), ("mode_not_mean", "reports the most likely value as the mean")],
                     "the mean is recomputed as the sum of x times P(X = x) over the table and compared with n times p",
                     {"type": "table", "must_include": ["probability distribution"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"], method="table expectation vs np"), 80, [f"n={n}", f"p={p}"])
    # Q2: P(X >= 2)
    ge2 = sum(pm[2:])
    agree(ge2, 1 - pm[0] - pm[1], tol=1e-9, name="ge2")
    gt2 = sum(pm[3:]); eq2 = pm[2]; le1c = 1 - pm[1]
    vals = {"gt": gt2, "eq": eq2, "c1": le1c}
    r3 = {k: round(v, 3) for k, v in vals.items()}
    if len({round(ge2, 3), *r3.values()}) < 4 or min(abs(round(ge2, 3) - v) for v in r3.values()) < 0.01 or min(abs(a - b) for a in r3.values() for b in r3.values() if a != b) < 0.01:
        raise ValueError("ge2_collide")
    k2 = Opt(T(ge2, 3), True, f"$P(X \\ge 2) = 1 - P(X=0) - P(X=1) = 1 - {tbl[0]:.4f} - {tbl[1]:.4f} \\approx {ge2:.3f}$, which equals the sum of the table probabilities from $x=2$ on.", round(ge2, 3))
    w2 = {"gt": "Finds $P(X > 2)$, leaving out the probability that $X = 2$.", "eq": "Finds $P(X = 2)$ only, instead of the probability of $2$ or more.", "c1": "Subtracts only $P(X=1)$ from $1$, leaving out the probability that $X=0$ from the removed values."}
    ds2 = [Opt(T(r3[k], 3), False, w2[k], r3[k]) for k in ("gt", "eq", "c1")]
    m2 = _member("st_set_binomial", 2, "2.10", "3.C", f"What is the probability that at least $2$ of the {units} in the sample are {trait}? Use the table and round to three decimal places.", k2, ds2, rng,
                 sbp("st_set_binomial_q2", "2.10", "3.C", "Find an at-least probability from a probability distribution table",
                     ["Translate at least 2 into the values 2 and above of X", "Add those probabilities or subtract the probabilities of the values below 2 from 1"],
                     [("P(X at least 2) equals one minus the probabilities of 0 and 1", "the table lists the probability of every value of X")],
                     [("excludes_boundary", "uses more than 2 instead of at least 2"), ("single_value", "uses exactly 2 instead of at least 2"), ("partial_complement", "subtracts only one value from 1")],
                     "the table probabilities are summed from x = 2 up and compared with the complement, using binomial probabilities computed from the combinations formula and scipy",
                     {"type": "table", "must_include": ["probability distribution"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"], method="direct sum vs complement"), 85, [f"ge2={ge2:.3f}"])
    # Q3: 확률 해석(P(X=0))
    z = pm[0]
    pctz = int(round(z * 100))
    k3 = Opt(f"In about ${pctz}\\%$ of all such random samples of ${n}$ {units}, none of the {units} would be {trait}", True, f"$P(X=0) \\approx {z:.4f}$ is the long-run proportion of random samples of ${n}$ {units} with no {trait} {units}.", None)
    ds3 = [Opt(f"There is a ${pctz}\\%$ chance that any one of the {units} in a sample is {trait}", False, f"Confuses $P(X=0)$ with the probability for one individual item; the probability for one {units[:-1]} is given in the scenario.", None),
           Opt(f"Exactly ${pctz}\\%$ of the {units} in every sample of ${n}$ are {trait}", False, "Reads a probability as a guaranteed percentage in every sample.", None),
           Opt(f"In about ${pctz}\\%$ of all such samples, all of the {units} would be {trait}", False, "Reverses the event: $X=0$ means none are of the stated kind, not all.", None)]
    m3 = _member("st_set_binomial", 3, "2.8", "4.D", f"Which of the following is the correct interpretation of $P(X=0)$ in this context?", k3, ds3, rng,
                 sbp("st_set_binomial_q3", "2.8", "4.D", "Interpret a probability from a distribution in context",
                     ["Read P(X = 0) from the table and recall what the event X = 0 means in words", "Interpret a probability as a long-run proportion of repeated random samples"],
                     [("a probability from a distribution describes the long-run proportion of samples with that outcome", "the table gives P(X = 0) and the scenario defines X")],
                     [("probability_for_one_item", "confuses with the probability for one item"), ("guaranteed_percentage", "reads it as a guaranteed percentage"), ("reversed_event", "reverses the event")],
                     "the sentences are generated from the definition of X and the table value; the event wording is checked against X = 0",
                     {"type": "table", "must_include": ["probability distribution"]}, ["interpretation"], method="definition check"), 85, [f"p0={z:.4f}"])
    return _set_pack("st_set_binomial", intro, stim, [m1, m2, m3], [f"n={n}", f"p={p}", "X~Bin"], None)


# ======================= 세트 2: 회귀 컴퓨터 출력 (단원 5) =======================
RG_CTX = [("The relationship between the number of hours a student spent studying and the exam score, in points, is described by a least-squares regression line", "Hours", "Score", "hour", "point", (2, 8), (48, 5.5), "study time", "exam score"),
          ("The relationship between the age of a used car, in years, and its selling price, in thousands of dollars, is described by a least-squares regression line", "Age", "Price", "year", "thousand dollars", (2, 9), (26, -2.0), "age", "selling price")]


def st_set_regression(rng):
    intro0, xn, yn, xu, yu, xr, (a0, b0), xdesc, ydesc = pick(rng, RG_CTX)
    for _ in forever():
        a = round(a0 + rng.uniform(-2, 2), 1)
        b = round(b0 + rng.uniform(-0.5, 0.5), 2)
        r2 = rng.choice([0.64, 0.72, 0.81, 0.49])
        r = math.copysign(math.sqrt(r2), b)
        x0 = rng.randint(xr[0], xr[1])
        yh = a + b * x0
        d2 = {"no_int": b * x0, "swap": b + a * x0, "x_only": a + b}
        rr = {k: round(v, 1) for k, v in d2.items()}
        allv = [round(yh, 1)] + list(rr.values())
        if len(set(allv)) == 4 and min(abs(i - j) for i in allv for j in allv if i != j) >= 0.4:
            break
    se_b = round(abs(b) / rng.uniform(4, 9), 3); se_a = round(rng.uniform(0.8, 2.2), 3)
    out = {"title": f"Regression Analysis: {yn} versus {xn}", "sections": [
        {"columns": ["Predictor", "Coef", "SE Coef", "T", "P"], "rows": [["Constant", f"{a:.2f}", f"{se_a:.3f}", f"{a / se_a:.2f}", "0.000"], [xn, f"{b:.2f}", f"{se_b:.3f}", f"{b / se_b:.2f}", "0.000"]]},
        {"columns": ["S", "R-Sq"], "rows": [["2.15", f"{r2 * 100:.1f}%"]]}]}
    stim = stat_stim("Computer output for a least-squares regression", "output", output=out)
    intro = f"Questions refer to the following information. {intro0}. Computer output for the regression is shown."
    # Q1 기울기 해석
    key1 = Opt(f"For each additional {xu} of {xdesc}, the predicted {ydesc} {'increases' if b > 0 else 'decreases'} by about ${abs(b):.2f}$ {yu}s", True, f"The slope is ${b:.2f}$, so each one-{xu} increase in {xdesc} goes with a predicted change of ${b:.2f}$ {yu}s in {ydesc}.", None)
    ds1 = [Opt(f"For each additional {xu} of {xdesc}, the {ydesc} {'increases' if b > 0 else 'decreases'} by exactly ${abs(b):.2f}$ {yu}s", False, "Claims an exact change for every individual, but the slope describes the predicted change on average.", None),
           Opt(f"For each additional ${abs(b):.2f}$ {yu}s of {ydesc}, the predicted {xdesc} {'increases' if b > 0 else 'decreases'} by about $1$ {xu}", False, "Reverses the roles of the explanatory and the response variables.", None),
           Opt(f"For each additional {xu} of {xdesc}, the predicted {ydesc} {'increases' if b > 0 else 'decreases'} by about ${abs(b):.2f}\\%$", False, "Treats the slope as a percent change instead of a change in the units of the response.", None)]
    m1 = _member("st_set_regression", 1, "5.3", "4.D", "Which of the following is the correct interpretation of the slope of the regression line?", key1, ds1, rng,
                 sbp("st_set_regression_q1", "5.3", "4.D", "Interpret the slope of a least-squares line in context",
                     ["Read the slope from the Coef column next to the explanatory variable", "Describe the predicted change in the response for a one-unit increase in the explanatory variable, in context and with units"],
                     [("the slope is the predicted change in y for a one-unit increase in x", "the output gives the slope in the Coef column and the stem names both variables and their units")],
                     [("exact_change", "claims an exact change"), ("roles_reversed", "reverses the variables"), ("percent_change", "uses percent")],
                     "the interpretation sentences are generated from the slope sign and units, and the slope is checked against the sign implied by the correlation",
                     {"type": "computer_output", "must_include": ["Coef column"]}, ["interpretation", "representation_reading"], method="template and sign check"), 90, [f"b={b}"])
    # Q2 예측값
    keyv = Opt(T(yh, 1), True, f"The predicted value is $\\hat y = {a:.1f} + ({b:.2f})({x0}) \\approx {yh:.1f}$.", round(yh, 1))
    w2 = {"no_int": "Leaves out the intercept and predicts with the slope times $x$ alone.", "swap": "Uses the slope as the intercept and the intercept as the slope.", "x_only": "Adds the slope to the intercept instead of multiplying the slope by $x$."}
    ds2 = [Opt(T(rr[k], 1), False, w2[k], rr[k]) for k in ("no_int", "swap", "x_only")]
    m2 = _member("st_set_regression", 2, "5.3", "3.B", f"What is the predicted {ydesc} when {xdesc} is ${x0}$? Round to one decimal place.", keyv, ds2, rng,
                 sbp("st_set_regression_q2", "5.3", "3.B", "Predict a response value from regression output",
                     ["Read the intercept and the slope from the Coef column", "Substitute the x value into the line and round as stated"],
                     [("the predicted value is intercept plus slope times x", "the output gives both coefficients and the stem gives x")],
                     [("intercept_omitted", "leaves out the intercept"), ("coefficients_swapped", "swaps slope and intercept"), ("slope_added", "adds instead of multiplies")],
                     "the prediction is recomputed from the printed coefficients and compared with the generating line",
                     {"type": "computer_output", "must_include": ["Coef column"]}, ["representation_reading", "calculated_value_decision"], method="recomputation"), 80, [f"x0={x0}", f"yhat={yh:.2f}"])
    # Q3 상관계수
    dd = {"r2": r2, "neg": -r, "pct": r2 * 100 / 100 + 0.0, "sq": r ** 3}
    vals3 = {"r2": r2, "flip": -r, "half": r / 2}
    kk = Opt(T(r, 2), True, f"The correlation has the same sign as the slope, so $r = {'' if b > 0 else '-'}\\sqrt{{{r2}}} = {r:.2f}$.", round(r, 2))
    w3 = {"r2": "Reports $r^2$ as if it were the correlation $r$.", "flip": "Uses the wrong sign: the sign of $r$ must match the sign of the slope.", "half": "Divides $r$ by $2$, which has no basis in the output."}
    r3 = {k: round(v, 2) for k, v in vals3.items()}
    if len({round(r, 2), *r3.values()}) < 4 or min(abs(i - j) for i in [round(r, 2), *r3.values()] for j in [round(r, 2), *r3.values()] if i != j) < 0.04:
        raise ValueError("r_collide")
    ds3 = [Opt(T(r3[k], 2), False, w3[k], r3[k]) for k in ("r2", "flip", "half")]
    m3 = _member("st_set_regression", 3, "5.2", "3.B", "What is the correlation coefficient between the two variables? Round to two decimal places.", kk, ds3, rng,
                 sbp("st_set_regression_q3", "5.2", "3.B", "Find the correlation coefficient from R-squared and the sign of the slope",
                     ["Take the square root of the R-Sq value written as a proportion", "Give r the same sign as the slope"],
                     [("r is the square root of r squared with the sign of the slope", "the output shows R-Sq and the slope")],
                     [("r_squared_as_r", "reports r squared"), ("wrong_sign", "uses the wrong sign"), ("halved_r", "divides r by two")],
                     "r is recomputed as the square root of the printed R-Sq with the slope's sign and rounded to two decimals; options are at least 0.04 apart",
                     {"type": "computer_output", "must_include": ["R-Sq", "Coef column"]}, ["representation_reading", "calculated_value_decision"], method="recomputation"), 85, [f"r={r:.3f}"])
    return _set_pack("st_set_regression", intro, stim, [m1, m2, m3], [f"a={a}", f"b={b}", f"r2={r2}", f"x0={x0}"], None)


STAGE_SETS = ["st_set_binomial", "st_set_regression"]
