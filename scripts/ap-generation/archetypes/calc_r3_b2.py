"""R3 B2 (AB 단원 3·4·5, 계산기 불가): 정확한 값으로만 답이 나오는 비그래프 MC 원형.
정답·오답 값은 코드(sympy 정확 계산)가 만들고, 오답은 why 에 적은 실수를 그대로 코드로 재현한 값이다. 독립 경로는 수치(중심차분·격자·brentq)로 따로 확인한다."""
from scommon import *
from scipy import optimize as _O
import math

AB_ = "ap_calculus_ab"


def tx(v):
    return sp.latex(sp.sympify(v)).replace("\\log", "\\ln")


def L(v):
    return "$" + tx(v) + "$"


def fmt(v, nd=4):
    """정확한 값을 항상 LaTeX 로(근호·e·분수 포함) 표기한다. common.fmt 를 대신한다."""
    return "$" + tx(v) + "$"


def _lam(e, var=x):
    return sp.lambdify(var, e, "math")


def _cd(fn, a, hh=1e-6):
    return (fn(a + hh) - fn(a - hh)) / (2 * hh)


def _chk(a, b, tol=1e-5):
    if abs(float(a) - float(b)) > tol * max(1.0, abs(float(b))):
        raise ValueError("independent_check_failed")


def _P(arch, topic, skill, stem, key, ds, rng, bpd, est=90, facts=None):
    bpr = nb(arch, topic, skill, "not_allowed", *bpd, AB_)
    return build(arch, topic, skill, "not_allowed", stem, key, ds, rng, bpr, est, facts or [])


def _ivl(a, b):
    return "(%s,%s)" % (tx(a) if a is not None else "-\\infty", tx(b) if b is not None else "\\infty")


def _union(idx, bps):
    """구간 번호 목록 → 합집합 문자열(연속한 구간은 하나로 합친다). bps: [b0, b1, ..., None] 이면 i 번째 구간 = (bps[i], bps[i+1])."""
    runs, cur = [], []
    for i in sorted(idx):
        if cur and i == cur[-1] + 1:
            cur.append(i)
        else:
            if cur:
                runs.append(cur)
            cur = [i]
    if cur:
        runs.append(cur)
    return "$" + "\\cup".join(_ivl(bps[r[0]], bps[r[-1] + 1]) for r in runs) + "$"


def _uniq_expr(exprs, pts=(0.37, 0.71, 1.29)):
    """식들이 서로 다른 함수인지 수치로 확인."""
    for i in range(len(exprs)):
        for j in range(i + 1, len(exprs)):
            if all(abs(float(exprs[i].subs(x, p)) - float(exprs[j].subs(x, p))) < 1e-9 for p in pts):
                return False
    return True


# ============================================================ 단원 3
# 3.1 합성함수(지수·삼각)의 도함수 값
def c_chain_exp_cos_point(rng):
    a = rng.choice([2, 3, 5])
    k = rng.choice([2, 3, 4])
    x0 = sp.pi / (3 * k)
    f = a * sp.exp(sp.cos(k * x))
    key_v = sp.simplify(sp.diff(f, x).subs(x, x0))
    e0, s0, c0 = sp.sqrt(sp.E), sp.sqrt(3) / 2, sp.Rational(1, 2)
    if sp.simplify(key_v + a * k * s0 * e0) != 0:
        raise ValueError("independent_check_failed")
    _chk(_cd(_lam(f), float(x0)), float(key_v))
    ds = [("Omits the inner derivative: it differentiates $\\cos(%dx)$ as $-\\sin(%dx)$ and leaves out the factor $%d$." % (k, k, k), -a * s0 * e0),
          ("Uses $\\sin(%dx)$ instead of $-\\sin(%dx)$ as the derivative of $\\cos(%dx)$, so the sign is wrong." % (k, k, k), a * k * s0 * e0),
          ("Treats the derivative of $e^{u}$ as just $u'$ and drops the factor $e^{\\cos(%dx)}$." % k, -a * k * s0),
          ("Evaluates $-%d\\sin(%dx)$ with $\\cos(%dx)=\\frac{1}{2}$ in place of $\\sin(%dx)$." % (k, k, k, k), -a * k * c0 * e0)]
    pool = opts(ds, key_v, fmt)
    stem = "What is the slope of the line tangent to the graph of $f(x)=%d e^{\\cos(%dx)}$ at the point where $x=%s$?" % (a, k, tx(x0))
    key = Opt(fmt(key_v), True, "By the chain rule $f'(x)=%d\\cdot e^{\\cos(%dx)}\\cdot(-%d\\sin(%dx))$; at $x=%s$ we have $\\cos(%dx)=\\frac{1}{2}$ and $\\sin(%dx)=\\frac{\\sqrt{3}}{2}$, so $f'=%s$." % (a, k, k, k, tx(x0), k, k, tx(key_v)), key_v)
    return _P("c_chain_exp_cos_point", "3.1", "1.E", stem, key, pool, rng,
              ("Differentiate an exponential of a trigonometric function with the chain rule and evaluate at an exact point",
               ["Identify the outer function $e^{u}$ and the inner function $u=\\cos(kx)$", "Multiply the outer derivative $e^{u}$ by the inner derivative $-k\\sin(kx)$", "Evaluate at the given angle using exact trigonometric values"],
               [("the derivative of $e^{u}$ is $e^{u}u'$", "chain rule with $u=\\cos(kx)$")],
               [("omits_inner_factor", "forgets the factor k from the inner derivative"), ("sign_error", "drops the minus sign of the cosine derivative"), ("drops_exponential", "drops the exponential factor"), ("cos_for_sin", "evaluates cosine where sine belongs")],
               "central difference (step 1e-6) of the lambdified function at the numeric point (independent of the symbolic chain rule)"),
              95, [f"a={a}", f"k={k}", f"key={key_v}"])


# 3.5 로그 합성함수의 도함수 식 고르기
def c_log_trig_deriv_expr(rng):
    for _ in forever():
        p = rng.choice([3, 4, 5])
        b = rng.choice([1, 2, 3])
        tr = rng.choice([sp.sin, sp.cos])
        u = p + b * tr(x)
        du = sp.diff(u, x)
        f = sp.log(u)
        key_e = du / u
        cand = [("Differentiates $\\ln u$ as $\\frac{1}{u}$ and forgets to multiply by $u'$.", 1 / u),
                ("Multiplies $u'$ by $u$ instead of dividing by $u$.", du * u),
                ("Reverses the sign of the inner derivative $u'$.", -du / u),
                ("Divides $u'$ by $u^{2}$ instead of $u$.", du / u ** 2)]
        if _uniq_expr([key_e] + [c[1] for c in cand]):
            break
    _chk(_cd(_lam(f), 0.9), float(key_e.subs(x, 0.9)))
    pool = textopts([("$" + tx(e) + "$", w) for w, e in cand])
    stem = "Let $f(x)=\\ln\\left(%s\\right)$. Which of the following is $f'(x)$?" % tx(u)
    key = Opt("$" + tx(key_e) + "$", True, "With $u=%s$ and $u'=%s$, the chain rule gives $f'(x)=\\frac{u'}{u}$." % (tx(u), tx(du)), None)
    return _P("c_log_trig_deriv_expr", "3.5", "1.C", stem, key, pool, rng,
              ("Select the correct derivative expression of the natural logarithm of a trigonometric expression",
               ["Recognize a composite $\\ln u$ and name $u$", "Apply $\\frac{d}{dx}\\ln u=\\frac{u'}{u}$", "Differentiate the inner expression and write the quotient"],
               [("the derivative of $\\ln u$ is $u'/u$", "chain rule")],
               [("no_inner_derivative", "uses 1/u only"), ("product_instead_of_quotient", "multiplies u' by u"), ("sign_error", "flips the sign of u'"), ("wrong_power", "divides by u squared")],
               "central difference of the lambdified function compared with the key expression at a numeric point (independent of the option expressions)"),
              80, [f"u={u}"])


# 3.2 음함수로 정의된 곡선의 접선의 방정식
_CURVES = [x ** 3 + y ** 3, x ** 2 * y + y ** 3, x * y ** 2 + x ** 2, x ** 2 + x * y + y ** 3]


def c_implicit_tangent_line_eq(rng):
    for _ in forever():
        F = rng.choice(_CURVES)
        p = rng.choice([1, 2, 3, -1, -2])
        q = rng.choice([1, 2, 3, -1])
        Fx, Fy = sp.diff(F, x).subs({x: p, y: q}), sp.diff(F, y).subs({x: p, y: q})
        if Fy == 0 or Fx == 0:
            continue
        m = -Fx / Fy
        if abs(m) == 1:
            continue
        bint = q - m * p
        bs = p - m * q
        cands = [("Uses the opposite sign for the slope: $+\\frac{F_x}{F_y}$ instead of $-\\frac{F_x}{F_y}$.", (-m, q + m * p)),
                 ("Uses the reciprocal of the correct slope.", (1 / m, q - p / m)),
                 ("Swaps the coordinates of the point and builds the line through $(%d,%d)$." % (q, p), (m, bs)),
                 ("Finds the correct slope but writes the line as $y=mx+q$ with $q=%d$, forgetting to subtract $mx_0$." % q, (m, q))]
        lines = {(m, bint)} | {c[1] for c in cands}
        if len(lines) == 5 and p != 0:
            break
    c0 = F.subs({x: p, y: q})
    # 독립 경로: 곡선에서 y(x) 를 수치로 풀어 중심차분
    yf = lambda xv: _O.newton(lambda yv: float(F.subs({x: xv, y: yv})) - float(c0), float(q))
    Ff = sp.lambdify((x, y), F, "math")
    yf = lambda xv: _O.brentq(lambda yv: Ff(xv, yv) - float(c0), q - 0.45, q + 0.45) if (Ff(xv, q - 0.45) - float(c0)) * (Ff(xv, q + 0.45) - float(c0)) < 0 else _O.newton(lambda yv: Ff(xv, yv) - float(c0), float(q))
    _chk(_cd(yf, float(p), 1e-5), float(m), 1e-4)
    pool = textopts([("$y=%s$" % tx(mm * x + bb), w) for w, (mm, bb) in cands])
    key = Opt("$y=%s$" % tx(m * x + bint), True, "Differentiating implicitly, $\\frac{dy}{dx}=-\\frac{F_x}{F_y}$; at $(%d,%d)$ this is $%s$, so $%s=%s(%s)$." % (p, q, tx(m), ("y-%d" % q) if q >= 0 else ("y+%d" % -q), tx(m), ("x-%d" % p) if p >= 0 else ("x+%d" % -p)), None)
    stem = "The point $(%d,%d)$ lies on the curve $%s=%s$. Which of the following is an equation of the line tangent to the curve at this point?" % (p, q, tx(F), tx(c0))
    return _P("c_implicit_tangent_line_eq", "3.2", "1.E", stem, key, pool, rng,
              ("Write the equation of the tangent line to an implicitly defined curve at a point",
               ["Differentiate both sides with respect to $x$, treating $y$ as a function of $x$", "Solve for $\\frac{dy}{dx}$ and evaluate at the point to get the slope", "Write the point-slope equation and simplify"],
               [("the slope of the tangent line is dy/dx at the point", "the point lies on the curve and $F_y\\ne 0$ there")],
               [("sign_error", "wrong sign of the slope"), ("reciprocal_slope", "reciprocal of the slope"), ("swapped_point", "swaps the coordinates of the point"), ("forgot_to_subtract", "writes y = m x + q")],
               "solve the curve numerically for $y(x)$ near the point and take a central difference (independent of implicit differentiation)"),
              100, [f"F={F}", f"p={p}", f"q={q}"])


