"""AP Statistics S1 파일럿 — M(중간 위험) 원형 6개. 정답 판정은 코드(진리표·열거·수치)가 하고, 해석 문장은 고정 문장 4개(정답 1 + 이름 붙은 오해 3)로 만든다."""
from stats_common import *
from stats_common import _I  # noqa: F401


# ======================= 4. 관찰연구/실험 → 인과·일반화 결론 (1.13 / 2.B) =======================
STUDY_CTX = [
    dict(pop="students", pool="a large school district", x="tutoring program", outcome="mean test score", yes="use the tutoring program", no="not use it", a_adj="the tutoring program"),
    dict(pop="adults", pool="a mid-sized city", x="exercise plan", outcome="mean weight loss", yes="follow the exercise plan", no="not follow it", a_adj="the exercise plan"),
    dict(pop="employees", pool="a large company", x="flexible schedule", outcome="mean job satisfaction score", yes="work a flexible schedule", no="keep the regular schedule", a_adj="the flexible schedule"),
]


def _claim(causal, general, x, group):
    if causal and general:
        return f"The {x} caused the higher {{o}}, and the result can be generalized to all {group}"
    if causal:
        return f"The {x} caused the higher {{o}}, but the result cannot be generalized beyond the {group} in the study"
    if general:
        return f"The result can be generalized to all {group}, but it does not show that the {x} caused the higher {{o}}"
    return f"The result does not show that the {x} caused the higher {{o}} and cannot be generalized to all {group}"


def st_study_conclusion(rng):
    c = pick(rng, STUDY_CTX)
    rand_sel, rand_asg = rng.random() < 0.5, rng.random() < 0.5
    n = pick(rng, [120, 150, 200, 240])
    sel = f"A random sample of ${n}$ {c['pop']} is selected from {c['pool']}" if rand_sel else f"In {c['pool']}, ${n}$ {c['pop']} volunteer to participate in a study"
    asg = f"each is assigned at random to {c['yes']} or to {c['no']}" if rand_asg else f"each chooses whether to {c['yes']} or to {c['no']}"
    # 진리표(독립 경로): 인과 결론은 무작위 배정이, 일반화는 무작위 추출이 허용한다
    truth = {(cs, gn): (cs == rand_asg and gn == rand_sel) for cs in (True, False) for gn in (True, False)}
    assert sum(truth.values()) == 1
    sent = lambda cs, gn: _claim(cs, gn, c["x"], c["pop"]).replace("{o}", c["outcome"])
    key_cg = [k for k, v in truth.items() if v][0]
    why = lambda cs, gn: ({
        (True, True): "Random assignment supports a cause-and-effect conclusion and random selection supports generalizing.",
        (True, False): "Random assignment supports a cause-and-effect conclusion, but the participants were not randomly selected, so the result stays with the participants.",
        (False, True): "The participants were randomly selected, so the result can be generalized, but without random assignment the groups may differ in other ways, so cause cannot be concluded.",
        (False, False): "Without random assignment cause cannot be concluded, and without random selection the result cannot be generalized."}[(cs, gn)])
    key = Opt(sent(*key_cg), True, why(*key_cg), None)
    wr = {(True, True): "Claims cause and generalization even though " + ("the participants were not randomly selected" if not rand_sel else "the participants were not randomly assigned") + ".",
          (True, False): "Claims cause" + (" even though the participants chose their own group" if not rand_asg else "") + (" and refuses to generalize even though the sample was randomly selected" if rand_sel else "") + ".",
          (False, True): "Refuses to conclude cause" + (" even though the groups were randomly assigned" if rand_asg else "") + " and generalizes" + (" even though the participants volunteered" if not rand_sel else "") + ".",
          (False, False): "Refuses both conclusions" + (", but random assignment allows a cause-and-effect conclusion" if rand_asg else "") + (", but random selection allows generalizing" if rand_sel else "") + "."}
    ds = [Opt(sent(cs, gn), False, wr[(cs, gn)], None) for (cs, gn), v in truth.items() if not v]
    stem = f"{sel}, and {asg}. After the study period, the {c['outcome']} is higher in the group that used {c['a_adj']}, and the difference is statistically significant. Which conclusion is justified by the design of this study?"
    bpr = sbp("st_study_conclusion", "1.13", "2.B", "Decide which conclusions a study design justifies",
              ["Check whether treatments were assigned at random, which decides whether a cause-and-effect conclusion is justified", "Check whether participants were randomly selected, which decides whether results can be generalized to the population"],
              [("random assignment allows a causal conclusion and random selection allows generalization", "the stem states how participants were selected and how they were assigned to groups")],
              [("cause_without_random_assignment", "concludes cause from self-selected groups"), ("generalize_from_volunteers", "generalizes from volunteers"), ("refuse_valid_conclusion", "refuses a conclusion that the design justifies")],
              "a truth table over the two design features is enumerated, exactly one of the four claims is allowed, and the sentences are generated from the same table",
              {"type": "none", "must_include": []}, ["claim_justification", "interpretation"])
    return spack("st_study_conclusion", "1.13", "2.B", stem, key, ds, rng, bpr, None, 110, [f"sel={rand_sel}", f"asg={rand_asg}"])


