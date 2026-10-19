"""AP Biology P0 — FRQ 원형 6유형(CED Exam Information V.1 p.197–203): 긴 문항 2개(각 9점: Q1 결과 해석·평가 A1/B3/C3/D2, Q2 결과 해석·평가+그래프 A1/B4/C2/D2) + 짧은 문항 4개(각 4점, 파트마다 1점: Q3 과학적 탐구, Q4 개념 분석, Q5 모델·시각 표현 분석, Q6 자료 분석).
모든 수치·표·그림 값은 코드가 계산한다. 루브릭은 의미 기반(문구 일치 아님): 행마다 필수 요소(개념 서술)·허용 표현 2개 이상·흔한 오류. 모범 답안은 'ALTON reference answer for self-review — not official AP scoring'.
공식 FRQ 는 종이 손글씨(하이브리드)이므로 문제·키·행·자기 채점 참고 답안을 만든다. 그래프 작성 행(kind=graph)은 종이에서 자기 채점한다."""
from bio_common import *  # noqa: F401,F403
from calc_ab_frq import row, part
from bp import frq_blueprint
from frq_visible import setup_title

REF_NOTE = "ALTON reference answer for self-review — not official AP scoring"
NOTE = "Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase."


def R(rid, crit, elem=None, alts=None, errs=None, kind="claim", requires=None, num=None, tol=None, units=False):
    if num is not None:
        r = row(rid, 1, crit, [str(num)], None, None, errs or ["uses the wrong values from the table or an incorrect formula"], requires, False, True, tol, units)
    else:
        assert elem and len(elem) >= 25 and len(alts or []) >= 2 and errs, (rid, elem)
        r = row(rid, 1, crit, [elem], None, alts, errs, requires, False, False, None, False)
    r["kind"] = kind
    r["meaning_based"] = True
    r["uses_concept"] = False
    r["single_explanation"] = False
    r["grading_note"] = NOTE
    return r


def P(label, prompt, mode, skills, topics, answer, rows):
    pt = part(label, prompt, len(rows), mode, skills, answer, rows)
    pt["topic_codes"] = list(topics)
    return pt


def _finish(arch, template, topic, extra, skill, title, stim, parts, total, minutes, facts, expected, concept, thinking, conds, material, path, judgment, experiment=None):
    assert sum(p["points"] for p in parts) == total, (arch, total)
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim, "parts": parts,
          "total_points": total, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    ex = {"judgment_demand": judgment, "code_first": True}
    if experiment:
        ex["experiment"] = experiment
    pk["blueprint"] = frq_blueprint(arch, SUB, pk, concept, thinking, conds, material, path, extra=ex)
    return pk


def _ev(part_, q, v, tol, unit=""):
    return {"part": part_, "quantity": q, "value": float(v), "unit": unit, "tolerance": tol}


def _table(desc, cols, rows):
    return {"kind": "table", "description": desc, "data": {"columns": cols, "rows": [[str(c) for c in r] for r in rows]}}


def _data(sc, rng):
    """시나리오 평균·SE: 기준 평균 패턴에 작은 잡음을 얹고 SE 는 평균의 3–6 %."""
    means = [round(m * rng.uniform(0.97, 1.03), 1) for m in sc["means"]]
    se = [round(max(0.1, m * rng.uniform(0.03, 0.06)), 2) for m in means]
    return means, se


def _overlap(m, se, i, j):
    return not ((m[i] + 2 * se[i]) < (m[j] - 2 * se[j]) or (m[j] + 2 * se[j]) < (m[i] - 2 * se[i]))


def _trend(m):
    if all(m[i] < m[i + 1] for i in range(len(m) - 1)):
        return "increases"
    if all(m[i] > m[i + 1] for i in range(len(m) - 1)):
        return "decreases"
    return "mixed"


# ============================ Q1 긴 문항: 결과 해석·평가 (9점: A1 / B3 / C3 / D2) ============================
Q1_SCEN = [
    dict(key="inhibitor", topic="3.1", extra=["3.2"], skill="1.B", sys="an enzyme-catalyzed reaction", intro="A researcher hypothesizes that compound X is a competitive inhibitor of an enzyme. The researcher measures the initial rate of the reaction at four concentrations of compound X. Each treatment was repeated n = {n} times.",
         x_name="Concentration of compound X (µM)", levels=["0", "2", "4", "8"], dv="initial reaction rate", unit="µmol of product per minute", means=[40.0, 28.0, 20.0, 12.0], n=6, iv="the concentration of compound X",
         A_prompt="Explain how a competitive inhibitor decreases the rate of an enzyme-catalyzed reaction.", A_ans="A competitive inhibitor resembles the substrate and binds to the active site, so fewer active sites are available for the substrate and the rate falls.",
         A_elem="The inhibitor binds to the active site of the enzyme, which prevents the substrate from binding there", A_alts=["it competes with the substrate for the active site", "the inhibitor occupies the active site so less substrate can bind"], A_errs=["says the inhibitor changes the substrate", "says the inhibitor binds only away from the active site and changes the enzyme's shape"],
         const=["temperature", "pH", "the amount of enzyme", "the substrate concentration", "the reaction time"],
         D_prompt="Predict how the effect of compound X on the rate would change if the experiment were repeated with a much higher concentration of substrate, and justify your prediction.",
         D_pred="The decrease in rate caused by compound X would be smaller (the rate with compound X would be closer to the rate without it).", D_pred_elem="The inhibition would be reduced, so the rate with compound X would be closer to the rate without it", D_pred_alts=["the rate would rise toward the uninhibited rate", "compound X would have less effect"], D_pred_errs=["predicts that the inhibitor would stop working completely", "predicts that the rate would decrease further"],
         D_just="More substrate molecules compete with the inhibitor for the active sites, so more active sites are occupied by substrate.", D_just_elem="At high substrate concentration the substrate outcompetes the inhibitor for the active sites", D_just_alts=["more substrate molecules occupy the active sites than inhibitor molecules do", "the competition for the active site favors the substrate"], D_just_errs=["says the substrate changes the shape of the inhibitor", "gives a reason based on a change in temperature"],
         trend_word="decreases", ind="concentration of compound X", dep="initial reaction rate"),
    dict(key="growthfactor", topic="4.2", extra=["4.5"], skill="1.B", sys="cultured cells", intro="A researcher investigates how a growth factor affects cell division in cultured cells. Cells were grown with four concentrations of the growth factor, and the percent of cells in mitosis was determined after 24 hours. Each treatment was repeated n = {n} times.",
         x_name="Growth factor concentration (ng/mL)", levels=["0", "5", "10", "20"], dv="percent of cells in mitosis", unit="percent of cells", means=[4.0, 9.0, 14.0, 17.5], n=8, iv="the concentration of the growth factor",
         A_prompt="Describe how binding of a growth factor to a receptor on a cell can lead to cell division.", A_ans="The growth factor binds to a receptor, which starts a signal transduction pathway of relay proteins that results in a cellular response such as activating genes needed for division.",
         A_elem="Binding of the growth factor to the receptor starts a signal transduction pathway that results in a cell response", A_alts=["the receptor relays the signal through a series of proteins to turn on division", "the signal received at the receptor is transduced into activation of genes for division"], A_errs=["says the growth factor enters the nucleus and directly copies DNA", "describes only the binding without any resulting pathway or response"],
         const=["temperature", "the number of cells plated", "the incubation time", "the type of growth medium"],
         D_prompt="Predict how the percent of cells in mitosis at 20 ng/mL would change if a drug that blocks the growth factor receptor were added, and justify your prediction.",
         D_pred="The percent of cells in mitosis would be lower than without the drug.", D_pred_elem="The percent of cells in mitosis would decrease compared with the treatment without the drug", D_pred_alts=["fewer cells would be dividing", "the mitotic percentage would fall toward the level without growth factor"], D_pred_errs=["predicts that the percent would increase", "predicts that all cells would stop dividing permanently"],
         D_just="The growth factor could not bind its receptor, so the signal transduction pathway for division would not be activated.", D_just_elem="Without receptor binding the signal transduction pathway that leads to cell division is not activated", D_just_alts=["the growth factor cannot bind so no signal reaches the cell", "blocking the receptor stops the signal from being transduced into a response"], D_just_errs=["says the drug destroys the growth factor outside the cell without mentioning the receptor", "says the cells lose their DNA"],
         trend_word="increases", ind="concentration of the growth factor", dep="percent of cells in mitosis"),
    dict(key="salinity", topic="2.7", extra=["8.1"], skill="1.B", sys="seeds", intro="A student investigates how the salt concentration of the water affects the germination of seeds. Seeds were placed in solutions of sodium chloride (NaCl), and the percent of seeds that germinated after 7 days was recorded. Each treatment was repeated n = {n} times.",
         x_name="NaCl concentration (mM)", levels=["0", "50", "100", "200"], dv="percent of seeds that germinated", unit="percent of seeds", means=[96.0, 90.0, 62.0, 20.0], n=10, iv="the concentration of NaCl in the solution",
         A_prompt="Describe how water moves into a seed from the surrounding water, using the term water potential.", A_ans="Water moves by osmosis from the region of higher water potential (the surrounding water) to the region of lower water potential (inside the seed).",
         A_elem="Water moves from a region of higher water potential to a region of lower water potential across the seed coat", A_alts=["osmosis carries water into the seed because the seed has the lower water potential", "water flows down its water potential gradient into the seed"], A_errs=["says water moves toward the higher water potential", "says solutes rather than water move into the seed"],
         const=["temperature", "the number of seeds per dish", "the volume of solution", "the amount of light"],
         D_prompt="Predict the percent of seeds that would germinate in a NaCl solution of 300 millimolar, compared with the solution of 200 millimolar, and justify your prediction.",
         D_pred="Fewer seeds would germinate in 300 mM NaCl than in 200 mM NaCl.", D_pred_elem="The percent germination would be lower in 300 mM NaCl than in 200 mM NaCl", D_pred_alts=["germination would be even lower", "fewer than 20 percent of the seeds would germinate"], D_pred_errs=["predicts that more seeds would germinate", "predicts no change in germination"],
         D_just="A higher NaCl concentration lowers the water potential of the solution, so less water enters the seeds.", D_just_elem="The more concentrated solution has a lower water potential, so less water moves into the seeds", D_just_alts=["water potential outside falls as salt rises, which reduces water uptake", "less osmosis into the seed occurs in the stronger salt solution"], D_just_errs=["says salt is a nutrient that is used by the seeds", "says salt raises the water potential of the solution"],
         trend_word="decreases", ind="concentration of NaCl", dep="percent of seeds that germinated"),
    dict(key="resistance", topic="7.8", extra=["7.2"], skill="1.B", sys="bacteria", intro="A researcher grows a culture of bacteria with an antibiotic that does not kill all of the cells. After different numbers of days of exposure to the antibiotic, the percent of bacterial cells that are resistant to the antibiotic was determined. Each measurement used n = {n} samples.",
         x_name="Days of exposure to the antibiotic", levels=["0", "1", "2", "4"], dv="percent of bacterial cells that are resistant", unit="percent of cells", means=[1.0, 6.0, 24.0, 71.0], n=6, iv="the number of days of exposure to the antibiotic",
         A_prompt="Describe how natural selection could increase the proportion of resistant bacteria in a population exposed to an antibiotic.", A_ans="Resistant bacteria carry heritable variation that lets them survive and reproduce in the presence of the antibiotic, so they pass the resistance allele on and become a larger proportion of the population.",
         A_elem="Resistant bacteria survive and reproduce more in the presence of the antibiotic and pass the resistance trait to offspring", A_alts=["the antibiotic selects for the resistant cells, which leave more descendants", "heritable resistance gives resistant cells higher survival and reproduction"], A_errs=["says the antibiotic causes each bacterium to become resistant", "says the bacteria develop resistance because they need it"],
         const=["temperature", "the type of growth medium", "the concentration of antibiotic", "the starting number of cells"],
         D_prompt="Predict the percent of resistant cells after 8 days of continued exposure to the antibiotic, and justify your prediction.",
         D_pred="The percent of resistant cells would be higher than at 4 days and would approach 100 percent.", D_pred_elem="The percent of resistant cells would be higher than at 4 days, approaching nearly all of the cells", D_pred_alts=["the population would be mostly resistant", "the percentage would continue to increase"], D_pred_errs=["predicts that the percent would decrease", "predicts that the percent would stay at 71 percent"],
         D_just="Continued exposure keeps selecting for resistant cells, which keep surviving and reproducing, while nonresistant cells die.", D_just_elem="Continued exposure keeps favoring the survival and reproduction of resistant cells over nonresistant cells", D_just_alts=["selection continues each generation so resistant cells become even more common", "nonresistant cells continue to be killed while resistant cells reproduce"], D_just_errs=["says the bacteria keep mutating on purpose to resist", "says the antibiotic will stop working on its own"],
         trend_word="increases", ind="number of days of exposure to the antibiotic", dep="percent of bacterial cells that are resistant"),
]


