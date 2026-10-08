from common import *
from calc_ab_1 import pack_fixed
from scipy import integrate as _I
import numpy as np

# ---------------- Unit 6 ----------------
def riemann_table(rng):
    ts = [0, 2, 4, 6, 8]
    vals = [rnd(rng, 1, 12) for _ in ts]
    left = 2 * sum(vals[:-1]); right = 2 * sum(vals[1:]); trap = sum((vals[i] + vals[i + 1]) for i in range(4))
    if len({left, right, trap}) < 3: raise ValueError("degenerate")
    stem = "The table gives values of the rate $v(t)$ at selected times. Which is the left Riemann sum approximation of $\\int_0^8 v(t)\\,dt$ using the four subintervals determined by the table?"
    rows = [[str(a), str(b)] for a, b in zip(ts, vals)]
    key = Opt(fmt(left), True, "Left endpoints times subinterval width 2.", left)
    ds = [Opt(fmt(right), False, "Uses right endpoints.", right), Opt(fmt(trap), False, "Averages left and right (trapezoidal sum).", trap), Opt(fmt(sum(vals[:-1])), False, "Forgets to multiply by the width 2.", sum(vals[:-1])),
          Opt(fmt(2 * sum(vals)), False, "Includes all five values.", 2 * sum(vals))]
    return pack("riemann_table", "6.2", "2.B", "not_allowed", stem, key, ds, rng, stimulus=table_stimulus("Values of v(t)", "t", rows, "v(t)"), est=70, facts=[f"left={left}"])

def ftc_accum(rng):
    a = rng.choice([2, 3]); fvals = {a * a: rnd(rng, -6, 9), a: rnd(rng, -6, 9)}
    key_v = 2 * a * fvals[a * a]
    stem = f"The function $f$ is continuous, and $h(x)=\\displaystyle\\int_0^{{x^2}} f(t)\\,dt$. Values of $f$ are given in the table. What is $h'({a})$?"
    rows = [[str(k), str(v)] for k, v in sorted(fvals.items())]
    key = Opt(fmt(key_v), True, "Fundamental Theorem with the chain rule: f(x^2)*2x.", key_v)
    ds = [Opt(fmt(fvals[a * a]), False, "Forgets the chain-rule factor 2x.", fvals[a * a]), Opt(fmt(2 * a * fvals[a]), False, "Evaluates f at x instead of x squared.", 2 * a * fvals[a]),
          Opt(fmt(fvals[a]), False, "Uses f(x) with no chain rule.", fvals[a]), Opt(fmt(a * a * fvals[a * a]), False, "Multiplies by x squared instead of 2x.", a * a * fvals[a * a])]
    return pack("ftc_accum", "6.4", "1.D", "not_allowed", stem, key, ds, rng, stimulus=table_stimulus("Values of f", "t", rows, "f(t)"), est=75, facts=[f"h'={key_v}"])

def prop_integrals(rng):
    A, B, C = rnd(rng, 1, 9), rnd(rng, -8, 8), rnd(rng, -5, 7)
    key_v = A + B + 2 * C - 6
    stem = f"Suppose $\\int_0^2 f(x)\\,dx={A}$, $\\int_2^6 f(x)\\,dx={B}$ and $\\int_0^6 g(x)\\,dx={C}$. What is $\\int_0^6 \\left[f(x)+2g(x)-1\\right]dx$?"
    key = Opt(fmt(key_v), True, "Additivity over intervals, linearity, and the integral of the constant over [0, 6].", key_v)
    ds = [Opt(fmt(A + B + 2 * C), False, "Ignores the -1 term.", A + B + 2 * C), Opt(fmt(A + B + 2 * C + 6), False, "Adds instead of subtracts the constant integral.", A + B + 2 * C + 6),
          Opt(fmt(A + B + C - 6), False, "Drops the factor 2 on g.", A + B + C - 6), Opt(fmt(A + 2 * C - 6), False, "Uses only the first interval for f.", A + 2 * C - 6), Opt(fmt(A + B + 2 * C - 1), False, "Treats the constant as -1 instead of -6.", A + B + 2 * C - 1)]
    return pack("prop_integrals", "6.6", "1.E", "not_allowed", stem, key, ds, rng, est=75, facts=[f"value={key_v}"])