# ======================= 10. 표본평균 분포(CLT) 서술 (2.12 / 4.C, 그림: D) =======================
CLT_CTX = [("waiting times", "minutes", "customers at a service desk"), ("lengths of phone calls", "minutes", "calls to a help line"), ("repair costs", "dollars", "repairs at a garage")]


def st_clt_describe(rng):
    what, unit, who = pick(rng, CLT_CTX)
    mu, sd = pick(rng, [(40, 20), (60, 30), (50, 25)])
    n = pick(rng, [64, 100])
    se = sd / math.sqrt(n)
    k = (mu / sd) ** 2
    theta = sd * sd / mu
    nsim = 40
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    means = [gen.gamma(k, theta, n).mean() for _ in range(nsim)]
    # 독립 경로: 별도 시뮬레이션 20000회로 평균·표준편차 확인
    ref = np.random.default_rng(12345).gamma(k, theta, (4000, n)).mean(axis=1)
    agree(ref.mean(), mu, tol=0.02, name="clt_mean")
    agree(ref.std(ddof=0), se, tol=0.06, name="clt_sd")
    vals = [round(m) for m in means]
    counts = {}
    for v in vals:
        counts[v] = counts.get(v, 0) + 1
    if len(counts) > 20 or max(counts.values()) > 15 or len(counts) < 6:
        raise ValueError("dot_plot_shape")
    if abs(np.mean(vals) - mu) > 1.2 * se or abs(np.std(vals) - se) > 0.35 * se:
        raise ValueError("plot_not_consistent")
    fmt = lambda v: TC(v, 3)
    key = Opt(f"Approximately normal, with mean {TI(mu)} and standard deviation {fmt(se)}", True, f"The mean of the sampling distribution is $\\mu={mu}$ and its standard deviation is $\\sigma/\\sqrt{{n}}={sd}/\\sqrt{{{n}}}={clean(se, 3)}$; with ${n}$ observations the Central Limit Theorem makes it approximately normal.", None)
    ds = [Opt(f"Skewed to the right like the population, with mean {TI(mu)} and standard deviation {fmt(se)}", False, "Believes the sampling distribution keeps the shape of the skewed population even with a large sample size.", None),
          Opt(f"Approximately normal, with mean {TI(mu)} and standard deviation {TI(sd)}", False, "Keeps the population standard deviation instead of dividing it by the square root of the sample size.", None),
          Opt(f"Approximately normal, with mean {TI(mu)} and standard deviation {fmt(sd / n)}", False, "Divides the population standard deviation by $n$ instead of by the square root of $n$.", None)]
    stem = f"The {what}, in {unit}, for {who} are skewed to the right with mean ${mu}$ and standard deviation ${sd}$. The dotplot shown displays the means of ${nsim}$ simulated random samples of ${n}$ values from this population. Which describes the sampling distribution of the sample mean for samples of size ${n}$?"
    stim = stat_stim(f"Dotplot of {nsim} simulated sample means", "dot_plot", xTitle=f"Sample mean ({unit})", dots=[{"value": v, "count": c} for v, c in sorted(counts.items())])
    bpr = sbp("st_clt_describe", "2.12", "4.C", "Describe the sampling distribution of a sample mean using the Central Limit Theorem",
              ["Find the mean and the standard deviation of the sampling distribution from the population values and the sample size", "Decide the shape of the sampling distribution from the sample size even though the population is skewed"],
              [("the sampling distribution of the mean has mean mu, standard deviation sigma over root n and is approximately normal for large n", "the sample size is large (at least 30) and the population standard deviation is given")],
              [("shape_of_population", "keeps the population shape"), ("population_standard_deviation", "keeps sigma"), ("divides_by_n", "divides sigma by n")],
              "4000 simulated samples from a gamma population with the same mean and standard deviation reproduce the stated mean and standard deviation, and the plotted means are checked against them",
              {"type": "dot_plot", "must_include": ["simulated sample means"]}, ["interpretation", "representation_reading"])
    return spack("st_clt_describe", "2.12", "4.C", stem, key, ds, rng, bpr, stim, 100, [f"n={n}", f"mu={mu}", f"sd={sd}"])


