"""AP Statistics S2-b — 새 단독 MC 원형(2026-10-12). 첫 풀 세트의 부족 칸을 채우는 용도: 스킬 1(조사 질문) 3개, 스킬 2(방법·설계·가설·구간 폭·검정력) 8개 중 신규 7개.
정답 판정은 코드(속성표·진리표·열거·수치)가 하고 해석·설계 문장은 고정 문장 4개(정답 1 + 이름 붙은 오해 3)다. 모든 수·통계량은 $...$ 안에 쓴다."""
from stats_common import *


def _bp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method):
    return sbp(arch, topic, skill, concept, thinking, cond, mis, path, material, judgment, method=method)


NOSTIM = {"type": "none", "must_include": []}

# ======================= Q-a. 조사 질문이 묻는 자료 구조 (1.1 / 1.A) =======================
QT_CTX = [
    dict(pop="students at a large high school", y="number of hours of sleep on a school night", x="number of hours of homework on a school night", g=("students who ride the bus to school", "students who walk to school"), prop="own a car", c1="grade level", c2="whether the student owns a car"),
    dict(pop="adult members of a fitness center", y="number of visits to the center in a month", x="number of years as a member", g=("members who joined this year", "members who joined more than five years ago"), prop="use the swimming pool", c1="membership type", c2="whether the member uses the swimming pool"),
    dict(pop="customers of a coffee shop", y="amount spent, in dollars, on a visit", x="number of minutes spent in the shop", g=("customers who order at the counter", "customers who order with the phone app"), prop="buy a pastry", c1="time of day of the visit", c2="whether the customer buys a pastry"),
]
QT_STRUCT = {
    "one_quant": ("A question about the distribution of one quantitative variable", "one quantitative variable"),
    "one_cat": ("A question about the proportion of individuals in one category of a categorical variable", "one categorical variable"),
    "two_groups": ("A question that compares a quantitative variable between two groups", "a quantitative variable and a categorical variable that defines two groups"),
    "two_quant": ("A question about the relationship between two quantitative variables", "two quantitative variables"),
    "two_cat": ("A question about the association between two categorical variables", "two categorical variables"),
}


def st_question_type(rng):
    c = pick(rng, QT_CTX)
    qs = {
        "one_quant": f"What is the typical {c['y']} for {c['pop']}?",
        "one_cat": f"What proportion of {c['pop']} {c['prop']}?",
        "two_groups": f"Do {c['g'][0]} tend to have a greater {c['y']} than {c['g'][1]}?",
        "two_quant": f"Among {c['pop']}, is there a relationship between the {c['x']} and the {c['y']}?",
        "two_cat": f"Among {c['pop']}, is there an association between {c['c1']} and {c['c2']}?",
    }
    kk = pick(rng, list(qs))
    # 진리표(독립 경로): 질문에 나온 변수의 (유형 수) 로 구조가 정해진다 — 구조 5개는 서로 다른 (양적 수, 범주형 수, 집단 비교 여부) 조합이다
    sig = {"one_quant": (1, 0, False), "one_cat": (0, 1, False), "two_groups": (1, 1, True), "two_quant": (2, 0, False), "two_cat": (0, 2, False)}
    assert len(set(sig.values())) == 5 and [k for k, v in sig.items() if v == sig[kk]] == [kk]
    wrongs = rng.sample([k for k in qs if k != kk], 3)
    key = Opt(QT_STRUCT[kk][0], True, f"The question names {QT_STRUCT[kk][1]}, which is the structure this option describes.", None)
    ds = [Opt(QT_STRUCT[k][0], False, f"The question names {QT_STRUCT[kk][1]}, not {QT_STRUCT[k][1]}.", None) for k in wrongs]
    stem = f"A researcher plans to collect data from a random sample of {c['pop']} to answer the following investigative question: \"{qs[kk]}\" Which of the following best describes what this question asks about?"
    bpr = _bp("st_question_type", "1.1", "1.A", "Recognize what an investigative question asks about: one distribution, a comparison of groups or an association",
              ["List the variables that the question names and decide whether each is quantitative or categorical", "Match the number and types of variables, and whether groups are compared, to the one option with the same structure"],
              [("a valid investigative question names the variables it asks about, so its structure follows from the variables named", "the question is stated in the stem and every option describes a different variable structure")],
              [("wrong_variable_count", "names one variable when the question names two or the reverse"), ("wrong_variable_type", "mixes up quantitative and categorical variables"), ("comparison_vs_relationship", "mixes up comparing two groups with a relationship between two variables")],
              "the five question structures are generated from a table of (quantitative count, categorical count, groups compared) and exactly one row matches the question",
              NOSTIM, ["interpretation", "claim_justification"], "variable-structure table enumeration")
    return spack("st_question_type", "1.1", "1.A", stem, key, ds, rng, bpr, None, 70, [f"kind={kk}"])


