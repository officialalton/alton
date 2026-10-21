"""AP Precalculus 원형 G — 단원 1(다항·유리 함수) 2차 저작: 계산기 불가 12 + 그래핑 계산기 필수 3."""
from pre_common import *
from pre_common import _O

STAGE_U1C = ["pre_ivt_zero_guarantee", "pre_poly_increasing_interval_graph", "pre_rational_equation_solve", "pre_complex_zero_count", "pre_poly_end_behavior_factored", "pre_quadratic_complex_zeros",
             "pre_poly_division_quotient", "pre_transform_reflect_describe", "pre_roc_unit_interpretation", "pre_quad_model_from_roots", "pre_rational_context_asymptote", "pre_poly_even_odd_expression",
             "pre_quartic_zero_count_calc", "pre_rational_xint_calc", "pre_poly_roc_sign_calc"]


@retry_sep
def pre_ivt_zero_guarantee(rng):
    for _ in forever():
        xs = [0, 1, 2, 3, 4, 5]; ys = [rng.randint(-9, 9) for _ in xs]
        if 0 in ys or len({*ys}) < 5:
            continue
        sc = sum(1 for i in range(5) if ys[i] * ys[i + 1] < 0)
        if 2 <= sc <= 4:
            break
    for _ in forever():
        lo, hi = sorted(rng.sample(range(0, 6), 2))
        g = sum(1 for i in range(lo, hi) if ys[i] * ys[i + 1] < 0)
        if hi - lo >= 2 and g >= 1 and g != sc:
            break
    key, ds = num_options(float(g), [("Counts the sign changes of the whole table instead of the stated interval.", float(sc) if sc != g else float(sc + 1)), ("Counts the number of table entries in the interval.", float(hi - lo + 1)), ("Counts the number of subintervals between table entries.", float(hi - lo)),
                                    ("Adds two to the correct count.", float(g + 2)), ("Doubles the number of sign changes.", float(2 * g))], f=lambda v: f"${int(v)}$", tol=0.1)
    stim = table_stim("Values of a polynomial function $p$", "x", "p(x)", list(zip(xs, ys)))
    stem = f"The table gives values of a continuous polynomial function $p$. Based on the table, what is the least number of zeros that $p$ must have in the interval ${lo}\\le x\\le {hi}$?"
    return MQ("pre_ivt_zero_guarantee", "1.4", "2", "not_allowed", stem, key, ds, rng, "A sign change between consecutive table values guarantees a zero by the Intermediate Value Theorem", ["Look for consecutive outputs with opposite signs inside the interval", "Count the subintervals with a sign change"], "sign comparison of consecutive outputs computed independently in numpy", f"The outputs change sign on {g} subinterval(s) within ${lo}\\le x\\le {hi}$, so $p$ has at least {g} zero(s) there.", [f"xs={xs}", f"ys={ys}", f"lo={lo}", f"hi={hi}"], stim=stim, est=85, mat=MAT_TABLE("the table values of p"))


