from common import *
from calc_ab_1 import pack_fixed

# ---------------- Unit 4 ----------------
def motion_calc(rng):
    A = rng.choice([1.3, 2.4, 0.8, 1.7]); B = rng.choice([0.2, 0.5, 0.3]); C = rng.choice([0.4, 1.0, 0.6]); t0 = rng.choice([1.2, 1.5, 2.0, 2.5])
    v = A * t * sp.log(B * t + C)
    a = sp.diff(v, t)
    key_v = sp.N(a.subs(t, t0), 10)
    # 독립 수치 경로(중앙 차분)
    fv = sp.lambdify(t, v, "math"); hh = 1e-6
    assert abs((fv(t0 + hh) - fv(t0 - hh)) / (2 * hh) - float(key_v)) < 1e-5
    miss = A * sp.log(B * t0 + C)                       # 곱의 미분 둘째 항 누락
    vval = sp.N(v.subs(t, t0), 10)                        # v(t0) 를 가속도로 착각
    wrong2 = sp.N((A * (B * t0) / (B * t0 + C)), 10)      # 둘째 항만
    stem = f"A particle moves along a straight line with velocity $v(t)={A}t\\ln({B}t+{C})$ for $t\\ge 0$. What is the acceleration of the particle at time $t={t0}$?"
    key = Opt(fmt(key_v, 3), True, "Differentiates v(t) with the product rule and chain rule.", key_v)
    ds = [Opt(fmt(miss, 3), False, "Product rule with the second term missing.", miss), Opt(fmt(vval, 3), False, "Evaluates the velocity instead of the acceleration.", vval),
          Opt(fmt(wrong2, 3), False, "Keeps only the t * d/dt[ln] term.", wrong2), Opt(fmt(-key_v, 3), False, "Reports the acceleration with the wrong sign.", -key_v)]
    return pack("motion_calc", "4.2", "1.E", "required", stem, key, ds, rng, est=100, facts=[f"a={key_v}"])

def related_rates(rng):
    kind = rng.choice(["circle", "sphere"]); r0 = rnd(rng, 2, 6); k = rnd(rng, 1, 4)
    if kind == "circle":
        stem = f"The radius of a circle is increasing at a constant rate of ${k}$ centimeters per second. At the instant the radius is ${r0}$ centimeters, how fast is the area of the circle increasing, in square centimeters per second?"
        key_v = 2 * sp.pi * r0 * k
        ds = [(sp.pi * r0 * r0 * k, "Multiplies the area formula by dr/dt instead of differentiating."), (2 * sp.pi * k, "Forgets the factor r from differentiating r squared."),
              (2 * sp.pi * r0, "Forgets to multiply by dr/dt."), (sp.pi * r0 * k, "Differentiates r^2 as r.")]
    else:
        stem = f"A spherical balloon is being inflated so that its radius increases at ${k}$ centimeters per second. At the instant the radius is ${r0}$ centimeters, how fast is the volume increasing, in cubic centimeters per second? (The volume of a sphere is $V=\\frac{{4}}{{3}}\\pi r^3$.)"
        key_v = 4 * sp.pi * r0 ** 2 * k
        ds = [(sp.Rational(4, 3) * sp.pi * r0 ** 3 * k, "Uses the volume formula instead of its derivative."), (4 * sp.pi * r0 * k, "Differentiates r^3 as 3r (wrong power)."),
              (4 * sp.pi * r0 ** 2, "Forgets dr/dt."), (sp.Rational(4, 3) * sp.pi * 3 * r0 ** 2 * k / 2, "Wrong constant after differentiating.")]
    key = Opt(fmt(key_v), True, "Differentiates the formula with respect to time (chain rule).", key_v)
    return pack("related_rates", "4.4", "1.D", "not_allowed", stem, key, [Opt(fmt(v), False, w, v) for v, w in ds], rng, est=90, facts=[f"rate={key_v}"])

def linearization(rng):
    s = rng.choice([4, 5, 6, 7, 8, 10]); a = s * s; d = rng.choice([1, 2, 3, -1, -2, -3])
    key_v = s + S(d) / (2 * s)
    stem = f"Let $f(x)=\\sqrt{{x}}$. The line tangent to the graph of $f$ at $x={a}$ is used to approximate $f({a+d})$. Which gives the approximation and correctly describes how it compares with the actual value of $f({a+d})$?"
    wrong1 = s + S(d) / s; wrong2 = s + d
    # f 는 위로 오목이 아닌 아래로 오목(f''<0) → 접선 근사는 과대 추정
    texts = [(f"{ftxt(key_v)}; an overestimate", True, "Tangent value; f is concave down so the tangent line lies above the graph."),
             (f"{ftxt(key_v)}; an underestimate", False, "Gives the tangent-line value but says underestimate: f(x)=sqrt(x) is concave down, so the tangent line lies above the graph."),
             (f"{ftxt(wrong1)}; an overestimate", False, "Uses the slope 1/sqrt(a) instead of 1/(2 sqrt(a)) for the tangent line, then states overestimate."),
             (f"{ftxt(wrong2)}; an underestimate", False, "Uses slope 1 instead of f'(a) for the tangent line, then states underestimate.")]
    opts = [Opt("$" + t_ + "$" if False else t_.replace(t_.split(";")[0], "$" + t_.split(";")[0] + "$"), k, w, None) for t_, k, w in texts]
    return pack_fixed("linearization", "4.6", "1.F", "not_allowed", stem, opts, rng, est=85, facts=[f"approx={key_v}", "overestimate"])

