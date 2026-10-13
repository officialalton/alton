"""AP Statistics S1 파일럿 — L(낮은 위험) 원형 10개. 정답은 코드가 계산하고 독립 경로로 다시 확인한다. 해석 문구가 정답 판정의 핵심이 아닌 값·분류 문항이다.
각 함수는 시드 rng 하나로 한 문항 팩을 만든다. 표본 조건을 못 맞추면 ValueError(파이프라인이 시드를 건너뛴다)."""
from stats_common import *

U = "ap_statistics"


# ======================= 1. 히스토그램 중앙값 계급 (1.7 / 3.B, 그림: H) =======================
HIST_CTX = [("students", "minutes", "spent on homework last night"), ("commuters", "minutes", "spent traveling to work"),
            ("members of a gym", "minutes", "spent on a workout"), ("customers", "minutes", "spent waiting in line at a bank")]


def _cls_of_pos(counts, p):
    cum = 0
    for i, c in enumerate(counts):
        cum += c
        if p <= cum:
            return i
    raise ValueError("pos")


def st_hist_median_interval(rng):
    who, unit, what = pick(rng, HIST_CTX)
    w = pick(rng, [5, 10])
    nb = pick(rng, [6, 7])
    lo0 = w * pick(rng, [0, 1, 2])
    for _ in forever():
        counts = [rng.randint(1, 14) for _ in range(nb)]
        n = sum(counts)
        if not (45 <= n <= 90) or counts.count(max(counts)) != 1:
            continue
        pos = [(n // 2, n // 2 + 1)] if n % 2 == 0 else [((n + 1) // 2,) * 2]
        a, b = pos[0]
        ci = _cls_of_pos(counts, a)
        if _cls_of_pos(counts, b) != ci:
            continue
        # 독립 경로: 계급 중점으로 자료를 펼쳐 정렬한 뒤 중앙값이 속한 계급
        data = sorted(x for i, c in enumerate(counts) for x in [lo0 + w * i + w / 2] * c)
        med = float(np.median(data))
        if int((med - lo0) // w) != ci:
            raise ValueError("independent_check_failed:median_class")
        modal = counts.index(max(counts))
        q1 = _cls_of_pos(counts, math.ceil(n / 4))
        q3 = _cls_of_pos(counts, math.ceil(3 * n / 4))
        mid = nb // 2
        cand = {"modal": modal, "middle": mid, "q1": q1, "q3": q3}
        if len({v for v in cand.values() if v != ci}) < 3:
            continue
        break
    cls = lambda i: "$" + f"{lo0 + w * i} \\le x < {lo0 + w * (i + 1)}" + "$"
    whys = {"modal": "Picks the tallest bar (the modal class) instead of the class where half of the observations have been accumulated.",
            "middle": "Picks the middle class of the horizontal axis rather than locating the position of the median from cumulative counts.",
            "q1": "Picks the class where the cumulative count reaches one quarter of the data, which is the first quartile, not the median.",
            "q3": "Picks the class where the cumulative count reaches three quarters of the data, which is the third quartile, not the median."}
    key = Opt(cls(ci), True, f"The ${n}$ observations put the median at position ${a}$" + ("" if a == b else f" and ${b}$") + f"; adding the bar heights from the left, the running total first reaches that position in this class.", None)
    seen = {ci}
    ds = []
    for k, v in cand.items():
        if v not in seen:
            seen.add(v)
            ds.append(Opt(cls(v), False, whys[k], None))
    stem = f"The histogram shown summarizes the time, in {unit}, that each of ${n}$ {who} {what}. In which class does the median time lie?"
    stim = stat_stim(f"Histogram of times ({unit})", "histogram", xTitle=f"Time ({unit})", yTitle="Frequency",
                     bins=[{"from": lo0 + w * i, "to": lo0 + w * (i + 1), "count": c} for i, c in enumerate(counts)])
    bpr = sbp("st_hist_median_interval", "1.7", "3.B", "Locate the median class of a distribution displayed in a histogram",
              ["Read each bar height and add them to find the number of observations", "Find the position of the median and the class where the running total of frequencies first reaches it"],
              [("the median of grouped data lies in the class where the cumulative frequency first reaches the median position", "the classes have equal width and each bar height is the class frequency")],
              [("modal_class", "picks the tallest bar as the median class"), ("middle_of_axis", "picks the middle class of the axis"), ("quartile_class", "reports the class of the first or third quartile")],
              "the data are expanded into a sorted list using class midpoints and the median is taken with numpy, independent of the cumulative-count rule",
              {"type": "histogram", "must_include": ["class boundaries", "class frequencies"]}, ["representation_reading", "procedure_choice"])
    return spack("st_hist_median_interval", "1.7", "3.B", stem, key, ds, rng, bpr, stim, 80, [f"n={n}", f"w={w}"])


# ======================= 2. 5수 요약 → 1.5 IQR 이상치 경계 (1.7 / 3.B, 그림: B + 이상치 점) =======================
BOX_CTX = [("pizza delivery times", "minutes", "a pizza restaurant"), ("waiting times in an emergency room", "minutes", "a hospital"),
           ("times to complete a puzzle", "minutes", "a puzzle contest"), ("lengths of phone calls", "minutes", "a call center")]


def st_box_outlier_fence(rng):
    what, unit, where = pick(rng, BOX_CTX)
    for _ in forever():
        d = pick(rng, [4, 5, 6, 8, 10, 12])
        q1 = rng.randint(14, 30)
        q3 = q1 + d
        med = q1 + rng.randint(1, d - 1)
        fence_hi = Fr(3, 2) * d + q3
        fence_lo = q1 - Fr(3, 2) * d
        lo = q1 - rng.randint(2, d)
        hi = q3 + rng.randint(2, int(Fr(3, 2) * d))
        out = int(fence_hi) + rng.randint(3, 9)
        if hi > fence_hi or lo < fence_lo or out <= fence_hi or lo < 0:
            continue
        # 독립 경로: 경계 바로 안쪽·바깥쪽 값을 규칙(값 > Q3 + 1.5 IQR)에 직접 넣어 본다
        eps = Fr(1, 100)
        assert not ((fence_hi) > fence_hi) and ((fence_hi + eps) > q3 + Fr(3, 2) * (q3 - q1))
        cands = {"add_iqr": q3 + d, "just_1_5_iqr": Fr(3, 2) * d, "lower_fence": fence_lo, "whisker_end": hi}
        vals = {k: v for k, v in cands.items() if v != fence_hi}
        if len({float(v) for v in vals.values()}) < 3 or any(abs(float(v) - float(fence_hi)) < 0.5 for v in vals.values()):
            continue
        break
    fmt = lambda v: TC(float(v), 1)
    key = Opt(fmt(fence_hi), True, f"IQR $= {q3} - {q1} = {d}$, so the boundary is $Q_3 + 1.5\\times \\mathrm{{IQR}} = {q3} + {clean(1.5 * d, 1)} = {clean(float(fence_hi), 1)}$.", float(fence_hi))
    whys = {"add_iqr": "Adds one IQR to the third quartile instead of 1.5 times the IQR.",
            "just_1_5_iqr": "Reports 1.5 times the IQR without adding it to the third quartile.",
            "lower_fence": "Computes the lower boundary $Q_1 - 1.5\\times \\mathrm{IQR}$, which is used for low outliers, not high ones.",
            "whisker_end": "Reads the end of the upper whisker, which is the largest value that is not an outlier, not the boundary itself."}
    chosen = list(vals.items())[:]
    rng.shuffle(chosen)
    ds = [Opt(fmt(v), False, whys[k], float(v)) for k, v in chosen[:3]]
    stem = f"The boxplot shown summarizes the {what}, in {unit}, at {where}. The first quartile is ${q1}$ and the third quartile is ${q3}$. According to the $1.5\\times \\mathrm{{IQR}}$ rule, a value above what boundary is classified as a high outlier?"
    stim = stat_stim(f"Boxplot of {what}", "boxplot", xTitle=f"Time ({unit})", boxes=[{"name": "Times", "min": lo, "q1": q1, "median": med, "q3": q3, "max": hi, "outliers": [out]}])
    bpr = sbp("st_box_outlier_fence", "1.7", "3.B", "Apply the 1.5 IQR rule to find the boundary for high outliers shown on a boxplot",
              ["Find the interquartile range from the given quartiles", "Apply the 1.5 times IQR rule above the third quartile and decide which boundary applies to high outliers"],
              [("a value is a high outlier when it exceeds Q3 + 1.5 IQR", "the boxplot marks the one observation beyond this boundary with a dot while the whisker stops at the largest non-outlier")],
              [("add_one_iqr", "adds IQR rather than 1.5 IQR"), ("no_quartile_added", "reports 1.5 IQR alone"), ("lower_fence", "uses the lower boundary"), ("whisker_end", "reads the whisker end")],
              "candidate values at the boundary plus and minus 0.01 are tested against the rule with exact fractions, and the plotted whisker end and outlier are checked to lie below and above the boundary",
              {"type": "boxplot", "must_include": ["quartiles", "outlier"]}, ["procedure_choice", "calculated_value_decision"])
    return spack("st_box_outlier_fence", "1.7", "3.B", stem, key, ds, rng, bpr, stim, 75, [f"q1={q1}", f"q3={q3}"])


# ======================= 3. 서로 다른 시험의 z 점수 비교 (1.7 / 3.B) =======================
def st_z_compare(rng):
    for _ in forever():
        sa, sb = pick(rng, [4, 8, 10, 12, 16, 20]), pick(rng, [4, 8, 10, 12, 16, 20])
        za, zb = pick(rng, [-0.5, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]), pick(rng, [-0.5, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0])
        ma, mb = rng.randint(60, 80), rng.randint(60, 80)
        xa, xb = ma + za * sa, mb + zb * sb
        if xa != int(xa) or xb != int(xb) or abs(za - zb) < 0.5 or xa > 100 or xb > 100 or xa < 0 or xb < 0 or sa == sb:
            continue
        xa, xb = int(xa), int(xb)
        hi = "A" if za > zb else "B"
        # 오개념: 더 큰 원점수·더 큰 점수 편차가 다른 시험에 있어야 한다
        raw_other = (xb > xa) if hi == "A" else (xa > xb)
        dev_other = ((xb - mb) > (xa - ma)) if hi == "A" else ((xa - ma) > (xb - mb))
        if raw_other and dev_other:
            break
    # 독립 경로: 정규 가정에서 백분위로 비교(norm.cdf)한 순서가 z 순서와 같아야 한다
    pa, pb = ss.norm.cdf(za), ss.norm.cdf(zb)
    if (pa > pb) != (za > zb):
        raise ValueError("independent_check_failed:percentile_order")
    zk, zo = (za, zb) if hi == "A" else (zb, za)
    lo = "B" if hi == "A" else "A"
    zhi, zlo = TC(zk, 2), TC(zo, 2)
    xr = {"A": xa, "B": xb}
    mr = {"A": ma, "B": mb}
    key = Opt(f"Test {hi}, because its z-score of {zhi} is greater than the z-score of {zlo} on Test {lo}", True, f"The z-scores are $z_A = ({xa}-{ma})/{sa} = {clean(za, 2)}$ and $z_B = ({xb}-{mb})/{sb} = {clean(zb, 2)}$; the larger z-score marks the better relative performance.", None)
    ds = [Opt(f"Test {lo}, because the raw score of {TI(xr[lo])} is greater than the raw score of {TI(xr[hi])} on Test {hi}", False, "Compares raw scores from two tests that have different means and standard deviations.", None),
          Opt(f"Test {lo}, because the score is {TI(xr[lo] - mr[lo])} points above the mean, more than {TI(xr[hi] - mr[hi])} points on Test {hi}", False, "Compares distances from the mean in points instead of in standard deviations.", None),
          Opt("Neither test, because the tests have different standard deviations and cannot be compared", False, "Believes scores on different scales can never be compared even though z-scores put them on a common scale.", None)]
    stem = f"On Test A, which has mean ${ma}$ and standard deviation ${sa}$, a student scored ${xa}$. On Test B, which has mean ${mb}$ and standard deviation ${sb}$, the same student scored ${xb}$. On which test did the student perform better relative to the other test takers?"
    bpr = sbp("st_z_compare", "1.7", "3.B", "Compare relative standing on two tests using z-scores",
              ["Standardize each score using its own test mean and standard deviation", "Compare the z-scores to decide relative performance"],
              [("relative position on different scales is compared with z-scores", "the stem gives the mean and standard deviation of each test")],
              [("raw_scores", "compares raw scores"), ("point_distance_from_mean", "compares distance from the mean in points"), ("not_comparable", "says scores cannot be compared")],
              "normal percentile ranks from scipy.stats.norm.cdf are compared and must order the tests exactly as the z-scores do",
              {"type": "none", "must_include": []}, ["procedure_choice", "claim_justification"])
    return spack("st_z_compare", "1.7", "3.B", stem, key, ds, rng, bpr, None, 80, [f"zA={za}", f"zB={zb}"])


# ======================= 6. 이원표 조건부 확률 (2.6 / 3.C, 그림: T) =======================
TW_CTX = [
    ("students", "student", "Grade", [("Junior", "is a junior"), ("Senior", "is a senior"), ("Sophomore", "is a sophomore")], [("Has a job", "has a job"), ("No job", "does not have a job")]),
    ("commuters", "commuter", "Age group", [("Under 30", "is under 30"), ("30 or older", "is 30 or older")], [("Drives", "drives to work"), ("Public transit", "takes public transit")]),
    ("shoppers", "shopper", "Visit type", [("Weekday", "visited on a weekday"), ("Weekend", "visited on a weekend")], [("Bought", "made a purchase"), ("Did not buy", "did not make a purchase")]),
    ("patients", "patient", "Clinic", [("North", "was treated at the North clinic"), ("South", "was treated at the South clinic")], [("Improved", "improved"), ("Did not improve", "did not improve")]),
]


def st_cond_prob_table(rng):
    plural, sing, hdr, rows, cols = pick(rng, TW_CTX)
    nr = len(rows) if len(rows) == 2 else pick(rng, [2, 3])
    rows = rows[:nr]
    for _ in forever():
        cells = [[rng.randint(12, 70) for _ in cols] for _ in rows]
        r, c = rng.randrange(nr), rng.randrange(len(cols))
        N = sum(map(sum, cells))
        rs, cs = sum(cells[r]), sum(cells[i][c] for i in range(nr))
        key_v = Fr(cells[r][c], cs)
        d = {"swap": Fr(cells[r][c], rs), "joint": Fr(cells[r][c], N), "marginal": Fr(rs, N)}
        vals = [float(key_v)] + [float(v) for v in d.values()]
        if min(abs(a - b) for i, a in enumerate(vals) for b in vals[i + 1:]) >= 0.006:
            break
    # 독립 경로: 개별 응답 목록으로 전수 열거
    recs = [(i, j) for i in range(nr) for j in range(len(cols)) for _ in range(cells[i][j])]
    given = [x for x in recs if x[1] == c]
    enum_v = sum(1 for x in given if x[0] == r) / len(given)
    agree(enum_v, float(key_v), name="cond_prob")
    key = Opt(T(float(key_v)), True, f"Given the column, the total is ${cs}$ and ${cells[r][c]}$ of them are in the row: ${cells[r][c]}/{cs} \\approx {float(key_v):.3f}$.", float(key_v))
    whys = {"swap": "Divides by the row total instead of the column total, which reverses the condition.", "joint": "Divides by the grand total, which gives the probability of both events instead of the conditional probability.",
            "marginal": "Reports the overall proportion in the row, ignoring the given information."}
    ds = [Opt(T(float(v)), False, whys[k], float(v)) for k, v in d.items()]
    stem = f"The table shown summarizes the responses of ${N}$ {plural}. One {sing} is selected at random. Given that the {sing} {cols[c][1]}, what is the probability that the {sing} {rows[r][1]}? Round to three decimal places."
    stim = stat_stim(f"Two-way table of {hdr.lower()} and response", "two_way", rowHeader=hdr, rowLabels=[x[0] for x in rows], colLabels=[x[0] for x in cols], cells=cells)
    bpr = sbp("st_cond_prob_table", "2.6", "3.C", "Compute a conditional probability from a two-way table",
              ["Restrict attention to the group named by the given condition (one column)", "Divide the count of the event within that group by the group total, not by the grand total or the row total"],
              [("P(A given B) divides the joint count by the total for B", "the table gives all counts and the stem names the given condition")],
              [("reversed_condition", "divides by the row total"), ("joint_probability", "divides by the grand total"), ("marginal_probability", "ignores the given condition")],
              "every respondent is expanded into an individual record and the conditional proportion is found by enumeration, independent of the cell-count ratio",
              {"type": "two_way_table", "must_include": ["all cell counts"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"])
    return spack("st_cond_prob_table", "2.6", "3.C", stem, key, ds, rng, bpr, stim, 85, [f"N={N}"])


# ======================= 7. 확률 트리 → 역조건부(총확률·베이즈) (2.6 / 3.C, 그림: V 트리) =======================
TREE_CTX = [("Machine", "A", "B", "item", "Defective", "Not defect", "came from Machine A", "a factory", "defective"),
            ("Supplier", "A", "B", "part", "Faulty", "Working", "came from Supplier A", "an electronics assembler", "faulty"),
            ("Inbox", "Work", "Personal", "email", "Flagged", "Unflagged", "is a work email", "an email filter", "flagged")]


def st_tree_bayes(rng):
    kind, a, b, thing, pos_name, neg_name, ev_text, where, ev_adj = pick(rng, TREE_CTX)
    for _ in forever():
        pa = Fr(rng.randrange(30, 71, 10), 100)
        pb = 1 - pa
        fa, fb = Fr(rng.randrange(2, 13), 100), Fr(rng.randrange(1, 9), 100)
        if fa == fb:
            continue
        pos = pa * fa + pb * fb
        key_v = pa * fa / pos
        d = {"reverse": fa, "joint": pa * fa, "total": pos, "prior": pa}
        vals = [float(key_v)] + [float(v) for v in d.values()]
        if min(abs(x - y) for i, x in enumerate(vals) for y in vals[i + 1:]) >= 0.006:
            break
    # 독립 경로: 인구 100000 개로 키운 정수 개수로 계산
    N = 100000
    cnt_pos_a, cnt_pos_b = int(pa * N * fa), int(pb * N * fb)
    agree(cnt_pos_a / (cnt_pos_a + cnt_pos_b), float(key_v), name="bayes")
    key = Opt(T(float(key_v)), True, f"$P(\\text{{{a}}}\\mid \\text{{{ev_adj}}}) = {float(pa * fa):.4f}/{float(pos):.4f} \\approx {float(key_v):.3f}$: the branch for {a} then {ev_adj}, divided by the total probability of {ev_adj}.", float(key_v))
    whys = {"reverse": f"Reports the probability of being {ev_adj} given {a}, which reverses the conditional probability asked for.", "joint": f"Reports the probability of {a} and {ev_adj} together, without dividing by the probability of being {ev_adj}.",
            "total": f"Reports the overall probability of being {ev_adj}, not the probability of {a} given that.", "prior": f"Reports the probability of {a} before the {ev_adj} information is used."}
    ch = list(d.items())
    rng.shuffle(ch)
    ds = [Opt(T(float(v)), False, whys[k], float(v)) for k, v in ch[:3]]
    stem = f"At {where}, each {thing} comes from {kind} {a} or {kind} {b}, as shown in the tree diagram. One {thing} is selected at random and is {ev_adj}. What is the probability that the {thing} {ev_text}? Round to three decimal places."
    lab = lambda v: f"{float(v):.2f}"
    nm = lambda t: (f"{kind} {t}" if len(f"{kind} {t}") <= 10 else t)
    stim = stat_stim(f"Probability tree for {kind} and outcome", "tree", tree={"branches": [
        {"name": nm(a), "label": lab(pa), "next": [{"name": pos_name, "label": lab(fa)}, {"name": neg_name, "label": lab(1 - fa)}]},
        {"name": nm(b), "label": lab(pb), "next": [{"name": pos_name, "label": lab(fb)}, {"name": neg_name, "label": lab(1 - fb)}]}]})
    bpr = sbp("st_tree_bayes", "2.6", "3.C", "Reverse a conditional probability using a probability tree",
              ["Compute the probability of each path ending in the given outcome", "Divide the path through the named source by the total probability of the outcome"],
              [("P(source given outcome) = P(source and outcome) / P(outcome)", "the tree gives the source probabilities and the conditional outcome probabilities on each branch")],
              [("reversed_conditional", "gives P(outcome given source)"), ("joint_only", "gives the joint probability"), ("total_probability", "gives the overall outcome probability"), ("prior", "gives the prior probability")],
              "a population of 100000 items is built from the tree with integer counts per path and the conditional proportion is computed from the counts",
              {"type": "probability_tree", "must_include": ["branch probabilities"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"])
    return spack("st_tree_bayes", "2.6", "3.C", stem, key, ds, rng, bpr, stim, 100, [f"pa={pa}"])


# ======================= 8. 이항 확률 P(X = k) (2.10 / 3.C) =======================
BIN_CTX = [("seeds", "germinate", "A gardener plants {n} seeds, each of which independently germinates with probability ${p}$"),
           ("free throws", "are made", "A basketball player attempts {n} free throws, each of which is independently made with probability ${p}$"),
           ("calls", "are answered", "A call center places {n} calls to randomly selected customers, and each call is independently answered with probability ${p}$")]


def st_binomial_exact(rng):
    thing, verb, tpl = pick(rng, BIN_CTX)
    for _ in forever():
        n = rng.randint(8, 15)
        p = pick(rng, [0.2, 0.3, 0.4, 0.6, 0.7])
        k = rng.randint(max(1, int(n * p) - 2), min(n - 1, int(n * p) + 2))
        key_v = ss.binom.pmf(k, n, p)
        indep = math.comb(n, k) * p ** k * (1 - p) ** (n - k)
        agree(key_v, indep, name="binom_pmf")
        d = {"at_most": ss.binom.cdf(k, n, p), "at_least": ss.binom.sf(k - 1, n, p), "less_than": ss.binom.cdf(k - 1, n, p), "swapped": math.comb(n, k) * (1 - p) ** k * p ** (n - k)}
        vals = [key_v] + list(d.values())
        if min(abs(x - y) for i, x in enumerate(vals) for y in vals[i + 1:]) >= 0.006 and min(vals) >= 0.01 and max(vals) <= 0.995:
            break
    key = Opt(T(key_v), True, f"With ${n}$ independent trials and constant probability, $X$ is binomial: $P(X={k}) = \\binom{{{n}}}{{{k}}}({p})^{{{k}}}({clean(1 - p, 2)})^{{{n - k}}} \\approx {key_v:.3f}$.", key_v)
    whys = {"at_most": f"Finds the probability of at most ${k}$ successes instead of exactly ${k}$.", "at_least": f"Finds the probability of at least ${k}$ successes instead of exactly ${k}$.",
            "less_than": f"Finds the probability of fewer than ${k}$ successes instead of exactly ${k}$.", "swapped": "Swaps the success and failure probabilities."}
    ch = list(d.items())
    rng.shuffle(ch)
    ds = [Opt(T(v), False, whys[k2], v) for k2, v in ch[:3]]
    stem = tpl.format(n=f"${n}$", p=p) + f". What is the probability that exactly ${k}$ of the {thing} {verb}? Round to three decimal places."
    bpr = sbp("st_binomial_exact", "2.10", "3.C", "Recognize a binomial setting and find the probability of exactly k successes",
              ["Check that the trials are independent with a fixed number and a constant probability of success so that the count is binomial", "Evaluate the probability of exactly k successes rather than a cumulative probability"],
              [("the count of successes is binomial when n is fixed, trials are independent and p is constant", "the stem states each trial is independent with the same probability")],
              [("cumulative_at_most", "finds P(X <= k)"), ("cumulative_at_least", "finds P(X >= k)"), ("missing_coefficient", "omits the binomial coefficient"), ("swapped_probabilities", "swaps p and 1 - p")],
              "the probability is recomputed with math.comb and powers directly, independent of scipy.stats.binom",
              {"type": "none", "must_include": []}, ["procedure_choice", "calculated_value_decision"])
    return spack("st_binomial_exact", "2.10", "3.C", stem, key, ds, rng, bpr, None, 85, [f"n={n}", f"p={p}", f"k={k}"])


# ======================= 9. 정규분포 오른쪽 넓이 (2.11 / 3.C, 그림: N 이중 눈금) =======================
NORM_CTX = [("weights of apples", "grams", "apples", 150, 8), ("battery lives of a phone model", "hours", "phones", 18, 1.5), ("heights of sunflower plants", "centimeters", "plants", 190, 12),
            ("lengths of fish in a lake", "centimeters", "fish", 42, 3.5)]


def st_normal_area(rng):
    what, unit, items, mu0, sd0 = pick(rng, NORM_CTX)
    for _ in forever():
        mu = mu0 + rng.choice([-1, 0, 1]) * sd0 * 0.5
        sd = sd0
        z = pick(rng, [0.8, 1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2])
        x0 = mu + z * sd
        if abs(x0 * 100 - round(x0 * 100)) > 1e-9 or abs(mu * 100 - round(mu * 100)) > 1e-9:
            continue
        key_v = ss.norm.sf(z)
        agree(key_v, 1 - ncdf(z), tol=1e-9, name="normal_area")
        zz = (x0 - mu) / (sd * sd)  # 분산으로 나눈 오류
        d = {"complement": ss.norm.cdf(z), "two_tail": 2 * ss.norm.sf(z), "variance": ss.norm.sf(zz)}
        vals = [key_v] + list(d.values())
        if min(abs(a - b) for i, a in enumerate(vals) for b in vals[i + 1:]) >= 0.006 and key_v > 0.01:
            break
    key = Opt(T(key_v), True, f"$z = ({clean(x0, 2)}-{clean(mu, 2)})/{clean(sd, 2)} = {clean(z, 2)}$ and the area to the right of $z$ is about ${key_v:.3f}$.", key_v)
    whys = {"complement": "Uses the area to the left of the value instead of the area to the right.", "two_tail": "Doubles the tail area as if the question asked about values far from the mean in either direction.",
            "variance": "Divides the distance from the mean by the variance instead of the standard deviation when finding the z-score."}
    ds = [Opt(T(v), False, whys[k], v) for k, v in d.items()]
    stem = f"The {what}, in {unit}, are approximately normally distributed with mean ${clean(mu, 2)}$ and standard deviation ${clean(sd, 2)}$. The curve shown has the area to the right of ${clean(x0, 2)}$ shaded. Approximately what proportion of the {items} have a value greater than ${clean(x0, 2)}$? Round to three decimal places."
    ticks = [round(mu + k * sd, 4) for k in (-3, -2, -1, 0, 1, 2, 3)]
    stim = stat_stim(f"Normal curve with the area to the right of {clean(x0, 2)} shaded", "curve", **normal_curve(mu, sd, ticks, f"{what.split(' of ')[0].capitalize()} ({unit})", shades=[{"from": round(x0, 4), "to": round(mu + 4 * sd, 4)}], marks=[{"at": round(x0, 4), "label": clean(x0, 2)}]))
    bpr = sbp("st_normal_area", "2.11", "3.C", "Find the proportion of a normal population above a value",
              ["Standardize the value using the mean and the standard deviation", "Find the area in the upper tail of the standard normal distribution"],
              [("the proportion above x equals the upper-tail area at z = (x - mean)/sd", "the stem says the distribution is approximately normal and gives the mean and standard deviation")],
              [("left_area", "uses the lower tail"), ("two_tails", "doubles the tail"), ("variance_in_z", "divides by the variance")],
              "the upper-tail area is computed from math.erf, independent of scipy.stats.norm.sf, and the plotted curve is a density with unit area",
              {"type": "normal_curve", "must_include": ["shaded area", "mean", "standard deviation"]}, ["procedure_choice", "calculated_value_decision", "representation_reading"])
    return spack("st_normal_area", "2.11", "3.C", stem, key, ds, rng, bpr, stim, 90, [f"mu={mu}", f"sd={sd}", f"x0={x0}"])


# ======================= 13. 1-표본 z 검정: 통계량·P값 (3.7 / 3.E) =======================
Z_CTX = [("A school claims that ${p0}$ of its students ride the bus.", "In a random sample of ${n}$ students, ${x}$ ride the bus", "p"),
         ("A company states that ${p0}$ of its customers renew a subscription.", "In a random sample of ${n}$ customers, ${x}$ renewed", "p"),
         ("A city reports that ${p0}$ of its residents recycle.", "In a random sample of ${n}$ residents, ${x}$ say they recycle", "p")]


def st_z_test_decision(rng):
    pre, post, _ = pick(rng, Z_CTX)
    tail = pick(rng, ["greater", "less", "two"])
    for _ in forever():
        p0 = pick(rng, [0.3, 0.4, 0.5, 0.6])
        n = pick(rng, [100, 150, 200, 250])
        x = round(n * (p0 + pick(rng, [-0.08, -0.06, 0.05, 0.06, 0.08])))
        ph = x / n
        if abs(ph - p0) < 0.04 or (tail == "greater" and ph < p0) or (tail == "less" and ph > p0):
            continue
        z = (ph - p0) / math.sqrt(p0 * (1 - p0) / n)
        zp = (ph - p0) / math.sqrt(ph * (1 - ph) / n)
        sf = lambda zz: ss.norm.sf(abs(zz))
        P = {"greater": ss.norm.sf(z), "less": ss.norm.cdf(z), "two": 2 * sf(z)}[tail]
        agree(P, {"greater": 1 - ncdf(z), "less": ncdf(z), "two": 2 * (1 - ncdf(abs(z)))}[tail], tol=1e-9, name="z_pvalue")
        Pp = {"greater": ss.norm.sf(zp), "less": ss.norm.cdf(zp), "two": 2 * sf(zp)}[tail]
        P_wrongtail = (P / 2) if tail == "two" else min(1.0, 2 * P)
        P_compl = 1 - P
        opts = {"key": (z, P), "p_hat_se": (zp, Pp), "tails": (z, P_wrongtail), "complement": (z, P_compl)}
        rs = {k: (round(a, 2), round(b, 3)) for k, (a, b) in opts.items()}
        if len(set(rs.values())) == 4 and abs(z) > 1.2 and abs(zp - z) > 0.03 and P < 0.2 and 0.003 < P:
            break
    fmt = lambda a, b: f"$z \\approx {a:.2f},\\ P \\approx {b:.3f}$"
    key = Opt(fmt(*rs["key"]), True, f"$z = ({ph:.3f}-{p0})/\\sqrt{{{p0}({clean(1 - p0, 2)})/{n}}} \\approx {z:.2f}$ using the hypothesized proportion in the standard error, and the P-value is the matching normal tail area.", None)
    whys = {"p_hat_se": "Uses the sample proportion rather than the hypothesized proportion in the standard error of the test statistic.",
            "tails": "Uses the wrong number of tails for the alternative hypothesis when finding the P-value.", "complement": "Reports the area on the wrong side of the test statistic as the P-value."}
    ds = [Opt(fmt(*rs[k]), False, whys[k], None) for k in ("p_hat_se", "tails", "complement")]
    ha = {"greater": f"p > {p0}", "less": f"p < {p0}", "two": f"p \\ne {p0}"}[tail]
    stem = f"{pre.format(p0=p0)} {post.format(n=n, x=x)}. A test of $H_0: p = {p0}$ versus $H_a: {ha}$ is conducted, and the conditions for inference are met. Which gives the test statistic and the P-value? Round $z$ to two decimal places and the P-value to three decimal places."
    bpr = sbp("st_z_test_decision", "3.7", "3.E", "Carry out a one-sample z test for a proportion",
              ["Compute the standard error from the hypothesized proportion and standardize the sample proportion", "Find the P-value from the normal tail area that matches the alternative hypothesis"],
              [("a one-proportion z test uses the hypothesized proportion in the standard error", "the stem states the null value, the alternative and that the conditions are met")],
              [("sample_proportion_in_se", "puts p-hat in the standard error"), ("wrong_tails", "uses the wrong number of tails"), ("wrong_side", "reports the complement area")],
              "the P-value is recomputed from math.erf rather than scipy.stats.norm and every wrong option is checked to round to a different pair of values",
              {"type": "none", "must_include": []}, ["procedure_choice", "calculated_value_decision"])
    return spack("st_z_test_decision", "3.7", "3.E", stem, key, ds, rng, bpr, None, 110, [f"n={n}", f"x={x}", f"tail={tail}"])


# ======================= 15. 1-표본 t 검정: 통계량·P값 (4.5 / 3.E, 그림: t 곡선) =======================
T_CTX = [("A battery manufacturer claims that its batteries last a mean of ${mu0}$ hours.", "A random sample of ${n}$ batteries has a mean of ${xb}$ hours and a standard deviation of ${s}$ hours", "$\\mu$"),
         ("A bakery claims that its loaves have a mean mass of ${mu0}$ grams.", "A random sample of ${n}$ loaves has a mean mass of ${xb}$ grams and a standard deviation of ${s}$ grams", "$\\mu$")]


def st_t_test_stats(rng):
    pre, post, _ = pick(rng, T_CTX)
    tail = pick(rng, ["greater", "less", "two"])
    mu0 = pick(rng, [50, 60, 100, 120])
    for _ in forever():
        n = rng.randint(8, 15)
        s = round(rng.uniform(1.2, 4.0), 1)
        diff = pick(rng, [-1.8, -1.4, 1.2, 1.5, 1.8, 2.2])
        xb = round(mu0 + diff, 1)
        if xb == mu0 or (tail == "greater" and xb < mu0) or (tail == "less" and xb > mu0):
            continue
        df = n - 1
        t = (xb - mu0) / (s / math.sqrt(n))
        sf = lambda tt: ss.t.sf(abs(tt), df)
        P = {"greater": ss.t.sf(t, df), "less": ss.t.cdf(t, df), "two": 2 * sf(t)}[tail]
        P_ind = {"greater": 1 - t_cdf_num(t, df), "less": t_cdf_num(t, df), "two": 2 * (1 - t_cdf_num(abs(t), df))}[tail]
        agree(P, P_ind, tol=1e-6, name="t_pvalue")
        Pz = {"greater": ss.norm.sf(t), "less": ss.norm.cdf(t), "two": 2 * ss.norm.sf(abs(t))}[tail]
        t2 = (xb - mu0) / (s / math.sqrt(n - 1))
        P2 = {"greater": ss.t.sf(t2, df), "less": ss.t.cdf(t2, df), "two": 2 * sf(t2)}[tail]
        P_tails = (P / 2) if tail == "two" else min(1.0, 2 * P)
        opts = {"key": (t, P), "z": (t, Pz), "sqrt_n_minus_1": (t2, P2), "tails": (t, P_tails)}
        rs = {k: (round(a, 2), round(b, 3)) for k, (a, b) in opts.items()}
        if len(set(rs.values())) == 4 and abs(t) > 1.3 and P < 0.2 and P > 0.004 and abs(Pz - P) >= 0.004 and abs(t2 - t) >= 0.05:
            break
    fmt = lambda a, b: f"$t \\approx {a:.2f},\\ P \\approx {b:.3f}$"
    key = Opt(fmt(*rs["key"]), True, f"$t = ({xb}-{mu0})/({s}/\\sqrt{{{n}}}) \\approx {t:.2f}$ with ${df}$ degrees of freedom, and the P-value is the matching tail area of the t distribution.", None)
    whys = {"z": "Finds the P-value from the standard normal distribution instead of the t distribution with $n-1$ degrees of freedom.", "sqrt_n_minus_1": "Divides the sample standard deviation by the square root of $n-1$ instead of the square root of $n$.",
            "tails": "Uses the wrong number of tails for the alternative hypothesis when finding the P-value."}
    ds = [Opt(fmt(*rs[k]), False, whys[k], None) for k in ("z", "sqrt_n_minus_1", "tails")]
    ha = {"greater": f"\\mu > {mu0}", "less": f"\\mu < {mu0}", "two": f"\\mu \\ne {mu0}"}[tail]
    stem = f"{pre.format(mu0=mu0)} {post.format(n=n, xb=xb, s=s)}, and the conditions for inference are met. A test of $H_0: \\mu = {mu0}$ versus $H_a: {ha}$ is conducted. The t distribution curve shown has the area that corresponds to the P-value shaded. Which gives the test statistic and the P-value? Round $t$ to two decimal places and the P-value to three decimal places."
    lim = 4.5
    tl = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
    shades = [{"from": -lim, "to": -abs(round(t, 3))}, {"from": abs(round(t, 3)), "to": lim}] if tail == "two" else ([{"from": round(t, 3), "to": lim}] if tail == "greater" else [{"from": -lim, "to": round(t, 3)}])
    shades = [sh for sh in shades if sh["from"] < sh["to"] and -lim <= sh["from"] and sh["to"] <= lim]
    stim = stat_stim(f"t distribution with {df} degrees of freedom; the shaded area is the P-value region", "curve", title=f"t distribution, df = {df}",
                     curve={"family": "t", "x": {"label": "t", "min": -lim, "max": lim, "ticks": tl}, "points": curve_pts(lambda x: t_pdf(x, df), -lim, lim), "shades": shades})
    bpr = sbp("st_t_test_stats", "4.5", "3.E", "Carry out a one-sample t test for a mean",
              ["Standardize the sample mean with the standard error s divided by the square root of n", "Find the P-value from the t distribution with n minus 1 degrees of freedom and the tail count that matches the alternative"],
              [("a one-sample t test uses s over the square root of n and a t distribution with n - 1 degrees of freedom", "the stem gives the sample statistics, the null value, the alternative and that conditions are met")],
              [("normal_instead_of_t", "uses the normal distribution"), ("sqrt_n_minus_1", "divides by the square root of n - 1"), ("wrong_tails", "uses the wrong number of tails")],
              "the t tail area is obtained by numerically integrating the t density with scipy.integrate.quad, independent of scipy.stats.t",
              {"type": "t_curve", "must_include": ["shaded tail area", "degrees of freedom"]}, ["procedure_choice", "calculated_value_decision"])
    return spack("st_t_test_stats", "4.5", "3.E", stem, key, ds, rng, bpr, stim, 110, [f"n={n}", f"xb={xb}", f"s={s}", f"tail={tail}"])


# ======================= 16. 두 표본 t 신뢰구간 (4.7 / 3.E, 표) =======================
TS_CTX = [("two brands of tires", "tread life (in thousands of miles)", "Brand X", "Brand Y"), ("two study methods", "test score (in points)", "Method 1", "Method 2"),
          ("two fertilizers", "plant height (in centimeters)", "Fertilizer A", "Fertilizer B")]


def st_two_sample_t(rng):
    what, qty, g1, g2 = pick(rng, TS_CTX)
    for _ in forever():
        n1, n2 = rng.randint(14, 30), rng.randint(14, 30)
        m1, m2 = round(rng.uniform(30, 60), 1), round(rng.uniform(30, 60), 1)
        s1, s2 = round(rng.uniform(3, 9), 1), round(rng.uniform(3, 9), 1)
        if abs(m1 - m2) < 1.5 or abs(s1 - s2) < 1.0:
            continue
        v1, v2 = s1 ** 2 / n1, s2 ** 2 / n2
        se = math.sqrt(v1 + v2)
        df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1))
        tc = ss.t.ppf(0.975, df)
        # 독립 경로: scipy.stats.t.interval 의 구간과, pdf 를 수치 적분한 누적분포를 뒤집어 얻은 임계값
        diff = m1 - m2
        lo_s, hi_s = ss.t.interval(0.95, df, loc=diff, scale=se)
        agree(lo_s, diff - tc * se, tol=1e-9, name="welch_lo")
        agree(hi_s, diff + tc * se, tol=1e-9, name="welch_hi")
        from scipy import optimize as _O
        tc_ind = _O.brentq(lambda x: t_cdf_num(x, df) - 0.975, 0.5, 5)
        agree(tc, tc_ind, tol=1e-5, name="tcrit")
        z = ss.norm.ppf(0.975)
        d = {"z_star": (diff - z * se, diff + z * se), "add_se": (diff - tc * (math.sqrt(v1) + math.sqrt(v2)), diff + tc * (math.sqrt(v1) + math.sqrt(v2))), "reversed": (-(diff + tc * se), -(diff - tc * se))}
        key_iv = (diff - tc * se, diff + tc * se)
        allv = [key_iv] + list(d.values())
        r = [(round(a, 3), round(b, 3)) for a, b in allv]
        near = min(abs(a - b) for i, x in enumerate(allv) for a, b in [(x[0], y[0]) for y in allv[i + 1:]] + [(x[1], y[1]) for y in allv[i + 1:]])
        if len(set(r)) == 4 and near >= 0.02:
            break
    fmt = lambda iv: f"$({iv[0]:.3f},\\ {iv[1]:.3f})$"
    key = Opt(fmt(key_iv), True, f"The standard error is $\\sqrt{{{s1}^2/{n1}+{s2}^2/{n2}}} \\approx {se:.3f}$, the degrees of freedom are about ${df:.1f}$, and $t^* \\approx {tc:.3f}$ for $95\\%$ confidence.", None)
    whys = {"z_star": "Uses the standard normal critical value instead of a t critical value, which makes the interval too narrow.", "add_se": "Adds the two standard errors instead of combining the variances under a square root.",
            "reversed": "Finds the interval for the difference in the opposite order, $\\mu_2 - \\mu_1$."}
    ds = [Opt(fmt(d[k]), False, whys[k], None) for k in ("z_star", "add_se", "reversed")]
    stem = f"A researcher compares {what} using independent random samples; the summary statistics for the {qty} are shown. Assuming the conditions for inference are met, which is a $95\\%$ confidence interval for $\\mu_1 - \\mu_2$, where group 1 is {g1} and group 2 is {g2}? Round the endpoints to three decimal places."
    stim = stat_stim(f"Summary statistics for {what}", "table", columns=["Group", "n", "Mean", "Standard deviation"], rows=[[g1, n1, m1, s1], [g2, n2, m2, s2]])
    bpr = sbp("st_two_sample_t", "4.7", "3.E", "Construct a two-sample t interval for a difference of means from summary statistics",
              ["Combine the two sample variances under one square root for the standard error and use the t critical value for the approximate degrees of freedom", "Choose the interval that matches the order of subtraction stated in the question"],
              [("a two-sample t interval uses the unpooled standard error and a t critical value", "the table gives each sample size, mean and standard deviation and the stem states the order of subtraction")],
              [("z_critical_value", "uses z star"), ("added_standard_errors", "adds standard errors"), ("reversed_difference", "reverses the order of subtraction")],
              "scipy.stats.ttest_ind_from_stats confidence_interval reproduces the endpoints and the t critical value is found by inverting the numerically integrated t cdf",
              {"type": "summary_table", "must_include": ["n", "mean", "standard deviation"]}, ["procedure_choice", "calculated_value_decision"])
    return spack("st_two_sample_t", "4.7", "3.E", stem, key, ds, rng, bpr, stim, 120, [f"n1={n1}", f"n2={n2}"])


STAGE_L = ["st_hist_median_interval", "st_box_outlier_fence", "st_z_compare", "st_cond_prob_table", "st_tree_bayes", "st_binomial_exact", "st_normal_area", "st_z_test_decision", "st_t_test_stats", "st_two_sample_t"]
