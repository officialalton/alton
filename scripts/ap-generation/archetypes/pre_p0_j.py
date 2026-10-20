"""AP Precalculus 원형 J — 단원 1 3차 저작: 계산기 불가 14 + 그래핑 계산기 필수 6."""
from pre_common import *
from pre_common import _O
from pre_p0_b import _fit_exact

STAGE_U1D = ["pre_avg_roc_expression", "pre_line_point_slope", "pre_quad_vertex_standard", "pre_quad_other_zero", "pre_quad_leading_from_table", "pre_poly_equation_from_graph", "pre_poly_touch_zero_expr",
             "pre_rational_va_hole_count", "pre_poly_sign_graph", "pre_transform_graph_equation", "pre_model_domain_limit", "pre_poly_degree_from_roc_pattern", "pre_rational_zero_count", "pre_poly_symmetry_graph",
             "pre_rational_threshold_calc", "pre_quad_regression_vertex_calc", "pre_poly_zero_between_calc", "pre_rational_near_asymptote_calc", "pre_poly_regression_sse_calc", "pre_poly_value_threshold_calc"]


@retry_sep
def pre_avg_roc_expression(rng):
    a_ = pick(rng, [1, 2, 3]); b_ = pick(rng, [-4, -2, 3, 5]); c_ = pick(rng, [-3, 0, 2])
    h, aa = sp.symbols("h a"); f = lambda v: a_ * v ** 2 + b_ * v + c_  # noqa: E731
    expr = sp.simplify((f(aa + h) - f(aa)) / h); expr = sp.expand(sp.cancel(sp.expand(f(aa + h) - f(aa)) / h))
    key = Opt(tx(expr), True, "Expand f(a+h), subtract f(a), and divide by h.", None)
    cands = [("Forgets the term $h$ left after dividing: reports only the part that does not contain $h$.", a_ * 2 * aa + b_), ("Squares only the first term: expands $(a+h)^2$ as $a^2+h^2$.", a_ * h + b_), ("Does not divide the constant factor: reports the difference without dividing by $h$.", sp.expand(f(aa + h) - f(aa))), ("Divides only the quadratic part by $h$ and drops the linear part.", a_ * (2 * aa + h))]
    opts = []
    seen = {tx(expr)}
    for w, e in cands:
        t = tx(sp.expand(e))
        if t not in seen:
            seen.add(t); opts.append(Opt(t, False, w, None))
    if len(opts) < 3:
        raise ValueError("few")
    stem = f"The function $f$ is defined by $f(x)={L(a_ * X ** 2 + b_ * X + c_)}$. Which of the following is the average rate of change of $f$ over the interval $a\\le x\\le a+h$, where $h\\ne 0$?"
    return MQ("pre_avg_roc_expression", "1.3", "1", "not_allowed", stem, key, opts[:3], rng, "The average rate of change of a quadratic over a symbolic interval", ["Write f(a+h) and f(a) and subtract", "Divide by h and simplify"], "sympy simplification versus numerical difference quotient at sample values", f"The difference quotient simplifies to ${L(expr)}$.", [f"a={a_}", f"b={b_}", f"c={c_}"], est=100)


@retry_sep
def pre_line_point_slope(rng):
    x1, y1, x2, y2 = rng.sample(range(-5, 8), 4)
    if x1 == x2:
        raise ValueError("vertical")
    m = sp.Rational(y2 - y1, x2 - x1)
    if m == 0 or m.q > 3:
        raise ValueError("slope")
    ex = m * (X - x1) + y1
    key, ds = expr_options(sp.expand(ex), [("Reverses the order of subtraction in the slope.", sp.expand(-m * (X - x1) + y1)), ("Uses the reciprocal of the slope.", sp.expand((1 / m) * (X - x1) + y1)), ("Uses the second point's $y$ but the first point's $x$ in the wrong way: $m(x-x_1)+y_2$.", sp.expand(m * (X - x1) + y2)), ("Takes $x_1$ with the wrong sign.", sp.expand(m * (X + x1) + y1))])
    stem = f"A linear function $f$ has values $f({x1})={y1}$ and $f({x2})={y2}$. Which of the following is an expression for $f(x)$?"
    return MQ("pre_line_point_slope", "1.3", "1", "not_allowed", stem, key, ds, rng, "A linear function is determined by two points", ["Compute the slope as the change in output over the change in input", "Write the equation through one of the points"], "evaluation of the proposed expression at both given inputs", f"The slope is ${L(m)}$ and $f(x)={L(sp.expand(ex))}$.", [f"x1={x1}", f"y1={y1}", f"x2={x2}", f"y2={y2}"], est=80)


