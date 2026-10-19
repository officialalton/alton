"""AP Statistics S1 파일럿 — H(높은 위험) 원형 4개. 정답 판정이 해석 문장에 달려 있으므로 고정 문장 4개(정답 1 + 이름 붙은 오해 3)로 만들고, 수치는 코드가 계산해 문장에 넣는다.
문장 길이를 맞추고(길이 단서 방지) CED 표현을 따른다."""
from statistics import NormalDist
from stats_common import *


# ======================= 5. 교란변수 식별 (1.13 / 2.A) =======================
CONF = [
    dict(who="adults", exp="drink green tea every day", resp="a lower rate of heart disease", conf="Whether the person exercises regularly", cw="Exercising is more common among tea drinkers and independently lowers the risk of heart disease.",
         wrong=[("The rate of heart disease for each person", "The response variable itself is not a confounding variable."), ("The number of adults in the study", "Sample size does not vary with the explanatory or response variable."), ("The brand of cups used for the tea", "Unrelated to both variables, so it cannot create a false association.")]),
    dict(who="students", exp="use a study app", resp="higher exam scores", conf="How motivated the student is to do well", cw="Motivated students are more likely to use the app and also tend to score higher for other reasons.",
         wrong=[("The exam score of each student", "The response variable itself is not a confounding variable."), ("The number of students who were surveyed", "Sample size does not vary with the explanatory or response variable."), ("The color of the app icon", "Unrelated to both variables, so it cannot create a false association.")]),
    dict(who="cities", exp="have higher ice cream sales", resp="more drowning incidents", conf="The outdoor temperature in the city", cw="Hot weather increases both ice cream sales and the number of people swimming.",
         wrong=[("The number of drowning incidents in the city", "The response variable itself is not a confounding variable."), ("The number of ice cream shops in the city", "A restatement of the explanatory variable, not a separate variable linked to both."), ("The favorite flavor of ice cream in the city", "Unrelated to drowning incidents, so it cannot create a false association.")]),
    dict(who="people", exp="take vitamin supplements", resp="fewer sick days", conf="How health conscious the person is", cw="Health conscious people are more likely to take vitamins and also to avoid illness in other ways.",
         wrong=[("The number of sick days each person had", "The response variable itself is not a confounding variable."), ("The number of people who were interviewed", "Sample size does not vary with the explanatory or response variable."), ("The shape of the vitamin bottles", "Unrelated to both variables, so it cannot create a false association.")]),
    dict(who="employees", exp="work from home", resp="higher productivity ratings", conf="The type of job the employee has", cw="Jobs that can be done at home may differ in how productivity is rated, which affects both variables.",
         wrong=[("The productivity rating of each employee", "The response variable itself is not a confounding variable."), ("The number of employees who responded", "Sample size does not vary with the explanatory or response variable."), ("The color of the office walls", "Unrelated to both variables, so it cannot create a false association.")]),
]


def st_confounder(rng):
    c = pick(rng, CONF)
    n = pick(rng, [180, 240, 320, 400])
    key = Opt(c["conf"], True, c["cw"], None)
    ds = [Opt(t, False, w, None) for t, w in c["wrong"]]
    stem = f"In an observational study of ${n}$ {c['who']}, researchers found that those who {c['exp']} tended to have {c['resp']}. Which of the following is a possible confounding variable?"
    bpr = sbp("st_confounder", "1.13", "2.A", "Identify a confounding variable in an observational study",
              ["Recall that a confounding variable is related to both the explanatory variable and the response variable", "Reject options that are the response itself, are unrelated to both variables or are only a feature of the study"],
              [("a confounder is associated with both the explanatory and the response variables", "the stem describes an observational study with an explanatory and a response variable")],
              [("response_variable", "names the response variable"), ("sample_size", "names the sample size"), ("unrelated_variable", "names a variable unrelated to both")],
              "each scenario is written with exactly one variable linked to both variables and three named non-confounders drawn from a fixed catalog that was checked by hand for uniqueness",
              {"type": "none", "must_include": []}, ["interpretation", "claim_justification"], method="catalog of reviewed scenarios")
    return spack("st_confounder", "1.13", "2.A", stem, key, ds, rng, bpr, None, 80, [f"n={n}"])


