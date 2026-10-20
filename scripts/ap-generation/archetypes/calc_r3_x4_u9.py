"""BC4·BC5 확대 라운드(2026-10-19) 단원 9(매개변수·벡터·극좌표) 새 원형. 공개 세트·재고와 풀이 틀이 다르다(곡선의 오목성 부호표, 완전제곱 호의 길이, 속도벡터 적분, 매개 소거,
수평접선 개수, 속력 증가 판정, 평균속도 벡터, 극→직교 변환, 장미 꽃잎 넓이, 극 영역 적분 세우기, 최소 속력·시각 찾기·안쪽 고리 넓이).
학생에게 보이는 모든 문장(보기·해설)은 실제 수치로 쓰고 수식은 $...$ 안에 둔다(r3_lint.py 통과)."""
from calc_r3_x4_lib import *
from scipy import optimize as _O

TT = sp.Symbol("t", real=True)
TH = sp.Symbol("theta", real=True)


def _fl(e, var=TT):
    return sp.lambdify(var, e, "math")


def W(text, why):
    return Opt(text, False, why, None)


# 9.2 곡선의 오목성: x=t^3/3 - a^2 t, y = k t^2 → d2y/dx2 = -2k(t^2+a^2)/(t^2-a^2)^3, 오목한 구간은 |t| < a
def c_x4_param_concave_t(rng):
    a = rng.choice([1, 2, 3]); k = rng.choice([1, 2, 3, 4])
    X = TT ** 3 / 3 - a * a * TT; Y = k * TT ** 2
    d1 = sp.diff(Y, TT) / sp.diff(X, TT); d2 = sp.simplify(sp.diff(d1, TT) / sp.diff(X, TT))
    if sp.simplify(d2 + 2 * k * (TT ** 2 + a * a) / (TT ** 2 - a * a) ** 3) != 0:
        raise ValueError("closed_form_mismatch")
    # 독립 경로: 매개변수 유한차분으로 d2y/dx2 의 부호를 구간 대표점에서 확인
    xf, yf = _fl(X), _fl(Y)
    g = lambda u: ((yf(u + 1e-5) - yf(u - 1e-5)) / (xf(u + 1e-5) - xf(u - 1e-5)))

    def second(u):
        hh = 1e-3
        return (g(u + hh) - g(u - hh)) / (2 * hh) / ((xf(u + hh) - xf(u - hh)) / (2 * hh))
    for u in [-a - 1.5, -a / 2, a / 2, a + 1.5, -a * 0.9, a * 0.9]:
        if (second(u) > 0) != (abs(u) < a):
            raise ValueError("independent_check_failed")
    A2 = a * a
    key_t = f"$-{a}<t<{a}$"
    ds = [W(f"$t>{a}$", f"For $t>{a}$ the second derivative $-{2 * k}(t^2+{A2})/(t^2-{A2})^3$ is negative, so the curve is concave down there; the sign of $\\dfrac{{dy}}{{dx}}$ changes nowhere on this interval, which is not the same as concave up."),
          W("$t>0$", "Uses the sign of $\\dfrac{dy}{dt}$ (the curve rises) as if it were the sign of $\\dfrac{d^2y}{dx^2}$."),
          W(f"$t<-{a}$ or $t>{a}$", "Uses the sign of $\\dfrac{dx}{dt}$ (the curve moves to the right) as if it were the sign of $\\dfrac{d^2y}{dx^2}$."),
          W(f"$-{a}<t<0$ or $t>{a}$", "Uses the sign of $\\dfrac{dy}{dx}$ (positive slope) instead of the sign of $\\dfrac{d^2y}{dx^2}$."),
          W(f"all $t$ with $t\\ne\\pm{a}$", f"Uses $\\dfrac{{d^2y}}{{dt^2}}={2 * k}>0$, which is the concavity of $y$ as a function of $t$, not the concavity of the curve.")]
    stem = f"A curve in the $xy$-plane is defined by the parametric equations $x=\\dfrac{{t^3}}{{3}}-{A2}t$ and $y={tex(k * TT ** 2)}$. For which values of $t$ is the curve concave up?"
    bpr = bpb("c_x4_param_concave_t", "9.2", "3.D", "not_allowed", "Decide the concavity of a parametric curve from the sign of d2y/dx2 = (d/dt(dy/dx))/(dx/dt)",
              ["Form dy/dx = (dy/dt)/(dx/dt)", "Differentiate dy/dx with respect to t and divide by dx/dt", "Find where the result is positive, keeping the points with dx/dt = 0 out"],
              [("concave up means d2y/dx2 > 0 and d2y/dx2 is defined only where dx/dt is not 0", "the curve has a vertical tangent where t = +-a")],
              [("sign_of_dxdt", "uses dx/dt"), ("sign_of_dydt", "uses dy/dt"), ("sign_of_dydx", "uses dy/dx"), ("d2y_dt2", "uses the second derivative with respect to t")],
              "finite-difference d2y/dx2 from the sampled parametric curve at representative t in each region (independent of the closed form)")
    why = f"$\\dfrac{{dy}}{{dx}}=\\dfrac{{{2 * k}t}}{{t^2-{A2}}}$, so $\\dfrac{{d^2y}}{{dx^2}}=\\dfrac{{\\frac{{d}}{{dt}}\\left(dy/dx\\right)}}{{dx/dt}}=\\dfrac{{-{2 * k}(t^2+{A2})}}{{(t^2-{A2})^3}}$. This is positive exactly when $t^2-{A2}<0$, that is, when $-{a}<t<{a}$."
    return finish("c_x4_param_concave_t", "9.2", "3.D", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 100, [f"a={a}", f"k={k}"])


