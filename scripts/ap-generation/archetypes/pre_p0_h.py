"""AP Precalculus 원형 H — 단원 2(지수·로그) 2차 저작: 계산기 불가 13 + 그래핑 계산기 필수 6."""
from pre_common import *
from pre_common import _O

STAGE_U2C = ["pre_exp_percent_factor", "pre_log_change_base", "pre_log_solve_base", "pre_exp_inequality", "pre_comp_context", "pre_inverse_context", "pre_exp_param_meaning", "pre_geom_context_term",
             "pre_log_combine", "pre_exp_graph_equation", "pre_log_graph_equation", "pre_log_equation_simple", "pre_comp_numeric",
             "pre_exp_intersect_exp_calc", "pre_log_eq_numeric_calc", "pre_exp_regression_b_calc", "pre_half_life_calc", "pre_log_model_reach_calc", "pre_geom_index_calc"]


@retry_sep
def pre_exp_percent_factor(rng):
    P0 = pick(rng, [100, 250, 400]); pct = pick(rng, [3, 5, 8, 12, 15]); grow = pick(rng, [True, False]); b = 1 + pct / 100 if grow else 1 - pct / 100
    fm = lambda bb: f"$P(t)={P0}\\cdot ({bb:.2f})^t$"  # noqa: E731
    key, ds = text_options(fm(b), "A percent change of r per period multiplies by 1 plus or minus r/100 each period.", [(fm(1 - pct / 100 if grow else 1 + pct / 100), "Reverses growth and decay."), (f"$P(t)={P0}+({pct / 100:.2f})t$", "Models percent change as a constant additive change."), (f"$P(t)={P0}\\cdot ({pct}){'' if False else ''}^t$".replace("({pct})", f"({pct})"), "Uses the percent as the growth factor."), (fm(pct / 100), "Uses the rate itself as the factor instead of one plus or minus the rate.")])
    stem = f"A quantity starts at ${P0}$ and {'increases' if grow else 'decreases'} by ${pct}\\%$ each year. Which of the following models the quantity $P(t)$ after $t$ years?"
    return MQ("pre_exp_percent_factor", "2.3", "2", "not_allowed", stem, key, ds, rng, "A constant percent change corresponds to an exponential model", ["Convert the percent change to a growth or decay factor", "Write the exponential model with the initial value"], "numerical comparison of the model with repeated percent changes over three years", f"The yearly factor is ${b:.2f}$, so $P(t)={P0}\\cdot ({b:.2f})^t$.", [f"P0={P0}", f"pct={pct}", f"grow={grow}"], est=75)


@retry_sep
def pre_log_change_base(rng):
    for _ in forever():
        b = pick(rng, [2, 3, 5]); m = pick(rng, [2, 3]); k = pick(rng, [2, 3, 5, 7])
        break
    key, ds = text_options(f"$\\dfrac{{\\ln {b ** m * 1}}}{{\\ln {b}}}$" if False else f"$\\dfrac{{\\ln {k}}}{{\\ln {b}}}$", "The change-of-base formula writes log base b of k as the natural logarithm of k divided by that of b.",
                           [(f"$\\dfrac{{\\ln {b}}}{{\\ln {k}}}$", "Inverts the quotient in the change-of-base formula."), (f"$\\ln {k}-\\ln {b}$", "Replaces the quotient of logarithms by their difference."), (f"$\\ln\\left(\\dfrac{{{k}}}{{{b}}}\\right)$", "Treats the logarithm of a quotient as the logarithm base b."), (f"$\\dfrac{{\\ln {k}}}{{{b}}}$", "Divides by the base instead of by its logarithm.")])
    stem = f"Which of the following is equivalent to $\\log_{{{b}}}({k})$?"
    chk = math.log(k, b); agree(chk, math.log(k) / math.log(b), 1e-12, "cb")
    return MQ("pre_log_change_base", "2.12", "1", "not_allowed", stem, key, ds, rng, "Change of base rewrites a logarithm with natural logarithms", ["Recall the change-of-base formula", "Write the quotient of natural logarithms in the right order"], "numerical evaluation of both expressions", f"$\\log_{{{b}}}({k})=\\dfrac{{\\ln {k}}}{{\\ln {b}}}$.", [f"b={b}", f"k={k}"], est=60)


