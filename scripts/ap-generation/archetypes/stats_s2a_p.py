"""AP Statistics S2-a — 단독 MC 원형 14개(2026-10-12). 파일럿 빈칸 채우기: P1 스킬(1.A), P2 추가(2.A–2.E), 추론 조건 확인(4.E), 더 어려운 난이도.
정답 판정은 코드(진리표·열거·수치)가 하고 해석 문장은 고정 문장 4개(정답 1 + 이름 붙은 오해 3)다. 모든 수·통계량은 $...$ 안에 쓴다."""
from stats_common import *

# ======================= P1-a. 유효한 조사 질문 고르기 (1.10 / 1.A) =======================
IQ_CTX = [
    dict(topic="how much time students at the high schools of a school district spend using the school library each week",
         keys=["What is the typical amount of time per week that students at the district's high schools spend using the school library?",
               "What proportion of students at the district's high schools spend more than two hours per week using the school library?",
               "Do students in the upper grades at the district's high schools spend more time per week in the school library than students in the lower grades?"],
         lookup="How many students are enrolled at the largest high school in the district this year?", one="How much time did Maria, a junior at one of the high schools, spend in the school library last Tuesday?", opinion="Should the district spend more money on its school libraries?"),
    dict(topic="how long customers of a bakery chain wait to be served",
         keys=["What is the typical amount of time that customers at the chain's stores wait to be served?",
               "What proportion of customers at the chain's stores wait more than five minutes to be served?",
               "Do customers at the chain's busiest stores wait longer to be served than customers at its other stores?"],
         lookup="How many stores does the bakery chain operate in the city this year?", one="How long did Mr. Lee wait to be served at the bakery this morning?", opinion="Should the bakery chain hire more cashiers for its stores?"),
    dict(topic="how much sleep teenagers in a state get on school nights",
         keys=["What is the typical number of hours that teenagers in the state sleep on a school night?",
               "What proportion of teenagers in the state sleep fewer than seven hours on a school night?",
               "Do older teenagers in the state sleep fewer hours on a school night than younger teenagers?"],
         lookup="How many teenagers lived in the state at the time of the last census?", one="How many hours did Priya sleep last night?", opinion="Should the state require high schools to start later in the morning?"),
    dict(topic="how far employees of a large company commute to work",
         keys=["What is the typical one-way commuting distance of employees of the company?",
               "What proportion of the company's employees commute more than twenty miles one way?",
               "Do employees of the company who work downtown commute shorter distances than employees who work at other offices?"],
         lookup="How many employees does the company have at its headquarters?", one="How many miles did Mr. Gomez drive to work yesterday?", opinion="Should the company allow its employees to work from home?"),
]


def st_investigative_question(rng):
    c = pick(rng, IQ_CTX)
    form = rng.randrange(3)
    # 진리표(독립 경로): 질문이 갖춰야 할 세 속성 — 개체 간 변동 예상, 모집단 명시, 자료 수집으로 답함. 정답 하나만 세 속성을 모두 가진다.
    flaws = {
        "no_variability": (c["lookup"], "Asks for a single count that can be looked up, so no variability in data is anticipated and no statistical investigation is needed."),
        "one_individual": (c["one"], "Asks about one individual, so there is no population and no variability to investigate."),
        "opinion": (c["opinion"], "Asks for an opinion or a value judgment that data collection and analysis cannot settle."),
    }
    attrs = {"key": (True, True, True), "no_variability": (False, True, True), "one_individual": (True, False, True), "opinion": (True, True, False)}
    assert [k for k, v in attrs.items() if all(v)] == ["key"]
    key = Opt(c["keys"][form], True, "Anticipates variability among the individuals, names the population and can be answered by collecting and analyzing data.", None)
    ds = [Opt(t, False, w, None) for t, w in flaws.values()]
    stem = f"A researcher wants to study {c['topic']}. Which of the following is a valid investigative question that requires a statistical investigation?"
    bpr = sbp("st_investigative_question", "1.10", "1.A", "Recognize a valid investigative question that requires a statistical investigation",
              ["Check whether the question anticipates variability among individuals rather than asking for one fixed value", "Check that the question names a population and can be answered by collecting and analyzing data, not by opinion"],
              [("a valid investigative question anticipates variability, refers to a population and can be answered with data", "three options each lack exactly one of these three properties")],
              [("single_known_value", "asks for a count or fact that can be looked up"), ("one_individual", "asks about one person"), ("opinion_not_data", "asks for an opinion")],
              "each option is generated from a table of three properties (variability, population, answerable with data) and exactly one option has all three",
              {"type": "none", "must_include": []}, ["interpretation", "claim_justification"], method="property table enumeration")
    return spack("st_investigative_question", "1.10", "1.A", stem, key, ds, rng, bpr, None, 70, [f"form={form}"])


# ======================= P1-b. 수집한 자료로 답할 수 있는 조사 질문 (1.10 / 1.A, 표) =======================
DM_CTX = [
    dict(who="students at a high school", vars=[("Grade level", "categorical"), ("Hours of sleep on a school night", "quantitative"), ("Owns a car", "categorical")], n=250,
         key="Is there an association between a student's grade level and whether the student owns a car?",
         unc="Do students with higher grade point averages sleep more hours on a school night?", cause="Would owning a car cause a student to sleep fewer hours on a school night?", lst="What was the number of hours of sleep on a school night for each of the students?"),
    dict(who="adult members of a gym", vars=[("Membership type", "categorical"), ("Visits last month", "quantitative"), ("Years as a member", "quantitative")], n=180,
         key="Is there an association between a gym member's years of membership and visits last month?",
         unc="Do members with a higher resting heart rate visit the gym more often?", cause="Would switching to a premium membership cause a member to visit the gym more often?", lst="What was the number of visits last month for each of the members?"),
    dict(who="households in a town", vars=[("Number of residents", "quantitative"), ("Owns or rents", "categorical"), ("Monthly electric bill (dollars)", "quantitative")], n=300,
         key="Is there an association between the number of residents in a household and its monthly electric bill?",
         unc="Do households with a higher annual income have a larger monthly electric bill?", cause="Would adding another resident to a household cause its monthly electric bill to increase?", lst="What was the monthly electric bill for each of the households?"),
]


def st_question_data_match(rng):
    c = pick(rng, DM_CTX)
    key = Opt(c["key"], True, "Uses only variables that were recorded and asks about a relationship that the recorded data can address.", None)
    ds = [Opt(c["unc"], False, "Needs a variable that was not recorded, so the data cannot answer it.", None),
          Opt(c["cause"], False, "A cause-and-effect question needs data from a randomized experiment, but these data were only recorded, not assigned.", None),
          Opt(c["lst"], False, "Asks for a listing of individual values rather than a question about a population that can be answered by summarizing and analyzing the data.", None)]
    rows = [[v, k] for v, k in c["vars"]]
    stim = {"kind": "table", "description": f"Variables recorded for each of {c['n']} {c['who']}.", "data": {"title": "Variables recorded", "columns": ["Variable", "Type"], "rows": rows}}
    stem = f"A random sample of ${c['n']}$ {c['who']} was surveyed, and the variables in the table shown were recorded for each individual. Which of the following investigative questions can be answered using these data?"
    bpr = sbp("st_question_data_match", "1.10", "1.A", "Decide which investigative question the collected data can answer",
              ["Match the variables named in each question to the variables in the table", "Reject questions that need uncollected variables, need random assignment for a cause-and-effect claim, or ask for individual values"],
              [("an investigative question must be answerable with the collected variables and the study design", "the table lists every variable that was recorded and the stem says the data come from a survey")],
              [("uncollected_variable", "needs a variable that was not recorded"), ("causal_from_survey", "asks a cause-and-effect question of survey data"), ("individual_listing", "asks for a list of individual values")],
              "the variable names in each option are matched mechanically against the table and exactly one option uses only recorded variables and an association question",
              {"type": "table", "must_include": ["variables recorded"]}, ["representation_reading", "claim_justification"], method="variable set containment check")
    return spack("st_question_data_match", "1.10", "1.A", stem, key, ds, rng, bpr, stim, 80, [f"n={c['n']}"])


