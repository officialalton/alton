"""AP Statistics 연습 시험 5(2026-10-19 추가 라운드) 공유 자료 세트 2개(각 3문항). 단원 2 = 결합 확률표(합집합 · 조건부 확률 · 둘 다 아님), 단원 5 = 산점도의 이상치(잔차 · 연관성 설명 · 이상치 제거의 영향).
기존 공개 세트와 연습 시험 3·4 세트의 틀(분포 표, 정규곡선, 회귀 출력, 자료표, 모형 비교)과 다르다. 세트의 세 문항은 서로의 정답에 의존하지 않는다. 모든 수·통계량은 $...$ 안."""
from stats_r19 import *  # noqa: F401,F403
from stats_r19 import mc


def _member(arch, j, topic, skill, concept, steps, key, wrongs, rng, stem, how, judgment, est=85, facts=None, sig=None):
    p = mc(f"{arch}_q{j}", topic, skill, concept, steps, key, wrongs, rng, stem, how, judgment, None, None, est, facts, None, sig)
    p.pop("stimulus", None)
    return p


def _set_pack(arch, intro, stim, members, facts):
    return {"archetype": arch, "topic": members[0]["topic"], "skill": members[0]["skill"], "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": members,
            "set_size": len(members), "est_seconds": sum(m["est_seconds"] for m in members), "facts": facts}


# ======================= 세트 A (단원 2): 결합 확률표 =======================
JP_CTX = [dict(sc="A store records how a randomly selected customer shops and whether the customer uses a coupon.", rows=("Shops online", "Shops in store"), cols=("Uses a coupon", "Uses no coupon"), A="shops online", B="uses a coupon"),
          dict(sc="A school records the grade level of a randomly selected student and whether the student plays a sport.", rows=("Grade 9", "Grade 10"), cols=("Plays a sport", "Plays no sport"), A="is in grade 9", B="plays a sport"),
          dict(sc="A clinic records the age group of a randomly selected patient and whether the patient has a flu shot.", rows=("Under 40", "40 or older"), cols=("Has a flu shot", "Has no flu shot"), A="is under 40", B="has a flu shot")]