# ======================= 11. 비율 신뢰구간 해석 (3.4 / 4.F) =======================
CIP = [("students at a large high school", "own a smartphone"), ("registered voters in a county", "support a new library"), ("customers of a grocery chain", "buy store-brand products")]


def st_ci_interpretation(rng):
    pop, event = pick(rng, CIP)
    for _ in forever():
        n = pick(rng, [120, 150, 200, 250, 300])
        x = rng.randint(int(0.3 * n), int(0.7 * n))
        ph = x / n
        zs = ss.norm.ppf(0.975)
        agree(zs, NormalDist().inv_cdf(0.975), tol=1e-6, name="zstar")
        se = math.sqrt(ph * (1 - ph) / n)
        lo, hi = ph - zs * se, ph + zs * se
        if n * ph >= 10 and n * (1 - ph) >= 10 and round(lo, 3) != round(hi, 3):
            break
    a, b = f"${lo:.3f}$", f"${hi:.3f}$"
    key = Opt(f"We are $95\\%$ confident that the proportion of all {pop} who {event} is between {a} and {b}", True, f"A confidence interval estimates the population proportion; the confidence level describes the method, and the interval is stated about the population proportion in context.", None)
    ds = [Opt(f"There is a $95\\%$ probability that the proportion of all {pop} who {event} is between {a} and {b}", False, "Treats the fixed population proportion as random: the probability statement describes the method, not this particular interval.", None),
          Opt(f"$95\\%$ of all samples of {pop} will have a sample proportion between {a} and {b}", False, "Confuses the confidence interval for the population proportion with the sampling distribution of the sample proportion.", None),
          Opt(f"We are $95\\%$ confident that the proportion of the {pop} in the sample who {event} is between {a} and {b}", False, "Describes the sample proportion, which is already known exactly, instead of the population proportion that the interval estimates.", None)]
    stem = f"A random sample of ${n}$ {pop} found that ${x}$ of them {event}. A $95\\%$ confidence interval for the proportion of all {pop} who {event} is $({lo:.3f},\\ {hi:.3f})$, and the conditions for inference are met. Which is the correct interpretation of this interval?"
    bpr = sbp("st_ci_interpretation", "3.4", "4.F", "Interpret a confidence interval for a population proportion in context",
              ["Identify the parameter the interval estimates: the proportion of the whole population, not of the sample or of future samples", "Choose the statement that describes the confidence level as confidence in the method and names the population in context"],
              [("a confidence interval is interpreted as confidence that the interval captures the population parameter", "the stem gives the sample counts and the interval and says the conditions are met")],
              [("probability_for_fixed_parameter", "assigns a probability to the fixed parameter"), ("sampling_distribution_confusion", "describes other samples"), ("sample_individuals", "describes the sample instead of the population")],
              "the interval is recomputed with the z critical value from statistics.NormalDist (independent of scipy.stats.norm) and the large counts condition is verified",
              {"type": "none", "must_include": []}, ["interpretation", "claim_justification"])
    return spack("st_ci_interpretation", "3.4", "4.F", stem, key, ds, rng, bpr, None, 100, [f"n={n}", f"x={x}"])


# ======================= 12. P값 해석 (3.6 / 4.F, 그림: 표본비율 분포 + 꼬리) =======================
PV = [("A city official claims that ${p0}$ of residents support building a new park", "residents", "support the park"),
      ("A school principal believes that ${p0}$ of students walk to school", "students", "walk to school")]


