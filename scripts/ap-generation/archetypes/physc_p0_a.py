"""AP Physics C: Mechanics 원형 A — 단원 1(운동학, 미적분 표기). 정답은 sympy 도함수·적분으로 풀고 중심 차분·Simpson·RK4·이분법으로 독립 재계산한다."""
from physc_common import *

t_ = sp.symbols("t", positive=True)


def _P(c):
    """계수 목록 [c3,c2,c1,c0] -> 'ct^3 + ...' TeX (0 항 생략)."""
    out = ""
    for p, v in zip((3, 2, 1, 0), c):
        if v == 0:
            continue
        term = (f"{abs(v):g}" if (abs(v) != 1 or p == 0) else "") + ("t" if p else "") + (f"^{p}" if p > 1 else "")
        out += (" - " if v < 0 else (" + " if out else "")) + term
    return out.lstrip(" +") if out.startswith(" + ") else out


@retry_sep
def pc_xt_poly_velocity(rng):
    for _ in forever():
        A = pick(rng, [1, 2, 3]); B = pick(rng, [2, 3, 4, 6]); C = pick(rng, [1, 2, 4, 5]); t0 = pick(rng, [2, 3, 4])
        x = A * t_ ** 3 - B * t_ ** 2 + C * t_
        v = float(sp.diff(x, t_).subs(t_, t0)); f = sp.lambdify(t_, x, "math")
        agree(v, nd(f, t0), 1e-6, "v")
        if v > 3:
            break
    avg = float(x.subs(t_, t0)) / t0
    key, ds = num_opts(v, [("Divides the position by the time, which gives the average velocity from $t=0$ rather than the instantaneous velocity.", avg),
                           ("Differentiates only the cubic term, $3At^2$, and drops the other terms.", 3 * A * t0 ** 2), ("Evaluates the position function instead of its derivative.", float(x.subs(t_, t0))),
                           ("Differentiates twice and reports the acceleration at the given time.", float(sp.diff(x, t_, 2).subs(t_, t0)))], "m/s")
    stem = f"A particle moves along the $x$-axis with position $x(t)={_P([A, -B, C, 0])}$, where $x$ is in meters and $t$ is in seconds. What is the velocity of the particle at $t={t0}\\text{{ s}}$?"
    return MQ("pc_xt_poly_velocity", "1.2", "2.B", stem, key, ds, rng, "Instantaneous velocity is the time derivative of position", ["Differentiate the position function with respect to time", "Evaluate the derivative at the given time"],
              "sympy derivative versus a central finite difference of the same function", f"$v=dx/dt={3 * A}t^2-{2 * B}t+{C}$, which at $t={t0}\\text{{ s}}$ is ${sig(v)}\\text{{ m/s}}$.", [f"A={A}", f"B={B}", f"C={C}", f"t0={t0}"], est=85)


