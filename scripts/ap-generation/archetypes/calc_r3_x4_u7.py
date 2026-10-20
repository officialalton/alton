"""BC4·BC5 확대 라운드(2026-10-19) 단원 6·7·8 의 BC 전용 새 원형: 자율 미분방정식 그래프(오일러·극한), 로지스틱 최대 증가율, 오일러 표로 미분방정식 찾기,
이상적분 수렴 고르기, 로그 부분적분 정적분, 호의 길이(정확값). 학생에게 보이는 모든 문장은 실제 수치와 $...$ 수식으로 쓴다."""
from calc_r3_x4_lib import *
from fractions import Fraction as Fr

XS9 = list(range(0, 9))


def W(text, why):
    return Opt(text, False, why, None)


# 7.5 자율 미분방정식 dy/dt = f(y) 의 오일러 방법(f 는 그래프)
def g_x4_euler_autonomous_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 9, -3, 3)
        y0 = rng.randint(1, 6)
        y1 = y0 + v[y0]
        if 0 <= y1 <= 8:
            y2 = y1 + v[y1]
            if len({y2, y1, y1 + v[y0], y0 + 2 * v[y1], v[y1], y0}) >= 5 and y2 not in (y1, y0):
                break
    f = PL(XS9, v)
    yy = float(y0)
    for _ in range(2):  # 독립 경로: 보간 그래프로 오일러 두 번 실행
        yy = yy + f.num(yy)
    if abs(yy - y2) > 1e-9:
        raise ValueError("independent_check_failed")
    cands = [(f"Stops after one step and reports $y_1={y1}$.", y1), (f"Uses the slope at $y={y0}$ again in the second step: $y_1+f({y0})$.", y1 + v[y0]), (f"Adds twice the second slope to the starting value: $y_0+2f(y_1)$.", y0 + 2 * v[y1]),
             (f"Reports the slope $f(y_1)={v[y1]}$ read from the graph instead of the approximation of $y(2)$.", v[y1]), (f"Reports the starting value $y(0)={y0}$.", y0)]
    ds = [Opt(fx(z), False, w, z) for w, z in cands if z != y2]
    stem = f"Let $y$ be the solution of $\\dfrac{{dy}}{{dt}}=f(y)$ with $y(0)={y0}$, where the graph of $f$ is shown for $0\\le y\\le 8$ and consists of line segments. Euler's method with two steps of size $1$, starting at $t=0$, is used to approximate $y(2)$. What is the approximation?"
    bpr = bpb("g_x4_euler_autonomous_graph", "7.5", "1.E", "not_allowed", "Apply Euler's method to an autonomous differential equation whose right side is given by a graph in y",
              ["Read f(y0) from the graph and compute y1 = y0 + 1 * f(y0)", "Read f(y1) at the new y-value and compute y2 = y1 + 1 * f(y1)"],
              [("the slope used in each step is f evaluated at the current y-value", "the differential equation does not depend on t")],
              [("one_step_only", "stops after the first step"), ("stale_slope", "reuses the first slope"), ("double_second_slope", "doubles the second slope"), ("slope_not_value", "reports a slope"), ("start_value", "reports the initial value")],
              "Euler iteration repeated with the interpolated graph function (independent of reading integer vertices)", {"type": "graph", "must_include": ["vertices of f at y = 0, 1, ..., 8"]})
    lo, hi = min(min(v), 0) - 1, max(max(v), 0) + 1
    key = Opt(fx(y2), True, f"$y_1=y_0+1\\cdot f({y0})={y0}+({v[y0]})={y1}$ and $y_2=y_1+1\\cdot f({y1})={y1}+({v[y1]})={y2}$.", y2)
    return gpack("g_x4_euler_autonomous_graph", "7.5", "1.E", "not_allowed", stem, key, ds, rng,
                 gstim("Graph of the function f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], axis("y", 0, 8, 1), axis("f(y)", lo, hi, 1)), bpr, 95, [f"v={v}", f"y0={y0}"])


# 7.9 자율 미분방정식의 극한값: dy/dt = f(y) 그래프의 영점과 부호
def g_x4_autonomous_limit_graph(rng):
    xs = XS9
    for _ in forever():
        p = rng.choice([1, 2, 3, 4])
        q = rng.choice([u for u in (4, 5, 6, 7) if u - p >= 2])
        pos_between = rng.choice([True, False])
        s = 1 if pos_between else -1
        v = []
        for y_ in xs:
            if y_ in (p, q):
                v.append(0)
            elif p < y_ < q:
                v.append(s * rng.randint(1, 3))
            else:
                v.append(-s * rng.randint(1, 3))
        y0 = rng.choice([u for u in range(1, 8) if u != p and u != q])
        # 극한값: pos_between → 안정 평형은 q, y0 > p 이어야 한다. 아니면 안정 평형은 p, y0 < q 이어야 한다
        if pos_between and y0 > p:
            key = q
        elif (not pos_between) and y0 < q:
            key = p
        else:
            continue
        break
    f = PL(xs, v)
    yy, dt = float(y0), 0.001  # 독립 경로: 작은 보폭 오일러로 t = 400 까지
    for _ in range(400000):
        yy += dt * f.num(min(8.0, max(0.0, yy)))
    if abs(yy - key) > 0.02:
        raise ValueError("independent_check_failed")
    other = q if key == p else p
    ymax_ = [i for i in range(9) if v[i] == max(v)][0]; ymin_ = [i for i in range(9) if v[i] == min(v)][0]
    cands = [(f"Reports the equilibrium $y={other}$, which is the other equilibrium: the solution moves away from it.", other), (f"Reports the starting value $y(0)={y0}$, but $f({y0})\\ne0$ so the solution is not constant.", y0),
             (f"Reports the value $y={ymax_}$ where the graph of $f$ is highest, which is where $y$ changes fastest, not where it settles.", ymax_), (f"Reports the value $y={ymin_}$ where the graph of $f$ is lowest, which is where $y$ decreases fastest, not where it settles.", ymin_),
             ("Reports $y=0$, the left end of the graph, which is not an equilibrium.", 0), ("Reports $y=8$, the right end of the graph, which is not an equilibrium.", 8)]
    ds, seen = [], {f"${key}$"}
    for w, z in cands:
        tx = f"${z}$"
        if tx not in seen:
            seen.add(tx); ds.append(W(tx, w))
    if len(ds) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"Let $y$ be the solution of $\\dfrac{{dy}}{{dt}}=f(y)$ with $y(0)={y0}$, where the graph of $f$ is shown for $0\\le y\\le 8$ and consists of line segments. What is $\\displaystyle\\lim_{{t\\to\\infty}}y(t)$?"
    bpr = bpb("g_x4_autonomous_limit_graph", "7.9", "2.D", "not_allowed", "Find the long-term behavior of an autonomous equation from the sign of f: equilibria are zeros of f, and y moves toward a stable one",
              ["Find the zeros of f (equilibrium values)", "Determine the sign of f on each side of the starting value to see whether y increases or decreases", "Identify the equilibrium that y approaches"],
              [("y increases where f > 0 and decreases where f < 0", "y stays within the plotted domain 0 <= y <= 8 for the given starting value")],
              [("other_equilibrium", "reports the unstable equilibrium"), ("initial_value", "reports the starting value"), ("not_an_equilibrium", "reports a value where f is not 0"), ("infinite_limit", "claims unbounded growth")],
              "small-step Euler integration of the interpolated f from the starting value to t = 400 (independent of reading signs from the graph)", {"type": "graph", "must_include": ["vertices of f at y = 0, 2, 4, 6, 8"]})
    why = f"The zeros of $f$ are $y={p}$ and $y={q}$. For $y_0={y0}$ the solution moves toward $y={key}$ because $f$ is {'positive' if (key > y0) else 'negative'} between $y={y0}$ and $y={key}$, so $\\lim y(t)={key}$."
    lo, hi = min(min(v), 0) - 1, max(max(v), 0) + 1
    return gpack("g_x4_autonomous_limit_graph", "7.9", "2.D", "not_allowed", stem, Opt(f"${key}$", True, why, key), ds, rng,
                 gstim("Graph of the function f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], axis("y", 0, 8, 1), axis("f(y)", lo, hi, 1)), bpr, 100, [f"v={v}", f"y0={y0}", f"key={key}"])


# 7.9 로지스틱 모형의 최대 증가율: dP/dt = r P (1 - P/K) 의 최댓값 r K / 4
def c_x4_logistic_max_rate(rng):
    r = rng.choice([Fr(1, 5), Fr(1, 4), Fr(2, 5), Fr(3, 10), Fr(1, 2)])
    K = rng.choice([200, 400, 600, 800])
    key = r * K / 4
    best = max(float(r) * (K * i / 20000) * (1 - i / 20000) for i in range(20001))
    if abs(best - float(key)) > 1e-3:
        raise ValueError("independent_check_failed")
    t = lambda v: "$" + sp.latex(sp.Rational(v.numerator, v.denominator)) + "$"
    ds = vopts([(f"Reports $rK={r * K}$, which leaves out the factor $\\dfrac14$ from $P\\left(1-\\dfrac{{P}}{{K}}\\right)$ at $P=\\dfrac{{K}}{{2}}$.", r * K), (f"Reports the population $P=\\dfrac{{K}}{{2}}={K // 2}$ at which the growth rate is greatest, not the growth rate itself.", Fr(K, 2)),
                (f"Reports $\\dfrac{{rK}}{{2}}={r * K / 2}$, using $\\left(1-\\dfrac{{P}}{{K}}\\right)=\\dfrac12$ but forgetting $P=\\dfrac{{K}}{{2}}$ is also a factor $\\dfrac12$.", r * K / 2), (f"Reports the carrying capacity ${K}$.", Fr(K))], key, t)
    rt = sp.latex(sp.Rational(r.numerator, r.denominator))
    stem = f"The population $P(t)$ of fish in a lake, in hundreds of fish, satisfies the logistic differential equation $\\dfrac{{dP}}{{dt}}={rt}P\\left(1-\\dfrac{{P}}{{{K}}}\\right)$, where $t$ is measured in years. What is the greatest value of $\\dfrac{{dP}}{{dt}}$ over all $P$ with $0<P<{K}$?"
    bpr = bpb("c_x4_logistic_max_rate", "7.9", "1.E", "not_allowed", "Find the maximum growth rate of a logistic model: dP/dt as a function of P is a parabola with its vertex at P = K/2",
              ["View dP/dt as a function of P", "Find the vertex of the parabola at P = K/2", "Evaluate dP/dt there"],
              [("dP/dt = rP(1 - P/K) is a downward parabola in P", "its maximum is at the vertex P = K/2")],
              [("missing_quarter", "reports r times K"), ("population_not_rate", "reports the population P = K/2"), ("missing_half", "reports rK/2"), ("carrying_capacity", "reports the carrying capacity")],
              "a 20001-point grid search of r P (1 - P/K) over 0 < P < K (independent of the vertex formula)")
    why = f"As a function of $P$, $\\dfrac{{dP}}{{dt}}={rt}P\\left(1-\\dfrac{{P}}{{{K}}}\\right)$ is a downward parabola with vertex at $P=\\dfrac{{{K}}}{{2}}={K // 2}$, where $\\dfrac{{dP}}{{dt}}={rt}\\cdot{K // 2}\\cdot\\dfrac12={t(key).strip('$')}$."
    return finish("c_x4_logistic_max_rate", "7.9", "1.E", "not_allowed", stem, t(key), why, key, ds, rng, bpr, 95, [f"r={r},K={K}", f"key={key}"])


# 7.5 오일러 표로 미분방정식 찾기: 첫 단계는 모두 같고 둘째 단계부터 다르다
def c_x4_euler_table_de(rng):
    y0 = rng.choice([1, 2, 3])
    lib = [("x+y", lambda x_, y_: x_ + y_, "\\dfrac{dy}{dx}=x+y"), ("y", lambda x_, y_: y_, "\\dfrac{dy}{dx}=y"), (f"y^2/{y0}", lambda x_, y_: Fr(y_ * y_, y0), f"\\dfrac{{dy}}{{dx}}=\\dfrac{{y^2}}{{{y0}}}"),
           (f"xy+{y0}", lambda x_, y_: x_ * y_ + y0, f"\\dfrac{{dy}}{{dx}}=xy+{y0}"), ("2x+y", lambda x_, y_: 2 * x_ + y_, "\\dfrac{dy}{dx}=2x+y"), ("x^2+y", lambda x_, y_: x_ * x_ + y_, "\\dfrac{dy}{dx}=x^2+y"),
           (f"x+{y0}", lambda x_, y_: x_ + y0, f"\\dfrac{{dy}}{{dx}}=x+{y0}"), ("x(y)+y", lambda x_, y_: x_ * y_ + y_, "\\dfrac{dy}{dx}=xy+y")]
    def run(fn):
        ys = [Fr(y0)]
        for i in range(3):
            ys.append(ys[-1] + fn(i, ys[-1]))
        return ys
    tables = [run(fn) for _, fn, _ in lib]
    for _ in forever():
        ki = rng.randrange(len(lib))
        others = [j for j in range(len(lib)) if j != ki and tables[j][1] == tables[ki][1] and tables[j][2] != tables[ki][2]]
        if len(others) >= 3 and all(tables[ki][i] == int(tables[ki][i]) for i in range(4)):
            break
    chosen = rng.sample(others, 3)
    key_ys = tables[ki]
    # 독립 경로: 선택지마다 표의 둘째 값부터 다시 계산해 키만 표 전체와 일치함을 확인
    for j in chosen:
        if tables[j] == key_ys:
            raise ValueError("independent_check_failed")
    rows = [(i, i, int(key_ys[i])) for i in range(4)]
    key_t = f"$" + lib[ki][2] + "$"
    ds = [W("$" + lib[j][2] + "$", f"Gives the same first step ($y_1={tables[j][1]}$) but the second step is $y_2={tables[j][2]}$, not ${int(key_ys[2])}$.") for j in chosen]
    stem = f"Euler's method with step size $1$ is applied to a differential equation $\\dfrac{{dy}}{{dx}}=F(x,y)$ with the initial condition $y(0)={y0}$. The table shows the values $x_n$ and the approximations $y_n$ for $n=0,1,2,3$. Which of the following could be the differential equation?"
    bpr = bpb("c_x4_euler_table_de", "7.5", "2.C", "not_allowed", "Identify the differential equation from the iterates of Euler's method: test each candidate with y_(n+1) = y_n + h F(x_n, y_n)",
              ["Compute the first Euler step for a candidate and compare with y_1", "Compute the second step for the candidates that match, using the point (x_1, y_1)", "Choose the equation matching every row"],
              [("each Euler iterate is y_n + h F(x_n, y_n)", "all candidates give the same y_1, so y_2 decides")],
              [("same_first_step", "matches y_1 only"), ("later_step_mismatch", "fails at the second step"), ("wrong_dependence", "wrong dependence on x or y")],
              "each candidate equation is iterated exactly three times with rational arithmetic and compared with the table (independent of testing by inspection)", {"type": "table", "must_include": ["n = 0..3", "x_n", "y_n"]})
    why = f"Every candidate gives $y_1=y_0+1\\cdot F(0,{y0})={int(key_ys[1])}$, so test the second step. For ${lib[ki][2]}$, $y_2={int(key_ys[1])}+F(1,{int(key_ys[1])})={int(key_ys[2])}$ and $y_3={int(key_ys[3])}$, matching the table; each other equation gives a different $y_2$."
    return finish("c_x4_euler_table_de", "7.5", "2.C", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 120, [f"y0={y0}", f"key={lib[ki][0]}", f"ys={[str(z) for z in key_ys]}"],
                  stim=tab_multi("Euler's method approximations", ["n", "x_n", "y_n"], rows))


# 6.13 이상적분: 수렴하는 것을 고르기(하나만 수렴)
def c_x4_improper_converges_choice(rng):
    frames = []
    # (유형, 지수 p) 유형: "inf" = ∫_1^∞ x^{-p}, "zero" = ∫_0^1 x^{-p}
    def conv(kind, p):
        return p > 1 if kind == "inf" else p < 1
    pool = [("inf", Fr(3, 2)), ("inf", Fr(2)), ("inf", Fr(3)), ("inf", Fr(1, 2)), ("inf", Fr(1)), ("zero", Fr(1, 2)), ("zero", Fr(1, 3)), ("zero", Fr(1)), ("zero", Fr(3, 2)), ("zero", Fr(2))]
    for _ in forever():
        kk = rng.sample(pool, 4)
        if sum(conv(k, p) for k, p in kk) == 1:
            break
    def num_conv(kind, p):  # 독립 경로: 로그 변수 u 로 바꿔 두 경계에서 값을 비교한다
        pp = float(p)
        if kind == "inf":
            g = lambda B: QI.quad(lambda u: math.exp((1 - pp) * u), 0, math.log(B))[0]
        else:
            g = lambda e: QI.quad(lambda u: math.exp((pp - 1) * u), 0, math.log(1 / e))[0]
        a, b = (g(1e8), g(1e16)) if kind == "inf" else (g(1e-8), g(1e-16))
        return abs(b - a) < 1e-3 * max(1.0, abs(a))
    for (k_, p_) in kk:
        if num_conv(k_, p_) != conv(k_, p_):
            raise ValueError("independent_check_failed")
    pt = lambda p: f"x^{{{p.numerator}/{p.denominator}}}" if p.denominator > 1 else (f"x^{p.numerator}" if p != 1 else "x")
    integral = lambda k, p: f"$\\displaystyle\\int_{{{1 if k == 'inf' else 0}}}^{{{'\\infty' if k == 'inf' else 1}}}\\dfrac{{1}}{{{pt(p)}}}\\,dx$"
    key_idx = [i for i, (k, p) in enumerate(kk) if conv(k, p)][0]
    key_k, key_p = kk[key_idx]
    def why_for(k, p):
        if k == "inf":
            return f"$\\int_1^{{\\infty}}x^{{-{p}}}\\,dx$ with $p={p}\\le1$ diverges: the antiderivative grows without bound as the upper limit increases." if p <= 1 else ""
        return f"$\\int_0^1x^{{-{p}}}\\,dx$ with $p={p}\\ge1$ diverges: the antiderivative grows without bound as the lower limit approaches $0$." if p >= 1 else ""
    ds = [W(integral(k, p), why_for(k, p)) for i, (k, p) in enumerate(kk) if i != key_idx]
    why = (f"$\\int_1^{{\\infty}}x^{{-{key_p}}}\\,dx=\\lim_{{b\\to\\infty}}\\left[\\dfrac{{x^{{{1 - key_p}}}}}{{{1 - key_p}}}\\right]_1^b$ converges because ${key_p}>1$." if key_k == "inf" else
           f"$\\int_0^1x^{{-{key_p}}}\\,dx=\\lim_{{a\\to0^+}}\\left[\\dfrac{{x^{{{1 - key_p}}}}}{{{1 - key_p}}}\\right]_a^1$ converges because ${key_p}<1$.")
    stem = "Which of the following improper integrals converges?"
    bpr = bpb("c_x4_improper_converges_choice", "6.13", "3.D", "not_allowed", "Decide convergence of improper integrals of power functions: infinite limit converges for p > 1, a singularity at 0 converges for p < 1",
              ["Identify where each integral is improper (at infinity or at 0)", "Apply the p-test for that type", "Select the single convergent integral"],
              [("integral of x^(-p) from 1 to infinity converges iff p > 1; from 0 to 1 converges iff p < 1", "p-integral test")],
              [("infinity_p_le_1", "divergent at infinity with p <= 1"), ("zero_p_ge_1", "divergent at zero with p >= 1"), ("mixed_up_inequality", "uses the wrong inequality for the type")],
              "log-variable quadrature of each integral to two cutoffs (1e8 and 1e16 for infinity, 1e-8 and 1e-16 for 0) shows which values stabilize (independent of the antiderivative)")
    return finish("c_x4_improper_converges_choice", "6.13", "3.D", "not_allowed", stem, integral(key_k, key_p), why, None, ds, rng, bpr, 100, [f"set={[(k, str(p)) for k, p in kk]}"])


# 6.11 부분적분 정적분: ∫_1^e x^n ln x dx = (n e^(n+1) + 1)/(n+1)^2
def c_x4_parts_ln_exact(rng):
    n = rng.choice([1, 2, 3])
    key = (n * sp.E ** (n + 1) + 1) / sp.Integer(n + 1) ** 2
    num = QI.quad(lambda u: u ** n * math.log(u), 1, math.e)[0]
    if abs(float(key) - num) > 1e-9:
        raise ValueError("independent_check_failed")
    e1 = sp.E ** (n + 1)
    cands = [("Forgets the second term of integration by parts: uses only $\\left[\\dfrac{x^{n+1}}{n+1}\\ln x\\right]_1^e$.".replace("n+1", str(n + 1)), e1 / (n + 1)),
             ("Subtracts instead of adds the constant from the lower limit: $\\dfrac{%d e^{%d}-1}{%d}$." % (n, n + 1, (n + 1) ** 2), (n * e1 - 1) / sp.Integer(n + 1) ** 2),
             ("Does not square the denominator after integrating the second time: $\\dfrac{%d e^{%d}+1}{%d}$." % (n, n + 1, n + 1), (n * e1 + 1) / sp.Integer(n + 1)),
             ("Forgets the factor %d in the first term: $\\dfrac{e^{%d}+1}{%d}$." % (n, n + 1, (n + 1) ** 2), (e1 + 1) / sp.Integer(n + 1) ** 2)]
    ds = vopts(cands, key)
    u_tex = f"x^{n}" if n > 1 else "x"
    stem = f"What is the value of $\\displaystyle\\int_1^{{e}}{u_tex}\\ln x\\,dx$?"
    bpr = bpb("c_x4_parts_ln_exact", "6.11", "1.E", "not_allowed", "Integration by parts with u = ln x and dv = x^n dx, then evaluate between 1 and e",
              ["Choose u = ln x and dv = x^n dx", "Apply the parts formula and integrate the remaining x^n / x term", "Evaluate at e and 1"],
              [("ln x is easier to differentiate than to integrate", "so it is chosen as u")],
              [("missing_second_term", "drops the second parts term"), ("sign_error", "wrong sign at the lower limit"), ("denominator_not_squared", "denominator not squared"), ("lost_coefficient", "loses the coefficient n")],
              "scipy quad of x^n ln x over [1, e] (independent of the parts antiderivative)")
    why = f"With $u=\\ln x$ and $dv={u_tex}\\,dx$: $\\displaystyle\\int {u_tex}\\ln x\\,dx=\\dfrac{{x^{{{n + 1}}}}}{{{n + 1}}}\\ln x-\\dfrac{{x^{{{n + 1}}}}}{{{(n + 1) ** 2}}}$. Evaluating from $1$ to $e$ gives $\\dfrac{{e^{{{n + 1}}}}}{{{n + 1}}}-\\dfrac{{e^{{{n + 1}}}}}{{{(n + 1) ** 2}}}+\\dfrac{{1}}{{{(n + 1) ** 2}}}=\\dfrac{{{n}e^{{{n + 1}}}+1}}{{{(n + 1) ** 2}}}$."
    return finish("c_x4_parts_ln_exact", "6.11", "1.E", "not_allowed", stem, E(key), why, key, ds, rng, bpr, 100, [f"n={n}", f"key={key}"])


# 8.13 호의 길이(정확값): y = (2/3) x^(3/2) on [0, b]
def c_x4_arclength_exact(rng):
    b = rng.choice([3, 8])
    key = sp.Rational(2, 3) * ((1 + b) ** sp.Rational(3, 2) - 1)
    num = QI.quad(lambda u: math.sqrt(1 + u), 0, b)[0]
    if abs(float(key) - num) > 1e-9:
        raise ValueError("independent_check_failed")
    yb = sp.Rational(2, 3) * sp.Integer(b) ** sp.Rational(3, 2)
    ds = vopts([("Integrates $1+y'^2$ without the square root: $\\int_0^{%d}(1+x)\\,dx$." % b, sp.Integer(b) + sp.Integer(b) ** 2 / 2), ("Reports the vertical change $y(%d)-y(0)$ instead of the length of the curve." % b, yb),
                ("Reports the straight-line distance between the endpoints $(0,0)$ and $(%d,y(%d))$." % (b, b), sp.sqrt(sp.Integer(b) ** 2 + yb ** 2)), ("Forgets the lower limit: $\\dfrac23(1+%d)^{3/2}$ without subtracting $\\dfrac23$." % b, sp.Rational(2, 3) * (1 + b) ** sp.Rational(3, 2))], key)
    stem = f"What is the length of the curve $y=\\dfrac{{2}}{{3}}x^{{3/2}}$ from $x=0$ to $x={b}$?"
    bpr = bpb("c_x4_arclength_exact", "8.13", "1.E", "not_allowed", "Arc length of a smooth curve y = f(x): integral of sqrt(1 + (f')^2), where the root simplifies",
              ["Compute y' = x^(1/2)", "Write the integral of sqrt(1 + x) from 0 to b", "Integrate by substitution and evaluate"],
              [("arc length of y = f(x) on [a, b] is the integral of sqrt(1 + (f'(x))^2)", "f' is continuous on [0, b]")],
              [("no_root", "forgets the root"), ("vertical_change", "reports y(b) - y(0)"), ("chord", "straight-line distance"), ("missing_lower_limit", "drops the lower limit term")],
              "scipy quad of sqrt(1 + x) over [0, b] (independent of the substitution antiderivative)")
    why = f"$y'=x^{{1/2}}$, so $L=\\displaystyle\\int_0^{{{b}}}\\sqrt{{1+x}}\\,dx=\\dfrac23\\left[(1+x)^{{3/2}}\\right]_0^{{{b}}}=\\dfrac23\\left({(1 + b) ** 1.5:g}-1\\right)={tex(key)}$."
    return finish("c_x4_arclength_exact", "8.13", "1.E", "not_allowed", stem, E(key), why, key, ds, rng, bpr, 100, [f"b={b}", f"key={key}"])


STAGE_LISTS = {"supp_x4c_bc": ["g_x4_euler_autonomous_graph", "g_x4_autonomous_limit_graph", "c_x4_logistic_max_rate", "c_x4_euler_table_de", "c_x4_improper_converges_choice", "c_x4_parts_ln_exact", "c_x4_arclength_exact"]}