# ======================= Q-b. 부적절한 초안 질문의 수정 (1.10 / 1.A) =======================
QR_CTX = [
    dict(topic="how much time students at the high schools of a district spend on social media each day",
         flaws={"opinion": ("Is social media a waste of time for high school students in the district?", "Asks for a judgment about value, which data cannot settle."),
                "individual": ("How much time did Jordan, a student at one of the high schools, spend on social media yesterday?", "Asks about one individual, so there is no population and no variability to study."),
                "lookup": ("How many of the district's high schools have a rule about social media use in class?", "Asks for a single count that can be looked up, so no variability among individuals is anticipated.")},
         cosm={"opinion": "Is it fair for the district's high schools to limit the time that students spend on social media?", "individual": "How much time did the first student surveyed at the district's high schools spend on social media yesterday?", "lookup": "How many social media apps are installed on the computers of the district's high schools?"},
         key="What is the typical amount of time that students at the district's high schools spend on social media each day?"),
    dict(topic="how long bus riders in a city wait at their stops",
         flaws={"opinion": ("Should the city add more buses to its routes?", "Asks for a judgment about what should be done, which data cannot settle."),
                "individual": ("How long did Ms. Alvarez wait at her bus stop this morning?", "Asks about one individual, so there is no population and no variability to study."),
                "lookup": ("How many bus routes does the city operate?", "Asks for a single count that can be looked up, so no variability among individuals is anticipated.")},
         cosm={"opinion": "Is waiting for a bus an unfair burden on the bus riders of the city?", "individual": "How long did the first rider interviewed at a bus stop wait for a bus?", "lookup": "How many bus stops are there in the city?"},
         key="What is the typical amount of time that bus riders in the city wait at their stops?"),
    dict(topic="how many books students at a university read for pleasure in a semester",
         flaws={"opinion": ("Is reading for pleasure better than watching television for university students?", "Asks for a judgment about which is better, which data cannot settle."),
                "individual": ("How many books did Priya, a student at the university, read for pleasure last semester?", "Asks about one individual, so there is no population and no variability to study."),
                "lookup": ("How many books does the university library own?", "Asks for a single count that can be looked up, so no variability among individuals is anticipated.")},
         cosm={"opinion": "Is reading for pleasure a more worthwhile activity than studying for students at the university?", "individual": "How many books did the first student surveyed at the university read for pleasure last semester?", "lookup": "How many novels are in the fiction collection of the university library?"},
         key="What is the typical number of books that students at the university read for pleasure in a semester?"),
]


def st_question_revision(rng):
    c = pick(rng, QR_CTX)
    draft = pick(rng, ["opinion", "individual", "lookup"])
    # 진리표(독립 경로): 개선안은 (변동 예상, 모집단 명시, 자료로 답함) 세 속성을 모두 가져야 한다
    attrs = {"key": (True, True, True), "opinion": (True, True, False), "individual": (True, False, True), "lookup": (False, True, True)}
    assert [k for k, v in attrs.items() if all(v)] == ["key"]
    other = [k for k in ("opinion", "individual", "lookup") if k != draft]
    key = Opt(c["key"], True, "Keeps the topic of the draft, names the population, anticipates variability among the individuals and can be answered by collecting and analyzing data.", None)
    ds = [Opt(c["flaws"][k][0], False, c["flaws"][k][1], None) for k in other]
    draft_q, draft_w = c["flaws"][draft]
    # 초안과 같은 결함을 그대로 둔 '표면만 바꾼' 개선안(가장 그럴듯한 오답)
    cosm = c["cosm"][draft]
    cw = {"opinion": "Still asks for an opinion rather than for data that vary among individuals in a population.",
          "individual": "Still asks about a single individual, so there is no population and no variability to study.",
          "lookup": "Still asks for a single published fact, so no variability among individuals is anticipated."}[draft]
    ds.append(Opt(cosm, False, cw, None))
    stem = f"A student wants to study {c['topic']}. The student's first draft of an investigative question is: \"{draft_q}\" Which of the following is the best revision that gives a valid investigative question requiring a statistical investigation?"
    bpr = _bp("st_question_revision", "1.10", "1.A", "Diagnose why a draft question is not a valid investigative question and choose the revision that fixes it",
              ["Decide which property the draft lacks: variability among individuals, a population, or answerability with data", "Choose the revision that has all three properties, not one that only rewords the flaw"],
              [("a valid investigative question anticipates variability, refers to a population and can be answered with data", "the draft and each revision are stated in the stem and the options")],
              [("same_flaw_reworded", "keeps the flaw of the draft in new words"), ("other_flaw", "fixes the draft but introduces a different flaw"), ("individual_not_population", "asks about one individual instead of a population")],
              "each revision is generated from the property table (variability, population, answerable with data); the draft flaw is one row, and exactly one revision has all three properties",
              NOSTIM, ["claim_justification", "interpretation"], "property table enumeration")
    return spack("st_question_revision", "1.10", "1.A", stem, key, ds, rng, bpr, None, 85, [f"draft={draft}"])