@retry_sep
def pc_xt_poly_rest_accel(rng):
    for _ in forever():
        r1 = pick(rng, [1, 2]); r2 = r1 + pick(rng, [1, 2, 3]); k = pick(rng, [1, 2]); m_ = pick(rng, [1, 2, 3])
        # v = 3k (t-r1)(t-r2) -> x = k t^3 - 1.5 k (r1+r2) t^2 + 3 k r1 r2 t
        A = k; B = 1.5 * k * (r1 + r2); C = 3 * k * r1 * r2
        if B != int(B):
            continue
        x = A * t_ ** 3 - B * t_ ** 2 + C * t_
        sols = sorted(float(s) for s in sp.solve(sp.diff(x, t_), t_)); assert len(sols) == 2
        a_late = float(sp.diff(x, t_, 2).subs(t_, sols[1])); a_early = float(sp.diff(x, t_, 2).subs(t_, sols[0]))
        f = sp.lambdify(t_, x, "math"); agree(a_late, (nd(f, sols[1] + 1e-3, 1e-3) - nd(f, sols[1] - 1e-3, 1e-3)) / 2e-3, 1e-3, "a")
        break
    key, ds = signed_opts(a_late, [("Uses the earlier time at which the velocity is zero, where the acceleration has the opposite sign.", a_early), ("Reports zero, confusing a momentary stop with zero acceleration.", 1e-9 + 0.0),
                                  ("Reports the position at the later time instead of the acceleration.", float(x.subs(t_, sols[1]))), ("Reports the velocity coefficient $3A$ as the acceleration, forgetting to differentiate a second time.", 3.0 * A)], "m/s^2", fmt=lambda v: Q(v, "m/s^2") if abs(v) > 1e-6 else "$0\\text{ m/s}^{2}$")
    stem = f"A particle moves along the $x$-axis with position $x(t)={_P([A, -int(B), C, 0])}$, where $x$ is in meters and $t$ is in seconds. The particle is momentarily at rest twice for $t>0$. What is its acceleration at the later of the two times?"
    return MQ("pc_xt_poly_rest_accel", "1.2", "2.B", stem, key, ds, rng, "A momentary stop is where the velocity, not the acceleration, is zero", ["Find the velocity as the derivative of the position and solve for the times when it is zero", "Differentiate again and evaluate the acceleration at the later time"],
              "sympy roots of the derivative; a finite-difference second derivative recomputes the acceleration", f"$v={3 * A}t^2-{2 * int(B)}t+{C}$ is zero at $t={sig(sols[0])}\\text{{ s}}$ and $t={sig(sols[1])}\\text{{ s}}$; $a=dv/dt={6 * A}t-{2 * int(B)}$ at the later time is ${sig(a_late)}\\text{{ m/s}}^2$.", [f"A={A}", f"B={B}", f"C={C}"], est=110)


@retry_sep
def pc_vt_poly_displacement(rng):
    for _ in forever():
        b = pick(rng, [4, 6, 8, 9, 12]); c = pick(rng, [1, 2, 3]); T = pick(rng, [4, 5, 6, 8])
        tz = b / c
        if not (tz < T and tz > 1):
            continue
        v = b * t_ - c * t_ ** 2
        disp = float(sp.integrate(v, (t_, 0, T))); dist = float(sp.integrate(v, (t_, 0, tz)) - sp.integrate(v, (t_, tz, T)))
        f = sp.lambdify(t_, v, "math"); agree(disp, simpson(f, 0, T), 1e-6, "disp"); agree(dist, simpson(lambda s: abs(f(s)), 0, T, 20001), 1e-4, "dist")
        if disp != 0 and abs(disp) > 3 and abs(abs(disp) - dist) > 1:
            break
    key, ds = signed_opts(disp, [("Reports the total distance traveled, adding the areas without regard to the sign of the velocity.", dist), ("Multiplies the final velocity by the elapsed time, as if the velocity were constant.", float(v.subs(t_, T)) * T),
                                ("Multiplies the average of the initial and final velocities by the elapsed time, which holds only for constant acceleration.", float(v.subs(t_, T)) * T / 2), ("Evaluates the velocity function at the end instead of integrating it.", float(v.subs(t_, T)))], "m")
    stem = f"A cart moves along a straight line with velocity $v(t)={b}t-{c}t^2$, where $v$ is in meters per second and $t$ is in seconds. What is the displacement of the cart from $t=0$ to $t={T}\\text{{ s}}$?"
    return MQ("pc_vt_poly_displacement", "1.2", "2.B", stem, key, ds, rng, "Displacement is the time integral of velocity, with sign", ["Integrate the velocity over the interval", "Keep the sign, because the cart reverses direction in the interval"],
              "sympy definite integral versus a Simpson integration of the same function; the distance uses the integral of |v|", f"$\\Delta x=\\int_0^{{{T}}}({b}t-{c}t^2)\\,dt={b}\\cdot{T}^2/2-{c}\\cdot{T}^3/3={sig(disp)}\\text{{ m}}$.", [f"b={b}", f"c={c}", f"T={T}"], est=100)


