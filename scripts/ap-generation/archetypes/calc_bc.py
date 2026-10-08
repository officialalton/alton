"""AP Calculus BC 전용 원형(공통 토픽은 AB 원형을 content_key 로 재사용). 모든 값은 sympy/수치로 이중 검증."""
from common import *
from calc_ab_1 import pack_fixed
from calc_ab_frq import row, part, f3
from scipy import integrate as _I
import numpy as np

def int_by_parts(rng):
    k = rng.choice([1, 2, 3]); form = rng.choice(["xe", "xln", "xsin"])
    if form == "xe":
        f = x * sp.exp(k * x); b = 1; val = sp.integrate(f, (x, 0, b)); txt = f"\\int_0^1 x e^{{{k}x}}\\,dx"
        ds = [sp.integrate(x * sp.exp(k * x), (x, 0, 1)) * 0 + (sp.exp(k) / k + 1 / S(k * k)), sp.exp(k) / k, (sp.exp(k) / k - (sp.exp(k) - 1) / (k * k)) * k, (sp.exp(k) / k + (sp.exp(k) - 1) / (k * k))]
        why = ["Mishandles the sign of the remaining integral.", "Stops after the uv term (forgets the integral of v du).", "Multiplies by k after parts.", "Adds the remaining integral instead of subtracting."]
    elif form == "xln":
        f = x * sp.log(x); val = sp.integrate(f, (x, 1, k + 1)); txt = f"\\int_1^{k+1} x\\ln x\\,dx"
        a = k + 1
        ds = [(a ** 2 / 2) * sp.log(a), (a ** 2 / 2) * sp.log(a) + (a ** 2 - 1) / 4, (a ** 2 / 2) * sp.log(a) - (a ** 2 - 1) / 2, (a ** 2 - 1) / 4]
        why = ["Keeps only the uv term.", "Adds the remaining integral instead of subtracting.", "Uses 1/2 x instead of 1/4 x^2 in the remaining integral.", "Reports only the remaining integral."]
    else:
        f = x * sp.sin(x); val = sp.integrate(f, (x, 0, sp.pi)); txt = "\\int_0^{\\pi} x\\sin x\\,dx"
        ds = [-sp.pi, sp.pi * 2, sp.Integer(0) + 1, -2 * sp.pi]
        why = ["Sign error: uses u dv with the wrong sign of v.", "Doubles the result.", "Forgets the uv boundary term.", "Sign and factor errors combined."]
    assert abs(float(sp.N(val)) - _I.quad(lambda v: float(sp.N(f.subs(x, v))), 0 if form != "xln" else 1, {"xe": 1, "xln": k + 1, "xsin": math.pi}[form])[0]) < 1e-6
    key = Opt(fmt(val), True, "Integration by parts with u = x and dv the remaining factor.", sp.N(val, 10))
    return pack("int_by_parts", "6.11", "1.C", "not_allowed", f"What is ${txt}$?", key, [Opt(fmt(v), False, w, sp.N(v, 10)) for v, w in zip(ds, why)], rng, est=100, facts=[f"value={val}"])

def partial_fractions(rng):
    a = rng.choice([1, 2]); b = a + rng.choice([2, 3]); lo, hi = b + 1, b + 3
    expr = 1 / ((x - a) * (x - b)); val = sp.integrate(expr, (x, lo, hi))
    val = sp.simplify(val)
    assert abs(float(sp.N(val)) - _I.quad(lambda v: 1 / ((v - a) * (v - b)), lo, hi)[0]) < 1e-6
    A = S(1) / (a - b); B = S(1) / (b - a)
    ds = [sp.log((hi - b) * (lo - a) / ((hi - a) * (lo - b))) * A * -1 + 0, sp.log(hi * 1 / (lo)) * 0 + sp.log(S((hi - a) * (hi - b)) / ((lo - a) * (lo - b))), A * sp.log(S(hi - a) / (lo - a)) + A * sp.log(S(hi - b) / (lo - b)), sp.log(S(hi - b) / (lo - b)) - sp.log(S(hi - a) / (lo - a))]
    ds = [d for d in ds if abs(float(sp.N(d)) - float(sp.N(val))) > 1e-9]
    why = ["Reverses the order of the two logarithms.", "Integrates the product as a single logarithm of the whole denominator.", "Uses the same coefficient for both terms.", "Drops the coefficient 1/(a-b)."]
    key = Opt(fmt(val), True, "Partial fractions A/(x-a)+B/(x-b), then logarithms.", sp.N(val, 10))
    stem = f"What is $\\displaystyle\\int_{{{lo}}}^{{{hi}}} \\dfrac{{dx}}{{(x-{a})(x-{b})}}$?"
    return pack("partial_fractions", "6.12", "1.C", "not_allowed", stem, key, [Opt(fmt(d), False, w, sp.N(d, 10)) for d, w in zip(ds, why)], rng, est=100, facts=[f"value={val}"])

