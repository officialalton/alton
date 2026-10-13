"""예비 3차 B3(2026-10-12): AP 미적분 AB 단원 6~8 계산기 불가 MC 원형. 모든 정답·오답 값은 sympy 정확 계산, 독립 수치 경로(구적법·차분·격자)로 재확인."""
from scommon import *
from scipy import integrate as _I, optimize as _O
import math

AB_ = "ap_calculus_ab"
_L = lambda e: sp.latex(e).replace("\\log", "\\ln")


def _tex(v):
    return "$" + _L(sp.sympify(v)) + "$"


def _tx(s):
    return "$" + s + "$"


def _eopts(trip, key_val, positive=False):
    """trip: [(why, value, text 또는 None)] -> 값/텍스트가 키와 겹치지 않는 오답 Opt."""
    out, seen = [], {_tex(key_val)}
    for w, v, tx in trip:
        if positive and float(sp.N(v)) <= 0:
            continue
        t = tx or _tex(v)
        if t in seen:
            continue
        seen.add(t)
        out.append(Opt(t, False, w, v))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


def _dist(a, b):
    return abs(float(sp.N(a)) - float(sp.N(b)))


def _nb(arch, topic, skill, concept, thinking, cond, mis, path, material=None):
    if material:
        return bp(arch, topic, skill, "not_allowed", concept, thinking, cond, mis, path, material)
    return nb(arch, topic, skill, "not_allowed", concept, thinking, cond, mis, path, AB_)


def _chk(cond):
    if not cond:
        raise ValueError("independent_check_failed")


# ============================================================ 단원 6
# 6.8 기본 부정적분 규칙(거듭제곱·음의 거듭제곱·상수항) 표현 고르기
def c_antideriv_power_rules(rng):
    for _ in forever():
        n = rng.choice([2, 3, 4])
        s = rng.choice([1, 2, 3, 5])
        p = s * (n + 1)
        q = rng.choice([1, 2, 3, 4, 6])
        r = rng.choice([-5, -4, -3, -2, 2, 3, 4, 5])
        f = p * x ** n + q / x ** 2 + r
        F = s * x ** (n + 1) - q / x + r * x
        _chk(sp.simplify(sp.diff(F, x) - f) == 0)
        fn = sp.lambdify(x, F, "math")
        hh = 1e-6
        _chk(abs((fn(1.7 + hh) - fn(1.7 - hh)) / (2 * hh) - float(f.subs(x, 1.7))) < 1e-5)
        C = lambda e: _tx(_L(e) + "+C")
        d_der = sp.diff(f, x)
        d_nodiv = p * x ** (n + 1) + q / x + r * x
        d_ln = s * x ** (n + 1) + r * x + q * sp.log(sp.Abs(x))
        d_sign = s * x ** (n + 1) + q / x + r * x
        d_c = s * x ** (n + 1) - q / x + r
        ds = [("Differentiates each term, getting %s, instead of integrating." % _tex(d_der), 1, C(d_der)),
              ("Adds 1 to each exponent but does not divide by the new exponent, which gives %s." % _tex(d_nodiv), 2, C(d_nodiv)),
              ("Uses the rule for $\\int \\frac{1}{x}\\,dx$ on $\\frac{%d}{x^{2}}$ and writes $%d\\ln|x|$." % (q, q), 3, C(d_ln)),
              ("Integrates $\\frac{%d}{x^{2}}$ as $%dx^{-1}$ and loses the minus sign that comes from dividing by $-1$." % (q, q), 4, C(d_sign)),
              ("Integrates the constant term $%d$ as $%d$ instead of $%dx$." % (r, r, r), 5, C(d_c))]
        ds = [(w, sp.Integer(v), tx) for w, v, tx in ds]
        # 값이 의미 없는 텍스트 선택지: Opt 를 직접 만든다(값 None)
        pool = textopts([(tx, w) for w, _, tx in ds])
        break
    stem = "Which of the following is equal to $\\displaystyle\\int\\left(%s\\right)dx$?" % _L(f)
    key = Opt(C(F), True, "Apply the power rule term by term: $\\int %s\\,dx=%s$, $\\int %s\\,dx=%s$ and $\\int %d\\,dx=%dx$, then add $C$." % (_L(p * x ** n), _L(s * x ** (n + 1)), _L(q / x ** 2), _L(-q / x), r, r), None)
    bpr = _nb("c_antideriv_power_rules", "6.8", "1.C", "Find an indefinite integral of a sum of a power, a negative power and a constant using the basic antiderivative rules",
              ["Rewrite each term as a power of x", "Raise each exponent by 1 and divide by the new exponent", "Integrate the constant as a multiple of x and add C"],
              [("the antiderivative of x to the n for n not equal to -1 is x to the n+1 over n+1", "the exponents in the integrand are 2, 3 or 4 and -2, none equal to -1")],
              [("differentiates", "differentiates instead of integrating"), ("no_division", "adds 1 to each exponent without dividing"), ("ln_rule_misuse", "uses the ln rule for x to the -2"), ("sign_loss", "drops the minus sign from dividing by -1"), ("constant_not_x", "integrates the constant as itself")],
              "derivative of each option checked symbolically and by a central difference at x = 1.7 (independent of the term-by-term integration)")
    return build("c_antideriv_power_rules", "6.8", "1.C", "not_allowed", stem, key, pool, rng, bpr, 70, [f"f={f}", f"F={F}"])


# 6.9 치환적분(부정적분, 삼각함수): 거듭제곱 x 도함수 구조
def c_usub_indef_trig(rng):
    m = rng.choice([2, 3, 4])
    s = rng.choice([1, 2, 3])
    k = s * (m + 1)
    kind = rng.choice(["A", "B"])
    sn, cs = sp.sin(x), sp.cos(x)
    C = lambda e: _tx(_L(e) + "+C")
    if kind == "A":
        f = k * sn ** m * cs
        F = s * sn ** (m + 1)
        u, du = "\\sin x", "\\cos x\\,dx"
        d1 = k * sn ** (m + 1)
        d2 = k * cs * sn ** (m + 1) / (m + 1)
        d3 = -s * sn ** (m + 1)
        d4 = s * cs ** (m + 1)
        w1 = "Raises the exponent of $\\sin x$ to $%d$ but forgets to divide by $%d$, which gives %s." % (m + 1, m + 1, _tex(d1))
        w2 = "Applies the power rule to $\\sin^{%d}x$ only and keeps $\\cos x$ as a factor, which gives %s." % (m, _tex(d2))
        w3 = "Puts in a minus sign, as if the substitution $u=\\sin x$ gave $du=-\\cos x\\,dx$, which gives %s." % _tex(d3)
        w4 = "Substitutes $u=\\cos x$ instead of $u=\\sin x$, which gives %s." % _tex(d4)
        why = "Let $u=\\sin x$, so $du=\\cos x\\,dx$ and the integral becomes $\\int %d u^{%d}\\,du=%s+C$." % (k, m, _L(F))
    else:
        f = k * sn * cs ** m
        F = -s * cs ** (m + 1)
        d1 = -k * cs ** (m + 1)
        d2 = k * sn * cs ** (m + 1) / (m + 1)
        d3 = s * cs ** (m + 1)
        d4 = s * sn ** (m + 1)
        w1 = "Raises the exponent of $\\cos x$ to $%d$ but forgets to divide by $%d$, which gives %s." % (m + 1, m + 1, _tex(d1))
        w2 = "Applies the power rule to $\\cos^{%d}x$ only and keeps $\\sin x$ as a factor, which gives %s." % (m, _tex(d2))
        w3 = "Forgets the minus sign in $du=-\\sin x\\,dx$ when $u=\\cos x$, which gives %s." % _tex(d3)
        w4 = "Substitutes $u=\\sin x$ instead of $u=\\cos x$, which gives %s." % _tex(d4)
        why = "Let $u=\\cos x$, so $du=-\\sin x\\,dx$ and the integral becomes $-\\int %d u^{%d}\\,du=%s+C$." % (k, m, _L(F))
    _chk(sp.simplify(sp.diff(F, x) - f) == 0)
    fn = sp.lambdify(x, F, "math")
    hh = 1e-6
    _chk(abs((fn(0.9 + hh) - fn(0.9 - hh)) / (2 * hh) - float(f.subs(x, 0.9))) < 1e-5)
    pool = textopts([(C(d1), w1), (C(d2), w2), (C(d3), w3), (C(d4), w4)])
    stem = "Which of the following is equal to $\\displaystyle\\int %s\\,dx$?" % _L(f)
    key = Opt(C(F), True, why, None)
    bpr = _nb("c_usub_indef_trig", "6.9", "1.E", "Find an indefinite integral of a power of sine or cosine times the other function by substitution",
              ["Identify the inner function whose derivative appears as the other factor", "Rewrite the integral in terms of u and integrate the power", "Return to x and add C"],
              [("the other trigonometric factor is, up to a sign, the derivative of the inner function", "cos x is the derivative of sin x and sin x is the negative derivative of cos x")],
              [("no_division", "forgets to divide by the new exponent"), ("partial_rule", "integrates only the power and keeps the other factor"), ("sign_error", "gets the sign of du wrong"), ("wrong_u", "chooses the wrong inner function")],
              "central difference of each antiderivative at x = 0.9 compared with the integrand (independent of the substitution)")
    return build("c_usub_indef_trig", "6.9", "1.E", "not_allowed", stem, key, pool, rng, bpr, 80, [f"f={f}", f"F={F}"])


