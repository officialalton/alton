"""예비 3차(R3) AB FRQ(계산기 불가) 원형: 기존 유형과 질문·파트 골격이 다른 6종.
 1 초깃값이 있는 도함수 공식 → 접선 근사·오목성 판정·치환 적분·닫힌 구간 절대 극값
 2 모수가 있는 유리함수: 임계점 조건으로 상수 결정 → 극한 → 전역 극값 정당화 → 해의 개수
 3 지수 감쇠 미분방정식: 분리 풀이 → 반감기로 k → 남은 양 시점 → 평균값
 4 벽에 붙인 칸막이 우리 비용 최소화(제약 → 비용 함수 → 임계점 → 2계 도함수 정당화)
 5 극한·연속 묶음(로피탈 0/0, 연속이 되는 값, 두 번 적용, 무한대 극한과 수평 점근선)
 6 역함수 도함수 표: 역함수 도함수, 곱의 미분, 접선 근사, 치환 적분(FTC)
모든 값은 정확 유리수·sympy 로 계산하고, 독립 수치 경로(적분 구적법·중심차분·격자·고정밀 mpmath)로 다시 확인한다."""
from common import *
from bp import frq_blueprint
from calc_ab_frq import row, part
from calc_supp_frq import AB
from scipy import integrate as _I, interpolate as _P, optimize as _O
from fractions import Fraction as Fr
import mpmath as _mp

STAGE_LISTS = {"supp_r3fb_ab": ["frq_ivp_antiderivative", "frq_rational_param", "frq_exp_decay_de", "frq_pen_cost", "frq_limits_continuity", "frq_inverse_table"]}

X = sp.Symbol("x")


def _T(e):
    """sympy 식 또는 정수/유리수를 $...$ TeX 로."""
    return "$" + sp.latex(sp.nsimplify(e) if isinstance(e, (int, Fr)) else e) + "$"


def _R(v):
    return sp.Rational(v.numerator, v.denominator) if isinstance(v, Fr) else sp.Rational(v)


def _pack(name, template, topic, extra, skill, title, stim, parts, topic_codes, facts, concept, thinking, conds, material, indep):
    for p_, tc in zip(parts, topic_codes):
        p_["topic_codes"] = tc
    pk = {"archetype": name, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "not_allowed", "title": title,
          "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": facts}
    pk["blueprint"] = frq_blueprint(name, AB, pk, concept, thinking, conds, material, indep)
    # sympy.latex 의 \log{\left(2 \right)} 를 \ln 2 로(학생·채점 문장의 표기 일관성)
    import json as _json, re as _re
    s = _json.dumps(pk)
    s = _re.sub(r"\\\\log\{\\\\left\(([^{}]*?) \\\\right\)\}", lambda m: "\\\\ln " + m.group(1), s)
    return _json.loads(s)


# ------------------------------------------------------------------ 1. 도함수 공식 + 초깃값: 접선 근사, 오목성, 치환 적분, 닫힌 구간 극값
def frq_ivp_antiderivative(rng):
    c = rng.choice([2, 4, 6, -2, -4, -6])
    f1 = rng.choice([-3, -2, 1, 2, 3, 4, 5])
    e = sp.E
    fp = c * X * sp.exp(-X ** 2)
    F = f1 + sp.Rational(c, 2) * (sp.exp(-1) - sp.exp(-X ** 2))
    if sp.simplify(sp.diff(F, X) - fp) != 0 or F.subs(X, 1) != f1:
        raise ValueError("bad_design")
    slope = fp.subs(X, 1)
    approx = f1 + sp.Rational(1, 2) * slope
    fpp = sp.diff(fp, X)
    over = c > 0   # f''=c e^{-x^2}(1-2x^2): 구간 [1,3/2] 에서 1-2x^2<0 → c>0 이면 위로 볼록(오목 아래) → 접선은 과대
    f0, fm1, f2 = F.subs(X, 0), F.subs(X, -1), F.subs(X, 2)
    vals = {"x=-1": fm1, "x=0": f0, "x=2": f2}
    # 독립 경로: 수치 적분 F, 격자 극값, 중심차분 f''
    Fn = lambda u: f1 + _I.quad(lambda s: c * s * math.exp(-s * s), 1, u)[0]
    fx = sp.lambdify(X, F, "math")
    grid = [-1 + 3 * i / 30000 for i in range(30001)]
    gmax = max(grid, key=fx)
    gmin = min(grid, key=fx)
    chk_over = all((c * (-(2 * s * s - 1)) * math.exp(-s * s) < 0) == over for s in [1 + i / 100 for i in range(51)])
    tan_val = f1 + 0.5 * c * math.exp(-1)
    exact_15 = fx(1.5)
    h = 1e-4
    fpp_num = (c * (1 + h) * math.exp(-(1 + h) ** 2) - c * (1 - h) * math.exp(-(1 - h) ** 2)) / (2 * h)
    if (tan_val > exact_15) != over or abs(Fn(0) - float(f0)) > 1e-8 or abs(Fn(2) - float(f2)) > 1e-8 or abs(Fn(-1) - f1) > 1e-8 or not chk_over \
            or abs(fpp_num - float(fpp.subs(X, 1))) > 1e-5 or abs(tan_val - float(approx)) > 1e-12:
        raise ValueError("independent_check_failed")
    if c > 0:
        amax_x, amin_x, amax, amin = 2, 0, f2, f0
    else:
        amax_x, amin_x, amax, amin = 0, 2, f0, f2
    if abs(gmax - amax_x) > 2e-3 or abs(gmin - amin_x) > 2e-3:
        raise ValueError("independent_check_failed")
    # f(-1)=f1 is neither extreme (strictly between): c>0: f(-1) = f1 > f0 and < f2
    fprime_tex = f"{c}xe^{{-x^2}}"
    tl = f"y={f1}{'+' if c > 0 else '-'}{sp.latex(abs(slope))}(x-1)"
    parts = [
        part("a", f"A function $f$ satisfies $f'(x)={fprime_tex}$ for all real $x$, and $f(1)={f1}$. Write an equation for the line tangent to the curve $y=f(x)$ at $x=1$, and use it to approximate $f\\left(\\frac32\\right)$.", 2, "calculate", ["1.E", "1.F"],
             f"$f'(1)={sp.latex(slope)}$, so the tangent line is ${tl}$ and $f(3/2)\\approx {sp.latex(approx)}$.",
             [row("a1", 1, "Slope of the tangent line from the given derivative at the point", [f"$f'(1)={sp.latex(slope)}$"], nums=True),
              row("a2", 1, "Tangent line equation and the approximation value", [f"${tl}$", f"$f(3/2)\\approx {sp.latex(approx)}$"], requires="a1", nums=True)]),
        part("b", "Is the approximation from part (a) an overestimate or an underestimate of $f\\left(\\frac32\\right)$? Give a reason for your answer.", 2, "explain", ["1.F", "3.E"],
             f"$f''(x)={sp.latex(sp.simplify(fpp))}$; for $1\\le x\\le \\frac32$, $1-2x^2<0$, so $f''$ is {'negative' if over else 'positive'} and the curve is concave {'down' if over else 'up'} there; the tangent line lies {'above' if over else 'below'} the curve, so the approximation is an {'overestimate' if over else 'underestimate'}.",
             [row("b1", 1, "Second derivative of $f$ obtained by differentiating the given $f'$", [f"$f''(x)={sp.latex(sp.simplify(fpp))}$"]),
              row("b2", 1, "Reason from the sign of the second derivative (concavity) on the interval, with the conclusion", [f"$f''$ is {'negative' if over else 'positive'} on $[1,3/2]$", "overestimate" if over else "underestimate"], both=True, requires="b1")]),
        part("c", "Find $f(x)$.", 3, "calculate", ["1.D", "1.E"],
             f"With $u=-x^2$, $\\int {fprime_tex}\\,dx={sp.latex(sp.Rational(-c, 2))}e^{{-x^2}}+C$; $f(1)={f1}$ gives $C={sp.latex(f1 + sp.Rational(c, 2) * sp.exp(-1))}$, so $f(x)={sp.latex(F)}$.",
             [row("c1", 1, "Antiderivative by substitution of the inner exponent", [f"$\\int {fprime_tex}\\,dx={sp.latex(sp.Rational(-c, 2))}e^{{-x^2}}+C$"]),
              row("c2", 1, "Uses the condition to find the constant", [f"$f(1)={f1}$"], requires="c1", nums=True),
              row("c3", 1, "Final expression for $f(x)$", [f"$f(x)={sp.latex(F)}$"], requires="c2", nums=True)]),
        part("d", "On the closed interval $-1\\le x\\le 2$, find the $x$-coordinates of the absolute maximum and of the absolute minimum of $f$. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"$f'(x)={fprime_tex}=0$ only at $x=0$, where $f'$ changes from {'negative to positive' if c > 0 else 'positive to negative'}. Candidates: $f(-1)={sp.latex(fm1)}$, $f(0)={sp.latex(f0)}$, $f(2)={sp.latex(f2)}$. The absolute maximum is at $x={amax_x}$ and the absolute minimum is at $x={amin_x}$.",
             [row("d1", 1, "Critical point $x=0$ from $f'(x)=0$ and the candidates list including both endpoints", ["$x=0$", f"$f(-1)={sp.latex(fm1)}$", f"$f(2)={sp.latex(f2)}$"], nums=True),
              row("d2", 1, "Comparison of candidate values with the conclusion for the absolute maximum and minimum, with the reason", [f"maximum at $x={amax_x}$", f"minimum at $x={amin_x}$"], both=True, nums=True, requires="d1")])]
    stim = {"kind": "text", "description": "A function given by its derivative and one value", "data": {"fprime": f"f'(x) = {c} x e^(-x^2)", "condition": f"f(1) = {f1}"}}
    return _pack("frq_ivp_antiderivative", "derivative_formula_initial_value", "4.6", ["5.6", "6.9", "5.5"], "1.E", "A function defined by its derivative: tangent approximation, concavity, substitution, absolute extrema", stim, parts,
                 [["4.6"], ["5.6"], ["6.9"], ["5.5"]], [f"c={c}", f"f1={f1}", f"approx={approx}", f"over={over}", f"fm1={fm1}", f"f0={f0}", f"f2={f2}"],
                 "Start from a derivative formula and one value: tangent-line approximation with a concavity reason, antiderivative by substitution, absolute extrema on a closed interval",
                 ["Evaluate f' at the point for the slope", "Differentiate f' to see the concavity on the interval", "Integrate f' by substitution and use the value to fix the constant", "Apply the candidates test with the endpoints"],
                 [("f''(x) has one sign on [1, 3/2] because 1 - 2x^2 < 0 there", "the tangent line lies on one side of a concave curve"), ("f' vanishes only at x = 0 on [-1, 2]", "the candidates are -1, 0, 2")], {"type": "text", "must_include": ["derivative formula", "initial value"]},
                 "f is rebuilt by numerical quadrature of f' from 1 and compared at x = -1, 0, 2; the extremes by a 30001-point grid scan; the sign of f'' by sampling; f'' by central difference; the approximation compared with the numerical f(3/2)")