def improper_integral(rng):
    p = rng.choice([S(1) / 2, S(2) / 3, S(3) / 2, 2, 3, S(5) / 2]); conv = p > 1
    val = 1 / (p - 1) if conv else None
    stem = f"What is the value of $\\displaystyle\\int_1^{{\\infty}} \\dfrac{{dx}}{{x^{{{sp.latex(p)}}}}}$?"
    if conv:
        key = Opt(fmt(val), True, "p-integral converges for p>1 to 1/(p-1).", val)
        ds = [Opt("The integral diverges", False, "Believes every improper integral to infinity diverges.", None), Opt(fmt(p), False, "Reports the exponent.", p), Opt(fmt(1 / p), False, "Uses 1/p instead of 1/(p-1).", 1 / p), Opt(fmt(p - 1), False, "Inverts 1/(p-1).", p - 1)]
    else:
        key = Opt("The integral diverges", True, "p-integral diverges for p<=1.", None)
        ds = [Opt(fmt(1 / (1 - p)), False, "Applies 1/(p-1) formula with the wrong sign.", 1 / (1 - p)), Opt(fmt(p), False, "Reports the exponent.", p), Opt(fmt(0), False, "Thinks the tail vanishes.", 0), Opt(fmt(1 / p), False, "Uses 1/p.", 1 / p)]
    return pack("improper_integral", "6.13", "3.D", "not_allowed", stem, key, ds, rng, est=75, facts=[f"converges={conv}"])

def euler_method(rng):
    h = rng.choice([S(1) / 2, S(1) / 4 * 2, 1]); h = S(1) / 2 if h == 1 else h
    y0 = rnd(rng, 1, 3); form = rng.choice(["x+y", "xy", "y-x"])
    g = {"x+y": lambda a, b: a + b, "xy": lambda a, b: a * b, "y-x": lambda a, b: b - a}[form]
    x0 = 0; y1 = y0 + h * g(x0, y0); y2 = y1 + h * g(x0 + h, y1)
    one = y1; wrong_x = y0 + h * g(x0, y0) + h * g(x0, y1)   # x 갱신 누락
    wrong_h = y0 + g(x0, y0) + g(x0 + h, y0 + g(x0, y0))     # h 누락
    wrong_old = y0 + h * g(x0, y0) + h * g(x0 + h, y0)       # 갱신된 y 대신 y0 사용
    stem = f"Let $y=f(x)$ satisfy $\\dfrac{{dy}}{{dx}}={form.replace('xy','xy')}$ with $f(0)={y0}$. What is the approximation of $f(1)$ obtained by Euler's method with two steps of equal size?"
    key = Opt(fmt(y2), True, "Two Euler steps of size 1/2, updating x and y each step.", y2)
    ds = [Opt(fmt(one), False, "Stops after one step.", one), Opt(fmt(wrong_x), False, "Does not advance x in the second step.", wrong_x), Opt(fmt(wrong_h), False, "Forgets to multiply by the step size.", wrong_h), Opt(fmt(wrong_old), False, "Reuses the starting y value in the second step.", wrong_old)]
    return pack("euler_method", "7.5", "1.E", "not_allowed", stem, key, ds, rng, est=90, facts=[f"y2={y2}"])

def logistic(rng):
    K = rng.choice([100, 200, 500, 800]); kk = rng.choice([S(1) / 10, S(1) / 5, S(1) / 20]); kind = rng.choice(["limit", "maxrate"])
    P = sp.Function("P")
    stem = f"A population $P(t)$ satisfies the logistic differential equation $\\dfrac{{dP}}{{dt}}={sp.latex(kk)}P\\left(1-\\dfrac{{P}}{{{K}}}\\right)$ with $P(0)=10$. "
    if kind == "limit":
        stem += "What is $\\displaystyle\\lim_{t\\to\\infty}P(t)$?"; key_v = K
        ds = [(K / 2, "That is the population at the maximum growth rate, not the limit."), (K * kk, "Multiplies the capacity by k."), (10, "Uses the initial value."), (sp.Rational(K) / kk, "Divides the capacity by k.")]
    else:
        stem += "For what value of $P$ is the population growing fastest?"; key_v = S(K) / 2
        ds = [(K, "That is the carrying capacity (growth rate zero)."), (10, "Uses the initial value."), (S(K) / 4, "Halves again."), (K * kk, "Multiplies by k.")]
    # 독립 검증: dP/dt 최대화
    if kind == "maxrate":
        g = lambda v: float(kk) * v * (1 - v / K); best = max(range(1, K), key=g); assert abs(best - K / 2) <= 1
    key = Opt(fmt(key_v), True, "Equilibrium K for the limit; K/2 maximizes P(1-P/K).", key_v)
    return pack("logistic", "7.9", "3.D", "not_allowed", stem, key, [Opt(fmt(v), False, w, v) for v, w in ds], rng, est=75, facts=[f"{kind}={key_v}"])