# 5.? 음함수 곡선에서 수평접선의 x 좌표(1계 도함수만)
_CUBIC_PARAMS = [(2, 5, 1), (2, 7, -1), (3, 8, 1), (3, 28, 2)]


def c_implicit_cubic_horizontal_x(rng):
    for _ in forever():
        a, k, r1 = rng.choice(_CUBIC_PARAMS)
        if r1 == a:
            continue
        # 곡선 y^2 = x^3 - 3a x^2 + k, 2y y' = 3x^2 - 6a x
        if k <= 0 or k - 4 * a ** 3 >= 0:
            continue
        if r1 ** 3 - 3 * a * r1 ** 2 + k != 0:
            raise ValueError("bad_param_table")
        break
    key_v = sp.Integer(0)
    ds = [("Solves $3x^{2}-%dx=0$ but keeps $x=%d$ too, where $y^{2}=%d<0$ so there is no point on the curve." % (6 * a, 2 * a, k - 4 * a ** 3), sp.Integer(2 * a)),
          ("Finds where $y=0$: at $x=%d$ the curve has a vertical tangent, not a horizontal one." % r1, sp.Integer(r1)),
          ("Differentiates $-%dx^{2}$ as $-%dx$, so the numerator becomes $3x^{2}-%dx=3x(x-%d)$ and the root $x=%d$ appears." % (3 * a, 3 * a, 3 * a, a, a), sp.Integer(a)),
          ("Drops the exponent factor $3$ when differentiating $x^{3}$, so the numerator becomes $x^{2}-%dx=x(x-%d)$ and the root $x=%d$ appears." % (6 * a, 6 * a, 6 * a), sp.Integer(6 * a))]
    # 독립 경로: 격자에서 상반 가지 Y(x)=sqrt(x^3-3a x^2+k) 의 내부 극값 위치
    xs = [-3 + 13 * i / 26000 for i in range(26001)]
    Y = [math.sqrt(max(0.0, w ** 3 - 3 * a * w * w + k)) if w ** 3 - 3 * a * w * w + k > 0 else None for w in xs]
    ext = [xs[i] for i in range(1, len(xs) - 1) if Y[i - 1] is not None and Y[i] is not None and Y[i + 1] is not None and ((Y[i] - Y[i - 1]) * (Y[i + 1] - Y[i]) < 0)]
    if len(ext) != 1 or abs(ext[0]) > 1e-3:
        raise ValueError("independent_check_failed")
    pool = opts(ds, key_v, fmt)
    stem = "The curve $y^{2}=x^{3}-%dx^{2}+%d$ has a horizontal tangent line at one value of $x$ (at the points of the curve with that $x$-coordinate). What is that value of $x$?" % (3 * a, k)
    key = Opt(fmt(key_v), True, "Differentiating implicitly, $2y\\frac{dy}{dx}=3x^{2}-%dx$, so $\\frac{dy}{dx}=0$ needs $3x(x-%d)=0$; $x=%d$ gives $y^{2}=%d<0$ (no point), so only $x=0$ works, where $y^{2}=%d$." % (6 * a, 2 * a, 2 * a, k - 4 * a ** 3, k), key_v)
    return _P("c_implicit_cubic_horizontal_x", "3.2", "1.E", stem, key, pool, rng,
              ("Locate the horizontal tangent of an implicit cubic curve using the first derivative and check which candidates lie on the curve",
               ["Differentiate implicitly to get $dy/dx=(3x^{2}-6ax)/(2y)$", "Set the numerator equal to $0$ and list the candidate $x$-values", "Discard candidates for which no point of the curve exists"],
               [("a horizontal tangent needs $dy/dx=0$ at a point ON the curve", "$y^{2}=%d<0$ at the other root" % (k - 4 * a ** 3))],
               [("off_curve_root", "keeps the root with no point on the curve"), ("vertical_tangent_point", "uses the place where y = 0"), ("power_rule_slip", "drops an exponent factor when differentiating"), ("missing_cubic_factor", "drops the factor 3 when differentiating the cubic term")],
               "grid scan of the upper branch $Y(x)=\\sqrt{x^{3}-3ax^{2}+k}$ for interior local extrema (independent of the implicit derivative)"),
              105, [f"a={a}", f"k={k}"])


# 3.3 역함수의 도함수(식으로 주어진 함수)
_INV_F = [(x ** 3 + x, "x^{3}+x", [1, 2]), (x ** 3 + 2 * x, "x^{3}+2x", [1, 2]), (x ** 5 + x, "x^{5}+x", [1]), (sp.exp(x) + x, "e^{x}+x", [0]), (2 * x ** 3 + x, "2x^{3}+x", [1]), (x ** 3 + 3 * x, "x^{3}+3x", [1])]


def c_inverse_deriv_formula(rng):
    f, ftex, avals = rng.choice(_INV_F)
    a = rng.choice(avals)
    fp = sp.diff(f, x)
    b = sp.simplify(f.subs(x, a))
    fpa, fpb = fp.subs(x, a), fp.subs(x, b)
    key_v = 1 / fpa
    # 독립 경로: f(z)=b±h 를 수치로 풀어 역함수의 중심차분
    ff = _lam(f)
    inv = lambda bb: _O.brentq(lambda z: ff(z) - bb, -5, 5)
    _chk(_cd(inv, float(b), 1e-5), float(key_v), 1e-5)
    ds = [("Evaluates the derivative at the wrong place: $\\frac{1}{f'(%s)}$ instead of $\\frac{1}{f'(%d)}$." % (tx(b), a), 1 / fpb),
          ("Takes $f'(%d)$ and forgets to use its reciprocal." % a, fpa),
          ("Divides by $[f'(%d)]^{2}$ instead of by $f'(%d)$, giving $\\frac{1}{[f'(%d)]^{2}}$." % (a, a, a), 1 / fpa ** 2),
          ("Uses $\\frac{1}{f(%d)}=\\frac{1}{%s}$, the reciprocal of the function value instead of the derivative." % (a, tx(b)), 1 / b)]
    pool = opts(ds, key_v, fmt)
    stem = "Let $f(x)=%s$, which is one-to-one, and let $g$ be the inverse function of $f$. What is the value of $g'(%s)$?" % (ftex, tx(b))
    key = Opt(fmt(key_v), True, "Since $f(%d)=%s$, $g(%s)=%d$, and $g'(%s)=\\frac{1}{f'(g(%s))}=\\frac{1}{f'(%d)}=%s$." % (a, tx(b), tx(b), a, tx(b), tx(b), a, tx(key_v)), key_v)
    return _P("c_inverse_deriv_formula", "3.3", "1.E", stem, key, pool, rng,
              ("Find the derivative of an inverse function at a point when the function is given by a formula",
               ["Find $a$ with $f(a)=b$ by inspection", "Use $g'(b)=1/f'(g(b))=1/f'(a)$", "Compute $f'(a)$ and take the reciprocal"],
               [("$g'(b)=1/f'(g(b))$ for an inverse function", "$f$ is one-to-one and $f'(a)\\ne 0$")],
               [("wrong_evaluation_point", "evaluates f' at b"), ("no_reciprocal", "uses f' without reciprocal"), ("squared_denominator", "squares the derivative in the denominator"), ("reciprocal_of_value", "reciprocal of f(a)")],
               "root-finding for $f(z)=b\\pm h$ and a central difference of the numerical inverse (independent of the formula $1/f'$)"),
              85, [f"f={f}", f"a={a}"])


# 3.4 역삼각함수 합성의 도함수 값
def c_arc_trig_deriv_value(rng):
    if rng.random() < 0.5:
        p = rng.choice([2, 3, 4])
        h = sp.atan(p * x ** 2)
        x0 = sp.Integer(1)
        key_v = sp.Rational(2 * p, 1 + p * p)
        u = p
        ds = [("Omits the inner derivative: uses $\\frac{1}{1+u^{2}}$ with $u=%dx^{2}$ and leaves out $u'=%dx$." % (p, 2 * p), sp.Rational(1, 1 + p * p)),
              ("Uses $\\frac{u'}{1+u}$ in place of $\\frac{u'}{1+u^{2}}$." , sp.Rational(2 * p, 1 + p)),
              ("Takes the derivative of $\\arctan u$ to be just $u'$.", sp.Integer(2 * p)),
              ("Squares the denominator: $\\frac{u'}{\\left(1+u^{2}\\right)^{2}}$.", sp.Rational(2 * p, (1 + p * p) ** 2))]
        stem = "Let $h(x)=\\arctan\\left(%dx^{2}\\right)$. What is the value of $h'(1)$?" % p
        why = "$h'(x)=\\frac{2%sx}{1+%dx^{4}}$ hmm" % ("", 0)
        why = "With $u=%dx^{2}$, $h'(x)=\\frac{u'}{1+u^{2}}=\\frac{%dx}{1+%dx^{4}}$; at $x=1$ this is $%s$." % (p, 2 * p, p * p, tx(key_v))
        bpd = ("Differentiate an inverse tangent of a power expression and evaluate at a point",
               ["Identify the outer function $\\arctan u$ and the inner function $u$", "Apply $\\frac{d}{dx}\\arctan u=\\frac{u'}{1+u^{2}}$", "Substitute $x=1$"],
               [("the derivative of $\\arctan u$ is $u'/(1+u^{2})$", "chain rule")],
               [("no_inner_derivative", "omits the inner derivative u'"), ("denominator_without_square", "uses 1+u in the denominator instead of 1+u squared"), ("only_inner", "uses u' only"), ("squared_denominator", "squares the denominator")])
    else:
        q = rng.choice([2, 3, 4])
        h = sp.asin(q * x)
        x0 = sp.Rational(1, 2 * q)
        key_v = sp.simplify(sp.diff(h, x).subs(x, x0))
        ds = [("Omits the inner derivative $%d$: uses $\\frac{1}{\\sqrt{1-u^{2}}}$ only." % q, sp.simplify(1 / sp.sqrt(1 - (q * x0) ** 2))),
              ("Uses $\\frac{u'}{1-u^{2}}$, with no square root.", sp.simplify(q / (1 - (q * x0) ** 2))),
              ("Uses $\\frac{u'}{\\sqrt{1-u}}$, forgetting to square $u$.", sp.simplify(q / sp.sqrt(1 - q * x0))),
              ("Uses the derivative of $\\arccos u$, which is $-\\frac{u'}{\\sqrt{1-u^{2}}}$.", -key_v)]
        stem = "Let $h(x)=\\arcsin(%dx)$. What is the value of $h'\\left(\\frac{1}{%d}\\right)$?" % (q, 2 * q)
        why = "With $u=%dx$, $h'(x)=\\frac{%d}{\\sqrt{1-%dx^{2}\\cdot %d}}$; at $x=\\frac{1}{%d}$, $u=\\frac{1}{2}$ so $h'=\\frac{%d}{\\sqrt{3/4}}=%s$." % (q, q, 1, q * q, 2 * q, q, tx(key_v))
        why = "With $u=%dx$, $h'(x)=\\frac{u'}{\\sqrt{1-u^{2}}}=\\frac{%d}{\\sqrt{1-%dx^{2}}}$; at $x=\\frac{1}{%d}$ we have $u=\\frac{1}{2}$, so $h'=\\frac{%d}{\\sqrt{3/4}}=%s$." % (q, q, q * q, 2 * q, q, tx(key_v))
        bpd = ("Differentiate an inverse sine of a linear expression and evaluate at an exact point",
               ["Identify the outer function $\\arcsin u$ and the inner function $u=qx$", "Apply $\\frac{d}{dx}\\arcsin u=\\frac{u'}{\\sqrt{1-u^{2}}}$", "Evaluate with $u=1/2$"],
               [("the derivative of $\\arcsin u$ is $u'/\\sqrt{1-u^{2}}$", "chain rule, $|u|<1$ at the point")],
               [("no_inner_derivative", "omits the inner derivative u'"), ("no_square_root", "no square root"), ("u_not_squared", "forgets to square u"), ("wrong_function", "uses arccos")])
    _chk(_cd(_lam(h), float(x0), 1e-6), float(key_v), 1e-5)
    pool = opts(ds, key_v, fmt)
    key = Opt(fmt(key_v), True, why, key_v)
    return _P("c_arc_trig_deriv_value", "3.4", "1.E", stem, key, pool, rng, bpd + ("central difference (step 1e-6) of the lambdified function (independent of the inverse-trig formula)",), 90, [f"h={h}", f"x0={x0}"])


