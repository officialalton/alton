"""AP Biology P0 원형 F — 공유 자료 세트(문항 4개, 공식 "typically 4–5 questions each"). 한 자료(표) 에서 서로 다른 스킬 4문항을 만든다."""
from bio_common import *  # noqa: F401,F403

SET_SIZE = 4


def _set(arch, intro, stim, items, topic, skill):
    assert len(items) == SET_SIZE
    return {"archetype": arch, "topic": topic, "skill": skill, "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": items, "facts": items[0]["facts"], "blueprint": items[0]["blueprint"]}


def bis_enzyme_set(rng):
    """세트 1: pH 에 따른 효소 속도 표(평균 ± 2SE) → 추세·퍼센트 변화·오차 범위 비교·예측."""
    for _ in forever():
        phs = [4, 6, 8, 10]
        means = [round(v * rng.uniform(0.95, 1.05), 1) for v in rng.choice([[6.0, 14.0, 18.0, 7.0], [5.0, 12.0, 20.0, 9.0], [8.0, 15.0, 19.0, 6.0]])]
        n = rng.choice([8, 10])
        se2 = [round(2 * m * rng.uniform(0.03, 0.06), 2) for m in means]
        top = int(np.argmax(means))
        if top not in (1, 2):
            continue
        lo = [m - e for m, e in zip(means, se2)]; hi = [m + e for m, e in zip(means, se2)]
        ov = lambda i, j: not (hi[i] < lo[j] or hi[j] < lo[i])  # noqa: E731
        pairs_all = [(i, j) for i in range(4) for j in range(i + 1, 4)]
        sep = [p_ for p_ in pairs_all if not ov(*p_)]
        ovl = [p_ for p_ in pairs_all if ov(*p_)]
        if sep and ovl:
            break
    stim = tbl("Mean rate of an enzyme-catalyzed reaction (µmol of product per minute) ± 2SE at four pH values", ["pH", "Mean rate ± 2SE", "Number of trials"], [[ph, f"{m:.1f} ± {e:.2f}", n] for ph, m, e in zip(phs, means, se2)])
    # q1: 추세 묘사
    top_ph = phs[top]
    k1, d1 = sentence_options(f"The mean rate rises from {means[0]:.1f} at pH 4 to a maximum of {means[top]:.1f} at pH {top_ph} and then falls to {means[3]:.1f} at pH 10.", f"The table shows an increase from {means[0]:.1f} to {means[top]:.1f} up to pH {top_ph} and a decrease to {means[3]:.1f} at pH 10, so the rate peaks at an intermediate pH.",
        [(f"The mean rate rises steadily across all four pH values and is greatest at pH 10 ({means[3]:.1f}).", f"The rate at pH 10 ({means[3]:.1f}) is lower than the rate at pH {top_ph} ({means[top]:.1f}), so the rate does not keep rising."),
         (f"The mean rate falls steadily across all four pH values and is least at pH 10 ({means[3]:.1f}).", f"The rate at pH {top_ph} ({means[top]:.1f}) is higher than the rate at pH 4 ({means[0]:.1f}), so the rate does not fall steadily."),
         (f"The mean rate falls from {means[0]:.1f} at pH 4 to a minimum at pH {top_ph} and then rises to pH 10.", f"The rate at pH {top_ph} ({means[top]:.1f}) is the greatest value in the table, not the least.")])
    q1 = mk("bis_enzyme_set_q1", "3.2", "4.B", "Which statement best describes how the mean rate changes as the pH increases from 4 to 10?", k1, d1, rng, concept="describe an optimum in a table of rates", path="argmax of the table means vs the generating optimum", material=MAT_TABLE("mean rates at four pH values"), facts=[f"means={means}", f"se2={se2}"], est=55)
    # q2: 퍼센트 변화(pH 6 → 최대 pH)
    a, b = (1 if top == 2 else 0), top
    ia = a; pct = (means[b] - means[ia]) / means[ia] * 100
    agree(pct, 100 * (means[b] / means[ia] - 1), 1e-9, "pct")
    pairs = [("Divides the change by the larger mean instead of the starting mean.", (means[b] - means[ia]) / means[b] * 100), ("Reports the difference in rates rather than the percent change.", means[b] - means[ia]), ("Reports the ratio of the means as a percent.", means[b] / means[ia] * 100), ("Reverses the starting and ending means.", (means[ia] - means[b]) / means[b] * 100)]
    k2, d2 = val_opts(pct, pairs, lambda v: f"{hu(v, 0)}%" if abs(v) >= 10 or abs(v) == 0 else f"{hu(v, 1)}", gap=2.0)
    q2 = mk("bis_enzyme_set_q2", "3.2", "5.A", f"What is the percent change in the mean rate from pH {phs[ia]} to pH {phs[b]}?", k2, d2, rng, concept="percent change between two means", path="(new - old)/old x 100 vs ratio-based form", material=MAT_TABLE("mean rates"), facts=[f"pct={pct:.4f}"], est=65,
            kwhy=f"Percent change = (new - old) / old x 100 = ({means[b]:.1f} - {means[ia]:.1f}) / {means[ia]:.1f} x 100 = {pct:.0f}%.")
    # q3: ±2SE 비교
    pr = rng.choice(sep); pr2 = rng.choice(ovl)
    tgt_sep = rng.choice([True, False]); i, j = (pr if tgt_sep else pr2)
    k3, d3 = range_options(tgt_sep, f"The ranges are {means[i] - se2[i]:.2f} to {means[i] + se2[i]:.2f} and {means[j] - se2[j]:.2f} to {means[j] + se2[j]:.2f}.")
    q3 = mk("bis_enzyme_set_q3", "3.2", "5.B", f"Which statement about the rates at pH {phs[i]} and pH {phs[j]} is best supported by the ±2SE values in the table?", k3, d3, rng, concept="judge a difference with ±2SE ranges", path="interval overlap from the displayed values vs the generating means and SE", material=MAT_TABLE("mean ± 2SE"), facts=[f"pair={(i, j)}"], est=70)
    # q4: pH 12 예측
    k4, d4 = sentence_options("At pH 12 the rate would be lower than at the optimum, because extreme pH disrupts the bonds that hold the enzyme's shape.", "Extreme pH disrupts ionic and hydrogen bonds that hold the enzyme's shape, which reduces substrate binding at the active site.",
        [("At pH 12 the rate would be higher than at the optimum, because enzymes work faster in basic solutions.", "Each enzyme has an optimum pH, and the table shows a lower rate at the pH values on either side of the maximum."),
         ("At pH 12 the rate would be the same as at pH 10, because pH has no effect beyond the tested range.", "The table shows that pH changes the rate between pH values that are only a few units apart, so no effect beyond the range is unsupported."),
         ("At pH 12 the rate would be zero, because no enzyme can function in a basic solution.", "Many enzymes work in basic solutions, and the lower rate at pH 10 shows a decline and not a complete loss of activity.")])
    q4 = mk("bis_enzyme_set_q4", "3.2", "6.E", "Based on the data and on the structure of enzymes, which prediction about the rate at pH 12 is best supported?", k4, d4, rng, concept="predict enzyme activity beyond the tested range", path="trend of the table beyond the optimum vs the denaturation model", material=MAT_TABLE("mean rates"), facts=[f"means={means}"], est=65)
    return _set("bis_enzyme_set", "A researcher measures the rate of an enzyme-catalyzed reaction at four pH values. Each value in the table is the mean of the trials, with ±2SE.", stim, [q1, q2, q3, q4], "3.2", "4.B")