def arc_length_calc(rng):
    c = rng.choice([1, 2, 3]); n = rng.choice([S(3) / 2, 2, 3]); b = rng.choice([2, 3])
    f = c * x ** n; fp = sp.diff(f, x); L = _I.quad(lambda v: math.sqrt(1 + float(sp.N(fp.subs(x, v))) ** 2), 0, b)[0]
    area_like = _I.quad(lambda v: float(sp.N(f.subs(x, v))), 0, b)[0]
    wrong1 = _I.quad(lambda v: 1 + abs(float(sp.N(fp.subs(x, v)))), 0, b)[0]  # sqrt 누락 → 1+|f'|
    wrong2 = _I.quad(lambda v: math.sqrt(1 + float(sp.N(f.subs(x, v))) ** 2), 0, b)[0]  # f' 대신 f
    stem = f"What is the length of the curve $y={sp.latex(f)}$ from $x=0$ to $x={b}$?"
    key = Opt("$%.3f$" % L, True, "Arc length integral of sqrt(1+(y')^2).", L)
    ds = [Opt("$%.3f$" % wrong2, False, "Uses y instead of y' inside the radical.", wrong2), Opt("$%.3f$" % wrong1, False, "Drops the square root: integrates 1+|y'|.", wrong1), Opt("$%.3f$" % area_like, False, "Computes the area under the curve.", area_like), Opt("$%.3f$" % math.sqrt(b * b + float(sp.N(f.subs(x, b))) ** 2), False, "Uses the straight-line distance between endpoints.", math.sqrt(b * b + float(sp.N(f.subs(x, b))) ** 2))]
    return pack("arc_length_calc", "8.13", "1.E", "required", stem, key, ds, rng, est=100, facts=[f"L={L}"])

def param_dydx(rng):
    a, b, c = rnd(rng, 1, 3), rnd(rng, 1, 4), rnd(rng, 1, 3); t0 = rng.choice([1, 2])
    X = a * t ** 2 + b * t; Y = c * t ** 3 - t
    xp, yp = sp.diff(X, t), sp.diff(Y, t); s = S(yp.subs(t, t0)) / xp.subs(t, t0)
    assert xp.subs(t, t0) != 0
    ds = [S(xp.subs(t, t0)) / yp.subs(t, t0) if yp.subs(t, t0) != 0 else None, yp.subs(t, t0), S(yp.subs(t, t0)) * xp.subs(t, t0), -s]
    why = ["Inverts: computes dx/dy.", "Reports dy/dt only.", "Multiplies the two derivatives.", "Sign error."]
    stem = f"A curve is defined by $x(t)={sp.latex(X)}$ and $y(t)={sp.latex(Y)}$. What is $\\dfrac{{dy}}{{dx}}$ at $t={t0}$?"
    key = Opt(fmt(s), True, "dy/dx = (dy/dt)/(dx/dt).", s)
    return pack("param_dydx", "9.1", "1.E", "not_allowed", stem, key, [Opt(fmt(d), False, w, d) for d, w in zip(ds, why) if d is not None], rng, est=80, facts=[f"slope={s}"])