# 6.9 치환 후 적분 구간·계수 변환(함수 f 가 일반)
def c_usub_limits_transform(rng):
    for _ in forever():
        q = rng.choice([2, 3])
        d = rng.choice([1, 2])
        m = rng.choice([1, 2, 4] if q == 2 else [1, 3, 6])
        a = rng.choice([0, 1])
        b = rng.choice([2, 3])
        co = sp.Rational(m, q)
        ga, gb = a ** q + d, b ** q + d
        fn = lambda u: 1 / (1 + u * u)
        lhs = _I.quad(lambda z: m * z ** (q - 1) * fn(z ** q + d), a, b)[0]
        def val(c, lo, hi):
            return float(c) * _I.quad(fn, lo, hi)[0]
        cand = [("key", co, ga, gb), ("keep", co, a, b), ("nofac", sp.Integer(m), ga, gb), ("nod", co, a ** q, b ** q), ("both", sp.Integer(m), a, b)]
        vals = {nm: val(c, lo, hi) for nm, c, lo, hi in cand}
        if abs(vals["key"] - lhs) > 1e-8:
            raise ValueError("independent_check_failed")
        if any(abs(vals[nm] - vals["key"]) < 1e-6 for nm in ("keep", "nofac", "nod", "both")):
            continue
        break
    def T(c, lo, hi):
        cs = "" if c == 1 else _L(c)
        return "$%s\\displaystyle\\int_{%s}^{%s} f(u)\\,du$" % (cs, lo, hi)
    gx = _L(m * x ** (q - 1))
    stem = "Let $f$ be a continuous function. Using the substitution $u=x^{%d}+%d$, which of the following is equal to $\\displaystyle\\int_{%d}^{%d} %s\\,f\\!\\left(x^{%d}+%d\\right)dx$?" % (q, d, a, b, gx, q, d)
    key = Opt(T(co, ga, gb), True, "With $u=x^{%d}+%d$ we have $du=%d x^{%d}\\,dx$, so $%s\\,dx=%s\\,du$; the limits become $u=%d$ and $u=%d$." % (q, d, q, q - 1, gx, _L(co) if co != 1 else "1", ga, gb), None)
    pool = textopts([(T(co, a, b), "Changes the integrand to $u$ and the coefficient to $%s$ but keeps the $x$-limits $%d$ and $%d$." % (_L(co), a, b)),
                     (T(m, ga, gb), "Converts the limits correctly but forgets the factor $\\frac{1}{%d}$ that comes from $du=%d x^{%d}\\,dx$, so the coefficient stays $%d$." % (q, q, q - 1, m)),
                     (T(co, a ** q, b ** q), "Converts the limits with $u=x^{%d}$ and forgets to add $%d$, so the limits are $%d$ and $%d$." % (q, d, a ** q, b ** q)),
                     (T(m, a, b), "Replaces the integrand by $f(u)$ but keeps both the $x$-limits and the coefficient $%d$." % m)])
    bpr = _nb("c_usub_limits_transform", "6.9", "2.C", "Rewrite a definite integral in terms of u after a substitution, including the limits and the constant factor, for an unspecified function f",
              ["Differentiate the substitution to find du in terms of dx", "Match the factor in front of f with du to find the coefficient", "Evaluate u at the original limits"],
              [("a definite integral after substitution needs new limits and the matching constant factor", "u is a differentiable function of x on the interval")],
              [("old_limits", "keeps the x-limits"), ("no_constant", "forgets the constant from du"), ("limits_no_shift", "forgets the added constant in u"), ("nothing_changed", "changes only the integrand")],
              "numerical quadrature of both sides with the concrete continuous function f(u) = 1/(1+u^2); every distractor differs numerically from the original integral (independent of the symbolic substitution)")
    return build("c_usub_limits_transform", "6.9", "2.C", "not_allowed", stem, key, pool, rng, bpr, 90, [f"q={q}", f"d={d}", f"m={m}", f"a={a}", f"b={b}"])


# 6.9 치환적분 정적분의 로그 결과(유리식 x/(x^2+d))
def c_usub_ln_definite(rng):
    b, d = rng.choice([(2, 3), (2, 1), (3, 1), (3, 2), (2, 5), (3, 5)])
    k = rng.choice([2, 4, 6])
    ratio = sp.Rational(b * b + d, 1 + d)
    key_v = sp.Rational(k, 2) * sp.log(ratio)
    num = _I.quad(lambda z: k * z / (z * z + d), 1, b)[0]
    _chk(abs(num - float(key_v)) < 1e-9)
    d1 = k * sp.log(ratio)
    d2 = sp.Rational(k, 2) * sp.log(b * b + d)
    d3 = sp.Rational(k, 2) * sp.log(b)
    d4 = k * sp.log(b)
    ds = [("Forgets the factor $\\frac{1}{2}$ from $du=2x\\,dx$ and gets %s." % _tex(d1), d1, None),
          ("Evaluates $\\ln u$ only at the upper limit $u=%d$ and does not subtract its value at the lower limit." % (b * b + d), d2, None),
          ("Keeps the $x$-limits $1$ and $%d$ in $\\ln|u|$, which gives $%s$." % (b, _L(sp.Rational(k, 2)) + "\\ln " + str(b)), d3, None),
          ("Substitutes $u=x^{2}$ and drops the constant $%d$ in the denominator, which gives $%s$." % (d, _L(k) + "\\ln " + str(b)), d4, None)]
    pool = _eopts(ds, key_v)
    stem = "What is the value of $\\displaystyle\\int_{1}^{%d}\\dfrac{%dx}{x^{2}+%d}\\,dx$?" % (b, k, d)
    key = Opt(_tex(key_v), True, "Let $u=x^{2}+%d$, so $du=2x\\,dx$ and the limits become $%d$ and $%d$; then $\\int \\frac{%d}{2}\\cdot\\frac{1}{u}\\,du=%s\\left(\\ln %d-\\ln %d\\right)$." % (d, 1 + d, b * b + d, k, _L(sp.Rational(k, 2)), b * b + d, 1 + d), key_v)
    bpr = _nb("c_usub_ln_definite", "6.9", "1.E", "Evaluate a definite integral of a rational function whose numerator is a multiple of the derivative of the denominator, with changed limits",
              ["Choose u as the denominator and find du", "Convert the limits and integrate 1 over u as a natural logarithm", "Subtract the logarithms of the new limits"],
              [("the integrand is a constant multiple of u' over u", "the numerator is a multiple of the derivative of x^2 + d")],
              [("missing_half", "forgets the factor 1/2 from du"), ("upper_only", "forgets the lower limit"), ("old_limits", "keeps the x-limits"), ("drops_constant", "drops the constant in the denominator")],
              "numerical quadrature (scipy) of the integrand compared with the closed form (independent of the substitution)")
    return build("c_usub_ln_definite", "6.9", "1.E", "not_allowed", stem, key, pool, rng, bpr, 95, [f"k={k}", f"b={b}", f"d={d}"])


# 6.3 극한 합 표기 -> 정적분
_SIG = [("sq", "\\left({u}\\right)^{{2}}", "x^{{2}}", lambda z: z ** 2), ("sqrt", "\\sqrt{{{u}}}", "\\sqrt{{x}}", sp.sqrt),
        ("cube", "\\left({u}\\right)^{{3}}", "x^{{3}}", lambda z: z ** 3), ("exp", "e^{{{u}}}", "e^{{x}}", sp.exp)]