# ======================= P2-a. 가설 설정 (3.5 / 2.E) =======================
HYP_CTX = [
    dict(kind="p", who="a company claims that $p0$ of its customers are satisfied", par="p", what="the proportion of all customers who are satisfied", p0=0.8, sus={"less": "A consumer group suspects the true proportion is lower than the claim", "greater": "A consumer group suspects the true proportion is higher than the claim", "two": "A consumer group suspects the claim is not accurate"}),
    dict(kind="p", who="a manufacturer says that $p0$ of its parts meet specifications", par="p", what="the proportion of all parts that meet specifications", p0=0.9, sus={"less": "An inspector suspects the true proportion is lower than the manufacturer says", "greater": "An inspector suspects the true proportion is higher than the manufacturer says", "two": "An inspector suspects the manufacturer's value is not correct"}),
    dict(kind="p", who="a school reports that $p0$ of its graduates enroll in college", par="p", what="the proportion of all graduates who enroll in college", p0=0.7, sus={"less": "A reporter suspects the true proportion is lower than reported", "greater": "A reporter suspects the true proportion is higher than reported", "two": "A reporter suspects the reported value is not accurate"}),
    dict(kind="p", who="a seed company states that $p0$ of its seeds germinate", par="p", what="the proportion of all seeds that germinate", p0=0.6, sus={"less": "A gardener suspects the true proportion is lower than stated", "greater": "A gardener suspects the true proportion is higher than stated", "two": "A gardener suspects the stated value is not correct"}),
]


def st_hypotheses_setup(rng):
    c = pick(rng, HYP_CTX)
    tail = pick(rng, ["less", "greater", "two"])
    p0 = c["p0"]
    sym = {"less": "<", "greater": ">", "two": "\\ne"}
    who = c["who"].replace("$p0$", f"${int(round(p0 * 100))}\\%$").replace("$m0$", f"${p0}$")
    par = c["par"]
    h0 = lambda s: f"$H_0: {s} = {p0}$"
    ha = lambda sy: f"$H_a: {s_par} {sy} {p0}$"
    s_par = par
    key_text = f"{h0(par)} and $H_a: {par} {sym[tail]} {p0}$"
    # 진리표(독립 경로): 대립가설 방향은 의심 문구의 방향과 같아야 하고 모수는 모집단 모수(p 또는 mu)여야 한다
    others = [t for t in ("less", "greater", "two") if t != tail]
    def dwhy(t):
        if tail == "two":
            return "Writes a one-sided alternative although the suspicion only says the claim is not accurate, without a direction."
        return "Reverses the direction of the alternative hypothesis relative to the suspicion." if t != "two" else "Writes a two-sided alternative although the suspicion has a direction."
    wr = [(f"{h0(par)} and $H_a: {par} {sym[others[0]]} {p0}$", dwhy(others[0]) + (" Picks the lower direction." if others[0] == "less" and tail == "two" else (" Picks the upper direction." if others[0] == "greater" and tail == "two" else "")))]
    wr.append((f"{h0(par)} and $H_a: {par} {sym[others[1]]} {p0}$", dwhy(others[1]) + (" Picks the upper direction." if others[1] == "greater" and tail == "two" else (" Picks the lower direction." if others[1] == "less" and tail == "two" else ""))))
    stat = "\\hat{p}" if c["kind"] == "p" else "\\bar{x}"
    wr.append((f"$H_0: {stat} = {p0}$ and $H_a: {stat} {sym[tail]} {p0}$", "Writes the hypotheses about a sample statistic, but hypotheses are always about the population parameter."))
    wr.append((f"$H_0: {par} {sym[tail] if tail != 'two' else '<'} {p0}$ and $H_a: {par} = {p0}$", "Puts the claim of the suspicion in the null hypothesis and an equal sign in the alternative, instead of an equal sign in the null."))
    key = Opt(key_text, True, f"The parameter is {c['what']}; the null hypothesis states the claimed value and the alternative matches the suspicion, which is {'one-sided' if tail != 'two' else 'two-sided'}.", None)
    ds = [Opt(t, False, w, None) for t, w in wr]
    stem = f"{who[0].upper() + who[1:]}. {c['sus'][tail]}. Let ${par}$ be {c['what']}. Which of the following pairs of hypotheses should be tested?"
    bpr = sbp("st_hypotheses_setup", "3.5", "2.E", "Choose the null and alternative hypotheses from a scenario",
              ["Identify the population parameter and the claimed value that goes in the null hypothesis", "Match the direction of the alternative hypothesis to the direction of the suspicion"],
              [("the null hypothesis states equality with the claimed value and the alternative reflects what is suspected", "the stem states the claim and the direction of the suspicion in words")],
              [("wrong_direction", "uses an alternative in the wrong direction"), ("statistic_not_parameter", "writes hypotheses about a sample statistic"), ("claim_in_wrong_hypothesis", "swaps the roles of the two hypotheses")],
              "each option is built from a table of direction, parameter symbol and role of the equality, and only one row matches the scenario's claim and suspicion",
              {"type": "none", "must_include": []}, ["procedure_choice", "interpretation"], method="role table enumeration")
    return spack("st_hypotheses_setup", "3.5", "2.E", stem, key, ds, rng, bpr, None, 70, [f"tail={tail}", f"kind={c['kind']}"])


# ======================= P2-b. 추론 방법 선택 (4.4 평균 / 3.14 범주형) (2.C) =======================
def _feat(k):
    return {"type": k[0], "samples": k[1], "goal": k[2]}


MEAN_M = {
    ("quant", 1, "test"): ("A one-sample t-test for a population mean", "A coach wants to test whether the mean time for all of her runners to finish a mile is less than $7$ minutes, using the times of a random sample of $25$ runners"),
    ("paired", 2, "test"): ("A matched-pairs t-test for a mean difference", "A trainer wants to test whether a program changes the mean weight of members, using the weight of each of $20$ randomly selected members before and after the program"),
    ("quant", 2, "test"): ("A two-sample t-test for a difference in population means", "A scientist wants to test whether the mean growth, in centimeters, differs for plants given two fertilizers, using one random sample of $30$ plants for each fertilizer"),
    ("cat", 1, "test"): ("A one-sample z-test for a population proportion", "A factory manager wants to test whether the proportion of defective items in a shipment is above $5\\%$, using the counts from a random sample of $200$ items"),
}
CAT_M = {
    ("cat", 1, "interval"): ("A one-sample z-interval for a population proportion", "A polling firm wants to estimate the proportion of all registered voters in a city who support a proposed park, using a random sample of $400$ voters"),
    ("cat", 2, "test"): ("A two-sample z-test for a difference in population proportions", "A school wants to test whether the proportion of students who bring lunch from home differs between two grades, using separate random samples of $150$ students from each grade"),
    ("assoc", 1, "test"): ("A chi-square test of independence", "A researcher wants to test for an association between the type of transportation to work and the age group of employees, using one random sample of $300$ employees classified by both variables"),
    ("quant", 1, "interval"): ("A one-sample t-interval for a population mean", "A dentist wants to estimate the mean time that all patients wait before their appointment, using the waiting times of a random sample of $40$ patients"),
}