def lhopital(rng):
    p = rnd(rng, 2, 7); q = rnd(rng, 2, 7)
    while p == q: q = rnd(rng, 2, 7)
    form = rng.choice(["sin", "exp", "ln"])
    if form == "sin": e = f"\\dfrac{{\\sin({p}x)}}{{{q}x}}"
    elif form == "exp": e = f"\\dfrac{{e^{{{p}x}}-1}}{{{q}x}}"
    else: e = f"\\dfrac{{\\ln(1+{p}x)}}{{{q}x}}"
    L = S(p) / q
    ex = {"sin": sp.sin(p * x) / (q * x), "exp": (sp.exp(p * x) - 1) / (q * x), "ln": sp.log(1 + p * x) / (q * x)}[form]
    assert sp.limit(ex, x, 0) == L
    stem = f"What is $\\displaystyle\\lim_{{x\\to 0}} {e}$?"
    key = Opt(fmt(L), True, "Both numerator and denominator approach 0; differentiate each (L'Hospital) or use the standard limit.", L)
    ds = [Opt(fmt(S(q) / p), False, "Inverts the ratio of the derivatives.", S(q) / p), Opt(fmt(0), False, "Substitutes x=0 into the numerator only.", 0),
          Opt("The limit does not exist", False, "Treats 0/0 as undefined.", None), Opt(fmt(p), False, "Forgets to divide by the denominator derivative.", p)]
    return pack("lhopital", "4.7", "1.E", "not_allowed", stem, key, ds, rng, est=70, facts=[f"limit={L}"])

# ---------------- Unit 5 ----------------
def mvt_calc(rng):
    a = rng.choice([0, 1]); b = a + rng.choice([2, 3, 4])
    avg = (sp.exp(b) - sp.exp(a)) / (b - a)
    c = sp.log(avg); assert a < float(c) < b
    key_v = sp.N(c, 10)
    stem = f"The function $f(x)=e^x$ is differentiable on $[{a},{b}]$. According to the Mean Value Theorem, there is a number $c$ in $({a},{b})$ with $f'(c)$ equal to the average rate of change of $f$ on the interval. What is the value of $c$?"
    key = Opt(fmt(key_v, 3), True, "Solves e^c = average rate of change.", key_v)
    ds = [Opt(fmt(S(a + b) / 2, 3), False, "Assumes c is the midpoint.", S(a + b) / 2), Opt(fmt(sp.N(avg, 10), 3), False, "Reports the average rate of change instead of c.", sp.N(avg, 10)),
          Opt(fmt(sp.N(sp.log(sp.exp(b) - sp.exp(a)), 10), 3), False, "Forgets to divide by b-a before taking the logarithm.", sp.N(sp.log(sp.exp(b) - sp.exp(a)), 10)),
          Opt(fmt(sp.N(sp.log(avg, 10), 10), 3), False, "Uses the common logarithm instead of the natural logarithm.", sp.N(sp.log(avg, 10), 10))]
    return pack("mvt_calc", "5.1", "3.D", "required", stem, key, ds, rng, est=90, facts=[f"c={key_v}"])

def extrema_classification(rng):
    rts = sorted(rng.sample(range(-4, 6), 3)); r1, r2, r3 = rts
    sgn = rng.choice([1, -1])
    fp = sgn * (x - r1) * (x - r2) ** 2 * (x - r3)
    def sign(v): return sp.sign(fp.subs(x, v))
    ptsx = [r1 - 1, S(r1 + r2) / 2, S(r2 + r3) / 2, r3 + 1]
    sg = [sign(v) for v in ptsx]
    mx = [r for r, i in ((r1, 0), (r2, 1), (r3, 2)) if (sg[i] if i < 2 else sg[i]) > 0 and (sg[i + 1] if i == 0 else sg[i + 1]) < 0]
    # r2 는 부호 변화 없음; r1: 구간0->1, r3: 구간2->3
    local_max = [r for r, (s0, s1) in ((r1, (sg[0], sg[1])), (r3, (sg[2], sg[3]))) if s0 > 0 and s1 < 0]
    assert len(local_max) == 1
    ans = local_max[0]
    stem = f"The derivative of a function $f$ is $f'(x)={sp.latex(sp.factor(fp))}$. At which value of $x$ does $f$ have a relative maximum?"
    other = [r for r in (r1, r3) if r != ans][0]
    key = Opt(fmt(ans), True, "f' changes from positive to negative there.", ans)
    ds = [Opt(fmt(r2), False, "Double root: f' does not change sign, so no extremum.", r2), Opt(fmt(other), False, "f' changes from negative to positive there (relative minimum).", other),
          Opt("$f$ has no relative maximum", False, "Misreads the sign chart.", None)]
    return pack("extrema_classification", "5.4", "3.E", "not_allowed", stem, key, ds, rng, est=85, facts=[f"max at {ans}"])