def ftc_eval_calc(rng):
    b = rng.choice([1.0, 1.5, 2.0])
    f = lambda v: math.exp(-v * v)
    val = _I.quad(f, 0, b)[0]
    assert abs(numeric_integral(f, 0, b) - val) < 1e-6
    stem = f"What is the value of $\\displaystyle\\int_0^{{{b}}} e^{{-x^2}}\\,dx$?"
    key = Opt("$%.3f$" % val, True, "Numerical integration with a graphing calculator.", val)
    alt = [(b * f(b), "Rectangle of width b and height f(b)."), (f(b), "Reports the integrand value at the upper limit."), ((1 - math.exp(-b * b)) / (2 * b), "Treats the integral as a substitution that is not valid here."), (1 - math.exp(-b), "Integrates e^(-x) instead of e^(-x^2).")]
    return pack("ftc_eval_calc", "6.7", "1.E", "required", stem, key, [Opt("$%.3f$" % v, False, w, v) for v, w in alt], rng, est=60, facts=[f"value={val}"])

def usub_integral(rng):
    k = rnd(rng, 2, 4); c = rnd(rng, 1, 3); n = rng.choice([2, 3]); a = 0; b = rng.choice([1, 2])
    expr = k * x * (x * x + c) ** n
    key_v = S(k) / 2 * ((b * b + c) ** (n + 1) - (a * a + c) ** (n + 1)) / (n + 1)
    assert sp.integrate(expr, (x, a, b)) == key_v
    stem = f"What is $\\displaystyle\\int_{{{a}}}^{{{b}}} {k}x\\,(x^2+{c})^{{{n}}}\\,dx$?"
    key = Opt(fmt(key_v), True, "u = x^2 + c with du = 2x dx, and the limits converted to u.", key_v)
    ds = [Opt(fmt(2 * key_v), False, "Forgets the factor 1/2 from du = 2x dx.", 2 * key_v), Opt(fmt(key_v * (n + 1)), False, "Forgets to divide by n+1.", key_v * (n + 1)),
          Opt(fmt(S(k) / 2 * (b ** (2 * n + 2) - a ** (2 * n + 2)) / (n + 1) * 1), False, "Uses the original limits of x as limits for u.", S(k) / 2 * (b ** (n + 1) - a ** (n + 1)) / (n + 1)),
          Opt(fmt(S(k) * ((b * b + c) ** n - (a * a + c) ** n)), False, "Differentiates the power instead of integrating.", S(k) * ((b * b + c) ** n - (a * a + c) ** n))]
    return pack("usub_integral", "6.9", "1.E", "not_allowed", stem, key, ds, rng, est=100, facts=[f"value={key_v}"])

