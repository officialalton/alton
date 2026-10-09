"""AB 계산기 필수 일반 MC 신규 원형 I군(2026-10-09, 단계 S3 '일반' 14칸): 그래프 없는 계산기 문항. 식·정답은 sympy, 독립 수치 경로(중심차분·quad·brentq)로 재확인."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts

SUBJ = "ap_calculus_ab"


def _bpg(*a, **k):
    return bp(*a, **k)


def _fin(arch, topic, skill, stem, key, ds, rng, bpr, est, facts):
    pool = dopts(ds, key.value)
    return pack(arch, topic, skill, "required", stem, key, pool, rng, est=est, facts=facts, extra={"blueprint": bpr})


# 1) 2.9 몫의 법칙: (e^{ax} + b)/(x^2 + c) 의 한 점 미분계수
def c_quotient_deriv_calc(rng):
    a, b, c, p = rng.choice([0.3, 0.4, 0.5]), rng.randint(1, 4), rng.randint(1, 4), rng.choice([1, 2, 3])
    f = (sp.exp(a * x) + b) / (x ** 2 + c)
    key_v = float(sp.diff(f, x).subs(x, p))
    ff = sp.lambdify(x, f, "math")
    hh = 1e-6
    if abs((ff(p + hh) - ff(p - hh)) / (2 * hh) - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    N, D = math.exp(a * p) + b, p * p + c
    Np, Dp = a * math.exp(a * p), 2 * p
    ds = [("Divides the derivatives, N'/D', instead of using the quotient rule.", Np / Dp), ("Adds the terms of the numerator, N' D + N D', instead of subtracting.", (Np * D + N * Dp) / D ** 2),
          ("Divides by D instead of D squared.", (Np * D - N * Dp) / D), ("Reverses the order of the numerator: N D' - N' D.", (N * Dp - Np * D) / D ** 2)]
    stem = f"Let $f(x)=\\dfrac{{e^{{{a}x}}+{b}}}{{x^{{2}}+{c}}}$. What is the value of $f'({p})$?"
    key = Opt(dec(key_v), True, "Quotient rule: f' = (N' D - N D')/D^2 evaluated at x = %d with a calculator." % p, key_v)
    bpr = _bpg("c_quotient_deriv_calc", "2.9", "1.E", "required", "Evaluate the derivative of a quotient with an exponential numerator at a point",
               ["Identify the numerator and denominator and differentiate each", "Apply the quotient rule with the numerator in the right order", "Evaluate with a calculator"],
               [("the denominator x^2 + c is positive so f is differentiable everywhere", "x squared plus a positive constant")],
               [("quotient_of_derivatives", "divides derivatives"), ("sign_error", "adds numerator terms"), ("no_square", "does not square the denominator"), ("reversed_numerator", "reverses the numerator")],
               "central difference (step 1e-6) of the original function (independent of the quotient rule)", {"type": "none", "must_include": []})
    return _fin("c_quotient_deriv_calc", "2.9", "1.E", stem, key, ds, rng, bpr, 80, [f"key={key_v:.6f}"])


# 2) 2.10 삼각함수 도함수: x sec x 의 한 점 미분계수
def c_trig_deriv_calc(rng):
    k, p = rng.choice([1, 2, 3]), rng.choice([0.4, 0.5, 0.6, 0.7])
    f = k * x * sp.sec(x)
    key_v = float(sp.diff(f, x).subs(x, p))
    ff = sp.lambdify(x, f, "math")
    hh = 1e-6
    if abs((ff(p + hh) - ff(p - hh)) / (2 * hh) - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    sec, tan = 1 / math.cos(p), math.tan(p)
    ds = [("Differentiates sec x as sec^2 x instead of sec x tan x.", k * (sec + p * sec * sec)), ("Leaves out the product rule term k sec x and keeps only k x sec x tan x.", k * p * sec * tan),
          ("Treats x sec x as the product of the derivatives, 1 times sec x tan x.", k * sec * tan), ("Uses cos x in place of sec x for the derivative of sec.", k * (sec + p * math.cos(p) * tan))]
    stem = f"Let $f(x)={k}x\\sec x$. What is the value of $f'({p})$? (Angles are in radians.)"
    key = Opt(dec(key_v), True, "Product rule with (sec x)' = sec x tan x: f' = k sec x + k x sec x tan x, evaluated with a calculator.", key_v)
    bpr = _bpg("c_trig_deriv_calc", "2.10", "1.C", "required", "Choose and apply the product rule with the derivative of secant",
               ["Recognize the product of x and sec x", "Use (sec x)' = sec x tan x in the product rule", "Evaluate numerically in radians"],
               [("sec x is defined and differentiable at x = p because cos p is not zero", "p is between 0 and pi/2")],
               [("sec_derivative_wrong", "uses sec squared"), ("missing_term", "drops a product rule term"), ("product_of_derivatives", "multiplies derivatives"), ("cos_for_sec", "uses cosine for secant")],
               "central difference (step 1e-6) of the original function (independent of the symbolic derivative)", {"type": "none", "must_include": []})
    return _fin("c_trig_deriv_calc", "2.10", "1.C", stem, key, ds, rng, bpr, 80, [f"key={key_v:.6f}"])


# 3) 3.2 음함수: x e^y + y^2 = c 위의 점에서 기울기
def c_implicit_slope_calc(rng):
    x0, y0 = rng.choice([1, 2, 3]), rng.choice([1, 2])
    cst = x0 * math.exp(y0) + y0 ** 2
    num = -math.exp(y0)
    den = x0 * math.exp(y0) + 2 * y0
    key_v = num / den
    # 독립 경로: 곡선을 y(x) 로 수치 해석(brentq)하고 중심차분
    yx = lambda xx: _O.brentq(lambda yy: xx * math.exp(yy) + yy * yy - cst, y0 - 1.5, y0 + 1.5, xtol=1e-14)
    hh = 1e-5
    if abs((yx(x0 + hh) - yx(x0 - hh)) / (2 * hh) - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Differentiates y^2 as 2y without the factor dy/dx.", -(math.exp(y0) + 2 * y0) / (x0 * math.exp(y0))), ("Forgets the 2y dy/dx term from y squared and solves e^y + x e^y y' = 0.", -math.exp(y0) / (x0 * math.exp(y0))),
          ("Gets the sign wrong: dy/dx = e^y/(x e^y + 2y).", math.exp(y0) / den), ("Treats y as a constant when differentiating x e^y, so the e^y term is missing from the numerator: -1/(...) .", -1 / den)]
    stem = f"A curve is defined by $xe^{{y}}+y^{{2}}={cst:.4f}$. The point $({x0},{y0})$ lies on the curve. What is $\\dfrac{{dy}}{{dx}}$ at this point?"
    key = Opt(dec(key_v), True, "Implicit differentiation: e^y + x e^y y' + 2y y' = 0, so y' = -e^y/(x e^y + 2y), evaluated with a calculator.", key_v)
    bpr = _bpg("c_implicit_slope_calc", "3.2", "1.E", "required", "Find a slope by implicit differentiation of a curve mixing an exponential and a power of y",
               ["Differentiate both sides with respect to x using the product and chain rules", "Solve for dy/dx", "Evaluate at the point with a calculator"],
               [("the denominator x e^y + 2y is not zero at the point", "all terms are positive at the given point")],
               [("missing_dydx_on_square", "forgets dy/dx on y squared"), ("missing_product_term", "drops the product rule term"), ("sign_error", "wrong sign"), ("y_constant", "treats y as constant")],
               "the curve is solved for y(x) with Brent's method near the point and differentiated by central difference (independent of implicit differentiation)", {"type": "none", "must_include": []})
    return _fin("c_implicit_slope_calc", "3.2", "1.E", stem, key, ds, rng, bpr, 95, [f"key={key_v:.6f}"])


# 4) 4.5 관련 변화율: 원뿔 용기에 물을 채울 때 수면의 상승 속도
def c_related_rates_cone_calc(rng):
    r_over_h = rng.choice([Fr(1, 2), Fr(1, 3), Fr(3, 4)])
    q, h0 = rng.choice([4, 6, 8, 10]), rng.choice([2, 3, 5])
    k = float(r_over_h)
    # V = (1/3) pi (k h)^2 h = (pi k^2/3) h^3  →  dh/dt = q / (pi k^2 h^2)
    key_v = q / (math.pi * k * k * h0 * h0)
    # 독립 경로: V(h) 를 수치로 역함수화해 중심차분
    V = lambda hh_: math.pi * k * k * hh_ ** 3 / 3
    hh = 1e-6
    Vt = V(h0)
    dt = 1e-6
    h_of_V = lambda vv: _O.brentq(lambda z: V(z) - vv, 0.01, 50, xtol=1e-14)
    if abs((h_of_V(Vt + q * dt) - h_of_V(Vt - q * dt)) / (2 * dt) - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Uses V = (1/3) pi r^2 h with r = %s h but differentiates only h, forgetting that r also changes: dh/dt = q/((pi/3) r^2)." % r_over_h, q / (math.pi / 3 * (k * h0) ** 2)), ("Forgets the factor 1/3 in the cone volume.", key_v / 3),
          ("Takes the radius equal to the depth, r = h, ignoring the ratio %s: dh/dt = q/(pi h^2)." % r_over_h, q / (math.pi * h0 * h0)), ("Differentiates h^3 as 3h without the other factor of h: dh/dt = q/(pi k^2 h^2) * h.", key_v * h0)]
    stem = f"Water is poured into a conical tank whose radius is always {r_over_h} times the water depth $h$ (both in meters). The volume of water increases at a constant ${q}$ cubic meters per minute. How fast, in meters per minute, is the depth increasing when $h={h0}$ meters?"
    key = Opt(dec(key_v), True, "V = (pi/3) r^2 h with r = (%s) h gives V = (pi k^2/3) h^3, so dV/dt = pi k^2 h^2 dh/dt and dh/dt = q/(pi k^2 h^2)." % r_over_h, key_v)
    bpr = _bpg("c_related_rates_cone_calc", "4.5", "1.D", "required", "Solve a related rates problem by eliminating the radius from the cone volume before differentiating",
               ["Write V in terms of h alone using r = k h", "Differentiate with respect to time with the chain rule", "Solve for dh/dt and evaluate numerically"],
               [("r is proportional to h at every instant so V can be written in terms of h alone", "stated in the problem")],
               [("radius_held_fixed", "differentiates only h"), ("missing_third", "forgets 1/3"), ("radius_for_height", "mixes r and h"), ("power_slip", "wrong power of h")],
               "V(h) inverted numerically by Brent's method and differentiated by central difference in time (independent of the chain rule)", {"type": "none", "must_include": []})
    return _fin("c_related_rates_cone_calc", "4.5", "1.D", stem, key, ds, rng, bpr, 105, [f"key={key_v:.6f}"])


# 5) 5.6 변곡점: f(x) = x^3 e^{-x/c}
def c_inflection_calc(rng):
    c = rng.choice([1, 2, 3])
    f = x ** 3 * sp.exp(-x / c)
    f2 = sp.diff(f, x, 2)
    roots = [float(r) for r in sp.Poly(sp.simplify(f2 * sp.exp(x / c)), x).nroots() if abs(sp.im(r)) < 1e-12 and sp.re(r) > 1e-9]
    roots = sorted(float(sp.re(r)) for r in sp.Poly(sp.simplify(f2 * sp.exp(x / c)), x).nroots() if abs(sp.im(r)) < 1e-9 and sp.re(r) > 1e-9)
    if len(roots) != 2:
        raise ValueError("unexpected_roots")
    key_v = roots[1]
    ff2 = sp.lambdify(x, f2, "math")
    if abs(ff2(key_v)) > 1e-7 or abs(_O.brentq(ff2, roots[1] - 0.3, roots[1] + 0.3) - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    crit = float(3 * c)
    ds = [("Reports the x-coordinate 3c of the critical point (where f' = 0) instead of an inflection point.", crit), ("Reports the smaller inflection point.", roots[0]),
          ("Reports 6c, a guess from the scale of the exponential.", 6.0 * c), ("Reports the x-value where f'' is largest.", (roots[0] + roots[1]) / 2)]
    stem = f"Let $f(x)=x^{{3}}e^{{-x/{c}}}$ for $x>0$. The graph of $f$ has two points of inflection. What is the $x$-coordinate of the one with the larger $x$-value?"
    key = Opt(dec(key_v), True, "Solve f''(x) = 0 on x > 0 with a calculator; f'' changes sign at both roots, and the larger root is the answer.", key_v)
    bpr = _bpg("c_inflection_calc", "5.6", "2.E", "required", "Locate points of inflection by solving f'' = 0 numerically",
               ["Compute f'' using the product and chain rules", "Solve f''(x) = 0 on x > 0 with a calculator", "Choose the larger root where f'' changes sign"],
               [("f'' is a polynomial times e^(-x/c) so its sign changes exactly at its simple roots", "both roots are simple")],
               [("critical_point", "reports the critical point"), ("smaller_root", "reports the smaller root"), ("guess", "guesses a value"), ("midpoint", "reports the midpoint of the roots")],
               "Brent's method on the lambdified f'' near the reported root and a sign-change check (independent of the polynomial root finder)", {"type": "none", "must_include": []})
    return _fin("c_inflection_calc", "5.6", "2.E", stem, key, ds, rng, bpr, 100, [f"c={c}", f"roots={roots}"])


# 6) 5.7 2계 도함수 판정: f(x) = x^2 e^{-x/c} 의 상대 최댓값
def c_second_deriv_test_calc(rng):
    c, k = rng.choice([1, 2]), rng.choice([2, 3, 4])
    f = k * x ** 2 * sp.exp(-x / c)
    crit = 2 * c
    key_v = float(f.subs(x, crit))
    f2 = sp.lambdify(x, sp.diff(f, x, 2), "math")
    if f2(crit) >= 0 or abs(float(sp.diff(f, x).subs(x, crit))) > 1e-9:
        raise ValueError("bad_critical_point")
    ff = sp.lambdify(x, f, "math")
    if max(ff(i / 1000) for i in range(0, 20001)) - key_v > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports f''(%d), the value of the second derivative, instead of the value of f." % crit, f2(crit)), ("Reports f(0) = 0, the value at the other critical point, which is a relative minimum.", 0.0 + 0.0001),
          ("Reports the critical number %d instead of the function value." % crit, float(crit)), ("Uses e^(-x) instead of e^(-x/%d) when evaluating f(%d)." % (c, crit), float(k * crit ** 2 * math.exp(-crit)))]
    stem = f"Let $f(x)={k}x^{{2}}e^{{-x/{c}}}$ for $x\\ge 0$. By the Second Derivative Test, $f$ has a relative maximum at a critical number $c>0$. What is the relative maximum value of $f$?"
    key = Opt(dec(key_v), True, "f' = 0 at x = %d and f''(%d) < 0, so the relative maximum value is f(%d), evaluated with a calculator." % (crit, crit, crit), key_v)
    bpr = _bpg("c_second_deriv_test_calc", "5.7", "3.D", "required", "Apply the Second Derivative Test and report the extreme value",
               ["Find the critical numbers from f' = 0", "Use the sign of f'' to identify the relative maximum", "Evaluate f at that critical number with a calculator"],
               [("f is twice differentiable and f''(c) < 0 at the critical number c", "verified by the sign of f'' at x = 2c")],
               [("second_derivative_value", "reports f''"), ("other_critical_point", "reports the minimum value"), ("location_not_value", "reports the x-coordinate"), ("wrong_exponent", "uses the wrong exponent")],
               "maximum of f over a fine grid on [0, 20] compared with f at the critical number (independent of the Second Derivative Test)", {"type": "none", "must_include": []})
    return _fin("c_second_deriv_test_calc", "5.7", "3.D", stem, key, ds, rng, bpr, 95, [f"c={c}", f"k={k}", f"key={key_v:.6f}"])


# 7) 5.5 닫힌 구간의 절대 최댓값
def c_abs_extreme_calc(rng):
    a, b = rng.choice([2, 3, 4]), rng.choice([0.5, 0.8, 1.0])
    f = -(x - a) * sp.exp(-b * x) + x / 3
    lo, hi = 0.0, 6.0
    ff = sp.lambdify(x, f, "math")
    fp = sp.lambdify(x, sp.diff(f, x), "math")
    grid = [lo + (hi - lo) * i / 6000 for i in range(6001)]
    best = max(grid, key=ff)
    key_v = ff(best)
    crit = [_O.brentq(fp, grid[i], grid[i + 1], xtol=1e-13) for i in range(6000) if fp(grid[i]) * fp(grid[i + 1]) < 0]
    cands = {t_: ff(t_) for t_ in [lo, hi] + crit}
    bx = max(cands, key=cands.get)
    if abs(cands[bx] - key_v) > 1e-5 or bx in (lo, hi) and False:
        raise ValueError("independent_check_failed")
    others = [v_ for t_, v_ in cands.items() if t_ != bx]
    if len(others) < 2 or abs(key_v) < 0.05:
        raise ValueError("not_enough_candidates")
    ds = [("Reports the value at a different candidate (a critical point or endpoint) rather than the largest.", others[0]), ("Reports the value at another candidate rather than the largest.", others[1]),
          ("Reports the x-coordinate where the maximum occurs instead of the maximum value.", bx), ("Evaluates f at x = %d, a zero of the first factor, instead of at the candidates." % a, float(ff(a)))]
    stem = f"Let $f(x)=-(x-{a})e^{{-{b}x}}+\\dfrac{{x}}{{3}}$. What is the absolute maximum value of $f$ on the interval $[0,6]$?"
    key = Opt(dec(key_v), True, "Candidates test: solve f'(x) = 0 on (0, 6) with a calculator, then compare f at the critical points and at the endpoints; the largest value is the maximum.", key_v)
    bpr = _bpg("c_abs_extreme_calc", "5.5", "1.E", "required", "Find an absolute maximum on a closed interval with the candidates test using a calculator",
               ["Differentiate and solve f' = 0 numerically on the interval", "Evaluate f at each critical point and both endpoints", "Select the largest value"],
               [("f is continuous on [0, 6] so the Extreme Value Theorem guarantees an absolute maximum", "f is a sum of continuous functions")],
               [("other_candidate", "reports a smaller candidate value"), ("location_not_value", "reports the x-coordinate"), ("wrong_point", "evaluates at x = a")],
               "maximum of f over a 6001-point grid on [0, 6] (independent of the candidate comparison)", {"type": "none", "must_include": []})
    return _fin("c_abs_extreme_calc", "5.5", "1.E", stem, key, ds, rng, bpr, 105, [f"a={a}", f"b={b}", f"key={key_v:.6f}"])


# 8) 6.2 중점 리만 합(함수): 4 구간
def c_midpoint_sum_calc(rng):
    k, hi = rng.choice([2, 3, 5]), rng.choice([2, 4])
    f = sp.sqrt(1 + x ** 3 / k)
    ff = sp.lambdify(x, f, "math")
    n = 4
    w = hi / n
    mids = [w * (i + 0.5) for i in range(n)]
    key_v = w * sum(ff(m) for m in mids)
    left = w * sum(ff(w * i) for i in range(n))
    right = w * sum(ff(w * (i + 1)) for i in range(n))
    trap = (left + right) / 2
    exact = _I.quad(ff, 0, hi)[0]
    if abs(key_v - sum(ff(m) * w for m in mids)) > 1e-12:
        raise ValueError("independent_check_failed")
    ds = [("Uses left endpoints instead of midpoints.", left), ("Uses right endpoints instead of midpoints.", right), ("Uses the trapezoidal sum instead of the midpoint sum.", trap), ("Reports the exact value of the integral instead of the midpoint approximation.", exact)]
    stem = f"A midpoint Riemann sum with 4 subintervals of equal length is used to approximate $\\int_0^{{{hi}}}\\sqrt{{1+\\dfrac{{x^{{3}}}}{{{k}}}}}\\,dx$. What is the value of the approximation?"
    key = Opt(dec(key_v), True, "Width %s; midpoints %s; sum of f at the midpoints times the width, evaluated with a calculator." % (w, ", ".join("%s" % m for m in mids)), key_v)
    bpr = _bpg("c_midpoint_sum_calc", "6.2", "1.E", "required", "Compute a midpoint Riemann sum for a non-elementary integrand with a calculator",
               ["Find the width and the midpoints of the four subintervals", "Evaluate the integrand at each midpoint with a calculator", "Multiply the sum of values by the width"],
               [("the subintervals have equal length so the midpoints are w(i + 1/2)", "stated in the problem")],
               [("left_sum", "left endpoints"), ("right_sum", "right endpoints"), ("trapezoid", "trapezoids"), ("exact_integral", "exact value")],
               "direct sum of the lambdified integrand at the midpoints (independent of the closed form of the points)", {"type": "none", "must_include": []})
    return _fin("c_midpoint_sum_calc", "6.2", "1.E", stem, key, ds, rng, bpr, 90, [f"k={k}", f"hi={hi}", f"key={key_v:.6f}"])


# 9) 6.4 FTC + 연쇄법칙(수치): F(x) = ∫_1^{x^2} e^{-t^2/c} dt
def c_ftc_chain_calc(rng):
    c, p = rng.choice([8, 10, 12]), rng.choice([1.2, 1.3, 1.5])
    key_v = 2 * p * math.exp(-(p * p) ** 2 / c)
    F = lambda xx: _I.quad(lambda t_: math.exp(-t_ * t_ / c), 1, xx * xx)[0]
    hh = 1e-6
    if abs((F(p + hh) - F(p - hh)) / (2 * hh) - key_v) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the chain rule factor 2x.", math.exp(-(p * p) ** 2 / c)), ("Evaluates the integrand at x instead of at x squared: 2x e^(-x^2/c).", 2 * p * math.exp(-p * p / c)),
          ("Reports the value of the integral F(%s) instead of its derivative." % p, F(p)), ("Uses the integrand's derivative: 2x times the derivative of e^(-t^2/c) at t = x^2.", 2 * p * (-2 * p * p / c) * math.exp(-(p * p) ** 2 / c))]
    stem = f"Let $F(x)=\\int_1^{{x^{{2}}}}e^{{-t^{{2}}/{c}}}\\,dt$. What is the value of $F'({p})$?"
    key = Opt(dec(key_v), True, "By the Fundamental Theorem of Calculus with the chain rule, F'(x) = 2x e^{-(x^2)^2/c}; evaluate at x = %s with a calculator." % p, key_v)
    bpr = _bpg("c_ftc_chain_calc", "6.4", "1.D", "required", "Differentiate an accumulation function with an inner function in the upper limit and evaluate numerically",
               ["Recognize an accumulation function with upper limit x squared", "Apply the Fundamental Theorem with the chain rule", "Evaluate with a calculator"],
               [("the integrand is continuous so the Fundamental Theorem applies", "e^(-t^2/c) is continuous")],
               [("no_chain_factor", "omits the factor 2x"), ("inner_not_applied", "uses x instead of x squared"), ("integral_value", "reports the integral F"), ("differentiates_integrand", "differentiates the integrand")],
               "central difference (step 1e-6) of F computed by scipy quad (independent of the Fundamental Theorem)", {"type": "none", "must_include": []})
    return _fin("c_ftc_chain_calc", "6.4", "1.D", stem, key, ds, rng, bpr, 85, [f"c={c}", f"p={p}", f"key={key_v:.6f}"])


# 10) 7.8 반감기·지수 감소: dy/dt = -k y
def c_decay_model_calc(rng):
    y0, t1, frac, t2 = rng.choice([50, 80, 120]), rng.choice([3, 4]), rng.choice([0.6, 0.7]), rng.choice([8, 10])
    k = -math.log(frac) / t1
    key_v = y0 * math.exp(-k * t2)
    sol = _I.solve_ivp(lambda t_, y_: [-k * y_[0]], [0, t2], [y0], rtol=1e-11, atol=1e-12)
    if abs(sol.y[0][-1] - key_v) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Uses linear decay: the amount lost in %d hours is repeated every %d hours." % (t1, t1), y0 - (y0 - y0 * frac) / t1 * t2), ("Applies the factor %s once per hour instead of once per %d hours: y0 * %s^t." % (frac, t1, frac), y0 * frac ** t2),
          ("Uses k = ln(%s)/%d with the wrong sign, which grows instead of decays." % (frac, t1), y0 * math.exp(k * t2)), ("Measures %d hours from the %d-hour value: y(%d) * %s^((%d - %d)/%d) with the wrong base amount." % (t2, t1, t1, frac, t2, t1, t1), y0 * frac * frac ** (t2 / t1))]
    stem = f"A substance decays so that the amount $y$ (in grams) satisfies $\\dfrac{{dy}}{{dt}}=-ky$ for a constant $k>0$, where $t$ is in hours. Initially there are ${y0}$ grams, and after ${t1}$ hours ${y0*frac:.4g}$ grams remain. How many grams remain after ${t2}$ hours?"
    key = Opt(dec(key_v), True, "y = y0 e^{-kt} with e^{-%d k} = %s, so y(%d) = %d (%s)^{%d/%d}, evaluated with a calculator." % (t1, frac, t2, y0, frac, t2, t1), key_v)
    bpr = _bpg("c_decay_model_calc", "7.8", "1.E", "required", "Use an exponential decay model determined by two data points to predict a later amount",
               ["Solve dy/dt = -ky to get y = y0 e^(-kt)", "Find k from the amount remaining after the given time", "Evaluate the amount at the later time with a calculator"],
               [("solutions of dy/dt = -ky have the form y0 e^(-kt)", "exponential model stated in the problem")],
               [("linear_decay", "extends the loss linearly"), ("ratio_per_hour", "applies the ratio per hour"), ("wrong_sign_k", "grows instead of decays"), ("wrong_base", "starts from the wrong amount")],
               "Runge-Kutta numerical integration of dy/dt = -ky with k recomputed from the two data points (independent of the exponential solution)", {"type": "none", "must_include": []})
    return _fin("c_decay_model_calc", "7.8", "1.E", stem, key, ds, rng, bpr, 90, [f"y0={y0}", f"t1={t1}", f"frac={frac}", f"t2={t2}", f"key={key_v:.6f}"])