def bis_chi_square_set(rng):
    """세트 2: 이중 교배 자손 관찰 수 → 기대 수·카이제곱 값·결론·설명."""
    for _ in forever():
        N = rng.choice([160, 320, 480])
        exp = [N * r / 16 for r in (9, 3, 3, 1)]
        dev = rng.choice([0.05, 0.12, 0.3])
        obs = [max(2, round(e * (1 + rng.choice([-1, 1]) * dev * rng.random()))) for e in exp]
        obs[0] += N - sum(obs)
        X = chi2(obs, exp)
        if abs(X - 7.81) > 0.6:
            break
    c = crit(3); reject = X > c
    labs = ["Round, yellow", "Round, green", "Wrinkled, yellow", "Wrinkled, green"]
    stim = tbl("Phenotypes of the offspring of a cross between two plants that are heterozygous for seed shape and seed color", ["Phenotype", "Observed number of offspring"], [[l, o] for l, o in zip(labs, obs)], notes=[f"Total offspring: {N}", "Hypothesis: the genes assort independently, giving a 9:3:3:1 ratio."])
    pick_i = rng.randrange(4)
    key_v = exp[pick_i]
    k1, d1 = val_opts(key_v, [("Uses the observed number instead of the expected number.", float(obs[pick_i])), ("Divides the total by 4 as if the four classes were equally likely.", N / 4), ("Uses the ratio number as the count.", float((9, 3, 3, 1)[pick_i])), ("Multiplies the total by the ratio number without dividing by 16.", float(N * (9, 3, 3, 1)[pick_i]) if N * (9, 3, 3, 1)[pick_i] < 5000 else None)], lambda v: f"{v:g}", gap=1, rel=0.05)
    q1 = mk("bis_chi_square_set_q1", "5.3", "5.A", f"If the genes assort independently, how many offspring are expected in the phenotype class {labs[pick_i].lower()}?", k1, d1, rng, concept="expected count from a 9:3:3:1 ratio", path="N x ratio/16 vs exact fractions", material=MAT_TABLE("observed offspring"), facts=[f"N={N}", f"exp={exp}"], est=60)
    pairs = [("Divides each squared difference by the observed number instead of the expected number.", sum((o - e) ** 2 / o for o, e in zip(obs, exp))), ("Does not divide by the expected numbers.", sum((o - e) ** 2 for o, e in zip(obs, exp))), ("Does not square the differences, using the sum of the absolute differences divided by the expected numbers.", sum(abs(o - e) / e for o, e in zip(obs, exp))), ("Adds the observed and expected numbers before squaring.", sum((o + e) ** 2 / e for o, e in zip(obs, exp)) / 10)]
    k2, d2 = val_opts(X, pairs, lambda v: f"{hu(v, 2)}", gap=0.1, rel=0.05)
    q2 = mk("bis_chi_square_set_q2", "5.3", "5.C", "Using the chi-square equation on the formula sheet, what is the value of chi-square for the data?", k2, d2, rng, concept="chi-square statistic", path="floating-point sum vs exact fractions", material=MAT_TABLE("observed offspring"), facts=[f"obs={obs}", f"chi2={X:.4f}"], est=90,
            kwhy=f"χ² = Σ(o - e)²/e = " + " + ".join(f"({o} - {e:g})²/{e:g}" for o, e in zip(obs, exp)) + f" = {X:.2f}.")
    k3, d3 = sentence_options(f"The null hypothesis is {'rejected' if reject else 'not rejected'}, because the chi-square value is {'greater' if reject else 'less'} than the critical value of {c} for 3 degrees of freedom at p = 0.05.", f"With four phenotype classes the degrees of freedom are 3, and the critical value at p = 0.05 is {c}; the calculated value is {X:.2f}.",
        [(f"The null hypothesis is {'not rejected' if reject else 'rejected'}, because the chi-square value is {'less' if reject else 'greater'} than the critical value of {c} for 3 degrees of freedom at p = 0.05.", "States the opposite decision from the comparison of the calculated and critical values."),
         (f"The null hypothesis is {'not rejected' if reject else 'rejected'}, because the critical value for 4 degrees of freedom, {crit(4)}, is used.", "The degrees of freedom are the number of classes minus one, which is 3."),
         ("The null hypothesis is proven true, because the chi-square value is not zero.", "A statistical test cannot prove the null hypothesis.")])
    q3 = mk("bis_chi_square_set_q3", "5.3", "5.C", "Which conclusion is correct at the 0.05 level of significance?", k3, d3, rng, concept="compare chi-square with the critical value", path="decision rule with df = 3 vs the generating comparison", material=MAT_TABLE("observed offspring"), facts=[f"chi2={X:.4f}", f"reject={reject}"], est=70)
    if reject:
        k4, d4 = sentence_options("The two genes may be linked on the same chromosome, so the assortment may not be independent.", "A significant departure from 9:3:3:1 suggests that independent assortment is not a good fit, as with linked genes.",
            [("The genes are on different chromosomes, so independent assortment must apply.", "The data do not fit independent assortment, so this is not supported."), ("The experiment must be wrong because genetic ratios never vary.", "Observed ratios vary by chance, but a significant departure needs an explanation."), ("Both parents must be homozygous for both genes.", "Homozygous parents would not produce the four phenotype classes.")])
        stem4 = "Which explanation is best supported by the result of the chi-square test?"
    else:
        k4, d4 = sentence_options("The data are consistent with independent assortment of the two genes.", "The difference from 9:3:3:1 is small enough to be explained by chance.",
            [("The data prove that the genes are on different chromosomes.", "A test cannot prove the hypothesis; it shows consistency."), ("The data show that the genes are linked on the same chromosome.", "Linked genes would give a significant departure from the expected ratio."), ("The two genes must be on the sex chromosomes.", "Nothing in the data indicates sex linkage.")])
        stem4 = "Which explanation is best supported by the result of the chi-square test?"
    q4 = mk("bis_chi_square_set_q4", "5.3", "6.B", stem4, k4, d4, rng, concept="interpret a chi-square result in terms of linkage and assortment", path="decision rule outcome vs the generating deviation", material=MAT_TABLE("observed offspring"), facts=[f"reject={reject}"], est=65)
    return _set("bis_chi_square_set", "A student crosses two pea plants that are heterozygous for seed shape (round or wrinkled) and seed color (yellow or green) and counts the offspring. The table shows the data.", stim, [q1, q2, q3, q4], "5.3", "5.C")


