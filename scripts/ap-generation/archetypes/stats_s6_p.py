"""AP Statistics 연습 시험 5(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 1·2. 기존 공개 세트와 연습 시험 3·4 의 풀이 틀을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(분수·전수 열거·math.erf)로 다시 계산한다. 해석·설계 문항은 고정 문장 4개(정답 1 + 이름 붙은 오해 3). 모든 수·통계량은 $...$ 안(표 칸은 일반 글자)."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


def W(rows):
    return [(t, w, m, None, s) for t, w, m, s in rows]


# ======================= 1. 주장을 조사 질문으로 (1.10 / 1.A) =======================
CQ_CTX = [dict(claim="A teacher claims that students who take notes by hand remember more of a lecture than students who type their notes.", key="Do students who take notes by hand tend to score higher on a test of the lecture than students who type their notes?", w=["Why do most students who take notes by hand say that they like the lecture better than students who type?", "Did the teacher's own notes by hand help the students in her class on last week's short quiz?", "Are handwritten notes a better way of taking notes than typed notes are for students in general?"]),
          dict(claim="A coach claims that athletes who stretch before practice have fewer injuries than athletes who do not stretch.", key="Do athletes who stretch before practice tend to have fewer injuries in a season than athletes who do not stretch?", w=["Why do so many athletes on the team say that they dislike stretching before every practice?", "Did the captain of the team stretch for ten minutes before the last practice of the season?", "Is stretching before practice a smarter habit for an athlete than simply resting before practice?"]),
          dict(claim="A manager claims that employees who work from home are more productive than employees who work in the office.", key="Do employees who work from home tend to complete more tasks per week than employees who work in the office?", w=["Why do so many employees of the company say that they like working from home on most days?", "Did the manager's assistant finish more tasks at home last Friday than in the office on Monday?", "Is working from home a better lifestyle for an employee than working in the office all week?"])]


def st_n5_claim_to_question(rng):
    c = pick(rng, CQ_CTX)
    key = (c["key"], "It restates the claim as a question about two groups in a population with a measured variable that varies among individuals, so it can be answered by collecting and analyzing data.")
    wr = W([(c["w"][0], "It asks about a reason or an attitude rather than about a measured variable that can be compared between the groups.", "reason_question", 1), (c["w"][1], "It asks about one individual, so there is no population and no variability to study.", "single_individual", 1), (c["w"][2], "It asks for a judgment of value that data cannot settle.", "judgment", 2)])
    stem = f"{c['claim']} Which of the following is a valid investigative question that restates the claim so that it can be investigated with data?"
    return mc("st_n5_claim_to_question", "1.10", "1.A", "Restate a claim as a valid investigative question", ["Identify the groups and the variable that the claim compares", "Choose the question that compares the measured variable between the groups for a population and reject questions about reasons, one individual or a judgment"],
              key, wr, rng, stem, "each claim is paired with one question about a measured comparison and three questions that fail by asking about reasons, an individual or a judgment", ["claim_justification", "interpretation"], est=70)


# ======================= 2. 모집단이 분명한 질문 (1.1 / 1.A) =======================
PD_CTX = [dict(var="the number of hours of sleep that students get on a school night", good="What is the typical number of hours of sleep that students at Lincoln High School get on a school night?", vague=("What is the typical number of hours of sleep that people get?", "The population is not specified: people of all ages and places are not one population that a single investigation can describe."), indiv="How many hours of sleep did the student sitting in the first row get last night?", look="How many hours of sleep does the national guideline recommend for a teenager?"),
          dict(var="the weekly amount that households spend on groceries", good="What is the typical weekly amount that households in the town of Maple Grove spend on groceries?", vague=("What is the typical weekly amount that anyone spends on groceries?", "The population is not specified: everyone in every place is not one population that a single investigation can describe."), indiv="How much did the Garcia household spend on groceries last week?", look="How much does the price of a gallon of milk cost at the corner store today?"),
          dict(var="the number of minutes that commuters spend traveling to work", good="What is the typical number of minutes that commuters in the city of Riverton spend traveling to work?", vague=("What is the typical number of minutes that workers spend on travel?", "The population is not specified: workers everywhere traveling in any way are not one population that a single investigation can describe."), indiv="How many minutes did the commuter who sat next to the researcher spend traveling today?", look="How many minutes does the posted train schedule list for the trip from Riverton to the capital?")]


def st_n5_population_defined(rng):
    c = pick(rng, PD_CTX)
    key = (c["good"], f"It names a specific population and one measured variable ({c['var']}) that varies among its individuals, so it can be answered by collecting and analyzing data.")
    wr = W([(c["vague"][0], c["vague"][1], "population_not_defined", 1), (c["indiv"], "It asks about one individual, so there is no population and no variability to study.", "single_individual", 1), (c["look"], "It has a single factual answer that can be looked up, so no variability among individuals is anticipated.", "lookup", 1)])
    stem = f"A researcher wants to study {c['var']}. Which of the following is the best investigative question for the study?"
    return mc("st_n5_population_defined", "1.1", "1.A", "Choose the investigative question that names a specific population", ["Check that each question names a specific population and a measured variable", "Reject questions with no defined population, about one individual or with a lookup answer"],
              key, wr, rng, stem, "each context pairs one question with a defined population against a vague-population question, an individual question and a lookup question", ["claim_justification", "interpretation"], est=65)


# ======================= 3. 양적 변수가 필요한 질문 (1.2 / 1.A) =======================
VT_CTX = [dict(pop="students at a college", q_quant="How much time do students at the college spend studying in a week?", q_cat=("Do students at the college live on campus?", "yes or no"), q2="Which major do students at the college choose?", q3="Are students at the college enrolled full time or part time?", var="the number of hours spent studying"),
          dict(pop="drivers in a city", q_quant="How many kilometers do drivers in the city drive in a week?", q_cat=("Do drivers in the city own an electric car?", "yes or no"), q2="Which brand of car do drivers in the city own?", q3="Do drivers in the city park in a garage or on the street?", var="the number of kilometers driven"),
          dict(pop="patients at a clinic", q_quant="How long do patients at the clinic wait before seeing a doctor?", q_cat=("Do patients at the clinic have health insurance?", "yes or no"), q2="Which language do patients at the clinic prefer to speak?", q3="Do patients at the clinic arrive by car or on foot?", var="the number of minutes waited")]


def st_n5_quantitative_question(rng):
    c = pick(rng, VT_CTX)
    key = (c["q_quant"], f"Its answer is based on {c['var']}, a quantitative variable that takes numerical values, so the data can be summarized by a typical value and a spread.")
    wr = W([(c["q_cat"][0], f"Its answer is based on a categorical variable with the responses {c['q_cat'][1]}, which is summarized by proportions.", "categorical_yes_no", 1), (c["q2"], "Its answer is based on a categorical variable with several named categories, which is summarized by proportions.", "categorical_names", 1), (c["q3"], "Its answer is based on a categorical variable with two named categories, which is summarized by proportions.", "categorical_two", 1)])
    stem = f"A researcher plans to collect data from a random sample of the {c['pop']}. For which of the following investigative questions would the researcher need to record a quantitative variable?"
    return mc("st_n5_quantitative_question", "1.2", "1.A", "Recognize the investigative question that needs a quantitative variable", ["Identify the variable whose values would be recorded for each individual", "Choose the question whose variable takes numerical values and reject questions answered with categories"],
              key, wr, rng, stem, "each context pairs one question about a numerical measurement with three questions answered with categories", ["interpretation", "claim_justification"], est=65)


# ======================= 4. 상대도수표의 최빈 범주와 합 (1.3 / 4.A, 표) =======================
RF_CTX = [dict(what="favorite type of pet among students", cats=("Dog", "Cat", "Fish", "Bird", "Other"), unit="students"), dict(what="main way that employees travel to work", cats=("Car", "Bus", "Bike", "Walk", "Other"), unit="employees"), dict(what="favorite season among visitors to a park", cats=("Summer", "Spring", "Fall", "Winter"), unit="visitors")]


def st_n5_rel_freq_table(rng):
    c = pick(rng, RF_CTX)
    k = len(c["cats"])
    for _ in forever():
        raw = [rng.randint(6, 36) for _ in range(k)]; tot = sum(raw); pct = [round(100 * v / tot) for v in raw]; pct[-1] = 100 - sum(pct[:-1])
        order = sorted(range(k), key=lambda i: -pct[i])
        if len(set(pct)) == k and min(pct) >= 4 and pct[order[0]] - pct[order[1]] >= 3 and pct[order[1]] != pct[order[2]]:
            break
    top, sec = order[0], order[1]
    comb = pct[top] + pct[sec]
    stim = stat_stim(f"Relative frequencies of the {c['what']}", "table", title="Relative frequency table", columns=["Category", "Percent of the " + c["unit"]], rows=[[cat, f"{p}%"] for cat, p in zip(c["cats"], pct)])
    key = (f"The most common category is {c['cats'][top].lower()}, and the two most common categories together make up ${comb}\\%$ of the {c['unit']}.", f"{c['cats'][top]} has the largest percent (${pct[top]}\\%$) and the two largest percents, ${pct[top]}\\%$ and ${pct[sec]}\\%$, add up to ${comb}\\%$.")
    third = order[2]
    wr = W([(f"The most common category is {c['cats'][sec].lower()}, and the two most common categories together make up ${comb}\\%$ of the {c['unit']}.", "Names the category with the second largest percent as the most common category.", "wrong_mode", 1), (f"The most common category is {c['cats'][top].lower()}, and the two most common categories together make up ${pct[top] + pct[third]}\\%$ of the {c['unit']}.", "Adds the largest percent to the third largest instead of the second largest.", "wrong_pair", 2),
            (f"The most common category is {c['cats'][top].lower()}, and the two most common categories together make up ${100 - comb}\\%$ of the {c['unit']}.", "Gives the percent of the remaining categories instead of the two most common categories.", "complement_given", 2)])
    stem = f"The relative frequency table shown gives the {c['what']} in a survey. Which of the following statements is supported by the table?"
    return mc("st_n5_rel_freq_table", "1.3", "4.A", "Use a relative frequency table to name the most common category and combine percents", ["Find the category with the largest percent", "Add the percents of the two largest categories and reject the sum of other pairs or the percent of the rest"],
              key, wr, rng, stem, "the percents sum to 100 and the three wrong statements are the named slips", ["representation_reading", "claim_justification"], stim, est=75, facts=[f"pct={pct}"])


# ======================= 5. 도수표에서 평균 (1.7 / 3.B, 표) =======================
FT_CTX = [dict(what="the number of books that each of 20 students read in a month", unit="books", xs=(0, 1, 2, 3, 4)), dict(what="the number of siblings of each of 25 students", unit="siblings", xs=(0, 1, 2, 3, 4)), dict(what="the number of goals that a team scored in each of 20 games", unit="goals", xs=(0, 1, 2, 3, 4))]


def st_n5_freq_table_mean(rng):
    c = pick(rng, FT_CTX)
    for _ in forever():
        fr = [rng.randint(1, 8) for _ in range(5)]; n = sum(fr)
        mean = sum(x * f for x, f in zip(c["xs"], fr)) / n
        unw = sum(c["xs"]) / 5; med_i = sorted([x for x, f in zip(c["xs"], fr) for _ in range(f)]); med = float(np.median(med_i)); mode = c["xs"][int(np.argmax(fr))]
        vals = [mean, unw, med, float(mode)]
        if n in (15, 20, 25, 30) and gaps_ok([round(v, 2) for v in vals], 0.1) and round(mean, 2) not in (round(med, 2),):
            break
    agree(float(np.mean(med_i)), mean, tol=1e-9, name="mean")
    stim = stat_stim(f"Frequency table of {c['what']}", "table", title="Frequency table", columns=[cap(c["unit"]), "Frequency"], rows=[[str(x), str(f)] for x, f in zip(c["xs"], fr)])
    fm = lambda v: f"${v:.2f}$ {c['unit']}"
    key = (fm(mean), f"The mean is the sum of each value times its frequency divided by the total frequency ${n}$: ${mean:.2f}$.", round(mean, 2))
    wr = [(fm(unw), "Averages the listed values without weighting them by the frequencies.", "unweighted_mean", round(unw, 2), 1), (fm(med), "Reports the median of the data instead of the mean.", "median_not_mean", round(med, 2), 2), (fm(float(mode)), "Reports the most frequent value, which is the mode, instead of the mean.", "mode_not_mean", round(float(mode), 2), 1)]
    stem = f"The frequency table shown gives {c['what']}. What is the mean of the data? (Round to two decimal places.)"
    return mc("st_n5_freq_table_mean", "1.7", "3.B", "Find the mean of the data in a frequency table", ["Multiply each value by its frequency and add the products", "Divide by the total frequency and reject the unweighted average, the median and the mode"],
              key, wr, rng, stem, "the mean is recomputed from the expanded list of individual values", ["procedure_choice", "calculated_value_decision", "representation_reading"], stim, est=90, facts=[f"fr={fr}"])


# ======================= 6. 평균과 중앙값으로 분포의 모양 (1.6 / 4.C) =======================
SH_CTX = [dict(w="the prices of homes in a town, in thousands of dollars", u="thousand dollars", m=(250, 320), d=(25, 60)), dict(w="the scores on an easy quiz, in points", u="points", m=(70, 85), d=(3, 9)), dict(w="the lengths of phone calls, in minutes", u="minutes", m=(6, 12), d=(1.5, 4))]


def st_n5_shape_from_stats(rng):
    c = pick(rng, SH_CTX)
    right = pick(rng, [True, False])
    base = rng.randint(*[int(x) for x in c["m"]]); d = round(rng.uniform(*c["d"]), 1)
    med, mean = (base, round(base + d, 1)) if right else (base, round(base - d, 1))
    key = (("The distribution is skewed to the right, because the mean is greater than the median." if right else "The distribution is skewed to the left, because the mean is less than the median."), "A long tail on one side pulls the mean toward that side, so the mean is on the side of the tail relative to the median.")
    wr = W([(("The distribution is skewed to the left, because the mean is greater than the median." if right else "The distribution is skewed to the right, because the mean is less than the median."), "Reverses the direction of the skew; the mean is pulled toward the long tail, not away from it.", "direction_reversed", 1), ("The distribution is symmetric, because the mean and the median are both measures of center.", "A symmetric distribution has a mean about equal to its median; here they differ.", "always_symmetric", 1),
            ("The distribution is bimodal, because the mean and the median are different.", "The mean and the median of a distribution with one peak can differ when it is skewed; the number of peaks is not decided by these two values.", "bimodal_from_difference", 2)])
    stem = f"For a large sample of {c['w']}, the mean is ${mean:g}$ and the median is ${med:g}$. Which of the following is the most likely description of the distribution?"
    return mc("st_n5_shape_from_stats", "1.6", "4.C", "Infer the direction of skew from the mean and the median", ["Compare the mean with the median", "Conclude that the mean is pulled toward the long tail and reject reversed, symmetric and bimodal descriptions"],
              key, wr, rng, stem, "each statement is checked against the rule that the mean lies on the side of the tail relative to the median", ["interpretation", "claim_justification"], est=70, facts=[f"right={right}"])


# ======================= 7. 간격이 있는 히스토그램 해석 (1.5 / 4.A, 히스토그램) =======================
GP_CTX = [dict(what="the number of minutes that customers waited at a store", unit="minutes"), dict(what="the number of pages in the books of a library", unit="pages"), dict(what="the ages of the visitors to a museum", unit="years")]


def st_n5_hist_gap(rng):
    c = pick(rng, GP_CTX)
    w = rng.choice([5, 10, 20]); lo0 = rng.choice([0, w])
    counts = [14, 22, 18, 0, 0, 3, 2, 1][:8]
    counts = [max(0, v + (rng.randint(-1, 1) if v > 0 else 0)) for v in counts]
    bins = [{"from": lo0 + w * i, "to": lo0 + w * (i + 1), "count": v} for i, v in enumerate(counts)]
    gap_from, gap_to = lo0 + 3 * w, lo0 + 5 * w; total = sum(counts); big = sum(counts[:3]); pct = round(100 * big / total)
    stim = stat_stim(f"Histogram of {c['what']}", "histogram", title=f"Frequency histogram ({c['unit']})", xTitle=cap(c["unit"]), yTitle="Frequency", bins=bins)
    key = (f"There is a gap between ${gap_from}$ and ${gap_to}$ {c['unit']}, and most of the observations (about ${pct}\\%$) are below ${gap_from}$ {c['unit']}.", "The bars from the fourth and fifth class have zero height, which is the gap, and the first three classes contain most of the observations.")
    wr = W([(f"There is no gap, because every value between ${lo0}$ and ${lo0 + 8 * w}$ {c['unit']} must have been observed.", "The classes with no bar have a frequency of zero, which shows that no observation fell in them.", "no_gap", 1), (f"There is a gap between ${gap_from}$ and ${gap_to}$ {c['unit']}, and most of the observations are above ${gap_to}$ {c['unit']}.", "The bars to the right of the gap are short; most of the observations are to the left of the gap.", "wrong_side", 2),
            (f"The distribution is symmetric about ${gap_from}$ {c['unit']}, because the gap is in the middle of the horizontal axis.", "The bars on the left are much taller than the bars on the right, so the distribution is not symmetric.", "symmetric_from_gap", 1)])
    stem = f"The histogram shown displays {c['what']} for a random sample of ${total}$ observations. Which of the following statements about the distribution is supported by the histogram?"
    return mc("st_n5_hist_gap", "1.5", "4.A", "Describe a gap and the location of most observations in a histogram", ["Read the heights of the bars and locate the classes with no bar", "State where the gap is and on which side most of the observations lie"],
              key, wr, rng, stem, "the generated counts have exactly two empty classes and a heavy left cluster, so the gap and the side with most observations are unambiguous", ["representation_reading", "claim_justification"], stim, est=80, facts=[f"counts={counts}"])


# ======================= 8. 표집틀에서 빠지는 집단 (1.12 / 2.B) =======================
UC_CTX = [dict(goal="the proportion of adults in a city who use public transit", frame="the list of registered car owners in the city", miss="adults who do not own a car", dirn="too small"), dict(goal="the proportion of residents in a county who have a landline telephone", frame="a list of residents who have a mobile telephone plan", miss="residents who have no mobile plan", dirn="too small"),
          dict(goal="the mean number of books that students at a college read per year", frame="the list of students who are members of the college library", miss="students who are not library members", dirn="too large")]


def st_n5_undercoverage(rng):
    c = pick(rng, UC_CTX)
    key = (f"The {c['miss']} have no chance of being selected, so the sample undercovers the population and the estimates will tend to be {c['dirn']}.", "A sampling frame that leaves out part of the population cannot give those individuals a chance of selection, which biases the estimate in the direction of the included group.")
    wr = W([(f"The {c['miss']} are selected more often than the others, so the estimates will tend to be {'too large' if c['dirn'] == 'too small' else 'too small'}.", "The excluded individuals are never selected, so they cannot be selected more often.", "excluded_over_selected", 1), (f"There is no problem with the frame, because every individual on the list has the same chance of being selected.", "Equal chances within the list do not make up for the individuals who are not on the list.", "equal_chance_within_list", 1),
            (f"The problem is that the sample is too small, and a larger sample from the same list would remove the bias.", "A larger sample from the same list still leaves out the same individuals, so the bias remains.", "bigger_sample_fixes", 2)])
    stem = f"A researcher wants to estimate {c['goal']}. A simple random sample is selected from {c['frame']}. Which of the following statements about this plan is correct?"
    return mc("st_n5_undercoverage", "1.12", "2.B", "Identify the group that a sampling frame leaves out and the direction of the bias", ["Compare the sampling frame with the population that the researcher wants to describe", "Name the group with no chance of selection and the direction of the resulting bias, rejecting claims that equal chances or a larger sample remove it"],
              key, wr, rng, stem, "each frame excludes one stated group, so the undercoverage and the direction of the bias follow from the frame", ["claim_justification", "interpretation"], est=80)


# ======================= 9. 층화 임의 추출을 쓰는 이유 (1.11 / 2.B) =======================
ST_CTX = [dict(pop="a school with $900$ freshmen and $300$ seniors", goal="the mean number of hours of homework per week for each grade", unit="students"), dict(pop="a county with $8000$ urban households and $2000$ rural households", goal="the mean monthly water use for each type of area", unit="households"), dict(pop="a company with $700$ office workers and $200$ factory workers", goal="the mean job satisfaction score for each type of job", unit="employees")]


def st_n5_why_stratify(rng):
    c = pick(rng, ST_CTX)
    key = ("Stratified random sampling guarantees that each group is represented by enough individuals, so the researcher can estimate the quantity for each group as well as for the whole.", "Selecting a random sample within each group guarantees a sample size for every group, including the smaller one, which a single simple random sample cannot.")
    wr = W([("Stratified random sampling removes the need to use chance, because the groups are chosen by the researcher.", "Chance is still used to select individuals within each group; the groups are only the strata.", "no_chance_needed", 1), ("Stratified random sampling makes the sample unbiased even if only volunteers from each group take part.", "Volunteers within a group are a voluntary response sample, which is biased whatever the strata are.", "volunteers_ok", 1), ("Stratified random sampling makes the sample size larger than a simple random sample of the same total size would be.", "The total sample size is fixed by the researcher; stratifying only decides how the individuals are allocated to the groups.", "larger_total", 2)])
    stem = f"A researcher studies {c['pop']} and wants to estimate {c['goal']}. The researcher chooses a stratified random sample of {c['unit']}, with the two groups as strata. Which of the following is the main advantage of this design for the goal of the study?"
    return mc("st_n5_why_stratify", "1.11", "2.B", "State the advantage of stratified random sampling when estimates are needed for each group", ["Recognize that the researcher needs an estimate for every group, including the smaller one", "Choose the advantage of guaranteed representation of each group and reject claims that remove chance, allow volunteers or enlarge the sample"],
              key, wr, rng, stem, "each context pairs the guaranteed representation of each group with three misconceptions about chance, volunteers and sample size", ["claim_justification", "interpretation"], est=80)


# ======================= 10. 대조군의 목적 (1.13 / 2.A) =======================
CG_CTX = [dict(trt="a new fertilizer", ctrl="plants that receive no fertilizer", resp="plant height", u="plants"), dict(trt="a new study app", ctrl="students who use no app", resp="test score", u="students"), dict(trt="a new training routine", ctrl="athletes who continue the old routine", resp="sprint time", u="athletes")]


def st_n5_control_group(rng):
    c = pick(rng, CG_CTX)
    key = (f"The control group shows what happens to {c['resp']} without the new treatment, so a difference between the groups can be attributed to the treatment.", "A comparison group that differs from the treatment group only by the treatment, with the other conditions the same, is what allows the difference to be attributed to the treatment.")
    wr = W([(f"The control group makes the {c['u']} in the experiment representative of all {c['u']}.", "Representing a population depends on how the individuals are selected, not on having a control group.", "control_for_representation", 1), (f"The control group makes it unnecessary to assign the {c['u']} to the groups at random.", "A control group does not replace random assignment; both are needed to compare the treatments fairly.", "control_replaces_random", 1), (f"The control group guarantees that no other variable affects {c['resp']}.", "A control group does not guarantee that no other variable has an effect; random assignment tends to balance other variables between the groups.", "control_removes_other_variables", 2)])
    stem = f"In an experiment to study {c['trt']}, the researcher also includes a group of {c['ctrl']}. Which of the following is the main reason for including this control group?"
    return mc("st_n5_control_group", "1.13", "2.A", "State the purpose of a control group in an experiment", ["Identify what the control group lacks compared with the treatment group", "Choose the purpose of showing what happens without the treatment and reject claims about representation, random assignment or removing all other variables"],
              key, wr, rng, stem, "each context pairs the purpose of a control group with three claims that belong to other design features", ["claim_justification", "interpretation"], est=75)


# ======================= 11. 확률변수의 일차 변환 (2.9 / 3.D) =======================
RV_CTX = [dict(who="A delivery company charges a flat fee plus a rate for each package", X="the number of packages in an order", fee=12, rate=3, unit="dollars"), dict(who="A tutor charges a booking fee plus an hourly rate", X="the number of hours of a tutoring session", fee=10, rate=25, unit="dollars"), dict(who="A phone plan has a monthly fee plus a charge for each gigabyte used", X="the number of gigabytes used in a month", fee=15, rate=4, unit="dollars")]


def st_n5_rv_linear(rng):
    c = pick(rng, RV_CTX)
    for _ in forever():
        mu = rng.choice([2.5, 3.0, 3.5, 4.0, 5.0]); sd = rng.choice([0.6, 0.8, 1.0, 1.2, 1.5])
        a, b = c["rate"], c["fee"]
        m1, s1 = a * mu + b, a * sd
        wrong = [(a * mu, a * sd), (a * mu + b, a * sd + b), (mu + b, sd)]
        if len({(round(m1, 2), round(s1, 2))} | {(round(x, 2), round(y, 2)) for x, y in wrong}) == 4:
            break
    xs = [mu - sd, mu + sd]; ys = [a * x + b for x in xs]; agree((ys[0] + ys[1]) / 2, m1, name="mean"); agree(abs(ys[1] - ys[0]) / 2, s1, name="sd")
    fm = lambda m_, s_: f"mean ${m_:g}$ {c['unit']}, standard deviation ${s_:g}$ {c['unit']}"
    key = (fm(m1, s1), f"For $Y = {a}X + {b}$ the mean is ${a}({mu:g}) + {b} = {m1:g}$ and the standard deviation is ${a}({sd:g}) = {s1:g}$, because adding the fee does not change the spread.")
    wr = [(fm(*wrong[0]), "Forgets the flat fee in the mean.", "fee_ignored", None, 1), (fm(*wrong[1]), "Adds the flat fee to the standard deviation, but adding a constant does not change the spread.", "fee_changes_spread", None, 2), (fm(*wrong[2]), "Does not multiply by the rate: the mean and standard deviation of the cost use the rate as a factor of $X$.", "rate_ignored", None, 1)]
    stem = f"{c['who']}. Let $X$ be {c['X']}, with mean ${mu:g}$ and standard deviation ${sd:g}$. The cost is $Y = {a}X + {b}$ {c['unit']}. Which of the following gives the mean and the standard deviation of $Y$?"
    return mc("st_n5_rv_linear", "2.9", "3.D", "Find the mean and the standard deviation of a linear function of a random variable", ["Apply the multiplication and the addition to the mean", "Apply only the multiplication to the standard deviation"],
              key, wr, rng, stem, "the mean and standard deviation of Y are recomputed from two values of X placed one standard deviation from the mean", ["procedure_choice", "calculated_value_decision", "interpretation"], est=85, facts=[f"mu={mu}", f"sd={sd}"],
              sig=(["mean of a linear function", "standard deviation of a linear function"], 1, "light"))


# ======================= 12. 독립 사건의 곱과 합 (2.7 / 3.C) =======================
IP_CTX = [dict(a="A student passes the driving test", b="the student passes the written test", pa=(0.6, 0.9), pb=(0.5, 0.9), ctx="Each of two tests is taken independently."), dict(a="A bus arrives on time at the first stop", b="it arrives on time at the second stop", pa=(0.7, 0.9), pb=(0.6, 0.9), ctx="The two stops are independent."), dict(a="A seed of type A sprouts", b="a seed of type B sprouts", pa=(0.6, 0.9), pb=(0.5, 0.8), ctx="The two seeds are planted independently.")]


def st_n5_independent_or(rng):
    c = pick(rng, IP_CTX)
    for _ in forever():
        pa = rng.randint(int(c["pa"][0] * 100), int(c["pa"][1] * 100)) / 100; pb = rng.randint(int(c["pb"][0] * 100), int(c["pb"][1] * 100)) / 100
        both = pa * pb; either = pa + pb - both; vals = [either, both, pa + pb if pa + pb < 1 else 0.999, 1 - both]
        if pa + pb > 1.0 and gaps_ok([round(either, 3), round(both, 3), round(1 - both, 3)], 0.04):
            break
    agree(either, 1 - (1 - pa) * (1 - pb), name="either")
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(either), f"With independent events $P(A \\text{{ and }} B) = {pa}({pb}) = {both:.4f}$, so $P(A \\text{{ or }} B) = {pa} + {pb} - {both:.4f} = {either:.3f}$.", round(either, 3))
    wr = [(f3(both), "Gives the probability that both events happen instead of at least one.", "both_not_either", round(both, 3), 1), (f3(1 - both), "Gives the probability that the two events do not both happen, which is not the same as at least one happening.", "not_both", round(1 - both, 3), 2), (f3(pa * pb * 0 + (pa + pb) / 2), "Averages the two probabilities, which is not a rule for combining events.", "averaged", round((pa + pb) / 2, 3), 1)]
    stem = f"{c['a']} with probability ${pa}$, and {c['b']} with probability ${pb}$. {c['ctx']} What is the probability that at least one of the two events occurs? (Give the answer as a decimal rounded to three decimal places.)"
    if len({round(either, 3), round(both, 3), round(1 - both, 3), round((pa + pb) / 2, 3)}) < 4:
        raise ValueError("close")
    return mc("st_n5_independent_or", "2.7", "3.C", "Find the probability that at least one of two independent events occurs", ["Use independence to find the probability that both events occur", "Apply the addition rule with that overlap and reject the product, the complement of both and an average"],
              key, wr, rng, stem, "the probability is recomputed with the complement of both events failing", ["procedure_choice", "calculated_value_decision"], est=85, facts=[f"pa={pa}", f"pb={pb}"],
              sig=(["independent events", "addition rule"], 1, "light"))


# ======================= 13. 정규분포의 두 값 사이 확률 (2.11 / 3.C) =======================
NB_CTX = [dict(what="the time, in minutes, that a bus takes to complete a route", u="minutes", mu=(40, 55), sd=(4, 7)), dict(what="the amount of juice, in milliliters, that a machine pours into a bottle", u="milliliters", mu=(330, 360), sd=(4, 8)), dict(what="the score, in points, on a standardized reading test", u="points", mu=(480, 540), sd=(40, 70))]


def st_n5_normal_between(rng):
    c = pick(rng, NB_CTX)
    for _ in forever():
        mu = rng.randint(*c["mu"]); sd = rng.randint(*c["sd"]); a = round(mu - rng.choice([0.5, 1.0, 1.5]) * sd, 1); b = round(mu + rng.choice([0.5, 1.0, 2.0]) * sd, 1)
        pab = ncdf((b - mu) / sd) - ncdf((a - mu) / sd); agree(pab, ss.norm.cdf(b, mu, sd) - ss.norm.cdf(a, mu, sd), tol=1e-9, name="between")
        w1 = ncdf((b - mu) / sd); w2 = 1 - pab; w3 = ncdf((b - mu) / sd) + ncdf((a - mu) / sd)
        if gaps_ok([round(v, 3) for v in (pab, w1, w2, w3)], 0.04) and 0.2 < pab < 0.9 and w3 < 1:
            break
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(pab), f"The probability is $\\Phi({(b - mu) / sd:.2f}) - \\Phi({(a - mu) / sd:.2f}) = {pab:.3f}$.", round(pab, 3))
    wr = [(f3(w1), "Gives the area to the left of the upper value without removing the area to the left of the lower value.", "upper_cumulative_only", round(w1, 3), 1), (f3(w2), "Gives the probability outside the two values instead of between them.", "outside_not_between", round(w2, 3), 2), (f3(w3), "Adds the two cumulative areas instead of subtracting them.", "added_areas", round(w3, 3), 1)]
    stem = f"{cap(c['what'])} is approximately normally distributed with mean ${mu}$ {c['u']} and standard deviation ${sd}$ {c['u']}. What is the probability that a randomly selected value is between ${a:g}$ and ${b:g}$ {c['u']}? (Give the answer as a decimal rounded to three decimal places.)"
    return mc("st_n5_normal_between", "2.11", "3.C", "Find the probability that a normal random variable lies between two values", ["Standardize both values", "Subtract the lower cumulative area from the upper one and reject the single cumulative area, the outside area and the sum"],
              key, wr, rng, stem, "the probability is recomputed with math.erf and with scipy's normal cdf", ["procedure_choice", "calculated_value_decision", "interpretation"], est=95, facts=[f"mu={mu}", f"sd={sd}"],
              sig=(["standardizing", "area between two values"], 1, "light"))


# ======================= 14. 모의 실험의 한 시행에 기록할 것 (2.3 / 2.A) =======================
SG_CTX = [dict(sc="To estimate the probability that at least $2$ of $5$ randomly selected people were born on a weekend, a student simulates the situation. A random digit from $0$ to $6$ stands for the day of the week, and $0$ and $6$ stand for weekend days.", good="One trial generates $5$ random digits from $0$ to $6$ and records whether at least $2$ of them are $0$ or $6$; the estimate is the proportion of trials in which this happens.", w=["One trial generates $5$ random digits from $0$ to $6$ and records the sum of the digits; the estimate is the mean of the sums.", "One trial generates $1$ random digit from $0$ to $6$ and records whether it is $0$ or $6$; the estimate is the proportion of trials in which the digit is $0$ or $6$.", "One trial generates $2$ random digits from $0$ to $6$ and records whether both are $0$ or $6$; the estimate is the proportion of trials in which both are $0$ or $6$."]),
          dict(sc="To estimate the probability that a basketball player who makes $70\\%$ of her shots makes at least $3$ of $4$ shots, a student simulates the situation. A random digit from $0$ to $9$ is generated for each shot, and the digits $0$ through $6$ stand for a made shot.", good="One trial generates $4$ random digits from $0$ to $9$ and records whether at least $3$ of them are from $0$ to $6$; the estimate is the proportion of trials in which this happens.", w=["One trial generates $4$ random digits from $0$ to $9$ and records the number of different digits; the estimate is the mean number of different digits.", "One trial generates $1$ random digit from $0$ to $9$ and records whether it is from $0$ to $6$; the estimate is the proportion of trials in which the digit is from $0$ to $6$.", "One trial generates $3$ random digits from $0$ to $9$ and records whether all are from $0$ to $6$; the estimate is the proportion of trials in which all are from $0$ to $6$."]),
          dict(sc="To estimate the probability that at least $3$ of $6$ randomly selected customers use a coupon when $40\\%$ of customers do, a student simulates the situation. A random digit from $0$ to $9$ is generated for each customer, and the digits $0$ through $3$ stand for using a coupon.", good="One trial generates $6$ random digits from $0$ to $9$ and records whether at least $3$ of them are from $0$ to $3$; the estimate is the proportion of trials in which this happens.", w=["One trial generates $6$ random digits from $0$ to $9$ and records the largest digit; the estimate is the mean of the largest digits.", "One trial generates $1$ random digit from $0$ to $9$ and records whether it is from $0$ to $3$; the estimate is the proportion of trials in which the digit is from $0$ to $3$.", "One trial generates $3$ random digits from $0$ to $9$ and records whether all are from $0$ to $3$; the estimate is the proportion of trials in which all are from $0$ to $3$."])]


def st_n5_sim_trial(rng):
    c = pick(rng, SG_CTX)
    key = (c["good"], "One trial must reproduce the whole situation and record whether the event of interest happened, and the estimate is the proportion of trials with the event.")
    wr = W([(c["w"][0], "Records a quantity that is not the event of interest, so the proportion of trials with the event cannot be found.", "wrong_quantity", 1), (c["w"][1], "One trial represents only a single person or shot, not the whole situation described in the probability.", "trial_too_small", 1), (c["w"][2], "Records the event 'all' instead of 'at least' the stated number, so it estimates the probability of a different event.", "wrong_event", 2)])
    stem = f"{c['sc']} Which of the following describes one trial and the estimate correctly?"
    return mc("st_n5_sim_trial", "2.3", "2.A", "Describe one trial of a simulation and the estimate it produces", ["Decide what one trial must contain to reproduce the situation", "Choose the trial that records whether the stated event happened and reject trials that record another quantity, too little or a different event"],
              key, wr, rng, stem, "each family pairs the correct trial with a wrong quantity, a trial that is too small and a different event", ["procedure_choice", "claim_justification"], est=90)


# ======================= 15. 이원표에서 독립 여부 판단 (2.7 / 4.B, 표) =======================
TW_CTX = [dict(rh="Group", rows=("Treated", "Untreated"), cols=("Improved", "Did not improve"), what="a treatment", ev="improved"), dict(rh="Shift", rows=("Day", "Night"), cols=("Late", "On time"), what="a shift", ev="was late"), dict(rh="Class", rows=("Morning", "Afternoon"), cols=("Passed", "Failed"), what="a class time", ev="passed")]


def st_n5_independence_table(rng):
    c = pick(rng, TW_CTX)
    indep = pick(rng, [True, False])
    for _ in forever():
        r1 = rng.choice([40, 60, 80]); r2 = rng.choice([60, 90, 120]); p = rng.choice([0.25, 0.4, 0.5, 0.6])
        a = int(round(r1 * p)); b = int(round(r2 * p)) if indep else int(round(r2 * (p + rng.choice([-0.2, 0.2]))))
        cells = [[a, r1 - a], [b, r2 - b]]
        pc1 = a / r1; pc2 = b / r2; po = (a + b) / (r1 + r2)
        if indep and abs(pc1 - pc2) < 1e-9 and 0.1 < pc1 < 0.9:
            break
        if (not indep) and abs(pc1 - pc2) > 0.12 and 0.05 < pc1 < 0.95 and 0.05 < pc2 < 0.95:
            break
    stim = stat_stim(f"Counts for {c['what']}", "two_way", title="Counts in the table", rowHeader=c["rh"], rowLabels=list(c["rows"]), colLabels=list(c["cols"]), cells=cells)
    if indep:
        key = (f"The events are independent, because the proportion who {c['ev']} is ${pc1:.2f}$ in each row, which equals the proportion ${po:.2f}$ in the whole table.", "Independence means that knowing the row does not change the probability of the outcome; here the conditional proportions are equal to each other and to the overall proportion.")
        wr = W([(f"The events are not independent, because the counts in the two rows are different.", "Different counts come from different row totals; independence compares proportions, not counts.", "counts_compared", 1), (f"The events are not independent, because both rows contain some individuals who {c['ev']}.", "Both rows having some of each outcome is expected under independence and does not show a relationship.", "both_rows_present", 1), (f"The events cannot be judged, because a table of counts does not give probabilities.", "Relative frequencies from the table estimate the probabilities, and comparing them decides independence for these data.", "no_probabilities", 2)])
    else:
        key = (f"The events are not independent, because the proportion who {c['ev']} is ${pc1:.2f}$ in the first row and ${pc2:.2f}$ in the second row, so the row changes the probability of the outcome.", "Independence would require the same conditional proportion in each row; the two proportions differ noticeably.")
        wr = W([(f"The events are independent, because both rows contain some individuals who {c['ev']}.", "Both rows having some of each outcome does not show independence; the proportions have to be equal.", "both_rows_present", 1), (f"The events are independent, because the two row totals are different.", "Different row totals do not decide independence; the conditional proportions do.", "totals_compared", 1), (f"The events are independent, because the count who {c['ev']} is the largest in the row with the larger total.", "The count depends on the size of the row; the proportions are different, so the events are not independent.", "counts_not_proportions", 2)])
    stem = f"The table shown gives the counts for a random sample classified by {c['what']} and by whether the individual {c['ev']}. Based on the table, which of the following statements about the events 'in the first row' and '{c['ev']}' is correct?"
    return mc("st_n5_independence_table", "2.7", "4.B", "Judge independence from the conditional proportions in a two-way table", ["Find the proportion with the outcome within each row and in the whole table", "Compare the proportions and reject judgments based on counts, totals or the presence of both outcomes"],
              key, wr, rng, stem, "the table is generated either with equal conditional proportions or with proportions that differ by at least 0.12", ["representation_reading", "claim_justification"], stim, est=95, facts=[f"indep={indep}"])


# ======================= 16. 표본 크기가 표본평균의 분포에 미치는 영향 (2.12 / 4.C) =======================
SM_CTX = [dict(w="the waiting times, in minutes, at a clinic", skew="strongly skewed to the right"), dict(w="the amounts, in dollars, that customers spend in a store", skew="strongly skewed to the right"), dict(w="the lifetimes, in hours, of a type of lightbulb", skew="strongly skewed to the right")]


def st_n5_xbar_shape_n(rng):
    c = pick(rng, SM_CTX)
    n1 = rng.choice([2, 3, 4]); n2 = rng.choice([40, 50, 60])
    key = (f"The sampling distribution of the sample mean for $n = {n2}$ is closer to a normal distribution and has a smaller standard deviation than for $n = {n1}$.", "As the sample size increases, the Central Limit Theorem makes the sampling distribution of the sample mean closer to normal, and its standard deviation decreases in proportion to the square root of the sample size.")
    wr = W([(f"The sampling distribution of the sample mean for $n = {n2}$ is skewed like the population and has the same standard deviation as for $n = {n1}$.", "The shape becomes closer to normal as the sample size increases, and the standard deviation of the sample mean decreases.", "no_change", 1), (f"The sampling distribution of the sample mean for $n = {n2}$ is closer to a normal distribution but has a larger standard deviation than for $n = {n1}$.", "A larger sample size gives a smaller, not a larger, standard deviation of the sample mean.", "sd_increases", 2),
            (f"The sampling distribution of the sample mean for $n = {n2}$ is as strongly skewed as the population, but has a smaller standard deviation than for $n = {n1}$.", "The shape also changes: with a large sample size the distribution of the sample mean is close to normal even for a skewed population.", "shape_unchanged", 2)])
    stem = f"Random samples are taken from a population of {c['w']}, which is {c['skew']}. Samples of size ${n1}$ and of size ${n2}$ are each used to form a sampling distribution of the sample mean. Which of the following statements compares the two sampling distributions correctly?"
    return mc("st_n5_xbar_shape_n", "2.12", "4.C", "Compare sampling distributions of the sample mean for a small and a large sample size", ["Apply the Central Limit Theorem to the shape of the sampling distribution for each sample size", "Compare the standard deviations using the square root of the sample size and reject statements that leave the shape or the spread unchanged"],
              key, wr, rng, stem, "each context pairs the correct comparison with statements that leave the shape or the spread unchanged or reverse the spread", ["interpretation", "claim_justification"], est=85)


STAGE_SINGLES = ["st_n5_claim_to_question", "st_n5_population_defined", "st_n5_quantitative_question", "st_n5_rel_freq_table", "st_n5_freq_table_mean", "st_n5_shape_from_stats", "st_n5_hist_gap", "st_n5_undercoverage", "st_n5_why_stratify", "st_n5_control_group",
                 "st_n5_rv_linear", "st_n5_independent_or", "st_n5_normal_between", "st_n5_sim_trial", "st_n5_independence_table", "st_n5_xbar_shape_n"]
