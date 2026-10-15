"""AP Psychology 고차 원형 E — 코드 계산 다단계 자료 해석 추가 4종(hd-c 단계, 2026-10-15 psych-hard). 값·정답을 코드가 계산하고 독립 경로로 다시 계산한다. 표의 백분율은 정수 인원과 맞는다."""
import statistics as st  # noqa: F401
from psych_common import mk, tbl, agree, PATH_STATS
from psych_hd_common import key_not_longest, pct_rows_ok
import numpy as np


def _mk(arch, topic, skill, stem, key, kwhy, wr, rng, *, concept, ek, stim, facts, thinking, cond, est=100, method="statistics+numpy"):
    key_not_longest(key, wr)
    pct_rows_ok(stim)
    return mk(arch, topic, skill, stem, key, kwhy, wr, rng, concept=concept, ek=ek, stim=stim, est=est, facts=facts, path=PATH_STATS, method=method, thinking=thinking, cond=cond)


def ps_hd_s_spacing(rng):
    """두 학습 방식의 지연 시점별 기억 비율(%): 시점마다 차이를 구해 가장 큰 격차와 해석을 고른다(참가자 비율이 아니라 단어 비율)."""
    for _ in range(400):
        delays = ["1 day", "1 week", "1 month"]
        m = [rng.randint(66, 76), rng.randint(36, 48), rng.randint(16, 24)]
        diffs = [rng.randint(5, 9), rng.randint(14, 20), rng.randint(23, 30)]
        sp = [a + b for a, b in zip(m, diffs)]
        if not (sp[0] > sp[1] > sp[2]) or max(sp) > 95 or len(set(diffs)) != 3:
            continue
        agree(int(np.argmax(np.array(sp) - np.array(m))), 2, 0, "largest_gap")
        stim = tbl("Percentage of studied words recalled", ["Delay before the test", "Massed study", "Spaced study"], [[d, a, b] for d, a, b in zip(delays, m, sp)])
        stem = "Students studied vocabulary lists by massed study (one long session) or spaced study (several shorter sessions) and were tested after different delays. The table shows the percentage of words recalled. At which delay did spaced study have the greatest advantage over massed study, and what does the pattern suggest?"
        key = f"At 1 month, by {diffs[2]} points; the advantage of spaced study grew as the delay lengthened."
        wr = [(f"At 1 day, by {diffs[0]} points, because both methods retained the most material at the shortest delay and spaced study matters most then.", "Chooses the delay with the highest recall instead of the largest difference between the methods."),
              (f"At 1 week, by {diffs[1]} points, because the spaced method lost the fewest points between the 1-day and the 1-week tests of recall.", "Names the second-largest gap, not the largest; the difference grows again at 1 month."),
              (f"At 1 month, by {sp[2]} points, because that is the percentage of words the spaced group recalled at the longest delay in the table.", "Reports the spaced group's recall instead of the difference between the two methods.")]
        return _mk("ps_hd_s_spacing", "2.4", "3.C", stem, key, "Subtract massed from spaced at each delay; the differences grow with the delay, which fits the spacing effect on long-term retention.", wr, rng,
                   concept="comparing differences between conditions across delays and interpreting the spacing effect", ek="2.4", stim=stim, facts=[f"massed={m}", f"spaced={sp}", f"diffs={diffs}"],
                   thinking=["Subtract the massed-study percentage from the spaced-study percentage at each delay", "Find the delay with the largest difference and notice how the differences change as the delay grows", "Choose the matching interpretation and reject answers that use the highest recall or report a recall value as the difference"],
                   cond=[("the three differences are distinct and increase with the delay", "table values")])
    raise ValueError("no_data")