# 3.6 곱 x e^{kx} 의 이계도함수 값
def c_second_deriv_product_exp(rng):
    k = rng.choice([2, 3, 4])
    x0 = sp.Rational(1, k)
    f = x * sp.exp(k * x)
    f2 = sp.diff(f, x, 2)
    key_v = sp.simplify(f2.subs(x, x0))
    f1v = sp.simplify(sp.diff(f, x).subs(x, x0))
    if sp.simplify(key_v - 3 * k * sp.E) != 0:
        raise ValueError("independent_check_failed")
    ff = _lam(f)
    hh = 1e-3
    _chk((ff(float(x0) + hh) - 2 * ff(float(x0)) + ff(float(x0) - hh)) / hh ** 2, float(key_v), 1e-5)
    ds = [("Treats the derivative of $e^{%dx}$ as $e^{%dx}$ (no factor $%d$) in both derivatives, which gives $(2+x)e^{%dx}$." % (k, k, k, k), (2 + x0) * sp.exp(1)),
          ("Stops after the first derivative and reports $f'\\left(\\frac{1}{%d}\\right)$." % k, f1v),
          ("Differentiates the product $(1+%dx)e^{%dx}$ as the product of the derivatives, $%d\\cdot%de^{%dx}$." % (k, k, k, k, k), k * k * sp.exp(1)),
          ("Drops the exponential factor: evaluates $%d+%d^{2}x$ without the factor $e^{%dx}$." % (2 * k, k, k), sp.Integer(3 * k))]
    pool = opts(ds, key_v, fmt)
    stem = "Let $f(x)=xe^{%dx}$. What is the value of $f''\\left(\\frac{1}{%d}\\right)$?" % (k, k)
    key = Opt(fmt(key_v), True, "$f'(x)=(1+%dx)e^{%dx}$ and $f''(x)=(%d+%d^{2}x)e^{%dx}$; at $x=\\frac{1}{%d}$ this is $%s$." % (k, k, 2 * k, k, k, k, tx(key_v)), key_v)
    return _P("c_second_deriv_product_exp", "3.6", "1.E", stem, key, pool, rng,
              ("Find a second derivative of a product with an exponential of a linear function and evaluate it at a point",
               ["Differentiate once with the product and chain rules", "Differentiate the result again with the product and chain rules", "Substitute the given $x$"],
               [("$f''$ is the derivative of $f'$", "product rule and chain rule are both needed twice")],
               [("missing_chain_factor", "no factor k from e^{kx}"), ("first_derivative_only", "stops at f'"), ("product_of_derivatives", "differentiates a product factor by factor"), ("drops_exponential", "drops the exponential")],
               "second central difference (step 1e-3) of the lambdified function (independent of symbolic differentiation)"),
              100, [f"k={k}", f"key={key_v}"])


# 3.5 곱과 합성이 함께 나오는 함수 x*sqrt(x^2+a) 의 도함수 값
_SQRT = [(3, 16, 5), (2, 5, 3), (1, 3, 2), (4, 9, 5), (5, 11, 6), (2, 12, 4), (3, 7, 4), (6, 28, 8), (4, 33, 7)]


def c_product_sqrt_chain_value(rng):
    x0, a, r = rng.choice(_SQRT)
    f = x * sp.sqrt(x ** 2 + a)
    key_v = sp.Rational(r * r + x0 * x0, r)  # r + x0^2 / r
    if sp.simplify(sp.diff(f, x).subs(x, x0) - key_v) != 0:
        raise ValueError("independent_check_failed")
    _chk(_cd(_lam(f), float(x0)), float(key_v))
    R_, X_ = sp.Integer(r), sp.Integer(x0)
    ds = [("Differentiates the product factor by factor: $1\\cdot\\frac{x}{\\sqrt{x^{2}+%d}}$." % a, X_ / R_),
          ("Forgets the factor $2x$ from the chain rule: uses $\\frac{1}{2\\sqrt{x^{2}+%d}}$ for the derivative of the square root." % a, R_ + X_ / (2 * R_)),
          ("Omits the first term of the product rule and keeps only $x\\cdot\\frac{x}{\\sqrt{x^{2}+%d}}$." % a, X_ ** 2 / R_),
          ("Drops the $\\frac{1}{2}$ from the derivative of the square root, using $\\frac{2x}{\\sqrt{x^{2}+%d}}$." % a, R_ + 2 * X_ ** 2 / R_)]
    pool = opts(ds, key_v, fmt)
    stem = "Let $f(x)=x\\sqrt{x^{2}+%d}$. What is the value of $f'(%d)$?" % (a, x0)
    key = Opt(fmt(key_v), True, "By the product and chain rules, $f'(x)=\\sqrt{x^{2}+%d}+\\frac{x^{2}}{\\sqrt{x^{2}+%d}}$; at $x=%d$ we have $\\sqrt{x^{2}+%d}=%d$, so $f'(%d)=%d+\\frac{%d}{%d}=%s$." % (a, a, x0, a, r, x0, r, x0 * x0, r, tx(key_v)), key_v)
    return _P("c_product_sqrt_chain_value", "3.5", "1.C", stem, key, pool, rng,
              ("Choose and combine the product rule and the chain rule to differentiate a product containing a square root of a polynomial",
               ["Recognize a product of $x$ and a composite square root", "Apply the product rule and the chain rule to the square root", "Evaluate at the given $x$ where the radicand is a perfect square"],
               [("both the product rule and the chain rule are required", "the radicand $x^{2}+a$ is a perfect square at the point")],
               [("product_of_derivatives", "multiplies the derivatives"), ("missing_chain_factor", "forgets 2x"), ("missing_first_term", "drops a product-rule term"), ("drops_half", "drops the 1/2")],
               "central difference (step 1e-6) of the lambdified function (independent of the symbolic rules)"),
              100, [f"x0={x0}", f"a={a}", f"key={key_v}"])


# ============================================================ 단원 4
# 4.2 다항 위치함수에서 속력이 증가하는 구간
_MOTION = [(1, 2, 2), (1, 3, 1), (1, 5, 1), (2, 4, 1), (2, 3, 2), (1, 4, 2)]


def c_speeding_up_intervals(rng):
    r1, r2, cc = rng.choice(_MOTION)
    r1, r2 = sp.Integer(r1), sp.Integer(r2)
    pos = cc * (t ** 3 - sp.Rational(3, 2) * (r1 + r2) * t ** 2 + 3 * r1 * r2 * t)
    pos = sp.expand(pos)
    v, a = sp.diff(pos, t), sp.diff(pos, t, 2)
    m = sp.solve(a, t)[0]
    bps = [sp.Integer(0), r1, m, r2, None]
    samples = [r1 / 2, (r1 + m) / 2, (m + r2) / 2, r2 + 1]
    vs = [sp.sign(v.subs(t, s)) for s in samples]
    as_ = [sp.sign(a.subs(t, s)) for s in samples]
    speed = [i for i in range(4) if vs[i] * as_[i] > 0]
    slow = [i for i in range(4) if vs[i] * as_[i] < 0]
    vpos = [i for i in range(4) if vs[i] > 0]
    vneg = [i for i in range(4) if vs[i] < 0]
    apos = [i for i in range(4) if as_[i] > 0]
    # 독립 경로: |v| 의 수치 도함수 부호
    vf = _lam(v, t)
    for i, s in enumerate(samples):
        hh = 1e-6
        d = (abs(vf(float(s) + hh)) - abs(vf(float(s) - hh))) / (2 * hh)
        if (d > 0) != (i in speed):
            raise ValueError("independent_check_failed")
    ds = [("Finds where the particle moves in the positive direction ($v>0$), which is not the same as the speed increasing.", _union(vpos, bps)),
          ("Uses only the sign of the acceleration: $a>0$ for $t>%s$, but the speed increases only when $v$ and $a$ have the same sign." % tx(m), _union(apos, bps)),
          ("Finds where $v$ and $a$ have opposite signs, which is where the speed is decreasing.", _union(slow, bps)),
          ("Finds where the particle moves in the negative direction ($v<0$).", _union(vneg, bps))]
    pool = textopts([(tx_, w) for w, tx_ in [(d[0], d[1]) for d in ds]])
    pool = textopts([(tt, w) for w, tt in ds if tt != _union(speed, bps)])
    stem = "A particle moves along the $x$-axis so that its position at time $t\\ge 0$ is $x(t)=%s$. For which values of $t>0$ is the speed of the particle increasing?" % tx(pos)
    key = Opt(_union(speed, bps), True, "$v(t)=%s$ and $a(t)=%s$; the speed increases when $v$ and $a$ have the same sign: $v$ changes sign at $t=%s$ and $t=%s$, $a$ changes sign at $t=%s$." % (tx(sp.factor(v)), tx(a), tx(r1), tx(r2), tx(m)), None)
    return _P("c_speeding_up_intervals", "4.2", "2.D", stem, key, pool, rng,
              ("Find the time intervals on which the speed of a particle with a polynomial position function is increasing",
               ["Compute $v(t)$ and $a(t)$ and find where each is zero", "Build a sign chart for $v$ and $a$ on $t>0$", "Speed increases exactly where $v$ and $a$ have the same sign"],
               [("speed increases when $v$ and $a$ have the same sign", "sign chart of $v$ and $a$")],
               [("velocity_positive_only", "uses v > 0"), ("acceleration_positive_only", "uses a > 0"), ("slowing_down_intervals", "uses opposite signs"), ("velocity_negative_only", "uses v < 0")],
               "numerical derivative of $|v(t)|$ at one sample point inside each interval (independent of the sign chart)"),
              95, [f"x={pos}"])


# 4.1 변화율의 의미 해석(단위와 부호)
_CTX = [("fuel in a tank", "F", "gallons", "hours", "hour"), ("water in a swimming pool", "W", "gallons", "minutes", "minute"), ("a chemical dissolved in a tank", "C", "grams", "minutes", "minute")]


