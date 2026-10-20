"""AP Statistics 연습 시험 3(2026-10-19 추가 라운드) FRQ 원형 4종. 기존 공개 FRQ(조사 질문 + 5수 요약 이상치, 산점도 회귀 해석, 모비율 z 검정, 이원표 확률·이항·구간)와 틀이 다르다:
Q1 = 블록 실험 설계 + 두 처리 집단의 요약 비교, Q2 = 컴퓨터 출력으로 보는 회귀(표준오차 s·r²·잔차 해석), Q3 = 쌍체 평균 t 검정, Q4 = 정규분포·표본평균 분포·t 구간 통합.
2027 FRQ: 4문항 x 10점, 채점 행은 1점씩 10행. 정답·수치는 코드가 계산하고 독립 경로로 다시 계산하며, 서술 행은 문구가 아니라 의미로 채점한다(meaning_based). 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import R, frq_pack, ev


def cap(s):
    return s[0].upper() + s[1:]


# ======================= Q1. 블록 실험 설계와 두 처리 집단 비교 (1.13 / 1.A) =======================
Q1_CTX = [
    dict(units="tomato plants", u1="plant", factor="fertilizer", trt=("Fertilizer A", "Fertilizer B"), block="the greenhouse bench (sunny or shady)", resp="height after eight weeks", unit="centimeters", pop="tomato plants in the greenhouse", fvar="the number of tomatoes that each plant produces", fq="What is the typical number of tomatoes that a tomato plant in the greenhouse produces?", bvar="amount of sunlight"),
    dict(units="students", u1="student", factor="study condition", trt=("Music", "Silence"), block="grade level (grade 11 or grade 12)", resp="score on a memory test", unit="points", pop="students at the school", fvar="the number of hours of sleep that students get on a school night", fq="What is the typical number of hours of sleep that students at the school get on a school night?", bvar="grade level"),
]


def stfrq_n3_q1_block(rng):
    c = pick(rng, Q1_CTX)
    for _ in forever():
        m2 = rng.randint(40, 70) + rng.choice([0, 0.5]); d = pick(rng, [2.4, 3.1, 3.8, 4.6, 5.2]); m1 = round(m2 + d, 1)
        s1 = pick(rng, [2.1, 2.4, 2.8, 3.0]); s2 = round(s1 * pick(rng, [1.6, 1.8, 2.0]), 1)
        n = pick(rng, [18, 20, 24, 30])
        if abs(m1 - m2 - d) < 1e-9 and s2 > 1.5 * s1:
            break
    N = 2 * n
    diff = round(m1 - m2, 1)
    # 독립 경로: 분수 계산
    agree(float(Fr(str(m1)) - Fr(str(m2))), diff, name="diff"); agree(s2 / s1, round(s2 / s1, 6), name="ratio")
    stim = {"kind": "table", "description": f"Summary of the {c['resp']} for each treatment group.", "data": {"columns": ["Treatment", "Number of " + c["units"], f"Mean ({c['unit']})", f"Standard deviation ({c['unit']})"], "rows": [[c["trt"][0], str(n), f"{m1:g}", f"{s1:g}"], [c["trt"][1], str(n), f"{m2:g}", f"{s2:g}"]], "notes": f"Results for the two treatment groups of {N} {c['units']}."}}
    parts = [
        part("A", f"A researcher plans an experiment to compare two {c['factor']}s, {c['trt'][0]} and {c['trt'][1]}, using ${N}$ {c['units']}. The researcher will record the {c['resp']} of each {c['u1']}. Identify (i) the experimental units and (ii) the response variable.", 2, "explain", ["2.A"],
             f"(i) The experimental units are the ${N}$ {c['units']}. (ii) The response variable is the {c['resp']} ({c['unit']}).",
             [R("A1", f"Identifies the experimental units as the {N} {c['units']} (the individuals that receive a treatment)", [c["units"]], err=["names the treatments as the units", "names the blocks as the units"]),
              R("A2", f"Identifies the response variable as the {c['resp']}", [c["resp"]], err=["names the explanatory variable (the " + c["factor"] + ") as the response"])]),
        part("B", f"The researcher decides to block the {c['units']} by {c['block']}. (i) Explain the purpose of blocking in this experiment. (ii) Describe how to assign the treatments at random within the blocks.", 2, "explain", ["2.B"],
             f"(i) Blocking groups {c['units']} that are alike in {c['bvar']}, so the treatments are compared within similar units and variability due to {c['bvar']} is removed from the comparison. (ii) Within each block separately, randomly assign half of the {c['units']} to {c['trt'][0]} and the other half to {c['trt'][1]}, for example by drawing names or using random numbers.",
             [R("B1", f"Explains that blocking compares the treatments among similar units so that variability due to the blocking variable ({c['bvar']}) does not hide or confuse the effect of the treatments", ["compares similar units", "controls variability from the blocking variable"], alt=["each treatment appears in every block so the blocking variable cannot explain a difference"], err=["says blocking makes the sample random", "says blocking removes the need for random assignment"]),
              R("B2", "Describes random assignment carried out separately within each block, with about half of the units in each block receiving each treatment", ["random assignment within each block", "half of each block to each treatment"], alt=["shuffle the names in each block and give the first half one treatment"], err=["randomly assigns across all units ignoring the blocks", "assigns the treatments by choice of the units"])]),
        part("C", f"The table shown gives the mean {c['resp']} of each treatment group. Calculate the difference in the means, {c['trt'][0].lower()} minus {c['trt'][1].lower()}.", 1, "calculate", ["3.B"],
             f"${m1:g} - {m2:g} = {diff:g}$ {c['unit']}.",
             [R("C1", f"Calculates the difference in the means (answer {diff:g} {c['unit']}, with the subtraction in the stated order)", [f"{diff:g}"], nums=True, err=["subtracts in the opposite order", "divides instead of subtracts"])]),
        part("D", f"Compare the distributions of the {c['resp']} for the two treatment groups, using the means and the standard deviations in the table. Your comparison should address both center and spread, in context.", 2, "explain", ["4.A"],
             f"The mean {c['resp']} is about ${diff:g}$ {c['unit']} greater for {c['trt'][0].lower()} (${m1:g}$) than for {c['trt'][1].lower()} (${m2:g}$). The responses under {c['trt'][1].lower()} are more variable: the standard deviation is ${s2:g}$ {c['unit']}, compared with ${s1:g}$ {c['unit']} for {c['trt'][0].lower()}.",
             [R("D1", f"Compares the centers in context: the mean {c['resp']} is greater for {c['trt'][0].lower()} than for {c['trt'][1].lower()}", [f"{m1:g}", f"{m2:g}", "greater for " + c["trt"][0].lower()], nums=True, err=["compares the groups without naming the response or the treatments", "reverses the direction of the difference"]),
              R("D2", f"Compares the spreads in context: the standard deviation is greater for {c['trt'][1].lower()} (${s2:g}$) than for {c['trt'][0].lower()} (${s1:g}$), so its responses are more variable", [f"{s2:g}", f"{s1:g}", "more variable for " + c["trt"][1].lower()], nums=True, err=["says the group with the greater mean is more variable", "interprets the standard deviation as the center"])]),
        part("E", f"The researcher also wants to study {c['fvar']} among the {c['pop']}. State a valid investigative question about this topic that requires a statistical investigation. Your question should name the population of interest, name the variable that would be measured, and be answerable by collecting and analyzing data that vary from individual to individual.", 3, "explain", ["1.A"],
             f"For example: {c['fq']}",
             [R("E1", f"Names the population of interest (the {c['pop']})", [c["pop"]], err=["names only the sample or one individual"]),
              R("E2", f"Names the variable that would be measured ({c['fvar']})", [c["fvar"]], err=["states no variable"]),
              R("E3", "Poses a question that anticipates variability among individuals and can be answered with data (not a single fact or an opinion)", ["anticipates variability", "answerable with data"], err=["asks a yes-or-no fact", "asks for an opinion"])]),
    ]
    for pt, tc in zip(parts, [["1.13"], ["1.13"], ["1.7"], ["1.9"], ["1.10"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n3_q1_block", "q1_multifocus", "1.10", ["1.7", "1.9", "1.13"], "1.A", f"A blocked experiment comparing two {c['factor']}s for {c['units']}", stim, parts, 22,
                    [f"n={n}", f"m1={m1}", f"m2={m2}", f"s1={s1}", f"s2={s2}"], [ev("C", "difference of means", diff, 0.01), ev("D", "ratio of standard deviations", s2 / s1, 0.02)],
                    ("A multi-focus question combining experimental units and response, the purpose and randomization of blocking, a difference of group means, a comparison of two distributions by center and spread and a valid investigative question",
                     ["Identify the experimental units and the response variable", "Explain blocking and random assignment within blocks", "Compare two groups by center and spread from summary statistics", "Write a valid investigative question"],
                     [("blocking compares treatments within similar units and the random assignment is done within each block", "the stem names the blocking variable and the table gives the group summaries")], {"type": "table", "must_include": ["group means", "group standard deviations"]},
                     "the difference of the means is recomputed with exact fractions and the ratio of the standard deviations is checked to exceed 1.5 so the spread comparison is unambiguous"),
                    ["claim_justification", "representation_reading", "procedure_choice"])


# ======================= Q2. 컴퓨터 출력으로 보는 회귀 (5.4 / 4.D) =======================
Q2_CTX = [
    dict(x="monthly advertising spending (thousands of dollars)", y="monthly sales (thousands of units)", xs="advertising spending", ys="sales", xu="thousand dollars", yu="thousand units", xr=(2, 14), a=(8, 20), b=(1.4, 3.2), s=(1.5, 3.0), units="stores", ex="a store whose monthly advertising spending is"),
    dict(x="daily high temperature (degrees Celsius)", y="daily sales of bottled water (hundreds of bottles)", xs="daily high temperature", ys="bottled water sales", xu="degrees Celsius", yu="hundred bottles", xr=(10, 34), a=(-3, 4), b=(0.9, 1.7), s=(2.5, 5.0), units="days", ex="a day whose high temperature is"),
]


def stfrq_n3_q2_output(rng):
    c = pick(rng, Q2_CTX)
    for _ in forever():
        n = pick(rng, [18, 22, 26, 30]); a = round(rng.uniform(*c["a"]), 2); b = round(rng.uniform(*c["b"]), 2); r = pick(rng, [0.6, 0.7, 0.8, 0.9]); r2 = round(r * r * 100, 1)
        s = round(rng.uniform(*c["s"]), 2)
        x0 = rng.randint(c["xr"][0] + 2, c["xr"][1] - 2); yh = a + b * x0
        resid = round(pick(rng, [-1, 1]) * rng.uniform(0.8, 2.2) * s, 1)
        y0 = round(yh + resid, 1); resid_act = round(y0 - yh, 2)
        if abs(resid_act) >= 0.5 * s:
            break
    agree(math.sqrt(r2 / 100), r, tol=1e-6, name="r")
    out = {"title": f"Regression Analysis: {c['ys'].capitalize()} versus {c['xs']}", "sections": [{"columns": ["Predictor", "Coef"], "rows": [["Constant", f"{a:.2f}"], [c["xs"].capitalize(), f"{b:.2f}"]]}, {"columns": ["S", "R-Sq"], "rows": [[f"{s:.2f}", f"{r2:.1f}%"]]}]}
    stim = {"kind": "stat_chart", "description": f"Computer output for a least-squares regression of {c['ys']} on {c['xs']}.", "data": {"chart": "output", "output": out}}
    lo = (resid_act < 0)
    sgn = "+" if a >= 0 else "-"
    parts = [
        part("A", f"A researcher uses data from ${n}$ {c['units']} to model the relationship between {c['xs']} ($x$, in {c['xu']}) and {c['ys']} ($y$, in {c['yu']}). The computer output shown gives the results of a least-squares regression. (i) Write the equation of the least-squares regression line. (ii) Interpret the $y$-intercept of the line in context, and say whether it has a meaningful interpretation.", 2, "explain", ["4.D"],
             f"(i) $\\hat y = {a:.2f} + {b:.2f}x$ (using the constant {a:.2f} and the coefficient {b:.2f}). (ii) When the {c['xs']} is $0$, the predicted {c['ys']} is {a:.2f} {c['yu']}; this is meaningful only if $x = 0$ lies within the range of the data, because otherwise it is an extrapolation.",
             [R("A1", f"Writes the equation with the intercept {a:.2f} and the slope {b:.2f}, in the form $\\hat y = {a:.2f} + {b:.2f}x$", [f"{a:.2f}", f"{b:.2f}"], nums=True, err=["swaps the intercept and the slope", "omits the hat on the predicted value"]),
              R("A2", f"Interprets the intercept as the predicted {c['ys']} when the {c['xs']} equals $0$ and comments on whether $0$ is within the range of the data", ["predicted value when x is 0", "meaningful only if 0 is within the range of the data"], alt=["says that the intercept is the predicted value at zero and that it may not be meaningful when zero is not a possible or observed value of x"], err=["interprets the intercept as the change in y per unit of x", "says the intercept is always meaningful"])]),
        part("B", f"The regression line is used for {c['ex']} ${x0}$ {c['xu']}. (i) Calculate the predicted {c['ys']}. (ii) The actual {c['ys']} for one such {c['units'][:-1]} was ${y0:g}$ {c['yu']}. Calculate the residual and interpret it in context.", 2, "calculate", ["3.B"],
             f"(i) $\\hat y = {a:.2f} + {b:.2f}({x0}) = {yh:.2f}$. (ii) Residual = ${y0:g} - {yh:.2f} = {resid_act:.2f}$; the actual {c['ys']} was {abs(resid_act):.2f} {c['yu']} {'below' if lo else 'above'} the value predicted by the line.",
             [R("B1", f"Calculates the predicted value (answer {yh:.2f})", [f"{yh:.2f}"], nums=True, err=["uses the slope as the intercept"]),
              R("B2", f"Calculates the residual as actual minus predicted (answer {resid_act:.2f}) and says that the actual value is {'below' if lo else 'above'} the prediction", [f"{resid_act:.2f}", "below" if lo else "above"], requires="B1", nums=True, err=["subtracts in the wrong order", "gives the residual without interpreting its sign"])]),
        part("C", f"The output gives $S = {s:.2f}$. Interpret the value of $S$ in the context of the data.", 2, "explain", ["4.D"],
             f"The actual {c['ys']} values typically differ from the values predicted by the regression line by about {s:.2f} {c['yu']}.",
             [R("C1", f"States that $S$ ({s:.2f}) is the typical size (about the typical distance) of the residuals, that is, of the differences between actual and predicted values", [f"{s:.2f}", "typical size of the prediction errors"], nums=True, err=["says S is the slope", "says S is the percent of variation explained"]),
              R("C2", f"Gives the interpretation in context with units (the {c['ys']} in {c['yu']}, predicted from the {c['xs']})", ["in context", c["yu"]], requires="C1", err=["omits the units or the context"])]),
        part("D", f"Use the output to find the correlation coefficient $r$ between {c['xs']} and {c['ys']}, and describe the direction and strength of the linear relationship.", 2, "calculate", ["3.B"],
             f"$r = +\\sqrt{{{r2 / 100:.3f}}} = {r}$, because the slope is {'positive' if b > 0 else 'negative'}. This is a {'strong' if r >= 0.8 else 'moderately strong'} positive linear relationship.",
             [R("D1", f"Calculates $r$ as the square root of $R^2$ with the sign of the slope (answer $r = {r}$)", [f"{r}"], nums=True, err=["reports r squared as the correlation", "gives the wrong sign"]),
              R("D2", "Describes the relationship as positive linear with a strength that matches the value of $r$", ["positive", "strength"], requires="D1", nums=True, err=["describes the strength with the percent explained instead of r"])]),
        part("E", f"A residual plot for the regression shows a clear U-shaped pattern: the residuals are positive for the smallest and largest values of {c['xs']} and negative in the middle. Does the residual plot support the use of a linear model for these data? Justify your answer.", 2, "explain", ["4.D"],
             "No. A residual plot for an appropriate linear model shows no pattern; the U-shaped pattern shows that the relationship is curved, so a linear model is not appropriate.",
             [R("E1", "States that the residual plot does not support a linear model", ["not appropriate"], err=["says a large r squared shows the model is appropriate"]),
              R("E2", "Justifies the answer by the curved (U-shaped) pattern in the residuals, whereas an appropriate linear model leaves residuals with no pattern", ["curved pattern in the residuals", "no pattern expected"], requires="E1", err=["justifies with the correlation alone"])]),
    ]
    for pt, tc in zip(parts, [["5.3"], ["5.4"], ["5.4"], ["5.2"], ["5.4"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n3_q2_output", "q2_regression", "5.4", ["5.2", "5.3"], "4.D", f"Regression of {c['ys']} on {c['xs']}: reading computer output", stim, parts, 22,
                    [f"a={a}", f"b={b}", f"s={s}", f"r2={r2}", f"x0={x0}"], [ev("B", "predicted value", yh, 0.02), ev("B", "residual", resid_act, 0.02), ev("D", "correlation", r, 0.005)],
                    ("Read a regression output: equation and intercept, a prediction and its residual, the meaning of S, the correlation from R-squared and the sign of the slope, and a judgment from a residual pattern",
                     ["Write the line and interpret the intercept", "Compute a prediction and a residual and interpret S", "Find r from R-squared and the slope sign and judge the model from the residual pattern"],
                     [("the intercept, S, R-squared and the slope sign are all read from the output", "the output block shows the coefficients, S and R-squared")], {"type": "computer_output", "must_include": ["coefficients", "S", "R-Sq"]},
                     "the prediction and the residual are recomputed from the coefficients and r is recomputed from R-squared by a square root, checked to be a one-decimal value"),
                    ["interpretation", "representation_reading", "claim_justification"])


# ======================= Q3. 쌍체 평균 t 검정 (4.5 / 3.E) =======================
Q3_CTX = [
    dict(who="a running coach", unit_pl="runners", u1="runner", what="time to run 400 meters", before="before", after="after", prog="a six-week training program", diff="before minus after", unit="seconds", sus="reduces", N=400, claim="the mean time decreases", better="decrease", pop="runners in the league"),
    dict(who="a teacher", unit_pl="students", u1="student", what="score on a vocabulary quiz", before="before", after="after", prog="a month of using a vocabulary app", diff="after minus before", unit="points", sus="improves", N=600, claim="the mean score increases", better="increase", pop="students at the school"),
]


def stfrq_n3_q3_matched(rng):
    c = pick(rng, Q3_CTX)
    for _ in forever():
        n = pick(rng, [14, 16, 18, 20, 24]); sd = pick(rng, [2.4, 3.0, 3.6, 4.2, 5.0, 6.1]); dbar = round(pick(rng, [0.6, 0.8, 1.0, 1.2, 1.5]) * sd * pick(rng, [0.7, 1.0, 1.3]) / math.sqrt(n) * 2.2, 1)
        se = sd / math.sqrt(n); t = dbar / se; df = n - 1
        P = float(ss.t.sf(t, df)); P_ind = 1 - t_cdf_num(t, df)
        agree(P, P_ind, tol=1e-6, name="t_p")
        if 0.003 < P < 0.18 and abs(P - 0.05) > 0.012 and dbar > 0 and dbar != 1.0:
            break
    rej = P < 0.05
    stim = {"kind": "text", "description": f"{cap(c['who'])} wants to know whether {c['prog']} {c['sus']} the {c['what']}. The {c['what']} of each of ${n}$ randomly selected {c['unit_pl']} was recorded {c['before']} and {c['after']} the program. For each {c['u1']}, the difference ({c['diff']}) was calculated. The mean of the ${n}$ differences is ${dbar:g}$ {c['unit']} and the standard deviation of the differences is ${sd:g}$ {c['unit']}. A dotplot of the differences is roughly symmetric with no outliers. There are about ${c['N']}$ {c['pop']}. Use a significance level of $\\alpha = 0.05$.", "data": {}}
    parts = [
        part("A", f"State the null and alternative hypotheses for a test of whether the program {c['sus']} the {c['what']}. Define any parameter you use.", 2, "explain", ["2.E"],
             f"Let $\\mu_d$ be the mean of the differences ({c['diff']}) for all {c['pop']}. $H_0: \\mu_d = 0$ and $H_a: \\mu_d > 0$.",
             [R("A1", f"States $H_0: \\mu_d = 0$ with $\\mu_d$ defined as the population mean of the differences ({c['diff']}) in context", ["mu_d = 0", "population mean difference"], err=["writes hypotheses about the sample mean difference", "defines two separate population means for paired data"]),
              R("A2", "States $H_a: \\mu_d > 0$ in the direction of the claim, with the same definition of the difference", ["mu_d > 0"], err=["uses a two-sided alternative", "uses the opposite direction"])]),
        part("B", f"Verify that the conditions for the matched-pairs $t$ procedure are met.", 2, "explain", ["4.E"],
             f"Random: the ${n}$ {c['unit_pl']} were selected at random. 10% condition: ${n}$ is less than 10% of ${c['N']}$. Normality: the dotplot of the differences is roughly symmetric with no outliers, so the differences are approximately normal even though ${n}$ is less than $30$.",
             [R("B1", f"States that the {c['unit_pl']} were randomly selected and that the sample size {n} is less than 10% of the population ({c['N']})", ["random sample", "10% condition"], err=["checks the 10% condition against the sample size of the population"]),
              R("B2", f"Checks normality on the differences: the dotplot of the differences is roughly symmetric with no outliers, which is acceptable for a sample of only {n}", ["differences", "symmetric with no outliers"], err=["checks normality of the before and after values instead of the differences", "applies the sample size 30 rule although n is smaller"])]),
        part("C", "Carry out the test: identify the procedure, and calculate the test statistic and the P-value.", 3, "calculate", ["3.E"],
             f"Matched-pairs $t$ test. $t = {dbar:g}/({sd:g}/\\sqrt{{{n}}}) \\approx {t:.2f}$ with $df = {n - 1}$; the P-value for the one-sided alternative is about ${P:.4f}$.",
             [R("C1", "Names the procedure: a matched-pairs (one-sample on the differences) t test", ["matched-pairs t test"], err=["names a two-sample t test"]),
              R("C2", f"Calculates the test statistic (answer t of about {t:.2f}, df {n - 1})", [f"{t:.2f}"], requires="C1", nums=True, err=["uses the standard deviation instead of the standard error"]),
              R("C3", f"Finds the P-value from the t distribution with {n - 1} degrees of freedom for the one-sided alternative (answer about {P:.4f})", [f"{P:.4f}"], requires="C2", nums=True, err=["doubles the P-value for a one-sided test", "uses the wrong degrees of freedom"])]),
        part("D", "State a conclusion in the context of the problem. Justify your answer using the P-value and the significance level.", 3, "explain", ["4.G"],
             (f"The P-value ${P:.4f}$ is less than $0.05$, so reject $H_0$. There is convincing evidence that the mean difference is greater than $0$; that is, the program {c['sus']} the {c['what']} on average." if rej else
              f"The P-value ${P:.4f}$ is greater than $0.05$, so fail to reject $H_0$. There is not convincing evidence that the program {c['sus']} the {c['what']} on average."),
             [R("D1", f"Compares the P-value ({P:.4f}) with the significance level 0.05 ({'less' if rej else 'greater'})", ["compares P-value with alpha"], nums=True, err=["compares the test statistic with alpha"]),
              R("D2", "Makes the decision: " + ("rejects" if rej else "fails to reject") + " the null hypothesis", ["rejects" if rej else "fails to reject"], requires="D1", err=["accepts the null hypothesis"]),
              R("D3", "States the conclusion about the population mean difference in context (" + ("convincing" if rej else "not convincing") + " evidence)", ["conclusion in context about the population"], requires="D2", err=["generalizes only to the sample", "claims that the program is proven"])]),
    ]
    for pt, tc in zip(parts, [["4.4"], ["4.4"], ["4.5"], ["4.5"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n3_q3_matched", "q3_inference", "4.5", ["4.2", "4.4"], "3.E", f"Testing whether {c['prog']} {c['sus']} the {c['what']}", stim, parts, 22,
                    [f"n={n}", f"dbar={dbar}", f"sd={sd}", f"t={t:.3f}", f"P={P:.4f}"], [ev("C", "test statistic t", t, 0.02), ev("C", "P-value", P, 0.001)],
                    ("A complete matched-pairs t test for a mean difference: hypotheses, conditions on the differences, test statistic and P-value, and a conclusion in context",
                     ["State hypotheses about the population mean difference", "Verify the random, 10 percent and normality conditions on the differences", "Compute t and the one-sided P-value and decide"],
                     [("a matched-pairs t procedure needs random selection, a sample under 10 percent of the population and approximately normal differences", "the problem gives the sample, the population size and a description of the differences")], {"type": "text", "must_include": ["sample", "differences"]},
                     "t and the P-value are recomputed with scipy and with numerical integration of the t density, and the decision at alpha 0.05 is checked for a margin of at least 0.012"),
                    ["procedure_choice", "condition_check", "claim_justification"])


# ======================= Q4. 정규분포 · 표본평균의 분포 · t 구간 (2.11 + 4.1 / 3.C) =======================
Q4_CTX = [dict(item="a bag of rice", pl="bags of rice", meas="weight", unit="grams", label=500, mu=(503, 508), sd=(5, 8), mach="a filling machine", sample_what="bags", claim="The label on each bag says that it contains $500$ grams of rice."),
          dict(item="a battery", pl="batteries", meas="lifetime", unit="hours", label=40, mu=(41, 44), sd=(3, 5), mach="a production line", sample_what="batteries", claim="The package of each battery says that it lasts $40$ hours.")]


def stfrq_n3_q4_clt(rng):
    c = pick(rng, Q4_CTX)
    for _ in forever():
        mu = rng.randint(*c["mu"]); sd = rng.randint(*c["sd"]); cut = c["label"] + rng.choice([-2, -1, 0, 1]) if c["label"] == 500 else c["label"] + rng.choice([-1, 0])
        n1 = pick(rng, [16, 25, 36]); n2 = pick(rng, [20, 25])
        xb = mu + rng.choice([-1.0, -0.5, 0.5, 1.0]) + 0.0; s = sd + rng.choice([-1.0, 0.0, 1.0])
        z1 = (cut - mu) / sd; pA = ncdf(z1); pA2 = ss.norm.cdf(cut, mu, sd)
        agree(pA, pA2, tol=1e-9, name="pA")
        sem = sd / math.sqrt(n1); z2 = (cut - mu) / sem; pC = ncdf(z2); pC2 = ss.norm.cdf(cut, mu, sem); agree(pC, pC2, tol=1e-9, name="pC")
        df = n2 - 1; t = tstar(0.95, df); se = s / math.sqrt(n2); lo, hi = xb - t * se, xb + t * se
        if 0.1 < pA < 0.9 and abs(pA - pC) > 0.08 and 0.003 < pC < 0.997:
            break
    covers = lo <= c["label"] <= hi
    stim = {"kind": "text", "description": f"{c['claim']} The manufacturer reports that the {c['meas']} of {c['item']} produced by {c['mach']} is approximately normally distributed with mean ${mu}$ {c['unit']} and standard deviation ${sd}$ {c['unit']}. An inspector who does not rely on the report selects a random sample of ${n2}$ {c['sample_what']} from a large production run and finds a sample mean of ${xb:g}$ {c['unit']} and a sample standard deviation of ${s:g}$ {c['unit']}. For a $95\\%$ confidence interval with ${df}$ degrees of freedom, $t^* = {t:.3f}$.", "data": {}}
    parts = [
        part("A", f"What is the probability that a randomly selected {c['item'][2:]} has a value of less than ${cut}$ {c['unit']}? Round to three decimal places.", 2, "calculate", ["3.C"],
             f"$z = ({cut} - {mu})/{sd} = {z1:.2f}$ and $P(X < {cut}) \\approx {pA:.3f}$.",
             [R("A1", f"Standardizes the value: $z = ({cut} - {mu})/{sd} \\approx {z1:.2f}$", [f"{z1:.2f}"], nums=True, err=["divides by the wrong standard deviation", "subtracts in the wrong order"]),
              R("A2", f"Finds the probability from the normal distribution (answer {pA:.3f})", [f"{pA:.3f}"], requires="A1", nums=True, err=["finds the upper tail"])]),
        part("B", f"A random sample of ${n1}$ {c['pl']} is selected. State the mean and the standard deviation of the sampling distribution of the sample mean $\\bar x$.", 2, "calculate", ["3.D"],
             f"The mean is ${mu}$ {c['unit']} and the standard deviation is ${sd}/\\sqrt{{{n1}}} = {sem:.3f}$ {c['unit']}.",
             [R("B1", f"States that the mean of the sampling distribution of the sample mean is {mu}", [f"{mu}"], nums=True, err=["gives the sample mean of the other sample"]),
              R("B2", f"Calculates the standard deviation of the sampling distribution as ${sd}/\\sqrt{{{n1}}} \\approx {sem:.3f}$", [f"{sem:.3f}"], nums=True, err=["uses the population standard deviation without dividing by the square root of n"])]),
        part("C", f"For a random sample of ${n1}$ {c['pl']}, what is the probability that the sample mean is less than ${cut}$ {c['unit']}? Compare this probability with your answer to part (A) and explain why the two probabilities are different.", 2, "explain", ["4.C"],
             f"$z = ({cut} - {mu})/{sem:.3f} = {z2:.2f}$ and $P(\\bar x < {cut}) \\approx {pC:.3f}$, which is {'smaller' if pC < pA else 'larger'} than ${pA:.3f}$. Sample means vary less than individual values (the standard deviation of $\\bar x$ is $\\sigma/\\sqrt{{n}}$), so a sample mean is {'less' if pC < pA else 'more'} likely than a single value to fall below ${cut}$, because ${cut}$ is {'below' if cut < mu else 'above'} the population mean.",
             [R("C1", f"Calculates the probability for the sample mean (answer {pC:.3f}) and says that it is {'smaller' if pC < pA else 'larger'} than the probability for one value", [f"{pC:.3f}", "smaller" if pC < pA else "larger"], nums=True, err=["uses the standard deviation of individual values", "states the comparison in the wrong direction"]),
              R("C2", "Explains that the distribution of the sample mean has a smaller standard deviation (less variability) than the distribution of individual values", ["sampling distribution has less variability", "standard deviation divided by the square root of n"], alt=["averages of several values are less spread out than single values"], err=["says the sample mean has a different mean", "attributes the difference to the shape of the population"])]),
        part("D", f"Use the inspector's sample of ${n2}$ {c['sample_what']} to construct a $95\\%$ confidence interval for the mean {c['meas']} of all {c['pl']} produced. Round the endpoints to two decimal places.", 2, "calculate", ["3.E"],
             f"${xb:g} \\pm {t:.3f}({s:g}/\\sqrt{{{n2}}})$ gives $({lo:.2f}, {hi:.2f})$.",
             [R("D1", "Identifies a one-sample t interval for a mean and uses the standard error $s/\\sqrt{n}$ with the given critical value", ["one-sample t interval", "standard error"], err=["uses a z interval", "uses s without dividing by the square root of n"]),
              R("D2", f"Calculates the interval (answer ({lo:.2f}, {hi:.2f}))", [f"{lo:.2f}", f"{hi:.2f}"], requires="D1", nums=True, err=["uses the wrong critical value"])]),
        part("E", f"Does the interval from part (D) provide convincing evidence that the mean {c['meas']} of all {c['pl']} produced is different from the labeled value of ${c['label']}$ {c['unit']}? Justify your answer.", 2, "explain", ["4.F"],
             (f"No. The labeled value ${c['label']}$ is inside the interval $({lo:.2f}, {hi:.2f})$, so it is a plausible value for the population mean and the interval does not provide convincing evidence of a difference." if covers else
              f"Yes. The labeled value ${c['label']}$ is not inside the interval $({lo:.2f}, {hi:.2f})$, so it is not a plausible value for the population mean, which provides convincing evidence that the mean differs from ${c['label']}$."),
             [R("E1", "Compares the labeled value with the interval and says whether it is inside the interval", [f"{c['label']}", "inside the interval" if covers else "not inside the interval"], nums=True, err=["compares the labeled value with the sample mean only"]),
              R("E2", "States the conclusion in context: " + ("the interval does not provide convincing evidence of a difference" if covers else "there is convincing evidence that the mean differs from the label") + ", because the labeled value is " + ("a plausible" if covers else "not a plausible") + " value for the population mean", ["conclusion in context", "plausible value"], requires="E1", err=["says the interval contains the true mean with probability 0.95", "says the mean equals the label"])]),
    ]
    for pt, tc in zip(parts, [["2.11"], ["4.1"], ["2.12"], ["4.2"], ["4.3"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n3_q4_clt", "q4_integrated", "2.11", ["2.12", "4.1", "4.2", "4.3"], "3.C", f"{cap(c['item'])}: a single value, a sample mean and a confidence interval", stim, parts, 22,
                    [f"mu={mu}", f"sd={sd}", f"cut={cut}", f"n1={n1}", f"n2={n2}", f"xb={xb}", f"s={s}"], [ev("A", "probability for one value", pA, 0.001), ev("B", "standard deviation of the sample mean", sem, 0.001), ev("C", "probability for the sample mean", pC, 0.001), ev("D", "interval lower endpoint", lo, 0.01), ev("D", "interval upper endpoint", hi, 0.01)],
                    ("An integrated question: a normal probability for one value, the mean and standard deviation of the sampling distribution of the sample mean, a comparison and explanation, a t interval and a claim about a labeled value",
                     ["Standardize and find a normal probability", "Find the standard deviation of a sample mean and compare probabilities", "Construct and use a t interval"],
                     [("the sample mean has standard deviation sigma over the square root of n and the interval is judged against the labeled value", "the box gives the population model, the sample and the critical value")], {"type": "text", "must_include": ["mean and standard deviation", "sample statistics", "critical value"]},
                     "normal probabilities are recomputed with math.erf and scipy, the standard deviation of the sample mean is checked, and the t critical value is obtained by numerical integration of the t density"),
                    ["procedure_choice", "interpretation", "claim_justification"])


STAGE_FRQ = ["stfrq_n3_q1_block", "stfrq_n3_q2_output", "stfrq_n3_q3_matched", "stfrq_n3_q4_clt"]
