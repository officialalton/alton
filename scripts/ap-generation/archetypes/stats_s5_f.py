"""AP Statistics 연습 시험 4(2026-10-19 추가 라운드) FRQ 원형 4종. 기존 공개 FRQ 와 연습 시험 3 FRQ 의 틀과 다르다:
Q1 = 층화 임의 추출 + 무응답 편향 + 범주 비율 비교(표), Q2 = 자료표에서 계산기로 회귀(직선·기울기·잔차·R^2·외삽), Q3 = 독립 두 표본 평균 t 검정(요약 통계), Q4 = 이원표 조건부 확률 + 카이제곱 독립성 검정.
2027 FRQ: 4문항 x 10점, 채점 행은 1점씩 10행. 정답·수치는 코드가 계산하고 독립 경로로 다시 계산하며, 서술 행은 의미로 채점한다(meaning_based). 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import R, frq_pack, ev


def cap(s):
    return s[0].upper() + s[1:]


# ======================= Q1. 층화 추출 · 무응답 편향 · 비율 비교 (1.11 / 1.A) =======================
Q1_CTX = [
    dict(unit="students", u1="student", strata=("freshmen", "seniors"), place="a high school", q="Do you support a later start time for the school day?", cats=("Support", "Oppose", "No opinion"), resp="support",
         bias="Students who feel strongly about the start time are more likely to return the survey than students who do not care.", bias_dir="overestimate the percentage who support or who oppose, because students with strong opinions answer more often", pop="students at the school", fvar="the number of minutes that students at the school spend commuting each day", fq="What is the typical number of minutes that students at the school spend commuting each day?"),
    dict(unit="residents", u1="resident", strata=("renters", "homeowners"), place="a city", q="Do you favor building a new library branch?", cats=("Favor", "Oppose", "Undecided"), resp="favor",
         bias="Residents who use the library are more likely to return the survey than residents who never use it.", bias_dir="overestimate the percentage who favor the new branch, because library users answer more often and are more likely to favor it", pop="residents of the city", fvar="the number of library books that residents of the city borrow each year", fq="What is the typical number of library books that residents of the city borrow in a year?"),
]


def stfrq_n4_q1_stratified(rng):
    c = pick(rng, Q1_CTX)
    for _ in forever():
        n1 = rng.choice([60, 80, 100]); n2 = rng.choice([120, 150, 180, 200])
        f1 = [rng.uniform(.5, .7), rng.uniform(.15, .3)]; f2 = [rng.uniform(.3, .45), rng.uniform(.3, .4)]
        r1 = [int(round(n1 * f1[0])), int(round(n1 * f1[1]))]; r1.append(n1 - sum(r1)); r2 = [int(round(n2 * f2[0])), int(round(n2 * f2[1]))]; r2.append(n2 - sum(r2))
        p1 = Fr(r1[0], n1); p2 = Fr(r2[0], n2)
        if min(r1 + r2) >= 4 and p1 - p2 > Fr(1, 10) and r2[0] > r1[0] - 5 and abs(float(p1) - float(p2)) > 0.1:
            break
    d = float(p1) - float(p2)
    s1, s2 = c["strata"]
    stim = {"kind": "table", "description": f"Counts of survey answers by group in an earlier survey at {c['place']}.", "data": {"columns": ["Group", *c["cats"], "Total"], "rows": [[cap(s1), *[str(v) for v in r1], str(n1)], [cap(s2), *[str(v) for v in r2], str(n2)]], "notes": f"Answers to the question \"{c['q']}\" in an earlier survey of random samples from each group."}}
    parts = [
        part("A", f"A researcher at {c['place']} plans a new survey and wants to select a stratified random sample of ${100}$ {c['unit']}, with ${50}$ from each of two groups: {s1} and {s2}. Describe how the researcher could select such a sample.", 2, "explain", ["2.B"],
             f"Make a separate list of the {s1} and a separate list of the {s2}. Within each list, use a random number generator (or draw names at random) to select $50$ different {c['unit']}; the two selections together form the stratified random sample.",
             [R("A1", f"Separates the {c['unit']} into the two groups ({s1} and {s2}) before selecting, with ${50}$ from each group", [f"separate lists for {s1} and {s2}", "50 from each group"], err=["selects 100 from all {0} together".format(c['unit']), "chooses by convenience within a group"]),
              R("A2", "Uses a chance method (random numbers or drawing names) within each group to choose the individuals, without repeats", ["random selection within each group"], alt=["number each list and use random numbers to pick 50 different numbers"], err=["lets volunteers join", "takes the first 50 on each list"])]),
        part("B", f"Suppose that the researcher mails the survey to the selected {c['unit']} and only $35\\%$ of them return it. Explain how nonresponse could bias the results of the survey, and state the direction of the bias for the question \"{c['q']}\"", 2, "explain", ["2.B"],
             f"Nonresponse bias occurs when the {c['unit']} who respond differ from those who do not. {c['bias']} The survey would likely {c['bias_dir']}.",
             [R("B1", f"Explains that the {c['unit']} who respond can differ from those who do not respond, so the responses do not represent everyone who was selected", ["respondents differ from nonrespondents"], err=["says a low response rate only makes the sample smaller", "says nonresponse bias can be fixed by a larger sample"]),
              R("B2", "Describes in context how the difference could push the results in a particular direction (which kind of answers are over-represented)", ["names the over-represented answers in context"], err=["gives a general statement with no connection to the question"])]),
        part("C", f"The table shown gives the counts of the answers in an earlier survey, in which random samples of the {s1} and of the {s2} were asked. What percent of the {s1} in the earlier survey chose \"{c['cats'][0]}\"? Round to one decimal place.", 1, "calculate", ["3.B"],
             f"${r1[0]}/{n1} \\approx {float(p1) * 100:.1f}\\%$.",
             [R("C1", f"Calculates the percent of the {s1} who chose \"{c['cats'][0]}\" (answer {float(p1) * 100:.1f}%)", [f"{float(p1) * 100:.1f}"], nums=True, err=["divides by the total of both groups", "divides by the other group's total"])]),
        part("D", f"Compare the percent of the {s1} who chose \"{c['cats'][0]}\" with the percent of the {s2} who chose \"{c['cats'][0]}\" in the earlier survey. Use percents, not counts, in your comparison.", 2, "explain", ["4.A"],
             f"About ${float(p1) * 100:.1f}\\%$ of the {s1} chose \"{c['cats'][0]}\", compared with about ${float(p2) * 100:.1f}\\%$ of the {s2}, so the percent is greater for the {s1} (by about ${d * 100:.1f}$ percentage points), even though the counts are {'larger' if r2[0] > r1[0] else 'smaller'} for the {s2}.",
             [R("D1", f"Gives both percents ({float(p1) * 100:.1f}% and {float(p2) * 100:.1f}%), each computed with its own group total", [f"{float(p1) * 100:.1f}", f"{float(p2) * 100:.1f}"], nums=True, err=["compares the counts instead of the percents"]),
              R("D2", f"States in context that the percent who chose \"{c['cats'][0]}\" is greater for the {s1} than for the {s2}", ["greater for " + s1], requires="D1", err=["says the group with the larger count has the larger percent", "reverses the groups"])]),
        part("E", f"The researcher also wants to study {c['fvar']}. State a valid investigative question about this topic that requires a statistical investigation. Your question should name the population of interest, name the variable that would be measured, and be answerable by collecting and analyzing data that vary from individual to individual.", 3, "explain", ["1.A"],
             f"For example: {c['fq']}",
             [R("E1", f"Names the population of interest (the {c['pop']})", [c["pop"]], err=["names only the sample or one individual"]),
              R("E2", f"Names the variable that would be measured ({c['fvar']})", [c["fvar"]], err=["states no variable"]),
              R("E3", "Poses a question that anticipates variability among individuals and can be answered with data (not a single fact or an opinion)", ["anticipates variability", "answerable with data"], err=["asks a yes-or-no fact", "asks for an opinion"])]),
    ]
    for pt, tc in zip(parts, [["1.11"], ["1.12"], ["1.3"], ["1.4"], ["1.10"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n4_q1_stratified", "q1_multifocus", "1.10", ["1.3", "1.4", "1.11", "1.12"], "1.A", f"A stratified sample survey of {c['unit']} at {c['place']}", stim, parts, 22,
                    [f"r1={r1}", f"r2={r2}", f"p1={float(p1):.4f}", f"p2={float(p2):.4f}"], [ev("C", "percent in the first group", float(p1) * 100, 0.06), ev("D", "percent in the second group", float(p2) * 100, 0.06)],
                    ("A multi-focus question combining stratified random selection, nonresponse bias, a percent from a table, a comparison of percents for groups of different sizes and a valid investigative question",
                     ["Describe a stratified random sample", "Explain nonresponse bias and its direction in context", "Compute and compare percents with each group's own total", "Write a valid investigative question"],
                     [("the groups are compared by percents computed with their own totals", "the table gives the counts and totals for the two groups")], {"type": "table", "must_include": ["counts by group", "group totals"]},
                     "the two percents are recomputed with exact fractions and the case is kept only if the group with the larger percent does not have the larger count, so counts and percents disagree"),
                    ["claim_justification", "representation_reading", "procedure_choice"])


# ======================= Q2. 자료표에서 회귀 (5.3 / 4.D) =======================
Q2_CTX = [dict(x="age of a laptop (years)", y="resale value (hundreds of dollars)", xs="age", ys="resale value", xu="years", yu="hundreds of dollars", xr=(1, 8), a=(10, 14), b=(-1.6, -1.0), noise=0.7, sub="laptop", ex="laptop of age"),
          dict(x="distance run in a training session (kilometers)", y="time to complete the session (minutes)", xs="distance", ys="time", xu="kilometers", yu="minutes", xr=(2, 12), a=(2, 8), b=(5.0, 6.5), noise=2.5, sub="session", ex="session of distance")]


def stfrq_n4_q2_table(rng):
    c = pick(rng, Q2_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n = 8
        x = np.sort(gen.choice(np.arange(c["xr"][0], c["xr"][1] + 1), size=n, replace=False)).astype(float)
        a0 = rng.uniform(*c["a"]); b0 = rng.uniform(*c["b"])
        y = np.round(a0 + b0 * x + gen.normal(0, c["noise"], n), 1)
        mx, my = x.mean(), y.mean(); sxx = ((x - mx) ** 2).sum(); sxy = ((x - mx) * (y - my)).sum(); syy = ((y - my) ** 2).sum()
        b = sxy / sxx; a = my - b * mx; r2 = sxy ** 2 / (sxx * syy); r = math.copysign(math.sqrt(r2), b)
        cf = np.polyfit(x, y, 1); agree(cf[0], b, tol=1e-8, name="slope"); agree(cf[1], a, tol=1e-8, name="intercept")
        a_, b_ = round(a, 2), round(b, 2)
        i = int(rng.randrange(2, n - 2)); res = y[i] - (a_ + b_ * x[i])
        xo = c["xr"][1] + rng.randint(3, 6); yo = a_ + b_ * xo
        if r2 > 0.8 and abs(res) > 0.25 and yo > 0.5 and abs(b_) > 0.3 and abs(round(res, 2)) > 0.3:
            break
    r2_ = round(r2, 3); rr = round(r, 3)
    rows = [[f"{v:g}", f"{w:g}"] for v, w in zip(x, y)]
    stim = {"kind": "table", "description": f"Data on {c['xs']} and {c['ys']} for {n} {c['sub']}s.", "data": {"columns": [cap(c["x"]), cap(c["y"])], "rows": rows, "notes": f"Data for {n} {c['sub']}s."}}
    sg = "+" if b_ >= 0 else "-"
    yh = a_ + b_ * x[i]
    parts = [
        part("A", f"The table shows data for ${n}$ {c['sub']}s on the {c['xs']} ($x$, in {c['xu']}) and the {c['ys']} ($y$, in {c['yu']}). Use technology to find the equation of the least-squares regression line for predicting {c['ys']} from {c['xs']}. Give the slope and the intercept rounded to two decimal places.", 2, "calculate", ["3.B"],
             f"$\\hat y = {a_} {sg} {abs(b_)}x$ (slope ${b_}$, intercept ${a_}$).",
             [R("A1", f"Gives the slope (answer {b_})", [f"{b_}"], nums=True, err=["gives the correlation as the slope", "swaps slope and intercept"]), R("A2", f"Gives the intercept (answer {a_})", [f"{a_}"], nums=True, err=["swaps slope and intercept"])]),
        part("B", f"Interpret the slope of the regression line in the context of the data.", 2, "explain", ["4.D"],
             f"For each additional {c['xu'][:-1] if c['xu'].endswith('s') else c['xu']} of {c['xs']}, the predicted {c['ys']} {'increases' if b_ > 0 else 'decreases'} by about {abs(b_)} {c['yu']}.",
             [R("B1", f"States that the predicted {c['ys']} {'increases' if b_ > 0 else 'decreases'} by about {abs(b_)} for each one-unit increase in the {c['xs']} (direction and amount)", [f"{abs(b_)}", "increases" if b_ > 0 else "decreases"], nums=True, err=["gives the intercept", "says the change is exact for every individual"]),
              R("B2", f"Gives the interpretation in context with units ({c['yu']} per {c['xu'][:-1] if c['xu'].endswith('s') else c['xu']}) and the word predicted (or on average)", ["in context", "units", "predicted"], requires="B1", err=["omits the units or the context"])]),
        part("C", f"One of the {c['sub']}s has {c['xs']} equal to ${x[i]:g}$ {c['xu']} and {c['ys']} equal to ${y[i]:g}$ {c['yu']}. Calculate the residual for this {c['sub']} and say whether the {c['sub']} is above or below the regression line.", 2, "calculate", ["3.B"],
             f"Predicted value ${a_} {sg} {abs(b_)}({x[i]:g}) = {yh:.2f}$; residual $= {y[i]:g} - {yh:.2f} = {res:.2f}$, so the point is {'above' if res > 0 else 'below'} the line.",
             [R("C1", f"Calculates the residual as actual minus predicted (answer {res:.2f})", [f"{res:.2f}"], nums=True, err=["subtracts in the wrong order"]), R("C2", f"States that the point is {'above' if res > 0 else 'below'} the line because the residual is {'positive' if res > 0 else 'negative'}", ["above" if res > 0 else "below"], requires="C1", err=["reverses above and below"])]),
        part("D", f"For these data, $r^2 \\approx {r2_}$. Interpret $r^2$ in the context of the data.", 2, "explain", ["4.D"],
             f"About {r2_ * 100:.1f}% of the variation in {c['ys']} is accounted for by the linear relationship with {c['xs']}.",
             [R("D1", f"States that about {r2_ * 100:.1f}% (the proportion {r2_}) of the variation in the {c['ys']} is accounted for by the linear relationship", [f"{r2_ * 100:.1f}%", "variation"], nums=True, err=["says that the line passes through that percent of the points", "says the {0} changes by that percent".format(c['ys'])]),
              R("D2", "Uses the context by naming both variables", ["in context"], requires="D1")]),
        part("E", f"A researcher uses the regression line to predict the {c['ys']} of a {c['ex']} ${xo}$ {c['xu']}. Calculate the predicted value, and explain whether you would trust the prediction.", 2, "calculate", ["4.D"],
             f"$\\hat y = {a_} {sg} {abs(b_)}({xo}) = {yo:.2f}$; this is outside the range of the data ({int(x.min())} to {int(x.max())} {c['xu']}), so it is an extrapolation and should not be trusted.",
             [R("E1", f"Calculates the predicted value (answer {yo:.2f})", [f"{yo:.2f}"], nums=True, err=["uses the slope as the intercept"]), R("E2", "Explains that the value is outside the range of the data (extrapolation), so the linear pattern may not continue and the prediction is not reliable", ["extrapolation", "outside the range of the data"], requires="E1", err=["says the prediction is reliable because r squared is large"])]),
    ]
    for pt, tc in zip(parts, [["5.3"], ["5.3"], ["5.4"], ["5.5"], ["5.3"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n4_q2_table", "q2_regression", "5.3", ["5.4", "5.5"], "4.D", f"Linear regression of {c['ys']} on {c['xs']} from a data table", stim, parts, 22,
                    [f"a={a_}", f"b={b_}", f"r2={r2_}", f"i={i}", f"xo={xo}"], [ev("A", "slope", b_, 0.02), ev("A", "intercept", a_, 0.02), ev("C", "residual", res, 0.02), ev("E", "prediction", yo, 0.03)],
                    ("Use technology on a data table to find a least-squares line, interpret its slope, compute and interpret a residual, interpret r squared and recognize an extrapolation",
                     ["Find the equation of the line from the data", "Interpret the slope and r squared", "Compute a residual and judge an extrapolation"],
                     [("the line is fitted to the table by least squares and each later part uses the fitted coefficients", "the table gives all eight observations")], {"type": "table", "must_include": ["all x and y values"]},
                     "the coefficients are recomputed by the normal equations and numpy's polynomial fit, and the residual and prediction are recomputed from the rounded coefficients"),
                    ["procedure_choice", "interpretation", "claim_justification"])


# ======================= Q3. 독립 두 표본 평균 t 검정 (4.10 / 3.E) =======================
Q3_CTX = [dict(a="Brand A", b="Brand B", what="battery life", unit="hours", u="batteries", claim="Brand A batteries last longer on average than Brand B batteries", sus="longer", who="a consumer group", N="large shipments", mu=(38, 44), sd=(3.5, 5.5), tn=(22, 30)),
          dict(a="the new method", b="the standard method", what="score on a final exam", unit="points", u="students", claim="the new method gives a higher mean exam score than the standard method", sus="higher", who="a teacher", N="a large school", mu=(70, 78), sd=(8, 12), tn=(26, 36))]


def stfrq_n4_q3_twomeans(rng):
    c = pick(rng, Q3_CTX)
    for _ in forever():
        n1 = rng.randint(*c["tn"]); n2 = rng.randint(*c["tn"]); m2 = rng.randint(*c["mu"]) + rng.choice([0, 0.4, 0.8]); d = rng.choice([1.2, 1.8, 2.4, 3.0, 3.8]) * (c["sd"][1] / 5.0); m1 = round(m2 + d, 1)
        s1 = round(rng.uniform(*c["sd"]), 1); s2 = round(rng.uniform(*c["sd"]), 1)
        v1, v2 = s1 ** 2 / n1, s2 ** 2 / n2; se = math.sqrt(v1 + v2); t = (m1 - m2) / se; df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1))
        P = float(ss.t.sf(t, df)); P_ind = 1 - t_cdf_num(t, df); agree(P, P_ind, tol=1e-6, name="welch_p")
        ref = ss.ttest_ind_from_stats(m1, s1, n1, m2, s2, n2, equal_var=False); agree(float(ref.statistic), t, tol=1e-9, name="welch_t")
        if 0.003 < P < 0.18 and abs(P - 0.05) > 0.012 and abs(m1 - m2) > 0.3:
            break
    rej = P < 0.05
    stim = {"kind": "text", "description": f"{cap(c['who'])} wants to know whether {c['claim'][0].lower() + c['claim'][1:]}. Independent random samples were taken: ${n1}$ {c['u']} of {c['a'].lower() if c['a'][0] == 'B' else c['a']} had a mean {c['what']} of ${m1:g}$ {c['unit']} with a standard deviation of ${s1:g}$ {c['unit']}, and ${n2}$ {c['u']} of {c['b']} had a mean {c['what']} of ${m2:g}$ {c['unit']} with a standard deviation of ${s2:g}$ {c['unit']}. Boxplots of the two samples are roughly symmetric with no outliers. Each sample is less than $10\\%$ of its population. Use a significance level of $\\alpha = 0.05$.", "data": {}}
    parts = [
        part("A", f"State the null and alternative hypotheses for the test. Define any parameters you use.", 2, "explain", ["2.E"],
             f"Let $\\mu_1$ be the mean {c['what']} for all {c['u']} of {c['a']}, and $\\mu_2$ the mean for {c['b']}. $H_0: \\mu_1 - \\mu_2 = 0$ and $H_a: \\mu_1 - \\mu_2 > 0$.",
             [R("A1", f"States $H_0: \\mu_1 = \\mu_2$ (or $\\mu_1 - \\mu_2 = 0$) with both parameters defined as population means in context", ["mu_1 = mu_2", "population means defined"], err=["writes hypotheses about the sample means", "defines a single mean of differences"]), R("A2", "States $H_a: \\mu_1 > \\mu_2$ (or $\\mu_1 - \\mu_2 > 0$) in the direction of the claim", ["mu_1 > mu_2"], err=["uses a two-sided alternative", "uses the opposite direction"])]),
        part("B", "Verify the conditions for a two-sample $t$ procedure.", 2, "explain", ["4.E"],
             f"Random and independent: the two samples are random and independent of each other. 10% condition: each sample is less than $10\\%$ of its population. Normality: the boxplots are roughly symmetric with no outliers, so the populations are approximately normal; each sample size is also about $30$ or close to it.",
             [R("B1", "States that the two samples are random and independent and that each is less than 10% of its population", ["random and independent samples", "10% condition"], err=["checks the conditions with the two samples combined as one sample"]), R("B2", "Checks normality for each group using the boxplots (roughly symmetric, no outliers) or the sample sizes", ["boxplots symmetric with no outliers"], err=["checks normality of the differences, which do not exist for independent samples"])]),
        part("C", "Carry out the test: identify the procedure, and calculate the test statistic and the P-value (use technology for the degrees of freedom).", 3, "calculate", ["3.E"],
             f"Two-sample $t$ test. $t = ({m1:g} - {m2:g})/\\sqrt{{{s1:g}^2/{n1} + {s2:g}^2/{n2}}} \\approx {t:.2f}$ with $df \\approx {df:.1f}$; the P-value for the one-sided alternative is about ${P:.4f}$.",
             [R("C1", "Names the procedure: a two-sample (unpooled) t test for the difference of two means", ["two-sample t test"], err=["names a matched-pairs t test", "names a z test"]), R("C2", f"Calculates the test statistic (answer t of about {t:.2f})", [f"{t:.2f}"], requires="C1", nums=True, err=["uses the pooled standard error", "uses the standard deviations instead of the standard errors"]),
              R("C3", f"Finds the P-value from the t distribution for the one-sided alternative (answer about {P:.4f}, with about {df:.0f} degrees of freedom)", [f"{P:.4f}"], requires="C2", nums=True, err=["doubles the P-value for a one-sided test", "uses n - 1 of the smaller sample as the degrees of freedom without checking"])]),
        part("D", "State a conclusion in the context of the problem. Justify your answer using the P-value and the significance level.", 3, "explain", ["4.G"],
             (f"The P-value ${P:.4f}$ is less than $0.05$, so reject $H_0$. There is convincing evidence that the mean {c['what']} is {c['sus']} for {c['a']} than for {c['b']}." if rej else f"The P-value ${P:.4f}$ is greater than $0.05$, so fail to reject $H_0$. There is not convincing evidence that the mean {c['what']} is {c['sus']} for {c['a']} than for {c['b']}."),
             [R("D1", f"Compares the P-value ({P:.4f}) with the significance level 0.05 ({'less' if rej else 'greater'})", ["compares P-value with alpha"], nums=True, err=["compares the test statistic with alpha"]), R("D2", "Makes the decision: " + ("rejects" if rej else "fails to reject") + " the null hypothesis", ["rejects" if rej else "fails to reject"], requires="D1", err=["accepts the null hypothesis"]),
              R("D3", "States the conclusion about the population means in context (" + ("convincing" if rej else "not convincing") + " evidence)", ["conclusion in context about the populations"], requires="D2", err=["generalizes only to the samples"])]),
    ]
    for pt, tc in zip(parts, [["4.9"], ["4.7"], ["4.10"], ["4.10"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n4_q3_twomeans", "q3_inference", "4.10", ["4.6", "4.7", "4.9"], "3.E", f"Comparing the mean {c['what']} of two independent groups", stim, parts, 22,
                    [f"n1={n1}", f"n2={n2}", f"t={t:.3f}", f"df={df:.2f}", f"P={P:.4f}"], [ev("C", "test statistic t", t, 0.02), ev("C", "P-value", P, 0.002)],
                    ("A complete two-sample t test for a difference of means from summary statistics: hypotheses, conditions for both samples, test statistic and P-value, and a conclusion in context",
                     ["State hypotheses about the two population means", "Verify the random, independent, 10 percent and normality conditions for both samples", "Compute t and the one-sided P-value with technology and decide"],
                     [("a two-sample t procedure needs independent random samples, each under 10 percent of its population and approximately normal", "the problem gives both samples and describes their boxplots")], {"type": "text", "must_include": ["both samples", "boxplots"]},
                     "t is recomputed with scipy's unpooled routine and by hand, and the P-value by numerical integration of the t density with the Welch degrees of freedom; cases near 0.05 are excluded"),
                    ["procedure_choice", "condition_check", "claim_justification"])


# ======================= Q4. 이원표 조건부 확률 + 카이제곱 독립성 검정 (2.6 + 3.15 / 3.C) =======================
Q4_CTX = [dict(unit="students", u1="student", rh="Class", rows=("Freshman", "Sophomore", "Junior"), cols=("Band", "Choir", "Neither"), ph_s=("is in the band", "is in the choir", "is in neither"), ph_p=("are in the band", "are in the choir", "are in neither"), v1="class", v2="music activity", pop="students at a large high school", pick=(0, 0)),
          dict(unit="customers", u1="customer", rh="Age group", rows=("Under 30", "30 to 49", "50 or older"), cols=("Prefers online", "Prefers in store", "No preference"), ph_s=("prefers to shop online", "prefers to shop in a store", "has no preference"), ph_p=("prefer to shop online", "prefer to shop in a store", "have no preference"), v1="age group", v2="shopping preference", pop="customers of a retail chain", pick=(0, 0))]


def stfrq_n4_q4_chisq(rng):
    c = pick(rng, Q4_CTX)
    for _ in forever():
        base = np.array([rng.uniform(.25, .5), rng.uniform(.2, .4), 0.0]); base[2] = 1 - base[:2].sum()
        cells = []
        for i in range(3):
            tilt = np.array([rng.uniform(-.1, .1), rng.uniform(-.1, .1), 0.0]); tilt[2] = -tilt[:2].sum()
            pr = np.clip(base + tilt, 0.08, None); pr = pr / pr.sum(); per = rng.choice([60, 80, 100, 120])
            row = [int(round(per * v)) for v in pr]; row[-1] = per - sum(row[:-1]); cells.append(row)
        arr = np.array(cells); chi, P, dof, exp = ss.chi2_contingency(arr)
        P_ind = chi2_sf_num(chi, dof); agree(P, P_ind, tol=1e-6, name="chi_p")
        if exp.min() >= 8 and 0.003 < P < 0.18 and abs(P - 0.05) > 0.012:
            break
    N = int(arr.sum()); rt = arr.sum(axis=1); ct = arr.sum(axis=0)
    chi_ind = sum((arr[i, j] - rt[i] * ct[j] / N) ** 2 / (rt[i] * ct[j] / N) for i in range(3) for j in range(3)); agree(chi, chi_ind, tol=1e-9, name="chi2")
    rej = P < 0.05
    i0, j0 = 0, 0
    pcond = Fr(int(arr[i0, j0]), int(rt[i0])); e00 = rt[i0] * ct[j0] / N
    stim = {"kind": "stat_chart", "description": f"Two-way table of {c['v1']} and {c['v2']} for {N} {c['unit']}.", "data": {"chart": "two_way", "title": f"{cap(c['v1'])} and {c['v2']} of {N} {c['unit']}", "data": {"rowHeader": c["rh"], "rowLabels": list(c["rows"]), "colLabels": list(c["cols"]), "cells": arr.tolist()}}}
    parts = [
        part("A", f"The two-way table shown comes from a random sample of ${N}$ {c['unit']}. One {c['u1']} is selected from the sample at random. Given that the selected {c['u1']}'s {c['v1']} is {c['rows'][i0].lower()}, what is the probability that the {c['u1']} {c['ph_s'][j0]}? Round to three decimal places.", 2, "calculate", ["3.C"],
             f"$P = {int(arr[i0, j0])}/{int(rt[i0])} \\approx {float(pcond):.3f}$.",
             [R("A1", f"Uses the row total ({int(rt[i0])}) of the given group as the denominator", [str(int(rt[i0]))], nums=True, err=["divides by the grand total"]), R("A2", f"Calculates the conditional probability (answer {float(pcond):.3f})", [f"{float(pcond):.3f}"], requires="A1", nums=True, err=["divides by the column total"])]),
        part("B", f"The researcher plans a chi-square test of independence with these data. State the null and alternative hypotheses and the degrees of freedom.", 2, "explain", ["2.E"],
             f"$H_0$: {c['v1']} and {c['v2']} are independent in the population of {c['pop']}; $H_a$: {c['v1']} and {c['v2']} are not independent (are associated). $df = (3 - 1)(3 - 1) = {dof}$.",
             [R("B1", f"States $H_0$ that {c['v1']} and {c['v2']} are independent (no association) in the population, and $H_a$ that they are associated", ["independent in the population", "associated"], err=["states the hypotheses about the sample", "swaps the null and alternative hypotheses"]), R("B2", f"Gives the degrees of freedom as (rows - 1)(columns - 1) = {dof}", [str(dof)], nums=True, err=["uses the number of cells minus one"])]),
        part("C", f"Calculate the expected count for the cell of the {c['unit']} whose {c['v1']} is {c['rows'][i0].lower()} and who {c['ph_p'][j0]}, when the null hypothesis is true. Then verify that the large counts condition is met for the test.", 2, "calculate", ["4.E"],
             f"Expected count $= ({int(rt[i0])})({int(ct[j0])})/{N} \\approx {e00:.2f}$. All of the expected counts are at least $5$ (the smallest is ${exp.min():.2f}$), so the large counts condition is met.",
             [R("C1", f"Calculates the expected count (row total times column total divided by the grand total, answer {e00:.2f})", [f"{e00:.2f}"], nums=True, err=["uses the observed count", "divides the row total by the number of columns"]), R("C2", f"Verifies that all expected counts are at least 5 (the smallest is {exp.min():.2f})", ["all expected counts at least 5"], requires="C1", err=["checks the observed counts instead of the expected counts"])]),
        part("D", "Use technology to find the value of the chi-square statistic and the P-value for the test.", 2, "calculate", ["3.E"],
             f"$\\chi^2 \\approx {chi:.2f}$ with $df = {dof}$, and the P-value is about ${P:.4f}$.",
             [R("D1", f"Calculates the chi-square statistic (answer about {chi:.2f})", [f"{chi:.2f}"], nums=True, err=["sums the squared differences without dividing by the expected counts"]), R("D2", f"Finds the P-value from the chi-square distribution with {dof} degrees of freedom (answer about {P:.4f})", [f"{P:.4f}"], requires="D1", nums=True, err=["uses the wrong degrees of freedom"])]),
        part("E", "State a conclusion in the context of the problem at the significance level $\\alpha = 0.05$. Justify your answer using the P-value.", 2, "explain", ["4.G"],
             (f"The P-value ${P:.4f}$ is less than $0.05$, so reject $H_0$. There is convincing evidence of an association between {c['v1']} and {c['v2']} among the {c['pop']}." if rej else f"The P-value ${P:.4f}$ is greater than $0.05$, so fail to reject $H_0$. There is not convincing evidence of an association between {c['v1']} and {c['v2']} among the {c['pop']}."),
             [R("E1", f"Compares the P-value ({P:.4f}) with 0.05 ({'less' if rej else 'greater'}) and makes the decision to " + ("reject" if rej else "fail to reject") + " the null hypothesis", ["compares P-value with alpha", "rejects" if rej else "fails to reject"], nums=True, err=["accepts the null hypothesis", "compares the chi-square statistic with alpha"]),
              R("E2", "States the conclusion about an " + ("association" if rej else "association (or its absence)") + " between the two variables in the population in context, without claiming cause and effect", ["conclusion in context about the population", "no cause and effect"], requires="E1", err=["claims that one variable causes the other", "limits the conclusion to the sample"])]),
    ]
    for pt, tc in zip(parts, [["2.6"], ["3.14"], ["3.15"], ["3.15"], ["3.15"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n4_q4_chisq", "q4_integrated", "2.6", ["3.14", "3.15"], "3.C", f"A two-way table of {c['v1']} and {c['v2']}: probability and a chi-square test", stim, parts, 22,
                    [f"cells={arr.tolist()}", f"pcond={float(pcond):.3f}", f"chi={chi:.3f}", f"P={P:.4f}"], [ev("A", "conditional probability", float(pcond), 0.001), ev("C", "expected count", e00, 0.01), ev("D", "chi-square statistic", chi, 0.02), ev("D", "P-value", P, 0.002)],
                    ("An integrated question using a two-way table: a conditional probability, hypotheses and degrees of freedom, an expected count with the large counts condition, the chi-square statistic and P-value, and a conclusion in context",
                     ["Compute a conditional probability from the table", "Set up a chi-square test of independence and check its condition", "Compute the statistic and P-value and conclude in context"],
                     [("a chi-square test of independence compares observed counts with the counts expected when the variables are independent, and needs all expected counts at least 5", "the table gives all nine observed counts")], {"type": "two_way_table", "must_include": ["all cell counts"]},
                     "the statistic and the expected counts are recomputed with scipy's chi-square contingency routine and by hand, and the P-value by numerical integration of the chi-square density; cases near 0.05 are excluded"),
                    ["procedure_choice", "condition_check", "claim_justification"])


STAGE_FRQ = ["stfrq_n4_q1_stratified", "stfrq_n4_q2_table", "stfrq_n4_q3_twomeans", "stfrq_n4_q4_chisq"]