def c_sigma_to_integral(rng):
    for _ in forever():
        nm, tpl, btpl, fe = rng.choice(_SIG)
        c = rng.choice([2, 3, 4])
        a = rng.choice([1, 2])
        if c == a:
            continue
        fsym = lambda z: fe(z)
        u = "%d+\\dfrac{%dk}{n}" % (a, c)
        term = "\\dfrac{%d}{n}%s" % (c, tpl.format(u=u))
        body = btpl.format()
        iv = lambda lo, hi, coef=None, f=None: sp.integrate((coef or 1) * (f if f is not None else fe(x)), (x, lo, hi))
        key_v = iv(a, a + c)
        # 독립 경로: n 이 큰 오른쪽 리만 합
        n = 400000
        ks = [a + c * i / n for i in range(1, n + 1)]
        f_num = sp.lambdify(x, fe(x), "math")
        sm = (c / n) * sum(f_num(kv) for kv in ks)
        _chk(abs(sm - float(sp.N(key_v))) < 2e-3 * max(1, abs(float(sp.N(key_v)))))
        v1 = iv(0, c)
        v2 = iv(a, c)
        v3 = iv(a, a + c, c)
        v4 = iv(0, 1, f=fe(a + c * x))
        if len({round(float(sp.N(z)), 8) for z in (key_v, v1, v2, v3, v4)}) == 5:
            break
    I = lambda lo, hi, bd, coef="": "$%s\\displaystyle\\int_{%s}^{%s} %s\\,dx$" % (coef, lo, hi, bd)
    fb = _L(fe(a + c * x)).replace("\\log", "\\ln")
    stem = "Which of the following definite integrals is equal to $\\displaystyle\\lim_{n\\to\\infty}\\sum_{k=1}^{n}%s$?" % term
    key = Opt(I(a, a + c, body), True, "The width of each subinterval is $\\frac{%d}{n}$ and the sample points are $x_k=%d+\\frac{%dk}{n}$, so the sum is a right Riemann sum for $%s$ on $[%d,%d]$." % (c, a, c, body, a, a + c), None)
    pool = textopts([(I(0, c, body), "Ignores the starting point $%d$ and uses the interval $[0,%d]$." % (a, c)),
                     (I(a, c, body), "Uses $%d$ as the upper limit, the length of the interval, instead of the endpoint $%d+%d=%d$." % (c, a, c, a + c)),
                     (I(a, a + c, body, str(c)), "Treats the width $\\frac{%d}{n}$ as part of the function and multiplies the integrand by $%d$ again." % (c, c)),
                     (I(0, 1, fb), "Rescales to $[0,1]$ but forgets that the width $\\frac{%d}{n}$ gives an extra factor $%d$." % (c, c))])
    bpr = _nb("c_sigma_to_integral", "6.3", "2.C", "Recognize the limit of a right Riemann sum written in summation notation as a definite integral",
              ["Read the width of each subinterval from the factor in front", "Read the starting point and the endpoint from the sample points", "Write the integral of the matching function between those endpoints"],
              [("the limit of a Riemann sum of a continuous function is a definite integral", "the width is c over n and the sample points are a plus c k over n")],
              [("start_ignored", "ignores the starting point"), ("wrong_upper", "uses the interval length as the upper limit"), ("extra_factor", "multiplies by the width again"), ("rescaled", "rescales to the unit interval and loses the factor")],
              "a right Riemann sum with 400000 subintervals compared with the exact integral value (independent of the symbolic recognition)")
    return build("c_sigma_to_integral", "6.3", "2.C", "not_allowed", stem, key, pool, rng, bpr, 95, [f"c={c}", f"a={a}", f"f={nm}"])


# 6.4 위·아래 끝이 모두 x 의 함수인 누적함수의 도함수
def c_accum_two_limits(rng):
    for _ in forever():
        m = rng.choice([2, 3])
        q = rng.choice([2, 3])
        a = 1 if q == 3 else rng.choice([1, 2])
        be = rng.choice([-3, -2, -1, 1, 2, 3])
        ga = rng.choice([-4, -3, -2, -1, 1, 2, 3, 4])
        f = lambda z: z * z + be * z + ga
        up, lo = a ** q, m * a
        key_v = q * a ** (q - 1) * f(up) - m * f(lo)
        # 독립 경로: F(x)=∫ 의 중심차분
        tt = sp.Symbol("tt")
        fn = sp.lambdify(tt, tt ** 2 + be * tt + ga, "math")
        Fx = lambda z: _I.quad(fn, m * z, z ** q)[0]
        hh = 1e-5
        _chk(abs((Fx(a + hh) - Fx(a - hh)) / (2 * hh) - key_v) < 1e-4)
        v = {"nochain_up": f(up) - m * f(lo), "nochain_both": f(up) - f(lo), "nolower": q * a ** (q - 1) * f(up), "plus": q * a ** (q - 1) * f(up) + m * f(lo),
             "at_x": (q * a ** (q - 1) - m) * f(a)}
        cand = [("Applies the chain rule to the lower limit but not to the upper limit, so $f(%d)$ is not multiplied by $%d$." % (up, q * a ** (q - 1)), v["nochain_up"]),
                ("Forgets the chain-rule factors for both limits and writes $f(%d)-f(%d)$." % (up, lo), v["nochain_both"]),
                ("Ignores the lower limit $%dx$ and differentiates only the upper limit." % m, v["nolower"]),
                ("Adds the lower-limit term $%d\\,f(%d)$ instead of subtracting it." % (m, lo), v["plus"]),
                ("Evaluates $f$ at $x=%d$ instead of at the limits and multiplies by $%d-%d$." % (a, q * a ** (q - 1), m), v["at_x"])]
        if len({key_v, *v.values()}) >= 4:
            try:
                pool = numopts(cand, key_v, lambda z: "$%d$" % z)
            except ValueError:
                continue
            break
    ftex = _L(t ** 2 + be * t + ga)
    stem = "Let $F(x)=\\displaystyle\\int_{%dx}^{x^{%d}}\\left(%s\\right)dt$. What is $F'(%d)$?" % (m, q, ftex, a)
    key = Opt("$%d$" % key_v, True, "By the Fundamental Theorem and the chain rule, $F'(x)=%s\\,f(x^{%d})-%d\\,f(%dx)$; at $x=%d$ this is $%d\\cdot f(%d)-%d\\cdot f(%d)=%d$ with $f(t)=%s$." % (_L(q * x ** (q - 1)), q, m, m, a, q * a ** (q - 1), up, m, lo, key_v, ftex), key_v)
    bpr = _nb("c_accum_two_limits", "6.4", "1.E", "Differentiate an accumulation function whose lower and upper limits are both functions of x",
              ["Write F(x) as the integral to the upper limit minus the integral to the lower limit", "Differentiate each piece with the Fundamental Theorem and the chain rule", "Evaluate f at each limit and combine"],
              [("the derivative of the integral from g(x) to h(x) of f is f(h(x))h'(x) minus f(g(x))g'(x)", "f is continuous")],
              [("upper_no_chain", "drops the chain factor on the upper limit"), ("no_chain", "drops both chain factors"), ("lower_ignored", "ignores the lower limit"), ("sign_error", "adds the lower-limit term"), ("f_at_x", "evaluates f at x")],
              "central difference (step 1e-5) of F(x) computed by numerical quadrature (independent of the Fundamental Theorem)")
    return build("c_accum_two_limits", "6.4", "1.E", "not_allowed", stem, key, pool, rng, bpr, 100, [f"m={m}", f"q={q}", f"a={a}", f"key={key_v}"])


# 6.2 간격이 다른 표의 사다리꼴 합 + 초기량
_TT = [[0, 2, 5, 9, 10], [0, 1, 4, 6, 10], [0, 3, 5, 9, 12], [0, 2, 6, 7, 10], [0, 4, 5, 8, 12]]