# ======================= Q-c. 표본으로 답할 수 있는 질문의 범위 (1.10 / 1.A) =======================
QS_CTX = [
    dict(sample="$150$ students selected at random from the list of all students at Lincoln High School", pop="students at Lincoln High School", broad="all high school students in the United States", other="students at Jefferson High School, a school across town", y="amount of time spent on homework each night", cause="Would a later school start time cause students to spend less time on homework?"),
    dict(sample="$200$ patients selected at random from the records of all patients of one regional clinic", pop="patients of the regional clinic", broad="all adults in the country", other="patients of a clinic in another state", y="number of days waiting for an appointment", cause="Would hiring more nurses cause patients to wait fewer days for an appointment?"),
    dict(sample="$120$ households selected at random from the list of all households in one town", pop="households in the town", broad="all households in the state", other="households in a neighboring town", y="monthly amount spent on groceries", cause="Would opening a new supermarket cause households to spend less on groceries?"),
]


def st_question_scope(rng):
    c = pick(rng, QS_CTX)
    # 진리표(독립 경로): 질문의 모집단이 표본이 뽑힌 모집단과 같고, 관찰로 답할 수 있어야 한다
    props = {"key": (True, True), "broad": (False, True), "other": (False, True), "cause": (True, False)}  # (모집단 일치, 관찰 자료로 답함)
    assert [k for k, v in props.items() if all(v)] == ["key"]
    key = Opt(f"What is the typical {c['y']} for {c['pop']}?", True, "The question refers to the population from which the sample was drawn at random, and it can be answered by summarizing the data collected.", None)
    ds = [Opt(f"What is the typical {c['y']} for {c['broad']}?", False, "The sample was drawn from a smaller population, so the data cannot be used to answer a question about this larger population.", None),
          Opt(f"What is the typical {c['y']} for {c['other']}?", False, "The sample was not drawn from this population, so the data say nothing about it.", None),
          Opt(c["cause"], False, "A cause-and-effect question needs an experiment with random assignment, but the data come only from a random sample that was observed.", None)]
    stem = f"A researcher collects data on the {c['y']} from a sample of {c['sample']}. No treatment is assigned to anyone. Which of the following investigative questions can be answered using the data from this sample?"
    bpr = _bp("st_question_scope", "1.10", "1.A", "Decide which investigative question the sample can answer from the population it was drawn from",
              ["Identify the population from which the sample was selected at random", "Reject questions about a larger or different population and questions that need random assignment to answer"],
              [("data from a random sample can answer questions about the population sampled, and only an experiment supports cause and effect", "the stem names the sampling frame and says that no treatment was assigned")],
              [("generalizes_beyond_population", "applies the result to a larger population than the one sampled"), ("different_population", "applies the result to a population that was not sampled"), ("causal_from_observation", "asks a cause-and-effect question of observational data")],
              "the population of each question is compared with the sampling frame and the study type is checked against the claim; exactly one question matches both",
              NOSTIM, ["claim_justification", "condition_check"], "population and study type comparison")
    return spack("st_question_scope", "1.10", "1.A", stem, key, ds, rng, bpr, None, 85, [f"pop={c['pop']}"])


# ======================= S-a. 표본추출의 편향 유형 (1.12 / 2.B) =======================
SB = {
    "under": ("Undercoverage", "Undercoverage occurs when some members of the population have no chance of being selected."),
    "vol": ("Voluntary response bias", "Voluntary response bias occurs when individuals choose for themselves whether to take part."),
    "non": ("Nonresponse bias", "Nonresponse bias occurs when individuals who were selected do not respond or cannot be reached."),
    "resp": ("Response bias", "Response bias occurs when individuals answer inaccurately, for example because of the wording of a question or the setting."),
}
SB_SC = {
    "under": [("A city survey about public transportation use is carried out by calling a random sample of numbers from a directory of landline telephones", "the directory leaves out residents who have no landline telephone"),
              ("A school wants to know how students get to school and surveys a random sample of students from the list of students who are present on a particular morning", "students who are absent that morning have no chance of being selected")],
    "vol": [("A radio station asks its listeners to call in to say whether the city should build a new stadium, and uses the callers to estimate the opinion of all residents", "the callers decided for themselves to respond"),
            ("A website invites all visitors to click a link and rate a new feature, and the ratings are used to describe all users", "only users who chose to click the link are in the data")],
    "non": [("A company sends a survey to a random sample of $500$ customers, but only $60$ customers return it, and the company uses the $60$ responses to describe all customers", "most of the customers who were selected did not respond"),
            ("A researcher mails a questionnaire about exercise habits to a random sample of adults, and many of the selected adults never return it", "many selected adults did not return the questionnaire")],
    "resp": [("An interviewer in uniform asks a random sample of students whether they have ever cheated on an exam, with the principal standing nearby", "the setting may lead students to answer untruthfully"),
             ("A random sample of voters is asked, \"Do you support the new law that will protect our children from harm?\"", "the wording of the question pushes respondents toward one answer")],
}