# ------------------------------------------------------------------ 2. 모수 유리함수: 임계점 조건으로 상수 결정, 극한, 전역 극값 정당화, f(x)=k 의 해의 개수
def frq_rational_param(rng):
    p = rng.choice([1, 2, 3])
    q = rng.choice([1, 2, 3, 4, 5])
    A, B = 2 * p * q, p * p
    f = A * X / (X ** 2 + B)
    fp = sp.simplify(sp.diff(f, X))
    if sp.simplify(fp - A * (B - X ** 2) / (X ** 2 + B) ** 2) != 0 or f.subs(X, p) != q:
        raise ValueError("bad_design")
    # 독립 경로: 격자 전역 극값, 해의 개수(부호 변화 수), 큰 x 에서 값, 중심차분 f'
    fx = sp.lambdify(X, f, "math")
    import numpy as _np
    N = 400000
    grid = _np.linspace(-400.0, 400.0, N + 1)
    gv = A * grid / (grid ** 2 + B)
    imax, imin = int(_np.argmax(gv)), int(_np.argmin(gv))
    if abs(grid[imax] - p) > 0.01 or abs(grid[imin] + p) > 0.01 or abs(gv[imax] - q) > 1e-6 or abs(gv[imin] + q) > 1e-6:
        raise ValueError("independent_check_failed")
    cnt = lambda k_: int(_np.sum((gv[:-1] - k_) * (gv[1:] - k_) < 0))
    if cnt(q / 2) != 2 or cnt(-q / 2) != 2 or cnt(q * 1.01) != 0 or cnt(-q * 1.01) != 0 or cnt(q * 0.999) != 2:
        raise ValueError("independent_check_failed")
    h = 1e-6
    if abs((fx(p + 0.3 + h) - fx(p + 0.3 - h)) / (2 * h) - float(fp.subs(X, sp.Rational(3, 10) + p))) > 1e-6 or abs(fx(1e9)) > 1e-6:
        raise ValueError("independent_check_failed")
    parts = [
        part("a", f"Let $f$ be the function given by $f(x)=\\frac{{Ax}}{{x^2+B}}$, where $A$ and $B$ are positive constants. The function $f$ has a critical point at $x={p}$, and $f({p})={q}$. Find $A$ and $B$.", 3, "calculate", ["1.E", "3.D"],
             f"$f'(x)=\\frac{{A(B-x^2)}}{{(x^2+B)^2}}$. $f'({p})=0$ gives $B={p}^2={B}$. Then $f({p})=\\frac{{A}}{{{2 * p}}}={q}$ gives $A={A}$.",
             [row("a1", 1, "Derivative of $f$ by the quotient rule", ["$f'(x)=\\frac{A(B-x^2)}{(x^2+B)^2}$"]),
              row("a2", 1, "Uses $f'(p)=0$ to find $B$", [f"$B={B}$"], requires="a1", nums=True),
              row("a3", 1, "Uses the value of $f$ to find $A$; both constants stated", [f"$A={A}$"], requires="a2", nums=True)]),
        part("b", "For the values of $A$ and $B$ found in part (a), find $\\lim_{x\\to\\infty}f(x)$ and $\\lim_{x\\to-\\infty}f(x)$, and give an equation for the horizontal asymptote of the curve $y=f(x)$.", 1, "calculate", ["1.E", "2.B"],
             "Both limits equal $0$; the horizontal asymptote is $y=0$.",
             [row("b1", 1, "Value of both limits and the equation of the horizontal asymptote", ["$0$", "$y=0$"], nums=True)]),
        part("c", f"Show that $f$ has an absolute maximum value of ${q}$ and an absolute minimum value of ${-q}$ on the interval $-\\infty<x<\\infty$. Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"$f'(x)=\\frac{{{A}({B}-x^2)}}{{(x^2+{B})^2}}$ is negative for $x<-{p}$, positive for $-{p}<x<{p}$, and negative for $x>{p}$. So $f$ has a relative minimum at $x=-{p}$ with $f(-{p})=-{q}$ and a relative maximum at $x={p}$ with $f({p})={q}$. Since $f(x)\\to 0$ as $x\\to\\pm\\infty$ and $-{q}<0<{q}$, no value outside $[-{q},{q}]$ occurs, so these are the absolute extreme values.",
             [row("c1", 1, "Sign of $f'$ on the three intervals determined by the critical points", [f"$f'$ changes sign at $x=-{p}$ and $x={p}$"], nums=True),
              row("c2", 1, "Classifies the critical points and gives the values of $f$ there", [f"$f(-{p})=-{q}$", f"$f({p})={q}$"], requires="c1", nums=True),
              row("c3", 1, "Reason that no other value is larger or smaller: the limits at infinity are $0$ and there are no other critical points", ["limits at $\\pm\\infty$ are $0$", "there are no other critical points, so these extreme values are absolute"], both=True, requires="c2", nums=True)]),
        part("d", f"For which values of the constant $k$ does the equation $f(x)=k$ have exactly two solutions? Justify your answer.", 2, "explain", ["3.B", "3.C", "3.E"],
             f"On $(-\\infty,-{p}]$, $f$ decreases from values near $0$ to $-{q}$; on $[-{p},{p}]$, $f$ increases from $-{q}$ to ${q}$ and equals $0$ only at $x=0$; on $[{p},\\infty)$, $f$ decreases from ${q}$ toward $0$ without reaching it. By the Intermediate Value Theorem and monotonicity on each piece, each $k$ with $0<k<{q}$ is attained once on $(0,{p})$ and once on $({p},\\infty)$, and each $k$ with $-{q}<k<0$ is attained once on $(-\\infty,-{p})$ and once on $(-{p},0)$. The values $k=0$ and $k=\\pm {q}$ give exactly one solution, and $|k|>{q}$ gives none. So the answer is $0<|k|<{q}$.",
             [row("d1", 1, "Describes the behavior of $f$ on each of the intervals, including the values at the extremes", [f"$f(-{p})=-{q}$", f"$f({p})={q}$"], nums=True),
              row("d2", 1, "Conclusion with the Intermediate Value Theorem reason: exactly two solutions when $0<|k|<" + str(q) + "$", [f"$0<|k|<{q}$"], both=True, requires="d1", nums=True)])]
    stim = {"kind": "text", "description": "A rational function with unknown constants", "data": {"definition": "f(x) = A x / (x^2 + B), A > 0, B > 0", "conditions": f"critical point at x = {p}; f({p}) = {q}"}}
    return _pack("frq_rational_param", "parametric_rational_global_extrema", "5.2", ["1.15", "5.4", "5.5"], "3.E", "A rational function with unknown constants: critical-point conditions, limits at infinity, global extrema, number of solutions", stim, parts,
                 [["5.2"], ["1.15"], ["5.5"], ["5.5"]], [f"p={p}", f"q={q}", f"A={A}", f"B={B}"],
                 "Determine two constants of a rational function from a critical point and a value, then use the limit at infinity to justify global extrema and count solutions of f(x) = k",
                 ["Differentiate with the quotient rule and set f'(p) = 0", "Use the value to solve for the second constant", "Use the sign of f' and the limits at infinity for the absolute extrema", "Track the ranges on the monotone pieces to count solutions"],
                 [("f' = A(B - x^2)/(x^2 + B)^2 vanishes only at x = -p and x = p", "A = 2pq and B = p^2 by construction"), ("f tends to 0 at both ends", "the extremes are q and -q")], {"type": "text", "must_include": ["definition of f with constants", "critical point and value"]},
                 "a 400001-point grid scan of f on [-400, 400] for the extreme values and their locations, the number of solutions of f(x) = k by counting sign changes, a central-difference derivative, and f(1e9) for the limit")