def c_roc_meaning_polynomial(rng):
    for _ in forever():
        thing, nm, unit, tu, tus = rng.choice(_CTX)
        A0 = rng.choice([100, 120, 150])
        b = rng.choice([12, 16, 20, 24])
        c = rng.choice([1, 2, 3])
        t0 = rng.choice([2, 3, 4, 5])
        Q = lambda s: A0 + b * s - c * s * s
        r0 = b - 2 * c * t0
        avg = sp.Rational(Q(t0) - Q(0), t0)
        step = Q(t0 + 1) - Q(t0)
        if r0 == 0 or abs(r0) < 2 or abs(avg) == abs(r0) or step == r0 or Q(t0) == abs(r0):
            continue
        break
    _chk(_cd(lambda s: Q(s), float(t0), 1e-4), r0, 1e-6)
    dirw = lambda z: "increasing" if z > 0 else "decreasing"
    dirp = lambda z: "increased" if z > 0 else "decreased"
    key_t = "At time $t=%d$ %s, the amount of %s is %s at a rate of $%d$ %s per %s." % (t0, tu, thing, dirw(r0), abs(r0), unit, tus)
    ds = [("At time $t=%d$ %s, there are $%d$ %s of %s." % (t0, tu, Q(t0), unit, thing), "Reads $%s'(%d)$ as the amount $%s(%d)=%d$ itself, not as a rate." % (nm, t0, nm, t0, Q(t0))),
          ("During the first $%d$ %s, the amount of %s %s by an average of $%s$ %s per %s." % (t0, tu, thing, dirp(avg), tx(abs(avg)), unit, tus), "Gives the average rate over $[0,%d]$, which is $\\frac{%s(%d)-%s(0)}{%d}=%s$, not the instantaneous rate." % (t0, nm, t0, nm, t0, tx(avg))),
          ("At time $t=%d$ %s, the amount of %s is %s at a rate of $%d$ %s per %s." % (t0, tu, thing, dirw(-r0), abs(r0), unit, tus), "Reads the sign of $%s'(%d)=%d$ backwards." % (nm, t0, r0)),
          ("Between $t=%d$ and $t=%d$ %s, the amount of %s %s by exactly $%d$ %s." % (t0, t0 + 1, tu, thing, dirp(r0), abs(r0), unit), "Treats the rate $%s'(%d)=%d$ as the exact change over the next %s, but $%s(%d)-%s(%d)=%d$." % (nm, t0, r0, tus, nm, t0 + 1, nm, t0, step))]
    pool = textopts(ds)
    stem = "The amount of %s is modeled by $%s(t)=%d+%dt-%st^{2}$, where $%s(t)$ is measured in %s and $t$ is measured in %s, for $0\\le t\\le 6$. Which of the following is the best interpretation of $%s'(%d)$?" % (thing, nm, A0, b, "" if c == 1 else str(c), nm, unit, tu, nm, t0)
    key = Opt(key_t, True, "$%s'(t)=%d-%dt$, so $%s'(%d)=%d$: the derivative gives the instantaneous rate of change, in %s per %s, and its sign shows the amount is %s." % (nm, b, 2 * c, nm, t0, r0, unit, tus, dirw(r0)), None)
    return _P("c_roc_meaning_polynomial", "4.1", "3.F", stem, key, pool, rng,
              ("Interpret the value of a derivative in context with correct units and sign for a quadratic model",
               ["Compute $Q'(t_0)$ from the model", "Recognize $Q'(t_0)$ as an instantaneous rate with units of the quantity per unit of time", "Use the sign to decide whether the amount is increasing or decreasing"],
               [("the derivative is the instantaneous rate of change with units quantity per time", "the sign of the derivative gives the direction")],
               [("derivative_read_as_value", "reads Q' as Q"), ("average_rate", "average rate"), ("sign_misread", "reverses the direction"), ("exact_change_next_hour", "treats rate as exact change over an interval")],
               "central difference (step 1e-4) of the quadratic model at $t_0$ (independent of the power rule)"),
              90, [f"t0={t0}", f"b={b}", f"c={c}"])


# 4.5 관련 변화율: 가로등과 그림자
def c_related_rates_shadow(rng):
    for _ in forever():
        Lh = rng.choice([12, 15, 18, 20, 24])
        hp = rng.choice([5, 6])
        v = rng.choice([3, 4, 5, 6, 7])
        Lh_, hp_, v_ = sp.Integer(Lh), sp.Integer(hp), sp.Integer(v)
        key_v = hp_ * v_ / (Lh_ - hp_)
        cands = [Lh_ * v_ / (Lh_ - hp_), hp_ * v_ / Lh_, v_, (Lh_ - hp_) * v_ / hp_]
        if len({key_v, *cands}) == 5:
            break
    # 독립 경로: 가로등 꼭대기와 사람 머리를 잇는 직선이 땅과 만나는 점으로 그림자 끝을 구하고 시간에 대해 수치 미분
    def shadow(tt, xs=20.0):
        xp = xs + v * tt
        tip = Lh * xp / (Lh - hp)  # 직선 (0,L)-(xp,h) 가 y=0 과 만나는 x
        return tip - xp
    _chk(_cd(shadow, 0.0, 1e-4), float(key_v), 1e-6)
    ds = [("Finds the rate at which the tip of the shadow moves, $\\frac{%d\\cdot %d}{%d-%d}$, instead of the rate at which its length grows." % (Lh, v, Lh, hp), cands[0]),
          ("Uses the similar triangles $\\frac{s}{%d}=\\frac{x}{%d}$ (lamp height $%d$ in the wrong place), giving $\\frac{%d\\cdot %d}{%d}$." % (hp, Lh, Lh, hp, v, Lh), cands[1]),
          ("Assumes the shadow grows at the walking speed of $%d$ feet per second." % v, cands[2]),
          ("Inverts the ratio of the heights: $\\frac{(%d-%d)\\cdot %d}{%d}$." % (Lh, hp, v, hp), cands[3])]
    pool = opts(ds, key_v, fmt)
    stem = "A street lamp is $%d$ feet tall. A person who is $%d$ feet tall walks directly away from the base of the lamp at a constant speed of $%d$ feet per second. At what rate, in feet per second, is the length of the shadow of the person increasing?" % (Lh, hp, v)
    key = Opt(fmt(key_v), True, "With $x$ the distance from the lamp and $s$ the shadow length, similar triangles give $\\frac{x+s}{%d}=\\frac{s}{%d}$, so $s=\\frac{%dx}{%d}$ and $\\frac{ds}{dt}=\\frac{%d}{%d}\\cdot %d=%s$." % (Lh, hp, hp, Lh - hp, hp, Lh - hp, v, tx(key_v)), key_v)
    return _P("c_related_rates_shadow", "4.5", "1.E", stem, key, pool, rng,
              ("Solve a related rates problem for the length of a shadow using similar triangles",
               ["Draw the lamp, the person and the shadow and set up similar triangles", "Solve for the shadow length in terms of the distance walked", "Differentiate with respect to time and substitute the walking speed"],
               [("the two triangles are similar", "the lamp and the person are both vertical")],
               [("tip_of_shadow", "gives the speed of the tip"), ("wrong_triangle_ratio", "wrong similar triangles"), ("walking_speed", "assumes the walking speed"), ("inverted_heights", "inverts the ratio")],
               "coordinate geometry: the line through the lamp top and the person's head meets the ground at the shadow tip; numerical time derivative (independent of the similar-triangle algebra)"),
              100, [f"L={Lh}", f"h={hp}", f"v={v}"])


# 4.5 관련 변화율: 벽에 기대 미끄러지는 사다리
_LADDER = [(5, 12, 13), (8, 15, 17), (6, 8, 10), (9, 12, 15), (12, 16, 20), (7, 24, 25), (15, 20, 25)]


def c_related_rates_ladder(rng):
    x0, y0, Ln = rng.choice(_LADDER)
    v = rng.choice([2, 3, 4])
    X0, Y0, LL, V = sp.Integer(x0), sp.Integer(y0), sp.Integer(Ln), sp.Integer(v)
    key_v = -X0 * V / Y0
    # 독립 경로: y(t) = sqrt(L^2 - (x0 + v t)^2) 의 수치 미분
    yfun = lambda tt: math.sqrt(Ln ** 2 - (x0 + v * tt) ** 2)
    _chk(_cd(yfun, 0.0, 1e-6), float(key_v), 1e-5)
    ds = [("Gives the speed instead of the rate of change: the top moves down, so the rate is negative.", X0 * V / Y0),
          ("Inverts the ratio: $-\\frac{y}{x}\\cdot\\frac{dx}{dt}$.", -Y0 * V / X0),
          ("Uses the ladder length $%d$ in place of $x$: $-\\frac{%d\\cdot %d}{%d}$." % (Ln, Ln, v, y0), -LL * V / Y0),
          ("Assumes the top slides down at the same rate as the bottom slides out.", -V)]
    pool = opts(ds, key_v, fmt)
    stem = "A $%d$-foot ladder leans against a vertical wall. The bottom of the ladder slides away from the wall at a constant rate of $%d$ feet per second. At the instant when the bottom of the ladder is $%d$ feet from the wall, what is the rate of change, in feet per second, of the height of the top of the ladder?" % (Ln, v, x0)
    key = Opt(fmt(key_v), True, "With $x^{2}+y^{2}=%d$, $2x\\frac{dx}{dt}+2y\\frac{dy}{dt}=0$; at $x=%d$ we have $y=%d$, so $\\frac{dy}{dt}=-\\frac{%d}{%d}\\cdot %d=%s$." % (Ln * Ln, x0, y0, x0, y0, v, tx(key_v)), key_v)
    return _P("c_related_rates_ladder", "4.5", "1.E", stem, key, pool, rng,
              ("Solve a related rates problem for a ladder sliding down a wall using the Pythagorean theorem",
               ["Relate the horizontal and vertical distances with $x^{2}+y^{2}=L^{2}$", "Differentiate with respect to time", "Find $y$ at the given instant and solve for $dy/dt$"],
               [("the ladder length is constant", "$x^{2}+y^{2}$ is constant in time")],
               [("sign_ignored", "reports the positive speed"), ("inverted_ratio", "inverts x and y"), ("ladder_length_used", "uses the ladder length"), ("equal_rates", "assumes equal rates")],
               "numerical derivative of $y(t)=\\sqrt{L^{2}-(x_0+vt)^{2}}$ (independent of implicit differentiation)"),
              95, [f"x0={x0}", f"y0={y0}", f"v={v}"])


# 4.6 접선이 x 축과 만나는 점
_TANX = [(x ** 3 - 4, "x^{3}-4", 2), (x ** 3 + 1, "x^{3}+1", 1), (x ** 2 - 6, "x^{2}-6", 3), (sp.sqrt(x), "\\sqrt{x}", 4), (sp.sqrt(x) - 1, "\\sqrt{x}-1", 9), (sp.log(x), "\\ln x", sp.exp(2)), (x ** 2 + x - 1, "x^{2}+x-1", 2)]