def ps_hd_s_twins(rng):
    """쌍둥이 일치율: 인원 수에서 일치율(%)을 구하고 유전·환경 기여를 해석한다(같은 n 이라 백분율이 정수)."""
    for _ in range(400):
        n = rng.choice([40, 50])
        mz = rng.randint(int(n * 0.62), int(n * 0.78)); dz = rng.randint(int(n * 0.32), int(n * 0.46))
        pm, pd_ = 100 * mz / n, 100 * dz / n
        if abs(pm - round(pm)) > 1e-9 or abs(pd_ - round(pd_)) > 1e-9 or pm <= pd_ + 15:
            continue
        pm, pd_ = int(pm), int(pd_)
        agree(float(np.round(100 * mz / n)), pm, 0, "mz"); agree(float(np.round(100 * dz / n)), pd_, 0, "dz")
        if len({pm, pd_, mz, dz}) != 4:
            continue
        stim = tbl("Pairs of twins in which both twins describe themselves as night owls", ["Twin type", "Pairs studied", "Pairs in which both are night owls"], [["Identical", n, mz], ["Fraternal", n, dz]])
        stem = "A researcher studied pairs of identical and fraternal twins to see whether both twins in a pair describe themselves as night owls. The table shows the results. Which interpretation of the concordance rates is best supported?"
        key = f"Concordance was {pm}% for identical pairs and {pd_}% for fraternal pairs, so heredity contributes and environment matters too."
        wr = [(f"Concordance was {pd_}% for identical pairs and {pm}% for fraternal pairs, so heredity contributes and environment matters too to the trait.", "Swaps the two rates; identical twins, not fraternal twins, had the higher concordance."),
              (f"Concordance was {pm}% for identical pairs, which is above 50 percent, so being a night owl is entirely determined by heredity.", "A concordance below 100 percent for identical twins shows that environment contributes as well."),
              (f"Concordance was {mz}% for identical pairs and {dz}% for fraternal pairs, so heredity contributes and environment matters too in these data.", "Reports the numbers of pairs as if they were percentages; with this number of pairs the percentages are different.")]
        return _mk("ps_hd_s_twins", "1.1", "3.C", stem, key, f"Each group has {n} pairs, so concordance is the count divided by {n} times 100; identical twins being more alike than fraternal twins suggests heredity, and less than 100 percent suggests environment.", wr, rng,
                   concept="converting twin-pair counts to concordance rates and interpreting heredity and environment", ek="1.1", stim=stim, facts=[f"n={n}", f"mz={mz}", f"dz={dz}", f"rates={pm},{pd_}"],
                   thinking=["Convert each count of concordant pairs to a percentage of the pairs studied", "Compare the identical-twin rate with the fraternal-twin rate to judge a hereditary contribution", "Notice that the identical-twin rate is below 100 percent to judge an environmental contribution and reject swapped or overstated answers"],
                   cond=[("both rates are whole percentages and the identical-twin rate exceeds the fraternal rate by more than 15 points", "table values")])
    raise ValueError("no_data")


def ps_hd_s_relative(rng):
    """전후 인원 수에서 백분율 포인트 변화와 상대 변화를 구분한다(백분율은 정수 인원과 일치)."""
    for _ in range(400):
        n = rng.choice([40, 50, 80, 200])
        a = rng.randint(int(n * 0.1), int(n * 0.3)); b = a + rng.randint(int(n * 0.08), int(n * 0.2))
        pa, pb = 100 * a / n, 100 * b / n
        if abs(pa - round(pa)) > 1e-9 or abs(pb - round(pb)) > 1e-9:
            continue
        pa, pb = int(pa), int(pb); pp = pb - pa; rel = 100 * (pb - pa) / pa
        if abs(rel - round(rel)) > 1e-9 or len({pp, int(round(rel)), pb, b - a}) != 4:
            continue
        rel = int(round(rel)); agree(float(np.diff([pa, pb])[0]), pp, 1e-9, "pp"); agree(100 * (b - a) / a, rel, 1e-9, "rel")
        stim = tbl("Employees who reported high well-being on a survey", ["Time", "Employees surveyed", "Employees reporting high well-being"], [["Before the program", n, a], ["After the program", n, b]])
        stem = "A company surveyed the same number of employees before and after a workplace well-being program. The table shows how many reported high well-being. Which statement correctly describes the change?"
        key = f"The percentage rose by {pp} percentage points, which is a {rel} percent relative increase."
        wr = [(f"The percentage rose by {rel} percentage points, which is a {pp} percent relative increase over the survey before the program.", "Swaps the two measures: the change in points is the difference of the percentages, and the relative change divides it by the starting percentage."),
              (f"The percentage rose by {pp} percent, which is the same as a {pp} percentage point increase from before the program to after it.", "Treats a change in percentage points as a relative percent change; the two are equal only by coincidence."),
              (f"The percentage rose by {b - a} percentage points, because that many more employees reported high well-being after the program.", "Reports the change in the number of employees as if it were percentage points, ignoring the group size.")]
        return _mk("ps_hd_s_relative", "5.2", "3.B", stem, key, f"Each survey included {n} employees, so the percentages are {pa}% and {pb}%; the difference is {pp} points and {pp} divided by {pa} is a {rel} percent relative increase.", wr, rng,
                   concept="distinguishing percentage-point change from relative percent change", ek="5.2", stim=stim, facts=[f"n={n}", f"counts={a},{b}", f"pp={pp}", f"rel={rel}"],
                   thinking=["Convert each count to a percentage of the employees surveyed", "Subtract the percentages to get the change in percentage points", "Divide that change by the starting percentage to get the relative change and reject answers that swap or confuse the two measures"],
                   cond=[("both percentages are whole numbers and the relative change is a whole percent", "table values")])
    raise ValueError("no_data")