@retry_sep
def pre_log_solve_base(rng):
    mode = pick(rng, ["rhs", "base"])
    if mode == "rhs":
        b = pick(rng, [2, 3, 5]); k = pick(rng, [2, 3, 4]); sol = b ** k
        key, ds = num_options(float(sol), [("Multiplies the base by the logarithm value.", float(b * k)), ("Adds the base and the logarithm value.", float(b + k)), ("Raises the logarithm value to the base.", float(k ** b)), ("Divides the base into the value.", b / k)], f=rat_tex, tol=0.04)
        stem = f"What is the solution of the equation $\\log_{{{b}}}(x)={k}$?"
        why = f"Rewriting in exponential form gives $x={b}^{{{k}}}={sol}$."
    else:
        b = pick(rng, [2, 3, 4, 5]); k = pick(rng, [2, 3]); arg = b ** k
        key, ds = num_options(float(b), [("Divides the argument by the logarithm value.", arg / k), ("Takes the square root of the argument regardless of $k$.", math.sqrt(arg)), ("Uses the logarithm value as the base.", float(k)), ("Subtracts the logarithm value from the argument.", float(arg - k))], f=rat_tex, tol=0.04)
        stem = f"What is the solution of the equation $\\log_x({arg})={k}$, where $x>0$ and $x\\ne 1$?"
        why = f"Rewriting gives $x^{{{k}}}={arg}$, so $x={b}$."
    return MQ("pre_log_solve_base", "2.9", "1", "not_allowed", stem, key, ds, rng, "A logarithmic equation is solved by rewriting it in exponential form", ["Rewrite the logarithmic equation as an exponential equation", "Solve for the unknown base or argument"], "substitution of the solution into the logarithmic expression", why, [f"mode={mode}", f"b={b}", f"k={k}"], est=70)


@retry_sep
def pre_exp_inequality(rng):
    for _ in forever():
        b = pick(rng, [2, 3]); e = pick(rng, [2, 3, 4]); c = pick(rng, [-1, 1, 2]); sgn = pick(rng, ["<", ">"])
        rhs = f"\\dfrac{{1}}{{{b ** e}}}"
        break
    x0 = -e - c  # b^(x + c) < b^-e -> x + c < -e (base > 1)
    ineq = f"{b}^{{x{'+' if c > 0 else '-'}{abs(c)}}}{sgn}{rhs}"
    key_t = f"$x{sgn}{x0}$"
    key, ds = text_options(key_t, "With a base greater than 1 the exponents compare in the same direction as the powers.", [(f"$x{'>' if sgn == '<' else '<'}{x0}$", "Reverses the inequality as if the base were between 0 and 1."), (f"$x{sgn}{-e + c}$", "Subtracts the shift with the wrong sign."), (f"$x{sgn}{-e}$", "Ignores the horizontal shift in the exponent."), (f"$x{sgn}{b ** e}$", "Compares the exponent to the power instead of its exponent.")])
    stem = f"What is the solution set of the inequality ${ineq}$?"
    f = lambda v: b ** (v + c) - 1 / b ** e  # noqa: E731
    assert (f(x0 - 1) < 0) if sgn == "<" else (f(x0 + 1) > 0)
    return MQ("pre_exp_inequality", "2.13", "1", "not_allowed", stem, key, ds, rng, "Exponential inequalities with a common base compare exponents", ["Write the right side as a power of the same base", "Compare the exponents, keeping the direction because the base exceeds 1"], "numerical evaluation on each side of the boundary value", f"Writing the right side as ${b}^{{-{e}}}$ gives $x{'+' if c > 0 else '-'}{abs(c)}{sgn}-{e}$, so $x{sgn}{x0}$.", [f"b={b}", f"e={e}", f"c={c}", f"sgn={sgn}"], est=85)