# ------------------------------------------------------------------ 3. 지수 감쇠 미분방정식: 분리 풀이, 반감기로 k, 남은 양 시점, 평균값
def frq_exp_decay_de(rng):
    for _ in range(200):
        m = rng.choice([3, 5, 10])
        M0 = m * rng.choice([6, 8, 12, 16, 20])
        h = rng.choice([4, 5, 6, 8, 10])
        break
    M1 = M0 // m
    ln2 = sp.log(2)
    k = ln2 / h
    t_m = h * sp.log(m) / ln2
    avg = sp.Rational(3 * M0, 8) / ln2        # (1/(2h)) ∫_0^{2h} M0 e^{-kt} dt = 3 M0/(8 ln 2)
    Mt = M0 * sp.exp(-k * sp.Symbol("t"))
    # 독립 경로: 수치 적분, 수치 근, 수치 해(RK 대신 해석식과의 비교) — 반감기와 평균
    kn = math.log(2) / h
    avg_n = _I.quad(lambda t: M0 * math.exp(-kn * t), 0, 2 * h)[0] / (2 * h)
    t_n = _O.brentq(lambda t: M0 * math.exp(-kn * t) - M1, 0, 100 * h)
    half = M0 * math.exp(-kn * h)
    # 미분방정식을 만족하는지: 중심차분
    tt = 1.7
    dd = (M0 * math.exp(-kn * (tt + 1e-6)) - M0 * math.exp(-kn * (tt - 1e-6))) / 2e-6
    if abs(avg_n - float(avg)) > 1e-8 or abs(t_n - float(t_m)) > 1e-8 or abs(half - M0 / 2) > 1e-9 or abs(dd + kn * M0 * math.exp(-kn * tt)) > 1e-5:
        raise ValueError("independent_check_failed")
    unit = "grams"
    parts = [
        part("a", f"A sealed capsule holds ${M0}$ grams of a radioactive tracer. Let $M(t)$ be the mass of the tracer, in grams, remaining $t$ years after the capsule is sealed. The rate at which the mass decreases is proportional to the mass present, so $\\frac{{dM}}{{dt}}=-kM$ for a positive constant $k$. Use separation of variables to find an expression for $M(t)$ in terms of $k$.", 3, "calculate", ["1.E", "3.D"],
             f"$\\frac{{1}}{{M}}\\,dM=-k\\,dt$; $\\ln|M|=-kt+C$; $M=Ce^{{-kt}}$ and $M(0)={M0}$ gives $M(t)={M0}e^{{-kt}}$.",
             [row("a1", 1, "Separates the variables", ["$\\frac{1}{M}\\,dM=-k\\,dt$"]),
              row("a2", 1, "Antiderivatives of both sides with a constant of integration", ["$\\ln|M|=-kt+C$"], requires="a1"),
              row("a3", 1, "Solves for $M$ and uses the initial mass to find the constant", [f"$M(t)={M0}e^{{-kt}}$"], requires="a2", nums=True)]),
        part("b", f"The half-life of the tracer is ${h}$ years, that is, $M({h})=\\frac12 M(0)$. Find $k$.", 1, "calculate", ["1.E"],
             f"${M0}e^{{-{h}k}}={M0 // 2}$ gives $e^{{-{h}k}}=\\frac12$, so $k=\\frac{{\\ln 2}}{{{h}}}$.",
             [row("b1", 1, "Value of $k$ from the half-life condition", [f"$k=\\frac{{\\ln 2}}{{{h}}}$"], nums=True)]),
        part("c", f"At what time $t$ will ${M1}$ grams of the tracer remain? Express your answer in terms of natural logarithms.", 2, "calculate", ["1.E"],
             f"${M0}e^{{-kt}}={M1}$ gives $e^{{-kt}}=\\frac{{1}}{{{m}}}$, so $t=\\frac{{\\ln {m}}}{{k}}=\\frac{{{h}\\ln {m}}}{{\\ln 2}}$ years.",
             [row("c1", 1, "Sets up and solves the exponential equation by taking logarithms", [f"$e^{{-kt}}=\\frac{{1}}{{{m}}}$"], nums=True),
              row("c2", 1, "Value of $t$ with the value of $k$ substituted", [f"$t=\\frac{{{h}\\ln {m}}}{{\\ln 2}}$"], requires="c1", nums=True)]),
        part("d", f"Find the average mass of the tracer in the capsule over the time interval $0\\le t\\le {2 * h}$ years. Give your answer in grams, in exact form.", 3, "calculate", ["1.D", "1.E"],
             f"$\\frac{{1}}{{{2 * h}}}\\int_0^{{{2 * h}}}{M0}e^{{-kt}}\\,dt=\\frac{{{M0}}}{{{2 * h}k}}\\left(1-e^{{-{2 * h}k}}\\right)=\\frac{{{M0}}}{{{2 * h}k}}\\left(1-\\frac14\\right)={sp.latex(avg)}$ grams.",
             [row("d1", 1, "Integral setup for the average value, with division by the length of the interval", [f"$\\frac{{1}}{{{2 * h}}}\\int_0^{{{2 * h}}}{M0}e^{{-kt}}\\,dt$"], nums=True),
              row("d2", 1, "Antiderivative and evaluation using $e^{-" + str(2 * h) + "k}=\\frac14$", [f"$e^{{-{2 * h}k}}=\\frac14$"], requires="d1", nums=True),
              row("d3", 1, "Exact value of the average mass with units", [f"${sp.latex(avg)}$ grams"], requires="d2", nums=True, units=True)])]
    stim = {"kind": "text", "description": "Radioactive tracer in a sealed capsule", "data": {"model": "dM/dt = -kM", "initial mass": f"{M0} grams", "half-life": f"{h} years"}}
    return _pack("frq_exp_decay_de", "exponential_decay_model_de", "7.8", ["7.6", "7.7", "8.1"], "1.E", "Exponential decay differential equation: separation of variables, half-life, time to a given mass, average mass", stim, parts,
                 [["7.7"], ["7.8"], ["7.8"], ["8.1"]], [f"M0={M0}", f"h={h}", f"M1={M1}", f"m={m}", f"avg={avg}", f"t={t_m}"],
                 "Solve a proportional-decay differential equation by separation of variables, use the half-life to fix k, solve for the time at a given mass, and compute an exact average value",
                 ["Separate variables and integrate both sides", "Use the half-life to get e^{-hk} = 1/2", "Take logarithms for the time at a given mass", "Average with an integral divided by the interval length, using e^{-2hk} = 1/4"],
                 [("the mass after one half-life is half the initial mass", "e^{-hk} = 1/2 so k = ln 2 / h"), ("M1 = M0/m", "t = h ln m / ln 2")], {"type": "text", "must_include": ["differential equation", "initial mass", "half-life"]},
                 "numerical quadrature for the average, Brent's root finder for the time, the half-life checked from the closed form with k = ln 2 / h, and the differential equation checked by central difference")