def c_trapezoid_table_initial(rng):
    for _ in forever():
        ts = rng.choice(_TT)
        vs = [2 * rng.randint(1, 10) for _ in ts]
        V0 = rng.choice([20, 30, 40, 50, 60])
        w = [ts[i + 1] - ts[i] for i in range(4)]
        trap = sum(sp.Rational(vs[i] + vs[i + 1], 2) * w[i] for i in range(4))
        left = sum(vs[i] * w[i] for i in range(4))
        right = sum(vs[i + 1] * w[i] for i in range(4))
        T = ts[-1]
        eq = sp.Rational(T, 4) * (sp.Rational(vs[0], 2) + vs[1] + vs[2] + vs[3] + sp.Rational(vs[4], 2))
        if eq.q != 1:
            continue
        key_v = V0 + trap
        from scipy.integrate import trapezoid as _tz
        _chk(abs(V0 + _tz(vs, ts) - float(key_v)) < 1e-9)
        cand = [("Reports the trapezoidal estimate of the water that flows in, %s, and leaves out the %d liters already in the tank." % (_tex(trap), V0), trap),
                ("Uses a left Riemann sum instead of trapezoids and adds the initial %d liters." % V0, V0 + left),
                ("Uses a right Riemann sum instead of trapezoids and adds the initial %d liters." % V0, V0 + right),
                ("Uses the same width $%s$ for all four trapezoids even though the table times are not equally spaced." % _L(sp.Rational(T, 4)), V0 + eq)]
        try:
            pool = numopts(cand, key_v, lambda z: _tex(z))
        except ValueError:
            continue
        break
    rows = [[str(a), str(b)] for a, b in zip(ts, vs)]
    stem = "Water flows into a tank at a rate $R(t)$ liters per minute, where $t$ is measured in minutes. Values of $R$ are given in the table. At $t=0$ the tank holds %d liters. Using a trapezoidal sum with the four subintervals determined by the table, what is the approximate number of liters in the tank at $t=%d$?" % (V0, T)
    key = Opt(_tex(key_v), True, "The trapezoids have widths %s; the estimate of the water added is $%s$, so the tank holds about $%d+%s$ liters." % (", ".join("$%d$" % z for z in w), _L(trap), V0, _L(trap)), key_v)
    bpr = _nb("c_trapezoid_table_initial", "6.2", "1.E", "Approximate the amount in a tank at a later time with an initial amount plus a trapezoidal sum over unequal subintervals of a table of rates",
              ["Compute the width of each subinterval from the table times", "Apply the trapezoidal formula (average of the two rates times the width) on each subinterval and add", "Add the initial amount"],
              [("the change in the amount is the integral of the rate, approximated by trapezoids on subintervals of different widths", "the times in the table are not equally spaced")],
              [("no_initial", "omits the initial amount"), ("left_sum", "uses a left sum"), ("right_sum", "uses a right sum"), ("equal_widths", "uses equal widths")],
              "scipy.integrate.trapezoid applied to the table times and values plus the initial amount (independent of the hand sum)",
              {"type": "table", "must_include": ["values of R(t) at t = " + ", ".join(str(z) for z in ts)]})
    return gpack("c_trapezoid_table_initial", "6.2", "1.E", "not_allowed", stem, key, pool, rng, table_stimulus("Values of the rate $R(t)$", "t (minutes)", rows, "R(t) (liters per minute)"), bpr, 100, [f"ts={ts}", f"vs={vs}", f"V0={V0}", f"key={key_v}"])


# 6.10 완전제곱 후 arctan
def c_complete_square_arctan(rng):
    c = rng.choice([1, 2, 3])
    m = rng.choice([2, 3])
    key_v = sp.pi / (4 * m)
    quad = lambda z: z * z + 2 * c * z + c * c + m * m
    _chk(abs(_I.quad(lambda z: 1 / quad(z), -c, m - c)[0] - float(key_v)) < 1e-9)
    ds = [("Gets $\\frac{1}{x^{2}+%dx+%d}$ in the form $\\frac{1}{u^{2}+%d}$ with $u=x+%d$ but forgets the factor $\\frac{1}{%d}$ in front of the arctangent, which gives $\\frac{\\pi}{4}$." % (2 * c, c * c + m * m, m * m, c, m), sp.pi / 4, None),
          ("Uses $\\int\\frac{du}{u}$ on the quadratic, writing $\\ln\\left|x^{2}+%dx+%d\\right|$; the values at the limits are $%d$ and $%d$, so the result is $\\ln 2$." % (2 * c, c * c + m * m, 2 * m * m, m * m), sp.log(2), None),
          ("Uses $\\arctan u$ instead of $\\arctan\\frac{u}{%d}$, so the result is $\\frac{1}{%d}\\arctan %d$." % (m, m, m), sp.atan(m) / m, "$\\dfrac{1}{%d}\\arctan %d$" % (m, m)),
          ("Uses $\\frac{1}{%d}$ twice and gets $\\frac{\\pi}{%d}$." % (m, 4 * m * m), sp.pi / (4 * m * m), None)]
    pool = _eopts(ds, key_v)
    stem = "What is the value of $\\displaystyle\\int_{%d}^{%d}\\dfrac{dx}{x^{2}+%dx+%d}$?" % (-c, m - c, 2 * c, c * c + m * m)
    key = Opt(_tex(key_v), True, "Completing the square, $x^{2}+%dx+%d=(x+%d)^{2}+%d$. With $u=x+%d$ the limits become $0$ and $%d$, and $\\int_0^{%d}\\frac{du}{u^{2}+%d}=\\frac{1}{%d}\\arctan\\frac{u}{%d}\\Big|_0^{%d}=\\frac{1}{%d}\\cdot\\frac{\\pi}{4}$." % (2 * c, c * c + m * m, c, m * m, c, m, m, m * m, m, m, m, m), key_v)
    bpr = _nb("c_complete_square_arctan", "6.10", "1.E", "Integrate the reciprocal of an irreducible quadratic by completing the square and using the arctangent antiderivative",
              ["Complete the square in the denominator", "Substitute u for the shifted variable and match the form 1 over u^2 + a^2", "Integrate to an arctangent with the factor 1 over a and evaluate"],
              [("the antiderivative of 1 over u^2 + a^2 is (1/a) arctan(u/a)", "the quadratic has no real roots")],
              [("missing_factor", "forgets 1 over a"), ("log_rule", "uses the natural logarithm rule"), ("arctan_unscaled", "forgets to divide u by a inside arctan"), ("factor_twice", "uses the factor 1 over a twice")],
              "scipy quad of the integrand (independent of the completed-square antiderivative)")
    return build("c_complete_square_arctan", "6.10", "1.E", "not_allowed", stem, key, pool, rng, bpr, 105, [f"c={c}", f"m={m}"])


# ============================================================ 단원 7
# 7.7 분리 가능 미분방정식의 일반해(음함수 형태) 고르기
def c_separable_general_solution(rng):
    k = rng.choice([2, 3, 4, 6])
    C = lambda s: _tx(s + "+C")
    Y = sp.Symbol("yy")
    key_t = "y^{2}=%s" % _L(sp.Rational(2 * k, 3) * x ** 3)
    d1_t = "y^{2}=%s" % _L(sp.Rational(k, 3) * x ** 3)
    d2_t = "y^{2}=%s" % _L(2 * k * x ** 3)
    d3_t = "y=%s" % _L(sp.Rational(k, 3) * x ** 3 / Y).replace("yy", "y")
    d4_t = "\\ln|y|=%s" % _L(sp.Rational(k, 3) * x ** 3)
    # 독립 경로: 각 관계식 G(x,y)=C 가 dy/dx = k x^2 / y 를 만족하는지 음함수 미분으로 확인
    xx, yy = sp.symbols("xx yy")
    G = {"key": yy ** 2 - sp.Rational(2 * k, 3) * xx ** 3, "d1": yy ** 2 - sp.Rational(k, 3) * xx ** 3, "d2": yy ** 2 - 2 * k * xx ** 3,
         "d3": yy - sp.Rational(k, 3) * xx ** 3 / yy, "d4": sp.log(yy) - sp.Rational(k, 3) * xx ** 3}
    slope = k * xx ** 2 / yy
    res = {nm: float((sp.diff(g, xx) + sp.diff(g, yy) * slope).subs({xx: 1.3, yy: 1.7})) for nm, g in G.items()}
    _chk(abs(res["key"]) < 1e-9 and all(abs(res[nm]) > 1e-3 for nm in ("d1", "d2", "d3", "d4")))
    pool = textopts([(C(d1_t), "Integrates $y\\,dy$ as $y^{2}$ instead of $\\frac{y^{2}}{2}$, which gives $\\frac{%d}{3}x^{3}$ on the right side after clearing nothing." % k if False else "Integrates $y\\,dy$ as $y^{2}$ instead of $\\frac{y^{2}}{2}$ and then keeps the right side $%s$." % _L(sp.Rational(k, 3) * x ** 3)),
                     (C(d2_t), "Integrates $%dx^{2}$ as $%dx^{3}$ and forgets to divide by $3$." % (k, k)),
                     (C(d3_t), "Does not separate the variables and integrates $\\frac{%dx^{2}}{y}$ with respect to $x$ while treating $y$ as a constant." % k),
                     (C(d4_t), "Integrates $y\\,dy$ as $\\ln|y|$.")])
    stem = "Which of the following is the general solution of the differential equation $\\dfrac{dy}{dx}=\\dfrac{%dx^{2}}{y}$?" % k
    key = Opt(C(key_t), True, "Separate the variables: $y\\,dy=%dx^{2}\\,dx$. Integrating gives $\\frac{y^{2}}{2}=%s+C_1$, so $y^{2}=%s+C$." % (k, _L(sp.Rational(k, 3) * x ** 3), _L(sp.Rational(2 * k, 3) * x ** 3)), None)
    bpr = _nb("c_separable_general_solution", "7.7", "1.E", "Find the general solution of a separable differential equation in implicit form",
              ["Separate the variables so that y terms and x terms are on opposite sides", "Integrate both sides, each with its own variable", "Collect the constant and write the relation"],
              [("a separable equation dy/dx = g(x)h(y) is solved by integrating dy/h(y) and g(x) dx", "the right side is a product of a function of x and a function of y")],
              [("no_half", "integrates y dy as y squared"), ("no_division", "forgets to divide by 3"), ("not_separated", "does not separate the variables"), ("ln_rule", "integrates y dy as ln y")],
              "implicit differentiation of each relation (symbolic) evaluated at (x, y) = (1.3, 1.7): only the key satisfies dy/dx = k x^2 / y (independent of the separation)")
    return build("c_separable_general_solution", "7.7", "1.E", "not_allowed", stem, key, pool, rng, bpr, 90, [f"k={k}"])