@retry_sep
def pc_at_linear_velocity(rng):
    for _ in forever():
        k = pick(rng, [0.5, 1.0, 1.5, 2.0, 3.0]); v0 = pick(rng, [-4.0, -2.0, 2.0, 3.0, 5.0]); T = pick(rng, [2.0, 3.0, 4.0])
        vf = v0 + k * T ** 2 / 2
        tt = np.linspace(0, T, 40001); agree(vf, v0 + float(np.trapezoid(k * tt, tt)), 1e-8, "v")
        if vf != 0 and abs(vf) > 2:
            break
    key, ds = signed_opts(vf, [("Treats the acceleration at the final time as constant, $v_0+kT\\cdot T$.", v0 + k * T * T), ("Forgets the initial velocity and reports only the change in velocity.", k * T ** 2 / 2),
                              ("Integrates twice, adding a position-like term $kT^3/6$ to the initial velocity.", v0 + k * T ** 3 / 6),
                              ("Integrates but leaves out the factor of one half, $v_0+kT^2$.", v0 + k * T ** 2)], "m/s")
    stem = f"A particle moves along a straight line. Its acceleration is $a(t)={k:g}t$, where $a$ is in $\\text{{m/s}}^2$ and $t$ is in seconds. At $t=0$ its velocity is ${v0:g}\\text{{ m/s}}$. What is its velocity at $t={T:g}\\text{{ s}}$?"
    return MQ("pc_at_linear_velocity", "1.2", "2.B", stem, key, ds, rng, "Velocity changes by the time integral of acceleration", ["Integrate the acceleration function from zero to the final time", "Add the result to the initial velocity"],
              "sympy integral versus numpy trapezoid integration of the acceleration", f"$v=v_0+\\int_0^T kt\\,dt=v_0+kT^2/2={v0:g}+{sig(k * T * T / 2)}={sig(vf)}\\text{{ m/s}}$.", [f"k={k}", f"v0={v0}", f"T={T}"], est=90)


@retry_sep
def pc_xt_avg_vs_inst_claim(rng):
    A = pick(rng, [2, 3, 4]); T = pick(rng, [2, 4, 6])
    x = A * t_ ** 2; f = sp.lambdify(t_, x, "math")
    avg = (f(T) - f(0)) / T; v_mid = nd(f, T / 2); v_end = nd(f, T)
    agree(avg, v_mid, 1e-6, "avg=mid"); agree(v_end, 2 * avg, 1e-6, "end")
    h = T // 2; vel = f"{2 * A}t"
    key, ds = sentence_options(f"The average velocity, ${sig(avg)}\\text{{ m/s}}$, equals the instantaneous velocity at $t={h}\\text{{ s}}$, because the velocity ${vel}$ is linear in time.", f"For $x={A}t^2$ the velocity ${vel}$ is linear, so its average over an interval equals its value at the midpoint of the interval.",
                               [(f"The average velocity, ${sig(avg)}\\text{{ m/s}}$, equals the instantaneous velocity at $t={T}\\text{{ s}}$, because the velocity at the end of an interval is its average.", "Identifies the average velocity over an interval with the final instantaneous velocity."),
                                (f"The average velocity is ${sig(f(T) / 2 / T)}\\text{{ m/s}}$, half of the correct value, because the particle starts from rest.", "Halves the average velocity because the initial velocity is zero, instead of using the position change divided by the time."),
                                (f"The average velocity, ${sig(avg)}\\text{{ m/s}}$, has no relation to any instantaneous velocity, because the position is not linear in time.", "Believes that average and instantaneous velocities are never related when the position is not linear in time.")])
    stem = f"A particle moves along the $x$-axis with position $x(t)={A}t^2$, where $x$ is in meters and $t$ is in seconds. Which statement about the average velocity from $t=0$ to $t={T}\\text{{ s}}$ is correct and best justified?"
    return MQ("pc_xt_avg_vs_inst_claim", "1.2", "3.B", stem, key, ds, rng, "Average velocity versus instantaneous velocity for constant acceleration", ["Find the velocity function by differentiating", "Compare the average velocity with instantaneous values"],
              "the average velocity from position values and the instantaneous velocity from a central finite difference at the midpoint and the end are compared numerically", "", [f"A={A}", f"T={T}"], est=90, judg=["law_selection", "justification"])


