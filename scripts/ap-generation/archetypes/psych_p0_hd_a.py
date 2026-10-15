"""AP Psychology 고차 원형 A — 코드가 값을 계산하는 다단계 자료 해석·연구 설계 문항(2026-10-15, psych-hard). 모든 값·정답을 코드가 계산하고 독립 경로(statistics·numpy·scipy)로 다시 계산한다.
표의 백분율은 정수 인원과 맞는다(표에는 인원 수만 싣거나 psych_hd_common.pct_rows_ok 를 통과한 값만). 손계산 수준(계산기 없음). 정답은 가장 긴 선택지가 아니다."""
import statistics as st
from psych_common import mk, tbl, agree, PATH_STATS
from psych_hd_common import key_not_longest, pct_rows_ok
from psych_hd_signals import code_signals
import numpy as np
from scipy import stats as sps


def _mk(arch, topic, skill, stem, key, kwhy, wr, rng, *, concept, ek, stim, facts, thinking, cond, est=100, method="statistics+numpy"):
    key_not_longest(key, wr)
    pct_rows_ok(stim)
    p = mk(arch, topic, skill, stem, key, kwhy, wr, rng, concept=concept, ek=ek, stim=stim, est=est, facts=facts, path=PATH_STATS, method=method, thinking=thinking, cond=cond)
    p["difficulty_signals"] = code_signals(arch, thinking, wr)  # 난이도 신호 선언(psych_hd_signals.py)
    return p


def ps_hd_s_did(rng):
    """통제 집단이 있는 사전·사후 평균: 통제 집단의 향상을 뺀 순 향상(두 집단 사전 점수가 다름)."""
    for _ in range(400):
        pre_t = rng.randint(44, 52); d0 = rng.randint(3, 6); pre_c = pre_t + d0
        g_t = rng.randint(9, 13); g_c = rng.randint(3, 5)
        post_t, post_c = pre_t + g_t, pre_c + g_c
        gap = post_t - post_c; net = g_t - g_c
        agree(np.diff([pre_t, post_t])[0], g_t, 0, "gain_t"); agree(np.diff([pre_c, post_c])[0], g_c, 0, "gain_c")
        if not (0 <= gap <= 3) or net < 4 or len({net, g_t, g_t + g_c, gap}) != 4:
            continue
        stim = tbl("Mean score on a 100-point vocabulary test", ["Group", "Pretest mean", "Posttest mean"], [["Retrieval-practice program", pre_t, post_t], ["Usual review (control)", pre_c, post_c]])
        stem = "A teacher gives one class a retrieval-practice program and lets a second class continue its usual review. Both classes take the same vocabulary test before and after the four-week unit. The table shows each class's mean score. Taking the control class into account, which conclusion is best supported?"
        key = f"The program class gained {g_t} points and the control class {g_c}, so the program class improved about {net} points more than the control class."
        wr = [(f"The program class gained {g_t} points, so the program accounts for all {g_t} points of improvement shown in the table and for nothing else.", "Ignores the control class, whose gain shows that retesting and ordinary instruction also raise scores."),
              (f"At posttest the two classes differ by only {gap} points, so the program had little or no effect on vocabulary scores in this study.", "Compares only posttest means and ignores that the classes started at different levels; the gains are the relevant comparison."),
              (f"Adding the two gains, {g_t} + {g_c} = {g_t + g_c} points, gives the amount of improvement that the retrieval-practice program produced in this study.", "Adds the control class's gain instead of subtracting it; the control gain estimates improvement without the program.")]
        return _mk("ps_hd_s_did", "2.4", "2.B", stem, key, "The control class's gain estimates how much scores rise without the program, so the program's added improvement is the difference in gains.", wr, rng,
                   concept="using a control group's change to interpret a treatment group's change", ek="2.4", stim=stim, facts=[f"pre_t={pre_t}", f"post_t={post_t}", f"pre_c={pre_c}", f"post_c={post_c}", f"net={net}"],
                   thinking=["Compute each class's gain from its pretest and posttest means", "Use the control class's gain as the improvement expected without the program", "Subtract the control gain from the program gain and reject the answers that skip the control or compare only posttest means"],
                   cond=[("the posttest means differ by at most 3 points while the gains differ by at least 4", "table values")])
    raise ValueError("no_data")