def st_sampling_bias(rng):
    kk = pick(rng, list(SB))
    sc, clue = pick(rng, SB_SC[kk])
    # 진리표(독립 경로): 시나리오의 단서 하나(프레임 제외 / 자기 선택 / 선택됐으나 무응답 / 부정확한 응답)가 한 편향만 가리킨다
    clues = {"under": "frame_excludes", "vol": "self_selected", "non": "selected_not_responding", "resp": "inaccurate_answers"}
    assert len(set(clues.values())) == 4
    key = Opt(SB[kk][0], True, f"{SB[kk][1]} In this scenario, {clue}.", None)
    ds = [Opt(SB[k][0], False, f"{SB[k][1]} That is not what happens here: {clue}.", None) for k in SB if k != kk]
    stem = f"{sc}. Which of the following is the most likely source of bias in this study?"
    bpr = _bp("st_sampling_bias", "1.12", "2.B", "Identify the source of bias in a sampling plan from how individuals were selected and how they answered",
              ["Decide who had a chance of being selected, who chose to respond, who was selected but did not respond and whether answers were accurate", "Match the one clue in the scenario to the one type of bias with that definition"],
              [("each type of bias has its own defining feature: excluded group, self-selection, nonresponse or inaccurate answers", "the scenario gives exactly one defining clue")],
              [("undercoverage_vs_nonresponse", "mixes up units that could not be selected with selected units that did not respond"), ("voluntary_vs_nonresponse", "mixes up self-selection with nonresponse"), ("response_vs_selection", "mixes up inaccurate answers with how units were selected")],
              "each scenario is built from one defining clue of a four-row table of bias types, and exactly one type matches that clue",
              NOSTIM, ["procedure_choice", "claim_justification"], "defining-clue table enumeration")
    return spack("st_sampling_bias", "1.12", "2.B", stem, key, ds, rng, bpr, None, 75, [f"bias={kk}"])


# ======================= S-b. 구획 설계(블록)의 근거 (1.13 / 2.B) =======================
BL = [
    dict(unit="plots", blockvar="field", blocks="two fields with different soil quality", ta="fertilizer A", tb="fertilizer B", resp="crop yield", n="$16$ plots in each of", who="a farmer", exp="the farmer"),
    dict(unit="students", blockvar="class", blocks="two classes taught by different teachers", ta="the new study guide", tb="the old study guide", resp="score on a final exam", n="$20$ students in each of", who="a principal", exp="the principal"),
    dict(unit="rooms", blockvar="building", blocks="two buildings with different heating systems", ta="the new thermostat setting", tb="the standard thermostat setting", resp="energy use", n="$12$ rooms in each of", who="a facilities manager", exp="the manager"),
]


def st_blocking_design(rng):
    c = pick(rng, BL)
    PL = c['blockvar'] + ('es' if c['blockvar'].endswith('s') else 's')  # class -> classes (S2-b 반려 사유: 'classs')
    # 진리표(독립 경로): 설계가 갖춰야 할 세 속성 — 무작위 배정, 블록 안에서 두 처리를 모두 사용, 블록 효과 분리
    des = {"key": (True, True), "by_block": (False, False), "choose": (False, False), "crd": (True, False)}  # (무작위 배정, 블록마다 두 처리를 같은 수로)
    assert [k for k, v in des.items() if all(v)] == ["key"]
    key = Opt(f"Within each {c['blockvar']}, randomly assign half of the {c['unit']} to {c['ta']} and the other half to {c['tb']}", True, f"Random assignment within each {c['blockvar']} gives both treatments the same share of each {c['blockvar']}, so differences between the {PL} cannot be mistaken for a treatment effect.", None)
    ds = [Opt(f"Use {c['ta']} for all of the {c['unit']} in one {c['blockvar']} and {c['tb']} for all of the {c['unit']} in the other {c['blockvar']}", False, f"Each treatment is used in only one {c['blockvar']}, so the treatment is confounded with the difference between the {PL}.", None),
          Opt(f"Let the {c['unit']} in each {c['blockvar']} be assigned to the treatment that {c['exp']} expects to work better", False, "The assignment is not random, so the choice of the experimenter can be confounded with the response.", None),
          Opt(f"Number all of the {c['unit']} in both {PL} together and randomly assign half of all of them to {c['ta']} and the rest to {c['tb']}, ignoring the {c['blockvar']}", False, f"The assignment is random, but it does not guarantee that each {c['blockvar']} receives both treatments in equal numbers, so it does not control for the difference between the {PL}.", None)]
    stem = f"{c['who'][0].upper() + c['who'][1:]} plans an experiment to compare {c['ta']} with {c['tb']} on the {c['resp']}, using {c['n']} {c['blocks']}. The {c['resp']} is expected to differ between the two {PL} even without any treatment. Which of the following designs is the best way to carry out the experiment?"
    bpr = _bp("st_blocking_design", "1.13", "2.B", "Justify a randomized block design when the response is expected to differ between known groups",
              ["Notice that the response is expected to differ between the blocks, so the treatments must be balanced within each block", "Check that the assignment is random and that every block receives both treatments"],
              [("a randomized block design randomly assigns the treatments within each block so that block differences are not confounded with the treatment", "the stem says the response is expected to differ between the blocks")],
              [("confounded_with_block", "uses a different treatment in each block"), ("experimenter_choice", "lets the experimenter choose the treatments"), ("ignores_blocks", "randomizes without regard to the blocks")],
              "each design is generated from a property table (random assignment, both treatments in every block, block effect separated) and exactly one design has every property",
              NOSTIM, ["procedure_choice", "claim_justification"], "design property table")
    return spack("st_blocking_design", "1.13", "2.B", stem, key, ds, rng, bpr, None, 90, [f"unit={c['unit']}"])