def bis_cell_cycle_set(rng):
    """세트 3: 대조·처리 뿌리 끝 세포 수 → 유사분열 지수·퍼센트 변화·차단 단계 해석."""
    for _ in forever():
        N = rng.choice([200, 400])
        drug = rng.choice(["spindle", "synthesis"])
        c = {"Interphase": int(N * rng.uniform(0.80, 0.86))}
        rest = N - c["Interphase"]
        c["Prophase"] = int(rest * 0.45); c["Metaphase"] = int(rest * 0.2); c["Anaphase"] = int(rest * 0.15); c["Telophase"] = rest - c["Prophase"] - c["Metaphase"] - c["Anaphase"]
        if drug == "spindle":
            t = {"Interphase": int(N * 0.78)}
            r2 = N - t["Interphase"]
            t["Prophase"] = int(r2 * 0.25); t["Metaphase"] = int(r2 * 0.65); t["Anaphase"] = 1; t["Telophase"] = r2 - t["Prophase"] - t["Metaphase"] - 1
        else:
            t = {"Interphase": int(N * 0.96)}
            r2 = N - t["Interphase"]
            t["Prophase"] = int(r2 * 0.4); t["Metaphase"] = int(r2 * 0.2); t["Anaphase"] = int(r2 * 0.2); t["Telophase"] = r2 - t["Prophase"] - t["Metaphase"] - t["Anaphase"]
        if min(t.values()) >= 1 and min(c.values()) >= 1:
            break
    phases = list(c)
    stim = tbl(f"Number of root-tip cells in each stage of the cell cycle in a control group and in a group treated with a drug (N = {N} cells counted in each group)", ["Stage", "Control", "Treated"], [[p_, c[p_], t[p_]] for p_ in phases])
    mi_c = (N - c["Interphase"]) / N * 100; mi_t = (N - t["Interphase"]) / N * 100
    k1, d1 = sentence_options("The drug caused a change in the distribution of cells among the stages of mitosis, compared with the control.", f"The treated group has {t['Metaphase']} cells in metaphase compared with {c['Metaphase']} in the control, and its distribution among the stages differs.",
        [("The drug had no effect, because cells in all stages are present in both groups.", "The number of cells in each stage differs between the control and the treated group."), ("The drug caused all treated cells to enter interphase.", "The treated group still has cells in each stage of mitosis."), ("The drug changed the number of cells counted in the treated group.", "The number of cells counted was the same in both groups.")])
    q1 = mk("bis_cell_cycle_set_q1", "4.6", "4.B", "Which statement best describes the data in the table?", k1, d1, rng, concept="describe differences between control and treated distributions", path="stage counts compared between groups vs the generating drug effect", material=MAT_TABLE("stage counts"), facts=[f"c={c}", f"t={t}"], est=60)
    pairs = [("Reports the percent of control cells in interphase.", c["Interphase"] / N * 100), ("Reports the number of cells in mitosis rather than the percent.", float(N - c["Interphase"])), ("Divides the cells in mitosis by the cells in interphase.", (N - c["Interphase"]) / c["Interphase"] * 100), ("Reports the percent of cells in prophase only.", c["Prophase"] / N * 100)]
    k2, d2 = val_opts(mi_c, pairs, lambda v: f"{hu(v, 0)}%" if v >= 1 else f"{hu(v, 1)}%", gap=1.0)
    q2 = mk("bis_cell_cycle_set_q2", "4.6", "5.A", "The mitotic index is the percent of cells in mitosis (all stages except interphase). What is the mitotic index of the control group?", k2, d2, rng, concept="mitotic index from counts", path="exact fraction of non-interphase cells vs float computation", material=MAT_TABLE("stage counts"), facts=[f"mi_c={mi_c:.3f}"], est=65,
            kwhy=f"The control group has {N - c['Interphase']} cells in mitosis out of {N}, so the mitotic index is {N - c['Interphase']} / {N} x 100 = {mi_c:.0f}%.")
    pc = (mi_t - mi_c) / mi_c * 100
    pairs = [("Divides by the mitotic index of the treated group instead of the control group.", (mi_t - mi_c) / mi_t * 100), ("Reports the difference in percentage points rather than the percent change.", mi_t - mi_c), ("Reports the ratio of the treated index to the control index as a percent.", mi_t / mi_c * 100), ("Reports the mitotic index of the treated group.", mi_t)]
    k3, d3 = val_opts(pc, pairs, lambda v: f"{v:+.0f}%" if abs(v) >= 1 else f"{v:+.1f}%", gap=2.0)
    q3 = mk("bis_cell_cycle_set_q3", "4.6", "5.A", "What is the percent change in the mitotic index of the treated group compared with the control group?", k3, d3, rng, concept="percent change in mitotic index", path="(treated - control)/control x 100 vs ratio form", material=MAT_TABLE("stage counts"), facts=[f"pc={pc:.3f}"], est=75)
    if drug == "spindle":
        k4, d4 = sentence_options("The drug most likely interferes with spindle fibers, so cells stall in metaphase and do not complete anaphase.", f"Cells accumulate in metaphase ({t['Metaphase']} compared with {c['Metaphase']}) and few reach anaphase, as expected if chromosomes cannot be pulled apart.",
            [("The drug most likely blocks DNA replication, so cells cannot enter mitosis.", "Blocking replication would lower the number of cells entering mitosis, not increase the number in metaphase."), ("The drug most likely speeds up cytokinesis, so many cells are in telophase.", "The number of cells in telophase does not increase in the treated group."), ("The drug most likely has no effect on mitosis.", "The distribution of cells in the stages of mitosis changed.")])
    else:
        k4, d4 = sentence_options("The drug most likely blocks DNA synthesis, so fewer cells enter mitosis and more remain in interphase.", f"The treated group has {t['Interphase']} cells in interphase compared with {c['Interphase']}, and the mitotic index is much lower.",
            [("The drug most likely interferes with spindle fibers, so cells stall in metaphase.", "The data do not show an accumulation of cells in metaphase."), ("The drug most likely speeds up the cell cycle, so more cells are in mitosis.", "The treated group has fewer cells in mitosis."), ("The drug most likely has no effect on the cell cycle.", "The mitotic index changed strongly.")])
    q4 = mk("bis_cell_cycle_set_q4", "4.6", "6.E", "Which statement best explains the effect of the drug on the cell cycle?", k4, d4, rng, concept="infer the target of a cell-cycle drug from stage counts", path="stage with the largest relative change vs the generating drug", material=MAT_TABLE("stage counts"), facts=[f"drug={drug}"], est=70)
    return _set("bis_cell_cycle_set", "A student treats onion root tips with a drug and counts cells in each stage of the cell cycle in treated and control root tips. The table shows the counts.", stim, [q1, q2, q3, q4], "4.6", "4.B")