def ps_hd_s_zcompare(rng):
    """서로 다른 척도의 두 점수를 표준편차 단위로 비교하고 경험칙으로 상위 비율을 구한다."""
    for _ in range(400):
        small = rng.choice([(50, 5), (70, 5), (100, 10), (40, 4)]); big = rng.choice([(500, 100), (250, 50), (1000, 200)])
        hi_is_small = rng.random() < 0.5
        zs = (2, 1) if hi_is_small else (1, 2)
        (ms, ss), (mb, sb) = small, big
        xs = ms + zs[0] * ss; xb = mb + zs[1] * sb
        names = ("A", "B") if rng.random() < 0.5 else ("B", "A")
        ns, nb = names
        hi, lo = (ns, nb) if zs[0] > zs[1] else (nb, ns)
        agree((xs - ms) / ss, zs[0], 1e-12, "z_small"); agree((xb - mb) / sb, zs[1], 1e-12, "z_big")
        agree(round(100 * sps.norm.sf(2)), 2, 0, "tail2"); agree(round(100 * sps.norm.sf(1)), 16, 0, "tail1")
        tail = 2.5 if zs[0] > zs[1] else 1  # 높은 z 쪽 위로 남는 비율은 z=2 이면 2.5, 아니면 16
        hi_tail = "2.5" if max(zs) == 2 else "16"
        if max(zs) != 2:
            continue
        rows = sorted([[f"Test {ns}", ms, ss, xs], [f"Test {nb}", mb, sb, xb]], key=lambda r: r[0])
        stim = tbl("Two standardized tests (scores are approximately normally distributed)", ["Test", "Mean", "Standard deviation", "Student's score"], rows)
        stem = "One student took two standardized tests, shown in the table. Both distributions are approximately normal. On which test did the student score higher relative to other test takers, and about what percentage of test takers scored above the student on that test?"
        xhi, mhi = (xs, ms) if hi == ns else (xb, mb)
        key = f"Test {hi}; about 2.5 percent of test takers scored higher, because the score of {xhi} is two standard deviations above that test's mean of {mhi}."
        wr = [(f"Test {lo}; about 16 percent of test takers scored higher than the student, because the raw score on that test is the larger number of the two scores.", "Compares raw scores from different scales; only the distance from each test's mean in standard deviations is comparable."),
              (f"Test {hi}; about 5 percent of test takers scored higher than the student, because 95 percent of the scores on that test fall within two standard deviations of the mean.", "Counts both tails; only about half of the 5 percent outside two standard deviations lies above the mean."),
              (f"Test {hi}; about 16 percent of test takers scored higher than the student, because the student's score on that test is above the mean of the test takers.", "That percentage belongs to a score one standard deviation above the mean, not two.")]
        return _mk("ps_hd_s_zcompare", "2.8", "3.B", stem, key, "A score 2 standard deviations above the mean beats about 97.5 percent of scores, leaving about 2.5 percent higher; a score 1 standard deviation above leaves about 16 percent.", wr, rng,
                   concept="comparing scores on different scales in standard deviation units and reading the normal curve", ek="2.8", stim=stim, facts=[f"small={small}", f"big={big}", f"scores={xs},{xb}", f"better={hi}"],
                   thinking=["Convert each score to a number of standard deviations above its own test's mean", "Decide which test gives the greater distance above the mean", "Use the 68-95-99.7 rule to find the percentage above that score and reject the answers that compare raw scores or count both tails"],
                   cond=[("one score is exactly 2 standard deviations and the other exactly 1 above its mean, and the lower-z test has the larger raw score", "table values")], method="scipy norm.sf + empirical rule")
    raise ValueError("no_data")