# ------------------------------------------------------------------ 4. 벽에 붙인 칸막이 우리: 비용 최소화(제약, 비용 함수, 임계점, 2계 도함수 정당화)
def frq_pen_cost(rng):
    cand = []
    for s in (4, 5, 6, 8, 10):
        for a in (4, 5, 6, 8):
            for b in (6, 9, 10, 12, 15):
                if (3 * a * s * s) % b == 0 and 150 <= 3 * a * s * s // b <= 1500:
                    cand.append((s, a, b))
    s, a, b = rng.choice(cand)
    A = 3 * a * s * s // b
    x = X
    C = 3 * a * x + b * sp.Rational(A) / x
    Cp = sp.diff(C, x)
    Cpp = sp.diff(C, x, 2)
    crit = sp.solve(sp.Eq(Cp, 0), x)
    crit = [r for r in crit if r.is_positive]
    if crit != [s]:
        raise ValueError("bad_design")
    cmin = C.subs(x, s)
    L = sp.Rational(A, s)
    # 독립 경로: 격자 최소, 중심차분 2계 도함수, 직접 비용 계산(변의 길이로)
    cost = lambda xx: a * (3 * xx) + b * (A / xx)
    grid = [0.05 + i * (6 * s) / 200000 for i in range(200001)]
    gx = min(grid, key=cost)
    h = 1e-3
    c2 = (cost(s + h) - 2 * cost(s) + cost(s - h)) / h ** 2
    if abs(gx - s) > 1e-2 or abs(cost(s) - float(cmin)) > 1e-9 or abs(c2 - float(Cpp.subs(x, s))) > 1e-3 or abs(cmin - 6 * a * s) != 0:
        raise ValueError("independent_check_failed")
    Cpp_tex = sp.latex(Cpp)
    parts = [
        part("a", f"A farmer builds a rectangular pen against a long stone wall, so no fence is needed along the wall. The pen has area ${A}$ square meters and is divided into two stalls by one more fence perpendicular to the wall. Fence perpendicular to the wall costs ${a}$ dollars per meter, and the fence opposite the wall costs ${b}$ dollars per meter. Let $x$ meters be the length of each fence perpendicular to the wall. Write an expression for the total cost $C(x)$, in dollars, of the fence in terms of $x$ only.", 2, "calculate", ["1.D", "1.E"],
             f"The length opposite the wall is $\\frac{{{A}}}{{x}}$ meters; three fences of length $x$ cost ${3 * a}x$ and the fence opposite the wall costs $\\frac{{{b * A}}}{{x}}$, so $C(x)={3 * a}x+\\frac{{{b * A}}}{{x}}$.",
             [row("a1", 1, "Length of the side opposite the wall from the area constraint", [f"$\\frac{{{A}}}{{x}}$"], nums=True),
              row("a2", 1, "Total cost expression using three perpendicular fences and one fence opposite the wall", [f"$C(x)={3 * a}x+\\frac{{{b * A}}}{{x}}$"], requires="a1", nums=True)]),
        part("b", "Find the value of $x$ for which $C'(x)=0$.", 2, "calculate", ["1.E", "3.D"],
             f"$C'(x)={3 * a}-\\frac{{{b * A}}}{{x^2}}=0$ gives $x^2={s * s}$, so $x={s}$ for $x>0$.",
             [row("b1", 1, "Derivative of the cost function", [f"$C'(x)={3 * a}-\\frac{{{b * A}}}{{x^2}}$"], nums=True),
              row("b2", 1, "Solves for the positive critical value", [f"$x={s}$"], requires="b1", nums=True)]),
        part("c", "Use the second derivative to justify that the value of $x$ found in part (b) gives the absolute minimum cost over all possible values of $x$.", 3, "explain", ["3.B", "3.E"],
             f"$C''(x)={Cpp_tex}$. For every $x>0$, $C''(x)>0$, so $C$ is concave up on its whole domain $x>0$. A concave-up function with $C'({s})=0$ has its absolute minimum at $x={s}$.",
             [row("c1", 1, "Second derivative of the cost function", [f"$C''(x)={Cpp_tex}$"], nums=True),
              row("c2", 1, "Reason: $C''(x)>0$ for all $x>0$, the entire domain, so the function is concave up everywhere", ["$C''(x)>0$ for all $x>0$"], both=True, requires="c1"),
              row("c3", 1, "Conclusion that the critical point is the absolute minimum", [f"absolute minimum at $x={s}$"], both=True, requires="c2", nums=True)]),
        part("d", "Find the minimum total cost, in dollars, and the length, in meters, of the fence opposite the wall for that pen.", 2, "calculate", ["1.E"],
             f"$C({s})={3 * a * s}+\\frac{{{b * A}}}{{{s}}}={sp.latex(cmin)}$ dollars; the fence opposite the wall has length $\\frac{{{A}}}{{{s}}}={sp.latex(L)}$ meters.",
             [row("d1", 1, "Minimum cost value", [f"${sp.latex(cmin)}$ dollars"], nums=True, units=True),
              row("d2", 1, "Length opposite the wall with units", [f"${sp.latex(L)}$ meters"], nums=True, units=True)])]
    stim = {"kind": "text", "description": "A pen built against a wall", "data": {"area": f"{A} square meters", "costs": f"{a} dollars per meter perpendicular to the wall, {b} dollars per meter opposite the wall"}}
    return _pack("frq_pen_cost", "optimization_cost_divided_pen", "5.11", ["5.10", "5.7"], "3.E", "Pen against a wall with different fence prices: cost function, critical value, second-derivative justification, minimum cost", stim, parts,
                 [["5.10"], ["5.11"], ["5.7"], ["5.11"]], [f"s={s}", f"a={a}", f"b={b}", f"A={A}", f"cmin={cmin}", f"L={L}"],
                 "Optimize the cost of a fenced pen with two fence prices: build the cost function from the area constraint, find the critical value, justify the absolute minimum by concavity on the whole domain, and find the minimum cost",
                 ["Express the free side with the area constraint", "Add the prices times the lengths of each fence", "Set the derivative to zero", "Show the second derivative is positive on the whole domain"],
                 [("C''(x) = 2bA/x^3 > 0 for all x > 0", "the cost is concave up on the entire domain"), ("the optimal x is s with b A = 3 a s^2", "C(s) = 6 a s")], {"type": "text", "must_include": ["area", "two fence prices"]},
                 "a 200001-point grid minimum of the cost computed directly from the side lengths, a central second difference at the critical value, and the closed-form cost 6as")