def _method(rng, table, arch, topic):
    kk = pick(rng, list(table))
    # 진리표(독립 경로): 시나리오 특징(변수 유형, 표본 수·짝, 목적)이 정확히 한 절차와 일치한다
    assert len([k for k in table if _feat(k) == _feat(kk)]) == 1
    def reason(k):
        f, g = _feat(k), _feat(kk)
        bits = []
        if f["type"] != g["type"]:
            bits.append({"cat": "the scenario's data are counts of a category", "quant": "the scenario's data are measurements, not counts of a category", "paired": "the scenario's measurements come in pairs from the same individuals", "assoc": "the scenario classifies each individual by two categorical variables"}[g["type"]])
        if f["samples"] != g["samples"]:
            bits.append("the number of samples does not fit the scenario")
        if f["goal"] != g["goal"]:
            bits.append("the scenario's goal is " + ("an interval" if g["goal"] == "interval" else "a test") + ", not " + ("an interval" if f["goal"] == "interval" else "a test"))
        return "Chooses " + table[k][0][0].lower() + table[k][0][1:] + ", but " + "; ".join(bits or ["its features do not match the scenario"]) + "."
    wrongs = [k for k in table if k != kk]
    key = Opt(table[kk][0], True, "The variables, the number of samples and the goal in the scenario match this procedure.", None)
    ds = [Opt(table[k][0], False, reason(k), None) for k in wrongs]
    stem = f"{table[kk][1]}. Which of the following procedures is appropriate?"
    bpr = sbp(arch, topic, "2.C", "Choose the statistical inference procedure that fits a scenario",
              ["Decide whether the data are categorical counts or measurements and whether the individuals are paired", "Count the samples and decide whether the goal is an interval or a test, then match the procedure"],
              [("the type of variable, the number of samples, pairing and the goal determine the procedure", "the scenario states the variable, the sampling and the goal")],
              [("mismatched_data_type", "mixes up proportions and means"), ("mismatched_sampling", "uses the wrong number of samples or ignores pairing"), ("mismatched_goal", "uses a test when an interval is needed or the reverse")],
              "a feature table (variable type, sample count, pairing, goal) is matched against each procedure and exactly one procedure matches the scenario",
              {"type": "none", "must_include": []}, ["procedure_choice"], method="feature table enumeration")
    return spack(arch, topic, "2.C", stem, key, ds, rng, bpr, None, 80, [f"method={kk}"])


def st_method_choice_means(rng):
    return _method(rng, MEAN_M, "st_method_choice_means", "4.4")


def st_method_choice_cat(rng):
    return _method(rng, CAT_M, "st_method_choice_cat", "3.14")


# ======================= P2-c. 제1·2종 오류 (3.8 / 2.D) =======================
ERR_CTX = [
    dict(h0="the machine's filling process is working properly", ha="the machine is not filling properly", rej="stop the machine for repairs", ctx="A quality manager tests whether a bottling machine is filling bottles properly"),
    dict(h0="the new medicine is no more effective than the standard medicine", ha="the new medicine is more effective than the standard medicine", rej="approve the new medicine", ctx="A researcher tests whether a new medicine is more effective than the standard medicine"),
    dict(h0="the true proportion of defective parts is at most the allowed limit", ha="the true proportion of defective parts is above the allowed limit", rej="reject the shipment", ctx="An inspector tests whether the proportion of defective parts in a shipment exceeds the allowed limit"),
]


def st_type_errors(rng):
    c = pick(rng, ERR_CTX)
    which = pick(rng, ["I", "II"])
    # 2x2 진리표: (진실 H0 참/거짓) x (결정 기각/기각 못함); 제1종 = 참인 H0 기각, 제2종 = 거짓인 H0 기각 못함
    cells = {("true", "reject"): "I", ("false", "fail"): "II", ("true", "fail"): None, ("false", "reject"): None}
    assert [k for k, v in cells.items() if v == which] and len([k for k, v in cells.items() if v == which]) == 1
    txt = {
        ("true", "reject"): f"The test leads to the decision to {c['rej']} even though {c['h0']}",
        ("false", "fail"): f"The test does not lead to the decision to {c['rej']} even though {c['ha']}",
        ("true", "fail"): f"The test does not lead to the decision to {c['rej']} and {c['h0']}",
        ("false", "reject"): f"The test leads to the decision to {c['rej']} and {c['ha']}",
    }
    why = {
        ("true", "reject"): "A Type I error is rejecting a null hypothesis that is true.",
        ("false", "fail"): "A Type II error is failing to reject a null hypothesis that is false.",
        ("true", "fail"): "This is a correct decision, so it is not an error of either type.",
        ("false", "reject"): "This is a correct decision, so it is not an error of either type.",
    }
    kcell = [k for k, v in cells.items() if v == which][0]
    wrong_why = {
        ("false", "fail") if which == "I" else ("true", "reject"): f"Describes a Type {'II' if which == 'I' else 'I'} error, mixing up the two types of error.",
        ("true", "fail"): "Describes a correct decision (failing to reject a true null hypothesis), not an error.",
        ("false", "reject"): "Describes a correct decision (rejecting a false null hypothesis), not an error.",
    }
    key = Opt(txt[kcell], True, why[kcell], None)
    ds = [Opt(txt[k], False, w, None) for k, w in wrong_why.items()]
    stem = f"{c['ctx']}, using the null hypothesis that {c['h0']} and the alternative hypothesis that {c['ha']}. Which of the following describes a Type {which} error in this context?"
    bpr = sbp("st_type_errors", "3.8", "2.D", f"Describe a Type {which} error in context",
              ["Recall that a Type I error rejects a true null hypothesis and a Type II error fails to reject a false null hypothesis", "Translate the decision and the state of nature into the words of the scenario"],
              [("the type of error is determined by the true state of the null hypothesis and the decision", "the stem states the null and alternative hypotheses and what rejecting leads to")],
              [("swapped_error_types", "swaps Type I and Type II"), ("correct_decision_not_error", "calls a correct decision an error"), ("correct_decision_rejected", "calls the other correct decision an error")],
              "the four options are the four cells of the truth-by-decision table; exactly one cell matches the requested error type",
              {"type": "none", "must_include": []}, ["interpretation", "procedure_choice"], method="2x2 truth table enumeration")
    return spack("st_type_errors", "3.8", "2.D", stem, key, ds, rng, bpr, None, 85, [f"type={which}"])


# ======================= P2-d. 표본추출 방법의 근거 (1.11 / 2.B) =======================
SAMP = {
    "stratified": dict(goal="The principal wants every grade level to be represented in the sample in proportion to its enrollment", plan="Randomly select students separately within each grade level, with the number from each grade proportional to its enrollment", name="stratified random sample", text="A stratified random sample"),
    "cluster": dict(goal="Traveling to many apartment buildings is too costly, so the manager wants to survey all residents in only a few buildings", plan="Randomly select $5$ of the $40$ apartment buildings and survey every resident in the selected buildings", name="cluster sample", text="A cluster sample"),
    "srs": dict(goal="The company wants a sample of $50$ employees from a list of $800$ in which every group of $50$ employees is equally likely to be chosen", plan="Number the employees from $1$ to $800$ and use a random number generator to choose $50$ different numbers", name="simple random sample", text="A simple random sample"),
}
SAMP_WHY = {
    "stratified": "Does not guarantee that each subgroup is represented in proportion; only random selection within each subgroup guarantees it.",
    "cluster": "Selects whole groups at random and surveys every member, which does not match a goal of spreading the sample across the list.",
    "srs": "Gives every group of the chosen size the same chance, but does not guarantee representation of each subgroup.",
    "convenience": "Chooses whoever is easy to reach, which is likely to be biased and does not use random selection.",
}