def ps_hd_s_counts(rng):
    """세 조건의 인원 수(같은 n)를 백분율로 바꿔 인접 조건 사이의 가장 큰 하락을 찾는다."""
    for _ in range(400):
        n = rng.choice([40, 50])
        a = rng.randint(int(n * 0.74), int(n * 0.9)); b = a - rng.randint(2, int(n * 0.3)); c = b - rng.randint(2, int(n * 0.4))
        if c < int(n * 0.2):
            continue
        pa, pb, pc = (100 * a / n), (100 * b / n), (100 * c / n)
        if any(abs(x - round(x)) > 1e-9 for x in (pa, pb, pc)):
            continue
        pa, pb, pc = int(pa), int(pb), int(pc)
        d1, d2 = pa - pb, pb - pc
        agree(np.diff(np.array([a, b, c]) * 100 / n)[0], -d1, 1e-9, "drop1"); agree(np.diff(np.array([a, b, c]) * 100 / n)[1], -d2, 1e-9, "drop2")
        if d1 == d2 or len({d1, d2, a - b, b - c}) != 4:
            continue
        big_first = d1 > d2
        stim = tbl("Students who offered help to a distressed stranger", ["Condition", "Students in condition", "Students who offered help"], [["Alone in the room", n, a], ["Two other bystanders present", n, b], ["Four other bystanders present", n, c]])
        names = ["alone", "two-bystander", "four-bystander"]
        stem = "In a lab experiment, students heard a stranger in the next room appear to be in distress, either while alone or while two or four other bystanders were present. The table gives each condition's results. Between which neighboring conditions did the percentage of students who offered help fall the most, and by how much?"
        pair_big = (names[0], names[1]) if big_first else (names[1], names[2]); pair_small = (names[1], names[2]) if big_first else (names[0], names[1])
        dbig, dsmall = (d1, d2) if big_first else (d2, d1); cbig, csmall = ((a - b), (b - c)) if big_first else ((b - c), (a - b))
        key = f"Between the {pair_big[0]} and {pair_big[1]} conditions, by {dbig} percentage points, because that pair shows the largest fall in the percentage of helpers."
        wr = [(f"Between the {pair_small[0]} and {pair_small[1]} conditions, by {dsmall} percentage points, because that is the first step at which fewer students offered help.", "Chooses the neighboring pair with the smaller percentage-point drop."),
              (f"Between the {pair_big[0]} and {pair_big[1]} conditions, by {cbig} percentage points, because the number of students who helped fell by that many.", "Reports the drop in the number of students as if it were percentage points; with this group size, percentages and counts differ."),
              ("The drop was the same between each pair of neighboring conditions, because the number of students who offered help fell steadily as bystanders were added.", "The percentage-point drops differ between the neighboring pairs; the table values show that the falls are not equal.")]
        return _mk("ps_hd_s_counts", "4.3", "3.C", stem, key, f"Each condition has {n} students, so each percentage is the count divided by {n} times 100 and the drops are compared in percentage points.", wr, rng,
                   concept="converting counts to percentages and comparing changes between conditions (bystander effect)", ek="4.3", stim=stim, facts=[f"n={n}", f"counts={a},{b},{c}", f"drops={d1},{d2}"],
                   thinking=["Convert each condition's count of helpers to a percentage of the students in that condition", "Subtract the percentages for each pair of neighboring conditions", "Choose the larger drop and reject the answers that report counts as percentage points or pick the smaller drop"],
                   cond=[("the two neighboring drops in percentage points differ and neither equals the raw count drops", "table values")])
    raise ValueError("no_data")


def ps_hd_s_placebo3(rng):
    """무처치·위약·약물 세 집단의 호전 인원: 위약 효과와 약물 고유 효과를 분리한다."""
    for _ in range(400):
        n = rng.choice([40, 50])
        none = rng.randint(int(n * 0.1), int(n * 0.25)); pla = none + rng.randint(int(n * 0.15), int(n * 0.3)); drug = pla + rng.randint(int(n * 0.2), int(n * 0.35))
        if drug > n - 2:
            continue
        pr = [100 * x / n for x in (none, pla, drug)]
        if any(abs(x - round(x)) > 1e-9 for x in pr):
            continue
        pn, pp, pd = [int(round(x)) for x in pr]
        placebo_effect, drug_effect, total = pp - pn, pd - pp, pd - pn
        agree(float(np.diff(np.array([none, pla, drug]) * 100 / n)[1]), drug_effect, 1e-9, "drug_effect")
        if len({placebo_effect, drug_effect, total, pd}) != 4:
            continue
        stim = tbl("Participants with mild insomnia who reported improved sleep after four weeks", ["Group", "Participants", "Number who improved"], [["No pill", n, none], ["Placebo pill", n, pla], ["Sleep medication", n, drug]])
        stem = "Researchers randomly assigned adults with mild insomnia to receive no pill, a placebo pill, or a sleep medication. Participants did not know whether a pill contained the medication. The table shows how many in each group reported improved sleep. Which conclusion is best supported?"
        key = f"The medication group improved {drug_effect} percentage points more than the placebo group, and the placebo group improved {placebo_effect} points more than the no-pill group."
        wr = [(f"The medication improved sleep in {total} more percentage points of participants than doing nothing, so all {total} points are due to the active ingredient of the medication.", "Treats the whole difference from the no-pill group as the drug effect; the placebo group's gain shows that expectations alone contribute."),
              (f"Because {pp} percent of the placebo group improved, the placebo condition failed as a control and the medication results cannot be interpreted at all.", "A placebo group is expected to improve through expectation; that improvement is what makes it a useful comparison."),
              (f"The medication caused {pd} percentage points of improvement, because {pd} percent of that group reported improved sleep after four weeks of use.", "Credits the medication with the group's whole improvement rate and ignores the placebo and no-pill comparison groups.")]
        return _mk("ps_hd_s_placebo3", "5.5", "2.B", stem, key, "The no-pill group estimates change without any expectation, the placebo group adds expectation, and the medication group adds the drug; successive differences separate those contributions.", wr, rng,
                   concept="separating placebo effects from a treatment effect with a no-treatment and a placebo group", ek="5.5", stim=stim, facts=[f"n={n}", f"counts={none},{pla},{drug}", f"effects={placebo_effect},{drug_effect}"],
                   thinking=["Convert each group's number who improved to a percentage", "Subtract the no-pill rate from the placebo rate to estimate the effect of expectation", "Subtract the placebo rate from the medication rate to estimate the drug's added effect and reject the answers that skip a comparison group"],
                   cond=[("all three percentages are whole numbers and the three candidate differences are distinct", "table values")])
    raise ValueError("no_data")