# ------------------------------------------------------------------ 5. 극한·연속 묶음: 로피탈, 연속이 되는 값, 두 번 적용, 무한대 극한과 수평 점근선
def frq_limits_continuity(rng):
    n = rng.choice([2, 3])
    p = rng.choice([1, 2, 3])
    q = rng.choice([1, 2, 3, 4])
    a_, b_, c_ = rng.choice([(3, 5, 2), (4, 3, 1), (5, 2, 3), (2, 7, 4), (6, 5, 3), (3, 8, 5)])
    L1 = n * p ** n
    L2 = sp.Rational(1, 2 * q)
    L3 = sp.Rational(a_, c_)
    # 독립 경로: 고정밀 mpmath 로 극한 근방/큰 x 에서 값
    _mp.mp.dps = 80
    g1 = lambda u: (u ** n - p ** n) / (_mp.log(u) - _mp.log(p))
    g2 = lambda u: (_mp.e ** u - 1 - u) / (q * u ** 2)
    g3 = lambda u: (a_ * u ** 2 + b_ * _mp.log(u)) / (c_ * u ** 2)
    v1 = g1(_mp.mpf(p) + _mp.mpf(10) ** -30)
    v2 = g2(_mp.mpf(10) ** -20)
    v3 = g3(_mp.mpf(10) ** 60)
    if abs(v1 - L1) > 1e-20 or abs(v2 - float(L2)) > 1e-15 or abs(v3 - float(L3)) > 1e-20:
        raise ValueError("independent_check_failed")
    sl = sp.limit((X ** n - p ** n) / (sp.log(X) - sp.log(p)), X, p)
    sl2 = sp.limit((sp.exp(X) - 1 - X) / (q * X ** 2), X, 0)
    sl3 = sp.limit((a_ * X ** 2 + b_ * sp.log(X)) / (c_ * X ** 2), X, sp.oo)
    if sl != L1 or sl2 != L2 or sl3 != L3:
        raise ValueError("independent_check_failed")
    hx = f"\\frac{{x^{n}-{p ** n}}}{{\\ln x-\\ln {p}}}" if p > 1 else f"\\frac{{x^{n}-1}}{{\\ln x}}"
    lnp = f"\\ln {p}"
    parts = [
        part("a", f"Find $\\lim_{{x\\to {p}}}{hx}$. Show the work that leads to your answer, including why the method you use applies.", 3, "calculate", ["1.E", "3.C"],
             f"Substituting $x={p}$ gives $\\frac{{0}}{{0}}$, so L’Hospital’s Rule applies: $\\lim_{{x\\to {p}}}\\frac{{{n}x^{{{n - 1}}}}}{{1/x}}=\\lim_{{x\\to {p}}}{n}x^{{{n}}}={L1}$.",
             [row("a1", 1, "Identifies the indeterminate form $\\frac00$ (numerator and denominator both approach $0$)", ["$\\frac{0}{0}$"], nums=True),
              row("a2", 1, "Differentiates numerator and denominator", [f"${n}x^{{{n - 1}}}$", "$\\frac{1}{x}$"], requires="a1"),
              row("a3", 1, "Value of the limit", [f"${L1}$"], requires="a2", nums=True)]),
        part("b", f"Let $g$ be the function defined by $g(x)={hx}$ for $x>0$ with $x\\ne {p}$, and $g({p})=c$. For what value of $c$ is $g$ continuous at $x={p}$? Justify your answer.", 1, "explain", ["3.B", "3.C"],
             f"$g$ is continuous at $x={p}$ exactly when $\\lim_{{x\\to {p}}}g(x)=g({p})$, so $c={L1}$.",
             [row("b1", 1, "Value of $c$ with the condition that the limit equals the function value", [f"$c={L1}$", "the limit equals the function value"], both=True, nums=True)]),
        part("c", f"Find $\\lim_{{x\\to 0}}\\frac{{e^x-1-x}}{{{'' if q == 1 else q}x^2}}$. Show the work that leads to your answer.", 3, "calculate", ["1.E", "3.C"],
             f"The form is $\\frac{{0}}{{0}}$; L’Hospital’s Rule gives $\\lim_{{x\\to 0}}\\frac{{e^x-1}}{{{2 * q}x}}$, again $\\frac{{0}}{{0}}$; applying it once more gives $\\lim_{{x\\to 0}}\\frac{{e^x}}{{{2 * q}}}=\\frac{{1}}{{{2 * q}}}$.",
             [row("c1", 1, "Identifies the form $\\frac00$ and applies L’Hospital’s Rule once", [f"$\\frac{{e^x-1}}{{{2 * q}x}}$"], nums=True),
              row("c2", 1, "Recognizes that the new form is still $\\frac00$ and applies the rule again", [f"$\\frac{{e^x}}{{{2 * q}}}$"], requires="c1", nums=True),
              row("c3", 1, "Value of the limit", [f"$\\frac{{1}}{{{2 * q}}}$"], requires="c2", nums=True)]),
        part("d", f"Let $h(x)=\\frac{{{a_}x^2+{b_}\\ln x}}{{{c_}x^2}}$ for $x>0$. Find $\\lim_{{x\\to\\infty}}h(x)$ and write an equation for the horizontal asymptote of the curve $y=h(x)$. Justify your answer.", 2, "explain", ["1.E", "3.E"],
             f"$h(x)=\\frac{{{a_}}}{{{c_}}}+\\frac{{{b_}}}{{{c_}}}\\cdot\\frac{{\\ln x}}{{x^2}}$. The form $\\frac{{\\ln x}}{{x^2}}$ is $\\frac{{\\infty}}{{\\infty}}$ and L’Hospital’s Rule gives $\\lim_{{x\\to\\infty}}\\frac{{1/x}}{{2x}}=0$. So $\\lim_{{x\\to\\infty}}h(x)={sp.latex(L3)}$ and the horizontal asymptote is $y={sp.latex(L3)}$.",
             [row("d1", 1, "Shows $\\frac{\\ln x}{x^2}\\to 0$ with a valid reason such as the $\\frac{\\infty}{\\infty}$ form and the derivative ratio", ["$\\lim_{x\\to\\infty}\\frac{\\ln x}{x^2}=0$"], both=True),
              row("d2", 1, "Value of the limit and the equation of the asymptote", [f"$y={sp.latex(L3)}$"], requires="d1", nums=True)])]
    stim = {"kind": "text", "description": "Three limit problems and a continuity condition", "data": {"functions": "The functions g and h are defined in parts (b) and (d)."}}
    return _pack("frq_limits_continuity", "limits_lhopital_continuity", "4.7", ["1.15", "1.13", "1.11"], "1.E", "Limits with L’Hospital’s Rule: a removable value, a repeated application, and a limit at infinity with a horizontal asymptote", stim, parts,
                 [["4.7"], ["1.11"], ["4.7"], ["1.15"]], [f"n={n}", f"p={p}", f"q={q}", f"a={a_}", f"b={b_}", f"c={c_}", f"L1={L1}", f"L2={L2}", f"L3={L3}"],
                 "Evaluate indeterminate limits with L’Hospital’s Rule: a 0/0 limit that fixes the value making a function continuous, a limit needing two applications, and a limit at infinity giving a horizontal asymptote",
                 ["Check the indeterminate form before applying the rule", "Differentiate numerator and denominator separately", "Check the form again after the first application", "Compare the limit with the function value for continuity"],
                 [("both numerator and denominator approach 0 at x = p", "the quotient has the form 0/0"), ("ln x / x^2 is of the form infinity over infinity", "the derivative ratio 1/(2x^2) tends to 0")], {"type": "text", "must_include": ["three functions"]},
                 "80-digit mpmath evaluation of each quotient very near the limit point (or at 10^60), and sympy's symbolic limit")