@retry_sep
def pc_cliff_horizontal_launch(rng):
    for _ in forever():
        h = pick(rng, [20.0, 30.0, 45.0, 60.0, 80.0]); v0 = pick(rng, [5.0, 8.0, 10.0, 12.0, 15.0])
        t = math.sqrt(2 * h / CG); d = v0 * t
        y = rk4(lambda tt, s: np.array([s[2], s[3], 0.0, -CG]), [0, h, v0, 0], 0, t, 4000); agree(0.0, abs(y[1]), 1e-3, "ground"); agree(d, y[0], 1e-6, "d")
        if 10 < d < 80:
            break
    key, ds = num_opts(d, [("Uses the fall time for a drop of $h$ with no factor of two, $\\sqrt{h/g}$, in the distance.", v0 * math.sqrt(h / CG)), ("Uses $v_0 h/g$, mixing the height into the time of flight.", v0 * h / CG),
                           ("Assumes the horizontal speed grows with time under gravity, using the speed just before impact times the fall time.", math.hypot(v0, math.sqrt(2 * CG * h)) * t), ("Divides the height by the time rather than multiplying the speed by the time.", h / t)], "m")
    stem = f"A rock is thrown horizontally at ${v0:g}\\text{{ m/s}}$ from the edge of a cliff that is ${h:g}\\text{{ m}}$ above level ground. Air resistance is negligible. How far from the base of the cliff does the rock land?"
    return MQ("pc_cliff_horizontal_launch", "1.5", "2.B", stem, key, ds, rng, "Independent horizontal and vertical motion of a projectile", ["Use the vertical motion alone to find the time of fall", "Multiply the constant horizontal velocity by that time"],
              "closed form versus an RK4 integration of the projectile until it reaches the ground", f"The fall time is $t=\\sqrt{{2h/g}}={sig(t)}\\text{{ s}}$ and the distance is $v_0t={sig(d)}\\text{{ m}}$.", [f"h={h}", f"v0={v0}"], est=95)