def ps_hd_s_corr(rng):
    """상관 행렬 읽기: 부호와 크기를 분리하고 인과를 주장하지 않는다."""
    for _ in range(400):
        r1 = -round(rng.uniform(0.55, 0.75), 2); r2 = round(rng.uniform(0.30, 0.45), 2); r3 = round(rng.uniform(0.04, 0.2), 2)
        order = [("Hours of sleep the night before", r1), ("Minutes of screen use before bed", r2), ("Cups of coffee that day", r3)]
        rng.shuffle(order)
        if abs(r1) - r2 < 0.15 or len({f"{x:+.2f}" for _, x in order}) != 3:
            continue
        strongest = max(order, key=lambda t: abs(t[1]))[0]
        agree(abs(r1), max(abs(x) for _, x in order), 1e-12, "strongest")
        stim = tbl("Correlation (r) with number of attention errors on a simulated driving task", ["Variable", "r"], [[v, f"{x:+.2f}"] for v, x in order])
        stem = "A researcher measured three variables in 120 drivers and correlated each with the number of attention errors made on a simulated driving task. The table gives the correlation coefficients. Which conclusion is best supported?"
        key = f"Hours of sleep (r = {r1:+.2f}) has the strongest relationship, because its coefficient lies farthest from zero; more sleep went with fewer errors."
        wr = [("Minutes of screen use has the strongest relationship with errors in this sample, because its coefficient is the largest positive value shown in the table.", "Treats the largest positive r as the strongest; strength depends on distance from zero, whatever the sign."),
              ("Hours of sleep has the weakest relationship with errors in this sample, because a negative coefficient means that the two variables are unrelated.", "A negative coefficient indicates an inverse relationship, not the absence of a relationship."),
              ("Cups of coffee cause attention errors, because even a small positive coefficient shows the direction in which coffee influences driving.", "A correlation cannot show causation, and a coefficient this close to zero indicates almost no relationship.")]
        return _mk("ps_hd_s_corr", "1.5", "3.C", stem, key, "Strength is the absolute value of r, so the coefficient farthest from zero is strongest; its sign gives only the direction, and no correlation by itself shows cause.", wr, rng,
                   concept="reading signs and sizes of correlation coefficients without inferring causation", ek="1.5", stim=stim, facts=[f"r={order}", f"strongest={strongest}"],
                   thinking=["Read each coefficient's sign for direction and its distance from zero for strength", "Identify the coefficient farthest from zero even though it is negative", "Reject the answers that equate large positive r with strong, negative with none, or any correlation with cause"],
                   cond=[("the strongest coefficient is negative and exceeds the largest positive by at least 0.15", "table values")], method="threshold rule recomputed")
    raise ValueError("no_data")


