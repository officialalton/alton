"""AP Statistics S3 — 다단계·결합 개념 단독 MC 원형 10개(2026-10-12, docs/ap/statistics-difficulty.md).
목적: ST1 의 MC exam_prep 비율(24%)을 올린다. 라벨을 부풀리지 않고 실제로 어려운 구조(3단계 이상 + 둘 이상의 개념/자료)를 만든다. 모든 원형은 pack 에 `difficulty_signals` 를 선언한다
(단계 목록·결합 개념·자료 수·오답이 처음 틀어지는 단계). 게이트(lib/ap-generation/stats-difficulty.ts)가 "단계마다 그 단계에서 틀어지는 오답이 있는가"를 검사해 단계 부풀리기를 막는다.
정답은 코드가 계산하고 독립 경로(분수·scipy·math.erf·수치 적분·전수 열거·numpy)로 다시 계산한다. 해석·설계 문항은 고정 문장 4개(정답 1 + 이름 붙은 오해 3)다. 모든 수·통계량은 $...$ 안."""
from stats_common import *


NOSTIM = {"type": "none", "must_include": []}


def W(text, why, step, value=None):
    """오답 보기: 이 오답이 처음 틀어지는 단계(1부터)를 step 으로 붙인다."""
    o = Opt(text, False, why, value)
    o.step = step
    return o


def _bp(arch, topic, skill, concept, steps, cond, mis, path, material, judgment, method):
    return sbp(arch, topic, skill, concept, steps, cond, mis, path, material, judgment, method=method)


def spack_d(arch, topic, skill, stem, key, ds, rng, bpr, stim, est, facts, steps, concepts, reps, arith="light"):
    p = spack(arch, topic, skill, stem, key, ds, rng, bpr, stim, est, facts)
    p["difficulty_signals"] = {"steps": steps, "concepts": concepts, "representations": reps, "distractor_fail_step": {o.text: o.step for o in ds}, "arithmetic": arith}
    return p


def tie_safe(*vals):
    """3자리 반올림 보기: 값이 정확히 반올림 경계(예: 0.5625)에 놓이면 학생이 반올림 규칙에 따라 답이 갈리므로 제외한다."""
    return all(abs((v * 1000) % 1 - 0.5) > 0.02 for v in vals)


def cap(s):
    return s[0].upper() + s[1:]


# ======================= 1. 두 표본 vs 쌍체 선택 + 정규성 조건 확인 (4.4 / 4.E) =======================
SKEW, SYM = "strongly right-skewed with an outlier", "roughly symmetric with no outliers"
PAIRED_CTX = [
    dict(sc="A teacher wants to know whether a tutoring program changes the mean score on a vocabulary quiz. Each of ${n}$ randomly selected students takes the quiz before the program and takes a similar quiz after the program.", diff="after minus before", b="before scores", unit="students"),
    dict(sc="A coach wants to know whether the mean reaction time differs between the dominant and nondominant hands. Each of ${n}$ randomly selected athletes is tested with both hands, in a random order.", diff="dominant minus nondominant", b="dominant-hand times", unit="athletes"),
    dict(sc="A nutritionist wants to know whether a new diet changes the mean weight loss compared with a standard diet. In each of ${n}$ randomly selected pairs of twins, one twin is randomly assigned to each diet.", diff="new diet minus standard diet", b="weight losses on the new diet", unit="pairs of twins"),
]
INDEP_CTX = [
    dict(sc="To compare the mean number of hours studied last week, a researcher selects independent random samples of ${n1}$ students who use paper planners and ${n2}$ students who use phone apps.", a="paper planners", b="phone apps"),
    dict(sc="To compare the mean waiting time, in minutes, at two bank branches, a manager selects independent random samples of ${n1}$ customers at the downtown branch and ${n2}$ customers at the suburban branch.", a="the downtown branch", b="the suburban branch"),
    dict(sc="To compare the mean yield, in kilograms per plant, of two tomato varieties, a farmer selects independent random samples of ${n1}$ plants of the first variety and ${n2}$ plants of the second variety.", a="the first variety", b="the second variety"),
]


def st_t_procedure_conditions(rng):
    paired = rng.random() < 0.5
    verdict = pick(rng, ["met", "not"])
    MP, TS, OS = "Matched-pairs $t$ procedure", "Two-sample $t$ procedure", "One-sample $t$ procedure"
    vtxt = {"met": "is met", "not": "is not met"}
    if paired:
        c = pick(rng, PAIRED_CTX)
        n = rng.randint(14, 24)
        shape_d, shape_b = (SKEW, SYM) if verdict == "not" else (SYM, SKEW)
        # 독립 경로: 조건은 차이의 개수·모양에서 정해진다(n 이 30 미만이므로 모양이 결정). 모양 -> 판정 표
        ok = lambda shape, size: size >= 30 or shape == SYM
        assert ok(shape_d, n) == (verdict == "met") and ok(shape_b, n) == (verdict != "met")
        other = "met" if verdict == "not" else "not"
        stem = (c["sc"].format(n=n) + f" A dotplot of the ${n}$ differences ({c['diff']}) is {shape_d}, and a dotplot of the ${n}$ {c['b']} is {shape_b}. "
                "Which of the following identifies the appropriate $t$ procedure to compare the means and states whether its normality condition is met?")
        if verdict == "not":
            key = Opt(f"{MP}; the normality condition is not met, because there are only ${n}$ differences and they are {shape_d}", True, f"The pairs are the units, so the differences must be checked: ${n} < 30$ and their dotplot is strongly skewed, so the condition is not met.", None)
            ds = [W(f"{TS}; the normality condition is met, because the dotplot of the ${n}$ {c['b']} is {shape_b}", "Treats the two sets of measurements as two independent samples although the same individuals (or matched pairs) produced both sets.", 1),
                  W(f"{MP}; the normality condition is met, because the dotplot of the ${n}$ {c['b']} is {shape_b}", "Checks the shape of one set of measurements instead of the shape of the differences.", 2),
                  W(f"{MP}; the normality condition is not met, because the values before and after are dependent", "The pairs are meant to be dependent; the normality condition is about the shape of the differences, not about independence of the two measurements.", 3)]
        else:
            key = Opt(f"{MP}; the normality condition is met, because the dotplot of the ${n}$ differences is {shape_d}", True, f"The pairs are the units, so the differences must be checked: their dotplot is roughly symmetric with no outliers, so the condition is met even though ${n} < 30$.", None)
            ds = [W(f"{TS}; the normality condition is not met, because the dotplot of the ${n}$ {c['b']} is {shape_b}", "Treats the two sets of measurements as two independent samples although the same individuals (or matched pairs) produced both sets.", 1),
                  W(f"{MP}; the normality condition is not met, because the dotplot of the ${n}$ {c['b']} is {shape_b}", "Checks the shape of one set of measurements instead of the shape of the differences.", 2),
                  W(f"{MP}; the normality condition is not met, because ${n}$ is less than $30$", "Applies the sample-size guideline without using the dotplot: with a symmetric dotplot and no outliers a sample smaller than $30$ is acceptable.", 3)]
        steps = ["Decide from the design that the same units are measured twice, so the data are matched pairs", "Identify the quantity whose distribution must be checked: the differences, not the separate sets of measurements", "Apply the sample-size and dotplot guideline to the differences to decide whether the condition is met"]
        concepts = ["choosing matched-pairs versus two independent samples", "normality condition for t procedures"]
        bpr = _bp("st_t_procedure_conditions", "4.4", "4.E", "Choose between a matched-pairs and a two-sample t procedure from the design and verify the normality condition on the correct data",
                  steps, [("the design (same units measured twice) decides the procedure, and the normality condition is checked on the differences", "the stem states how the data were collected and describes the dotplots of the differences and of one set of measurements")],
                  [("independent_samples_for_pairs", "uses a two-sample procedure for data from the same individuals"), ("wrong_data_checked", "checks the shape of the original measurements instead of the differences"), ("rule_misapplied", "uses the sample-size rule or independence in place of the shape of the differences")],
                  "the verdict is recomputed from a table of (shape, size) pairs for the differences and for the measurements; exactly one option has the correct procedure, the correct data and the correct verdict",
                  NOSTIM, ["procedure_choice", "condition_check"], "design and shape/size truth table")
        return spack_d("st_t_procedure_conditions", "4.4", "4.E", stem, key, ds, rng, bpr, None, 115, [f"paired", f"n={n}", f"verdict={verdict}"], steps, concepts, 1, "none")
    c = pick(rng, INDEP_CTX)
    if verdict == "not":
        n1, n2 = rng.randint(36, 46), rng.randint(12, 19)
        s1, s2 = SKEW, SKEW
    else:
        n1, n2 = rng.randint(15, 19), rng.randint(15, 19)
        while n2 == n1:
            n2 = rng.randint(15, 19)
        s1, s2 = SYM, SYM
    ok = lambda shape, size: size >= 30 or shape == SYM
    assert (ok(s1, n1) and ok(s2, n2)) == (verdict == "met")
    stem = (c["sc"].format(n1=n1, n2=n2) + f" A dotplot of the ${n1}$ values for {c['a']} is {s1}, and a dotplot of the ${n2}$ values for {c['b']} is {s2}. "
            "Which of the following identifies the appropriate $t$ procedure to compare the means and states whether its normality condition is met?")
    comb = n1 + n2
    if verdict == "not":
        key = Opt(f"{TS}; the normality condition is not met, because the ${n2}$ values for {c['b']} are {s2} and ${n2} < 30$", True, f"The samples are independent, so each sample is checked: the sample for {c['b']} has ${n2} < 30$ values and is strongly skewed, so the condition is not met.", None)
        ds = [W(f"{OS} using all ${comb}$ values together; the normality condition is met, because ${comb} \\ge 30$", "Combines two independent samples into one, which is not a valid way to compare two means.", 1),
              W(f"{TS}; the normality condition is met, because the ${n1}$ values for {c['a']} are at least $30$ in number", "Checks only one of the two samples; the condition must hold for both.", 2),
              W(f"{TS}; the normality condition is not met, because the two sample sizes are not equal", "Equal sample sizes are not required for the two-sample $t$ procedure; the condition concerns the shape and size of each sample.", 3)]
    else:
        key = Opt(f"{TS}; the normality condition is met, because each of the two dotplots is {SYM}", True, "The samples are independent, so each sample is checked: both dotplots are roughly symmetric with no outliers, so the condition is met even though each sample is smaller than $30$.", None)
        ds = [W(f"{OS} using all ${comb}$ values together; the normality condition is met, because ${comb} \\ge 30$", "Combines two independent samples into one, which is not a valid way to compare two means.", 1),
              W(f"{TS}; the normality condition is met, because the combined sample of ${comb}$ values is at least $30$", "Checks the combined sample instead of each sample separately.", 2),
              W(f"{TS}; the normality condition is not met, because each sample size is less than $30$", "Applies the sample-size guideline without using the dotplots: symmetric dotplots with no outliers are acceptable for small samples.", 3)]
    steps = ["Decide from the design that the two groups are separate independent samples, so a two-sample procedure applies", "Identify that the condition must be checked for each sample separately, not for the combined values", "Apply the sample-size and dotplot guideline to each sample to decide whether the condition is met"]
    concepts = ["choosing matched-pairs versus two independent samples", "normality condition for t procedures"]
    bpr = _bp("st_t_procedure_conditions", "4.4", "4.E", "Choose between a matched-pairs and a two-sample t procedure from the design and verify the normality condition on the correct data",
              steps, [("two independent samples call for a two-sample procedure, and the normality condition is checked for each sample", "the stem states that the samples are independent and gives the sizes and dotplot shapes of both samples")],
              [("independent_samples_for_pairs", "combines the samples or uses a one-sample or matched-pairs procedure for independent samples"), ("wrong_data_checked", "checks only one sample or the combined sample"), ("rule_misapplied", "uses equal sample sizes or the sample-size rule alone as the criterion")],
              "the verdict is recomputed from a table of (shape, size) pairs for each sample; exactly one option has the correct procedure, the correct data and the correct verdict",
              NOSTIM, ["procedure_choice", "condition_check"], "design and shape/size truth table")
    return spack_d("st_t_procedure_conditions", "4.4", "4.E", stem, key, ds, rng, bpr, None, 115, ["independent", f"n={n1},{n2}", f"verdict={verdict}"], steps, concepts, 1, "none")