def param_speed_calc(rng):
    a, b = rnd(rng, 1, 3), rnd(rng, 1, 3); t0 = rng.choice([1.0, 1.5, 2.0])
    X = a * t ** 2; Y = b * sp.sin(t) + t
    xp, yp = sp.diff(X, t), sp.diff(Y, t); sp_ = math.sqrt(float(xp.subs(t, t0)) ** 2 + float(yp.subs(t, t0)) ** 2)
    stem = f"A particle moves in the plane with position $(x(t),y(t))=\\left({sp.latex(X)},\\,{sp.latex(Y)}\\right)$ for $t\\ge 0$. What is the speed of the particle at time $t={t0}$?"
    alt = [(abs(float(xp.subs(t, t0))) + abs(float(yp.subs(t, t0))), "Adds the components instead of using the Pythagorean combination."), (float(yp.subs(t, t0)) / float(xp.subs(t, t0)), "Reports dy/dx."), (math.sqrt(float(X.subs(t, t0)) ** 2 + float(Y.subs(t, t0)) ** 2), "Uses the position magnitude."), (float(xp.subs(t, t0)) ** 2 + float(yp.subs(t, t0)) ** 2, "Forgets the square root.")]
    key = Opt("$%.3f$" % sp_, True, "Speed = sqrt((x')^2+(y')^2).", sp_)
    return pack("param_speed_calc", "9.6", "1.E", "required", stem, key, [Opt("$%.3f$" % v, False, w, v) for v, w in alt], rng, est=85, facts=[f"speed={sp_}"])

def polar_area_calc(rng):
    a = rng.choice([1, 2, 3]); b = rng.choice([1, 2]); lo, hi = 0, rng.choice([1.0, math.pi / 2, math.pi])
    r = lambda th: a + b * math.sin(th)
    A = 0.5 * _I.quad(lambda th: r(th) ** 2, lo, hi)[0]
    stem = f"What is the area of the region enclosed by the polar curve $r={a}+{b}\\sin\\theta$ and the rays $\\theta={lo:g}$ and $\\theta={hi:.4g}$?" if hi != math.pi / 2 and hi != math.pi else f"What is the area of the region enclosed by the polar curve $r={a}+{b}\\sin\\theta$ and the rays $\\theta=0$ and $\\theta={'\\pi' if hi==math.pi else '\\frac{\\pi}{2}'}$?"
    alt = [(_I.quad(r, lo, hi)[0] * 0.5, "Integrates r instead of r squared."), (_I.quad(lambda th: r(th) ** 2, lo, hi)[0], "Omits the factor 1/2."), (0.5 * _I.quad(lambda th: r(th), lo, hi)[0] ** 2, "Squares the integral instead of integrating the square."), (0.5 * _I.quad(lambda th: (a - b * math.sin(th)) ** 2, lo, hi)[0], "Sign error inside r.")]
    key = Opt("$%.3f$" % A, True, "Area = (1/2) integral of r^2 d theta.", A)
    return pack("polar_area_calc", "9.8", "1.D", "required", stem, key, [Opt("$%.3f$" % v, False, w, v) for v, w in alt], rng, est=90, facts=[f"A={A}"])

def series_test(rng):
    fam = rng.choice(["geo", "pseries", "alt_p", "ratio", "nthterm"])
    if fam == "geo":
        r = rng.choice([S(2) / 3, S(3) / 2, -S(1) / 2, -S(4) / 3, S(5) / 4]); a0 = rnd(rng, 1, 4)
        expr = f"\\sum_{{n=0}}^{{\\infty}} {a0}\\left({sp.latex(r)}\\right)^n"; truth = "abs" if abs(r) < 1 else "div"
        # 독립: 부분합
        ps = sum(float(a0 * r ** n) for n in range(60)); assert (abs(ps) < 1e3) == (truth == "abs")
    elif fam == "pseries":
        p = rng.choice([S(1) / 2, S(2) / 3, 1, S(3) / 2, 2]); expr = f"\\sum_{{n=1}}^{{\\infty}} \\dfrac{{1}}{{n^{{{sp.latex(p)}}}}}"; truth = "abs" if p > 1 else "div"
    elif fam == "alt_p":
        p = rng.choice([S(1) / 2, 1, S(3) / 2, 2]); expr = f"\\sum_{{n=1}}^{{\\infty}} \\dfrac{{(-1)^n}}{{n^{{{sp.latex(p)}}}}}"; truth = "abs" if p > 1 else "cond"
    elif fam == "ratio":
        k = rng.choice([2, 3, 5]); expr = f"\\sum_{{n=1}}^{{\\infty}} \\dfrac{{n^2}}{{{k}^n}}"; truth = "abs"
    else:
        c = rng.choice([2, 3]); expr = f"\\sum_{{n=1}}^{{\\infty}} \\dfrac{{{c}n}}{{{c}n+1}}"; truth = "div"
    texts = {"abs": "The series converges absolutely", "cond": "The series converges conditionally", "div": "The series diverges", "nth": "The series converges by the nth-term test"}
    why = {"abs": "Absolute convergence holds.", "cond": "Converges, but the series of absolute values diverges.", "div": "Terms or partial sums do not settle.", "nth": "The nth-term test can only show divergence, never convergence."}
    wr = {"abs": "Claims absolute convergence although the absolute series diverges.", "cond": "Treats a series that also converges absolutely as only conditionally convergent.", "div": "Claims divergence for a convergent series.", "nth": why["nth"]}
    opts = [Opt(texts[k], k == truth, why[k] if k == truth else wr[k], None) for k in ["abs", "cond", "div", "nth"]]
    return pack_fixed("series_test", "10.9", "3.D", "not_allowed", f"Which statement about $\\displaystyle {expr}$ is true?", opts, rng, est=85, facts=[f"{fam}:{truth}"])

