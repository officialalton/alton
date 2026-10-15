"""AP Psychology 원형 — 자료 해석(Practice 3) 문항. 2026-10-14. 코드가 정답을 계산하는 기술통계 문항(`ps_stat_*`, 이중 경로: statistics 모듈 vs numpy/scipy)과 고정 자료 표·그래프 문항(`ps_data_*`).
계산기는 없다(손계산): 값은 정수 평균·중앙값이 되게 만든다. 효과 크기 해석은 CED 값(작음 ≤0.2, 중간 0.3–0.7, 큼 ≥0.8)을 따른다."""
import statistics as st
from psych_common import *  # noqa: F401,F403
from psych_common import register, mk, tbl, chart, agree
import numpy as np
from scipy import stats as sps
from common import Opt  # noqa: F401


def _row_table(desc, header, rows):
    return tbl(desc, header, rows)


def _distinct(vals, minsep=1):
    s = sorted(vals)
    return all(b - a >= minsep for a, b in zip(s, s[1:]))


# ---------------- 코드 계산 원형 ----------------
def ps_stat_mean(rng):
    """평균: 정수 평균, 중앙값·최빈값과 모두 다르다."""
    for _ in range(400):
        n = rng.choice([7, 8])
        base = rng.randint(4, 7)
        data = [max(1, min(10, base + rng.randint(-3, 3))) for _ in range(n)]
        if sum(data) % n:
            continue
        mean = sum(data) // n
        med = st.median(data)
        mo = st.multimode(data)
        if len(mo) != 1 or mean in (med, mo[0]) or med == mo[0] or med != int(med):
            continue
        agree(np.mean(data), st.mean(data), 1e-9, "mean")
        agree(st.mean(data), mean, 1e-9, "mean_int")
        names = ["Ana", "Ben", "Cho", "Dee", "Eli", "Fay", "Gus", "Hal"][:n]
        stim = _row_table("Ratings of a new campus policy (1 = strongly oppose, 10 = strongly support)", ["Participant", "Rating"], list(zip(names, data)))
        wr = [(str(int(med)), "That is the median, the middle value when the ratings are ordered, not the mean."), (str(mo[0]), "That is the mode, the most frequent rating, not the mean."), (str(max(data) - min(data)), "That is the range, the difference between the highest and lowest ratings, not the mean.")]
        if len({str(mean), *[w[0] for w in wr]}) != 4:
            continue
        return mk("ps_stat_mean", "4.2", "3.B", f"The table shows ratings that {n} participants gave a new campus policy. What is the mean rating?", str(mean), "The mean is the sum of the ratings divided by the number of participants.",
                  wr, rng, concept="calculating the mean from a data set", ek="4.2", stim=stim, est=75, facts=[f"data={data}", f"mean={mean}"], path=PATH_STATS, method="statistics+numpy",
                  thinking=["Add all of the ratings in the table and count the participants", "Divide the sum by the number of participants, then reject the median, mode, and range"],
                  cond=[("the mean equals the sum divided by the count and differs from the median, mode, and range", "table values")])
    raise ValueError("no_data")