# ------------------------------------------------------------------ 6. 역함수 도함수 표: 역함수 도함수, 곱의 미분, 접선 근사, 치환 적분(FTC)
def frq_inverse_table(rng):
    xs = [1, 2, 3, 4, 5]
    for _ in range(4000):
        f = sorted(rng.sample(range(-2, 20), 5))
        fp = [rng.choice([1, 2, 3, 4, 5]) for _ in xs]
        i1, i2 = rng.sample([1, 2, 3], 2)
        if len(set(f)) < 5:
            continue
        # 독립 경로: 에르미트 보간(표의 값과 기울기를 정확히 따르는 C1 함수)으로 역함수 도함수·적분을 수치로 확인
        H = _P.CubicHermiteSpline(xs, f, fp)
        g = [xs[0] + 4 * i / 4000 for i in range(4001)]
        if not all(H(u, 1) > 0 for u in g):
            continue
        break
    else:
        raise ValueError("no_sample")
    a1, a2 = xs[i1], xs[i2]
    b1, b2 = f[i1], f[i2]
    inv1 = Fr(1, fp[i1])
    hpr = Fr(a2) + Fr(b2, fp[i2])                  # h(x) = x f^{-1}(x): h'(b2) = f^{-1}(b2) + b2 (f^{-1})'(b2)
    dlt = rng.choice([1, 2])
    apx = Fr(a1) + inv1 * dlt                      # f^{-1}(b1 + dlt) ≈ a1 + dlt / f'(a1)
    lo, hi = 1, 5
    integ = Fr(f[4] ** 3 - f[0] ** 3, 3)           # ∫_1^5 f'(x) f(x)^2 dx
    # 독립 경로
    finv = lambda y: _O.brentq(lambda u: H(u) - y, 1, 5, xtol=1e-14)
    e = 1e-5
    dinv1 = (finv(b1 + e) - finv(b1 - e)) / (2 * e)
    hn = lambda y: y * finv(y)
    dh = (hn(b2 + e) - hn(b2 - e)) / (2 * e)
    qd = _I.quad(lambda u: H(u, 1) * H(u) ** 2, 1, 5, epsabs=1e-10, epsrel=1e-12)[0]
    if abs(dinv1 - float(inv1)) > 1e-6 or abs(dh - float(hpr)) > 1e-5 or abs(qd - float(integ)) > 1e-6 * max(1, abs(float(integ))) or not (b1 - e > f[0] and b2 - e > f[0]):
        raise ValueError("independent_check_failed")
    rows_tab = [[str(a), str(b), str(c)] for a, b, c in zip(xs, f, fp)]
    stim = {"kind": "table", "description": "Table of values of a differentiable function and of its derivative", "data": {"columns": ["x", "f(x)", "f'(x)"], "rows": rows_tab}}
    tab_tex = "$" + "; ".join(f"f({a})={b},\\ f'({a})={c}" for a, b, c in zip(xs, f, fp)) + "$"
    fr = lambda v: sp.latex(_R(v))
    parts = [
        part("a", f"The function $f$ is differentiable and increasing on $1\\le x\\le 5$ (so $f$ has an inverse function $f^{{-1}}$), and the table gives values of $f$ and $f'$. Find $\\left(f^{{-1}}\\right)'({b1})$.", 2, "calculate", ["1.E", "2.B"],
             f"$f({a1})={b1}$, so $f^{{-1}}({b1})={a1}$ and $\\left(f^{{-1}}\\right)'({b1})=\\frac{{1}}{{f'({a1})}}=\\frac{{1}}{{{fp[i1]}}}$.",
             [row("a1", 1, "Identifies the point of the inverse using the table value", [f"$f^{{-1}}({b1})={a1}$"], nums=True),
              row("a2", 1, "Derivative of the inverse as the reciprocal of $f'$", [f"$\\frac{{1}}{{{fp[i1]}}}$"], requires="a1", nums=True)]),
        part("b", f"Let $h(x)=x\\cdot f^{{-1}}(x)$. Find $h'({b2})$.", 2, "calculate", ["1.E", "2.B"],
             f"$h'(x)=f^{{-1}}(x)+x\\left(f^{{-1}}\\right)'(x)$. Since $f({a2})={b2}$, $f^{{-1}}({b2})={a2}$ and $\\left(f^{{-1}}\\right)'({b2})=\\frac{{1}}{{{fp[i2]}}}$, so $h'({b2})={a2}+{b2}\\cdot\\frac{{1}}{{{fp[i2]}}}={fr(hpr)}$.",
             [row("b1", 1, "Product rule applied to $h$", ["$h'(x)=f^{-1}(x)+x\\left(f^{-1}\\right)'(x)$"]),
              row("b2", 1, "Value of $h'$ using the table values", [f"$h'({b2})={fr(hpr)}$"], requires="b1", nums=True)]),
        part("c", f"Find the value of $\\int_{{1}}^{{5}}f'(x)\\left(f(x)\\right)^2\\,dx$. Show the work that leads to your answer.", 3, "calculate", ["1.E", "3.D"],
             f"With $u=f(x)$, $du=f'(x)\\,dx$: $\\int_1^5 f'(x)(f(x))^2\\,dx=\\int_{{{f[0]}}}^{{{f[4]}}}u^2\\,du=\\frac{{{f[4]}^3-({f[0]})^3}}{{3}}={fr(integ)}$.",
             [row("c1", 1, "Substitution $u=f(x)$ with $du=f'(x)\\,dx$", ["$u=f(x)$", "$du=f'(x)\\,dx$"]),
              row("c2", 1, "New limits of integration from the table", [f"$u$ from ${f[0]}$ to ${f[4]}$"], requires="c1", nums=True),
              row("c3", 1, "Antiderivative and value", [f"${fr(integ)}$"], requires="c2", nums=True)]),
        part("d", f"Write an equation for the line tangent to the curve $y=f^{{-1}}(x)$ at $x={b1}$, and use it to approximate $f^{{-1}}({b1 + dlt})$.", 2, "calculate", ["1.E", "1.F"],
             f"The tangent line is $y={a1}+\\frac{{1}}{{{fp[i1]}}}(x-{b1})$, so $f^{{-1}}({b1 + dlt})\\approx {a1}+\\frac{{{dlt}}}{{{fp[i1]}}}={fr(apx)}$.",
             [row("d1", 1, "Tangent line equation using the point and the slope from part (a)", [f"$y={a1}+\\frac{{1}}{{{fp[i1]}}}(x-{b1})$"], nums=True),
              row("d2", 1, "Approximation value", [f"${fr(apx)}$"], requires="d1", nums=True)])]
    pk = _pack("frq_inverse_table", "inverse_function_table_derivatives", "3.3", ["3.5", "6.9", "4.6"], "1.E", "Inverse function from a table: derivative of the inverse, product rule, substitution integral, tangent approximation", stim, parts,
               [["3.3"], ["3.3"], ["6.9"], ["4.6"]], [f"f={f}", f"fp={fp}", f"inv1={inv1}", f"hpr={hpr}", f"integ={integ}", f"apx={apx}"],
               "Use a table of f and f' to differentiate the inverse function, a product with the inverse, a substitution integral and a tangent-line approximation for the inverse",
               ["Locate the table row whose f value equals the given input", "Take the reciprocal of f' there for the inverse derivative", "Apply the product rule with the inverse derivative", "Substitute u = f(x) and change the limits using the table"],
               [("f is increasing, so f has an inverse", "f' > 0 at the table points"), ("the integrand is f'(x) times f(x) squared", "u = f(x) turns it into u squared")], {"type": "table", "must_include": ["f values", "f' values"]},
               "a cubic Hermite function that reproduces every table value and slope: the inverse by Brent's method with a central difference for the two derivative values, and numerical quadrature of the integral")
    return pk


