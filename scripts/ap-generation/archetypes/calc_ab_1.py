from common import *

# ---------------- Unit 1 ----------------
def lim_table(rng):
    a = rnd(rng, 2, 6); c = rnd(rng, 2, 5); b = c * c - a
    f = (sp.sqrt(x + b) - c) / (x - a)
    L = S(1) / (2 * c)
    k = rng.choice([c, 0, a, 1, 2])
    if S(k) == L: k = 7
    xs = [sp.Rational(str(v)) for v in (a - 0.1, a - 0.01, a + 0.01, a + 0.1)]
    rows = [[str(float(v)), "%.4f" % float(sp.N(f.subs(x, v), 30))] for v in xs]
    # 독립 경로: 표의 안쪽 두 값 평균이 L 에 근접
    assert abs((float(rows[1][1]) + float(rows[2][1])) / 2 - float(L)) < 0.002
    stem = f"Let $f$ be defined by $f(x)=\\dfrac{{\\sqrt{{x+{b}}}-{c}}}{{x-{a}}}$ for $x\\ne {a}$, and $f({a})={k}$. The table gives values of $f$ near $x={a}$. What is $\\lim_{{x\\to {a}}} f(x)$?" if b >= 0 else f"Let $f$ be defined by $f(x)=\\dfrac{{\\sqrt{{x-{-b}}}-{c}}}{{x-{a}}}$ for $x\\ne {a}$, and $f({a})={k}$. The table gives values of $f$ near $x={a}$. What is $\\lim_{{x\\to {a}}} f(x)$?"
    key = Opt(fmt(L), True, "Limit read from the values the function approaches (rationalizing gives 1/(2c)).", L)
    ds = [Opt(fmt(k), False, "Treats the function value f(a) as the limit.", k),
          Opt("The limit does not exist", False, "Believes a mismatch between f(a) and the nearby values means the limit fails.", None),
          Opt(fmt(2 * L), False, "Drops the 1/2 from the derivative of the square root.", 2 * L),
          Opt(fmt(0), False, "Reads the 0/0 form as 0.", 0)]
    return pack("lim_table", "1.3", "2.B", "not_allowed", stem, key, ds, rng,
                stimulus=table_stimulus("Values of f near x=%d" % a, "x", rows, "f(x)"), est=75,
                facts=[f"limit={L}", f"f(a)={k}"])

def cont_piece(rng):
    c0 = rng.choice([2, 3, 4]); m = rnd(rng, 1, 6)
    kk = S(c0 * c0 - m - 1) / c0
    stem = (f"Let $f(x)=\\begin{{cases}} kx+1 & x<{c0}\\\\ x^2-{m} & x\\ge {c0}\\end{{cases}}$. For what value of $k$ is $f$ continuous at $x={c0}$?")
    alt = [S(c0 * c0 + m - 1) / c0, S(c0 * c0 - m), S(2 * c0), S(c0 * c0 - m + 1) / c0]
    why = ["Adds instead of subtracts the constant when matching the two pieces.", "Forgets the +1 in the left piece.",
           "Matches the derivatives of the pieces instead of their values.", "Moves the +1 to the wrong side."]
    key = Opt(fmt(kk), True, "Sets the left-hand limit equal to the value from the right piece.", kk)
    return pack("cont_piece", "1.11", "3.D", "not_allowed", stem, key, [Opt(fmt(v), False, w, v) for v, w in zip(alt, why)], rng, est=80, facts=[f"k={kk}"])

def ivt(rng):
    a = rnd(rng, -4, 2); b = a + rnd(rng, 5, 9)
    s = rng.choice([1, -1])
    lo, hi = (a, b) if s > 0 else (b, a)
    fa, fb = lo, hi
    f0, f4 = (a, b) if s > 0 else (b, a)
    mid = S(f0 + f4) / 2
    stem = (f"The function $f$ is continuous on $[0,4]$, with $f(0)={f0}$ and $f(4)={f4}$. For which value of $k$ does the Intermediate Value Theorem guarantee a number $c$ in the open interval $(0,4)$ with $f(c)=k$?")
    kk = sp.Rational(mid) if mid.q == 1 else mid
    beyond_hi = max(f0, f4) + rnd(rng, 1, 3); beyond_lo = min(f0, f4) - rnd(rng, 1, 3)
    key = Opt(fmt(kk), True, "Lies strictly between f(0) and f(4), so IVT applies on the open interval.", kk)
    ds = [Opt(fmt(f0), False, "An endpoint value is not guaranteed at an interior point.", f0),
          Opt(fmt(beyond_hi), False, "Outside the interval between f(0) and f(4).", beyond_hi),
          Opt(fmt(beyond_lo), False, "Outside the interval between f(0) and f(4).", beyond_lo),
          Opt(fmt(f4), False, "An endpoint value is not guaranteed at an interior point.", f4)]
    return pack("ivt", "1.15", "3.D", "not_allowed", stem, key, ds, rng, est=60, facts=[f"between {f0} and {f4}"])