def ps_hd_s_skew(rng):
    """평균과 중앙값을 모두 계산해 대표값 선택과 치우침 방향을 추론한다."""
    for _ in range(2000):
        core = sorted(rng.randint(205, 262) for _ in range(8)); out = rng.randint(360, 430)
        data = core + [out]
        if sum(data) % 9:
            continue
        mean = sum(data) // 9; med = st.median(data)
        agree(np.mean(data), st.mean(data), 1e-9, "mean"); agree(np.median(data), med, 1e-9, "median")
        if int(med) != med or mean - med < 18 or len(set(data)) != 9:
            continue
        med = int(med)
        shuffled = data[:]; rng.shuffle(shuffled)
        stim = tbl("Time (ms) to press a brake pedal after a signal, nine adults aged 70 and older", ["Participant", "Reaction time (ms)"], [[i + 1, x] for i, x in enumerate(shuffled)])
        stem = "A researcher recorded how quickly nine older adults pressed a brake pedal after a signal. The table lists their reaction times. Which statement about the data is best supported?"
        key = f"The median, {med} ms, better describes a typical reaction time, and a mean ({mean} ms) above the median suggests a positively skewed distribution."
        wr = [(f"The mean, {mean} ms, better describes a typical reaction time because it uses every score, and the distribution is roughly symmetric around it.", "A mean pulled above the median by one very slow time is not typical, and the gap itself shows the distribution is not symmetric."),
              (f"The median, {med} ms, better describes a typical reaction time, and a mean above the median suggests a negatively skewed distribution with a tail of fast times.", "Gets the typical value right but reverses the skew; a long tail of high values is positive skew."),
              (f"The mean, {mean} ms, better describes a typical reaction time because the slowest participant is part of the data, and the distribution is positively skewed.", "Reads the skew correctly but chooses the mean, which an extreme score pulls away from where most participants fall.")]
        return _mk("ps_hd_s_skew", "3.2", "3.B", stem, key, "The slowest time pulls the mean upward but does not move the middle value; mean greater than median indicates a tail toward high values, a positive skew.", wr, rng,
                   concept="choosing a measure of central tendency and inferring skew from mean and median", ek="3.2", stim=stim, facts=[f"data={sorted(data)}", f"mean={mean}", f"median={med}"],
                   thinking=["Order the nine times and find the median, then add them and divide by nine to find the mean", "Compare the mean with the median to infer the direction of the skew", "Choose the measure that best represents most participants and reject answers that misread the skew or choose the mean"],
                   cond=[("the mean exceeds the median by at least 18 ms because of one slow time", "table values")])
    raise ValueError("no_data")


def ps_hd_s_pvalue(rng):
    """통계적 유의성과 효과 크기(작음 ≤0.2, 중간 0.3–0.7)를 함께 해석한다: 두 연구 비교. p 는 t = d·sqrt(n/2) 로 두 경로 계산."""
    for _ in range(400):
        d1 = rng.choice([0.06, 0.08, 0.1]); n1 = rng.choice([2000, 2400, 3000])
        d2 = rng.choice([0.5, 0.6]); n2 = rng.choice([24, 20, 30])
        t1, t2 = d1 * (n1 / 2) ** 0.5, d2 * (n2 / 2) ** 0.5
        p1 = 2 * sps.t.sf(t1, 2 * n1 - 2); p2 = 2 * sps.t.sf(t2, 2 * n2 - 2)
        p2b = float(sps.ttest_ind_from_stats(d2, 1, n2, 0, 1, n2).pvalue); agree(p2, p2b, 1e-9, "p2_paths")
        if not (p1 < 0.01) or not (0.06 < p2 < 0.15):
            continue
        stim = tbl("Two experiments testing whether a persuasive message changes attitudes", ["Study", "Participants per group", "Effect size (d)", "p-value"], [["Study 1", n1, f"{d1:.2f}", "< .01"], ["Study 2", n2, f"{d2:.2f}", f"{p2:.2f}".lstrip("0")]])
        stem = "Two experiments compared attitudes after a persuasive message with attitudes after no message. The table shows their sample sizes, effect sizes, and p-values. Which interpretation is best supported?"
        key = f"Study 1 (d = {d1:.2f}) is unlikely due to chance but small; Study 2 (d = {d2:.2f}) is medium but may be due to chance, because its sample is small."
        wr = [("Study 1 shows the larger and more meaningful effect on attitudes, because its p-value is smaller and a smaller p-value always means a bigger effect.", "A small p-value says the result is unlikely to be chance; it does not say the effect is large, and very large samples make tiny effects significant."),
              ("Study 2 shows that the message had no effect on attitudes at all, because its p-value is above the usual .05 cutoff for statistical significance.", "A non-significant result does not prove there is no effect; the medium effect size from a small sample may simply be imprecise."),
              ("Both studies show differences that are unlikely to be due to chance, because both studies report effect sizes that are greater than zero.", "Effect size and statistical significance are different; only a small p-value indicates that chance is an unlikely explanation.")]
        return _mk("ps_hd_s_pvalue", "4.2", "3.C", stem, key, "Statistical significance concerns whether chance is a plausible explanation; effect size concerns the size of the difference, and a small sample can leave a medium difference non-significant while a very large sample can make a tiny difference significant.", wr, rng,
                   concept="distinguishing statistical significance from effect size and the role of sample size", ek="4.2", stim=stim, facts=[f"n1={n1}", f"d1={d1}", f"n2={n2}", f"d2={d2}", f"p2={p2:.3f}"],
                   thinking=["Read each study's p-value to decide whether chance is an unlikely explanation", "Read each effect size as small (about 0.2 or less) or medium (about 0.3 to 0.7)", "Combine both readings for each study, noting sample size, and reject answers that equate p with effect size or non-significance with no effect"],
                   cond=[("Study 1 has p below .01 with d below .11, and Study 2 has p between .06 and .15 with d of at least .5", "table values")], method="scipy t-test two paths")
    raise ValueError("no_data")