def st_pvalue_interpretation(rng):
    pre, pop, event = pick(rng, PV)
    for _ in forever():
        p0 = pick(rng, [0.3, 0.4, 0.5])
        # 외부 검수 2026-10-15 AP-067: 표시하는 표본비율은 정수 개수 / n 이어야 한다(n=200 에서 .459 는 91.8명). n 은 x/n 이 소수 셋째 자리 이내에서 딱 떨어지는 값만 쓴다.
        n = pick(rng, [200, 250, 500])
        se = math.sqrt(p0 * (1 - p0) / n)
        x = round(n * (p0 + pick(rng, [1.7, 1.9, 2.2, 2.4]) * se))
        ph = x / n
        assert abs(ph * 1000 - round(ph * 1000)) < 1e-9 and abs(ph * n - x) < 1e-9
        ph = round(ph, 3)
        z = (ph - p0) / se
        P = ss.norm.sf(z)
        agree(P, 1 - ncdf(z), tol=1e-9, name="pvalue")
        if 0.005 < P < 0.07 and round(P, 3) != round(ph, 3):
            break
    Ps, phs = f"${P:.3f}$", f"${ph}$"
    key = Opt(f"If the true proportion were ${p0}$, the probability of getting a sample proportion of {phs} or larger by chance alone is {Ps}", True, "The P-value is computed assuming the null hypothesis is true and gives the chance of a result at least as extreme as the observed sample result.", None)
    ds = [Opt(f"The probability that the true proportion is ${p0}$, given the sample proportion of {phs}, is {Ps}", False, "Interprets the P-value as the probability that the null hypothesis is true, but it is computed assuming the null hypothesis is true.", None),
          Opt(f"The probability that the true proportion is greater than ${p0}$, given the sample proportion of {phs}, is {Ps}", False, "Interprets the P-value as the probability that the alternative hypothesis is true, which a significance test does not give.", None),
          Opt(f"If the true proportion were ${p0}$, the probability of getting a sample proportion of exactly {phs} by chance alone is {Ps}", False, "Uses exactly the observed value instead of the observed value or something more extreme in the direction of the alternative.", None)]
    stem = f"{pre.format(p0=p0)}. In a random sample of ${n}$ {pop}, the sample proportion who {event} is ${ph}$. A test of $H_0: p = {p0}$ versus $H_a: p > {p0}$ gives a P-value of ${P:.3f}$. The curve shown models the sampling distribution of the sample proportion when $H_0$ is true, and the shaded area is the P-value. Which is a correct interpretation of the P-value?"
    sd = se
    ticks = [round(p0 + k * sd, 4) for k in (-3, -2, -1, 0, 1, 2, 3)]
    stim = stat_stim("Sampling distribution of the sample proportion when H0 is true with the upper tail shaded", "curve",
                     **normal_curve(p0, sd, ticks, "Sample proportion", shades=[{"from": round(ph, 4), "to": round(p0 + 4 * sd, 4)}], marks=[{"at": round(ph, 4), "label": f"{ph}"}]))
    bpr = sbp("st_pvalue_interpretation", "3.6", "4.F", "Interpret a P-value in the context of a test for a proportion",
              ["Recall that the P-value is computed assuming the null hypothesis is true", "Choose the statement that gives the probability of a result at least as extreme as the observed one under that assumption, not the probability of a hypothesis"],
              [("the P-value is the probability, assuming the null hypothesis is true, of a sample result at least as extreme as the one observed", "the stem gives the hypotheses, the sample proportion and the P-value, and the figure shades the upper tail")],
              [("probability_null_true", "reads the P-value as the probability that H0 is true"), ("probability_alternative_true", "reads it as the probability that Ha is true"), ("exact_value", "uses exactly the observed value instead of at least as extreme")],
              "the upper-tail area is computed from math.erf and the shaded region and marked value are generated from the same sample proportion and standard error as the P-value",
              {"type": "normal_curve", "must_include": ["shaded tail", "observed value"]}, ["interpretation", "claim_justification"])
    return spack("st_pvalue_interpretation", "3.6", "4.F", stem, key, ds, rng, bpr, stim, 110, [f"p0={p0}", f"ph={ph}", f"P={P:.4f}"])


# ======================= 18. 회귀 기울기 해석 (5.5 / 4.D, 그림: O) =======================
SLOPE_CTX = [("age of a used car (years)", "price (thousands of dollars)", "year", "thousand dollars", "the age of the car", "the price of the car", "Age", "Price", -1.9, 24.8, (1, 10)),
             ("study time (hours)", "exam score (points)", "hour", "point", "the study time", "the exam score", "Hours", "Score", 4.2, 48.0, (1, 9)),
             ("outdoor temperature (degrees Celsius)", "hot drinks sold (cups)", "degree Celsius", "cup", "the temperature", "the number of hot drinks sold", "Temp", "Drinks", -3.4, 95.0, (2, 25))]