# 7.3 미분방정식 dy/dx=(x-a)(y-b) 의 경사장에서 기울기가 양수인 점
def c_slope_sign_points(rng):
    for _ in forever():
        a = rng.choice([-2, -1, 1, 2, 3])
        b = rng.choice([-2, -1, 1, 2, 3])
        sgn = rng.choice([1, -1])
        px = a + sgn * rng.randint(1, 3)
        py = b + sgn * rng.randint(1, 3)
        zx = (a, b + rng.choice([-3, -2, 2, 3]))
        zy = (a + rng.choice([-3, -2, 2, 3]), b)
        no1 = (a + rng.choice([1, 2, 3]), b - rng.choice([1, 2, 3]))
        no2 = (a - rng.choice([1, 2, 3]), b + rng.choice([1, 2, 3]))
        pts = [(px, py), zx, zy, no1, no2]
        if len(set(pts)) == 5:
            break
    sl = lambda p: (p[0] - a) * (p[1] - b)
    assert sl((px, py)) > 0
    _chk(all(sl(p) <= 0 for p in pts[1:]))
    # 독립 경로: 점 근처 격자에서 기울기 부호
    g = lambda u, v: (u - a) * (v - b)
    _chk(g(px + 1e-9, py + 1e-9) > 0 and all(g(p[0] + 1e-9, p[1] + 1e-9) * g(p[0] - 1e-9, p[1] - 1e-9) <= 1e-12 or sl(p) < 0 for p in pts[1:]))
    P = lambda p: "$(%d,%d)$" % p
    fac = lambda var, c: var if c == 0 else (var + "-%d" % c if c > 0 else var + "+%d" % -c)
    def w(p, extra):
        return "At %s the factors $%s$ and $%s$ equal $%d$ and $%d$, so the slope is $%d$, %s" % (P(p), fac("x", a), fac("y", b), p[0] - a, p[1] - b, sl(p), extra)
    wmap = {pts[1]: w(pts[1], "and the slope field has a horizontal segment there, not a positive slope."),
            pts[2]: w(pts[2], "and the slope field has a horizontal segment there, not a positive slope."),
            pts[3]: w(pts[3], "because the two factors have opposite signs."),
            pts[4]: w(pts[4], "because the two factors have opposite signs.")}
    pool = textopts([(P(p), wmap[p]) for p in pts[1:]])
    stem = "A slope field is drawn for the differential equation $\\dfrac{dy}{dx}=(%s)(%s)$. At which of the following points does the slope field have a positive slope?" % (fac("x", a), fac("y", b))
    key = Opt(P((px, py)), True, "At %s the factors $%s$ and $%s$ equal $%d$ and $%d$, so the slope is $%d>0$ because both factors have the same sign." % (P((px, py)), fac("x", a), fac("y", b), px - a, py - b, sl((px, py))), None)
    bpr = _nb("c_slope_sign_points", "7.3", "2.D", "Decide at which point a slope field defined by a product formula has a positive slope",
              ["Evaluate or sign-check each factor x minus a and y minus b at the point", "A product is positive only when both factors have the same sign", "Choose the point where the slope is positive, not zero or negative"],
              [("the slope at (x, y) is the value of the formula at that point", "positive slope means the two factors are both positive or both negative")],
              [("zero_factor_x", "chooses a point on the line where the first factor is zero"), ("zero_factor_y", "chooses a point on the line where the second factor is zero"), ("mixed_signs_1", "chooses a point where the factors have opposite signs"), ("mixed_signs_2", "chooses another point with opposite signs")],
              "evaluation of the formula at every option point and at nearby points by brute force (independent of the factor-sign argument)")
    return build("c_slope_sign_points", "7.3", "2.D", "not_allowed", stem, key, pool, rng, bpr, 70, [f"a={a}", f"b={b}", f"key={(px, py)}"])


# ============================================================ 단원 8
_PAIRS = [(x, x ** 2, "x", "x^{2}"), (x, x ** 3, "x", "x^{3}"), (sp.sqrt(x), x, "\\sqrt{x}", "x"), (sp.sqrt(x), x ** 2, "\\sqrt{x}", "x^{2}")]


# 8.5 y 에 대한 적분(곡선 x=y^2 와 직선 x=my+n)
def c_area_between_in_y(rng):
    for _ in forever():
        r1 = rng.choice([-2, -1])
        r2 = rng.choice([1, 2, 3])
        if r2 - r1 < 3:
            continue
        m, n = r1 + r2, -r1 * r2
        line = m * y + n
        key_v = sp.integrate(line - y ** 2, (y, r1, r2))
        _chk(abs(_I.quad(lambda z: abs(m * z + n - z * z), r1, r2)[0] - float(key_v)) < 1e-9)
        d = [("Integrates only from $y=0$ to $y=%d$ and leaves out the part of the region with $y<0$." % r2, sp.integrate(line - y ** 2, (y, 0, r2))),
             ("Uses the $x$-coordinates $x=%d$ and $x=%d$ of the intersection points as the limits for $y$." % (min(r1 ** 2, r2 ** 2), max(r1 ** 2, r2 ** 2)), sp.integrate(line - y ** 2, (y, min(r1 ** 2, r2 ** 2), max(r1 ** 2, r2 ** 2)))),
             ("Adds the two functions of $y$ instead of subtracting them.", sp.integrate(line + y ** 2, (y, r1, r2))),
             ("Integrates only the line $x=%s$ and ignores the parabola $x=y^{2}$." % _L(line), sp.integrate(line, (y, r1, r2)))]
        try:
            pool = _eopts([(w, v, None) for w, v in d], key_v, positive=True)
        except ValueError:
            continue
        break
    stem = "Let $R$ be the region enclosed by the graphs of $x=y^{2}$ and $x=%s$. What is the area of $R$?" % _L(line)
    key = Opt(_tex(key_v), True, "The graphs intersect where $y^{2}=%s$, that is at $y=%d$ and $y=%d$. The line is to the right of the parabola, so the area is $\\int_{%d}^{%d}\\left(%s-y^{2}\\right)dy=%s$." % (_L(line), r1, r2, r1, r2, _L(line), _L(key_v)), key_v)
    bpr = _nb("c_area_between_in_y", "8.5", "1.D", "Find the exact area between a parabola opening to the right and a line by integrating with respect to y",
              ["Solve for the intersection points in the y-variable", "Decide which curve is to the right on that range of y", "Integrate right minus left with respect to y between the intersection values of y"],
              [("when curves are given as x in terms of y, integrate (right minus left) dy between the y-values of the intersections", "the line is to the right of the parabola for y between the roots")],
              [("part_of_region", "leaves out part of the region"), ("x_values_as_limits", "uses the x-values of the intersection points as limits for y"), ("sum_not_difference", "adds the functions"), ("line_only", "ignores the parabola")],
              "scipy quad of |line - y^2| over the interval between the roots (independent of the sign analysis and exact antiderivative)")
    return build("c_area_between_in_y", "8.5", "1.D", "not_allowed", stem, key, pool, rng, bpr, 100, [f"r1={r1}", f"r2={r2}"])