def _q1(rng, sc):
    means, se = _data(sc, rng)
    n = sc["n"]
    if _trend(means) != ("increases" if sc["trend_word"] == "increases" else "decreases"):
        raise ValueError("trend")
    L = sc["levels"]
    first, last = means[0], means[-1]
    pct = (last - first) / first * 100
    agree(pct, 100 * (last / first - 1), 1e-9, "pct")
    ci, cj = 1, 2
    ov = _overlap(means, se, ci, cj)
    stat_ans = ("The ranges overlap, so the difference between the two treatments is not statistically supported." if ov else "The ranges do not overlap, so the difference between the two treatments is statistically supported.")
    stim = _table(f"Mean {sc['dv']} ({sc['unit']}) ± 2SE for {sc['sys']} at four levels of the independent variable; n = {n} for each level", [sc["x_name"], f"Mean {sc['dv']} ({sc['unit']}) ± 2SE"], [[L[i], f"{means[i]:.1f} ± {2 * se[i]:.2f}"] for i in range(4)])
    rng_i = f"{means[ci] - 2 * se[ci]:.2f} to {means[ci] + 2 * se[ci]:.2f}"; rng_j = f"{means[cj] - 2 * se[cj]:.2f} to {means[cj] + 2 * se[cj]:.2f}"
    parts = [
        P("A", sc["A_prompt"], "explain", ["1.B"], [sc["topic"]], sc["A_ans"], [R("A1", "Gives a correct explanation or description of the biological concept", sc["A_elem"], sc["A_alts"], sc["A_errs"], "claim")]),
        P("B", f"(i) Identify the independent variable and the dependent variable in the investigation. (ii) Identify one factor that should be kept constant so the results are due to the independent variable. (iii) Describe the pattern in the data in the table.", "explain", ["3.C", "4.B"], [sc["topic"]],
          f"(i) Independent variable: {sc['ind']}; dependent variable: {sc['dep']}. (ii) For example {sc['const'][0]}. (iii) The mean {sc['dv']} {sc['trend_word']} as the independent variable increases, from {means[0]:.1f} to {means[-1]:.1f}.",
          [R("B1", "Identifies both the independent variable and the dependent variable", f"The independent variable is {sc['ind']} and the dependent variable is {sc['dep']}", [f"manipulated variable: {sc['ind']}; measured response: {sc['dep']}", f"changes {sc['ind']} and measures {sc['dep']}"], ["names the dependent variable as the independent variable", "names only one of the two variables"], "claim"),
           R("B2", "Identifies a valid factor that is kept constant", "Names a factor other than the independent variable that is held the same in all treatments", sc["const"][:3], ["names the independent variable as the constant", "names a factor that was changed between treatments"], "design"),
           R("B3", "Describes the pattern in the data, using values from the table", f"States that the mean {sc['dv']} {sc['trend_word']} as the independent variable increases, citing values", [f"the {sc['dv']} goes {'up' if sc['trend_word'] == 'increases' else 'down'} from {means[0]:.1f} to {means[-1]:.1f}", f"the values {sc['trend_word'][:-1]} across the levels, citing the first and last means"], ["describes the opposite trend", "describes the pattern without any values from the table"], "claim")]),
        P("C", f"(i) Calculate the percent change in the mean {sc['dv']} from the lowest level to the highest level of the independent variable. Show your work. (ii) Using the ±2SE values, determine whether the difference between the mean at {L[ci]} and the mean at {L[cj]} is statistically supported, and justify your answer.", "calculate", ["5.A", "5.B"], [sc["topic"]],
          f"(i) percent change = ({last:.1f} - {first:.1f}) / {first:.1f} x 100 = {pct:.1f}%. (ii) {L[ci]}: {rng_i}; {L[cj]}: {rng_j}. {stat_ans}",
          [R("C1", "Sets up the percent change with the correct formula and values (expression)", f"Uses (final - initial) / initial x 100 with the values {last:.1f} and {first:.1f}", [f"(({last:.1f} - {first:.1f}) / {first:.1f}) x 100", "percent change = difference divided by the starting value times 100"], ["divides by the final value instead of the initial value", "forgets to multiply by 100"], "expression"),
           R("C2", "Gives the correct percent change (answer)", None, None, None, "numeric", requires="C1", num=f"{pct:.1f}", tol=f"±{max(0.2, abs(pct) * 0.01):.1f}"),
           R("C3", "States whether the difference is supported and justifies it by comparing the ±2SE ranges", ("The ±2SE ranges overlap, so the difference is not supported" if ov else "The ±2SE ranges do not overlap, so the difference is supported"), ["compares the mean ± 2SE intervals of the two treatments and states the conclusion", "overlapping error ranges mean the difference may be due to chance" if ov else "separated error ranges mean the difference is unlikely to be due to chance"], ["compares only the means", "states the wrong conclusion for the ranges"], "justification")]),
        P("D", sc["D_prompt"], "explain", ["6.E", "6.C"], [sc["topic"]], f"{sc['D_pred']} {sc['D_just']}",
          [R("D1", "Makes a reasonable prediction", sc["D_pred_elem"], sc["D_pred_alts"], sc["D_pred_errs"], "claim"), R("D2", "Justifies the prediction with biological reasoning", sc["D_just_elem"], sc["D_just_alts"], sc["D_just_errs"], "justification", requires="D1")]),
    ]
    arch = f"bif_q1_{sc['key']}"
    return _finish(arch, "bio_q1_results", sc["topic"], sc["extra"], "1.B", f"Interpreting and evaluating results: {sc['sys']}", stim, parts, 9, 22,
                   [f"means={means}", f"se={se}", f"pct={pct:.4f}", f"overlap={ov}"], [_ev("C", "percent change", pct, max(0.2, abs(pct) * 0.01), "%")],
                   f"Interpret and evaluate experimental results in a data table: {sc['intro'][:60]}", ["Explain the underlying concept", "Identify variables, a control factor, and the data pattern", "Calculate a percent change and compare ±2SE ranges", "Predict and justify a change to the experiment"],
                   [("Means with ±2SE for the same number of replicates at each level", "the table gives mean ± 2SE and n")], {"type": "experiment_table", "must_include": ["levels of the variable", "mean ± 2SE", "n"]},
                   "percent change and ±2SE overlap recomputed from the displayed table values", "explain a concept, describe data, calculate, test with ±2SE, and predict with justification",
                   experiment={"fictional": True, "design": "experimental", "independent_variables": [sc["ind"]], "dependent_variable": sc["dep"], "controls": [], "control_not_applicable": "levels of one variable are compared with the lowest level, and all other conditions are held constant", "replicates_per_group": n,
                               "measurement": {"variable": sc["dv"], "unit": sc["unit"]}, "claims": [{"text": f"the mean {sc['dv']} {sc['trend_word']} with the independent variable", "scope": "causation"}], "ced_topics_used": [sc["topic"]]})


def _mk_q1(sc):
    def f(rng):
        p = _q1(rng, sc)
        p["stimulus"]["description"] = sc["intro"].format(n=sc["n"]) + " " + p["stimulus"]["description"]
        p["title"] = setup_title(sc["intro"].format(n=sc["n"]))  # 실험 소개는 표 스펙에 실리지 않는 description 에만 있었다 — 학생이 보는 제목에 완전한 문장으로 둔다
        return p
    f.__name__ = f"bif_q1_{sc['key']}"
    f.__module__ = __name__
    return f


for _s in Q1_SCEN:
    globals()[f"bif_q1_{_s['key']}"] = _mk_q1(_s)

# ============================ Q2 긴 문항: 결과 해석·평가 + 그래프 작성 (9점: A1 / B4 / C2 / D2) ============================
Q2_SCEN = [
    dict(key="potato", topic="2.7", extra=["2.4"], intro="A student places potato cores of equal initial mass in sucrose solutions of different molarity for 24 hours and measures the percent change in mass of the cores.",
         x=["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"], xl="Sucrose molarity (M)", yl="Percent change in mass", yunit="%", gen=lambda r: (lambda iso, s: [round(s * (m - iso), 1) for m in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)])(r.choice([0.25, 0.35, 0.45]), r.choice([-24, -28, -32])), plot_type="line",
         A_prompt="Describe what is meant by water potential, and state the direction in which water moves between regions of different water potential.", A_ans="Water potential is a measure of the potential energy of water per unit volume that depends on solute concentration and pressure; water moves from higher to lower water potential.",
         A_elem="Water moves from a region of higher water potential to a region of lower water potential", A_alts=["water flows down the water potential gradient", "osmosis moves water toward the lower water potential"], A_errs=["says water moves toward higher water potential", "says only solutes move"],
         C_prompt="(i) Using your plotted data, estimate the molarity of sucrose at which there would be no net movement of water into or out of the potato cores. (ii) State a null hypothesis for the investigation.",
         D_prompt="The investigation is repeated with sodium chloride (NaCl), which ionizes into two ions, instead of sucrose, using the same molarities. Predict how the percent change in mass at 0.4 M would differ from that in 0.4 M sucrose, and justify your prediction.",
         D_pred="The cores would lose more mass (or gain less) in 0.4 M NaCl than in 0.4 M sucrose.", D_pred_elem="The cores in NaCl would show a lower (more negative) percent change in mass than the cores in sucrose at the same molarity", D_pred_alts=["more water would leave the cores in NaCl", "the mass would decrease more in NaCl"], D_pred_errs=["predicts an identical change because the molarity is the same", "predicts a gain in mass larger than in sucrose"],
         D_just="NaCl ionizes into two ions, so the solute concentration is greater, which makes the solute potential (Ψ_S = -iCRT with i = 2) lower (more negative) and the water potential of the solution lower.", D_just_elem="NaCl ionizes into two particles, so the solution has more solute particles and a lower water potential than sucrose", D_just_alts=["the ionization constant i is 2 for NaCl so the solute potential is more negative", "more dissolved particles lower the water potential, so more water leaves the cores"], D_just_errs=["says NaCl is not a solute", "says the molarity is the only factor that matters"]),
    dict(key="enzymetemp", topic="3.2", extra=["3.1"], intro="A student measures the rate at which an enzyme converts its substrate to product at six temperatures. Each value is the mean of repeated trials.",
         x=["10", "20", "30", "40", "50", "60"], xl="Temperature (°C)", yl="Rate of reaction (µmol of product per minute)", yunit="", gen=lambda r: (lambda opt: [round(100 * math.exp(-((t - opt) / 14.0) ** 2), 0) for t in (10, 20, 30, 40, 50, 60)])(r.choice([28, 30, 32])), plot_type="line",
         A_prompt="Describe how the structure of an enzyme allows it to catalyze a reaction of a specific substrate.", A_ans="The active site of the enzyme has a shape and chemistry complementary to the substrate, so only that substrate binds and the reaction is catalyzed by lowering the activation energy.",
         A_elem="The active site has a shape and chemical properties that fit the substrate, so the enzyme binds a specific substrate", A_alts=["only substrates that fit the active site can bind", "the enzyme's three-dimensional shape determines which substrate it can bind"], A_errs=["says the enzyme is used up in the reaction", "says the enzyme supplies energy to the reaction"],
         C_prompt="(i) Calculate the percent increase in the rate of the reaction from 10 degrees Celsius to 20 degrees Celsius. Show your work. (ii) State a null hypothesis for the investigation.",
         D_prompt="Predict the rate of the reaction at 70 degrees Celsius, compared with the rate at 60 degrees Celsius, and justify your prediction.",
         D_pred="The rate at 70 °C would be lower than (or equal to near zero compared with) the rate at 60 °C.", D_pred_elem="The rate of the reaction at 70 °C would be lower than the rate at 60 °C", D_pred_alts=["activity would be close to zero", "the rate would continue to fall"], D_pred_errs=["predicts that the rate would increase", "predicts no change in rate"],
         D_just="High temperature breaks the weak bonds that hold the enzyme's shape (denaturation), so the active site changes and substrate binds less well.", D_just_elem="High temperature denatures the enzyme so the active site no longer binds the substrate well", D_just_alts=["the enzyme loses its shape at high temperature", "heat disrupts the bonds maintaining the active site"], D_just_errs=["says high temperature removes the substrate", "says high temperature increases the activation energy of the reaction"]),
    dict(key="popgrowth", topic="8.3", extra=["8.4"], intro="A researcher introduces a small number of mice to an island and counts the number of mice every two weeks.",
         x=["0", "2", "4", "6", "8", "10", "12"], xl="Time (weeks)", yl="Number of mice", yunit="", gen=lambda r: (lambda K, rr, N0: [round(K / (1 + (K - N0) / N0 * math.exp(-rr * t))) for t in (0, 2, 4, 6, 8, 10, 12)])(r.choice([400, 600, 800]), r.choice([0.55, 0.65, 0.75]), r.choice([10, 20])), plot_type="line",
         A_prompt="Describe what is meant by the carrying capacity of an environment.", A_ans="The carrying capacity is the maximum population size that the environment can sustain given the available resources.",
         A_elem="The carrying capacity is the maximum population size that the environment can sustain with its available resources", A_alts=["the largest number of individuals the habitat can support over time", "the population size at which resources limit further growth"], A_errs=["defines it as the number of births in a year", "defines it as the largest population that has ever occurred"],
         C_prompt="(i) Calculate the average rate of population growth from week 4 to week 8. Show your work. (ii) Estimate the carrying capacity of the island for the mice from your plotted data.",
         D_prompt="A drought reduces the plant food available on the island. Predict how the carrying capacity for the mice would change, and justify your prediction.",
         D_pred="The carrying capacity would decrease.", D_pred_elem="The carrying capacity of the island for the mice would decrease", D_pred_alts=["the environment would support fewer mice", "the plateau of the population would be lower"], D_pred_errs=["predicts that the carrying capacity would increase", "predicts that it would not change because population size is the same"],
         D_just="Carrying capacity is set by the available resources, and less food can support fewer individuals.", D_just_elem="Carrying capacity depends on resources, and with less food the environment can support fewer mice", D_just_alts=["fewer resources limit the population at a smaller size", "limited food increases competition so the maximum population falls"], D_just_errs=["says the mice would reproduce faster to make up for the loss", "says carrying capacity is not affected by food"]),
    dict(key="photosyn", topic="3.4", extra=["3.3"], intro="A student measures the rate of oxygen production by an aquatic plant at several light intensities. Each value is the mean of repeated trials.",
         x=["0", "50", "100", "200", "400", "800"], xl="Light intensity (arbitrary units)", yl="Rate of oxygen production (µL per minute)", yunit="", gen=lambda r: (lambda P: [round(min(P, 0.6 * l), 1) for l in (0, 50, 100, 200, 400, 800)])(r.choice([70.0, 80.0, 90.0])), plot_type="line",
         A_prompt="Describe the role of the light reactions in photosynthesis, including one product that is used by the Calvin cycle.", A_ans="The light reactions capture light energy and use it to make ATP and NADPH, which the Calvin cycle uses to fix carbon dioxide into sugar.",
         A_elem="The light reactions use light energy to make ATP and NADPH that the Calvin cycle uses to fix carbon dioxide", A_alts=["light energy is converted to the chemical energy in ATP and NADPH", "the light reactions provide ATP and NADPH for sugar synthesis"], A_errs=["says the light reactions produce glucose directly", "says the Calvin cycle produces the oxygen gas"],
         C_prompt="(i) Calculate the average rate of increase in oxygen production per unit of light intensity between 0 and 50 units. Show your work. (ii) Identify a factor other than light intensity that most likely limits the rate at the highest light intensities.",
         D_prompt="Predict how the rate of oxygen production at the highest light intensity would change if the carbon dioxide concentration available to the plant were doubled, and justify your prediction.",
         D_pred="The rate of oxygen production would increase.", D_pred_elem="The rate of oxygen production at the highest light intensity would increase", D_pred_alts=["the plateau would be higher", "more oxygen would be produced"], D_pred_errs=["predicts that the rate would decrease", "predicts no change because light is the only limit"],
         D_just="At high light intensity the rate is limited by carbon dioxide in the Calvin cycle, so more carbon dioxide allows more carbon fixation and more use of the products of the light reactions.", D_just_elem="Carbon dioxide limits carbon fixation in the Calvin cycle at high light, so more carbon dioxide raises the rate", D_just_alts=["more carbon dioxide allows more sugar synthesis and keeps the light reactions running", "the plateau is caused by a limit other than light that extra carbon dioxide would relieve"], D_just_errs=["says carbon dioxide is the source of the oxygen released", "says extra carbon dioxide would make the light reactions faster directly"]),
]


