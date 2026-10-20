"""AP Statistics 연습 시험 3(2026-10-19 추가 라운드) 단독 MC 원형 — 단원 1·2. 기존 공개 세트(ST1·ST2)의 풀이 틀(표본 추출법 이름 대기, 이상치 울타리, 이항 정확 확률, 조건부 확률 표 등)을 쓰지 않는다.
정답·수치는 코드가 계산하고 독립 경로(분수·전수 열거·math.erf 이분법·수치 적분)로 다시 계산한다. 해석·설계 문항은 고정 문장 4개(정답 1 + 이름 붙은 오해 3). 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def cap(s):
    return s[0].upper() + s[1:]


# ======================= 1. 자료에 기록된 변수로 답할 수 있는 조사 질문 (1.10 / 1.A, 표) =======================
TV_CTX = [
    dict(who="visitors", place="a county park", vars=[("Age group", "child, teen, adult or senior"), ("Minutes in the park", "a number of minutes"), ("Brought a dog", "yes or no")],
         key="Do visitors who brought a dog tend to stay in the park longer than visitors who did not?", noinfo="Do visitors who live closer to the park tend to stay longer than visitors who live farther away?",
         indiv="How many minutes did the first visitor on the list spend in the park?", opin="Is a larger dog area a better use of park funds than a new playground?"),
    dict(who="riders", place="a commuter rail line", vars=[("Ticket type", "single trip, weekly or monthly"), ("Minutes waiting", "a number of minutes"), ("Boarding station", "one of five stations")],
         key="Do riders with monthly tickets tend to wait for a different number of minutes than riders with single-trip tickets?", noinfo="Do riders who travel with children tend to wait longer than riders who travel alone?",
         indiv="How many minutes did the rider who boarded last on Monday wait?", opin="Should the rail line replace single-trip tickets with monthly tickets?"),
    dict(who="patients", place="a regional clinic", vars=[("Appointment type", "checkup or follow-up"), ("Minutes in waiting room", "a number of minutes"), ("Arrived early", "yes or no")],
         key="Do patients who arrived early tend to spend less time in the waiting room than patients who did not?", noinfo="Do patients with more years of education tend to spend less time in the waiting room?",
         indiv="How many minutes did the patient with the first appointment of the day spend in the waiting room?", opin="Is it fair that patients who arrive early receive the first appointments?"),
]


def st_n_iq_table_vars(rng):
    c = pick(rng, TV_CTX)
    n = pick(rng, [60, 80, 100, 120, 150])
    stim = stat_stim(f"Variables recorded for each of {n} {c['who']}", "table", title=f"Variables recorded for each of {n} randomly selected {c['who']}", columns=["Variable", "Possible values"], rows=[[a, b] for a, b in c["vars"]])
    key = (c["key"], "It asks about two recorded variables for the whole population of " + c["who"] + ", and the answer varies from one individual to the next, so it can be answered by analyzing these data.")
    wr = [(c["noinfo"], "It needs a variable that was not recorded, so the table cannot be used to answer it.", "variable_not_recorded"),
          (c["indiv"], "It asks about one individual rather than a population, so no variability is studied.", "single_individual"),
          (c["opin"], "It asks for a judgment of value that data on these variables cannot settle.", "opinion")]
    stem = f"{cap(c['place'])} collected data from a random sample of ${n}$ {c['who']}. The table shown lists the variables recorded for each one. Which of the following is an investigative question that these data can be used to answer?"
    return mc("st_n_iq_table_vars", "1.10", "1.A", "Select the investigative question that the recorded variables can answer",
              ["Read which variables the table records for each individual", "Reject questions that need an unrecorded variable, concern one individual or ask for an opinion, and keep the one about recorded variables across the population"],
              key, wr, rng, stem, "each context lists exactly three recorded variables and four questions, of which exactly one uses only recorded variables for a population", ["representation_reading", "claim_justification"], stim, est=70, facts=[f"n={n}"])


# ======================= 2. 통계적 질문 가려내기 (1.1 / 1.A) =======================
SN_CTX = [
    dict(stat="How much do the daily numbers of steps vary among the adult residents of a city?", lookup="How many days are there in a leap year?", calc="If each of 4 walkers takes 8,000 steps in a day, how many steps do the walkers take altogether?", opin="Is walking a more enjoyable exercise than swimming?", pop="residents of a city"),
    dict(stat="How much do the weights of the loaves produced by a bakery on one day vary?", lookup="What is the legal minimum weight for a loaf of bread sold in the state, according to the state's regulations?", calc="If each of 12 loaves weighs 500 grams, what is the total weight of the loaves?", opin="Is rye bread tastier than wheat bread?", pop="loaves"),
    dict(stat="How does the number of books borrowed in a month vary among the members of a public library?", lookup="In what year was the first public library in the country opened?", calc="If 5 members each borrow 3 books, how many books were borrowed in all?", opin="Is reading a novel better than reading a newspaper?", pop="members of a library"),
]


def st_n_stat_vs_nonstat(rng):
    c = pick(rng, SN_CTX)
    wr_all = [(c["lookup"], "It has a single factual answer that can be looked up, so no variability among individuals is anticipated.", "lookup"),
              (c["calc"], "It is answered by a fixed calculation with the given numbers, so no data have to be collected and analyzed.", "arithmetic"),
              (c["opin"], "It asks for a preference or judgment, which data on a measured variable cannot settle.", "opinion")]
    key = (c["stat"], "It asks about a variable that takes different values for different individuals in a population, so it is answered by collecting and analyzing data.")
    stem = "A teacher asks students to write a question that requires a statistical investigation. Which of the following questions does so?"
    return mc("st_n_stat_vs_nonstat", "1.1", "1.A", "Recognize a question that anticipates variability and can be answered with data",
              ["Ask of each question whether its answer would be the same every time or would vary among the individuals studied", "Keep only the question about a measurable variable across a population and reject lookups, fixed calculations and opinions"],
              key, wr_all, rng, stem, "every context pairs one question about a varying measurement with a lookup, a fixed calculation and an opinion, written and checked by hand", ["claim_justification", "interpretation"], est=60)


# ======================= 3. 질문에 맞는 자료 수집 방식 (1.10 / 1.A) =======================
QD_CTX = [
    dict(q="Does a new fertilizer increase the mean yield of tomato plants compared with the standard fertilizer?", pop="a farm's tomato plants", key="A randomized experiment in which plants are randomly assigned to the new or the standard fertilizer", kind="exp"),
    dict(q="What proportion of the households in a town have a rain barrel?", pop="a town's households", key="A sample survey of households chosen at random from a list of the households in the town", kind="svy"),
    dict(q="Do adults who drink coffee every day tend to have a different resting heart rate than adults who do not drink coffee?", pop="adults in a city", key="An observational study that compares the resting heart rates of randomly selected adults who do and do not drink coffee daily", kind="obs"),
    dict(q="Does a new reading app improve the mean reading score of second graders compared with the usual lessons?", pop="second graders in a district", key="A randomized experiment in which second graders are randomly assigned to use the app or to have the usual lessons", kind="exp"),
]
QD_OPT = {"exp": "A randomized experiment that assigns the individuals at random to the treatments being compared", "svy": "A sample survey of randomly selected individuals from the population", "obs": "An observational study that compares randomly selected individuals who already belong to each group"}
QD_BAD = {
    "exp": {"svy": "A sample survey cannot show that a treatment causes a change because no treatment is imposed on the individuals.", "obs": "Comparing individuals who chose their own groups leaves other differences between the groups that can explain the result."},
    "svy": {"exp": "No treatments are being compared in the question, so an experiment is not needed to estimate a proportion.", "obs": "No groups are being compared in the question, so a comparison of existing groups does not estimate the single proportion."},
    "obs": {"exp": "Assigning people to drink coffee or not is not needed to describe a difference between existing groups, and the question asks only whether the groups tend to differ.", "svy": "One proportion from a single group does not compare the two groups that the question asks about."},
}


def st_n_question_design_match(rng):
    c = pick(rng, QD_CTX)
    k = c["kind"]
    texts = {"exp": "A randomized experiment in which the individuals are assigned at random to the treatments", "svy": "A sample survey of randomly selected individuals from the population", "obs": "An observational study comparing randomly selected individuals who already belong to each group"}
    key = (texts[k], {"exp": "The question asks whether a treatment changes a response, and only random assignment of the treatments supports a cause-and-effect answer.", "svy": "The question asks for the value of a single proportion in the population, which a random sample estimates.", "obs": "The question asks whether two existing groups tend to differ, which random samples from each group can answer without imposing treatments."}[k])
    others = [t for t in texts if t != k]
    wr = [(texts[o], QD_BAD[k][o], "design_" + o) for o in others]
    wr.append(("A census of every individual in the population, because only a census can answer a question about a population", "A well-designed random sample answers questions about a population without measuring everyone, and a census is not required.", "census_required"))
    stem = f"A researcher wants to answer the following investigative question about {c['pop']}: \"{c['q']}\" Which of the following methods of collecting data is best suited to answering the question?"
    return mc("st_n_question_design_match", "1.10", "1.A", "Match an investigative question to the type of data collection that can answer it",
              ["Decide whether the question compares treatments that can be assigned, compares existing groups or estimates one quantity", "Choose the data collection method that fits that purpose and reject the methods whose conclusions go beyond what they can support"],
              key, wr, rng, stem, "each question is paired with one of three design types by whether it asks about an imposed treatment, a comparison of existing groups, or a single proportion", ["claim_justification", "procedure_choice"], est=75, facts=[f"kind={k}"])


# ======================= 4. 크기가 다른 두 집단의 범주 분포 비교 (1.3 / 4.A, 표) =======================
BC_CTX = [
    dict(unit="students", g=("Morning session", "Evening session"), cats=("Walk", "Bike", "Bus"), top="Bus", what="usual way of getting to the session"),
    dict(unit="members", g=("Downtown branch", "Suburban branch"), cats=("Fiction", "Nonfiction", "Magazines"), top="Fiction", what="kind of material borrowed most often"),
    dict(unit="campers", g=("June camp", "August camp"), cats=("Hiking", "Swimming", "Crafts"), top="Swimming", what="favorite activity"),
]


def st_n_cat_compare_totals(rng):
    c = pick(rng, BC_CTX)
    ti = c["cats"].index(c["top"])
    for _ in forever():
        n1 = rng.randint(90, 150); n2 = rng.randint(220, 340)
        f1 = rng.uniform(0.38, 0.55); f2 = rng.uniform(0.25, 0.37)
        a1 = int(round(n1 * f1)); a2 = int(round(n2 * f2))
        if a2 > a1 and a1 / n1 - a2 / n2 > 0.07:
            break
    def mkrow(tot, a):
        r = [0, 0, 0]; r[ti] = a; rest = tot - a; o = [i for i in range(3) if i != ti]
        r[o[0]] = rest // 2; r[o[1]] = rest - rest // 2
        return r
    row1 = mkrow(n1, a1); row2 = mkrow(n2, a2)
    assert sum(row1) == n1 and sum(row2) == n2
    p1, p2 = Fr(row1[ti], n1), Fr(row2[ti], n2)
    assert p1 > p2 and row2[ti] > row1[ti]
    stim = stat_stim(f"Counts of {c['unit']} by {c['what']} for two groups", "table", title="Counts by category for the two groups", columns=["Group", *c["cats"], "Total"], rows=[[c["g"][0], *row1, n1], [c["g"][1], *row2, n2]])
    g1n, g2n = c["g"]
    key = (f"A larger percentage of the {g1n.lower()} {c['unit']} than of the {g2n.lower()} {c['unit']} chose {c['top'].lower()}.", f"The relative frequency is ${row1[ti]}/{n1} \\approx {float(p1) * 100:.1f}\\%$ in the first group and ${row2[ti]}/{n2} \\approx {float(p2) * 100:.1f}\\%$ in the second group, so the first percentage is larger.")
    wr = [(f"More {c['unit']} chose {c['top'].lower()} in the {g2n.lower()} than in the {g1n.lower()}, so {c['top'].lower()} is more popular in the {g2n.lower()}.", "Compares counts although the two groups have different totals; the groups have to be compared by relative frequency.", "counts_not_percents", None, 1),
          (f"The {g1n.lower()} and the {g2n.lower()} are equally likely to choose {c['top'].lower()}, because both groups have the same three choices.", "Having the same categories does not make the relative frequencies equal; they are different in the table.", "same_categories", None, 2),
          (f"The percentage choosing {c['top'].lower()} is greater in the {g2n.lower()}, because its total is greater than the total of the {g1n.lower()}.", "Uses the larger group total as if it raised the percentage; the percentage is the count divided by the group's own total.", "bigger_group_bigger_percent", None, 2)]
    stem = f"A survey recorded the {c['what']} of {c['unit']} in two groups. The table shown gives the counts. Which of the following statements is supported by the table?"
    return mc("st_n_cat_compare_totals", "1.3", "4.A", "Compare two categorical distributions with different totals by relative frequency",
              ["Notice that the two groups have different totals", "Convert each group's count to a percentage of its own total and compare the percentages"],
              key, wr, rng, stem, "the generator accepts a case only if the larger count is in the group with the smaller relative frequency, and recomputes both fractions exactly", ["representation_reading", "claim_justification"], stim, est=75, facts=[f"rows={row1},{row2}"],
              sig=(["relative frequency from counts", "comparing two groups"], 1, "light"))


# ======================= 5. 일차 변환 뒤의 평균·표준편차 (1.7 / 3.B) =======================
LT_CTX = [dict(thing="quiz scores", unit="points", cur="a teacher multiplies each score by ${a}$ and then adds ${b}$ points", base=(50, 90, 6, 14)),
          dict(thing="the lengths of rope pieces", unit="centimeters", cur="a worker records each length on a new scale that is ${a}$ times the old scale plus ${b}$ centimeters", base=(80, 140, 8, 22)),
          dict(thing="the daily wages of workers", unit="dollars", cur="a company multiplies each wage by ${a}$ and then adds a flat bonus of ${b}$ dollars", base=(90, 160, 10, 30))]


def st_n_linear_transform(rng):
    c = pick(rng, LT_CTX)
    a = pick(rng, [2, 3, 1.5, 0.8]); b = pick(rng, [5, 8, 10, 12])
    m0 = rng.randint(c["base"][0], c["base"][1]); s0 = rng.randint(c["base"][2], c["base"][3])
    m1, s1 = a * m0 + b, a * s0
    # 독립 경로: 합성 자료(두 값)의 일차 변환을 직접 계산
    xs = [m0 - s0, m0 + s0]; ys = [a * x + b for x in xs]
    agree(sum(ys) / 2, m1, name="mean"); agree(abs(ys[1] - ys[0]) / 2, s1, name="sd")
    fmt = lambda x: f"${x:g}$"
    key = (f"mean {fmt(m1)} {c['unit']}, standard deviation {fmt(s1)} {c['unit']}", "Multiplying by a multiplies the mean and the standard deviation by a, and adding b shifts the mean by b but does not change the spread.")
    cand = [(f"mean {fmt(a * m0)} {c['unit']}, standard deviation {fmt(a * s0)} {c['unit']}", "Forgets to add the constant to the mean.", "shift_ignored", 1),
            (f"mean {fmt(a * m0 + b)} {c['unit']}, standard deviation {fmt(a * s0 + b)} {c['unit']}", "Adds the constant to the standard deviation, but adding a constant does not change the spread.", "shift_changes_spread", 2),
            (f"mean {fmt(a * m0 + b)} {c['unit']}, standard deviation {fmt(s0)} {c['unit']}", "Leaves the standard deviation unchanged, but multiplying by a constant multiplies the spread by that constant.", "scale_ignored", 2),
            (f"mean {fmt(m0 + b)} {c['unit']}, standard deviation {fmt(a * s0)} {c['unit']}", "Adds the constant to the original mean without multiplying the mean by the factor first.", "mean_not_scaled", 1)]
    cand = [x for x in cand if x[0] != key[0]]
    wr = [(t, w, mid, None, st) for t, w, mid, st in cand[:3]]
    nn = rng.choice([20, 24, 30, 36])
    stem = f"The mean of {nn} {c['thing']} is ${m0}$ {c['unit']} and the standard deviation is ${s0}$ {c['unit']}. Then {c['cur'].format(a=f'{a:g}', b=b)}. Which of the following gives the mean and the standard deviation of the new values?"
    return mc("st_n_linear_transform", "1.7", "3.B", "Find the mean and standard deviation after multiplying by a constant and adding a constant",
              ["Apply both the multiplication and the addition to the mean", "Recognize that only the multiplication changes the standard deviation"],
              key, wr, rng, stem, "the new mean and spread are recomputed from two synthetic values whose mean and standard deviation equal the given summary", ["procedure_choice", "calculated_value_decision", "interpretation"], est=80, facts=[f"a={a}", f"b={b}"],
              sig=(["effect of a linear change on a mean", "effect of a linear change on a standard deviation"], 1, "light"))


# ======================= 6. 히스토그램의 모양과 중심 측도 선택 (1.6 / 4.C, 히스토그램) =======================
HS_CTX = [dict(what="the number of minutes that patients waited to see a nurse", unit="minutes", lo=0, w=10), dict(what="the weekly amounts of rainfall at a station, in millimeters", unit="millimeters", lo=0, w=5),
          dict(what="the number of seconds that visitors stayed at an exhibit", unit="seconds", lo=0, w=20)]
SHAPES = {"right": "skewed to the right", "left": "skewed to the left", "sym": "roughly symmetric with one peak", "bi": "bimodal, with two separate peaks"}


def _hist_counts(shape, rng):
    base = {"right": [10, 26, 20, 14, 10, 8, 6, 4, 3, 2], "left": [2, 3, 4, 6, 8, 10, 14, 20, 26, 10], "sym": [2, 6, 14, 24, 30, 24, 14, 6, 2], "bi": [10, 24, 14, 4, 4, 14, 24, 10]}[shape]
    return [max(1, v + rng.randint(-1, 1)) for v in base]


def st_n_hist_shape_center(rng):
    c = pick(rng, HS_CTX)
    shape = pick(rng, list(SHAPES))
    counts = _hist_counts(shape, rng)
    w = c["w"]; bins = [{"from": c["lo"] + w * i, "to": c["lo"] + w * (i + 1), "count": v} for i, v in enumerate(counts)]
    # 독립 경로: 구간 중점 자료로 모양을 판정(봉우리 수·평균과 중앙값의 위치)
    data = [c["lo"] + w * i + w / 2 for i, v in enumerate(counts) for _ in range(v)]
    mean = sum(data) / len(data); srt = sorted(data); med = srt[len(srt) // 2] if len(srt) % 2 else (srt[len(srt) // 2 - 1] + srt[len(srt) // 2]) / 2
    peaks = sum(1 for i in range(len(counts)) if (i == 0 or counts[i] > counts[i - 1]) and (i == len(counts) - 1 or counts[i] > counts[i + 1]) and counts[i] >= 8)
    if shape == "right": assert mean > med + 0.15 * w and peaks == 1
    if shape == "left": assert mean < med - 0.15 * w and peaks == 1
    if shape == "sym": assert abs(mean - med) < 0.15 * w and peaks == 1
    if shape == "bi": assert peaks == 2
    center = {"right": "so the median is a better summary of the typical value than the mean, which the long right tail pulls up", "left": "so the median is a better summary of the typical value than the mean, which the long left tail pulls down",
              "sym": "so the mean and the median are close to each other and either describes the center", "bi": "so a single measure of center does not describe the typical value well"}
    key = (f"The distribution is {SHAPES[shape]}, {center[shape]}.", "The bars rise and fall in the pattern described, and the location of the tail or the peaks determines how the mean and median compare.")
    wr = []
    for s in [x for x in SHAPES if x != shape]:
        wr.append((f"The distribution is {SHAPES[s]}, {center[s]}.", f"Describes a distribution that is {SHAPES[s]}, but the bars of the histogram show a distribution that is {SHAPES[shape]}.", "wrong_shape_" + s))
    wr = [(t, w_, m_, None, 1 + i % 2) for i, (t, w_, m_) in enumerate(wr)]
    stim = stat_stim(f"Histogram of {c['what']}", "histogram", title=f"Frequency histogram ({c['unit']})", xTitle=f"{c['unit'].capitalize()}", yTitle="Frequency", bins=bins)
    stem = f"The histogram shown displays {c['what']} for a random sample of ${sum(counts)}$ observations. Which of the following statements about the distribution is best supported by the histogram?"
    return mc("st_n_hist_shape_center", "1.6", "4.C", "Describe the shape of a histogram and the consequence for the mean and the median",
              ["Read the overall pattern of the bars: the number of peaks and the side with the long tail", "Connect the shape to the position of the mean relative to the median and to the choice of a summary"],
              key, wr, rng, stem, "the shape of the generated counts is verified from midpoint data: the number of peaks and the comparison of the grouped mean with the grouped median must agree with the intended shape", ["representation_reading", "interpretation"], stim, est=80, facts=[f"shape={shape}", f"counts={counts}"])


# ======================= 7. 누적 상대도수표 읽기 (1.8 / 4.C, 표) =======================
CU_CTX = [dict(what="scores on a driving test", unit="points", cuts=(50, 60, 70, 80, 90, 100)), dict(what="ages of the customers of a garden shop", unit="years", cuts=(20, 30, 40, 50, 60, 70)),
          dict(what="commute times of the employees of a hospital", unit="minutes", cuts=(10, 20, 30, 40, 50, 60))]


def st_n_cumulative_table(rng):
    c = pick(rng, CU_CTX)
    cuts = c["cuts"]
    for _ in forever():
        n = rng.choice([200, 250, 500])
        freq = [rng.randint(int(n * 0.07), int(n * 0.30)) for _ in range(5)]
        freq[-1] = n - sum(freq[:-1])
        if 0.07 * n <= freq[-1] <= 0.3 * n:
            break
    cum = [sum(freq[:i + 1]) / n for i in range(5)]
    rows = [[f"Up to {cuts[i + 1]}", f"{cum[i]:.3f}"] for i in range(5)]
    i0 = rng.choice([1, 2])  # 범위: (cuts[i0], cuts[i0 + 2]]
    lo_c, hi_c = cuts[i0], cuts[i0 + 2]
    inside = cum[i0 + 1] - cum[i0 - 1]
    agree(inside, (freq[i0] + freq[i0 + 1]) / n, name="between")
    pct = lambda v: f"${v * 100:.1f}\\%$"
    rg = f"above ${lo_c}$ and at most ${hi_c}$"
    key = (f"About {pct(inside)} of the observations are {rg}.", f"The cumulative relative frequency up to {hi_c} minus the cumulative relative frequency up to {lo_c} is ${cum[i0 + 1]:.3f} - {cum[i0 - 1]:.3f} = {inside:.3f}$.")
    wr = [(f"About {pct(cum[i0 + 1])} of the observations are {rg}.", "Reports the cumulative relative frequency up to the upper value without removing the observations at or below the lower value.", "cumulative_not_interval", None, 2),
          (f"About {pct(1 - cum[i0 - 1])} of the observations are {rg}.", "Gives the proportion of observations above the lower value, which also includes the observations above the upper value.", "above_lower_only", None, 2),
          (f"About {pct(1 - cum[i0 + 1])} of the observations are {rg}.", f"Gives the proportion of observations above {hi_c}, which lies outside the stated interval.", "upper_tail", None, 1)]
    stim = stat_stim(f"Cumulative relative frequencies of {c['what']}", "table", title="Cumulative relative frequencies", columns=[f"Class ({c['unit']})", "Cumulative relative frequency"], rows=rows)
    stem = f"The table shown gives the cumulative relative frequencies for a sample of ${n}$ observations of {c['what']}. Each class includes its upper value. Which of the following statements is supported by the table?"
    return mc("st_n_cumulative_table", "1.8", "4.C", "Find the share of observations between two values from a cumulative relative frequency table",
              ["Identify the two cumulative relative frequencies that bound the interval", "Subtract the lower cumulative value from the upper one and read the result as a percentage"],
              key, wr, rng, stem, "class counts are generated first and the cumulative values are derived; the interval share is recomputed from the class counts directly", ["representation_reading", "claim_justification"], stim, est=85, facts=[f"n={n}", f"i0={i0}"],
              sig=(["cumulative relative frequency", "share between two values"], 1, "light"))


# ======================= 8. 모집단 추정에 알맞은 표본 계획 (1.11 / 2.B) =======================
PL_CTX = [
    dict(pop="the {N} households in a village", est="the proportion of households with a vegetable garden", frame="a complete list of the households",
         key="Number the households on the list from $1$ to ${N}$, use a random number generator to choose ${n}$ different numbers, and survey those households",
         w=["Post the survey on the village's website and use the answers of the households that choose to respond", "Survey the first ${n}$ households that the researcher meets while walking along the main street", "Ask the village council to choose ${n}$ households that it considers typical of the village"]),
    dict(pop="the {N} members of a hiking club", est="the mean number of hikes per year of a member", frame="the membership roster",
         key="Assign each member a number from the roster, select ${n}$ different numbers at random, and ask those members",
         w=["Ask the ${n}$ members who arrive first at the next club meeting", "Send an e-mail to all members and use the first ${n}$ replies", "Ask ${n}$ members whom the club president knows to be frequent hikers"]),
    dict(pop="the {N} students in a school's ninth grade", est="the proportion of students who walk to school", frame="the grade's class roster",
         key="Give each student on the roster a number, draw ${n}$ different numbers using a random number table, and interview those students",
         w=["Interview the ${n}$ students who volunteer to stay after school for an announcement", "Interview the ${n}$ students sitting nearest to the principal's office at lunch", "Interview the ${n}$ students whom the homeroom teachers suggest as typical"]),
]
WHY_PL = ["Volunteers or respondents who choose to reply can differ from the whole population, so the estimate can be biased.", "Selecting the individuals who are easiest to reach leaves out the others and tends to give a biased estimate.", "Selecting individuals that someone considers typical introduces the chooser's judgment and does not give every individual a chance."]


def st_n_plan_unbiased(rng):
    c = pick(rng, PL_CTX)
    N = pick(rng, [240, 360, 480, 600]); n = pick(rng, [30, 40, 50])
    fx = lambda s: s.replace("${N}$", f"${N}$").replace("${n}$", f"${n}$")
    key = (fx(c["key"]) + ".", "Every individual on the complete list has the same chance of being chosen, so the sample tends to represent the whole population.")
    wr = [(fx(t) + ".", WHY_PL[i], ["voluntary", "convenience", "judgment"][i]) for i, t in enumerate(c["w"])]
    stem = f"A researcher wants to estimate {c['est']} among {c['pop'].format(N=N)} and has {c['frame']}. The sample size will be ${n}$. Which of the following plans is most likely to give an estimate that is not biased?"
    return mc("st_n_plan_unbiased", "1.11", "2.B", "Choose the sampling plan that gives every individual a chance and avoids selection bias",
              ["Compare how each plan chooses the individuals and who could be left out", "Select the plan that uses chance with a complete list and reject plans driven by volunteering, convenience or judgment"],
              key, wr, rng, stem, "each context lists one random-selection plan on a complete list and three plans with named selection problems, written and checked by hand", ["claim_justification", "procedure_choice"], est=80, facts=[f"N={N}", f"n={n}"])


# ======================= 9. 표본 편향의 방향 (1.12 / 2.B) =======================
BD_CTX = [
    dict(where="outside a fitness center on Saturday mornings", what="the mean number of hours that adults in the city exercise per week", fact="People who use the fitness center exercise more hours per week, on average, than other adults in the city", dirn="high"),
    dict(where="at the checkout counters of a computer store", what="the proportion of adults in the city who own a laptop", fact="Shoppers at a computer store are more likely to own a laptop than other adults in the city", dirn="high"),
    dict(where="at the entrance of a large discount store on weekday afternoons", what="the mean amount that adults in the town spend on groceries each week", fact="Customers who can shop on weekday afternoons spend less per week on groceries, on average, than other adults in the town", dirn="low"),
    dict(where="from a list of members of a luxury hotel's rewards program", what="the mean number of nights per year that adults in the region spend in hotels", fact="Members of the rewards program stay in hotels more nights per year, on average, than other adults in the region", dirn="high"),
    dict(where="outside the campus health office in the afternoon", what="the proportion of students at the university who have had the flu this year", fact="Students who visit the health office are more likely to have had the flu this year than other students", dirn="high"),
]


def st_n_bias_direction(rng):
    c = pick(rng, BD_CTX)
    hi = c["dirn"] == "high"
    cd = {True: ("tend to be too high", "too large"), False: ("tend to be too low", "too small")}
    opp = "low" if hi else "high"
    key = (f"The estimates will tend to be too {'large' if hi else 'small'}, because the people who are surveyed differ from the population in the direction that raises the result." if hi else "The estimates will tend to be too small, because the people who are surveyed differ from the population in the direction that lowers the result.",
           "The sampled individuals are not representative of the population, and the stated difference shows which way the estimates are pushed.")
    wr = [(f"The estimates will tend to be too {'small' if hi else 'large'}, because the people who are surveyed differ from the population in the direction that {'lowers' if hi else 'raises'} the result.", "Reverses the direction: the individuals who are sampled differ in the opposite way from the one stated.", "direction_reversed", None, 2),
          ("There is no bias, because every adult who is surveyed answers the question honestly.", "Honest answers do not remove selection bias, which comes from who is sampled and not from how the sampled people answer.", "honesty_not_bias", None, 1),
          ("There is no bias, because a large sample always represents the population.", "A large sample does not remove bias from a flawed way of selecting individuals; it only makes the biased estimate more precise.", "size_fixes_bias", None, 1)]
    stem = f"To estimate {c['what']}, a researcher interviews ${rng.choice([200, 300, 400, 500])}$ adults selected {c['where']}. {c['fact']}. Which of the following statements about the estimates from this plan is correct?"
    return mc("st_n_bias_direction", "1.12", "2.B", "Decide the direction of the bias that a flawed way of selecting individuals produces",
              ["Compare the people who can be selected with the whole population on the variable being estimated", "Use the stated difference to decide whether the estimates are pushed up or down, and reject claims that honesty or sample size removes bias"],
              key, wr, rng, stem, "each scenario states how the sampled group differs from the population, so the direction of the bias follows from the statement", ["claim_justification", "interpretation"], est=80, facts=[f"dirn={c['dirn']}"])


# ======================= 10. 요인이 둘인 실험의 실험 단위와 처리 (1.13 / 2.A) =======================
EX_CTX = [dict(unit="pots", unit1="pot", fa=("fertilizer", ["a standard fertilizer", "a new fertilizer", "an organic fertilizer"]), fb=("watering", ["daily", "weekly"]), resp="the height of the plant after six weeks"),
          dict(unit="rats", unit1="rat", fa=("diet", ["a low-fat diet", "a high-fat diet"]), fb=("exercise", ["no wheel", "a wheel for one hour a day", "a wheel for three hours a day"]), resp="the change in body mass after eight weeks"),
          dict(unit="slices of bread", unit1="slice", fa=("storage temperature", ["4 degrees Celsius", "22 degrees Celsius"]), fb=("preservative", ["none", "preservative A", "preservative B"]), resp="the number of days until mold first appears")]


def st_n_factorial_units(rng):
    c = pick(rng, EX_CTX)
    a, b = len(c["fa"][1]), len(c["fb"][1])
    N = a * b * pick(rng, [4, 5, 6])
    key = (f"The experimental units are the ${N}$ {c['unit']}, and there are ${a * b}$ treatments, one for each combination of a level of {c['fa'][0]} with a level of {c['fb'][0]}.", f"Each of the ${a}$ levels of {c['fa'][0]} can be combined with each of the ${b}$ levels of {c['fb'][0]}, which gives ${a} \\times {b} = {a * b}$ treatments.")
    wr = [(f"The experimental units are the ${N}$ {c['unit']}, and there are ${a + b}$ treatments, the ${a}$ levels of {c['fa'][0]} and the ${b}$ levels of {c['fb'][0]} counted separately.", "Adds the numbers of levels; a treatment is a combination of one level of each factor.", "levels_added", None, 1),
          (f"The experimental units are the ${a * b}$ combinations of levels, and the ${N}$ {c['unit']} are the treatments.", "Reverses the roles: the units receive the treatments and the combinations of levels are the treatments.", "roles_reversed", None, 2),
          (f"The experimental units are the measurements of {c['resp']}, and there are ${a * b}$ treatments.", "The measurements are values of the response variable; the experimental units are the individuals that receive the treatments.", "response_as_unit", None, 2)]
    stem = f"An experiment uses ${N}$ {c['unit']}. Each {c['unit1']} is assigned at random to one {c['fa'][0]} condition ({', '.join(c['fa'][1])}) and one {c['fb'][0]} condition ({', '.join(c['fb'][1])}) in such a way that every combination is used equally often, and then {c['resp']} is recorded. Which of the following correctly identifies the experimental units and the treatments?"
    return mc("st_n_factorial_units", "1.13", "2.A", "Identify the experimental units and count the treatments in an experiment with two factors",
              ["Identify the individuals that receive the conditions as the experimental units", "Count the combinations of one level of each factor to find the number of treatments"],
              key, wr, rng, stem, "the number of treatments is the product of the numbers of levels, and the sum, the reversed roles and the response measurements are the named wrong readings", ["procedure_choice", "interpretation"], est=85, facts=[f"a={a}", f"b={b}", f"N={N}"],
              sig=(["experimental units", "treatments formed from two factors"], 1, "light"))


# ======================= 11. 합집합 규칙과 여사건 (2.4 / 3.C) =======================
UN_CTX = [dict(who="households in a town", A="have a dog", B="have a cat"), dict(who="students at a college", A="are enrolled in a biology course", B="are enrolled in a chemistry course"),
          dict(who="members of a gym", A="attend a yoga class", B="attend a spinning class")]


def st_n_union_complement(rng):
    c = pick(rng, UN_CTX)
    for _ in forever():
        a = rng.randint(30, 55) / 100; b = rng.randint(25, 45) / 100; both = rng.randint(8, 20) / 100
        vv = [1 - a - b + both, 1 - a - b, a + b - both, 1 - a * b]
        if both < min(a, b) - 0.05 and a + b - both < 0.9 and min(abs(x - y) for x in vv for y in vv if x is not y) >= 0.03:
            break
    union = a + b - both; neither = 1 - union
    # 독립 경로: 가상 모집단 1000명의 집합 연산
    pop = set(range(1000)); A = set(range(int(a * 1000))); B = set(range(int(a * 1000) - int(both * 1000), int(a * 1000) - int(both * 1000) + int(b * 1000)))
    assert len(A & B) == int(both * 1000)
    agree(len(pop - (A | B)) / 1000, neither, tol=1e-9, name="neither")
    fm = lambda v: f"${v:.2f}$"
    key = (fm(neither), f"The probability of at least one is ${a:.2f} + {b:.2f} - {both:.2f} = {union:.2f}$, and the probability of neither is $1 - {union:.2f} = {neither:.2f}$.", neither)
    wr = [(fm(1 - a - b), "Subtracts the two probabilities from $1$ without adding back the overlap that was counted twice.", "overlap_ignored", 1 - a - b, 1), (fm(union), "Stops at the probability of at least one event and does not take the complement.", "complement_missed", union, 2),
          (fm(1 - a * b), "Treats the events as independent and finds the probability that they do not both happen.", "independence_assumed", 1 - a * b, 1)]
    stem = f"Among the {c['who']}, ${int(round(a * 100))}\\%$ {c['A']}, ${int(round(b * 100))}\\%$ {c['B']}, and ${int(round(both * 100))}\\%$ do both. One is selected at random. What is the probability that the selected one does neither? (Probabilities are given to two decimal places.)"
    return mc("st_n_union_complement", "2.4", "3.C", "Find the probability of neither event from the addition rule for two events that overlap",
              ["Use the addition rule with the overlap to find the probability of at least one of the two events", "Take the complement of that probability to find the probability of neither"],
              key, wr, rng, stem, "the probability of neither is recomputed by counting a synthetic population of 1000 with the stated overlaps", ["procedure_choice", "calculated_value_decision"], est=80, facts=[f"a={a}", f"b={b}", f"both={both}"],
              sig=(["addition rule for overlapping events", "complement rule"], 1, "light"))


# ======================= 12. 상호배타·독립 판정 (2.5 / 4.B) =======================
def st_n_me_independent(rng):
    case = pick(rng, ["me", "ind", "neither"])
    for _ in forever():
        a = rng.randint(2, 6) / 10; b = rng.randint(2, 6) / 10
        both = {"me": 0.0, "ind": round(a * b, 4), "neither": rng.randint(5, 25) / 100}[case]
        if case == "neither" and (abs(both - a * b) < 0.04 or both >= min(a, b) or both == 0):
            continue
        if both <= min(a, b) and a + b - both <= 1:
            break
    u = a + b - both
    is_me = abs(both) < 1e-12; is_ind = abs(both - a * b) < 1e-9
    assert (case == "me") == (is_me and not is_ind) and (case == "ind") == (is_ind and not is_me) and (case == "neither") == (not is_me and not is_ind)
    S = {"me": "The events are mutually exclusive, and they are not independent.", "ind": "The events are independent, and they are not mutually exclusive.", "neither": "The events are neither mutually exclusive nor independent.", "cant": "It cannot be decided from these probabilities whether the events are mutually exclusive or independent."}
    W = {"me": "Then $P(A \\text{ and } B) = 0$, so the events cannot occur together, while $P(A)P(B) \\neq 0$, so they are not independent.", "ind": "Then $P(A \\text{ and } B) = P(A)P(B)$, which is not $0$, so the events are independent but can occur together.",
         "neither": "Then $P(A \\text{ and } B)$ is neither $0$ nor $P(A)P(B)$, so the events are neither mutually exclusive nor independent."}
    key = (S[case], f"From $P(A \\text{{ or }} B) = P(A) + P(B) - P(A \\text{{ and }} B)$, we get $P(A \\text{{ and }} B) = {a:g} + {b:g} - {u:g} = {both:g}$. " + W[case])
    wrongs_k = [k for k in ("me", "ind", "neither") if k != case]
    why = {"me": "States that the events are mutually exclusive, but the probability of both is not $0$.", "ind": "States that the events are independent, but the probability of both is not equal to the product of the two probabilities.", "neither": "States that the events are neither, but the probabilities show that one of the two properties holds."}
    wr = [(S[k], why[k] if k != "me" or case != "ind" else "States that the events are mutually exclusive, but the probability of both is not $0$.", "wrong_pair_" + k, None, 1 + (i % 2)) for i, k in enumerate(wrongs_k)] + [(S["cant"], "The probability of both is determined by the addition rule from the three given probabilities, so both properties can be decided.", "cannot_decide", None, 1)]
    wr = wr[:3]
    stem = f"For two events $A$ and $B$, $P(A) = {a:g}$, $P(B) = {b:g}$ and $P(A \\text{{ or }} B) = {u:g}$. Which of the following statements is correct?"
    return mc("st_n_me_independent", "2.5", "4.B", "Decide from three probabilities whether two events are mutually exclusive and whether they are independent",
              ["Use the addition rule to find the probability that both events occur", "Compare that probability with $0$ for mutual exclusivity and with the product of the two probabilities for independence"],
              key, wr, rng, stem, "the probability of both is recomputed and tested against 0 and against the product; each case is generated so that exactly one statement is true", ["claim_justification", "procedure_choice"], est=90, facts=[f"case={case}", f"both={both}"],
              sig=(["addition rule", "mutually exclusive versus independent"], 1, "light"))


# ======================= 13. 게임의 기댓값 해석 (2.9 / 4.D, 표) =======================
GM_CTX = [dict(game="a ring-toss game at a fair", cost=3, prizes=[(0, "No prize"), (4, "Small toy"), (8, "Medium toy"), (20, "Large toy")], unit="dollars"),
          dict(game="a spinner game at a school carnival", cost=2, prizes=[(0, "No prize"), (3, "Sticker"), (5, "Key chain"), (12, "Stuffed animal")], unit="dollars")]


def st_n_game_expected(rng):
    c = pick(rng, GM_CTX)
    for _ in forever():
        pr = [rng.randint(40, 60), rng.randint(20, 30), rng.randint(8, 16), rng.randint(2, 6)]
        pr[0] = 100 - sum(pr[1:])
        ev_prize = sum(p * v for p, (v, _) in zip(pr, c["prizes"])) / 100
        net = ev_prize - c["cost"]
        if -1.5 < net < -0.2 and abs(net - round(net, 2)) < 1e-9:
            break
    agree(sum(Fr(p, 100) * v for p, (v, _) in zip(pr, c["prizes"])) - c["cost"], Fr(round(net * 100), 100), name="ev")
    amt = f"${abs(net):.2f}$"
    stim = stat_stim(f"Prize values and probabilities for {c['game']}", "table", title="Prizes and their probabilities", columns=["Prize", "Value of the prize (dollars)", "Probability"], rows=[[nm, str(v), f"{p / 100:.2f}"] for p, (v, nm) in zip(pr, c["prizes"])])
    key = (f"The mean net result per play over a very large number of plays is a loss of {amt} dollars, so the game is expected to cost the player money.", f"The mean prize is ${ev_prize:.2f}$ dollars and the cost to play is ${c['cost']}$ dollars, so the mean net result is ${net:.2f}$ dollars per play.")
    wr = [(f"Each player loses exactly {amt} dollars on every play of the game.", "Treats the expected value as the outcome of each play, but it is only the long-run average of the net results.", "expected_as_each", None, 3),
          (f"The mean net result per play over a very large number of plays is a gain of ${ev_prize:.2f}$ dollars, so the game is expected to pay the player.", "Uses the mean prize without subtracting the cost of playing.", "cost_ignored", None, 2),
          (f"A player who plays 100 times will lose exactly ${abs(net) * 100:.0f}$ dollars.", "Treats the expected value as a guaranteed total, but the total for any number of plays varies around its expected value.", "guaranteed_total", None, 3)]
    stem = f"A player pays ${c['cost']}$ dollars to play {c['game']}. The table shown gives the value of each prize and its probability, and the net result of a play is the value of the prize minus the cost. Which of the following statements about the mean (expected value) of the net result of one play is correct?"
    return mc("st_n_game_expected", "2.9", "4.D", "Find and interpret the expected net result of a game from a probability table",
              ["Weight each prize value by its probability and subtract the cost to get the expected net result", "Interpret the value as a long-run average per play rather than the result of each play or of a fixed number of plays", "Reject interpretations that ignore the cost or call the average a guaranteed outcome"],
              key, wr, rng, stem, "the expected net result is recomputed with exact fractions from the table and must equal a value with two decimal places", ["interpretation", "representation_reading", "calculated_value_decision"], stim, est=100, facts=[f"pr={pr}"],
              sig=(["expected value of a discrete random variable", "interpretation of an expected value"], 1, "light"))


# ======================= 14. 모의 실험 점도표에서 확률 어림 (2.3 / 3.C, 점도표) =======================
SM_CTX = [dict(who="A basketball player makes ${pp}\\%$ of her free throws.", trial="In each trial, a computer simulates ${n}$ free throws and records the number that the player makes.", var="made", event="makes at least"),
          dict(who="A seed company claims that ${pp}\\%$ of its seeds sprout.", trial="In each trial, a computer simulates planting ${n}$ seeds and records the number that sprout.", var="sprouting", event="has at least"),
          dict(who="A call center reports that ${pp}\\%$ of its calls are resolved on the first try.", trial="In each trial, a computer simulates ${n}$ calls and records the number resolved on the first try.", var="resolved", event="has at least")]


def st_n_sim_dotplot_tail(rng):
    c = pick(rng, SM_CTX)
    n = pick(rng, [15, 20, 25]); pp = pick(rng, [60, 70, 75]); sims = 50
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        draws = gen.binomial(n, pp / 100, size=sims)
        counts = {int(v): int((draws == v).sum()) for v in np.unique(draws)}
        k = int(np.ceil(n * pp / 100)) + rng.choice([1, 2])
        tail = sum(v for x, v in counts.items() if x >= k)
        eq = counts.get(k, 0); nb = counts.get(k - 1, 0)
        vv = (tail, eq, sims - tail, tail + nb)
        if 4 <= tail <= 20 and eq >= 2 and nb >= 2 and len(counts) >= 5 and max(counts.values()) <= 15 and len(set(vv)) == 4 and min(abs(x - y) for i, x in enumerate(vv) for j2, y in enumerate(vv) if i < j2) >= 2:
            break
    agree(tail, int((draws >= k).sum()), name="tail")
    below = sims - tail
    f = lambda v: f"${v / sims:.2f}$"
    key = (f(tail), f"{tail} of the {sims} simulated trials had at least {k}, so the estimated probability is ${tail}/{sims} = {tail / sims:.2f}$.", tail / sims)
    wr = [(f(eq), f"Uses only the trials that had exactly {k} instead of at least {k}.", "exactly_not_at_least", eq / sims, 1), (f(below), f"Uses the trials with fewer than {k} instead of at least {k}.", "wrong_tail", below / sims, 1),
          (f(tail + nb), f"Also counts the trials that had exactly {k - 1}, an off-by-one error in the boundary of the event.", "boundary_off_by_one", (tail + nb) / sims, 2)]
    stim = stat_stim(f"Dotplot of the number {c['var']} in {sims} simulated trials", "dot_plot", title=f"Number {c['var']} in {sims} simulated trials", xTitle=f"Number {c['var']} out of {n}", dots=[{"value": v, "count": cnt} for v, cnt in sorted(counts.items())])
    stem = f"{c['who'].format(pp=pp)} {c['trial'].format(n=n)} The dotplot shown displays the results of ${sims}$ trials. Based on the simulation, what is the estimated probability that in ${n}$ attempts the number {c['var']} is at least ${k}$? (Give the estimate as a decimal rounded to two decimal places.)"
    return mc("st_n_sim_dotplot_tail", "2.3", "3.C", "Estimate a tail probability from a dotplot of simulated results",
              ["Find the values on the horizontal axis that satisfy the event, at least the stated number", "Add the dots at those values and divide by the total number of simulated trials"],
              key, wr, rng, stem, "the simulated counts are generated with numpy's binomial sampler and the tail count is recomputed from the raw draws", ["representation_reading", "calculated_value_decision", "procedure_choice"], stim, est=90, facts=[f"n={n}", f"pp={pp}", f"k={k}"])


# ======================= 15. 정규분포의 역계산(기준값) (2.11 / 3.C) =======================
NC_CTX = [dict(what="the time, in minutes, that a package takes to be delivered", unit="minutes", mu=(40, 65), sd=(4, 9), goal="The company will call a delivery late if it is among the slowest ${p}\\%$ of deliveries.", tail="high"),
          dict(what="the battery life, in hours, of a phone model", unit="hours", mu=(18, 30), sd=(2, 4), goal="A warranty will replace any phone whose battery life is among the shortest ${p}\\%$.", tail="low"),
          dict(what="the height, in centimeters, of the plants in a nursery", unit="centimeters", mu=(60, 90), sd=(5, 9), goal="The nursery sells the tallest ${p}\\%$ of its plants in a premium class.", tail="high")]


def st_n_normal_cutoff(rng):
    c = pick(rng, NC_CTX)
    mu = rng.randint(*c["mu"]); sd = rng.randint(*c["sd"]); p = pick(rng, [10, 5, 15, 20])
    z = zstar_tail(p / 100)  # 상위 p 의 z
    lo = c["tail"] == "low"
    cut = mu - z * sd if lo else mu + z * sd
    # 독립 경로: scipy 의 ppf
    agree(cut, (ss.norm.ppf(p / 100, mu, sd) if lo else ss.norm.isf(p / 100, mu, sd)), tol=1e-6, name="cutoff")
    f = lambda v: f"${v:.1f}$ {c['unit']}"
    key = (f(cut), f"The cutoff is at ${'z = -' if lo else 'z = '}{z:.3f}$ standard deviations from the mean: ${mu} {'-' if lo else '+'} {z:.3f}({sd}) = {cut:.1f}$.", round(cut, 1))
    wrong_v = [(mu + z * sd if lo else mu - z * sd, "Uses the correct z-score on the wrong side of the mean.", "wrong_side", 1), (mu - (1 - p / 100) * sd * 1.0 if lo else mu + (1 - p / 100) * sd, "Uses the proportion as if it were a z-score.", "percent_as_z", 1),
               (mu - z * sd * 2 if lo else mu + z * sd * 2, "Doubles the standard deviation distance, as if the cutoff were for both tails.", "two_tail_cutoff", 2)]
    wr = [(f(v), w, mid, round(v, 1), st) for v, w, mid, st in wrong_v]
    stem = f"{cap(c['what'])} is approximately normally distributed with mean ${mu}$ {c['unit']} and standard deviation ${sd}$ {c['unit']}. {c['goal'].format(p=p)} Which of the following is the cutoff value that separates this group from the other values? (Round to one decimal place.)"
    return mc("st_n_normal_cutoff", "2.11", "3.C", "Find a cutoff value for a stated percent of a normal distribution",
              ["Find the z-score that has the stated percent of the distribution beyond it, on the correct side of the mean", "Convert the z-score back to the original scale with the mean and the standard deviation"],
              key, wr, rng, stem, "the z-score is found by bisection on the normal cdf and the cutoff is also computed with scipy's inverse normal function", ["procedure_choice", "calculated_value_decision", "interpretation"], est=95, facts=[f"mu={mu}", f"sd={sd}", f"p={p}"],
              sig=(["inverse normal calculation", "side of the mean"], 1, "light"))


def zstar_tail(p):
    """상위 꼬리 면적 p 에 대한 z (정규 누적함수 이분법)."""
    lo, hi = 0.0, 6.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if 1 - ncdf(mid) > p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ======================= 16. 이항 확률변수가 되는 상황 고르기 (2.10 / 2.A) =======================
BN_SC = [
    dict(ok="A quality inspector tests ${n}$ light bulbs chosen at random from a very large shipment in which $4\\%$ of the bulbs are defective, and counts the defective bulbs.",
         bad=[("An inspector tests light bulbs chosen at random from a very large shipment in which $4\\%$ are defective until the first defective bulb is found, and counts the bulbs tested.", "The number of trials is not fixed in advance; the variable counts trials until the first success."),
              ("An inspector chooses ${n}$ bulbs from a box of exactly ${m}$ bulbs of which ${d}$ are defective, with no bulb replaced, and counts the defective bulbs.", "The sample is a large part of a small box, so removing a bulb changes the probability for the next one and the trials are not independent."),
              ("An inspector tests ${n}$ bulbs and records the number of hours that each bulb lasts, then reports the mean lifetime.", "The variable is a measured lifetime rather than a count of successes in a fixed number of independent trials with two outcomes.")]),
    dict(ok="A basketball player takes ${n}$ free throws in a practice, and the coach counts the number she makes, assuming that each shot has the same probability of success and that the shots are independent.",
         bad=[("A basketball player keeps shooting free throws until she misses and the coach counts the shots she takes.", "The number of trials is not fixed in advance."),
              ("A coach draws ${n}$ players without replacement from a team of ${m}$ players of whom ${d}$ are starters and counts the starters drawn.", "Sampling a large part of a small group without replacement makes the probability change from draw to draw."),
              ("A player takes ${n}$ free throws, and the coach adds the number of points each shot earns to get a total score for the practice.", "The variable is a total of point values rather than a count of successes with two possible outcomes per trial.")]),
    dict(ok="A pollster phones ${n}$ voters selected at random from the very large list of voters in a state, and counts the voters who say they plan to vote.",
         bad=[("A pollster phones voters selected at random from a very large list until one voter says no, and counts the calls made.", "The number of trials is not fixed in advance."),
              ("A pollster selects ${n}$ voters, one after another without replacement, from a club of exactly ${m}$ voters of whom ${d}$ plan to vote, and counts those who plan to vote.", "The probability of success changes with every selection from the small club, so the trials are not independent."),
              ("A pollster asks ${n}$ voters how many hours they plan to spend at the polls and averages the answers.", "The variable is a measurement averaged over voters, not a count of successes with two outcomes per trial.")]),
]


def st_n_binomial_scenario(rng):
    c = pick(rng, BN_SC)
    n = pick(rng, [12, 15, 20]); m = pick(rng, [20, 24, 25]); d = pick(rng, [6, 8, 9])
    fx = lambda s: s.format(n=n, m=m, d=d) if False else s.replace("${n}$", f"${n}$").replace("${m}$", f"${m}$").replace("${d}$", f"${d}$")
    key = (fx(c["ok"]), "The number of trials is fixed, each trial has two outcomes with the same probability, and the trials are independent, so the count of successes is a binomial random variable.")
    wr = [(fx(t), w, "not_binomial_" + str(i)) for i, (t, w) in enumerate(c["bad"])]
    wr = [(t, w, mid, None, 1) for t, w, mid in wr]
    stem = "For which of the following is the random variable described a binomial random variable?"
    return mc("st_n_binomial_scenario", "2.10", "2.A", "Recognize the conditions that make a count a binomial random variable",
              ["Check each description for a fixed number of trials, two outcomes, a constant probability and independence", "Keep the description that meets every condition and reject those that count trials to a first success, sample a small group without replacement or measure a quantity"],
              key, wr, rng, stem, "each family lists one scenario that meets all four binomial conditions and three that each break exactly one condition, written and checked by hand", ["condition_check", "claim_justification"], est=90, facts=[f"n={n}", f"m={m}"])


STAGE_SINGLES = ["st_n_iq_table_vars", "st_n_stat_vs_nonstat", "st_n_question_design_match", "st_n_cat_compare_totals", "st_n_linear_transform", "st_n_hist_shape_center", "st_n_cumulative_table", "st_n_plan_unbiased", "st_n_bias_direction", "st_n_factorial_units",
                 "st_n_union_complement", "st_n_me_independent", "st_n_game_expected", "st_n_sim_dotplot_tail", "st_n_normal_cutoff", "st_n_binomial_scenario"]