# 8.10 x 축이 아닌 수평선 아래로의 회전체(와셔)
def c_washer_about_line(rng):
    for _ in forever():
        top, bot, tt, bt = rng.choice(_PAIRS)
        k = rng.choice([1, 2])
        V = sp.pi * sp.integrate((top + k) ** 2 - (bot + k) ** 2, (x, 0, 1))
        f = sp.lambdify(x, top, "math")
        g = sp.lambdify(x, bot, "math")
        num = math.pi * _I.quad(lambda z: (f(z) + k) ** 2 - (g(z) + k) ** 2, 0, 1)[0]
        _chk(abs(num - float(V)) < 1e-9)
        dsl = [("Revolves about the $x$-axis instead of the line $y=-%d$, so the radii are $%s$ and $%s$." % (k, tt, bt), sp.pi * sp.integrate(top ** 2 - bot ** 2, (x, 0, 1))),
              ("Squares the difference of the radii, $\\left(R-r\\right)^{2}$, instead of taking $R^{2}-r^{2}$.", sp.pi * sp.integrate((top - bot) ** 2, (x, 0, 1))),
              ("Subtracts the distance $%d$ to the line instead of adding it, so the radii are $%s-%d$ and $%s-%d$." % (k, tt, k, bt, k), sp.pi * sp.integrate((top - k) ** 2 - (bot - k) ** 2, (x, 0, 1))),
              ("Evaluates the integral correctly but leaves out the factor $\\pi$.", sp.integrate((top + k) ** 2 - (bot + k) ** 2, (x, 0, 1)))]
        try:
            pool = _eopts([(w, v, None) for w, v in dsl], V, positive=True)
        except ValueError:
            continue
        break
    stem = "Let $R$ be the region in the first quadrant enclosed by the graphs of $y=%s$ and $y=%s$. The region $R$ is revolved about the line $y=-%d$. What is the volume of the solid generated?" % (tt, bt, k)
    key = Opt(_tex(V), True, "The outer radius is $%s+%d$ and the inner radius is $%s+%d$ on $0\\le x\\le 1$, so $V=\\pi\\int_0^1\\left[(%s+%d)^{2}-(%s+%d)^{2}\\right]dx=%s$." % (tt, k, bt, k, tt, k, bt, k, _L(V)), V)
    bpr = _nb("c_washer_about_line", "8.10", "1.D", "Find the exact volume of a solid obtained by revolving a region between two curves about a horizontal line below the region",
              ["Measure the outer and inner radii from the line of revolution", "Set up pi times the integral of outer radius squared minus inner radius squared", "Evaluate exactly"],
              [("each cross-section is a washer whose radii are the distances from the line y = -k to the two curves", "the line is below the region, so the radii are the function values plus k")],
              [("axis_instead", "revolves about the x-axis"), ("squares_difference", "squares the difference of radii"), ("subtracts_shift", "subtracts the distance to the line"), ("no_pi", "forgets pi")],
              "numerical quadrature of pi times (outer radius squared minus inner radius squared) with scipy (independent of the symbolic integration)")
    return build("c_washer_about_line", "8.10", "1.D", "not_allowed", stem, key, pool, rng, bpr, 105, [f"top={top}", f"bot={bot}", f"k={k}"])


# 8.7/8.8 밑면에 대각선(또는 변)이 놓인 정사각형·정삼각형 단면
def c_xsection_nonstandard(rng):
    for _ in forever():
        top, bot, tt, bt = rng.choice(_PAIRS)
        shape = rng.choice(["diag", "equi"])
        dd = top - bot
        if shape == "diag":
            area = dd ** 2 / 2
            alt = [("Treats the length $d$ of the base segment as the side of the square and integrates $d^{2}$.", dd ** 2),
                   ("Uses the half-diagonal as the side of the square and integrates $\\left(\\frac{d}{2}\\right)^{2}$.", dd ** 2 / 4)]
            desc = "squares whose diagonal lies in the base"
            wk = "A square with diagonal $d$ has area $\\frac{d^{2}}{2}$"
        else:
            area = sp.sqrt(3) / 4 * dd ** 2
            alt = [("Uses the area $\\frac{d^{2}}{2}$ of a right isosceles triangle instead of that of an equilateral triangle.", dd ** 2 / 2),
                   ("Forgets the factor $\\frac{1}{2}$ in $\\frac{1}{2}\\cdot d\\cdot\\frac{\\sqrt{3}}{2}d$ and integrates $\\frac{\\sqrt{3}}{2}d^{2}$.", sp.sqrt(3) / 2 * dd ** 2)]
            desc = "equilateral triangles with a side in the base"
            wk = "An equilateral triangle with side $d$ has area $\\frac{\\sqrt{3}}{4}d^{2}$"
        V = sp.integrate(sp.simplify(area), (x, 0, 1))
        f = sp.lambdify(x, top - bot, "math")
        af = (lambda z: f(z) ** 2 / 2) if shape == "diag" else (lambda z: math.sqrt(3) / 4 * f(z) ** 2)
        _chk(abs(_I.quad(af, 0, 1)[0] - float(sp.N(V))) < 1e-9)
        d = [("Integrates the length $d$ of the base segment instead of the cross-sectional area, which is the area of the region $R$.", dd),
             ("Treats each cross section as a semicircle with diameter $d$ and integrates $\\frac{\\pi}{8}d^{2}$.", sp.pi / 8 * dd ** 2)] + alt
        try:
            pool = _eopts([(w, sp.integrate(sp.simplify(e), (x, 0, 1)), None) for w, e in d], V, positive=True)
        except ValueError:
            continue
        break
    stem = "Let $R$ be the region in the first quadrant enclosed by the graphs of $y=%s$ and $y=%s$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are %s. What is the volume of the solid?" % (tt, bt, desc)
    key = Opt(_tex(V), True, "The length of the base segment is $d=%s-%s$. %s, so $V=\\int_0^1 %s\\,dx=%s$." % (tt, bt, wk, "\\frac{d^{2}}{2}" if shape == "diag" else "\\frac{\\sqrt{3}}{4}d^{2}", _L(V)), V)
    bpr = _nb("c_xsection_nonstandard", "8.7", "1.D", "Find the exact volume of a solid whose cross sections are squares with diagonal in the base or equilateral triangles on the base segment",
              ["Find the length d of the base segment as top minus bottom", "Write the cross-sectional area as a multiple of d squared for the given shape", "Integrate that area over the interval of x"],
              [("volume equals the integral of the cross-sectional area, and for these shapes the area is a constant multiple of d squared", "the base segment is the diagonal of the square, or a side of the equilateral triangle")],
              [("integrates_length", "integrates d instead of the area"), ("semicircle", "uses semicircular cross sections"), ("shape_error_1", "uses the wrong side or the wrong area formula for the shape"), ("shape_error_2", "makes a second mistake in the shape area")],
              "numerical quadrature of the cross-sectional area function with scipy (independent of the symbolic integration)")
    return build("c_xsection_nonstandard", "8.7", "1.D", "not_allowed", stem, key, pool, rng, bpr, 110, [f"top={top}", f"bot={bot}", f"shape={shape}"])


# 8.2 사인·코사인 속도에서 초기 위치가 있는 시각의 위치
def c_position_from_velocity(rng):
    for _ in forever():
        kind = rng.choice(["cos", "sin"])
        T = rng.choice([sp.Rational(3, 2), sp.Rational(5, 2)]) * sp.pi if kind == "cos" else rng.choice([sp.Rational(3, 2), sp.Rational(5, 2), 2]) * sp.pi
        kk = rng.choice([1, 2, 3, 4])
        x0 = rng.choice([-3, -2, 2, 3, 4, 5])
        v = kk * (sp.cos(t) if kind == "cos" else sp.sin(t))
        zeros = [sp.pi / 2 + j * sp.pi for j in range(0, 4)] if kind == "cos" else [j * sp.pi for j in range(1, 4)]
        br = [sp.Integer(0)] + [z for z in zeros if z < T] + [T]
        disp = sp.integrate(v, (t, 0, T))
        dist = sum(abs(sp.integrate(v, (t, br[i], br[i + 1]))) for i in range(len(br) - 1))
        fv = sp.lambdify(t, v, "math")
        key_v = x0 + disp
        _chk(abs(x0 + _I.quad(fv, 0, float(T), limit=200)[0] - float(key_v)) < 1e-8)
        _chk(abs(_I.quad(lambda z: abs(fv(z)), 0, float(T), points=[float(z) for z in br[1:-1]], limit=200)[0] - float(dist)) < 1e-7)
        if disp == dist or len(br) < 3:
            continue
        cand = [("Uses the total distance traveled, $%s$, in place of the net displacement, so the result is $%d+%s$." % (_L(dist), x0, _L(dist)), x0 + dist),
                ("Reports the net displacement $%s$ and forgets the initial position $%d$." % (_L(disp), x0), disp),
                ("Adds the velocity $v(%s)=%s$ at the final time to the initial position instead of integrating." % (_L(T), _L(v.subs(t, T))), x0 + v.subs(t, T)),
                ("Subtracts the net displacement from the initial position instead of adding it.", x0 - disp)]
        try:
            pool = _eopts([(w, vv, None) for w, vv in cand], key_v)
        except ValueError:
            continue
        break
    stem = "A particle moves along the $x$-axis with velocity $v(t)=%s$ for $0\\le t\\le %s$, where $t$ is in seconds and $v$ is in meters per second. The position of the particle at time $t=0$ is $x=%d$ meters. What is the position of the particle at time $t=%s$?" % (_L(v), _L(T), x0, _L(T))
    key = Opt(_tex(key_v), True, "The position is the initial position plus the net change: $%d+\\int_0^{%s}%s\\,dt=%d+%s=%s$." % (x0, _L(T), _L(v), x0, _L(disp), _L(key_v)), key_v)
    bpr = _nb("c_position_from_velocity", "8.2", "1.D", "Find the position of a particle at a later time from its velocity and its initial position when the velocity changes sign",
              ["Position equals initial position plus the integral of velocity", "Integrate the velocity over the interval with the antiderivative of sine or cosine", "Add the initial position; do not use the total distance"],
              [("position at time T is x(0) plus the integral of the velocity from 0 to T", "the particle changes direction, so distance and displacement differ")],
              [("total_distance", "adds the total distance"), ("no_initial", "forgets the initial position"), ("velocity_value", "adds the velocity at the final time"), ("wrong_sign", "subtracts the displacement")],
              "scipy quad of the velocity over [0, T] added to the initial position (independent of the antiderivative evaluation)")
    return build("c_position_from_velocity", "8.2", "1.D", "not_allowed", stem, key, pool, rng, bpr, 95, [f"kind={kind}", f"T={T}", f"x0={x0}", f"k={kk}"])