def _q2(rng, sc):
    ys = [float(v) for v in sc["gen"](rng)]
    xs = [float(v) for v in sc["x"]]
    key = sc["key"]
    stim = _table(sc["intro"] + f" The table shows the data.", [sc["xl"], sc["yl"]], [[x, f"{y:g}"] for x, y in zip(sc["x"], ys)])
    ev = []
    facts = [f"ys={ys}"]
    if key == "potato":
        i0 = next(i for i in range(5) if ys[i] > 0 >= ys[i + 1])
        est = xs[i0] + (0 - ys[i0]) * (xs[i0 + 1] - xs[i0]) / (ys[i0 + 1] - ys[i0])
        co = np.polyfit(xs, ys, 1)
        agree(est, -co[1] / co[0], 0.06, "iso")
        est_r = round(est, 2)
        c_ans = f"(i) The graph crosses 0% change at about {est_r:.2f} M (between {xs[i0]:.1f} and {xs[i0 + 1]:.1f} M). (ii) There is no difference in the percent change in mass of the cores among the sucrose molarities."
        c_rows = [R("C1", "Estimates the molarity at which the percent change is zero (value)", None, None, None, "numeric", num=f"{est_r:.2f}", tol="±0.05 M (read from the plotted line)", units=True),
                  R("C2", "States a null hypothesis of no effect or no difference", "States that the molarity of sucrose has no effect on the percent change in mass of the cores", ["there is no difference in mass change among the molarities", "sucrose concentration does not affect the mass of the potato cores"], ["states a prediction that the mass will change", "states that the cores will not change in mass without any link to the molarity"], "claim")]
        ev = [_ev("C", "molarity with no net change", est_r, 0.05, "M")]
    elif key == "enzymetemp":
        pct = (ys[1] - ys[0]) / ys[0] * 100
        if ys[0] <= 0:
            raise ValueError("zero")
        c_ans = f"(i) percent increase = ({ys[1]:g} - {ys[0]:g}) / {ys[0]:g} x 100 = {pct:.0f}%. (ii) There is no difference in the rate of the reaction at the different temperatures."
        c_rows = [R("C1", "Gives the correct percent increase in rate with the formula applied (answer)", None, None, None, "numeric", num=f"{pct:.0f}", tol=f"±{max(1, abs(pct) * 0.01):.0f}"),
                  R("C2", "States a null hypothesis of no effect of temperature", "States that temperature has no effect on the rate of the enzyme-catalyzed reaction", ["there is no difference in rate among the temperatures", "the rate does not depend on the temperature"], ["states that the rate will increase with temperature", "states a prediction about the optimum temperature"], "claim")]
        ev = [_ev("C", "percent increase", pct, max(1, abs(pct) * 0.01), "%")]
    elif key == "popgrowth":
        a, b = xs.index(4.0), xs.index(8.0)
        rate = (ys[b] - ys[a]) / (xs[b] - xs[a])
        K_est = float(np.mean(ys[-2:]))
        if abs(ys[-1] - ys[-2]) > 0.05 * ys[-1] or rate <= 0:
            raise ValueError("shape")
        c_ans = f"(i) rate = ({ys[b]:g} - {ys[a]:g}) / (8 - 4) = {rate:.1f} mice per week. (ii) The population levels off at about {ys[-1]:g} mice, which estimates the carrying capacity."
        c_rows = [R("C1", "Gives the correct average growth rate with units (answer)", None, None, None, "numeric", num=f"{rate:.1f}", tol=f"±{max(0.2, abs(rate) * 0.01):.1f}", units=True),
                  R("C2", "Estimates the carrying capacity from the plateau of the graph (value)", None, None, None, "numeric", num=f"{ys[-1]:g}", tol=f"±{max(10, 0.05 * ys[-1]):.0f}")]
        ev = [_ev("C", "average growth rate", rate, max(0.2, abs(rate) * 0.01), "mice per week"), _ev("C", "carrying capacity", ys[-1], max(10, 0.05 * ys[-1]), "mice")]
    elif sc.get("calc") in ("rate_plateau", "rate_threshold"):
        # 2026-10-15 주제 분산 시나리오(bio_p0_l.py): 두 x 값 사이 평균 변화율 + (포화값 또는 기준값을 넘는 x 의 선형 보간) — 값은 표에서 코드가 다시 계산한다.
        a, b = xs.index(float(sc["ia"])), xs.index(float(sc["ib"]))
        rate = (ys[b] - ys[a]) / (xs[b] - xs[a])
        if rate <= 0 or any(ys[i + 1] < ys[i] for i in range(len(ys) - 1)):
            raise ValueError("shape")
        agree(rate, float((np.interp(xs[b], xs, ys) - np.interp(xs[a], xs, ys)) / (xs[b] - xs[a])), 1e-9, "rate")
        ru = sc["rate_unit"]
        if sc["calc"] == "rate_plateau":
            if abs(ys[-1] - ys[-2]) > 0.05 * ys[-1]:
                raise ValueError("shape")
            est, est_tol = ys[-1], max(sc.get("plateau_tol_min", 2), 0.05 * ys[-1])
            c2_crit = f"Estimates the maximum {sc['yl'].lower()} from the plateau of the graph (value)"
            c_ans = f"(i) rate = ({ys[b]:g} - {ys[a]:g}) / ({xs[b]:g} - {xs[a]:g}) = {rate:.2f} {ru}. (ii) The graph levels off at about {est:g} {sc['yunit']}, which estimates the maximum."
            ev = [_ev("C", "average rate of increase", rate, max(0.02, abs(rate) * 0.01), ru), _ev("C", "plateau value", est, est_tol, sc["yunit"])]
        else:
            thr = float(sc["threshold"])
            j = next(i for i in range(len(ys) - 1) if ys[i] < thr <= ys[i + 1])
            est = xs[j] + (thr - ys[j]) * (xs[j + 1] - xs[j]) / (ys[j + 1] - ys[j])
            agree(est, float(np.interp(thr, ys, xs)), 1e-6, "crossing")
            est = round(est, 1); est_tol = sc["threshold_tol"]
            c2_crit = f"Estimates from the graph the {sc['xl'].split(' (')[0].lower()} at which the value first exceeds {thr:g} (value)"
            c_ans = f"(i) rate = ({ys[b]:g} - {ys[a]:g}) / ({xs[b]:g} - {xs[a]:g}) = {rate:.2f} {ru}. (ii) The plotted line crosses {thr:g} at about {est:.1f} (between {xs[j]:g} and {xs[j + 1]:g})."
            ev = [_ev("C", "average rate of increase", rate, max(0.02, abs(rate) * 0.01), ru), _ev("C", "crossing point", est, est_tol, "")]
        c_rows = [R("C1", "Gives the correct average rate of increase with units (answer)", None, None, None, "numeric", num=f"{rate:.2f}", tol=f"±{max(0.02, abs(rate) * 0.01):.2f}", units=True),
                  R("C2", c2_crit, None, None, None, "numeric", num=f"{est:g}", tol=f"±{est_tol:g}")]
    else:
        slope = (ys[1] - ys[0]) / (xs[1] - xs[0])
        if ys[-1] != ys[-2] or slope <= 0:
            raise ValueError("shape")
        c_ans = f"(i) rate = ({ys[1]:g} - {ys[0]:g}) / (50 - 0) = {slope:.2f} µL per minute per unit of light. (ii) Carbon dioxide concentration (or the amount of enzymes of the Calvin cycle) limits the rate at high light."
        c_rows = [R("C1", "Gives the correct average rate of increase (answer)", None, None, None, "numeric", num=f"{slope:.2f}", tol="±0.02", units=True),
                  R("C2", "Identifies a valid limiting factor other than light", "Names a limiting factor such as carbon dioxide concentration, temperature, or the amount of enzyme in the Calvin cycle", ["carbon dioxide is limiting at high light", "temperature or enzyme amount limits the rate when light is high"], ["names light intensity as the limiting factor at the plateau", "names a factor that was not part of the data and has no link to the rate"], "claim")]
        ev = [_ev("C", "average rate of increase", slope, 0.02, "µL per minute per light unit")]
    xlab, ylab = sc["xl"], sc["yl"]
    graph_rows = [
        R("B1", "Labels both axes with the variable and the units, with the independent variable on the horizontal axis", f"Horizontal axis labeled {xlab} and vertical axis labeled {ylab}", ["the axis labels name the variable and give the units from the table", "independent variable on x with its unit and dependent variable on y with its unit"], ["omits the units from the axis labels", "puts the dependent variable on the horizontal axis"], "graph"),
        R("B2", "Uses an appropriate, evenly spaced scale for each axis", "Uses a uniform scale on each axis that makes the plotted data fill most of the graph area", ["equal intervals of values for equal spaces on each axis", "scale chosen so the data cover most of the grid"], ["uses a scale that is not evenly spaced", "uses a scale in which the data occupy only a small corner of the graph"], "graph"),
        R("B3", "Plots all of the data points correctly", "Plots every data point from the table at the correct position", ["each point is placed at the correct x and y value", "all of the plotted values agree with the table within one grid unit"], ["plots some points at the wrong value", "omits one or more data points"], "graph"),
        R("B4", "Draws an appropriate type of graph, with the points connected", "Connects the plotted points with a line, because the independent variable is continuous", ["a line graph with the points joined is drawn", "connects the points in order with a line or smooth curve"], ["draws a bar graph for a continuous independent variable", "draws unconnected points with no line"], "graph"),
    ]
    parts = [
        P("A", sc["A_prompt"], "explain", ["1.A"], [sc["topic"]], sc["A_ans"], [R("A1", "Gives a correct description of the biological concept", sc["A_elem"], sc["A_alts"], sc["A_errs"], "claim")]),
        P("B", f"Construct an appropriately labeled graph of the data in the table. Use the space provided to draw your graph.", "draw", ["4.A"], [sc["topic"]], f"A line graph with {xlab} on the horizontal axis and {ylab} on the vertical axis, with all {len(xs)} points plotted and connected.", graph_rows),
        P("C", sc["C_prompt"], "calculate", ["5.A", "3.B"] if key in ("potato", "enzymetemp") else ["5.A", "4.B"], [sc["topic"]], c_ans, c_rows),
        P("D", sc["D_prompt"], "explain", ["6.E", "6.C"], [sc["topic"]], f"{sc['D_pred']} {sc['D_just']}",
          [R("D1", "Makes a reasonable prediction", sc["D_pred_elem"], sc["D_pred_alts"], sc["D_pred_errs"], "claim"), R("D2", "Justifies the prediction with biological reasoning", sc["D_just_elem"], sc["D_just_alts"], sc["D_just_errs"], "justification", requires="D1")]),
    ]
    arch = f"bif_q2_{key}"
    return _finish(arch, "bio_q2_graphing", sc["topic"], sc["extra"], "4.A", setup_title(sc["intro"]), stim, parts, 9, 24, facts, ev, "Construct a graph from a table, analyze it, and predict with justification",
                   ["Explain a concept from the scenario", "Construct a labeled, scaled, plotted graph", "Use the data to calculate or estimate", "Predict and justify a change"], [("Data pairs for six or seven values of the independent variable", "the table gives all of the data to be plotted")], {"type": "experiment_table", "must_include": ["independent variable values", "dependent variable values"]},
                   "values read back from the generating data (percent change, interpolation, slope, plateau)", "construct, read, and extend a graph")