# ======================= 2. 신뢰구간과 검정 결정의 일관성 (4.3 / 4.G) =======================
CC_CTX = [
    dict(pop="bags of coffee", what="the mean weight, in ounces, of all bags of coffee filled by a machine", u="ounces", base=(11.0, 13.0), s=(0.5, 1.1)),
    dict(pop="commuters", what="the mean time, in minutes, that all commuters in a city spend on the way to work", u="minutes", base=(24.0, 44.0), s=(5.0, 9.0)),
    dict(pop="light bulbs", what="the mean lifetime, in hours, of all light bulbs of one brand", u="hours", base=(780.0, 920.0), s=(40.0, 80.0)),
]


def st_ci_test_consistency(rng):
    c = pick(rng, CC_CTX)
    conf = pick(rng, [90, 95])
    typ = pick(rng, ["two_out", "two_in", "one_support", "one_other", "one_in"])
    two = typ.startswith("two")
    gt = rng.random() < 0.5
    alpha = round((1 - conf / 100) / (1 if two else 2), 4)
    for _ in forever():
        n = rng.randint(16, 30)
        xb = round(rng.uniform(*c["base"]), 1)
        s = round(rng.uniform(*c["s"]), 1)
        tc = float(ss.t.ppf(1 - (1 - conf / 100) / 2, n - 1))
        me = tc * s / math.sqrt(n)
        lo, hi = round(xb - me, 1), round(xb + me, 1)
        if hi - lo < 4 * 0.1:
            continue
        step = round(max(0.1, (hi - lo) / 6), 1)
        if typ in ("two_in", "one_in"):
            m0 = round((lo + hi) / 2 + rng.uniform(-0.3, 0.3) * (hi - lo), 1)
        elif typ == "two_out":
            m0 = round(lo - step * rng.randint(2, 4), 1) if rng.random() < 0.5 else round(hi + step * rng.randint(2, 4), 1)
        elif typ == "one_support":  # m0 가 대립가설이 가리키는 쪽 바깥(Ha: > 이면 구간 아래)
            m0 = round(lo - step * rng.randint(2, 4), 1) if gt else round(hi + step * rng.randint(2, 4), 1)
        else:  # one_other: 반대쪽 바깥
            m0 = round(hi + step * rng.randint(2, 4), 1) if gt else round(lo - step * rng.randint(2, 4), 1)
        # 판정 두 경로: (a) 구간 위치 (b) 반올림된 구간에서 복원한 t 통계량과 P 값
        xm, mer = (lo + hi) / 2, (hi - lo) / 2
        se = mer / tc
        t = (xm - m0) / se
        if two:
            p = 2 * float(ss.t.sf(abs(t), n - 1))
            p2 = 2 * (1 - t_cdf_num(abs(t), n - 1))
            dec_ci = not (lo <= m0 <= hi)
        else:
            p = float(ss.t.sf(t, n - 1)) if gt else float(ss.t.cdf(t, n - 1))
            p2 = (1 - t_cdf_num(t, n - 1)) if gt else t_cdf_num(t, n - 1)
            dec_ci = (m0 < lo) if gt else (m0 > hi)
        agree(p, p2, tol=1e-5, name="pvalue")
        if (p < alpha) != dec_ci or abs(p - alpha) < 0.004 * (1 + alpha * 20):
            continue
        want = {"two_out": True, "two_in": False, "one_support": True, "one_other": False, "one_in": False}[typ]
        if dec_ci != want or m0 < 0:
            continue
        break
    sym = "\\ne" if two else (">" if gt else "<")
    opp = "<" if gt else ">"
    M = lambda v: f"{v:g}"
    r_ne = f"Reject $H_0$; there is convincing evidence that $\\mu \\ne {M(m0)}$"
    r_dir = f"Reject $H_0$; there is convincing evidence that $\\mu {sym} {M(m0)}$"
    r_opp = f"Reject $H_0$; there is convincing evidence that $\\mu {opp} {M(m0)}$"
    f_ = f"Fail to reject $H_0$; there is not convincing evidence that $\\mu {sym} {M(m0)}$"
    acc = f"Fail to reject $H_0$; there is convincing evidence that $\\mu = {M(m0)}$"
    und = "No conclusion can be reached, because a confidence interval cannot be used to carry out a significance test"
    W1 = ("Treats the interval and the test as unrelated, but a two-sided interval at confidence level $1-2\\alpha$ gives the decision for a test at level $\\alpha$ in the direction supported by the interval." if not two else "Treats the interval and the test as unrelated, but a two-sided interval at confidence level $1-\\alpha$ gives the decision for a two-sided test at level $\\alpha$.")
    if two and dec_ci:
        key = Opt(r_ne, True, f"The ${conf}\\%$ interval matches a two-sided test at $\\alpha = {alpha:g}$, and ${M(m0)}$ is outside $({lo:g}, {hi:g})$, so $H_0$ is rejected (the P-value is about ${p:.3f}$).", None)
        ds = [W(f_, f"Places ${M(m0)}$ inside the interval, but it lies outside $({lo:g}, {hi:g})$.", 2), W(acc, "Failing to reject $H_0$ never gives evidence that $H_0$ is true.", 3), W(und, W1, 1)]
    elif two:
        key = Opt(f_, True, f"The ${conf}\\%$ interval matches a two-sided test at $\\alpha = {alpha:g}$, and ${M(m0)}$ is inside $({lo:g}, {hi:g})$, so $H_0$ is not rejected (the P-value is about ${p:.3f}$).", None)
        ds = [W(r_ne, f"Places ${M(m0)}$ outside the interval, but it lies inside $({lo:g}, {hi:g})$.", 2), W(acc, "Failing to reject $H_0$ never gives evidence that $H_0$ is true.", 3), W(und, W1, 1)]
    elif dec_ci:
        key = Opt(r_dir, True, f"A ${conf}\\%$ two-sided interval matches a one-sided test at $\\alpha = {alpha:g}$; ${M(m0)}$ lies {'below' if gt else 'above'} the interval, on the side that supports $H_a$, so $H_0$ is rejected (the P-value is about ${p:.3f}$).", None)
        ds = [W(f_, f"Places ${M(m0)}$ inside the interval, but it lies {'below' if gt else 'above'} $({lo:g}, {hi:g})$.", 2), W(r_opp, "Rejects in the direction opposite to the alternative hypothesis, which the test does not support.", 3), W(und, W1, 1)]
    else:
        place = "inside the interval" if typ == "one_in" else f"{'above' if gt else 'below'} the interval, on the side opposite to the alternative"
        key = Opt(f_, True, f"A ${conf}\\%$ two-sided interval matches a one-sided test at $\\alpha = {alpha:g}$; ${M(m0)}$ lies {place}, so the sample gives no support for $H_a$ and $H_0$ is not rejected (the P-value is about ${p:.3f}$).", None)
        ds = [W(r_dir, f"Sees ${M(m0)}$ outside the interval but ignores which side supports $H_a$." if typ == "one_other" else f"Places ${M(m0)}$ outside the interval, but it lies inside $({lo:g}, {hi:g})$.", 3 if typ == "one_other" else 2),
              W(r_opp, "Rejects in the direction opposite to the alternative hypothesis, which the test does not support." if typ == "one_other" else f"Rejects in the direction opposite to the alternative hypothesis, and ${M(m0)}$ lies inside $({lo:g}, {hi:g})$, so $H_0$ is not rejected at all.", 3 if typ == "one_other" else 2), W(und, W1, 1)]
    alt = f"$H_a: \\mu {sym} {M(m0)}$"
    stem = (f"A random sample of ${n}$ {c['pop']} gives a ${conf}\\%$ confidence interval of $({lo:g}, {hi:g})$ for $\\mu$, {c['what']}. The same sample is used to test $H_0: \\mu = {M(m0)}$ against {alt} at significance level $\\alpha = {alpha:g}$. "
            "Assume that the conditions for inference are met. Which of the following is a correct conclusion?")
    steps = ["Match the confidence level of the interval to the significance level and the sidedness of the test", "Locate the hypothesized value relative to the interval and relative to the direction of the alternative hypothesis", "Turn the location into a decision about $H_0$ and state the conclusion about the claim without accepting the null hypothesis"]
    concepts = ["duality of confidence intervals and significance tests", "decision wording and direction of the alternative hypothesis"]
    bpr = _bp("st_ci_test_consistency", "4.3", "4.G", "Use a confidence interval to reach the decision of a matching significance test, including the direction of a one-sided alternative",
              steps, [("a two-sided interval at confidence level $1-2\\alpha$ matches a one-sided test at level $\\alpha$, and a two-sided interval at level $1-\\alpha$ matches a two-sided test", "the stem gives the interval, the null value, the alternative and the significance level")],
              [("interval_unrelated_to_test", "believes an interval cannot give a test decision"), ("location_misread_or_direction_ignored", "misplaces the null value or ignores the direction of the alternative"), ("accepting_the_null", "treats failing to reject as evidence that the null hypothesis is true")],
              "the decision is found from the position of the null value in the rounded interval and again from the t statistic and P-value (scipy and a numerically integrated t cdf), and the two must agree with a margin from the significance level",
              NOSTIM, ["claim_justification", "interpretation"], "interval position and recomputed P-value")
    return spack_d("st_ci_test_consistency", "4.3", "4.G", stem, key, ds, rng, bpr, None, 115, [f"type={typ}", f"conf={conf}", f"p={p:.4f}"], steps, concepts, 1, "none")