# ======================= S-c. 시뮬레이션 설계 (2.3 / 2.A) =======================
SIM = [
    dict(sc="A basketball player makes each free throw with probability ${p}$, independently of other shots.", ev="a shot is made", unit="shots", ask="the player makes {t} of ${n}$ shots"),
    dict(sc="A seed company states that each of its seeds germinates with probability ${p}$, independently of other seeds.", ev="a seed germinates", unit="seeds", ask="{t} of ${n}$ seeds germinate"),
    dict(sc="An airline finds that each passenger with a ticket shows up for the flight with probability ${p}$, independently of other passengers.", ev="a passenger shows up", unit="passengers", ask="{t} of ${n}$ ticketed passengers show up"),
]


def st_simulation_design(rng):
    c = pick(rng, SIM)
    pp = pick(rng, [3, 4, 6, 7]); n = pick(rng, [4, 5, 6]); k = rng.randint(2, n - 1)
    rule = pick(rng, ["at least", "exactly", "at most"])
    tgt = lambda r: f"{r} ${k}$"
    # 설계 한 가지 = (사건에 배정한 숫자 개수 m, 한 시행의 숫자 개수 L, 세는 규칙). 목표 (10p, n, rule) 와 세 성분이 모두 같을 때만 올바르다.
    target = (pp, n, rule)
    wrong_rule = pick(rng, [r for r in ("at least", "exactly", "at most") if r != rule])
    designs = {
        "key": target,
        "wrong_p": (pp + pick(rng, [-2, 2]), n, rule),
        "wrong_n": (pp, n + pick(rng, [-1, 1, 2]), rule),
        "wrong_rule": (pp, n, wrong_rule),
    }
    assert [d for d, v in designs.items() if v == target] == ["key"] and len(set(designs.values())) == 4 and all(1 <= v[0] <= 9 and v[1] > k for v in designs.values())

    def text(d):
        m, L, r = d
        grp = f"digits $0$ through ${m - 1}$ represent" if m > 1 else "digit $0$ represents"
        rest = f"${m}$ through $9$" if m < 9 else "$9$"
        return f"The {grp} that {c['ev']} and {rest} that it is not; each trial reads ${L}$ random digits and records whether {tgt(r)} of them are in the first group, repeated for many trials"
    key = Opt(text(designs["key"]), True, f"The probability that {c['ev']} is ${pp / 10:g}$, so ${pp}$ of the $10$ equally likely digits represent it; one trial has ${n}$ {c['unit']}, and the event counted is {tgt(rule)}.", None)
    why = {"wrong_p": "The share of digits assigned to the event does not match the stated probability, so the simulation estimates a different probability.",
           "wrong_n": f"A trial uses a different number of digits than the ${n}$ {c['unit']} in the scenario, so the simulated event is not the one asked about.",
           "wrong_rule": f"Counts a different event: the scenario asks for {tgt(rule)}, not {tgt(wrong_rule)}."}
    ds = [Opt(text(designs[k_]), False, why[k_], None) for k_ in ("wrong_p", "wrong_n", "wrong_rule")]
    stem = (c["sc"].format(p=f"{pp / 10:g}") + f" A researcher wants to use a table of random digits, in which each digit from $0$ to $9$ is equally likely, to estimate the probability that " + c["ask"].format(t=tgt(rule), n=n) + ". Which of the following describes a correct simulation?")
    bpr = _bp("st_simulation_design", "2.3", "2.A", "Identify a correct simulation design (digit assignment, trial length and event counted) for a probability question",
              ["Assign digits so that the share of digits for the event equals the given probability", "Make one trial a set of digits equal to the number of individuals and count the event exactly as the question states"],
              [("a simulation must reproduce the probability of one outcome, the number of independent repetitions in a trial and the event that is counted", "the stem gives the probability, the number of individuals in a trial and the event")],
              [("wrong_probability_share", "assigns the wrong share of digits to the event"), ("wrong_trial_length", "uses the wrong number of digits per trial"), ("wrong_event_counted", "counts a different event than the one asked about")],
              "each design is a triple (digits for the event, digits per trial, counting rule) and is accepted as correct only when all three equal the target triple; the three wrong designs each differ in exactly one component",
              NOSTIM, ["procedure_choice", "condition_check"], "triple comparison")
    return spack("st_simulation_design", "2.3", "2.A", stem, key, ds, rng, bpr, None, 95, [f"p={pp}", f"n={n}", f"k={k}", f"rule={rule}"])


