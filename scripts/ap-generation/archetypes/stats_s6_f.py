"""AP Statistics 연습 시험 5(2026-10-19 추가 라운드) FRQ 원형 4종. 기존 공개 FRQ 와 연습 시험 3·4 FRQ 의 틀과 다르다:
Q1 = 히스토그램 해석 + 위약 대조 실험 설계, Q2 = 이상치가 있는 산점도(연관성·기울기·잔차·제거의 영향·r^2), Q3 = 두 모비율 z 검정(요약 개수), Q4 = 이항 확률 + 표본비율의 분포 + 비율 신뢰구간.
2027 FRQ: 4문항 x 10점, 채점 행은 1점씩 10행. 서술 행은 의미로 채점한다(meaning_based). 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import R, frq_pack, ev


def cap(s):
    return s[0].upper() + s[1:]


# ======================= Q1. 히스토그램 해석과 위약 대조 실험 (1.5 / 1.A) =======================
Q1_CTX = [dict(what="the number of minutes that patients reported pain relief", unit="minutes", trt="a new pain medicine", ctl="a placebo", who="patients", u1="patient", resp="minutes of pain relief", expl="the type of pill (medicine or placebo)", resp_type="quantitative", pop="patients at a clinic", fvar="the number of hours that patients at the clinic wait before an appointment", fq="What is the typical number of hours that patients at the clinic wait before an appointment?"),
          dict(what="the number of hours that plants grew toward a light", unit="hours", trt="a new plant food", ctl="plain water", who="plants", u1="plant", resp="hours of growth toward the light", expl="the type of liquid (plant food or plain water)", resp_type="quantitative", pop="plants in a greenhouse", fvar="the number of flowers that plants in the greenhouse produce", fq="What is the typical number of flowers that a plant in the greenhouse produces?")]


def stfrq_n5_q1_hist(rng):
    c = pick(rng, Q1_CTX)
    w = pick(rng, [5, 10]); lo0 = 0
    for _ in forever():
        counts = [rng.randint(2, 6), rng.randint(6, 12), rng.randint(14, 24), rng.randint(10, 18), rng.randint(5, 10), rng.randint(2, 5), rng.randint(0, 2)]
        n = sum(counts)
        peak = counts.index(max(counts))
        mid = [lo0 + w * (i + 0.5) for i in range(7)]; mean_h = sum(m_ * v for m_, v in zip(mid, counts)) / n
        cum_ = np.cumsum(counts); med_h = mid[int(np.searchsorted(cum_, n / 2.0))]
        if peak == 2 and n in range(55, 90) and mean_h > med_h + 0.15 * w and counts[-1] + counts[-2] >= 3:
            break
    bins = [{"from": lo0 + w * i, "to": lo0 + w * (i + 1), "count": v} for i, v in enumerate(counts)]
    thr_i = 4; thr = lo0 + w * thr_i; atl = sum(counts[thr_i:]); pct = atl / n * 100
    cum = np.cumsum(counts); med_class = int(np.searchsorted(cum, n / 2.0)); mc_from, mc_to = lo0 + w * med_class, lo0 + w * (med_class + 1)
    agree(sum(counts[thr_i:]), atl, name="atl")
    stim = {"kind": "stat_chart", "description": f"Histogram of {c['what']} for the {c['who']} that received the treatment.", "data": {"chart": "histogram", "title": f"Histogram of the treatment group ({c['unit']})", "data": {"xTitle": cap(c["unit"]), "yTitle": "Frequency", "bins": bins}}}
    skew_r = counts[-1] + counts[-2] < counts[0] + counts[1] + 1 and False
    parts = [
        part("A", f"A researcher plans a study of {c['trt']} in which each of ${n * 2}$ {c['who']} will be given either {c['trt']} or {c['ctl']}, and the {c['resp']} will be recorded for each. Identify the explanatory variable and the response variable, and say whether each is categorical or quantitative.", 2, "explain", ["2.A"],
             f"The explanatory variable is {c['expl']}, which is categorical. The response variable is the {c['resp']}, which is quantitative.",
             [R("A1", f"Identifies {c['expl']} as the explanatory variable and classifies it as categorical", [c["expl"], "categorical"], err=["names the response as explanatory", "classifies the type of pill as quantitative"]), R("A2", f"Identifies the {c['resp']} as the response variable and classifies it as quantitative", [c["resp"], "quantitative"], err=["names the explanatory variable as the response", "classifies the response as categorical"])]),
        part("B", f"Describe a completely randomized design for the study in which the {c['who']} are blinded to the treatment they receive, and explain why blinding is used.", 2, "explain", ["2.B"],
             f"Assign the {c['who']} at random, half to {c['trt']} and half to {c['ctl']} (for example by drawing names or using random numbers), and do not tell the {c['who']} or the people who measure the response which treatment each one received. Blinding keeps expectations from influencing the responses or the measurements.",
             [R("B1", f"Describes random assignment of the {c['who']} to the two treatments, with about half in each group", ["random assignment", "half to each treatment"], alt=["shuffle the names and give the first half one treatment"], err=["lets the individuals choose their treatment", "assigns by order of arrival"]), R("B2", "Explains that blinding keeps the expectations of the individuals (or of those who measure) from influencing the responses, so the groups are treated alike apart from the treatment", ["expectations do not influence the results"], err=["says blinding makes the groups the same size", "says blinding lets the results be generalized"])]),
        part("C", f"The histogram shown displays {c['what']} for the treatment group of ${n}$ {c['who']}. What percent of the {c['who']} in the treatment group had a value of at least ${thr}$ {c['unit']}? Round to one decimal place.", 1, "calculate", ["3.B"],
             f"The bars at ${thr}$ and above have a total frequency of ${atl}$ out of ${n}$, so the percent is about ${pct:.1f}\\%$.",
             [R("C1", f"Adds the frequencies of the bars at {thr} and above ({atl}) and divides by the total {n} (answer {pct:.1f}%)", [str(atl), f"{pct:.1f}"], nums=True, err=["divides by the number of bars", "uses only the frequency of one bar"])]),
        part("D", f"Describe the distribution of {c['what']} for the treatment group shown in the histogram. Your description should address the shape, a typical value (the class that contains the median) and the spread, in context.", 2, "explain", ["4.C"],
             f"The distribution is unimodal with its peak in the class from ${lo0 + w * 2}$ to ${lo0 + w * 3}$ {c['unit']} and is skewed to the right; the median is in the class from ${mc_from}$ to ${mc_to}$ {c['unit']}, and the values range from the class starting at ${lo0}$ to the class ending at ${lo0 + w * (7 if counts[-1] else 6)}$ {c['unit']}.",
             [R("D1", "Describes the shape of the distribution as having one peak and a longer tail on the right (skewed to the right) in context", ["one peak", "skewed to the right"], err=["describes the shape of a different variable", "gives only a measure of center"]), R("D2", f"Gives a typical value (the median is in the class from {mc_from} to {mc_to}) and the spread (the range of the classes), with units", [f"{mc_from} to {mc_to}", "spread", c["unit"]], nums=True, err=["gives the center without the spread", "omits the units"])]),
        part("E", f"The researcher also wants to study {c['fvar']}. State a valid investigative question about this topic that requires a statistical investigation. Your question should name the population of interest, name the variable that would be measured, and be answerable by collecting and analyzing data that vary from individual to individual.", 3, "explain", ["1.A"],
             f"For example: {c['fq']}",
             [R("E1", f"Names the population of interest (the {c['pop']})", [c["pop"]], err=["names only the sample or one individual"]), R("E2", f"Names the variable that would be measured ({c['fvar']})", [c["fvar"]], err=["states no variable"]), R("E3", "Poses a question that anticipates variability among individuals and can be answered with data (not a single fact or an opinion)", ["anticipates variability", "answerable with data"], err=["asks a yes-or-no fact", "asks for an opinion"])]),
    ]
    for pt, tc in zip(parts, [["1.2"], ["1.13"], ["1.5"], ["1.6"], ["1.10"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n5_q1_hist", "q1_multifocus", "1.10", ["1.2", "1.5", "1.6", "1.13"], "1.A", f"A placebo-controlled experiment on {c['trt']}", stim, parts, 22,
                    [f"counts={counts}", f"w={w}", f"atl={atl}"], [ev("C", "percent at or above the threshold", pct, 0.06)],
                    ("A multi-focus question combining the classification of variables, a blinded completely randomized design, a percent read from a histogram, a description of a distribution and a valid investigative question",
                     ["Classify the explanatory and response variables", "Describe a blinded randomized design", "Read a percent from a histogram and describe a distribution", "Write a valid investigative question"],
                     [("a completely randomized blinded design assigns treatments by chance and keeps expectations from influencing responses", "the problem names the treatments and the histogram gives the frequencies of the treatment group")], {"type": "histogram", "must_include": ["class frequencies"]},
                     "the percent is recomputed from the frequencies of the displayed bars and the median class from the cumulative frequencies"),
                    ["representation_reading", "claim_justification", "procedure_choice"])


# ======================= Q2. 이상치가 있는 산점도의 회귀 (5.1 / 4.D) =======================
Q2_CTX = [dict(x="Hours of training", y="Errors in a week", xs="training time", ys="number of errors", xu="hours", yu="errors", xr=(2, 14), a=16.0, b=-1.0, sub="employee"), dict(x="Age of a machine (years)", y="Repair cost (hundreds of dollars)", xs="age of the machine", ys="repair cost", xu="years", yu="hundred dollars", xr=(2, 12), a=4.0, b=2.2, sub="machine")]


def stfrq_n5_q2_outlier(rng):
    c = pick(rng, Q2_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        xs = np.sort(np.round(gen.uniform(c["xr"][0], c["xr"][1], 9), 0))
        if len(set(xs)) < 9:
            continue
        ys = np.round(c["a"] + c["b"] * xs + gen.normal(0, abs(c["b"]) * 0.8, 9), 1)
        xk = float(xs[4]); yk = round(c["a"] + c["b"] * xk + rng.choice([-1, 1]) * abs(c["b"]) * (c["xr"][1] - c["xr"][0]) * 0.55, 1)
        X = np.append(xs, xk); Y = np.append(ys, yk)
        b_all, a_all = np.polyfit(X, Y, 1); r_all = float(np.corrcoef(X, Y)[0, 1]); b_wo, a_wo = np.polyfit(xs, ys, 1); r_wo = float(np.corrcoef(xs, ys)[0, 1])
        ar, br = round(float(a_all), 2), round(float(b_all), 2)
        if abs(abs(r_wo) - abs(r_all)) >= 0.06 and abs(r_wo) > abs(r_all) and abs(br) > 0.3 and abs(ar + br * xk - yk) > 0.8 and abs(round(ar + br * xk - yk, 2)) > 0.5 and abs(abs(b_wo) - abs(b_all)) / abs(b_all) < 0.12:
            break
    sxx = ((X - X.mean()) ** 2).sum(); sxy = ((X - X.mean()) * (Y - Y.mean())).sum(); agree(sxy / sxx, b_all, tol=1e-8, name="slope")
    rr = round(r_all, 3); r2 = round(r_all ** 2, 3); rw = round(r_wo, 3); aw, bw = round(float(a_wo), 2), round(float(b_wo), 2)
    n = len(X); yh = ar + br * xk; res = yk - yh; dirn = "negative" if r_all < 0 else "positive"
    sg = "+" if br >= 0 else "-"; sgw = "+" if bw >= 0 else "-"
    stim = {"kind": "stat_chart", "description": f"Scatterplot of {c['ys']} versus {c['xs']} for {n} {c['sub']}s with the least-squares line.", "data": {"chart": "scatter", "title": f"{c['ys'].capitalize()} versus {c['xs']}", "data": {"xTitle": c["x"], "yTitle": c["y"], "points": [[float(a), float(b)] for a, b in zip(X, Y)], "fitLine": {"slope": br, "intercept": ar}, "highlights": [{"index": n - 1}]}}}
    parts = [
        part("A", f"The scatterplot shown displays the {c['ys']} and the {c['xs']} for ${n}$ {c['sub']}s. The highlighted point has {c['xs']} equal to ${xk:g}$ {c['xu']} and {c['ys']} equal to ${yk:g}$ {c['yu']}. Describe the association shown in the scatterplot, including the direction, the form, the strength and any unusual observation.", 2, "explain", ["4.A"],
             f"There is a moderately strong {dirn} linear association: as the {c['xs']} increases the {c['ys']} tends to {'decrease' if r_all < 0 else 'increase'}. The highlighted point is an outlier that lies far from the line.",
             [R("A1", f"Describes the direction ({dirn}) and the linear form of the association in context", [dirn, "linear"], err=["gives the wrong direction", "describes a curved form"]), R("A2", "Describes the strength as moderately strong or strong and identifies the highlighted point as an outlier (it lies far from the pattern)", ["strength", "outlier"], err=["omits the unusual observation", "calls the point typical"])]),
        part("B", f"The least-squares regression line for all ${n}$ points is $\\hat y = {ar:g} {sg} {abs(br):g}x$, where $x$ is the {c['xs']} in {c['xu']} and $\\hat y$ is the predicted {c['ys']}. Interpret the slope of the line in context.", 2, "explain", ["4.D"],
             f"For each additional {c['xu'][:-1] if c['xu'].endswith('s') else c['xu']} of {c['xs']}, the predicted {c['ys']} {'increases' if br > 0 else 'decreases'} by about {abs(br):g} {c['yu']}.",
             [R("B1", f"States that the predicted {c['ys']} {'increases' if br > 0 else 'decreases'} by about {abs(br):g} for each one-unit increase in the {c['xs']}", [f"{abs(br):g}", "increases" if br > 0 else "decreases"], nums=True, err=["gives the intercept", "says the change is exact for every individual"]), R("B2", "Gives the interpretation in context with units and the word predicted (or on average)", ["in context", "units", "predicted"], requires="B1", err=["omits the units or the context"])]),
        part("C", f"Calculate the residual for the highlighted point, and say whether the point is above or below the regression line.", 2, "calculate", ["3.B"],
             f"Predicted value ${ar:g} {sg} {abs(br):g}({xk:g}) = {yh:.2f}$; residual $= {yk:g} - {yh:.2f} = {res:.2f}$, so the point is {'above' if res > 0 else 'below'} the line.",
             [R("C1", f"Calculates the residual as actual minus predicted (answer {res:.2f})", [f"{res:.2f}"], nums=True, err=["subtracts in the wrong order"]), R("C2", f"States that the point is {'above' if res > 0 else 'below'} the line because the residual is {'positive' if res > 0 else 'negative'}", ["above" if res > 0 else "below"], requires="C1", err=["reverses above and below"])]),
        part("D", f"When the highlighted point is removed, the least-squares line for the other ${n - 1}$ points is $\\hat y = {aw:g} {sgw} {abs(bw):g}x$ and the correlation is $r = {rw}$ (compared with $r = {rr}$ for all ${n}$ points). Describe how removing the highlighted point changes the slope and the strength of the correlation.", 2, "explain", ["4.D"],
             f"The slope changes only slightly (from ${br:g}$ to ${bw:g}$), but the correlation becomes stronger (|r| increases from ${abs(rr):.3f}$ to ${abs(rw):.3f}$), because the outlier is far from the line but near the middle of the values of x, so it has little influence on the slope.",
             [R("D1", f"States that the slope changes only slightly (from {br:g} to {bw:g})", [f"{br:g}", f"{bw:g}", "changes only slightly"], nums=True, err=["says the slope changes a lot"]), R("D2", f"States that the correlation becomes stronger (from {abs(rr):.3f} to {abs(rw):.3f} in size) because the outlier increased the scatter about the line", ["correlation stronger", "outlier increases scatter"], requires="D1", err=["says the correlation becomes weaker"])]),
        part("E", f"For the data with all ${n}$ points, $r^2 \\approx {r2}$. Interpret $r^2$ in the context of the data.", 2, "explain", ["4.D"],
             f"About {r2 * 100:.1f}% of the variation in the {c['ys']} is accounted for by the linear relationship with the {c['xs']}.",
             [R("E1", f"States that about {r2 * 100:.1f}% (the proportion {r2}) of the variation in the {c['ys']} is accounted for by the linear relationship", [f"{r2 * 100:.1f}%", "variation"], nums=True, err=["says that the line passes through that percent of the points", "says the response changes by that percent"]), R("E2", "Uses the context by naming both variables", ["in context"], requires="E1")]),
    ]
    for pt, tc in zip(parts, [["5.1"], ["5.3"], ["5.4"], ["5.2"], ["5.5"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n5_q2_outlier", "q2_regression", "5.2", ["5.1", "5.3", "5.4", "5.5"], "4.D", f"A scatterplot with an outlier: {c['ys']} versus {c['xs']}", stim, parts, 22,
                    [f"ar={ar}", f"br={br}", f"rr={rr}", f"res={res:.2f}", f"rw={rw}"], [ev("C", "residual", res, 0.02)],
                    ("Describe an association with an outlier, interpret the slope, compute a residual, judge the effect of removing an outlier on the slope and the correlation, and interpret r squared",
                     ["Describe the association and the outlier", "Interpret the slope and compute a residual", "Judge the effect of the outlier and interpret r squared"],
                     [("an outlier far from the line but near the middle of x weakens r but changes the slope little", "the scatterplot highlights the point and the problem gives the lines and correlations with and without it")], {"type": "scatter", "must_include": ["fitted line", "highlighted point"]},
                     "the coefficients and correlations are recomputed by the normal equations and numpy with and without the highlighted point, and the slope change must be under 12 percent while the correlation strengthens by at least 0.06"),
                    ["interpretation", "representation_reading", "claim_justification"])


# ======================= Q3. 두 모비율 z 검정 (3.13 / 3.E) =======================
Q3_CTX = [dict(a="students who use a study app", b="students who do not use a study app", what="passed the final exam", u="students", claim="a larger proportion of students who use the app pass", pop="students at a large school", N="about $5000$"), dict(a="patients who receive a new treatment", b="patients who receive the standard treatment", what="recovered within two weeks", u="patients", claim="a larger proportion of patients recover with the new treatment", pop="patients with the condition", N="about $8000$")]


def stfrq_n5_q3_twoprop(rng):
    c = pick(rng, Q3_CTX)
    for _ in forever():
        n1 = rng.choice([120, 150, 180, 220]); n2 = rng.choice([130, 160, 200, 240]); x1 = rng.randint(int(.5 * n1), int(.75 * n1)); x2 = rng.randint(int(.4 * n2), int(.65 * n2))
        p1, p2 = x1 / n1, x2 / n2; pp = (x1 + x2) / (n1 + n2); se = math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); z = (p1 - p2) / se
        P = float(ss.norm.sf(z)); P_ind = 1 - ncdf(z); agree(P, P_ind, tol=1e-9, name="p")
        if 0.003 < P < 0.18 and abs(P - 0.05) > 0.012 and min(x1, n1 - x1, x2, n2 - x2) >= 10:
            break
    rej = P < 0.05
    stim = {"kind": "text", "description": f"A researcher wants to know whether {c['claim']}. Independent random samples were taken from {c['pop']}: of ${n1}$ {c['a']}, ${x1}$ {c['what']}; of ${n2}$ {c['b']}, ${x2}$ {c['what']}. Each sample is less than $10\\%$ of its population ({c['N']} {c['u']} in each group). Use a significance level of $\\alpha = 0.05$.", "data": {}}
    parts = [
        part("A", "State the null and alternative hypotheses for the test. Define any parameters you use.", 2, "explain", ["2.E"],
             f"Let $p_1$ be the proportion of all {c['a']} who {c['what']}, and $p_2$ the proportion of all {c['b']} who {c['what']}. $H_0: p_1 - p_2 = 0$ and $H_a: p_1 - p_2 > 0$.",
             [R("A1", f"States $H_0: p_1 = p_2$ (or $p_1 - p_2 = 0$) with both parameters defined as population proportions in context", ["p_1 = p_2", "population proportions"], err=["writes hypotheses about the sample proportions"]), R("A2", "States $H_a: p_1 > p_2$ (or $p_1 - p_2 > 0$) in the direction of the claim", ["p_1 > p_2"], err=["uses a two-sided alternative", "uses the opposite direction"])]),
        part("B", "Verify the conditions for the two-proportion $z$ test.", 2, "explain", ["4.E"],
             f"Random and independent: the two samples are random and independent. 10% condition: each sample is less than $10\\%$ of its population. Large counts: with the pooled proportion ${pp:.3f}$, $n_1\\hat p = {n1 * pp:.1f}$, $n_1(1-\\hat p) = {n1 * (1 - pp):.1f}$, $n_2\\hat p = {n2 * pp:.1f}$ and $n_2(1-\\hat p) = {n2 * (1 - pp):.1f}$ are all at least $10$.",
             [R("B1", "States that the samples are random and independent and that each is less than 10% of its population", ["random and independent", "10% condition"], err=["checks the conditions for only one of the samples"]), R("B2", f"Checks the large counts condition for both samples with the counts of successes and failures (pooled proportion {pp:.3f}), all at least 10", ["all counts at least 10", "both samples"], err=["checks only the sample sizes", "uses np0 for a single sample"])]),
        part("C", "Carry out the test: identify the procedure, and calculate the test statistic and the P-value.", 3, "calculate", ["3.E"],
             f"Two-proportion $z$ test. $\\hat p_1 = {p1:.3f}$, $\\hat p_2 = {p2:.3f}$, $\\hat p = {pp:.3f}$, $z = ({p1:.3f} - {p2:.3f})/\\sqrt{{{pp:.3f}(1-{pp:.3f})(1/{n1} + 1/{n2})}} \\approx {z:.2f}$, and the P-value for the one-sided alternative is about ${P:.4f}$.",
             [R("C1", "Names the procedure: a two-proportion z test", ["two-proportion z test"], err=["names a one-proportion test", "names a t test"]), R("C2", f"Calculates the test statistic using the pooled proportion (answer z of about {z:.2f})", [f"{z:.2f}"], requires="C1", nums=True, err=["uses the unpooled standard error", "omits the square root"]),
              R("C3", f"Finds the P-value from the standard normal distribution for the one-sided alternative (answer about {P:.4f})", [f"{P:.4f}"], requires="C2", nums=True, err=["doubles the P-value for a one-sided test"])]),
        part("D", "State a conclusion in the context of the problem. Justify your answer using the P-value and the significance level.", 3, "explain", ["4.G"],
             (f"The P-value ${P:.4f}$ is less than $0.05$, so reject $H_0$. There is convincing evidence that the proportion who {c['what']} is greater for {c['a']} than for {c['b']}." if rej else f"The P-value ${P:.4f}$ is greater than $0.05$, so fail to reject $H_0$. There is not convincing evidence that the proportion who {c['what']} is greater for {c['a']} than for {c['b']}."),
             [R("D1", f"Compares the P-value ({P:.4f}) with the significance level 0.05 ({'less' if rej else 'greater'})", ["compares P-value with alpha"], nums=True, err=["compares the test statistic with alpha"]), R("D2", "Makes the decision: " + ("rejects" if rej else "fails to reject") + " the null hypothesis", ["rejects" if rej else "fails to reject"], requires="D1", err=["accepts the null hypothesis"]),
              R("D3", "States the conclusion about the population proportions in context (" + ("convincing" if rej else "not convincing") + " evidence)", ["conclusion in context about the populations"], requires="D2", err=["generalizes only to the samples"])]),
    ]
    for pt, tc in zip(parts, [["3.12"], ["3.13"], ["3.13"], ["3.13"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n5_q3_twoprop", "q3_inference", "3.13", ["3.9", "3.12"], "3.E", f"Comparing the proportions of {c['a']} and {c['b']} who {c['what']}", stim, parts, 22,
                    [f"n1={n1}", f"n2={n2}", f"z={z:.3f}", f"P={P:.4f}"], [ev("C", "test statistic z", z, 0.02), ev("C", "P-value", P, 0.001)],
                    ("A complete two-proportion z test: hypotheses, conditions for both samples including large counts, test statistic and P-value, and a conclusion in context",
                     ["State hypotheses about the two population proportions", "Verify the random, 10 percent and large counts conditions for both samples", "Compute z with the pooled proportion and the one-sided P-value and decide"],
                     [("a two-proportion z test needs independent random samples each under 10 percent of its population and at least ten successes and failures in each group", "the problem gives both samples and their counts")], {"type": "text", "must_include": ["both samples", "counts"]},
                     "z and the P-value are recomputed with math.erf and the pooled proportion and the decision at alpha 0.05 is checked for a margin of at least 0.012"),
                    ["procedure_choice", "condition_check", "claim_justification"])


# ======================= Q4. 이항 + 표본비율의 분포 + 비율 구간 (2.10 + 3.2 + 3.3 / 3.C) =======================
Q4_CTX = [dict(unit="voters", u1="voter", pop="voters in a large county", ev="support a library bond", plural="voters"), dict(unit="customers", u1="customer", pop="customers of an online store", ev="return an item", plural="customers")]


def stfrq_n5_q4_binom(rng):
    c = pick(rng, Q4_CTX)
    for _ in forever():
        p = rng.choice([0.3, 0.35, 0.4, 0.45, 0.6]); k = rng.choice([8, 10, 12]); kk = rng.choice([3, 4, 5])
        n2 = rng.choice([200, 250, 300, 400]); cut = round(p + rng.choice([0.04, 0.05, 0.06]), 2); n3 = rng.choice([250, 300, 400]); x3 = int(round(n3 * (p + rng.choice([-0.03, 0.02, 0.04]))))
        pa = float(ss.binom.sf(kk - 1, k, p)); pa_ind = 1 - sum(math.comb(k, j) * p ** j * (1 - p) ** (k - j) for j in range(kk)); agree(pa, pa_ind, tol=1e-9, name="binom")
        mu, sd = p, math.sqrt(p * (1 - p) / n2); pb = float(ss.norm.sf(cut, mu, sd)); pb_ind = 1 - ncdf((cut - mu) / sd); agree(pb, pb_ind, tol=1e-9, name="pb")
        ph = x3 / n3; z = zstar(0.95); se = math.sqrt(ph * (1 - ph) / n3); lo, hi = ph - z * se, ph + z * se
        if 0.05 < pa < 0.95 and 0.02 < pb < 0.5 and n2 * p >= 10 and n2 * (1 - p) >= 10 and n3 * ph >= 10 and n3 * (1 - ph) >= 10 and 0.2 < ph < 0.8:
            break
    thr = 0.5; covers = lo <= thr <= hi
    stim = {"kind": "text", "description": f"A polling organization knows from past surveys that about ${round(p * 100)}\\%$ of the {c['pop']} {c['ev']}.", "data": {}}
    parts = [
        part("A", f"Suppose that ${k}$ {c['unit']} are selected at random from a very large population in which ${round(p * 100)}\\%$ {c['ev']}. Let $X$ be the number of the {c['unit']} who {c['ev']}. Identify the distribution of $X$ and calculate the probability that at least ${kk}$ of the ${k}$ {c['unit']} {c['ev']}. Round to three decimal places.", 2, "calculate", ["3.C"],
             f"$X$ is binomial with $n = {k}$ and $p = {p}$. $P(X \\ge {kk}) = 1 - P(X \\le {kk - 1}) \\approx {pa:.3f}$.",
             [R("A1", f"Identifies a binomial distribution with n = {k} and p = {p}", ["binomial", f"n = {k}", f"p = {p}"], err=["gives p as a percent without converting", "names a normal distribution"]), R("A2", f"Calculates the probability of at least {kk} (answer {pa:.3f})", [f"{pa:.3f}"], requires="A1", nums=True, err=["computes P(X > {0})".format(kk), "computes P(X = {0})".format(kk)])]),
        part("B", f"A random sample of ${n2}$ {c['unit']} is selected from the population. State the mean and the standard deviation of the sampling distribution of the sample proportion $\\hat p$, and verify that the sampling distribution is approximately normal.", 2, "calculate", ["3.D"],
             f"The mean is ${p}$ and the standard deviation is $\\sqrt{{{p}(1-{p})/{n2}}} \\approx {sd:.4f}$. Both $np = {n2 * p:.1f}$ and $n(1-p) = {n2 * (1 - p):.1f}$ are at least $10$, so the sampling distribution is approximately normal.",
             [R("B1", f"States that the mean is {p} and the standard deviation is {sd:.4f}", [f"{p}", f"{sd:.4f}"], nums=True, err=["gives the standard deviation without the square root", "uses the sample proportion in place of p"]), R("B2", f"Verifies the large counts condition with np = {n2 * p:.1f} and n(1 - p) = {n2 * (1 - p):.1f}, both at least 10", [f"{n2 * p:.1f}", f"{n2 * (1 - p):.1f}"], nums=True, err=["checks only the sample size", "uses p-hat"])]),
        part("C", f"Using the sampling distribution from part (B), calculate the probability that the sample proportion is greater than ${cut}$. Round to three decimal places.", 2, "calculate", ["3.C"],
             f"$z = ({cut} - {p})/{sd:.4f} = {(cut - p) / sd:.2f}$ and $P(\\hat p > {cut}) \\approx {pb:.3f}$.",
             [R("C1", f"Standardizes the value: z = ({cut} - {p})/{sd:.4f} of about {(cut - p) / sd:.2f}", [f"{(cut - p) / sd:.2f}"], nums=True, err=["uses the standard deviation of a single value", "subtracts in the wrong order"]), R("C2", f"Finds the upper tail probability (answer {pb:.3f})", [f"{pb:.3f}"], requires="C1", nums=True, err=["finds the lower tail"])]),
        part("D", f"In a different random sample of ${n3}$ {c['unit']}, ${x3}$ {c['ev'].replace('support', 'support')}. Assume that the conditions are met and calculate a $95\\%$ confidence interval for the proportion of all {c['unit']} in the population who {c['ev']}. Round the endpoints to three decimal places.", 2, "calculate", ["3.E"],
             f"$\\hat p = {x3}/{n3} = {ph:.3f}$; ${ph:.3f} \\pm 1.96\\sqrt{{{ph:.3f}(1-{ph:.3f})/{n3}}}$ gives $({lo:.3f}, {hi:.3f})$.",
             [R("D1", "Identifies a one-sample z interval for a proportion with the standard error computed from the sample proportion", ["one-sample z interval for a proportion"], err=["uses a t interval", "uses p0 in the standard error"]), R("D2", f"Calculates the interval (answer ({lo:.3f}, {hi:.3f}))", [f"{lo:.3f}", f"{hi:.3f}"], requires="D1", nums=True, err=["uses the wrong critical value"])]),
        part("E", f"A reporter claims that exactly half of all {c['unit']} in the population {c['ev']}. Does the interval from part (D) provide convincing evidence against the reporter's claim? Justify your answer, and interpret the confidence level.", 2, "explain", ["4.F"],
             (f"No. The value $0.5$ is inside the interval $({lo:.3f}, {hi:.3f})$, so it is a plausible value and there is not convincing evidence against the claim. The $95\\%$ confidence level means that the method captures the true proportion in about $95\\%$ of all random samples." if covers else
              f"Yes. The value $0.5$ is not inside the interval $({lo:.3f}, {hi:.3f})$, so it is not a plausible value and there is convincing evidence against the claim. The $95\\%$ confidence level means that the method captures the true proportion in about $95\\%$ of all random samples."),
             [R("E1", "Compares the claimed value 0.5 with the interval and states whether it is inside the interval, and the resulting conclusion about the claim in context", ["0.5 " + ("inside" if covers else "outside") + " the interval", "conclusion in context"], nums=True, err=["compares 0.5 with the sample proportion only"]),
              R("E2", "Interprets the confidence level as the long-run success rate of the method (about 95% of random samples capture the true proportion)", ["95% of intervals from random samples capture the parameter"], requires="E1", err=["says there is a 95% probability that the parameter is in this interval"])]),
    ]
    for pt, tc in zip(parts, [["2.10"], ["3.2"], ["3.2"], ["3.3"], ["3.4"]]):
        pt["topic_codes"] = tc
    return frq_pack("stfrq_n5_q4_binom", "q4_integrated", "2.10", ["3.2", "3.3", "3.4"], "3.C", f"{cap(c['unit'])} who {c['ev']}: a binomial probability, the distribution of a sample proportion and an interval", stim, parts, 22,
                    [f"k={k}", f"p={p}", f"cut={cut}", f"n3={n3}", f"x3={x3}"], [ev("A", "binomial probability", pa, 0.001), ev("B", "standard deviation of the sample proportion", sd, 0.0005), ev("C", "probability for the sample proportion", pb, 0.001), ev("D", "interval lower endpoint", lo, 0.001), ev("D", "interval upper endpoint", hi, 0.001)],
                    ("An integrated question: a binomial probability, the mean and standard deviation of a sample proportion with the large counts check, a normal probability for the sample proportion, a confidence interval for a proportion and a claim judged by the interval",
                     ["Use a binomial distribution", "Describe the sampling distribution of the sample proportion and find a probability", "Construct and use a confidence interval for a proportion"],
                     [("the sample proportion has mean p and standard deviation sqrt(p(1-p)/n) and is approximately normal when np and n(1-p) are at least 10", "the problem states the population proportion and the sample sizes")], {"type": "text", "must_include": ["population proportion", "sample sizes"]},
                     "the binomial probability is recomputed from the combinations formula and scipy, the normal probability with math.erf, and the interval with a critical value from bisection on the normal cdf"),
                    ["procedure_choice", "interpretation", "claim_justification"])


STAGE_FRQ = ["stfrq_n5_q1_hist", "stfrq_n5_q2_outlier", "stfrq_n5_q3_twoprop", "stfrq_n5_q4_binom"]

# P5 첫 FRQ 런에서 반려된 Q1·Q2·Q4 를 고쳐 다시 돌린다
STAGE_FIXFRQ = ["stfrq_n5_q1_hist", "stfrq_n5_q2_outlier", "stfrq_n5_q4_binom"]