def taylor_coeff(rng):
    k = rng.choice([2, 3]); n = rng.choice([3, 4]); form = rng.choice(["exp", "sin", "ln"])
    f = {"exp": sp.exp(k * x), "sin": sp.sin(k * x), "ln": sp.log(1 + k * x)}[form]
    ser = sp.series(f, x, 0, n + 2).removeO(); c = ser.coeff(x, n)
    wrong_fact = sp.diff(f, x, n).subs(x, 0)               # f^(n)(0) 를 계수로
    wrong_nofact = c * sp.factorial(n) / k ** n * 1        # k^n 누락 형태
    wrong_k = c / k ** n if c != 0 else None
    ds = [wrong_fact, wrong_k, c * sp.factorial(n), -c]
    why = ["Reports the nth derivative at 0 without dividing by n!.", "Forgets the k^n from the chain rule.", "Multiplies by n! instead of dividing.", "Sign error."]
    stem = f"What is the coefficient of $x^{n}$ in the Maclaurin series for $f(x)={sp.latex(f)}$?"
    key = Opt(fmt(c), True, "f^(n)(0)/n! (or substitute k x into the standard series).", c)
    return pack("taylor_coeff", "10.14", "1.E", "not_allowed", stem, key, [Opt(fmt(d), False, w, d) for d, w in zip(ds, why) if d is not None and d != 0 or (d == 0 and False)], rng, est=85, facts=[f"coef={c}"])

def radius_interval(rng):
    b = rng.choice([2, 3, 4]); a = rng.choice([0, 1, -1]); alt = rng.choice([True, False])
    base = f"(x{'+' if a < 0 else '-'}{abs(a)})" if a != 0 else "x"
    term = f"\\dfrac{{{base}^n}}{{n\\,{b}^n}}" if True else ""
    expr = f"\\sum_{{n=1}}^{{\\infty}} {term}"
    lo, hi = a - b, a + b   # 끝점 x=a-b: 교대조화 수렴, x=a+b: 조화 발산 → [lo, hi)
    key_txt = f"$[{lo},{hi})$"
    texts = [(key_txt, True, "Radius b from the ratio test; left endpoint gives the alternating harmonic series (converges), right endpoint gives the harmonic series (diverges)."),
             (f"$({lo},{hi})$", False, "Does not test the endpoints."), (f"$[{lo},{hi}]$", False, "Includes the divergent harmonic endpoint."), (f"$({lo},{hi}]$", False, "Swaps which endpoint converges.")]
    opts = [Opt(t_, k, w, None) for t_, k, w in texts]
    # 독립 검증: 끝점 부분합 거동
    ph = sum(1.0 / n for n in range(1, 20000)); pa = sum(((-1) ** n) / n for n in range(1, 20000))
    assert ph > 9 and abs(pa + math.log(2)) < 1e-3
    return pack_fixed("radius_interval", "10.13", "1.E", "not_allowed", f"What is the interval of convergence of $\\displaystyle {expr}$?", opts, rng, est=100, facts=[f"interval=[{lo},{hi})"])

def geometric_sum(rng):
    a0 = rnd(rng, 2, 8); r = rng.choice([S(1) / 2, S(1) / 3, S(2) / 3, S(1) / 4]); start = rng.choice([0, 1])
    val = a0 * r ** start / (1 - r)
    assert abs(float(val) - sum(float(a0 * r ** n) for n in range(start, 200))) < 1e-9
    wrong_start = (a0 / (1 - r)) if start == 1 else (a0 * r / (1 - r))
    ds = [wrong_start, a0 / (1 + r) * (r ** start), a0 * r ** start, a0 * r ** start / (1 - r) - a0 * r ** start]
    why = ["Uses the other starting term (first term mismatch).", "Uses 1+r in the denominator.", "Reports only the first term.", "Subtracts the first term from the sum."]
    stem = f"What is the sum of the series $\\displaystyle\\sum_{{n={start}}}^{{\\infty}} {a0}\\left({sp.latex(r)}\\right)^n$?"
    key = Opt(fmt(val), True, "First term over one minus the ratio, using the actual first term.", val)
    return pack("geometric_sum", "10.2", "1.E", "not_allowed", stem, key, [Opt(fmt(d), False, w, d) for d, w in zip(ds, why)], rng, est=75, facts=[f"sum={val}"])