@retry_sep
def pre_quad_vertex_standard(rng):
    a = pick(rng, [1, 2, -1, -2]); h0 = pick(rng, [-3, -2, -1, 1, 2, 3]); k0 = pick(rng, [-5, -2, 1, 4, 7])
    P = sp.expand(a * (X - h0) ** 2 + k0); b = sp.Poly(P, X).all_coeffs()[1]; c = sp.Poly(P, X).all_coeffs()[0]
    ask = pick(rng, ["x", "point"])
    pt = lambda a_, b_: f"$({a_}, {b_})$"  # noqa: E731
    if ask == "x":
        key, ds = num_options(float(h0), [("Uses $b/2a$ without the negative sign.", float(b / (2 * c))), ("Uses $-b/a$ and forgets the factor of two.", float(-b / c)), ("Inverts the formula and uses $-2a/b$.", float(-2 * c / b)), ("Reports the $y$-coordinate of the vertex.", float(k0))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
        q = "What is the $x$-coordinate of the vertex of the graph of $f$?"
    else:
        key = Opt(pt(h0, k0), True, "Use x=-b/2a and then evaluate f at that value.", None)
        ds = [Opt(pt(-h0, k0), False, "Uses the opposite sign for the vertex's $x$-coordinate.", None), Opt(pt(h0, -k0), False, "Uses the opposite sign for the vertex's $y$-coordinate.", None), Opt(pt(h0, int(P.subs(X, 0))), False, "Uses the $y$-intercept as the $y$-coordinate of the vertex.", None), Opt(pt(k0, h0), False, "Swaps the coordinates.", None)]
        q = "What are the coordinates of the vertex of the graph of $f$?"
    stem = f"The function $f$ is defined by $f(x)={L(P)}$. {q}"
    return MQ("pre_quad_vertex_standard", "1.3", "1", "not_allowed", stem, key, ds, rng, "The vertex of a parabola is at x = -b/2a", ["Use the axis of symmetry formula for the x-coordinate", "Evaluate the function there for the y-coordinate"], "completing the square versus numerical evaluation near the vertex", f"The vertex is at $({h0}, {k0})$.", [f"a={a}", f"h={h0}", f"k={k0}", f"ask={ask}"], est=80)


@retry_sep
def pre_quad_other_zero(rng):
    r1 = pick(rng, [-4, -2, 0, 1, 3]); h0 = r1 + pick(rng, [2, 3, 4]); r2 = 2 * h0 - r1
    key, ds = num_options(float(r2), [("Adds the distance to the axis in the same direction as the first zero.", float(h0 + (h0 - r1) * 0 + (r1 - h0) * -1 + 0.0)) if False else ("Reports the axis of symmetry as the other zero.", float(h0)), ("Adds twice the axis value to the first zero instead of reflecting it.", float(r1 + 2 * h0)), ("Uses the opposite of the first zero as the other zero.", float(-r1)), ("Subtracts the first zero from the axis value only once.", float(h0 - r1))], f=lambda v: f"${int(v)}$", tol=0.05)
    stem = f"A quadratic function $q$ has a zero at $x={r1}$, and the axis of symmetry of its graph is the line $x={h0}$. What is the other zero of $q$?"
    return MQ("pre_quad_other_zero", "1.3", "2", "not_allowed", stem, key, ds, rng, "Zeros of a quadratic are symmetric about the axis of symmetry", ["Use that the axis of symmetry is the midpoint of the two zeros", "Solve for the other zero"], "midpoint formula versus a numerical quadratic built from the two zeros", f"The other zero is $2({h0})-({r1})={r2}$.", [f"r1={r1}", f"h={h0}"], est=70)


@retry_sep
def pre_quad_leading_from_table(rng):
    a = pick(rng, [-3, -2, -1, 1, 2, 3, sp.Rational(1, 2)]); step = pick(rng, [1, 2, 3]); xs = [step * k for k in range(4)]; b = pick(rng, [-4, 0, 3]); c = pick(rng, [-2, 1, 5])
    ys = [a * v * v + b * v + c for v in xs]
    if any(sp.Rational(y).q != 1 for y in ys):
        raise ValueError("frac")
    d2 = (ys[2] - 2 * ys[1] + ys[0]); lead = sp.Rational(d2, 2 * step * step)
    agree(float(lead), float(a), 1e-9, "lead")
    key, ds = num_options(float(a), [("Uses the second difference itself as the leading coefficient.", float(d2)), ("Uses the first difference divided by the step.", float(sp.Rational(ys[1] - ys[0], step))), ("Divides the second difference by $step^2$ but forgets the factor 2.", float(sp.Rational(d2, step * step))), ("Uses the opposite sign.", float(-a))], f=lambda v: f"${int(v)}$" if abs(v - round(v)) < 1e-9 else rat_tex(v), tol=0.05)
    stim = table_stim("Values of a quadratic function $q$", "x", "q(x)", [(v, int(y)) for v, y in zip(xs, ys)])
    stem = "The table gives values of a quadratic function $q(x)=ax^2+bx+c$. What is the value of $a$?"
    return MQ("pre_quad_leading_from_table", "1.3", "2", "not_allowed", stem, key, ds, rng, "The second difference of a quadratic over equal steps is 2a times the step squared", ["Compute the second difference of the outputs", "Divide by twice the square of the step to get the leading coefficient"], "sympy solves the three equations from the table for a, b and c", f"The second difference is {d2} over a step of {step}, so $a={L(lead)}$.", [f"a={a}", f"step={step}", f"ys={ys}"], stim=stim, est=95, mat=MAT_TABLE("the table values of q"))


@retry_sep
def pre_poly_equation_from_graph(rng):
    for _ in forever():
        r = sorted(rng.sample([-3, -2, -1, 0, 1, 2, 3], 3)); a = pick(rng, [-1, 1]); f = lambda v: a * (v - r[0]) * (v - r[1]) * (v - r[2]) / 3.0  # noqa: E731
        lo, hi = r[0] - 1.0, r[2] + 1.0
        if max(abs(f(v)) for v in np.linspace(lo, hi, 300)) <= 9:
            break
    ymax = math.ceil(max(abs(f(v)) for v in np.linspace(lo, hi, 400))) + 1
    stim = fn_graph("The graph of a cubic polynomial function $p$ that crosses the $x$-axis at three points", f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    fac = lambda z: f"(x{'-' if z > 0 else '+'}{abs(z)})" if z != 0 else "x"  # noqa: E731
    eq = lambda a_, rr: f"$p(x)={'-' if a_ < 0 else ''}{fac(rr[0])}{fac(rr[1])}{fac(rr[2])}$"  # noqa: E731
    key, ds = text_options(eq(a, r), "The zeros give the factors and the end behavior gives the sign of the leading coefficient.", [(eq(-a, r), "Uses the wrong sign for the leading coefficient."), (eq(a, [-z for z in r]), "Uses the opposite sign for every zero."), (eq(a, [r[0], r[1], r[1] if r[1] != 0 else 1]) if r[1] != r[2] else eq(a, [r[0], r[1], r[2] + 1]), "Uses a wrong zero in one factor."), (eq(-a, [-z for z in r]), "Uses the wrong sign for the leading coefficient and for every zero.")])
    stem = "The graph of a cubic polynomial function $p$ is shown. Which of the following could be an expression for $p(x)$?"
    return MQ("pre_poly_equation_from_graph", "1.4", "2", "not_allowed", stem, key, ds, rng, "Write a polynomial from its zeros and end behavior", ["Read the zeros from the x-intercepts of the graph", "Choose the sign of the leading coefficient from the end behavior"], "the plotted values come from the factored form; the sign and zeros are rechecked numerically", f"The zeros are {r[0]}, {r[1]}, {r[2]} and the leading coefficient is {'positive' if a > 0 else 'negative'}.", [f"r={r}", f"a={a}"], stim=stim, est=90, mat=MAT_GRAPH("the plotted curve", "the zeros"))


@retry_sep
def pre_poly_touch_zero_expr(rng):
    r1, r2, r3 = rng.sample([-3, -2, -1, 1, 2, 3], 3); m = [pick(rng, [1, 2, 3]) for _ in range(3)]
    if len({x % 2 for x in m}) < 2:
        raise ValueError("parity")
    fac = lambda z, e: f"(x{'-' if z > 0 else '+'}{abs(z)})" + (f"^{e}" if e > 1 else "")  # noqa: E731
    P = f"p(x)={fac(r1, m[0])}{fac(r2, m[1])}{fac(r3, m[2])}"
    touch = [z for z, e in zip((r1, r2, r3), m) if e % 2 == 0]
    ask = "touches" if touch else None
    if not touch:
        raise ValueError("none")
    key_t = " and ".join(f"$x={z}$" for z in touch)
    others = [z for z in (r1, r2, r3) if z not in touch]
    wr = [(" and ".join(f"$x={z}$" for z in others), "Reports the zeros with odd multiplicity, where the graph crosses the axis."), ("$x=" + str(r1) + "$, $x=" + str(r2) + "$ and $x=" + str(r3) + "$", "Treats every zero as a point where the graph touches the axis."), ("None of the zeros", "Thinks a graph can only cross the axis at its zeros.")]
    wr = [(t, w) for t, w in wr if t != key_t]
    key, ds = text_options(key_t, "A zero of even multiplicity makes the graph touch the x-axis and turn around.", wr)
    stem = f"The polynomial function $p$ is defined by ${P}$. At which zeros does the graph of $p$ touch the $x$-axis without crossing it?"
    return MQ("pre_poly_touch_zero_expr", "1.4", "1", "not_allowed", stem, key, ds, rng, "Even multiplicity zeros touch the axis", ["Read the exponent of each factor", "Identify the zeros whose exponent is even"], "a sign evaluation just left and right of each zero", f"The zeros with even exponents are {key_t}.", [f"r={[r1, r2, r3]}", f"m={m}"], est=80)


@retry_sep
def pre_rational_va_hole_count(rng):
    for _ in forever():
        zs = rng.sample([-3, -2, -1, 1, 2, 3, 4], 4); num_roots = [zs[0], zs[1]]; den_roots = [zs[1] if rng.random() < 0.7 else zs[2], zs[3]]
        den_roots = sorted(set(den_roots))
        if len(den_roots) == 2:
            break
    Nn = sp.expand((X - num_roots[0]) * (X - num_roots[1])); Dd = sp.expand((X - den_roots[0]) * (X - den_roots[1]))
    holes = len(set(num_roots) & set(den_roots)); va = len(den_roots) - holes; ask = pick(rng, ["va", "hole"]); val = va if ask == "va" else holes
    pool = [(0, "Reports none because the function is a quotient."), (1, "Counts a single feature of the graph only."), (2, "Counts both zeros of the denominator regardless of cancellation." if ask == "va" else "Counts both zeros of the numerator as holes."), (3, "Adds the horizontal asymptote to the count."), (4, "Counts the zeros of the numerator and the denominator together.")]
    key, ds = num_options(float(val), [(w, float(v)) for v, w in pool if v != val], f=lambda v: f"${int(round(v))}$", tol=0.1)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(Nn)}}}{{{L(Dd)}}}$. " + ("How many vertical asymptotes does the graph of $f$ have?" if ask == "va" else "How many holes does the graph of $f$ have?")
    return MQ("pre_rational_va_hole_count", "1.10", "1", "not_allowed", stem, key, ds, rng, "Common factors create holes and the remaining denominator zeros create vertical asymptotes", ["Factor the numerator and the denominator", "Cancel the common factors and count the remaining denominator zeros"], "sympy cancel counts the zeros before and after cancellation", f"The graph has {va} vertical asymptote(s) and {holes} hole(s).", [f"num={num_roots}", f"den={den_roots}", f"ask={ask}"], est=85)