def ps_stat_median(rng):
    for _ in range(400):
        n = rng.choice([7, 9])
        data = [rng.randint(3, 20) for _ in range(n)]
        mean = sum(data) / n
        med = st.median(data)
        mo = st.multimode(data)
        if len(set(data)) < n - 1 or len(mo) != 1 and len(mo) != n or mean == med or int(med) != med or abs(mean - med) < 1:
            continue
        agree(np.median(data), med, 1e-9, "median")
        unsorted_mid = data[n // 2]
        wr_opts = [("mean", mean), ("middle value of the unsorted list", unsorted_mid), ("range", max(data) - min(data))]
        wr = []
        for lab, v in wr_opts:
            t = f"{v:.1f}" if isinstance(v, float) and abs(v - round(v)) > 1e-9 else str(int(round(v)))
            wr.append((t, {"mean": "That is the mean, the sum divided by the count, not the median.", "middle value of the unsorted list": "That is the value in the middle position of the list as listed, but the list must be ordered before the middle is found.", "range": "That is the range, the highest value minus the lowest value, not the median."}[lab]))
        if len({str(int(med)), *[w[0] for w in wr]}) != 4:
            continue
        names = "ABCDEFGHI"[:n]
        stim = _row_table("Number of words recalled by each participant after a 24-hour delay", ["Participant", "Words recalled"], list(zip(names, data)))
        return mk("ps_stat_median", "2.4", "3.B", f"The table shows the number of words that each of {n} participants recalled. What is the median number of words recalled?", str(int(med)), "The median is the middle value after the data are put in order.",
                  wr, rng, concept="finding the median from an unordered data set", ek="2.4", stim=stim, est=80, facts=[f"data={data}", f"median={med}"], path=PATH_STATS, method="statistics+numpy",
                  thinking=["Put the recall scores in order from lowest to highest", "Choose the middle score and reject the mean, the unsorted middle, and the range"],
                  cond=[("the median is the middle value of the ordered scores and differs from the mean and the range", "table values")])
    raise ValueError("no_data")


def ps_stat_range_mode(rng):
    for _ in range(400):
        n = 8
        data = [rng.randint(5, 25) for _ in range(n)]
        mo = st.multimode(data)
        if len(mo) != 1 or max(data) - min(data) < 8:
            continue
        which = rng.choice(["range", "mode"])
        names = "ABCDEFGH"
        stim = _row_table("Number of trials each rat needed to run a maze without errors", ["Rat", "Trials"], list(zip(names, data)))
        rg = max(data) - min(data)
        agree(np.ptp(data), rg, 1e-9, "range")
        if which == "range":
            key, others = rg, [(mo[0], "That is the mode, the most frequent number of trials, not the range."), (round(st.mean(data)), "That is close to the mean number of trials, not the range."), (max(data), "That is the highest value only; the range subtracts the lowest value from it.")]
            q = "The table shows how many trials each of 8 rats needed to learn a maze. What is the range of the number of trials?"
            kw = "The range is the highest value minus the lowest value."
        else:
            key, others = mo[0], [(rg, "That is the range, the difference between the highest and lowest values, not the mode."), (round(st.mean(data)), "That is close to the mean number of trials, not the mode."), (st.median(data), "That is the median, the middle value, not the most frequent value.")]
            q = "The table shows how many trials each of 8 rats needed to learn a maze. What is the mode of the number of trials?"
            kw = "The mode is the value that appears most often."
        txts = [str(int(round(k))) if float(k) == int(k) else f"{k:.1f}" for k in [key] + [o[0] for o in others]]
        if len(set(txts)) != 4:
            continue
        wr = [(t, o[1]) for t, o in zip(txts[1:], others)]
        return mk("ps_stat_range_mode", "3.8", "3.B", q, txts[0], kw, wr, rng, concept=f"finding the {which} of a data set", ek="3.8", stim=stim, est=70, facts=[f"data={data}", f"{which}={key}"], path=PATH_STATS, method="statistics+numpy",
                  thinking=[f"Read the number of trials for every rat in the table", f"Compute the {which} and reject the other measures of the data"], cond=[(f"the {which} is unique and differs from the distractor values", "table values")])
    raise ValueError("no_data")


def ps_stat_outlier(rng):
    for _ in range(400):
        n = 7
        core = sorted(rng.randint(14, 22) for _ in range(n - 1))
        out = rng.choice([48, 52, 56])
        data = core + [out]
        rng.shuffle(data)
        m1, m2 = st.mean(data), st.mean(core)
        d1, d2 = st.median(data), st.median(core)
        if abs(m1 - m2) < 4 or abs(d1 - d2) > 2:
            continue
        agree(np.mean(data), m1, 1e-9, "mean_all"); agree(np.median(core), d2, 1e-9, "median_core")
        stim = _row_table("Daily stress ratings (0-60) reported by 7 employees", ["Employee", "Stress rating"], list(zip("ABCDEFG", data)))
        stem = f"The table shows stress ratings for 7 employees, one of whom has a very high rating of {out}. If that employee's rating were removed, how would the mean and the median most likely change?"
        return mk("ps_stat_outlier", "5.1", "3.B", stem, "The mean would decrease noticeably, and the median would change little.", "An extreme value pulls the mean toward it, while the median depends only on the middle value.",
                  [("The mean would change little, and the median would decrease noticeably.", "Reverses the effect: the mean, not the median, is sensitive to an extreme value."), ("Both the mean and the median would increase noticeably.", "Removing a very high value cannot raise the mean."), ("Neither the mean nor the median would change at all.", "Removing a very high value lowers the mean.")], rng,
                  concept="effect of an outlier on measures of central tendency", ek="5.1", stim=stim, est=85, facts=[f"data={data}", f"mean_all={m1}", f"mean_core={m2}", f"med_all={d1}", f"med_core={d2}"], path=PATH_STATS, method="statistics+numpy",
                  thinking=["Compute or estimate the mean and median with and without the extreme rating", "Choose the statement that matches which statistic is sensitive to an outlier"], cond=[("mean falls by at least 4 points while the median moves by at most 2 when the outlier is removed", "table values")])
    raise ValueError("no_data")


def ps_stat_percentile(rng):
    """정규분포: 평균 + z·SD 의 백분위(경험칙 근사). z ∈ {-2,-1,1,2}."""
    z = rng.choice([-2, -1, 1, 2])
    mean, sd = rng.choice([(100, 15), (500, 100), (50, 10), (70, 5)])
    score = mean + z * sd
    pct = {-2: 2, -1: 16, 1: 84, 2: 98}[z]
    exact = sps.norm.cdf(z) * 100
    agree(round(exact), pct, 0.51, "percentile")
    distract = [("50", "That is the percentile rank of a score equal to the mean, not of this score."), ("68", "That is the percent of scores within one standard deviation of the mean, not a percentile rank."), ("95", "That is the percent of scores within two standard deviations of the mean, not a percentile rank.")]
    if str(pct) in ("84", "98"):
        extra = ("16", "That is the percentile rank of a score one standard deviation below the mean, the mirror image of this score.")
    else:
        extra = ("84", "That is the percentile rank of a score one standard deviation above the mean, the mirror image of this score.")
    wr = [(t, w) for t, w in distract if t != str(pct)][:2] + [extra]
    if len({str(pct), *[w[0] for w in wr]}) != 4:
        raise ValueError("opts")
    stem = f"Scores on a standardized test are approximately normally distributed with a mean of {mean} and a standard deviation of {sd}. A student scores {score}. About what percentile rank does this score have?"
    side = "above" if z > 0 else "below"
    kw = f"Using the 68-95-99.7 rule for a normal curve, the score is {abs(z)} standard deviation{'s' if abs(z) > 1 else ''} {side} the mean, so about {pct} percent of scores are lower."
    return mk("ps_stat_percentile", "4.2", "3.B", stem, str(pct), kw,
              wr, rng, concept="percentile rank on a normal curve", ek="4.2", est=80, facts=[f"mean={mean}", f"sd={sd}", f"z={z}", f"percentile={pct}"], path=PATH_STATS, method="scipy normal cdf + 68-95-99.7 rule",
              thinking=["Convert the score to a number of standard deviations from the mean", "Use the normal curve percentages to find the share of scores below it"], cond=[("the score is exactly 1 or 2 standard deviations from the mean, so the empirical-rule percentile is exact enough to round", "stem values")])


def ps_stat_sd_compare(rng):
    for _ in range(400):
        mean = rng.randint(10, 14)
        a = [mean - 1, mean - 1, mean, mean, mean + 1, mean + 1, mean]
        b = [mean - 5, mean - 3, mean, mean + 3, mean + 5, mean - 4, mean + 4]
        if sum(b) % 7 != mean * 7 % 7 or st.mean(b) != st.mean(a):
            b[-1] += (st.mean(a) - st.mean(b)) * 7
        if abs(st.mean(a) - st.mean(b)) > 1e-9:
            continue
        sa, sb = st.pstdev(a), st.pstdev(b)
        agree(np.std(a), sa, 1e-9, "sd_a"); agree(np.std(b), sb, 1e-9, "sd_b")
        if sb < 1.5 * sa:
            continue
        stim = _row_table("Memory test scores for two groups of 7 participants", ["Participant", "Group X", "Group Y"], [(i + 1, x, y) for i, (x, y) in enumerate(zip(a, b))])
        return mk("ps_stat_sd_compare", "4.3", "3.B", f"The table shows memory test scores for two groups. Both groups have the same mean of {mean}. Which statement correctly compares the groups?",
                  "Group Y has the larger standard deviation because its scores are more spread out.", "The two groups have equal means, but Group Y's scores are spread farther from the mean.",
                  [("Group X has the larger standard deviation because its scores are more spread out.", "Group X's scores are clustered close together, so its standard deviation is smaller."), ("The two groups have the same standard deviation because they have the same mean.", "Groups with the same mean can have very different spreads."), ("Neither group has a standard deviation because the scores are not normally distributed.", "A standard deviation can be computed for any data set.")], rng,
                  concept="comparing variation using standard deviation", ek="4.3", stim=stim, est=80, facts=[f"a={a}", f"b={b}", f"sd_a={sa:.3f}", f"sd_b={sb:.3f}"], path=PATH_STATS, method="statistics.pstdev+numpy",
                  thinking=["Notice that the means are equal, so the comparison is about spread", "Compare how far scores in each group lie from the mean and choose the larger standard deviation"], cond=[("both groups have equal means and group Y's standard deviation is at least 1.5 times group X's", "table values")])
    raise ValueError("no_data")


def _strength(r):
    a = abs(r)
    return "strong" if a >= 0.7 else "moderate" if 0.3 <= a < 0.7 else "weak"


def ps_stat_corr_r(rng):
    r = rng.choice([-0.9, -0.85, -0.5, -0.1, 0.1, 0.5, 0.85, 0.9])
    topic = rng.choice([("hours of sleep and number of attention errors", "sleep"), ("weekly practice time and recall accuracy", "practice"), ("number of close friends and reported life satisfaction", "friends")])
    s = _strength(r); d = "positive" if r > 0 else "negative"
    key = f"A {s} {d} correlation"
    others = []
    for ss, dd in [(s, "negative" if d == "positive" else "positive"), ("weak" if s != "weak" else "strong", d), ("weak" if s != "weak" else "strong", "negative" if d == "positive" else "positive")]:
        others.append((f"A {ss} {dd} correlation", "The sign and the size of the coefficient indicate the direction and strength of the relationship; this description gets at least one of them wrong."))
    whys = ["Misreads the direction: a positive r means the variables increase together and a negative r means one decreases as the other increases.", "Misreads the strength: values near 1 or -1 are strong and values near 0 are weak.", "Misreads both the direction and the strength of the coefficient."]
    wr = [(t, w) for (t, _), w in zip(others, whys)]
    agree(1 if _strength(r) == s else 0, 1, 0, "strength")
    stem = f"A study of {topic[0]} reports a correlation coefficient of r = {r:+.2f}. Which description of the relationship is best?"
    return mk("ps_stat_corr_r", "4.5", "3.C", stem, key, "The sign gives the direction and the absolute value gives the strength; the relationship does not show causation.", wr, rng,
              concept="interpreting a correlation coefficient", ek="4.5", est=65, facts=[f"r={r}"], path=PATH_STATS, method="threshold rule recomputed",
              thinking=["Read the sign of r for the direction of the relationship", "Judge the strength from the distance of r from zero and choose the matching description"], cond=[("the coefficient is at least 0.85 away from the strength boundaries so the strength label is not debatable", "stem value")])


def ps_stat_effect_size(rng):
    d = rng.choice([0.1, 0.5, 0.9])
    lab = {0.1: "small", 0.5: "medium", 0.9: "large"}[d]
    agree(1 if (d <= 0.2 and lab == "small") or (0.3 <= d <= 0.7 and lab == "medium") or (d >= 0.8 and lab == "large") else 0, 1, 0, "cutoffs")
    meaning = {"small": "The difference between the groups is small.", "medium": "The difference between the groups is moderate in size.", "large": "The difference between the groups is large."}
    wr = [(meaning[o], f"The reported effect size of {d} does not correspond to this size of effect under the usual interpretation.") for o in ["small", "medium", "large"] if o != lab]
    wr = [(wr[0][0], f"A value of {d} is not in the range usually interpreted as {[o for o in ['small', 'medium', 'large'] if meaning[o] == wr[0][0]][0]}."), (wr[1][0], f"A value of {d} is not in the range usually interpreted as {[o for o in ['small', 'medium', 'large'] if meaning[o] == wr[1][0]][0]}."), ("The effect size shows that the treatment caused every participant to improve.", "An effect size describes the size of a difference between groups, not what happens to each individual.")]
    stem = f"In a study comparing a new therapy with a control condition, the researchers report an effect size of {d}. Using the usual interpretation (small: 0.2 or below; medium: 0.3 to 0.7; large: 0.8 or above), which statement is best?"
    return mk("ps_stat_effect_size", "5.5", "3.C", stem, meaning[lab], "An effect size indicates the size of the difference between conditions; " + f"{d} falls in the {lab} range.", wr, rng,
              concept="interpreting effect size", ek="5.5", est=75, facts=[f"d={d}", f"label={lab}"], path=PATH_STATS, method="cutoff rule recomputed",
              thinking=["Compare the reported effect size with the small, medium, and large ranges", "Choose the description of the difference and reject claims about every participant"], cond=[("the value is 0.1, 0.5, or 0.9, which lie clearly inside one effect-size range", "stem value")])


def ps_stat_pvalue(rng):
    p, sig = rng.choice([(0.01, True), (0.03, True), (0.2, False), (0.4, False)])
    stem = f"A researcher compares two groups and reports p = {str(p).lstrip('0')}. The researcher uses the conventional cutoff of .05 for statistical significance. Which conclusion is best supported?"
    if sig:
        key, kw = "The difference is statistically significant, so it is unlikely to be due to chance alone.", "A p value below .05 means the result is not likely due to chance."
        wr = [("The difference is not statistically significant, so it is probably due to chance.", "A p value below .05 is below the cutoff, so the result is statistically significant."), ("The result proves that the treatment works for everyone.", "Statistical significance does not prove an effect for every individual."), ("The result shows that the effect is large.", "Statistical significance does not by itself indicate the size of the effect.")]
    else:
        key, kw = "The difference is not statistically significant, so it may be due to chance.", "A p value above .05 does not meet the conventional cutoff for significance."
        wr = [("The difference is statistically significant, so it is unlikely to be due to chance.", "A p value above .05 is above the cutoff, so the result is not statistically significant."), ("The result proves that there is no difference between the groups.", "A nonsignificant result does not prove that there is no difference."), ("The result shows that the effect is very large.", "A nonsignificant result says nothing that supports a large effect.")]
    return mk("ps_stat_pvalue", "5.5", "3.C", stem, key, kw, wr, rng, concept="interpreting statistical significance", ek="5.5", est=65, facts=[f"p={p}", f"sig={sig}"], path=PATH_STATS, method="cutoff rule recomputed",
              thinking=["Compare the reported p value with the .05 cutoff", "Choose the conclusion about chance and avoid claims about proof or effect size"], cond=[("the p value is clearly on one side of .05", "stem value")])


# ---------------- 고정 자료 표·그래프 문항 ----------------
def _fixed_data(arch, topic, skill, concept, ek, variants, est=75):
    def fn(rng):
        q, kt, kw, wr, stim = variants[rng.randrange(len(variants))]
        return mk(arch, topic, skill, q, kt, kw, wr, rng, concept=concept, ek=ek, stim=stim, est=est)
    fn.__name__ = arch
    return fn


ps_data_conditioning = _fixed_data("ps_data_conditioning", "3.7", "3.A", "reading conditioning phases in data", "3.7.A.2", [
    ("The table shows the amount of saliva (in drops) a dog produced across trials in which a tone and food were presented. Which concept do the data from trials 11-15 illustrate?",
     "Extinction", "The tone was presented without food and the conditioned response weakened.",
     [("Acquisition", "Acquisition is the phase in which the response is learned, as in trials 6-10."), ("Spontaneous recovery", "Spontaneous recovery is a reappearance of the response after a rest, which is not shown in trials 11-15."), ("Stimulus discrimination", "Stimulus discrimination would require comparing the response to different tones, which these data do not do.")],
     tbl("Saliva production across conditioning trials", ["Trials", "Stimuli presented", "Saliva (drops)"], [["1-5", "Tone only", "0"], ["6-10", "Tone followed by food", "9"], ["11-15", "Tone only", "2"]])),
    ("The table shows a dog's saliva production across phases. Which concept do the data from the phase labeled 'Day 3' illustrate?",
     "Spontaneous recovery", "After extinction and a rest, the tone alone again produced saliva.",
     [("Acquisition", "Acquisition is the learning phase when the tone and food are paired."), ("Extinction", "Extinction is the weakening of the response when the tone is presented without food, as on Day 2."), ("Habituation", "Habituation is a decreased response to a repeated stimulus and does not describe a response returning.")],
     tbl("Saliva production in response to a tone across days", ["Day", "Stimuli presented", "Saliva (drops)"], [["Day 1", "Tone followed by food", "10"], ["Day 2", "Tone only, repeated", "1"], ["Day 3 (after a rest)", "Tone only", "5"]]))])


ps_data_age_reaction = _fixed_data("ps_data_age_reaction", "3.2", "3.C", "interpreting a bar chart of age and reaction time", "3.2.D.1", [
    ("The graph shows the average reaction time of volunteers in four age groups. Which conclusion is best supported by the graph?",
     "The oldest group had the slowest average reaction time.", "The bar for the oldest age group is the tallest.",
     [("Reaction time increases for every individual as he or she ages.", "The graph shows group averages and cannot show change within individuals."), ("The youngest group had the slowest average reaction time.", "The youngest group has the lowest bar."), ("Age causes reaction time to slow down.", "The data are group comparisons and do not establish cause and effect.")],
     chart("Bar chart of average reaction time by age group", "bar", categories=["20-29", "40-49", "60-69", "80-89"], series=[{"name": "Reaction time", "values": [210, 230, 275, 340]}], xTitle="Age group (years)", yTitle="Average reaction time (milliseconds)")),
    ("The graph shows the average number of items correctly recalled by participants who were tested after different delays. Which conclusion is best supported?",
     "Average recall was highest with the shortest delay and decreased as the delay grew.", "The bars decline from the shortest delay to the longest delay.",
     [("Average recall increased as the delay grew.", "The bars decrease rather than increase."), ("Average recall was the same after every delay.", "The bars differ in height."), ("A longer delay causes forgetting in each participant.", "The graph shows group averages and cannot show change within an individual.")],
     chart("Bar chart of average items recalled by delay", "bar", categories=["10 minutes", "1 hour", "1 day", "1 week"], series=[{"name": "Items recalled", "values": [18, 14, 9, 5]}], xTitle="Delay before test", yTitle="Average number of items recalled"))], est=80)


ps_data_retrieval = _fixed_data("ps_data_retrieval", "2.6", "3.C", "comparing recall and recognition in a table", "2.6.A.1", [
    ("The table shows the mean percentage correct for two retrieval tasks given to the same students after studying a list of 40 words. Which conclusion is best supported?",
     "Students performed better on the recognition task than on the free recall task.", "The mean percentage correct is higher for recognition than for recall.",
     [("Students performed better on the free recall task than on the recognition task.", "The recall mean is lower than the recognition mean."), ("The tasks produced the same mean percentage correct.", "The two means differ, with recognition higher than recall."), ("Recognition tasks require more effort than recall tasks, as shown by the data.", "The data show performance, not effort.")],
     tbl("Mean percentage correct by retrieval task", ["Retrieval task", "Mean percentage correct"], [["Free recall (write the words, no hints)", "34"], ["Recognition (pick the words from a list)", "78"]]))])


ps_data_therapy = _fixed_data("ps_data_therapy", "5.5", "3.C", "interpreting symptom scores by group", "5.5.A", [
    ("The table shows mean anxiety scores (higher scores mean more anxiety) before and after 8 weeks for participants randomly assigned to a therapy group or a waiting-list group. Which conclusion is best supported?",
     "The therapy group showed a larger decrease in mean anxiety than the waiting-list group.", "The therapy group fell by 14 points while the waiting-list group fell by 3 points.",
     [("The waiting-list group showed a larger decrease in mean anxiety than the therapy group.", "The waiting-list group fell by only 3 points."), ("Neither group's mean anxiety changed.", "Both groups' means decreased, by different amounts."), ("The therapy group started with lower anxiety than the waiting-list group.", "The starting means are the same.")],
     tbl("Mean anxiety scores", ["Group", "Before", "After 8 weeks"], [["Therapy", "40", "26"], ["Waiting list", "40", "37"]]))])


ps_data_scatter = _fixed_data("ps_data_scatter", "4.5", "3.C", "reading a scatterplot", "4.5.B.1", [
    ("The scatterplot shows weekly hours of practice and scores on a skills test for ten musicians. Which statement best describes the relationship?",
     "As practice time increases, test scores tend to increase.", "The points rise from the lower left to the upper right.",
     [("As practice time increases, test scores tend to decrease.", "The points do not slope downward."), ("There is no relationship between practice time and test scores.", "The points form a clear upward pattern."), ("More practice time causes higher test scores.", "A scatterplot of existing data shows association, not cause and effect.")],
     chart("Scatterplot of weekly practice hours and skills test score", "scatter", points=[[2, 55], [3, 58], [4, 62], [5, 60], [6, 70], [7, 72], [8, 75], [9, 80], [10, 83], [11, 85]], xTitle="Weekly practice (hours)", yTitle="Skills test score", xMin=0, xMax=12, xStep=2))], est=75)


ps_data_serial = _fixed_data("ps_data_serial", "2.4", "3.A", "identifying a concept in recall-by-position data", "2.4.A.5", [
    ("The graph shows the percentage of participants who recalled each word from a 15-word list, according to the word's position in the list. Which concept do the data illustrate?",
     "Serial position effect", "Recall is highest for words at the beginning and end of the list.",
     [("Spacing effect", "The spacing effect concerns distributing study over time, not position in a list."), ("Testing effect", "The testing effect concerns practicing retrieval."), ("Misinformation effect", "The misinformation effect concerns altered memories after misleading information.")],
     chart("Bar chart of recall by list position", "bar", categories=["1-3", "4-6", "7-9", "10-12", "13-15"], series=[{"name": "Recalled", "values": [78, 42, 30, 38, 70]}], xTitle="Position in word list", yTitle="Participants recalling the word (percent)"))], est=75)

_FNS = [n for n in list(globals()) if n.startswith(("ps_stat_", "ps_data_")) and callable(globals()[n])]
for _n in _FNS:
    globals()[_n].__module__ = __name__