def _mk_q2(sc):
    def f(rng):
        return _q2(rng, sc)
    f.__name__ = f"bif_q2_{sc['key']}"
    f.__module__ = __name__
    return f


for _s in Q2_SCEN:
    globals()[f"bif_q2_{_s['key']}"] = _mk_q2(_s)

# ============================ Q3 짧은 문항: 과학적 탐구 (4점: 개념 서술 / 실험 절차 / 귀무가설·예측 / 예측 정당화) ============================
Q3_SCEN = [
    dict(key="osmosis", topic="2.7", skills=["1.A", "3.C", "3.B", "6.C"], title="Potato cores in sucrose solutions",
         stim="A student places potato cores of equal mass in distilled water and in sucrose solutions of 0.2 M, 0.4 M, and 0.6 M for 24 hours. The student measures the mass of each core before and after, and calculates the percent change in mass.",
         A=("Describe what happens to the movement of water by osmosis when a cell is placed in a solution with a lower water potential than the cell.", "Water moves out of the cell, from the higher water potential inside the cell to the lower water potential of the solution.", "Water moves out of the cell toward the solution that has the lower water potential", ["net water movement is out of the cell", "osmosis carries water from the cell to the solution"], ["says water moves into the cell", "says solutes move out of the cell and water does not move"]),
         B=("Identify one variable that should be controlled in the investigation, and explain why it should be controlled.", "The temperature (or the volume of the solution, the initial size of the cores, or the time) should be the same for all treatments so differences in mass are caused by the sucrose concentration.", "Names a variable that is the same in all treatments and links it to isolating the effect of sucrose", ["temperature should be constant so only sucrose concentration changes", "the time or the volume of solution should be the same so the results can be compared"], ["names the sucrose concentration as the controlled variable", "names a controlled variable without connecting it to the comparison"]),
         C=("State a null hypothesis for the investigation.", "The molarity of the sucrose solution has no effect on the percent change in mass of the potato cores.", "States that the sucrose concentration has no effect on the percent change in mass of the cores", ["there is no difference in mass change among the solutions", "mass change does not depend on the molarity"], ["states a prediction that the mass will change", "states that all of the cores will gain mass"]),
         D=("Predict whether the mass of the core in distilled water will increase or decrease, and justify your prediction in terms of water potential.", "The core will gain mass, because the distilled water has a higher water potential than the potato cells, so water moves into the cells.", "Predicts a gain in mass because water moves into cells whose water potential is lower than that of the pure water", ["the core gains mass since the water potential of the cells is lower than that of distilled water", "water enters the cells by osmosis so the mass increases"], ["predicts a loss in mass", "predicts no change without a reason based on water potential"])),
    dict(key="catalase", topic="3.2", skills=["1.B", "3.C", "3.B", "6.C"], title="Catalase at different temperatures",
         stim="A student measures the volume of oxygen gas produced in 2 minutes when the enzyme catalase breaks down hydrogen peroxide at 10 °C, 25 °C, 37 °C, and 70 °C. The same amounts of enzyme and hydrogen peroxide are used at each temperature.",
         A=("Describe how an enzyme speeds up a chemical reaction.", "An enzyme lowers the activation energy of a reaction by binding the substrate at its active site.", "The enzyme lowers the activation energy of the reaction by binding the substrate at its active site", ["it reduces the energy barrier so the reaction proceeds faster", "the substrate binds at the active site and is converted more easily to product"], ["says the enzyme is consumed in the reaction", "says the enzyme raises the energy of the products"]),
         B=("Identify the dependent variable in the investigation, and describe how it is measured.", "The dependent variable is the volume of oxygen gas produced in 2 minutes, which is measured by collecting the gas.", "Names the volume of oxygen produced as the dependent variable and says how it is measured", ["the volume of oxygen gas collected in 2 minutes", "the amount of oxygen released, measured by the gas collected"], ["names the temperature as the dependent variable", "names the amount of enzyme as the dependent variable"]),
         C=("Predict the relationship between temperature and the volume of oxygen produced from 10 °C to 37 °C.", "The volume of oxygen produced will increase as the temperature increases from 10 °C to 37 °C.", "Predicts that the volume of oxygen produced increases as the temperature rises from 10 °C to 37 °C", ["more oxygen at 37 °C than at 10 °C", "the rate of the reaction rises with temperature up to the optimum"], ["predicts that the volume decreases between 10 °C and 37 °C", "predicts that the volume is the same at all of the temperatures"]),
         D=("Justify your prediction about the volume of oxygen produced at 70 °C, which is much higher than the optimum temperature of catalase.", "Less oxygen will be produced at 70 °C because the high temperature denatures the enzyme, changing the shape of the active site.", "At 70 °C the enzyme is denatured, so the active site changes and less substrate is converted", ["high temperature breaks the bonds that hold the enzyme's shape so less oxygen is produced", "the enzyme loses its shape and activity at 70 °C"], ["says that high temperature increases the activation energy", "says that the substrate is destroyed by heat without involving the enzyme"])),
    dict(key="yeast", topic="3.5", skills=["1.A", "3.C", "3.B", "6.C"], title="Yeast fermentation with and without sugar",
         stim="A student places yeast in three sealed tubes with a balloon over each tube. Tube 1 contains yeast and a sucrose solution, tube 2 contains yeast and water only, and tube 3 contains only a sucrose solution. All tubes are kept at 30 °C for 30 minutes, and the diameter of each balloon is measured.",
         A=("Describe the role of fermentation in yeast cells that have no oxygen.", "Fermentation regenerates NAD+ so that glycolysis can continue to produce a small amount of ATP when no oxygen is available.", "Fermentation regenerates NAD+ so glycolysis can continue to make ATP without oxygen", ["it allows glycolysis to continue by recycling NAD+", "yeast make ATP by glycolysis and use fermentation to regenerate NAD+"], ["says fermentation uses oxygen as the final electron acceptor", "says fermentation produces more ATP than aerobic respiration"]),
         B=("Identify the tube that serves as a negative control for the production of gas by yeast, and explain your choice.", "Tube 3 (sucrose without yeast) shows whether gas is produced without yeast, or tube 2 (yeast without sugar) shows whether yeast produce gas without sugar.", "Identifies a tube that lacks yeast or lacks sugar and explains that it shows no gas without that component", ["tube 2 has no sugar for the yeast to use so gas production should not occur", "tube 3 has no yeast so gas cannot be due to fermentation by yeast"], ["identifies tube 1 as the negative control", "names a control without explaining what it tests"]),
         C=("Predict the relative balloon diameters of the three tubes after 30 minutes.", "The balloon on tube 1 will be largest, and the balloons on tubes 2 and 3 will be small or unchanged.", "Predicts that the balloon on tube 1, with yeast and sucrose, will be the largest", ["only the tube with both yeast and sugar will inflate a lot", "tube 1 has the most carbon dioxide and the others show little or no change"], ["predicts that tube 2 or tube 3 will have the largest balloon", "predicts that all of the balloons will be the same size"]),
         D=("Justify your prediction for tube 1 in terms of cellular metabolism.", "In tube 1 the yeast use sucrose as an energy source and release carbon dioxide gas by fermentation, which inflates the balloon.", "The yeast break down sucrose and release carbon dioxide gas during fermentation, which inflates the balloon", ["carbon dioxide produced by fermentation of the sugar fills the balloon", "yeast metabolize the sugar and release gas as a product"], ["says the yeast produce oxygen that inflates the balloon", "says the sucrose itself changes into a gas without the yeast"])),
    dict(key="pillbug", topic="8.1", skills=["1.C", "3.C", "3.B", "6.C"], title="Pill bugs in a choice chamber",
         stim="A student places 20 pill bugs in a choice chamber with two halves. One half is kept humid and the other half is kept dry. The student counts the number of pill bugs in each half every minute for 10 minutes.",
         A=("Describe one way in which an organism can respond to an environmental cue such as humidity.", "An organism can move toward or away from the cue (a taxis or kinesis), which helps it to survive in a favorable habitat.", "Describes a behavioral response, such as moving toward a favorable humidity, that improves survival", ["it moves toward a humid area to avoid drying out", "the organism changes its movement rate or direction in response to the cue"], ["describes an acquired trait that is passed to offspring", "describes a response that does not depend on the cue"]),
         B=("Identify a control group that could be set up for this investigation, and explain what it shows.", "A chamber in which both halves are the same (both dry or both humid) shows how the pill bugs distribute themselves without a difference in humidity.", "Describes a chamber with the same humidity in both halves as a baseline for comparison", ["both halves dry, so any preference must be due to humidity in the test", "a chamber without a humidity difference to show the distribution without the cue"], ["describes a chamber with humid and dry halves as the control", "describes a control with a different number of pill bugs"]),
         C=("State a null hypothesis for the investigation.", "Pill bugs show no preference for the humid or the dry half of the chamber.", "States that humidity has no effect on which half of the chamber the pill bugs choose", ["the pill bugs are evenly distributed between the humid and dry halves", "there is no difference in the numbers of pill bugs in the two halves"], ["states that pill bugs prefer humid conditions", "states that pill bugs will move more in dry conditions"]),
         D=("The pill bugs are found mostly in the humid half. Justify this result in terms of the survival of pill bugs.", "Pill bugs lose water easily through their body surface, so staying in a humid environment reduces water loss and improves survival.", "Staying in the humid half reduces water loss, which improves the survival of the pill bugs", ["pill bugs dry out in dry conditions, so selecting humidity helps them survive", "the response helps maintain water balance"], ["says the pill bugs like humidity because they are learning", "says the humid half has more food without any evidence"])),
    dict(key="density", topic="8.4", skills=["1.C", "3.C", "3.B", "6.C"], title="Plant density and growth",
         stim="A student plants 5, 10, 20, or 40 radish seeds in identical containers with the same soil, water, and light. After four weeks, the student measures the mass of each plant and calculates the mean mass per plant for each container.",
         A=("Describe what is meant by a density-dependent factor that limits the growth of a population.", "A density-dependent factor is one whose effect on population growth changes with the density of the population, such as competition for resources.", "A density-dependent factor limits growth more strongly as the density of the population increases", ["its effect depends on how crowded the population is", "competition, disease, or predation that increases with density"], ["describes a factor such as a fire that acts regardless of density", "describes a factor that limits only small populations"]),
         B=("Identify the independent variable and the dependent variable in this investigation.", "The independent variable is the number of seeds per container (density) and the dependent variable is the mean mass per plant.", "Names the number of seeds per container as independent and the mean mass per plant as dependent", ["density of plants is manipulated and mass per plant is measured", "manipulated: seeds per container; measured: mean mass per plant"], ["reverses the independent and dependent variables", "names the soil or light as the independent variable"]),
         C=("Predict the relationship between the number of seeds per container and the mean mass per plant.", "The mean mass per plant will decrease as the number of seeds per container increases.", "Predicts that the mean mass per plant decreases as the number of seeds per container increases", ["crowded containers will have plants with lower mass", "more seeds per container will mean smaller plants on average"], ["predicts that the mean mass will increase with the number of seeds", "predicts that density has no effect on the mass"]),
         D=("Justify your prediction in terms of resources.", "At higher density the plants compete for the same limited light, water, and nutrients, so each plant gets fewer resources and grows less.", "Plants in crowded containers compete for limited resources such as light, water, and nutrients, so each grows less", ["more plants share the same limited resources so each gets less", "competition for light and soil nutrients reduces the growth of each plant"], ["says that more plants produce more resources for each plant", "says that the plants will run out of space but not of resources, without competition"])),
]


