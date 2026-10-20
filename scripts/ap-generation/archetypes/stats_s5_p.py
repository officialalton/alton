"""AP Statistics 연습 시험 4(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 1·2. 기존 공개 세트(ST1·ST2)와 연습 시험 3 의 풀이 틀을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(분수·전수 열거·numpy)로 다시 계산한다. 해석·설계 문항은 고정 문장 4개(정답 1 + 이름 붙은 오해 3). 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


# ======================= 1. 질문에 답하도록 변수를 정의하기 (1.2 / 1.A) =======================
OV_CTX = [
    dict(q="Do students who sleep more tend to earn higher grades?", pop="students at a large high school", good="the number of hours slept on school nights and the grade point average for the semester",
         vague=("how rested each student feels and how smart each student seems to teachers", "Both variables are judged by feeling or opinion and are not defined well enough to be measured the same way for every student."),
         single="the grade point average for the semester of each student, without any information about sleep", unrel="the number of students in each homeroom and the length of the school day"),
    dict(q="Do employees who commute farther tend to arrive late more often?", pop="employees of a large company", good="the distance of each employee's commute in kilometers and the number of late arrivals in the past month",
         vague=("how stressful each commute feels and how reliable each employee seems to a manager", "Both variables are based on impressions and are not defined well enough to be measured the same way for every employee."),
         single="the number of late arrivals in the past month for each employee, without any information about the commute", unrel="the number of parking spaces and the color of the company's logo"),
    dict(q="Do households that recycle more tend to produce less trash?", pop="households in a city", good="the number of kilograms of recycling collected in a week and the number of kilograms of trash collected in the same week",
         vague=("how green each household feels and how clean each household's yard looks", "Both variables are based on impressions and are not defined well enough to be measured the same way for every household."),
         single="the number of kilograms of trash collected in a week from each household, without any information about recycling", unrel="the number of trash trucks and the day of the week of the collection"),
]


def st_n_operational_variables(rng):
    c = pick(rng, OV_CTX)
    key = (cap(c["good"]) + ".", "Each variable is defined so that it can be measured in the same way for every individual, and together they address the relationship named in the question.")
    wr = [(cap(c["vague"][0]) + ".", c["vague"][1], "undefined_variables"), (cap(c["single"]) + ".", "The question asks about a relationship between two variables, and these data contain only one of them, so the question cannot be answered.", "only_one_variable"),
          (cap(c["unrel"]) + ".", "These variables are not the ones named in the question, so they cannot be used to answer it.", "unrelated_variables")]
    wr = [(t, w, m, None, 1) for t, w, m in wr]
    stem = f"A researcher plans to collect data from a random sample of {c['pop']} to answer the question \"{c['q']}\" Which of the following lists the data that should be collected for each individual so that the question can be answered?"
    return mc("st_n_operational_variables", "1.2", "1.A", "Choose measurable variables that match the variables named in an investigative question",
              ["Identify the two variables that the question names", "Choose the data that define both variables in a measurable way and reject vague, incomplete or unrelated data"],
              key, wr, rng, stem, "each context pairs one measurable definition of both variables with a vague definition, a single variable and unrelated variables, written and checked by hand", ["claim_justification", "interpretation"], est=75)


# ======================= 2. 상자그림으로 답할 수 있는 질문 (1.5 / 1.A, 상자그림) =======================
BG_CTX = [dict(what="the number of hours that students at a college work per week", unit="hours", pop="students at the college", lo=0, hi=36, other="Do students who live on campus work fewer hours per week than students who live off campus?"),
          dict(what="the number of seconds that a web page takes to load", unit="seconds", pop="loads of a company's web page", lo=1, hi=9, other="Do the loads of the page on mobile phones take longer than the loads on computers?"),
          dict(what="the number of liters of water that households use per day", unit="liters", pop="households in a town", lo=60, hi=330, other="Do households with a garden use more water per day than households without a garden?")]


def st_n_graph_answers_question(rng):
    c = pick(rng, BG_CTX)
    span = c["hi"] - c["lo"]
    mn = c["lo"] + round(span * rng.uniform(0.03, 0.08)); q1 = mn + round(span * rng.uniform(0.10, 0.16)); med = q1 + round(span * rng.uniform(0.07, 0.12)); q3 = med + round(span * rng.uniform(0.08, 0.14)); mx = q3 + round(span * rng.uniform(0.12, 0.2))
    assert mn < q1 < med < q3 < mx <= c["hi"] + span * 0.1
    stim = stat_stim(f"Boxplot of {c['what']} for a random sample", "boxplot", title="Boxplot for a random sample", xTitle=cap(c["unit"]), boxes=[{"name": "Sample", "min": mn, "q1": q1, "median": med, "q3": q3, "max": mx}])
    key = (f"What is the typical value of {c['what']} among the {c['pop']}?", "The boxplot displays the distribution of one quantitative variable for a sample, so it can help answer a question about the typical value or spread of that variable in the population.")
    wr = [(c["other"], "Answering it needs a second variable that defines two groups, and the boxplot displays only one group.", "second_variable_needed", None, 1),
          (f"What was the value of {c['what']} for the first individual in the sample?", "Asks about one individual rather than about the population, so no variability is studied.", "single_individual", None, 1),
          (f"Is the value of {c['what']} better for the {c['pop']} than it was last year?", "Asks for a judgment and needs data from another year, which the boxplot does not provide.", "judgment_and_other_data", None, 2)]
    stem = f"The boxplot shown summarizes {c['what']} for a random sample of the {c['pop']}. Which of the following investigative questions can the data in the boxplot be used to help answer?"
    return mc("st_n_graph_answers_question", "1.5", "1.A", "Select the investigative question that a one-variable display can help answer",
              ["Read what variable and what group the display describes", "Choose the question about that one variable in the population and reject questions that need another variable, ask about one individual or ask for a judgment"],
              key, wr, rng, stem, "each context pairs one question about the displayed variable with a two-group question, a single-individual question and a judgment question", ["representation_reading", "claim_justification"], stim, est=75, facts=[f"q1={q1}"])


# ======================= 3. 결과에서 이어지는 후속 조사 질문 (1.10 / 1.A) =======================
FU_CTX = [dict(res="A random sample of $400$ adults in a city found that $62\\%$ use public transit at least once a week.", pop="adults in the city", key="Do adults who live within one mile of a transit stop tend to use public transit more often than adults who live farther away?", indiv="Did the first adult who was surveyed in the sample use public transit at least once during last week?", look="How many transit stops does the city operate on its bus and train lines combined?", judge="Should the city spend more of its transportation budget on building new transit stops?"),
          dict(res="A random sample of $300$ members of a gym found that the mean number of visits per month was $11.4$.", pop="members of the gym", key="Do members who attend group classes tend to visit the gym more often than members who do not attend group classes?", indiv="How many times did the newest member of the gym visit the gym during last month?", look="In what year was the gym first opened to the public in this city?", judge="Is a gym that offers group classes a better place to exercise than a gym that does not?"),
          dict(res="A random sample of $250$ households in a county found that $48\\%$ own a pet.", pop="households in the county", key="Do households with children tend to own pets more often than households without children?", indiv="Does the household that lives at the address that the researcher visited first own a pet?", look="How many veterinary clinics are located in the county, according to the county directory?", judge="Should the county require every household with a pet to register that pet with the county?")]


def st_n_followup_question(rng):
    c = pick(rng, FU_CTX)
    key = (c["key"], "It asks about two variables for the whole population, and the answer varies among individuals, so it is answered by collecting and analyzing data.")
    wr = [(c["indiv"], "Asks about one individual, so there is no population and no variability to study.", "single_individual", None, 1), (c["look"], "Asks for a single count that can be looked up, so no variability among individuals is anticipated.", "lookup", None, 1), (c["judge"], "Asks for a judgment about what should be done, which data cannot settle.", "judgment", None, 1)]
    stem = f"{c['res']} The researchers want to follow up with a new study of the {c['pop']}. Which of the following is a valid investigative question for the new study?"
    return mc("st_n_followup_question", "1.10", "1.A", "Choose a valid follow-up investigative question after a reported result",
              ["Recognize that a valid question names a population and variables that vary among its individuals", "Reject questions that concern one individual, a single fact or a judgment of what should be done"],
              key, wr, rng, stem, "each context pairs one two-variable population question with an individual question, a lookup question and a judgment question", ["claim_justification", "interpretation"], est=70)


# ======================= 4. 막대그래프의 잘린 세로축 (1.4 / 4.A, 막대그래프) =======================
AX_CTX = [dict(what="the number of tickets sold by three theaters last month", cats=("Theater A", "Theater B", "Theater C"), vals=(1900, 1940, 1980), yt="Tickets sold", ymin=1860),
          dict(what="the number of visitors to three museums in one week", cats=("Museum X", "Museum Y", "Museum Z"), vals=(4800, 4920, 5040), yt="Visitors", ymin=4700),
          dict(what="the number of bottles that three machines filled in a shift", cats=("Machine 1", "Machine 2", "Machine 3"), vals=(920, 950, 980), yt="Bottles filled", ymin=880)]


def st_n_bar_axis(rng):
    c = pick(rng, AX_CTX)
    sc = rng.choice([1, 1, 2]); vals = [v + rng.randint(-8, 8) for v in c["vals"]]
    lo, hi = min(vals), max(vals)
    ymin = c["ymin"]; ymax = int(math.ceil((hi + 20) / 20.0) * 20)
    pct = (hi - lo) / lo * 100
    vis = (hi - ymin) / (lo - ymin)  # 막대 높이의 시각적 비
    assert vis > 2.0 and pct < 6
    imax = c["cats"][vals.index(hi)]; imin = c["cats"][vals.index(lo)]
    stim = stat_stim(f"Bar graph of {c['what']}", "bar", title=f"{c['yt']} (vertical axis starts at {ymin})", categories=list(c["cats"]), series=[{"values": vals}], xTitle="Group", yTitle=c["yt"], yMin=ymin, yMax=ymax, valueLabels=True)
    key = (f"The vertical axis starts at ${ymin}$, so the bars exaggerate the differences; the largest value is only about ${pct:.1f}\\%$ greater than the smallest.", f"The bars are measured from ${ymin}$ rather than from $0$, so the visual ratio of the bar heights is not the ratio of the values; the actual ratio of ${hi}$ to ${lo}$ gives about ${pct:.1f}\\%$ more.")
    wr = [(f"{imax} has a value about ${vis:.1f}$ times as large as {imin}, because its bar is about ${vis:.1f}$ times as tall.", "Compares the heights of bars that do not start at zero; the ratio of the values is much closer to $1$ than the ratio of the bar heights.", "bar_height_ratio", None, 1),
          ("The starting value of the vertical axis does not matter in a bar graph, because only the order of the bars shows the comparison.", "A bar graph represents values by length, so starting the axis above zero distorts the sizes that readers compare.", "axis_start_irrelevant", None, 1),
          ("The graph is misleading because the bars of a bar graph should touch each other.", "Touching bars belong to a histogram of a quantitative variable; the spacing of bars in a bar graph is not the problem here.", "bars_should_touch", None, 2)]
    stem = f"The bar graph shown displays {c['what']}. Which of the following statements about the graph is correct?"
    return mc("st_n_bar_axis", "1.4", "4.A", "Recognize how a vertical axis that does not start at zero distorts a bar graph",
              ["Read the starting value of the vertical axis and the values of the bars", "Compare the actual values with the visual heights of the bars and reject statements that rely on the heights alone"],
              key, wr, rng, stem, "the percent difference is recomputed from the labeled values and the visual height ratio is checked to exceed 2 while the actual difference stays below 6 percent", ["representation_reading", "claim_justification"], stim, est=85, facts=[f"vals={vals}", f"ymin={ymin}"],
              sig=(["axis scale of a bar graph", "relative size of values"], 1, "light"))


# ======================= 5. 자료 목록에서 중앙값과 사분범위 (1.7 / 3.B) =======================
FN_CTX = [dict(what="the number of minutes that 11 customers waited in a line", unit="minutes"), dict(what="the number of points that 11 players scored in a game", unit="points"), dict(what="the number of kilometers that 11 cyclists rode in a week", unit="kilometers")]


def st_n_five_number_list(rng):
    c = pick(rng, FN_CTX)
    for _ in forever():
        v = sorted(rng.sample(range(4, 60), 11))
        med = v[5]; q1 = float(np.median(v[:5])); q3 = float(np.median(v[6:])); iqr = q3 - q1
        q1w = float(np.median(v[:6])); q3w = float(np.median(v[5:])); iqrw = q3w - q1w
        rngv = v[-1] - v[0]
        opts = [(med, iqr), (med, iqrw), (med, rngv), (sum(v) / 11, iqr)]
        flat = [(round(a, 2), round(b, 2)) for a, b in opts]
        if len(set(flat)) == 4 and q1 != q1w and q3 != q3w and abs(sum(v) / 11 - med) > 0.6:
            break
    # 독립 경로: numpy 의 사분위수(선형 보간)는 쓰지 않고 정의대로 반쪽의 중앙값을 다시 계산
    srt = sorted(v); lower = srt[:5]; upper = srt[6:]; agree(np.median(lower), q1, name="q1"); agree(np.median(upper), q3, name="q3")
    fm = lambda a, b: f"median ${a:g}$ {c['unit']}, interquartile range ${b:g}$ {c['unit']}"
    key = (fm(med, iqr), f"The median is the middle value ${med:g}$; the quartiles are the medians of the five values below and the five values above the median, ${q1:g}$ and ${q3:g}$, so the IQR is ${iqr:g}$.")
    wr = [(fm(med, iqrw), "Includes the median in both halves when finding the quartiles, which shifts them; the halves are the values below and above the median.", "median_in_halves", None, 2), (fm(med, rngv), "Reports the range, the maximum minus the minimum, instead of the interquartile range.", "range_not_iqr", None, 2),
          (f"median ${sum(v) / 11:.1f}$ {c['unit']}, interquartile range ${iqr:g}$ {c['unit']}", "Reports the mean as the median.", "mean_not_median", None, 1)]
    stem = f"The values for {c['what']} are {', '.join(f'${x}$' for x in v)}. Which of the following gives the median and the interquartile range of these values?"
    return mc("st_n_five_number_list", "1.7", "3.B", "Find the median and the interquartile range from a list of values",
              ["Order the values and find the median", "Find the quartiles as the medians of the lower and upper halves, leaving the median out, and subtract"],
              key, wr, rng, stem, "the quartiles are recomputed as medians of the lower and upper halves that exclude the median of the eleven sorted values", ["procedure_choice", "calculated_value_decision"], est=95, facts=[f"v={v}"])


# ======================= 6. 극단값 제거가 요약 통계에 미치는 영향 (1.7 / 4.C) =======================
OR_CTX = [dict(what="the prices, in thousands of dollars, of nine homes on one street", unit="thousand dollars"), dict(what="the salaries, in thousands of dollars, of nine employees in a small firm", unit="thousand dollars"), dict(what="the number of followers, in thousands, of nine accounts", unit="thousand followers")]


def st_n_outlier_removal(rng):
    c = pick(rng, OR_CTX)
    for _ in forever():
        v = sorted(rng.sample(range(40, 80), 8)); out = v[-1] + rng.randint(120, 260); allv = v + [out]
        m0, m1 = np.mean(allv), np.mean(v); md0, md1 = np.median(allv), np.median(v)
        s0, s1 = np.std(allv, ddof=1), np.std(v, ddof=1)
        q = lambda x: (float(np.median(sorted(x)[:len(x) // 2])), float(np.median(sorted(x)[(len(x) + 1) // 2:])))
        i0 = q(allv)[1] - q(allv)[0]; i1 = q(v)[1] - q(v)[0]
        if (m0 - m1) > 5 * abs(md0 - md1) and (m0 - m1) > 10 and (s0 - s1) > 15 and abs(i0 - i1) < 0.35 * (s0 - s1):
            break
    key = ("The mean and the standard deviation decrease by a lot, while the median and the interquartile range change very little.", "The extreme value pulls the mean and inflates the standard deviation, but the median and the quartiles depend on the order of the values and barely change.")
    wr = [("The median decreases the most, and the mean stays about the same.", "Reverses the roles: the extreme value pulls the mean strongly while the median is resistant.", "median_not_resistant", None, 1),
          ("All four measures of center and spread decrease by about the same amount.", "The mean and the standard deviation are sensitive to an extreme value, but the median and the interquartile range are resistant.", "all_change_equally", None, 1),
          ("The standard deviation stays about the same, because it measures the spread of the middle values, while the interquartile range decreases a lot.", "Reverses the roles: the standard deviation uses every value and is inflated by the extreme value, while the interquartile range ignores it.", "sd_resistant", None, 2)]
    stem = f"The values for {c['what']} are {', '.join(f'${x}$' for x in allv)}. The largest value is removed from the data. Which of the following describes how the mean, the standard deviation, the median and the interquartile range change?"
    return mc("st_n_outlier_removal", "1.7", "4.C", "Describe which summary statistics are resistant to an extreme value",
              ["Recognize that the mean and the standard deviation use every value", "Recognize that the median and the interquartile range depend only on the order of the values and are resistant"],
              key, wr, rng, stem, "the four statistics are recomputed with and without the largest value and the case is kept only if the mean and the standard deviation change by far more than the median and the interquartile range", ["interpretation", "claim_justification"], est=90, facts=[f"v={allv}"])


# ======================= 7. 상자그림과 백분율 진술 (1.8 / 4.D, 상자그림) =======================
BP_CTX = [dict(what="the amount of time, in minutes, that customers wait to be served", unit="minutes"), dict(what="the number of pages that books in a library have", unit="pages"), dict(what="the scores, in points, on a final exam", unit="points")]


def st_n_boxplot_percent(rng):
    c = pick(rng, BP_CTX)
    base = rng.choice([20, 30, 40, 100, 150]); step = rng.choice([4, 5, 6, 8, 10])
    mn = base; q1 = mn + 2 * step; med = q1 + step + rng.randint(0, 2); q3 = med + 2 * step; mx = q3 + 3 * step
    assert mn < q1 < med < q3 < mx
    stim = stat_stim(f"Boxplot of {c['what']}", "boxplot", title="Boxplot of the observations", xTitle=cap(c["unit"]), boxes=[{"name": "Data", "min": mn, "q1": q1, "median": med, "q3": q3, "max": mx}])
    key = (f"About $75\\%$ of the observations are less than ${q3}$ {c['unit']}.", f"The third quartile is ${q3}$, and by definition about three quarters of the observations lie below the third quartile.")
    wr = [(f"About $75\\%$ of the observations are between ${q1}$ and ${q3}$ {c['unit']}.", "The values between the first and the third quartile are about half of the observations, not three quarters.", "iqr_is_75", None, 1),
          (f"About half of the observations are between ${med}$ and ${mx}$ {c['unit']}.", "The values between the median and the maximum are about half of the observations only if the median is the lower end; here that interval holds about the upper half, but the statement is not what the box shows.", "x", None, 1),
          (f"About $25\\%$ of the observations are less than ${mn}$ {c['unit']}.", "The minimum is the smallest observation, so no observation is less than it; about $25\\%$ are less than the first quartile.", "min_as_q1", None, 1)]
    wr[1] = (f"About $25\\%$ of the observations are between ${mn}$ and ${q1}$ {c['unit']}, and another $25\\%$ are between ${q3}$ and ${mx}$ {c['unit']}, so about $75\\%$ of the observations are outside the box.", "The box holds about half of the observations, so about half, not three quarters, lie outside the box.", "outside_box_75", None, 2)
    stem = f"The boxplot shown displays {c['what']} for a large random sample. Which of the following statements is correct?"
    return mc("st_n_boxplot_percent", "1.8", "4.D", "Interpret the quartiles of a boxplot as percentages of the observations",
              ["Read the quartiles and the median from the boxplot", "Use the fact that each of the four parts between the five numbers holds about a quarter of the observations to judge each statement"],
              key, wr, rng, stem, "each statement is checked against the rule that each part between consecutive five-number-summary values holds about a quarter of the observations", ["representation_reading", "interpretation"], stim, est=80, facts=[f"q3={q3}"])


# ======================= 8. 난수표로 단순 임의 표본 뽑기 (1.11 / 2.B) =======================
RD_CTX = [dict(pop="students", N=300, n=25, pad=3), dict(pop="employees", N=80, n=12, pad=2), dict(pop="tenants", N=450, n=30, pad=3), dict(pop="club members", N=90, n=10, pad=2)]


def st_n_random_digits(rng):
    c = pick(rng, RD_CTX)
    N, n, pad = c["N"], c["n"], c["pad"]
    first = "0" * (pad - 1) + "1"; last = str(N)
    key = (f"Number the {c['pop']} from {first} to {last}, read the table of random digits {pad} digits at a time, skip any number that is not from {first} to {last} and any repeat, and continue until ${n}$ different {c['pop']} are chosen.", "Every individual has a label of the same length, every label is equally likely to be read, and ignoring invalid labels and repeats gives a simple random sample without replacement.")
    wr = [(f"Number the {c['pop']} from {first} to {last}, read the table {pad - 1} digits at a time, and choose the first ${n}$ numbers that are read, even if a number is read twice.", f"Reading {pad - 1} digits at a time cannot produce every label, and accepting repeats does not give ${n}$ different individuals.", "short_labels_repeats", None, 1),
          (f"Number the {c['pop']} from {first} to {last}, read the table {pad} digits at a time, and subtract {N} from any number that is larger than {N}.", "Subtracting makes some labels more likely than others, so not every individual has the same chance.", "subtract_not_skip", None, 2),
          (f"Number the {c['pop']} from {first} to {last} and choose every ${max(2, N // n)}$th individual from a random starting point.", "This is a systematic sample; not every group of individuals has the same chance of being chosen, so it is not a simple random sample.", "systematic_not_srs", None, 1)]
    stem = f"A researcher wants to select a simple random sample of ${n}$ from ${N}$ {c['pop']} by using a table of random digits. Which of the following procedures should the researcher use?"
    return mc("st_n_random_digits", "1.11", "2.B", "Choose the correct procedure for selecting a simple random sample with a table of random digits",
              ["Label every individual with a number of the same length", "Read digits in groups of that length, skip invalid numbers and repeats and reject procedures that change the probabilities"],
              key, wr, rng, stem, "each option differs from the key by one named defect: short labels with repeats, subtracting instead of skipping, or a systematic selection", ["procedure_choice", "claim_justification"], est=85, facts=[f"N={N}", f"n={n}"])


# ======================= 9. 무응답 편향 줄이기 (1.12 / 2.B) =======================
NR_CTX = [dict(unit="households", what="a mailed survey about household recycling", pct=30), dict(unit="customers", what="an online survey about satisfaction with a store", pct=20), dict(unit="residents", what="a mailed survey about public parks", pct=35)]


def st_n_nonresponse_fix(rng):
    c = pick(rng, NR_CTX)
    n = pick(rng, [400, 500, 600])
    key = (f"Contact many of the {c['unit']} that did not respond again, for example by telephone or a visit, and use their answers as well.", "Nonresponse bias arises because those who do not respond can differ from those who respond, so the way to reduce it is to obtain answers from as many of the selected individuals as possible.")
    wr = [(f"Select ${n}$ more {c['unit']} at random and again use only the answers of those who choose to respond.", "A new sample with the same low response rate has the same nonresponse bias, only with more responses.", "more_of_same", None, 1),
          (f"Replace each {c['unit'][:-1]} that did not respond with a volunteer who asks to take part.", "Volunteers differ from the selected individuals in ways that can bias the results, so replacing nonrespondents with volunteers adds bias.", "volunteer_replacement", None, 1),
          ("Give the responses of the people who answered more weight, because they were interested in the survey.", "Weighting the respondents more heavily increases the effect of the individuals who responded and does nothing to include the nonrespondents.", "weight_respondents", None, 2)]
    stem = f"A researcher selects ${n}$ {c['unit']} at random for {c['what']}, but only ${c['pct']}\\%$ of the selected {c['unit']} respond. Which of the following actions would best reduce the bias caused by the nonresponse?"
    return mc("st_n_nonresponse_fix", "1.12", "2.B", "Choose an action that reduces nonresponse bias in a survey",
              ["Recognize that nonresponse bias comes from the selected individuals who do not answer", "Choose the action that obtains answers from the nonrespondents and reject actions that add volunteers, more of the same sample or extra weight for respondents"],
              key, wr, rng, stem, "each context pairs the follow-up action with three actions that leave or add bias, written and checked by hand", ["claim_justification", "procedure_choice"], est=80, facts=[f"n={n}"])


# ======================= 10. 이중 눈가림의 목적 (1.13 / 2.A) =======================
BL_CTX = [dict(trt="a new pain medicine", ctrl="a placebo", resp="how much pain each patient reports", who="patients", meas="doctors who measure the pain"), dict(trt="a new teaching video", ctrl="the usual lesson", resp="the score on a test", who="students", meas="teachers who grade the tests"),
          dict(trt="a new fertilizer", ctrl="the usual fertilizer", resp="the height of each plant", who="plants", meas="technicians who measure the plants")]


def st_n_blinding_purpose(rng):
    c = pick(rng, BL_CTX)
    human = c["who"] != "plants"
    key = ("To keep the expectations of the individuals who receive the treatments and of the people who measure the response from influencing the results.", "When neither group knows which treatment was given, expectations cannot change the behavior or the measurements in one group differently from the other.") if human else \
          ("To keep the expectations of the people who measure the response from influencing the measurements of the plants.", "When the people who measure do not know which fertilizer each plant received, their expectations cannot change the measurements in one group differently from the other.")
    wr = [("To make the groups the same size so that the treatments can be compared fairly.", "The sizes of the groups are set by the assignment of the treatments, not by who knows which treatment was given.", "equal_size", None, 1),
          ("To make the sample represent the population so that the results can be generalized to all individuals.", "Representing a population depends on how the individuals were selected, not on who knows the treatments.", "generalize", None, 1),
          ("To make sure that the treatments were assigned to the individuals at random.", "Random assignment is a separate feature of the design carried out with chance; blinding does not assign the treatments.", "random_assignment", None, 2)]
    who = c["who"]
    stem = f"In an experiment to compare {c['trt']} with {c['ctrl']}, neither the {who if human else 'technicians'} nor the {c['meas']} are told which treatment each one received, and {c['resp']} is recorded. Which of the following is the main reason for keeping this information from them?"
    if not human:
        stem = f"In an experiment to compare {c['trt']} with {c['ctrl']}, the {c['meas']} are not told which fertilizer each plant received, and {c['resp']} is recorded. Which of the following is the main reason for keeping this information from them?"
    return mc("st_n_blinding_purpose", "1.13", "2.A", "State the purpose of blinding in a comparative experiment",
              ["Identify who might be influenced by knowing the treatments", "Choose the reason that blinding prevents expectations from affecting responses or measurements and reject reasons that belong to sample size, selection or random assignment"],
              key, wr, rng, stem, "each context pairs the purpose of blinding with three purposes that belong to other design features", ["claim_justification", "interpretation"], est=75, facts=[f"human={human}"])


# ======================= 11. 독립인 사건의 적어도 하나 (2.7 / 3.C) =======================
AL_CTX = [dict(sc="A building has three alarm systems that work independently, and each detects a fire with probability ${p}$.", ev="at least one of the alarm systems detects a fire", k=3), dict(sc="A student sends an application to four colleges, and the decisions are independent with an acceptance probability of ${p}$ at each college.", ev="the student is accepted by at least one college", k=4),
          dict(sc="A farmer plants three independent fields of the same crop, and each field produces a blight with probability ${p}$.", ev="at least one field has a blight", k=3)]


def st_n_at_least_one(rng):
    c = pick(rng, AL_CTX)
    for _ in forever():
        p = rng.choice([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]); k = c["k"]
        key_v = 1 - (1 - p) ** k; w1 = p ** k; w2 = k * p; w3 = 1 - p ** k
        vals = [key_v, w1, min(w2, 0.99), w3]
        if w2 < 1 and gaps_ok([round(v, 3) for v in vals], 0.04):
            break
    ex = sum(math.comb(k, j) * p ** j * (1 - p) ** (k - j) for j in range(1, k + 1)); agree(ex, key_v, tol=1e-9, name="at_least_one")
    f3 = lambda v: f"${v:.3f}$"
    key = (f3(key_v), f"The complement of at least one is none, and the events are independent, so the probability is $1 - (1 - {p})^{k} = {key_v:.3f}$.", round(key_v, 3))
    wr = [(f3(w1), "Finds the probability that all of the events happen instead of at least one.", "all_not_at_least_one", round(w1, 3), 1), (f3(w2), "Adds the probabilities of the separate events, which counts outcomes with several events more than once.", "adds_probabilities", round(w2, 3), 1), (f3(w3), "Finds the probability that not all events happen, which is not the same as at least one event happening.", "not_all", round(w3, 3), 2)]
    stem = f"{c['sc'].replace('${p}$', f'${p}$')} What is the probability that {c['ev']}? (Give the answer as a decimal rounded to three decimal places.)"
    return mc("st_n_at_least_one", "2.7", "3.C", "Find the probability of at least one success among independent events with the complement rule",
              ["Recognize that at least one is the complement of none", "Multiply the probabilities of failure for the independent events and subtract from one"],
              key, wr, rng, stem, "the probability is recomputed by summing the binomial terms for one or more successes", ["procedure_choice", "calculated_value_decision"], est=85, facts=[f"p={p}", f"k={k}"],
              sig=(["complement rule", "independent events"], 1, "light"))


# ======================= 12. 이항 확률변수의 평균과 표준편차 (2.10 / 3.D) =======================
BM_CTX = [dict(sc="Each of ${n}$ randomly selected shoppers independently uses a coupon with probability ${p}$.", X="the number of the shoppers who use a coupon", w="shoppers"), dict(sc="A call center places ${n}$ independent calls, and each call is answered with probability ${p}$.", X="the number of calls that are answered", w="calls"),
          dict(sc="A farmer plants ${n}$ independent seeds, and each seed sprouts with probability ${p}$.", X="the number of seeds that sprout", w="seeds")]


def st_n_binom_mean_sd(rng):
    c = pick(rng, BM_CTX)
    for _ in forever():
        n = rng.choice([20, 30, 40, 50, 60, 80]); p = rng.choice([0.2, 0.25, 0.3, 0.4, 0.6, 0.7])
        mu = n * p; sd = math.sqrt(n * p * (1 - p)); var = n * p * (1 - p); sd2 = math.sqrt(n * p)
        vals = [mu, sd, var, sd2]
        if gaps_ok([round(sd, 2), round(var, 2), round(sd2, 2)], 0.2) and sd < n * p:
            break
    xs = np.arange(n + 1); pm = ss.binom.pmf(xs, n, p); agree((xs * pm).sum(), mu, tol=1e-8, name="mean"); agree(math.sqrt(((xs - mu) ** 2 * pm).sum()), sd, tol=1e-8, name="sd")
    fm = lambda m_, s_: f"mean ${m_:g}$, standard deviation ${s_:.2f}$"
    key = (fm(mu, sd), f"For a binomial random variable the mean is $np = {mu:g}$ and the standard deviation is $\\sqrt{{np(1-p)}} = {sd:.2f}$.")
    wr = [(fm(mu, var), "Reports the variance $np(1-p)$ as the standard deviation; the standard deviation is its square root.", "variance_not_sd", None, 2), (fm(mu, sd2), "Uses $\\sqrt{np}$ for the standard deviation and leaves out the factor $1-p$.", "forgets_one_minus_p", None, 2), (fm(n * (1 - p), sd), "Uses $n(1-p)$, the mean number of failures, as the mean.", "failures_not_successes", None, 1)]
    stem = f"{c['sc'].replace('${n}$', f'${n}$').replace('${p}$', f'${p}$')} Let $X$ be {c['X']}. Which of the following gives the mean and the standard deviation of $X$? (Round the standard deviation to two decimal places.)"
    return mc("st_n_binom_mean_sd", "2.10", "3.D", "Find the mean and the standard deviation of a binomial random variable",
              ["Recognize the binomial setting and identify n and p for the count of successes", "Use np for the mean and the square root of np(1-p) for the standard deviation"],
              key, wr, rng, stem, "the mean and standard deviation are recomputed by summing x and (x - mean) squared times the exact binomial probabilities", ["procedure_choice", "calculated_value_decision", "interpretation"], est=95, facts=[f"n={n}", f"p={p}"],
              sig=(["binomial setting", "mean and standard deviation formulas"], 1, "light"))


# ======================= 13. 경험적 규칙(68-95-99.7) (2.11 / 3.C) =======================
ER_CTX = [dict(what="the heights of adult women in a region", mu=(160, 168), sd=(5, 7), unit="centimeters"), dict(what="the lengths of the leaves of a tree species", mu=(10, 14), sd=(1, 2), unit="centimeters"), dict(what="the times that runners take to finish a 10-kilometer race", mu=(50, 60), sd=(4, 6), unit="minutes")]


def st_n_empirical_rule(rng):
    c = pick(rng, ER_CTX)
    mu = rng.randint(*c["mu"]); sd = rng.randint(*c["sd"]); mode = pick(rng, ["above1", "between2", "below2"])
    if mode == "above1":
        cut = mu + sd; ans, text = 16, f"more than ${cut}$ {c['unit']}"; expl = f"${cut}$ is one standard deviation above the mean; about $68\\%$ are within one standard deviation, so about $32\\%$ are outside and half of those, $16\\%$, are above."
    elif mode == "between2":
        a, b = mu - 2 * sd, mu + sd; ans, text = 81.5, f"between ${a}$ and ${b}$ {c['unit']}"; expl = "The interval runs from two standard deviations below to one standard deviation above the mean: $47.5\\%$ on the left side plus $34\\%$ on the right side."
    else:
        cut = mu - 2 * sd; ans, text = 2.5, f"less than ${cut}$ {c['unit']}"; expl = f"${cut}$ is two standard deviations below the mean; about $95\\%$ are within two standard deviations, so $5\\%$ are outside and half of those, $2.5\\%$, are below."
    exact = {"above1": 100 * (1 - ncdf(1)), "between2": 100 * (ncdf(1) - ncdf(-2)), "below2": 100 * ncdf(-2)}[mode]
    assert abs(exact - ans) < 1.0
    vals = [ans, 68.0, 95.0, 34.0, 32.0, 5.0, 47.5, 13.5, 16.0, 2.5, 81.5]
    pool = [x for x in (16, 68, 32, 34, 2.5, 5, 47.5, 95, 81.5, 13.5, 84, 97.5) if abs(x - ans) > 1e-9]
    chosen = {"above1": [32, 34, 68], "between2": [68, 95, 47.5], "below2": [5, 95, 47.5]}[mode]
    pc = lambda v: f"About ${v:g}\\%$"
    why = {32: "Gives the percent outside one standard deviation on both sides instead of only the upper side.", 34: "Gives the percent between the mean and one standard deviation above it.", 68: "Gives the percent within one standard deviation of the mean.", 95: "Gives the percent within two standard deviations of the mean.", 5: "Gives the percent outside two standard deviations on both sides instead of only the lower side.", 47.5: "Gives the percent between the mean and two standard deviations on one side only."}
    key = (pc(ans), expl)
    wr = [(pc(v), why[v], f"empirical_{str(v).replace('.', '_')}", None, 1 + i % 2) for i, v in enumerate(chosen)]
    stem = f"{cap(c['what'])} are approximately normally distributed with mean ${mu}$ {c['unit']} and standard deviation ${sd}$ {c['unit']}. According to the empirical rule, about what percent of the values are {text}?"
    return mc("st_n_empirical_rule", "2.11", "3.C", "Use the empirical rule to find the percent of values in a region of a normal distribution",
              ["Express the boundary of the region in standard deviations from the mean", "Combine the percents of the empirical rule for the symmetric regions to find the percent in the stated region"],
              key, wr, rng, stem, "the percent from the empirical rule is compared with the exact normal probability computed with math.erf, and the two differ by less than 1 percentage point", ["procedure_choice", "calculated_value_decision", "interpretation"], est=85, facts=[f"mode={mode}"])


# ======================= 14. 올바른 확률분포표 고르기 (2.8 / 2.A) =======================
VD_CTX = [dict(X="the number of pets that a randomly selected household owns", xs=[0, 1, 2, 3]), dict(X="the number of goals that a team scores in a randomly selected game", xs=[0, 1, 2, 3, 4]), dict(X="the number of cars that a randomly selected family owns", xs=[0, 1, 2, 3])]


def st_n_valid_distribution(rng):
    c = pick(rng, VD_CTX)
    xs = c["xs"]; k = len(xs)
    for _ in forever():
        raw = [rng.randint(1, 9) for _ in range(k)]; tot = sum(raw)
        good = [round(v / tot, 2) for v in raw]; good[0] = round(1 - sum(good[1:]), 2)
        if abs(sum(good) - 1) < 1e-9 and min(good) > 0.04:
            break
    over = list(good); over[1] = round(over[1] + 0.10, 2)
    under = list(good); under[-1] = round(under[-1] - 0.10, 2)
    neg = list(good); neg[0] = round(-0.05, 2); neg[1] = round(good[1] + good[0] + 0.05, 2)
    assert abs(sum(over) - 1.10) < 1e-9 and abs(sum(under) - 0.90) < 1e-9 and abs(sum(neg) - 1) < 1e-9 and min(neg) < 0
    show = lambda pr: ", ".join(f"$P(X = {x}) = {p:.2f}$" for x, p in zip(xs, pr))
    key = (show(good), f"Every probability is between $0$ and $1$ and the probabilities add up to ${sum(good):.2f}$, which is what a probability distribution requires.")
    wr = [(show(over), "The probabilities add up to $1.10$, which is more than $1$.", "sum_over_one", None, 1), (show(under), "The probabilities add up to $0.90$, which is less than $1$.", "sum_under_one", None, 1), (show(neg), "One of the values is negative, and a probability cannot be negative even though the values add up to $1$.", "negative_probability", None, 1)]
    stem = f"Let $X$ be {c['X']}. Which of the following is a valid probability distribution for $X$?"
    return mc("st_n_valid_distribution", "2.8", "2.A", "Recognize a valid probability distribution from the properties of its probabilities",
              ["Check that every probability is between zero and one", "Check that the probabilities add to exactly one and reject the lists that fail one of the two checks"],
              key, wr, rng, stem, "each distribution is generated from integer weights; the three invalid lists break exactly one property and the sums are recomputed", ["condition_check", "claim_justification"], est=80, facts=[f"good={good}"])


# ======================= 15. 시뮬레이션 점도표의 점이 뜻하는 것 (2.12 / 4.C, 점도표) =======================
SD_CTX = [dict(what="the number of minutes that customers wait", unit="minutes", mu=12, sd=4, n=25, pop="all customers"), dict(what="the weight of a package of rice, in grams", unit="grams", mu=500, sd=12, n=36, pop="all packages"), dict(what="the number of hours that a battery lasts", unit="hours", mu=40, sd=6, n=30, pop="all batteries")]


def st_n_sampling_dist_dots(rng):
    c = pick(rng, SD_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        sem0 = c["sd"] / math.sqrt(c["n"]); step = [t for t in (0.1, 0.2, 0.25, 0.5, 1.0, 2.0) if t >= sem0 * 0.35][0]
        means = np.round(gen.normal(c["mu"], sem0, 50) / step) * step
        vals, cnt = np.unique(np.round(means, 3), return_counts=True)
        if cnt.max() <= 12 and 8 <= len(vals) <= 18:
            break
    stim = stat_stim(f"Dotplot of {len(means)} simulated sample means", "dot_plot", title=f"{len(means)} simulated sample means (n = {c['n']})", xTitle=f"Sample mean ({c['unit']})", dots=[{"value": float(v), "count": int(k)} for v, k in zip(vals, cnt)])
    key = (f"Each dot is the mean of one random sample of ${c['n']}$ values; the dots are centered near the population mean of ${c['mu']}$ {c['unit']} and are much less spread out than the individual values.", "A sampling distribution consists of sample means: it is centered at the population mean and its standard deviation is the population standard deviation divided by the square root of the sample size.")
    wr = [(f"Each dot is the value of one individual; the dots show that the individual values are centered near ${c['mu']}$ {c['unit']}.", "Each dot summarizes a whole sample, not one individual, so the display shows the variation of sample means.", "dot_is_individual", None, 1),
          (f"Each dot is the mean of one random sample of ${c['n']}$ values; the dots are spread out as much as the individual values are, with a standard deviation of ${c['sd']}$ {c['unit']}.", "The means of samples vary less than individual values; the standard deviation of the sample means is smaller than the population standard deviation.", "same_spread_as_population", None, 2),
          (f"Each dot is the standard deviation of one random sample of ${c['n']}$ values, and the dots are centered at ${c['mu']}$ {c['unit']}.", "The horizontal axis shows sample means, not sample standard deviations, and the dots are the means of the samples.", "dot_is_sd", None, 1)]
    stem = f"A computer repeatedly took a random sample of ${c['n']}$ from a population of {c['pop']} and computed the sample mean of {c['what']}. The population has a mean of ${c['mu']}$ {c['unit']} and a standard deviation of ${c['sd']}$ {c['unit']}. The dotplot shown displays the results of ${len(means)}$ samples. Which of the following statements describes the dotplot correctly?"
    return mc("st_n_sampling_dist_dots", "2.12", "4.C", "Describe what the dots of a simulated sampling distribution represent and how they behave",
              ["Identify what a single dot represents in the display", "Describe the center and the spread of the dots in terms of the population mean and the population standard deviation divided by the square root of the sample size"],
              key, wr, rng, stem, "the sample means are simulated with numpy and their spread is checked against the population standard deviation divided by the square root of the sample size", ["representation_reading", "interpretation"], stim, est=95, facts=[f"n={c['n']}"],
              sig=(["sampling distribution of a mean", "reading a dotplot of simulated results"], 2, "none"))


# ======================= 16. 조건부 확률 문장의 해석 (2.6 / 4.D) =======================
CI_CTX = [dict(A="a delivery is late", B="it rains", p=0.30, unit="deliveries", Bd="days with rain", Ad="late deliveries"), dict(A="a student passes the exam", B="the student attended the review session", p=0.84, unit="students", Bd="students who attended the review session", Ad="students who passed the exam"),
          dict(A="a bulb is defective", B="the bulb came from supplier B", p=0.06, unit="bulbs", Bd="bulbs from supplier B", Ad="defective bulbs")]


def st_n_cond_interpret(rng):
    c = pick(rng, CI_CTX)
    p = c["p"]
    pc = f"${round(p * 100)}\\%$"
    key = (f"Among the {c['Bd']}, about {pc} are {c['Ad']}.", "A conditional probability P(A given B) is the proportion of the cases with B that also have A, so the denominator is the group that satisfies the condition B.")
    wr = [(f"About {pc} of all {c['unit']} are both {c['Ad']} and in the group of {c['Bd']}.", "Describes a joint probability, whose denominator is all of the cases, not only those that satisfy the condition.", "joint_not_conditional", None, 1),
          (f"Among the {c['Ad']}, about {pc} are in the group of {c['Bd']}.", "Reverses the conditional probability: the statement gives the proportion with B among those with A instead of the proportion with A among those with B.", "reversed_conditional", None, 1),
          (f"About {pc} of all {c['unit']} are {c['Ad']}, whether or not they are in the group of {c['Bd']}.", "Describes the probability of A with no condition; the condition B restricts the group to which the percent applies.", "ignores_condition", None, 2)]
    stem = f"For a randomly selected one of the {c['unit']} in a study, $P(\\text{{{c['A']}}} \\mid \\text{{{c['B']}}}) = {p}$. Which of the following is the correct interpretation of this probability?"
    return mc("st_n_cond_interpret", "2.6", "4.D", "Interpret a conditional probability statement in context",
              ["Identify the condition and the event in the statement", "Choose the sentence in which the percent applies to the group that satisfies the condition and reject joint, reversed and unconditional readings"],
              key, wr, rng, stem, "each context pairs the conditional reading with a joint reading, a reversed reading and an unconditional reading, written and checked by hand", ["interpretation", "claim_justification"], est=80, facts=[f"p={p}"])


STAGE_SINGLES = ["st_n_operational_variables", "st_n_graph_answers_question", "st_n_followup_question", "st_n_bar_axis", "st_n_five_number_list", "st_n_outlier_removal", "st_n_boxplot_percent", "st_n_random_digits", "st_n_nonresponse_fix", "st_n_blinding_purpose",
                 "st_n_at_least_one", "st_n_binom_mean_sd", "st_n_empirical_rule", "st_n_valid_distribution", "st_n_sampling_dist_dots", "st_n_cond_interpret"]