# ======================= 3. 표본평균의 표집분포: 중심·퍼짐·모양 (4.1 / 3.D) =======================
SD_CTX = [
    dict(var="the amount of time, in minutes, that customers wait to be served at a bank", unit="minutes"),
    dict(var="the weight, in pounds, of the luggage checked by passengers on a flight", unit="pounds"),
    dict(var="the number of messages, per day, received by employees of a company", unit="messages"),
]


def st_sampling_dist_xbar(rng):
    c = pick(rng, SD_CTX)
    case = pick(rng, ["skew_large", "skew_small", "normal_small"])
    n = pick(rng, [36, 49, 64, 100]) if case == "skew_large" else pick(rng, [9, 16, 25])
    if case == "skew_large":
        n = pick(rng, [36, 49, 64, 100])
    sig = pick(rng, [10, 12, 14, 15, 18, 20, 24])
    mu = pick(rng, [40, 45, 50, 60, 72, 80])
    xo = mu + pick(rng, [-1, 1]) * rng.randint(3, 6)
    sd = sig / math.sqrt(n)
    # 독립 경로: 시뮬레이션이 아니라 정확한 항등식 — 평균 n 개의 분산은 sigma^2 / n (균등 가중 합의 분산). numpy 로 공분산 행렬의 대각합으로 다시 계산한다.
    w = np.full(n, 1 / n)
    sd_check = math.sqrt(float(w @ (sig ** 2 * np.eye(n)) @ w))
    agree(sd, sd_check, tol=1e-9, name="sd_xbar")
    CLT = {"skew_large": ("approximately normal", f"The population is strongly skewed, but ${n} \\ge 30$, so the Central Limit Theorem makes the sampling distribution of $\\bar{{x}}$ approximately normal."),
           "skew_small": ("skewed to the right", f"The population is strongly skewed and ${n} < 30$, so the Central Limit Theorem does not apply and the sampling distribution of $\\bar{{x}}$ is still skewed to the right."),
           "normal_small": ("approximately normal", "The population is approximately normal, so the sampling distribution of $\\bar{x}$ is approximately normal for every sample size.")}
    shape_key, why_shape = CLT[case]
    wrong_shape = {"skew_large": "skewed to the right", "skew_small": "approximately normal", "normal_small": "skewed to the right"}[case]
    wrong_shape_why = {"skew_large": "Keeps the shape of the population, but for a large sample size the Central Limit Theorem makes the sampling distribution approximately normal.",
                       "skew_small": "Applies the Central Limit Theorem to a sample size that is too small for it when the population is strongly skewed.",
                       "normal_small": "Requires a sample size of at least $30$ even though the population is already approximately normal."}[case]
    popshape = "approximately normal" if case == "normal_small" else "strongly skewed to the right"
    f = lambda m, s_, sh: f"Mean ${clean(m, 2)}$, standard deviation ${clean(s_, 2)}$, {sh}"
    sd_bad = pick(rng, [sig, sig / n])
    key = Opt(f(mu, sd, shape_key), True, f"The mean of $\\bar{{x}}$ is $\\mu={mu}$, the standard deviation is $\\sigma/\\sqrt{{n}} = {sig}/\\sqrt{{{n}}} = {clean(sd, 2)}$. " + why_shape, None)
    ds = [W(f(xo, sd, shape_key), "Centers the sampling distribution at the mean of the one sample that was observed instead of at the population mean.", 1),
          W(f(mu, sd_bad, shape_key), "Uses the population standard deviation without dividing by $\\sqrt{n}$." if sd_bad == sig else "Divides the population standard deviation by $n$ instead of by $\\sqrt{n}$.", 2),
          W(f(mu, sd, wrong_shape), wrong_shape_why, 3)]
    if len({round(sd, 3), round(sd_bad, 3), round(sig, 3)}) < 2 or abs(sd - sd_bad) < 0.2:
        raise ValueError("sd_options_collide")
    stem = (f"The population distribution of {c['var']} is {popshape}, with mean $\\mu = {mu}$ and standard deviation $\\sigma = {sig}$. One random sample of ${n}$ observations from this population has a sample mean of ${xo}$. "
            f"Consider the sample means of all possible random samples of size ${n}$ from this population. Which of the following describes the sampling distribution of the sample mean $\\bar{{x}}$?")
    steps = ["Identify the center of the sampling distribution as the population mean, not the mean of the one observed sample", "Compute the standard deviation of the sample mean as the population standard deviation divided by the square root of the sample size", "Use the shape of the population and the sample size to decide whether the Central Limit Theorem makes the sampling distribution approximately normal"]
    concepts = ["standard error of a sample mean", "Central Limit Theorem and shape"]
    bpr = _bp("st_sampling_dist_xbar", "4.1", "3.D", "Describe the center, spread and shape of the sampling distribution of a sample mean from the population and the sample size",
              steps, [("the sampling distribution of the mean has mean mu, standard deviation sigma over root n, and is approximately normal when the population is normal or the sample size is large", "the stem gives the population shape, mean and standard deviation, the sample size and one observed sample mean")],
              [("center_at_observed_mean", "centers the distribution at the one observed sample mean"), ("spread_not_reduced", "forgets to divide by the square root of the sample size"), ("shape_clt_misapplied", "applies or withholds the Central Limit Theorem incorrectly")],
              "the standard deviation of a mean of n independent observations is recomputed from the variance of a weighted sum with numpy and compared with the closed form; the shape follows from a table of (population shape, sample size)",
              NOSTIM, ["interpretation", "calculated_value_decision"], "variance of a weighted sum and shape table")
    return spack_d("st_sampling_dist_xbar", "4.1", "3.D", stem, key, ds, rng, bpr, None, 105, [f"case={case}", f"n={n}", f"sigma={sig}"], steps, concepts, 1, "light")