# 8.2 총 이동거리와 변위의 차(속도의 부호가 바뀌는 다항식)
def c_distance_minus_displacement(rng):
    for _ in forever():
        p = rng.choice([1, 2])
        q = rng.choice([3, 4, 5])
        T = q + rng.choice([1, 2])
        v = (t - p) * (t - q)
        disp = sp.integrate(v, (t, 0, T))
        dist = sp.integrate(v, (t, 0, p)) + sp.integrate(-v, (t, p, q)) + sp.integrate(v, (t, q, T))
        key_v = dist - disp
        fv = sp.lambdify(t, v, "math")
        _chk(abs(_I.quad(lambda z: abs(fv(z)), 0, T, points=[p, q], limit=200)[0] - _I.quad(fv, 0, T)[0] - float(key_v)) < 1e-8)
        mid = sp.integrate(v, (t, p, q))
        cand = [("Reports the net displacement $\\int_0^{%d}v(t)\\,dt=%s$ instead of the difference." % (T, _L(disp)), disp),
                ("Reports the total distance $%s$ instead of how much it exceeds the displacement." % _L(dist), dist),
                ("Reports only $\\int_{%d}^{%d}|v(t)|\\,dt=%s$, the distance traveled while the velocity is negative, which is half of the difference." % (p, q, _L(-mid)), -mid),
                ("Reports the signed integral $\\int_{%d}^{%d}v(t)\\,dt=%s$ over the interval where the velocity is negative." % (p, q, _L(mid)), mid)]
        try:
            pool = _eopts([(w, vv, None) for w, vv in cand], key_v)
        except ValueError:
            continue
        break
    stem = "A particle moves along a line with velocity $v(t)=%s$ meters per second for $0\\le t\\le %d$. How many more meters is the total distance traveled by the particle than the net displacement over this time interval?" % (_L(sp.expand(v)), T)
    key = Opt(_tex(key_v), True, "The velocity is negative only for $%d<t<%d$. There the distance counts $-v$ while the displacement counts $v$, so the difference is $2\\int_{%d}^{%d}\\left(-v(t)\\right)dt=%s$." % (p, q, p, q, _L(key_v)), key_v)
    bpr = _nb("c_distance_minus_displacement", "8.2", "1.E", "Compare total distance with net displacement for a particle whose velocity changes sign",
              ["Find the times when the velocity is zero and where it is negative", "Distance counts the negative part with the opposite sign, so the difference is twice the integral of minus v over the negative part", "Evaluate that integral exactly"],
              [("total distance is the integral of |v| and net displacement is the integral of v", "v is negative only between its two zeros")],
              [("displacement_only", "reports the displacement"), ("distance_only", "reports the total distance"), ("half_difference", "reports only the negative-velocity distance"), ("signed_piece", "reports the signed integral over the negative part")],
              "scipy quad of |v| minus scipy quad of v over [0, T] with break points at the zeros (independent of the piece-by-piece exact integration)")
    return build("c_distance_minus_displacement", "8.2", "1.E", "not_allowed", stem, key, pool, rng, bpr, 100, [f"p={p}", f"q={q}", f"T={T}"])


# 8.1 적분의 평균값 정리: f(c)=평균값 인 c
def c_mvt_integral_value(rng):
    for _ in forever():
        a, b = rng.choice([(0, 3), (0, 6), (0, 9), (1, 4), (3, 6), (2, 5), (1, 7)])
        avg = sp.Rational(b ** 3 - a ** 3, 3 * (b - a))
        key_v = sp.sqrt(avg)
        fn = lambda z: z * z
        av_num = _I.quad(fn, a, b)[0] / (b - a)
        cc = _O.brentq(lambda z: z * z - av_num, a, b)
        _chk(abs(cc - float(key_v)) < 1e-9 and a < float(key_v) < b)
        cand = [("Reports the average value $%s$ of $f$ itself instead of the $x$-value $c$ where $f(c)$ equals it." % _L(avg), avg),
                ("Takes the midpoint $c=\\frac{%d+%d}{2}$ of the interval." % (a, b), sp.Rational(a + b, 2)),
                ("Solves $f(c)=\\frac{f(%d)+f(%d)}{2}$, the average of the endpoint values, which gives $c=%s$." % (a, b, _L(sp.sqrt(sp.Rational(a * a + b * b, 2)))), sp.sqrt(sp.Rational(a * a + b * b, 2))),
                ("Solves $f(c)=\\int_{%d}^{%d}f(x)\\,dx=%s$ without dividing by the length of the interval." % (a, b, _L(sp.Rational(b ** 3 - a ** 3, 3))), sp.sqrt(sp.Rational(b ** 3 - a ** 3, 3)))]
        try:
            pool = _eopts([(w, vv, None) for w, vv in cand], key_v)
        except ValueError:
            continue
        break
    stem = "Let $f(x)=x^{2}$. By the Mean Value Theorem for integrals, there is a number $c$ in the open interval $(%d,%d)$ such that $f(c)$ equals the average value of $f$ on $[%d,%d]$. What is the value of $c$?" % (a, b, a, b)
    key = Opt(_tex(key_v), True, "The average value is $\\frac{1}{%d}\\int_{%d}^{%d}x^{2}\\,dx=%s$. Solving $c^{2}=%s$ with $c$ in $(%d,%d)$ gives $c=%s$." % (b - a, a, b, _L(avg), _L(avg), a, b, _L(key_v)), key_v)
    bpr = _nb("c_mvt_integral_value", "8.1", "3.D", "Find the number c guaranteed by the Mean Value Theorem for integrals for a power function",
              ["Compute the average value of f on the interval as the integral divided by the length", "Set f(c) equal to the average value", "Solve and keep the solution in the open interval"],
              [("a continuous function takes its average value at some c in the open interval", "x squared is continuous on the closed interval")],
              [("average_itself", "reports the average value instead of c"), ("midpoint", "takes the midpoint"), ("endpoint_average", "uses the average of the endpoint values"), ("no_division", "forgets to divide by the interval length")],
              "root of f(c) minus the numerical average (scipy quad / Brent) (independent of the exact integral)")
    return build("c_mvt_integral_value", "8.1", "3.D", "not_allowed", stem, key, pool, rng, bpr, 95, [f"a={a}", f"b={b}"])


# 8.4 e^x 와 e^-x 사이의 면적
def c_area_exp_between(rng):
    bb = rng.choice([2, 3, 4])
    L = sp.log(bb)
    key_v = bb + sp.Rational(1, bb) - 2
    _chk(abs(_I.quad(lambda z: math.exp(z) - math.exp(-z), 0, math.log(bb))[0] - float(key_v)) < 1e-9)
    cand = [("Integrates $e^{x}-e^{-x}$ but takes the antiderivative of $e^{-x}$ to be $e^{-x}$, forgetting the factor $-1$, which gives $%s$." % _L(bb - sp.Rational(1, bb)), bb - sp.Rational(1, bb)),
            ("Integrates only the upper curve $y=e^{x}$ from $0$ to $\\ln %d$ and ignores the lower curve." % bb, bb - 1),
            ("Uses $x=%d$ instead of $x=\\ln %d$ as the upper limit, which gives $e^{%d}+e^{-%d}-2$." % (bb, bb, bb, bb), sp.exp(bb) + sp.exp(-bb) - 2),
            ("Evaluates the antiderivative $e^{x}+e^{-x}$ only at the upper limit and does not subtract its value at $x=0$.", bb + sp.Rational(1, bb))]
    pool = _eopts([(w, vv, None) for w, vv in cand], key_v)
    stem = "Let $R$ be the region in the first quadrant bounded by the graphs of $y=e^{x}$ and $y=e^{-x}$, the $y$-axis, and the line $x=\\ln %d$. What is the area of $R$?" % bb
    key = Opt(_tex(key_v), True, "On $0\\le x\\le \\ln %d$ the graph of $e^{x}$ is above that of $e^{-x}$, so the area is $\\int_0^{\\ln %d}(e^{x}-e^{-x})\\,dx=\\left[e^{x}+e^{-x}\\right]_0^{\\ln %d}=\\left(%d+\\frac{1}{%d}\\right)-2=%s$." % (bb, bb, bb, bb, bb, _L(key_v)), key_v)
    bpr = _nb("c_area_exp_between", "8.4", "1.D", "Find the exact area between y = e^x and y = e^-x on an interval ending at a logarithm",
              ["Decide which curve is on top and write top minus bottom", "Find the antiderivative, taking care with the chain rule factor for e^-x", "Evaluate at ln b and at 0 and subtract"],
              [("area between curves is the integral of top minus bottom", "e^x is greater than e^-x for x > 0")],
              [("antiderivative_sign", "forgets the minus sign when integrating e^-x"), ("top_only", "integrates only the upper curve"), ("wrong_limit", "uses b instead of ln b"), ("no_lower_limit", "omits the lower limit")],
              "scipy quad of e^x - e^-x on [0, ln b] (independent of the antiderivative)")
    return build("c_area_exp_between", "8.4", "1.D", "not_allowed", stem, key, pool, rng, bpr, 90, [f"b={bb}"])