# ---------------- Unit 7 ----------------
_DE = {"x-y": lambda a, b: a - b, "x+y": lambda a, b: a + b, "xy": lambda a, b: a * b, "y-x": lambda a, b: b - a, "x^2-y": lambda a, b: a * a - b, "y/2": lambda a, b: b / 2, "x/y": None}
def slope_field_match(rng):
    names = ["x-y", "x+y", "xy", "y-x", "x^2-y", "y/2"]
    pts = [(-1, 1), (1, 1), (1, -1), (2, 1), (0, 2), (-2, -1)]
    for _ in range(100):
        sel = rng.sample(names, 4); keyn = sel[0]
        sl = [float(_DE[keyn](a, b)) for a, b in pts]
        ok = all(any(abs(_DE[o](a, b) - s) > 1e-9 for (a, b), s in zip(pts, sl)) for o in sel[1:])
        if ok: break
    rows = [["(%d, %d)" % p, ("%g" % s)] for p, s in zip(pts, sl)]
    lab = lambda n: "$\\dfrac{dy}{dx}=%s$" % {"x-y": "x-y", "x+y": "x+y", "xy": "xy", "y-x": "y-x", "x^2-y": "x^2-y", "y/2": "\\frac{y}{2}"}[n]
    stem = "The table gives the slopes of a slope field at selected points $(x,y)$. Which differential equation could the slope field represent?"
    opts = [Opt(lab(n), n == keyn, "Slopes at all listed points match." if n == keyn else "Fails the slope at at least one listed point.", None) for n in sel]
    return pack_fixed("slope_field_match", "7.3", "2.C", "not_allowed", stem, opts, rng, stimulus=table_stimulus("Slopes of the field", "point (x, y)", rows, "slope"), est=90, facts=[f"key={keyn}"])

def separable_particular(rng):
    kk = rnd(rng, 1, 4); y0 = rnd(rng, 1, 4); a = rng.choice([1, 2])
    Y = sp.Function("y"); sol = sp.dsolve(sp.Eq(Y(x).diff(x), kk * x * Y(x)), Y(x), ics={Y(0): y0})
    val = sol.rhs.subs(x, a)
    assert sp.simplify(val - y0 * sp.exp(S(kk) * a * a / 2)) == 0
    stem = f"The function $y=f(x)$ satisfies $\\dfrac{{dy}}{{dx}}={kk}xy$ with $f(0)={y0}$. What is $f({a})$?"
    key = Opt(fmt(val), True, "Separates variables and uses the initial condition.", sp.N(val, 10))
    ds = [Opt(fmt(sp.exp(S(kk) * a * a / 2)), False, "Drops the initial condition constant.", sp.N(sp.exp(S(kk) * a * a / 2), 10)), Opt(fmt(y0 + S(kk) * a * a / 2), False, "Treats the solution as y0 plus the integral of kx.", y0 + S(kk) * a * a / 2),
          Opt(fmt(y0 * sp.exp(kk * a * a)), False, "Integrates kx as kx^2 instead of kx^2/2.", sp.N(y0 * sp.exp(kk * a * a), 10)), Opt(fmt(y0 * sp.exp(S(kk) * a / 2)), False, "Integrates x as x/2 (wrong power).", sp.N(y0 * sp.exp(S(kk) * a / 2), 10))]
    return pack("separable_particular", "7.7", "1.E", "not_allowed", stem, key, ds, rng, est=100, facts=[f"f(a)={val}"])

# ---------------- Unit 8 ----------------
def avg_value_calc(rng):
    a, b = rng.choice([(1, 4), (1, 5), (2, 6)]); f = lambda v: math.log(v) + 0.5 * v
    avg = _I.quad(f, a, b)[0] / (b - a)
    stem = f"What is the average value of $f(x)=\\ln x+0.5x$ on the interval $[{a},{b}]$?"
    key = Opt("$%.3f$" % avg, True, "(1/(b-a)) times the definite integral.", avg)
    alt = [(avg * (b - a), "Reports the integral without dividing by b-a."), ((f(a) + f(b)) / 2, "Averages the endpoint values."), (f((a + b) / 2), "Evaluates f at the midpoint."), (f(b) - f(a), "Reports the change in f.")]
    return pack("avg_value_calc", "8.1", "1.E", "required", stem, key, [Opt("$%.3f$" % v, False, w, v) for v, w in alt], rng, est=75, facts=[f"avg={avg}"])