# ------------------------------------------------------------------ 7. 변하는 위쪽 끝을 가진 누적 함수: 미적분의 기본정리(연쇄) → 접선 → 극값 정당화 → 로피탈 극한
def frq_ftc_chain_limit(rng):
    p = rng.choice([2, 3, 4, 5])
    t = sp.Symbol("t")
    H = sp.integrate(sp.exp(t) - p, (t, 0, X ** 2))
    Hp = sp.diff(H, X)
    if sp.simplify(Hp - 2 * X * (sp.exp(X ** 2) - p)) != 0:
        raise ValueError("bad_design")
    r = sp.sqrt(sp.log(p))
    h1, hp1 = sp.simplify(H.subs(X, 1)), sp.simplify(Hp.subs(X, 1))
    hr = sp.simplify(H.subs(X, r))
    lim0 = 1 - p
    tl = f"y=\\left({sp.latex(hp1)}\\right)(x-1)+\\left({sp.latex(h1)}\\right)"
    # 독립 경로: 수치 적분으로 H, 중심차분 H', 격자 극값, 고정밀 mpmath 로 H(x)/x^2
    Hn = lambda u: _I.quad(lambda s_: math.exp(s_) - p, 0, u * u)[0]
    if abs(Hn(1) - float(h1)) > 1e-9 or abs(Hn(float(r)) - float(hr)) > 1e-9:
        raise ValueError("independent_check_failed")
    for u in (0.4, 1.0, 1.3, -0.8):
        if abs((Hn(u + 1e-5) - Hn(u - 1e-5)) / 2e-5 - float(Hp.subs(X, u))) > 1e-5:
            raise ValueError("independent_check_failed")
    xs_ = [-2.5 + 5 * i / 2000 for i in range(2001)]
    gv = [Hn(u) for u in xs_]
    mins = [xs_[i] for i in range(1, 2000) if gv[i] < gv[i - 1] and gv[i] < gv[i + 1]]
    maxs = [xs_[i] for i in range(1, 2000) if gv[i] > gv[i - 1] and gv[i] > gv[i + 1]]
    if len(mins) != 2 or len(maxs) != 1 or abs(abs(mins[0]) - float(r)) > 0.01 or abs(abs(mins[1]) - float(r)) > 0.01 or abs(maxs[0]) > 0.01:
        raise ValueError("independent_check_failed")
    _mp.mp.dps = 40
    q0 = _mp.quad(lambda s_: _mp.e ** s_ - p, [0, _mp.mpf(10) ** -12]) / _mp.mpf(10) ** -12
    if abs(q0 - lim0) > 1e-9:
        raise ValueError("independent_check_failed")
    rtex = f"\\sqrt{{\\ln {p}}}"
    stim = {"kind": "text", "description": "A function defined by an integral with a variable upper limit", "data": {"definition": f"H(x) = integral from 0 to x^2 of (e^t - {p}) dt"}}
    parts = [
        part("a", f"Let $H$ be the function defined by $H(x)=\\int_0^{{x^2}}\\left(e^t-{p}\\right)dt$. Find $H'(x)$.", 2, "calculate", ["1.E", "3.D"],
             f"By the Fundamental Theorem of Calculus and the chain rule, $H'(x)=\\left(e^{{x^2}}-{p}\\right)\\cdot 2x$.",
             [row("a1", 1, "Uses the Fundamental Theorem of Calculus: the integrand evaluated at the upper limit", [f"$e^{{x^2}}-{p}$"]),
              row("a2", 1, "Chain rule factor from the upper limit; the final expression for the derivative", [f"$H'(x)=2x\\left(e^{{x^2}}-{p}\\right)$"], requires="a1")]),
        part("b", "Write an equation for the line tangent to the curve $y=H(x)$ at $x=1$.", 2, "calculate", ["1.E"],
             f"$H(1)=\\int_0^1\\left(e^t-{p}\\right)dt={sp.latex(h1)}$ and $H'(1)=2(e-{p})={sp.latex(hp1)}$, so the tangent line is ${tl}$.",
             [row("b1", 1, "Value of $H(1)$ by evaluating the integral and the slope $H'(1)$", [f"$H(1)={sp.latex(h1)}$", f"$H'(1)={sp.latex(hp1)}$"], nums=True),
              row("b2", 1, "Equation of the tangent line", [f"${tl}$"], requires="b1", nums=True)]),
        part("c", "Find the $x$-coordinate of each relative extremum of $H$ and classify each as a relative maximum or a relative minimum. Justify your answers.", 3, "explain", ["3.B", "3.E"],
             f"$H'(x)=2x\\left(e^{{x^2}}-{p}\\right)=0$ at $x=0$ and $x=\\pm{rtex}$. $H'<0$ for $x<-{rtex}$, $H'>0$ on $\\left(-{rtex},0\\right)$, $H'<0$ on $\\left(0,{rtex}\\right)$, and $H'>0$ for $x>{rtex}$. So $H$ has a relative maximum at $x=0$ and relative minima at $x=\\pm{rtex}$.",
             [row("c1", 1, "Critical points from setting $H'(x)=0$", ["$x=0$", f"$x=\\pm{rtex}$"], nums=True),
              row("c2", 1, "Justification: signs of $H'$ on the intervals determined by the critical points (sign changes of $H'$)", [f"$H'$ changes sign at $x=0$, $x=-{rtex}$ and $x={rtex}$"], nums=True, requires="c1"),
              row("c3", 1, "Classification of all three critical points as the reason requires: a relative maximum at the middle one and relative minima at the other two", ["relative maximum at $x=0$", f"relative minima at $x=\\pm{rtex}$"], both=True, nums=True, requires="c2")]),
        part("d", "Find $\\lim_{x\\to 0}\\frac{H(x)}{x^2}$. Show the work that leads to your answer, including why the method you use applies.", 2, "calculate", ["1.E", "3.C"],
             f"$H(0)=0$ and $x^2\\to 0$, so the form is $\\frac00$ and L’Hospital’s Rule applies: $\\lim_{{x\\to 0}}\\frac{{H'(x)}}{{2x}}=\\lim_{{x\\to 0}}\\left(e^{{x^2}}-{p}\\right)=1-{p}={lim0}$.",
             [row("d1", 1, "Identifies the indeterminate form $\\frac00$ (both numerator and denominator approach $0$) before differentiating", ["$\\frac{0}{0}$", "$H(0)=0$"], nums=True),
              row("d2", 1, "Applies L’Hospital’s Rule with $H'(x)$ from part (a) and gives the value", [f"${lim0}$"], requires="d1", nums=True)])]
    return _pack("frq_ftc_chain_limit", "accumulation_function_variable_limit", "6.4", ["3.1", "5.4", "4.7"], "1.E", "An accumulation function with upper limit x squared: derivative, tangent line, relative extrema, limit at zero", stim, parts,
                 [["6.4", "3.1"], ["6.4"], ["5.4"], ["4.7"]], [f"p={p}", f"h1={h1}", f"hp1={hp1}", f"hr={hr}", f"lim0={lim0}"],
                 "Differentiate an accumulation function whose upper limit is x^2 (Fundamental Theorem with the chain rule), write a tangent line, classify relative extrema by the sign of H', and evaluate a 0/0 limit with L’Hospital’s Rule",
                 ["Evaluate the integrand at the upper limit and multiply by the derivative of the limit", "Compute H(1) from the integral for the tangent line", "Set H' = 0 and chart its sign", "Check H(0) = 0 and the denominator before using L’Hospital’s Rule"],
                 [("H' = 2x(e^{x^2} - p) is zero at x = 0 and x = ± sqrt(ln p)", "H' changes sign at each of them"), ("H(0) = 0", "the quotient H(x)/x^2 has the form 0/0 at x = 0")], {"type": "text", "must_include": ["integral definition of H"]},
                 "H computed by numerical quadrature of the integrand, H' by central difference at four points, relative extrema by a 2001-point scan, and the limit by a 40-digit quadrature of H(x)/x^2 at x = 1e-6")