def c_tangent_x_intercept(rng):
    f, ftex, a = rng.choice(_TANX)
    a = sp.sympify(a)
    fa = sp.simplify(f.subs(x, a))
    fpa = sp.simplify(sp.diff(f, x).subs(x, a))
    key_v = sp.simplify(a - fa / fpa)
    # 독립 경로: 중심차분 접선의 영점
    ff = _lam(f)
    af = float(a)
    sl = _cd(ff, af, 1e-6)
    _chk(af - ff(af) / sl, float(key_v), 1e-5)
    ds = [("Adds instead of subtracts: $a+\\frac{f(a)}{f'(a)}$.", sp.simplify(a + fa / fpa)),
          ("Inverts the quotient: $a-\\frac{f'(a)}{f(a)}$.", sp.simplify(a - fpa / fa)),
          ("Forgets to subtract from $a$ and reports $\\frac{f(a)}{f'(a)}$.", sp.simplify(fa / fpa)),
          ("Finds the $y$-intercept of the tangent line, $f(a)-af'(a)$, instead of the $x$-intercept.", sp.simplify(fa - a * fpa)),
          ("Reports $-\\frac{f(a)}{f'(a)}$, the horizontal distance to the intercept, without adding $a$.", sp.simplify(-fa / fpa))]
    pool = opts(ds, key_v, fmt)
    stem = "Let $f(x)=%s$. The line tangent to the graph of $f$ at $x=%s$ crosses the $x$-axis at what value of $x$?" % (ftex, tx(a))
    key = Opt(fmt(key_v), True, "The tangent line is $y-%s=%s(x-%s)$; setting $y=0$ gives $x=%s-\\frac{%s}{%s}=%s$." % (tx(fa), tx(fpa), tx(a), tx(a), tx(fa), tx(fpa), tx(key_v)), key_v)
    return _P("c_tangent_x_intercept", "4.6", "1.D", stem, key, pool, rng,
              ("Find where the tangent line to a curve crosses the x-axis",
               ["Compute $f(a)$ and $f'(a)$", "Write the tangent line $y-f(a)=f'(a)(x-a)$", "Set $y=0$ and solve for $x$"],
               [("the tangent line is the linearization at $a$", "its slope is $f'(a)\\ne 0$")],
               [("added_instead_of_subtracted", "adds the quotient"), ("inverted_quotient", "inverts the quotient"), ("forgot_to_subtract_from_a", "forgets to subtract the quotient from a"), ("y_intercept", "finds the y-intercept")],
               "central difference slope and the zero of the resulting line (independent of the symbolic derivative)"),
              90, [f"f={f}", f"a={a}"])


# 4.7 로피탈을 두 번 써야 하는 0/0 꼴
def c_lhopital_twice_zero(rng):
    p = rng.choice([2, 3, 4, 5])
    if rng.random() < 0.5:
        num, ntex = sp.exp(p * x) - 1 - p * x, "e^{%dx}-1-%dx" % (p, p)
        step1, step2 = "$\\frac{%de^{%dx}-%d}{2x}$" % (p, p, p), "$\\frac{%d^{2}e^{%dx}}{2}$" % (p, p)
        dwhy = "Omits one factor of $%d$ when differentiating $%de^{%dx}$ the second time, getting $\\frac{%de^{%dx}}{2}$." % (p, p, p, p, p)
    else:
        num, ntex = 1 - sp.cos(p * x), "1-\\cos(%dx)" % p
        step1, step2 = "$\\frac{%d\\sin(%dx)}{2x}$" % (p, p), "$\\frac{%d^{2}\\cos(%dx)}{2}$" % (p, p)
        dwhy = "Omits one factor of $%d$ when differentiating $%d\\sin(%dx)$ the second time, getting $\\frac{%d\\cos(%dx)}{2}$." % (p, p, p, p, p)
    key_v = sp.Rational(p * p, 2)
    nf = _lam(num)
    _chk(nf(1e-3) / 1e-6, float(key_v), 5e-3)
    ds = [(dwhy, sp.Rational(p, 2)),
          ("Treats the derivative of the denominator the second time as $1$ instead of $2$, which gives $%d^{2}$." % p, sp.Integer(p * p)),
          ("Substitutes $x=0$ into the numerator only, which is $0$, and concludes the limit is $0$.", sp.Integer(0)),
          ("Treats the factor $2$ in the denominator as a factor of the numerator, giving $2\\cdot %d^{2}$." % p, sp.Integer(2 * p * p))]
    pool = opts(ds, key_v, fmt)
    stem = "The limit $\\lim_{x\\to 0}\\frac{%s}{x^{2}}$ is to be evaluated. What is its value?" % ntex
    key = Opt(fmt(key_v), True, "The limit has the form $\\frac{0}{0}$. One application of L’Hospital’s Rule gives %s, still $\\frac{0}{0}$; a second application gives %s, so the limit is $%s$." % (step1, step2, tx(key_v)), key_v)
    return _P("c_lhopital_twice_zero", "4.7", "1.E", stem, key, pool, rng,
              ("Evaluate a limit of the form 0/0 that needs two applications of L’Hospital’s Rule",
               ["Check that the limit has the indeterminate form $0/0$", "Differentiate numerator and denominator and notice the form is still $0/0$", "Differentiate again and evaluate"],
               [("L’Hospital’s Rule applies to $0/0$ forms", "both the numerator and the denominator tend to $0$ after each step")],
               [("missing_chain_factor", "loses a factor p"), ("denominator_second_derivative", "treats (2x)' as 1"), ("numerator_only", "substitutes into the numerator only"), ("constant_moved", "moves the 2 to the numerator")],
               "direct evaluation of the quotient at $x=10^{-3}$ (independent of L’Hospital’s Rule)"),
              90, [f"p={p}", f"num={num}"])


# 4.7 로피탈 ∞/∞ 꼴(지수 항이 지배)
def c_lhopital_inf_inf(rng):
    for _ in forever():
        p, q = rng.choice([2, 3, 4, 5]), rng.choice([2, 3, 4, 5])
        if p != q:
            break
    key_v = sp.Rational(p, q)
    big = 40.0
    _chk((p * math.exp(big) + big ** 2) / (q * math.exp(big) + big), float(key_v), 1e-9)
    ds = [("Inverts the ratio of the coefficients of $e^{x}$ and gives $\\frac{%d}{%d}$." % (q, p), sp.Rational(q, p)),
          ("Ignores the coefficients and the lower terms, taking $\\frac{e^{x}}{e^{x}}=1$.", sp.Integer(1)),
          ("Compares $x^{2}$ with $x$ and concludes the numerator grows faster, so the limit is infinite.", sp.oo),
          ("Divides by $e^{x}$ but drops the coefficient $%d$ in the denominator, getting $%d$." % (q, p), sp.Integer(p))]
    pool = []
    seen = {fmt(key_v)}
    for w, v_ in ds:
        t_ = "$\\infty$" if v_ == sp.oo else fmt(v_)
        if t_ not in seen:
            seen.add(t_)
            pool.append(Opt(t_, False, w, None if v_ == sp.oo else v_))
    stem = "What is the value of $\\lim_{x\\to\\infty}\\frac{%de^{x}+x^{2}}{%de^{x}+x}$?" % (p, q)
    key = Opt(fmt(key_v), True, "The limit has the form $\\frac{\\infty}{\\infty}$. L’Hospital’s Rule gives $\\frac{%de^{x}+2x}{%de^{x}+1}$, still $\\frac{\\infty}{\\infty}$, and again $\\frac{%de^{x}+2}{%de^{x}}\\to\\frac{%d}{%d}$." % (p, q, p, q, p, q), key_v)
    return _P("c_lhopital_inf_inf", "4.7", "1.E", stem, key, pool, rng,
              ("Evaluate a limit at infinity of an infinity over infinity form with exponential and polynomial terms",
               ["Recognize the form $\\infty/\\infty$", "Apply L’Hospital’s Rule repeatedly until the exponential terms are all that is left", "Compare the coefficients of $e^{x}$"],
               [("the exponential terms dominate the polynomial terms", "L’Hospital’s Rule applies to $\\infty/\\infty$")],
               [("inverted_coefficients", "inverts the ratio"), ("coefficients_ignored", "ignores the coefficients and gets 1"), ("polynomial_part_dominates", "claims infinity"), ("dropped_denominator_coefficient", "drops the denominator coefficient q")],
               "direct evaluation of the quotient at $x=40$ (independent of L’Hospital’s Rule)"),
              95, [f"p={p}", f"q={q}"])


# ============================================================ 단원 5
# 5.1 평균값 정리: 반드시 참인 진술
def c_mvt_must_be_true(rng):
    for _ in forever():
        a = rng.choice([0, 1, 2])
        b = a + rng.choice([2, 3, 4])
        A, B = rng.randint(-3, 6), rng.randint(-3, 14)
        s = sp.Rational(B - A, b - a)
        if A == B or s == 0 or min(A, B) <= s <= max(A, B) or abs(s) == 1:
            continue
        break
    # 독립 경로: 조건을 만족하는 구체 함수들에 대해 각 진술을 격자에서 검사
    sf = float(s)
    grid = [a + (b - a) * i / 4000 for i in range(4001)]
    lin = lambda u: A + (B - A) * (u - a) / (b - a)
    dlin = lambda u: sf
    bump = lambda u: lin(u) + 0.5 * (u - a) * (b - u)
    dbump = lambda u: sf + 0.5 * (a + b - 2 * u)
    def holds_c(fn_d, target):
        vals = [fn_d(u) - target for u in grid]
        return any(vals[i] * vals[i + 1] <= 0 for i in range(len(vals) - 1))
    if not (holds_c(dlin, sf) and holds_c(dbump, sf)):
        raise ValueError("independent_check_failed")
    every_false = any(abs(dbump(u) - sf) > 1e-6 for u in grid)  # 오목한 예: 모든 점에서 같지는 않다
    val_false = not holds_c(lambda u: lin(u), sf)  # 직선 예: f(c)=s 인 c 가 없다
    zero_false = not holds_c(dlin, 0.0)
    neg_false = not holds_c(dlin, -sf)
    if not (every_false and val_false and zero_false and neg_false):
        raise ValueError("independent_check_failed")
    S = tx(s)
    ds = [("$f'(x)=%s$ for every $x$ in $(%d,%d)$" % (S, a, b), "The theorem gives at least one such point, not every point; for a function that is not linear, $f'$ varies."),
          ("there is a number $c$ in $[%d,%d]$ with $f(c)=%s$" % (a, b, S), "Confuses the average rate of change with a function value; $%s$ is not between $f(%d)=%d$ and $f(%d)=%d$, so nothing guarantees such a $c$." % (S, a, A, b, B)),
          ("there is a number $c$ in $(%d,%d)$ with $f'(c)=0$" % (a, b), "That conclusion would need $f(%d)=f(%d)$, but here $f(%d)=%d$ and $f(%d)=%d$." % (a, b, a, A, b, B)),
          ("there is a number $c$ in $(%d,%d)$ with $f'(c)=%s$" % (a, b, tx(-s)), "Subtracts in the wrong order: the average rate of change is $\\frac{f(%d)-f(%d)}{%d-%d}=%s$, not its opposite." % (b, a, b, a, S))]
    pool = textopts([("$" + t_.replace("$", "") + "$" if False else _wrap_stmt(t_), w) for t_, w in ds])
    stem = "The function $f$ is differentiable for all real numbers, with $f(%d)=%d$ and $f(%d)=%d$. Which of the following statements must be true?" % (a, A, b, B)
    key = Opt(_wrap_stmt("there is a number $c$ in $(%d,%d)$ with $f'(c)=%s$" % (a, b, S)), True, "$f$ is continuous on $[%d,%d]$ and differentiable on $(%d,%d)$, so by the Mean Value Theorem $f'(c)=\\frac{f(%d)-f(%d)}{%d-%d}=\\frac{%s}{%d}=%s$ for some $c$." % (a, b, a, b, b, a, b, a, ("%d-%d" % (B, A)) if A >= 0 else ("%d-(%d)" % (B, A)), b - a, S), None)
    return _P("c_mvt_must_be_true", "5.1", "3.D", stem, key, pool, rng,
              ("State the conclusion of the Mean Value Theorem for a differentiable function with two given values",
               ["Check that $f$ is differentiable, hence continuous, on the interval", "Compute the average rate of change from the endpoint values", "Choose the statement the theorem guarantees: some $c$ with $f'(c)$ equal to that rate"],
               [("the Mean Value Theorem needs continuity on $[a,b]$ and differentiability on $(a,b)$", "$f$ is differentiable for all real numbers")],
               [("every_point", "claims the derivative equals the average rate everywhere"), ("function_value_confusion", "equates f(c) with the average rate"), ("zero_derivative", "claims a zero derivative"), ("wrong_order_of_subtraction", "negative of the average rate")],
               "test the statements on a linear function and on a function with an added bump, on a 4000-point grid (independent of the theorem)"),
              85, [f"a={a}", f"b={b}", f"A={A}", f"B={B}"])