def area_setup(rng):
    a = rng.choice([2, 3, 4, 5])
    f = lambda v: a * v; g = lambda v: v * v
    area = _I.quad(lambda v: f(v) - g(v), 0, a)[0]
    stem = f"Let $R$ be the region enclosed by the graphs of $y={a}x$ and $y=x^2$. Which integral gives the area of $R$?"
    texts = {"key": f"$\\displaystyle\\int_0^{{{a}}}\\left({a}x-x^2\\right)dx$", "rev": f"$\\displaystyle\\int_0^{{{a}}}\\left(x^2-{a}x\\right)dx$", "sum": f"$\\displaystyle\\int_0^{{{a}}}\\left({a}x+x^2\\right)dx$",
             "lim": f"$\\displaystyle\\int_0^{{{a*a}}}\\left({a}x-x^2\\right)dx$"}
    vals = {"key": area, "rev": -area, "sum": _I.quad(lambda v: f(v) + g(v), 0, a)[0], "lim": _I.quad(lambda v: f(v) - g(v), 0, a * a)[0]}
    assert len({round(v, 6) for v in vals.values()}) == 4
    why = {"key": "Upper curve minus lower curve between the intersection points x=0 and x=a.", "rev": "Subtracts in the wrong order, giving the negative of the area.", "sum": "Adds the functions instead of subtracting.", "lim": "Uses a y-value as the upper limit of x."}
    opts = [Opt(texts[k], k == "key", why[k], None) for k in texts]
    return pack_fixed("area_setup", "8.4", "1.D", "not_allowed", stem, opts, rng, est=75, facts=[f"area={area}"])

def volume_calc(rng):
    c = rng.choice([2, 3, 4]); f = lambda v: math.sqrt(v) + 1; g = lambda v: v / c
    # 교점 찾기(수치)
    from scipy.optimize import brentq
    b = brentq(lambda v: f(v) - g(v), 0.5 * c, 40 * c) if f(0) > g(0) else None
    V = _I.quad(lambda v: (f(v) - g(v)) ** 2, 0, b)[0]
    stem = f"Let $R$ be the region in the first quadrant bounded by the $y$-axis and the graphs of $y=\\sqrt{{x}}+1$ and $y=\\dfrac{{x}}{{{c}}}$. Region $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are squares. What is the volume of the solid?"
    A = _I.quad(lambda v: f(v) - g(v), 0, b)[0]
    key = Opt("$%.3f$" % V, True, "Integrates the square of the side length, (top - bottom)^2.", V)
    alt = [(A, "Integrates the side length instead of its square."), (math.pi * V, "Uses disks (multiplies by pi) instead of squares."), (_I.quad(lambda v: f(v) ** 2 - g(v) ** 2, 0, b)[0], "Squares each function separately."), (V / 2, "Uses half the square (triangle-like) cross section.")]
    return pack("volume_calc", "8.7", "1.D", "required", stem, key, [Opt("$%.3f$" % v, False, w, v) for v, w in alt], rng, est=110, facts=[f"V={V}", f"b={b}"])

def accum_context_calc(rng):
    A = rng.choice([40, 50, 80]); R = lambda v: 12 + 6 * math.sin(v / 2); T = rng.choice([4, 6, 8])
    ch = _I.quad(R, 0, T)[0]
    stem = f"Water flows into a tank at the rate $R(t)=12+6\\sin\\left(\\dfrac{{t}}{{2}}\\right)$ gallons per minute for $0\\le t\\le {T}$ minutes. At $t=0$ the tank contains ${A}$ gallons. How many gallons are in the tank at $t={T}$?"
    key = Opt("$%.2f$" % (A + ch), True, "Initial amount plus the integral of the rate.", A + ch)
    alt = [(ch, "Forgets the initial amount."), (A + R(T), "Adds the rate at t=T instead of integrating."), (A + R(T) * T, "Multiplies the final rate by the time."), (A + 12 * T, "Ignores the sine term.")]
    return pack("accum_context_calc", "8.3", "3.D", "required", stem, key, [Opt("$%.2f$" % v, False, w, v) for v, w in alt], rng, est=85, facts=[f"total={A+ch}"])