def fprime_graph_statements(rng):
    r1, r2 = sorted(rng.sample(range(1, 7), 2))
    lo = r1 + rng.choice([0, 1]) if False else r1 - 0
    lo, hi = sorted(rng.sample(range(0, 9), 2))
    while hi - lo < 2: lo, hi = sorted(rng.sample(range(0, 9), 2))
    mid = S(lo + hi) / 2
    stem = (f"The derivative $f'$ of a twice-differentiable function $f$ is positive on $(0,{r1})$, negative on $({r1},{r2})$ and positive on $({r2},9)$. "
            f"Also, $f'$ is increasing on $({lo},{hi})$. Which statement about $f$ is true?")
    key_txt = f"$f$ has a local maximum at $x={r1}$ and a local minimum at $x={r2}$, and $f$ is concave up on $({lo},{hi})$"
    d1 = f"$f$ has a local minimum at $x={r1}$ and a local maximum at $x={r2}$, and $f$ is concave up on $({lo},{hi})$"
    d2 = f"$f$ has a local maximum at $x={r1}$ and a local minimum at $x={r2}$, and $f$ is concave down on $({lo},{hi})$"
    d3 = f"$f$ has a local maximum at $x={r1}$ and a local minimum at $x={r2}$, and $f$ has a local minimum at $x={mid}$" if mid not in (r1, r2) else f"$f$ has a local maximum at $x={r1}$ and a local minimum at $x={r2}$, and $f$ is decreasing on $({lo},{hi})$"
    opts = [Opt(key_txt, True, "Sign changes of f' locate extrema; f' increasing means f is concave up.", None),
            Opt(d1, False, "Swaps maximum and minimum when reading the sign change.", None), Opt(d2, False, "Confuses f' increasing with f concave down.", None),
            Opt(d3, False, "Treats the location where f' is smallest as a relative extremum of f.", None)]
    return pack_fixed("fprime_graph_statements", "5.9", "2.D", "not_allowed", stem, opts, rng, est=100, facts=[f"max {r1} min {r2} concave up ({lo},{hi})"])

def inflection_count(rng):
    rts = sorted(rng.sample(range(-5, 6), 3)); r1, r2, r3 = rts
    fpp = rng.choice([1, -1]) * (x - r1) * (x - r2) ** 2 * (x - r3)
    changes = 0
    pts = [r1 - 1, S(r1 + r2) / 2, S(r2 + r3) / 2, r3 + 1]
    sg = [sp.sign(fpp.subs(x, v)) for v in pts]
    changes = sum(1 for i in range(3) if sg[i] != sg[i + 1])
    assert changes == 2
    stem = f"The second derivative of a function $f$ is $f''(x)={sp.latex(sp.factor(fpp))}$. How many points of inflection does the graph of $f$ have?"
    key = Opt("$2$", True, "f'' changes sign at two of its three zeros (the double zero gives no sign change).", 2)
    ds = [Opt("$3$", False, "Counts every zero of f'' as an inflection point.", 3), Opt("$1$", False, "Misses one sign change.", 1), Opt("$4$", False, "Counts the double zero twice.", 4)]
    return pack("inflection_count", "5.6", "2.E", "not_allowed", stem, key, ds, rng, est=70, facts=["count=2"])

def optimization(rng):
    k = rng.choice([1, 2, 3]); c = 3 * k * k
    key_v = 4 * k ** 3
    stem = f"A rectangle has its base on the $x$-axis and its upper two vertices on the graph of $y={c}-x^2$, symmetric about the $y$-axis. What is the maximum possible area of the rectangle?"
    # 독립 수치 경로
    best = max(2 * xx * (c - xx * xx) for xx in [i / 1000 * (c ** 0.5) for i in range(0, 1001)])
    assert abs(best - key_v) < 0.05 * key_v
    key = Opt(fmt(key_v), True, "Area 2x(c - x^2) is maximized at x = k.", key_v)
    ds = [Opt(fmt(2 * k ** 3), False, f"Uses base x instead of 2x, so the area x({c} - x^2) is maximized at x = {k} with value {2*k**3}.", 2 * k ** 3), Opt(fmt(k), False, f"Reports the maximizing value x = {k} instead of the maximum area.", k),
          Opt(fmt(3 * k ** 3), False, f"Uses height {c} (the y-intercept) instead of {c} - {k}^2 = {c-k*k} at the optimum.", 3 * k ** 3), Opt(fmt(2 * k * c), False, f"Evaluates 2x({c}) at x = {k} using the full height {c}.", 2 * k * c)]
    return pack("optimization", "5.11", "1.E", "not_allowed", stem, key, ds, rng, est=100, facts=[f"max area={key_v}"])