def st_set_joint_table(rng):
    c = pick(rng, JP_CTX)
    for _ in forever():
        raw = [rng.randint(8, 40) for _ in range(4)]; tot = sum(raw); pr = [round(v / tot, 2) for v in raw]; pr[3] = round(1 - sum(pr[:3]), 2)
        pAB, pAnB, pnAB, pnAnB = pr
        pA = pAB + pAnB; pB = pAB + pnAB; union = pA + pB - pAB; cond = pAB / pA; neither = 1 - union
        v1 = [union, pA + pB, pAB, 1 - pAB]; v2 = [cond, pAB / pB, pAB, pB]; v3 = [neither, union, 1 - pA - pB, 1 - pAB]
        if min(pr) >= 0.05 and abs(sum(pr) - 1) < 1e-9 and gaps_ok([round(v, 3) for v in v1], 0.03) and gaps_ok([round(v, 3) for v in v2], 0.03) and gaps_ok([round(v, 3) for v in v3], 0.03) and pA + pB < 1.15:
            break
    stim = stat_stim("Joint probabilities", "table", title="Joint probability table", columns=["", c["cols"][0], c["cols"][1], "Total"], rows=[[c["rows"][0], f"{pAB:.2f}", f"{pAnB:.2f}", f"{pA:.2f}"], [c["rows"][1], f"{pnAB:.2f}", f"{pnAnB:.2f}", f"{pnAB + pnAnB:.2f}"], ["Total", f"{pB:.2f}", f"{pnAnB + pAnB:.2f}", "1.00"]])
    intro = f"{c['sc']} The table shown gives the probability of each combination. Let $A$ be the event that the selected individual {c['A']}, and let $B$ be the event that the individual {c['B']}."
    f3 = lambda v: f"${v:.3f}$"
    key1 = (f3(union), f"$P(A \\text{{ or }} B) = P(A) + P(B) - P(A \\text{{ and }} B) = {pA:.2f} + {pB:.2f} - {pAB:.2f} = {union:.3f}$.", round(union, 3))
    wr1 = [(f3(pA + pB), "Adds $P(A)$ and $P(B)$ without subtracting $P(A \\text{ and } B)$, which counts the overlap twice.", "overlap_counted_twice", round(pA + pB, 3), 1), (f3(pAB), "Gives $P(A \\text{ and } B)$, the probability that both events occur, instead of at least one.", "both_not_either", round(pAB, 3), 1), (f3(1 - pAB), "Gives the probability that the two events do not both occur, which is not the probability of at least one.", "not_both", round(1 - pAB, 3), 2)]
    m1 = _member("st_set_joint_table", 1, "2.4", "3.C", "Find the probability that at least one of two events occurs from a joint probability table", ["Read $P(A)$, $P(B)$ and $P(A \\text{ and } B)$ from the table", "Apply the addition rule with the overlap subtracted"], key1, wr1, rng, "What is $P(A \\text{ or } B)$? (Give the answer as a decimal rounded to three decimal places.)", "the union probability is recomputed from the addition rule and from the table cells", ["procedure_choice", "calculated_value_decision", "representation_reading"], 85, [f"pAB={pAB}"],
                 sig=(["addition rule", "reading a joint table"], 1, "light"))
    key2 = (f3(cond), f"$P(B \\mid A) = P(A \\text{{ and }} B)/P(A) = {pAB:.2f}/{pA:.2f} = {cond:.3f}$.", round(cond, 3))
    wr2 = [(f3(pAB / pB), "Divides by $P(B)$ instead of by $P(A)$, which gives $P(A \\mid B)$.", "reversed_conditional", round(pAB / pB, 3), 1), (f3(pAB), "Gives the joint probability without dividing by the probability of the given event.", "joint_not_conditional", round(pAB, 3), 1), (f3(pB), "Gives the unconditional probability $P(B)$, which ignores the given event.", "ignores_condition", round(pB, 3), 2)]
    m2 = _member("st_set_joint_table", 2, "2.6", "3.C", "Find a conditional probability from a joint probability table", ["Identify the given event and read the joint probability and the probability of the given event", "Divide the joint probability by the probability of the given event"], key2, wr2, rng, "What is $P(B \\mid A)$, the probability that $B$ occurs given that $A$ occurs? (Give the answer as a decimal rounded to three decimal places.)", "the conditional probability is recomputed from the joint probability and the marginal probability", ["procedure_choice", "calculated_value_decision", "representation_reading"], 85, [f"cond={cond:.3f}"])
    key3 = (f3(neither), f"The probability of at least one of $A$ and $B$ is ${union:.3f}$, so the probability that neither occurs is $1 - {union:.3f} = {neither:.3f}$, which is also the table entry for 'not $A$ and not $B$'.", round(neither, 3))
    wr3 = [(f3(union), "Gives the probability that at least one event occurs instead of the probability that neither occurs.", "union_not_neither", round(union, 3), 1), (f3(1 - pA - pB), "Subtracts $P(A)$ and $P(B)$ from $1$ without adding back the overlap, which removes the overlap twice.", "overlap_removed_twice", round(1 - pA - pB, 3), 2), (f3(1 - pAB), "Gives the probability that the two events do not both occur, which is larger than the probability that neither occurs.", "not_both", round(1 - pAB, 3), 2)]
    m3 = _member("st_set_joint_table", 3, "2.7", "3.C", "Find the probability that neither of two events occurs from a joint probability table", ["Find the probability that at least one event occurs", "Take the complement to find the probability that neither occurs"], key3, wr3, rng, "What is the probability that neither $A$ nor $B$ occurs? (Give the answer as a decimal rounded to three decimal places.)", "the probability is recomputed as the complement of the union and compared with the table cell for neither", ["procedure_choice", "calculated_value_decision", "representation_reading"], 90, [f"neither={neither:.3f}"],
                 sig=(["addition rule", "complement rule"], 1, "light"))
    return _set_pack("st_set_joint_table", intro, stim, [m1, m2, m3], [f"pr={pr}"])


# ======================= 세트 B (단원 5): 산점도의 이상치 =======================
SO_CTX = [dict(intro="A manager records the number of hours that each of ten employees trained and the number of errors that each made in a week.", x="Hours of training", y="Errors in a week", xr=(2, 14), a=16.0, b=-1.0, xu="hours", yu="errors", xd="training time", yd="number of errors", sub="employee"),
          dict(intro="A scientist records the temperature of ten rooms of a building and the number of minutes that a sample of ice needs to melt in each room.", x="Temperature (degrees Celsius)", y="Melting time (minutes)", xr=(12, 30), a=60.0, b=-1.8, xu="degrees Celsius", yu="minutes", xd="temperature", yd="melting time", sub="room")]