def lim_alg(rng):
    a = rnd(rng, 2, 7); p = rnd(rng, 1, 5)
    # (x^2 - a^2)/(x^2 + p x - (a^2 + p a)) -> x=a ; denominator factor (x-a)(x+a+p)
    num = x * x - a * a
    den = (x - a) * (x + a + p)
    L = sp.limit(num / den, x, a)
    assert L == S(2 * a) / (2 * a + p)
    stem = f"What is $\\displaystyle\\lim_{{x\\to {a}}}\\dfrac{{x^2-{a*a}}}{{x^2+{p}x-{a*a+p*a}}}$?"
    key = Opt(fmt(L), True, "Factors and cancels the common (x-a) factor before substituting.", L)
    ds = [Opt(fmt(0), False, "Substitutes and reads 0/0 as 0.", 0), Opt("The limit does not exist", False, "Treats 0/0 as undefined and stops.", None),
          Opt(fmt(S(a) / (2 * a + p)), False, "Cancels incorrectly, losing a factor of 2 from the numerator.", S(a) / (2 * a + p)),
          Opt(fmt(S(2 * a) / (a + p)), False, "Substitutes x=a into only one factor of the denominator.", S(2 * a) / (a + p))]
    return pack("lim_alg", "1.7", "1.C", "not_allowed", stem, key, ds, rng, est=75, facts=[f"limit={L}"])

# ---------------- Unit 2 ----------------
def deriv_est_table(rng):
    p = S(rnd(rng, 1, 3)) / 2; q = rnd(rng, -4, 6); r = rnd(rng, 0, 5)
    f = p * x * x + q * x + r
    xs = [1, 3, 5, 7]
    vals = {v: f.subs(x, v) for v in xs}
    est = (vals[7] - vals[3]) / 4
    assert est == sp.diff(f, x).subs(x, 5)
    rows = [[str(v), str(vals[v])] for v in xs]
    stem = "The differentiable function $f$ has the values shown in the table. Using the data, which is the best approximation of $f'(5)$ using the points $x=3$ and $x=7$?"
    key = Opt(fmt(est), True, "Symmetric difference quotient over [3, 7].", est)
    ds = [Opt(fmt((vals[7] - vals[5]) / 2), False, "Uses the forward interval [5, 7] only.", (vals[7] - vals[5]) / 2),
          Opt(fmt((vals[5] - vals[3]) / 2), False, "Uses the backward interval [3, 5] only.", (vals[5] - vals[3]) / 2),
          Opt(fmt((vals[7] - vals[3]) / 2), False, "Divides by 2 instead of the interval length 4.", (vals[7] - vals[3]) / 2),
          Opt(fmt(vals[7] - vals[3]), False, "Forgets to divide by the interval length.", vals[7] - vals[3])]
    return pack("deriv_est_table", "2.3", "2.B", "not_allowed", stem, key, ds, rng,
                stimulus=table_stimulus("Values of f", "x", rows, "f(x)"), est=70, facts=[f"estimate={est}"])

