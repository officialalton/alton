"""AP Statistics S2-a — FRQ 원형 4종(2026-10-12). 2027 FRQ: 4문항 × 10점, 채점 행은 1점씩 10행(CED 샘플 4문항 모두 같은 구조).
Q1 복합 초점(Practice 1·2: 조사 질문 파트 E = 스킬 1.A·토픽 1.10), Q2 자료 분석·모형(Practice 3·4: 회귀), Q3 추론(가설검정), Q4 단원 통합.
정답·수치·기대값은 코드가 계산(독립 경로로 재계산)하고 모범 답안은 '공식 채점이 아님'을 밝히는 자기 점검용이다. 학생 응답은 전부 키보드 입력(통계는 완전 디지털 — 필기 입력 없음)."""
from stats_common import *
from calc_ab_frq import row, part
from bp import frq_blueprint

SUB = "ap_statistics"


def R(rid, crit, req, alt=None, err=None, requires=None, nums=False):
    """1점 채점 행."""
    return row(rid, 1, crit, req, None, alt, err, requires, False, nums, None, False)


def _pack(arch, template, topic, extra, skill, title, stim, parts, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == 10 and sum(len(p["rubric_rows"]) for p in parts) == 10 and all(r["points"] == 1 for p in parts for r in p["rubric_rows"])
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": 10, "est_minutes": minutes, "facts": facts, "expected_values": expected}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUB, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


def _ev(part, quantity, value, tol):
    return {"part": part, "quantity": quantity, "value": float(value), "unit": "", "tolerance": tol}


# ======================= Q1. 복합 초점: 조사 질문·자료 요약·실험 설계 (1.10 / 1.A) =======================
Q1_CTX = [
    dict(who="students at a large high school", expl="whether a student exercises before school", yes="exercise before school", no="do not exercise before school", resp="number of minutes spent on homework the previous night", unit="minutes", pop="all students at the school",
         follow="the number of hours of sleep that students get on a school night", follow_q="What is the typical number of hours of sleep that students at the school get on a school night?"),
    dict(who="adult members of a community center", expl="whether a member takes a weekly yoga class", yes="take a yoga class", no="do not take a yoga class", resp="self-rated stress score", unit="points", pop="all adult members of the center",
         follow="the number of hours per week that members use the center", follow_q="What is the typical number of hours per week that adult members of the center use the center?"),
]


def stfrq_q1_design(rng):
    c = pick(rng, Q1_CTX)
    for _ in forever():
        q1 = rng.randint(55, 75); iqr = rng.randint(6, 14); q3 = q1 + iqr; med = q1 + rng.randint(2, iqr - 2)
        lo = q1 - rng.randint(4, 10); hi = q3 + rng.randint(3, 8)
        fence = q3 + 1.5 * iqr
        val = int(fence) + rng.choice([-2, 3, 4, -3])
        if val > hi and val != fence and abs(val - fence) >= 2:
            break
    # 독립 경로: 규칙을 분수로 다시 계산
    f_hi = Fr(3, 2) * (q3 - q1) + q3
    assert float(f_hi) == fence and (val > f_hi) == (val > fence)
    outlier = val > fence
    stim = {"kind": "table", "description": f"Five-number summary of the {c['resp']} for the sample of {c['who']} in the study.", "data": {"columns": ["Statistic", f"Value ({c['unit']})"], "rows": [["Minimum", str(lo)], ["First quartile", str(q1)], ["Median", str(med)], ["Third quartile", str(q3)], ["Maximum", str(hi)]], "notes": f"Summary of the {c['resp']} for a sample of {c['who']}."}}
    nvol = 2 * rng.choice([20, 30, 40])
    parts = [
        part("A", f"A researcher plans a study of {c['who']}. For each person the researcher records {c['expl']} and the {c['resp']}. Identify the explanatory variable and the response variable in this study.", 2, "explain", ["2.A"],
             f"Explanatory variable: {c['expl']}. Response variable: the {c['resp']}.",
             [R("A1", f"Identifies the explanatory variable as {c['expl']}", [c["expl"]], err=["names the response as explanatory"]),
              R("A2", f"Identifies the response variable as the {c['resp']}", [c["resp"]], err=["names the group as the response"])]),
        part("B", f"The table shown gives the five-number summary of the {c['resp']} for the sample of {c['who']} in the study. (i) Calculate the interquartile range. (ii) Is a value of ${val}$ {c['unit']} an outlier according to the $1.5\\times\\mathrm{{IQR}}$ rule? Justify your answer with a calculation.", 2, "calculate", ["3.B"],
             f"(i) IQR = {q3} - {q1} = {iqr}. (ii) The upper boundary is {q3} + 1.5({iqr}) = {fence:g}; since {val} is {'greater' if outlier else 'not greater'} than {fence:g}, {val} {'is' if outlier else 'is not'} an outlier.",
             [R("B1", f"Calculates the interquartile range (answer {iqr})", [str(iqr)], nums=True, err=["uses the range instead of the IQR"]),
              R("B2", f"Compares {val} with the boundary Q3 + 1.5 IQR = {fence:g} and states that it {'is' if outlier else 'is not'} an outlier", [f"{fence:g}", "outlier" if outlier else "not an outlier"], requires="B1", nums=True, err=["adds IQR rather than 1.5 IQR", "uses the lower boundary"])]),
        part("C", f"The researcher is considering an experiment with ${nvol}$ volunteers from {c['pop']}. (i) Describe a method to assign each volunteer at random to one of the two groups so that the groups are the same size. (ii) Explain why random assignment makes it reasonable to conclude that a difference in the {c['resp']} was caused by the treatment.", 2, "explain", ["2.B"],
             "(i) Number the volunteers, use a random number generator (or draw names from a hat) to choose half of them for the treatment group; the rest form the other group. (ii) Random assignment tends to balance other variables across the groups, so a difference in the response is attributable to the treatment.",
             [R("C1", "Describes a chance method (random numbers, names from a hat) that puts half of the volunteers in each group", ["random numbers or drawing names", "half in each group"], alt=["shuffle names and take the first half"], err=["lets volunteers choose", "assigns by order of arrival"]),
              R("C2", "Explains that random assignment balances other (lurking) variables between the groups so cause and effect can be concluded", ["balances other variables across groups", "supports a cause-and-effect conclusion"], err=["says random assignment makes the sample representative of the population"])]),
        part("D", f"Suppose that instead the researcher simply compares the {c['who']} in the study who already {c['yes']} with those who {c['no']}. Can the researcher conclude that {c['expl']} causes a change in the {c['resp']}? Justify your answer.", 1, "explain", ["4.B"],
             "No. This is an observational study; the groups chose themselves, so other variables (confounders) may explain the difference and a cause-and-effect conclusion is not justified.",
             [R("D1", "States that a cause-and-effect conclusion is not justified because the individuals chose their own groups (observational study, confounding possible)", ["no cause-and-effect conclusion", "observational study or confounding"], err=["claims the difference proves cause because the result is significant"])]),
        part("E", f"The researcher also wants to study {c['follow']} among {c['pop']}. State a valid investigative question about this topic that requires a statistical investigation. Your question should name the population of interest, name the variable that would be measured, and be answerable by collecting and analyzing data that vary from individual to individual.", 3, "explain", ["1.A"],
             f"For example: {c['follow_q']}",
             [R("E1", f"Names the population of interest ({c['pop']})", [c["pop"]], err=["names only the sample or one individual"]),
              R("E2", f"Names the variable that would be measured ({c['follow']})", [c["follow"]], err=["states no variable"]),
              R("E3", "Poses a question that anticipates variability among individuals and can be answered with data (not a single fact or an opinion)", ["anticipates variability", "answerable with data"], err=["asks a yes-or-no fact", "asks for an opinion"])]),
    ]
    for pt, tc in zip(parts, [["1.2"], ["1.7"], ["1.13"], ["1.13"], ["1.10"]]):
        pt["topic_codes"] = tc
    return _pack("stfrq_q1_design", "q1_multifocus", "1.10", ["1.2", "1.7", "1.13"], "1.A", f"Planning a study of {c['who']}", stim, parts, 22,
                 [f"q1={q1}", f"q3={q3}", f"val={val}", f"iqr={iqr}"], [_ev("B", "IQR", iqr, 0.01), _ev("B", "upper boundary", fence, 0.01)],
                 ("A multi-focus question combining a variable identification, a five-number summary with the 1.5 IQR rule, random assignment, observational versus experimental conclusions and a valid investigative question",
                  ["Identify the explanatory and response variables", "Compute IQR and the outlier boundary", "Describe random assignment and its effect on causal conclusions", "Write a valid investigative question"],
                  [("the 1.5 IQR rule decides outliers", "the table gives the quartiles and the value to check")], {"type": "table", "must_include": ["five-number summary"]},
                  "the outlier boundary is recomputed with exact fractions and the decision for the stated value is checked against both the fraction and the float rule"),
                 ["representation_reading", "claim_justification", "procedure_choice"])


# ======================= Q2. 자료 분석·모형: 선형 회귀 (5.3 / 4.D) =======================
Q2_CTX = [dict(x="number of hours of study", y="exam score (points)", xu="hour", yu="points", xr=(1, 9), a0=45, b0=5.0, noise=3.0, ex="a student who studies", xn="Hours of study", yn="Exam score"),
          dict(x="age of the car (years)", y="selling price (thousands of dollars)", xu="year", yu="thousand dollars", xr=(1, 10), a0=28, b0=-2.0, noise=1.2, ex="a car that is", xn="Age (years)", yn="Price (thousands of dollars)")]


def stfrq_q2_regression(rng):
    c = pick(rng, Q2_CTX)
    shape = pick(rng, ["linear", "curved"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n = pick(rng, [14, 16, 18])
        x = np.sort(gen.choice(np.arange(c["xr"][0], c["xr"][1] + 1), size=n, replace=True)).astype(float)
        if len(set(x)) < 6:
            continue
        mu = c["a0"] + c["b0"] * x
        if shape == "curved":
            xc = (x - x.mean())
            mu = mu + (c["b0"] * 0.55) * (xc ** 2 - (xc ** 2).mean())
        y = np.round(mu + gen.normal(0, c["noise"], n), 1)
        # 최소제곱: 정규방정식 직접 계산
        mx, my = x.mean(), y.mean(); sxx = ((x - mx) ** 2).sum(); sxy = ((x - mx) * (y - my)).sum(); syy = ((y - my) ** 2).sum()
        b = sxy / sxx; a = my - b * mx; r2 = sxy ** 2 / (sxx * syy)
        # 독립 경로: numpy lstsq
        A = np.vstack([np.ones(n), x]).T; coef = np.linalg.lstsq(A, y, rcond=None)[0]
        agree(coef[1], b, tol=1e-8, name="slope"); agree(coef[0], a, tol=1e-8, name="intercept")
        res = y - (a + b * x)
        xcn = (x - x.mean()) / x.std(); q = np.polyfit(xcn, res, 2); pred = np.polyval(q, xcn)
        rq = 1 - ((res - pred) ** 2).sum() / max(((res - res.mean()) ** 2).sum(), 1e-9)
        if y.min() <= 2 or a + b * (c["xr"][1] + 2) <= 1:  # 가격·점수는 양수여야 하고 외삽 예측값도 비현실적 음수가 아니어야 한다(S2-b: 중고차 문맥의 음수 가격으로 반려)
            continue
        if shape == "curved" and rq > 0.55 and 0.4 < r2 < 0.93:
            break
        if shape == "linear" and rq < 0.2 and 0.55 < r2 < 0.95:
            break
    a_, b_ = round(a, 2), round(b, 2); r2_ = round(r2, 2)
    i = rng.randrange(3, n - 3); x0 = float(x[i]); y0 = float(y[i])
    yh = a_ + b_ * x0; resid = y0 - yh
    # 참고답이 말하는 "자료의 범위"는 실제로 뽑힌 x 의 최솟값·최댓값이다(명목 범위 xr 은 뽑힌 표본에 10 이 없을 수 있다 — 독립 풀이 검증 2026-10-19 에서 발견).
    xo = c["xr"][1] + rng.randint(4, 8)
    while a_ + b_ * xo <= 1 and xo > c["xr"][1] + 1:
        xo -= 1
    yo = a_ + b_ * xo
    pat_ends = "above the line at both ends and below it in the middle" if q[0] > 0 else "below the line at both ends and above it in the middle"  # 이차항 계수의 부호(독립 경로: 잔차의 이차 적합)로 방향을 정한다
    stim = {"kind": "stat_chart", "description": f"Scatterplot of {c['y']} versus {c['x']} for {n} observations, with the least-squares regression line.", "data": {"chart": "scatter", "title": f"{c['yn']} versus {c['xn'].lower()}", "data": {"xTitle": c["xn"], "yTitle": c["yn"], "points": [[float(p), float(q_)] for p, q_ in zip(x, y)], "fitLine": {"slope": float(b_), "intercept": float(a_)}}}}
    lin = shape == "linear"
    parts = [
        part("A", f"The least-squares regression line for the data in the scatterplot shown is $\\hat y = {a_} {'+' if b_ >= 0 else '-'} {abs(b_)}x$, where $x$ is the {c['x']} and $\\hat y$ is the predicted {c['y']}, and $r^2 = {r2_}$. Interpret the slope of the line in the context of the data.", 2, "explain", ["4.D"],
             f"For each additional {c['xu']}, the predicted {c['y'].split(' (')[0]} {'increases' if b_ > 0 else 'decreases'} by about {abs(b_)} {c['yu']}.",
             [R("A1", f"States that the predicted response changes by {abs(b_)} for each one-unit increase in the explanatory variable (with the correct direction)", [f"{abs(b_)}", "increases" if b_ > 0 else "decreases"], nums=True, err=["gives the intercept", "says the response changes exactly"]),
              R("A2", "Gives the interpretation in context with units (predicted value, " + c["yu"] + ", per " + c["xu"] + ")", ["in context", "units"], requires="A1", err=["omits the word predicted or the context"])]),
        part("B", f"(i) Use the regression line to predict the {c['y'].split(' (')[0]} when $x = {x0:g}$. (ii) One observation has $x = {x0:g}$ and an actual {c['y'].split(' (')[0]} of ${y0:g}$. Calculate the residual for this observation.", 2, "calculate", ["3.B"],
             f"(i) Predicted value: {a_} + ({b_})({x0:g}) = {yh:.2f}. (ii) Residual = actual - predicted = {y0:g} - {yh:.2f} = {resid:.2f}.",
             [R("B1", f"Calculates the predicted value (answer {yh:.2f})", [f"{yh:.2f}"], nums=True, err=["uses the slope as the intercept"]),
              R("B2", f"Calculates the residual as actual minus predicted (answer {resid:.2f})", [f"{resid:.2f}"], requires="B1", nums=True, err=["subtracts in the wrong order"])]),
        part("C", "Does the scatterplot suggest that a linear model is appropriate for these data? Justify your answer by describing the pattern in the scatterplot relative to the line.", 3, "explain", ["4.D"],
             ("Yes. The points are scattered fairly evenly above and below the line with no curve, so a linear model is appropriate." if lin else f"No. The points show a curved pattern: they lie {pat_ends}, so a linear model is not appropriate."),
             [R("C1", "Describes the pattern of the points about the line (" + ("no curve, points scattered evenly above and below" if lin else f"a curved pattern: {pat_ends}") + ")", ["describes the pattern about the line"], err=["describes only the direction of the association"]),
              R("C2", "States that a linear model " + ("is" if lin else "is not") + " appropriate", ["appropriate" if lin else "not appropriate"], requires="C1"),
              R("C3", "Links the conclusion to the pattern (" + ("no curvature in the scatterplot" if lin else "curvature means the line does not describe the relationship") + ")", ["conclusion is tied to the observed pattern"], requires="C2", err=["justifies with r squared alone"])]),
        part("D", f"Interpret the value $r^2 = {r2_}$ in the context of the data.", 2, "explain", ["4.D"],
             f"About {int(round(r2_ * 100))}% of the variation in the {c['y'].split(' (')[0]} is accounted for by the linear relationship with the {c['x'].split(' (')[0]}.",
             [R("D1", f"States that {int(round(r2_ * 100))}% (the proportion {r2_}) of the variation in the response is accounted for by the linear relationship", [f"{int(round(r2_ * 100))}%", "variation"], nums=True, err=["says the line passes through that percent of the points", "says the response changes by that percent"]),
              R("D2", "Uses the context (names both variables)", ["in context"], requires="D1")]),
        part("E", f"A researcher uses the regression line to predict the {c['y'].split(' (')[0]} when $x = {xo}$. Is this prediction reliable? Explain.", 1, "explain", ["4.D"],
             f"No. ${xo}$ is outside the range of the data ({int(x.min())} to {int(x.max())}), so this is extrapolation and the linear pattern may not continue.",
             [R("E1", "States that the prediction is not reliable because the value is outside the range of the data (extrapolation)", ["extrapolation", "outside the range of the data"], err=["says it is reliable because r squared is large"])]),
    ]
    for pt, tc in zip(parts, [["5.3"], ["5.4"], ["5.4"], ["5.5"], ["5.3"]]):
        pt["topic_codes"] = tc
    return _pack("stfrq_q2_regression", "q2_regression", "5.4", ["5.3", "5.5"], "4.D", f"Linear regression of {c['y'].split(' (')[0]} on {c['x'].split(' (')[0]}", stim, parts, 22,
                 [f"a={a_}", f"b={b_}", f"r2={r2_}", f"x0={x0:g}", f"shape={shape}"], [_ev("B", "predicted value", yh, 0.02), _ev("B", "residual", resid, 0.02)],
                 ("Interpret and use a least-squares line, judge model appropriateness from a scatterplot, interpret r squared and recognize extrapolation",
                  ["Interpret slope and r squared in context", "Compute a prediction and a residual", "Judge appropriateness from the pattern and recognize extrapolation"],
                  [("a linear model is appropriate when the points scatter evenly about the line without curvature", "the scatterplot shows the data and the fitted line")], {"type": "scatter", "must_include": ["fitted line"]},
                  "the coefficients are recomputed with numpy lstsq, and a quadratic fit to the residuals classifies the pattern, which must match the intended pattern"),
                 ["interpretation", "claim_justification", "representation_reading"])


# ======================= Q3. 추론: 모비율 z 검정 (3.7 / 3.E) =======================
Q3_CTX = [dict(who="a city", pop_unit="residents", trait="own a bicycle", claim=0.4, label="city residents", N=60000, sus="less", ctx="A city official claims that $40\\%$ of the city's residents own a bicycle. A reporter suspects that the true proportion is lower."),
          dict(who="a school district", pop_unit="students", trait="ride the bus to school", claim=0.5, label="district students", N=20000, sus="greater", ctx="A district report states that $50\\%$ of its students ride the bus to school. A parent group suspects that the true proportion is higher."),
          dict(who="a manufacturer", pop_unit="bolts", trait="meet specifications", claim=0.9, label="bolts", N=50000, sus="less", ctx="A manufacturer claims that $90\\%$ of its bolts meet specifications. An inspector suspects that the true proportion is lower.")]


def stfrq_q3_prop_test(rng):
    c = pick(rng, Q3_CTX)
    for _ in forever():
        n = pick(rng, [150, 200, 250, 300]); p0 = c["claim"]
        d = pick(rng, [0.05, 0.06, 0.07, 0.08]) * (-1 if c["sus"] == "less" else 1)
        x = int(round(n * (p0 + d)))
        ph = x / n
        z = (ph - p0) / math.sqrt(p0 * (1 - p0) / n)
        P = ss.norm.cdf(z) if c["sus"] == "less" else ss.norm.sf(z)
        P_ind = ncdf(z) if c["sus"] == "less" else 1 - ncdf(z)
        agree(P, P_ind, tol=1e-9, name="z_p")
        if 0.0015 < P < 0.2 and abs(P - 0.05) > 0.012 and min(n * p0, n * (1 - p0)) >= 10 and abs(z) > 1.0:
            break
    rej = P < 0.05
    sym = "<" if c["sus"] == "less" else ">"
    stim = {"kind": "text", "description": f"{c['ctx']} A random sample of ${n}$ {c['pop_unit']} is selected, and ${x}$ of them {c['trait']}. Use a significance level of $\\alpha=0.05$.", "data": {}}
    parts = [
        part("A", "State the null and alternative hypotheses for the test described. Define any parameter you use.", 2, "explain", ["2.E"],
             f"Let $p$ be the proportion of all {c['label']} that {c['trait']}. $H_0: p = {p0}$ and $H_a: p {sym} {p0}$.",
             [R("A1", f"States the null hypothesis $H_0: p = {p0}$ with $p$ defined as the population proportion in context", [f"p = {p0}", "population proportion"], err=["writes hypotheses about the sample proportion"]),
              R("A2", f"States the alternative hypothesis $H_a: p {sym} {p0}$ in the direction of the suspicion", [f"p {sym} {p0}"], err=["uses a two-sided alternative", "uses the wrong direction"])]),
        part("B", f"Verify that the conditions for a one-sample z-test for a proportion are met. There are about ${c['N']}$ {c['pop_unit']} in all.", 2, "explain", ["4.E"],
             f"Random: the sample is random. 10% condition: ${n}$ is less than 10% of ${c['N']}$. Large counts: $np_0 = {n * p0:g} \\ge 10$ and $n(1-p_0) = {n * (1 - p0):g} \\ge 10$.",
             [R("B1", f"States that the sample is random and that the sample size {n} is less than 10% of the population ({c['N']})", ["random sample", "10% condition"], err=["checks the conditions with the sample proportion instead of the sample size"]),
              R("B2", f"Checks the large counts condition with the null value: $np_0 = {n * p0:g}$ and $n(1-p_0) = {n * (1 - p0):g}$ are both at least $10$", [f"{n * p0:g}", f"{n * (1 - p0):g}"], nums=True, err=["uses the sample proportion for the large counts check"])]),
        part("C", "Carry out the test: identify the procedure, and calculate the test statistic and the P-value.", 3, "calculate", ["3.E"],
             f"One-sample z-test for a proportion. $\\hat p = {x}/{n} = {ph:.4f}$, $z = ({ph:.4f} - {p0})/\\sqrt{{{p0}({1 - p0:g})/{n}}} \\approx {z:.2f}$, P-value $\\approx {P:.4f}$.",
             [R("C1", "Names the procedure: a one-sample z-test for a population proportion", ["one-sample z-test for a proportion"], err=["names a t-test"]),
              R("C2", f"Calculates the test statistic (answer z of about {z:.2f})", [f"{z:.2f}"], requires="C1", nums=True, err=["uses the sample proportion in the standard error"]),
              R("C3", f"Finds the P-value from the standard normal distribution for the one-sided alternative (answer about {P:.4f})", [f"{P:.4f}"], requires="C2", nums=True, err=["doubles the P-value for a one-sided test"])]),
        part("D", "State a conclusion in the context of the problem. Justify your answer using the P-value and the significance level.", 3, "explain", ["4.G"],
             (f"The P-value ${P:.4f}$ is less than $0.05$, so reject $H_0$. There is convincing evidence that the proportion of all {c['label']} that {c['trait']} is {'lower' if c['sus'] == 'less' else 'higher'} than {p0}." if rej else
              f"The P-value ${P:.4f}$ is greater than $0.05$, so fail to reject $H_0$. There is not convincing evidence that the proportion of all {c['label']} that {c['trait']} is {'lower' if c['sus'] == 'less' else 'higher'} than {p0}."),
             [R("D1", f"Compares the P-value ({P:.4f}) with the significance level 0.05 ({'less' if rej else 'greater'})", ["compares P-value with alpha"], nums=True, err=["compares the test statistic with alpha"]),
              R("D2", "Makes the decision: " + ("rejects" if rej else "fails to reject") + " the null hypothesis", ["rejects" if rej else "fails to reject"], requires="D1", err=["accepts the null hypothesis"]),
              R("D3", "States the conclusion about the population in context (" + ("convincing" if rej else "not convincing") + " evidence)", ["conclusion in context about the population"], requires="D2", err=["generalizes only to the sample"])]),
    ]
    for pt, tc in zip(parts, [["3.5"], ["3.7"], ["3.7"], ["3.7"]]):
        pt["topic_codes"] = tc
    return _pack("stfrq_q3_prop_test", "q3_inference", "3.7", ["3.5", "3.6"], "3.E", f"Testing a claim about the proportion of {c['label']} that {c['trait']}", stim, parts, 22,
                 [f"n={n}", f"x={x}", f"p0={p0}", f"z={z:.3f}", f"P={P:.4f}"], [_ev("C", "test statistic z", z, 0.02), _ev("C", "P-value", P, 0.001)],
                 ("A complete one-sample z-test for a proportion: hypotheses, conditions, test statistic and P-value, and a conclusion in context",
                  ["State hypotheses about the population parameter", "Verify the three conditions with the null value", "Compute z and the one-sided P-value and decide"],
                  [("a one-sample z-test needs a random sample, a sample under 10 percent of the population and np0 and n(1-p0) at least 10", "the problem gives the sample, the population size and the null value")], {"type": "text", "must_include": ["sample", "claim"]},
                  "z and the P-value are recomputed with math.erf (independent of scipy.stats.norm) and the decision at alpha 0.05 is checked for a margin of at least 0.012"),
                 ["procedure_choice", "condition_check", "claim_justification"])


# ======================= Q4. 단원 통합: 이원표·이항·구간 (2.6 / 3.C) =======================
Q4_CTX = [dict(plural="students", sing="student", groups=("Freshmen", "Seniors"), gdesc=("is a freshman", "is a senior"), gpl=("freshmen", "seniors"), act=("Plays a sport", "Does not play a sport"), outcome="plays a sport", base="play a sport"),
          dict(plural="employees", sing="employee", groups=("Under 40", "40 or older"), gdesc=("is under 40", "is 40 or older"), gpl=("employees who are under 40", "employees who are 40 or older"), act=("Commutes by bus", "Does not commute by bus"), outcome="commutes by bus", base="commute by bus")]


def stfrq_q4_integrated(rng):
    c = pick(rng, Q4_CTX)
    for _ in forever():
        g1 = [rng.randint(30, 80), rng.randint(40, 110)]
        g2 = [rng.randint(30, 80), rng.randint(40, 110)]
        cells = [g1, g2]
        N = sum(map(sum, cells)); r1, r2_ = sum(g1), sum(g2); c1 = g1[0] + g2[0]
        pA = Fr(g1[0], r1)  # P(outcome | group 1)
        pB = Fr(c1, N)
        n1 = r1; ph = g1[0] / n1
        if abs(float(pA - pB)) > 0.03 and 40 <= n1 <= 190 and 0.2 < ph < 0.8:
            break
    # 독립 경로: 개별 기록 열거
    recs = [(i, j) for i in range(2) for j in range(2) for _ in range(cells[i][j])]
    given = [x for x in recs if x[0] == 0]
    agree(sum(1 for x in given if x[1] == 0) / len(given), float(pA), name="cond_prob")
    se = math.sqrt(ph * (1 - ph) / n1)
    zs = ss.norm.ppf(0.975)
    lo_z, hi_z = 1.0, 3.0
    for _ in range(60):
        mid = (lo_z + hi_z) / 2
        if ncdf(mid) < 0.975:
            lo_z = mid
        else:
            hi_z = mid
    agree(zs, lo_z, tol=1e-8, name="zstar")
    L, H = ph - zs * se, ph + zs * se
    k = pick(rng, [5, 6]); p_b = round(float(pB), 2)
    pm = [math.comb(k, j) * p_b ** j * (1 - p_b) ** (k - j) for j in range(k + 1)]
    for a_, b_ in zip(pm, [ss.binom.pmf(j, k, p_b) for j in range(k + 1)]):
        agree(a_, b_, tol=1e-9, name="binom")
    ge2 = 1 - pm[0] - pm[1]
    stim = {"kind": "stat_chart", "description": f"Two-way table of group and response for {N} {c['plural']}.", "data": {"chart": "two_way", "title": "Survey results", "data": {"rowHeader": "Group", "rowLabels": [c["groups"][0], c["groups"][1]], "colLabels": [c["act"][0], c["act"][1]], "cells": cells}}}
    indep = abs(float(pA - pB)) < 1e-9
    sing, plural, out, base = c["sing"], c["plural"], c["outcome"], c["base"]
    parts = [
        part("A", f"The two-way display shown summarizes a survey of ${N}$ {plural}. One {sing} is selected at random. Given that the selected {sing} {c['gdesc'][0]}, what is the probability that the {sing} {out}? Round to three decimal places.", 2, "calculate", ["3.C"],
             f"$P = {g1[0]}/{r1} \\approx {float(pA):.3f}$.",
             [R("A1", f"Restricts to the group total ({r1}) as the denominator", [str(r1)], nums=True, err=["divides by the grand total"]),
              R("A2", f"Calculates the conditional probability (answer {float(pA):.3f})", [f"{float(pA):.3f}"], requires="A1", nums=True, err=["divides by the column total"])]),
        part("B", f"Overall, the proportion of the ${N}$ {plural} who {base} is ${float(pB):.3f}$. Are the events 'the {sing} {c['gdesc'][0]}' and 'the {sing} {out}' independent? Justify your answer using probabilities from the display.", 2, "explain", ["3.C"],
             (f"No. The conditional probability ${float(pA):.3f}$ is not equal to the overall probability ${float(pB):.3f}$, so the events are not independent." if not indep else f"Yes. The conditional probability ${float(pA):.3f}$ equals the overall probability ${float(pB):.3f}$, so the events are independent."),
             [R("B1", f"Compares the conditional probability ({float(pA):.3f}) with the overall probability ({float(pB):.3f})", [f"{float(pA):.3f}", f"{float(pB):.3f}"], nums=True, err=["compares counts instead of probabilities"]),
              R("B2", "Concludes the events are " + ("independent" if indep else "not independent") + " because the two probabilities are " + ("equal" if indep else "not equal"), ["not independent" if not indep else "independent"], requires="B1", err=["says events are not independent because they can occur together"])]),
        part("C", f"Suppose ${k}$ {plural} are selected at random with replacement. Let $X$ be the number of them who {base}, and use $p = {p_b}$. Identify the distribution of $X$ and calculate the probability that at least $2$ of the ${k}$ {plural} {base}.", 2, "calculate", ["3.C"],
             f"$X$ is binomial with $n={k}$ and $p={p_b}$. $P(X \\ge 2) = 1 - P(0) - P(1) \\approx {ge2:.3f}$.",
             [R("C1", f"Identifies a binomial distribution with n = {k} and p = {p_b}", ["binomial", f"n = {k}", f"p = {p_b}"], err=["gives p as the conditional probability"]),
              R("C2", f"Calculates the probability of at least 2 (answer {ge2:.3f})", [f"{ge2:.3f}"], requires="C1", nums=True, err=["computes P(X > 2)", "computes P(X = 2)"])]),
        part("D", f"Treat the survey data for the {c['gpl'][0]} as a random sample from all {c['gpl'][0]}, and assume that the conditions for the interval are met. Calculate a $95\\%$ confidence interval for the proportion of all {c['gpl'][0]} who {base}. Round the endpoints to three decimal places.", 2, "calculate", ["3.E"],
             f"$\\hat p = {g1[0]}/{r1} = {ph:.3f}$; interval: ${ph:.3f} \\pm 1.96\\sqrt{{{ph:.3f}(1-{ph:.3f})/{r1}}}$ = $({L:.3f}, {H:.3f})$.",
             [R("D1", "Identifies a one-sample z-interval for a proportion with the sample proportion in the center and the standard error with the sample proportion", ["one-sample z-interval for a proportion"], err=["uses a t-interval", "uses p0 in the standard error"]),
              R("D2", f"Calculates the interval (answer ({L:.3f}, {H:.3f}))", [f"{L:.3f}", f"{H:.3f}"], requires="D1", nums=True, err=["uses the wrong critical value"])]),
        part("E", "Interpret the interval from part (D) in the context of the survey, including the meaning of the confidence level.", 2, "explain", ["4.F"],
             f"We are $95\\%$ confident that the interval from {L:.3f} to {H:.3f} captures the true proportion of all {c['gpl'][0]} who {base}. The method captures the true proportion in about $95\\%$ of all random samples.",
             [R("E1", "Interprets the interval as capturing the population proportion for the group in context", ["captures the population proportion", "in context"], err=["interprets the interval as a range for the sample proportion"]),
              R("E2", "Explains the confidence level as the long-run success rate of the method (about 95% of random samples)", ["95% of intervals from random samples capture the parameter"], requires="E1", err=["says there is a 95% probability that the parameter is in this interval"])]),
    ]
    for pt, tc in zip(parts, [["2.6"], ["2.7"], ["2.10"], ["3.3"], ["3.3"]]):
        pt["topic_codes"] = tc
    return _pack("stfrq_q4_integrated", "q4_integrated", "2.6", ["2.7", "2.10", "3.3"], "3.C", f"Survey of {plural}: probability and a confidence interval", stim, parts, 22,
                 [f"cells={cells}", f"p_cond={float(pA):.3f}", f"p_b={p_b}", f"k={k}"], [_ev("A", "conditional probability", float(pA), 0.001), _ev("C", "P(X>=2)", ge2, 0.001), _ev("D", "interval lower", L, 0.001), _ev("D", "interval upper", H, 0.001)],
                 ("An integrated question using a two-way table: a conditional probability, independence, a binomial probability and a confidence interval with its interpretation",
                  ["Compute a conditional probability from a two-way table and test independence", "Use a binomial distribution", "Construct and interpret a confidence interval for a proportion"],
                  [("conditional probability divides by the given group total and independence means equal conditional and overall probabilities", "the table gives all counts")], {"type": "two_way_table", "must_include": ["all cell counts"]},
                  "probabilities are recomputed from expanded individual records, the binomial probability from scipy and the combinations formula, and z* by bisection on the normal cdf"),
                 ["procedure_choice", "interpretation", "claim_justification"])


STAGE_FRQ = ["stfrq_q1_design", "stfrq_q2_regression", "stfrq_q3_prop_test", "stfrq_q4_integrated"]
STAGE_FRQPILOT = ["stfrq_q3_prop_test", "stfrq_q1_design"]  # S2-a 유료 파일럿: 추론(Q3)과 조사 질문 포함 복합 초점(Q1)만
