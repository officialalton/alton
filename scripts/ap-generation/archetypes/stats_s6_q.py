"""AP Statistics 연습 시험 5(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 3·4·5. 기존 공개 세트와 연습 시험 3·4 의 풀이 틀을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(math.erf·수치 적분·분수·numpy)로 다시 계산한다. 모든 수·통계량은 $...$ 안(표 칸은 일반 글자)."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


def W(rows):
    return [(t, w, m, None, s) for t, w, m, s in rows]


# ======================= 17. 표본비율이 표본마다 달라짐 (3.1 / 2.D) =======================
UB_CTX = [dict(who="voters in a county", what="support a ballot measure"), dict(who="students at a university", what="own a bicycle"), dict(who="households in a city", what="recycle every week")]


def st_n5_phat_varies(rng):
    c = pick(rng, UB_CTX)
    n = rng.choice([150, 200, 300, 400]); p1, p2 = rng.choice([(0.44, 0.47), (0.52, 0.49), (0.38, 0.41)])
    key = (f"The two sample proportions differ because of sampling variability, and each is an unbiased estimate of the same population proportion.", "Different random samples give different values of the statistic, and the sample proportion is centered at the population proportion over many samples.")
    wr = W([("The two sample proportions differ, so at least one of the two samples must have been selected incorrectly.", "Random samples are expected to give different values; a difference does not show that a sample was selected incorrectly.", "difference_means_error", 1), ("The two sample proportions differ, so the population proportion must have changed between the two samples.", "The population proportion is fixed for the population; the difference comes from the sampling variability of the statistic.", "parameter_changed", 1),
            ("The larger sample proportion is closer to the population proportion, because it is larger.", "A larger value of a statistic is not more accurate; its closeness to the parameter depends on chance and on the sample size.", "larger_is_closer", 2)])
    stem = f"Two independent random samples of ${n}$ {c['who']} each are selected. In the first sample ${round(p1 * 100)}\\%$ of the {c['who']} {c['what']}, and in the second sample ${round(p2 * 100)}\\%$ do. Which of the following statements about the two sample proportions is correct?"
    return mc("st_n5_phat_varies", "3.1", "2.D", "Explain why two sample proportions differ and what an unbiased estimator means", ["Recognize that a statistic varies from sample to sample", "Conclude that the difference reflects sampling variability and reject explanations based on errors, a changed parameter or size"],
              key, wr, rng, stem, "each context pairs the sampling variability explanation with three misconceptions about errors, a changed parameter and size", ["interpretation", "claim_justification"], est=75)


# ======================= 18. 표본비율 분포가 정규에 가까워지는 조건 (3.2 / 2.D) =======================
PN_CTX = [dict(w="a random sample of voters", ev="support a proposal"), dict(w="a random sample of customers", ev="buy an extended warranty"), dict(w="a random sample of students", ev="walk to school")]


def st_n5_phat_normal_cond(rng):
    c = pick(rng, PN_CTX)
    for _ in forever():
        good = rng.choice([(200, 0.4), (150, 0.3), (400, 0.2), (120, 0.5), (300, 0.1)])
        bad = [(20, 0.3), (50, 0.1), (30, 0.8), (40, 0.05), (25, 0.6), (60, 0.9)]
        bad = rng.sample(bad, 3)
        ok = lambda t: t[0] * t[1] >= 10 and t[0] * (1 - t[1]) >= 10
        if ok(good) and not any(ok(b) for b in bad) and len({good} | set(bad)) == 4:
            break
    desc = lambda t: f"${t[0]}$ with a population proportion of ${t[1]:g}$"
    key = (f"A sample of {desc(good)}", f"Both $np = {good[0] * good[1]:g}$ and $n(1-p) = {good[0] * (1 - good[1]):g}$ are at least $10$, so the sampling distribution of $\\hat p$ is approximately normal.")
    wr = [(f"A sample of {desc(b)}", f"$np = {b[0] * b[1]:g}$ and $n(1-p) = {b[0] * (1 - b[1]):g}$, and at least one of them is less than $10$, so the sampling distribution of $\\hat p$ is not approximately normal.", f"large_counts_fail_{i}", None, 1) for i, b in enumerate(bad)]
    stem = f"For which of the following can the sampling distribution of the sample proportion be considered approximately normal when {c['w']} is selected and the proportion who {c['ev']} is as stated? Assume that the sample is less than $10\\%$ of the population."
    return mc("st_n5_phat_normal_cond", "3.2", "2.D", "Choose the sample size and proportion that satisfy the large counts condition", ["Compute np and n(1 - p) for each option", "Keep the option for which both counts are at least ten and reject the others"],
              key, wr, rng, stem, "exactly one option satisfies both large counts and the three others each fail at least one", ["condition_check", "calculated_value_decision"], est=85, facts=[f"good={good}"])


# ======================= 19. 주장 문구에서 가설 정하기 (3.5 / 2.E) =======================
HC_CTX = [dict(claim="A manufacturer claims that at least $90\\%$ of its light bulbs last more than $1000$ hours", p0=0.9, kind="ge", what="bulbs that last more than $1000$ hours"), dict(claim="A restaurant claims that no more than $5\\%$ of its orders arrive late", p0=0.05, kind="le", what="orders that arrive late"),
          dict(claim="A pollster claims that exactly half of the voters in a city support a proposal", p0=0.5, kind="eq", what="voters who support the proposal")]


def st_n5_hyp_from_claim(rng):
    c = pick(rng, HC_CTX)
    p0 = c["p0"]; k = c["kind"]
    H = {"ge": (f"$H_0: p = {p0:g}$ and $H_a: p < {p0:g}$", "The claim says 'at least', so the null hypothesis holds the boundary value and the alternative hypothesis is that the proportion is less than the claimed value."),
         "le": (f"$H_0: p = {p0:g}$ and $H_a: p > {p0:g}$", "The claim says 'no more than', so the null hypothesis holds the boundary value and the alternative hypothesis is that the proportion is greater than the claimed value."),
         "eq": (f"$H_0: p = {p0:g}$ and $H_a: p \\neq {p0:g}$", "The claim says 'exactly', so the null hypothesis is that the proportion equals the claimed value and the alternative hypothesis is two-sided.")}
    key = H[k]
    alts = [t for t in ("ge", "le", "eq") if t != k]
    other = {"ge": (f"$H_0: p = {p0:g}$ and $H_a: p > {p0:g}$", "Puts the alternative in the same direction as the claim; a researcher who tests the claim looks for evidence that the proportion is lower than claimed."), "le": (f"$H_0: p = {p0:g}$ and $H_a: p < {p0:g}$", "Puts the alternative in the same direction as the claim; a researcher who tests the claim looks for evidence that the proportion is higher than claimed."),
             "eq": (f"$H_0: p = {p0:g}$ and $H_a: p > {p0:g}$", "Uses a one-sided alternative although the claim of exactly this value is contradicted by a proportion on either side.")}
    wr = [(f"$H_0: \\hat p = {p0:g}$ and $H_a: \\hat p {'<' if k == 'ge' else '>' if k == 'le' else '\\neq'} {p0:g}$", "States the hypotheses with the sample proportion; hypotheses are about the population proportion.", "statistic_in_hypotheses", None, 2), (other[k][0], other[k][1], "claim_as_alternative", None, 1),
          (f"$H_0: p {'<' if k == 'ge' else '>' if k == 'le' else '<'} {p0:g}$ and $H_a: p = {p0:g}$", "Puts the equality in the alternative hypothesis; the null hypothesis must contain the equality.", "equality_in_alternative", None, 1)]
    stem = f"{c['claim']}. A researcher plans a test of significance, using a random sample, to see whether there is evidence against the claim. Let $p$ be the proportion of all {c['what']}. Which of the following gives the appropriate hypotheses?"
    return mc("st_n5_hyp_from_claim", "3.5", "2.E", "Write the hypotheses for a claim stated with at least, no more than or exactly", ["Translate the wording of the claim into a boundary value with the equality in the null hypothesis", "Choose the alternative that contradicts the claim and reject sample proportions in the hypotheses"],
              key, wr, rng, stem, "each claim wording fixes the direction of the alternative, and the wrong options use a statistic, the claim's direction or the equality in the alternative", ["procedure_choice", "claim_justification"], est=90, facts=[f"kind={k}"])


# ======================= 20. 구간과 검정 중 고르기 (3.3 / 2.C) =======================
CT5_CTX = [dict(goal="estimate the proportion of all voters in a county who support a proposal", key="int", pop="voters"), dict(goal="decide whether the proportion of all packages that arrive late differs from the $8\\%$ that a carrier claims", key="test", pop="packages"),
           dict(goal="estimate the proportion of all students at a school who ride the bus", key="int", pop="students"), dict(goal="decide whether the proportion of all customers who prefer a new recipe is greater than $50\\%$", key="test", pop="customers")]
PR5 = {"int": "A one-sample $z$ interval for a population proportion", "test": "A one-sample $z$ test for a population proportion", "two": "A two-sample $z$ interval for a difference of two population proportions", "chi": "A chi-square test of independence"}


def st_n5_interval_or_test(rng):
    c = pick(rng, CT5_CTX)
    k = c["key"]
    why = {"int": "The goal is to estimate a single population proportion, which an interval does.", "test": "The goal is to decide about a claimed value of a single population proportion, which a test does."}
    key = (PR5[k] + ".", why[k])
    other = "test" if k == "int" else "int"
    wr = W([(PR5[other] + ".", "The goal is " + ("to decide about a claimed value, which is the purpose of a test, not of an interval." if k == "test" else "to estimate a value, which is the purpose of an interval rather than a test."), "interval_test_confused", 1), (PR5["two"] + ".", "There is one sample and one population, not two independent samples to compare.", "two_sample", 1), (PR5["chi"] + ".", "There is one categorical variable with two outcomes in one sample, not two variables whose association is studied.", "chi_square", 2)])
    stem = f"A researcher takes one random sample of {c['pop']} and plans to {c['goal']}. Which of the following procedures is the most appropriate?"
    return mc("st_n5_interval_or_test", "3.3", "2.C", "Choose between an interval and a test for one proportion from the goal of the study", ["Decide whether the goal is to estimate a value or to decide about a claimed value", "Choose the matching one-proportion procedure and reject two-sample and chi-square procedures"],
              key, wr, rng, stem, "each context pairs the goal with one of the two one-proportion procedures and two procedures that do not fit one sample", ["procedure_choice", "claim_justification"], est=75, facts=[f"k={k}"])


# ======================= 21. z 값에서 P-값 (3.7 / 3.E) =======================
PZ_CTX = [dict(sc="In a test of $H_0: p = 0.5$ the test statistic is $z = {z}$."), dict(sc="A one-proportion $z$ test gives the test statistic $z = {z}$."), dict(sc="The test statistic for a test about a population proportion is $z = {z}$.")]


def st_n5_pvalue_from_z(rng):
    c = pick(rng, PZ_CTX)
    for _ in forever():
        z = rng.choice([-2.35, -1.96, -1.64, -1.28, 1.45, 1.75, 2.05, 2.33]); alt = pick(rng, ["less", "greater", "two"])
        if (alt == "less" and z > 0) or (alt == "greater" and z < 0):
            continue
        P = {"less": ncdf(z), "greater": 1 - ncdf(z), "two": 2 * (1 - ncdf(abs(z)))}[alt]
        agree(P, {"less": ss.norm.cdf(z), "greater": ss.norm.sf(z), "two": 2 * ss.norm.sf(abs(z))}[alt], tol=1e-9, name="p")
        one = 1 - ncdf(abs(z)); wrong = [one if alt == "two" else 2 * one, 1 - P, ncdf(abs(z))]
        vals = [P] + wrong
        if gaps_ok([round(v, 3) for v in vals], 0.015) and all(0 < v < 1 for v in vals):
            break
    altt = {"less": "$H_a: p < 0.5$", "greater": "$H_a: p > 0.5$", "two": "$H_a: p \\neq 0.5$"}[alt]
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(P), f"For {altt} the P-value is " + {"less": "the area to the left of $z$", "greater": "the area to the right of $z$", "two": "twice the area in the tail beyond $|z|$"}[alt] + f", which is ${P:.3f}$.", round(P, 3))
    ws = [("Uses the wrong number of tails for the alternative hypothesis.", "wrong_tails"), ("Gives the area on the opposite side of the test statistic from the alternative hypothesis.", "opposite_tail"), ("Gives the area to the left of $|z|$, which is not a tail area of the test.", "not_a_tail")]
    wr = [(f3(v), w[0], w[1], round(v, 3), 1 + i % 2) for i, (v, w) in enumerate(zip(wrong, ws))]
    stem = f"{c['sc'].format(z=z)} The alternative hypothesis is {altt}. What is the P-value of the test? (Give the answer as a decimal rounded to three decimal places.)"
    return mc("st_n5_pvalue_from_z", "3.7", "3.E", "Find the P-value of a z test from the test statistic and the alternative hypothesis", ["Decide which tail or tails of the standard normal distribution the alternative hypothesis uses", "Find that area from the test statistic and reject the other tail areas"],
              key, wr, rng, stem, "the P-value is recomputed with math.erf and with scipy's normal survival function for the stated alternative", ["procedure_choice", "calculated_value_decision"], est=90, facts=[f"z={z}", f"alt={alt}"],
              sig=(["alternative hypothesis", "tail area of the normal distribution"], 1, "light"))


# ======================= 22. 표본비율 구간의 오차한계 (3.3 / 3.B) =======================
ME_CTX = [dict(who="a random sample of ${n}$ customers", ev="said that they would buy again", pop="customers"), dict(who="a random sample of ${n}$ residents", ev="support a new park", pop="residents"), dict(who="a random sample of ${n}$ students", ev="use the library weekly", pop="students")]


def st_n5_margin_error_p(rng):
    c = pick(rng, ME_CTX)
    for _ in forever():
        n = rng.choice([200, 250, 400, 500, 625]); x = rng.randint(int(.3 * n), int(.7 * n)); ph = x / n; z = zstar(0.95)
        me = z * math.sqrt(ph * (1 - ph) / n); w1 = z * (ph * (1 - ph) / n); w2 = zstar(0.90) * math.sqrt(ph * (1 - ph) / n); w3 = z * math.sqrt(ph * (1 - ph)) / n * 10
        vals = [me, w1, w2, z * math.sqrt(ph * (1 - ph) / n) * 2]
        if gaps_ok([round(v, 3) for v in vals], 0.004) and n * ph >= 10 and n * (1 - ph) >= 10:
            break
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(me), f"The margin of error is $z^*\\sqrt{{\\hat p(1-\\hat p)/n}} = 1.960\\sqrt{{{ph:.3f}(1 - {ph:.3f})/{n}}} \\approx {me:.3f}$.", round(me, 3))
    wr = [(f3(w1), "Leaves out the square root in the standard error, which makes the margin of error far too small.", "no_square_root", round(w1, 3), 2), (f3(w2), "Uses the critical value for $90\\%$ confidence, about $1.645$, instead of about $1.960$.", "wrong_z", round(w2, 3), 1), (f3(vals[3]), "Doubles the margin of error, as if the interval width were the margin of error.", "width_not_margin", round(vals[3], 3), 2)]
    stem = f"In {c['who'].format(n=n)}, ${x}$ {c['ev']}. Assume that the conditions for inference are met. What is the margin of error of a $95\\%$ confidence interval for the proportion of all {c['pop']} who {c['ev'].replace('said that they would', 'would').replace('support', 'support')}? (Round to three decimal places.)"
    return mc("st_n5_margin_error_p", "3.3", "3.B", "Calculate the margin of error of a confidence interval for a proportion", ["Find the sample proportion and the standard error", "Multiply the standard error by the critical value for the stated confidence level"],
              key, wr, rng, stem, "the margin of error is recomputed with a critical value from bisection on the normal cdf and compared with scipy", ["procedure_choice", "calculated_value_decision"], est=90, facts=[f"n={n}", f"x={x}"])


# ======================= 23. 합동 비율 (3.13 / 3.E) =======================
PP_CTX = [dict(a="a morning class", b="an evening class", what="students who passed", u="students"), dict(a="the first design", b="the second design", what="visitors who clicked", u="visitors"), dict(a="the east plant", b="the west plant", what="parts that met the specification", u="parts")]


def st_n5_pooled_phat(rng):
    c = pick(rng, PP_CTX)
    for _ in forever():
        n1 = rng.choice([80, 100, 150, 200]); n2 = rng.choice([120, 160, 240, 300]); x1 = rng.randint(int(.4 * n1), int(.7 * n1)); x2 = rng.randint(int(.3 * n2), int(.6 * n2))
        pp = (x1 + x2) / (n1 + n2); avg = (x1 / n1 + x2 / n2) / 2; diff = x1 / n1 - x2 / n2; w3 = (x1 + x2) / n1
        vals = [pp, avg, diff, w3]
        if gaps_ok([round(v, 3) for v in vals], 0.01) and w3 < 1:
            break
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(pp), f"The pooled proportion combines the successes and the sample sizes of both samples: $({x1} + {x2})/({n1} + {n2}) = {pp:.3f}$.", round(pp, 3))
    wr = [(f3(avg), "Averages the two sample proportions without weighting them by the sample sizes.", "unweighted_average", round(avg, 3), 1), (f3(diff), "Gives the difference of the sample proportions, which is the numerator of the test statistic and not the pooled proportion.", "difference_given", round(diff, 3), 1), (f3(w3), "Divides the combined number of successes by the size of the first sample only.", "one_sample_size", round(w3, 3), 2)]
    stem = f"Independent random samples of ${n1}$ {c['u']} from {c['a']} and ${n2}$ {c['u']} from {c['b']} have ${x1}$ and ${x2}$ {c['what']}, respectively. A test of $H_0: p_1 = p_2$ is planned. What is the pooled sample proportion used in the standard error of the test statistic? (Round to three decimal places.)"
    return mc("st_n5_pooled_phat", "3.13", "3.E", "Calculate the pooled sample proportion for a test of two proportions", ["Recognize that the null hypothesis of equal proportions lets the two samples be combined", "Divide the total number of successes by the total sample size"],
              key, wr, rng, stem, "the pooled proportion is recomputed from the total successes and total sizes and the three wrong values are the named slips", ["procedure_choice", "calculated_value_decision"], est=85, facts=[f"x1={x1}", f"x2={x2}"])


# ======================= 24. 구간으로 양측 검정 결정 (3.4 / 4.G) =======================
CD_CTX = [dict(w="the proportion of all customers who prefer a new package design", p0=0.5), dict(w="the proportion of all voters who support a ballot measure", p0=0.5), dict(w="the proportion of all students who walk to school", p0=0.3)]


def st_n5_ci_two_sided(rng):
    c = pick(rng, CD_CTX)
    p0 = c["p0"]
    for _ in forever():
        n = rng.choice([300, 400, 500, 600]); inside = pick(rng, [True, False])
        ph = round(p0 + (rng.uniform(-0.015, 0.025) if inside else rng.choice([-1, 1]) * rng.uniform(0.07, 0.1)), 2)
        se = math.sqrt(ph * (1 - ph) / n); lo, hi = ph - 1.96 * se, ph + 1.96 * se
        if (lo < p0 < hi) == inside and abs(p0 - lo) > 0.004 and abs(hi - p0) > 0.004:
            break
    I = f"$({lo:.3f},\\ {hi:.3f})$"
    if inside:
        key = (f"Fail to reject $H_0$, because ${p0:g}$ is inside the interval {I}.", "A two-sided test at the significance level that matches the confidence level rejects the null value only if it is outside the interval.")
        wr = W([(f"Reject $H_0$, because the sample proportion ${ph:g}$ is not equal to ${p0:g}$.", "The sample proportion almost never equals the null value; the decision depends on whether the null value is inside the interval.", "sample_not_equal", 1), (f"Reject $H_0$, because the interval {I} is not centered at ${p0:g}$.", "An interval is not required to be centered at the null value; what matters is whether the null value is inside.", "not_centered", 2), (f"Fail to reject $H_0$, which proves that the population proportion is exactly ${p0:g}$.", "Failing to reject does not prove that the null value is true; it only shows that the value is plausible.", "accepts_null", 1)])
    else:
        key = (f"Reject $H_0$, because ${p0:g}$ is not inside the interval {I}.", "A null value outside a $95\\%$ interval is not plausible, so a two-sided test at the $5\\%$ level rejects it.")
        wr = W([(f"Fail to reject $H_0$, because the sample proportion ${ph:g}$ is close to ${p0:g}$.", "Closeness is judged against the margin of error; the null value is outside the interval, so it is not plausible.", "close_is_enough", 1), (f"Fail to reject $H_0$, because a confidence interval cannot be used to carry out a test.", "A $95\\%$ interval for a proportion can be used to decide a two-sided test at the $5\\%$ level.", "interval_cannot_test", 1), (f"Reject $H_0$, which proves that the population proportion is not ${p0:g}$.", "Rejecting the null hypothesis gives convincing evidence, not proof.", "proves_alternative", 2)])
    stem = f"A $95\\%$ confidence interval for {c['w']} is {I}, based on a random sample of ${n}$ for which the conditions for inference are met. A two-sided test of $H_0: p = {p0:g}$ is carried out at the significance level $\\alpha = 0.05$. Which of the following is the correct decision and reason?"
    return mc("st_n5_ci_two_sided", "3.4", "4.G", "Decide a two-sided test at the matching level from a confidence interval", ["Check whether the null value is inside the confidence interval", "State the decision at the matching significance level and reject reasons based on the sample proportion, centering or proof"],
              key, wr, rng, stem, "the null value is generated clearly inside or clearly outside the recomputed interval", ["claim_justification", "interpretation"], est=95, facts=[f"inside={inside}"])


# ======================= 25. 두 비율 검정의 결론 (3.13 / 4.G) =======================
TC5_CTX = [dict(a="students who use the tutoring center", b="students who do not use it", what="passed the course", cl="the proportion who passed is higher for students who use the tutoring center"), dict(a="patients who receive the new treatment", b="patients who receive the standard treatment", what="recovered within a week", cl="the proportion who recovered is higher with the new treatment"),
           dict(a="customers who received a coupon", b="customers who did not", what="made a purchase", cl="the proportion who made a purchase is higher for customers who received a coupon")]


def st_n5_two_prop_conclusion(rng):
    c = pick(rng, TC5_CTX)
    for _ in forever():
        z = rng.choice([1.35, 1.52, 1.88, 2.12, 2.41, 2.67]); P = 1 - ncdf(z)
        if abs(P - 0.05) > 0.012:
            break
    agree(P, ss.norm.sf(z), tol=1e-9, name="p")
    rej = P < 0.05
    st = f"${P:.3f}$"
    key = ((f"The P-value of about {st} is less than $0.05$, so there is convincing evidence that {c['cl']}.") if rej else (f"The P-value of about {st} is greater than $0.05$, so there is not convincing evidence that {c['cl']}."), "The decision compares the P-value with the significance level, and the conclusion is stated about the populations in context.")
    wr = W([((f"The P-value of about {st} is less than $0.05$, so we have proven that {c['cl']}.") if rej else (f"The P-value of about {st} is greater than $0.05$, so we have proven that the two proportions are equal."), "A test gives convincing evidence or a lack of it, not proof of the alternative or of the null hypothesis.", "proof_claimed", 2),
            ((f"The P-value of about {st} is greater than $0.05$, so there is convincing evidence that {c['cl']}.") if rej else (f"The P-value of about {st} is less than $0.05$, so there is convincing evidence that {c['cl']}."), "Reverses the decision rule: a P-value below the significance level is evidence against the null hypothesis.", "rule_reversed", 1),
            (f"The probability that the null hypothesis is true is about {st}, so the claim that {c['cl']} is " + ("probably true." if rej else "probably false."), "A P-value is not the probability that the null hypothesis is true.", "p_value_as_prob_h0", 1)])
    stem = f"Independent random samples of {c['a']} and of {c['b']} are used in a one-sided test of $H_0: p_1 = p_2$ against $H_a: p_1 > p_2$, where $p_1$ and $p_2$ are the population proportions that {c['what']}. The test statistic is $z = {z}$. Which of the following is the correct conclusion at the significance level $\\alpha = 0.05$?"
    return mc("st_n5_two_prop_conclusion", "3.13", "4.G", "State a conclusion about two proportions from the test statistic", ["Find the one-sided P-value from the test statistic", "Compare it with the significance level and state the conclusion about the populations in context without claiming proof"],
              key, wr, rng, stem, "the P-value is recomputed from the test statistic and the cases near 0.05 are excluded", ["claim_justification", "calculated_value_decision", "interpretation"], est=100, facts=[f"z={z}"],
              sig=(["one-sided P-value", "decision at a significance level"], 1, "light"))


# ======================= 26. t 분포의 특징 (4.2 / 2.D) =======================
TF_CTX = [dict(n1=5, n2=30), dict(n1=6, n2=40), dict(n1=8, n2=50)]


def st_n5_t_features(rng):
    c = pick(rng, TF_CTX)
    t1 = tstar(0.95, c["n1"] - 1); t2 = tstar(0.95, c["n2"] - 1); z = zstar(0.95)
    key = (f"The critical value is greater for the sample of ${c['n1']}$ (${t1:.3f}$) than for the sample of ${c['n2']}$ (${t2:.3f}$), and both are greater than the normal value ${z:.3f}$, because a $t$ distribution has heavier tails.", "A t distribution has more area in the tails than the normal distribution, and the tails get lighter as the degrees of freedom increase.")
    wr = [(f"The critical value is less for the sample of ${c['n1']}$ than for the sample of ${c['n2']}$, because a smaller sample gives a narrower distribution.", "A smaller sample gives fewer degrees of freedom and heavier tails, so the critical value is larger, not smaller.", "smaller_n_smaller_t", None, 1),
          (f"The critical value is the same for both samples, because the confidence level is the same.", "The critical value depends on the degrees of freedom as well as on the confidence level.", "same_for_both", None, 1),
          (f"Both critical values are less than the normal value ${z:.3f}$, because a $t$ distribution is more concentrated than the normal distribution.", "A t distribution is more spread out than the normal distribution, so its critical values are larger.", "t_less_than_z", None, 2)]
    stem = f"A researcher constructs $95\\%$ confidence intervals for a population mean from a sample of ${c['n1']}$ and from a sample of ${c['n2']}$ using critical values from the appropriate $t$ distributions. Which of the following statements about the two critical values is correct?"
    return mc("st_n5_t_features", "4.2", "2.D", "Compare t critical values for two sample sizes with each other and with the normal value", ["Recall that a t distribution has heavier tails than the normal distribution and that the tails get lighter as the degrees of freedom grow", "Compare the two critical values and the normal value and reject statements that reverse or ignore the effect of the degrees of freedom"],
              key, wr, rng, stem, "the critical values are recomputed by numerical integration of the t density and the statements are checked against them", ["interpretation", "claim_justification"], est=90, facts=[f"n1={c['n1']}", f"n2={c['n2']}"])


# ======================= 27. 두 평균의 차를 추정하려면 어떤 자료가 필요한가 (4.6 / 2.A) =======================
DD_CTX = [dict(q="Do students who use paper notes tend to score higher on a test than students who use a laptop?", pop="students at a college", ga="students who use paper notes", gb="students who use a laptop", var="the test score"),
          dict(q="Do drivers of electric cars tend to drive more kilometers per week than drivers of gasoline cars?", pop="drivers in a city", ga="drivers of electric cars", gb="drivers of gasoline cars", var="the number of kilometers driven in a week"),
          dict(q="Do workers on the new schedule tend to complete more tasks per day than workers on the old schedule?", pop="workers at a company", ga="workers on the new schedule", gb="workers on the old schedule", var="the number of tasks completed in a day")]


def st_n5_data_for_difference(rng):
    c = pick(rng, DD_CTX)
    na = rng.choice([30, 36, 40]); nb = rng.choice([32, 38, 45])
    key = (f"Independent random samples of ${na}$ {c['ga']} and ${nb}$ {c['gb']}, with {c['var']} recorded for each individual.", "The question compares the mean of a quantitative variable between two groups, so the data needed are independent random samples from the two groups with that variable recorded for every individual.")
    wr = W([(f"One random sample of ${na + nb}$ {c['pop']}, with only the group of each individual recorded.", "The variable that the question compares is not recorded, so the means cannot be compared.", "variable_not_recorded", 1), (f"A random sample of ${na}$ {c['ga']}, with {c['var']} recorded for each individual.", "Data from only one of the two groups cannot show a difference between the groups.", "one_group_only", 1),
            (f"Independent random samples of ${na}$ {c['ga']} and ${nb}$ {c['gb']}, with only whether each individual is above or below average recorded.", "Recording only above or below average discards the quantitative variable that the means need.", "categorized_response", 2)])
    stem = f"A researcher wants to answer the investigative question \"{c['q']}\" for the {c['pop']}. Which of the following describes the data that the researcher should collect?"
    return mc("st_n5_data_for_difference", "4.6", "2.A", "Choose the data needed to compare the means of two groups", ["Identify the quantitative variable and the two groups named in the question", "Choose independent random samples from both groups with the variable recorded and reject plans with one group, a missing variable or a categorized response"],
              key, wr, rng, stem, "each context pairs the complete plan with a plan that omits the variable, omits a group or categorizes the response", ["claim_justification", "procedure_choice"], est=80)


# ======================= 28. 쌍체 설계를 쓰는 이유 (4.4 / 2.B) =======================
MPW_CTX = [dict(what="the effect of a new shoe sole on running time", who="runners", pair="each runner runs once with each sole in a random order", var="differences among runners in basic speed"), dict(what="the effect of a hint on the time to solve a puzzle", who="players", pair="each player solves one puzzle with a hint and another without a hint", var="differences among players in puzzle skill"),
           dict(what="the effect of a fertilizer on plant growth", who="pairs of neighboring plots", pair="in each pair of neighboring plots one plot is chosen at random to receive the fertilizer", var="differences in soil and sunlight from plot to plot")]


def st_n5_why_matched(rng):
    c = pick(rng, MPW_CTX)
    key = (f"Pairing allows each {c['who'].rstrip('s') if c['who'] != 'pairs of neighboring plots' else 'pair'} to be compared with itself, which removes the effect of {c['var']} from the comparison.", "Within a pair the conditions are alike, so the differences within the pairs reflect the treatment more than the variability among individuals.")
    wr = W([("Pairing guarantees that the sample is representative of the population.", "Representing a population depends on how the individuals are selected, not on pairing.", "pairing_for_representation", 1), ("Pairing makes it possible to draw a cause-and-effect conclusion without random assignment.", "A cause-and-effect conclusion still needs random assignment within each pair, here of the order or of the treatment.", "pairing_replaces_random", 2), ("Pairing doubles the number of independent observations, so the sample is twice as large.", "The two measurements in a pair are not independent, so pairing does not give twice as many independent observations.", "doubles_sample", 1)])
    stem = f"A study of {c['what']} uses a matched-pairs design in which {c['pair']}. Which of the following is the main reason for using the matched-pairs design?"
    return mc("st_n5_why_matched", "4.4", "2.B", "State why a matched-pairs design is used", ["Recognize that a pair is compared with itself", "Choose the reason that pairing removes variability among individuals and reject claims about representation, causation without randomization or sample size"],
              key, wr, rng, stem, "each context pairs the removal of variability with three misconceptions about representation, randomization and sample size", ["claim_justification", "interpretation"], est=80)


# ======================= 29. 차이 목록에서 쌍체 t 통계량 (4.5 / 3.E) =======================
PT_CTX = [dict(what="the number of minutes of sleep", cond="before and after a new bedtime routine", u="minutes", diff="after minus before"), dict(what="the number of points scored on a quiz", cond="before and after a review session", u="points", diff="after minus before"), dict(what="the number of seconds to finish a task", cond="with the old tool and with the new tool", u="seconds", diff="old minus new")]


def st_n5_paired_t_list(rng):
    c = pick(rng, PT_CTX)
    for _ in forever():
        n = rng.choice([6, 8]); d = [rng.randint(-2, 12) for _ in range(n)]
        if len(set(d)) < n - 1:
            continue
        dm = float(np.mean(d)); sd = float(np.std(d, ddof=1)); t = dm / (sd / math.sqrt(n)); w1 = dm / sd; w2 = dm / (sd / n); w3 = dm / (float(np.std(d, ddof=0)) / math.sqrt(n))
        if dm > 1 and gaps_ok([round(v, 2) for v in (t, w1, w2, w3)], 0.08):
            break
    ref = ss.ttest_1samp(d, 0); agree(float(ref.statistic), t, tol=1e-9, name="t")
    f2 = lambda v: f"${v:.2f}$"
    key = (f2(t), f"The mean of the differences is ${dm:.3f}$ and their standard deviation is ${sd:.3f}$, so $t = {dm:.3f}/({sd:.3f}/\\sqrt{{{n}}}) \\approx {t:.2f}$.", round(t, 2))
    wr = [(f2(w1), "Divides the mean difference by the standard deviation without dividing the standard deviation by the square root of the sample size.", "no_standard_error", round(w1, 2), 1), (f2(w2), "Divides the standard deviation by $n$ instead of by the square root of $n$ in the standard error.", "divides_by_n", round(w2, 2), 2), (f2(w3), "Uses the population formula of the standard deviation, dividing by $n$ instead of $n - 1$, for a sample.", "sd_divisor_n", round(w3, 2), 2)]
    stem = f"A researcher measures {c['what']} for ${n}$ randomly selected individuals {c['cond']}. The differences ({c['diff']}) are {', '.join(f'${x}$' for x in d)} {c['u']}. For a test of $H_0: \\mu_d = 0$, what is the value of the test statistic $t$? (Round to two decimal places.)"
    return mc("st_n5_paired_t_list", "4.5", "3.E", "Compute the t statistic for a mean difference from the list of differences", ["Find the mean and the sample standard deviation of the differences", "Divide the mean by the standard error s over the square root of n"],
              key, wr, rng, stem, "the statistic is recomputed with scipy's one-sample t test applied to the differences", ["procedure_choice", "calculated_value_decision", "condition_check"], est=120, facts=[f"d={d}"],
              sig=(["differences as the data", "standard error of a mean"], 1, "light"))


# ======================= 30. 평균 구간에 필요한 표본 크기 (4.2 / 3.E) =======================
SM5 = [dict(what="the mean time, in minutes, that nurses spend on paperwork", u="minutes", sd=(10, 16)), dict(what="the mean weight, in grams, of packaged nuts", u="grams", sd=(6, 12)), dict(what="the mean length, in centimeters, of leaves", u="centimeters", sd=(2, 5))]


def st_n5_sample_size_mean(rng):
    c = pick(rng, SM5)
    for _ in forever():
        sd = rng.randint(*c["sd"]); m = rng.choice([1, 2, 3]) if c["sd"][1] > 6 else rng.choice([0.5, 1.0]); conf = rng.choice([0.90, 0.95, 0.99]); z = zstar(conf)
        nx = (z * sd / m) ** 2; nk = math.ceil(nx); nf = math.floor(nx); n2 = math.ceil(z * sd / m); n3 = math.ceil((z * sd / (2 * m)) ** 2)
        opts = [nk, nf, n2, n3]
        if len(set(opts)) == 4 and nx != nk and gaps_ok(opts, 1) and nk < 3000:
            break
    agree(z, ss.norm.ppf(1 - (1 - conf) / 2), tol=1e-6, name="z")
    key = (f"${nk}$", f"$n = (z^*\\sigma/m)^2 = ({z:.3f} \\cdot {sd}/{m:g})^2 \\approx {nx:.1f}$, which is rounded up to ${nk}$.", nk)
    wr = [(f"${nf}$", "Rounds the calculated sample size down, which gives a margin of error slightly larger than the stated value.", "rounded_down", nf, 2), (f"${n2}$", "Leaves out the square: the sample size is the square of $z^*\\sigma/m$.", "no_square", n2, 1), (f"${n3}$", "Doubles the margin of error in the denominator, as if the margin were half of the width of the interval.", "width_for_margin", n3, 1)]
    stem = f"A researcher wants to estimate {c['what']} with a margin of error of at most ${m:g}$ {c['u']} at a ${round(conf * 100)}\\%$ confidence level. A previous study suggests that the population standard deviation is about ${sd}$ {c['u']}. What is the smallest sample size that the researcher needs?"
    return mc("st_n5_sample_size_mean", "4.2", "3.E", "Find the smallest sample size for a stated margin of error for a mean", ["Solve the margin of error formula for n using the critical value, the standard deviation and the margin", "Round up to the next whole number"],
              key, wr, rng, stem, "the sample size is recomputed from the critical value by bisection and scipy and rounded up", ["procedure_choice", "calculated_value_decision"], est=105, facts=[f"sd={sd}", f"m={m}", f"conf={conf}"],
              sig=(["margin of error formula", "rounding up"], 1, "light"))


# ======================= 31. 평균 구간의 해석 (4.3 / 4.F) =======================
CM_CTX = [dict(pop="nurses in a hospital system", what="mean number of minutes per shift spent on paperwork", u="minutes"), dict(pop="packages of nuts from a factory", what="mean weight", u="grams"), dict(pop="tablets of a brand", what="mean battery life", u="hours")]


def st_n5_ci_mean_interpret(rng):
    c = pick(rng, CM_CTX)
    lo = round(rng.uniform(40, 60), 1); hi = round(lo + rng.uniform(4, 9), 1)
    key = (f"We are $95\\%$ confident that the {c['what']} of all {c['pop']} is between ${lo:g}$ and ${hi:g}$ {c['u']}.", "A confidence interval estimates the population mean, and the confidence level describes the success rate of the method.")
    wr = W([(f"$95\\%$ of the individual {c['pop']} in the sample have a value between ${lo:g}$ and ${hi:g}$ {c['u']}.", "The interval is for the population mean, not for the individual values in the sample.", "interval_for_individuals", 1), (f"There is a $95\\%$ probability that the sample mean is between ${lo:g}$ and ${hi:g}$ {c['u']}.", "The sample mean is known from the sample; the interval is about the population mean.", "about_sample_mean", 2), (f"If the sampling were repeated, $95\\%$ of the sample means would be between ${lo:g}$ and ${hi:g}$ {c['u']}.", "The interval from one sample does not give the range of future sample means; different samples give different intervals.", "future_sample_means", 2)])
    stem = f"A $95\\%$ confidence interval for the {c['what']} of all {c['pop']} is $({lo:g},\\ {hi:g})$ {c['u']}, based on a random sample for which the conditions for inference are met. Which of the following is the correct interpretation of the interval?"
    return mc("st_n5_ci_mean_interpret", "4.3", "4.F", "Interpret a confidence interval for a population mean", ["Identify that the interval estimates the population mean", "Choose the sentence that states the confidence in the method for the population mean and reject statements about individuals, the sample mean or future sample means"],
              key, wr, rng, stem, "each option differs from the key by one named defect: individuals, the sample mean or future sample means", ["interpretation", "claim_justification"], est=90)


# ======================= 32. 쌍체 t 검정의 결론 (4.5 / 4.G) =======================
PC5 = [dict(what="the time to finish a puzzle", cond="with a hint and without a hint", claim="the mean time is shorter with a hint", pop="players", d="without minus with"), dict(what="the score on a memory test", cond="after studying with music and after studying in silence", claim="the mean score is higher after studying with music", pop="students", d="music minus silence"),
       dict(what="the amount of pain reported", cond="before and after a therapy session", claim="the mean pain is lower after the session", pop="patients", d="before minus after")]


def st_n5_paired_conclusion(rng):
    c = pick(rng, PC5)
    for _ in forever():
        n = rng.choice([12, 16, 20, 25]); t = rng.choice([1.45, 1.78, 2.15, 2.48, 2.92]); df = n - 1; P = float(ss.t.sf(t, df)); agree(P, 1 - t_cdf_num(t, df), tol=1e-6, name="p")
        if abs(P - 0.05) > 0.012:
            break
    rej = P < 0.05; st = f"${P:.3f}$"
    key = ((f"The P-value of about {st} is less than $0.05$, so there is convincing evidence that {c['claim']} for all {c['pop']}.") if rej else (f"The P-value of about {st} is greater than $0.05$, so there is not convincing evidence that {c['claim']} for all {c['pop']}."), "The decision compares the P-value with the significance level, and the conclusion is about the population mean difference in context.")
    wr = W([((f"The P-value of about {st} is less than $0.05$, so {c['claim']} for every one of the {c['pop']} in the sample.") if rej else (f"The P-value of about {st} is greater than $0.05$, so the mean difference is exactly $0$ for all {c['pop']}."), "A test is about the population mean difference, not about every individual, and failing to reject does not show that the difference is exactly zero.", "individuals_or_proof", 2),
            ((f"The P-value of about {st} is greater than $0.05$, so there is convincing evidence that {c['claim']} for all {c['pop']}.") if rej else (f"The P-value of about {st} is less than $0.05$, so there is convincing evidence that {c['claim']} for all {c['pop']}."), "Reverses the decision rule: a P-value below the significance level is evidence against the null hypothesis.", "rule_reversed", 1),
            (f"The test statistic ${t}$ is greater than $0.05$, so there is convincing evidence that {c['claim']} for all {c['pop']}.", "Compares the test statistic with the significance level; the P-value is what is compared with $\\alpha$.", "statistic_vs_alpha", 1)])
    stem = f"A matched-pairs $t$ test of $H_0: \\mu_d = 0$ against a one-sided alternative, using the differences ({c['d']}) in {c['what']} {c['cond']} for ${n}$ randomly selected {c['pop']}, gives $t = {t}$. The conditions for inference are met. Which of the following is the correct conclusion at the significance level $\\alpha = 0.05$?"
    return mc("st_n5_paired_conclusion", "4.5", "4.G", "State the conclusion of a matched-pairs t test about a mean difference", ["Find the one-sided P-value from the test statistic and the degrees of freedom", "Compare it with the significance level and state the conclusion about the population mean difference in context"],
              key, wr, rng, stem, "the P-value is recomputed with scipy and by numerical integration of the t density and the cases near 0.05 are excluded", ["claim_justification", "calculated_value_decision", "interpretation"], est=100, facts=[f"n={n}", f"t={t}"],
              sig=(["one-sided P-value for a t statistic", "decision at a significance level"], 1, "light"))


# ======================= 33. 잔차의 합은 0 (5.4 / 3.B) =======================
RS_CTX = [dict(what="the heights of six plants", y="height", u="centimeters"), dict(what="the prices of six used cars", y="price", u="thousand dollars"), dict(what="the weekly sales of six stores", y="sales", u="thousand units")]


def st_n5_missing_residual(rng):
    c = pick(rng, RS_CTX)
    for _ in forever():
        res = [round(rng.uniform(-3.5, 3.5), 1) for _ in range(5)]
        last = round(-sum(res), 1)
        if abs(last) <= 4.5 and abs(last) > 0.3 and len({last, -last, round(sum(res), 1) / 2}) == 3:
            break
    opts = [last, -last, round(abs(last) + 1.0, 1), round(last / 2, 1)]
    if len(set(opts)) < 4 or not gaps_ok(opts, 0.3):
        raise ValueError("close")
    fm = lambda v: f"${v:g}$ {c['u']}"
    key = (fm(last), f"The residuals of a least-squares line add to $0$, so the missing residual is $-({' + '.join(f'({x:g})' for x in res)}) = {last:g}$.", last)
    wr = [(fm(-last), "Gives the value with the opposite sign; the residuals must add to $0$, not to the missing value.", "wrong_sign", -last, 1), (fm(opts[2]), "Gives a value whose absolute value is too large, so the six residuals would not add to $0$.", "wrong_size", opts[2], 2), (fm(opts[3]), "Gives half of the needed value, so the six residuals would not add to $0$.", "half_value", opts[3], 2)]
    stem = f"A least-squares regression line is fitted to data on {c['what']}. Five of the six residuals are {', '.join(f'${x:g}$' for x in res)} {c['u']}. What is the sixth residual?"
    return mc("st_n5_missing_residual", "5.4", "3.B", "Find a missing residual using the fact that the residuals of a least-squares line add to zero", ["Recall that the residuals of a least-squares line with an intercept add to zero", "Subtract the sum of the known residuals from zero"],
              key, wr, rng, stem, "the missing residual is recomputed as the negative of the sum of the five given residuals", ["procedure_choice", "calculated_value_decision"], est=80, facts=[f"res={res}"])


# ======================= 34. 단위를 바꾸면 기울기는? (5.5 / 4.D) =======================
SU_CTX = [dict(x="the height of a tree", y="the diameter of its trunk", xu="foot", xu2="meter", yu="inches", slope=0.9, f=0.3048, desc="1 foot = 0.3048 meter"), dict(x="the length of a trip", y="the cost of the trip", xu="mile", xu2="kilometer", yu="dollars", slope=0.6, f=1.609, desc="1 mile = 1.609 kilometers"),
          dict(x="the weight of a bag", y="the shipping fee", xu="pound", xu2="kilogram", yu="dollars", slope=1.8, f=0.4536, desc="1 pound = 0.4536 kilogram")]


def st_n5_slope_units(rng):
    c = pick(rng, SU_CTX)
    f = c["f"]; b = c["slope"]; b2 = b / f
    # 독립 경로: 합성 자료의 x 에 환산 계수를 곱하고 최소제곱 기울기를 다시 구한다
    xs = np.arange(1, 11, dtype=float); ys = b * xs + 3 + np.array([0.3, -0.2, 0.1, -0.4, 0.2, 0.0, -0.1, 0.4, -0.3, 0.1])
    agree(np.polyfit(xs * f, ys, 1)[0], np.polyfit(xs, ys, 1)[0] / f, tol=1e-9, name="slope")
    key = (f"About ${b2:.2f}$ {c['yu']} per {c['xu2']}.", f"One {c['xu']} is ${f}$ of a {c['xu2']}, so the predicted change per {c['xu2']} is ${b:g}/{f} \\approx {b2:.2f}$ {c['yu']}.")
    wr = [(f"About ${b:g}$ {c['yu']} per {c['xu2']}.", f"The slope is measured per unit of $x$, so it changes when the unit changes from the {c['xu']} to the {c['xu2']}.", "slope_unchanged", None, 1), (f"About ${b * f:.2f}$ {c['yu']} per {c['xu2']}.", f"Multiplies by the conversion factor instead of dividing by it; a {c['xu2']} is a different amount of $x$ than a {c['xu']} in the opposite way.", "factor_multiplied", None, 2),
          (f"About ${-b2:.2f}$ {c['yu']} per {c['xu2']}.", "The sign of the slope does not depend on the units, because the direction of the relationship does not change.", "sign_changes", None, 1)]
    stem = f"The least-squares line for predicting {c['y']} (in {c['yu']}) from {c['x']} (in {c['xu']}s) has a slope of ${b:g}$ {c['yu']} per {c['xu']}. The explanatory variable is converted to {c['xu2']}s ({c['desc']}) and the least-squares line is found again. What is the slope of the new line?"
    return mc("st_n5_slope_units", "5.5", "4.D", "Find the slope after the explanatory variable is converted to other units", ["Recognize that the slope is measured per unit of x", "Divide the slope by the conversion factor and keep its sign"],
              key, wr, rng, stem, "the new slope is recomputed by fitting a least-squares line to synthetic data whose x values are multiplied by the conversion factor", ["interpretation", "calculated_value_decision"], est=90, facts=[f"b={b}", f"f={f}"])


# ======================= 35. 내삽으로 믿을 만한 예측 고르기 (5.3 / 4.D) =======================
IL_CTX = [dict(x="the number of hours of practice per week", y="the skill score", lo=2, hi=12, a=40, b=3.5, unit="hours"), dict(x="the age of a car in years", y="its resale value in thousand dollars", lo=2, hi=10, a=30, b=-2.2, unit="years"), dict(x="the daily advertising spending in hundreds of dollars", y="the daily sales in thousands of units", lo=3, hi=15, a=12, b=1.8, unit="hundred dollars")]


def st_n5_interpolation_choice(rng):
    c = pick(rng, IL_CTX)
    inside = rng.choice([c["lo"] + 2, (c["lo"] + c["hi"]) // 2, c["hi"] - 2]); near = c["hi"] + 2; far = c["hi"] + 12; below = c["lo"] - 1
    a, b = c["a"], c["b"]; sg = "+" if b >= 0 else "-"
    key = (f"The prediction for $x = {inside}$, because ${inside}$ is between the smallest and the largest values of $x$ in the data.", f"The data have values of $x$ from ${c['lo']}$ to ${c['hi']}$, and a prediction inside that range is an interpolation, which is the most reliable kind.")
    wr = [(f"The prediction for $x = {near}$, because it is only a little beyond the largest value of $x$ in the data.", f"${near}$ is outside the range of the data (${c['lo']}$ to ${c['hi']}$), so the prediction is an extrapolation, even though it is close to the range.", "slightly_outside", None, 1),
          (f"The prediction for $x = {far}$, because the line is a least-squares line that fits all of the data.", "A good fit within the range of the data does not show that the line continues to hold far outside the range.", "least_squares_fits_all", None, 2),
          (f"The prediction for $x = {below}$, because the correlation is close to $1$.", f"${below}$ is below the smallest value of $x$ in the data, and a strong correlation within the range does not make predictions outside it reliable.", "strong_r_outside", None, 1)]
    stem = f"A least-squares line $\\hat y = {a} {sg} {abs(b):g}x$ predicts {c['y']} from {c['x']}, using data with $x$ from ${c['lo']}$ to ${c['hi']}$ {c['unit']} and a correlation close to $1$. A researcher considers predictions for $x = {inside}$, $x = {near}$, $x = {far}$ and $x = {below}$. Which prediction is the most reliable, and why?"
    return mc("st_n5_interpolation_choice", "5.3", "4.D", "Choose the prediction that is not an extrapolation and reject reasons based on closeness, fit or correlation", ["Compare each value of x with the range of the data", "Choose the value inside the range and reject values outside it whatever the reason given"],
              key, wr, rng, stem, "exactly one of the four values lies inside the stated range of the data and each wrong option gives a different reason", ["claim_justification", "condition_check"], est=85, facts=[f"inside={inside}"])


# ======================= 36. 상관계수 크기 비교 (5.2 / 4.A) =======================
CR5 = [dict(items=[("age of a car and its resale value", -0.92), ("shoe size and reading score of children", 0.55), ("daily temperature and heating bill", -0.78)]), dict(items=[("hours of practice and test score", 0.84), ("number of siblings and height", 0.08), ("distance to school and time to travel", 0.93)]),
       dict(items=[("hours of sleep and quiz score", 0.48), ("outdoor temperature and sweater sales", -0.86), ("number of pets and shoe size", -0.12)])]


def st_n5_corr_compare(rng):
    c = pick(rng, CR5)
    its = c["items"]
    strongest = max(its, key=lambda t: abs(t[1])); weakest = min(its, key=lambda t: abs(t[1]))
    sg = lambda v: f"${v:g}$"
    desc = "; ".join(f"{n}: $r = {r:g}$" for n, r in its)
    key = (f"The relationship between {strongest[0]} is the strongest linear relationship, because its correlation is farthest from $0$.", "The strength of a linear relationship is measured by the size of the correlation, the distance of $r$ from $0$, whatever its sign.")
    others = [t for t in its if t != strongest]
    pos_max = max(its, key=lambda t: t[1])
    wr = [(f"The relationship between {pos_max[0]} is the strongest linear relationship, because its correlation is the largest number.", "Compares the values of r as numbers; a negative correlation can be stronger than a positive one when it is farther from $0$.", "largest_value_not_size", None, 1), (f"The relationship between {weakest[0]} is the strongest linear relationship, because its correlation is closest to $0$.", "A correlation close to $0$ shows a weak linear relationship, not a strong one.", "closest_to_zero", None, 1),
          (f"The relationship between {strongest[0]} is a weak linear relationship, because its correlation is negative." if strongest[1] < 0 else f"The relationship between {others[0][0]} is the strongest, because it is the first one listed.", "A negative correlation is not weak because of its sign; the size of r shows the strength." if strongest[1] < 0 else "The order of a list does not show strength.", "sign_means_weak", None, 2)]
    if pos_max[0] == strongest[0]:
        wr[0] = (f"The relationship between {others[0][0]} is the strongest linear relationship, because it is listed first.", "The order of the list does not show strength; the size of the correlation does.", "listed_first", None, 1)
    stem = f"Three relationships were studied with random samples, and the correlations are as follows: {desc}. Which of the following statements is correct?"
    return mc("st_n5_corr_compare", "5.2", "4.A", "Compare the strength of linear relationships from correlation coefficients", ["Compare the sizes (absolute values) of the correlations, not their signs", "Choose the relationship with the correlation farthest from zero and reject comparisons by sign, closeness to zero or order"],
              key, wr, rng, stem, "each family lists three correlations with one negative value farther from zero than the largest positive one or a clearly strongest value", ["interpretation", "claim_justification"], est=80)


STAGE_SINGLES = ["st_n5_phat_varies", "st_n5_phat_normal_cond", "st_n5_hyp_from_claim", "st_n5_interval_or_test", "st_n5_pvalue_from_z", "st_n5_margin_error_p", "st_n5_pooled_phat", "st_n5_ci_two_sided", "st_n5_two_prop_conclusion",
                 "st_n5_t_features", "st_n5_data_for_difference", "st_n5_why_matched", "st_n5_paired_t_list", "st_n5_sample_size_mean", "st_n5_ci_mean_interpret", "st_n5_paired_conclusion",
                 "st_n5_missing_residual", "st_n5_slope_units", "st_n5_interpolation_choice", "st_n5_corr_compare"]

# P5 첫 런에서 반려된 원형(정의 암기 문항 교체, 단위 문구, 반복된 오답 근거)을 고쳐 다시 돌린다
STAGE_FIX = ["st_n5_data_for_difference", "st_n5_slope_units", "st_n5_interpolation_choice"]