# ======================= M-a. 평균 가설 설정 (4.4 / 2.E) =======================
HM = [
    dict(kind="one", claim="A mechanic claims that the mean time to complete a standard tune-up is $45$ minutes.", mu0="45", par="\\mu", what="the mean time, in minutes, for all standard tune-ups",
         sus={"greater": "A customer group suspects that the mean time is longer than the claim.", "less": "A customer group suspects that the mean time is shorter than the claim.", "two": "A customer group suspects that the claim is not correct."}),
    dict(kind="one", claim="A battery company states that the mean life of its batteries is $12$ hours.", mu0="12", par="\\mu", what="the mean life, in hours, of all of the company's batteries",
         sus={"greater": "A reviewer suspects that the mean life is longer than stated.", "less": "A reviewer suspects that the mean life is shorter than stated.", "two": "A reviewer suspects that the stated value is not correct."}),
    dict(kind="paired", inc_pos=True, claim="A trainer wants to know whether a program changes the resting heart rate of members. Each member's heart rate is measured before the program and after the program, and the difference is found as after minus before.", par="\\mu_d", what="the mean difference (after minus before), in beats per minute, for all members",
         sus={"greater": "The trainer suspects that the program increases the mean resting heart rate.", "less": "The trainer suspects that the program decreases the mean resting heart rate.", "two": "The trainer suspects only that the program changes the mean resting heart rate."}),
    dict(kind="paired", inc_pos=False, claim="A teacher wants to know whether a review session changes test scores. Each student's score is recorded on a test before the session and on a similar test after the session, and the difference is found as before minus after.", par="\\mu_d", what="the mean difference (before minus after), in points, for all students",
         sus={"greater": "The teacher suspects that the review session raises the mean score.", "less": "The teacher suspects that the review session lowers the mean score.", "two": "The teacher suspects only that the review session changes the mean score."}),
]


def st_hypotheses_means(rng):
    c = pick(rng, HM)
    tail = pick(rng, ["greater", "less", "two"])  # greater/less = 의심하는 변화가 증가/감소(짝지은 자료) 또는 평균이 더 큼/작음(한 표본)
    par = c["par"]
    NE = "\\ne"
    if c["kind"] == "paired":
        # 방향(독립 경로): 차이의 정의(빼는 순서)가 부등호를 정한다. 값이 커졌다는 의심 = (after - before) > 0 이지만 (before - after) < 0 이다.
        up = tail == "greater"
        ha_sym = NE if tail == "two" else ((">" if up else "<") if c["inc_pos"] else ("<" if up else ">"))
        mu0 = "0"
    else:
        ha_sym = {"less": "<", "greater": ">", "two": NE}[tail]
        mu0 = c["mu0"]
    key_t = f"$H_0: {par} = {mu0}$ and $H_a: {par} {ha_sym} {mu0}$"
    other = [t for t in ("<", ">", NE) if t != ha_sym]
    stat = "\\bar{x}_d" if c["kind"] == "paired" else "\\bar{x}"
    if tail == "two":
        o0, o1 = other[0], other[1]
        dn = lambda o: "lower" if o == "<" else "upper"
        w0 = f"Writes a one-sided alternative in the {dn(o0)} direction, but the suspicion only says the value is different, without a direction."
        w1 = f"Writes a one-sided alternative in the {dn(o1)} direction, but the suspicion only says the value is different, without a direction."
    else:
        o0 = ">" if ha_sym == "<" else "<"
        o1 = NE
        w0 = "Reverses the direction of the alternative hypothesis relative to the suspicion." + (" The direction of a mean difference follows the order of subtraction in its definition." if c["kind"] == "paired" else "")
        w1 = "Writes a two-sided alternative although the suspicion has a direction."
    sel = [(f"$H_0: {par} = {mu0}$ and $H_a: {par} {o0} {mu0}$", w0), (f"$H_0: {par} = {mu0}$ and $H_a: {par} {o1} {mu0}$", w1),
           (f"$H_0: {stat} = {mu0}$ and $H_a: {stat} {ha_sym} {mu0}$", "Writes the hypotheses about a sample mean, but hypotheses are always about the population parameter.")]
    assert len({t for t, _ in sel} | {key_t}) == 4
    key = Opt(key_t, True, f"The parameter is {c['what']}; the null hypothesis states the claimed value and the alternative matches the suspicion{' and the order of subtraction in the definition' if c['kind'] == 'paired' else ''}.", None)
    ds = [Opt(t, False, w, None) for t, w in sel]
    stem = f"{c['claim']} {c['sus'][tail]} Let ${par}$ be {c['what']}. Which of the following pairs of hypotheses should be tested?"
    bpr = _bp("st_hypotheses_means", "4.4", "2.E", "Choose the null and alternative hypotheses about a population mean or mean difference",
              ["Identify the population parameter (a mean or a mean difference) and the claimed value for the null hypothesis", "Use the direction of the suspicion and, for a difference, the order of subtraction to choose the alternative"],
              [("the null hypothesis states equality with the claimed value and the alternative reflects the suspicion in the direction fixed by how the parameter is defined", "the stem defines the parameter and states the suspicion")],
              [("wrong_direction", "uses the alternative in the wrong direction"), ("statistic_not_parameter", "writes hypotheses about a sample mean"), ("two_sided_for_directional", "uses a two-sided alternative for a directional suspicion")],
              "each option is generated from a table of direction, symbol and roles; the direction of a paired alternative is derived from the stated order of subtraction and the suspicion",
              NOSTIM, ["procedure_choice", "interpretation"], "role table enumeration")
    return spack("st_hypotheses_means", "4.4", "2.E", stem, key, ds, rng, bpr, None, 85, [f"kind={c['kind']}", f"tail={tail}", f"ha={ha_sym}"])


