"""보강(supplement) FRQ 원형 2군(배치 6): 배치 2 에서 같은 유형의 두 번째 묶음이 근접 중복 게이트(문장 3-gram 유사도 > 0.8)로 반려돼, 유형 자체를 늘린다.
AB 계산기 1(약물 농도 모형 분석), AB 계산기 불가 1(조각 함수 연속·미분 가능). 값은 코드가 계산하고 독립 수치 경로로 다시 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part, f3
from calc_supp_frq import _fr, AB
from scipy import integrate as _I, optimize as _O
from fractions import Fraction as Fr


# ------------------------------------------------------------------ AB 계산기: 약물 농도 모형 C(t) = A t e^{-t/b} 분석(평균값·변화율의 의미·최댓값·기준 이상인 시간 구간)
def frq_model_analysis_calc(rng):
    for _ in range(4000):
        A, b, t1 = rng.choice([20, 30, 40]), rng.choice([2, 3, 4]), rng.choice([1, 2])
        T = 12
        C = lambda u: A * u * math.exp(-u / b)
        Cp = lambda u: A * math.exp(-u / b) * (1 - u / b)
        cmax = A * b / math.e
        k = round(rng.choice([0.5, 0.6, 0.7]) * cmax, 1)
        grid = [T * i / 120000 for i in range(120001)]
        sc = [i for i in range(120000) if (C(grid[i]) - k) * (C(grid[i + 1]) - k) < 0]
        if len(sc) != 2 or C(T) >= k:
            continue
        break
    else:
        raise ValueError("no_sample")
    r1 = _O.brentq(lambda u: C(u) - k, grid[sc[0]], grid[sc[0] + 1], xtol=1e-13)
    r2 = _O.brentq(lambda u: C(u) - k, grid[sc[1]], grid[sc[1] + 1], xtol=1e-13)
    avg = _I.quad(C, 0, T)[0] / T
    dC = Cp(t1)
    # 독립 경로: sympy 기호 적분, 중심차분, 격자
    tt = sp.Symbol("tt")
    avg_s = float(sp.N(sp.integrate(A * tt * sp.exp(-tt / sp.Integer(b)), (tt, 0, T)))) / T
    cd = (C(t1 + 1e-6) - C(t1 - 1e-6)) / 2e-6
    gmax_t = max(grid, key=C)
    if abs(avg_s - avg) > 1e-8 or abs(cd - dC) > 1e-6 or abs(gmax_t - b) > T / 120000 * 2 or abs(grid[sc[0]] - r1) > T / 120000 * 2:
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "Concentration of a drug in the bloodstream", "data": {"model": f"C(t) = {A}t e^(-t/{b}) milligrams per liter, 0 <= t <= {T} hours"}}
    parts = [
        part("a", f"The concentration of a drug in a patient's bloodstream is modeled by $C(t)={A}te^{{-t/{b}}}$ milligrams per liter, where $t$ is the time in hours after the drug is given, for $0\\le t\\le {T}$. Find the average concentration over the first ${T}$ hours.", 2, "calculate", ["1.D", "1.E"],
             f"(1/{T}) ∫₀^{T} C(t) dt = {f3(avg)} milligrams per liter.", [row("a1", 1, f"Integral of C over [0, {T}] divided by {T}", [f"(1/{T}) ∫_0^{T} C(t) dt"]), row("a2", 1, "Answer", [f3(avg)], requires="a1", nums=True, tol="±0.001")]),
        part("b", f"Find $C'({t1})$. Using correct units, explain the meaning of $C'({t1})$ in the context of the problem.", 2, "explain", ["1.E", "3.F"],
             f"C'({t1}) = {f3(dC)}: at t = {t1} hour(s) the concentration is {'increasing' if dC > 0 else 'decreasing'} at about {f3(abs(dC))} milligrams per liter per hour.",
             [row("b1", 1, "Value of C'(t) at the given time", [f3(dC)], nums=True, tol="±0.001"), row("b2", 1, "Interpretation with units: the rate of change of the concentration, in milligrams per liter per hour", ["rate of change of the concentration", "milligrams per liter per hour"], both=True, units=True, requires="b1")]),
        part("c", "At what time $t$ is the concentration greatest? Find the greatest concentration and justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"C'(t) = {A}e^(-t/{b})(1 - t/{b}) = 0 at t = {b}; C' > 0 before and C' < 0 after, so the greatest concentration is C({b}) = {f3(cmax)} milligrams per liter.",
             [row("c1", 1, "Sets C'(t) = 0 and solves, with the sign change of C' as the justification", [f"t = {b}", "C' changes from positive to negative"], nums=True), row("c2", 1, "Greatest concentration value", [f3(cmax)], requires="c1", nums=True, tol="±0.001")]),
        part("d", f"The drug is effective when the concentration is at least ${k:g}$ milligrams per liter. Find the times at which the concentration is exactly ${k:g}$ milligrams per liter, and find the total length of time during $0\\le t\\le {T}$ for which the drug is effective.", 3, "calculate", ["1.E", "3.E"],
             f"C(t) = {k:g} at t = {f3(r1)} and t = {f3(r2)}; the drug is effective for {f3(r2 - r1)} hours.",
             [row("d1", 1, "Equation C(t) = threshold", [f"C(t) = {k:g}"]), row("d2", 1, "Both solutions (calculator)", [f"t = {f3(r1)}", f"t = {f3(r2)}"], requires="d1", nums=True, both=True, tol="±0.001"), row("d3", 1, "Length of the interval of effectiveness: the difference of the solutions, with units", [f"{f3(r2 - r1)} hours"], requires="d2", nums=True, units=True, tol="±0.001")])]
    for p_, tc in zip(parts, [["8.1"], ["4.1"], ["5.5"], ["5.5"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_model_analysis_calc", "template": "model_analysis_calc", "topic": "8.1", "extra_topics": ["4.1", "5.5"], "skill": "1.E", "representative_skill": "1.E", "calculator": "required", "title": "Drug concentration model: average value, meaning of C', greatest concentration, time above a threshold",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"A={A}", f"b={b}", f"k={k}", f"avg={avg:.6f}", f"dC={dC:.6f}", f"r1={r1:.6f}", f"r2={r2:.6f}", f"cmax={cmax:.6f}"]}
    pk["blueprint"] = frq_blueprint("frq_model_analysis_calc", AB, pk, "Analyze a concentration model with a calculator: average value, the meaning of the derivative, the maximum, and the time interval above a threshold",
        ["Average the model with an integral divided by the length", "Differentiate the model and interpret the derivative with units", "Locate the maximum with the sign of the derivative", "Solve C(t) = threshold for both times and subtract"],
        [("C rises to a single maximum at t = b and then falls, so C(t) = threshold has exactly two solutions in [0, T]", "C' changes sign once and C(T) is below the threshold")], {"type": "text", "must_include": ["model formula", "threshold"]},
        "the average is checked with sympy's symbolic integral, the derivative by central difference, and the two crossing times and the maximum by a 120001-point grid (independent of scipy quad and Brent's method)")
    return pk


# ------------------------------------------------------------------ AB 계산기 불가: 조각 함수의 연속·미분 가능·접선·도함수의 평균
def frq_piecewise_diff(rng):
    p = rng.choice([-5, -4, 1, 2, 3])
    q = 2 * p + 4
    r = -p - 3
    # f(x) = x^2 + p x (x <= 1), q sqrt(x) + r (x > 1): 연속이고 미분 가능하도록 설계
    f1, f2 = 1 + p, q + r
    d1, d2 = 2 + p, Fr(q, 2)
    if f1 != f2 or d1 != d2 or q == 0:
        raise ValueError("bad_design")
    f4 = 2 * q + r
    avgd = Fr(f4, 4)
    # 독립 경로: 수치 도함수의 양쪽 극한과 구간 [0, 4] 에서 f' 의 수치 평균
    fx = lambda u: u * u + p * u if u <= 1 else q * math.sqrt(u) + r
    hh = 1e-7
    left = (fx(1) - fx(1 - hh)) / hh
    right = (fx(1 + hh) - fx(1)) / hh
    fp_num = lambda u: (fx(u + 1e-6) - fx(u - 1e-6)) / 2e-6
    mean_fp = _I.quad(fp_num, 0, 4, points=[1], limit=200)[0] / 4
    if abs(left - float(d1)) > 1e-4 or abs(right - float(d2)) > 1e-4 or abs(mean_fp - float(avgd)) > 1e-4:
        raise ValueError("independent_check_failed")
    tang = f"y = {f1} + {_fr(d1)}(x - 1)"
    ptxt = lambda c_: f"+{c_}" if c_ >= 0 else f"{c_}"
    stim = {"kind": "text", "description": "A piecewise defined function", "data": {"definition": f"f(x) = x^2 {ptxt(p)}x for x <= 1; f(x) = {q}sqrt(x) {ptxt(r)} for x > 1"}}
    ftex = f"\\begin{{cases}} x^{{2}}{ptxt(p)}x, & x\\le 1\\\\ {q}\\sqrt{{x}}{ptxt(r)}, & x>1 \\end{{cases}}"
    parts = [
        part("a", f"Let $f$ be the function defined by $f(x)={ftex}$. Show that $f$ is continuous at $x=1$.", 2, "explain", ["3.B", "3.C"],
             f"f(1) = 1 {ptxt(p)} = {f1}; the left limit is {f1}; the right limit is {q}(1) {ptxt(r)} = {f2}; the one-sided limits equal f(1), so f is continuous at x = 1.",
             [row("a1", 1, "Evaluates f(1) and the left-hand limit", [f"f(1) = {f1}", f"left limit = {f1}"], nums=True), row("a2", 1, "Right-hand limit equal to f(1): the condition for continuity is met", [f"right limit = {f2}"], nums=True, requires="a1")]),
        part("b", "Is $f$ differentiable at $x=1$? Justify your answer.", 3, "explain", ["3.B", "3.C", "3.E"],
             f"For x < 1, f'(x) = 2x {ptxt(p)}, so the left derivative at 1 is {d1}; for x > 1, f'(x) = {q}/(2 sqrt x), so the right derivative at 1 is {_fr(d2)}. They are equal and f is continuous, so f is differentiable at x = 1.",
             [row("b1", 1, "Left-hand derivative at x = 1", [f"{d1}"], nums=True), row("b2", 1, "Right-hand derivative at x = 1", [_fr(d2)], nums=True), row("b3", 1, "Justification and conclusion: the one-sided derivatives are equal, so f is differentiable (yes)", ["one-sided derivatives are equal", "yes"], both=True, requires="b2")]),
        part("c", "Write an equation for the line tangent to the curve $y=f(x)$ at $x=1$.", 2, "calculate", ["1.E"], f"The tangent line is {tang}.",
             [row("c1", 1, "Uses the slope f'(1) from part (b)", [_fr(d1)], nums=True), row("c2", 1, "Equation of the tangent line", [tang], requires="c1", nums=True)]),
        part("d", "Find the average value of $f'(x)$ on the interval $0\\le x\\le 4$.", 2, "calculate", ["1.E", "2.B"], f"(1/4) ∫₀⁴ f'(x) dx = (f(4) - f(0))/4 = ({f4} - 0)/4 = {_fr(avgd)}.",
             [row("d1", 1, "Uses the Fundamental Theorem: the integral of f' from 0 to 4 is f(4) - f(0)", ["f(4) - f(0)", f"f(4) = {f4}"], nums=True), row("d2", 1, "Value of the average", [_fr(avgd)], requires="d1", nums=True)])]
    for p_, tc in zip(parts, [["1.11"], ["2.4"], ["2.7"], ["6.7"]]):
        p_["topic_codes"] = tc
    pk = {"archetype": "frq_piecewise_diff", "template": "piecewise_function_differentiability", "topic": "2.4", "extra_topics": ["1.11", "2.7", "6.7"], "skill": "3.B", "representative_skill": "3.B", "calculator": "not_allowed", "title": "Piecewise function: continuity, differentiability, tangent line, average value of the derivative",
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"p={p}", f"q={q}", f"r={r}", f"f(1)={f1}", f"f'(1)={d1}", f"avg={_fr(avgd)}"]}
    pk["blueprint"] = frq_blueprint("frq_piecewise_diff", AB, pk, "Check continuity and differentiability of a piecewise function at the break point, write the tangent line, and use the Fundamental Theorem for the average of the derivative",
        ["Evaluate the one-sided limits and f(1)", "Differentiate each piece and compare the one-sided derivatives", "Write the tangent line from f(1) and f'(1)", "Use f(4) - f(0) for the integral of the derivative"],
        [("the pieces were chosen so that the function is continuous and differentiable at x = 1", "the conditions 1 + p = q + r and 2 + p = q/2 hold by construction")], {"type": "text", "must_include": ["piecewise definition"]},
        "the one-sided difference quotients (step 1e-7) and the numerical average of a central-difference derivative on [0, 4] (independent of the formulas for the derivatives and of the Fundamental Theorem)")
    return pk