def diff_cont(rng):
    c0 = rng.choice([1, 2, 3]); pconst = rnd(rng, 0, 4)
    case = rng.choice(["cont_nodiff", "cont_nodiff", "diff", "jump"])
    left = x * x + pconst
    if case == "diff":
        right = 2 * c0 * x + (c0 * c0 + pconst - 2 * c0 * c0)
    elif case == "cont_nodiff":
        m = rng.choice([v for v in range(-3, 6) if v != 2 * c0 and v != 0])
        right = m * x + (c0 * c0 + pconst - m * c0)
    else:
        m = rnd(rng, 1, 4); right = m * x + (c0 * c0 + pconst - m * c0) + rng.choice([-3, -2, 2, 3])
    lv = left.subs(x, c0); rv = right.subs(x, c0)
    cont = lv == rv
    dif = cont and sp.diff(left, x).subs(x, c0) == sp.diff(right, x).subs(x, c0)
    truth = "A" if dif else ("B" if cont else "D")
    stem = f"Let $f(x)=\\begin{{cases}} {sp.latex(left)} & x<{c0}\\\\ {sp.latex(sp.expand(right))} & x\\ge {c0}\\end{{cases}}$. Which statement is true about $f$ at $x={c0}$?"
    texts = {"A": "$f$ is continuous and differentiable at $x=%d$" % c0, "B": "$f$ is continuous but not differentiable at $x=%d$" % c0,
             "C": "$f$ is differentiable but not continuous at $x=%d$" % c0, "D": "$f$ is neither continuous nor differentiable at $x=%d$" % c0}
    why = {"A": "Assumes matching values imply matching slopes.", "B": "Correct classification.", "C": "Differentiability requires continuity, so this cannot happen.",
           "D": "Claims discontinuity although the one-sided limits agree."}
    opts = [Opt(texts[k], k == truth, why[k] if k != truth else "Compares one-sided limits and one-sided derivatives.", None) for k in "ABCD"]
    return pack_fixed("diff_cont", "2.4", "3.E", "not_allowed", stem, opts, rng, est=70, facts=[f"truth={truth}"])

def pack_fixed(archetype, topic, skill, calc, stem, opts, rng, stimulus=None, est=90, facts=None, extra=None):
    opts = list(opts); rng.shuffle(opts)
    ki = [i for i, o in enumerate(opts) if o.key]
    assert len(ki) == 1
    p = {"archetype": archetype, "topic": topic, "skill": skill, "calculator": calc, "stem": stem,
         "stimulus": stimulus or {"kind": "none", "description": "", "data": {}},
         "options": [{"text": o.text, "why": o.why, "value": None} for o in opts], "key_index": ki[0], "est_seconds": est, "facts": facts or []}
    if extra: p.update(extra)
    return p

def product_table(rng):
    a = rnd(rng, 1, 4)
    f, fp, g, gp = (rnd(rng, -5, 6) for _ in range(4))
    c = rnd(rng, 2, 4)
    # h(x)=f(x)g(x)+c f(x)
    key_v = fp * g + f * gp + c * fp
    stem = f"The table gives values of differentiable functions $f$ and $g$ and their derivatives at $x={a}$. If $h(x)=f(x)g(x)+{c}f(x)$, what is $h'({a})$?"
    rows = [["f(%d)" % a, str(f)], ["f'(%d)" % a, str(fp)], ["g(%d)" % a, str(g)], ["g'(%d)" % a, str(gp)]]
    key = Opt(fmt(key_v), True, "Product rule plus the constant-multiple rule.", key_v)
    ds = [Opt(fmt(fp * gp + c * fp), False, "Multiplies the derivatives f'g' instead of using the product rule.", fp * gp + c * fp),
          Opt(fmt(fp * g + f * gp + c * f), False, "Differentiates c*f(x) as c*f.", fp * g + f * gp + c * f),
          Opt(fmt(fp * g + f * gp), False, "Drops the c f'(x) term.", fp * g + f * gp),
          Opt(fmt(fp * g + c * fp), False, "Omits the f g' term of the product rule.", fp * g + c * fp)]
    return pack("product_table", "2.8", "1.E", "not_allowed", stem, key, ds, rng,
                stimulus=table_stimulus("Values at x=%d" % a, "quantity", rows, "value"), est=75, facts=[f"h'={key_v}"])

def quotient_rule_eval(rng):
    a = rnd(rng, 1, 4)
    while True:
        f, fp, g, gp = (rnd(rng, -5, 6) for _ in range(4))
        if g != 0: break
    key_v = S(fp * g - f * gp) / (g * g)
    stem = f"The table gives values of differentiable functions $f$ and $g$ and their derivatives at $x={a}$. If $q(x)=\\dfrac{{f(x)}}{{g(x)}}$, what is $q'({a})$?"
    rows = [["f(%d)" % a, str(f)], ["f'(%d)" % a, str(fp)], ["g(%d)" % a, str(g)], ["g'(%d)" % a, str(gp)]]
    key = Opt(fmt(key_v), True, "Quotient rule.", key_v)
    cand = [(S(f * gp - fp * g) / (g * g), "Reverses the order of the numerator terms."), (S(fp * g - f * gp) / g, "Divides by g instead of g squared."),
            (S(fp) / gp if gp != 0 else None, "Divides the derivatives f'/g'."), (S(fp * gp - f * g) / (g * g), "Uses a product-like numerator.")]
    ds = [Opt(fmt(v), False, w, v) for v, w in cand if v is not None]
    return pack("quotient_rule_eval", "2.9", "1.E", "not_allowed", stem, key, ds, rng,
                stimulus=table_stimulus("Values at x=%d" % a, "quantity", rows, "value"), est=80, facts=[f"q'={key_v}"])

