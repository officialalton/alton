"""AP Statistics 연습 시험 3(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 3·4·5. 기존 공개 세트(ST1·ST2)의 틀(카이제곱 귀무·자유도, 출력 읽기, 두 표본 t 통계량, 오차 유형 해석, 평균 차 추정 등)을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(math.erf 이분법·수치 적분·분수·numpy)로 다시 계산한다. 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


def gaps_ok(vals, g):
    return min(abs(x - y) for i, x in enumerate(vals) for j, y in enumerate(vals) if i < j) >= g


# ======================= 17. 추정량의 편향과 변동 비교 (3.1 / 2.D, 표) =======================
ES_CTX = [dict(what="the proportion of all voters in a city who support a measure", unit="proportion", theta=0.40, names="plans for choosing the sample"), dict(what="the mean number of hours that all students at a school sleep on a school night", unit="hours", theta=7.2, names="formulas for estimating the mean")]


def st_n_estimator_compare(rng):
    c = pick(rng, ES_CTX)
    th = c["theta"]; sc = 0.01 if c["unit"] == "proportion" else 0.1
    for _ in forever():
        sd = sorted(rng.sample([2, 3, 4, 6, 8], 4))  # 표준편차(sc 단위)
        bias = [0, 0, rng.choice([-1, 1]) * rng.choice([5, 6, 8]), rng.choice([-1, 1]) * rng.choice([4, 5])]
        order = list(range(4)); rng.shuffle(order)
        break
    # 추정량 0: 편향 0·표준편차 중간, 1: 편향 0·표준편차 큼, 2: 편향 큼·표준편차 가장 작음, 3: 편향 있음·표준편차 큼
    sds = [sd[1], sd[2], sd[0], sd[3]]
    mean_ = [th + b * sc for b in bias]
    letters = "ABCD"
    # 독립 경로: 평균이 참값과 0.5 sc 안에 있는 추정량 중 표준편차가 최소인 것을 찾는다
    cand = [i for i in range(4) if abs(mean_[i] - th) < 0.5 * sc]
    best = min(cand, key=lambda i: sds[i]); assert best == 0
    fm = (lambda v: f"${v:.2f}$") if c["unit"] == "proportion" else (lambda v: f"${v:.1f}$")
    rows = [[f"Estimator {letters[order.index(i)]}", fm(mean_[i]), fm(sds[i] * sc)] for i in range(4)]
    rows.sort(key=lambda r: r[0])
    L = lambda i: f"Estimator {letters[order.index(i)]}"
    key = (f"{L(0)}, because the center of its sampling distribution is at the true value and its spread is the smallest among the estimators that are centered there.", "An estimator that is unbiased has a sampling distribution centered at the parameter, and among unbiased estimators the one with the least variability is best.")
    wr = [(f"{L(2)}, because it has the smallest spread of all the estimators.", "Considers variability alone; the center of this sampling distribution is not at the true value, so the estimator is biased.", "variability_only", None, 1),
          (f"{L(1)}, because the center of its sampling distribution is at the true value.", "Considers bias alone; another estimator is also centered at the true value and has less variability.", "bias_only", None, 2),
          (f"{L(3)}, because its sampling distribution has the largest spread and so covers the most possible values.", "Treats a larger spread as an advantage; more variability means estimates that are farther from the parameter more often.", "spread_good", None, 1)]
    ns = rng.choice([1000, 2000])
    stim = stat_stim(f"Mean and standard deviation of the estimates from {ns} simulated samples", "table", title=f"Results of {ns} simulated samples for each estimator", columns=["Estimator", "Mean of the estimates", "Standard deviation of the estimates"], rows=rows)
    stem = f"The true value of {c['what']} is ${th:g}$. A researcher compares four estimators by simulating ${ns}$ samples for each and computing the estimate from every sample. The table shown gives the mean and the standard deviation of the estimates for each estimator. Which estimator is best for estimating the true value?"
    return mc("st_n_estimator_compare", "3.1", "2.D", "Choose the best estimator from the center and spread of its simulated sampling distribution",
              ["Compare the center of each sampling distribution with the true value to find the unbiased estimators", "Among the unbiased estimators choose the one with the smallest spread and reject choices based on only one of the two properties"],
              key, wr, rng, stem, "the unbiased estimators are found by comparing each mean with the true value and the best one has the smallest standard deviation among them; the biased estimator with the smallest spread is deliberately included", ["representation_reading", "claim_justification", "interpretation"], stim, est=95, facts=[f"theta={th}"],
              sig=(["bias of an estimator", "variability of an estimator"], 1, "none"))


# ======================= 18. 모비율 신뢰구간 계산 (3.3 / 3.E) =======================
PC_CTX = [dict(who="a random sample of ${n}$ visitors to a zoo", ev_s="bought a souvenir", ev_p="bought a souvenir", pop="visitors to the zoo"), dict(who="a random sample of ${n}$ residents of a county", ev_s="said that they recycle every week", ev_p="recycle every week", pop="residents of the county"),
          dict(who="a random sample of ${n}$ customers of an online store", ev_s="returned an item", ev_p="returned an item", pop="customers of the store")]


def st_n_prop_ci_compute(rng):
    c = pick(rng, PC_CTX)
    for _ in forever():
        n = pick(rng, [150, 200, 250, 300, 400, 500]); x = rng.randint(int(0.3 * n), int(0.6 * n)); ph = x / n
        se = math.sqrt(ph * (1 - ph) / n); z = zstar(0.95); z90 = zstar(0.90); z99 = zstar(0.99)
        agree(z, ss.norm.ppf(0.975), tol=1e-6, name="z95")
        cands = {"key": (ph - z * se, ph + z * se), "z90": (ph - z90 * se, ph + z90 * se), "nosqrt": (ph - z * ph * (1 - ph) / n, ph + z * ph * (1 - ph) / n), "z99": (ph - z99 * se, ph + z99 * se)}
        flat = [round(v, 3) for t in cands.values() for v in t]
        if len(set(flat)) == 8 and gaps_ok([cands[k][0] for k in cands], 0.004) and gaps_ok([cands[k][1] for k in cands], 0.004) and n * ph >= 10 and n * (1 - ph) >= 10:
            break
    fm = lambda t: f"$({t[0]:.3f},\\ {t[1]:.3f})$"
    key = (fm(cands["key"]), f"The interval is $\\hat p \\pm z^* \\sqrt{{\\hat p(1-\\hat p)/n}}$ with $\\hat p = {ph:.3f}$ and $z^* \\approx 1.960$, which gives {fm(cands['key'])}.", cands["key"][0])
    wr = [(fm(cands["z90"]), "Uses the critical value for $90\\%$ confidence, about $1.645$, instead of about $1.960$.", "wrong_confidence_z", cands["z90"][0], 1), (fm(cands["nosqrt"]), "Leaves out the square root in the standard error, which makes the margin of error far too small.", "no_square_root", cands["nosqrt"][0], 2),
          (fm(cands["z99"]), "Uses the critical value for $99\\%$ confidence, about $2.576$, instead of about $1.960$.", "wrong_confidence_z99", cands["z99"][0], 1)]
    stem = f"In {c['who'].format(n=n)}, ${x}$ {c['ev_s']}. Assume that the conditions for inference are met. Which of the following is a $95\\%$ confidence interval for the proportion of all {c['pop']} who {c['ev_p']}? (Round the endpoints to three decimal places.)"
    return mc("st_n_prop_ci_compute", "3.3", "3.E", "Construct a confidence interval for a population proportion from the sample count",
              ["Find the sample proportion and its standard error", "Multiply the standard error by the critical value for the stated confidence level and form the interval around the sample proportion"],
              key, wr, rng, stem, "the interval is recomputed with a critical value from bisection on the normal cdf and compared with scipy's inverse normal function", ["procedure_choice", "calculated_value_decision"], est=100, facts=[f"n={n}", f"x={x}"])


# ======================= 19. 모수와 통계량 식별 (3.1 / 2.A) =======================
PS_CTX = [dict(pop="all voters in a county", what="plan to vote for a ballot measure", sample="${n}$ randomly selected voters", ph=None), dict(pop="all of the bolts that a factory produced this week", what="are within the specification", sample="${n}$ randomly selected bolts", ph=None),
          dict(pop="all adults who live in a city", what="have a library card", sample="${n}$ randomly selected adults", ph=None)]


def st_n_param_statistic(rng):
    c = pick(rng, PS_CTX)
    n = pick(rng, [150, 200, 250, 400]); x = rng.randint(int(0.35 * n), int(0.65 * n)); ph = x / n
    p3 = f"${ph:.3f}$"
    key = (f"The parameter is the proportion of {c['pop']} who {c['what']}, and the statistic is {p3}.", "A parameter describes the whole population and its value is unknown, while a statistic is computed from the sample.")
    wr = [(f"The parameter is {p3}, and the statistic is the proportion of {c['pop']} who {c['what']}.", "Reverses the two terms: the value computed from the sample is the statistic.", "terms_reversed", None, 1),
          (f"The parameter is the number ${n}$, and the statistic is {p3}.", "The sample size is a feature of the study, not the unknown population proportion that is being estimated.", "sample_size_as_parameter", None, 1),
          (f"The parameter is the proportion of the sample who {c['what']}, and the statistic is {p3}.", "The proportion in the sample is the statistic itself; the parameter is the proportion in the whole population.", "sample_as_parameter", None, 2)]
    stem = f"A researcher selects {c['sample'].format(n=n)} from {c['pop']} and finds that ${x}$ of them {c['what']}. Which of the following correctly identifies the parameter and the statistic for estimating the proportion of the population who {c['what']}?"
    return mc("st_n_param_statistic", "3.1", "2.A", "Identify the parameter and the statistic in a study that estimates a proportion",
              ["Decide which quantity describes the whole population and is unknown", "Decide which quantity is computed from the sample and match each to its name"],
              key, wr, rng, stem, "each option pairs a quantity with a name; exactly one pairing assigns the population proportion to the parameter and the sample proportion to the statistic", ["interpretation", "claim_justification"], est=70, facts=[f"n={n}", f"x={x}"])


# ======================= 20. 두 모비율 차 검정의 가설 (3.12 / 2.E) =======================
HP_CTX = [dict(a="students who use a new study planner", b="students who do not use the planner", what="turn in all of their homework", p1="the proportion of all students who use the planner who turn in all of their homework", p2="the proportion of all students who do not use the planner who turn in all of their homework"),
          dict(a="patients who take a daily walk", b="patients who do not walk", what="are readmitted within a month", p1="the proportion of all patients who take a daily walk who are readmitted within a month", p2="the proportion of all patients who do not walk who are readmitted within a month"),
          dict(a="customers who receive a coupon", b="customers who do not receive a coupon", what="make a second purchase", p1="the proportion of all customers who receive a coupon who make a second purchase", p2="the proportion of all customers who do not receive a coupon who make a second purchase")]


def st_n_hyp_two_prop(rng):
    c = pick(rng, HP_CTX)
    d = pick(rng, ["greater", "less"])
    sym = ">" if d == "greater" else "<"; opp = "<" if d == "greater" else ">"
    key = (f"$H_0: p_1 - p_2 = 0$ and $H_a: p_1 - p_2 {sym} 0$", f"The researcher suspects that $p_1$ is {d} than $p_2$, so the alternative hypothesis is one-sided in that direction and the null hypothesis states no difference between the population proportions.")
    wr = [(f"$H_0: p_1 - p_2 = 0$ and $H_a: p_1 - p_2 {opp} 0$", "The alternative hypothesis points in the direction opposite to the researcher's suspicion.", "direction_reversed", None, 1),
          (f"$H_0: \\hat{{p}}_1 - \\hat{{p}}_2 = 0$ and $H_a: \\hat{{p}}_1 - \\hat{{p}}_2 {sym} 0$", "States the hypotheses with sample proportions; hypotheses are about the population proportions, not the statistics.", "statistics_in_hypotheses", None, 2),
          ("$H_0: p_1 - p_2 = 0$ and $H_a: p_1 - p_2 \\neq 0$", "Uses a two-sided alternative although the researcher suspects a difference in one specific direction.", "two_sided_for_directional", None, 1)]
    stem = f"A researcher takes independent random samples of {c['a']} and of {c['b']}, and records whether each one {c['what']}. Let $p_1$ be {c['p1']}, and let $p_2$ be {c['p2']}. The researcher suspects that $p_1$ is {d} than $p_2$ and will carry out a test of significance. Which of the following gives the appropriate hypotheses?"
    return mc("st_n_hyp_two_prop", "3.12", "2.E", "State the hypotheses for a test about the difference of two population proportions",
              ["Define the parameters as population proportions and write the null hypothesis as no difference", "Write the alternative hypothesis in the direction the researcher suspects, using the same order of subtraction"],
              key, wr, rng, stem, "each option differs from the key by exactly one named defect: the direction, the use of statistics, or a two-sided alternative", ["procedure_choice", "claim_justification"], est=85, facts=[f"d={d}"])


# ======================= 21. 모의 실험 점도표로 P-값 어림하고 결론 (3.6 / 4.G, 점도표) =======================
SV_CTX = [dict(who="A cafe owner claims that $40\\%$ of customers order a seasonal drink.", prop="the proportion of all customers who order a seasonal drink", obs="customers ordered a seasonal drink", sus="greater", p0=0.4, pop="customers"),
          dict(who="A school reports that $30\\%$ of its students walk to school.", prop="the proportion of all students who walk to school", obs="students walk to school", sus="less", p0=0.3, pop="students"),
          dict(who="A seed company claims that $80\\%$ of its seeds germinate.", prop="the proportion of all seeds that germinate", obs="seeds germinated", sus="less", p0=0.8, pop="seeds")]


def st_n_sim_pvalue(rng):
    c = pick(rng, SV_CTX)
    n = 50; p0 = c["p0"]; gen = np.random.default_rng(rng.randrange(10 ** 9)); sims = 50
    for _ in forever():
        draws = gen.binomial(n, p0, size=sims)
        cnt = {int(v): int((draws == v).sum()) for v in np.unique(draws)}
        x0 = int(round(n * p0)) + (rng.choice([4, 5, 6]) if c["sus"] == "greater" else -rng.choice([4, 5, 6]))
        tail = sum(v for k_, v in cnt.items() if (k_ >= x0 if c["sus"] == "greater" else k_ <= x0))
        other = sims - tail
        if 1 <= tail <= 12 and abs(tail / sims - 0.05) >= 0.03 and len(cnt) >= 7 and max(cnt.values()) <= 15:
            break
    agree(tail, int(((draws >= x0) if c["sus"] == "greater" else (draws <= x0)).sum()), name="tail")
    pv = tail / sims; rej = pv < 0.05
    sg = "greater" if c["sus"] == "greater" else "less"
    P = lambda v: f"${v:.2f}$"
    word = f"{c['prop']} is {sg} than ${p0}$"
    key = (f"The estimated P-value is {P(pv)}, which is {'less' if rej else 'greater'} than $0.05$, so there is {'convincing' if rej else 'not convincing'} evidence that {word}.", f"{tail} of the {sims} simulated counts are as extreme as the observed value in the direction of $H_a$, so the estimated P-value is ${tail}/{sims} = {pv:.2f}$, and comparing it with $0.05$ gives the decision.")
    wr = [(f"The estimated P-value is {P(other / sims)}, which is greater than $0.05$, so there is not convincing evidence that {word}.", "Counts the simulated values on the wrong side of the observed value, which is the opposite tail from the alternative hypothesis.", "wrong_tail", None, 1),
          (f"The estimated P-value is {P(pv)}, which is {'less' if rej else 'greater'} than $0.05$, so there is {'not convincing' if rej else 'convincing'} evidence that {word}.", "Finds the P-value correctly but reverses the decision rule: a P-value below the significance level is evidence against the null hypothesis.", "decision_reversed", None, 2),
          (f"The estimated P-value is {P(pv)}, which is the probability that the null hypothesis is true, so the claim of ${p0}$ is {'unlikely' if rej else 'likely'} to be true.", "Interprets the P-value as the probability that the null hypothesis is true; it is the probability of results at least this extreme if the null hypothesis is true.", "p_value_as_prob_h0", None, 3)]
    stim = stat_stim(f"Dotplot of {sims} simulated sample counts when the null hypothesis is true", "dot_plot", title=f"Simulated number of {c['pop']} out of {n} when the claim is true", xTitle=f"Number out of {n}", dots=[{"value": v, "count": k_} for v, k_ in sorted(cnt.items())])
    stem = f"{c['who']} In a random sample of ${n}$ {c['pop']}, ${x0}$ {c['obs']}, and the researcher suspects that {c['prop']} is {sg} than ${p0}$. To test the claim, a computer simulated ${sims}$ random samples of ${n}$ {c['pop']} when the true proportion is ${p0}$. The dotplot shown gives the number in each simulated sample. Using the simulation and a significance level of $0.05$, which of the following is the best conclusion? (Estimate the P-value to two decimal places.)"
    return mc("st_n_sim_pvalue", "3.6", "4.G", "Estimate a P-value from a simulated null distribution and draw a conclusion",
              ["Count the simulated results that are as extreme as the observed result in the direction of the alternative hypothesis", "Divide by the number of simulations to estimate the P-value and compare it with the significance level", "State the conclusion about the claim without calling the P-value the probability of the null hypothesis"],
              key, wr, rng, stem, "the simulated counts come from numpy's binomial sampler and the tail count is recomputed from the raw draws; cases within 0.03 of 0.05 are excluded", ["representation_reading", "claim_justification", "calculated_value_decision"], stim, est=110, facts=[f"x0={x0}", f"tail={tail}"],
              sig=(["simulation-based P-value", "decision at a significance level", "meaning of a P-value"], 1, "light"))


# ======================= 22. 신뢰수준과 표본 크기를 함께 바꿀 때 오차한계 (3.3 / 2.D) =======================
MT_CTX = [dict(what="the proportion of adults in a region who own an electric bicycle"), dict(what="the proportion of a company's invoices that are paid late"), dict(what="the proportion of apples in an orchard that have a blemish")]


def st_n_me_tradeoff(rng):
    c = pick(rng, MT_CTX)
    for _ in forever():
        c0, c1 = pick(rng, [(0.90, 0.99), (0.90, 0.95), (0.95, 0.99), (0.99, 0.90), (0.95, 0.90)]); m = pick(rng, [2, 3, 4, 9])
        zr = zstar(c1) / zstar(c0); r = zr / math.sqrt(m); nosq = zr / m; zonly = zr; nonly = 1 / math.sqrt(m)
        vals = [round(100 * v) for v in (r, nosq, zonly, nonly)]
        if len(set(vals)) == 4 and gaps_ok(vals, 6):
            break
    ratio_chk = (ss.norm.ppf(1 - (1 - c1) / 2) / ss.norm.ppf(1 - (1 - c0) / 2)) / math.sqrt(m)
    agree(ratio_chk, r, tol=1e-5, name="ratio")
    pc = lambda v: f"${round(100 * v)}\\%$"
    key = (f"About {pc(r)} of the original margin of error", f"The margin of error is proportional to $z^*/\\sqrt{{n}}$; the critical value changes by a factor of about ${zr:.3f}$ and the sample size changes by a factor of ${m}$, so the margin changes by ${zr:.3f}/\\sqrt{{{m}}} \\approx {r:.2f}$.", r)
    wr = [(f"About {pc(nosq)} of the original margin of error", f"Divides by ${m}$ instead of by $\\sqrt{{{m}}}$ when the sample size changes; the margin of error is proportional to $1/\\sqrt{{n}}$.", "no_square_root_n", nosq, 2), (f"About {pc(zonly)} of the original margin of error", "Accounts only for the change in the confidence level and ignores the change in the sample size.", "confidence_only", zonly, 1),
          (f"About {pc(nonly)} of the original margin of error", "Accounts only for the change in the sample size and ignores the change in the confidence level.", "sample_size_only", nonly, 1)]
    stem = f"A researcher constructs a ${round(c0 * 100)}\\%$ confidence interval for {c['what']}. The researcher then constructs a ${round(c1 * 100)}\\%$ confidence interval from a new random sample that is ${m}$ times as large, and the sample proportion is about the same. The margin of error of the new interval is about what percent of the margin of error of the original interval?"
    return mc("st_n_me_tradeoff", "3.3", "2.D", "Find how the margin of error changes when the confidence level and the sample size both change",
              ["Find the factor by which the critical value changes when the confidence level changes", "Find the factor by which the sample size changes the standard error and combine the two factors"],
              key, wr, rng, stem, "the critical values come from bisection on the normal cdf and from scipy, and the combined factor is recomputed from both", ["procedure_choice", "calculated_value_decision", "interpretation"], est=100, facts=[f"c0={c0}", f"c1={c1}", f"m={m}"],
              sig=(["margin of error and confidence level", "margin of error and sample size"], 1, "light"))


# ======================= 23. 두 비율 구간의 조건 점검 (3.10 / 4.E, 표) =======================
TC_CTX = [dict(g=("Group A", "Group B"), what="a vaccine", unit="participants", succ="developed antibodies", fail="did not develop antibodies", pop="a large population of volunteers"),
          dict(g=("New method", "Standard method"), what="a teaching method", unit="students", succ="passed the test", fail="did not pass the test", pop="all students in a large state"),
          dict(g=("Treated plots", "Untreated plots"), what="a soil treatment", unit="plots", succ="had a healthy crop", fail="did not have a healthy crop", pop="all of the farm's thousands of plots")]


def st_n_cond_two_prop(rng):
    c = pick(rng, TC_CTX)
    bad = pick(rng, ["s1", "f1", "s2", "f2"])
    n1 = rng.randint(55, 90); n2 = rng.randint(60, 100)
    s1 = rng.randint(int(.4 * n1), int(.7 * n1)); s2 = rng.randint(int(.4 * n2), int(.7 * n2))
    small = rng.randint(4, 8)
    if bad == "s1": s1 = small
    if bad == "f1": s1 = n1 - small
    if bad == "s2": s2 = small
    if bad == "f2": s2 = n2 - small
    cells = {"s1": s1, "f1": n1 - s1, "s2": s2, "f2": n2 - s2}
    viol = [k for k, v in cells.items() if v < 10]
    assert viol == [bad], (viol, bad)
    nm = {"s1": (c["g"][0], c["succ"]), "f1": (c["g"][0], c["fail"]), "s2": (c["g"][1], c["succ"]), "f2": (c["g"][1], c["fail"])}
    g_, o_ = nm[bad]
    key = (f"The large counts condition is not met, because only ${cells[bad]}$ of the {c['unit']} in {g_.lower()} {o_}, which is fewer than $10$.", "Each of the four counts of successes and failures must be at least $10$ for a two-proportion z procedure, and one count is smaller than that.")
    wr = [(f"The $10\\%$ condition is not met, because the samples are too small compared with {c['pop']}.", "The $10\\%$ condition requires each sample to be less than $10\\%$ of its population, which is true when the population is much larger than the samples.", "ten_percent_misread", None, 1),
          ("The independence condition between the groups is not met, because the two groups were compared with each other.", "Comparing two groups is the purpose of the procedure; the condition asks that the two samples be independent of each other, which random samples from separate groups are.", "comparison_not_independence", None, 2),
          ("All of the conditions are met, because both sample sizes are greater than $30$.", "The sample sizes are large, but the large counts condition is about the counts of successes and failures in each group, and one count is too small.", "sample_size_only", None, 1)]
    stim = stat_stim(f"Counts of {c['unit']} that {c['succ']} in two groups", "table", title=f"Outcomes in the two groups ({c['what']})", columns=["Group", c["succ"].capitalize(), c["fail"].capitalize(), "Total"], rows=[[c["g"][0], str(s1), str(n1 - s1), str(n1)], [c["g"][1], str(s2), str(n2 - s2), str(n2)]])
    stem = f"A researcher takes independent random samples of {c['unit']} from two groups to study {c['what']}, and the sample from each group is less than $10\\%$ of the group. The table shown summarizes the results. The researcher plans to construct a confidence interval for the difference between the two population proportions. Which of the following statements about the conditions for the interval is correct?"
    return mc("st_n_cond_two_prop", "3.10", "4.E", "Find which condition for a two-proportion interval fails from the counts in a table",
              ["Check the four counts of successes and failures against the large counts condition", "Decide that the condition with a count below ten is the one that fails and reject the other conditions, which the design satisfies"],
              key, wr, rng, stem, "exactly one of the four counts is generated below 10 and the check confirms that it is the only one; the random and 10 percent conditions are stated in the stem", ["condition_check", "representation_reading"], stim, est=95, facts=[f"bad={bad}", f"cells={cells}"],
              sig=(["large counts condition", "random and independent samples"], 1, "none"))


# ======================= 24. 두 비율 차 z 통계량(합동 비율) (3.13 / 3.E) =======================
ZT_CTX = [dict(g=("the morning shift", "the evening shift"), what="workers who reported a safety incident", unit="workers"), dict(g=("the east region", "the west region"), what="households that use solar panels", unit="households"),
          dict(g=("first-year students", "fourth-year students"), what="students who own a bicycle", unit="students")]


def st_n_two_prop_z(rng):
    c = pick(rng, ZT_CTX)
    for _ in forever():
        n1 = rng.randint(120, 220); n2 = rng.randint(150, 260)
        s1 = rng.randint(int(.30 * n1), int(.55 * n1)); s2 = rng.randint(int(.2 * n2), int(.45 * n2))
        p1, p2 = s1 / n1, s2 / n2; pp = (s1 + s2) / (n1 + n2)
        z = (p1 - p2) / math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2))
        zu = (p1 - p2) / math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
        zbad2 = (p1 - p2) / math.sqrt(pp * (1 - pp) * (1 / (n1 + n2)))
        zbad3 = (p1 - p2) / math.sqrt(pp * (1 - pp) / n1 + pp * (1 - pp) / n2) * 0 + (p1 - p2) / (pp * (1 - pp) * (1 / n1 + 1 / n2))
        vals = [z, zu, zbad2, zbad3]
        if abs(z) > 1.2 and gaps_ok([round(v, 2) for v in vals], 0.05) and all(abs(v) < 150 for v in vals):
            break
    agree(z, (lambda a, b: (a[0] / a[1] - b[0] / b[1]) / math.sqrt(((a[0] + b[0]) / (a[1] + b[1])) * (1 - (a[0] + b[0]) / (a[1] + b[1])) * (1 / a[1] + 1 / b[1])))((s1, n1), (s2, n2)), name="z")
    zz = lambda v: f"${v:.2f}$"
    key = (zz(z), f"The pooled proportion is $({s1} + {s2})/({n1} + {n2}) \\approx {pp:.3f}$, the standard error is $\\sqrt{{{pp:.3f}(1 - {pp:.3f})(1/{n1} + 1/{n2})}}$, and $z = ({p1:.3f} - {p2:.3f})/\\mathrm{{SE}} \\approx {z:.2f}$.", round(z, 2))
    wr = [(zz(zu), "Uses the two separate sample proportions in the standard error; a test of equal proportions uses the pooled proportion.", "not_pooled", round(zu, 2), 1), (zz(zbad2), "Uses $1/(n_1+n_2)$ in place of $1/n_1 + 1/n_2$ inside the standard error.", "wrong_sample_size_term", round(zbad2, 2), 2),
          (zz(zbad3), "Leaves out the square root when dividing by the standard error, which divides by the variance instead.", "no_square_root", round(zbad3, 2), 3)]
    stem = f"A researcher takes independent random samples of ${n1}$ {c['unit']} from {c['g'][0]} and ${n2}$ {c['unit']} from {c['g'][1]}. Of these, ${s1}$ and ${s2}$ are {c['what']}. The researcher will test $H_0: p_1 = p_2$ against $H_a: p_1 \\neq p_2$, and the conditions for inference are met. What is the value of the test statistic $z$? (Round to two decimal places.)"
    return mc("st_n_two_prop_z", "3.13", "3.E", "Compute the z statistic for a test of two population proportions with the pooled proportion",
              ["Find the pooled sample proportion because the null hypothesis says the two proportions are equal", "Use the pooled proportion in the standard error of the difference", "Divide the difference of the sample proportions by that standard error"],
              key, wr, rng, stem, "the statistic is recomputed from the counts with a one-line formula and compared with the value built from the pooled proportion step by step", ["procedure_choice", "calculated_value_decision", "condition_check"], est=120, facts=[f"s1={s1}", f"s2={s2}", f"n1={n1}", f"n2={n2}"],
              sig=(["pooled proportion", "standard error of a difference"], 1, "light"))


# ======================= 25. 카이제곱 기대 빈도 계산 (3.15 / 3.C, 이원표) =======================
CE_CTX = [dict(rows=("Freshman", "Sophomore", "Junior"), cols=("Band", "Chorus", "Orchestra"), rh="Class", what="students at a school by class and music group"),
          dict(rows=("Morning", "Afternoon", "Evening"), cols=("Walk-in", "Appointment", "Online"), rh="Time of day", what="clients of a service by time of day and way of booking"),
          dict(rows=("Urban", "Suburban", "Rural"), cols=("Cat", "Dog", "Other pet"), rh="Area", what="households by area and type of pet")]


def st_n_chisq_expected(rng):
    c = pick(rng, CE_CTX)
    for _ in forever():
        cells = [[rng.randint(14, 60) for _ in range(3)] for _ in range(3)]
        rt = [sum(r) for r in cells]; ct = [sum(cells[i][j] for i in range(3)) for j in range(3)]; N = sum(rt)
        i, j = rng.randrange(3), rng.randrange(3)
        e = rt[i] * ct[j] / N; w1 = rt[i] / 3; w2 = rt[(i + 1) % 3] * ct[j] / N; w3 = float(cells[i][j])
        if gaps_ok([round(v, 1) for v in (e, w1, w2, w3)], 0.6):
            break
    chi, pv, dof, exp = ss.chi2_contingency(np.array(cells))
    agree(exp[i][j], e, tol=1e-9, name="expected")
    f1 = lambda v: f"${v:.1f}$"
    key = (f1(e), f"The expected count is (row total)(column total)/(grand total) $= ({rt[i]})({ct[j]})/{N} \\approx {e:.1f}$.", round(e, 1))
    wr = [(f1(w1), "Divides the row total by the number of columns, which assumes that every column is equally likely; the expected count uses the column total.", "equal_columns", round(w1, 1), 1), (f1(w2), "Uses the total of a different row; the expected count for a cell uses the totals of its own row and its own column.", "wrong_row_total", round(w2, 1), 1),
          (f1(w3), "Reports the observed count in the cell; the expected count is what the null hypothesis predicts.", "observed_not_expected", round(w3, 1), 1)]
    stim = stat_stim(f"Two-way table of {c['what']}", "two_way", title="Observed counts in the sample", rowHeader=c["rh"], rowLabels=list(c["rows"]), colLabels=list(c["cols"]), cells=cells)
    stem = f"A random sample of ${N}$ was classified as shown in the table. A chi-square test of independence is planned. What is the expected count for the cell in the {c['rows'][i].lower()} row and the {c['cols'][j].lower()} column when the null hypothesis is true? (Round to one decimal place.)"
    return mc("st_n_chisq_expected", "3.15", "3.C", "Find the expected count of one cell for a chi-square test of independence",
              ["Find the total of the row and the total of the column that contain the cell and the grand total", "Compute row total times column total divided by the grand total"],
              key, wr, rng, stem, "the expected count is recomputed with scipy's chi-square contingency routine and compared with the row-total-times-column-total formula", ["procedure_choice", "representation_reading", "calculated_value_decision"], stim, est=90, facts=[f"cell={i},{j}"])


# ======================= 26. 표본평균의 표준편차를 반으로 줄이는 방법 (4.1 / 2.D) =======================
SE_CTX = [dict(what="the mean time, in seconds, to complete an online form", n=(25, 40, 64)), dict(what="the mean weight, in grams, of a batch of packaged almonds", n=(36, 50, 80)), dict(what="the mean number of minutes that commuters spend in traffic", n=(30, 45, 100))]


def st_n_se_change(rng):
    c = pick(rng, SE_CTX)
    n = pick(rng, list(c["n"])); sd = pick(rng, [3.2, 4.8, 6.4, 7.2])
    f = pick(rng, [2, 3])
    se0 = sd / math.sqrt(n); se1 = sd / math.sqrt(n * f * f)
    agree(se1, se0 / f, name="se")
    key = (f"Increase the sample size to ${n * f * f}$, which is ${f * f}$ times as large.", f"The standard deviation of the sample mean is $\\sigma/\\sqrt{{n}}$, so dividing it by ${f}$ requires multiplying $n$ by ${f}^2 = {f * f}$.")
    wr = [(f"Increase the sample size to ${n * f}$, which is ${f}$ times as large.", f"Multiplies the sample size by ${f}$, but the standard deviation of the sample mean is divided by only $\\sqrt{{{f}}}$ when $n$ is multiplied by ${f}$.", "linear_in_n", None, 1),
          (f"Sample from a population that is ${f}$ times as large, keeping the sample size at ${n}$.", "The standard deviation of the sample mean depends on the sample size, not on the size of the population when the population is large.", "population_size", None, 1),
          (f"Increase the sample size to ${n * f ** 4}$, which is ${f ** 4}$ times as large.", f"Multiplies the sample size by ${f}$ twice too often; that would divide the standard deviation by ${f * f}$ rather than by ${f}$.", "overcorrection", None, 2)]
    stem = f"The population standard deviation is $\\sigma = {sd}$ for {c['what']}. A researcher takes simple random samples of size ${n}$ from a very large population, so the sampling distribution of the sample mean has a standard deviation of about ${se0:.2f}$. The researcher wants the standard deviation of the sample mean to be about ${se0 / f:.2f}$. Which of the following changes would achieve this?"
    return mc("st_n_se_change", "4.1", "2.D", "Decide how the sample size must change to divide the standard deviation of the sample mean by a given factor",
              ["Write the standard deviation of the sample mean as sigma over the square root of n", "Find the factor by which n must change so that the square root of n changes by the factor needed"],
              key, wr, rng, stem, "the new standard deviation is recomputed from sigma over the square root of the stated new sample size and equals the target", ["procedure_choice", "interpretation", "claim_justification"], est=90, facts=[f"n={n}", f"f={f}"])


# ======================= 27. 평균의 t 구간 계산 (4.2 / 3.E) =======================
TI_CTX = [dict(what="the time, in minutes, that a sample of nurses spent on paperwork during one shift", unit="minutes", mean=(40, 70), sd=(6, 12)), dict(what="the length, in centimeters, of fish caught in a lake", unit="centimeters", mean=(30, 50), sd=(3, 7)),
          dict(what="the daily sales, in units, of a bakery's rolls", unit="rolls", mean=(120, 180), sd=(12, 25))]


def st_n_t_interval_compute(rng):
    c = pick(rng, TI_CTX)
    for _ in forever():
        n = pick(rng, [12, 16, 20, 25]); xb = rng.randint(*c["mean"]) + rng.choice([0, 0.4, 0.8]); s = rng.randint(*c["sd"]) + rng.choice([0, 0.5])
        df = n - 1; t = tstar(0.95, df); t90 = tstar(0.90, df); se = s / math.sqrt(n)
        z = zstar(0.95)
        cands = {"key": (xb - t * se, xb + t * se), "z": (xb - z * se, xb + z * se), "nosqrt": (xb - t * s / n, xb + t * s / n), "t90": (xb - t90 * se, xb + t90 * se)}
        if gaps_ok([cands[k][0] for k in cands], 0.12) and gaps_ok([cands[k][1] for k in cands], 0.12):
            break
    fm = lambda t_: f"$({t_[0]:.2f},\\ {t_[1]:.2f})$"
    key = (fm(cands["key"]), f"The interval is $\\bar x \\pm t^* s/\\sqrt{{n}}$ with $\\bar x = {xb:g}$, $s = {s:g}$, $n = {n}$ and $t^* \\approx {t:.3f}$ for ${df}$ degrees of freedom, which gives {fm(cands['key'])}.", round(cands["key"][0], 2))
    wr = [(fm(cands["z"]), "Uses the normal critical value $1.960$ instead of the $t$ critical value for the stated degrees of freedom, which makes the interval too narrow.", "z_for_t", round(cands["z"][0], 2), 1), (fm(cands["nosqrt"]), "Divides $s$ by $n$ instead of by $\\sqrt{n}$ in the standard error.", "no_square_root", round(cands["nosqrt"][0], 2), 2),
          (fm(cands["t90"]), "Uses the $t$ critical value for $90\\%$ confidence instead of for $95\\%$ confidence.", "wrong_confidence_t", round(cands["t90"][0], 2), 1)]
    stem = f"A random sample of ${n}$ measurements of {c['what']} has mean ${xb:g}$ {c['unit']} and standard deviation ${s:g}$ {c['unit']}. The measurements are approximately normally distributed. For a $95\\%$ confidence interval with ${df}$ degrees of freedom, $t^* \\approx {t:.3f}$. Which of the following is the $95\\%$ confidence interval for the population mean? (Round the endpoints to two decimal places.)"
    return mc("st_n_t_interval_compute", "4.2", "3.E", "Construct a t confidence interval for a population mean from summary statistics",
              ["Compute the standard error of the mean from the sample standard deviation and sample size", "Multiply by the given critical value and form the interval around the sample mean"],
              key, wr, rng, stem, "the t critical value comes from numerical integration of the t density and from scipy, and the interval is recomputed from the summary statistics", ["procedure_choice", "calculated_value_decision"], est=110, facts=[f"n={n}", f"xb={xb}", f"s={s}"])


# ======================= 28. 쌍체 평균 차 검정의 가설 (4.9 / 2.E) =======================
MP_CTX = [dict(what="the time, in seconds, to run a 400-meter course", cond="before and after a four-week training program", diff="after minus before", d="after", sus="lower", unit="athletes"),
          dict(what="the score on a balance test", cond="with and without a stabilizing insole", diff="with insole minus without insole", d="with", sus="higher", unit="volunteers"),
          dict(what="the number of typing errors in a five-minute task", cond="using a new keyboard and using the usual keyboard", diff="new keyboard minus usual keyboard", d="new", sus="lower", unit="employees")]


def st_n_hyp_paired(rng):
    c = pick(rng, MP_CTX)
    lo = c["sus"] == "lower"
    sym = "<" if lo else ">"; opp = ">" if lo else "<"
    key = (f"$H_0: \\mu_d = 0$ and $H_a: \\mu_d {sym} 0$", f"The pairs are the units, so the parameter is the mean of the population differences ({c['diff']}); the researcher suspects the differences are {c['sus']} than $0$, so the alternative is one-sided in that direction.")
    wr = [(f"$H_0: \\mu_d = 0$ and $H_a: \\mu_d {opp} 0$", f"Reverses the direction of the alternative: with the differences defined as {c['diff']}, the suspicion corresponds to the other sign.", "direction_reversed", None, 2),
          (f"$H_0: \\mu_1 - \\mu_2 = 0$ and $H_a: \\mu_1 - \\mu_2 {sym} 0$", "Writes hypotheses for two independent samples, but the same individuals were measured twice, so the parameter is the mean of the differences.", "two_sample_for_pairs", None, 1),
          (f"$H_0: \\bar{{x}}_d = 0$ and $H_a: \\bar{{x}}_d {sym} 0$", "States the hypotheses with a sample mean difference; hypotheses are about the population mean difference.", "statistic_in_hypotheses", None, 2)]
    stem = f"A researcher measures {c['what']} for each of ${rng.choice([14, 18, 22, 26])}$ randomly selected {c['unit']} {c['cond']}. Let $\\mu_d$ be the population mean of the differences ({c['diff']}). The researcher suspects that the mean difference is {c['sus']} than $0$ and will carry out a test of significance. Which of the following gives the appropriate hypotheses?"
    return mc("st_n_hyp_paired", "4.4", "2.E", "State the hypotheses for a matched-pairs test with a stated direction of subtraction",
              ["Recognize that the differences are the data when the same individuals are measured twice", "Write hypotheses for the population mean difference in the direction that matches the stated subtraction"],
              key, wr, rng, stem, "each option differs from the key by one named defect: the sign of the alternative, the two-sample parameters, or a statistic in the hypotheses", ["procedure_choice", "claim_justification"], est=90, facts=[f"sus={c['sus']}"],
              sig=(["matched pairs", "direction of the alternative hypothesis"], 1, "none"))


# ======================= 29. t 분포표에서 P-값 범위와 결론 (4.5 / 4.G, 표) =======================
def st_n_t_table(rng):
    for _ in forever():
        df = pick(rng, [14, 19, 24, 29]); tails = [0.10, 0.05, 0.025, 0.01, 0.005]
        crit = [tstar(1 - 2 * a, df) for a in tails]  # 단측 상위 꼬리 a: 양측 신뢰수준 1-2a
        k = rng.randrange(0, 4)  # 검정통계량이 crit[k] 와 crit[k+1] 사이
        t = round(crit[k] + (crit[k + 1] - crit[k]) * rng.uniform(0.3, 0.7), 2)
        lo_a, hi_a = tails[k + 1], tails[k]
        if crit[k] < t < crit[k + 1]:
            break
    for a, cv in zip(tails, crit):
        agree(cv, ss.t.isf(a, df), tol=1e-4, name="tcrit")
    rej = hi_a <= 0.05  # P < hi_a 이고 P > lo_a. 0.05 와 비교: P 구간 전체가 0.05 미만이면 기각
    assert (hi_a <= 0.05) or (lo_a >= 0.05)
    rng_s = f"between ${lo_a:g}$ and ${hi_a:g}$"
    pr = lambda a, b: f"between ${a:g}$ and ${b:g}$"
    dec = lambda r: "reject" if r else "fail to reject"
    ev = lambda r: "there is convincing evidence that $\\mu > 50$" if r else "there is not convincing evidence that $\\mu > 50$"
    key = (f"The P-value is {rng_s}, so at the $0.05$ significance level we {dec(rej)} $H_0$; {ev(rej)}.", f"A one-sided test uses the upper tail probability: ${t}$ is between $t^* = {crit[k]:.3f}$ (tail ${tails[k]:g}$) and $t^* = {crit[k + 1]:.3f}$ (tail ${tails[k + 1]:g}$) in the row for ${df}$ degrees of freedom, so the P-value is {rng_s}.")
    wr = [(f"The P-value is {pr(2 * lo_a, 2 * hi_a)}, so at the $0.05$ significance level we {dec(2 * hi_a <= 0.05)} $H_0$; {ev(2 * hi_a <= 0.05)}.", "Doubles the tail probabilities as for a two-sided test although the alternative hypothesis is one-sided.", "doubled_for_one_sided", None, 2),
          (f"The P-value is {rng_s}, so at the $0.05$ significance level we {dec(not rej)} $H_0$; {ev(not rej)}.", "Finds the P-value range correctly but reverses the decision: a P-value below $0.05$ leads to rejecting $H_0$.", "decision_reversed", None, 3),
          (f"The P-value is {pr(1 - hi_a, 1 - lo_a)}, so at the $0.05$ significance level we fail to reject $H_0$; there is not convincing evidence that $\\mu > 50$.", "Uses the lower tail probability, which is the area on the wrong side of the test statistic for this alternative hypothesis.", "wrong_tail", None, 1)]
    wr = wr[:3]
    rows = [[f"{d_}"] + [f"{tstar(1 - 2 * a, d_):.3f}" for a in tails] for d_ in [df - 1, df, df + 1]]
    stim = stat_stim("Critical values of the t distribution", "table", title="Critical values of t for the upper-tail probability", columns=["Degrees of freedom"] + [f"{a:g}" for a in tails], rows=rows)
    n = df + 1
    stem = f"A random sample of ${n}$ observations from an approximately normal population is used to test $H_0: \\mu = 50$ against $H_a: \\mu > 50$. The test statistic is $t = {t}$. The table shown gives critical values of the $t$ distribution for the upper-tail probability at the top of each column. Which of the following is the correct statement about the P-value and the conclusion?"
    return mc("st_n_t_table", "4.5", "4.G", "Bracket a one-sided P-value with a t table and draw the conclusion",
              ["Find the row for the degrees of freedom and locate the test statistic between two critical values", "Read the one-sided tail probabilities of those values as the range for the P-value without doubling them", "Compare the range with the significance level to state the decision and the conclusion"],
              key, wr, rng, stem, "the critical values are recomputed with scipy's inverse t function and the test statistic lies strictly between two adjacent critical values, so the P-value range is unique", ["representation_reading", "claim_justification", "procedure_choice"], stim, est=110, facts=[f"df={df}", f"t={t}"],
              sig=(["P-value from a t table", "one-sided versus two-sided tail", "decision at a significance level"], 1, "none"))


# ======================= 30. 두 표본평균 차의 표준편차 (4.6 / 3.D) =======================
SD_CTX = [dict(a="students who use a paper planner", b="students who use a phone app", what="hours of homework per week"), dict(a="the daytime shift", b="the night shift", what="packages sorted per hour"), dict(a="shoppers at the north store", b="shoppers at the south store", what="dollars spent per visit")]


def st_n_diff_means_sd(rng):
    c = pick(rng, SD_CTX)
    for _ in forever():
        n1 = rng.choice([25, 36, 40, 49, 64]); n2 = rng.choice([30, 45, 50, 81]); s1 = rng.choice([3.0, 4.0, 5.0, 6.0]); s2 = rng.choice([2.0, 4.5, 7.0, 8.0])
        v = math.sqrt(s1 ** 2 / n1 + s2 ** 2 / n2); add = s1 / math.sqrt(n1) + s2 / math.sqrt(n2); pooled = math.sqrt((s1 ** 2 + s2 ** 2) / (n1 + n2)); var = s1 ** 2 / n1 + s2 ** 2 / n2
        vals = [v, add, pooled, var]
        if gaps_ok([round(x, 2) for x in vals], 0.04):
            break
    agree(v, math.sqrt(np.var([0], ddof=0) + s1 ** 2 / n1 + s2 ** 2 / n2), name="sd")
    f2 = lambda x: f"${x:.2f}$"
    key = (f2(v), f"The variances of independent sample means add: $\\sqrt{{{s1:g}^2/{n1} + {s2:g}^2/{n2}}} \\approx {v:.2f}$.", round(v, 2))
    wr = [(f2(add), "Adds the two standard deviations of the sample means; for independent samples the variances add, and the standard deviation is the square root of their sum.", "add_standard_deviations", round(add, 2), 1), (f2(pooled), "Combines the two samples as if they came from one population, dividing the total variance by the total sample size.", "pooled_sample_size", round(pooled, 2), 2),
          (f2(var), "Reports the variance of the difference of the sample means instead of its standard deviation, which needs the square root.", "variance_not_sd", round(var, 2), 2)]
    stem = f"Independent random samples of ${n1}$ from {c['a']} and ${n2}$ from {c['b']} are used to compare {c['what']}. The population standard deviations are ${s1:g}$ and ${s2:g}$, respectively. What is the standard deviation of the sampling distribution of $\\bar x_1 - \\bar x_2$? (Round to two decimal places.)"
    return mc("st_n_diff_means_sd", "4.6", "3.D", "Find the standard deviation of the difference of two independent sample means",
              ["Recognize that the variances of independent sample means add", "Take the square root of the sum of the two variances of the sample means"],
              key, wr, rng, stem, "the standard deviation is recomputed from the sum of the two variances of the sample means", ["procedure_choice", "calculated_value_decision", "interpretation"], est=95, facts=[f"n1={n1}", f"n2={n2}"])


# ======================= 31. 자료 배치로 방법 고르기 (4.4 / 2.C, 표) =======================
MF_CTX = [dict(what="the number of push-ups completed", unit="athletes", cond=("Before the program", "After the program"), layout="paired", q="whether a six-week program changes the mean number of push-ups"),
          dict(what="the number of push-ups completed", unit="athletes", cond=("Group 1", "Group 2"), layout="indep", q="whether the mean number of push-ups differs between two independent teams of athletes"),
          dict(what="the minutes needed to solve a puzzle", unit="players", cond=("With hint", "Without hint"), layout="paired", q="whether a hint changes the mean time, when each player solved one puzzle with a hint and another without"),
          dict(what="the minutes needed to solve a puzzle", unit="players", cond=("Group A", "Group B"), layout="indep", q="whether the mean time differs between two separate groups of players")]
PROC = {"paired": "A matched-pairs $t$ procedure for the mean of the differences", "indep": "A two-sample $t$ procedure for the difference of two means", "one": "A one-sample $t$ procedure for a single mean", "chi": "A chi-square test of independence"}
PROC_WHY = {"paired": "Each row is one individual measured twice, so the differences within the rows are the data for the procedure.", "indep": "The two columns hold measurements of different individuals, so the two samples are independent and are compared with a two-sample procedure."}


def st_n_method_from_table(rng):
    c = pick(rng, MF_CTX)
    k = c["layout"]; other = "indep" if k == "paired" else "paired"
    nrow = 6
    base = [rng.randint(18, 40) for _ in range(nrow)]
    other_col = [b + rng.randint(-4, 9) for b in base]
    unit = c["unit"]
    if k == "paired":
        cols = ["Individual", c["cond"][0], c["cond"][1]]; rows = [[f"{unit[:-1].capitalize()} {i + 1}", str(base[i]), str(other_col[i])] for i in range(nrow)]
    else:
        cols = ["Observation", c["cond"][0], c["cond"][1]]; rows = [[f"{i + 1}", str(base[i]), str(other_col[i])] for i in range(nrow)]
    key = (PROC[k], PROC_WHY[k])
    wr = [(PROC[other], "The data layout shows " + ("that the same individuals were measured twice, which makes the samples dependent, so a two-sample procedure does not apply." if k == "paired" else "measurements of different individuals in each column, so there are no pairs to take differences of."), "layout_misread", None, 1),
          (PROC["one"], "There are two sets of measurements to compare, not one set compared with a fixed value.", "one_sample", None, 1), (PROC["chi"], "The data are quantitative measurements, and a chi-square test is for counts of categorical variables.", "chi_square", None, 1)]
    stim = stat_stim(f"Data layout for {c['what']}", "table", title=f"Measurements of {c['what']}", columns=cols, rows=rows)
    stem = f"A researcher wants to investigate {c['q']}. Random samples were used, and the table shown gives the first ${nrow}$ rows of the data that were collected. Which of the following is the most appropriate procedure for the investigation?"
    return mc("st_n_method_from_table", "4.4", "2.C", "Choose between a matched-pairs and a two-sample t procedure from the layout of the data",
              ["Read how the rows are organized: whether each row holds one individual measured twice or separate observations in each column", "Choose the procedure that matches the design and reject procedures for one mean or for counts"],
              key, wr, rng, stem, "each context pairs a stated question with a table layout; the paired layout has individuals in rows and the independent layout has unrelated observations in each column", ["procedure_choice", "representation_reading"], stim, est=85, facts=[f"layout={k}"])


# ======================= 32. 통계적 유의성과 실질적 의미 (4.10 / 4.D) =======================
PR_CTX = [dict(what="the mean time to download a file", unit="seconds", a="the old server", b="the new server", diff=0.4, n=2500, base="12"), dict(what="the mean score on a reading test", unit="points", a="the old curriculum", b="the new curriculum", diff=0.6, n=3000, base="500"),
          dict(what="the mean weight of packaged cereal", unit="grams", a="the old machine", b="the new machine", diff=0.5, n=4000, base="400")]


def st_n_practical(rng):
    c = pick(rng, PR_CTX)
    n = c["n"]; sd = {"seconds": 3.0, "points": 6.0, "grams": 6.0}[c["unit"]]
    se = math.sqrt(2 * sd ** 2 / n); t = c["diff"] / se; P = 2 * ss.t.sf(abs(t), 2 * n - 2)
    assert P < 0.01
    key = (f"The difference is statistically significant, but a difference of ${c['diff']}$ {c['unit']} may be too small to matter in practice.", "A very small P-value shows that the difference is unlikely to be due to chance alone; whether the difference is large enough to matter is a separate judgment about its size.")
    wr = [(f"Because the P-value is very small, the difference of ${c['diff']}$ {c['unit']} must be large.", "A small P-value does not mean that the difference is large; with very large samples even tiny differences give small P-values.", "small_p_means_large_effect", None, 1),
          (f"The difference is not statistically significant, because ${c['diff']}$ {c['unit']} is a small difference.", "Whether a result is statistically significant depends on the P-value, which here is small; the size of the difference is not the criterion.", "small_difference_not_significant", None, 1),
          ("The result cannot be trusted, because the samples are so large that they are likely to include errors.", "Large random samples give more precise estimates, not less trustworthy ones.", "large_sample_distrust", None, 2)]
    stem = f"To compare {c['what']} for {c['a']} and {c['b']}, a researcher takes independent random samples of ${n}$ measurements for each. The sample means differ by ${c['diff']}$ {c['unit']}, with $\\mathrm{{P}}\\text{{-value}} < 0.01$ in a two-sample $t$ test of equal population means. Which of the following statements is correct?"
    return mc("st_n_practical", "4.10", "4.D", "Distinguish statistical significance from the practical size of a difference",
              ["Interpret the small P-value as evidence that the population means differ", "Judge the size of the difference separately and avoid concluding that a significant result is a large one"],
              key, wr, rng, stem, "the P-value is recomputed from the stated difference, an assumed standard deviation and the sample sizes and is below 0.01, so the two readings of significance are separated", ["interpretation", "claim_justification"], est=85, facts=[f"n={n}", f"t={t:.2f}"],
              sig=(["statistical significance", "practical significance"], 1, "none"))


# ======================= 33. 산점도 설명(방향·형태·강도) (5.1 / 4.A, 산점도) =======================
SC_CTX = [dict(x="Age of a car (years)", y="Resale price (thousands of dollars)", xr=(1, 12), a=24, b=-1.5, n=22), dict(x="Hours of daily sunshine", y="Daily ice cream sales (units)", xr=(2, 12), a=20, b=11, n=24),
          dict(x="Distance from the city center (km)", y="Monthly rent (hundreds of dollars)", xr=(1, 14), a=26, b=-1.4, n=22), dict(x="Number of absences", y="Final grade (points)", xr=(0, 14), a=94, b=-1.8, n=24)]


def st_n_scatter_describe(rng):
    c = pick(rng, SC_CTX)
    strong = pick(rng, [True, False])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        x = np.round(gen.uniform(*c["xr"], c["n"]), 1)
        sdn = abs(c["b"]) * (1.0 if strong else 4.2)
        y = np.round(c["a"] + c["b"] * x + gen.normal(0, sdn, c["n"]), 1)
        r = float(np.corrcoef(x, y)[0, 1])
        if (strong and abs(r) > 0.9) or (not strong and 0.2 < abs(r) < 0.55):
            break
    agree(r, float(np.cov(x, y)[0, 1] / (x.std(ddof=1) * y.std(ddof=1))), tol=1e-9, name="r")
    dirn = "positive" if r > 0 else "negative"; opp = "negative" if r > 0 else "positive"
    strg = "strong" if strong else "weak"; ostr = "weak" if strong else "strong"
    S = lambda d, s, f: f"A {s} {d} {f} association between the two variables"
    key = (S(dirn, strg, "linear") + ".", f"The points rise or fall along a line in the {dirn} direction and the correlation is ${r:.2f}$, which describes a {strg} linear relationship.")
    wr = [(S(opp, strg, "linear") + ".", f"Gives the wrong direction: as the horizontal variable increases the vertical variable tends to {'increase' if r > 0 else 'decrease'}.", "direction_reversed", None, 1),
          (S(dirn, ostr, "linear") + ".", f"Gives the wrong strength: the correlation of ${r:.2f}$ and the spread of the points show a {strg} relationship.", "strength_wrong", None, 2),
          (S(dirn, strg, "curved") + ".", "Describes a curved form, but the points follow a straight-line pattern with no bend.", "form_wrong", None, 2)]
    stim = stat_stim(f"Scatterplot of {c['y'].lower()} versus {c['x'].lower()}", "scatter", title=f"{c['y'].split(' (')[0]} versus {c['x'].split(' (')[0].lower()}", xTitle=c["x"], yTitle=c["y"], points=[[float(a), float(b)] for a, b in zip(x, y)])
    stem = f"The scatterplot shown displays {c['y'].split(' (')[0].lower()} and {c['x'].split(' (')[0].lower()} for ${c['n']}$ observations. Which of the following best describes the association between the two variables?"
    return mc("st_n_scatter_describe", "5.1", "4.A", "Describe the direction, form and strength of the association in a scatterplot",
              ["Read the direction in which the points trend and whether they follow a line or a curve", "Judge the strength from how closely the points follow the pattern and match all three features to the one option that is correct"],
              key, wr, rng, stem, "the strength class is decided by the sample correlation computed two ways, with strong above 0.9 and weak between 0.2 and 0.55 so that no case is borderline", ["representation_reading", "interpretation"], stim, est=75, facts=[f"r={r:.2f}", f"strong={strong}"])


# ======================= 34. 단위 변환·역할 교환 후 상관계수 (5.2 / 4.D) =======================
CR_CTX = [dict(x="height in inches", y="weight in pounds", x2="height in centimeters", y2="weight in kilograms", r=(0.55, 0.85)), dict(x="outdoor temperature in degrees Fahrenheit", y="electricity use in kilowatt-hours", x2="outdoor temperature in degrees Celsius", y2="electricity use in megajoules", r=(0.6, 0.9)),
          dict(x="distance driven in miles", y="fuel used in gallons", x2="distance driven in kilometers", y2="fuel used in liters", r=(0.7, 0.95))]


def st_n_corr_changes(rng):
    c = pick(rng, CR_CTX)
    r = round(rng.uniform(*c["r"]), 2)
    mode = pick(rng, ["units", "swap"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    x = gen.normal(0, 1, 200); y = r * x + math.sqrt(1 - r * r) * gen.normal(0, 1, 200)
    r1 = float(np.corrcoef(x, y)[0, 1]); r_units = float(np.corrcoef(2.54 * x + 5, 0.4536 * y + 2)[0, 1]); r_swap = float(np.corrcoef(y, x)[0, 1])
    agree(r1, r_units, tol=1e-9, name="r_units"); agree(r1, r_swap, tol=1e-9, name="r_swap")
    if mode == "units":
        what = f"Each {c['x'].split(' in ')[0]} is converted to {c['x2'].split(' in ')[1]} and each {c['y'].split(' in ')[0]} is converted to {c['y2'].split(' in ')[1]}."
    else:
        what = f"The researcher interchanges the roles of the two variables, using {c['y']} as the explanatory variable and {c['x']} as the response variable."
    key = (f"The correlation is still ${r}$, because the correlation does not depend on the units and does not depend on which variable is called explanatory.", "The correlation is computed from standardized values, so linear changes of units and exchanging the two variables leave its value unchanged.")
    wr = [(f"The correlation is multiplied by the conversion factors and so is no longer ${r}$.", "Believes that the correlation depends on the units; it is unchanged by linear changes of units because it is based on standardized values.", "units_change_r", None, 1),
          (f"The correlation becomes ${-r}$, because the roles or the units of the variables are different.", "Confuses a change in the roles or units with a change in the direction of the association; the sign of the correlation is unchanged.", "sign_flips", None, 1),
          (f"The correlation is unchanged at ${r}$, but only if the new variables have the same standard deviations as the old variables.", "The correlation does not depend on the standard deviations of the variables, so no such requirement is needed.", "needs_equal_sd", None, 2)]
    stem = f"A researcher finds that the correlation between {c['x']} and {c['y']} for a random sample of individuals is $r = {r}$. {what} Which of the following statements about the correlation of the new data is correct?"
    return mc("st_n_corr_changes", "5.2", "4.D", "Decide how the correlation coefficient responds to a change of units or an exchange of the variables",
              ["Recall that the correlation is based on standardized values of both variables", "Conclude that linear changes of units and exchanging the variables leave the correlation unchanged"],
              key, wr, rng, stem, "simulated standardized data show that a linear change of units and an exchange of the two variables leave the correlation equal to machine precision", ["interpretation", "claim_justification"], est=80, facts=[f"mode={mode}", f"r={r}"])


# ======================= 35. 요약 통계로 회귀직선 구하기 (5.3 / 3.B) =======================
RS_CTX = [dict(x="the number of hours of practice per week", y="the score on a skills test", xu="hours", yu="points", xm=(4, 9), xs=(1.5, 3), ym=(60, 85), ys=(6, 12)),
          dict(x="the age of a tree in years", y="the diameter of its trunk in centimeters", xu="years", yu="centimeters", xm=(15, 35), xs=(5, 10), ym=(30, 60), ys=(6, 14)),
          dict(x="the number of ads shown per week", y="the weekly sales in hundreds of dollars", xu="ads", yu="hundreds of dollars", xm=(10, 25), xs=(3, 6), ym=(40, 90), ys=(8, 16))]


def st_n_line_from_stats(rng):
    c = pick(rng, RS_CTX)
    for _ in forever():
        xm = rng.randint(*c["xm"]); xs = rng.choice([1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0]); ym = rng.randint(*c["ym"]); ys = rng.choice([6.0, 8.0, 9.0, 10.0, 12.0, 14.0]); r = rng.choice([0.5, 0.6, 0.7, 0.8, 0.9])
        b = r * ys / xs; a = ym - b * xm
        b2 = r * xs / ys; a2 = ym - b2 * xm; a3 = ym + b * xm; b4 = ys / xs; a4 = ym - b4 * xm
        vals = [(a, b), (a2, b2), (a3, b), (a4, b4)]
        if gaps_ok([round(v[1], 2) for v in vals if v[1] != b] + [round(b, 2)], 0.05) and a > 0 and a3 != a and len({round(v[0], 2) for v in vals}) == 4:
            break
    # 독립 경로: 평균·표준편차·상관을 정확히 갖는 합성 자료에 최소제곱 직선을 맞춘다
    gen = np.random.default_rng(5); zx = gen.normal(0, 1, 400); zx = (zx - zx.mean()) / zx.std(); w = gen.normal(0, 1, 400); w = w - (w * zx).mean() * zx; w = (w - w.mean()) / w.std()
    zy = r * zx + math.sqrt(1 - r * r) * w; xx = xm + xs * zx; yy = ym + ys * zy
    cf = np.polyfit(xx, yy, 1); agree(cf[0], b, tol=1e-6, name="slope"); agree(cf[1], a, tol=1e-6, name="intercept")
    fm = lambda a_, b_: f"$\\hat{{y}} = {a_:.2f} {'+' if b_ >= 0 else '-'} {abs(b_):.2f}x$"
    key = (fm(a, b), f"The slope is $b = r(s_y/s_x) = {r}({ys:g}/{xs:g}) = {b:.2f}$ and the intercept is $a = \\bar y - b\\bar x = {ym} - {b:.2f}({xm}) = {a:.2f}$.")
    wr = [(fm(a2, b2), "Uses $r(s_x/s_y)$ for the slope, inverting the ratio of standard deviations.", "inverted_sd_ratio", None, 1), (fm(a3, b), "Adds $b\\bar x$ to $\\bar y$ for the intercept instead of subtracting it.", "intercept_sign", None, 2), (fm(a4, b4), "Uses $s_y/s_x$ for the slope and leaves out the correlation.", "correlation_left_out", None, 1)]
    stem = f"For a random sample of individuals, let $x$ be {c['x']} and let $y$ be {c['y']}. The summary statistics are $\\bar x = {xm}$, $s_x = {xs:g}$, $\\bar y = {ym}$, $s_y = {ys:g}$ and $r = {r}$. Which of the following is the equation of the least-squares regression line for predicting $y$ from $x$? (Round the coefficients to two decimal places.)"
    return mc("st_n_line_from_stats", "5.3", "3.B", "Find the least-squares line from the means, standard deviations and correlation",
              ["Find the slope as the correlation times the ratio of the standard deviations in the right order", "Find the intercept so that the line passes through the point of the two means"],
              key, wr, rng, stem, "the slope is recomputed from simulated standardized data with the same correlation and the intercept from the point of means", ["procedure_choice", "calculated_value_decision"], est=100, facts=[f"r={r}", f"xs={xs}", f"ys={ys}"],
              sig=(["slope from correlation and standard deviations", "line through the point of means"], 1, "light"))


# ======================= 36. 절편의 해석(의미가 있는 경우와 없는 경우) (5.5 / 4.D) =======================
IN_CTX = [dict(x="the number of hours of tutoring per week", y="the predicted score on a math test", xu="hour", yu="points", a=52.0, b=4.5, ok=True, xr="$0$ to $6$"), dict(x="the height of a child, in centimeters", y="the predicted shoe length, in centimeters", xu="centimeter", yu="centimeters", a=-4.2, b=0.2, ok=False, xr="$90$ to $150$"),
          dict(x="the number of minutes of exercise per day", y="the predicted resting heart rate", xu="minute", yu="beats per minute", a=78.0, b=-0.3, ok=True, xr="$0$ to $60$"), dict(x="the weight of a used car, in pounds", y="the predicted resale price, in thousands of dollars", xu="pound", yu="thousand dollars", a=24.0, b=-0.004, ok=False, xr="$2000$ to $4000$")]


def st_n_intercept_meaning(rng):
    c = pick(rng, IN_CTX)
    a = c["a"]; b = c["b"]; ok = c["ok"]
    fa = lambda v: f"${v:g}$"
    if ok:
        key = (f"When {c['x']} is $0$, the predicted value is {fa(a)} {c['yu']}, and this is meaningful because $x = 0$ is within the range of the data.", "The intercept is the predicted value of $y$ when $x = 0$, and it can be interpreted because zero is within the range of the data.")
    else:
        key = (f"The intercept is {fa(a)} {c['yu']}, the predicted value when {c['x']} is $0$, but it has no practical meaning because $x = 0$ is far outside the range of the data.", "The intercept is the predicted value of $y$ when $x = 0$, but interpreting it would be extrapolation because zero is not near the data.")
    wr = [(f"For each additional {c['xu']}, the predicted value changes by {fa(a)} {c['yu']}.", "Interprets the intercept as the slope; the amount of change in the prediction per unit of $x$ is the slope.", "intercept_as_slope", None, 1),
          (f"Every individual with {c['x']} equal to $0$ has an actual value of exactly {fa(a)} {c['yu']}.", "Treats the predicted value as the actual value of every individual; the line gives a prediction, which differs from individual values by residuals.", "prediction_as_actual", None, 2),
          (f"The intercept shows that {c['x']} explains {fa(a)} percent of the variation in the response.", "Confuses the intercept with the coefficient of determination, which measures the percent of variation explained.", "intercept_as_r2", None, 1)]
    if ok:
        wr[1] = (f"The intercept is meaningless in every regression, because it is the value for $x = 0$, which never occurs in data.", "Whether the intercept has a meaning depends on whether $x = 0$ is within the range of the data; here it is.", "intercept_never_meaningful", None, 2)
    stem = f"A least-squares regression line for the data on {c['x']} and {c['y']} is $\\hat{{y}} = {a:g} {'+' if b >= 0 else '-'} {abs(b):g}x$. The values of $x$ in the data range from {c['xr']}. Which of the following is the correct statement about the intercept of the line?"
    return mc("st_n_intercept_meaning", "5.5", "4.D", "Interpret the intercept of a least-squares line and judge whether it has a meaning",
              ["Say what the intercept is: the predicted response when the explanatory variable equals zero", "Check whether zero is within the range of the data to decide whether the intercept has a practical meaning"],
              key, wr, rng, stem, "each context states the range of the data, so whether zero is within it decides which interpretation is correct", ["interpretation", "claim_justification", "condition_check"], est=85, facts=[f"ok={ok}"])


STAGE_SINGLES = ["st_n_estimator_compare", "st_n_prop_ci_compute", "st_n_param_statistic", "st_n_hyp_two_prop", "st_n_sim_pvalue", "st_n_me_tradeoff", "st_n_cond_two_prop", "st_n_two_prop_z", "st_n_chisq_expected",
                 "st_n_se_change", "st_n_t_interval_compute", "st_n_hyp_paired", "st_n_t_table", "st_n_diff_means_sd", "st_n_method_from_table", "st_n_practical",
                 "st_n_scatter_describe", "st_n_corr_changes", "st_n_line_from_stats", "st_n_intercept_meaning"]

# 첫 런(stats-r19-p3-a)에서 반려된 원형을 고친 뒤 다시 돌리는 목록(검토기 지적: 줄글 오타, 추정량 표 제목 불일치, 설명 순서 뒤바뀜, 복수 정답 가능성, 모호한 의견 질문, 약한 오답)
STAGE_FIX = ["st_n_stat_vs_nonstat", "st_n_plan_unbiased", "st_n_bias_direction", "st_n_union_complement", "st_n_binomial_scenario", "st_n_linear_transform", "st_n_estimator_compare"]