def _wrap_stmt(s):
    """진술 첫 글자를 대문자로 하고 마침표를 붙인다(수식은 이미 $...$ 안)."""
    return s[0].upper() + s[1:] + "."


# 5.1 평균값 정리의 가정 확인
def _mvt_catalog(c):
    cb = lambda u: math.copysign(abs(u) ** (1 / 3), u)
    return {
        "abs_in": dict(tex="|x-%d|" % c, a=c - 2, b=c + 3, ok=False, f=lambda u: abs(u - c), why="Is continuous on the interval but not differentiable at $x=%d$, where the graph has a corner." % c),
        "pole": dict(tex="\\frac{1}{x-%d}" % c, a=c - 1, b=c + 2, ok=False, f=lambda u: 1 / (u - c), why="Is not continuous on the interval: it is undefined at $x=%d$, where there is a vertical asymptote." % c),
        "cusp": dict(tex="(x-%d)^{2/3}" % c, a=c - 1, b=c + 2, ok=False, f=lambda u: abs(u - c) ** (2 / 3), why="Is continuous but not differentiable at $x=%d$, where the tangent line is vertical." % c),
        "tan": dict(tex="\\tan x", a=0, b=None, ok=False, f=math.tan, why="Is not continuous on $[0,\\pi]$: it has a vertical asymptote at $x=\\frac{\\pi}{2}$."),
        "sqrt_end": dict(tex="\\sqrt{x-%d}" % c, a=c, b=c + 4, ok=True, f=lambda u: math.sqrt(max(u - c, 0.0)), why=None),
        "cbrt_end": dict(tex="\\sqrt[3]{x-%d}" % c, a=c, b=c + 8, ok=True, f=lambda u: cb(u - c), why=None),
        "abs_end": dict(tex="|x-%d|" % c, a=c, b=c + 3, ok=True, f=lambda u: abs(u - c), why=None),
    }


def c_mvt_hypotheses(rng):
    c = rng.choice([1, 2, 3, 4])
    cat = _mvt_catalog(c)
    kk = rng.choice(["sqrt_end", "cbrt_end", "abs_end"])
    bad = [n for n in ["abs_in", "pole", "cusp", "tan"] if not (kk == "abs_end" and n == "abs_in")]
    rng.shuffle(bad)
    bad = bad[:3] if kk != "abs_end" else bad[:3]
    # 독립 경로: 수치 점검(연속성: 한쪽 극한, 미분가능성: 좌우 차분몫)
    def check(name):
        e = cat[name]
        fn = e["f"]
        b_ = e["b"] if e["b"] is not None else math.pi
        a_ = e["a"]
        try:
            inner_pts = [a_ + (b_ - a_) * i / 11 for i in range(1, 11)]
            cont = all(math.isfinite(fn(u)) for u in inner_pts)
            eps = 1e-9
            # 열린 구간 안의 의심 지점(c 또는 pi/2)에서의 거동
            sus = math.pi / 2 if name == "tan" else c
            inside = a_ < sus < b_
            if name in ("pole", "tan"):
                near = abs(fn(sus + eps)) > 1e6 and abs(fn(sus - eps)) > 1e6
                return not near
            if inside:
                dl = (fn(sus) - fn(sus - 1e-6)) / 1e-6
                dr = (fn(sus + 1e-6) - fn(sus)) / 1e-6
                smooth = abs(dl - dr) < 1e-3 and abs(dl) < 1e3
                return smooth and cont
            sm = all(abs((fn(u + 1e-7) - fn(u - 1e-7)) / 2e-7) < 1e3 for u in inner_pts)
            return sm and cont and abs(fn(a_ + 1e-12) - fn(a_)) < 1e-3
        except (ZeroDivisionError, ValueError):
            return False
    for n in [kk] + bad:
        if check(n) != cat[n]["ok"]:
            raise ValueError("independent_check_failed")
    def opt_text(n):
        e = cat[n]
        iv = "[0,\\pi]" if e["b"] is None else "[%d,%d]" % (e["a"], e["b"])
        return "$f(x)=%s$ on $%s$" % (e["tex"], iv)
    pool = textopts([(opt_text(n), cat[n]["why"] if cat[n]["b"] is not None or True else "") for n in bad])
    pool = [Opt(o.text, False, "The function " + o.why[0].lower() + o.why[1:] if False else o.why, None) for o in pool]
    stem = "For which of the following functions and intervals do the hypotheses of the Mean Value Theorem hold?"
    kwhy = {"sqrt_end": "$f$ is continuous on $[%d,%d]$ and differentiable on $(%d,%d)$; the vertical tangent at the endpoint $x=%d$ does not matter, because differentiability is required only on the open interval." % (c, c + 4, c, c + 4, c),
            "cbrt_end": "$f$ is continuous on $[%d,%d]$ and differentiable on $(%d,%d)$; the vertical tangent at the endpoint $x=%d$ does not matter, because differentiability is required only on the open interval." % (c, c + 8, c, c + 8, c),
            "abs_end": "On $[%d,%d]$ the function equals $x-%d$, which is continuous on the closed interval and differentiable on the open interval; the corner of the graph of $|x-%d|$ at $x=%d$ lies at an endpoint, so it does not matter." % (c, c + 3, c, c, c)}[kk]
    key = Opt(opt_text(kk), True, kwhy, None)
    return _P("c_mvt_hypotheses", "5.1", "3.C", stem, key, pool, rng,
              ("Decide for which listed function and interval both hypotheses of the Mean Value Theorem hold",
               ["Check continuity on the closed interval for each choice", "Check differentiability on the open interval only", "Reject choices with an asymptote, a corner or a vertical tangent in the open interval"],
               [("the Mean Value Theorem needs continuity on $[a,b]$ and differentiability on $(a,b)$", "the bad point lies at an endpoint for the correct choice")],
               [("corner_inside", "corner inside the interval"), ("asymptote_inside", "vertical asymptote inside"), ("vertical_tangent_inside", "vertical tangent inside"), ("tangent_asymptote", "tan x has an asymptote")],
               "numerical difference quotients and blow-up tests at the suspicious point of each choice (independent of the catalog flags)"),
              85, [f"key={kk}", f"bad={bad}", f"c={c}"])


# 5.3 유리함수가 감소하는 구간(정의역 제외점 포함)
def c_decreasing_rational(rng):
    if rng.random() < 0.5:
        c = rng.choice([1, 2, 3])
        f = x ** 2 / (x - c)
        ftex = "\\dfrac{x^{2}}{x-%d}" % c
        bps = [None, sp.Integer(0), sp.Integer(c), sp.Integer(2 * c), None]
        pole = 2
    else:
        m = rng.choice([2, 3, 4])
        f = (x ** 2 + m * m) / x
        ftex = "\\dfrac{x^{2}+%d}{x}" % (m * m)
        bps = [None, sp.Integer(-m), sp.Integer(0), sp.Integer(m), None]
        pole = 2
    fp = sp.diff(f, x)
    samples = [bps[1] - 1, (bps[1] + bps[2]) / 2, (bps[2] + bps[3]) / 2, bps[3] + 1]
    sg = [sp.sign(fp.subs(x, s)) for s in samples]
    if sg != [1, -1, -1, 1]:
        raise ValueError("independent_check_failed")
    # 독립 경로: 수치 도함수의 부호
    ff = _lam(f)
    for i, s in enumerate(samples):
        d = _cd(ff, float(s), 1e-6)
        if (d < 0) != (sg[i] < 0):
            raise ValueError("independent_check_failed")
    b0, bp_, b2 = bps[1], bps[2], bps[3]
    seg = lambda i: bps[i:i + 2]
    key_t = "$%s$ and $%s$" % (_ivl(b0, bp_), _ivl(bp_, b2))
    ds = [("Writes one interval across $x=%s$, where $f$ is not defined, so $f$ cannot be decreasing on all of it." % tx(bp_), "$%s$" % _ivl(b0, b2)),
          ("Gives the intervals where $f'(x)>0$, which is where $f$ is increasing.", "$%s$ and $%s$" % (_ivl(None, b0), _ivl(b2, None))),
          ("Thinks $f'$ changes sign at $x=%s$ (the factor $(x-%s)^{2}$ keeps its sign), so only the left piece is decreasing." % (tx(bp_), tx(bp_)) if False else "Thinks $f'$ changes sign at the vertical asymptote $x=%s$ and keeps only the part to its left." % tx(bp_), "$%s$" % _ivl(b0, bp_)),
          ("Thinks $f'$ changes sign at the vertical asymptote $x=%s$ and keeps only the part to its right." % tx(bp_), "$%s$" % _ivl(bp_, b2))]
    pool = textopts([(tt, w) for w, tt in ds])
    stem = "Let $f(x)=%s$ for $x\\ne %s$. Which of the following describes all intervals on which $f$ is decreasing?" % (ftex, tx(bp_))
    key = Opt(key_t, True, "$f'(x)=%s$ has sign changes only at $x=%s$ and $x=%s$; $f'<0$ on both $%s$ and $%s$, and $f$ is not defined at $x=%s$, so $f$ is decreasing on each of these two intervals separately." % (tx(sp.factor(sp.simplify(fp))), tx(b0), tx(b2), _ivl(b0, bp_), _ivl(bp_, b2), tx(bp_)), None)
    return _P("c_decreasing_rational", "5.3", "1.E", stem, key, pool, rng,
              ("Find the intervals where a rational function is decreasing, keeping track of the point excluded from its domain",
               ["Differentiate with the quotient rule and factor $f'$", "Mark the zeros of $f'$ and the excluded $x$-value on a sign chart", "Report the decreasing intervals separately because $f$ is not defined at the excluded value"],
               [("$f$ is decreasing where $f'<0$ on an interval inside the domain", "the excluded value splits the decreasing set")],
               [("one_interval_across_asymptote", "merges across the excluded point"), ("increasing_set", "gives the increasing intervals"), ("left_piece_only", "keeps only the left piece"), ("right_piece_only", "keeps only the right piece")],
               "sign of a central-difference derivative at a point in each of the four intervals (independent of the factored derivative)"),
              95, [f"f={f}"])