# ======================= M-b. 신뢰구간 폭: 표본 크기와 신뢰수준 (4.2 / 2.D) =======================
import functools


@functools.lru_cache(maxsize=None)
def _tstar(conf, df):
    p = 0.5 + conf / 2
    z = float(ss.t.ppf(p, df))
    lo, hi = 0.0, 12.0
    for _ in range(50):  # 독립 경로: t 분포 누적(pdf 수치 적분)에 대한 이분법
        mid = (lo + hi) / 2
        if t_cdf_num(mid, df) < p:
            lo = mid
        else:
            hi = mid
    agree(z, lo, tol=1e-6, name="tstar")
    return z


WD_CTX = [("the mean number of minutes that employees of a company spend commuting each day", "employees"), ("the mean number of hours of sleep that students at a university get each night", "students"), ("the mean weight, in grams, of apples picked at an orchard", "apples")]


def st_ci_width_effect(rng):
    what, units = pick(rng, WD_CTX)
    for _ in forever():
        n1 = pick(rng, [16, 25, 36, 49]); n2 = pick(rng, [16, 25, 36, 49, 64, 100, 144])
        c1 = pick(rng, [0.90, 0.95, 0.99]); c2 = pick(rng, [0.90, 0.95, 0.99])
        if n1 == n2 and c1 == c2:
            continue
        w1 = _tstar(c1, n1 - 1) / math.sqrt(n1)
        w2 = _tstar(c2, n2 - 1) / math.sqrt(n2)
        ratio = w2 / w1
        if (n2 > n1) == (c2 > c1) and (c2 != c1) and (n2 != n1) and (ratio < 0.85 or ratio > 1.18):  # 두 변화의 효과가 반대 방향(표본 크기 증가 + 신뢰수준 증가, 또는 둘 다 감소)
            break
    verdict = "narrower" if ratio < 1 else "wider"
    pos = n2 > n1
    n_ph = "the larger sample size" if pos else "the smaller sample size"
    c_ph = "the higher confidence level" if pos else "the lower confidence level"
    narrow_eff, wide_eff = (n_ph, c_ph) if pos else (c_ph, n_ph)
    P = {
        "narrower": ("The new interval will be narrower than the original interval",
                     f"{narrow_eff[0].upper() + narrow_eff[1:]} has the larger effect: the new margin of error is about ${ratio:.2f}$ times the original margin of error, so the interval is narrower." if verdict == "narrower"
                     else f"Lets {narrow_eff} dominate, but the new margin of error is about ${ratio:.2f}$ times the original margin of error, so {wide_eff} has the larger effect and the interval is wider."),
        "wider": ("The new interval will be wider than the original interval",
                  f"{wide_eff[0].upper() + wide_eff[1:]} has the larger effect: the new margin of error is about ${ratio:.2f}$ times the original margin of error, so the interval is wider." if verdict == "wider"
                  else f"Lets {wide_eff} dominate, but the new margin of error is about ${ratio:.2f}$ times the original margin of error, so {narrow_eff} has the larger effect and the interval is narrower."),
        "same": ("The new interval will have the same width as the original interval", f"Assumes the two effects cancel exactly, but the new margin of error is about ${ratio:.2f}$ times the original margin of error."),
        "cannot": ("The relative width of the new interval cannot be determined without knowing the value of the sample standard deviation", "The sample standard deviation is the same in both intervals, so it cancels from the ratio of the margins of error, and the relative width can be determined."),
    }
    key = Opt(P[verdict][0], True, P[verdict][1], None)
    ds = [Opt(P[k][0], False, P[k][1], None) for k in ("narrower", "wider", "same", "cannot") if k != verdict]
    dn, dc = n2 - n1, c2 - c1
    stem = (f"A $%d\\%%$ confidence interval for {what} is constructed from a random sample of ${n1}$ {units} using a one-sample $t$-interval. A researcher then constructs a $%d\\%%$ confidence interval from a new random sample of ${n2}$ {units}. "
            "Assume that the sample standard deviation is the same for both samples and that the conditions for inference are met. Which of the following statements about the width of the new interval compared with the original interval is correct?") % (int(round(c1 * 100)), int(round(c2 * 100)))
    bpr = _bp("st_ci_width_effect", "4.2", "2.D", "Judge the net effect on the width of a t-interval when the sample size and the confidence level change together in opposite directions",
              ["Recall that a larger sample size reduces the standard error and a higher confidence level increases the critical value", "Compare the two margins of error to decide which effect is larger, using the critical values and the square roots of the sample sizes"],
              [("the margin of error is t-star times s over the square root of n, so the width depends on the critical value and the sample size together", "the stem gives both sample sizes and both confidence levels and says the standard deviations are equal")],
              [("effects_cancel_exactly", "believes the two opposite effects cancel exactly"), ("only_one_effect", "considers only the change in the sample size or only the confidence level"), ("needs_s", "believes the standard deviation is needed although it cancels")],
              "the ratio of the margins of error is computed from t critical values found with scipy and again by bisection on the numerically integrated t cdf, and the ratio must differ from 1 by at least 15 percent",
              NOSTIM, ["procedure_choice", "calculated_value_decision"], "ratio of margins of error")
    return spack("st_ci_width_effect", "4.2", "2.D", stem, key, ds, rng, bpr, None, 100, [f"n={n1},{n2}", f"conf={c1},{c2}", f"ratio={ratio:.3f}"])