def st_set_scatter_outlier(rng):
    c = pick(rng, SO_CTX)
    gen = np.random.default_rng(rng.randrange(10 ** 9))
    for _ in forever():
        xs = np.sort(np.round(gen.uniform(c["xr"][0], c["xr"][1], 9), 0))
        if len(set(xs)) < 9:
            continue
        ys = np.round(c["a"] + c["b"] * xs + gen.normal(0, abs(c["b"]) * 0.8, 9), 1)
        k = 4; xk = float(xs[k]); yk = round(c["a"] + c["b"] * xk + rng.choice([-1, 1]) * abs(c["b"]) * (c["xr"][1] - c["xr"][0]) * 0.55, 1)
        X = np.insert(np.delete(xs, k), 4, xk); Y = np.insert(np.delete(ys, k), 4, yk)
        # 이상치 하나를 포함한 10개 점: 9개 + 이상치
        X = np.append(xs, xk + 0.0); Y = np.append(ys, yk)
        b_all, a_all = np.polyfit(X, Y, 1); r_all = float(np.corrcoef(X, Y)[0, 1]); b_wo, a_wo = np.polyfit(xs, ys, 1); r_wo = float(np.corrcoef(xs, ys)[0, 1])
        if abs(abs(r_wo) - abs(r_all)) >= 0.06 and abs(abs(b_wo) - abs(b_all)) / abs(b_all) < 0.12 and abs(r_wo) > abs(r_all) and abs(round(float(a_all), 2) + round(float(b_all), 2) * xk - yk) > 0.5:
            break
    sxx = ((X - X.mean()) ** 2).sum(); sxy = ((X - X.mean()) * (Y - Y.mean())).sum(); agree(sxy / sxx, b_all, tol=1e-8, name="slope")
    ar, br = round(float(a_all), 2), round(float(b_all), 2); rr = round(r_all, 2)
    sgn = "+" if br >= 0 else "-"
    n = len(X)
    stim = stat_stim(f"Scatterplot of {c['yd']} versus {c['xd']}", "scatter", title=f"{c['yd'].capitalize()} versus {c['xd']}", xTitle=c["x"], yTitle=c["y"], points=[[float(a), float(b)] for a, b in zip(X, Y)], fitLine={"slope": br, "intercept": ar}, highlights=[{"index": n - 1}])
    intro = f"{c['intro']} The scatterplot shown displays the data, with the least-squares line $\\hat{{y}} = {ar:g} {sgn} {abs(br):g}x$ for all ${n}$ observations and $r = {rr}$. One {c['sub']} is highlighted: its {c['xd']} is ${xk:g}$ {c['xu']} and its {c['yd']} is ${yk:g}$ {c['yu']}."
    fm2 = lambda v: f"${v:.2f}$ {c['yu']}"
    yh = ar + br * xk; res = yk - yh
    vals = [res, -res, yk - br * xk, yh]
    if not gaps_ok([round(v, 2) for v in vals], 0.08) or abs((abs(res) * 100) % 1 - 0.5) < 0.12:
        raise ValueError("close")
    key1 = (fm2(res), f"The residual is the actual value minus the predicted value: ${yk:g} - ({yh:.2f}) = {res:.2f}$.", round(res, 2))
    wr1 = [(fm2(-res), "Subtracts in the wrong order; the residual is the actual value minus the predicted value.", "sign_reversed", round(-res, 2), 1), (fm2(yk - br * xk), "Leaves the intercept out of the predicted value before subtracting.", "intercept_left_out", round(yk - br * xk, 2), 2), (fm2(yh), "Reports the predicted value instead of the residual.", "prediction_not_residual", round(yh, 2), 2)]
    m1 = _member("st_set_scatter_outlier", 1, "5.4", "3.B", "Calculate the residual of the highlighted point from the given line", ["Find the predicted value from the line at the highlighted value of x", "Subtract the predicted value from the actual value"], key1, wr1, rng, "What is the residual of the highlighted observation? (Use the given line and round to two decimal places.)", "the predicted value and the residual are recomputed from the given coefficients and the stated coordinates", ["procedure_choice", "calculated_value_decision", "representation_reading"], 90, [f"xk={xk}"],
                 sig=(["predicted value from a line", "residual as actual minus predicted"], 1, "light"))
    dirn = "negative" if r_all < 0 else "positive"; opp = "positive" if r_all < 0 else "negative"
    key2 = (f"There is a moderately strong {dirn} linear association, and the highlighted observation is an outlier that lies far from the pattern of the other observations.", f"The points trend in the {dirn} direction along a line with $r = {rr}$, and the highlighted point lies far above or below the line.")
    wr2 = [(f"There is a moderately strong {opp} linear association, and the highlighted observation is an outlier that lies far from the pattern of the other observations.", "Gives the wrong direction: the points trend the other way as the horizontal variable increases.", "direction_reversed", None, 1), (f"There is a moderately strong {dirn} linear association with no unusual observations.", "The highlighted observation lies far from the pattern of the others, so it is an unusual observation.", "outlier_missed", None, 1), (f"There is a curved association, and the highlighted observation is the point where the curve bends.", "The other points follow a straight-line pattern with no bend; the highlighted point is an outlier.", "curved_form", None, 2)]
    m2 = _member("st_set_scatter_outlier", 2, "5.1", "4.A", "Describe the association in a scatterplot and recognize an unusual observation", ["Read the direction and the form of the pattern of the points", "Notice the observation that lies far from the pattern and include it in the description"], key2, wr2, rng, "Which of the following best describes the association in the scatterplot?", "the direction follows the sign of the correlation and the outlier lies at least 0.55 times the range of the trend away from the line", ["representation_reading", "interpretation"], 90, [f"r={rr}"])
    ra = "increase" if abs(r_wo) > abs(r_all) else "decrease"
    combos = [(a_, b_) for a_ in ("increase", "decrease") for b_ in ("change a lot", "change very little")]
    desc = lambda a_, b_: f"The correlation would {a_} in strength and the slope would {b_}."
    truth = (ra, "change very little")
    key3 = (desc(*truth), f"Without the highlighted point $|r|$ changes from ${abs(r_all):.2f}$ to ${abs(r_wo):.2f}$, while the slope changes from ${br:g}$ to ${b_wo:.2f}$, a change of only about ${abs(abs(b_wo) - abs(b_all)) / abs(b_all) * 100:.0f}\\%$.")
    def why3(a_, b_):
        parts_ = []
        if a_ != truth[0]:
            parts_.append(f"the strength of the correlation goes from $|r| = {abs(r_all):.2f}$ to ${abs(r_wo):.2f}$, which is an {truth[0]}, not a {a_}")
        if b_ != truth[1]:
            parts_.append(f"the slope goes from ${br:g}$ to ${b_wo:.2f}$, a change of only about ${abs(abs(b_wo) - abs(b_all)) / abs(b_all) * 100:.0f}\\%$, because the highlighted point is near the middle of the values of $x$ and has little leverage")
        return "Does not match the recalculated values: " + " and ".join(parts_) + "."
    wr3 = [(desc(a_, b_), why3(a_, b_), f"change_{a_}_{b_.split()[1]}", None, 1 + i % 2) for i, (a_, b_) in enumerate([x for x in combos if x != truth])]
    m3 = _member("st_set_scatter_outlier", 3, "5.2", "4.D", "Judge how removing an outlier with little leverage changes the correlation and the slope", ["Notice that the highlighted point is far from the line but near the middle of the values of x", "Decide that removing it strengthens the correlation but leaves the slope almost unchanged and match both to one option"], key3, wr3, rng, "The highlighted observation is removed, and the least-squares line and the correlation are recalculated from the other observations. Which of the following describes the change?", "the line and correlation are recomputed with and without the highlighted point and the slope changes by under 12 percent while the correlation strengthens by at least 0.06", ["interpretation", "claim_justification", "representation_reading"], 110, [f"ra={ra}"],
                 sig=(["an outlier in the data", "leverage and influence"], 1, "none"))
    return _set_pack("st_set_scatter_outlier", intro, stim, [m1, m2, m3], [f"a={ar}", f"b={br}", f"r={rr}"])


STAGE_SETS = ["st_set_joint_table", "st_set_scatter_outlier"]

# P5 세트 런에서 반려된 산점도 이상치 세트(난이도 신호 개념 이름)를 고쳐 다시 돌린다
STAGE_FIXSETS = ["st_set_scatter_outlier"]