def ps_hd_s_reliab(rng):
    """검사 신뢰도(재검사 상관)와 타당도(준거 상관)를 구분해 두 검사를 비교한다. 타당도 <= sqrt(신뢰도) 제약을 지킨다."""
    for _ in range(400):
        ra = round(rng.uniform(0.88, 0.95), 2); va = round(rng.uniform(0.10, 0.25), 2)
        rb = round(rng.uniform(0.58, 0.70), 2); vb = round(rng.uniform(0.42, 0.55), 2)
        if va > ra ** 0.5 or vb > rb ** 0.5:
            continue
        swap = rng.random() < 0.5
        A = ("A", ra, va) if not swap else ("A", rb, vb); B = ("B", rb, vb) if not swap else ("B", ra, va)
        hi_rel = A[0] if A[1] > B[1] else B[0]; hi_val = A[0] if A[2] > B[2] else B[0]
        lo_rel, lo_val = ("B" if hi_rel == "A" else "A"), ("B" if hi_val == "A" else "A")
        if hi_rel == hi_val:
            continue
        agree(1 if hi_rel != hi_val else 0, 1, 0, "split")
        stim = tbl("Two aptitude tests given to 200 students", ["Test", "Correlation between scores on two administrations, one month apart", "Correlation between test score and first-year college GPA"], [["Test A", f"{A[1]:.2f}", f"{A[2]:.2f}"], ["Test B", f"{B[1]:.2f}", f"{B[2]:.2f}"]])
        stem = "A college compared two aptitude tests. The table shows how strongly each test's scores correlated with the same students' scores one month later and with their first-year college GPA. Which statement is best supported?"
        ra_, va_ = (A[1], A[2]) if hi_rel == "A" else (B[1], B[2])
        rb_, vb_ = (B[1], B[2]) if hi_rel == "A" else (A[1], A[2])
        key = f"Test {hi_rel} is more reliable (r = {ra_:.2f}), but Test {hi_val} is the better predictor of GPA (r = {max(va_, vb_):.2f}), because the two qualities differ."
        wr = [(f"Test {hi_rel} is both more reliable and more valid, because consistent scores from one month to the next also make it the better predictor of first-year GPA in this table.", "Reliability does not guarantee validity; a consistent test can still predict the outcome poorly."),
              (f"Test {hi_val} is both more reliable and more valid, because the test that predicts GPA best must also give the most consistent scores over time in these data.", "Compares the columns incorrectly; the one-month correlation measures consistency, and the other test has the higher value there."),
              (f"Test {hi_val} is more reliable, but Test {hi_rel} is the better predictor of first-year GPA, because a correlation with GPA measures consistency of scores over a month.", "Swaps the meanings; correlation across two administrations measures reliability and correlation with a criterion measures validity.")]
        return _mk("ps_hd_s_reliab", "2.8", "3.C", stem, key, "The correlation between two administrations measures reliability (consistency), and the correlation with a later outcome measures predictive validity; they can point to different tests.", wr, rng,
                   concept="distinguishing reliability from validity in test data", ek="2.8", stim=stim, facts=[f"A={A}", f"B={B}", f"more_reliable={hi_rel}", f"more_valid={hi_val}"],
                   thinking=["Identify which column is reliability (consistency over time) and which is validity (relation to GPA)", "Compare the two tests on each column separately", "Reject the answers that assume reliability implies validity or that swap the meaning of the two columns"],
                   cond=[("one test has the higher reliability coefficient and the other the higher validity coefficient", "table values")], method="threshold rule recomputed")
    raise ValueError("no_data")