def _q3(rng, sc):
    A, B, C, D = sc["A"], sc["B"], sc["C"], sc["D"]
    sk = sc["skills"]
    parts = [
        P("A", A[0], "explain", [sk[0]], [sc["topic"]], A[1], [R("A1", "Gives a correct description of the biological concept or process", A[2], A[3], A[4], "claim")]),
        P("B", B[0], "explain", [sk[1]], [sc["topic"]], B[1], [R("B1", "Identifies an appropriate feature of the experimental design and gives the reason", B[2], B[3], B[4], "design")]),
        P("C", C[0], "explain", [sk[2]], [sc["topic"]], C[1], [R("C1", ("States an appropriate null hypothesis" if "null hypothesis" in C[0].lower() else "Makes an appropriate prediction of the results"), C[2], C[3], C[4], "claim")]),
        P("D", D[0], "explain", [sk[3]], [sc["topic"]], D[1], [R("D1", "Justifies the prediction or result with biological reasoning", D[2], D[3], D[4], "justification")]),
    ]
    stim = {"kind": "text", "description": sc["stim"], "data": {}}
    arch = f"bif_q3_{sc['key']}"
    return _finish(arch, "bio_q3_investigation", sc["topic"], [], "3.C", sc["title"], stim, parts, 4, 10, [f"scenario={sc['key']}"], [], f"Scientific investigation: {sc['title']}", ["Describe the biological concept behind the investigation", "Identify variables or controls", "State a null hypothesis or prediction", "Justify the prediction"],
                   [("The investigation describes one manipulated variable with a measured response", "the scenario names the treatments and what is measured")], {"type": "none", "must_include": []}, "a fixed scenario with rubric rows derived from the design (variable, control, null hypothesis, mechanism)", "design, predict, and justify within one investigation")


def _mk_q3(sc):
    def f(rng):
        return _q3(rng, sc)
    f.__name__ = f"bif_q3_{sc['key']}"
    f.__module__ = __name__
    return f


for _s in Q3_SCEN:
    globals()[f"bif_q3_{_s['key']}"] = _mk_q3(_s)

# ============================ Q4 짧은 문항: 개념 분석 (4점: 서술 / 설명 / 변화의 원인·결과 예측 / 예측 정당화) ============================
Q4_SCEN = [
    dict(key="etcblock", topic="3.5", skills=["1.A", "1.B", "6.E", "6.C"], title="A compound that blocks electron flow in mitochondria",
         stim="A researcher adds compound Z to a suspension of isolated mitochondria that are supplied with NADH and oxygen. Compound Z binds to the first protein complex of the electron transport chain and prevents that complex from passing electrons to the next protein in the chain.",
         A=("Describe the role of the electron transport chain in aerobic cellular respiration.", "The chain passes electrons through a series of proteins to oxygen and uses the energy released to pump protons across the inner mitochondrial membrane.", "The electron transport chain passes electrons along proteins and pumps protons across the inner membrane to build a gradient", ["electrons move to oxygen as energy is used to pump protons", "the chain builds a proton gradient across the inner mitochondrial membrane"], ["says the chain makes glucose", "says the chain occurs in the cytoplasm"]),
         B=("Explain how the proton gradient produced by the electron transport chain is used to make ATP.", "Protons move down their gradient through ATP synthase, and the energy released drives the addition of a phosphate to ADP.", "Protons flow down their gradient through ATP synthase, and the released energy is used to make ATP from ADP and phosphate", ["the proton gradient provides the energy for ATP synthase to produce ATP", "chemiosmosis couples proton flow to ATP formation"], ["says the protons are converted directly to ATP", "says ATP is produced by moving electrons to ATP synthase"]),
         C=("Predict the effect of compound Z on the rate at which the mitochondria consume oxygen.", "The rate of oxygen consumption will decrease.", "Predicts that the rate of oxygen consumption decreases", ["much less oxygen is consumed by the mitochondria", "oxygen uptake falls sharply"], ["predicts that oxygen consumption increases", "predicts that oxygen consumption is unchanged"]),
         D=("Justify your prediction in terms of the flow of electrons.", "Without electron flow through the chain, electrons are not passed to oxygen, the final electron acceptor, so little oxygen is reduced to water and consumed.", "Blocking electron flow means electrons do not reach oxygen, the final electron acceptor, so oxygen is not consumed", ["oxygen is consumed when it accepts electrons at the end of the chain, and no electrons arrive", "the chain stops passing electrons so less oxygen is reduced to water"], ["says compound Z destroys oxygen directly", "says the proton gradient increases and so more oxygen is used"])),
    dict(key="saltroot", topic="2.7", skills=["1.A", "1.B", "6.E", "6.C"], title="Plants in salty soil",
         stim="A farmer irrigates a field with salty water. Over several months the salt concentration in the soil water increases, and the plants in the field begin to wilt even though the soil is wet.",
         A=("Describe how water enters the root cells of a plant from the soil.", "Water moves by osmosis from the soil, where the water potential is higher, into the root cells, where it is lower.", "Water moves by osmosis from the soil into root cells, which have the lower water potential", ["water moves down the water potential gradient into the roots", "osmosis carries water from high to low water potential into the root"], ["says the roots pump water in using ATP in all cases", "says water moves from low to high water potential"]),
         B=("Explain how the solute concentration of the soil water affects the water potential of the soil water.", "A higher solute concentration lowers the solute potential and so the water potential of the soil water.", "More dissolved solute makes the solute potential more negative, which lowers the water potential of the soil water", ["adding solutes lowers the water potential", "higher salt makes Ψ_S more negative so the water potential decreases"], ["says more solute raises the water potential", "says solute concentration does not change water potential"]),
         C=("Predict the direction of net water movement between the root cells and the soil water when the soil water becomes very salty.", "Water would move out of the root cells, or less water would enter them.", "Predicts that less water enters the root cells or that water moves out of them", ["net water movement is out of the roots", "the roots take up less water"], ["predicts that more water enters the root cells", "predicts no change in water movement"]),
         D=("Justify your prediction using the term water potential.", "The soil water would have a lower water potential than the root cells, so water moves toward the lower water potential and the plant loses turgor and wilts.", "The soil water has a lower water potential than the root cells, so water moves out toward the lower water potential", ["water moves from the cells to the lower water potential of the soil", "when the soil water potential is lower than the root cells, osmosis stops water uptake"], ["says the root cells have a lower water potential than the soil", "says the water moves toward a higher water potential"])),
    dict(key="frameshift", topic="6.7", skills=["1.A", "1.B", "6.E", "6.C"], title="Deletion of one nucleotide in a gene",
         stim="A mutation deletes one nucleotide near the beginning of the coding sequence of a gene that encodes an enzyme in a human cell. The mutation does not remove the start codon or create an immediate stop codon.",
         A=("Describe the role of the mRNA in the process of translation.", "The mRNA carries the sequence of codons that specifies the sequence of amino acids that the ribosome joins into the polypeptide.", "The mRNA carries codons that specify the order of amino acids in the polypeptide", ["the ribosome reads the mRNA codons to assemble amino acids", "mRNA provides the code for the amino acid sequence"], ["says the mRNA makes the amino acids", "says the mRNA is translated into DNA"]),
         B=("Explain why deleting one nucleotide can change many amino acids in the polypeptide.", "The ribosome reads the mRNA in groups of three nucleotides, so a deletion shifts the reading frame and changes every codon that follows.", "A deletion shifts the reading frame, so all of the codons after the deletion are read differently", ["codons are read in groups of three, so the deletion changes the grouping downstream", "the frame shifts and the following codons specify different amino acids"], ["says only the codon with the deleted base changes", "says the deletion changes the tRNA anticodons"]),
         C=("Predict the effect of the mutation on the function of the enzyme.", "The enzyme will most likely lose some or all of its function.", "Predicts that the enzyme is likely to lose function or be nonfunctional", ["the enzyme will not work properly", "the protein will probably not fold into the active shape"], ["predicts that the enzyme will work better", "predicts that the mutation will have no effect on the enzyme"]),
         D=("Justify your prediction in terms of the structure of the protein.", "A changed amino acid sequence changes the folding and the shape of the active site, so the enzyme cannot bind its substrate.", "A changed amino acid sequence alters folding and the active site, so substrate binding is lost", ["the new sequence cannot fold into the correct shape for the active site", "different R groups change the interactions that determine protein shape"], ["says the changed protein will be the same shape as before", "says the mutation changes the substrate rather than the enzyme"])),
    dict(key="runoff", topic="8.7", skills=["1.C", "1.B", "6.E", "6.C"], title="Fertilizer runoff into a lake",
         stim="Runoff from nearby farms adds large amounts of nitrogen and phosphorus to a lake. Within weeks, algae multiply rapidly and cover the surface of the lake. Several months later, many fish in the lake die.",
         A=("Describe the role of algae in the lake ecosystem.", "Algae are producers that use light energy to make organic molecules by photosynthesis, which supplies energy to consumers.", "Algae are producers that fix energy by photosynthesis and supply energy to the food web", ["they make organic molecules from light energy", "they are the base of the lake food web"], ["says algae are decomposers", "says algae are consumers"]),
         B=("Explain why the addition of nitrogen and phosphorus causes the algae to multiply rapidly.", "Nitrogen and phosphorus are limiting nutrients, and adding them removes the limit so the algae can grow and reproduce more.", "These nutrients had been limiting growth, so adding them allows more growth and reproduction of the algae", ["the nutrients are needed to build proteins and nucleic acids so growth increases", "removing a limiting factor allows the population to grow"], ["says the nutrients are a source of energy for the algae", "says the nutrients kill the competitors of the algae"]),
         C=("Predict the change in the concentration of dissolved oxygen in the lake after the algae die in large numbers.", "The concentration of dissolved oxygen will decrease.", "Predicts that the dissolved oxygen decreases", ["there will be less oxygen in the water", "oxygen levels will fall"], ["predicts that the oxygen increases", "predicts no change in oxygen"]),
         D=("Justify your prediction in terms of the decomposers in the lake.", "Decomposers feed on the dead algae and use oxygen for aerobic respiration, which lowers the oxygen concentration so that fish cannot survive.", "Decomposers use up oxygen in aerobic respiration as they break down the dead algae", ["bacteria that decompose the algae consume dissolved oxygen", "the decomposition of many dead algae uses oxygen faster than it is replaced"], ["says the dead algae release oxygen to the water", "says the fish eat all of the oxygen"])),
    dict(key="insulin", topic="4.4", skills=["1.A", "1.B", "6.E", "6.C"], title="Loss of insulin receptors",
         stim="In some people, mutations make the insulin receptors on liver and muscle cells nonfunctional. These people produce normal amounts of insulin, but their blood glucose remains high after a meal.",
         A=("Describe how negative feedback regulates the concentration of glucose in the blood of a healthy person after a meal.", "A rise in glucose causes insulin release, which causes cells to take up glucose, which lowers blood glucose back toward the set point.", "Rising glucose triggers insulin release, which lowers blood glucose and so reverses the original change", ["the response opposes the rise in glucose and returns it to the set point", "insulin makes cells take up glucose and the level falls"], ["describes positive feedback in which glucose keeps rising", "says insulin raises the blood glucose"]),
         B=("Explain how binding of insulin to its receptor results in a change in the cell.", "Insulin binds to its receptor, which starts a signal transduction pathway that causes the cell to take up glucose, for example by moving glucose transporters to the membrane.", "Insulin binds the receptor and starts a signal transduction pathway that increases glucose uptake", ["the receptor relays the signal inside the cell to cause glucose uptake", "ligand binding triggers a pathway ending in glucose transporters in the membrane"], ["says insulin enters the cell and is used as an energy source", "says the receptor makes insulin"]),
         C=("Predict the effect of nonfunctional insulin receptors on the uptake of glucose by liver and muscle cells.", "The uptake of glucose by the cells will decrease.", "Predicts that the cells take up less glucose", ["less glucose enters the cells", "glucose stays in the blood"], ["predicts that glucose uptake increases", "predicts no change in uptake"]),
         D=("Justify your prediction in terms of the signal transduction pathway.", "Without functional receptors, insulin cannot start the pathway, so the response that causes glucose uptake is not triggered.", "Without a functional receptor, insulin cannot start the signal transduction pathway that leads to glucose uptake", ["the signal is not received so the cell does not respond", "the negative feedback loop is broken at the receptor step"], ["says insulin is destroyed in the cells", "says the receptor makes the cell take up glucose without insulin"])),
]