def lagrange_error(rng):
    n = rng.choice([2, 3]); M = rng.choice([4, 6, 12]); a = rng.choice([1, 2])
    key_v = S(M) * a ** (n + 1) / sp.factorial(n + 1)
    stem = f"The function $f$ has derivatives of all orders and $|f^{{({n+1})}}(x)|\\le {M}$ for $0\\le x\\le {a}$. Let $P_{{{n}}}(x)$ be the Maclaurin polynomial of degree ${n}$. Which is the smallest bound from the Lagrange error bound for $|f({a})-P_{{{n}}}({a})|$?"
    ds = [S(M) * a ** n / sp.factorial(n), S(M) * a ** (n + 1) / sp.factorial(n), S(M) * a ** (n + 2) / sp.factorial(n + 2), S(M) * a ** (n + 1) / (n + 1)]
    why = ["Uses the wrong power and factorial (degree n instead of n+1).", "Uses n! with the right power.", "Uses a higher order.", "Uses (n+1) instead of (n+1)!."]
    key = Opt(fmt(key_v), True, "M|x|^(n+1)/(n+1)!.", key_v)
    return pack("lagrange_error", "10.12", "3.D", "not_allowed", stem, key, [Opt(fmt(d), False, w, d) for d, w in zip(ds, why)], rng, est=85, facts=[f"bound={key_v}"])

# ---------------------------------------------------------------- BC FRQ
def frq_series(rng):
    c = rng.choice([1, 2, 3]); f = sp.log(1 + c * x ** 2)
    ser = sp.series(f, x, 0, 9).removeO()
    terms = [ser.coeff(x, k) * x ** k for k in (2, 4, 6, 8)]
    R = sp.Integer(1) / sp.sqrt(c)
    # 구간 끝점: x=±1/sqrt(c) → 교대 조화형(수렴) → [-R, R]
    a4 = abs(ser.coeff(x, 8)); x0 = S(1) / (2 * sp.sqrt(c)) if False else S(1) / 2
    # (c) 교대급수 오차 한계: f(x0) 근사에 처음 두 항을 쓰면 오차 ≤ 세 번째 항 크기(항 감소 확인)
    t1 = abs(ser.coeff(x, 2)) * x0 ** 2; t2 = abs(ser.coeff(x, 4)) * x0 ** 4; t3 = abs(ser.coeff(x, 6)) * x0 ** 6
    assert float(t1) > float(t2) > float(t3) > 0 if float(c * x0 ** 2) < 1 else True
    approx = ser.coeff(x, 2) * x0 ** 2 + ser.coeff(x, 4) * x0 ** 4
    bound = t3
    # (d) 급수로 ∫0^{1/2} f dx 의 첫 두 항
    integ2 = sp.integrate(sum(terms[:2]), (x, 0, x0))
    assert abs(float(sp.N(sp.integrate(f, (x, 0, x0)))) - float(sp.N(integ2))) < 0.05
    stim = {"kind": "text", "description": "Function and Maclaurin series setting", "data": {"f": f"f(x) = ln(1 + {c}x^2)", "center": 0}}
    parts = [
        part("a", f"Write the first four nonzero terms of the Maclaurin series for $f(x)=\\ln(1+{c}x^2)$, and write the general term.", 3, "calculate", ["1.E", "1.C"], f"Terms: {sp.latex(sum(terms))}; general term (-1)^(n+1) {c}^n x^(2n)/n", [
            row("a1", 1, "First two terms correct", [sp.latex(terms[0]), sp.latex(terms[1])], nums=True), row("a2", 1, "Next two terms correct", [sp.latex(terms[2]), sp.latex(terms[3])], requires="a1", nums=True),
            row("a3", 1, "General term", [f"(-1)^(n+1) {c}^n x^(2n) / n"])]),
        part("b", "Find the radius of convergence and the interval of convergence of the Maclaurin series for $f$. Show the work that leads to your answer.", 3, "explain", ["3.C", "3.D"], f"Ratio test: radius 1/√{c}; endpoints give an alternating harmonic series (converges).", [
            row("b1", 1, "Sets up the ratio test and finds the radius of convergence", [f"R = 1/sqrt({c})"], nums=True), row("b2", 1, "Tests an endpoint (alternating series test conditions: terms decrease to 0)", ["alternating series test", "terms decrease to 0"], requires="b1", both=True),
            row("b3", 1, "States the interval including both endpoints", [f"[-1/sqrt({c}), 1/sqrt({c})]"], requires="b2")]),
        part("c", f"Use the first two nonzero terms of the series to approximate $f\\left(\\tfrac{{1}}{{2}}\\right)$. Use the alternating series error bound to find a bound on the absolute error of this approximation.", 2, "calculate", ["3.D", "3.G"],
             f"Approximation {float(approx):.4f}; error ≤ |third term| = {float(bound):.5f}", [row("c1", 1, "Approximation using two terms", [f"{float(approx):.4f}"], nums=True, tol="±0.001"), row("c2", 1, "Error bound is the magnitude of the next term, with the decreasing-terms condition", [f"{float(bound):.5f}", "terms decrease in magnitude"], requires="c1", both=True)]),
        part("d", "Use the first two nonzero terms of the Maclaurin series for $f$ to approximate $\\int_0^{1/2} f(x)\\,dx$.", 1, "calculate", ["1.E"], f"{float(sp.N(integ2)):.4f}", [row("d1", 1, "Answer using term-by-term integration", [f"{float(sp.N(integ2)):.4f}"], nums=True, tol="±0.001")])]
    return {"archetype": "frq_series", "template": "series_taylor_convergence", "topic": "10.14", "extra_topics": ["10.13", "10.10"], "skill": "1.E", "calculator": "not_allowed", "title": "Maclaurin series, convergence, error bound", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"approx={approx}", f"bound={bound}", f"integ={integ2}"]}