def bis_population_set(rng):
    """세트 4: 개체군 크기 표 → 서술·성장률·수용력·교란 예측."""
    for _ in forever():
        K = rng.choice([400, 600, 800]); r = rng.choice([0.55, 0.65, 0.75]); N0 = rng.choice([10, 20])
        yrs = [0, 2, 4, 6, 8, 10, 12]
        N = [round(K / (1 + (K - N0) / N0 * math.exp(-r * y))) for y in yrs]
        inc = [N[i + 1] - N[i] for i in range(6)]
        pk = int(np.argmax(inc))
        if 0 < pk < 5 and inc[-1] < 0.2 * max(inc) and N[-1] > 0.95 * K:
            break
    stim = tbl("Number of individuals in a population of mice introduced to an island", ["Year", "Number of individuals"], [[y, n] for y, n in zip(yrs, N)])
    k1, d1 = sentence_options("The population grows slowly, then quickly, and then levels off near a maximum size.", f"The yearly increases are small at first, largest between years {yrs[pk]} and {yrs[pk + 1]}, and small near {N[-1]}.",
        [("The population grows at a constant rate throughout the study.", "The increases differ from interval to interval."), ("The population grows faster and faster throughout the study.", "The increases become smaller near the end."), ("The population decreases after the first two years.", "The population increases in every interval.")])
    q1 = mk("bis_population_set_q1", "8.4", "4.B", "Which statement best describes the growth of the population?", k1, d1, rng, concept="describe an S-shaped growth table", path="interval increases vs the generating logistic curve", material=MAT_TABLE("population sizes"), facts=[f"N={N}"], est=60)
    a_i, b_i = pk, pk + 1
    rate = (N[b_i] - N[a_i]) / (yrs[b_i] - yrs[a_i])
    pairs = [("Divides the change by the final year instead of the interval length.", (N[b_i] - N[a_i]) / yrs[b_i]), ("Reports the change in population without dividing by time.", float(N[b_i] - N[a_i])), ("Reports the population size at the end of the interval divided by the interval.", N[b_i] / (yrs[b_i] - yrs[a_i])), ("Divides the interval length by the change.", (yrs[b_i] - yrs[a_i]) / (N[b_i] - N[a_i]))]
    k2, d2 = val_opts(rate, pairs, lambda v: f"{hu(v, 1)} mice per year" if v < 100 else f"{hu(v, 0)} mice per year", gap=0.05, rel=0.08)
    q2 = mk("bis_population_set_q2", "8.3", "5.A", f"What is the average rate of population growth from year {yrs[a_i]} to year {yrs[b_i]}?", k2, d2, rng, concept="average growth rate from a table", path="(N2 - N1)/(t2 - t1) vs the mean of the yearly increments", material=MAT_TABLE("population sizes"), facts=[f"rate={rate:.4f}"], est=60,
            kwhy=f"Rate = change in population / change in time = ({N[b_i]} - {N[a_i]}) / ({yrs[b_i]} - {yrs[a_i]}) = {rate:.1f} mice per year.")
    pairs = [("Reads the population size in the year of fastest growth.", float(N[pk + 1])), ("Reads the starting population size.", float(N[0])), ("Reads the population size in year 4, which is still increasing.", float(N[2])), ("Reads half of the final value.", N[-1] / 2)]
    k3, d3 = val_opts(float(N[-1]), pairs, lambda v: f"{int(round(v)):,}", gap=12, rel=0.08)
    q3 = mk("bis_population_set_q3", "8.4", "2.B", "Which value is the best estimate of the carrying capacity of the island for this population?", k3, d3, rng, concept="read the plateau of a growth table as the carrying capacity", path="last values of the table vs the generating K", material=MAT_TABLE("population sizes"), facts=[f"K={K}"], est=60)
    k4, d4 = sentence_options("The carrying capacity would decrease, and the population would decline toward a smaller size.", "Fewer resources can support fewer individuals, so the population falls toward the lower carrying capacity.",
        [("The carrying capacity would stay the same, and the population would continue to grow at the same rate.", "The carrying capacity is set by the resources, which have decreased."), ("The carrying capacity would increase, because competition for the remaining food would be stronger.", "A loss of resources lowers, not raises, the carrying capacity."), ("The population would increase without limit, because fewer plants mean fewer competitors.", "A reduction of the food supply does not remove limits on a population.")])
    q4 = mk("bis_population_set_q4", "8.4", "6.E", "A drought reduces the amount of plant food available on the island. Which prediction about the mouse population is best supported?", k4, d4, rng, concept="predict the effect of a resource loss on carrying capacity", path="logistic model with a smaller K vs the generating population", material=MAT_TABLE("population sizes"), facts=[f"K={K}"], est=65)
    return _set("bis_population_set", "A small population of mice was introduced to an island that had no mice, and the number of mice was counted every two years. The table shows the data.", stim, [q1, q2, q3, q4], "8.4", "4.B")