def _q4(rng, sc):
    A, B, C, D = sc["A"], sc["B"], sc["C"], sc["D"]
    sk = sc["skills"]
    parts = [P("A", A[0], "explain", [sk[0]], [sc["topic"]], A[1], [R("A1", "Gives a correct description of the biological concept or process", A[2], A[3], A[4], "claim")]),
             P("B", B[0], "explain", [sk[1]], [sc["topic"]], B[1], [R("B1", "Gives a correct explanation of how or why the process works", B[2], B[3], B[4], "claim")]),
             P("C", C[0], "explain", [sk[2]], [sc["topic"]], C[1], [R("C1", "Makes a correct prediction of the effect of the disruption", C[2], C[3], C[4], "claim")]),
             P("D", D[0], "explain", [sk[3]], [sc["topic"]], D[1], [R("D1", "Justifies the prediction with biological reasoning", D[2], D[3], D[4], "justification")])]
    stim = {"kind": "text", "description": sc["stim"], "data": {}}
    arch = f"bif_q4_{sc['key']}"
    return _finish(arch, "bio_q4_conceptual", sc["topic"], [], "1.B", sc["title"], stim, parts, 4, 10, [f"scenario={sc['key']}"], [], f"Conceptual analysis of a disruption: {sc['title']}", ["Describe the normal process", "Explain how it works", "Predict the effect of the disruption", "Justify with reasoning"],
                   [("A single disruption of a normal biological process", "the scenario names the disruption")], {"type": "none", "must_include": []}, "a fixed scenario with rubric rows derived from the normal mechanism and the effect of the disruption", "explain a mechanism and predict the effect of a disruption")


def _mk_q4(sc):
    def f(rng):
        return _q4(rng, sc)
    f.__name__ = f"bif_q4_{sc['key']}"
    f.__module__ = __name__
    return f


for _s in Q4_SCEN:
    globals()[f"bif_q4_{_s['key']}"] = _mk_q4(_s)


# ============================ Q5 짧은 문항: 모델·시각 표현 분석 (4점: 특징 서술 / 관계 설명 / 관계 표현(그리기) / 큰 원리와 연결) ============================
def bif_q5_replication(rng):
    L = rng.randint(8, 10)
    top = "".join(rng.choice("ATGC") for _ in range(L))
    bot = comp_dna(top)
    left3 = rng.choice([True, False]); fork = rng.choice(["right", "left"])
    synth_top = "right" if left3 else "left"
    lead_top = synth_top == fork
    new_top_53 = revcomp(top) if False else None
    # 위쪽 주형이 왼쪽 3' → 오른쪽 5' 이면 새 가닥은 왼쪽 5' → 오른쪽 3'(왼쪽에서 오른쪽으로 읽으면 주형의 상보)
    new_top = comp_dna(top)  # 왼쪽에서 오른쪽 순서의 상보 염기
    new_ends = ("5'", "3'") if left3 else ("3'", "5'")  # 위쪽 새 가닥의 (왼쪽 끝, 오른쪽 끝)
    t_l, t_r = ("3'", "5'") if left3 else ("5'", "3'")
    b_l, b_r = ("5'", "3'") if left3 else ("3'", "5'")
    stim = strand_stim("Two parental DNA strands at a replication fork (the fork moves toward the " + fork + " side)", ("Top template strand", t_l, t_r, list(top)), ("Bottom template strand", b_l, b_r, list(bot)))
    stim["description"] = f"The diagram shows the two parental template strands at a replication fork that is moving toward the {fork} side of the diagram."
    stim["data"]["fork_direction"] = fork
    fork_sentence = f"The replication fork is moving toward the {fork} side of the diagram."  # 분기점 진행 방향이 있어야 선도 가닥 주형이 하나로 정해진다(외부 검수 AP-001) — 그림 설명이 아니라 학생이 보는 제목과 파트 A 에 둔다
    lead = "top" if lead_top else "bottom"; lag = "bottom" if lead_top else "top"
    seq_txt = "".join(new_top)
    parts = [
        P("A", f"{fork_sentence} Identify which template strand (top or bottom) is used to make the leading strand.", "explain", ["2.A"], ["6.2"], f"The {lead} template strand is used to make the leading strand.",
          [R("A1", "Identifies the template strand for the leading strand", f"States that the {lead} template strand is the template for the continuously made leading strand", [f"the {lead} strand's new strand is made continuously toward the fork", f"leading strand template: {lead}"], [f"names the {lag} strand", "names both strands"], "claim")]),
        P("B", "Explain why the new strand made on the other template strand is made in short fragments.", "explain", ["2.B"], ["6.2"], "DNA polymerase adds nucleotides only to the 3' end of a growing strand, so on the template whose new strand is made away from the fork, synthesis must be restarted in short Okazaki fragments as the fork opens.",
          [R("B1", "Explains that synthesis only occurs in the 5' to 3' direction away from the fork on the lagging template", "DNA polymerase adds nucleotides only to the 3' end, so that new strand runs away from the fork and is made in fragments", ["synthesis is always 5' to 3' and the lagging strand must be made in pieces as the fork opens", "the strand grows away from the fork, so it is made in Okazaki fragments"], ["says DNA polymerase works in both directions", "says the lagging strand is made in fragments because it has no primer"], "claim")]),
        P("C", f"Write the base sequence of the new strand that pairs with the top template strand, from the left end of the diagram to the right end, and label its left and right ends as 5' or 3'.", "draw", ["2.D"], ["6.2"], f"Left to right the new strand is {seq_txt}, with its left end {new_ends[0]} and its right end {new_ends[1]}.",
          [R("C1", "Writes the complementary sequence with the correct 5' and 3' labels", f"Writes {seq_txt} from left to right and labels the left end {new_ends[0]} and the right end {new_ends[1]}", [f"{seq_txt} with ends {new_ends[0]} and {new_ends[1]}", "complementary bases written in the same left-to-right positions with antiparallel labels"], ["writes the correct bases but labels the ends the same as the template", "uses uracil or the wrong complementary bases"], "diagram")]),
        P("D", "Explain how the top template strand and the new strand that you wrote in part C illustrate that DNA replication is semiconservative.", "explain", ["2.C"], ["6.2"], "The new strand is paired with the original template strand, so the resulting DNA molecule contains one original strand and one newly made strand, which is what semiconservative replication means.",
          [R("D1", "Relates the pairing of the new strand with its template to semiconservative replication", "The new strand pairs with the original top template strand, so each new DNA molecule has one old strand and one new strand", ["each daughter molecule keeps one parental strand and gains one new strand", "the template stays in the new molecule, paired with the strand made from it"], ["says the two parental strands stay together in one molecule", "says the new molecule is made entirely of new nucleotides"], "justification")]),
    ]
    return _finish("bif_q5_replication", "bio_q5_model", "6.2", ["6.1"], "2.B", f"Analyzing a model of DNA replication at a fork that moves toward the {fork} side of the diagram", stim, parts, 4, 10, [f"top={top}", f"left3={left3}", f"fork={fork}", f"lead={lead}"], [],
                   "Analyze a diagram of a replication fork", ["Identify the leading strand template", "Explain Okazaki fragments", "Represent the new strand with polarity", "Relate the structure of DNA to copying"], [("Template strands labeled 5' and 3' and the fork direction", "the diagram and the sentence give the polarity and fork direction")], {"type": "diagram", "must_include": ["template strands", "5' and 3' ends", "fork direction"]},
                   "synthesis direction derived from each template's polarity and the fork direction, checked from both templates; the new strand is the reverse-labeled complement", "read a model and represent a new strand")


def bif_q5_energy(rng):
    Er = rng.choice([40, 50, 60]); dG = rng.choice([-30, -20, -40]); Ea = rng.choice([70, 80, 90])
    Ep = Er + dG
    unc = [[0, Er], [3, Er], [5, Er + Ea], [7, Ep], [10, Ep]]
    stim = graph_stim("Free energy during a reaction without an enzyme", [("Without enzyme", unc)], gaxis("Reaction progress", 0, 10, 2), gaxis("Free energy (kJ/mol)", 0, math.ceil((Er + Ea + 20) / 20) * 20, 20))
    parts = [
        P("A", "Using the graph, determine the activation energy of the reaction without the enzyme and state whether the reaction is exergonic or endergonic.", "calculate", ["2.A"], ["3.1"], f"The activation energy is {Ea} kJ/mol (peak minus starting energy), and the reaction is exergonic because the products have less free energy than the reactants.",
          [R("A1", "Gives the activation energy and the correct type of reaction (value)", f"States an activation energy of {Ea} kJ/mol and that the reaction is exergonic because free energy decreases", [f"{Ea} kJ/mol and exergonic", f"peak at {Er + Ea} minus start {Er} gives {Ea}; products are lower in energy so it releases energy"], ["gives the peak value as the activation energy", "calls the reaction endergonic"], "numeric")]),
        P("B", "Explain what the difference in free energy between the reactants and the products indicates about the energy of the reaction.", "explain", ["2.B"], ["3.3"], f"The products are lower in free energy than the reactants by {abs(dG)} kJ/mol, so energy is released.",
          [R("B1", "Explains that lower-energy products mean that energy is released", f"The products have {abs(dG)} kJ/mol less free energy than the reactants, so the reaction releases energy", ["a negative change in free energy means energy is released", "the reaction is exergonic and can occur spontaneously, releasing the difference"], ["says energy must be added to make the products", "says the enzyme determines whether energy is released"], "claim")]),
        P("C", "On the graph, draw a curve showing the same reaction in the presence of an enzyme.", "draw", ["2.D"], ["3.1"], "A curve that starts and ends at the same free energy levels as the uncatalyzed curve, but with a lower peak.",
          [R("C1", "Draws a curve with a lower peak and the same starting and ending levels", "Draws a curve with a lower activation-energy peak that starts at the same reactant level and ends at the same product level", ["a lower hump with the same start and end points", "peak lower than the uncatalyzed peak, with unchanged reactant and product energies"], ["draws a curve with a different energy for the products", "draws a curve with a higher peak"], "diagram")]),
        P("D", "Explain how the enzyme-catalyzed curve illustrates the way enzymes affect the rate of a reaction without changing the overall energy of the reaction.", "explain", ["2.C"], ["3.1"], "Enzymes lower the activation energy so more molecules can react per unit time, but they do not change the energy of the reactants or products.",
          [R("D1", "Connects a lower activation energy to a faster rate with unchanged reactant and product energies", "A lower activation energy lets more molecules react per unit time, while the energy difference between reactants and products is unchanged", ["enzymes speed reactions by lowering the barrier but not changing the net energy change", "the catalyzed curve has a lower peak and the same end points"], ["says enzymes change the free energy of the products", "says enzymes supply energy to the reaction"], "justification")]),
    ]
    return _finish("bif_q5_energy", "bio_q5_model", "3.1", ["3.3"], "2.A", "Analyzing an energy diagram of a reaction", stim, parts, 4, 10, [f"Er={Er}", f"dG={dG}", f"Ea={Ea}"], [_ev("A", "activation energy", Ea, 2, "kJ/mol")],
                   "Analyze a reaction energy diagram", ["Read the activation energy and sign of the free energy change", "Explain the energy release", "Draw the catalyzed curve", "Relate catalysis to rate"], [("An energy diagram with labeled axes", "the graph gives the free energy at each point")], {"type": "graph", "must_include": ["reaction progress", "free energy"]},
                   "activation energy and free energy change read from the plotted vertices vs the generating values", "read an energy diagram and draw the catalyzed curve")