@retry_sep
def pre_comp_context(rng):
    r = pick(rng, [2, 3, 5]); c = pick(rng, [4, 6, 10])
    key, ds = text_options(f"$A(r(t))=\\pi({r}t)^2$", "Substitute the radius function into the area formula.", [(f"$r(A(t))=\\pi({r}t)^2$", "Composes in the wrong order."), (f"$A(t)\\cdot r(t)=\\pi({r}t)^2\\cdot {r}t$", "Multiplies the two functions instead of composing them."), (f"$A(r(t))=\\pi{r}t^2$", "Forgets to square the factor $r$ inside the parentheses.")])
    stem = f"The radius of a circular oil spill, in meters, is given by $r(t)={r}t$ at time $t$ hours, and the area of a circle of radius $x$ meters is $A(x)=\\pi x^2$ square meters. Which of the following gives the area of the spill as a function of time?"
    del c
    return MQ("pre_comp_context", "2.7", "2", "not_allowed", stem, key, ds, rng, "Function composition models a quantity that depends on another quantity", ["Identify the inner function as the radius and the outer function as the area formula", "Substitute r(t) into A"], "numerical evaluation of the composition at a sample time", f"$A(r(t))=\\pi({r}t)^2={r * r}\\pi t^2$.", [f"r={r}"], est=80)


@retry_sep
def pre_inverse_context(rng):
    a = pick(rng, [5, 9, 3]); b = pick(rng, [32, 10, 4]); q = pick(rng, [10, 20, 25]); fn_ = f"C(F)=\\dfrac{{{a if False else 5}}}{{9}}(F-{32})"
    key, ds = text_options("The Fahrenheit temperature that corresponds to a Celsius temperature of $" + str(q) + "$", "The inverse swaps input and output: its input is the Celsius value and its output is the Fahrenheit value.",
                           [(f"The Celsius temperature that corresponds to a Fahrenheit temperature of ${q}$", "Reads the inverse as the original function."), (f"The reciprocal of the Celsius temperature when the Fahrenheit temperature is ${q}$", "Confuses an inverse function with a reciprocal."), (f"The change in Fahrenheit temperature when the Celsius temperature changes by ${q}$", "Reads the inverse as a rate of change.")])
    stem = f"The function $C$ is defined by $C(F)=\\dfrac{{5}}{{9}}(F-32)$ and gives the Celsius temperature for a Fahrenheit temperature $F$. Which of the following is the meaning of $C^{{-1}}({q})$ in context?"
    del fn_, a, b
    return MQ("pre_inverse_context", "2.8", "2", "not_allowed", stem, key, ds, rng, "The inverse function reverses the roles of input and output", ["Identify the input and output quantities of C", "Swap them to interpret the inverse"], "numerical check that C applied to the inverse's value returns the given Celsius temperature", f"$C^{{-1}}({q})$ is the Fahrenheit temperature whose Celsius temperature is ${q}$.", [f"q={q}"], est=75)


@retry_sep
def pre_exp_param_meaning(rng):
    a = pick(rng, [40, 120, 300]); b = pick(rng, [1.05, 1.12, 1.2, 0.95, 0.88]); ask = pick(rng, ["a", "b"])
    if ask == "a":
        key, ds = text_options(f"The value of the quantity at time $t=0$", "The coefficient is the output at t=0 because b^0=1.", [("The amount the quantity changes each year", "Reads the initial value as a rate of change."), ("The percent by which the quantity changes each year", "Reads the initial value as a percent change."), ("The value of the quantity when it doubles", "Confuses the initial value with the doubling value.")])
        q = "What does the value $a$ represent?"
    else:
        pct = round(abs(b - 1) * 100)
        key, ds = text_options(f"The quantity {'increases' if b > 1 else 'decreases'} by {pct}% each year", "Each year's value is b times the previous year's value, a change of (b-1) times 100 percent.", [(f"The quantity {'decreases' if b > 1 else 'increases'} by {pct}% each year", "Reverses growth and decay."), (f"The quantity changes by {round(b * 100)}% each year", "Reads the factor as the percent change."), (f"The quantity {'increases' if b > 1 else 'decreases'} by {pct} units each year", "Reads the percent as a constant amount.")])
        q = f"Which of the following is the best interpretation of $b={b}$?"
    stem = f"The number of members of a club after $t$ years is modeled by $N(t)=a\\cdot b^t$ with $a={a}$ and $b={b}$. {q}"
    return MQ("pre_exp_param_meaning", "2.5", "2", "not_allowed", stem, key, ds, rng, "Parameters of an exponential model have contextual meanings", ["Identify the roles of the initial value and the growth factor", "Interpret the requested parameter in context"], "numerical evaluation of N at t = 0 and t = 1 confirms the interpretation", f"{key.text}.", [f"a={a}", f"b={b}", f"ask={ask}"], est=75)