# ------------------------------------------------------------------ 8. 역삼각함수 항이 있는 함수: 도함수와 임계점, 극댓값, x→∞ 에서 f(x)/x 의 극한, 영점의 개수(IVT)
def frq_arctan_zeros(rng):
    s = rng.choice([1, sp.sqrt(3)])
    b = rng.choice([1, 2, 3])
    a = b * (1 + s ** 2)
    f = a * sp.atan(X) - b * X
    fp = sp.simplify(sp.diff(f, X))
    if sp.simplify(fp - b * (s ** 2 - X ** 2) / (1 + X ** 2)) != 0:
        raise ValueError("bad_design")
    fs = sp.simplify(f.subs(X, s))
    if not fs.is_positive:
        raise ValueError("bad_design")
    st = sp.latex(s)
    # 독립 경로: 격자 극값, 영점 개수, 큰 x 에서 f(x)/x, 중심차분 f'
    fl = lambda u: float(a) * math.atan(u) - b * u
    import numpy as _np
    g = _np.linspace(-1000.0, 1000.0, 2000001)
    gv = float(a) * _np.arctan(g) - b * g
    msk = (g > -3) & (g < 3)
    gm, gvm = g[msk], gv[msk]
    loc_max = [gm[i] for i in range(1, len(gm) - 1) if gvm[i] > gvm[i - 1] and gvm[i] > gvm[i + 1]]
    nz = int(_np.sum(gv[:-1] * gv[1:] < 0)) + int(_np.sum(gv == 0))
    z = _O.brentq(fl, float(s) + 1e-9, 50.0)
    if len(loc_max) != 1 or abs(loc_max[0] - float(s)) > 1e-2 or abs(fl(float(s)) - float(fs)) > 1e-9 or nz != 3 or abs(fl(1e12) / 1e12 + b) > 1e-9 or z <= float(s) \
            or abs((fl(0.7 + 1e-6) - fl(0.7 - 1e-6)) / 2e-6 - float(fp.subs(X, 0.7))) > 1e-6:
        raise ValueError("independent_check_failed")
    stim = {"kind": "text", "description": "A function containing an inverse tangent term", "data": {"definition": f"f(x) = {sp.latex(a)} arctan(x) - {'' if b == 1 else b}x"}}
    bx = "" if b == 1 else str(b)
    ftex = f"{sp.latex(a)}\\arctan x-{bx}x"
    parts = [
        part("a", f"Let $f$ be the function defined by $f(x)={ftex}$ for all real $x$. Find $f'(x)$ and find all values of $x$ for which $f'(x)=0$.", 2, "calculate", ["1.E", "3.D"],
             f"$f'(x)=\\frac{{{sp.latex(a)}}}{{1+x^2}}-{b}=\\frac{{{bx}\\left({sp.latex(s ** 2)}-x^2\\right)}}{{1+x^2}}$, which is $0$ when $x^2={sp.latex(s ** 2)}$, that is, $x=\\pm{st}$.",
             [row("a1", 1, "Derivative using the derivative of the inverse tangent", [f"$f'(x)=\\frac{{{sp.latex(a)}}}{{1+x^2}}-{b}$"]),
              row("a2", 1, "Solves $f'(x)=0$ for both values", [f"$x=\\pm{st}$"], requires="a1", nums=True)]),
        part("b", f"Show that $f$ has a relative maximum at $x={st}$, and find the value of this relative maximum. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             f"$f'(x)$ is positive for $-{st}<x<{st}$ and negative for $x>{st}$, so $f'$ changes from positive to negative at $x={st}$ and $f$ has a relative maximum there. $f({st})={sp.latex(a)}\\arctan({st})-{b}\\cdot {st}={sp.latex(fs)}$.",
             [row("b1", 1, "Justification: $f'$ changes sign from positive to negative at $x=" + st + "$ (sign analysis on both sides)", [f"$f'$ changes from positive to negative at $x={st}$"], nums=True),
              row("b2", 1, "Value of the relative maximum, using the exact value of the inverse tangent", [f"$f({st})={sp.latex(fs)}$"], requires="b1", nums=True)]),
        part("c", "Find $\\lim_{x\\to\\infty}\\frac{f(x)}{x}$. Show the work that leads to your answer.", 3, "calculate", ["1.E", "2.B"],
             f"$\\frac{{f(x)}}{{x}}={sp.latex(a)}\\cdot\\frac{{\\arctan x}}{{x}}-{b}$. Since $-\\frac{{\\pi}}{{2}}<\\arctan x<\\frac{{\\pi}}{{2}}$, $\\frac{{\\arctan x}}{{x}}\\to 0$ as $x\\to\\infty$, so the limit is $-{b}$.",
             [row("c1", 1, "Rewrites the quotient as the inverse tangent term over $x$ minus a constant", [f"$\\frac{{f(x)}}{{x}}={sp.latex(a)}\\cdot\\frac{{\\arctan x}}{{x}}-{b}$"], nums=True),
              row("c2", 1, "Reason that $\\frac{\\arctan x}{x}\\to 0$: the inverse tangent is bounded (or approaches $\\frac{\\pi}{2}$) while $x\\to\\infty$", ["$\\arctan x$ is bounded"], both=True, requires="c1"),
              row("c3", 1, "Value of the limit", [f"$-{b}$"], requires="c2", nums=True)]),
        part("d", "How many solutions does the equation $f(x)=0$ have? Justify your answer.", 2, "explain", ["3.B", "3.C", "3.E"],
             f"$f(0)=0$. On $\\left[0,{st}\\right]$, $f$ is increasing from $0$ to $f({st})={sp.latex(fs)}>0$, and on $\\left[{st},\\infty\\right)$, $f$ is decreasing and continuous with $f(x)\\to-\\infty$, because $f(x)\\le {sp.latex(a)}\\cdot\\frac{{\\pi}}{{2}}-{bx}x$. By the Intermediate Value Theorem and monotonicity, there is exactly one solution with $x>{st}$. Since $f$ is odd, there is exactly one solution with $x<-{st}$. So $f(x)=0$ has $3$ solutions.",
             [row("d1", 1, "Describes the behavior of $f$ on each interval using the sign of $f'$, including the positive value $f(" + st + ")$ and $f(0)=0$", [f"$f({st})={sp.latex(fs)}>0$", "$f(0)=0$"], nums=True),
              row("d2", 1, "Justification by the Intermediate Value Theorem on each side, and the total of three solutions", ["$3$ solutions"], both=True, nums=True, requires="d1")])]
    return _pack("frq_arctan_zeros", "inverse_tangent_function_analysis", "3.4", ["5.4", "1.15", "1.16"], "3.E", "A function with an inverse tangent term: derivative, relative maximum, a limit at infinity, number of zeros", stim, parts,
                 [["3.4"], ["5.4"], ["1.15"], ["1.16"]], [f"s={s}", f"b={b}", f"a={a}", f"fs={fs}"],
                 "Analyze f(x) = a arctan x - b x: derivative and critical points, relative maximum by the sign of f', the limit of f(x)/x at infinity from the boundedness of the inverse tangent, and the number of zeros by monotonicity and the Intermediate Value Theorem",
                 ["Differentiate the inverse tangent term and combine fractions", "Chart the sign of f' around the critical points", "Divide by x and use that the inverse tangent is bounded", "Follow f on each monotone piece and use the Intermediate Value Theorem"],
                 [("a = b(1 + s^2), so f'(x) = b(s^2 - x^2)/(1 + x^2) vanishes at x = ±s", "the relative maximum value f(s) is positive"), ("f is odd and decreases to minus infinity for x > s", "exactly one zero beyond s")], {"type": "text", "must_include": ["definition of f"]},
                 "a 2000001-point grid on [-1000, 1000] for the local maximum and the sign changes (zero count), Brent's method for the zero beyond s, a central-difference derivative, and f(1e12)/1e12")