# ======================= 14. 카이제곱 검정 출력 → 결론 (3.15 / 4.G, 그림: O) =======================
CHI_CTX = [("students", "grade level", "preferred way to commute", ["9th grade", "10th grade", "11th grade"], ["Bus", "Car", "Walk or bike"]),
           ("shoppers", "age group", "preferred payment method", ["Under 30", "30 to 49", "50 or older"], ["Card", "Cash", "Mobile app"]),
           ("patients", "clinic location", "treatment outcome", ["North", "Central", "South"], ["Improved", "No change", "Worse"])]


def st_chisq_output(rng):
    who, var1, var2, rows, cols = pick(rng, CHI_CTX)
    for _ in forever():
        obs = [[rng.randint(18, 70) for _ in cols] for _ in rows]
        N = sum(map(sum, obs))
        rs = [sum(r) for r in obs]
        cs = [sum(obs[i][j] for i in range(len(rows))) for j in range(len(cols))]
        exp = [[rs[i] * cs[j] / N for j in range(len(cols))] for i in range(len(rows))]
        chi = sum((obs[i][j] - exp[i][j]) ** 2 / exp[i][j] for i in range(len(rows)) for j in range(len(cols)))
        df = (len(rows) - 1) * (len(cols) - 1)
        P = ss.chi2.sf(chi, df)
        agree(P, chi2_sf_num(chi, df), tol=1e-6, name="chi2_p")
        ref = ss.chi2_contingency(obs)
        agree(ref.statistic, chi, tol=1e-9, name="chi2_stat")
        if abs(P - 0.05) > 0.015 and P > 0.002 and min(min(r) for r in exp) >= 8:
            break
    rej = P < 0.05
    A, B = var1, var2
    if rej:
        key_t = f"There is convincing evidence of an association between {A} and {B} among all {who}"
        ds_t = [(f"There is convincing evidence that {A} causes a difference in {B} among all {who}", "Reads an association found by a test in an observational setting as cause and effect."),
                (f"There is convincing evidence that {A} and {B} are independent among all {who}", "Reverses the conclusion: a small P-value is evidence against independence, not for it."),
                (f"There is convincing evidence of an association between {A} and {B} only for the {who} in the sample", "Limits the conclusion to the sample even though the test is about the population.")]
        kw = f"The P-value ${P:.4f}$ is less than $0.05$, so the null hypothesis of independence is rejected and the conclusion is about the population."
    else:
        key_t = f"There is not convincing evidence of an association between {A} and {B} among all {who}"
        ds_t = [(f"There is convincing evidence that {A} and {B} are independent among all {who}", "Treats failing to reject the null hypothesis as proof that the null hypothesis is true."),
                (f"There is convincing evidence of an association between {A} and {B} among all {who}", "Reverses the decision rule: a P-value greater than the significance level does not support an association."),
                (f"There is convincing evidence that {A} causes a difference in {B} among all {who}", "Claims cause and effect from a test that did not even find an association.")]
        kw = f"The P-value ${P:.4f}$ is greater than $0.05$, so the null hypothesis of independence is not rejected."
    key = Opt(key_t, True, kw, None)
    ds = [Opt(t, False, w, None) for t, w in ds_t]
    stem = f"A random sample of ${N}$ {who} was classified by {A} and by {B}. A chi-square test of independence was carried out at the $\\alpha=0.05$ significance level, and the conditions for inference were met. Computer output for the test is shown. Which conclusion is justified by the output?"
    stim = stat_stim("Computer output for a chi-square test of independence", "output", output={
        "title": f"Chi-Square Test of Independence: {A} by {B}",
        "sections": [{"columns": ["Statistic", "Value"], "rows": [["Chi-Square", f"{chi:.3f}"], ["DF", df], ["P-Value", f"{P:.4f}"]]}],
        "notes": [f"Smallest expected count: {min(min(r) for r in exp):.2f}"]})
    bpr = sbp("st_chisq_output", "3.15", "4.G", "Draw a conclusion from computer output for a chi-square test of independence",
              ["Compare the P-value in the output with the stated significance level to make a decision about the null hypothesis", "State the conclusion in context about an association in the population without claiming cause or proving independence"],
              [("a P-value below alpha is evidence of an association in the population and a P-value above alpha is not", "the output gives the statistic, degrees of freedom, P-value and the smallest expected count which shows the conditions hold")],
              [("cause_and_effect", "reads association as cause"), ("accepts_null", "treats failing to reject as proof of independence"), ("sample_only", "limits the conclusion to the sample"), ("reversed_rule", "reverses the P-value rule")],
              "the chi-square statistic is recomputed from the expected counts, scipy.stats.chi2_contingency agrees and the tail area is also obtained by numerically integrating the chi-square density",
              {"type": "computer_output", "must_include": ["chi-square", "df", "P-value"]}, ["claim_justification", "representation_reading"])
    return spack("st_chisq_output", "3.15", "4.G", stem, key, ds, rng, bpr, stim, 100, [f"P={P:.4f}"])