def bif_q5_phylogeny(rng):
    taxa = rng.sample(["A", "B", "C", "D"], 4)
    X, Y, Z, W = taxa
    has = {"Outgroup": [0, 0, 0, 0], X: [1, 1, 1, 0], Y: [1, 1, 1, 1], Z: [1, 1, 0, 0], W: [1, 0, 0, 0]}
    rows = sorted([[t] + ["+" if v else "-" for v in has[t]] for t in has], key=lambda r: (r[0] != "Outgroup", r[0]))
    stim = _table("Presence (+) or absence (-) of four derived characters in four taxa and an outgroup", ["Taxon", "Character 1", "Character 2", "Character 3", "Character 4"], rows)
    pair = sorted([X, Y])
    order = [W, Z, X, Y]
    parts = [
        P("A", "Identify the two taxa that are most closely related, based on the table.", "explain", ["2.A"], ["7.9"], f"Taxa {pair[0]} and {pair[1]} are most closely related because they share the most derived characters.",
          [R("A1", "Identifies the two most closely related taxa", f"Names taxa {pair[0]} and {pair[1]} as the most closely related pair", [f"{pair[0]} and {pair[1]}", f"the pair {pair[1]} and {pair[0]} shares characters 1, 2, and 3"], ["names a pair that shares fewer derived characters", "names the outgroup as part of the closest pair"], "claim")]),
        P("B", "Explain how the shared derived characters in the table provide evidence about the relationships among the taxa.", "explain", ["2.B"], ["7.9"], "Taxa that share derived characters inherited them from a common ancestor in which those characters first appeared, so more shared derived characters indicate a more recent common ancestor.",
          [R("B1", "Links shared derived characters to common ancestry and recency", "Shared derived characters were inherited from a common ancestor, and more shared characters indicate a more recent common ancestor", ["taxa with more shared derived characters share a more recent ancestor", "a derived character that appears in several taxa suggests inheritance from the ancestor in which it arose"], ["says the taxa with the fewest characters are the most closely related", "says shared characters arose independently in each taxon"], "claim")]),
        P("C", "Draw a phylogenetic tree (cladogram) that represents the relationships among the four taxa and the outgroup, based on the table.", "draw", ["2.D"], ["7.9"], f"A tree with the outgroup branching first, then taxon {W}, then taxon {Z}, and finally taxa {X} and {Y} as sister taxa.",
          [R("C1", "Draws a tree in which the outgroup branches first and the taxa branch in the order supported by the characters", f"Shows the outgroup branching first, then {W}, then {Z}, with {X} and {Y} as the closest pair", [f"nested branching order {W}, {Z}, then {X} and {Y}", "outgroup on the first branch with the other four taxa branching in the order of the characters"], ["places the pair of closest taxa on separate early branches", "omits the outgroup or one of the taxa"], "diagram")]),
        P("D", "Explain how a phylogenetic tree such as the one you drew supports the idea of common ancestry among living organisms.", "explain", ["2.C"], ["7.9"], "A tree with nested branches shows that groups of taxa share ancestors, which is consistent with all of the taxa descending from a common ancestor.",
          [R("D1", "Relates the branching pattern to descent from common ancestors", "The nested branching pattern shows groups of taxa sharing common ancestors, consistent with descent from one common ancestor", ["each branch point represents a common ancestor of the taxa beyond it", "the tree shows that all of the taxa are related by common descent"], ["says the tree shows that one living taxon evolved from another living taxon", "says the tree shows organisms that are not related"], "justification")]),
    ]
    return _finish("bif_q5_phylogeny", "bio_q5_model", "7.9", ["7.7"], "2.B", "Analyzing a table of shared derived characters", stim, parts, 4, 10, [f"has={has}", f"pair={pair}", f"order={order}"], [],
                   "Analyze a character matrix to infer a phylogeny", ["Find the pair with the most shared derived characters", "Explain the inference", "Draw the cladogram", "Relate to common ancestry"], [("A character matrix with an outgroup and nested derived characters", "the table lists the characters of each taxon")], {"type": "table", "must_include": ["taxa", "derived characters", "outgroup"]},
                   "shared-character counts for each pair vs the generating nested pattern", "infer relationships from shared derived characters and represent them")


def bif_q5_pyramid(rng):
    E0 = rng.choice([10000, 20000, 50000]); pct = rng.choice([10, 10, 15, 20])
    lev = [E0, E0 * pct / 100, E0 * (pct / 100) ** 2]
    names = ["Producers", "Primary", "Secondary"]
    stim = bar_stim("Energy available at three trophic levels of an ecosystem (primary and secondary refer to primary and secondary consumers)", "Energy available at three trophic levels", names, [("Energy (kcal)", [round(v, 1) for v in lev])], "Trophic level", "Energy available (kcal per year)")
    nxt = lev[2] * pct / 100
    parts = [
        P("A", "Calculate the percent of the energy at the producer level that is transferred to the primary consumers.", "calculate", ["2.A"], ["8.2"], f"{lev[1]:g} / {lev[0]:g} x 100 = {pct}%.",
          [R("A1", "Gives the correct percent transfer (answer)", None, None, None, "numeric", num=pct, tol="±1")]),
        P("B", "Explain where the energy that is not transferred to the next trophic level goes.", "explain", ["2.B"], ["8.2"], "Much of the energy is lost as heat during cellular respiration and is used for the organism's own metabolism, and some is not eaten or is in waste.",
          [R("B1", "Explains that most of the energy is lost as heat or used in the organism's metabolism", "Most of the energy is lost as heat from metabolic processes or used by the organisms, and some remains in uneaten parts or waste", ["released as heat during cellular respiration", "used by the organism for its own life processes or left in waste and dead material"], ["says the energy is destroyed", "says the energy is transferred to the producers"], "claim")]),
        P("C", f"Using the same percent of energy transferred, determine the energy available to tertiary consumers, and represent it by adding a fourth bar to the bar chart.", "draw", ["2.D"], ["8.2"], f"{lev[2]:g} x {pct}/100 = {nxt:g} kcal per year, shown as a fourth bar much shorter than the third bar.",
          [R("C1", "Gives the correct energy for the next level and draws a bar of the correct relative height (value)", None, None, None, "numeric", num=f"{nxt:g}", tol=f"±{max(0.5, nxt * 0.05):.1f}")]),
        P("D", "Explain how the pattern shown by the bar chart is consistent with the statement that energy flows through ecosystems while matter is recycled.", "explain", ["2.C"], ["8.2"], "Energy decreases at each level as heat is lost and cannot be reused by producers, so ecosystems need a constant input of energy, while the matter in the molecules is recycled by decomposers.",
          [R("D1", "Connects the decrease in energy at each level to a one-way flow with an outside source, while matter is recycled", "Energy is lost as heat at each level and not reused, so an ecosystem needs constant energy input, while matter is recycled", ["energy is lost as heat so a continuous energy input is required", "decomposers return matter to producers but heat cannot be recaptured"], ["says energy is recycled by decomposers", "says matter is lost from ecosystems at each level"], "justification")]),
    ]
    return _finish("bif_q5_pyramid", "bio_q5_model", "8.2", ["8.5"], "2.B", "Analyzing an energy bar graph", stim, parts, 4, 10, [f"lev={lev}", f"pct={pct}", f"next={nxt}"], [_ev("A", "percent transferred", pct, 1, "%"), _ev("C", "energy to tertiary consumers", nxt, max(0.5, nxt * 0.05), "kcal per year")],
                   "Analyze an energy bar graph", ["Calculate the percent transferred", "Explain energy loss", "Represent the next level", "Relate to energy flow and matter cycling"], [("A bar graph of energy at three trophic levels with a constant transfer efficiency", "the bars give the energy at each level")], {"type": "diagram", "must_include": ["trophic levels", "energy values"]},
                   "percent transfer from the bar heights vs the generating efficiency", "calculate, explain, and extend an energy bar graph")


def bif_q5_pedigree(rng):
    rows = [["I-1", "Male", "Unaffected", "-"], ["I-2", "Female", "Unaffected", "-"], ["II-1", "Male", "Unaffected", "I-1, I-2"], ["II-2", "Female", "Affected", "I-1, I-2"], ["II-3", "Female", "Unaffected", "I-1, I-2"], ["II-4", "Male", "Unaffected", "I-1, I-2"]]
    stim = _table("Phenotypes of members of two generations of a family that has a rare genetic trait (pedigree information)", ["Individual", "Sex", "Phenotype", "Parents"], rows)
    stim["data"]["notes"] = ["The trait is rare."]
    parts = [
        P("A", "Identify the mode of inheritance of the trait that is most consistent with the data (autosomal dominant, autosomal recessive, X-linked dominant, or X-linked recessive).", "explain", ["2.A"], ["5.3"], "Autosomal recessive.",
          [R("A1", "Identifies autosomal recessive inheritance", "States that the trait is inherited as an autosomal recessive trait", ["autosomal recessive", "recessive and carried on an autosome rather than the X chromosome"], ["states X-linked recessive", "states a dominant mode of inheritance"], "claim")]),
        P("B", "Explain how the data in the table support your answer to part A.", "explain", ["2.B"], ["5.3"], "Two unaffected parents have an affected daughter, so both parents must carry a recessive allele. An affected daughter of an unaffected father is not possible with an X-linked recessive allele.",
          [R("B1", "Uses unaffected parents with an affected daughter as evidence", "Two unaffected parents had an affected daughter, which shows that the trait is recessive and that the father also carries the allele", ["an unaffected father cannot have an affected daughter if the trait is X-linked recessive", "the trait skipped a generation and appeared in a female, so it is autosomal recessive"], ["says the trait is dominant because it appears in a child", "says the daughter is affected because the mother is affected"], "claim")]),
        P("C", "Using the allele symbols A and a, determine the genotypes of individuals I-1 and II-2, and represent a Punnett square of the cross between I-1 and I-2.", "draw", ["2.D"], ["5.3"], "I-1 and I-2 are both Aa; II-2 is aa. The Punnett square of Aa x Aa gives AA, Aa, Aa, and aa.",
          [R("C1", "Gives the correct genotypes and a correct Punnett square", "I-1 is Aa and II-2 is aa, and the Punnett square for Aa x Aa shows AA, Aa, Aa, and aa", ["Aa and aa with a four-box square showing AA, Aa, Aa, aa", "both parents Aa, the affected child aa, and the correct four genotypes in the square"], ["gives AA as the genotype of the unaffected parents", "draws a Punnett square for a different cross"], "diagram")]),
        P("D", "Explain how the results of this cross are consistent with Mendel's principle that alleles segregate during gamete formation.", "explain", ["2.C"], ["5.3"], "Each parent has two different alleles, and the alleles separate into different gametes, so the affected child can receive one recessive allele from each parent.",
          [R("D1", "Relates segregation of alleles into gametes to the appearance of the recessive trait", "The two alleles of each parent separate into different gametes, so a child can receive a recessive allele from each parent and show the trait", ["segregation of alleles explains how the trait reappears in a child of unaffected parents", "each gamete carries one allele so the recessive alleles can combine in an offspring"], ["says the alleles blend in the parents", "says the recessive allele disappeared in the parents and reappeared by mutation"], "justification")]),
    ]
    return _finish("bif_q5_pedigree", "bio_q5_model", "5.3", ["5.2"], "2.A", "Analyzing family data for an inherited trait", stim, parts, 4, 10, [f"mode=AR"], [],
                   "Analyze pedigree information for a recessive trait", ["Identify the mode of inheritance", "Explain with the family data", "Represent genotypes and a Punnett square", "Relate to the principle of segregation"], [("Pedigree information in which two unaffected parents have an affected daughter", "the table gives the phenotype and parents of each individual")], {"type": "table", "must_include": ["individuals", "phenotypes", "parents"]},
                   "a fixed pedigree whose mode of inheritance is checked against the four candidate modes", "infer inheritance and represent a cross")