@retry_sep
def pre_poly_increasing_interval_graph(rng):
    for _ in forever():
        r = sorted(rng.sample([-3, -2, -1, 0, 1, 2, 3], 3)); a = pick(rng, [-1, 1]); f = lambda v: a * (v - r[0]) * (v - r[1]) * (v - r[2]) / 4.0  # noqa: E731
        dp = np.roots([3 * a / 4.0, -2 * a * sum(r) / 4.0, a * (r[0] * r[1] + r[0] * r[2] + r[1] * r[2]) / 4.0]); t = sorted(float(z.real) for z in dp if abs(z.imag) < 1e-9)
        lo, hi = r[0] - 1.0, r[2] + 1.0
        if len(t) == 2 and max(abs(f(v)) for v in np.linspace(lo, hi, 200)) <= 9 and t[1] - t[0] > 0.8 and all(abs(z - round(z)) > 0.1 for z in t):
            break
    ymax = math.ceil(max(abs(f(v)) for v in np.linspace(lo, hi, 400))) + 1
    stim = fn_graph("The graph of a polynomial function $p$", f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    inc_on_mid = a < 0
    key_t = f"$p$ is increasing on the interval between its two turning points" if inc_on_mid else f"$p$ is increasing to the left of its first turning point and to the right of its second turning point"
    wr = [("$p$ is decreasing on the interval between its two turning points" if inc_on_mid else "$p$ is decreasing to the left of its first turning point and to the right of its second turning point", "Reverses increasing and decreasing on every interval."),
          ("$p$ is increasing on every interval because it is a cubic function", "Assumes a cubic polynomial is increasing everywhere."),
          ("$p$ is increasing only where the graph is above the $x$-axis", "Confuses the sign of the function values with the direction of the graph.")]
    key, ds = text_options(key_t, "Read the direction of the graph on the intervals separated by the turning points: a cubic with this end behavior rises or falls on the outer intervals as shown.", wr)
    stem = "The graph of a polynomial function $p$ is shown. Which of the following statements about the behavior of $p$ is true?"
    return MQ("pre_poly_increasing_interval_graph", "1.4", "2", "not_allowed", stem, key, ds, rng, "The direction of a polynomial graph changes at its turning points", ["Locate the two turning points on the graph", "Determine whether the graph rises or falls on each of the three intervals"], "the derivative of the plotted cubic changes sign at the two turning points, computed with numpy roots", f"The graph {'rises' if inc_on_mid else 'falls'} between the turning points and does the opposite on the outer intervals.", [f"r={r}", f"a={a}"], stim=stim, est=85, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_rational_equation_solve(rng):
    for _ in forever():
        a, b, c, d = rng.sample([1, 2, 3, 4, 5, -1, -2, -3], 4)
        # (x + a)/(x + b) = c ; 해 x = (c b - a)/(1 - c)
        if c == 1:
            continue
        sol = sp.Rational(c * b - a, 1 - c)
        if sol != -b and sol.q <= 3:
            break
    f = sp.lambdify(X, (X + a) / (X + b) - c, "math"); agree(f(float(sol)), 0.0, 1e-9, "sol")
    key, ds = num_options(float(sol), [("Cross-multiplies but forgets to distribute $c$ over the denominator.", float(sp.Rational(c * 0 - a, 1) if False else sp.Rational(-a + c, 1) if c != 1 else 0)), ("Sets the numerator equal to $c$ and ignores the denominator.", float(c - a)), ("Solves with the wrong sign for $b$: $x-b$ instead of $x+b$.", float(sp.Rational(-c * b - a, 1 - c))), ("Reports the value that makes the denominator zero.", float(-b))], f=rat_tex)
    stem = f"What is the solution of the equation $\\dfrac{{x{a:+d}}}{{x{b:+d}}}={c}$?"
    return MQ("pre_rational_equation_solve", "1.8", "1", "not_allowed", stem, key, ds, rng, "Rational equations are solved by clearing the denominator and checking the domain", ["Multiply both sides by the denominator, distributing correctly", "Solve the linear equation and confirm the solution is not an excluded value"], "substitution of the solution into the original expression", f"$x{a:+d}={c}(x{b:+d})$ gives $x={L(sol)}$.", [f"a={a}", f"b={b}", f"c={c}"], est=90)


@retry_sep
def pre_complex_zero_count(rng):
    a = pick(rng, [1, 2, 3]); b = pick(rng, [1, 2, 3]); k = pick(rng, [1, 2])
    P = (X - a) ** 2 * (X ** 2 + b * b) * (X + k) if rng.random() < 0.5 else (X - a) * (X + b) * (X ** 2 + k * k) * (X ** 2 + 1)
    deg = sp.degree(sp.expand(P), X); nonreal = sum(1 for z in np.roots([float(q) for q in sp.Poly(sp.expand(P), X).all_coeffs()]) if abs(z.imag) > 1e-6)
    ask = pick(rng, ["nonreal", "degree"])
    val = nonreal if ask == "nonreal" else int(deg)
    wr = [("Counts only the real zeros.", int(deg) - nonreal), ("Counts distinct factors instead of zeros with multiplicity.", len(sp.factor_list(sp.expand(P), X, extension=sp.I)[1])), ("Uses half the degree.", int(deg) // 2 + (1 if int(deg) % 2 else 0)), ("Adds one extra zero for the leading coefficient.", int(deg) + 1), ("Counts each nonreal pair once.", nonreal // 2)]
    key, ds = num_options(float(val), [(w, float(v)) for w, v in wr], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"The polynomial $p$ is defined by $p(x)={L(P)}$, which is written in factored form over the real numbers. " + ("How many nonreal zeros does $p$ have, counting multiplicity?" if ask == "nonreal" else "How many zeros does $p$ have in the complex number system, counting multiplicity?")
    return MQ("pre_complex_zero_count", "1.5", "1", "not_allowed", stem, key, ds, rng, "The Fundamental Theorem of Algebra counts zeros with multiplicity", ["Find the degree of the polynomial from its factored form", "Separate real zeros from nonreal conjugate pairs and count with multiplicity"], "numpy roots of the expanded polynomial count the nonreal zeros", f"The degree is {int(deg)} and each quadratic factor with no real zeros contributes a nonreal conjugate pair, so there are {nonreal} nonreal zeros.", [f"P={P}", f"ask={ask}"], est=80)


@retry_sep
def pre_poly_end_behavior_factored(rng):
    for _ in forever():
        a = pick(rng, [-3, -2, 2, 3]); m1 = pick(rng, [1, 2, 3]); m2 = pick(rng, [1, 2, 3]); r1, r2 = rng.sample([-3, -2, -1, 1, 2, 3], 2)
        deg = m1 + m2
        if deg >= 3:
            break
    P = a * (X - r1) ** m1 * (X - r2) ** m2; f = sp.lambdify(X, P, "math"); vp, vn = f(1e3), f(-1e3)
    sgn = lambda v: "\\infty" if v > 0 else "-\\infty"  # noqa: E731
    tex = lambda r_, l_: f"As $x\\to\\infty$, $p(x)\\to {r_}$ and as $x\\to-\\infty$, $p(x)\\to {l_}$"  # noqa: E731
    r, l = sgn(vp), sgn(vn)
    combos = [("\\infty", "\\infty"), ("\\infty", "-\\infty"), ("-\\infty", "\\infty"), ("-\\infty", "-\\infty")]
    wr = []
    for aa, bb in combos:
        if (aa, bb) == (r, l):
            continue
        same_parity = ((aa == bb) == (r == l))
        del same_parity
        wr.append((tex(aa, bb), "Reverses the behavior at both ends." if (aa != r and bb != l) else ("Reverses the behavior as $x$ increases without bound only." if aa != r else "Reverses the behavior as $x$ decreases without bound only.")))
    key, ds = text_options(tex(r, l), "Add the exponents to find the degree and use the sign of the constant as the leading coefficient.", wr)
    stem = f"The polynomial function $p$ is defined by $p(x)={a}(x{-r1:+d})^{m1}(x{-r2:+d})^{m2}$. Which of the following describes the end behavior of $p$?"
    return MQ("pre_poly_end_behavior_factored", "1.6", "1", "not_allowed", stem, key, ds, rng, "End behavior from a factored polynomial uses the total degree and the leading coefficient", ["Add the exponents of the factors to find the degree", "Use the parity of the degree and the sign of the constant to describe both ends"], "numerical evaluation of p at plus and minus 10^3", f"The degree is {deg} and the leading coefficient is {a}, so {tex(r, l)}.", [f"a={a}", f"m1={m1}", f"m2={m2}", f"r1={r1}", f"r2={r2}"], est=85)


@retry_sep
def pre_quadratic_complex_zeros(rng):
    for _ in forever():
        a = pick(rng, [1, 2]); p_ = pick(rng, [-3, -2, -1, 1, 2, 3]); q = pick(rng, [1, 2, 3, 4])
        P = a * X ** 2 - 2 * a * p_ * X + a * (p_ ** 2 + q)
        break
    zs = np.roots([float(c) for c in sp.Poly(P, X).all_coeffs()]); ok = all(abs(z.real - p_) < 1e-9 for z in zs)
    assert ok
    ctex = lambda re_, im_: f"${re_}{'+' if im_ >= 0 else '-'}\\sqrt{{{abs(im_)}}}\\,i$" if im_ not in (1, -1) and False else None  # noqa: E731
    sq = lambda v: f"\\sqrt{{{v}}}" if v != 1 else "1"  # noqa: E731
    key_t = f"$x={p_}\\pm {sq(q)}i$"
    key, ds = text_options(key_t, "Use the quadratic formula; the discriminant is negative, so the zeros are a conjugate pair with real part -b/2a.", [(f"$x={-p_}\\pm {sq(q)}i$", "Reverses the sign of the real part."), (f"$x={p_}\\pm {sq(q * q)}i$" if q > 1 else f"$x={p_}\\pm 2i$", "Does not take the square root of the discriminant correctly."), (f"$x={p_}\\pm {sq(q)}$", "Drops the imaginary unit."), (f"$x={p_ * 2}\\pm {sq(q)}i$", "Uses $-b/a$ instead of $-b/2a$ for the real part.")])
    stem = f"What are the zeros of the quadratic function $q(x)={L(P)}$?"
    return MQ("pre_quadratic_complex_zeros", "1.5", "1", "not_allowed", stem, key, ds, rng, "Quadratics with negative discriminant have complex conjugate zeros", ["Compute the discriminant and note it is negative", "Apply the quadratic formula to write the conjugate pair"], "numpy roots of the coefficient list reproduce the conjugate pair", f"The zeros are $x={p_}\\pm {sq(q)}i$.", [f"a={a}", f"p={p_}", f"q={q}"], est=95)


@retry_sep
def pre_poly_division_quotient(rng):
    for _ in forever():
        k = pick(rng, [-2, -1, 1, 2, 3]); c3 = pick(rng, [1, 2]); c2 = pick(rng, [-3, -1, 2, 4]); c1 = pick(rng, [-5, -2, 3]); rem = pick(rng, [0, 0, 2, -3])
        qx = c3 * X ** 2 + c2 * X + c1; num = sp.expand(qx * (X - k) + rem)
        break
    f = sp.lambdify(X, num / (X - k), "math"); g = sp.lambdify(X, qx + rem / (X - k), "math"); agree(f(2.3), g(2.3), 1e-9, "div")
    key_e = qx if rem == 0 else qx + rem / (X - k)
    cands = [("Uses the wrong sign for the root in synthetic division.", sp.cancel(sp.div(num, X + k, X)[0])), ("Forgets the last coefficient of the quotient.", c3 * X ** 2 + c2 * X), ("Divides each term by $x-k$ separately.", sp.expand(num / X)), ("Uses the remainder as part of the quotient.", qx + rem)]
    if rem == 0:
        key, ds = expr_options(qx, [(w, e) for w, e in cands])
        ask = "What is the quotient when $p(x)$ is divided by $x" + (f"-{k}" if k > 0 else f"+{abs(k)}") + "$?"
    else:
        key, ds = expr_options(qx + rem / (X - k), [("Drops the remainder term.", qx), ("Puts the remainder over the wrong denominator.", qx + rem / (X + k)), ("Uses the opposite sign for the remainder.", qx - rem / (X - k)), ("Adds the remainder to the constant term of the quotient.", qx + rem)])
        ask = "Which of the following is equivalent to $\\dfrac{p(x)}{x" + (f"-{k}" if k > 0 else f"+{abs(k)}") + "}$ for $x\\ne " + str(k) + "$?"
    stem = f"The polynomial $p$ is defined by $p(x)={L(num)}$. {ask}"
    return MQ("pre_poly_division_quotient", "1.11", "1", "not_allowed", stem, key, ds, rng, "Polynomial division produces a quotient and a remainder", ["Divide the cubic polynomial by the linear divisor using long or synthetic division", "Write the result with the remainder if it is not zero"], "sympy polynomial division versus numerical evaluation of both forms", f"Dividing gives the quotient ${L(qx)}$ with remainder ${rem}$.", [f"num={num}", f"k={k}", f"rem={rem}"], est=105)


@retry_sep
def pre_transform_reflect_describe(rng):
    sh = pick(rng, [1, 2, 3]); kk = pick(rng, [-3, -2, 2, 4]); mode = pick(rng, ["neg_x", "neg_f", "both"])
    if mode == "neg_x":
        form = f"g(x)=f(-x){'+' if kk > 0 else '-'}{abs(kk)}"; key_t = f"A reflection of the graph of $f$ across the $y$-axis followed by a vertical translation {abs(kk)} units {'up' if kk > 0 else 'down'}"
        wr = [(f"A reflection across the $x$-axis followed by a vertical translation {abs(kk)} units {'up' if kk > 0 else 'down'}", "Confuses a reflection across the y-axis with a reflection across the x-axis."), (f"A reflection across the $y$-axis followed by a vertical translation {abs(kk)} units {'down' if kk > 0 else 'up'}", "Reverses the direction of the vertical translation."), (f"A reflection across the $y$-axis followed by a horizontal translation {abs(kk)} units {'left' if kk > 0 else 'right'}", "Treats the added constant as a horizontal translation.")]
    elif mode == "neg_f":
        form = f"g(x)=-f(x{'-' if sh > 0 else '+'}{abs(sh)})"; key_t = f"A reflection of the graph of $f$ across the $x$-axis and a horizontal translation {abs(sh)} units {'right' if sh > 0 else 'left'}"
        wr = [(f"A reflection across the $y$-axis and a horizontal translation {abs(sh)} units {'right' if sh > 0 else 'left'}", "Confuses a reflection across the x-axis with a reflection across the y-axis."), (f"A reflection across the $x$-axis and a horizontal translation {abs(sh)} units {'left' if sh > 0 else 'right'}", "Reverses the direction of the horizontal translation."), (f"A reflection across the $x$-axis and a vertical translation {abs(sh)} units {'down' if sh > 0 else 'up'}", "Treats the shift inside the function as a vertical translation.")]
    else:
        form = f"g(x)=-f(-x)"; key_t = "A reflection across both the $x$-axis and the $y$-axis"
        wr = [("A reflection across the $x$-axis only", "Applies only one of the two reflections."), ("A reflection across the $y$-axis only", "Applies only the reflection inside the function."), ("A reflection across the line $y=x$", "Confuses the combination of reflections with the reflection that produces an inverse.")]
    key, ds = text_options(key_t, "A sign change inside the function reflects across the y-axis; a sign change outside reflects across the x-axis; added constants translate.", wr)
    stem = f"The function $g$ is defined in terms of a function $f$ by ${form}$. Which of the following describes how the graph of $g$ is related to the graph of $f$?"
    return MQ("pre_transform_reflect_describe", "1.12", "2", "not_allowed", stem, key, ds, rng, "Reflections and translations of function graphs", ["Identify whether each change in the formula acts on the input or the output", "Describe the reflection and the translation with their directions"], "image points of two sample points are computed numerically for the transformation", f"The formula ${form}$ corresponds to: {key_t}.", [f"mode={mode}", f"sh={sh}", f"kk={kk}"], est=85)


@retry_sep
def pre_roc_unit_interpretation(rng):
    qty = pick(rng, [("the volume of water in a tank, in liters", "minutes", "liters per minute"), ("the population of a town, in thousands of people", "years", "thousand people per year"), ("the temperature of a cooling drink, in degrees Celsius", "minutes", "degrees Celsius per minute")])
    a, b = pick(rng, [(2, 8), (3, 9), (1, 6)]); r = pick(rng, [-4, -2.5, 3, 5]); unit = qty[2]
    sentence = lambda inc, per, lo, hi: f"Between ${lo}$ and ${hi}$ {qty[1]}, {qty[0].split(',')[0]} {'increased' if inc else 'decreased'} by an average of ${abs(per):g}$ {unit.replace(' per ' + qty[1][:-1], '')} per {qty[1][:-1]}"  # noqa: E731
    inc = r > 0
    phr = lambda inc_, v, lo, hi: f"On average, {qty[0].split(',')[0]} {'increased' if inc_ else 'decreased'} by ${abs(v):g}$ {'' if False else qty[0].split(', in ')[-1] if ', in ' in qty[0] else ''} per {qty[1][:-1]} from time ${lo}$ to time ${hi}$ {qty[1]}"  # noqa: E731
    key_t = phr(inc, r, a, b)
    wr = [(phr(not inc, r, a, b), "Reverses the direction of the change indicated by the sign."), (phr(inc, r * (b - a), a, b), "Reports the rate as the total change over the interval."), (f"At time ${b}$ {qty[1]}, {qty[0].split(',')[0]} was changing at exactly ${abs(r):g}$ {unit}", "Treats the average rate over an interval as the rate at a single instant."), (phr(inc, r, 0, b), "Uses the wrong starting time for the interval.")]
    key, ds = text_options(key_t, "An average rate of change is the change in the quantity per unit of time over the interval; its sign gives the direction.", wr)
    stem = f"Let $A(t)$ be {qty[0]}, at time $t$ {qty[1]}. The average rate of change of $A$ over the interval ${a}\\le t\\le {b}$ is ${r:g}$ {unit}. Which of the following is the best interpretation of this value?"
    del sentence
    return MQ("pre_roc_unit_interpretation", "1.2", "2", "not_allowed", stem, key, ds, rng, "Interpreting an average rate of change with units", ["Attach the units of the rate to the value", "Use the sign for the direction and the interval for the time span"], "recomputation of the average rate from sample endpoint values consistent with the stated rate", f"The value ${r:g}$ means the quantity {'increased' if inc else 'decreased'} on average by ${abs(r):g}$ per time unit over the interval.", [f"a={a}", f"b={b}", f"r={r}"], est=90)


@retry_sep
def pre_quad_model_from_roots(rng):
    for _ in forever():
        r1 = pick(rng, [0, 1, 2]); w = pick(rng, [4, 6, 8, 10]); r2 = r1 + w; h_ = pick(rng, [9, 16, 25, 36])
        a = sp.Rational(-h_, (w / 2) ** 2)
        P = sp.expand(a * (X - r1) * (X - r2))
        if a.q <= 2:
            break
    key_e = a * (X - r1) * (X - r2)
    vtx = (r1 + r2) / 2; agree(float(key_e.subs(X, vtx)), float(h_), 1e-9, "vertex")
    key, ds = expr_options(sp.expand(key_e), [("Uses a positive leading coefficient although the maximum height is positive.", -sp.expand(key_e)), ("Uses the maximum height as the leading coefficient.", sp.expand(h_ * (X - r1) * (X - r2) / -1 if False else -h_ * (X - r1) * (X - r2))), ("Places the vertex at the first zero.", sp.expand(a * (X - r1) ** 2)), ("Uses the wrong leading coefficient: $h/w$.", sp.expand(-sp.Rational(h_, w) * (X - r1) * (X - r2)))])
    stem = f"A ball is thrown so that its height $h(x)$, in feet, is a quadratic function of the horizontal distance $x$, in feet. The ball is at height $0$ when $x={r1}$ and when $x={r2}$, and its maximum height is ${h_}$ feet. Which of the following is an expression for $h(x)$?"
    return MQ("pre_quad_model_from_roots", "1.14", "2", "not_allowed", stem, key, ds, rng, "Construct a quadratic model from its zeros and maximum", ["Write the factored form from the two zeros", "Use the maximum value at the midpoint to find the leading coefficient"], "evaluation of the proposed expression at the midpoint and at both zeros", f"The leading coefficient is ${L(a)}$, so $h(x)={L(a)}(x-{r1})(x-{r2})$.", [f"r1={r1}", f"r2={r2}", f"h={h_}"], est=100)


@retry_sep
def pre_rational_context_asymptote(rng):
    a = pick(rng, [3, 4, 5, 8]); b = pick(rng, [200, 300, 500]); ctx = pick(rng, [("average cost per item, in dollars,", "number of items produced"), ("average speed over a trip, in miles per hour,", "hours traveled")])
    expr = f"\\dfrac{{{a}x+{b}}}{{x}}"
    key, ds = text_options(f"The average cost per item approaches ${a}$ dollars as more items are produced" if "cost" in ctx[0] else f"The average speed approaches ${a}$ miles per hour as the hours traveled grow", "The horizontal asymptote $y=a$ is the long-run value as the input grows without bound.",
                           [(f"The average cost per item approaches ${b}$ dollars as more items are produced" if "cost" in ctx[0] else f"The average speed approaches ${b}$ miles per hour as the hours traveled grow", "Reads the constant term as the long-run value."), (f"The average cost per item approaches $0$ dollars as more items are produced" if "cost" in ctx[0] else "The average speed approaches $0$ miles per hour as the hours traveled grow", "Thinks a rational function with a variable denominator approaches zero."), (f"The average cost per item grows without bound as more items are produced" if "cost" in ctx[0] else "The average speed grows without bound as the hours traveled grow", "Reads the fixed term as growing with the input.")])
    stem = f"The {ctx[0]} is modeled by $C(x)={expr}$, where $x$ is the {ctx[1]}. Which of the following is the best description of the long-run behavior of $C(x)$ as $x$ increases without bound?"
    return MQ("pre_rational_context_asymptote", "1.14", "2", "not_allowed", stem, key, ds, rng, "A horizontal asymptote describes the long-run value of a rational model", ["Divide each term of the numerator by x", "Identify the term that remains as x grows and interpret it in context"], "numerical evaluation of the model at large inputs", f"Rewriting gives ${a}+{b}/x$, which approaches ${a}$.", [f"a={a}", f"b={b}"], est=85)


@retry_sep
def pre_poly_even_odd_expression(rng):
    kind = pick(rng, ["even", "odd", "neither"]); a = pick(rng, [1, 2, 3]); b = pick(rng, [1, 2, 4]); c = pick(rng, [1, 2, 5])
    if kind == "even":
        f = a * X ** 4 - b * X ** 2 + c; why_ = "every term has an even exponent, so f(-x)=f(x)"
    elif kind == "odd":
        f = a * X ** 5 - b * X ** 3 + c * X; why_ = "every term has an odd exponent, so f(-x)=-f(x)"
    else:
        f = a * X ** 4 - b * X ** 3 + c; why_ = "the terms mix even and odd exponents, so f(-x) equals neither f(x) nor -f(x)"
    ans = {"even": "$f$ is even", "odd": "$f$ is odd", "neither": "$f$ is neither even nor odd"}
    fn = sp.lambdify(X, f, "math"); chk = (abs(fn(1.7) - fn(-1.7)) < 1e-9, abs(fn(1.7) + fn(-1.7)) < 1e-9); assert (kind == "even") == chk[0] and (kind == "odd") == chk[1]
    wy = {"even": "Calls the function even by looking only at the highest exponent.", "odd": "Calls the function odd by looking only at the highest exponent.", "neither": "Concludes neither even nor odd without checking f(-x)."}
    key, ds = text_options(ans[kind], f"Evaluate f(-x): {why_}.", [(v, wy[k]) for k, v in ans.items() if k != kind] + [("$f$ is both even and odd", "Thinks that symmetry about the y-axis and the origin can both hold for a nonzero function.")])
    stem = f"The function $f$ is defined by $f(x)={L(f)}$. Which of the following is true?"
    return MQ("pre_poly_even_odd_expression", "1.12", "1", "not_allowed", stem, key, ds, rng, "Even and odd polynomials are identified by the parity of their exponents", ["Substitute -x into the expression", "Compare f(-x) with f(x) and -f(x)"], "numerical evaluation of f at 1.7 and -1.7", f"Since {why_}, $f$ is {kind}.", [f"kind={kind}", f"f={f}"], est=80)


@retry_sep
def pre_quartic_zero_count_calc(rng):
    for _ in forever():
        a = pick(rng, [1, -1]); b = pick(rng, [-4, -2, 2, 4]); c = pick(rng, [-6, -3, 3, 5]); d = pick(rng, [-4, -2, 1, 3]); e = pick(rng, [-8, -4, 2, 6])
        P = a * X ** 4 + b * X ** 3 + c * X ** 2 + d * X + e
        f = sp.lambdify(X, P, "math"); zs = [float(z.real) for z in np.roots([a, b, c, d, e]) if abs(z.imag) < 1e-8]; scan = solve_all(f, -12, 12, 24000)
        if len(zs) == len(scan) and all(abs(z - round(z)) > 0.08 for z in zs):
            break
    n = len(zs)
    key, ds = num_options(float(n), [("Uses the degree of the polynomial as the number of zeros.", 4.0), ("Counts only the positive zeros.", float(sum(1 for z in zs if z > 0)) if sum(1 for z in zs if z > 0) != n else float(n + 1)), ("Counts only the negative zeros.", float(sum(1 for z in zs if z < 0)) if sum(1 for z in zs if z < 0) != n else float(n + 1)), ("Counts one extra turning point as a zero.", float(n + 1)), ("Counts one fewer.", float(max(n - 1, 0)))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. Using a graphing calculator, how many real zeros does $p$ have?"
    return MQ("pre_quartic_zero_count_calc", "1.4", "2", "required", stem, key, ds, rng, "The number of real zeros is read from the graph", ["Graph the polynomial in a window that shows all turning points", "Count the x-intercepts"], "numpy roots with the real parts of near-real roots versus a sign-change scan of the graph", f"The graph crosses the x-axis {n} time(s).", [f"P={P}"], est=95)


@retry_sep
def pre_rational_xint_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3]); b = pick(rng, [-7, -5, -3, 4, 6]); c = pick(rng, [-9, -6, -2, 3, 5]); d = pick(rng, [1, 2]); e = pick(rng, [3, 4, 5])
        N = a * X ** 2 + b * X + c; Dn = d * X ** 2 + e
        zs = sorted(float(z.real) for z in np.roots([a, b, c]) if abs(z.imag) < 1e-9); f = sp.lambdify(X, N / Dn, "math"); sc = solve_all(f, -20, 20, 20000)
        if len(zs) == 2 and len(sc) == 2 and all(abs(u - v) < 1e-6 for u, v in zip(zs, sc)) and all(abs(z - round(z)) > 0.1 for z in zs):
            break
    key, ds = num_options(zs[1], [("Reports the other zero.", zs[0]), ("Reports the $y$-intercept.", c / e), ("Reports the horizontal asymptote.", a / d), ("Reports the sum of the zeros.", zs[0] + zs[1])], tol=0.05)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(N)}}}{{{L(Dn)}}}$. Using a graphing calculator, what is the greater of the two $x$-intercepts of the graph of $f$?"
    return MQ("pre_rational_xint_calc", "1.8", "1", "required", stem, key, ds, rng, "Zeros of a rational function are the zeros of its numerator", ["Graph the function and locate the x-intercepts", "Choose the greater intercept"], "numpy roots of the numerator versus a sign-change scan of f", f"The x-intercepts are about ${zs[0]:.3f}$ and ${zs[1]:.3f}$.", [f"N={N}", f"D={Dn}"], est=90)


@retry_sep
def pre_poly_roc_sign_calc(rng):
    for _ in forever():
        a = pick(rng, [-1, 1]); b = pick(rng, [-3, 3]); c = pick(rng, [-6, 4, 7]); d = pick(rng, [2, 5]); P = a * X ** 3 + b * X ** 2 + c * X + d
        f = sp.lambdify(X, P, "math"); lo = pick(rng, [-2.0, -1.0, 0.0]); hi = lo + pick(rng, [1.0, 2.0, 3.0])
        xs = np.linspace(lo, hi, 401); roc = [(f(v + 1e-3) - f(v - 1e-3)) / 2e-3 for v in xs]
        r = (f(hi) - f(lo)) / (hi - lo)
        if abs(r) > 0.4:
            break
    ex = float(sp.N(sp.Rational(str(f(hi))) - sp.Rational(str(f(lo))), 15)) / (hi - lo)
    agree(r, ex, 1e-6, "roc")
    key, ds = num_options(r, [("Reports the change in outputs without dividing by the length of the interval.", f(hi) - f(lo)), ("Reports the value at the left endpoint.", f(lo)), ("Averages the two output values.", (f(lo) + f(hi)) / 2), ("Uses the reversed order of subtraction in the numerator.", -r)], tol=0.05)
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. Using a calculator, what is the average rate of change of $p$ over the interval ${lo:g}\\le x\\le {hi:g}$?"
    return MQ("pre_poly_roc_sign_calc", "1.4", "1", "required", stem, key, ds, rng, "Average rate of change of a polynomial between two inputs", ["Evaluate the polynomial at both endpoints with a calculator", "Divide the change in output by the change in input"], "floating-point evaluation versus exact rational arithmetic to fifteen digits", f"$\\dfrac{{p({hi:g})-p({lo:g})}}{{{hi - lo:g}}}\\approx{r:.3f}$.", [f"P={P}", f"lo={lo}", f"hi={hi}"], est=85)