# ======================= 4. 잔차그림 + r^2 로 모형 적합성 평가 (5.4 / 4.D) =======================
RR_CTX = [("the age of a car (in years)", "the selling price of the car", "Age (years)"), ("the number of hours studied", "the exam score", "Hours studied"), ("the temperature (in degrees Celsius)", "the number of cups of hot chocolate sold", "Temperature (degrees Celsius)")]


def st_residual_r2_model(rng):
    xdesc, ydesc, xlabel = pick(rng, RR_CTX)
    pattern = pick(rng, ["curved", "random"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n = pick(rng, [20, 24, 28])
        x = np.sort(gen.choice(np.arange(5, 61), size=n, replace=False)).astype(float)
        xc = (x - x.mean()) / x.std()
        r = 1.6 * (xc ** 2 - 1) + gen.normal(0, 0.35, n) if pattern == "curved" else gen.normal(0, 1.0, n)
        A = np.vstack([np.ones(n), x]).T
        coef, *_ = np.linalg.lstsq(A, r, rcond=None)
        r = r - A @ coef
        r = np.round(r * (4.0 / np.abs(r).max()), 2)
        q = np.polyfit(xc, r, 2)
        r2fit = 1 - ((r - np.polyval(q, xc)) ** 2).sum() / max(((r - r.mean()) ** 2).sum(), 1e-9)
        fan = abs(np.corrcoef(np.abs(r), x)[0, 1])
        if pattern == "curved" and r2fit > 0.75 and fan < 0.5:
            break
        if pattern == "random" and r2fit < 0.2 and fan < 0.35:
            break
    r2 = round(rng.uniform(0.88, 0.96), 2) if pattern == "curved" else round(rng.uniform(0.38, 0.56), 2)
    pct = int(round(r2 * 100))
    claim = (f"A student says that a linear model is appropriate because $r^2 = {r2:.2f}$, which is close to $1$." if pattern == "curved"
             else f"A student says that a linear model is not appropriate because $r^2 = {r2:.2f}$ is small.")
    cur = "The linear model is not appropriate, because the residual plot shows a curved pattern; a large $r^2$ does not show that the relationship is linear"
    ok_ = f"The linear model is appropriate, because the residual plot shows no pattern; the small $r^2$ means only that the model explains ${pct}\\%$ of the variation in the response"
    if pattern == "curved":
        key = Opt(cur, True, "The residuals are positive at the ends and negative in the middle, a curved pattern, so the linear model is not appropriate; $r^2$ measures the share of variation explained and cannot show that the form is linear.", None)
        ds = [W("The linear model is appropriate, because the residual plot shows no pattern and the large $r^2$ confirms it", "Misreads the residual plot: the residuals form a curved pattern rather than random scatter.", 1),
              W("The linear model is appropriate, because a large $r^2$ shows that the relationship between the variables is linear", "Treats a large $r^2$ as proof that the form is linear; a curved relationship can have a large $r^2$.", 2),
              W("The linear model is not appropriate, because $r^2$ is less than $1$ so the predictions are not exact", "Reaches the right decision for the wrong reason: $r^2$ below $1$ is true of every real model and is not the evidence against linearity.", 3)]
    else:
        key = Opt(ok_, True, f"The residuals scatter randomly about $0$ with no pattern, so the linear model is appropriate; $r^2 = {r2:.2f}$ says the line explains about ${pct}\\%$ of the variation but does not mean the form is wrong.", None)
        ds = [W("The linear model is not appropriate, because the residual plot shows a curved pattern that the line does not capture", "Misreads the residual plot: the residuals are randomly scattered, not curved.", 1),
              W("The linear model is not appropriate, because an $r^2$ below $0.60$ shows that the relationship is not linear", "Treats a small $r^2$ as evidence that the form is not linear; a linear relationship with a lot of scatter can have a small $r^2$.", 2),
              W("The linear model is appropriate, because the residuals add up to $0$", "Reaches the right decision for the wrong reason: least-squares residuals always add up to $0$, whatever the model.", 3)]
    stem = (f"A least-squares regression line is used to predict {ydesc} from {xdesc}, using ${n}$ observations. The residual plot is shown, and the coefficient of determination is $r^2 = {r2:.2f}$. {claim} Which of the following is the best response to the student?")
    stim = stat_stim("Residual plot with a horizontal line at zero", "scatter", xTitle=xlabel, yTitle="Residual", points=[[float(a), float(b)] for a, b in zip(x, r)], fitLine={"slope": 0, "intercept": 0})
    steps = ["Read the residual plot for a systematic pattern such as a curve rather than random scatter about zero", "Recognize that the size of $r^2$ measures the share of variation explained and does not decide whether a linear form is appropriate", "State the decision about the linear model with the residual pattern as the evidence"]
    concepts = ["residual plot as evidence about the form of the model", "interpretation of the coefficient of determination"]
    bpr = _bp("st_residual_r2_model", "5.4", "4.D", "Assess a linear model from the residual plot and a stated r squared, and respond to a claim that uses r squared as the criterion",
              steps, [("the form of the relationship is judged from the residual pattern, while r squared only measures the share of variation explained", "the stem shows the residual plot, gives r squared and states a student's claim")],
              [("residual_pattern_misread", "sees random scatter in a curve or a curve in random scatter"), ("r_squared_as_linearity", "uses the size of r squared as proof or disproof of linearity"), ("right_decision_wrong_reason", "gives the right decision with a reason that is true of every model")],
              "residuals are made orthogonal to x like least-squares residuals; a quadratic fit R squared and the correlation of absolute residuals with x classify the pattern, which must match the intended pattern",
              {"type": "scatter", "must_include": ["residuals", "zero line"]}, ["interpretation", "representation_reading"], "quadratic fit classification")
    return spack_d("st_residual_r2_model", "5.4", "4.D", stem, key, ds, rng, bpr, stim, 110, [f"pattern={pattern}", f"r2={r2}"], steps, concepts, 2, "none")


# ======================= 5. 고레버리지·이상점 제거의 영향(r, 기울기) (5.2 / 4.D) =======================
OL_CTX = [("the number of hours of sleep", "a reaction time score (in milliseconds)", "Hours of sleep", "Reaction time (ms)"), ("the engine size (in liters)", "the fuel efficiency (in miles per gallon)", "Engine size (liters)", "Fuel efficiency (mpg)"),
          ("the daily high temperature (in degrees Fahrenheit)", "the number of visitors to a park", "Temperature (F)", "Visitors")]


def _fit2(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    return sxy / sxx, my - sxy / sxx * mx, sxy / math.sqrt(sxx * syy)


def st_outlier_effect(rng):
    xdesc, ydesc, xl, yl = pick(rng, OL_CTX)
    typ = pick(rng, ["lev_on", "lev_off", "y_out"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n0 = 11
        x = list(np.round(np.sort(gen.uniform(2, 18, n0)), 1))
        b, a = gen.uniform(2, 5), gen.uniform(10, 30)
        y = [round(a + b * xi + gen.normal(0, 3.0), 1) for xi in x]
        if typ == "lev_on":
            xe = round(gen.uniform(28, 34), 1)
            ye = round(a + b * xe + gen.normal(0, 3.0), 1)
        elif typ == "lev_off":
            xe = round(gen.uniform(28, 34), 1)
            ye = round(a + b * xe + pick(rng, [-1, 1]) * gen.uniform(30, 60), 1)
        else:
            xe = round(float(np.mean(x)) + gen.uniform(-1.5, 1.5), 1)
            ye = round(a + b * xe + pick(rng, [-1, 1]) * gen.uniform(28, 45), 1)
        xs, ys = x + [xe], y + [ye]
        sl_w, ic_w, r_w = _fit2(xs, ys)
        sl_o, ic_o, r_o = _fit2(x, y)
        agree(np.polyfit(xs, ys, 1)[0], sl_w, tol=1e-9, name="slope_with")
        agree(np.corrcoef(x, y)[0, 1], r_o, tol=1e-9, name="r_without")
        if min(ys) < 0 or max(ys) > 140 or abs(r_o) < 0.55 or abs(r_o) > 0.985:
            continue
        rel = abs(abs(sl_o) - abs(sl_w)) / max(abs(sl_w), 0.1)
        d_r = abs(r_o) - abs(r_w)  # 제거했을 때 |r| 변화
        if typ == "lev_on" and not (d_r < -0.03 and rel < 0.07):
            continue
        if typ == "lev_off" and not (d_r > 0.05 and rel > 0.25):
            continue
        if typ == "y_out" and not (d_r > 0.06 and rel < 0.10):
            continue
        break
    r_up = abs(r_o) > abs(r_w)
    s_state = "same" if rel < 0.12 else ("steeper" if abs(sl_o) > abs(sl_w) else "flatter")
    RT = {True: "stronger", False: "weaker"}
    ST = {"same": "about the same", "steeper": "noticeably steeper", "flatter": "noticeably less steep"}
    words = lambda ru, ss_: f"The correlation becomes {RT[ru]} and the slope of the least-squares line becomes {ST[ss_]}"
    key = Opt(words(r_up, s_state), True, f"Without the circled point $|r|$ changes from ${abs(r_w):.2f}$ to ${abs(r_o):.2f}$ and the slope magnitude from ${abs(sl_w):.2f}$ to ${abs(sl_o):.2f}$.", None)
    key_c = (r_up, s_state)
    alt_s = [t for t in ("same", "steeper", "flatter") if t != s_state]
    same_why = {"lev_on": "the point follows the trend of the other points, so removing it leaves the slope about the same", "y_out": "the point is near the middle of the $x$-values, so removing it leaves the slope about the same", "lev_off": "the point lies far from the trend of the others, so removing it changes the slope noticeably"}[typ]
    r_why = ("the point lies away from the line and pulls the correlation down, so without it the correlation is stronger" if r_up else "the point extends the range of the $x$-values along the pattern, so without it the correlation is weaker")
    cands = [((not r_up, s_state), "Gets the effect on the correlation backwards: " + r_why + ".", 2),
             ((r_up, rng.choice(alt_s)), "Gets the effect on the slope wrong: " + (same_why if s_state == "same" else "the point pulls the line, so removing it changes the slope noticeably, and the direction of the change is given by the fitted lines") + ".", 3)]
    others = [v for k, v in {"lev_on": (True, "same"), "y_out": (False, "same"), "lev_off": (True, "steeper" if abs(sl_o) > abs(sl_w) else "flatter")}.items() if k != typ]
    pool = others + [(rr, ss_) for rr in (True, False) for ss_ in ("same", "steeper", "flatter")]
    ds, used = [], {key_c}
    for v, why, st in cands:
        if v in used:
            continue
        used.add(v)
        ds.append(W(words(*v), why, st))
    for v in pool:
        if len(ds) == 3:
            break
        if v in used:
            continue
        used.add(v)
        ds.append(W(words(*v), "Misjudges what kind of point the circled point is: it treats a point of one type (extreme in $x$ and on the trend, extreme in $x$ and off the trend, or extreme only in $y$) as if it were another type.", 1))
    assert len(ds) == 3
    stem = (f"The scatterplot shown displays ${n0 + 1}$ observations of {xdesc} and {ydesc}. The point circled in red is removed, and the correlation coefficient and the least-squares line are recomputed. "
            "Which of the following best describes the effect of removing the point?")
    stim = stat_stim("Scatterplot with one highlighted point", "scatter", xTitle=xl, yTitle=yl, xMin=0, xMax=40, xStep=5, points=[[float(a_), float(b_)] for a_, b_ in zip(xs, ys)], highlights=[{"index": n0}])
    steps = ["Classify the circled point by its position: far from the other $x$-values (leverage) or only far in the $y$-direction, and on or off the trend of the other points", "Decide how removing a point of that type changes the strength of the correlation", "Decide whether removing a point of that type changes the slope of the least-squares line noticeably"]
    concepts = ["leverage versus vertical outlier", "effect of unusual points on correlation and slope"]
    bpr = _bp("st_outlier_effect", "5.2", "4.D", "Predict how removing a high-leverage point on the trend, a high-leverage point off the trend or a vertical outlier changes the correlation and the slope",
              steps, [("a high-leverage point on the trend strengthens the correlation and barely moves the slope, a high-leverage point off the trend weakens the correlation and moves the slope, and a vertical outlier in the middle weakens the correlation and barely moves the slope", "the plot shows the circled point relative to the other observations")],
              [("point_type_misjudged", "treats the circled point as a different type of unusual point"), ("correlation_backwards", "gets the effect on the correlation backwards"), ("slope_effect_wrong", "gets the effect on the slope wrong")],
              "slope and correlation are recomputed with and without the point by closed-form sums and by numpy polyfit and corrcoef; the point type is enforced by thresholds on the change in |r| and on the relative change in the slope",
              {"type": "scatter", "must_include": ["highlighted point"]}, ["interpretation", "representation_reading"], "with/without recomputation")
    return spack_d("st_outlier_effect", "5.2", "4.D", stem, key, ds, rng, bpr, stim, 110, [f"type={typ}", f"r_with={r_w:.3f}", f"r_without={r_o:.3f}"], steps, concepts, 1, "none")


# ======================= 6. 검정력 표 읽기: 유의수준과 표본 크기를 함께 바꿀 때 (3.8 / 2.D) =======================
PT_CTX = [
    dict(test="A researcher tests $H_0: \\mu = 70$ versus $H_a: \\mu > 70$, where $\\mu$ is the mean score of all students at a school on a reading test, using a random sample of students from a population that is approximately normal with a known standard deviation of ${sd}$.", mua=74, mu0=70, sd=15),
    dict(test="A scientist tests $H_0: \\mu = 500$ versus $H_a: \\mu > 500$, where $\\mu$ is the mean lifetime, in hours, of all batteries of a new design, using a random sample of batteries from a population that is approximately normal with a known standard deviation of ${sd}$ hours.", mua=520, mu0=500, sd=80),
]


def _power(n, a, mu0, mua, sd):
    zc = float(ss.norm.ppf(1 - a))
    p1 = float(ss.norm.sf(zc - (mua - mu0) * math.sqrt(n) / sd))
    # 독립 경로: math.erf 와 이분법으로 임계값을 구하고 같은 검정력을 계산
    lo_, hi_ = 0.0, 6.0
    for _ in range(80):
        m = (lo_ + hi_) / 2
        if 1 - ncdf(m) > a:
            lo_ = m
        else:
            hi_ = m
    zc2 = (lo_ + hi_) / 2
    p2 = 1 - ncdf(zc2 - (mua - mu0) * math.sqrt(n) / sd)
    agree(p1, p2, tol=1e-6, name="power")
    return p1


def st_power_table_change(rng):
    c = pick(rng, PT_CTX)
    mu0, mua, sd = c["mu0"], c["mua"], c["sd"]
    for _ in forever():
        ns = sorted(rng.sample([15, 20, 25, 30, 40, 50, 60, 80, 100], 3))
        als = [0.10, 0.05, 0.01]
        tbl = [[round(_power(n, a, mu0, mua, sd), 2) for a in als] for n in ns]
        if len({v for row in tbl for v in row}) < 9 or any(not (0.08 <= v <= 0.97) for row in tbl for v in row):
            continue
        # 서로 상충하는 변화: (유의수준 down, n up) 또는 (유의수준 up, n down)
        mode = pick(rng, ["a_down_n_up", "a_up_n_down"])
        if mode == "a_down_n_up":
            i0, j0 = rng.randrange(0, 2), rng.randrange(0, 2)
            i1, j1 = rng.randrange(i0 + 1, 3), j0 + 1  # 표본 크기 증가, 유의수준 감소(열 인덱스 증가 = 더 작은 alpha)
        else:
            i0, j0 = rng.randrange(1, 3), rng.randrange(1, 3)
            i1, j1 = rng.randrange(0, i0), j0 - 1
        if j1 < 0 or j1 > 2 or i1 > 2:
            continue
        p0, p1 = tbl[i0][j0], tbl[i1][j1]
        if abs(p0 - p1) < 0.04:
            continue
        break
    a0, a1, n0, n1 = als[j0], als[j1], ns[i0], ns[i1]
    ti_down = a1 < a0
    up = p1 > p0
    TI = {True: "The probability of a Type I error decreases", False: "The probability of a Type I error increases"}
    PW_ = {True: "the power of the test increases", False: "the power of the test decreases"}
    opt = lambda ti, pw: f"{TI[ti]} and {PW_[pw]}"
    key = Opt(opt(ti_down, up), True, f"The probability of a Type I error equals the significance level, so it goes from ${a0:g}$ to ${a1:g}$; the table shows the power changing from ${p0:.2f}$ to ${p1:.2f}$.", None)
    ds = [W(opt(not ti_down, up), "Gets the Type I error backwards: its probability equals the new significance level, so it follows the change in the significance level, not the sample size.", 1),
          W(opt(not ti_down, not up), "Gets the Type I error backwards and also reads the change in power in the wrong direction.", 1),
          W(opt(ti_down, not up), f"Lets one of the two changes dominate: the table shows the net change in power from ${p0:.2f}$ to ${p1:.2f}$, which is the other direction.", 3)]
    stem = (c["test"].format(sd=sd) + f" The table shows the power of the test against the alternative $\\mu = {mua}$ for several sample sizes and significance levels. The researcher currently uses $n = {n0}$ and $\\alpha = {a0:g}$ and is considering a change to $n = {n1}$ and $\\alpha = {a1:g}$. "
            "Which of the following describes the effect of the change?")
    stim = stat_stim("Power of the test against the alternative mean for several sample sizes and significance levels", "table", title=f"Power of the test against the alternative mean {mua}",
                     columns=["Sample size n"] + [f"alpha = {a:g}" for a in als], rows=[[str(n)] + [f"{v:.2f}" for v in row] for n, row in zip(ns, tbl)])
    steps = ["Recall that the probability of a Type I error equals the significance level, so it follows the change in $\\alpha$", "Locate the current and the proposed combination of sample size and significance level in the power table", "Compare the two power values to find the net effect, since the two changes push the power in opposite directions"]
    concepts = ["probability of Type I error and significance level", "power as a function of sample size and significance level"]
    bpr = _bp("st_power_table_change", "3.8", "2.D", "Judge the combined effect on the Type I error probability and the power of changing the significance level and the sample size together, using a table of powers",
              steps, [("the Type I error probability equals alpha, and the net effect on power of opposite changes is read from the table of powers", "the stem names both changes and the table gives the power for each combination")],
              [("type_i_follows_n", "thinks the Type I error probability changes with the sample size"), ("both_wrong", "reads both effects in the wrong direction"), ("one_effect_dominates", "lets only one of the two changes decide the direction of the power")],
              "each power is computed with scipy's normal distribution and again from a bisection on math.erf; the compared powers must differ by at least 0.04 in the table",
              {"type": "table", "must_include": ["power values", "sample sizes", "significance levels"]}, ["interpretation", "representation_reading"], "power table dual computation")
    return spack_d("st_power_table_change", "3.8", "2.D", stem, key, ds, rng, bpr, stim, 115, [f"n={n0}->{n1}", f"alpha={a0}->{a1}"], steps, concepts, 2, "none")


# ======================= 7. 비복원 두 번 뽑기: 조건부 확률 + 나무그림 (2.6 / 3.C) =======================
TD_CTX = [
    dict(bag="A bag contains ${a}$ red marbles and ${b}$ blue marbles.", draw="Two marbles are drawn at random, one after the other, without replacement.", A="red", B="blue", ev="the second marble is {w}", asked="the first marble was {w}", nm=("Red", "Blue")),
    dict(bag="A raffle drum contains ${a}$ winning tickets and ${b}$ non-winning tickets.", draw="Two tickets are drawn at random, one after the other, without replacement.", A="winning", B="non-winning", ev="the second ticket is {w}", asked="the first ticket was {w}", nm=("Winning", "Not win")),
    dict(bag="A club has ${a}$ seniors and ${b}$ juniors.", draw="Two members are chosen at random, one after the other, without replacement, to serve as president and treasurer.", A="a senior", B="a junior", ev="the treasurer is {w}", asked="the president is {w}", nm=("Senior", "Junior")),
]


def st_two_draw_conditional(rng):
    c = pick(rng, TD_CTX)
    for _ in forever():
        a, b = rng.randint(3, 9), rng.randint(3, 9)
        if a == b:
            continue
        N = a + b
        # X = 첫 번째가 A, Y = 두 번째가 A 또는 B 중 하나(사건)
        ev_is_A = rng.random() < 0.5
        first_is = "A" if rng.random() < 0.5 else "B"
        cnt = {"A": a, "B": b}
        P1 = {k: Fr(v, N) for k, v in cnt.items()}
        P2 = {(f, s): Fr(cnt[s] - (1 if f == s else 0), N - 1) for f in "AB" for s in "AB"}
        ev = "A" if ev_is_A else "B"
        joint = P1[first_is] * P2[(first_is, ev)]
        tot = sum(P1[f] * P2[(f, ev)] for f in "AB")
        key_v = joint / tot
        d = {"branch": P2[(first_is, ev)], "joint": joint, "total": tot}
        vals = [float(key_v)] + [float(v) for v in d.values()]
        if min(abs(x - y) for i, x in enumerate(vals) for y in vals[i + 1:]) >= 0.02 and tie_safe(*vals):
            break
    # 독립 경로: 모든 순서쌍(구별되는 개체)을 전수 열거
    items = [("A", i) for i in range(a)] + [("B", i) for i in range(b)]
    pairs = [(p, q) for p in items for q in items if p != q]
    given = [pq for pq in pairs if pq[1][0] == ev]
    agree(sum(1 for pq in given if pq[0][0] == first_is) / len(given), float(key_v), name="two_draw")
    nmA, nmB = c["nm"]
    lab = {"A": c["A"], "B": c["B"]}
    key = Opt(T(float(key_v)), True, f"Add the two paths whose second draw is {lab[ev]}: the probability of that event is ${float(tot):.4f}$; the path through {lab[first_is]} first has probability ${float(joint):.4f}$, so the answer is ${float(joint):.4f}/{float(tot):.4f} \\approx {float(key_v):.3f}$.", float(key_v))
    ds = [W(T(float(d["branch"])), "Reads the branch probability for the second draw given the first, which reverses the conditional probability that is asked for.", 1, float(d["branch"])),
          W(T(float(d["joint"])), "Finds the probability that the first is " + lab[first_is] + " and the second is " + lab[ev] + " but does not divide by the probability of the given event.", 2, float(d["joint"])),
          W(T(float(d["total"])), "Reports the overall probability that the second draw is " + lab[ev] + ", which is the denominator rather than the conditional probability.", 3, float(d["total"]))]
    given_txt = c["ev"].format(w=lab[ev]) if "{w}" in c["ev"] else c["ev"]
    asked_txt = c["asked"].format(w=lab[first_is])
    stem = (c["bag"].format(a=a, b=b) + " " + c["draw"] + f" The tree diagram shows the probabilities of the first and second draws. Given that {given_txt}, what is the probability that {asked_txt}? Round to three decimal places.")
    fr = lambda q: f"{q.numerator}/{q.denominator}"
    stim = stat_stim("Probability tree for two draws without replacement", "tree", tree={"branches": [
        {"name": nmA, "label": fr(P1["A"]), "next": [{"name": nmA, "label": fr(P2[("A", "A")])}, {"name": nmB, "label": fr(P2[("A", "B")])}]},
        {"name": nmB, "label": fr(P1["B"]), "next": [{"name": nmA, "label": fr(P2[("B", "A")])}, {"name": nmB, "label": fr(P2[("B", "B")])}]}]})
    steps = ["Identify the two paths of the tree on which the second draw is the given outcome, and the one of them that starts with the first outcome asked about", "Multiply along each of those paths and add the two path probabilities to get the probability of the given event", "Divide the probability of the path asked about by the probability of the given event"]
    concepts = ["conditional probability read from a tree", "total probability with dependent draws"]
    bpr = _bp("st_two_draw_conditional", "2.6", "3.C", "Find the probability of the first draw given the second draw from a tree for draws without replacement",
              steps, [("P(first given second) = P(first and second) / P(second), with the second-draw probabilities depending on the first draw", "the tree gives the first-draw probabilities and the second-draw probabilities conditional on the first draw")],
              [("branch_instead_of_path", "reads the conditional branch probability for the reversed condition"), ("joint_without_division", "reports the joint probability of the two draws"), ("denominator_only", "reports the probability of the given event")],
              "all ordered pairs of distinguishable objects are enumerated and the conditional proportion is counted directly, independent of the tree arithmetic",
              {"type": "probability_tree", "must_include": ["first-draw probabilities", "second-draw conditional probabilities"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"], "ordered-pair enumeration")
    return spack_d("st_two_draw_conditional", "2.6", "3.C", stem, key, ds, rng, bpr, stim, 125, [f"a={a}", f"b={b}"], steps, concepts, 2, "light")


# ======================= 8. 표본비율의 정규 근사: 조건 확인 + 확률 (3.2 / 3.C) =======================
PH_CTX = [
    dict(pop="registered voters in a large city", succ="support a proposed tax", N=40000),
    dict(pop="customers of a large online retailer", succ="return at least one item", N=60000),
    dict(pop="students at a large state university", succ="live off campus", N=25000),
]


def st_phat_normal_prob(rng):
    c = pick(rng, PH_CTX)
    for _ in forever():
        p = pick(rng, [0.3, 0.35, 0.4, 0.45, 0.55, 0.6, 0.65])
        n = pick(rng, [80, 100, 120, 150, 200])
        sdp = math.sqrt(p * (1 - p) / n)
        z = rng.uniform(0.8, 2.1) * pick(rng, [-1, 1])
        cc = round(p + z * sdp, 2)
        if abs(cc - p) < 0.01:
            continue
        upper = rng.random() < 0.5
        zz = (cc - p) / sdp
        v = (1 - ncdf(zz)) if upper else ncdf(zz)
        v_alt = float(ss.norm.sf(zz)) if upper else float(ss.norm.cdf(zz))
        agree(v, v_alt, tol=1e-9, name="phat_normal")
        wrong_sd = (1 - ncdf((cc - p) / math.sqrt(p * (1 - p)))) if upper else ncdf((cc - p) / math.sqrt(p * (1 - p)))
        comp = 1 - v
        vals = [v, wrong_sd, comp]
        if n * p < 10 or n * (1 - p) < 10 or c["N"] < 10 * n:
            continue
        if min(abs(x - y) for i, x in enumerate(vals) for y in vals[i + 1:]) < 0.03 or min(vals) < 0.01 or max(vals) > 0.99 or not tie_safe(*vals):
            continue
        # 독립 경로: 정확한 이항 확률과 정규 근사가 크게 다르지 않아야 근사가 타당한 문항이다
        k = math.ceil(cc * n - 1e-9) if upper else math.floor(cc * n + 1e-9)
        ex = float(ss.binom.sf(k - 1, n, p)) if upper else float(ss.binom.cdf(k, n, p))
        if abs(ex - v) > 0.03:
            continue
        break
    sym = ">" if upper else "<"
    ok_txt = lambda val: f"The conditions are met, and the probability is approximately ${val:.3f}$"
    key = Opt(ok_txt(v), True, f"$np = {n * p:g}$ and $n(1-p) = {n * (1 - p):g}$ are both at least $10$ and the sample is less than $10\\%$ of the population, so $\\hat{{p}}$ is approximately normal with mean ${p:g}$ and standard deviation $\\sqrt{{{p:g}(1-{p:g})/{n}}} \\approx {sdp:.4f}$; $z = {zz:.2f}$ gives ${v:.3f}$.", v)
    ds = [W(ok_txt(wrong_sd), "Uses $\\sqrt{p(1-p)}$ as the standard deviation of $\\hat{p}$ without dividing by $\\sqrt{n}$.", 2, wrong_sd),
          W(ok_txt(comp), "Finds the probability in the wrong tail: the area to the " + ("right" if upper else "left") + " of the value is the one asked for.", 3, comp),
          W("The normal model is not appropriate, because the population proportion is not equal to $0.5$", "Treats a population proportion of exactly $0.5$ as a requirement; the large counts condition is that $np$ and $n(1-p)$ are both at least $10$, which holds here.", 1)]
    stem = (f"Suppose that ${int(round(p * 100))}\\%$ of the ${c['N']}$ {c['pop']} {c['succ']}. A simple random sample of ${n}$ of them is selected, and $\\hat{{p}}$ is the proportion of the sample who {c['succ']}. "
            f"Which of the following is the best statement about the conditions for a normal model for $\\hat{{p}}$ and about $P(\\hat{{p}} {sym} {cc:g})$? Round the probability to three decimal places.")
    steps = ["Check the large counts condition with the population proportion and the 10% condition for independence before using a normal model", "Compute the mean and the standard deviation of the sampling distribution of $\\hat{p}$ and standardize the stated value", "Find the area in the tail that the event describes"]
    concepts = ["conditions for the sampling distribution of a sample proportion", "normal probability calculation for a sample proportion"]
    bpr = _bp("st_phat_normal_prob", "3.2", "3.C", "Verify the conditions for a normal model for a sample proportion and find a probability about the sample proportion",
              steps, [("p-hat is approximately normal with mean p and standard deviation sqrt(p(1-p)/n) when np and n(1-p) are at least 10 and the sample is under 10 percent of the population", "the stem gives the population proportion, the sample size, the population size and the event for p-hat")],
              [("standard_deviation_without_root_n", "omits the square root of n"), ("wrong_tail", "uses the wrong tail"), ("sample_size_rule_misapplied", "rejects the normal model with a rule that does not apply")],
              "the normal probability is computed with math.erf and again with scipy; an exact binomial probability must be within 0.03 of the normal value so the approximation is sound",
              NOSTIM, ["condition_check", "calculated_value_decision"], "erf versus scipy plus exact binomial")
    return spack_d("st_phat_normal_prob", "3.2", "3.C", stem, key, ds, rng, bpr, None, 120, [f"p={p}", f"n={n}", f"c={cc}"], steps, concepts, 1, "light")


# ======================= 9. 블록 설계와 무작위 배정의 결과를 표로 판단 (1.13 / 4.B) =======================
BK_CTX = [
    dict(subj="patients", blocks=("Younger patients", "Older patients"), trts=("The new exercise program", "The standard program"), resp="reduction in blood pressure, in points", resp_s="reduction in blood pressure", base=(8, 14), gap=(20, 30), eff=(5, 8), sd=(2.5, 3.5)),
    dict(subj="students", blocks=("Class 1", "Class 2"), trts=("The new study guide", "The old study guide"), resp="score on a final exam, in points", resp_s="exam score", base=(55, 65), gap=(14, 22), eff=(5, 9), sd=(3.0, 4.0)),
    dict(subj="plots", blocks=("Field 1", "Field 2"), trts=("Fertilizer A", "Fertilizer B"), resp="crop yield, in bushels", resp_s="crop yield", base=(40, 50), gap=(14, 24), eff=(4, 8), sd=(2.5, 3.5)),
]


def st_block_table(rng):
    c = pick(rng, BK_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        nn = pick(rng, [10, 12, 15])
        b1 = gen.uniform(*c["base"])
        gap = gen.uniform(*c["gap"])
        eff = gen.uniform(*c["eff"])
        sdw = gen.uniform(*c["sd"])
        cell = {}
        for bi in (0, 1):
            for ti in (0, 1):
                mean = b1 + bi * gap + (eff if ti == 0 else 0)
                cell[(bi, ti)] = gen.normal(mean, sdw, nn)
        mus = {k: round(float(np.mean(v)), 1) for k, v in cell.items()}
        sds = {k: round(float(np.std(v, ddof=1)), 1) for k, v in cell.items()}
        # 독립 경로: statistics 모듈로 다시 계산
        import statistics as st_
        for k, v in cell.items():
            agree(st_.mean(v), np.mean(v), tol=1e-9, name="mean")
            agree(st_.stdev(v), np.std(v, ddof=1), tol=1e-9, name="sd")
        d1, d2 = mus[(0, 0)] - mus[(0, 1)], mus[(1, 0)] - mus[(1, 1)]
        G = (mus[(1, 1)] - mus[(0, 1)] + mus[(1, 0)] - mus[(0, 0)]) / 2
        if not (d1 > 2 and d2 > 2 and abs(d1 - d2) <= 2.0 and G >= 12 and max(sds.values()) <= 5.5 and abs(((d1 + d2) / 2) % 1 - 0.5) > 0.06 and abs(G % 1 - 0.5) > 0.06):
            continue
        break
    d = int(math.floor((d1 + d2) / 2 + 0.5))
    Gr = int(math.floor(G + 0.5))
    B1, B2 = c["blocks"]
    T1, T2 = c["trts"]
    rows = [[B1, T1, str(nn), f"{mus[(0, 0)]:.1f}", f"{sds[(0, 0)]:.1f}"], [B1, T2, str(nn), f"{mus[(0, 1)]:.1f}", f"{sds[(0, 1)]:.1f}"], [B2, T1, str(nn), f"{mus[(1, 0)]:.1f}", f"{sds[(1, 0)]:.1f}"], [B2, T2, str(nn), f"{mus[(1, 1)]:.1f}", f"{sds[(1, 1)]:.1f}"]]
    lo1 = lambda x: x[0].lower() + x[1:]
    key = Opt(f"The {c['resp_s']} differs by about ${Gr}$ between the blocks but by only about ${d}$ between the treatments in each block, so blocking removed the block differences while random assignment within blocks is still needed",
              True, f"Within each block the treatment means differ by ${d1:.1f}$ and ${d2:.1f}$, while the block means differ by about ${G:.1f}$ and the standard deviations are small; blocking removes the block-to-block variation, and randomizing within blocks balances the other variables.", None)
    ds = [W(f"{T1} works much better in {lo1(B2)} than in {lo1(B1)}, so the effect of the treatment depends on the block and blocking was not useful in this experiment", f"Misreads the table: the treatment means differ by about the same amount (${d1:.1f}$ and ${d2:.1f}$) in the two blocks.", 1),
          W(f"The difference of about ${Gr}$ between the blocks is an effect of the treatments, so the blocks should be ignored and all ${4 * nn}$ {c['subj']} compared as one group", "Attributes the difference between the blocks to the treatments, although every block received both treatments.", 2),
          W(f"Blocking guarantees that {T1 if T1.startswith('Fert') else lo1(T1)} caused the difference of about ${d}$, so random assignment of the treatments within the blocks was not necessary in this design", "Blocking controls only the blocking variable; random assignment within each block is still needed to balance all other variables.", 3)]
    stem = (f"An experiment compares two treatments using ${4 * nn}$ {c['subj']}. The {c['subj']} were first separated into two blocks, and within each block the treatments were assigned at random so that each treatment was given to ${nn}$ {c['subj']}. "
            f"The table summarizes the {c['resp']}. Which of the following conclusions is best supported by the table and the design?")
    stim = stat_stim("Summary of the response by block and treatment", "table", title="Summary statistics by block and treatment", columns=["Block", "Treatment", "n", "Mean", "SD"], rows=rows)
    steps = ["Compare the treatment means within each block and see that the difference is about the same in both blocks", "Compare the difference between the blocks with the differences within blocks and the standard deviations", "Connect the pattern to the purpose of blocking and to the role of random assignment within blocks"]
    concepts = ["purpose and benefit of blocking", "role of random assignment within blocks"]
    bpr = _bp("st_block_table", "1.13", "4.B", "Judge from a table of means and standard deviations by block and treatment what blocking accomplished and what random assignment is still needed for",
              steps, [("blocking separates a large block difference from the treatment comparison, and random assignment within blocks is still needed to balance other variables", "the stem describes the randomized block design and the table gives the means and standard deviations by block and treatment")],
              [("treatment_effect_misread", "reads the table as a treatment effect that depends on the block"), ("block_difference_credited_to_treatment", "credits the block difference to the treatments"), ("blocking_replaces_randomization", "believes blocking makes random assignment unnecessary")],
              "the cell means and standard deviations are recomputed from the raw simulated data with numpy and with the statistics module; the within-block differences, the block gap and the standard deviations must satisfy fixed thresholds",
              {"type": "table", "must_include": ["block", "treatment", "mean", "standard deviation"]}, ["claim_justification", "representation_reading"], "raw-data recomputation")
    return spack_d("st_block_table", "1.13", "4.B", stem, key, ds, rng, bpr, stim, 120, [f"nn={nn}", f"d={d1:.1f},{d2:.1f}", f"gap={G:.1f}"], steps, concepts, 2, "light")


# ======================= 10. 카이제곱: 독립성 vs 동질성 가설과 자유도 (3.14 / 2.E) =======================
CS_IND = [
    dict(pop="students at a large high school", v1="grade level", grp="grade levels", v2="favorite way to spend lunch", rows=["Grade 9", "Grade 10", "Grade 11", "Grade 12"], cols=["Cafeteria", "Outside", "Library"]),
    dict(pop="adult residents of a county", v1="age group", grp="age groups", v2="preferred way to read the news", rows=["18 to 34", "35 to 54", "55 or older"], cols=["Print", "Website", "Phone app", "Television"]),
]
CS_HOM = [
    dict(grp="stores", v2="payment method", rows=["Store A", "Store B", "Store C"], cols=["Cash", "Credit card", "Phone", "Gift card"], per=120, noun="customers"),
    dict(grp="schools", v2="preferred way to get to school", rows=["School 1", "School 2", "School 3", "School 4"], cols=["Bus", "Car", "Walk"], per=100, noun="students"),
]


def st_chisq_setup(rng):
    hom = rng.random() < 0.5
    if hom:
        c = pick(rng, CS_HOM)
        r_, c_ = len(c["rows"]), len(c["cols"])
        per = c["per"]
        for _ in forever():
            cells = []
            for _i in range(r_):
                pr = np.array([rng.uniform(0.15, 0.45) for _ in range(c_)])
                pr = pr / pr.sum()
                row = [int(round(per * v)) for v in pr]
                row[-1] = per - sum(row[:-1])
                cells.append(row)
            if all(v >= 6 for row in cells for v in row):
                break
    else:
        c = pick(rng, CS_IND)
        r_, c_ = len(c["rows"]), len(c["cols"])
        for _ in forever():
            cells = [[rng.randint(14, 48) for _ in range(c_)] for _ in range(r_)]
            break
    N = sum(map(sum, cells))
    # 독립 경로: scipy 의 카이제곱 분할표 검정이 보고하는 자유도와 기대 빈도로 확인
    chi2, pv, dof, exp = ss.chi2_contingency(np.array(cells))
    assert dof == (r_ - 1) * (c_ - 1) and exp.min() >= 5
    df = (r_ - 1) * (c_ - 1)
    df_bad = r_ * c_ - 1
    assert df != df_bad
    if hom:
        H_hom = f"$H_0$: the distribution of {c['v2']} is the same for all ${r_}$ {c['grp']}; $df = {df}$"
        H_ind = f"$H_0$: {c['grp'].rstrip('s')} and {c['v2']} are independent in the population of all customers; $df = {df}$".replace("customers", c["noun"])
        key = Opt(H_hom, True, f"Separate random samples were taken from each of the ${r_}$ {c['grp']}, so this is a test of homogeneity: the null hypothesis says that the distribution of the response is the same in every group; $df = ({r_}-1)({c_}-1) = {df}$.", None)
        ds = [W(H_ind, "Describes a test of independence, which is for one random sample classified on two variables; here the samples were taken separately from each group.", 1),
              W(f"$H_0$: the sample proportions of {c['v2']} are equal for all ${r_}$ {c['grp']}; $df = {df}$", "States the hypothesis about sample proportions in the table; hypotheses are about population parameters, and the sample proportions differ by chance.", 2),
              W(f"$H_0$: the distribution of {c['v2']} is the same for all ${r_}$ {c['grp']}; $df = {df_bad}$", f"Uses the number of cells minus $1$ for the degrees of freedom instead of $({r_}-1)({c_}-1)$.", 3)]
        stem = f"A researcher takes an independent random sample of ${per}$ {c['noun']} from each of ${r_}$ {c['grp']} and records the {c['v2']} of each {c['noun'].rstrip('s')} in the table shown. The researcher will carry out a chi-square test using these counts. Which of the following gives the appropriate null hypothesis and degrees of freedom?"
        hdr = c["grp"].capitalize().rstrip("s")
    else:
        v1, v2, pop = c["v1"], c["v2"], c["pop"]
        H_ind = f"$H_0$: {v1} and {v2} are independent in the population of {pop}; $df = {df}$"
        H_hom = f"$H_0$: the distribution of {v2} is the same for all ${r_}$ {c['grp']} in the population of {pop}; $df = {df}$"
        key = Opt(H_ind, True, f"One random sample of ${N}$ was classified on two categorical variables, so this is a test of independence: the null hypothesis says that the variables are independent (no association) in the population; $df = ({r_}-1)({c_}-1) = {df}$.", None)
        ds = [W(H_hom, "Describes a test of homogeneity, which is for separate samples from several populations; here one sample was classified on both variables.", 1),
              W(f"$H_0$: {v1} and {v2} are independent in the sample; $df = {df}$", "States the hypothesis about the sample rather than the population; the counts in the sample will not be exactly independent even if the variables are independent in the population.", 2),
              W(f"$H_0$: {v1} and {v2} are independent in the population of {pop}; $df = {df_bad}$", f"Uses the number of cells minus $1$ for the degrees of freedom instead of $({r_}-1)({c_}-1)$.", 3)]
        stem = f"A researcher selects one simple random sample of ${N}$ {pop.split(' at ')[0] if ' at ' in pop else pop.replace('adult ', '')} and classifies each one by {v1} and by {v2}, as shown in the table. The researcher will carry out a chi-square test using these counts. Which of the following gives the appropriate null hypothesis and degrees of freedom?"
        hdr = v1.capitalize()
    stim = stat_stim(f"Two-way table of {hdr.lower()} and {c['v2']}", "two_way", rowHeader=hdr, rowLabels=list(c["rows"]), colLabels=list(c["cols"]), cells=cells)
    steps = ["Decide from the sampling design whether the situation is one sample classified on two variables (independence) or separate samples from several groups (homogeneity)", "Choose the null hypothesis that matches the design and is stated about the population", "Find the degrees of freedom from the dimensions of the table as the number of rows minus one times the number of columns minus one"]
    concepts = ["chi-square test of independence versus homogeneity", "degrees of freedom for a two-way table"]
    bpr = _bp("st_chisq_setup", "3.14", "2.E", "Choose the null hypothesis and the degrees of freedom of a chi-square test from the sampling design and the dimensions of the table",
              steps, [("one sample classified on two variables gives a test of independence and separate samples from several groups give a test of homogeneity; the degrees of freedom are (rows - 1)(columns - 1)", "the stem states how the data were collected and the table shows the counts")],
              [("independence_homogeneity_swapped", "uses the null hypothesis of the other kind of test"), ("statistic_not_parameter", "states the hypothesis about the sample"), ("degrees_of_freedom_cells_minus_one", "uses the number of cells minus one")],
              "the degrees of freedom and the expected counts are recomputed with scipy's chi-square contingency routine, and every expected count must be at least 5",
              {"type": "two_way_table", "must_include": ["all cell counts", "row and column labels"]}, ["procedure_choice", "representation_reading"], "scipy contingency dof and expected counts")
    return spack_d("st_chisq_setup", "3.14", "2.E", stem, key, ds, rng, bpr, stim, 110, [f"hom={hom}", f"dim={r_}x{c_}"], steps, concepts, 2, "none")


STAGE_SINGLES = ["st_t_procedure_conditions", "st_ci_test_consistency", "st_sampling_dist_xbar", "st_residual_r2_model", "st_outlier_effect", "st_power_table_change", "st_two_draw_conditional", "st_phat_normal_prob", "st_block_table", "st_chisq_setup"]
STAGE_EXTRA = ["st_ci_test_consistency", "st_outlier_effect", "st_two_draw_conditional", "st_block_table", "st_t_procedure_conditions"]  # S3-b: 첫 통과율이 낮을 가능성이 큰 원형(그림·다중 판정)에 추가 후보