# ======================= M-c. 검정력과 오류 확률 (3.8 / 2.D) =======================
PW = [
    dict(test="A quality manager tests $H_0: p = 0.05$ versus $H_a: p > 0.05$, where $p$ is the proportion of defective parts in a shipment, at significance level $\\alpha = 0.05$ using a random sample of $200$ parts."),
    dict(test="A researcher tests $H_0: \\mu = 70$ versus $H_a: \\mu > 70$, where $\\mu$ is the mean score of all students on a reading test, at significance level $\\alpha = 0.05$ using a random sample of $50$ students."),
]


def st_power_effect(rng):
    c = pick(rng, PW)
    # 변화 = (표본 크기 변화, 유의수준 변화). 제2종 오류 확률이 줄면서 제1종 오류 확률이 늘지 않는 변화는 '표본 크기 증가'뿐이다.
    chg = {"n_up": (1, 0), "a_up": (0, 1), "a_down": (0, -1), "n_down": (-1, 0)}
    typeII_down = {k: (v[0] > 0 or v[1] > 0) for k, v in chg.items()}
    typeI_up = {k: v[1] > 0 for k, v in chg.items()}
    good = [k for k in chg if typeII_down[k] and not typeI_up[k]]
    assert good == ["n_up"]
    key = Opt("Increase the sample size while keeping the significance level the same", True, "A larger sample size reduces the variability of the sampling distribution, which increases power and lowers the probability of a Type II error without changing the probability of a Type I error.", None)
    ds = [Opt("Increase the significance level while keeping the sample size the same", False, "This lowers the probability of a Type II error, but it raises the probability of a Type I error, which the researcher wants to avoid.", None),
          Opt("Decrease the significance level while keeping the sample size the same", False, "A smaller significance level makes it harder to reject the null hypothesis, which raises the probability of a Type II error.", None),
          Opt("Decrease the sample size while keeping the significance level the same", False, "A smaller sample size increases the variability of the sampling distribution, which raises the probability of a Type II error.", None)]
    stem = f"{c['test']} The researcher wants to reduce the probability of a Type II error without increasing the probability of a Type I error. Which of the following changes should the researcher make?"
    bpr = _bp("st_power_effect", "3.8", "2.D", "Relate sample size and significance level to the probabilities of Type I and Type II errors",
              ["Recall how the sample size and the significance level each change the probability of a Type I error and of a Type II error", "Choose the one change that lowers the probability of a Type II error and does not raise the probability of a Type I error"],
              [("a larger sample size raises power without changing the probability of a Type I error, while a larger significance level raises power only by raising the probability of a Type I error", "the stem states the goal as two requirements on the error probabilities")],
              [("alpha_increase_trade_off", "raises the significance level and ignores the Type I error"), ("alpha_decrease_lowers_power", "thinks a smaller significance level raises power"), ("sample_size_direction", "thinks a smaller sample size raises power")],
              "each change is encoded as a pair (change in sample size, change in significance level) and the effects on both error probabilities are evaluated from a rule table; exactly one change meets both requirements",
              NOSTIM, ["procedure_choice", "interpretation"], "effect rule table")
    return spack("st_power_effect", "3.8", "2.D", stem, key, ds, rng, bpr, None, 80, ["change=n_up"])


STAGE_SINGLES = ["st_question_type", "st_question_revision", "st_question_scope", "st_sampling_bias", "st_blocking_design", "st_simulation_design", "st_hypotheses_means", "st_ci_width_effect", "st_power_effect",
                 "st_method_choice_means", "st_method_choice_cat", "st_conditions_prop"]
STAGE_SETS = ["st_set_binomial"]
STAGE_FRQ = ["stfrq_q1_design", "stfrq_q2_regression", "stfrq_q4_integrated"]