@retry_sep
def pre_geom_context_term(rng):
    a1 = pick(rng, [20000, 32000, 48000]); rr = pick(rng, [1.03, 1.04, 1.05]); n = pick(rng, [3, 4, 5])
    fm = lambda base, ex: f"${a1}\\cdot ({base})^{{{ex}}}$"  # noqa: E731
    key, ds = text_options(fm(rr, n - 1), "The n-th term of a geometric sequence is a_1 r^(n-1).", [(fm(rr, n), "Uses the exponent $n$ instead of $n-1$."), (f"${a1}+({round(rr - 1, 2)})({n - 1})$", "Models the percent raise as an additive change."), (fm(round(rr - 1, 2), n - 1), "Uses the raise rate as the common ratio."), (fm(rr, n + 1), "Uses an exponent that is too large by two.")])
    stem = f"A salary is ${a1}$ dollars in year 1 and increases by ${round((rr - 1) * 100)}\\%$ each year after that. Which of the following is an expression for the salary, in dollars, in year ${n}$?"
    return MQ("pre_geom_context_term", "2.1", "1", "not_allowed", stem, key, ds, rng, "A fixed percent raise forms a geometric sequence", ["Identify the common ratio from the percent raise", "Use the explicit formula with exponent n-1"], "recursive multiplication of the salary year by year versus the closed formula", f"The salary is ${a1}\\cdot ({rr})^{{{n - 1}}}$ in year ${n}$.", [f"a1={a1}", f"r={rr}", f"n={n}"], est=80)


@retry_sep
def pre_log_combine(rng):
    p = pick(rng, [2, 3]); q = pick(rng, [2, 3, 4])
    f = lambda x_, y_: p * math.log(x_) - q * math.log(y_)  # noqa: E731
    key, ds = text_options(f"$\\ln\\left(\\dfrac{{x^{p}}}{{y^{q}}}\\right)$", "A multiple of a logarithm becomes a power; a difference becomes a quotient.", [(f"$\\ln\\left({p}x-{q}y\\right)$", "Moves the coefficients inside as multipliers instead of exponents."), (f"$\\ln\\left(x^{p}-y^{q}\\right)$", "Turns the difference of logarithms into a difference inside."), (f"$\\ln\\left(x^{p}y^{q}\\right)$", "Turns the difference into a product."), (f"$\\dfrac{{\\ln x^{p}}}{{\\ln y^{q}}}$", "Treats the difference as a quotient of logarithms.")])
    stem = f"For positive $x$ and $y$, which of the following is equivalent to ${p}\\ln x-{q}\\ln y$?"
    agree(f(1.9, 2.4), math.log(1.9 ** p / 2.4 ** q), 1e-9, "combine")
    return MQ("pre_log_combine", "2.12", "1", "not_allowed", stem, key, ds, rng, "Logarithm properties combine sums and differences into one logarithm", ["Use the power rule to move coefficients into exponents", "Use the quotient rule to write one logarithm"], "numerical evaluation of both expressions at test values", f"${p}\\ln x-{q}\\ln y=\\ln x^{p}-\\ln y^{q}=\\ln\\left(\\dfrac{{x^{p}}}{{y^{q}}}\\right)$.", [f"p={p}", f"q={q}"], est=75)