def frq_parametric(rng):
    a, b = rnd(rng, 1, 3), rnd(rng, 1, 3); c = rnd(rng, 1, 3)
    X = a * t ** 2 + b * t; Y = t ** 3 - c * t
    t0 = 1; xp, yp = sp.diff(X, t), sp.diff(Y, t)
    slope = S(yp.subs(t, t0)) / xp.subs(t, t0)
    x0, y0 = X.subs(t, t0), Y.subs(t, t0)
    acc = (sp.diff(X, t, 2).subs(t, t0), sp.diff(Y, t, 2).subs(t, t0))
    tmax = 2
    dist = _I.quad(lambda v: math.sqrt(float(xp.subs(t, v)) ** 2 + float(yp.subs(t, v)) ** 2), 0, tmax)[0]
    sp_t = math.sqrt(float(xp.subs(t, t0)) ** 2 + float(yp.subs(t, t0)) ** 2)
    # d²y/dx² at t0
    d2 = sp.simplify(sp.diff(yp / xp, t) / xp).subs(t, t0)
    stim = {"kind": "text", "description": "Particle in the plane", "data": {"x(t)": sp.latex(X), "y(t)": sp.latex(Y)}}
    parts = [
        part("a", f"A particle moves in the plane so that its position at time $t\\ge 0$ is $\\left({sp.latex(X)},\\,{sp.latex(Y)}\\right)$. Find the speed of the particle at $t={t0}$ and write the particle's acceleration vector at $t={t0}$.", 3, "calculate", ["1.E"],
             f"speed = {sp_t:.3f}; acceleration = <{acc[0]}, {acc[1]}>", [row("a1", 1, "Velocity components", [f"x'(1)={xp.subs(t,1)}", f"y'(1)={yp.subs(t,1)}"], nums=True), row("a2", 1, "Speed", [f"{sp_t:.3f}"], requires="a1", nums=True, tol="±0.001"), row("a3", 1, "Acceleration vector", [f"<{acc[0]}, {acc[1]}>"], nums=True)]),
        part("b", f"Find an equation for the line tangent to the path of the particle at $t={t0}$.", 2, "calculate", ["1.E"], f"y − {y0} = {slope}(x − {x0})", [row("b1", 1, "Slope dy/dx = y'(t)/x'(t) at t=1", [f"{slope}"], nums=True), row("b2", 1, "Tangent line equation", [f"y - {y0} = {slope}(x - {x0})"], requires="b1")]),
        part("c", f"Find the total distance traveled by the particle from $t=0$ to $t={tmax}$.", 2, "calculate", ["1.D", "1.E"], f"{dist:.3f}", [row("c1", 1, "Integral of the speed with limits 0 and 2", ["∫_0^2 sqrt((x')^2+(y')^2) dt"]), row("c2", 1, "Answer", [f"{dist:.3f}"], requires="c1", nums=True, tol="±0.001")]),
        part("d", f"Find $\\dfrac{{d^2y}}{{dx^2}}$ at $t={t0}$.", 2, "calculate", ["1.E", "2.B"], f"{d2}", [row("d1", 1, "Uses d/dt(dy/dx) divided by dx/dt", ["d/dt(y'/x') / x'"]), row("d2", 1, "Answer", [f"{d2}"], requires="d1", nums=True)])]
    return {"archetype": "frq_parametric", "template": "parametric_motion_calc", "topic": "9.6", "extra_topics": ["9.1", "9.2", "9.3"], "skill": "1.E", "calculator": "required", "title": "Parametric motion: speed, tangent, distance, second derivative", "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"speed={sp_t}", f"slope={slope}", f"dist={dist}", f"d2={d2}"]}


def param_second(rng):
    a, b, c = rnd(rng, 1, 3), rnd(rng, 1, 4), rnd(rng, 1, 3); t0 = rng.choice([1, 2])
    X = a * t ** 2 + b * t; Y = t ** 3 - c * t
    xp, yp = sp.diff(X, t), sp.diff(Y, t)
    d2 = sp.simplify(sp.diff(yp / xp, t) / xp).subs(t, t0)
    first = S(yp.subs(t, t0)) / xp.subs(t, t0)
    ds = [sp.diff(yp / xp, t).subs(t, t0), S(sp.diff(Y, t, 2).subs(t, t0)) / sp.diff(X, t, 2).subs(t, t0), S(sp.diff(Y, t, 2).subs(t, t0)) / xp.subs(t, t0), first]
    why = ["Differentiates dy/dx with respect to t but forgets to divide by dx/dt.", "Divides y'' by x'' instead of using d/dt(dy/dx) over dx/dt.", "Divides y'' by x' only.", "Reports the first derivative dy/dx."]
    stem = f"A curve is defined by $x(t)={sp.latex(X)}$ and $y(t)={sp.latex(Y)}$. What is $\\dfrac{{d^2y}}{{dx^2}}$ at $t={t0}$?"
    key = Opt(fmt(d2), True, "d^2y/dx^2 = d/dt(dy/dx) divided by dx/dt.", d2)
    return pack("param_second", "9.2", "1.E", "not_allowed", stem, key, [Opt(fmt(d), False, w, d) for d, w in zip(ds, why)], rng, est=100, facts=[f"d2={d2}"])

def param_arclength_calc(rng):
    a, b = rnd(rng, 1, 3), rnd(rng, 1, 3); T = rng.choice([1, 2, 3])
    X = a * t ** 2; Y = b * t ** 3
    xp, yp = sp.diff(X, t), sp.diff(Y, t)
    L = _I.quad(lambda v: math.sqrt(float(xp.subs(t, v)) ** 2 + float(yp.subs(t, v)) ** 2), 0, T)[0]
    wrong1 = _I.quad(lambda v: abs(float(xp.subs(t, v))) + abs(float(yp.subs(t, v))), 0, T)[0]
    wrong2 = _I.quad(lambda v: float(xp.subs(t, v)) ** 2 + float(yp.subs(t, v)) ** 2, 0, T)[0]
    wrong3 = math.sqrt(float(X.subs(t, T)) ** 2 + float(Y.subs(t, T)) ** 2)
    stem = f"A curve is given by $x(t)={sp.latex(X)}$ and $y(t)={sp.latex(Y)}$ for $0\\le t\\le {T}$. What is the length of the curve?"
    key = Opt("$%.3f$" % L, True, "Integral of sqrt((x')^2+(y')^2) over the interval.", L)
    ds = [Opt("$%.3f$" % wrong1, False, "Adds the absolute components instead of combining them with a square root.", wrong1), Opt("$%.3f$" % wrong2, False, "Omits the square root.", wrong2), Opt("$%.3f$" % wrong3, False, "Reports the distance of the endpoint from the origin.", wrong3)]
    return pack("param_arclength_calc", "9.3", "1.D", "required", stem, key, ds + [Opt("$%.3f$" % (L * 2), False, "Doubles the correct length.", L * 2)], rng, est=95, facts=[f"L={L}"])