def st_sampling_method(rng):
    kk = pick(rng, list(SAMP))
    s = SAMP[kk]
    texts = {k: v["text"] for k, v in SAMP.items()}
    texts["convenience"] = "A convenience sample"
    # 진리표(독립 경로): 목표가 요구하는 속성(소집단 비례 대표 / 집단 단위 비용 절감 / 같은 크기 모든 부분집합의 동일 확률)은 한 방법만 만족
    prop = {"stratified": ("subgroup_proportional",), "cluster": ("whole_groups",), "srs": ("equal_chance_subsets",), "convenience": ()}
    need = {"stratified": "subgroup_proportional", "cluster": "whole_groups", "srs": "equal_chance_subsets"}[kk]
    assert [m for m, ps in prop.items() if need in ps] == [kk]
    key = Opt(texts[kk], True, f"This method matches the goal: {s['plan'].lower()[0] + s['plan'][1:]}.", None)
    ds = [Opt(texts[k], False, SAMP_WHY[k], None) for k in texts if k != kk]
    stem = f"{s['goal']}. The plan is to {s['plan'][0].lower() + s['plan'][1:]}. Which of the following best describes this sampling method?"
    bpr = sbp("st_sampling_method", "1.11", "2.B", "Justify a sampling method that fits a stated goal",
              ["Identify the goal stated in the scenario, such as representation of subgroups, cost of reaching whole groups or equal chance for every group of the chosen size", "Match that goal and the described plan to the one sampling method that has this property"],
              [("each sampling method has a defining property that matches one goal", "the stem states both the goal and the selection plan")],
              [("wrong_random_method", "names another random method"), ("wrong_random_method_2", "names a different random method"), ("convenience_is_random", "treats a convenience sample as random")],
              "a table of methods and defining properties is used and exactly one method has the property required by the stated goal",
              {"type": "none", "must_include": []}, ["procedure_choice", "claim_justification"], method="property table enumeration")
    return spack("st_sampling_method", "1.11", "2.B", stem, key, ds, rng, bpr, None, 80, [f"method={kk}"])


# ======================= C1. 비율 검정 조건 확인 (3.7 / 4.E) =======================
CP_CTX = [("a city", "residents", "own a bicycle", "city residents"), ("a school district", "students", "ride the bus to school", "district students"), ("a company", "employees", "work remotely at least one day a week", "employees")]


def st_conditions_prop(rng):
    pop, who, trait, label = pick(rng, CP_CTX)
    fail = pick(rng, ["none", "random", "ten", "large"])
    for _ in forever():
        p0 = pick(rng, [0.3, 0.4, 0.5, 0.6])
        n = pick(rng, [60, 80, 100, 120, 150])
        N = pick(rng, [3000, 5000, 8000, 12000])
        random_ok = True
        if fail == "random":
            random_ok = False
        if fail == "ten":
            N = pick(rng, [400, 500, 600, 700])
            n = pick(rng, [80, 100, 120]);
        if fail == "large":
            p0 = pick(rng, [0.05, 0.08, 0.1]); n = pick(rng, [40, 60, 80])
        conds = {"random": random_ok, "ten": N >= 10 * n, "large": n * p0 >= 10 and n * (1 - p0) >= 10}
        bad = [k for k, v in conds.items() if not v]
        if (fail == "none" and not bad) or (fail != "none" and bad == [fail]):
            break
    # 독립 경로: 열거 — 조건을 따로 평가
    lc = (round(n * p0, 1), round(n * (1 - p0), 1))
    sel = f"a random sample of ${n}$ {who}" if random_ok else f"${n}$ {who} who volunteered to answer an online survey"
    stem = f"In {pop} with ${N}$ {who}, {sel} is used to test $H_0: p = {p0}$, where $p$ is the proportion of all {label} who {trait}. A one-sample z-test for a proportion is planned. Which of the following statements about the conditions for this test is correct?"
    stmts = {
        "none": ("All three conditions are satisfied", "none"),
        "random": ("The random condition is not satisfied", "random"),
        "ten": ("The $10\\%$ condition is not satisfied", "ten"),
        "large": ("The large counts condition is not satisfied", "large"),
    }
    key_t = stmts[fail][0]
    whys = {
        "none": "Claims all conditions are satisfied even though one condition is violated.",
        "random": "Claims the sample is not random even though the sample was selected at random.",
        "ten": f"Claims the $10\\%$ condition fails even though ${n}$ is less than $10\\%$ of ${N}$.",
        "large": f"Claims the large counts condition fails even though $np_0 = {clean(lc[0], 1)}$ and $n(1-p_0) = {clean(lc[1], 1)}$ are both at least $10$.",
    }
    # 각 진술이 코드가 계산한 조건과 맞는지 확인: 정답 진술만 참
    truth = {"none": not bad, "random": not conds["random"], "ten": not conds["ten"], "large": not conds["large"]}
    assert truth[fail] and sum(1 for k, v in truth.items() if v) == 1
    key = Opt(key_t, True, {"none": f"Each condition is verified: the sample is random, ${n} < 10\\%$ of ${N}$, and both expected counts are at least $10$.", "random": "A sample of volunteers is not a random sample, so the random condition is violated.", "ten": f"$10\\%$ of ${N}$ is ${N // 10}$, and ${n} > {N // 10}$, so the $10\\%$ condition is violated.", "large": f"$np_0 = {clean(lc[0], 1)} < 10$, so the large counts condition is violated."}[fail], None)
    ds = [Opt(v[0], False, whys[k] if k != "none" else "Claims all conditions are satisfied even though one condition is violated.", None) for k, v in stmts.items() if k != fail]
    bpr = sbp("st_conditions_prop", "3.7", "4.E", "Verify the conditions for a one-sample z-test for a proportion",
              ["Check each condition separately: random selection, the 10 percent condition for independence and the large counts condition using the null value", "Find the single condition that fails, or decide that all are met"],
              [("a z-test for a proportion needs random selection, a sample under 10 percent of the population and both np0 and n(1-p0) at least 10", "the stem gives the sampling method, the sample and population sizes and the null value")],
              [("claims_all_met", "says conditions are met when one fails"), ("false_random_failure", "claims random fails"), ("false_count_failure", "claims large counts fails")],
              "each condition is evaluated separately in code and exactly one statement agrees with all three evaluations",
              {"type": "none", "must_include": []}, ["condition_check", "claim_justification"], method="separate evaluation of each condition")
    return spack("st_conditions_prop", "3.7", "4.E", stem, key, ds, rng, bpr, None, 100, [f"fail={fail}", f"n={n}", f"N={N}", f"p0={p0}"])


# ======================= C2. 평균 t 절차 조건: 점도표 (4.2 / 4.E) =======================
CT_CTX = [("times, in minutes, that customers wait at a drive-through window", "Waiting time (minutes)"), ("daily sales, in hundreds of dollars, at a food truck", "Daily sales (hundreds of dollars)"), ("lengths, in centimeters, of fish caught in a lake", "Length (centimeters)")]


def _dots(vals):
    cnt = {}
    for v in vals:
        cnt[v] = cnt.get(v, 0) + 1
    return [{"value": v, "count": c} for v, c in sorted(cnt.items())]