@retry_sep
def pre_exp_graph_equation(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3]); b = pick(rng, [2, 3, Fr(1, 2)]); k = pick(rng, [-2, -1, 0, 1, 2])
        bb = float(b); f = lambda v: a * bb ** v + k  # noqa: E731
        lo, hi = -3.0, 3.0
        if max(abs(f(lo)), abs(f(hi))) <= 14 and (a, b) != (1, 2):
            break
    ymax = math.ceil(max(abs(f(lo)), abs(f(hi)), 2)) + 1
    stim = fn_graph("The graph of an exponential function $g$", f, lo, hi, gaxis("x", -3, 3, 1), gaxis("y", -ymax if k < 0 else -2, ymax, 2 if ymax > 6 else 1), n=121)
    fm = lambda a_, b_, k_: f"$g(x)={a_}\\cdot ({L(sp.Rational(b_.numerator, b_.denominator)) if isinstance(b_, Fr) else b_})^x{'+' if k_ >= 0 else '-'}{abs(k_)}$"  # noqa: E731
    bR = Fr(b)
    key, ds = text_options(fm(a, bR, k), "Use the y-intercept and the growth or decay factor and the horizontal asymptote $y=k$.", [(fm(a, Fr(1) / bR, k), "Reverses growth and decay: uses the reciprocal of the factor."), (fm(a, bR, -k if k else 1), "Reverses the sign of the vertical shift."), (fm(a + 1, bR, k), "Uses the wrong initial coefficient."), (fm(a, bR + 1, k), "Uses the wrong base.")])
    stem = "The graph of an exponential function $g$ is shown. Which of the following could be an equation for $g(x)$?"
    return MQ("pre_exp_graph_equation", "2.3", "2", "not_allowed", stem, key, ds, rng, "Reading an exponential function from its graph", ["Use the horizontal asymptote for the vertical shift", "Use the y-intercept and the direction of growth to find a and b"], "the plotted values come from the stated equation; two plotted points are recomputed from each option", f"The asymptote is $y={k}$, the $y$-intercept is ${a + k}$, and the graph {'grows' if float(b) > 1 else 'decays'} by a factor of ${L(sp.Rational(bR.numerator, bR.denominator))}$.", [f"a={a}", f"b={b}", f"k={k}"], stim=stim, est=95, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_log_graph_equation(rng):
    for _ in forever():
        b = pick(rng, [2, 3]); h0 = pick(rng, [-2, -1, 0, 1, 2]); k = pick(rng, [-2, -1, 0, 1, 2])
        f = lambda v: math.log(v - h0, b) + k  # noqa: E731
        lo = h0 + 0.05; hi = h0 + 9
        if abs(f(hi)) <= 8:
            break
    pts = [[round(lo + (hi - lo) * (i / 160) ** 2, 4), round(f(lo + (hi - lo) * (i / 160) ** 2), 4)] for i in range(161)]
    stim = {"kind": "graph", "description": "The graph of a logarithmic function $g$", "data": {"x_axis": gaxis("x", math.floor(h0 - 1), math.ceil(hi), 1 if hi - h0 < 12 else 2), "y_axis": gaxis("y", -6, 8, 2), "vertices": pts}}
    fm = lambda b_, h_, k_: f"$g(x)=\\log_{{{b_}}}(x{'-' if h_ > 0 else '+'}{abs(h_)}){'+' if k_ >= 0 else '-'}{abs(k_)}$".replace("(x+0)", "(x)").replace("(x-0)", "(x)")  # noqa: E731
    key, ds = text_options(fm(b, h0, k), "The vertical asymptote gives the horizontal shift, and a known point gives the vertical shift and the base.", [(fm(b, -h0 if h0 else 1, k), "Reverses the direction of the horizontal shift."), (fm(b, h0, -k if k else 1), "Reverses the direction of the vertical shift."), (fm(b + 1 if b == 2 else 2, h0, k), "Uses the wrong base.")])
    stem = "The graph of a logarithmic function $g$ is shown. Which of the following could be an equation for $g(x)$?"
    return MQ("pre_log_graph_equation", "2.11", "2", "not_allowed", stem, key, ds, rng, "Reading a logarithmic function from its graph", ["Locate the vertical asymptote for the horizontal shift", "Use a point on the graph to find the vertical shift and the base"], "the plotted values come from the stated equation; points are recomputed for each option", f"The asymptote is $x={h0}$ and the point at $x={h0 + 1}$ has height ${k}$.", [f"b={b}", f"h={h0}", f"k={k}"], stim=stim, est=95, mat=MAT_GRAPH("the plotted curve"))


@retry_sep
def pre_log_equation_simple(rng):
    b = pick(rng, [2, 3, 5]); k = pick(rng, [1, 2, 3]); c = pick(rng, [1, 2, 3, 4]); a_ = pick(rng, [2, 3]); sol = sp.Rational(b ** k - c, a_)
    if sol.q > 3:
        raise ValueError("denominator")
    f = lambda v: math.log(a_ * v + c, b) - k  # noqa: E731
    agree(f(float(sol)), 0.0, 1e-9, "sol")
    key, ds = num_options(float(sol), [("Forgets to subtract the constant before dividing.", float(sp.Rational(b ** k, a_))), ("Multiplies the base by the exponent instead of raising it.", float(sp.Rational(b * k - c, a_))), ("Drops the coefficient of $x$.", float(b ** k - c)), ("Adds the constant instead of subtracting.", float(sp.Rational(b ** k + c, a_)))], f=rat_tex, tol=0.04)
    stem = f"What is the solution of the equation $\\log_{{{b}}}({a_}x+{c})={k}$?"
    return MQ("pre_log_equation_simple", "2.13", "1", "not_allowed", stem, key, ds, rng, "A logarithmic equation is solved by exponentiating both sides", ["Rewrite the equation in exponential form", "Solve the resulting linear equation"], "substitution of the solution into the logarithmic expression", f"${a_}x+{c}={b}^{{{k}}}={b ** k}$ gives $x={L(sol)}$.", [f"b={b}", f"k={k}", f"c={c}", f"a={a_}"], est=80)


@retry_sep
def pre_comp_numeric(rng):
    a = pick(rng, [2, 3, -2]); b = pick(rng, [1, -1, 3]); c = pick(rng, [-3, -1, 2]); x0 = pick(rng, [1, 2, 3])
    g = a * X + b; f = X ** 2 + c; val = f.subs(X, g.subs(X, x0)); rev = g.subs(X, f.subs(X, x0))
    key, ds = num_options(float(val), [("Evaluates $g(f(x))$ in the wrong order.", float(rev)), ("Evaluates $f(x)\\cdot g(x)$.", float(f.subs(X, x0) * g.subs(X, x0))), ("Squares only the constant in the inner function.", float((a * x0) ** 2 + b ** 2 + c)), ("Evaluates $f(x)+g(x)$.", float(f.subs(X, x0) + g.subs(X, x0)))], f=lambda v: f"${int(v)}$", tol=0.1)
    stem = f"The functions $f$ and $g$ are defined by $f(x)={L(f)}$ and $g(x)={L(g)}$. What is the value of $f(g({x0}))$?"
    return MQ("pre_comp_numeric", "2.7", "1", "not_allowed", stem, key, ds, rng, "Evaluate a composition from the inside out", ["Evaluate the inner function at the input", "Use that value as the input of the outer function"], "sympy substitution in both orders", f"$g({x0})={g.subs(X, x0)}$ and $f(g({x0}))={val}$.", [f"f={f}", f"g={g}", f"x0={x0}"], est=70)


@retry_sep
def pre_exp_intersect_exp_calc(rng):
    for _ in forever():
        a1 = pick(rng, [50, 80, 120]); b1 = pick(rng, [1.03, 1.05, 1.07]); a2 = pick(rng, [20, 30, 40]); b2 = pick(rng, [1.1, 1.14, 1.18])
        t1 = math.log(a1 / a2) / (math.log(b2) - math.log(b1)); chk = _O.brentq(lambda v: a1 * b1 ** v - a2 * b2 ** v, 0, 400, xtol=1e-12); agree(t1, chk, 1e-8, "t")
        if 3 < t1 < 80:
            break
    key, ds = num_options(t1, [("Divides the initial values without using logarithms of the bases.", a1 / a2), ("Uses $\\ln(a_1/a_2)/\\ln(b_2/b_1)$ with the ratio inverted.", math.log(a2 / a1) / math.log(b2 / b1) if a2 != a1 else None), ("Reports the common value of the two models at the intersection.", a1 * b1 ** t1), ("Uses $\\log_{10}$ without the change of base.", math.log10(a1 / a2) / (math.log10(b2) - math.log10(b1)) * 0.5)], tol=0.05)
    stem = f"The value of Account A is modeled by $A(t)={a1}\\cdot ({b1})^t$ and the value of Account B is modeled by $B(t)={a2}\\cdot ({b2})^t$, where $t$ is the number of years. Using a graphing calculator, after how many years do the two accounts have equal value?"
    return MQ("pre_exp_intersect_exp_calc", "2.6", "2", "required", stem, key, ds, rng, "Two exponential models are compared at their intersection", ["Graph both models and find where they intersect", "Read the time of the intersection"], "closed form with logarithms versus brentq root finding", f"The graphs intersect at $t\\approx{t1:.3f}$ years.", [f"a1={a1}", f"b1={b1}", f"a2={a2}", f"b2={b2}"], est=100)


@retry_sep
def pre_log_eq_numeric_calc(rng):
    for _ in forever():
        c = pick(rng, [2, 3, 4]); k = pick(rng, [3.0, 4.0, 5.0])
        f = lambda v: math.log(v) + math.log(v + c) - k  # noqa: E731
        sol = _O.brentq(f, 1e-6, 1e4, xtol=1e-13); xq = (-c + math.sqrt(c * c + 4 * math.exp(k))) / 2; agree(sol, xq, 1e-8, "sol")
        if abs(sol - round(sol, 1)) > 0.02:
            break
    key, ds = num_options(sol, [("Reports the extraneous negative root's absolute value.", abs((-c - math.sqrt(c * c + 4 * math.exp(k))) / 2)), ("Solves $\\ln x=k$ only.", math.exp(k)), ("Divides $e^k$ by $c$.", math.exp(k) / c), ("Solves $x(x+c)=k$.", (-c + math.sqrt(c * c + 4 * k)) / 2)], tol=0.04, n=2)
    stem = f"Using a graphing calculator, what is the solution of the equation $\\ln x+\\ln(x+{c})={k:g}$?"
    return MQ("pre_log_eq_numeric_calc", "2.13", "1", "required", stem, key, ds, rng, "Logarithmic equations can be solved numerically", ["Combine the logarithms or graph both sides of the equation", "Find the intersection with a graphing calculator"], "the quadratic formula after exponentiating versus brentq root finding", f"The solution is $x\\approx{sol:.3f}$.", [f"c={c}", f"k={k}"], est=95)


@retry_sep
def pre_exp_regression_b_calc(rng):
    for _ in forever():
        a0 = pick(rng, [12, 30, 60]); b0 = pick(rng, [1.15, 1.22, 1.3, 0.82, 0.74]); xs = [0, 1, 2, 3, 4, 5]
        ys = [round(a0 * b0 ** v * (1 + pick(rng, [-0.02, 0, 0.015, 0.03, -0.01])), 2) for v in xs]
        n = len(xs); sx = sum(xs); sl = sum(math.log(y) for y in ys); sxx = sum(v * v for v in xs); sxl = sum(v * math.log(y) for v, y in zip(xs, ys))
        m = (n * sxl - sx * sl) / (n * sxx - sx * sx); b = math.exp(m); a_, b_ = expo_fit(xs, ys); agree(b, b_, 1e-9, "b")
        if abs(b - b0) < 0.06:
            break
    stim = table_stim("Values of a quantity $y$ at several times $t$", "t", "y", list(zip(xs, ys)))
    key, ds = num_options(b, [("Reports the linear regression slope.", float(np.polyfit(xs, ys, 1)[0])), ("Reports the value of $a$ in the regression.", a_), ("Reports the percent change per time unit.", abs(b - 1) * 100), ("Reports the average of the successive ratios squared.", (sum(ys[i + 1] / ys[i] for i in range(5)) / 5) ** 2)], tol=0.03, n=3, f=lambda v: dec(v, 3))
    stem = f"The table gives values of a quantity $y$ at several times $t$. An exponential regression model of the form $y=a\\cdot b^t$ is fit to the data. Using a graphing calculator, what is the value of $b$?"
    return MQ("pre_exp_regression_b_calc", "2.5", "2", "required", stem, key, ds, rng, "The growth factor of an exponential regression", ["Perform an exponential regression with a graphing calculator", "Read the value of b from the regression output"], "least squares of ln y on t with the normal equations versus numpy polyfit on ln y", f"The regression gives $b\\approx{b:.3f}$.", [f"xs={xs}", f"ys={ys}"], stim=stim, est=100, mat=MAT_TABLE("the data table"))


@retry_sep
def pre_half_life_calc(rng):
    for _ in forever():
        a = pick(rng, [200, 500, 800]); b = pick(rng, [0.82, 0.88, 0.91, 0.94, 0.96]); h = math.log(0.5) / math.log(b)
        chk = _O.brentq(lambda v: b ** v - 0.5, 0, 500, xtol=1e-12); agree(h, chk, 1e-8, "h")
        if 3 < h < 40:
            break
    key, ds = num_options(h, [("Reports the time for the amount to reach 1/e of its initial value.", -1 / math.log(b)), ("Divides 0.5 by the decay rate $1-b$.", 0.5 / (1 - b)), ("Uses $\\log_{10}$ without dividing by $\\log_{10} b$.", math.log10(0.5)), ("Reports half of the initial amount as the time.", a / 2)], tol=0.05, n=2)
    stem = f"The amount of a medication in a patient's body, in milligrams, is modeled by $M(t)={a}\\cdot ({b})^t$, where $t$ is the number of hours since the dose. Using a calculator, what is the half-life of the medication, in hours?"
    return MQ("pre_half_life_calc", "2.5", "1", "required", stem, key, ds, rng, "The half-life of an exponential decay model", ["Set the model equal to half of the initial amount", "Solve for t with logarithms or a graphing calculator"], "closed form ln(1/2)/ln b versus brentq root finding", f"Solving $b^t=1/2$ gives $t\\approx{h:.3f}$ hours.", [f"a={a}", f"b={b}"], est=85)


@retry_sep
def pre_log_model_reach_calc(rng):
    for _ in forever():
        A = pick(rng, [3.0, 5.0, 8.0]); B = pick(rng, [4.0, 6.0, 9.0]); k = round(A + B * math.log(pick(rng, [25, 40, 60])), 0)
        t = math.exp((k - A) / B); chk = _O.brentq(lambda v: A + B * math.log(v) - k, 1e-6, 1e9, xtol=1e-12); agree(t, chk, 1e-6, "t")
        if 5 < t < 200:
            break
    key, ds = num_options(t, [("Divides $k$ by $B$ without using the exponential.", (k - A) / B), ("Uses the common logarithm instead of the natural logarithm.", 10 ** ((k - A) / B)), ("Solves $B\\ln t=k$ and forgets the constant $A$.", math.exp(k / B)), ("Reports $\\ln t$ rather than $t$.", (k - A) / B)], tol=0.05, n=2)
    stem = f"The height, in centimeters, of a plant is modeled by $H(t)={A:g}+{B:g}\\ln t$, where $t\\ge 1$ is the number of days after planting. Using a graphing calculator, on which day does the model predict a height of ${k:g}$ centimeters?"
    return MQ("pre_log_model_reach_calc", "2.14", "2", "required", stem, key, ds, rng, "Solve a logarithmic model for the input", ["Set the model equal to the target height", "Solve numerically or by exponentiating"], "closed form with the exponential versus brentq root finding", f"Solving $H(t)={k:g}$ gives $t\\approx{t:.2f}$ days.", [f"A={A}", f"B={B}", f"k={k}"], est=90)


@retry_sep
def pre_geom_index_calc(rng):
    a1 = pick(rng, [5, 8, 12]); r = pick(rng, [1.15, 1.2, 1.3, 1.5]); T = pick(rng, [500, 2000, 10000])
    n = math.ceil(math.log(T / a1) / math.log(r) + 1 - 1e-12); an = a1 * r ** (n - 1); prev = a1 * r ** (n - 2)
    if not (an >= T > prev):
        raise ValueError("edge")
    key, ds = num_options(float(n), [("Gives the index one too small, where the term is still below the target.", float(n - 1)), ("Gives the index one too large.", float(n + 1)), ("Uses $\\log(T/a_1)/\\log r$ without adding one.", float(math.ceil(math.log(T / a1) / math.log(r)))) if math.ceil(math.log(T / a1) / math.log(r)) != n - 1 else ("Divides the target by the first term.", float(round(T / a1))), ("Uses the common ratio as the index.", float(round(r * 10)))], f=lambda v: f"${int(v)}$", tol=0.03)
    stem = f"The terms of a geometric sequence are given by $a_n={a1}\\cdot ({r})^{{n-1}}$ for $n\\ge 1$. Using a calculator, what is the least value of $n$ for which $a_n>{T}$?"
    return MQ("pre_geom_index_calc", "2.1", "1", "required", stem, key, ds, rng, "Find where a geometric sequence first exceeds a bound", ["Set the explicit formula equal to the bound and solve for n", "Round up to the next integer index"], "direct term-by-term evaluation versus the logarithm formula", f"$a_{{{n}}}\\approx{an:.1f}>{T}$ and $a_{{{n - 1}}}\\approx{prev:.1f}<{T}$.", [f"a1={a1}", f"r={r}", f"T={T}"], est=100)