# 8.4 세 번 만나는 곡선 사이의 면적: 적분식 고르기(두 영역으로 나눠야 한다)
def c_area_crossing_setup(rng):
    k = rng.choice([1, 4, 9])
    s = int(math.isqrt(k))
    kx = _L(k * x) if k != 1 else "x"
    key_v = sp.Rational(k * k, 2)
    I = lambda lo, hi, body, c="": "%s\\displaystyle\\int_{%s}^{%s}\\left(%s\\right)dx" % (c, lo, hi, body)
    key_t = "$" + I(0, s, kx + "-x^{3}", "2") + "$"
    f = lambda z: abs(k * z - z ** 3)
    _chk(abs(_I.quad(f, -s, s, points=[0], limit=200)[0] - float(key_v)) < 1e-9)
    cand = [("Uses a single integral of $%s-x^{3}$ over $[%d,%d]$; the two regions have opposite orientation, so they cancel and the value is $0$." % (kx, -s, s), "$" + I(-s, s, kx + "-x^{3}") + "$", sp.Integer(0)),
            ("Integrates over $[0,%d]$ only, which is just the region in the first quadrant, with value $%s$." % (s, _L(sp.Rational(k * k, 4))), "$" + I(0, s, kx + "-x^{3}") + "$", sp.Rational(k * k, 4)),
            ("Takes top minus bottom in the wrong order on both halves, so the value is $%s$." % _L(-sp.Rational(k * k, 2)), "$2" + I(0, s, "x^{3}-" + kx) + "$", -sp.Rational(k * k, 2)),
            ("Adds the two regions as separate integrals but uses the same top-minus-bottom order on both, $\\int_{%d}^{0}\\left(%s-x^{3}\\right)dx+\\int_{0}^{%d}\\left(%s-x^{3}\\right)dx$, which cancels to $0$." % (-s, kx, s, kx), "$" + I(-s, 0, kx + "-x^{3}") + "+" + I(0, s, kx + "-x^{3}") + "$", sp.Integer(0)),
            ("Solves $x^{2}=%d$ but uses $%d$ instead of $\\sqrt{%d}=%d$ as the upper limit and then doubles the right half." % (k, k, k, s), "$2" + I(0, k, kx + "-x^{3}") + "$", 2 * sp.integrate(k * x - x ** 3, (x, 0, k)))]
    pool = _eopts([(w, vv, tx) for w, tx, vv in cand], key_v)
    stem = "Let $R$ be the region enclosed by the graphs of $y=x^{3}$ and $y=%s$. Which of the following gives the area of $R$?" % kx
    key = Opt(key_t, True, "The graphs intersect at $x=%d$, $x=0$ and $x=%d$. On $[%d,0]$ the cubic is above the line and on $[0,%d]$ the line is above the cubic, so the area is the sum of the two integrals of top minus bottom; by symmetry the two equal pieces give twice the integral over $[0,%d]$, which is $%s$." % (-s, s, -s, s, s, _L(key_v)), key_v)
    bpr = _nb("c_area_crossing_setup", "8.4", "1.D", "Set up the area between two curves that cross at an interior point, requiring the integral to be split",
              ["Find all the intersection points", "Decide which curve is on top on each piece", "Write one integral of top minus bottom for each piece and add"],
              [("the area is the integral of |f - g|, which requires splitting where the curves cross", "the cubic and the line change order at x = 0")],
              [("single_integral", "uses one integral so the pieces cancel"), ("one_piece", "includes only one of the two regions"), ("reversed_order", "subtracts in the wrong order"), ("wrong_limit", "uses the y-value of the intersection as a limit")],
              "scipy quad of |kx - x^3| over the full interval with a break point at 0 (independent of the split setup); each option's integral also evaluated exactly")
    return build("c_area_crossing_setup", "8.4", "1.D", "not_allowed", stem, key, pool, rng, bpr, 95, [f"k={k}"])


# 8.9 y 축 회전(디스크, y 에 대한 적분)
def c_volume_disc_y_axis(rng):
    n, h = rng.choice([(2, 4), (2, 9), (2, 16), (3, 8)])
    a = int(round(h ** (1.0 / n)))
    V = sp.integrate(sp.pi * y ** sp.Rational(2, n), (y, 0, h))
    # 독립 경로: 원통껍질 2π∫ x (h - x^n) dx
    num = 2 * math.pi * _I.quad(lambda z: z * (h - z ** n), 0, a)[0]
    _chk(abs(num - float(V)) < 1e-9 and a ** n == h)
    cand = [("Uses the radius $y$ instead of $x=%s$, so the integrand is $\\pi y^{2}$ and the volume is $%s$." % (_L(y ** sp.Rational(1, n)), _L(sp.integrate(sp.pi * y ** 2, (y, 0, h)))), sp.integrate(sp.pi * y ** 2, (y, 0, h))),
            ("Revolves the region about the $x$-axis instead of the $y$-axis: $\\pi\\int_0^{%d}\\left(%d^{2}-x^{%d}\\right)dx=%s$." % (a, h, 2 * n, _L(sp.integrate(sp.pi * (h ** 2 - x ** (2 * n)), (x, 0, a)))), sp.integrate(sp.pi * (h ** 2 - x ** (2 * n)), (x, 0, a))),
            ("Evaluates $\\int_0^{%d}%s\\,dy$ correctly but leaves out the factor $\\pi$." % (h, _L(y ** sp.Rational(2, n))), sp.integrate(y ** sp.Rational(2, n), (y, 0, h))),
            ("Treats the solid as a cylinder of radius $%d$ and height $%d$, $\\pi\\cdot%d^{2}\\cdot%d$." % (a, h, a, h), sp.pi * a * a * h)]
    pool = _eopts([(w, vv, None) for w, vv in cand], V, positive=True)
    stem = "Let $R$ be the region in the first quadrant bounded by the graph of $y=x^{%d}$, the line $y=%d$, and the $y$-axis. What is the volume of the solid generated when $R$ is revolved about the $y$-axis?" % (n, h)
    key = Opt(_tex(V), True, "Each cross section perpendicular to the $y$-axis is a disk of radius $x=%s$, so $V=\\pi\\int_0^{%d}%s\\,dy=%s$." % (_L(y ** sp.Rational(1, n)), h, _L(y ** sp.Rational(2, n)), _L(V)), V)
    bpr = _nb("c_volume_disc_y_axis", "8.9", "1.D", "Find the exact volume of a solid obtained by revolving a region about the y-axis using disks and integrating with respect to y",
              ["Solve y = x^n for x so the radius is a function of y", "Set up pi times the integral of the radius squared with respect to y over the y-range", "Evaluate exactly"],
              [("when revolving about the y-axis with disks, integrate in y with radius x as a function of y", "the region touches the y-axis")],
              [("radius_y", "uses the y-value as the radius"), ("x_axis", "revolves about the x-axis"), ("no_pi", "forgets pi"), ("cylinder", "uses a cylinder")],
              "cylindrical shells 2 pi times the integral of x (h - x^n) with scipy quad (independent of the disk setup)")
    return build("c_volume_disc_y_axis", "8.9", "1.D", "not_allowed", stem, key, pool, rng, bpr, 100, [f"n={n}", f"h={h}"])


STAGE_LISTS = {"supp_r3b3_ab": [
    "c_antideriv_power_rules", "c_usub_indef_trig", "c_usub_limits_transform", "c_usub_ln_definite", "c_sigma_to_integral", "c_accum_two_limits", "c_trapezoid_table_initial", "c_complete_square_arctan", "c_separable_general_solution", "c_slope_sign_points", "c_area_between_in_y",
    "c_washer_about_line", "c_xsection_nonstandard", "c_position_from_velocity", "c_distance_minus_displacement", "c_mvt_integral_value", "c_area_exp_between",
    "c_area_crossing_setup", "c_volume_disc_y_axis"]}