def bis_water_potential_set(rng):
    """세트 5: 감자 조각 질량 변화 → 서술·등장 농도·방향·용질 퍼텐셜."""
    for _ in forever():
        iso = rng.choice([0.25, 0.30, 0.35, 0.40, 0.45]); slope = rng.choice([-24, -28, -32])
        ms = [0.0, 0.2, 0.4, 0.6, 0.8]
        vals = [round(slope * (m - iso), 1) for m in ms]
        if vals[0] > 3 and vals[-1] < -3 and any(vals[i] > 0 >= vals[i + 1] for i in range(4)):
            break
    stim = tbl("Percent change in the mass of potato cores after 24 hours in sucrose solutions", ["Sucrose molarity (M)", "Percent change in mass"], [[f"{m:.1f}", f"{v:+.1f}"] for m, v in zip(ms, vals)])
    k1, d1 = sentence_options("The cores gained mass in the solutions of lower molarity and lost mass in the solutions of higher molarity.", "The percent change goes from positive to negative as the molarity increases.",
        [("The cores gained mass in every solution, because they were placed in water-based solutions.", "The percent change is negative at higher molarity."), ("The cores lost mass in every solution, because sucrose is toxic to the cells.", "The percent change is positive at low molarity."), ("The mass of the cores did not change in any of the solutions.", "The masses changed in every solution except possibly near the isotonic point.")])
    q1 = mk("bis_water_potential_set_q1", "2.7", "4.B", "Which statement best describes the data?", k1, d1, rng, concept="describe mass change across solution concentrations", path="sign pattern of the table vs the generating model", material=MAT_TABLE("percent mass change"), facts=[f"vals={vals}"], est=55)
    i0 = next(i for i in range(4) if vals[i] > 0 >= vals[i + 1])
    est = round(ms[i0] + (0 - vals[i0]) * (ms[i0 + 1] - ms[i0]) / (vals[i0 + 1] - vals[i0]), 2)
    co = np.polyfit(ms, vals, 1); agree(est, -co[1] / co[0], 0.05, "iso")
    pairs = [("Uses the molarity with the largest mass gain.", ms[0]), ("Uses the midpoint of all the molarities tested.", float(np.mean(ms))), ("Uses the molarity with the largest mass loss.", ms[-1]), ("Uses the midpoint of the two molarities that bracket zero without interpolating.", 0.5 * (ms[i0] + ms[i0 + 1]))]
    k2, d2 = val_opts(est, pairs, lambda v: f"{hu(v, 2)} M", gap=0.04)
    q2 = mk("bis_water_potential_set_q2", "2.7", "5.A", "Which value is the best estimate of the molarity of sucrose that is isotonic to the potato cells?", k2, d2, rng, concept="isotonic concentration by interpolation", path="interpolation between bracketing points vs least-squares x-intercept", material=MAT_TABLE("percent mass change"), facts=[f"est={est}"], est=75)
    k3, d3 = sentence_options("Water moved into the cores in the 0.0 M solution, because the solution had a higher water potential than the cells.", "A higher water potential outside the cells causes net movement of water into the cells, which increases mass.",
        [("Water moved out of the cores in the 0.0 M solution, because the solution had a higher water potential than the cells.", "Water moves from higher to lower water potential, which is into the cells."), ("Sucrose moved into the cores in the 0.0 M solution, which increased their mass.", "The solution had no sucrose, so none could move in."), ("Water moved into the cores in the 0.0 M solution, because the solution had a lower solute concentration, so the water potential is lower.", "A lower solute concentration gives a higher, not lower, water potential.")])
    q3 = mk("bis_water_potential_set_q3", "2.7", "6.B", "Which statement best explains the change in mass of the cores in the 0.0 M solution?", k3, d3, rng, concept="explain mass gain using water potential", path="direction of the mass change vs the sign of the water potential difference", material=MAT_TABLE("percent mass change"), facts=[f"vals={vals}"], est=70)
    Tc = rng.choice([20, 25]); Mx = rng.choice([0.4, 0.6, 0.8])
    psi = -1 * Mx * R_BAR * (Tc + 273)
    pairs = [("Gives the solute potential a positive sign.", -psi), ("Uses the temperature in degrees Celsius instead of kelvins.", -Mx * R_BAR * Tc), ("Forgets the molar concentration.", -R_BAR * (Tc + 273)), ("Uses 0.831 in place of 0.0831 for the pressure constant.", psi * 10)]
    k4, d4 = val_opts(psi, pairs, lambda v: f"{hu(v, 2)} bars", gap=0.03)
    q4 = mk("bis_water_potential_set_q4", "2.7", "5.A", f"Using the equation for solute potential on the formula sheet, what is the water potential of the {Mx:g} M sucrose solution at {Tc} °C in an open beaker? (The ionization constant for sucrose is 1.)", k4, d4, rng, concept="solute potential Psi_S = -iCRT", path="exact rational arithmetic vs float evaluation", material=MAT_TABLE("percent mass change"), facts=[f"psi={psi:.4f}"], est=80,
            kwhy=f"In an open container Ψ = Ψ_S = -iCRT = -(1)({Mx:g})(0.0831)({Tc + 273}) = {psi:.2f} bars.")
    return _set("bis_water_potential_set", "A student places potato cores of equal mass in sucrose solutions of different molarity for 24 hours and measures the change in mass. The table shows the results.", stim, [q1, q2, q3, q4], "2.7", "4.B")