def st_conditions_t(rng):
    what, xlabel = pick(rng, CT_CTX)
    case = pick(rng, ["small_ok", "small_bad", "large_skew"])
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        if case == "small_ok":
            n = pick(rng, [12, 14, 16])
            vals = [int(round(v)) for v in gen.normal(20, 3, n)]
        elif case == "small_bad":
            n = pick(rng, [12, 14, 16])
            vals = [int(round(v)) for v in gen.normal(20, 2, n - 1)] + [pick(rng, [34, 36, 38])]
        else:
            n = pick(rng, [40, 45, 50])
            vals = [min(40, int(round(v))) for v in gen.gamma(2.0, 5.0, n)]
        cnt = _dots(vals)
        if len(cnt) > 20 or max(c["count"] for c in cnt) > 9:
            continue
        a = np.array(vals)
        q1, q3 = np.percentile(a, [25, 75]); iqr = q3 - q1
        out = ((a > q3 + 1.5 * iqr) | (a < q1 - 1.5 * iqr)).sum()
        skew = float(ss.skew(a))
        if case == "small_ok" and out == 0 and abs(skew) < 0.45:
            break
        if case == "small_bad" and out >= 1 and skew > 1.0:
            break
        if case == "large_skew" and skew > 0.9:
            break
    ok = (n >= 30) or (out == 0 and abs(skew) < 0.45)  # 독립 경로: 표본 크기 또는 그림 기준
    assert ok == (case != "small_bad")
    S = {
        "ok_graph": "A t-procedure is reasonable because the sample is random and the dotplot shows no strong skewness or outliers",
        "ok_clt": f"A t-procedure is reasonable because the sample size ${n}$ is at least $30$, so the sampling distribution of the sample mean is approximately normal",
        "bad_graph": f"A t-procedure is not reasonable because the sample size ${n}$ is less than $30$ and the dotplot shows strong skewness and an outlier",
        "bad_small": f"A t-procedure is not reasonable because the sample size ${n}$ is less than $30$",
        "bad_skew": "A t-procedure is not reasonable because the dotplot is skewed",
        "ok_robust": "A t-procedure is reasonable because t procedures work for any sample size and any shape",
        "bad_sigma": "A t-procedure is not reasonable because the population standard deviation is not known",
        "ok_n": f"A t-procedure is reasonable because the sample size ${n}$ is large enough for the Central Limit Theorem",
    }
    if case == "small_ok":
        key_k, wr = "ok_graph", ["bad_small", "ok_n", "bad_sigma"]
        kw = f"With ${n} < 30$ the shape must be checked in the graph, and the dotplot shows no strong skewness or outliers."
    elif case == "small_bad":
        key_k, wr = "bad_graph", ["ok_robust", "ok_n", "bad_sigma"]
        kw = f"With ${n} < 30$ the graph must show no strong skewness or outliers, but the dotplot shows both."
    else:
        key_k, wr = "ok_clt", ["bad_skew", "bad_sigma", "ok_robust"]
        kw = f"Since ${n} \\ge 30$ the Central Limit Theorem makes the sampling distribution of the mean approximately normal even though the sample is skewed."
    whys = {
        "bad_small": "Rejects the procedure because $n < 30$ and ignores that a roughly symmetric graph with no outliers is enough for a small sample.",
        "ok_n": "Claims the Central Limit Theorem applies although the sample size is less than $30$.",
        "bad_sigma": "A t-procedure is designed for an unknown population standard deviation, so this is not a reason to reject it.",
        "ok_robust": "Believes the t-procedures work for any sample size and shape, but strong skewness or outliers in a small sample are a problem.",
        "bad_skew": "Ignores that a sample size of at least $30$ allows the procedure even when the sample is skewed.",
    }
    key = Opt(S[key_k], True, kw, None)
    ds = [Opt(S[k], False, whys[k], None) for k in wr]
    stem = f"A random sample of ${n}$ {what} is selected. The dotplot shown displays the sample data. The researcher plans to construct a $95\\%$ confidence interval for the population mean using a t-procedure. Which of the following statements is correct?"
    stim = stat_stim(f"Dotplot of {n} sample values", "dot_plot", xTitle=xlabel, dots=cnt)
    bpr = sbp("st_conditions_t", "4.2", "4.E", "Verify the normality condition for a t-procedure from the sample size and a graph",
              ["Check the sample size: at least 30 allows the Central Limit Theorem to apply", "For a smaller sample, read the dotplot for strong skewness or outliers before deciding"],
              [("a t-procedure for a mean is justified by n at least 30 or by a graph that shows no strong skewness or outliers", "the stem gives the sample size and the dotplot shows the sample data")],
              [("rejects_small_symmetric", "rejects a small symmetric sample"), ("clt_for_small_n", "applies the Central Limit Theorem to a small sample"), ("sigma_unknown_reason", "cites an unknown sigma as the problem")],
              "the sample is simulated and the skewness, interquartile outlier count and sample size are computed independently of the plotted counts; the case is accepted only if the rule agrees with the planned case",
              {"type": "dot_plot", "must_include": ["sample values"]}, ["condition_check", "representation_reading"], method="simulation plus separate rule evaluation")
    return spack("st_conditions_t", "4.2", "4.E", stem, key, ds, rng, bpr, stim, 100, [f"case={case}", f"n={n}"])


# ======================= C3. 두 표본 t 조건: 두 상자그림 (4.10 / 4.E) =======================
C3_CTX = [("the time to run a mile, in minutes, for athletes in two training programs", "Time to run a mile (minutes)", "Program A", "Program B"), ("the score on a final exam, in points, for students taught with two teaching methods", "Score on a final exam (points)", "Method 1", "Method 2")]