# 9.3 완전제곱 호의 길이: x=a t^2, y=a(t^3/3 - t) → 속력 a(t^2+1)
def c_x4_param_arclen_square(rng):
    a = rng.choice([1, 2, 3]); b = rng.choice([2, 3])
    X = a * TT ** 2; Y = a * (TT ** 3 / 3 - TT)
    if sp.simplify(sp.diff(X, TT) ** 2 + sp.diff(Y, TT) ** 2 - a * a * (TT ** 2 + 1) ** 2) != 0:
        raise ValueError("not_perfect_square")
    key = S(a) * (S(b) ** 3 / 3 + b)
    xp, yp = _fl(sp.diff(X, TT)), _fl(sp.diff(Y, TT))
    if abs(QI.quad(lambda u: math.hypot(xp(u), yp(u)), 0, b)[0] - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    sq = sp.integrate(sp.expand((a * (TT ** 2 + 1)) ** 2), (TT, 0, b))
    disp = sp.simplify(sp.sqrt((X.subs(TT, b)) ** 2 + (Y.subs(TT, b)) ** 2))
    manh = a * (S(b) ** 2 + S(b) ** 3 / 3 - b + S(4) / 3)
    ds = vopts([("Integrates $(x')^2+(y')^2$ and forgets the square root of the speed.", sq), (f"Finds the straight-line distance between the positions at $t=0$ and $t={b}$ instead of the length of the path.", disp),
                ("Integrates $|x'|+|y'|$ instead of the square root of the sum of squares.", manh), (f"Reports the speed at $t={b}$ instead of integrating the speed.", a * (S(b) ** 2 + 1))], key)
    stem = f"A particle moves in the $xy$-plane so that its position at time $t$ is $\\bigl(x(t),y(t)\\bigr)$, where $x(t)={tex(a * TT ** 2)}$ and $y(t)={a if a > 1 else ''}\\left(\\dfrac{{t^3}}{{3}}-t\\right)$. What is the total distance traveled by the particle from $t=0$ to $t={b}$?"
    bpr = bpb("c_x4_param_arclen_square", "9.3", "1.E", "not_allowed", "Total distance for planar motion is the integral of speed; the speed here simplifies because the sum of squares is a perfect square",
              ["Write the speed sqrt((x')^2 + (y')^2)", "Notice that the expression under the root is a perfect square and take the root", "Integrate the speed from 0 to the final time"],
              [("distance traveled equals the integral of speed", "the speed a(t^2+1) is positive, so no part of the path is retraced")],
              [("no_root", "omits the square root"), ("chord", "straight-line distance"), ("manhattan", "adds component speeds"), ("speed_only", "reports the speed")],
              "scipy quad of hypot(x'(t), y'(t)) over [0, b] (independent of the perfect-square simplification)")
    why = f"$x'(t)={2 * a}t$ and $y'(t)={tex(a * (TT ** 2 - 1))}$, so the speed is $\\sqrt{{({2 * a}t)^2+({tex(a * (TT ** 2 - 1))})^2}}={tex(a * (TT ** 2 + 1))}$. The distance is $\\int_0^{{{b}}}\\left({tex(a * (TT ** 2 + 1))}\\right)dt={E(key).strip('$')}$."
    return finish("c_x4_param_arclen_square", "9.3", "1.E", "not_allowed", stem, E(key), why, key, ds, rng, bpr, 110, [f"a={a}", f"b={b}", f"key={key}"])


# 9.5 속도 벡터를 적분해 위치 벡터: v(t) = <p t + q, r/(t+1)>, 시작 위치 (x0, y0), t = 2
def c_x4_vec_position_from_velocity(rng):
    p, q, r = rng.choice([2, 4, 6]), rng.choice([1, 2, 3]), rng.choice([2, 3, 4, 6])
    x0, y0 = rng.randint(1, 6), rng.randint(1, 6)
    b = 2
    xb = x0 + p * 2 + q * 2
    xn = x0 + QI.quad(lambda u: p * u + q, 0, b)[0]
    yn = y0 + QI.quad(lambda u: r / (u + 1), 0, b)[0]
    if abs(xn - xb) > 1e-9 or abs(yn - (y0 + r * math.log(3))) > 1e-9:
        raise ValueError("independent_check_failed")
    ln = "\\ln 3"
    yy = lambda c0, rr: (f"{c0}+" if c0 else "") + f"{rr if rr != 1 else ''}{ln}"
    pt = lambda u, w: f"$\\left({u},\\,{w}\\right)$"
    key_t = pt(xb, yy(y0, r))
    cands = [("Leaves out the initial position and reports only the displacement.", pt(xb - x0, yy(0, r))),
             (f"Evaluates the velocity vector at $t=2$ instead of integrating it.", pt(p * 2 + q, f"\\dfrac{{{r}}}{{3}}")),
             ("Adds the initial position to the first coordinate only.", pt(xb, yy(0, r))),
             ("Uses $\\dfrac{-1}{(t+1)^2}$ (the derivative) instead of $\\ln|t+1|$ as the antiderivative of $\\dfrac{1}{t+1}$ in the second coordinate.", pt(xb, f"{y0}+{sp.latex(S(r) * (1 - S(1) / 3))}")),
             ("Reverses the roles of the two initial coordinates.", pt(xb - x0 + y0, yy(x0, r)))]
    ds = [W(t_, w_) for w_, t_ in cands if t_ != key_t]
    stem = f"A particle moves in the $xy$-plane with velocity vector $\\vec v(t)=\\left\\langle {tex(p * TT + q)},\\ \\dfrac{{{r}}}{{t+1}}\\right\\rangle$ for $t\\ge 0$. At time $t=0$ the particle is at the point $({x0},{y0})$. What is the position of the particle at time $t=2$?"
    bpr = bpb("c_x4_vec_position_from_velocity", "9.5", "1.E", "not_allowed", "Recover a position vector by integrating each component of the velocity vector and adding the initial position",
              ["Integrate the x-component and the y-component separately from 0 to the given time", "Use an antiderivative of 1/(t+1) that is a logarithm", "Add the initial position to each coordinate"],
              [("position equals initial position plus the integral of velocity, componentwise", "Fundamental Theorem of Calculus applied to each coordinate")],
              [("displacement_only", "forgets the initial position"), ("velocity_not_integrated", "evaluates the velocity"), ("partial_initial", "adds the initial position to one coordinate"), ("wrong_antiderivative", "integrates 1/(t+1) incorrectly")],
              "scipy quad of each velocity component over [0, 2] plus the initial coordinates (independent of the symbolic antiderivatives)")
    why = f"$x(2)={x0}+\\int_0^2({tex(p * TT + q)})\\,dt={x0}+{p * 2 + q * 2}={xb}$ and $y(2)={y0}+\\int_0^2\\dfrac{{{r}}}{{t+1}}\\,dt={y0}+{r}\\ln 3$."
    return finish("c_x4_vec_position_from_velocity", "9.5", "1.E", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 105, [f"p={p},q={q},r={r}", f"x0={x0},y0={y0}"])


# 9.1 매개변수 소거: x = a cos t, y = b sin t → x^2/a^2 + y^2/b^2 = 1
def c_x4_param_eliminate(rng):
    a, b = rng.sample([2, 3, 4, 5], 2)
    pts = [(a * math.cos(u), b * math.sin(u)) for u in [0.3, 1.1, 2.0, 3.4, 5.0]]
    ok = lambda f: all(abs(f(px, py)) < 1e-9 for px, py in pts)
    if not ok(lambda X_, Y_: X_ ** 2 / a ** 2 + Y_ ** 2 / b ** 2 - 1) or ok(lambda X_, Y_: X_ ** 2 / b ** 2 + Y_ ** 2 / a ** 2 - 1) or ok(lambda X_, Y_: X_ ** 2 / a + Y_ ** 2 / b - 1) \
            or ok(lambda X_, Y_: X_ ** 2 + Y_ ** 2 - (a * a + b * b)) or ok(lambda X_, Y_: X_ ** 2 / a ** 2 - Y_ ** 2 / b ** 2 - 1):
        raise ValueError("independent_check_failed")
    key_t = f"$\\dfrac{{x^2}}{{{a * a}}}+\\dfrac{{y^2}}{{{b * b}}}=1$"
    ds = [W(f"$\\dfrac{{x^2}}{{{b * b}}}+\\dfrac{{y^2}}{{{a * a}}}=1$", "Swaps the two denominators, so the semi-axes lie along the wrong coordinate axes."),
          W(f"$\\dfrac{{x^2}}{{{a}}}+\\dfrac{{y^2}}{{{b}}}=1$", f"Divides by the amplitudes ${a}$ and ${b}$ instead of their squares."),
          W(f"$x^2+y^2={a * a + b * b}$", "Treats the curve as a circle by adding the squared amplitudes."),
          W(f"$\\dfrac{{x^2}}{{{a * a}}}-\\dfrac{{y^2}}{{{b * b}}}=1$", "Uses a minus sign, which would give a hyperbola; $\\cos^2t+\\sin^2t=1$ gives a plus sign.")]
    stem = f"A curve is defined by the parametric equations $x={a}\\cos t$ and $y={b}\\sin t$ for $0\\le t\\le 2\\pi$. Which of the following is an equation in $x$ and $y$ whose graph is this curve?"
    bpr = bpb("c_x4_param_eliminate", "9.1", "2.C", "not_allowed", "Re-express parametric equations as a Cartesian equation by eliminating the parameter with cos^2 t + sin^2 t = 1",
              ["Solve for cos t = x/a and sin t = y/b", "Substitute into cos^2 t + sin^2 t = 1"],
              [("the identity cos^2 t + sin^2 t = 1 holds for every t", "t runs over a full period so the whole ellipse is traced")],
              [("swapped_denominators", "swaps a and b"), ("amplitudes_not_squared", "forgets to square"), ("circle", "adds the squares"), ("hyperbola", "wrong sign")],
              "five sample parameter values are substituted into each option's equation; only the key is satisfied at every sample (independent of the algebra)")
    return finish("c_x4_param_eliminate", "9.1", "2.C", "not_allowed", stem, key_t, f"$\\cos t=\\dfrac{{x}}{{{a}}}$ and $\\sin t=\\dfrac{{y}}{{{b}}}$, so $\\cos^2t+\\sin^2t=1$ becomes $\\dfrac{{x^2}}{{{a * a}}}+\\dfrac{{y^2}}{{{b * b}}}=1$.", None, ds, rng, bpr, 85, [f"a={a}", f"b={b}"])


# 9.1 수평 접선 개수: dy/dt = 0 이면서 (dx/dt != 0 이거나 dy/dx 의 극한이 0)
def c_x4_param_hor_tangent_count(rng):
    frames = [("\\sin t", "\\cos 2t", lambda u: math.cos(u), lambda u: -2 * math.sin(2 * u), "\\cos t", "-4\\sin t", [math.pi / 2, 3 * math.pi / 2]),
              ("\\cos t", "\\cos 2t", lambda u: -math.sin(u), lambda u: -2 * math.sin(2 * u), "-\\sin t", "4\\cos t", [0, math.pi, 2 * math.pi])]
    xt, yt, xpf, ypf, xptex, slope_tex, bothz = rng.choice(frames)
    zeros = [k * math.pi / 2 for k in range(5)]
    cnt = 0
    for u in zeros:
        if abs(ypf(u)) > 1e-9:
            raise ValueError("bad_zero")
        if abs(xpf(u)) > 1e-9:
            cnt += 1
        else:
            hh = 1e-4
            if all(abs(ypf(u + s * hh) / xpf(u + s * hh)) < 1e-2 for s in (-1, 1)):
                cnt += 1
    key = cnt
    nb = len(bothz)
    if not (1 <= key <= 4) or key == len(zeros):
        raise ValueError("no_trap")
    cands = [("Counts every $t$ with $\\dfrac{dy}{dt}=0$, including the values where $\\dfrac{dx}{dt}=0$ too, without checking the slope there.", len(zeros)),
             ("Counts only the interior zeros of $\\dfrac{dy}{dt}$ and leaves out the endpoints $t=0$ and $t=2\\pi$.", len(zeros) - 2),
             ("Counts only the values of $t$ where $\\dfrac{dx}{dt}$ and $\\dfrac{dy}{dt}$ are both $0$.", nb),
             ("Counts the values of $t$ with $\\dfrac{dx}{dt}=0$ and $\\dfrac{dy}{dt}\\ne0$ (vertical tangents).", 2 if nb == 2 else 0),
             ("Counts every zero of $\\dfrac{dy}{dt}$ except the one at the endpoint $t=2\\pi$.", len(zeros) - 1)]
    seen, uds = {key}, []
    for w_, v_ in cands:
        if v_ not in seen:
            seen.add(v_); uds.append(Opt("$%d$" % v_, False, w_, v_))
    if len(uds) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"A curve is defined by $x={xt}$ and $y={yt}$ for $0\\le t\\le 2\\pi$. At how many values of $t$ in this interval does the curve have a horizontal tangent line?"
    bpr = bpb("c_x4_param_hor_tangent_count", "9.1", "2.D", "not_allowed", "Locate horizontal tangents of a parametric curve: dy/dt = 0 with dx/dt != 0, or both zero with dy/dx -> 0",
              ["Solve dy/dt = 0 on the interval", "Check dx/dt at each solution", "Where both vanish, find the limit of dy/dx from the simplified ratio"],
              [("a horizontal tangent needs dy/dx = 0", "at a point where both derivatives vanish dy/dx must be examined by simplifying the ratio")],
              [("count_all_dydt_zero", "counts all zeros of dy/dt"), ("endpoints_dropped", "drops endpoints"), ("only_both_zero", "counts the shared zeros"), ("vertical", "counts vertical tangents")],
              "numeric slopes y'(t)/x'(t) on both sides of each zero of dy/dt (independent of the symbolic simplification)")
    why = f"$\\dfrac{{dx}}{{dt}}={xptex}$ and $\\dfrac{{dy}}{{dt}}=-2\\sin 2t=-4\\sin t\\cos t$, which is $0$ at $t=0,\\ \\dfrac{{\\pi}}{{2}},\\ \\pi,\\ \\dfrac{{3\\pi}}{{2}},\\ 2\\pi$. Where $\\dfrac{{dx}}{{dt}}$ is also $0$, simplify $\\dfrac{{dy}}{{dx}}={slope_tex}$ and read its value there. Exactly ${key}$ of the values of $t$ give slope $0$."
    return finish("c_x4_param_hor_tangent_count", "9.1", "2.D", "not_allowed", stem, "$%d$" % key, why, key, uds, rng, bpr, 120, [f"x={xt}", f"y={yt}", f"key={key}"])


def _vec(e1, e2):
    return f"\\left\\langle {tex(e1)},\\ {tex(e2)}\\right\\rangle"


# 9.6 속력 증가 판정: 속도 <p t + q, r t^2 + s>, 가속도 <p, 2 r t>
def c_x4_speed_up_dot(rng):
    for _ in forever():
        p, q, r, s = rng.choice([-3, -2, -1, 1, 2, 3]), rng.randint(-6, 6), rng.choice([-2, -1, 1, 2]), rng.randint(-6, 6)
        c = rng.choice([1, 2, 3])
        vx, vy = p * c + q, r * c * c + s
        ax, ay = p, 2 * r * c
        dot = vx * ax + vy * ay
        if vx != 0 and vy != 0 and dot != 0 and (ax > 0) != (vx > 0) and (ay > 0) != (vy > 0):
            break
    spf = lambda u: math.hypot(p * u + q, r * u * u + s)
    if ((spf(c + 1e-6) - spf(c - 1e-6)) / 2e-6 > 0) != (dot > 0):
        raise ValueError("independent_check_failed")
    hor = lambda v: "to the right" if v > 0 else "to the left"
    ver = lambda v: "upward" if v > 0 else "downward"
    spd = lambda inc: "increasing" if inc else "decreasing"
    stm = lambda h, v, i: f"The particle is moving {hor(h)} and {ver(v)}, and its speed is {spd(i)}."
    key_t = stm(vx, vy, dot > 0)
    ds = [W(stm(vx, vy, dot < 0), f"Takes the wrong sign for the rate of change of speed: speed increases when $\\vec v\\cdot\\vec a>0$, and here $\\vec v\\cdot\\vec a={dot}$."),
          W(stm(-vx, vy, dot > 0), f"Reads the horizontal direction from the sign of the $x$-component of acceleration (${ax}$) instead of the $x$-component of velocity (${vx}$)."),
          W(stm(vx, -vy, dot > 0), f"Reads the vertical direction from the sign of the $y$-component of acceleration (${ay}$) instead of the $y$-component of velocity (${vy}$).")]
    stem = f"A particle moves in the $xy$-plane so that its velocity vector at time $t$ is $\\vec v(t)={_vec(p * TT + q, r * TT ** 2 + s)}$. Which of the following statements is true at time $t={c}$?"
    bpr = bpb("c_x4_speed_up_dot", "9.6", "3.D", "not_allowed", "Decide whether planar speed is increasing from the sign of v . a, and read direction from the components of v",
              ["Evaluate the velocity vector and the acceleration vector at the given time", "Read the direction of motion from the signs of the velocity components", "Compute v . a: positive means speed is increasing"],
              [("d(speed)/dt = (v . a)/|v| when the speed is not 0", "the velocity is not the zero vector at the given time")],
              [("speed_sign_flipped", "reverses increasing/decreasing"), ("horizontal_from_acceleration", "uses a_x for direction"), ("vertical_from_acceleration", "uses a_y for direction")],
              "central difference of the speed sqrt(x'^2 + y'^2) at the given time (independent of the dot product)")
    why = f"$\\vec v({c})=\\langle {vx},{vy}\\rangle$ and $\\vec a(t)={_vec(p, 2 * r * TT)}$, so $\\vec a({c})=\\langle {ax},{ay}\\rangle$. The components of $\\vec v$ give the direction, and $\\vec v\\cdot\\vec a={vx * ax}{'+' if vy * ay >= 0 else '-'}{abs(vy * ay)}={dot}$ is {'positive' if dot > 0 else 'negative'}, so the speed is {spd(dot > 0)}."
    return finish("c_x4_speed_up_dot", "9.6", "3.D", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 120, [f"p={p},q={q},r={r},s={s}", f"c={c}", f"dot={dot}"])


# 9.4·9.6 평균 속도 벡터: 위치 <p t^2 + q t, m t^3> 에서 구간 [1,3]
def c_x4_vec_avg_velocity(rng):
    p, q, m = rng.choice([1, 2, 3]), rng.choice([1, 2, 4]), rng.choice([1, 2, 3])
    X = p * TT ** 2 + q * TT; Y = m * TT ** 3
    avg = lambda e: S(e.subs(TT, 3) - e.subs(TT, 1)) / 2
    key = (avg(X), avg(Y))
    nm = lambda e: (float(e.subs(TT, 3)) - float(e.subs(TT, 1))) / 2
    if abs(nm(X) - float(key[0])) > 1e-12 or abs(nm(Y) - float(key[1])) > 1e-12:
        raise ValueError("independent_check_failed")
    vel = lambda u: (sp.diff(X, TT).subs(TT, u), sp.diff(Y, TT).subs(TT, u))
    pt = lambda v: "$\\left\\langle %s,\\ %s\\right\\rangle$" % (sp.latex(S(v[0])), sp.latex(S(v[1])))
    key_t = pt(key)
    mid = vel(2); ends = ((vel(1)[0] + vel(3)[0]) / 2, (vel(1)[1] + vel(3)[1]) / 2)
    cands = [("Reports the velocity at the midpoint $t=2$ instead of the average velocity; the second coordinate is cubic in $t$, so these differ.", pt(mid)),
             ("Reports the displacement without dividing by the length of the time interval.", pt((S(key[0]) * 2, S(key[1]) * 2))),
             ("Averages the endpoint positions instead of finding the change in position.", pt(((X.subs(TT, 1) + X.subs(TT, 3)) / 2, (Y.subs(TT, 1) + Y.subs(TT, 3)) / 2))),
             ("Averages the velocities at the endpoints, which is not the average velocity when a coordinate is cubic.", pt(ends))]
    ds = [W(t_, w_) for w_, t_ in cands if t_ != key_t]
    stem = f"The position of a particle moving in the $xy$-plane at time $t$ is $\\vec r(t)={_vec(X, Y)}$. What is the average velocity vector of the particle over the time interval $1\\le t\\le 3$?"
    bpr = bpb("c_x4_vec_avg_velocity", "9.4", "1.E", "not_allowed", "Average velocity vector is the change in the position vector divided by the elapsed time",
              ["Evaluate the position vector at both ends of the interval", "Subtract and divide by the length of the interval"],
              [("average velocity over [a, b] = (r(b) - r(a))/(b - a)", "definition for vector-valued functions")],
              [("midpoint_velocity", "evaluates velocity at the midpoint"), ("no_division", "forgets the division"), ("average_positions", "averages positions"), ("average_endpoint_velocities", "averages endpoint velocities")],
              "difference quotient of the numerically evaluated position components over the interval (independent of the sympy substitution)")
    why = f"$\\vec r(3)={pt((X.subs(TT, 3), Y.subs(TT, 3))).strip('$')}$ and $\\vec r(1)={pt((X.subs(TT, 1), Y.subs(TT, 1))).strip('$')}$, so the average velocity is $\\dfrac{{\\vec r(3)-\\vec r(1)}}{{3-1}}={pt(key).strip('$')}$."
    return finish("c_x4_vec_avg_velocity", "9.4", "1.E", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 95, [f"p={p},q={q},m={m}", f"key={key}"])


# 9.7 극좌표 방정식 → 직교 좌표의 도형: r = 2c cos θ(원 중심 (c,0)) 또는 r = 2c sin θ(원 중심 (0,c))
def c_x4_polar_to_cartesian(rng):
    c = rng.choice([1, 2, 3, 4]); fn = rng.choice(["cos", "sin"])
    rr = lambda th: 2 * c * (math.cos(th) if fn == "cos" else math.sin(th))
    cen = (c, 0) if fn == "cos" else (0, c)
    for th in [0.2, 0.9, 1.4, 2.5]:
        px, py = rr(th) * math.cos(th), rr(th) * math.sin(th)
        if abs(math.hypot(px - cen[0], py - cen[1]) - c) > 1e-9:
            raise ValueError("independent_check_failed")
    show = lambda ce, rad: f"A circle with center $({ce[0]},{ce[1]})$ and radius ${rad}$."
    key_t = show(cen, c)
    ds = [W(show((0, 0), 2 * c), f"Treats $r={2 * c}\\{fn}\\theta$ as if it had a constant radius, so the circle would be centered at the origin."),
          W(show((cen[1], cen[0]), c), "Swaps the roles of cosine and sine, so the circle is centered on the wrong axis."),
          W(show((2 * cen[0], 2 * cen[1]), 2 * c), f"Uses ${2 * c}$ as both the radius and the distance from the origin to the center; the center is at distance ${c}$."),
          W(show(cen, 2 * c), f"Finds the correct center but uses the diameter ${2 * c}$ as the radius.")]
    stem = f"The graph of the polar curve $r={2 * c}\\{fn}\\theta$ for $0\\le\\theta\\le\\pi$ is which of the following?"
    bpr = bpb("c_x4_polar_to_cartesian", "9.7", "2.C", "not_allowed", "Convert a polar equation to Cartesian form: multiply by r and use r^2 = x^2 + y^2, x = r cos(theta), y = r sin(theta)",
              ["Multiply both sides by r", "Replace r^2, r cos(theta) or r sin(theta) with Cartesian expressions", "Complete the square to read center and radius"],
              [("the polar curve is a circle through the origin", "r = 2c cos(theta) or 2c sin(theta)")],
              [("circle_at_origin", "reads r = 2c as constant radius"), ("swapped_trig", "swaps sin and cos"), ("double_radius", "doubles center and radius"), ("diameter_as_radius", "uses the diameter")],
              "polar points (r cos(theta), r sin(theta)) at four angles are tested against the distance to the claimed center (independent of completing the square)")
    var = "x" if fn == "cos" else "y"
    sq = f"(x-{c})^2+y^2" if fn == "cos" else f"x^2+(y-{c})^2"
    why = f"Multiplying by $r$ gives $r^2={2 * c}\\,r\\{fn}\\theta$, so $x^2+y^2={2 * c}{var}$. Completing the square gives ${sq}={c * c}$, a circle with center $({cen[0]},{cen[1]})$ and radius ${c}$."
    return finish("c_x4_polar_to_cartesian", "9.7", "2.C", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 90, [f"c={c}", f"fn={fn}"])


# 9.8 장미 곡선 한 꽃잎의 넓이: r = a sin(nθ), 0 ≤ θ ≤ π/n → π a^2/(4n)
def c_x4_polar_area_petal(rng):
    a, n = rng.choice([2, 3, 4]), rng.choice([2, 3, 4])
    key = sp.pi * a * a / (4 * n)
    chk = sp.integrate(sp.Rational(1, 2) * (a * sp.sin(n * TH)) ** 2, (TH, 0, sp.pi / n))
    if sp.simplify(chk - key) != 0 or abs(QI.quad(lambda u: 0.5 * (a * math.sin(n * u)) ** 2, 0, math.pi / n)[0] - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = vopts([("Leaves out the factor $\\dfrac12$ in the polar area formula.", sp.pi * a * a / (2 * n)), ("Integrates over $0$ to $2\\pi$, which covers all of the petals, not one petal.", sp.pi * a * a / 2),
                (f"Integrates over half of the petal, from $0$ to $\\dfrac{{\\pi}}{{{2 * n}}}$.", sp.pi * a * a / (8 * n)), ("Integrates $r$ instead of $r^2$ over one petal.", sp.Rational(a, n) if sp.Rational(a, n) != 1 else sp.Rational(2 * a, n))], key)
    stem = f"The polar curve $r={a}\\sin({n}\\theta)$ has several petals. What is the area of the region enclosed by one petal of the curve?"
    bpr = bpb("c_x4_polar_area_petal", "9.8", "1.E", "not_allowed", "Area of one petal: (1/2) times the integral of r^2 between consecutive zeros of r",
              ["Find consecutive zeros of r: theta = 0 and theta = pi/n", "Write (1/2) of the integral of r^2", "Use sin^2 = (1 - cos 2u)/2 to integrate"],
              [("r >= 0 on [0, pi/n], so this interval traces one petal exactly once", "sin(n theta) >= 0 for 0 <= theta <= pi/n")],
              [("no_half", "forgets 1/2"), ("all_petals", "integrates over a full period"), ("half_petal", "uses half the interval"), ("r_not_squared", "integrates r")],
              "scipy quad of (1/2) r^2 over the petal interval (independent of the symbolic integration)")
    why = f"$r=0$ at $\\theta=0$ and $\\theta=\\dfrac{{\\pi}}{{{n}}}$, and $r\\ge0$ between them, so one petal has area $\\dfrac12\\int_0^{{\\pi/{n}}}\\left({a}\\sin({n}\\theta)\\right)^2d\\theta={tex(key)}$."
    return finish("c_x4_polar_area_petal", "9.8", "1.E", "not_allowed", stem, E(key), why, key, ds, rng, bpr, 100, [f"a={a}", f"n={n}", f"key={key}"])


# 9.9 두 극곡선 사이 영역의 적분 세우기: 카디오이드 r = a(1+cosθ) 의 안쪽이면서 원 r = a 의 바깥
def c_x4_polar_between_setup(rng):
    a = rng.choice([2, 3, 4, 5])
    N = 400; cnt = 0
    for i in range(N):
        for j in range(N):
            px = -a * 0.2 + (a * 2.4) * (i + 0.5) / N
            py = -a * 1.3 + (a * 2.6) * (j + 0.5) / N
            if a < math.hypot(px, py) < a * (1 + math.cos(math.atan2(py, px))):
                cnt += 1
    grid_area = cnt * (a * 2.4 / N) * (a * 2.6 / N)
    area = sp.integrate(sp.Rational(1, 2) * ((a + a * sp.cos(TH)) ** 2 - a * a), (TH, -sp.pi / 2, sp.pi / 2))
    if abs(grid_area - float(area)) > 0.02 * float(area):
        raise ValueError("independent_check_failed")
    I = lambda lo, hi, body, half=True: f"${'\\dfrac{1}{2}' if half else ''}\\displaystyle\\int_{{{lo}}}^{{{hi}}}{body}\\,d\\theta$"
    outer = f"({a}+{a}\\cos\\theta)^2"; inner = f"{a * a}"
    key_t = I("-\\pi/2", "\\pi/2", f"\\left[{outer}-{inner}\\right]")
    ds = [W(I("-\\pi/2", "\\pi/2", f"\\left[{inner}-{outer}\\right]"), "Subtracts in the wrong order, which gives the negative of the area."),
          W(I("0", "\\pi", f"\\left[{outer}-{inner}\\right]"), "Uses the limits $0$ and $\\pi$; the curves meet where $\\cos\\theta=0$, at $\\theta=-\\dfrac{\\pi}{2}$ and $\\theta=\\dfrac{\\pi}{2}$, and the region lies on both sides of the $x$-axis."),
          W(I("-\\pi", "\\pi", f"\\left[{outer}-{inner}\\right]"), "Integrates over a full revolution, but the cardioid lies inside the circle for the left half-plane, so the integrand is negative there."),
          W(I("-\\pi/2", "\\pi/2", f"\\left[({a}+{a}\\cos\\theta)-{a}\\right]"), "Subtracts the radii instead of the squares of the radii."),
          W(I("-\\pi/2", "\\pi/2", f"\\left[{outer}-{inner}\\right]", half=False), "Leaves out the factor $\\dfrac12$ of the polar area formula.")]
    stem = f"Let $R$ be the region that lies inside the polar curve $r={a}+{a}\\cos\\theta$ and outside the polar curve $r={a}$. Which of the following gives the area of $R$?"
    bpr = bpb("c_x4_polar_between_setup", "9.9", "1.C", "not_allowed", "Set up the area between two polar curves: (1/2) integral of (r_outer^2 - r_inner^2) between the intersection angles",
              ["Find where the curves intersect: a(1 + cos(theta)) = a gives cos(theta) = 0", "Identify the outer and inner curve on that interval", "Write (1/2) of the integral of the difference of squares"],
              [("the cardioid is outside the circle exactly where cos(theta) > 0", "intersection angles are -pi/2 and pi/2")],
              [("wrong_order", "reverses the subtraction"), ("wrong_limits", "uses 0 to pi"), ("full_turn", "uses -pi to pi"), ("radii_not_squared", "subtracts radii"), ("no_half", "drops the factor 1/2")],
              "Cartesian grid count of lattice cells with a < r < a(1+cos(theta)) compared with the value of the key integral (independent of the setup)")
    why = f"The curves meet where ${a}+{a}\\cos\\theta={a}$, that is $\\cos\\theta=0$, at $\\theta=\\pm\\dfrac{{\\pi}}{{2}}$. Between those angles the cardioid is the outer curve, so the area is $\\dfrac12\\int_{{-\\pi/2}}^{{\\pi/2}}\\left[(r_{{\\text{{outer}}}})^2-(r_{{\\text{{inner}}}})^2\\right]d\\theta$."
    return finish("c_x4_polar_between_setup", "9.9", "1.C", "not_allowed", stem, key_t, why, None, ds, rng, bpr, 100, [f"a={a}", f"area={area}"])


# 9.6 계산기: 속력이 최소가 되는 시각
def c_x4_param_min_speed_calc(rng):
    for _ in forever():
        p, q, r, s = rng.choice([1, 2, 3]), rng.choice([2, 3, 4, 5]), rng.choice([1, 2]), rng.choice([1, 2, 3])
        vx = lambda u: p * u * u - q * u + 2
        vy = lambda u: r * u - s
        sp2 = lambda u: vx(u) ** 2 + vy(u) ** 2
        lo, hi = 0.0, 4.0
        res = _O.minimize_scalar(sp2, bounds=(lo, hi), method="bounded", options={"xatol": 1e-12})
        gmin = min([lo + (hi - lo) * i / 40000 for i in range(40001)], key=sp2)
        if abs(res.x - gmin) > 1e-3 or not (0.2 < res.x < 3.8) or sp2(res.x) < 0.05:
            continue
        tm = res.x
        zx = [float(sp.re(rt)) for rt in sp.Poly(p * TT ** 2 - q * TT + 2, TT).nroots() if abs(sp.im(rt)) < 1e-12 and 0 < float(sp.re(rt)) < 4]
        cands = [(s / r, f"Reports the time at which $y'(t)=0$, where the vertical component of velocity vanishes, not the time of least speed."),
                 (zx[0] if zx else None, "Reports the first time at which $x'(t)=0$, not the time of least speed."),
                 (q / (2 * p), f"Reports the vertex of $x'(t)={tex(p * TT ** 2 - q * TT + 2)}$, where the horizontal velocity alone is smallest."),
                 (4.0, "Reports the right endpoint, where the speed is not least."), (0.0, "Reports the left endpoint, where the speed is not least.")]
        ds = [(w, v) for v, w in cands if v is not None and abs(v - tm) > 0.002]
        if len({round(v, 3) for _, v in ds}) >= 3:
            break
    stem = f"A particle moves in the $xy$-plane with velocity vector $\\vec v(t)={_vec(p * TT ** 2 - q * TT + 2, r * TT - s)}$ for $0\\le t\\le 4$. At what time $t$ is the speed of the particle least?"
    seen, up = {"$%.3f$" % tm}, []
    for w, v in ds:
        tx = "$%.3f$" % v
        if tx not in seen:
            seen.add(tx); up.append(Opt(tx, False, w, v))
    bpr = bpb("c_x4_param_min_speed_calc", "9.6", "1.E", "required", "Minimize planar speed on a closed interval using a calculator: minimize the square of the speed and compare with endpoints",
              ["Write the speed (or its square) from the two velocity components", "Use the calculator to find where the derivative of the speed is zero on the interval", "Compare with the endpoint values"],
              [("the speed is continuous on [0, 4], so a minimum exists", "sum of squares of polynomials")],
              [("vertical_velocity_zero", "uses y' = 0"), ("horizontal_velocity_zero", "uses x' = 0"), ("vertex_of_x_velocity", "uses the vertex of x'"), ("endpoint", "reports an endpoint")],
              "bounded scalar minimization of the squared speed checked against a 40001-point grid search (independent of setting the derivative to zero)")
    why = f"The speed is $\\sqrt{{x'(t)^2+y'(t)^2}}$. Using a calculator to minimize $x'(t)^2+y'(t)^2$ on $[0,4]$ gives $t={tm:.3f}$, and the speeds at the endpoints $t=0$ and $t=4$ are larger."
    return finish("c_x4_param_min_speed_calc", "9.6", "1.E", "required", stem, "$%.3f$" % tm, why, tm, up, rng, bpr, 125, [f"p={p},q={q},r={r},s={s}", f"t={tm:.6f}"])


# 9.6 계산기: 처음 y 축을 지나는 시각의 접선 기울기
def c_x4_param_point_time_calc(rng):
    for _ in forever():
        m, n, k = rng.choice([2, 3, 4]), rng.choice([5, 6, 7, 8]), rng.choice([1, 2, 3])
        xf = lambda u: u * u - n * u + m
        disc = n * n - 4 * m
        if disc <= 0:
            continue
        t1 = (n - math.sqrt(disc)) / 2; t2 = (n + math.sqrt(disc)) / 2
        if not (0.2 < t1 < 3 and t2 > t1 + 1):
            continue
        yp = lambda u: 1 / (u + 1) + k
        xp = lambda u: 2 * u - n
        key = yp(t1) / xp(t1)
        t1b = _O.brentq(xf, 0.0, n / 2)
        yy = lambda u: math.log(u + 1) + k * u
        if abs((yy(t1b + 1e-6) - yy(t1b - 1e-6)) / (xf(t1b + 1e-6) - xf(t1b - 1e-6)) - key) > 1e-5 or abs(t1b - t1) > 1e-9:
            continue
        cands = [(yp(t2) / xp(t2), "Uses the second positive time at which $x(t)=0$ instead of the first."), (xp(t1) / yp(t1), "Reports $\\dfrac{dx}{dy}$, the reciprocal of the slope."), (yp(t1), "Reports $\\dfrac{dy}{dt}$ at that time instead of $\\dfrac{dy}{dx}$."),
                 (yy(t1), "Reports the $y$-coordinate of the point instead of the slope."), (yp(t1) * xp(t1), "Multiplies the two derivatives instead of dividing.")]
        ds = [(w, v) for v, w in cands if abs(v - key) > 0.002]
        if len({round(v, 3) for _, v in ds}) >= 3 and all(abs(v) < 1e3 for _, v in ds):
            break
    stem = f"A curve is defined by $x(t)=t^2-{n}t+{m}$ and $y(t)=\\ln(t+1)+{tex(k * TT)}$ for $t\\ge 0$. The curve crosses the $y$-axis at two values of $t$. What is the slope of the line tangent to the curve at the point where it crosses the $y$-axis for the first time?"
    pool, seen = [], {"$%.3f$" % key}
    for w, v in ds:
        tx = "$%.3f$" % v
        if tx not in seen:
            seen.add(tx); pool.append(Opt(tx, False, w, v))
    bpr = bpb("c_x4_param_point_time_calc", "9.6", "1.E", "required", "Find the parameter value for a geometric condition with a calculator, then compute dy/dx = (dy/dt)/(dx/dt) there",
              ["Solve x(t) = 0 and take the smaller positive root", "Compute dy/dt and dx/dt at that time", "Divide dy/dt by dx/dt"],
              [("the curve is on the y-axis exactly when x(t) = 0", "x(t) has two positive roots, so the first one must be chosen")],
              [("second_root", "uses the other root"), ("reciprocal", "reports the reciprocal dx/dy"), ("dydt_only", "reports dy/dt alone"), ("y_coordinate", "reports the y-coordinate"), ("product", "multiplies derivatives")],
              "bisection root of x(t) and a central finite difference of y over x at that root (independent of the derivative formulas)")
    why = f"$x(t)=0$ at $t={t1:.3f}$ and $t={t2:.3f}$; the first is $t={t1:.3f}$. There $\\dfrac{{dy}}{{dx}}=\\dfrac{{y'(t)}}{{x'(t)}}=\\dfrac{{\\frac{{1}}{{t+1}}+{k}}}{{2t-{n}}}={key:.3f}$."
    return finish("c_x4_param_point_time_calc", "9.6", "1.E", "required", stem, "$%.3f$" % key, why, key, pool, rng, bpr, 120, [f"m={m},n={n},k={k}", f"t1={t1:.6f}", f"key={key:.6f}"])


# 9.8 계산기: 리마송 r = a + b cos θ (b > a) 안쪽 고리의 넓이
def c_x4_polar_inner_loop_calc(rng):
    a, b = rng.choice([(1, 2), (1, 3), (2, 3), (2, 4)])
    th0 = math.acos(-a / b)
    rr = lambda u: a + b * math.cos(u)
    inner = QI.quad(lambda u: 0.5 * rr(u) ** 2, th0, 2 * math.pi - th0)[0]
    n = 20000
    ang = [th0 + (2 * math.pi - 2 * th0) * i / n for i in range(n + 1)]
    pts = [(rr(u) * math.cos(u), rr(u) * math.sin(u)) for u in ang]
    shoe = abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(n))) / 2
    if abs(shoe - inner) > 1e-4 * inner:
        raise ValueError("independent_check_failed")
    whole = QI.quad(lambda u: 0.5 * rr(u) ** 2, 0, 2 * math.pi)[0]
    cands = [(whole - inner, f"Integrates $\\dfrac12(r)^2$ over the angles outside the inner loop, $0\\le\\theta\\le{th0:.4f}$ and ${2 * math.pi - th0:.4f}\\le\\theta\\le2\\pi$, which gives ${whole - inner:.3f}$ instead of the area of the inner loop."),
             (whole, f"Integrates $\\dfrac12({a}+{b}\\cos\\theta)^2$ over $0\\le\\theta\\le2\\pi$, which gives ${whole:.3f}$ because it adds the area swept by the outer part to the area of the inner loop."),
             (2 * inner, f"Doubles the area of the inner loop, ${inner:.3f}$."), (QI.quad(lambda u: rr(u) ** 2, th0, 2 * math.pi - th0)[0], "Leaves out the factor $\\dfrac12$ of the polar area formula, so the integral of $r^2$ over the inner-loop angles is twice the area."),
             (QI.quad(lambda u: 0.5 * rr(u) ** 2, 0, th0)[0], f"Integrates $\\dfrac12({a}+{b}\\cos\\theta)^2$ only from $\\theta=0$ to $\\theta={th0:.4f}$, the first angle where $r=0$, which is half of the area outside the inner loop.")]
    pool, seen = [], {"$%.3f$" % inner}
    for v, w in cands:
        tx = "$%.3f$" % v
        if tx not in seen and 0.001 < v < 1e3:
            seen.add(tx); pool.append(Opt(tx, False, w, v))
    if len(pool) < 3:
        raise ValueError("not_enough_distractors")
    stem = f"The polar curve $r={a}+{tex(b * sp.cos(TH))}$ for $0\\le\\theta\\le 2\\pi$ has a small loop inside a large loop. What is the area of the region enclosed by the small inner loop?"
    bpr = bpb("c_x4_polar_inner_loop_calc", "9.8", "1.E", "required", "Area of an inner loop of a limacon: integrate (1/2)r^2 between the two angles where r = 0, using a calculator",
              ["Solve a + b cos(theta) = 0 for the two angles that bound the inner loop", "Write (1/2) of the integral of r^2 between them", "Evaluate with a calculator"],
              [("the inner loop is traced while r < 0, between the two angles where r = 0", "r changes sign at theta = arccos(-a/b) and 2 pi minus that angle")],
              [("outer_region", "area between loops"), ("full_turn", "full revolution"), ("doubled", "doubles the area"), ("no_half", "drops the factor 1/2"), ("wrong_limits", "wrong limits")],
              "shoelace area of the polygon through 20001 sampled points of the inner loop (independent of the integral)")
    why = f"$r=0$ when $\\cos\\theta=-\\dfrac{{{a}}}{{{b}}}$, at $\\theta={th0:.4f}$ and $\\theta=2\\pi-{th0:.4f}$, and $r<0$ between them. The inner loop has area $\\dfrac12\\int_{{{th0:.4f}}}^{{{2 * math.pi - th0:.4f}}}({a}+{b}\\cos\\theta)^2d\\theta={inner:.3f}$ (calculator)."
    return finish("c_x4_polar_inner_loop_calc", "9.8", "1.E", "required", stem, "$%.3f$" % inner, why, inner, pool, rng, bpr, 125, [f"a={a},b={b}", f"inner={inner:.6f}"])


STAGE_LISTS = {"supp_x4a_bc": ["c_x4_param_concave_t", "c_x4_param_arclen_square", "c_x4_vec_position_from_velocity", "c_x4_param_eliminate", "c_x4_param_hor_tangent_count", "c_x4_speed_up_dot", "c_x4_vec_avg_velocity", "c_x4_polar_to_cartesian", "c_x4_polar_area_petal", "c_x4_polar_between_setup", "c_x4_param_min_speed_calc", "c_x4_param_point_time_calc", "c_x4_polar_inner_loop_calc"]}