# 5.2 임계점(도함수가 정의되지 않는 점 포함)
def c_critical_points_cusp(rng):
    k = rng.choice([1, 2, 3])
    f = x ** sp.Rational(2, 3) * (x - 5 * k)
    crit = [0, 2 * k]
    # 독립 경로: 수치 도함수의 영점 + 0 근처의 급격한 기울기
    ff = lambda u: abs(u) ** (2 / 3) * (u - 5 * k)
    root = _O.brentq(lambda u: _cd(ff, u, 1e-6), 0.5 * k, 3 * k)
    big = abs(_cd(ff, 1e-9, 1e-10))
    if abs(root - 2 * k) > 1e-4 or big < 100:
        raise ValueError("independent_check_failed")
    T = lambda L_: " and ".join("$x=%d$" % z for z in L_)
    ds = [(T([2 * k]), "Solves $f'(x)=0$ but forgets that $f'$ is undefined at $x=0$, where $f$ is defined, so $x=0$ is also a critical point."),
          (T([0, 5 * k]), "Lists $x=0$ and the zero $x=%d$ of $f$ itself, instead of solving $f'(x)=0$." % (5 * k)),
          (T([0, 2 * k, 5 * k]), "Adds the zero $x=%d$ of $f$ to the true critical points; $f'(%d)\\ne 0$." % (5 * k, 5 * k)),
          (T([0]), "Finds only where $f'$ is undefined and does not solve $f'(x)=0$, which gives $x=%d$." % (2 * k))]
    pool = textopts(ds)
    stem = "Let $f(x)=x^{2/3}(x-%d)$. Which of the following lists all critical points of $f$?" % (5 * k)
    key = Opt(T(crit), True, "$f'(x)=\\frac{2}{3}x^{-1/3}(x-%d)+x^{2/3}=\\frac{5x-%d}{3x^{1/3}}$; $f'(x)=0$ at $x=%d$, and $f'$ is undefined at $x=0$, which is in the domain of $f$." % (5 * k, 10 * k, 2 * k), None)
    return _P("c_critical_points_cusp", "5.2", "1.D", stem, key, pool, rng,
              ("Find all critical points of a function with a vertical tangent, including the point where the derivative is undefined",
               ["Differentiate with the product rule and write $f'$ as one fraction", "Find where $f'=0$ and where $f'$ is undefined but $f$ is defined", "List both kinds of critical point"],
               [("a critical point is a point of the domain where $f'$ is zero or undefined", "$f(0)=0$ is defined")],
               [("misses_undefined_point", "forgets x=0"), ("zeros_of_f", "uses zeros of f"), ("adds_zero_of_f", "adds a zero of f"), ("undefined_point_only", "forgets f'=0")],
               "root of the numerical derivative on a bracket and the size of the slope near $x=0$ (independent of the symbolic derivative)"),
              90, [f"k={k}"])


# 5.7 이계도함수 판정법과 그 한계
def c_second_deriv_test_quartic(rng):
    p = rng.choice([1, 2, 3])
    f = x ** 4 - 4 * p * x ** 3
    fp, fpp = sp.diff(f, x), sp.diff(f, x, 2)
    if not (fpp.subs(x, 0) == 0 and fpp.subs(x, 3 * p) > 0 and sp.factor(fp) == 4 * x ** 2 * (x - 3 * p)):
        raise ValueError("independent_check_failed")
    # 독립 경로: 수치로 f 의 값 비교(0 과 3p 주변)
    ff = _lam(f)
    e = 1e-3
    mn3 = ff(3 * p - e) > ff(3 * p) < ff(3 * p + e)
    ext0 = (ff(-e) > ff(0) < ff(e)) or (ff(-e) < ff(0) > ff(e))
    if not (mn3 and not ext0):
        raise ValueError("independent_check_failed")
    N = "$x=0$"
    M = "$x=%d$" % (3 * p)
    names = {"min": "a relative minimum", "max": "a relative maximum", "none": "no relative extremum"}
    def stmt(s0, s3):
        return "$f$ has %s at %s and %s at %s." % (names[s0], "$x=0$", names[s3], M)
    key_t = stmt("none", "min")
    key_t = "$f$ has no relative extremum at $x=0$ and a relative minimum at $x=%d$." % (3 * p)
    cand = [("Concludes from $f''(0)=0$ that $x=0$ is a relative minimum as well; the Second Derivative Test gives no information there, and $f'$ does not change sign at $0$.", "$f$ has a relative minimum at $x=0$ and a relative minimum at $x=%d$." % (3 * p)),
            ("Calls $x=0$ a relative maximum because $f''<0$ on $(0,%d)$, but $f'(x)<0$ on both sides of $0$, so there is no extremum there." % (2 * p), "$f$ has a relative maximum at $x=0$ and a relative minimum at $x=%d$." % (3 * p)),
            ("Reads $f''(%d)=%d>0$ as concave down, so it calls $x=%d$ a maximum, but concave up at a critical point means a relative minimum." % (3 * p, fpp.subs(x, 3 * p), 3 * p), "$f$ has no relative extremum at $x=0$ and a relative maximum at $x=%d$." % (3 * p)),
            ("Reads $f''(0)=0$ as positive (a minimum) and $f''(%d)=%d>0$ as concave down (a maximum), reversing the conclusion at $x=%d$." % (3 * p, fpp.subs(x, 3 * p), 3 * p), "$f$ has a relative minimum at $x=0$ and a relative maximum at $x=%d$." % (3 * p))]
    pool = textopts([(t_, w) for w, t_ in cand])
    stem = "Let $f(x)=x^{4}-%dx^{3}$. Which of the following statements is true?" % (4 * p)
    key = Opt(key_t, True, "$f'(x)=4x^{2}(x-%d)$ and $f''(x)=12x(x-%d)$. At $x=%d$, $f''>0$ so $f$ has a relative minimum. At $x=0$, $f''(0)=0$ so the test fails, and $f'<0$ on both sides, so there is no extremum." % (3 * p, 2 * p, 3 * p), None)
    return _P("c_second_deriv_test_quartic", "5.7", "3.D", stem, key, pool, rng,
              ("Classify the critical points of a quartic using the Second Derivative Test and recognize where it fails",
               ["Find the critical points from $f'(x)=4x^{2}(x-3p)$", "Evaluate $f''$ at each critical point; $f''(0)=0$ is inconclusive", "Use the sign of $f'$ around $x=0$ to see that there is no extremum"],
               [("the Second Derivative Test is inconclusive when $f''(c)=0$", "$f''(0)=0$")],
               [("minimum_at_zero", "calls x=0 a minimum"), ("maximum_at_zero", "calls x=0 a maximum"), ("maximum_at_3p", "calls 3p a maximum"), ("both_reversed", "reverses both")],
               "numerical comparison of $f$ near $x=0$ and $x=3p$ (independent of the derivative tests)"),
              100, [f"p={p}"])


# 5.6 x^n ln x 의 오목성
def c_concave_xnlnx(rng):
    n = rng.choice([2, 3, 4])
    f = x ** n * sp.log(x)
    fpp = sp.diff(f, x, 2)
    thr = sp.Rational(-(2 * n - 1), n * (n - 1))   # ln x > thr  <=>  f'' > 0
    inc_thr = sp.Rational(-1, n)
    E = lambda e_: sp.exp(e_)
    key_t = "$(%s,\\infty)$" % tx(E(thr))
    # 독립 경로: 이차 차분 부호가 바뀌는 x 를 수치로 찾기
    ff = _lam(f)
    g2 = lambda u: (ff(u + 1e-4) - 2 * ff(u) + ff(u - 1e-4)) / 1e-8
    r = _O.brentq(g2, 0.05, 2.0)
    _chk(r, float(E(thr)), 1e-3)
    ds = [("Uses $\\ln x>%s$ (a sign slip), so the boundary is $x=%s$." % (tx(-thr), tx(E(-thr))), "$(%s,\\infty)$" % tx(E(-thr))),
          ("Keeps only the term of $f''$ containing $\\ln x$ and drops the other terms, so $f''>0$ when $\\ln x>0$.", "$(1,\\infty)$"),
          ("Finds where $f'>0$, i.e. where $f$ is increasing, using $\\ln x>%s$." % tx(inc_thr), "$(%s,\\infty)$" % tx(E(inc_thr))),
          ("Gives the set where $f''<0$, where the graph is concave down.", "$(0,%s)$" % tx(E(thr)))]
    pool = textopts([(t_, w) for w, t_ in ds])
    stem = "Let $f(x)=x^{%d}\\ln x$ for $x>0$. On which interval is the graph of $f$ concave up?" % n
    key = Opt(key_t, True, "$f'(x)=%dx^{%d}\\ln x+x^{%d}$ and $f''(x)=%s\\left(%d\\ln x+%d\\right)$; $f''>0$ when $\\ln x>%s$, i.e. $x>%s$." % (n, n - 1, n - 1, "x" if n == 3 else "x^{%d}" % (n - 2), n * (n - 1), 2 * n - 1, tx(thr), tx(E(thr))) if n > 2 else "$f'(x)=2x\\ln x+x$ and $f''(x)=2\\ln x+3$; $f''>0$ when $\\ln x>%s$, i.e. $x>%s$." % (tx(thr), tx(E(thr))), None)
    return _P("c_concave_xnlnx", "5.6", "1.E", stem, key, pool, rng,
              ("Find the interval of upward concavity of a product of a power and a logarithm from its second derivative",
               ["Differentiate twice with the product rule", "Factor $f''$ and solve $f''>0$ using the logarithm", "State the interval of $x>0$"],
               [("the graph is concave up where $f''>0$", "domain $x>0$")],
               [("sign_slip", "uses the opposite sign in the logarithm inequality"), ("only_log_term", "drops terms of f''"), ("increasing_interval", "finds where f is increasing"), ("concave_down_interval", "gives the concave down interval")],
               "sign change of a second central difference found with brentq (independent of the symbolic second derivative)"),
              95, [f"n={n}"])


# 5.5 닫힌구간의 절대 최대·최소(삼차함수)
def c_abs_extremum_cubic(rng):
    for _ in forever():
        r1, r2 = rng.choice([(1, 3), (1, 5), (2, 4), (1, 2), (2, 3), (1, 4)])
        cc = 2 if (r1 + r2) % 2 else rng.choice([1, 2])
        f = sp.expand(cc * (x ** 3 - sp.Rational(3, 2) * (r1 + r2) * x ** 2 + 3 * r1 * r2 * x))
        lo = r1 - rng.choice([1, 2])
        hi = r2 + rng.choice([1, 2])
        fv = lambda z: f.subs(x, z)
        pts = {lo: fv(lo), r1: fv(r1), r2: fv(r2), hi: fv(hi)}
        kind = rng.choice(["maximum", "minimum"])
        best = max(pts.values()) if kind == "maximum" else min(pts.values())
        arg = [z for z, w in pts.items() if w == best]
        if len(arg) == 1 and arg[0] in (lo, hi):
            break
    other = min(pts.values()) if kind == "maximum" else max(pts.values())
    loc = pts[r1] if kind == "maximum" else pts[r2]
    other_end = pts[hi] if arg[0] == lo else pts[lo]
    # 독립 경로: 촘촘한 격자에서 수치 최댓값/최솟값
    ff = _lam(f)
    grid = [lo + (hi - lo) * i / 20000 for i in range(20001)]
    gv = [ff(u) for u in grid]
    _chk(max(gv) if kind == "maximum" else min(gv), float(best), 1e-6)
    ds = [("Gives the value of the relative %s at the critical point inside the interval and forgets to compare the endpoint values." % ("maximum" if kind == "maximum" else "minimum"), loc),
          ("Gives the absolute %s instead of the absolute %s." % ("minimum" if kind == "maximum" else "maximum", kind), other),
          ("Gives the $x$-value $%d$ where the absolute %s occurs instead of the value of $f$." % (arg[0], kind), sp.Integer(arg[0])),
          ("Gives the value of $f$ at the other endpoint $x=%d$." % (hi if arg[0] == lo else lo), other_end),
          ("Gives the value of the relative %s at $x=%d$ instead of comparing with the endpoints." % ("minimum" if kind == "maximum" else "maximum", r2 if kind == "maximum" else r1), pts[r2] if kind == "maximum" else pts[r1])]
    pool = opts(ds, best, fmt)
    stem = "Let $f(x)=%s$. What is the absolute %s value of $f$ on the closed interval $[%d,%d]$?" % (tx(f), kind, lo, hi)
    key = Opt(fmt(best), True, "$f'(x)=%s$ is zero at $x=%d$ and $x=%d$. Comparing $f(%d)=%s$, $f(%d)=%s$, $f(%d)=%s$, $f(%d)=%s$, the absolute %s is $%s$ at $x=%d$." % (tx(sp.factor(sp.diff(f, x))), r1, r2, lo, tx(pts[lo]), r1, tx(pts[r1]), r2, tx(pts[r2]), hi, tx(pts[hi]), kind, tx(best), arg[0]), best)
    return _P("c_abs_extremum_cubic", "5.5", "1.E", stem, key, pool, rng,
              ("Find the absolute extreme value of a cubic on a closed interval by comparing critical-point and endpoint values",
               ["Find the critical points inside the interval", "Evaluate $f$ at the critical points and both endpoints", "Choose the largest or smallest value as asked"],
               [("the extreme value theorem guarantees absolute extrema on a closed interval", "the candidates are critical points and endpoints")],
               [("local_value_only", "gives the interior relative extreme value"), ("opposite_extreme", "gives the other absolute extreme"), ("x_value_reported", "reports the x-value"), ("other_endpoint", "gives the other endpoint value")],
               "maximum or minimum of the lambdified function over a 20001-point grid (independent of the candidate test)"),
              95, [f"f={f}", f"lo={lo}", f"hi={hi}", f"kind={kind}"])