def ps_hd_s_twoway(rng):
    """두 요인(학습 방식 x 수면)의 네 조건 합격 인원: 각 요인의 효과를 다른 요인 안에서 따로 비교한다."""
    for _ in range(600):
        n = 40
        sf = rng.randint(31, 37); ss = sf - rng.randint(6, 10); mf = sf - rng.randint(6, 9); ms = min(ss, mf) - rng.randint(5, 9)
        cells = {"sf": sf, "ss": ss, "mf": mf, "ms": ms}
        if ms < 8 or not (sf > ss > ms and sf > mf > ms) or ss == mf:
            continue
        agree(1 if (sf > mf and ss > ms) else 0, 1, 0, "spacing_in_both_sleep")
        agree(1 if (sf > ss and mf > ms) else 0, 1, 0, "sleep_in_both_study")
        stim = tbl("Students who passed a quiz (out of 40 in each group)", ["Study method", "Slept 8 hours", "Slept under 6 hours"], [["Spaced study", sf, ss], ["Massed study", mf, ms]])
        stem = "Researchers randomly assigned 160 students to study by a spaced or a massed method and to sleep either 8 hours or under 6 hours before a quiz, with 40 students in each of the four groups. The table shows how many in each group passed. Which conclusion is best supported?"
        key = f"More passed with spaced study in both sleep conditions ({sf} vs {mf}; {ss} vs {ms}), and more passed after 8 hours of sleep in both study methods."
        wr = [("Only the study method mattered among these students, because the highest number who passed was in a group that used spaced study.", "Compares only the best group; the full-sleep groups also passed more often than the short-sleep groups within each study method."),
              ("Only sleep mattered among these students, because the lowest number who passed was in a group that slept under 6 hours before the quiz.", "Compares only the worst group; spaced study also gave a higher number passing within each sleep condition."),
              ("Spaced study helped only the students who slept 8 hours, because the short-sleep students passed less often than the full-sleep students did.", "Spaced study also gave a higher number passing among the short-sleep students, so its benefit was not limited to full sleep.")]
        return _mk("ps_hd_s_twoway", "1.5", "3.C", stem, key, "Compare the two study methods within each sleep column and the two sleep conditions within each study row; both factors show an advantage in both comparisons.", wr, rng,
                   concept="judging the separate effects of two manipulated variables from a four-group table", ek="1.5", stim=stim, facts=[f"cells={cells}"],
                   thinking=["Compare spaced with massed study within each sleep condition", "Compare 8 hours with under 6 hours within each study method", "Choose the conclusion that holds in both comparisons and reject answers that rely on only the best or worst group"],
                   cond=[("spaced beats massed in both sleep conditions and full sleep beats short sleep in both study methods", "table values")])
    raise ValueError("no_data")


# 단계 C(psych-hard-c): 코드 계산 원형 4 (고정 문장 원형 10 은 psych_p0_hd_d.py 의 STAGE_HD_C)
STAGE_HD_C = ["ps_hd_s_spacing", "ps_hd_s_twins", "ps_hd_s_relative", "ps_hd_s_twoway"]