# ---------------- Unit 3 ----------------
def chain_table(rng):
    a = rnd(rng, 1, 3)
    ga, gpa = rnd(rng, 1, 5), rnd(rng, -4, 5)
    fv = {ga: rnd(rng, -5, 6), a: rnd(rng, -5, 6)}
    fp_at_g, fp_at_a = rnd(rng, -5, 6), rnd(rng, -5, 6)
    if ga == a: ga = a + 1; fv = {ga: rnd(rng, -5, 6), a: rnd(rng, -5, 6)}
    key_v = fp_at_g * gpa
    stem = f"The table gives values of differentiable functions. If $h(x)=f(g(x))$, what is $h'({a})$?"
    rows = [["g(%d)" % a, str(ga)], ["g'(%d)" % a, str(gpa)], ["f(%d)" % ga, str(fv[ga])], ["f'(%d)" % ga, str(fp_at_g)], ["f'(%d)" % a, str(fp_at_a)]]
    key = Opt(fmt(key_v), True, "Chain rule: f'(g(a))*g'(a).", key_v)
    ds = [Opt(fmt(fp_at_a * gpa), False, "Evaluates f' at x=a instead of at g(a).", fp_at_a * gpa),
          Opt(fmt(fp_at_g), False, "Forgets the inner derivative g'(a).", fp_at_g),
          Opt(fmt(fp_at_a * ga), False, "Multiplies f'(a) by g(a).", fp_at_a * ga),
          Opt(fmt(fv[ga] * gpa), False, "Uses f(g(a)) instead of f'(g(a)).", fv[ga] * gpa)]
    return pack("chain_table", "3.1", "1.E", "not_allowed", stem, key, ds, rng,
                stimulus=table_stimulus("Values of f, g and derivatives", "quantity", rows, "value"), est=70, facts=[f"h'={key_v}"])

def implicit_slope(rng):
    for _ in range(200):
        p = rnd(rng, 1, 4); q = rnd(rng, 1, 3); x0 = rnd(rng, 1, 3); y0 = rnd(rng, 1, 3)
        C = x0 * x0 + p * x0 * y0 + q * y0 * y0
        Fx = 2 * x0 + p * y0; Fy = p * x0 + 2 * q * y0
        if Fy == 0 or p * x0 == 0 or 2 * q * y0 == 0: continue
        s = S(-Fx) / Fy
        w1 = S(-Fx) / (2 * q * y0)            # xy 항의 x y' 를 빠뜨림
        w2 = S(-(Fx + 2 * q * y0)) / (p * x0)   # y^2 항에 y' 를 빠뜨림
        w3 = -s
        if len({s, w1, w2, w3}) == 4: break
    # 독립 경로: 암시적 미분(sympy idiff)
    X, Y = sp.symbols("X Y"); F = X * X + p * X * Y + q * Y * Y - C
    assert sp.idiff(F, Y, X).subs({X: x0, Y: y0}) == s
    stem = f"A curve is defined by $x^2+{p}xy+{q}y^2={C}$. What is $\\dfrac{{dy}}{{dx}}$ at the point $({x0},{y0})$?"
    key = Opt(fmt(s), True, "Implicit differentiation with the product rule on xy and the chain rule on y^2.", s)
    ds = [Opt(fmt(w1), False, "Differentiates xy as y, missing the x*dy/dx term.", w1), Opt(fmt(w2), False, "Differentiates y^2 as 2y without the dy/dx factor.", w2),
          Opt(fmt(w3), False, "Sign error when solving for dy/dx.", w3)]
    return pack("implicit_slope", "3.2", "1.E", "not_allowed", stem, key, ds + [Opt(fmt(S(Fx) / Fy * 2), False, "Doubles the slope after solving.", S(Fx) / Fy * 2)], rng, est=100, facts=[f"slope={s}"])