# 5.11 최적화: 부피가 정해진 윗면 없는 상자의 최소 겉넓이
def c_box_min_surface(rng):
    xb = rng.choice([2, 4, 6])
    V = sp.Rational(xb ** 3, 2)
    key_v = sp.Integer(3 * xb * xb)
    h = V / xb ** 2
    # 독립 경로: S(x)=x^2+4V/x 의 격자 최솟값
    Vf = float(V)
    Sg = min((u * u + 4 * Vf / u) for u in [0.05 + 30 * i / 60000 for i in range(60001)])
    _chk(Sg, float(key_v), 1e-6)
    ds = [("Gives the side length $x=%d$ of the base instead of the surface area." % xb, sp.Integer(xb)),
          ("Gives the height $h=\\frac{V}{x^{2}}=%s$ instead of the surface area." % tx(h), h),
          ("Counts only the four sides, $4xh=%d$, and leaves out the area of the base." % (4 * xb * h), 4 * xb * h),
          ("Adds a top, using $2x^{2}+4xh=%d$ for a closed box." % (2 * xb * xb + 4 * xb * h), 2 * xb * xb + 4 * xb * h)]
    pool = opts(ds, key_v, fmt)
    stem = "An open-top box has a square base and four vertical sides, and its volume is $%s$ cubic feet. What is the minimum possible surface area, in square feet, of the box (the base and the four sides)?" % tx(V)
    key = Opt(fmt(key_v), True, "With base side $x$ and $h=\\frac{%s}{x^{2}}$, $S(x)=x^{2}+\\frac{%s}{x}$ and $S'(x)=2x-\\frac{%s}{x^{2}}=0$ gives $x=%d$; then $S(%d)=%d+%d=%d$, which is the minimum because $S'$ changes from negative to positive." % (tx(V), tx(4 * V), tx(4 * V), xb, xb, xb * xb, 2 * xb * xb, 3 * xb * xb), key_v)
    return _P("c_box_min_surface", "5.11", "1.E", stem, key, pool, rng,
              ("Minimize the surface area of an open-top box with a square base and a fixed volume",
               ["Write the height in terms of the base side from the volume", "Write the surface area $S(x)=x^{2}+4V/x$ and set $S'(x)=0$", "Justify the minimum and evaluate $S$"],
               [("the critical point gives the minimum", "$S'$ changes from negative to positive at the critical point")],
               [("dimension_reported", "reports the base side"), ("height_reported", "reports the height"), ("sides_only", "omits the base"), ("closed_box", "adds a top")],
               "grid minimum of $S(x)=x^{2}+4V/x$ over a 60001-point grid (independent of the derivative)"),
              100, [f"x={xb}", f"V={V}"])


# 5.9 f' 의 식에서 한 점의 증가·오목 상태 읽기
def c_conditions_at_point(rng):
    for _ in forever():
        rts = sorted(rng.sample(range(-3, 6), 3))
        fp = sp.expand((x - rts[0]) * (x - rts[1]) * (x - rts[2]))
        a = rng.choice([z for z in range(-3, 6) if z not in rts])
        v1 = fp.subs(x, a)
        v2 = sp.diff(fp, x).subs(x, a)
        if v1 != 0 and v2 != 0:
            break
    ffp = _lam(fp)
    _chk((ffp(a + 1e-5) - ffp(a - 1e-5)) / 2e-5, float(v2), 1e-4)
    inc = v1 > 0
    up = v2 > 0
    T = lambda i_, u_: "At $x=%d$, the graph of $f$ is %s and %s." % (a, "increasing" if i_ else "decreasing", "concave up" if u_ else "concave down")
    key_t = T(inc, up)
    cand = [("Reads the sign of $f''(%d)=%d$ backwards: it is %s at $x=%d$ ($f'(%d)=%d$ is correct)." % (a, v2, "positive" if v2 > 0 else "negative", a, a, v1), T(inc, not up)),
            ("Reads the sign of $f'(%d)=%d$ backwards, although the concavity from $f''(%d)=%d$ is right." % (a, v1, a, v2), T(not inc, up)),
            ("Reverses both signs: $f'(%d)=%d$ and $f''(%d)=%d$ are each read the wrong way." % (a, v1, a, v2), T(not inc, not up))]
    pool = textopts([(t_, w) for w, t_ in [(c[0], c[1]) for c in cand]])
    stem = "The derivative of a twice-differentiable function $f$ is $f'(x)=%s$. Which of the following statements about the graph of $f$ at $x=%d$ is true?" % (tx(fp), a)
    key = Opt(key_t, True, "$f'(%d)=%d$ is %s, so $f$ is %s; $f''(x)=%s$ gives $f''(%d)=%d$, which is %s, so the graph is %s." % (a, v1, "positive" if inc else "negative", "increasing" if inc else "decreasing", tx(sp.diff(fp, x)), a, v2, "positive" if up else "negative", "concave up" if up else "concave down"), None)
    return _P("c_conditions_at_point", "5.9", "2.E", stem, key, pool, rng,
              ("Use the signs of the derivative and of the second derivative at a point to describe the graph of a function whose derivative is given by a formula",
               ["Evaluate $f'$ at the point to decide whether $f$ is increasing or decreasing", "Differentiate $f'$ to get $f''$ and evaluate at the point to decide the concavity", "Combine the two conclusions"],
               [("$f'>0$ means increasing and $f''>0$ means concave up", "$f'$ and $f''$ are both nonzero at the point")],
               [("concavity_reversed", "reverses the concavity"), ("direction_reversed", "reverses the direction"), ("both_reversed", "reverses both")],
               "central difference of $f'$ at the point to check the sign of $f''$ (independent of the symbolic derivative)"),
              85, [f"fp={fp}", f"a={a}"])


# 5.4 도함수가 삼각함수 식일 때 극댓값의 위치(1계 도함수 판정법)
def c_first_deriv_test_trig(rng):
    for _ in forever():
        use_sin = rng.random() < 0.5
        Bv = rng.choice([sp.Integer(1), sp.sqrt(3)])
        tr = sp.sin if use_sin else sp.cos
        fp = 2 * tr(x) - Bv
        th0 = sp.asin(Bv / 2) if use_sin else sp.acos(Bv / 2)
        z = sorted([th0, sp.pi - th0] if use_sin else [th0, 2 * sp.pi - th0])
        break
    ffp = _lam(fp)
    # 독립 경로: (0, 2π) 격자에서 f' 의 부호가 + → − 로 바뀌는 곳
    grid = [2 * math.pi * i / 40000 for i in range(1, 40000)]
    sgn = [ffp(u) for u in grid]
    idx = [i for i in range(len(sgn) - 1) if sgn[i] > 0 and sgn[i + 1] < 0]
    if len(idx) != 1:
        raise ValueError("independent_check_failed")
    key_v = sp.simplify(z[0] if (ffp(float(z[0]) - 1e-3) > 0) else z[1])
    _chk(grid[idx[0]], float(key_v), 1e-3)
    other = z[1] if key_v == sp.simplify(z[0]) else z[0]
    f2 = sp.diff(fp, x)
    infl = sp.pi / 2 if use_sin else sp.pi
    third = (sp.pi + th0) if use_sin else (sp.pi - th0)
    ds = [("Gives the other zero of $f'$, which is the relative minimum: $f'$ changes from negative to positive there.", other),
          ("Gives $x=%s$, where $f''(x)=0$ (an extreme value of $f'$), which is not where $f'$ changes sign." % tx(infl), infl),
          ("Takes the wrong angle for $%s x=%s$: uses $x=%s$, where %s." % ("\\sin" if use_sin else "\\cos", tx(Bv / 2), tx(third), "$\\sin x=%s$" % tx(-Bv / 2) if use_sin else "$\\cos x=%s$" % tx(-Bv / 2)), third)]
    pool = opts(ds, key_v, fmt)
    stem = "The derivative of a function $f$ is $f'(x)=%s$ for $0<x<2\\pi$. At what value of $x$ does $f$ have a relative maximum?" % tx(fp)
    key = Opt(fmt(key_v), True, "$f'(x)=0$ when $%s x=%s$, i.e. $x=%s$ and $x=%s$; $f'$ changes from positive to negative at $x=%s$, so $f$ has a relative maximum there." % ("\\sin" if use_sin else "\\cos", tx(Bv / 2), tx(z[0]), tx(z[1]), tx(key_v)), key_v)
    return _P("c_first_deriv_test_trig", "5.4", "3.D", stem, key, pool, rng,
              ("Use the First Derivative Test on a derivative given by a trigonometric expression to locate a relative maximum",
               ["Solve $f'(x)=0$ on $(0,2\\pi)$", "Check the sign of $f'$ on each side of each zero", "Choose the zero where $f'$ changes from positive to negative"],
               [("a relative maximum occurs where $f'$ changes from positive to negative", "sign chart of $f'$")],
               [("relative_minimum_chosen", "gives the relative minimum"), ("second_derivative_zero", "gives a zero of f''"), ("wrong_quadrant_angle", "uses a wrong angle")],
               "sign changes of $f'$ on a 40000-point grid of $(0,2\\pi)$ (independent of solving $f'=0$)"),
              90, [f"fp={fp}"])


STAGE_LISTS = {"supp_r3b2_ab": [
    "c_chain_exp_cos_point", "c_log_trig_deriv_expr", "c_implicit_tangent_line_eq", "c_implicit_cubic_horizontal_x", "c_inverse_deriv_formula", "c_arc_trig_deriv_value", "c_second_deriv_product_exp", "c_product_sqrt_chain_value",
    "c_speeding_up_intervals", "c_roc_meaning_polynomial", "c_related_rates_shadow", "c_related_rates_ladder", "c_tangent_x_intercept", "c_lhopital_twice_zero", "c_lhopital_inf_inf",
    "c_mvt_must_be_true", "c_mvt_hypotheses", "c_decreasing_rational", "c_critical_points_cusp", "c_second_deriv_test_quartic", "c_concave_xnlnx", "c_abs_extremum_cubic", "c_box_min_surface", "c_conditions_at_point", "c_first_deriv_test_trig"]}