def ps_hd_s_normal_count(rng):
    """정규분포 경험칙으로 인원 수를 구한다(%를 인원으로 바꾸는 2~3단계)."""
    for _ in range(400):
        mean, sd = rng.choice([(100, 15), (500, 100), (70, 10), (50, 8)])
        n = rng.choice([800, 1000, 2000, 2500, 4000])
        z = rng.choice([1, 2])
        cut = mean + z * sd; share = {1: 0.16, 2: 0.025}[z]
        agree(round(float(sps.norm.sf(z)), 2 if z == 1 else 3), round(share, 2 if z == 1 else 3) if z == 1 else 0.023, 0.0035, "tail")
        key_n = n * share
        if abs(key_n - round(key_n)) > 1e-9:
            continue
        key_n = int(round(key_n))
        other = {1: [(n * 0.32, "both tails (32 percent)"), (n * 0.68, "the middle 68 percent"), (n * 0.025, "the 2.5 percent beyond two standard deviations")],
                 2: [(n * 0.05, "both tails (5 percent)"), (n * 0.95, "the middle 95 percent"), (n * 0.16, "the 16 percent beyond one standard deviation")]}[z]
        vals = [int(round(v)) for v, _ in other]
        if len({key_n, *vals}) != 4:
            continue
        stem = f"A school district gave a reasoning test to {n:,} students. Scores were approximately normally distributed with a mean of {mean} and a standard deviation of {sd}. About how many students scored above {cut}?"
        key = f"About {key_n:,} students"
        why = {1: "A score 1 standard deviation above the mean has about 16 percent of scores above it (the 68 percent in the middle leaves 32 percent in the two tails, 16 percent in each).", 2: "A score 2 standard deviations above the mean has about 2.5 percent above it (the 95 percent in the middle leaves 5 percent in the two tails, 2.5 percent in each)."}[z]
        wr = [(f"About {v:,} students", f"Uses {lab} instead of the proportion above a score {z} standard deviation{'s' if z > 1 else ''} above the mean.") for v, lab in zip(vals, [o[1] for o in other])]
        stim = None
        th = ["Express the cutoff as a number of standard deviations above the mean", "Use the 68-95-99.7 rule to find the share of scores above that cutoff, halving the outside area", "Multiply the share by the number of students and reject counts that use both tails or the middle area"]
        p = mk("ps_hd_s_normal_count", "2.8", "3.B", stem, key, why, wr, rng, concept="applying the 68-95-99.7 rule to a count of test takers", ek="2.8", est=95, facts=[f"mean={mean}", f"sd={sd}", f"n={n}", f"z={z}", f"answer={key_n}"], path=PATH_STATS, method="scipy norm.sf + empirical rule",
               thinking=th, cond=[("the cutoff is exactly 1 or 2 standard deviations above the mean and the share times the group size is a whole number", "stem values")])
        p["difficulty_signals"] = code_signals("ps_hd_s_normal_count", th, wr)
        return p
    raise ValueError("no_data")

# 단계 B(psych-hard-b): 코드 계산 자료 해석 원형 9 + (psych_p0_hd_b.py 의 연구 설계 원형 11) + 표 비율을 고친 공유 세트 2(psych_p0_sets_b.py 의 원형, 같은 id 로 재생성)
STAGE_HD_B = ["ps_hd_s_did", "ps_hd_s_zcompare", "ps_hd_s_counts", "ps_hd_s_placebo3", "ps_hd_s_corr", "ps_hd_s_skew", "ps_hd_s_pvalue", "ps_hd_s_reliab", "ps_hd_s_normal_count", "pss_u3_attachment_style", "pss_u4_bystander_lab"]