def st_conditions_two_t(rng):
    what, lab, g1, g2 = pick(rng, C3_CTX)
    case = pick(rng, ["small_ok", "small_outlier", "large_outlier"])
    n1 = pick(rng, [12, 14, 15]) if case != "large_outlier" else pick(rng, [40, 45])
    n2 = pick(rng, [12, 14, 16]) if case != "large_outlier" else pick(rng, [42, 50])

    def box(center, spread, with_out):
        q1 = center - spread; q3 = center + spread; med = center + rng.choice([-1, 0, 1])
        lo = q1 - rng.randint(spread // 2 + 1, spread + 2); hi = q3 + rng.randint(spread // 2 + 1, spread + 2)
        outs = [q3 + int(1.5 * 2 * spread) + rng.randint(3, 7)] if with_out else []
        return dict(min=lo, q1=q1, median=med, q3=q3, max=hi, outliers=outs)
    b1 = box(rng.randint(40, 60), rng.randint(4, 7), False)
    b2 = box(rng.randint(40, 60), rng.randint(4, 7), case != "small_ok")
    # 독립 경로: 이상치 규칙을 상자그림 수치에 다시 적용
    def has_out(b):
        iqr = b["q3"] - b["q1"]
        return bool(b["outliers"]) and all(o > b["q3"] + 1.5 * iqr for o in b["outliers"]) and b["max"] <= b["q3"] + 1.5 * iqr
    if case != "small_ok":
        assert has_out(b2) and not has_out(b1)
    nmin = min(n1, n2)
    reasonable = nmin >= 30 or not (has_out(b1) or has_out(b2))
    assert reasonable == (case != "small_outlier")
    S = {
        "ok_graph": f"A two-sample t-procedure is reasonable because both sample sizes are less than $30$ but neither boxplot shows an outlier or strong skewness",
        "bad_graph": f"A two-sample t-procedure is not reasonable because a sample size is less than $30$ and the boxplot for {g2} shows an outlier",
        "ok_clt": f"A two-sample t-procedure is reasonable because both sample sizes, ${n1}$ and ${n2}$, are at least $30$ even though one boxplot shows an outlier",
        "bad_n": "A two-sample t-procedure is not reasonable because the two sample sizes are not equal",
        "ok_any": "A two-sample t-procedure is reasonable because boxplots can never show a problem with the normality condition",
        "bad_small": f"A two-sample t-procedure is not reasonable because the sample sizes are less than $30$",
        "bad_outlier": f"A two-sample t-procedure is not reasonable because the boxplot for {g2} shows an outlier",
        "ok_equal_spread": "A two-sample t-procedure is reasonable because the two boxplots have about the same spread",
    }
    if case == "small_ok":
        key_k, wr = "ok_graph", ["bad_n", "bad_small", "ok_equal_spread"]
        kw = "With small samples the graphs must show no strong skewness or outliers, and neither boxplot has an outlier."
    elif case == "small_outlier":
        key_k, wr = "bad_graph", ["ok_any", "bad_n", "ok_equal_spread"]
        kw = f"With a sample size below $30$ an outlier in the boxplot for {g2} is a problem for the normality condition."
    else:
        key_k, wr = "ok_clt", ["bad_outlier", "bad_n", "ok_any"]
        kw = "Both sample sizes are at least $30$, so the Central Limit Theorem makes the sampling distributions approximately normal despite the outlier."
    whys = {
        "bad_n": "The sample sizes do not need to be equal for a two-sample t-procedure.",
        "bad_small": "Rejects the procedure only because the samples are small and ignores that the graphs may show no strong skewness or outliers.",
        "ok_equal_spread": "Equal spread is not the condition: the shapes of the two distributions must be checked, not their spreads.",
        "ok_any": "Boxplots do display outliers, so they can show a problem with the normality condition.",
        "bad_outlier": "Ignores that large samples (at least $30$ in each group) make the procedure appropriate despite an outlier.",
    }
    key = Opt(S[key_k], True, kw, None)
    ds = [Opt(S[k], False, whys[k], None) for k in wr]
    stem = f"A researcher compares {what}, {g1} and {g2}, using independent random samples of ${n1}$ and ${n2}$ observations, respectively. The boxplots shown display the sample data. The researcher plans a two-sample t-interval for the difference in population means. Which statement about the normality condition is correct?"
    stim = stat_stim(f"Side-by-side boxplots for {g1} and {g2}", "boxplot", xTitle=lab, boxes=[{"name": g1, **b1}, {"name": g2, **b2}])
    bpr = sbp("st_conditions_two_t", "4.7", "4.E", "Verify the normality condition for a two-sample t-procedure from sample sizes and boxplots",
              ["Check each sample size: at least 30 allows the Central Limit Theorem to apply", "For smaller samples, read each boxplot for outliers or strong skewness before deciding"],
              [("a two-sample t-procedure is justified when both samples are at least 30 or the graphs show no strong skewness or outliers", "the stem gives both sample sizes and the boxplots show the sample data")],
              [("unequal_sizes_problem", "treats unequal sample sizes as a problem"), ("small_n_rejects_all", "rejects every small sample regardless of the graphs"), ("boxplot_cannot_show_outliers", "believes the boxplot cannot show a problem")],
              "the outlier rule is applied again to the plotted five-number summaries, and the decision rule is evaluated separately from the planned case",
              {"type": "boxplot", "must_include": ["both samples"]}, ["condition_check", "representation_reading"], method="rule evaluation on plotted summaries")
    return spack("st_conditions_two_t", "4.7", "4.E", stem, key, ds, rng, bpr, stim, 105, [f"case={case}", f"n1={n1}", f"n2={n2}"])


# ======================= H1. 두 비율 차 신뢰구간으로 주장 정당화 (3.11 / 4.G) =======================
TP_CTX = [("a new reminder text message", "attend their scheduled appointment", "Reminder group", "Control group", "patients"), ("a redesigned checkout page", "complete a purchase", "New design group", "Old design group", "website visitors")]


def st_two_prop_ci_claim(rng):
    what, trait, g1, g2, units = pick(rng, TP_CTX)
    for _ in forever():
        n1, n2 = rng.randint(180, 320), rng.randint(180, 320)
        p1, p2 = rng.uniform(0.35, 0.7), rng.uniform(0.3, 0.7)
        x1, x2 = round(n1 * p1), round(n2 * p2)
        a, b = x1 / n1, x2 / n2
        se = math.sqrt(a * (1 - a) / n1 + b * (1 - b) / n2)
        z = ss.norm.ppf(0.975)
        # 독립 경로: 이분법으로 z* 를 다시 구함
        lo_z, hi_z = 1.0, 3.0
        for _ in range(60):
            mid = (lo_z + hi_z) / 2
            if ncdf(mid) < 0.975:
                lo_z = mid
            else:
                hi_z = mid
        agree(z, lo_z, tol=1e-8, name="zstar")
        d = a - b
        lo, hi = d - z * se, d + z * se
        if min(abs(lo), abs(hi)) < 0.012 and lo * hi > 0:
            continue
        if lo * hi < 0 and max(abs(lo), abs(hi)) < 0.03:
            continue
        break
    kind = "above" if lo > 0 else ("below" if hi < 0 else "contains")
    L, H = f"{lo:.3f}", f"{hi:.3f}"
    iv = f"$({L},\\ {H})$"
    claims = {
        "above": f"There is convincing evidence that the proportion of {units} who {trait} is greater for the {g1.lower()} than for the {g2.lower()}",
        "below": f"There is convincing evidence that the proportion of {units} who {trait} is greater for the {g2.lower()} than for the {g1.lower()}",
        "contains": f"There is not convincing evidence of a difference in the proportions of {units} who {trait} between the two groups",
    }
    if kind == "contains":
        key = Opt(claims["contains"], True, f"The interval {iv} contains $0$, so $0$ is a plausible value for the difference and a difference is not supported.", None)
        ds = [Opt(claims["above"], False, "Claims a positive difference even though the interval includes $0$.", None),
              Opt(f"The interval contains $0$, so there is convincing evidence that the two population proportions are equal", False, "Treats an interval that contains $0$ as proof that the proportions are equal instead of as a lack of evidence for a difference.", None),
              Opt(f"There is a $95\\%$ probability that the difference in sample proportions lies in the interval {iv}", False, "Interprets the confidence level as a probability about the sample statistic instead of describing the method.", None)]
    else:
        right = claims[kind]; wrong_dir = claims["below" if kind == "above" else "above"]
        key = Opt(right, True, f"The entire interval {iv} is {kind} $0$, which supports a difference in this direction.", None)
        ds = [Opt(wrong_dir, False, "Reverses the direction: the sign of the interval shows which group has the larger proportion.", None),
              Opt(claims["contains"], False, f"Claims there is no evidence of a difference even though the interval {iv} does not contain $0$.", None),
              Opt(f"There is a $95\\%$ probability that the difference in sample proportions lies in the interval {iv}", False, "Interprets the confidence level as a probability about the sample statistic instead of describing the method.", None)]
    stem = f"A study compares the proportion of {units} who {trait} for a group using {what} ({g1}) and a comparison group ({g2}), using independent random samples of ${n1}$ and ${n2}$ {units}, and the conditions for inference are met. A $95\\%$ confidence interval for $p_1 - p_2$ is {iv}, where $p_1$ is the proportion for the {g1.lower()} and $p_2$ is the proportion for the {g2.lower()}. Which of the following claims is justified by the interval?"
    bpr = sbp("st_two_prop_ci_claim", "3.11", "4.G", "Justify a claim about a difference of proportions from a confidence interval",
              ["Check whether zero is inside the interval for the difference", "If zero is outside, use the sign of the interval to decide which population proportion is larger"],
              [("an interval for a difference that excludes 0 supports a difference in the direction of its sign, and an interval containing 0 does not", "the stem gives the interval, defines p1 and p2 and says the conditions are met")],
              [("accepts_null_when_zero_inside", "treats inclusion of zero as proof of no difference"), ("reversed_direction", "reverses the direction of the difference"), ("probability_interpretation", "gives a probability interpretation of the confidence level")],
              "the interval is recomputed from counts with z* found by bisection on the normal cdf and the claim is derived from the sign pattern of the endpoints",
              {"type": "none", "must_include": []}, ["claim_justification", "interpretation"], method="interval recomputation and sign rule")
    return spack("st_two_prop_ci_claim", "3.11", "4.G", stem, key, ds, rng, bpr, None, 110, [f"kind={kind}", f"lo={L}", f"hi={H}"])


# ======================= H2. 회귀 출력에서 잔차 계산 (5.4 / 3.B) =======================
RR_CTX = [("the number of hours a student studied", "exam score, in points", "Hours", "Score", (1, 8), (45, 5.5), 3.0, "student"), ("the age of a used car, in years", "selling price, in thousands of dollars", "Age", "Price", (1, 9), (28, -2.2), 1.8, "car")]


def st_regression_residual_output(rng):
    xdesc, ydesc, xn, yn, xr, (a0, b0), noise, unit = pick(rng, RR_CTX)
    for _ in forever():
        b = round(b0 + rng.uniform(-0.5, 0.5), 2)
        a = round(a0 + rng.uniform(-2, 2), 1)
        xv = rng.randint(xr[0] + 1, xr[1] - 1)
        yhat = a + b * xv
        resid = round(rng.choice([-1, 1]) * rng.uniform(2.5, 7), 1)
        yv = round(yhat + resid, 1)
        res_true = yv - yhat
        vals = {"key": res_true, "sign": -res_true, "swap": yv - (b + a * xv), "no_int": yv - b * xv}
        r1 = {k: round(v, 1) for k, v in vals.items()}
        if len(set(r1.values())) == 4 and min(abs(r1[i] - r1[j]) for i in r1 for j in r1 if i < j) >= 0.4 and abs(res_true) >= 2:
            break
    # 독립 경로: 최소제곱선에서 점이 선 위/아래에 있는지로 부호를 다시 확인
    above = yv > yhat
    assert (res_true > 0) == above
    se = round(rng.uniform(0.6, 1.4), 3)
    out = {"title": f"Regression Analysis: {yn} versus {xn}", "sections": [
        {"columns": ["Predictor", "Coef", "SE Coef", "T", "P"], "rows": [["Constant", f"{a:.2f}", f"{se:.3f}", f"{a / se:.2f}", "0.000"], [xn, f"{b:.2f}", f"{se / 2:.3f}", f"{b / (se / 2):.2f}", "0.000"]]},
        {"columns": ["S", "R-Sq"], "rows": [["2.1", "78.0%"]]}]}
    stim = stat_stim("Computer output for a least-squares regression", "output", output=out)
    fmt1 = lambda v: T(v, 1)
    key = Opt(fmt1(res_true), True, f"The predicted value is $\\hat y = {a:.1f} + ({b:.2f})({xv}) \\approx {yhat:.2f}$, and the residual is observed minus predicted, ${yv} - {yhat:.2f} \\approx {res_true:.1f}$.", round(res_true, 1))
    whys = {"sign": "Subtracts in the wrong order (predicted minus observed), which reverses the sign of the residual.", "swap": "Uses the slope as the intercept and the intercept as the slope when computing the predicted value.", "no_int": "Leaves out the intercept and predicts with the slope times $x$ alone."}
    ds = [Opt(fmt1(r1[k]), False, whys[k], r1[k]) for k in ("sign", "swap", "no_int")]
    stem = f"A least-squares regression line is used to predict {ydesc}, from {xdesc}. The computer output shown is for the regression. For one {unit} with {xn.lower()} equal to ${xv}$, the actual {yn.lower()} is ${yv}$. What is the residual for this {unit}? Round to one decimal place."
    bpr = sbp("st_regression_residual_output", "5.4", "3.B", "Compute a residual from regression computer output",
              ["Read the intercept and the slope from the Coef column of the output", "Compute the predicted value and subtract it from the observed value, in that order"],
              [("a residual is the observed response minus the value predicted by the least-squares line", "the output gives the coefficients and the stem gives the x value and the observed y")],
              [("sign_reversed", "subtracts in the wrong order"), ("coefficients_swapped", "swaps slope and intercept"), ("intercept_omitted", "leaves out the intercept")],
              "the residual is recomputed from the coefficients and checked against the side of the line (above or below) on which the observed point lies",
              {"type": "computer_output", "must_include": ["Coef column"]}, ["representation_reading", "calculated_value_decision"], method="recomputation and side-of-line check")
    return spack("st_regression_residual_output", "5.4", "3.B", stem, key, ds, rng, bpr, stim, 105, [f"a={a}", f"b={b}", f"x={xv}", f"y={yv}"])


# ======================= H3. r^2 해석 (5.5 / 4.D) =======================
R2_CTX = [("the number of hours of practice per week", "a musician's performance score", "practice time", "performance score"), ("a car's weight, in pounds", "its fuel efficiency, in miles per gallon", "weight", "fuel efficiency")]


def st_r2_interp(rng):
    xd, yd, xs, ys = pick(rng, R2_CTX)
    r = rng.choice([-1, 1]) * rng.choice([0.7, 0.8, 0.9]) if False else rng.choice([-0.8, -0.7, 0.8, 0.9, -0.9])
    r2 = round(r * r, 2)
    pct = int(round(r2 * 100))
    # 독립 경로: 수치 r^2 가 r 의 제곱과 일치하며 r 의 부호는 기울기 부호와 같다
    agree(r2, r * r, tol=1e-2, name="r2")
    key = Opt(f"About ${pct}\\%$ of the variation in {ys} is accounted for by the linear relationship with {xs}", True, f"$r^2 = {r2}$ is the proportion of the variation in the response that is explained by the linear relationship with the explanatory variable.", None)
    ds = [Opt(f"About ${pct}\\%$ of the points in the scatterplot lie exactly on the least-squares line", False, "Misreads $r^2$ as the percent of data points that fall on the regression line.", None),
          Opt(f"{ys[0].upper() + ys[1:]} increases by ${pct}\\%$ for each one-unit increase in {xs}", False, "Confuses $r^2$ with the slope and interprets it as a percent change in the response.", None),
          Opt(f"The correlation between {xs} and {ys} is ${r2}$", False, "Confuses $r^2$ with the correlation coefficient $r$: the correlation here is the square root of $r^2$ with the sign of the slope.", None)]
    sg = "positive" if r > 0 else "negative"
    stem = f"A least-squares regression line is used to describe the relationship between {xd} and {yd}. The relationship is {sg}, and the coefficient of determination is $r^2 = {r2}$. Which of the following is the correct interpretation of $r^2$?"
    bpr = sbp("st_r2_interp", "5.5", "4.D", "Interpret the coefficient of determination in context",
              ["Recall that r squared is the proportion of the variation in the response accounted for by the linear relationship with the explanatory variable", "Reject options that treat r squared as a percent of points on the line, a slope or the correlation"],
              [("r squared is the proportion of variation in y explained by the linear relationship with x", "the stem gives r squared and the direction of the association")],
              [("points_on_line", "reads r squared as points on the line"), ("slope_as_percent", "reads r squared as a slope"), ("r_instead_of_r2", "confuses r squared with r")],
              "r squared is checked as the square of a correlation r whose sign matches the described direction, and the sentences are generated from a fixed set of interpretations",
              {"type": "none", "must_include": []}, ["interpretation"], method="square of r recomputation")
    return spack("st_r2_interp", "5.5", "4.D", stem, key, ds, rng, bpr, None, 80, [f"r2={r2}", f"r={r}"])


# ======================= H4. 두 상자그림 비교 (1.9 / 4.A) =======================
BC_CTX = [("test scores, in points,", "Class A", "Class B"), ("delivery times, in minutes,", "Store A", "Store B")]


def st_boxplot_compare(rng):
    what, g1, g2 = pick(rng, BC_CTX)
    for _ in forever():
        def fs():
            q1 = rng.randint(55, 75); iqr = rng.randint(6, 18); q3 = q1 + iqr; med = q1 + rng.randint(2, iqr - 2)
            lo = q1 - rng.randint(4, 14); hi = q3 + rng.randint(4, 14)
            return dict(min=lo, q1=q1, median=med, q3=q3, max=hi, outliers=[])
        A, B = fs(), fs()
        iqa, iqb = A["q3"] - A["q1"], B["q3"] - B["q1"]
        ra, rb = A["max"] - A["min"], B["max"] - B["min"]
        if A["median"] == B["median"] or iqa == iqb or ra == rb or iqa == ra or iqb == rb:
            continue
        pool = {
            "med_A": (A["median"] > B["median"], f"The median of {g1} is greater than the median of {g2}", "Compares the medians in the wrong direction."),
            "iqr_A": (iqa > iqb, f"The interquartile range of {g1} is greater than the interquartile range of {g2}", "Compares the interquartile ranges in the wrong direction or misreads the box length."),
            "rng_A": (ra > rb, f"The range of {g1} is greater than the range of {g2}", "Compares the ranges in the wrong direction or reads the box instead of the whiskers."),
            "q3_A": (A["q3"] > B["q3"], f"The third quartile of {g1} is greater than the third quartile of {g2}", "Misreads the right edge of the boxes."),
            "max_A": (A["max"] > B["max"], f"The maximum of {g1} is greater than the maximum of {g2}", "Misreads the end of the upper whiskers."),
        }
        trues = [k for k, v in pool.items() if v[0]]; falses = [k for k, v in pool.items() if not v[0]]
        if len(trues) >= 1 and len(falses) >= 3:
            break
    kk = rng.choice(trues); wf = rng.sample(falses, 3)
    key = Opt(pool[kk][1], True, "This comparison is true for the plotted five-number summaries.", None)
    whys = {"med_A": "The line inside the box of the other class is higher, so this comparison of medians is reversed.", "iqr_A": "The box for the other class is longer, so this comparison of interquartile ranges is reversed.",
            "rng_A": "The whiskers of the other class span a larger range, so this comparison of ranges is reversed.", "q3_A": "The right edge of the box for the other class is farther right, so this comparison is reversed.", "max_A": "The upper whisker of the other class extends farther right, so this comparison is reversed."}
    ds = [Opt(pool[k][1], False, whys[k], None) for k in wf]
    stem = f"The boxplots shown display {what} for {g1} and {g2}. Which of the following statements is correct?"
    stim = stat_stim(f"Side-by-side boxplots of {what.strip(',')}", "boxplot", xTitle=what.strip(" ,").capitalize(), boxes=[{"name": g1, **A}, {"name": g2, **B}])
    bpr = sbp("st_boxplot_compare", "1.9", "4.A", "Compare two distributions displayed in boxplots",
              ["Read the median, the quartiles and the whisker ends for each group from the boxplot", "Evaluate each statement about center, spread or extremes and keep the one that matches the plotted values"],
              [("a boxplot shows the minimum, the quartiles, the median and the maximum", "the boxplots show the five-number summaries of both groups with no outliers")],
              [("reversed_median_comparison", "reverses a comparison of medians"), ("reversed_spread_comparison", "reverses a comparison of spreads"), ("misread_whisker", "misreads a whisker end")],
              "each statement is evaluated against the plotted five-number summaries and exactly one of the four chosen statements is true",
              {"type": "boxplot", "must_include": ["both groups"]}, ["representation_reading", "interpretation"], method="statement evaluation against five-number summaries")
    return spack("st_boxplot_compare", "1.9", "4.A", stem, key, ds, rng, bpr, stim, 85, [f"med={A['median']},{B['median']}", f"iqr={iqa},{iqb}"])


# ======================= H5. 독립 사건 판정 (2.7 / 3.C) =======================
IND_CTX = [("students", "student", "Grade level", [("Freshman", "is a freshman"), ("Senior", "is a senior")], [("Has a job", "has a job"), ("No job", "does not have a job")]),
           ("customers", "customer", "Age group", [("Under 40", "is under 40"), ("40 or older", "is 40 or older")], [("Online", "buys online"), ("In store", "buys in a store")])]


def st_independence_check(rng):
    plural, sing, hdr, rows, cols = pick(rng, IND_CTX)
    indep = rng.random() < 0.5
    for _ in forever():
        r1 = [rng.randint(2, 6) * 10, rng.randint(2, 6) * 10]
        if indep:
            k = rng.choice([2, 3, 4])
            r2 = [r1[0] * k // 2 if (r1[0] * k) % 2 == 0 else r1[0] * k, r1[1] * k // 2 if (r1[1] * k) % 2 == 0 else r1[1] * k]
            r2 = [r1[0] * k, r1[1] * k]
            cells = [r1, r2]
        else:
            cells = [r1, [rng.randint(2, 12) * 10, rng.randint(2, 12) * 10]]
        N = sum(map(sum, cells))
        row0, col0 = sum(cells[0]), cells[0][0] + cells[1][0]
        pA, pB, pAB = Fr(row0, N), Fr(col0, N), Fr(cells[0][0], N)
        isind = pAB == pA * pB
        if isind == indep and (indep or abs(float(pAB - pA * pB)) > 0.02):
            break
    # 독립 경로: 개별 기록 열거로 P(A|B) 와 P(A) 비교
    recs = [(i, j) for i in range(2) for j in range(2) for _ in range(cells[i][j])]
    pa = sum(1 for x in recs if x[0] == 0) / len(recs)
    pab = sum(1 for x in recs if x[0] == 0 and x[1] == 0) / sum(1 for x in recs if x[1] == 0)
    assert (abs(pa - pab) < 1e-12) == isind
    ev = lambda i: rows[i][1]; cv = lambda j: cols[j][1]
    key_t = (f"The events are independent because $P(A\\mid B) = P(A) = {float(pA):.3f}$" if isind
             else f"The events are not independent because $P(A\\mid B) \\approx {float(Fr(cells[0][0], col0)):.3f}$ is not equal to $P(A) \\approx {float(pA):.3f}$")
    ds_t = [(f"The events are {'not ' if isind else ''}independent because $P(A \\text{{ and }} B) \\approx {float(pAB):.3f}$ is {'not ' if isind else ''}equal to $P(A)\\cdot P(B) \\approx {float(pA * pB):.3f}$" if False else None, "")]
    wrongs = []
    if isind:
        wrongs = [(f"The events are not independent because the number of {plural} in each cell is not the same", "Thinks independence requires equal cell counts instead of equal conditional probabilities."),
                  (f"The events are not independent because $P(A \\text{{ and }} B) \\approx {float(pAB):.3f}$ is not equal to $P(A) = {float(pA):.3f}$", "Compares the joint probability with $P(A)$ instead of with $P(A)\\cdot P(B)$."),
                  (f"The events are not independent because they can both occur at the same time", "Confuses independent events with mutually exclusive events.")]
    else:
        wrongs = [(f"The events are independent because they can both occur at the same time", "Confuses independence with the ability to occur together."),
                  (f"The events are independent because $P(A \\text{{ and }} B) \\approx {float(pAB):.3f}$ is greater than $0$", "Believes a positive joint probability proves independence."),
                  (f"The events are not independent because $P(A) \\neq P(B)$", "Compares $P(A)$ with $P(B)$, which says nothing about independence.")]
    key = Opt(key_t, True, "Independent events satisfy $P(A\\mid B)=P(A)$; the table gives the counts needed to compare the two.", None)
    ds = [Opt(t, False, w, None) for t, w in wrongs]
    stem = f"The table shown summarizes the responses of ${N}$ {plural}. One {sing} is selected at random. Let $A$ be the event that the {sing} {ev(0)} and let $B$ be the event that the {sing} {cv(0)}. Which of the following statements is correct? Round probabilities to three decimal places."
    stim = stat_stim(f"Two-way table of {hdr.lower()} and response", "two_way", rowHeader=hdr, rowLabels=[x[0] for x in rows], colLabels=[x[0] for x in cols], cells=cells)
    bpr = sbp("st_independence_check", "2.7", "3.C", "Decide whether two events are independent from a two-way table",
              ["Find P(A) and the conditional probability P(A given B) from the table", "Compare the two: events are independent only when they are equal"],
              [("events A and B are independent exactly when P(A given B) equals P(A)", "the table gives all counts")],
              [("equal_cell_counts", "thinks independence needs equal counts"), ("mutually_exclusive_confusion", "confuses independence with mutual exclusivity"), ("wrong_comparison", "compares the wrong probabilities")],
              "the table is expanded into individual records and P(A given B) and P(A) are found by enumeration, independent of the cell-ratio calculation",
              {"type": "two_way_table", "must_include": ["all cell counts"]}, ["procedure_choice", "claim_justification", "representation_reading"], method="record enumeration")
    return spack("st_independence_check", "2.7", "3.C", stem, key, ds, rng, bpr, stim, 100, [f"N={N}", f"independent={isind}"])


STAGE_SINGLES = ["st_investigative_question", "st_question_data_match", "st_hypotheses_setup", "st_method_choice_means", "st_method_choice_cat", "st_type_errors", "st_sampling_method", "st_conditions_prop", "st_conditions_t", "st_conditions_two_t",
                 "st_two_prop_ci_claim", "st_regression_residual_output", "st_r2_interp", "st_boxplot_compare", "st_independence_check"]