# ======================= 17. 두 표본 t 출력(구간·P값) → 결론 (4.10 / 4.G, 그림: O) =======================
TOUT_CTX = [("a new fertilizer", "plant height", "centimeters", "Fertilizer", "Control"), ("a new training method", "reaction time", "milliseconds", "New method", "Standard method"), ("a revised recipe", "baking time", "minutes", "Revised", "Original")]


def st_t_output_claim(rng):
    what, qty, unit, g1, g2 = pick(rng, TOUT_CTX)
    for _ in forever():
        n1, n2 = rng.randint(15, 30), rng.randint(15, 30)
        m1, m2 = round(rng.uniform(20, 60), 1), round(rng.uniform(20, 60), 1)
        s1, s2 = round(rng.uniform(3, 9), 1), round(rng.uniform(3, 9), 1)
        v1, v2 = s1 ** 2 / n1, s2 ** 2 / n2
        se = math.sqrt(v1 + v2)
        df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1))
        diff = m1 - m2
        t = diff / se
        P = 2 * ss.t.sf(abs(t), df)
        agree(P, 2 * (1 - t_cdf_num(abs(t), df)), tol=1e-6, name="t2_p")
        tc = ss.t.ppf(0.975, df)
        lo, hi = diff - tc * se, diff + tc * se
        contains0 = lo <= 0 <= hi
        if (P < 0.05) == contains0 or not (0.02 < P < 0.5 or P < 0.02):
            continue
        if abs(P - 0.05) < 0.02 or min(abs(lo), abs(hi)) < 0.25 or P < 0.002:
            continue
        break
    diff_word = "the population means differ"
    ev = lambda convincing: f"There is {'convincing' if convincing else 'not convincing'} evidence that {diff_word}"
    rej = not contains0
    key = Opt(f"{ev(rej)}, because the interval {'does not contain' if rej else 'contains'} $0$", True, f"The $95\\%$ interval $({lo:.2f}, {hi:.2f})$ {'does not contain' if rej else 'contains'} $0$, which matches the P-value ${P:.4f}$ being {'less' if rej else 'greater'} than $0.05$ for a two-sided test.", None)
    ds = [Opt(f"{ev(not rej)}, because the interval {'does not contain' if rej else 'contains'} $0$", False, "Draws the opposite conclusion from the interval: whether $0$ is inside the interval decides whether a difference of $0$ is plausible.", None),
          Opt(f"{ev(rej)}, because the P-value is {'greater' if rej else 'less'} than $0.05$", False, "Misstates how the P-value compares with the significance level when deciding the conclusion.", None),
          Opt(f"{ev(not rej)}, because the P-value is {'less' if rej else 'greater'} than $0.05$", False, "Reverses the meaning of the P-value: a small P-value is evidence against the null hypothesis, not for it.", None)]
    stem = f"A researcher compares {qty}, in {unit}, for {what} using independent random samples, and the conditions for inference are met. Computer output for a two-sample t procedure is shown, where $\\mu_1$ is the mean for the {g1} group and $\\mu_2$ is the mean for the {g2} group. At the $\\alpha=0.05$ significance level, which conclusion is correct?"
    stim = stat_stim("Computer output for a two-sample t test and confidence interval", "output", output={
        "title": "Two-Sample t Test and Confidence Interval",
        "sections": [{"columns": ["Group", "N", "Mean", "StDev"], "rows": [[g1, n1, m1, s1], [g2, n2, m2, s2]]},
                     {"columns": ["Result", "Value"], "rows": [["Difference (mu1 - mu2)", f"{diff:.3f}"], ["95% CI for difference", f"({lo:.3f}, {hi:.3f})"], ["T-Value", f"{t:.3f}"], ["DF", f"{df:.1f}"], ["P-Value (two-sided)", f"{P:.4f}"]]}]})
    bpr = sbp("st_t_output_claim", "4.10", "4.G", "Draw a conclusion from two-sample t output using the interval and the P-value",
              ["Check whether the confidence interval for the difference contains zero and compare the two-sided P-value with the significance level", "State a conclusion about the population means that is consistent with both and give the right reason"],
              [("a 95 percent interval that excludes 0 goes with a two-sided P-value below 0.05", "the output gives the interval, the P-value and the significance level is stated")],
              [("opposite_conclusion", "draws the opposite conclusion from the interval"), ("p_value_misstated", "misstates the comparison of P with alpha"), ("p_value_reversed", "reverses the meaning of a small P-value")],
              "the Welch statistic, degrees of freedom, P-value (by numerical integration of the t density) and interval are recomputed from the summary statistics, and the interval and P-value must agree on the decision",
              {"type": "computer_output", "must_include": ["interval", "P-value"]}, ["claim_justification", "representation_reading"])
    return spack("st_t_output_claim", "4.10", "4.G", stem, key, ds, rng, bpr, stim, 110, [f"P={P:.4f}", f"contains0={contains0}"])