@retry_sep
def bis_hw_set(rng):
    """세트 6: 유전자형 관찰 수 → 대립유전자 빈도·기대 이형접합자 수·비교·원인."""
    for _ in forever():
        N = rng.choice([500, 1000]); q = rng.choice([0.3, 0.4, 0.5]); p = 1 - q
        exp_het = 2 * p * q * N
        het = int(exp_het * rng.uniform(0.55, 0.7))
        hom_rec_extra = (exp_het - het) / 2
        aa = int(q * q * N + hom_rec_extra); AA = N - het - aa
        if AA > 0 and aa > 0 and abs(AA - p * p * N) > 0.04 * N:
            break
    fa = (het + 2 * aa) / (2 * N)
    stim = tbl(f"Genotypes of {N} individuals in a population sampled at one time", ["Genotype", "Number of individuals"], [["AA", AA], ["Aa", het], ["aa", aa]])
    pairs = [("Counts the proportion of homozygous recessive individuals instead of the allele frequency.", aa / N), ("Counts the proportion of heterozygous individuals instead of the allele frequency.", het / N), ("Reports the frequency of the dominant allele.", 1 - fa), ("Divides the number of a alleles by the number of individuals instead of the number of alleles.", (het + 2 * aa) / N)]
    k1, d1 = val_opts(fa, pairs, lambda v: f"{hu(v, 2)}", gap=0.02)
    q1 = mk("bis_hw_set_q1", "7.5", "5.A", "What is the frequency of allele a in the population?", k1, d1, rng, concept="allele frequency from genotype counts", path="allele counting vs the generating q", material=MAT_TABLE("genotype counts"), facts=[f"q={fa:.4f}"], est=65,
            kwhy=f"There are {2 * N} alleles. The number of a alleles is {het} + 2({aa}) = {het + 2 * aa}, so the frequency of a is {het + 2 * aa}/{2 * N} = {fa:.2f}.")
    pf = 1 - fa; eh = 2 * pf * fa * N
    pairs = [("Uses p squared times the population size.", pf * pf * N), ("Uses q squared times the population size.", fa * fa * N), ("Uses 2pq as a number without multiplying by the population size.", 2 * pf * fa), ("Uses p times q times the population size, without the factor of 2.", pf * fa * N)]
    k2, d2 = val_opts(eh, pairs, lambda v: f"{v:,.0f}" if v >= 2 else f"{hu(v, 2)}", gap=1, rel=0.05)
    q2 = mk("bis_hw_set_q2", "7.5", "5.A", "If the population were in Hardy-Weinberg equilibrium with the allele frequencies found in the previous question, how many heterozygotes would be expected?", k2, d2, rng, concept="expected heterozygotes under Hardy-Weinberg", path="2pqN vs binomial expansion", material=MAT_TABLE("genotype counts"), facts=[f"eh={eh:.2f}"], est=75)
    k3, d3 = sentence_options(f"The population has fewer heterozygotes than expected ({het} observed and about {eh:.0f} expected), so it is not in Hardy-Weinberg equilibrium.", "A large deficit of heterozygotes is not consistent with the equilibrium genotype frequencies.",
        [(f"The population has more heterozygotes than expected ({het} observed and about {eh:.0f} expected), so it is not in equilibrium.", "The observed number of heterozygotes is lower than expected, not higher."), (f"The population has about the expected number of heterozygotes, so it is in Hardy-Weinberg equilibrium.", "The observed number differs a lot from the expected number."), ("The comparison cannot be made, because Hardy-Weinberg applies only to dominant alleles.", "Hardy-Weinberg applies to alleles of a gene in a population.")])
    q3 = mk("bis_hw_set_q3", "7.5", "4.B", "Which statement best compares the observed number of heterozygotes with the expected number?", k3, d3, rng, concept="compare observed and expected heterozygotes", path="observed minus expected heterozygotes vs the generating inbreeding", material=MAT_TABLE("genotype counts"), facts=[f"het={het}", f"eh={eh:.2f}"], est=70)
    k4, d4 = sentence_options("Nonrandom mating, such as mating between relatives, which increases the proportion of homozygotes", "Inbreeding raises the frequency of homozygotes and lowers the frequency of heterozygotes without changing allele frequencies.",
        [("A very large population, which prevents chance changes in allele frequencies", "A large population helps maintain equilibrium and would not cause a heterozygote deficit."), ("No mutation, because the alleles are not changed", "The absence of mutation would help keep equilibrium."), ("Random mating among all the individuals in the population", "Random mating is a condition for equilibrium, not a violation.")])
    q4 = mk("bis_hw_set_q4", "7.5", "6.E", "Which condition of Hardy-Weinberg equilibrium is most likely to have been violated?", k4, d4, rng, concept="identify a violated equilibrium condition from a heterozygote deficit", path="deficit pattern vs the generating cause", material=MAT_TABLE("genotype counts"), facts=[f"het={het}"], est=65)
    return _set("bis_hw_set", "A biologist samples a population of a plant species and records the genotypes at a gene with two alleles, A and a. The table shows the data.", stim, [q1, q2, q3, q4], "7.5", "5.A")


STAGE_SETS = ["bis_enzyme_set", "bis_chi_square_set", "bis_cell_cycle_set", "bis_population_set", "bis_water_potential_set", "bis_hw_set"]