@retry_sep
def pc_projectile_scaling(rng):
    k = pick(rng, [2, 3]); case = rng.randrange(3)
    th = pick(rng, [30, 40, 50, 60]); v0 = pick(rng, [10.0, 15.0, 20.0])
    rr = lambda v: v * v * math.sin(2 * math.radians(th)) / CG  # noqa: E731
    hh = lambda v: (v * math.sin(math.radians(th))) ** 2 / (2 * CG)  # noqa: E731
    tt = lambda v: 2 * v * math.sin(math.radians(th)) / CG  # noqa: E731
    fn, nm, ex = [(rr, "horizontal range", 2), (hh, "maximum height", 2), (tt, "time of flight", 1)][case]
    ans = fn(k * v0) / fn(v0); agree(ans, k ** ex, 1e-9, "ratio")
    wrong = [("Scales linearly with the launch speed, $\\times k$.", float(k)), (f"Scales with the cube of the launch speed.", float(k ** 3)), ("Scales as the square root of the launch speed.", math.sqrt(k)), ("Does not change, because the launch angle is the same.", 1.0), (f"Scales as $k^2$ times two, doubling the effect of the square.", float(2 * k * k))]
    key, ds = num_opts(float(k ** ex), wrong, "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A projectile is launched from level ground at an angle of ${th}^\\circ$ above the horizontal with speed $v_0$. Air resistance is negligible. The launch speed is changed to ${k}v_0$ with the same launch angle. By what factor does the {nm} change?"
    return MQ("pc_projectile_scaling", "1.5", "2.D", stem, key, ds, rng, "Scaling of projectile quantities with launch speed", ["Write the quantity as a function of $v_0$ and the angle", "Find the factor from the power of $v_0$ in that function"],
              "the quantity is evaluated numerically at $v_0$ and $kv_0$ and the ratio is compared with $k$ to the stated power", f"The {nm} is proportional to $v_0^{ex}$, so multiplying $v_0$ by {k} multiplies it by ${k ** ex}$.", [f"k={k}", f"case={case}", f"th={th}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_river_drift(rng):
    for _ in forever():
        w = pick(rng, [60.0, 80.0, 100.0, 120.0]); vb = pick(rng, [2.0, 3.0, 4.0, 5.0]); vr = pick(rng, [1.0, 1.5, 2.0, 2.5, 3.0])
        t = w / vb; d = vr * t
        pos = np.array([0.0, 0.0]); tt = np.linspace(0, t, 4001)
        xs = np.cumsum(np.full(4000, vr * (tt[1] - tt[0]))); agree(d, xs[-1], 1e-6, "drift")
        break
    key, ds = num_opts(d, [("Divides the river width by the speed of the current, $w/v_r$.", w / vr), ("Multiplies the width by the ratio $v_b/v_r$ (inverted).", w * vb / vr), ("Uses the resultant speed in the crossing time, $w/\\sqrt{v_b^2+v_r^2}$ times $v_r$.", vr * w / math.hypot(vb, vr)),
                           ("Reports the width of the river as the drift.", w)], "m")
    stem = f"A boat can move at ${vb:g}\\text{{ m/s}}$ relative to still water. The boat is pointed straight across a river of width ${w:g}\\text{{ m}}$ and keeps that heading. The river current is ${vr:g}\\text{{ m/s}}$ parallel to the banks. How far downstream from the starting point does the boat reach the far bank?"
    return MQ("pc_river_drift", "1.4", "2.B", stem, key, ds, rng, "Relative motion: independent perpendicular components", ["Find the crossing time from the component across the river", "Multiply the current speed by that time to find the drift"],
              "the downstream position is accumulated numerically over the crossing time", f"The crossing time is $w/v_b={sig(t)}\\text{{ s}}$ and the drift is $v_rt={sig(d)}\\text{{ m}}$.", [f"w={w}", f"vb={vb}", f"vr={vr}"], est=90)


@retry_sep
def pc_position_vector_speed(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [1, 2, 3]); t0 = pick(rng, [1, 2, 3])
        vx = a; vy = 2 * b * t0; s = math.hypot(vx, vy)
        fx = lambda t: a * t; fy = lambda t: b * t * t  # noqa: E731
        agree(s, math.hypot(nd(fx, t0), nd(fy, t0)), 1e-6, "s")
        break
    r = math.hypot(a * t0, b * t0 * t0)
    key, ds = num_opts(s, [("Divides the magnitude of the position vector by the time, which is an average speed from the origin.", r / t0), (f"Adds the components of the velocity instead of combining them as a vector sum, ${vx}+{vy}$.", vx + vy),
                           (f"Uses only the $y$-component of the velocity, ${vy}\\text{{ m/s}}$.", vy), (f"Uses only the horizontal velocity component, ${vx}\\text{{ m/s}}$.", float(vx)), ("Reports the magnitude of the position vector at the given time.", r)], "m/s")
    stem = f"A particle moves in the $xy$-plane with position $\\vec r(t)=({a}t)\\,\\hat x+({b}t^2)\\,\\hat y$, where lengths are in meters and $t$ is in seconds. What is the speed of the particle at $t={t0}\\text{{ s}}$?"
    return MQ("pc_position_vector_speed", "1.5", "2.B", stem, key, ds, rng, "Speed from the derivative of a two-dimensional position vector", ["Differentiate each component of the position", "Combine the components of the velocity with the Pythagorean theorem"],
              "sympy derivatives versus central differences of each component", f"$v_x={a}$ and $v_y=2({b})t={vy}\\text{{ m/s}}$, so the speed is $\\sqrt{{{a}^2+{vy}^2}}={sig(s)}\\text{{ m/s}}$.", [f"a={a}", f"b={b}", f"t0={t0}"], est=95)


@retry_sep
def pc_impact_angle(rng):
    for _ in forever():
        h = pick(rng, [20.0, 45.0, 80.0]); v0 = pick(rng, [10.0, 15.0, 20.0, 25.0])
        vy = math.sqrt(2 * CG * h); ang = math.degrees(math.atan2(vy, v0))
        y = rk4(lambda tt, s: np.array([s[2], s[3], 0.0, -CG]), [0, h, v0, 0], 0, math.sqrt(2 * h / CG), 4000); agree(ang, math.degrees(math.atan2(-y[3], y[2])), 1e-5, "ang")
        break
    key, ds = num_opts(ang, [("Uses $\\tan^{-1}(v_0/v_y)$, inverting the ratio of the components.", math.degrees(math.atan2(v0, vy))), ("Uses the height divided by the horizontal speed, $\\tan^{-1}(h/v_0)$.", math.degrees(math.atan(h / v0))),
                             ("Uses the average vertical speed during the fall, $v_y/2$, instead of the final vertical speed.", math.degrees(math.atan2(vy / 2, v0))), ("Assumes the ball lands at $45^\\circ$ for any launch speed.", 45.0)], "degrees", fmt=lambda v: f"${sig(v, 3)}^\\circ$ below the horizontal")
    stem = f"A ball is thrown horizontally at ${v0:g}\\text{{ m/s}}$ from a height of ${h:g}\\text{{ m}}$ above level ground. Air resistance is negligible. At what angle below the horizontal is the ball moving just before it hits the ground?"
    return MQ("pc_impact_angle", "1.5", "2.B", stem, key, ds, rng, "Direction of the velocity vector from its components", ["Find the vertical speed from the fall height", "Take the inverse tangent of the ratio of the vertical to the horizontal component"],
              "an RK4 integration of the projectile gives the components at the ground and their ratio", f"$v_y=\\sqrt{{2gh}}={sig(vy)}\\text{{ m/s}}$ and $\\tan\\theta=v_y/v_x$, so $\\theta={sig(ang)}^\\circ$.", [f"h={h}", f"v0={v0}"], est=100)


@retry_sep
def pc_xt_graph_speed_rank(rng):
    for _ in forever():
        r1 = pick(rng, [1.0, 1.5]); r2 = r1 + pick(rng, [1.5, 2.0, 2.5]); s_ = pick(rng, [0.5, 1.0])
        f = lambda t: s_ * (t - r1) * (t - r2) * (t - 0.0) * 1.0  # noqa: E731
        tl = sorted(rng.sample([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5], 4))
        labs = ["P", "Q", "R", "S"]; vals = {L: abs(nd(f, t)) for L, t in zip(labs, tl)}
        try:
            key, ds, order = rank_opts(vals, labs, [("Ranks by the position value at each time rather than the slope.", {L: abs(f(t)) + 1e-3 * i for i, (L, t) in enumerate(zip(labs, tl))}),
                                                    ("Ranks by time order, assuming the particle speeds up all the time.", {L: tt for L, tt in zip(labs, tl)}),
                                                    ("Ranks by the signed slope, so downward slopes rank lowest.", {L: nd(f, t) + 1e-3 * i for i, (L, t) in enumerate(zip(labs, tl))}),
                                                    ("Ranks by the reversed time order.", {L: -tt for L, tt in zip(labs, tl)})])
        except ValueError:
            continue
        break
    stim = dense_graph_stim("Position versus time with four marked times", f, 0, 4.0, gaxis("Time (s)", 0, 4, 0.5), gaxis("Position (m)", math.floor(min(f(x / 20) for x in range(81)) - 1), math.ceil(max(f(x / 20) for x in range(81)) + 1), 1), n=161)
    stem = f"The graph shows the position of a particle that moves along a straight line. Four times are marked: P at $t={tl[0]:g}\\text{{ s}}$, Q at ${tl[1]:g}\\text{{ s}}$, R at ${tl[2]:g}\\text{{ s}}$, and S at ${tl[3]:g}\\text{{ s}}$. Which ranking orders the speed of the particle at the four times from greatest to least?"
    return MQ("pc_xt_graph_speed_rank", "1.3", "2.C", stem, key, ds, rng, "Speed is the magnitude of the slope of a position-time graph", ["Estimate the slope of the tangent at each marked time", "Rank the magnitudes of the slopes, ignoring sign"],
              "the slopes are computed by central differences of the plotted function", f"The magnitudes of the slopes at P, Q, R and S rank as {key.text}.", [f"r1={r1}", f"r2={r2}", f"s={s_}", f"tl={tl}"], stim=stim, est=110, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "quantitative_comparison"])


@retry_sep
def pc_sym_stopping_distance(rng):
    v0 = pick(rng, [12.0, 16.0, 20.0, 24.0]); a = pick(rng, [2.0, 3.0, 4.0, 5.0])
    dsym = sp.symbols("d"); sol = sp.solve(sp.Eq(0, sp.Symbol("v0") ** 2 - 2 * sp.Symbol("a") * dsym), dsym)[0]
    val = float(sol.subs({sp.Symbol("v0"): v0, sp.Symbol("a"): a}))
    Tst = v0 / a; yy = rk4(lambda tt, s: np.array([s[1], -a]), [0.0, v0], 0.0, Tst, 4000); agree(val, yy[0], 1e-6, "d")
    env = {"v": v0, "a": a}
    key, ds = sym_opts("\\frac{v^2}{2a}", val, [("Uses the speed to the first power, $v/(2a)$.", "\\frac{v}{2a}"), ("Omits the factor of two, $v^2/a$.", "\\frac{v^2}{a}"), ("Inverts the relation, $2a/v^2$.", "\\frac{2a}{v^2}"), ("Uses $v^2/(2a)$ with $v$ replaced by its half, $v^2/(8a)$.", "\\frac{v^2}{8a}")], env)
    stem = f"A car moving at speed $v$ brakes to a stop with constant deceleration of magnitude $a$. Which expression gives the distance traveled while stopping?"
    return MQ("pc_sym_stopping_distance", "1.2", "2.A", stem, key, ds, rng, "Derive a distance from constant-acceleration kinematics", ["Choose the kinematic relation that does not contain time", "Solve it for the distance"],
              "sympy solves the kinematic relation for the distance and each option is evaluated numerically with the same values", "The relation $0=v^2-2ad$ gives $d=v^2/(2a)$.", [f"v={v0}", f"a={a}"], est=70, judg=["symbolic_reasoning"])


@retry_sep
def pc_two_cars_catch_up(rng):
    for _ in forever():
        vA = pick(rng, [8.0, 10.0, 12.0, 15.0]); a = pick(rng, [1.0, 2.0, 2.5, 4.0])
        t = 2 * vA / a; d = vA * t
        tn = bisect(lambda s: 0.5 * a * s * s - vA * s, 1.0, 1000.0); agree(t, tn, 1e-9, "t")
        if 4 < t < 25:
            break
    key, ds = num_opts(d, [(f"Uses the time when the speeds are equal, $t=v_A/a={sig(vA / a)}\\text{{ s}}$, so the distance is $v_A^2/a={sig(vA ** 2 / a)}\\text{{ m}}$.", vA ** 2 / a), (f"Uses the distance that car B needs to reach the speed $v_A$, $v_A^2/(2a)={sig(vA ** 2 / (2 * a))}\\text{{ m}}$, which is where B is when the speeds match.", vA ** 2 / (2 * a)),
                           (f"Reports the time at which the cars meet, $2v_A/a={sig(t)}\\text{{ s}}$, as if it were the distance.", t)], "m")
    stem = f"A car A travels at a constant ${vA:g}\\text{{ m/s}}$. At $t=0$ it passes a stationary car B, which immediately starts from rest with constant acceleration ${a:g}\\text{{ m/s}}^2$ in the same direction. How far from the starting point does car B catch up with car A?"
    return MQ("pc_two_cars_catch_up", "1.2", "2.B", stem, key, ds, rng, "Equal positions, not equal speeds, define when one object catches another", ["Write the position of each car as a function of time", "Set the positions equal, solve for the nonzero time, and find the distance"],
              "sympy solves the position equation; a bisection root finder on the position difference recomputes the time", f"$v_At=\\tfrac12at^2$ gives $t=2v_A/a={sig(t)}\\text{{ s}}$ and the distance is $v_At={sig(d)}\\text{{ m}}$.", [f"vA={vA}", f"a={a}"], est=100)


STAGE_U1 = ["pc_xt_poly_velocity", "pc_xt_poly_rest_accel", "pc_vt_poly_displacement", "pc_at_linear_velocity", "pc_xt_avg_vs_inst_claim", "pc_cliff_horizontal_launch", "pc_projectile_scaling", "pc_river_drift",
            "pc_position_vector_speed", "pc_impact_angle", "pc_xt_graph_speed_rank", "pc_sym_stopping_distance", "pc_two_cars_catch_up"]


# 2026-10-20 1차 생성(physc-mc/sets/frq) 검토 결과를 반영해 설명·선택지·문장을 고친 원형 — 같은 틀에서 새 시드로 다시 생성한다(physc_fix1). 1차 런의 같은 원형 후보는 재고에서 뺀다(phys-finalize --exclude).
STAGE_FIX1 = ["pc_xt_avg_vs_inst_claim", "pc_position_vector_speed", "pc_two_cars_catch_up", "pc_drag_exp_speed", "pc_circular_scaling", "pc_elevator_scale", "pc_newton3_claim", "pc_com_discrete",
              "pc_work_variable_force_poly", "pc_stable_equilibrium", "pc_rough_patch_speed", "pc_energy_power_poly", "pc_loop_min_height", "pc_gravity_path_claim", "pc_energy_graph_ke", "pc_rank_ramp_speeds",
              "pc_impulse_force_poly", "pc_ballistic_pendulum", "pc_com_velocity_system", "pc_sym_inelastic_speed", "pc_rank_impulse_bounce", "pc_momentum_graph_force", "pc_rot_kin_stop_turns", "pc_torque_pivot_claim",
              "pc_rolling_incline_speed", "pc_rolling_speed_ratio", "pc_orbit_energy_ratio", "pc_particle_ang_mom_line", "pc_shm_g_independence_claim", "pc_spring_parallel_period", "pc_shm_time_fraction",
              "pc_shm_xt_graph_claim", "pc_shm_scaling", "pc_shm_ode_period", "pc_shm_energy_scaling", "pcs_shm_energy_set", "pcs_drag_graph_set",
              "pcf_mr_variable_force_block", "pcf_tbr_work_energy_graph", "pcf_mr_drag_fall", "pcf_lab_terminal_speed"]

# 2026-10-20 2차 검토(physc-fix1·physc-b) 결과를 반영해 다시 고친 원형(physc_fix2).
STAGE_FIX2 = ["pc_xt_avg_vs_inst_claim", "pc_two_cars_catch_up", "pc_rank_impulse_bounce", "pc_vt_sine_displacement", "pc_rain_on_car", "pc_conical_pendulum_period", "pc_block_drop_spring_compression",
              "pc_power_from_position", "pc_perp_collision_speed", "pcs_torque_graph_set", "pcf_qqt_orbit_energy"]

# 3차 수선: 표 설명의 LaTeX 가 화면에서 원문으로 노출되던 FRQ(figure_label_latex_leak)를 평문 설명으로 고쳐 다시 생성한다(physc_fix3).
STAGE_FIX3 = ["pcf_lab_rolling_incline"]

# 3차 생성(physc-g) 검토 결과를 반영해 고친 원형(physc_fix4).
STAGE_FIX4 = ["pc_hooke_table_constant", "pc_net_torque_two_forces", "pc_exp_decay_distance", "pcs_fx_signed_set", "pcs_vt_shm_set", "pcf_lab_disk_inertia"]

# 4차 생성(physc-h) 검토 결과를 반영해 고친 FRQ(physc_fix5): 에너지 보존 풀이도 인정하고 C2 의 선행 행 의존을 없앴다.
STAGE_FIX5 = ["pcf_tbr_shm_phase_graphs"]
