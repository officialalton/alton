"""AP Statistics 연습 시험 4(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 3·4·5. 기존 공개 세트(ST1·ST2)와 연습 시험 3 의 풀이 틀을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(math.erf 이분법·수치 적분·분수·numpy)로 다시 계산한다. 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


# ======================= 17. 표본 크기 4배일 때 표본비율 분포의 변화 (3.2 / 2.D) =======================
PD_CTX = [dict(what="the proportion of all registered voters in a county who support a bond measure", who="voters"), dict(what="the proportion of all packages shipped by a company that arrive damaged", who="packages"), dict(what="the proportion of all students at a university who live on campus", who="students")]


def st_n_phat_dist_change(rng):
    c = pick(rng, PD_CTX)
    for _ in forever():
        p = rng.choice([0.2, 0.3, 0.4, 0.5, 0.6]); n = rng.choice([100, 150, 225, 400]); f = rng.choice([4, 9])
        s0 = math.sqrt(p * (1 - p) / n); s1 = math.sqrt(p * (1 - p) / (f * n)); k = math.sqrt(f)
        agree(s1, s0 / k, name="sd")
        if round(s0, 3) != round(s1, 3) and round(s0, 3) != round(s0 * k, 3):
            break
    fm = lambda m_, s_: f"The mean stays ${m_:g}$ and the standard deviation changes from ${s0:.3f}$ to ${s_:.3f}$."
    key = (fm(p, s1), f"The mean of the sampling distribution of $\\hat p$ is $p$ for every sample size, and the standard deviation $\\sqrt{{p(1-p)/n}}$ is divided by $\\sqrt{{{f}}} = {k:g}$ when $n$ is multiplied by ${f}$.")
    wr = [(fm(p, s0 * k), f"Multiplies the standard deviation by ${k:g}$, but a larger sample makes the sample proportions less variable.", "sd_increases", None, 1),
          (fm(p, s0), "Leaves the standard deviation unchanged, but the standard deviation of the sample proportion depends on the sample size.", "sd_unchanged", None, 1),
          (f"The mean changes to ${min(0.95, p * k):.2f}$ and the standard deviation changes from ${s0:.3f}$ to ${s1:.3f}$.", "The mean of the sampling distribution of the sample proportion is the population proportion and does not change with the sample size.", "mean_changes", None, 2)]
    if round(min(0.95, p * k), 2) == p:
        raise ValueError("mean_option_same")
    stem = f"The sampling distribution of $\\hat p$ is formed from random samples of ${n}$ for estimating {c['what']}, where $p = {p:g}$. The sample size is then multiplied by ${f}$, from ${n}$ to ${f * n}$. Which of the following describes the change in the sampling distribution of $\\hat p$? (Standard deviations are rounded to three decimal places.)"
    return mc("st_n_phat_dist_change", "3.2", "2.D", "Describe how the mean and the standard deviation of the sampling distribution of the sample proportion change when the sample size changes",
              ["Recall that the mean of the sampling distribution of the sample proportion equals the population proportion for any sample size", "Find how the standard deviation depends on the square root of the sample size and match both changes to one option"],
              key, wr, rng, stem, "the two standard deviations are recomputed from the square root of p(1-p)/n for both sample sizes and their ratio equals the square root of the sample size factor", ["interpretation", "calculated_value_decision", "procedure_choice"], est=95, facts=[f"p={p}", f"n={n}", f"f={f}"],
              sig=(["mean of a sampling distribution", "standard deviation of a sampling distribution"], 1, "light"))


# ======================= 18. 범주형 자료 배치로 방법 고르기 (3.14 / 2.C, 표) =======================
MC_CTX = [
    dict(kind="indep", sc="A random sample of ${N}$ adults in a city was classified by age group and by the way each adult usually travels to work.", rows=("Under 30", "30 to 49", "50 or older"), cols=("Car", "Transit", "Bike"), rh="Age group"),
    dict(kind="homog", sc="Independent random samples of ${n}$ customers were taken from each of three store locations, and each customer was asked whether he or she would recommend the store.", rows=("Store 1", "Store 2", "Store 3"), cols=("Would recommend", "Would not recommend"), rh="Location"),
    dict(kind="oneprop", sc="A company claims that $60\\%$ of its orders are delivered within two days. In a random sample of ${n}$ orders, the numbers delivered within two days and later were counted.", rows=("Sample",), cols=("Within two days", "Later"), rh="Orders"),
]
MC_OPT = {"oneprop": "A one-sample $z$ test for a population proportion", "twoprop": "A two-sample $z$ test for the difference of two population proportions", "homog": "A chi-square test for homogeneity", "indep": "A chi-square test of independence"}
MC_WHY = {"indep": "One sample is classified on two categorical variables, so the question is whether the variables are associated.", "homog": "Separate random samples are taken from three groups and one categorical variable is recorded, so the distributions in the three groups are compared.", "oneprop": "There is one sample and one claimed proportion, so the test is about a single population proportion."}


def st_n_method_from_counts(rng):
    c = pick(rng, MC_CTX)
    k = c["kind"]
    r_, c_ = len(c["rows"]), len(c["cols"])
    if k == "oneprop":
        n = rng.choice([150, 200, 250]); x = int(round(n * rng.uniform(0.48, 0.56))); cells = [[x, n - x]]
    elif k == "homog":
        n = rng.choice([60, 80, 100]); cells = [[(lambda a: [a, n - a])(rng.randint(int(.35 * n), int(.75 * n)))][0] for _ in range(3)]
    else:
        n = None; cells = [[rng.randint(14, 48) for _ in range(c_)] for _ in range(r_)]
    N = sum(map(sum, cells))
    if k == "oneprop":
        stim = stat_stim("Counts from the study", "table", title="Counts from the study", columns=["Delivery", "Number of orders"], rows=[[c["cols"][0], str(cells[0][0])], [c["cols"][1], str(cells[0][1])]])
    else:
        stim = stat_stim("Counts from the study", "two_way", title="Counts from the study", rowHeader=c["rh"], rowLabels=list(c["rows"]), colLabels=list(c["cols"]), cells=cells)
    key = (MC_OPT[k] + ".", MC_WHY[k])
    wr_keys = [o for o in ("oneprop", "twoprop", "homog", "indep") if o != k]
    whys = {"oneprop": "There is no claimed value for a single proportion in this study, and the table has more than a single sample.", "twoprop": "The table does not compare exactly two proportions from two independent samples; it has " + ("three groups" if k == "homog" else "more categories or only one sample") + ".",
            "homog": "The data do not come from separate random samples taken from several groups.", "indep": "The data do not come from one sample classified on two variables."}
    if k == "oneprop":
        whys["twoprop"] = "There is only one sample; a difference of two proportions needs two independent samples."; whys["homog"] = "There is only one sample and one claimed proportion, not separate samples from several groups."; whys["indep"] = "There is only one categorical variable measured on one sample, not two variables to compare."
    if k == "indep":
        whys["twoprop"] = "The table has three rows and three columns, so more than two proportions are involved; a two-proportion procedure does not apply."; whys["homog"] = "One sample was classified on both variables, rather than separate samples being taken from each age group."; whys["oneprop"] = "There is no claim about a single proportion; the question concerns two categorical variables."
    if k == "homog":
        whys["twoprop"] = "There are three groups, so the comparison is among three proportions; a two-proportion procedure applies only to two groups."; whys["indep"] = "The samples were taken separately from each location, rather than one sample being classified on two variables."; whys["oneprop"] = "No single claimed proportion is tested; the three groups are compared with each other."
    wr = [(MC_OPT[o] + ".", whys[o], "wrong_procedure_" + o, None, 1 + i % 2) for i, o in enumerate(wr_keys)]
    sc = c["sc"].replace("${N}$", f"${N}$").replace("${n}$", f"${n if n else N}$")
    stem = f"{sc} The table shown gives the counts. Which of the following procedures is the most appropriate for investigating the question the study was designed to answer?"
    if k == "indep":
        stem = f"{sc} The table shown gives the counts, and the researcher wants to know whether age group and way of traveling to work are associated. Which of the following procedures is most appropriate?"
    if k == "homog":
        stem = f"{sc} The table shown gives the counts, and the researcher wants to know whether the distribution of the answers is the same at the three locations. Which of the following procedures is most appropriate?"
    if k == "oneprop":
        stem = f"{sc} The table shown gives the counts, and the company wants to know whether the proportion differs from its claim. Which of the following procedures is most appropriate?"
    return mc("st_n_method_from_counts", "3.14", "2.C", "Choose the proportion or chi-square procedure that matches the sampling design and the table of counts",
              ["Read how the data were collected: one sample or several samples, and how many variables were recorded", "Match the design to the one procedure for proportions or chi-square that applies and reject the others"],
              key, wr, rng, stem, "each context fits exactly one of the four procedures by its design and table shape and the other three each fail the design", ["procedure_choice", "representation_reading"], stim, est=90, facts=[f"kind={k}"])


# ======================= 19. 두 비율의 차가 추정하는 모수 (3.9 / 2.A) =======================
DP_CTX = [dict(a="city A", b="city B", what="adults who own a bicycle", s1="${n1}$ adults", s2="${n2}$ adults", pa="adults in city A", pb="adults in city B"), dict(a="the east campus", b="the west campus", what="students who eat breakfast every day", s1="${n1}$ students", s2="${n2}$ students", pa="students on the east campus", pb="students on the west campus"),
          dict(a="the old design", b="the new design", what="visitors who click on the sign-up button", s1="${n1}$ visitors", s2="${n2}$ visitors", pa="visitors who see the old design", pb="visitors who see the new design")]


def st_n_diff_parameter(rng):
    c = pick(rng, DP_CTX)
    n1 = rng.choice([120, 150, 180, 240]); n2 = rng.choice([130, 160, 200, 250]); x1 = rng.randint(int(.3 * n1), int(.6 * n1)); x2 = rng.randint(int(.25 * n2), int(.55 * n2))
    d = x1 / n1 - x2 / n2
    key = (f"The difference between the proportion of all {c['pa']} who are among the {c['what']} and the proportion of all {c['pb']} who are among the {c['what']}.".replace(" who are among the " + c["what"], " in the population who are among the " + c["what"]) if False else f"The difference between the proportion of all {c['pa']} who are among the {c['what']} and the corresponding proportion for all {c['pb']}.", "A statistic estimates a parameter: the difference of the sample proportions estimates the difference of the two population proportions.")
    wr = [(f"The difference between the two sample proportions, ${d:.3f}$, which is computed from the two samples.", "This is the value of the statistic computed from the samples, not the parameter that it estimates.", "statistic_as_parameter", None, 1),
          (f"The proportion of all {c['pa']} and all {c['pb']} taken together who are among the {c['what']}.", "Combining the two populations estimates a single overall proportion, not the difference between the two proportions.", "combined_proportion", None, 1),
          (f"The difference between the sizes of the two samples, ${abs(n1 - n2)}$, which is a feature of the study.", "The sizes of the samples are features of the study and are not a population parameter.", "sample_sizes", None, 1)]
    stem = f"A researcher takes independent random samples of ${n1}$ from {c['a']} and ${n2}$ from {c['b']}, and finds that ${x1}$ and ${x2}$, respectively, are among the {c['what']}. The difference between the sample proportions, $\\hat p_1 - \\hat p_2 = {d:.3f}$, is used as an estimate. Which of the following is the parameter that this statistic estimates?"
    return mc("st_n_diff_parameter", "3.9", "2.A", "Identify the parameter that the difference of two sample proportions estimates",
              ["Recognize that the difference of the sample proportions is a statistic computed from the samples", "Identify the corresponding population quantity: the difference of the two population proportions"],
              key, wr, rng, stem, "each option names a different quantity; only the difference of the two population proportions is the parameter estimated by the difference of the sample proportions", ["interpretation", "claim_justification"], est=80, facts=[f"n1={n1}", f"n2={n2}"])


# ======================= 20. 유의수준에 따른 결정 (3.8 / 2.D) =======================
AR_CTX = [dict(sc="A test of $H_0: p = 0.4$ against $H_a: p > 0.4$ gives a P-value of ${P}$.", what="the proportion"), dict(sc="A test of whether the mean waiting time is $12$ minutes against a larger mean gives a P-value of ${P}$.", what="the mean"), dict(sc="A test of $H_0: p_1 - p_2 = 0$ against $H_a: p_1 - p_2 \\neq 0$ gives a P-value of ${P}$.", what="the difference")]


def st_n_alpha_relation(rng):
    c = pick(rng, AR_CTX)
    a_hi, a_lo = pick(rng, [(0.05, 0.01), (0.10, 0.05), (0.05, 0.025), (0.10, 0.01)])
    P = round(rng.uniform(a_lo * 1.25, a_hi * 0.8), 3)
    while not (a_lo < P < a_hi):
        P = round(rng.uniform(a_lo * 1.25, a_hi * 0.8), 3)
    S = lambda hi_dec, lo_dec: f"The null hypothesis is {hi_dec} at the ${a_hi:g}$ significance level and {lo_dec} at the ${a_lo:g}$ significance level."
    key = (S("rejected", "not rejected"), f"The P-value ${P:g}$ is less than ${a_hi:g}$ but greater than ${a_lo:g}$, so the null hypothesis is rejected at the larger significance level only.")
    wr = [(S("rejected", "rejected"), f"The P-value ${P:g}$ is greater than ${a_lo:g}$, so the null hypothesis is not rejected at that significance level.", "reject_both", None, 1), (S("not rejected", "not rejected"), f"The P-value ${P:g}$ is less than ${a_hi:g}$, so the null hypothesis is rejected at that significance level.", "reject_neither", None, 1),
          (S("not rejected", "rejected"), "A smaller significance level makes rejection harder, so a result rejected at the smaller level would also be rejected at the larger level.", "reversed_levels", None, 2)]
    stem = f"{c['sc'].replace('${P}$', f'${P:g}$')} Which of the following statements about the decision is correct?"
    return mc("st_n_alpha_relation", "3.8", "2.D", "Relate a P-value to decisions made at two different significance levels",
              ["Compare the P-value with each significance level separately", "Match the two decisions, rejecting only at the level that is larger than the P-value"],
              key, wr, rng, stem, "the P-value is generated strictly between the two significance levels so exactly one of the four decision pairs is correct", ["claim_justification", "procedure_choice"], est=75, facts=[f"P={P}", f"a={a_hi}/{a_lo}"])


# ======================= 21. 오차한계에 필요한 표본 크기 (3.3 / 3.E) =======================
SS_CTX = [dict(what="the proportion of adults in a city who use a ride-sharing app", who="adults"), dict(what="the proportion of a factory's parts that are defective", who="parts"), dict(what="the proportion of a county's voters who plan to vote", who="voters")]


def st_n_ci_sample_size(rng):
    c = pick(rng, SS_CTX)
    use_prior = pick(rng, [True, False])
    for _ in forever():
        me = rng.choice([0.02, 0.03, 0.04, 0.05]); conf = rng.choice([0.90, 0.95, 0.99]); pst = rng.choice([0.2, 0.3, 0.7]) if use_prior else 0.5
        z = zstar(conf); n_exact = z * z * pst * (1 - pst) / (me * me); n_key = math.ceil(n_exact)
        n_floor = math.floor(n_exact); n_half = math.ceil(z * z * 0.25 / (me * me)) if use_prior else math.ceil(z * z * pst * (1 - pst) / me)
        n_sq = math.ceil((z / me) * pst * (1 - pst)) if False else math.ceil(z * pst * (1 - pst) / me)
        opts = [n_key, n_floor, n_half, n_sq]
        if len(set(opts)) == 4 and n_exact != n_key and gaps_ok(opts, 1) and n_key < 3000:
            break
    agree(z, ss.norm.ppf(1 - (1 - conf) / 2), tol=1e-6, name="z")
    key = (f"${n_key}$", f"$n = z^{{*2}}\\hat p(1-\\hat p)/m^2 = ({z:.3f})^2({pst})({1 - pst:g})/({me})^2 \\approx {n_exact:.1f}$, which must be rounded up to ${n_key}$ so that the margin of error is no larger than ${me}$.", n_key)
    wr = [(f"${n_floor}$", "Rounds the calculated sample size down, which gives a margin of error slightly larger than the stated value; the sample size must be rounded up.", "rounded_down", n_floor, 2), (f"${n_half}$", ("Uses $\\hat p = 0.5$ although a prior estimate is given, which gives a larger sample size than needed." if use_prior else "Leaves out the square on the margin of error in the denominator."), "wrong_p_or_square", n_half, 1),
          (f"${n_sq}$", "Divides by the margin of error without squaring the margin of error and without squaring the critical value.", "no_squares", n_sq, 1)]
    prior = f"A previous study found that the proportion is about ${pst:g}$. " if use_prior else "There is no prior information about the proportion, so the researcher uses the value that gives the largest sample size. "
    stem = f"A researcher wants to estimate {c['what']} with a margin of error of at most ${me}$ at a ${round(conf * 100)}\\%$ confidence level. {prior}What is the smallest sample size that the researcher needs?"
    return mc("st_n_ci_sample_size", "3.3", "3.E", "Find the smallest sample size that gives a stated margin of error for a proportion",
              ["Choose the value of the proportion that the formula should use: the prior estimate or $0.5$ when there is none", "Solve the margin of error formula for n and round up to the next whole number"],
              key, wr, rng, stem, "the sample size is recomputed from the critical value by bisection and from scipy and rounded up; the three wrong values are the named slips", ["procedure_choice", "calculated_value_decision"], est=105, facts=[f"me={me}", f"conf={conf}", f"p={pst}"],
              sig=(["choice of the proportion in the formula", "margin of error formula"], 1, "light"))


# ======================= 22. 카이제곱 통계량 계산 (3.15 / 3.E, 이원표) =======================
CQ_CTX = [dict(rows=("Group 1", "Group 2"), cols=("Improved", "Did not improve"), rh="Treatment", what="a new therapy"), dict(rows=("Online", "In store"), cols=("Returned", "Kept"), rh="Purchase type", what="the way of purchase")]


def st_n_chisq_stat(rng):
    c = pick(rng, CQ_CTX)
    for _ in forever():
        cells = [[rng.randint(18, 60) for _ in range(2)] for _ in range(2)]
        rt = [sum(r) for r in cells]; ct = [cells[0][j] + cells[1][j] for j in range(2)]; N = sum(rt)
        exp = [[rt[i] * ct[j] / N for j in range(2)] for i in range(2)]
        chi = sum((cells[i][j] - exp[i][j]) ** 2 / exp[i][j] for i in range(2) for j in range(2))
        w1 = sum((cells[i][j] - exp[i][j]) ** 2 for i in range(2) for j in range(2))
        w2 = sum((cells[i][j] - exp[i][j]) ** 2 / cells[i][j] for i in range(2) for j in range(2))
        w3 = math.sqrt(chi)
        if gaps_ok([round(v, 2) for v in (chi, w1, w2, w3)], 0.1) and chi > 1.0 and all(v >= 5 for r in exp for v in r):
            break
    c2, pv, dof, e2 = ss.chi2_contingency(np.array(cells), correction=False); agree(c2, chi, tol=1e-9, name="chi2")
    fm = lambda v: f"${v:.2f}$"
    stim = stat_stim(f"Observed counts for {c['what']}", "two_way", title="Observed counts", rowHeader=c["rh"], rowLabels=list(c["rows"]), colLabels=list(c["cols"]), cells=cells)
    key = (fm(chi), f"The statistic is the sum of $(O - E)^2/E$ over the four cells, using expected counts ${exp[0][0]:.2f}$, ${exp[0][1]:.2f}$, ${exp[1][0]:.2f}$ and ${exp[1][1]:.2f}$, which gives ${chi:.2f}$.", round(chi, 2))
    wr = [(fm(w1), "Adds the squared differences without dividing each by its expected count.", "no_division_by_expected", round(w1, 2), 1), (fm(w2), "Divides each squared difference by the observed count instead of the expected count.", "divides_by_observed", round(w2, 2), 2), (fm(w3), "Takes the square root of the chi-square statistic, which is not the statistic that is compared with the chi-square distribution.", "square_root_taken", round(w3, 2), 2)]
    ex_txt = f"${exp[0][0]:.2f}$, ${exp[0][1]:.2f}$, ${exp[1][0]:.2f}$ and ${exp[1][1]:.2f}$"
    stem = f"The table shown gives the observed counts for a chi-square test of independence in a random sample. When the null hypothesis is true, the expected counts in the cells, in the order of the table (row by row), are {ex_txt}. What is the value of the chi-square statistic? (Round to two decimal places.)"
    return mc("st_n_chisq_stat", "3.15", "3.E", "Compute the chi-square statistic from observed and expected counts",
              ["Find the squared difference between each observed and expected count", "Divide each by its expected count and add the four results"],
              key, wr, rng, stem, "the statistic is recomputed with scipy's chi-square contingency routine without continuity correction", ["procedure_choice", "calculated_value_decision", "representation_reading"], stim, est=105, facts=[f"cells={cells}"])


# ======================= 23. 두 비율 차의 신뢰구간 계산 (3.10 / 3.E) =======================
TP_CTX = [dict(a="a morning class", b="an evening class", what="students who passed", unit="students"), dict(a="the first design", b="the second design", what="visitors who made a purchase", unit="visitors"), dict(a="the east region", b="the west region", what="households that recycle", unit="households")]


def st_n_two_prop_ci(rng):
    c = pick(rng, TP_CTX)
    for _ in forever():
        n1 = rng.choice([100, 120, 150, 200]); n2 = rng.choice([110, 140, 180, 220]); x1 = rng.randint(int(.45 * n1), int(.7 * n1)); x2 = rng.randint(int(.3 * n2), int(.55 * n2))
        p1, p2 = x1 / n1, x2 / n2; d = p1 - p2; z = zstar(0.95)
        se = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2); pp = (x1 + x2) / (n1 + n2); se_pool = math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2))
        z90 = zstar(0.90)
        cands = {"key": (d - z * se, d + z * se), "pool": (d - z * se_pool, d + z * se_pool), "z90": (d - z90 * se, d + z90 * se), "sum": (p1 + p2 - z * se, p1 + p2 + z * se)}
        if min(p1, 1 - p1) * n1 >= 10 and min(p2, 1 - p2) * n2 >= 10 and gaps_ok([cands[k][0] for k in cands], 0.006) and gaps_ok([cands[k][1] for k in cands], 0.006) and d > 0.05:
            break
    fm = lambda t: f"$({t[0]:.3f},\\ {t[1]:.3f})$"
    key = (fm(cands["key"]), f"The interval is $(\\hat p_1 - \\hat p_2) \\pm z^*\\sqrt{{\\hat p_1(1-\\hat p_1)/n_1 + \\hat p_2(1-\\hat p_2)/n_2}}$ with $\\hat p_1 - \\hat p_2 = {d:.3f}$, which gives {fm(cands['key'])}.", round(cands["key"][0], 3))
    wr = [(fm(cands["pool"]), "Uses the pooled proportion in the standard error, which is for a test of equal proportions; an interval uses the two separate sample proportions.", "pooled_in_interval", round(cands["pool"][0], 3), 2), (fm(cands["z90"]), "Uses the critical value for $90\\%$ confidence, about $1.645$, instead of about $1.960$.", "wrong_confidence_z", round(cands["z90"][0], 3), 1),
          (fm(cands["sum"]), "Centers the interval at the sum of the sample proportions instead of at their difference.", "sum_not_difference", round(cands["sum"][0], 3), 1)]
    stem = f"Independent random samples of ${n1}$ {c['unit']} from {c['a']} and ${n2}$ {c['unit']} from {c['b']} have ${x1}$ and ${x2}$ {c['what']}, respectively. Assume that the conditions for inference are met. Which of the following is a $95\\%$ confidence interval for the difference between the two population proportions, first minus second? (Round the endpoints to three decimal places.)"
    return mc("st_n_two_prop_ci", "3.10", "3.E", "Construct a confidence interval for the difference of two population proportions",
              ["Find the difference of the sample proportions as the center", "Use the unpooled standard error and the critical value for the stated confidence level"],
              key, wr, rng, stem, "the interval is recomputed with a critical value from bisection and compared with scipy's inverse normal function and with the unpooled standard error", ["procedure_choice", "calculated_value_decision"], est=115, facts=[f"x1={x1}", f"x2={x2}"],
              sig=(["difference of two proportions", "standard error without pooling"], 1, "light"))


# ======================= 24. 구간으로 '과반' 주장 정당화 (3.4 / 4.G) =======================
CT_CTX = [dict(sc="A random sample of ${n}$ voters is used to find a $95\\%$ confidence interval for the proportion of all voters who support a proposal.", who="voters", claim="a majority of all voters support the proposal", thr=0.5), dict(sc="A random sample of ${n}$ customers is used to find a $95\\%$ confidence interval for the proportion of all customers who prefer the new recipe.", who="customers", claim="more than $40\\%$ of all customers prefer the new recipe", thr=0.4)]


def st_n_ci_claim_threshold(rng):
    c = pick(rng, CT_CTX)
    thr = c["thr"]
    for _ in forever():
        n = rng.choice([200, 300, 400, 500]); mode = pick(rng, ["above", "straddle"])
        ph = round(thr + (rng.uniform(0.07, 0.11) if mode == "above" else rng.uniform(0.0, 0.025)), 2); se = math.sqrt(ph * (1 - ph) / n); lo, hi = ph - 1.96 * se, ph + 1.96 * se
        if (mode == "above" and lo > thr + 0.005) or (mode == "straddle" and lo < thr - 0.005 and hi > thr + 0.005):
            break
    conv = lo > thr
    I = f"$({lo:.3f},\\ {hi:.3f})$"
    key = ((f"Yes, because every value in the interval {I} is greater than ${thr:g}$, so there is convincing evidence for the claim.") if conv else
           (f"No, because the interval {I} includes values on both sides of ${thr:g}$, so there is not convincing evidence for the claim."), "A claim that the proportion is greater than a value is supported when the whole interval lies above that value; an interval that includes the value leaves it plausible.")
    wr = [((f"No, because the sample proportion ${ph:g}$ is greater than ${thr:g}$ but the interval {I} is too wide to support any claim.") if conv else (f"Yes, because the sample proportion ${ph:g}$ is greater than ${thr:g}$, so the claim that {c['claim']} is justified."), "Judges the claim from the sample proportion alone; the interval shows how far the population proportion can be from the sample proportion.", "sample_proportion_only", None, 1),
          ((f"No, because a confidence interval can never provide evidence for a claim about a proportion.") if conv else (f"Yes, because most of the values in the interval {I} are greater than ${thr:g}$."), "The claim is justified only if all of the plausible values satisfy it; having most of the values above the threshold is not enough." if not conv else "A confidence interval is used to judge whether a value is plausible, so it can provide evidence for a claim.", "interval_cannot_support" if conv else "most_values_above", None, 2),
          ((f"No, because there is a $95\\%$ chance that the sample proportion is above ${thr:g}$ only.") if conv else (f"Yes, because the margin of error is less than ${thr:g}$."), "Misreads the confidence level or the margin of error; the claim is judged by comparing the interval with the threshold." , "confidence_level_misread" if conv else "margin_vs_threshold", None, 2)]
    stem = f"{c['sc'].replace('${n}$', f'${n}$')} The sample proportion is ${ph:g}$, and the conditions for inference are met. The interval is {I}. Does the interval provide convincing evidence for the claim that {c['claim']}?"
    return mc("st_n_ci_claim_threshold", "3.4", "4.G", "Justify a one-sided claim about a proportion from a confidence interval",
              ["Compare the whole interval with the threshold in the claim", "State whether the claim is justified: only when every value in the interval satisfies it"],
              key, wr, rng, stem, "the interval is recomputed from the sample proportion and the sample size and the cases keep the threshold at least 0.005 outside or inside the interval", ["claim_justification", "interpretation"], est=100, facts=[f"mode={mode}", f"n={n}"])


# ======================= 25. 두 비율 차 구간의 해석 (3.10 / 4.F) =======================
DI_CTX = [dict(a="students who use the tutoring center", b="students who do not use the tutoring center", what="passed the course", pop="students at a college"), dict(a="patients who received the new treatment", b="patients who received the standard treatment", what="recovered within a week", pop="patients with the condition"),
          dict(a="customers who received a coupon", b="customers who did not receive a coupon", what="made a purchase", pop="customers of the store")]


def st_n_diff_ci_interpret(rng):
    c = pick(rng, DI_CTX)
    for _ in forever():
        lo = round(rng.uniform(0.04, 0.12), 2); hi = round(lo + rng.uniform(0.08, 0.14), 2)
        if hi < 0.3:
            break
    lp, hp = round(lo * 100), round(hi * 100)
    key = (f"We are $95\\%$ confident that the proportion of {c['pop']} in the first group who {c['what']} is between ${lp}$ and ${hp}$ percentage points higher than the proportion in the second group.", "The interval estimates the difference between the two population proportions, and the whole interval is positive, so the first proportion is estimated to be higher.")
    wr = [(f"We are $95\\%$ confident that between ${lp}\\%$ and ${hp}\\%$ of all {c['pop']} {c['what']}.", "Interprets the interval as a range for a single proportion, but the interval is for the difference between two proportions.", "single_proportion", None, 1),
          (f"There is a $95\\%$ probability that the difference in the sample proportions is between ${lp}$ and ${hp}$ percentage points.", "The difference in the sample proportions is known from the samples; the interval is about the difference in the population proportions.", "about_samples", None, 2),
          (f"We are $95\\%$ confident that the proportion in the second group who {c['what']} is between ${lp}$ and ${hp}$ percentage points higher than the proportion in the first group.", "Reverses the direction of the difference: a positive interval for first minus second means that the first proportion is higher.", "direction_reversed", None, 1)]
    stem = f"Independent random samples of {c['a']} and {c['b']} were used to construct a $95\\%$ confidence interval for $p_1 - p_2$, where $p_1$ and $p_2$ are the population proportions that {c['what']}. The interval is $({lo:.2f},\\ {hi:.2f})$, and the conditions for inference are met. Which of the following is the correct interpretation of the interval?"
    return mc("st_n_diff_ci_interpret", "3.10", "4.F", "Interpret a confidence interval for the difference of two proportions with its direction",
              ["Identify what the interval estimates: the difference of the two population proportions, first minus second", "Choose the sentence that gives the direction of the difference and the confidence in the method, and reject statements about one proportion or about the sample"],
              key, wr, rng, stem, "each option differs from the key by one named defect: a single proportion, a statement about the samples, or a reversed direction", ["interpretation", "claim_justification"], est=100, facts=[f"lo={lo}", f"hi={hi}"])


# ======================= 26. 표본평균의 분포가 정규에 가까운 상황 (4.1 / 2.D) =======================
CL_CTX = [dict(w="times that customers spend in a store", u="minutes"), dict(w="amounts of rainfall on rainy days", u="millimeters"), dict(w="salaries at a large company", u="thousand dollars")]
CL_BAD = [("a sample of ${n}$ from a population that is strongly skewed to the right", "small", "The sample is small and the population is strongly skewed, so the Central Limit Theorem does not make the sampling distribution approximately normal."),
          ("a sample of ${n}$ from a population that has two separate peaks and is not close to normal", "small", "The sample is small and the population is far from normal, so the sampling distribution of the sample mean is not approximately normal."),
          ("a sample of ${n}$ from a population that has a few very large outliers", "small", "The sample is small and the outliers pull the sample mean, so the sampling distribution is not approximately normal.")]


def st_n_clt_conditions_choice(rng):
    c = pick(rng, CL_CTX)
    big = pick(rng, [40, 50, 60]); small = pick(rng, [8, 10, 12])
    mode = pick(rng, ["large_skewed", "small_normal"])
    if mode == "large_skewed":
        key = (f"A random sample of ${big}$ from a population of {c['w']} that is strongly skewed to the right.", f"The sample size of ${big}$ is large, so the Central Limit Theorem makes the sampling distribution of the sample mean approximately normal even though the population is skewed.")
        wr = [(f"A random sample of ${small}$ from a population of {c['w']} that is strongly skewed to the right.", CL_BAD[0][2], "small_skewed", None, 1), (f"A random sample of ${small}$ from a population of {c['w']} with two separate peaks.", CL_BAD[1][2], "small_bimodal", None, 1), (f"A random sample of ${small}$ from a population of {c['w']} that includes a few very large outliers.", CL_BAD[2][2], "small_outliers", None, 2)]
    else:
        key = (f"A random sample of ${small}$ from a population of {c['w']} that is approximately normal.", f"When the population is approximately normal, the sampling distribution of the sample mean is approximately normal for any sample size, including ${small}$.")
        wr = [(f"A random sample of ${small}$ from a population of {c['w']} that is strongly skewed to the right.", CL_BAD[0][2], "small_skewed", None, 1), (f"A random sample of ${small}$ from a population of {c['w']} with two separate peaks.", CL_BAD[1][2], "small_bimodal", None, 1), (f"A random sample of ${small}$ from a population of {c['w']} that includes a few very large outliers.", CL_BAD[2][2], "small_outliers", None, 2)]
    stem = f"Which of the following describes a situation in which the sampling distribution of the sample mean can be considered approximately normal?"
    return mc("st_n_clt_conditions_choice", "4.1", "2.D", "Decide when the sampling distribution of the sample mean is approximately normal",
              ["Check the sample size and the shape of the population in each description", "Keep the description that has a large sample or a normal population and reject small samples from skewed, bimodal or outlier-prone populations"],
              key, wr, rng, stem, "each family lists exactly one description that satisfies the sample size or normal population requirement and three small samples from non-normal populations", ["condition_check", "claim_justification"], est=80, facts=[f"mode={mode}"])


# ======================= 27. 두 평균 차 검정의 가설 (4.9 / 2.E) =======================
HM_CTX = [dict(a="students who use flash cards", b="students who use highlighting", what="score on a vocabulary test", mu1="the mean score of all students who use flash cards", mu2="the mean score of all students who use highlighting", d="higher"),
          dict(a="drivers of the new car model", b="drivers of the old car model", what="fuel use per 100 kilometers", mu1="the mean fuel use of all drivers of the new model", mu2="the mean fuel use of all drivers of the old model", d="lower"),
          dict(a="workers on the new schedule", b="workers on the old schedule", what="number of tasks completed per day", mu1="the mean number of tasks completed per day by all workers on the new schedule", mu2="the mean number of tasks completed per day by all workers on the old schedule", d="higher")]


def st_n_hyp_two_means(rng):
    c = pick(rng, HM_CTX)
    two = pick(rng, [True, False])
    d = c["d"]
    sym = ">" if d == "higher" else "<"; opp = "<" if d == "higher" else ">"
    if two:
        key = ("$H_0: \\mu_1 = \\mu_2$ and $H_a: \\mu_1 \\neq \\mu_2$", "The researcher wants to know only whether the two population means differ, so the alternative hypothesis is two-sided and the null hypothesis states that the means are equal.")
        wr = [(f"$H_0: \\mu_1 = \\mu_2$ and $H_a: \\mu_1 {sym} \\mu_2$", "Uses a one-sided alternative although the researcher did not name a direction.", "one_sided_without_reason", None, 1), (f"$H_0: \\bar{{x}}_1 = \\bar{{x}}_2$ and $H_a: \\bar{{x}}_1 \\neq \\bar{{x}}_2$", "States the hypotheses with sample means; hypotheses are about the population means.", "statistics_in_hypotheses", None, 2), ("$H_0: \\mu_1 \\neq \\mu_2$ and $H_a: \\mu_1 = \\mu_2$", "Puts the equality in the alternative hypothesis; the null hypothesis is the statement of no difference.", "equality_in_alternative", None, 1)]
        goal = f"wants to know whether the mean {c['what']} is different for {c['a']} and for {c['b']}"
    else:
        key = (f"$H_0: \\mu_1 = \\mu_2$ and $H_a: \\mu_1 {sym} \\mu_2$", f"The researcher suspects that the mean for the first group is {d}, so the alternative hypothesis is one-sided in that direction and the null hypothesis states that the means are equal.")
        wr = [(f"$H_0: \\mu_1 = \\mu_2$ and $H_a: \\mu_1 {opp} \\mu_2$", "The alternative hypothesis points in the direction opposite to the researcher's suspicion.", "direction_reversed", None, 1), ("$H_0: \\mu_1 = \\mu_2$ and $H_a: \\mu_1 \\neq \\mu_2$", "Uses a two-sided alternative although the researcher suspects a difference in one specific direction.", "two_sided_for_directional", None, 1),
              (f"$H_0: \\bar{{x}}_1 = \\bar{{x}}_2$ and $H_a: \\bar{{x}}_1 {sym} \\bar{{x}}_2$", "States the hypotheses with sample means; hypotheses are about the population means.", "statistics_in_hypotheses", None, 2)]
        goal = f"suspects that the mean {c['what']} is {d} for {c['a']} than for {c['b']}"
    stem = f"A researcher takes independent random samples of {c['a']} and of {c['b']} and measures the {c['what']} of each. Let $\\mu_1$ and $\\mu_2$ be the population means for the first and second group. The researcher {goal}. Which of the following gives the appropriate hypotheses for a test of significance?"
    return mc("st_n_hyp_two_means", "4.9", "2.E", "State the hypotheses for a test about the difference of two independent population means",
              ["Define the parameters as population means and write the null hypothesis as no difference", "Decide from the researcher's wording whether the alternative is two-sided or one-sided and in which direction"],
              key, wr, rng, stem, "each option differs from the key by one named defect: the direction, a two-sided versus one-sided alternative, or statistics used in the hypotheses", ["procedure_choice", "claim_justification"], est=85, facts=[f"two={two}"])


# ======================= 28. t 와 z 중 알맞은 임계값 (4.2 / 2.C) =======================
TZ_CTX = [dict(w="the time that a sample of mail carriers need to finish a route", u="minutes"), dict(w="the weight of a random sample of eggs", u="grams"), dict(w="the battery life of a random sample of tablets", u="hours")]


def st_n_t_vs_z(rng):
    c = pick(rng, TZ_CTX)
    n = pick(rng, [12, 15, 18, 22]); df = n - 1
    key = (f"Use a $t$ critical value with ${df}$ degrees of freedom, because the population standard deviation is unknown and is estimated by the sample standard deviation.", "When the population standard deviation is unknown, the standardized sample mean follows a t distribution with n - 1 degrees of freedom.")
    wr = [(f"Use a $z$ critical value from the standard normal distribution, because the sample is random.", "Random selection does not make the standardized sample mean normal; with an estimated standard deviation the t distribution is used.", "z_for_random_sample", None, 1),
          (f"Use a $t$ critical value with ${n}$ degrees of freedom, because the population standard deviation is unknown.", f"Uses the sample size as the degrees of freedom; the degrees of freedom for a one-sample t procedure are ${df}$, one less than the sample size.", "df_equals_n", None, 2),
          (f"Use a $t$ critical value with ${df}$ degrees of freedom, because the population is not normal.", "The t distribution is used because the standard deviation is estimated; non-normality is a separate concern that is judged from the sample size and graphs.", "wrong_reason_for_t", None, 2)]
    stem = f"A researcher plans to construct a $95\\%$ confidence interval for a population mean using a random sample of ${n}$ measurements of {c['w']}. The population standard deviation is unknown and the sample data show no strong skewness or outliers. Which of the following is the appropriate critical value, with the correct reason?"
    return mc("st_n_t_vs_z", "4.2", "2.C", "Choose the t critical value and its degrees of freedom for a mean with unknown population standard deviation",
              ["Notice that the population standard deviation is unknown and replaced by the sample standard deviation", "Choose the t distribution with the sample size minus one degrees of freedom and give the matching reason"],
              key, wr, rng, stem, "each option differs from the key by one named defect: using z, using n as the degrees of freedom, or a wrong reason for using t", ["procedure_choice", "claim_justification"], est=85, facts=[f"n={n}"])


# ======================= 29. 구간의 끝점에서 평균과 오차한계 (4.2 / 3.B) =======================
EC_CTX = [dict(w="the mean time, in minutes, that nurses spend on paperwork", u="minutes"), dict(w="the mean length, in centimeters, of leaves on a tree species", u="centimeters"), dict(w="the mean daily sales, in dollars, of a food truck", u="dollars")]


def st_n_ci_endpoints_stats(rng):
    c = pick(rng, EC_CTX)
    for _ in forever():
        n = pick(rng, [16, 20, 25]); xb = rng.randint(40, 90) + rng.choice([0, 0.5]); me = rng.choice([2.5, 3.0, 3.5, 4.0, 4.5])
        a, b = xb - me, xb + me
        vals = [(xb, me), (xb, b - a), (me, xb), (a, me)]
        if gaps_ok([xb, b - a, me, a], 0.4):
            break
    fm = lambda m_, e_: f"sample mean ${m_:g}$, margin of error ${e_:g}$"
    key = (fm(xb, me), f"The sample mean is the midpoint $({a:g} + {b:g})/2 = {xb:g}$ and the margin of error is half the width, $({b:g} - {a:g})/2 = {me:g}$.")
    wr = [(fm(xb, b - a), "Reports the full width of the interval as the margin of error; the margin of error is half of the width.", "width_not_half", None, 2), (fm(me, xb), "Swaps the two values: the midpoint is the sample mean and half of the width is the margin of error.", "values_swapped", None, 1), (fm(a, me), "Takes the lower endpoint as the sample mean, but the sample mean is the midpoint of the interval.", "endpoint_as_mean", None, 1)]
    stem = f"A $95\\%$ confidence interval for {c['w']} is $({a:g},\\ {b:g})$ from a random sample of ${n}$ measurements. Which of the following gives the sample mean and the margin of error?"
    return mc("st_n_ci_endpoints_stats", "4.2", "3.B", "Recover the sample mean and the margin of error from the endpoints of a confidence interval",
              ["Recognize that the sample mean is the midpoint of the interval", "Recognize that the margin of error is half of the width of the interval"],
              key, wr, rng, stem, "the midpoint and half-width are recomputed from the two endpoints and the three wrong pairs are the named slips", ["procedure_choice", "calculated_value_decision", "interpretation"], est=80, facts=[f"xb={xb}", f"me={me}"])


# ======================= 30. t 표에서 임계값을 찾아 오차한계 (4.2 / 3.E, 표) =======================
MT_CTX = [dict(w="the time, in seconds, that a random sample of visitors spend on a web page", u="seconds", mean=(60, 95), sd=(14, 24)), dict(w="the weight, in grams, of a random sample of packages of nuts", u="grams", mean=(250, 290), sd=(8, 16)), dict(w="the length, in minutes, of a random sample of phone calls", u="minutes", mean=(8, 14), sd=(2.5, 5))]


def st_n_me_t_table(rng):
    c = pick(rng, MT_CTX)
    for _ in forever():
        n = pick(rng, [12, 16, 21, 26]); df = n - 1; s = rng.randint(int(c["sd"][0]), int(c["sd"][1]))
        t = tstar(0.95, df); tw = tstar(0.95, n); z = zstar(0.95)
        me = t * s / math.sqrt(n); me_w = tw * s / math.sqrt(n); me_z = z * s / math.sqrt(n); me_no = s / math.sqrt(n)
        vals = [round(me, 2), round(me_w, 2), round(me_z, 2), round(me_no, 2)]
        if gaps_ok(vals, 0.06) and len({round(t, 3), round(tw, 3)}) == 2:
            break
    rows = [[str(d_), f"{tstar(0.95, d_):.3f}"] for d_ in sorted({df - 1, df, df + 1, n + 1})]
    stim = stat_stim("Critical values of the t distribution for 95% confidence", "table", title="t critical values for 95 percent confidence", columns=["Degrees of freedom", "t* for 95% confidence"], rows=rows)
    fm = lambda v: f"${v:.2f}$ {c['u']}"
    key = (fm(me), f"With ${n}$ measurements the degrees of freedom are ${df}$, so $t^* \\approx {t:.3f}$ and the margin of error is ${t:.3f}({s}/\\sqrt{{{n}}}) \\approx {me:.2f}$.", round(me, 2))
    wr = [(fm(me_w), f"Reads the critical value from the row for ${n}$ degrees of freedom; the degrees of freedom are one less than the sample size.", "df_equals_n", round(me_w, 2), 2), (fm(me_z), "Uses the normal critical value $1.960$ instead of the $t$ critical value for the degrees of freedom.", "z_instead_of_t", round(me_z, 2), 1), (fm(me_no), "Leaves out the critical value, giving only the standard error of the sample mean.", "standard_error_only", round(me_no, 2), 1)]
    stem = f"A random sample of ${n}$ measurements of {c['w']} has a standard deviation of ${s}$ {c['u']}. The table shown gives $t$ critical values for $95\\%$ confidence. What is the margin of error of a $95\\%$ confidence interval for the population mean? (Round to two decimal places.)"
    return mc("st_n_me_t_table", "4.2", "3.E", "Look up the t critical value with the correct degrees of freedom and compute the margin of error",
              ["Find the degrees of freedom as the sample size minus one and read the critical value in that row of the table", "Multiply the critical value by the standard error s over the square root of n"],
              key, wr, rng, stem, "the critical values in the table are recomputed by numerical integration of the t density and the margin of error is recomputed from the value in the correct row", ["procedure_choice", "calculated_value_decision", "representation_reading"], stim, est=110, facts=[f"n={n}", f"s={s}"],
              sig=(["degrees of freedom", "margin of error for a mean", "reading a critical value table"], 2, "light"))


# ======================= 31. 두 평균 차 구간으로 주장 판단 (4.8 / 4.G) =======================
DM_CTX = [dict(a="the new fertilizer", b="the standard fertilizer", what="yield, in kilograms per plot", u="kilograms", claim="the mean yield with the new fertilizer is greater than with the standard fertilizer"), dict(a="the new route", b="the old route", what="commute time, in minutes", u="minutes", claim="the mean commute time on the new route is shorter than on the old route"),
          dict(a="students who take the review class", b="students who do not take the review class", what="exam score, in points", u="points", claim="the mean exam score is greater for students who take the review class")]


def st_n_diff_means_claim(rng):
    c = pick(rng, DM_CTX)
    shorter = "shorter" in c["claim"]
    mode = pick(rng, ["all_good", "contains_zero"])
    mag = rng.choice([1.2, 1.8, 2.4, 3.1])
    if mode == "all_good":
        lo, hi = (round(mag, 1), round(mag + rng.choice([2.1, 2.8, 3.5]), 1)) if not shorter else (round(-mag - rng.choice([2.1, 2.8, 3.5]), 1), round(-mag, 1))
    else:
        lo, hi = round(-rng.choice([0.8, 1.2, 1.6]), 1), round(rng.choice([2.5, 3.2, 3.8]), 1)
        if shorter:
            lo, hi = -hi, -lo
    conv = (lo > 0 or hi < 0) and ((lo > 0) != shorter)
    I = f"$({lo:g},\\ {hi:g})$"
    sign_txt = "positive" if lo > 0 else "negative"
    key = ((f"Yes, because the interval {I} contains only {sign_txt} values, so $0$ is not plausible and the claim is supported.") if conv else
           (f"No, because the interval {I} contains $0$, so there is not convincing evidence of a difference."), "A difference of $0$ is a plausible value when the interval includes it, and it is not plausible when the whole interval lies on one side of $0$." )
    wr = [((f"No, because the interval {I} contains values that are not equal to $0$, so it cannot show a difference.") if conv else (f"Yes, because the interval {I} shows that the means are different by about ${abs((lo + hi) / 2):g}$ {c['u']}."), "Judges the claim from the center of the interval; the claim depends on whether the interval includes $0$." if not conv else "Whether the interval includes $0$ is what matters, and here it does not include $0$.", "center_only" if not conv else "misreads_zero", None, 1),
          ((f"No, because the samples are independent, and a confidence interval can only be used with matched pairs.") if conv else (f"Yes, because the sample means must differ, since the interval is not exactly $0$."), "Intervals for the difference of two means are used with independent samples, and they do not need matched pairs." if conv else "The sample means almost always differ; the interval shows whether $0$ is a plausible value for the population difference.", "wrong_design_reason" if conv else "sample_means_differ", None, 2),
          ((f"Yes, because the interval {I} does not contain the sample mean of either group.") if conv else (f"No, because the interval {I} is not centered at $0$."), "The interval for the difference is compared with $0$, not with the sample means of the groups." if conv else "An interval is not required to be centered at $0$; what matters is whether $0$ is inside it.", "compares_with_means" if conv else "centered_at_zero", None, 2)]
    stem = f"Independent random samples were used to construct a $95\\%$ confidence interval for $\\mu_1 - \\mu_2$, the difference in population means of {c['what']} for {c['a']} (group 1) and {c['b']} (group 2). The interval is {I}, and the conditions for inference are met. Is there convincing evidence that {c['claim']}?"
    return mc("st_n_diff_means_claim", "4.8", "4.G", "Judge a claim about a difference of means by whether zero is inside the interval",
              ["Check whether zero lies inside the confidence interval for the difference", "State the conclusion and the direction of the claim, rejecting judgments based on the center of the interval or on the sample means"],
              key, wr, rng, stem, "the sign pattern of the interval endpoints decides whether zero is inside and whether the direction of the claim is supported", ["claim_justification", "interpretation"], est=100, facts=[f"mode={mode}", f"lo={lo}", f"hi={hi}"])


# ======================= 32. 표본 선택·처리 배정에 따른 결론의 범위 (4.10 / 4.D) =======================
SC_CTX = [dict(trt="a new tutoring program", resp="mean test scores", pop="students at a school", unit="students"), dict(trt="a new warm-up routine", resp="mean sprint times", pop="athletes in a league", unit="athletes"), dict(trt="a new watering method", resp="mean growth", pop="tomato plants on a farm", unit="plants")]


def st_n_scope_of_inference(rng):
    c = pick(rng, SC_CTX)
    assign = pick(rng, [True, False]); select = pick(rng, [True, False])
    A = f"The {c['unit']} were assigned at random to the two groups" if assign else f"Each of the {c['unit']} chose which of the two groups to join"
    S = f"the {c['unit']} were randomly selected from all of the {c['pop']}" if select else f"the {c['unit']} were volunteers"
    texts = {(True, True): "The difference can be attributed to the treatment, and the conclusion can be generalized to all of the " + c["pop"] + ".", (True, False): "The difference can be attributed to the treatment, but the conclusion cannot be generalized to all of the " + c["pop"] + ".",
             (False, True): "The conclusion can be generalized to all of the " + c["pop"] + ", but the difference cannot be attributed to the treatment.", (False, False): "The difference can be neither attributed to the treatment nor generalized to all of the " + c["pop"] + "."}
    key = (texts[(assign, select)], "Random assignment is what allows a cause-and-effect conclusion, and random selection from a population is what allows generalizing to that population.")
    others = [k for k in texts if k != (assign, select)]
    whys = {(True, True): "Random assignment and random selection both hold in the study, so both conclusions are justified.", (True, False): "Random assignment supports a cause-and-effect conclusion, but volunteers do not allow generalizing to the whole population.", (False, True): "Random selection supports generalizing, but without random assignment the groups can differ in other ways.", (False, False): "Neither feature is present, so neither conclusion is justified."}
    def why(k):
        parts_ = []
        if k[0] != assign:
            parts_.append("random assignment " + ("was used here, so a cause-and-effect conclusion is supported" if assign else "was not used here, so a cause-and-effect conclusion is not supported"))
        if k[1] != select:
            parts_.append("the individuals " + ("were randomly selected here, so generalizing is supported" if select else "were volunteers here, so generalizing is not supported"))
        return "Does not match the design of this study: " + " and ".join(parts_) + "."
    wr = [(texts[k], why(k), f"scope_{int(k[0])}{int(k[1])}", None, 1 + i % 2) for i, k in enumerate(others)]
    stem = f"In a study of {c['trt']}, a two-sample $t$ test of the difference in {c['resp']} gives a very small P-value. {A}, and {S}. Which of the following conclusions is justified by the design of the study?"
    return mc("st_n_scope_of_inference", "4.10", "4.D", "Decide from the design which conclusions a significant result supports",
              ["Check whether the treatments were assigned at random and whether the individuals were randomly selected", "Match the design to the one conclusion that is supported: cause and effect needs random assignment and generalizing needs random selection"],
              key, wr, rng, stem, "the four options are the four combinations of random assignment and random selection, so exactly one matches the stated design", ["claim_justification", "interpretation"], est=90, facts=[f"assign={assign}", f"select={select}"])


# ======================= 33. 표준편차 하나 위에서의 예측 (5.3 / 3.B) =======================
PO_CTX = [dict(x="the number of hours of practice per week", y="the score on a skills test", xm=(5, 9), xs=(1.5, 2.5), ym=(60, 80), ys=(8, 12), yu="points"), dict(x="the age of a tree in years", y="the diameter of its trunk in centimeters", xm=(15, 30), xs=(4, 8), ym=(30, 50), ys=(6, 12), yu="centimeters"),
          dict(x="the number of ads per week", y="the weekly sales in hundreds of dollars", xm=(10, 20), xs=(3, 5), ym=(50, 80), ys=(8, 14), yu="hundreds of dollars")]


def st_n_pred_one_sd(rng):
    c = pick(rng, PO_CTX)
    for _ in forever():
        xm = rng.randint(*c["xm"]); xs = rng.choice([1.5, 2.0, 2.5, 4.0, 5.0]); ym = rng.randint(*c["ym"]); ys = rng.choice([8.0, 10.0, 12.0, 14.0]); r = rng.choice([0.5, 0.6, 0.7, 0.8, 0.9])
        key_v = ym + r * ys; w1 = ym + ys; w2 = ym + r * r * ys; w3 = ym + ys / r if r > 0 else ym
        if gaps_ok([key_v, w1, w2, w3], 0.6):
            break
    # 독립 경로: 합성 자료에 최소제곱 직선을 맞춘 뒤 x̄ + s_x 에서 예측
    gen = np.random.default_rng(11); zx = gen.normal(0, 1, 500); zx = (zx - zx.mean()) / zx.std(); w = gen.normal(0, 1, 500); w = w - (w * zx).mean() * zx; w = (w - w.mean()) / w.std(); zy = r * zx + math.sqrt(1 - r * r) * w
    xx = xm + xs * zx; yy = ym + ys * zy; cf = np.polyfit(xx, yy, 1); agree(cf[0] * (xm + xs) + cf[1], key_v, tol=1e-6, name="pred")
    fm = lambda v: f"${v:.1f}$ {c['yu']}"
    key = (fm(key_v), f"The line passes through $(\\bar x, \\bar y)$ and each standard deviation of $x$ above the mean adds $r$ standard deviations of $y$: ${ym} + {r}({ys:g}) = {key_v:.1f}$.", round(key_v, 1))
    wr = [(fm(w1), "Adds one full standard deviation of $y$, which would be right only if the correlation were $1$.", "r_equals_one", round(w1, 1), 1), (fm(w2), "Multiplies by $r^2$ instead of $r$, which uses the proportion of variation explained instead of the correlation.", "r_squared_used", round(w2, 1), 2), (fm(w3), "Divides by $r$ instead of multiplying, which moves the prediction farther from the mean for a weaker correlation.", "divides_by_r", round(w3, 1), 2)]
    stem = f"For a random sample, the least-squares regression line predicts {c['y']} from {c['x']}. The summary statistics are $\\bar x = {xm}$, $s_x = {xs:g}$, $\\bar y = {ym}$, $s_y = {ys:g}$ and $r = {r}$. What is the predicted value of $y$ when $x$ is one standard deviation above its mean, that is, when $x = {xm + xs:g}$? (Round to one decimal place.)"
    return mc("st_n_pred_one_sd", "5.3", "3.B", "Predict the response one standard deviation above the mean of x using the correlation",
              ["Recall that the line passes through the point of the two means", "Use the fact that one standard deviation of x above the mean predicts r standard deviations of y above the mean of y"],
              key, wr, rng, stem, "the prediction is recomputed by fitting a least-squares line to synthetic data with exactly the stated means, standard deviations and correlation", ["procedure_choice", "calculated_value_decision", "interpretation"], est=100, facts=[f"r={r}", f"xs={xs}", f"ys={ys}"],
              sig=(["line through the point of means", "slope from correlation and standard deviations"], 1, "light"))


# ======================= 34. 외삽 진술 (5.3 / 4.D) =======================
EX_CTX = [dict(x="the age of a child, in months", y="the child's height, in centimeters", lo=12, hi=36, a=72.0, b=0.45, xn=96, yn="height"), dict(x="the number of years of experience", y="the hourly wage, in dollars", lo=1, hi=15, a=14.0, b=0.9, xn=40, yn="wage"), dict(x="the temperature, in degrees Celsius", y="the number of cups of hot chocolate sold", lo=0, hi=15, a=95.0, b=-4.0, xn=30, yn="number of cups")]


def st_n_extrapolation(rng):
    c = pick(rng, EX_CTX)
    a = round(c["a"] + rng.uniform(-1, 1), 1); b = round(c["b"] * rng.uniform(0.9, 1.1), 2); r = rng.choice([0.88, 0.91, 0.94, 0.96])
    xn = c["xn"] + rng.choice([-4, 0, 4]); v = a + b * xn
    sg = "+" if b >= 0 else "-"
    key = (f"The prediction of ${v:.1f}$ is an extrapolation, because ${xn}$ is outside the range of the data, so the linear pattern may not continue and the prediction may be unreliable.", "Predictions for values of the explanatory variable outside the range of the data assume that the linear pattern continues, which the data cannot confirm.")
    wr = [(f"The prediction of ${v:.1f}$ is reliable, because the correlation of ${r}$ is close to $1$.", "A strong correlation within the range of the data does not make predictions outside that range reliable.", "r_makes_reliable", None, 1),
          (f"The prediction of ${v:.1f}$ is reliable, because the line is the least-squares line, which has the smallest sum of squared residuals.", "The least-squares property describes the fit to the observed data, not the behavior of the relationship outside the data.", "least_squares_makes_reliable", None, 1),
          (f"The prediction cannot be made, because a regression line can only be used for the values of $x$ that appear in the data set.", "A prediction can be calculated for any value of $x$; the issue is that it is unreliable outside the range of the data.", "cannot_calculate", None, 2)]
    stem = f"A least-squares regression line for predicting {c['y']} from {c['x']} is $\\hat y = {a:g} {sg} {abs(b):g}x$, based on data for which $x$ ranges from ${c['lo']}$ to ${c['hi']}$, with $r = {r}$. A researcher uses the line to predict {c['yn']} when $x = {xn}$. Which of the following statements about the prediction is correct?"
    return mc("st_n_extrapolation", "5.3", "4.D", "Judge a prediction outside the range of the data",
              ["Compare the value of x with the range of the data", "Conclude that the prediction is an extrapolation and reject reasons based on the correlation or the least-squares property"],
              key, wr, rng, stem, "each context gives the range of the data and a value of x outside it, so the prediction is an extrapolation in every case", ["claim_justification", "interpretation", "condition_check"], est=90, facts=[f"xn={xn}"])


# ======================= 35. 잔차의 의미 (5.4 / 4.D) =======================
RM_CTX = [dict(who="a house", yv="selling price", u="thousand dollars", x="its size"), dict(who="a student", yv="exam score", u="points", x="the hours of study"), dict(who="a car", yv="fuel economy", u="miles per gallon", x="its weight")]


def st_n_residual_meaning(rng):
    c = pick(rng, RM_CTX)
    mag = rng.choice([2.4, 3.6, 4.2, 5.5, 6.8]); sign = pick(rng, [-1, 1])
    res = sign * mag
    below = res < 0
    key = (f"The actual {c['yv']} of {c['who']} was ${mag}$ {c['u']} {'below' if below else 'above'} the {c['yv']} that the line predicts for {c['x']}.", "A residual is the actual value minus the predicted value, so its sign shows whether the actual value is below or above the prediction and its size shows by how much.")
    wr = [(f"The line predicts a {c['yv']} that is ${mag}$ {c['u']} {'below' if below else 'above'} the actual {c['yv']} of {c['who']}.", "Reverses the roles of the actual and the predicted values: a residual is the actual value minus the predicted value.", "roles_reversed", None, 1),
          (f"The line is wrong by ${mag}\\%$ for {c['who']}.", "Treats the residual as a percent error, but a residual is measured in the units of the response variable.", "percent_error", None, 2),
          (f"The slope of the line is ${res:g}$, which is the change in {c['yv']} for each additional unit of {c['x']}.", "Confuses the residual with the slope; the slope describes the change in the predicted value per unit of $x$.", "slope_confusion", None, 1)]
    stem = f"A least-squares regression line is used to predict {c['yv']} from {c['x']}. For {c['who']} in the data set, the residual is ${res:g}$ {c['u']}. Which of the following is the correct interpretation of this residual?"
    return mc("st_n_residual_meaning", "5.4", "4.D", "Interpret a residual in context",
              ["Recall that a residual is the actual value minus the predicted value", "Read the sign and the size of the given residual as the position and distance of the actual value relative to the prediction"],
              key, wr, rng, stem, "each context gives a residual with a sign, and the four sentences differ by the roles of actual and predicted values, a percent reading and a slope reading", ["interpretation", "claim_justification"], est=80, facts=[f"res={res}"])


# ======================= 36. 상관과 인과 (5.2 / 4.B) =======================
CC_CTX = [dict(x="the number of ice cream cones sold per day", y="the number of visitors to a swimming pool per day", r=0.91, third="the outdoor temperature"), dict(x="the number of firefighters sent to a fire", y="the amount of damage that the fire causes", r=0.88, third="the size of the fire"), dict(x="a child's shoe size", y="the child's reading score", r=0.84, third="the child's age")]


def st_n_corr_causation(rng):
    c = pick(rng, CC_CTX)
    r = c["r"]
    key = (f"There is a strong positive linear association between {c['x']} and {c['y']}, but the data do not show that a change in one causes a change in the other.", "A correlation measures the strength of a linear association, and observational data cannot show cause and effect because other variables, such as " + c["third"] + ", may explain the association.")
    wr = [(f"Increasing {c['x']} would cause {c['y']} to increase, because the correlation is close to $1$.", "A high correlation does not show cause and effect; a lurking variable can explain a strong association.", "correlation_as_cause", None, 1),
          (f"About ${round(r * 100)}\\%$ of the variation in {c['y']} is caused by {c['x']}.", "The proportion of variation explained is $r^2$, not $r$, and an explained proportion does not mean that the variation is caused by the explanatory variable.", "r_as_percent_caused", None, 2),
          (f"The association shows that {c['y']} causes {c['x']}, because the correlation is positive.", "A positive correlation gives no direction of cause and effect; neither variable can be said to cause the other from these data alone.", "reverse_causation", None, 1)]
    stem = f"A random sample of observations gives a correlation of $r = {r}$ between {c['x']} and {c['y']}. The data come from an observational study. Which of the following conclusions is justified?"
    return mc("st_n_corr_causation", "5.2", "4.B", "Justify a conclusion about association without claiming cause and effect",
              ["Read the correlation as the strength and direction of a linear association", "Reject conclusions that claim cause and effect or misread the correlation as a percent of variation caused"],
              key, wr, rng, stem, "each context gives a strong correlation from observational data and a plausible lurking variable, so only the association statement is justified", ["claim_justification", "interpretation"], est=80, facts=[f"r={r}"])


STAGE_SINGLES = ["st_n_phat_dist_change", "st_n_method_from_counts", "st_n_diff_parameter", "st_n_alpha_relation", "st_n_ci_sample_size", "st_n_chisq_stat", "st_n_two_prop_ci", "st_n_ci_claim_threshold", "st_n_diff_ci_interpret",
                 "st_n_clt_conditions_choice", "st_n_hyp_two_means", "st_n_t_vs_z", "st_n_ci_endpoints_stats", "st_n_me_t_table", "st_n_diff_means_claim", "st_n_scope_of_inference",
                 "st_n_pred_one_sd", "st_n_extrapolation", "st_n_residual_meaning", "st_n_corr_causation"]