def st_slope_interp(rng):
    xd, yd, xu, yu, xw, yw, xn, yn, b0, a0, (xlo, xhi) = pick(rng, SLOPE_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        n = rng.randint(10, 14)
        x = np.sort(np.round(gen.uniform(xlo, xhi, n), 1))
        y = np.round(a0 + b0 * x + gen.normal(0, abs(b0) * 1.1, n), 1)
        b, a = np.polyfit(x, y, 1)
        # 독립 경로: 합으로 계산한 닫힌 형식
        mx, my = x.mean(), y.mean()
        b_cf = ((x - mx) * (y - my)).sum() / ((x - mx) ** 2).sum()
        agree(b, b_cf, tol=1e-9, name="slope")
        r2 = np.corrcoef(x, y)[0, 1] ** 2
        if abs(round(b, 3)) >= 0.5 and r2 > 0.6 and abs(round(a, 3)) != abs(round(b, 3)):
            break
    up = b > 0
    bs, a_s = f"${abs(b):.3f}$", f"${a:.3f}$"
    key = Opt(f"For each additional {xu}, the predicted {yw.replace('the ', '')} {'increases' if up else 'decreases'} by about {bs} {yu}s", True, f"The slope $b={b:.3f}$ is the predicted change in the response for each one-unit increase in the explanatory variable.", None)
    ds = [Opt(f"For each additional {xu}, the {yw.replace('the ', '')} {'increases' if up else 'decreases'} by exactly {bs} {yu}s", False, "Treats a prediction from a fitted line as an exact change instead of a predicted change on average.", None),
          Opt(f"For each additional {yu}, the predicted {xw.replace('the ', '')} {'increases' if up else 'decreases'} by about {bs} {xu}s", False, "Reverses the roles of the explanatory and response variables.", None),
          Opt(f"When the {xw.replace('the ', '')} is $0$, the predicted {yw.replace('the ', '')} is about {('$-' + f'{abs(b):.3f}' + '$') if not up else bs} {yu}s", False, "Confuses the slope with the intercept: the predicted value at zero is the intercept.", None)]
    stem = f"A least-squares regression of {yd} on {xd} for ${n}$ observations gives the computer output shown. Which is the best interpretation of the slope of the regression line?"
    stim = stat_stim("Computer output for a least-squares regression", "output", output={
        "title": f"Regression Analysis: {yn} versus {xn}",
        "sections": [{"columns": ["Predictor", "Coef"], "rows": [["Constant", round(float(a), 3)], [xn, round(float(b), 3)]]}, {"columns": ["Summary", "Value"], "rows": [["R-Sq", f"{r2 * 100:.1f}%"], ["N", n]]}]})
    bpr = sbp("st_slope_interp", "5.5", "4.D", "Interpret the slope of a least-squares line in context from computer output",
              ["Read the slope from the coefficient in the row of the explanatory variable, not from the constant row", "Interpret it as the predicted change in the response for each one-unit increase in the explanatory variable"],
              [("the slope is the predicted change in y for each one-unit increase in x", "the output lists the constant and the slope coefficient with the variable names and units")],
              [("exact_change", "treats the prediction as exact"), ("roles_reversed", "reverses x and y"), ("slope_as_intercept", "confuses the slope with the intercept")],
              "the least-squares slope is recomputed from the closed-form sums of deviations and compared with numpy polyfit; the coefficient shown in the output is the rounded fitted value",
              {"type": "computer_output", "must_include": ["constant", "slope", "variable names"]}, ["interpretation", "representation_reading"])
    return spack("st_slope_interp", "5.5", "4.D", stem, key, ds, rng, bpr, stim, 100, [f"b={b:.3f}", f"a={a:.3f}", f"r2={r2:.3f}"])


STAGE_H = ["st_confounder", "st_ci_interpretation", "st_pvalue_interpretation", "st_slope_interp"]