# ============================ Q6 짧은 문항: 자료 분석 (4점: 서술 / 서술·계산 / 자료로 가설 평가 / 원리와 연결) ============================
Q6_SCEN = [
    dict(key="enzymeph", topic="3.2", intro="The table shows the mean rate of an enzyme-catalyzed reaction ± 2SE at three pH values; n = {n} trials for each pH.", cond="pH", levels=["pH 4", "pH 7", "pH 10"], means=[6.0, 18.0, 9.0], n=8, dv="reaction rate", unit="µmol of product per minute",
         hyp="the enzyme has its greatest activity at pH 7", hyp_pos="supported",
         D_prompt="Explain how the effect of pH on the structure of the enzyme accounts for the lower rate at pH 4 than at pH 7.", D_ans="A pH far from the optimum changes the ionization of R groups and disrupts the interactions that hold the enzyme's shape, so the active site changes and binds the substrate less effectively.", D_elem="Extreme pH disrupts the interactions that hold the enzyme's shape, which changes the active site and reduces substrate binding", D_alts=["the enzyme is denatured or partly denatured at pH 4 so it binds less substrate", "a change in pH alters the charges of R groups and the shape of the active site"], D_errs=["says the low pH destroys the substrate", "says the low pH removes the activation energy"]),
    dict(key="mitotic", topic="4.6", intro="The table shows the mean percent of cells in mitosis ± 2SE in cultures with three concentrations of a drug; n = {n} cultures for each concentration.", cond="Drug concentration", levels=["0 µM", "5 µM", "20 µM"], means=[12.0, 7.0, 2.5], n=6, dv="percent of cells in mitosis", unit="percent of cells",
         hyp="the drug decreases cell division", hyp_pos="supported",
         D_prompt="Explain how a drug that blocks the cell cycle at a checkpoint could lower the percent of cells in mitosis.", D_ans="If the cell cycle is stopped at a checkpoint before mitosis, fewer cells enter mitosis, so the percent of cells in mitosis decreases.", D_elem="Stopping cells at a checkpoint before mitosis means fewer cells enter mitosis, which lowers the percent in mitosis", D_alts=["cells arrested in G1 or G2 do not move into M phase", "a checkpoint block keeps the cells in interphase so the mitotic percentage falls"], D_errs=["says the drug increases the length of mitosis for all cells", "says the drug speeds the cell cycle"]),
    dict(key="growth", topic="8.4", intro="The table shows the mean number of seeds produced per plant ± 2SE in plots with three densities of plants; n = {n} plots for each density.", cond="Density", levels=["5 plants per m²", "20 plants per m²", "80 plants per m²"], means=[62.0, 45.0, 21.0], n=10, dv="seeds per plant", unit="seeds",
         hyp="increasing density reduces the number of seeds per plant", hyp_pos="supported",
         D_prompt="Explain how the results relate to the idea of density-dependent limiting factors.", D_ans="At higher density plants compete for limited resources, so each plant produces fewer seeds, which shows that the effect of the limiting factor increases with density.", D_elem="Higher density increases competition for limited resources, so each plant makes fewer seeds", D_alts=["the factor limiting reproduction becomes stronger as the density increases", "crowded plants share the same resources so each has less to invest in seeds"], D_errs=["says the plants make fewer seeds because they are unrelated", "says density has no effect on resources"]),
    dict(key="salt", topic="2.7", intro="The table shows the mean percent change in mass ± 2SE of pieces of tissue after 24 hours in solutions of three salt concentrations; n = {n} pieces for each concentration.", cond="Salt concentration", levels=["0 M", "0.3 M", "0.6 M"], means=[18.0, 3.0, -16.0], n=8, dv="percent change in mass", unit="percent",
         hyp="the tissue loses mass in the solution with the highest salt concentration", hyp_pos="supported",
         D_prompt="Explain the change in mass in the 0.6 M solution in terms of water potential.", D_ans="The 0.6 M solution has a lower water potential than the tissue, so water moves out of the cells by osmosis and the mass decreases.", D_elem="The concentrated solution has a lower water potential than the tissue, so water leaves the cells by osmosis", D_alts=["water moves from the higher water potential in the cells to the lower water potential in the solution", "net osmosis out of the tissue lowers its mass"], D_errs=["says the salt moves into the tissue and makes it lighter", "says the water moves toward the higher water potential"]),
    dict(key="photo", topic="3.4", intro="The table shows the mean rate of oxygen production ± 2SE of an aquatic plant in light of three colors; n = {n} trials for each color.", cond="Color of light", levels=["Blue", "Green", "Red"], means=[48.0, 12.0, 30.0], n=6, dv="rate of oxygen production", unit="µL per minute",
         hyp="plants use green light less efficiently than blue light for photosynthesis", hyp_pos="supported",
         D_prompt="Explain how the data relate to the absorption of light by chlorophyll.", D_ans="Chlorophyll absorbs blue and red light strongly and reflects green light, so green light drives fewer light reactions and less oxygen is produced.", D_elem="Chlorophyll absorbs blue and red light well and green light poorly, so less oxygen is produced in green light", D_alts=["green light is mostly reflected rather than absorbed by chlorophyll", "photosynthesis depends on the light that the pigments absorb"], D_errs=["says plants absorb green light best because they look green", "says oxygen is produced from the light itself"]),
    dict(key="resp", topic="3.5", intro="The table shows the mean volume of oxygen consumed per minute ± 2SE by germinating peas at three temperatures; n = {n} trials for each temperature.", cond="Temperature", levels=["10 °C", "20 °C", "30 °C"], means=[1.2, 2.5, 4.9], n=6, dv="volume of oxygen consumed", unit="mL per minute",
         hyp="the rate of cellular respiration increases as temperature increases from 10 °C to 30 °C", hyp_pos="supported",
         D_prompt="Explain how the data relate to the role of oxygen in cellular respiration.", D_ans="Oxygen is the final electron acceptor of the electron transport chain, so more oxygen consumed indicates a higher rate of aerobic respiration, which provides more ATP.", D_elem="Oxygen is consumed as the final electron acceptor in aerobic respiration, so more oxygen consumed indicates a higher respiration rate", D_alts=["oxygen use measures the rate of the electron transport chain", "a higher oxygen uptake means more ATP is being made by aerobic respiration"], D_errs=["says oxygen is produced by respiration", "says oxygen is used in glycolysis as the reactant"]),
]


def _q6(rng, sc):
    means, se = _data(sc, rng)
    n = sc["n"]
    L = sc["levels"]
    top = int(np.argmax(means)); others = [i for i in range(3) if i != top]
    if any(_overlap(means, se, top, j) for j in others):
        raise ValueError("expected_separated_from_both")
    bi, bj = sc.get("pct", (top, max(others, key=lambda j: abs(means[top] - means[j]))))  # pct=(시작 행, 끝 행): 시간·나이처럼 순서가 있는 행은 시간 순서로 계산한다
    pct = (means[bj] - means[bi]) / abs(means[bi]) * 100
    agree(pct, 100 * (means[bj] - means[bi]) / abs(means[bi]), 1e-9, "pct")
    stim = _table(sc["intro"].format(n=n), [sc["cond"], f"Mean {sc['dv']} ({sc['unit']}) ± 2SE"], [[L[i], f"{means[i]:.1f} ± {2 * se[i]:.2f}"] for i in range(3)])
    trend = "peaks" if (means[1] > max(means[0], means[2])) else ("decreases" if means[0] > means[1] > means[2] else ("increases" if means[0] < means[1] < means[2] else "mixed"))
    if sc.get("categorical"):
        trend = "categorical"  # 순서가 없는 범주(예: 색·서식지 조합): 추세가 아니라 가장 큰 집단과 나머지의 차이로 기술한다
    rng_ = lambda i: f"{L[i]}: {means[i] - 2 * se[i]:.2f} to {means[i] + 2 * se[i]:.2f}"  # noqa: E731
    claim = f"the mean {sc['dv']} at {L[top]} is greater than the mean at each of the other two levels"
    desc_alts = {"categorical": ["the first group named has the highest mean and the other two groups are much lower, citing values", "one group stands out with the greatest mean while the other two groups have similar lower means"], "peaks": ["the values rise to the middle level then fall", "highest at the middle level"], "decreases": ["goes down across the levels", "falls from the first to the last level"], "increases": ["goes up across the levels", "rises from the first to the last level"], "mixed": ["changes across the levels, with values cited", "the values differ among the levels, citing the highest and the lowest"]}[trend]
    parts = [
        P("A", f"Describe the pattern shown by the data in the table, using values from the table to support your description.", "explain", ["4.B"], [sc["topic"]], (f"The mean {sc['dv']} is greatest for {L[top]} ({means[top]:.1f}) and much lower for the other two groups ({means[others[0]]:.1f} and {means[others[1]]:.1f})." if trend == "categorical" else f"The mean {sc['dv']} {'increases' if trend == 'increases' else 'decreases' if trend == 'decreases' else 'changes'} across the levels: {', '.join(f'{m:.1f}' for m in means)}; it is greatest at {L[top]}."),
          [R("A1", "Describes the pattern and supports it with values from the table", (f"Names the group with the greatest mean {sc['dv']} and describes how the other two groups compare, using the table values" if trend == "categorical" else f"Describes how the mean {sc['dv']} changes across the levels and names the level with the greatest mean using the table values"), desc_alts, ["describes a pattern that the data do not show", "describes the pattern without values from the table"], "claim")]),
        P("B", f"Calculate the percent change in the mean {sc['dv']} from {L[bi]} to {L[bj]}. Show your work.", "calculate", ["5.A"], [sc["topic"]], f"(({means[bj]:.1f} - {means[bi]:.1f}) / {abs(means[bi]):.1f}) x 100 = {pct:.1f}%.",
          [R("B1", "Gives the correct percent change with the formula applied (answer)", None, None, None, "numeric", num=f"{pct:.1f}", tol=f"±{max(0.2, abs(pct) * 0.01):.1f}")]),
        P("C", f"A student claims that {claim}. Using the ±2SE ranges in the table, evaluate whether the data support the claim.", "explain", ["5.D", "5.B"], [sc["topic"]], f"The ±2SE ranges are {rng_(top)}; {rng_(others[0])}; {rng_(others[1])}. The range at {L[top]} does not overlap the range at either of the other levels, so the data support the claim for both comparisons.",
          [R("C1", "Uses the ±2SE ranges of both comparisons to evaluate the claim", f"The ±2SE range at {L[top]} does not overlap the range at either of the other two levels, so the data support the claim", ["the error ranges at the greatest level are separated from both other levels, so the claim is supported", "compares the intervals of the greatest level with those of both other levels and concludes the claim is supported"], ["compares the greatest level with only one other level", "compares only the means", "concludes that the claim is not supported even though the ranges do not overlap"], "justification")]),
        P("D", sc["D_prompt"], "explain", ["6.D"], [sc["topic"]], sc["D_ans"], [R("D1", "Connects the results to a larger biological principle with an explanation", sc["D_elem"], sc["D_alts"], sc["D_errs"], "justification")]),
    ]
    arch = f"bif_q6_{sc['key']}"
    return _finish(arch, "bio_q6_data", sc["topic"], [], "4.B", setup_title(sc["intro"].format(n=n)), stim, parts, 4, 10, [f"means={means}", f"se={se}", f"pct={pct:.4f}", f"levels={L}"], [_ev("B", "percent change", pct, max(0.2, abs(pct) * 0.01), "%")],
                   f"Analyze a table of means with ±2SE: {sc['dv']}", ["Describe the pattern", "Calculate a percent change", "Evaluate a claim with ±2SE ranges", "Relate the result to a biological principle"], [("Means with ±2SE for the same number of replicates at each level", "the table gives mean ± 2SE and n")], {"type": "experiment_table", "must_include": ["levels", "mean ± 2SE", "n"]},
                   "percent change and ±2SE overlap recomputed from the displayed values", "describe, calculate, evaluate with ±2SE, and explain",
                   experiment={"fictional": True, "design": "experimental", "independent_variables": [sc["cond"]], "dependent_variable": sc["dv"], "controls": [], "control_not_applicable": "levels of one condition are compared and every other condition is held constant", "replicates_per_group": n, "measurement": {"variable": sc["dv"], "unit": sc["unit"]},
                               "claims": [{"text": claim, "scope": "causation"}], "ced_topics_used": [sc["topic"]]})


def _mk_q6(sc):
    def f(rng):
        return _q6(rng, sc)
    f.__name__ = f"bif_q6_{sc['key']}"
    f.__module__ = __name__
    return f


for _s in Q6_SCEN:
    globals()[f"bif_q6_{_s['key']}"] = _mk_q6(_s)

BIF_Q = {"bio_q1_results": [f"bif_q1_{s['key']}" for s in Q1_SCEN], "bio_q2_graphing": [f"bif_q2_{s['key']}" for s in Q2_SCEN], "bio_q3_investigation": [f"bif_q3_{s['key']}" for s in Q3_SCEN],
         "bio_q4_conceptual": [f"bif_q4_{s['key']}" for s in Q4_SCEN], "bio_q5_model": ["bif_q5_replication", "bif_q5_energy", "bif_q5_phylogeny", "bif_q5_pyramid", "bif_q5_pedigree"], "bio_q6_data": [f"bif_q6_{s['key']}" for s in Q6_SCEN]}
STAGE_FRQ = [n for v in BIF_Q.values() for n in v]