# ======================= 19. 잔차그림으로 선형모형 적합성 판단 (5.4 / 4.D, 그림: R) =======================
RES_CTX = [("the age of a car (in years)", "its selling price (in thousands of dollars)", "Age (years)"), ("the number of hours studied", "an exam score (in points)", "Hours studied"), ("the temperature (in degrees Celsius)", "the number of cups of hot chocolate sold", "Temperature (degrees Celsius)")]


def st_residual_plot(rng):
    xdesc, ydesc, xlabel = pick(rng, RES_CTX)
    pattern = pick(rng, ["random", "curved"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n = pick(rng, [20, 24, 28])
        x = np.sort(gen.choice(np.arange(5, 61), size=n, replace=False)).astype(float)
        xc = (x - x.mean()) / x.std()
        if pattern == "random":
            r = gen.normal(0, 1.0, n)
        else:
            r = 1.6 * (xc ** 2 - 1) + gen.normal(0, 0.35, n)
        # 최소제곱 잔차의 성질: 평균 0, x 와 무상관
        A = np.vstack([np.ones(n), x]).T
        coef, *_ = np.linalg.lstsq(A, r, rcond=None)
        r = r - A @ coef
        sc = 4.0 / np.abs(r).max()
        r = np.round(r * sc, 2)
        # 독립 판정: 잔차를 x 의 2차식으로 설명하는 정도(R^2)와 |잔차|-x 상관
        q = np.polyfit(xc, r, 2)
        pred = np.polyval(q, xc)
        r2 = 1 - ((r - pred) ** 2).sum() / max(((r - r.mean()) ** 2).sum(), 1e-9)
        fan = abs(np.corrcoef(np.abs(r), x)[0, 1])
        if pattern == "curved" and r2 > 0.75 and fan < 0.5:
            break
        if pattern == "random" and r2 < 0.2 and fan < 0.35:
            break
    ok_t = "A linear model is appropriate because the residuals show no clear pattern"
    bad_t = "A linear model is not appropriate because the residuals show a curved pattern"
    far_t = "A linear model is not appropriate because some of the residuals are far from $0$"
    zero_t = "A linear model is appropriate because the residuals add up to $0$"
    if pattern == "random":
        key = Opt(ok_t, True, "The residuals scatter randomly above and below $0$ with no curve or change in spread, so a linear model is appropriate.", None)
        ds = [Opt(bad_t, False, "Sees a curved pattern in what is only random scatter.", None), Opt(far_t, False, "Judges the model by how large individual residuals are rather than by whether the residuals show a pattern.", None),
              Opt(zero_t, False, "Uses the fact that least-squares residuals always add up to $0$, which is true for every model and says nothing about fit.", None)]
    else:
        key = Opt(bad_t, True, "The residuals are positive at the ends and negative in the middle, a curved pattern that shows the linear model does not capture the relationship.", None)
        ds = [Opt(ok_t, False, "Overlooks the clear curved pattern in the residuals.", None), Opt(far_t, False, "Judges the model by how large individual residuals are rather than by the curved pattern they form.", None),
              Opt(zero_t, False, "Uses the fact that least-squares residuals always add up to $0$, which is true for every model and says nothing about fit.", None)]
    stem = f"A least-squares regression line is used to predict {ydesc} from {xdesc}. The residual plot shown displays the residuals for the ${n}$ observations. Which statement is the most appropriate conclusion about the linear model?"
    stim = stat_stim("Residual plot with a horizontal line at zero", "scatter", xTitle=xlabel, yTitle="Residual", points=[[float(a), float(b)] for a, b in zip(x, r)], fitLine={"slope": 0, "intercept": 0})
    bpr = sbp("st_residual_plot", "5.4", "4.D", "Judge whether a linear model is appropriate from a residual plot",
              ["Look at the residual plot for any systematic pattern such as a curve rather than random scatter around zero", "Decide whether a linear model is appropriate and name the reason that the plot supports"],
              [("a residual plot with no pattern supports a linear model and a curved pattern does not", "the plot shows residuals against the explanatory variable with a reference line at zero")],
              [("pattern_not_seen", "overlooks the curve"), ("pattern_imagined", "sees a pattern in random scatter"), ("large_residuals", "judges by size of residuals"), ("residual_sum", "uses residuals adding to zero")],
              "residuals are made exactly orthogonal to x like least-squares residuals and a quadratic fit R squared and the correlation of absolute residuals with x classify the pattern, which must match the intended pattern",
              {"type": "scatter", "must_include": ["residuals", "zero line"]}, ["interpretation", "representation_reading"])
    return spack("st_residual_plot", "5.4", "4.D", stem, key, ds, rng, bpr, stim, 90, [f"pattern={pattern}", f"n={n}"])


# ======================= 20. 영향점 제거의 영향 (5.2 / 4.D, 그림: S 점 강조) =======================
INFL_CTX = [("the number of hours of sleep", "a reaction time score (in milliseconds)", "Hours of sleep", "Reaction time (ms)"), ("the engine size (in liters)", "the fuel efficiency (in miles per gallon)", "Engine size (liters)", "Fuel efficiency (mpg)"),
            ("the daily high temperature (in degrees Fahrenheit)", "the number of visitors to a park", "Temperature (F)", "Visitors")]


def _fit(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    return sxy / sxx, my - sxy / sxx * mx, sxy / math.sqrt(sxx * syy)


def st_influential_point(rng):
    xdesc, ydesc, xl, yl = pick(rng, INFL_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n0 = 10
        x = list(np.round(np.sort(gen.uniform(2, 18, n0)), 1))
        b, a = gen.uniform(2, 5), gen.uniform(10, 30)
        y = [round(a + b * xi + gen.normal(0, 3.0), 1) for xi in x]
        xe = round(gen.uniform(28, 34), 1)
        ye = round(a + b * xe + pick(rng, [-1, 1]) * gen.uniform(28, 60), 1)
        xs, ys = x + [xe], y + [ye]
        sl_w, ic_w, r_w = _fit(xs, ys)
        sl_o, ic_o, r_o = _fit(x, y)
        # 독립 경로: numpy 로 같은 계산
        agree(np.polyfit(xs, ys, 1)[0], sl_w, tol=1e-9, name="slope_with")
        agree(np.corrcoef(x, y)[0, 1], r_o, tol=1e-9, name="r_without")
        if min(ys) < 0 or max(ys) > 130:
            continue
        if abs(abs(r_o) - abs(r_w)) < 0.05 or abs(abs(sl_o) - abs(sl_w)) < 0.06 * max(abs(sl_w), 0.1) or abs(r_o) < 0.55:
            continue
        break
    r_up = abs(r_o) > abs(r_w)
    s_up = abs(sl_o) > abs(sl_w)
    words = lambda ru, su: f"The correlation becomes {'stronger' if ru else 'weaker'} and the slope becomes {'steeper' if su else 'less steep'}"
    key = Opt(words(r_up, s_up), True, f"Without the circled point $|r|$ changes from ${abs(r_w):.2f}$ to ${abs(r_o):.2f}$ and the slope magnitude from ${abs(sl_w):.2f}$ to ${abs(sl_o):.2f}$.", None)
    why_r = {True: "Gets the effect on the correlation backwards: the remaining points lie closer to a line, so the correlation gets stronger.", False: "Gets the effect on the correlation backwards: the remaining points are less well described by a line, so the correlation gets weaker."}
    why_s = {True: "Gets the effect on the slope backwards: the circled point was pulling the line flatter, so the slope gets steeper without it.", False: "Gets the effect on the slope backwards: the circled point was pulling the line steeper, so the slope gets less steep without it."}
    ds = []
    for ru in (True, False):
        for su in (True, False):
            if (ru, su) == (r_up, s_up):
                continue
            if ru != r_up and su != s_up:
                w = "Treats the effects on the correlation and on the slope as opposite to what they are."
            elif ru != r_up:
                w = why_r[r_up]
            else:
                w = why_s[s_up]
            ds.append(Opt(words(ru, su), False, w, None))
    stem = f"The scatterplot shown displays ${n0 + 1}$ observations of {xdesc} and {ydesc}. The point circled in red is removed, and the least-squares line and the correlation coefficient are recomputed. Which statement describes the effect of removing the point?"
    stim = stat_stim("Scatterplot with one highlighted point", "scatter", xTitle=xl, yTitle=yl, xMin=0, xMax=40, xStep=5, points=[[float(a), float(b2)] for a, b2 in zip(xs, ys)], highlights=[{"index": n0}])
    bpr = sbp("st_influential_point", "5.2", "4.D", "Describe how removing an influential point changes the correlation and the slope",
              ["Notice that the circled point has an extreme x-value and does not follow the pattern of the other points", "Decide how removing it changes the strength of the correlation and the steepness of the least-squares line"],
              [("a high-leverage point far from the pattern weakens the correlation and changes the slope", "the plot shows the circled point far to the right of the other observations")],
              [("correlation_backwards", "gets the correlation change backwards"), ("slope_backwards", "gets the slope change backwards"), ("both_backwards", "gets both changes backwards")],
              "slope and correlation are recomputed with and without the point by closed-form sums and by numpy polyfit and corrcoef, and the changes must exceed fixed thresholds so the options are distinct",
              {"type": "scatter", "must_include": ["highlighted point"]}, ["interpretation", "representation_reading"])
    return spack("st_influential_point", "5.2", "4.D", stem, key, ds, rng, bpr, stim, 100, [f"r_with={r_w:.3f}", f"r_without={r_o:.3f}"])


STAGE_M = ["st_study_conclusion", "st_clt_describe", "st_chisq_output", "st_t_output_claim", "st_residual_plot", "st_influential_point"]