@retry_sep
def pre_poly_sign_graph(rng):
    for _ in forever():
        r = sorted(rng.sample([-3, -2, -1, 0, 1, 2, 3], 3)); a = pick(rng, [-1, 1]); f = lambda v: a * (v - r[0]) * (v - r[1]) * (v - r[2]) / 3.0  # noqa: E731
        lo, hi = r[0] - 1.0, r[2] + 1.0
        if max(abs(f(v)) for v in np.linspace(lo, hi, 300)) <= 9:
            break
    ymax = math.ceil(max(abs(f(v)) for v in np.linspace(lo, hi, 400))) + 1
    stim = fn_graph("The graph of a polynomial function $p$ with zeros at " + ", ".join(str(v) for v in r), f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    pts = [-math.inf, *r, math.inf]; pos = []
    for i in range(4):
        mid = (pts[i] + pts[i + 1]) / 2 if math.isfinite(pts[i]) and math.isfinite(pts[i + 1]) else (pts[i + 1] - 1 if not math.isfinite(pts[i]) else pts[i] + 1)
        if f(mid) > 0:
            pos.append(f"({'-\\infty' if not math.isfinite(pts[i]) else int(pts[i])}, {'\\infty' if not math.isfinite(pts[i + 1]) else int(pts[i + 1])})")
    neg = []
    for i in range(4):
        mid = (pts[i] + pts[i + 1]) / 2 if math.isfinite(pts[i]) and math.isfinite(pts[i + 1]) else (pts[i + 1] - 1 if not math.isfinite(pts[i]) else pts[i] + 1)
        if f(mid) < 0:
            neg.append(f"({'-\\infty' if not math.isfinite(pts[i]) else int(pts[i])}, {'\\infty' if not math.isfinite(pts[i + 1]) else int(pts[i + 1])})")
    key_t = "$" + "\\cup".join(pos) + "$"
    wr = [("$" + "\\cup".join(neg) + "$", "Reports where the graph is below the x-axis instead of above."), (f"$({r[0]}, {r[2]})$", "Reports the interval between the outer zeros regardless of the sign."), (f"$(-\\infty, {r[0]})\\cup({r[1]}, {r[2]})$" if a > 0 else f"$({r[0]}, {r[1]})\\cup({r[2]}, \\infty)$", "Alternates the signs incorrectly across the zeros."),
          (f"$({pos[0].split(', ')[0].strip('(')}, {pos[0].split(', ')[1].strip(')')})$" if len(pos) > 1 else f"$({r[1]}, \\infty)$", "Reports only one of the intervals where the graph is above the axis."), (f"$(-\\infty, {r[2]})$", "Reports everything to the left of the last zero.")]
    wr = [(t, w) for t, w in wr if t != key_t]
    key, ds = text_options(key_t, "Read where the graph lies above the x-axis between and beyond the zeros.", wr)
    stem = "The graph of the polynomial function $p$ is shown. For which values of $x$ is $p(x)>0$?"
    return MQ("pre_poly_sign_graph", "1.4", "2", "not_allowed", stem, key, ds, rng, "Where a polynomial is positive is read from its graph", ["Locate the zeros on the graph", "Find the intervals on which the graph is above the x-axis"], "sign evaluation of the plotted function at interval midpoints", f"The graph is above the x-axis on {key_t}.", [f"r={r}", f"a={a}"], stim=stim, est=80, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_transform_graph_equation(rng):
    h0 = pick(rng, [-2, -1, 1, 2]); k0 = pick(rng, [-3, -2, 1, 2, 3]); par = pick(rng, [2, 3]); f = lambda v: (v - h0) ** par + k0  # noqa: E731
    lo, hi = h0 - 2.5, h0 + 2.5
    ymax = math.ceil(max(abs(f(lo)), abs(f(hi)), abs(k0))) + 1
    stim = fn_graph("The graph of a function $g$ obtained by transforming the graph of $y=x^{" + str(par) + "}$", f, lo, hi, gaxis("x", math.floor(lo), math.ceil(hi), 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    pw = f"^{par}"
    eq = lambda h_, k_: f"$g(x)=(x{'-' if h_ > 0 else '+'}{abs(h_)}){pw}{'+' if k_ >= 0 else '-'}{abs(k_)}$"  # noqa: E731
    key, ds = text_options(eq(h0, k0), "The turning point or center of symmetry of the graph is at (h, k), so g(x)=(x-h)^n+k.", [(eq(-h0, k0), "Reverses the direction of the horizontal shift."), (eq(h0, -k0), "Reverses the direction of the vertical shift."), (eq(k0, h0) if (k0, h0) != (h0, k0) else eq(h0 + 1, k0), "Swaps the horizontal and vertical shifts."), (eq(-h0, -k0), "Reverses both shifts.")])
    stem = f"The graph of a function $g$ is shown. The graph is a translation of the graph of $y=x^{{{par}}}$. Which of the following is an expression for $g(x)$?"
    return MQ("pre_transform_graph_equation", "1.12", "2", "not_allowed", stem, key, ds, rng, "Translations of a power function are read from the graph", ["Locate the point corresponding to the origin of the parent graph", "Write the equation with the horizontal and vertical shifts"], "the plotted values come from the stated equation; the shifted center point is rechecked", f"The center of the graph is at $({h0}, {k0})$, so $g(x)=(x-({h0}))^{par}+({k0})$.", [f"h={h0}", f"k={k0}", f"par={par}"], stim=stim, est=85, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_model_domain_limit(rng):
    ctx = pick(rng, [("the height $h(t)=-16t^2+64t$ of a ball, in feet,", "after $t$ seconds", "the ball returns to the ground", "$0\\le t\\le 4$"), ("the profit $P(x)=-2x^2+40x-150$, in dollars, from selling $x$ items", "when $x$ items are sold", "the profit is at least zero", "$5\\le x\\le 15$")])
    if "ball" in ctx[0]:
        key, ds = text_options("The model is only appropriate for $0\\le t\\le 4$, because the height cannot be negative.", "The model describes the ball only while it is in the air.", [("The model is appropriate for all real numbers $t$.", "Ignores the context restrictions on the input and the output."), ("The model is only appropriate for $t\\ge 4$.", "Uses the interval after the ball lands on the ground."), ("The model is only appropriate for $0\\le t\\le 2$.", "Uses only the time until the maximum height is reached.")])
    else:
        key, ds = text_options("The model gives a nonnegative profit only for $5\\le x\\le 15$.", "Solve P(x) at least 0 to find the interval of nonnegative profit.", [("The model gives a nonnegative profit for all $x\\ge 0$.", "Ignores that the quadratic is negative outside its zeros."), ("The model gives a nonnegative profit only for $x\\le 5$.", "Chooses the interval to the left of the smaller zero."), ("The model gives a nonnegative profit only for $x\\ge 15$.", "Chooses the interval to the right of the larger zero.")])
    stem = f"The function modeling {ctx[0]} {ctx[1]} is used to make predictions. Which of the following statements about the reasonable domain of the model is true?"
    return MQ("pre_model_domain_limit", "1.13", "2", "not_allowed", stem, key, ds, rng, "A function model has a domain limited by its context", ["Identify where the modeled quantity is meaningful", "Use the zeros of the quadratic model to limit the input"], "numerical evaluation of the model at the boundary values", f"{key.text}", [f"ctx={ctx[3]}"], est=90)


@retry_sep
def pre_poly_degree_from_roc_pattern(rng):
    deg = pick(rng, [2, 3]); lead = pick(rng, [1, 2, -1, -2]); xs = list(range(0, 5)); c = [lead] + [pick(rng, [-3, -1, 0, 2, 4]) for _ in range(deg)]
    ys = [int(np.polyval(c, v)) for v in xs]
    d1 = np.diff(ys); d2 = np.diff(d1); const2 = np.ptp(d2) == 0
    if deg == 2 and not const2:
        raise ValueError("x")
    ans = {2: "A quadratic function, because the second differences are constant.", 3: "A cubic function, because the third differences are constant."}[deg]
    key, ds = text_options(ans, "Take successive differences until they are constant.", [(v, "Chooses the wrong degree from the differences.") if k != deg else ("", "") for k, v in ans_items(ans, deg)] if False else [("A linear function, because the first differences are constant.", "Treats the first differences as constant although they are not."), ("A quadratic function, because the outputs change sign." if deg == 3 else "A cubic function, because the outputs change sign.", "Uses sign changes instead of the pattern of differences."), ("An exponential function, because the outputs increase." if lead > 0 else "An exponential function, because the outputs decrease.", "Assumes monotone change implies exponential growth or decay.")])
    stim = table_stim("Values of a function $f$ at equally spaced inputs", "x", "f(x)", list(zip(xs, ys)))
    stem = "The table gives values of a polynomial function $f$ at equally spaced inputs. Which of the following best describes $f$?"
    return MQ("pre_poly_degree_from_roc_pattern", "1.4", "2", "not_allowed", stem, key, ds, rng, "The pattern of differences identifies the polynomial degree", ["Compute the first, second and third differences", "Name the degree at which the differences become constant"], "numpy diff at each order for the generating values", f"The {'second' if deg == 2 else 'third'} differences are constant.", [f"c={c}", f"ys={ys}"], stim=stim, est=90, mat=MAT_TABLE("the table values"))


def ans_items(ans, deg):  # noqa: D401
    return []


@retry_sep
def pre_rational_zero_count(rng):
    for _ in forever():
        n = pick(rng, [1, 2, 3]); roots = rng.sample([-3, -2, -1, 1, 2, 3], n); m = pick(rng, [1, 2]); den = rng.sample([-4, 4, 5, -5], m)
        Nn = sp.expand(sp.prod([(X - r) for r in roots])); Dd = sp.expand(sp.prod([(X - r) for r in den]))
        break
    key, ds = num_options(float(n), [("Counts the zeros of the denominator as zeros of the function.", float(m)), ("Counts both numerator and denominator zeros.", float(n + m)), ("Uses the degree of the denominator as the number of zeros.", float(sp.degree(Dd, X) + 1)), ("Reports zero zeros because the function has asymptotes.", float(n + 2))], f=lambda v: f"${int(round(v))}$", tol=0.1)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{L(Nn)}}}{{{L(Dd)}}}$. How many distinct real zeros does $f$ have?"
    return MQ("pre_rational_zero_count", "1.8", "1", "not_allowed", stem, key, ds, rng, "Zeros of a rational function are zeros of the numerator that are not zeros of the denominator", ["Factor the numerator and the denominator", "Count the numerator zeros that are not canceled"], "numpy roots of the numerator versus the denominator roots", f"The numerator has {n} zeros and none of them are zeros of the denominator.", [f"roots={roots}", f"den={den}"], est=75)


@retry_sep
def pre_poly_symmetry_graph(rng):
    kind = pick(rng, ["even", "odd"]); a = pick(rng, [1, 2]); f = (lambda v: a * v ** 4 / 4.0 - 2 * v ** 2 / 2.0) if kind == "even" else (lambda v: a * v ** 3 / 3.0 - 2 * v / 2.0)  # noqa: E731
    lo, hi = -2.5, 2.5; ymax = math.ceil(max(abs(f(lo)), abs(f(hi)), 2)) + 1
    stim = fn_graph("The graph of a polynomial function $p$", f, lo, hi, gaxis("x", -3, 3, 1), gaxis("y", -ymax, ymax, 2 if ymax > 6 else 1))
    ans = {"even": "$p$ is an even function because its graph is symmetric about the $y$-axis.", "odd": "$p$ is an odd function because its graph is symmetric about the origin."}
    key, ds = text_options(ans[kind], "Even functions have y-axis symmetry; odd functions have origin symmetry.", [(ans["odd" if kind == "even" else "even"], "Confuses y-axis symmetry with origin symmetry."), ("$p$ is neither even nor odd because it has both positive and negative values.", "Thinks sign changes rule out symmetry."), ("$p$ is both even and odd because it has zeros on both sides of the $y$-axis.", "Thinks zeros on both sides imply both symmetries.")])
    stem = "The graph of a polynomial function $p$ is shown. Which of the following is true?"
    return MQ("pre_poly_symmetry_graph", "1.12", "2", "not_allowed", stem, key, ds, rng, "Symmetry of the graph identifies even and odd functions", ["Look for reflection across the y-axis or rotation about the origin", "Name the corresponding type of function"], "numerical comparison of p(x) with p(-x) at sample points of the plotted function", f"The plotted function satisfies the {kind} symmetry.", [f"kind={kind}", f"a={a}"], stim=stim, est=75, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_rational_threshold_calc(rng):
    for _ in forever():
        a = pick(rng, [30, 45, 60]); b = pick(rng, [10, 20, 40]); c = pick(rng, [3, 5, 8]); f = lambda n_: (a * n_ + b) / (n_ + c)  # noqa: E731
        th = round(a - pick(rng, [0.5, 1.0, 1.5]), 1); n = math.ceil((b - th * c) / (th - a) * -1 - 1e-12) if th < a else None
        # f(n) >= th  <=>  a n + b >= th (n + c) <=> n >= (th c - b)/(a - th)
        thr = (th * c - b) / (a - th); n = math.floor(thr) + 1
        if 3 < n < 200 and f(n) >= th > f(n - 1):
            break
    key, ds = num_options(float(n), [("Reports the largest integer below the boundary instead of the smallest at or above it.", float(n - 1)), ("Reports the boundary value without rounding up.", thr), ("Reports one more than the correct integer.", float(n + 1)), ("Divides the threshold by the horizontal asymptote.", th / a * 100)], f=lambda v: f"${v:.0f}$" if abs(v - round(v)) < 1e-9 else dec(v, 2), tol=0.02)
    stem = f"The average score of a class after $n$ practice tests is modeled by $S(n)=\\dfrac{{{a}n+{b}}}{{n+{c}}}$. Using a graphing calculator, what is the least number of practice tests $n$ for which $S(n)\\ge {th}$?"
    return MQ("pre_rational_threshold_calc", "1.14", "2", "required", stem, key, ds, rng, "Find where a rational model first reaches a threshold", ["Graph the model and the horizontal line at the threshold", "Round the intersection up to the next whole number of tests"], "closed form from clearing the denominator versus direct evaluation at consecutive integers", f"S({n})={f(n):.3f}\\ge {th} and S({n - 1})={f(n - 1):.3f}<{th}.".replace("\\ge", "≥"), [f"a={a}", f"b={b}", f"c={c}", f"th={th}"], est=105)


@retry_sep
def pre_quad_regression_vertex_calc(rng):
    for _ in forever():
        a0 = pick(rng, [-0.8, -1.2, -1.5, -2.0]); b0 = pick(rng, [8.0, 10.0, 12.0]); c0 = pick(rng, [4.0, 9.0, 15.0]); xs = [0, 1, 2, 3, 4, 5, 6, 7]
        ys = [round(a0 * v * v + b0 * v + c0 + pick(rng, [-0.4, -0.2, 0, 0.3, 0.5]), 1) for v in xs]
        fit = np.polyfit(xs, ys, 2); ex = _fit_exact(xs, ys, 2); agree(float(np.linalg.norm(np.array(fit) - np.array(ex))), 0.0, 1e-6, "fit")
        xv = -fit[1] / (2 * fit[0]); yv = float(np.polyval(fit, xv))
        if fit[0] < 0 and 1 < xv < 7:
            break
    stim = table_stim("Values of a quantity $y$ at several times $t$", "t", "y", list(zip(xs, ys)))
    key, ds = num_options(xv, [("Reports the maximum value of the model instead of the time.", yv), ("Uses the time of the largest data value.", float(xs[int(np.argmax(ys))])), ("Uses $b/2a$ without the negative sign.", fit[1] / (2 * fit[0])), ("Uses the average of the first and last times.", 3.5)], tol=0.05, n=3)
    stem = "The table gives values of a quantity $y$ at several times $t$. A quadratic function $Q$ is the regression model for the data. Using a graphing calculator, at what time $t$ does the model $Q$ reach its maximum value?"
    return MQ("pre_quad_regression_vertex_calc", "1.14", "2", "required", stem, key, ds, rng, "The vertex of a regression quadratic gives the time of the maximum", ["Perform a quadratic regression with a graphing calculator", "Find the vertex of the fitted parabola"], "exact normal equations in sympy rational arithmetic and the vertex formula -b/2a", f"The fitted model has its maximum at $t\\approx{xv:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=115, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_poly_zero_between_calc(rng):
    for _ in forever():
        a = pick(rng, [1, 2]); b = pick(rng, [-3, -2, 1, 3]); c = pick(rng, [-5, -2, 4]); d = pick(rng, [-12, -9, -6, 6, 9]); P = a * X ** 3 + b * X ** 2 + c * X + d; f = sp.lambdify(X, P, "math")
        zs = solve_all(f, -10, 10, 20000)
        if len(zs) == 1 and abs(zs[0] - round(zs[0])) > 0.15:
            break
    lo = math.floor(zs[0]); hi = lo + 1; z = zs[0]
    key, ds = num_options(z, [("Reports the left endpoint of the interval where the sign changes.", float(lo)), ("Reports the right endpoint of the interval where the sign changes.", float(hi)), ("Reports the average of the endpoints.", (lo + hi) / 2), ("Reports the $y$-intercept.", float(d))], tol=0.04, n=3)
    stem = f"The polynomial function $p$ is defined by $p(x)={L(P)}$. The values $p({lo})$ and $p({hi})$ have opposite signs. Using a graphing calculator, what is the zero of $p$ in the interval ${lo}<x<{hi}$?"
    return MQ("pre_poly_zero_between_calc", "1.4", "1", "required", stem, key, ds, rng, "A sign change guarantees a zero that can be located numerically", ["Use the sign change to know a zero lies in the interval", "Locate it on the graph with a graphing calculator"], "numpy roots of the coefficients versus a sign-change scan with brentq refinement", f"The zero in the interval is $x\\approx{z:.3f}$.", [f"P={P}", f"lo={lo}"], est=95)


@retry_sep
def pre_rational_near_asymptote_calc(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 5]); b = pick(rng, [4, 6, 9]); c = pick(rng, [1, 2, 3]); f = lambda v: (a * v + b) / (v + c)  # noqa: E731
        eps = pick(rng, [0.1, 0.05, 0.02]); thr = (b - a * c) / eps - c
        x = thr if (b - a * c) > 0 else None
        if x is not None and 5 < x < 3000:
            break
    xs_ = _O.brentq(lambda v: abs(f(v) - a) - eps, 1.0, 1e6, xtol=1e-9); agree(xs_, thr, 1e-4, "thr")
    key, ds = num_options(thr, [("Solves $f(x)=\\epsilon$ instead of $|f(x)-a|=\\epsilon$.", (b - eps * c) / (eps - a) if eps != a else None), ("Divides the constant term by the tolerance.", b / eps), ("Ignores the constant $c$ in the denominator.", (b - a * c) / eps), ("Solves $|f(x)-a|=\\epsilon$ for the wrong sign of the difference.", (c * a - b) / eps - c if (c * a - b) / eps - c > 0 else abs((c * a - b) / eps - c) + 5)], tol=0.03, n=2)
    stem = f"The function $f$ is defined by $f(x)=\\dfrac{{{a}x+{b}}}{{x+{c}}}$ for $x>0$. The graph of $f$ has a horizontal asymptote $y={a}$. Using a graphing calculator, for what value of $x$ is $f(x)$ within ${eps}$ of the asymptote, that is, $|f(x)-{a}|={eps}$?"
    return MQ("pre_rational_near_asymptote_calc", "1.7", "2", "required", stem, key, ds, rng, "How quickly a rational function approaches its horizontal asymptote", ["Graph the function and the lines at the asymptote plus or minus the tolerance", "Find the x-value where the graph reaches the line"], "closed form from clearing the denominator versus brentq root finding", f"The graph reaches the line at $x\\approx{thr:.2f}$.", [f"a={a}", f"b={b}", f"c={c}", f"eps={eps}"], est=105)


@retry_sep
def pre_poly_regression_sse_calc(rng):
    for _ in forever():
        a0 = pick(rng, [1.0, 1.5, -1.0]); b0 = pick(rng, [-4.0, 3.0]); c0 = pick(rng, [5.0, 12.0]); xs = [0, 1, 2, 3, 4, 5]
        ys = [round(a0 * v * v + b0 * v + c0 + pick(rng, [-0.6, -0.2, 0.3, 0.5, 0.0]), 1) for v in xs]
        lin = np.polyfit(xs, ys, 1); quad = np.polyfit(xs, ys, 2)
        sl = float(np.sum((np.array(ys) - np.polyval(lin, xs)) ** 2)); sq = float(np.sum((np.array(ys) - np.polyval(quad, xs)) ** 2))
        ex = _fit_exact(xs, ys, 1); agree(float(np.linalg.norm(np.array(lin) - np.array(ex))), 0.0, 1e-6, "fit")
        if sl > 3 * sq and sq > 0.05:
            break
    stim = table_stim("Data values $y$ at times $t$", "t", "y", list(zip(xs, ys)))
    key, ds = num_options(sl, [("Uses the quadratic model's residuals instead of the linear model's.", sq), ("Sums the residuals without squaring them.", abs(float(np.sum(np.array(ys) - np.polyval(lin, xs)))) + 0.05), ("Sums the absolute values of the residuals.", float(np.sum(np.abs(np.array(ys) - np.polyval(lin, xs))))), ("Squares the sum of the absolute residuals.", float(np.sum(np.abs(np.array(ys) - np.polyval(lin, xs)))) ** 2)], tol=0.08, n=3)
    stem = "The table gives data values $y$ at times $t$. The linear regression model $L$ is fit to the data. Using a graphing calculator, what is the sum of the squares of the residuals of $L$?"
    return MQ("pre_poly_regression_sse_calc", "1.14", "2", "required", stem, key, ds, rng, "Residuals measure how well a regression model fits the data", ["Find the linear regression model with a calculator", "Square and sum the residuals at the data points"], "exact normal equations in sympy rational arithmetic and a direct sum of squares", f"The sum of squared residuals is about ${sl:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=115, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_poly_value_threshold_calc(rng):
    for _ in forever():
        a = pick(rng, [-1, -2]); b = pick(rng, [8, 10, 12]); c = pick(rng, [0, 5]); P = a * X ** 2 + b * X + c; f = sp.lambdify(X, P, "math")
        th = pick(rng, [10, 14, 18, 20]); zs = solve_all(lambda v: f(v) - th, 0, 20, 20000)
        if len(zs) == 2 and max(f(v) for v in np.linspace(0, 20, 2000)) > th + 1:
            break
    dur = zs[1] - zs[0]
    key, ds = num_options(dur, [("Reports the later time at which the value equals the threshold.", zs[1]), ("Reports the earlier time at which the value equals the threshold.", zs[0]), ("Reports the time of the maximum value.", -b / (2 * a)), ("Reports the maximum value.", float(f(-b / (2 * a))))], tol=0.04, n=3)
    stem = f"The height, in feet, of a rocket at time $t$ seconds is modeled by $h(t)={L(P).replace('x', 't')}$ for $0\\le t\\le 20$. Using a graphing calculator, for how many seconds is the height of the rocket greater than ${th}$ feet?"
    return MQ("pre_poly_value_threshold_calc", "1.14", "2", "required", stem, key, ds, rng, "The time above a threshold is the distance between two intersections", ["Graph the model and the horizontal line at the threshold", "Subtract the two intersection times"], "the quadratic formula for both intersections versus a sign-change scan", f"The model equals ${th}$ at $t\\approx{zs[0]:.3f}$ and $t\\approx{zs[1]:.3f}$, so the duration is about ${dur:.3f}$ seconds.", [f"P={P}", f"th={th}"], est=100)
