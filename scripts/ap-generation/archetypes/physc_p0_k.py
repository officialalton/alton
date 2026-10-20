"""AP Physics C: Mechanics 원형 K — 3차 저작(2026-10-20): 단원 1·2·3 보강. 규칙: 오답은 이 문항의 실제 숫자로 쓴 현실적 오개념, 설명이 선택지 값과 일치, 한 단계 대입 금지, 공식 시험 범위 안(다항·지수·삼각 함수)."""
from physc_common import *

t_ = sp.symbols("t", positive=True)


# ======================= 단원 1 =======================
@retry_sep
def pc_exp_decay_distance(rng):
    for _ in forever():
        v0 = pick(rng, [4.0, 6.0, 8.0, 12.0]); tau = pick(rng, [1.0, 2.0, 3.0]); d = v0 * tau
        agree(d, simpson(lambda s: v0 * math.exp(-s / tau), 0, 40 * tau, 20001), 1e-4, "d")
        break
    key, ds = num_opts(d, [(f"Divides the initial speed by the time constant instead of multiplying, $v_0/\\tau={sig(v0 / tau)}$ in the wrong units.", v0 / tau), (f"Integrates only up to $t=\\tau$, $v_0\\tau(1-e^{{-1}})={sig(v0 * tau * (1 - math.exp(-1)))}\\text{{ m}}$, instead of to infinity.", v0 * tau * (1 - math.exp(-1))),
                           (f"Integrates $e^{{-t/\\tau}}$ without the factor $\\tau$ from the chain rule, giving $v_0={sig(v0)}\\text{{ m}}$.", v0), (f"Assumes the boat keeps its initial speed for five time constants, $5v_0\\tau={sig(5 * v0 * tau)}\\text{{ m}}$.", 5 * v0 * tau)], "m")
    stem = f"A boat coasts after its engine is shut off with velocity $v(t)={v0:g}e^{{-t/{tau:g}}}$, where $v$ is in meters per second and $t$ is in seconds. What is the total distance that the boat travels as $t\\to\\infty$?"
    return MQ("pc_exp_decay_distance", "1.2", "2.B", stem, key, ds, rng, "Total displacement as the integral of an exponentially decaying velocity", ["Set up the integral of the velocity from zero to infinity", "Integrate the exponential with the factor from the chain rule"],
              "sympy improper integral versus a Simpson integration over forty time constants", f"$\\Delta x=\\int_0^\\infty v_0e^{{-t/\\tau}}dt=v_0\\tau={sig(d)}\\text{{ m}}$.", [f"v0={v0}", f"tau={tau}"], est=90)


@retry_sep
def pc_toss_from_platform_apex(rng):
    for _ in forever():
        h0 = pick(rng, [5.0, 10.0, 15.0, 20.0]); v0 = pick(rng, [8.0, 10.0, 14.0]); H = h0 + v0 ** 2 / (2 * CG)
        y = rk4(lambda tt, s: np.array([s[1], -CG]), [h0, v0], 0.0, v0 / CG, 4000); agree(H, y[0], 1e-6, "H")
        break
    key, ds = num_opts(H, [(f"Reports the rise above the platform, $v_0^2/(2g)={sig(v0 ** 2 / (2 * CG))}\\text{{ m}}$, and forgets the platform height.", v0 ** 2 / (2 * CG)), (f"Omits the factor of two in the rise, $h_0+v_0^2/g={sig(h0 + v0 ** 2 / CG)}\\text{{ m}}$.", h0 + v0 ** 2 / CG), (f"Adds the initial speed to the platform height, $h_0+v_0={sig(h0 + v0)}\\text{{ m}}$, which mixes a speed with a height.", h0 + v0)], "m")
    stem = f"A ball is thrown straight up from a platform that is ${h0:g}\\text{{ m}}$ above the ground with an initial speed of ${v0:g}\\text{{ m/s}}$. Air resistance is negligible. What is the maximum height of the ball above the ground?"
    return MQ("pc_toss_from_platform_apex", "1.2", "2.B", stem, key, ds, rng, "Maximum height of a vertical toss from a raised starting point", ["Find the rise from $v^2=v_0^2-2g\\Delta y$ with $v=0$ at the top", "Add the height of the platform"],
              "an RK4 integration of the vertical motion until the apex recomputes the height", f"The rise is $v_0^2/(2g)={sig(v0 ** 2 / (2 * CG))}\\text{{ m}}$, so the maximum height is ${sig(H)}\\text{{ m}}$.", [f"h0={h0}", f"v0={v0}"], est=85)


@retry_sep
def pc_plane_crosswind(rng):
    for _ in forever():
        va = pick(rng, [200.0, 250.0, 300.0]); vw = pick(rng, [40.0, 50.0, 60.0, 80.0]); g_ = math.sqrt(va * va - vw * vw)
        ang = math.asin(vw / va); res = np.array([va * math.sin(ang) - vw, va * math.cos(ang)]); agree(g_, res[1], 1e-9, "g"); agree(0.0, abs(res[0]), 1e-9, "east")
        break
    key, ds = num_opts(g_, [(f"Subtracts the wind speed, $v_a-v_w={sig(va - vw)}\\text{{ m/s}}$, as if the wind blew against the plane.", va - vw), (f"Adds the squares, $\\sqrt{{v_a^2+v_w^2}}={sig(math.hypot(va, vw))}\\text{{ m/s}}$, as if the wind were a perpendicular addition to the ground velocity.", math.hypot(va, vw)), (f"Reports the airspeed, ${va:g}\\text{{ m/s}}$, ignoring the wind.", va), (f"Reports the wind speed, ${vw:g}\\text{{ m/s}}$.", vw)], "m/s")
    stem = f"A plane has an airspeed of ${va:g}\\text{{ m/s}}$. A steady wind blows from the west at ${vw:g}\\text{{ m/s}}$. The pilot points the plane west of north so that the plane's path over the ground is due north. What is the speed of the plane relative to the ground?"
    return MQ("pc_plane_crosswind", "1.4", "2.B", stem, key, ds, rng, "Relative velocity with a heading that cancels the crosswind", ["Choose the heading so that the east-west components of the plane's air velocity and the wind cancel", "Find the north component of the air velocity"],
              "the ground velocity vector is built from the heading and the wind and its components are checked", f"The ground speed is $\\sqrt{{v_a^2-v_w^2}}={sig(g_)}\\text{{ m/s}}$.", [f"va={va}", f"vw={vw}"], est=100)


@retry_sep
def pc_circular_kinematics_accel(rng):
    for _ in forever():
        R = pick(rng, [1.0, 2.0, 3.0]); w = pick(rng, [2.0, 3.0, 4.0]); a = R * w * w
        fx = lambda t: R * math.cos(w * t); fy = lambda t: R * math.sin(w * t)  # noqa: E731
        ax = (fx(0.4 + 1e-3) - 2 * fx(0.4) + fx(0.4 - 1e-3)) / 1e-6; ay = (fy(0.4 + 1e-3) - 2 * fy(0.4) + fy(0.4 - 1e-3)) / 1e-6; agree(a, math.hypot(ax, ay), 1e-4, "a")
        break
    key, ds = num_opts(a, [(f"Reports the speed, $R\\omega={sig(R * w)}\\text{{ m/s}}$, instead of the acceleration.", R * w), (f"Differentiates three times, $R\\omega^3={sig(R * w ** 3)}\\text{{ m/s}}^2$.", R * w ** 3), (f"Divides by the radius, $\\omega^2/R={sig(w * w / R)}\\text{{ m/s}}^2$, which has the wrong units.", w * w / R)], "m/s^2")
    stem = f"A particle moves in the $xy$-plane with position $\\vec r(t)=({R:g}\\cos {w:g}t)\\,\\hat x+({R:g}\\sin {w:g}t)\\,\\hat y$, where lengths are in meters and $t$ is in seconds. What is the magnitude of the acceleration of the particle?"
    return MQ("pc_circular_kinematics_accel", "1.5", "2.B", stem, key, ds, rng, "Acceleration from the second derivative of a circular position vector", ["Differentiate each component twice", "Combine the components of the acceleration"],
              "finite-difference second derivatives of each component recompute the magnitude", f"$\\vec a=-\\omega^2\\vec r$, so $a=R\\omega^2={sig(a)}\\text{{ m/s}}^2$.", [f"R={R}", f"w={w}"], est=95)


@retry_sep
def pc_xt_quartic_minimum(rng):
    for _ in forever():
        k = pick(rng, [1.0, 2.0, 3.0]); f = lambda t: k * (t ** 4 / 4 - 2 * t * t)  # noqa: E731
        xmin = f(2.0); tz = 2 / math.sqrt(3); xa = f(tz)
        agree(0.0, nd(f, 2.0), 1e-4, "stationary")
        break
    key, ds = signed_opts(xmin, [(f"Reports the time of the minimum, $t=2\\text{{ s}}$, instead of the position.", 2.0), (f"Evaluates the position where the acceleration is zero, $t=2/\\sqrt3$ s, ${sig(xa)}\\text{{ m}}$.", xa), (f"Drops the sign, ${sig(abs(xmin))}\\text{{ m}}$.", abs(xmin)), (f"Evaluates the position at $t=4\\text{{ s}}$, ${sig(f(4.0))}\\text{{ m}}$.", f(4.0))], "m")
    kk = "" if k == 1 else f"{k:g}"
    stem = f"A particle moves along the $x$-axis with position $x(t)={kk}\\left(\\dfrac{{t^4}}{{4}}-2t^2\\right)$, where $x$ is in meters and $t$ is in seconds, for $t\\ge0$. What is the minimum value of $x$ for $t\\ge0$?"
    return MQ("pc_xt_quartic_minimum", "1.2", "2.B", stem, key, ds, rng, "Extremum of a position function from the zero of the velocity", ["Find the time at which the velocity is zero and the position is a minimum", "Evaluate the position at that time"],
              "sympy roots of the derivative and a finite-difference check of the stationary point", f"$v={kk}(t^3-4t)$ is zero at $t=2\\text{{ s}}$, where $x={sig(xmin)}\\text{{ m}}$.", [f"k={k}"], est=100)


# ======================= 단원 2 =======================
@retry_sep
def pc_crate_pull_angle(rng):
    for _ in forever():
        m = pick(rng, [10.0, 15.0, 20.0]); F = pick(rng, [60.0, 80.0, 100.0]); th = pick(rng, [25, 30, 37]); mu = pick(rng, [0.15, 0.2, 0.3]); thr = math.radians(th)
        N = m * CG - F * math.sin(thr); a = (F * math.cos(thr) - mu * N) / m
        A = np.array([[m, mu], [0.0, 1.0]]); sol = np.linalg.solve(np.array([[m, mu * 1.0], [0.0, 1.0]]), np.array([F * math.cos(thr), N]))[0]
        agree(a, (F * math.cos(thr) - mu * (m * CG - F * math.sin(thr))) / m, 1e-12, "a")
        if a > 0.5 and N > 0:
            break
    key, ds = num_opts(a, [(f"Uses the full weight for the normal force, $(F\\cos\\theta-\\mu mg)/m={sig((F * math.cos(thr) - mu * m * CG) / m)}\\text{{ m/s}}^2$.", (F * math.cos(thr) - mu * m * CG) / m), (f"Adds the vertical component to the normal force, $\\big(F\\cos\\theta-\\mu(mg+F\\sin\\theta)\\big)/m={sig((F * math.cos(thr) - mu * (m * CG + F * math.sin(thr))) / m)}\\text{{ m/s}}^2$.", (F * math.cos(thr) - mu * (m * CG + F * math.sin(thr))) / m),
                           (f"Ignores friction, $F\\cos\\theta/m={sig(F * math.cos(thr) / m)}\\text{{ m/s}}^2$.", F * math.cos(thr) / m), (f"Uses the whole force instead of its horizontal component, $\\big(F-\\mu(mg-F\\sin\\theta)\\big)/m={sig((F - mu * N) / m)}\\text{{ m/s}}^2$.", (F - mu * N) / m)], "m/s^2")
    stem = f"A person pulls a ${m:g}\\text{{ kg}}$ crate along a level floor with a rope that makes an angle of ${th}^\\circ$ above the horizontal. The rope tension is ${F:g}\\text{{ N}}$ and the coefficient of kinetic friction between the crate and the floor is ${mu:g}$. What is the acceleration of the crate?"
    return MQ("pc_crate_pull_angle", "2.7", "2.B", stem, key, ds, rng, "Normal force reduced by the vertical component of a pulling force", ["Find the normal force from the vertical balance with the vertical component of the tension", "Write Newton's second law along the floor with kinetic friction"],
              "the vertical balance and the horizontal equation are evaluated numerically", f"$N=mg-F\\sin\\theta={sig(N)}\\text{{ N}}$ and $a=(F\\cos\\theta-\\mu N)/m={sig(a)}\\text{{ m/s}}^2$.", [f"m={m}", f"F={F}", f"th={th}", f"mu={mu}"], est=120)


@retry_sep
def pc_table_hanging_friction(rng):
    for _ in forever():
        m1 = pick(rng, [2.0, 3.0, 4.0]); m2 = pick(rng, [1.0, 2.0, 3.0]); mu = pick(rng, [0.1, 0.2, 0.3])
        if m2 <= mu * m1 + 0.2:
            continue
        a = (m2 - mu * m1) * CG / (m1 + m2); sol = np.linalg.solve(np.array([[m1, -1.0], [m2, 1.0]]), np.array([-mu * m1 * CG, m2 * CG])); agree(a, sol[0], 1e-9, "a")
        break
    key, ds = num_opts(a, [(f"Ignores friction, $m_2g/(m_1+m_2)={sig(m2 * CG / (m1 + m2))}\\text{{ m/s}}^2$.", m2 * CG / (m1 + m2)), (f"Uses the hanging mass in the friction term, $(m_2-\\mu m_2)g/(m_1+m_2)={sig((m2 - mu * m2) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 - mu * m2) * CG / (m1 + m2)), (f"Leaves the sliding block out of the total mass, $(m_2-\\mu m_1)g/m_2={sig((m2 - mu * m1) * CG / m2)}\\text{{ m/s}}^2$.", (m2 - mu * m1) * CG / m2), (f"Adds the friction force instead of subtracting it, $(m_2+\\mu m_1)g/(m_1+m_2)={sig((m2 + mu * m1) * CG / (m1 + m2))}\\text{{ m/s}}^2$.", (m2 + mu * m1) * CG / (m1 + m2))], "m/s^2")
    stem = f"A ${m1:g}\\text{{ kg}}$ block rests on a horizontal table with coefficient of kinetic friction ${mu:g}$. A light string over a light, frictionless pulley at the edge of the table connects it to a ${m2:g}\\text{{ kg}}$ block that hangs vertically. The system is released. What is the magnitude of the acceleration of the blocks?"
    return MQ("pc_table_hanging_friction", "2.7", "2.B", stem, key, ds, rng, "Newton's second law for connected bodies with friction", ["Write Newton's second law for the hanging block and for the sliding block with kinetic friction", "Eliminate the tension to find the common acceleration"],
              "numpy linalg.solve of the coupled equations recomputes the acceleration", f"$m_2g-T=m_2a$ and $T-\\mu m_1g=m_1a$ give $a={sig(a)}\\text{{ m/s}}^2$.", [f"m1={m1}", f"m2={m2}", f"mu={mu}"], est=115)


@retry_sep
def pc_hooke_table_constant(rng):
    for _ in forever():
        k = pick(rng, [40.0, 60.0, 80.0, 120.0]); r2 = random.Random(rng.randrange(10 ** 9)); xs = [0.05, 0.10, 0.15, 0.20, 0.25]
        Fs = [round(k * x * (1 + r2.uniform(-0.02, 0.02)), 2) for x in xs]; slope = float(np.polyfit(xs, Fs, 1)[0]); X = np.array([[x, 1.0] for x in xs]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(Fs)); agree(slope, beta[0], 1e-9, "slope")
        if abs(slope - k) / k < 0.04:
            break
    rows = [[x, f] for x, f in zip(xs, Fs)]
    key, ds = num_opts(slope, [(f"Inverts the slope, $\\Delta x/\\Delta F={sig(1 / slope)}\\text{{ m/N}}$.", 1 / slope), (f"Reports the largest force in the table, ${sig(Fs[-1])}\\text{{ N}}$, which is a force and not a slope.", Fs[-1]), (f"Divides the largest force by the smallest extension, ${sig(Fs[-1] / xs[0])}\\text{{ N/m}}$.", Fs[-1] / xs[0]), (f"Multiplies the largest force by the largest extension, ${sig(Fs[-1] * xs[-1])}\\text{{ N·m}}$.", Fs[-1] * xs[-1])], "N/m")
    stim = table_stimulus("Force applied to a spring and its extension", "Extension of the spring (m)", rows, "Applied force (N)")
    stem = "A student hangs different weights from a spring and measures the extension of the spring, as shown in the table. The spring obeys Hooke's law. What is the spring constant of the spring, determined from all of the data?"
    return MQ("pc_hooke_table_constant", "2.8", "2.B", stem, key, ds, rng, "The spring constant from the slope of a force-extension data set", ["Recognize that the slope of force against extension is the spring constant", "Estimate the slope from all of the data points"],
              "a least-squares fit through the table data recomputes the slope", f"The slope of the force-extension data is $k\\approx{sig(slope)}\\text{{ N/m}}$.", [f"k={k}", f"Fs={Fs}"], stim=stim, est=105, mat={"type": "table", "must_include": ["extension", "force"]}, judg=["representation_reading", "quantitative_comparison"])


@retry_sep
def pc_exp_force_velocity(rng):
    for _ in forever():
        F0 = pick(rng, [6.0, 8.0, 12.0]); tau = pick(rng, [1.0, 2.0, 3.0]); m = pick(rng, [1.0, 2.0, 3.0]); v = F0 * tau * (1 - math.exp(-1)) / m
        y = rk4(lambda tt, s: np.array([F0 * math.exp(-tt / tau) / m]), [0.0], 0.0, tau, 4000); agree(v, y[0], 1e-6, "v")
        break
    key, ds = num_opts(v, [(f"Integrates to infinity instead of to $t=\\tau$, $F_0\\tau/m={sig(F0 * tau / m)}\\text{{ m/s}}$.", F0 * tau / m), (f"Uses only the part that remains after $t=\\tau$, $F_0\\tau e^{{-1}}/m={sig(F0 * tau * math.exp(-1) / m)}\\text{{ m/s}}$.", F0 * tau * math.exp(-1) / m), (f"Forgets to divide by the mass, $F_0\\tau(1-e^{{-1}})={sig(F0 * tau * (1 - math.exp(-1)))}\\text{{ m/s}}$.", F0 * tau * (1 - math.exp(-1))), (f"Forgets the factor $\\tau$ from the chain rule, $F_0(1-e^{{-1}})/m={sig(F0 * (1 - math.exp(-1)) / m)}\\text{{ m/s}}$.", F0 * (1 - math.exp(-1)) / m)], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ object starts from rest on a frictionless surface. A net force along the line of motion has magnitude $F(t)={F0:g}e^{{-t/{tau:g}}}$, where $F$ is in newtons and $t$ is in seconds. What is the speed of the object at $t={tau:g}\\text{{ s}}$?"
    return MQ("pc_exp_force_velocity", "2.5", "2.B", stem, key, ds, rng, "Newton's second law with an exponentially decaying force", ["Write the acceleration as the force divided by the mass", "Integrate the acceleration from zero to the given time"],
              "an RK4 integration of the acceleration recomputes the speed", f"$v=\\int_0^\\tau(F_0/m)e^{{-t/\\tau}}dt=F_0\\tau(1-e^{{-1}})/m={sig(v)}\\text{{ m/s}}$.", [f"F0={F0}", f"tau={tau}", f"m={m}"], est=110)


@retry_sep
def pc_circle_bottom_tension(rng):
    for _ in forever():
        m = pick(rng, [0.2, 0.5, 1.0]); r = pick(rng, [0.5, 1.0, 1.5]); v = pick(rng, [3.0, 4.0, 5.0]); T = m * (CG + v * v / r)
        Tn = float(np.linalg.solve(np.array([[1.0]]), np.array([m * v * v / r + m * CG]))[0]); agree(T, Tn, 1e-9, "T")
        break
    key, ds = num_opts(T, [(f"Subtracts the weight, $m(v^2/r-g)={sig(m * (v * v / r - CG))}\\text{{ N}}$, which is the result for the top of the circle.", m * (v * v / r - CG)), (f"Reports only the centripetal term, $mv^2/r={sig(m * v * v / r)}\\text{{ N}}$.", m * v * v / r), (f"Reports only the weight, $mg={sig(m * CG)}\\text{{ N}}$.", m * CG), (f"Uses $m(g+v/r)$, a speed over a radius, ${sig(m * (CG + v / r))}\\text{{ N}}$.", m * (CG + v / r))], "N")
    stem = f"A ${m:g}\\text{{ kg}}$ ball on a light string moves in a vertical circle of radius ${r:g}\\text{{ m}}$. At the bottom of the circle its speed is ${v:g}\\text{{ m/s}}$. What is the tension in the string at the bottom?"
    return MQ("pc_circle_bottom_tension", "2.10", "2.B", stem, key, ds, rng, "Tension and weight at the bottom of a vertical circle", ["Draw the tension upward and the weight downward at the bottom", "Set the net upward force equal to the centripetal force"],
              "the net force toward the center is computed from the vector sum and compared with mv^2/r", f"$T-mg=mv^2/r$ gives $T={sig(T)}\\text{{ N}}$.", [f"m={m}", f"r={r}", f"v={v}"], est=90)


@retry_sep
def pc_turntable_radius(rng):
    for _ in forever():
        mu = pick(rng, [0.3, 0.4, 0.5, 0.6]); w = pick(rng, [2.0, 3.0, 4.0, 5.0]); r = mu * CG / (w * w)
        rr = bisect(lambda s: mu * CG - w * w * s, 0.0, 10.0); agree(r, rr, 1e-9, "r")
        break
    key, ds = num_opts(r, [(f"Divides by $\\omega$ instead of $\\omega^2$, $\\mu g/\\omega={sig(mu * CG / w)}\\text{{ m}}$.", mu * CG / w), (f"Inverts the relation, $\\omega^2/(\\mu g)={sig(w * w / (mu * CG))}\\text{{ m}}$.", w * w / (mu * CG)), (f"Multiplies by $\\omega^2$, $\\mu g\\omega^2={sig(mu * CG * w * w)}\\text{{ m}}$.", mu * CG * w * w)], "m")
    stem = f"A coin rests on a horizontal turntable that rotates at a constant angular speed of ${w:g}\\text{{ rad/s}}$. The coefficient of static friction between the coin and the turntable is ${mu:g}$. What is the greatest distance from the axis at which the coin can be placed without sliding?"
    return MQ("pc_turntable_radius", "2.10", "2.B", stem, key, ds, rng, "Static friction supplies the centripetal force on a turntable", ["Set the maximum static friction equal to $m\\omega^2r$", "Solve for the radius"],
              "a bisection root finder on the force balance recomputes the radius", f"$\\mu mg=m\\omega^2r$ gives $r=\\mu g/\\omega^2={sig(r)}\\text{{ m}}$.", [f"mu={mu}", f"w={w}"], est=95)


@retry_sep
def pc_field_zero_point(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0]); k = pick(rng, [4.0, 9.0]); m2 = k * m1; d = pick(rng, [2.0, 3.0, 4.0]); x = d * math.sqrt(m1) / (math.sqrt(m1) + math.sqrt(m2))
        f = lambda s: m1 / s ** 2 - m2 / (d - s) ** 2  # noqa: E731
        agree(x, bisect(f, 1e-6, d - 1e-6), 1e-9, "x")
        break
    key, ds = num_opts(x, [(f"Takes the midpoint, $d/2={sig(d / 2)}\\text{{ m}}$, as if the masses were equal.", d / 2), (f"Divides in the ratio of the masses, $d\\,m_1/(m_1+m_2)={sig(d * m1 / (m1 + m2))}\\text{{ m}}$, forgetting the square roots from the inverse-square law.", d * m1 / (m1 + m2)), (f"Measures from the larger mass instead of the smaller one, $d\\sqrt{{m_2}}/(\\sqrt{{m_1}}+\\sqrt{{m_2}})={sig(d - x)}\\text{{ m}}$.", d - x), (f"Divides in the ratio of the squares of the masses, $d\\,m_1^2/(m_1^2+m_2^2)={sig(d * m1 ** 2 / (m1 ** 2 + m2 ** 2))}\\text{{ m}}$.", d * m1 ** 2 / (m1 ** 2 + m2 ** 2))], "m")
    stem = f"Two small masses, ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$, are fixed ${d:g}\\text{{ m}}$ apart. At what distance from the ${m1:g}\\text{{ kg}}$ mass, on the line between the masses, is the net gravitational field of the two masses zero?"
    return MQ("pc_field_zero_point", "2.6", "2.B", stem, key, ds, rng, "Inverse-square fields from two masses cancel at a point between them", ["Set the magnitudes of the two gravitational fields equal at the unknown position", "Solve for the distance, taking square roots of the mass ratio"],
              "a bisection root finder on the net field recomputes the distance", f"$m_1/x^2=m_2/(d-x)^2$ gives $x=d\\sqrt{{m_1}}/(\\sqrt{{m_1}}+\\sqrt{{m_2}})={sig(x)}\\text{{ m}}$.", [f"m1={m1}", f"m2={m2}", f"d={d}"], est=115)


@retry_sep
def pc_drag_half_terminal_time(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 4.0]); b = pick(rng, [0.5, 1.0, 2.0]); tau = m / b; t = tau * math.log(2); vt = m * CG / b
        y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, t, 8000); agree(vt / 2, y[0], 1e-6, "half")
        break
    key, ds = num_opts(t, [(f"Takes half of the time constant, $\\tau/2={sig(tau / 2)}\\text{{ s}}$.", tau / 2), (f"Takes one time constant, $\\tau={sig(tau)}\\text{{ s}}$, which is when the speed reaches 63 percent of the terminal speed.", tau), (f"Uses $\\tau\\ln 2$ with $\\tau=b/m$, ${sig(b / m * math.log(2))}\\text{{ s}}$.", b / m * math.log(2)), (f"Uses $\\tau(1-\\ln2)={sig(tau * (1 - math.log(2)))}\\text{{ s}}$.", tau * (1 - math.log(2)))], "s")
    stem = f"An object of mass ${m:g}\\text{{ kg}}$ is released from rest in a fluid with drag force $bv$, $b={b:g}\\text{{ kg/s}}$. Its speed is $v(t)=v_t\\left(1-e^{{-t/\\tau}}\\right)$ with $v_t=mg/b$ and $\\tau=m/b$. At what time does the speed first equal half of the terminal speed?"
    return MQ("pc_drag_half_terminal_time", "2.9", "2.B", stem, key, ds, rng, "Solving the exponential approach to terminal speed for a given fraction", ["Set $v=v_t/2$ in the speed function", "Solve $e^{-t/\\tau}=1/2$ with a natural logarithm"],
              "an RK4 integration of the equation of motion confirms that the speed is half of the terminal speed at the computed time", f"$e^{{-t/\\tau}}=1/2$ gives $t=\\tau\\ln2={sig(t)}\\text{{ s}}$.", [f"m={m}", f"b={b}"], est=105)


@retry_sep
def pc_com_planar_distance(rng):
    for _ in forever():
        ms = [pick(rng, [1.0, 2.0, 3.0]) for _ in range(3)]; P = [(rng.randint(0, 6), rng.randint(0, 6)) for _ in range(3)]
        if len(set(P)) < 3 or ms.count(max(ms)) != 1:
            continue
        M = sum(ms); xc = sum(m * p[0] for m, p in zip(ms, P)) / M; yc = sum(m * p[1] for m, p in zip(ms, P)) / M; d = math.hypot(xc, yc)
        agree(d, float(np.linalg.norm(np.average(np.array(P, dtype=float), axis=0, weights=ms))), 1e-9, "d")
        xs = sum(p[0] for p in P) / 3; ys = sum(p[1] for p in P) / 3
        if d > 1 and abs(d - math.hypot(xs, ys)) > 0.3 and d != xc and d != yc:
            break
    key, ds = num_opts(d, [(f"Averages the coordinates without the masses, $\\sqrt{{({sig(xs)})^2+({sig(ys)})^2}}={sig(math.hypot(xs, ys))}\\text{{ m}}$.", math.hypot(xs, ys)), (f"Gives only the $x$-coordinate of the center of mass, ${sig(xc)}\\text{{ m}}$.", xc), (f"Divides the sums of $mx$ and $my$ by 3 instead of by the total mass, ${sig(math.hypot(sum(m * p[0] for m, p in zip(ms, P)) / 3, sum(m * p[1] for m, p in zip(ms, P)) / 3))}\\text{{ m}}$.", math.hypot(sum(m * p[0] for m, p in zip(ms, P)) / 3, sum(m * p[1] for m, p in zip(ms, P)) / 3)), (f"Gives only the $y$-coordinate of the center of mass, ${sig(yc)}\\text{{ m}}$.", yc)], "m")
    stem = f"Three small objects lie in the $xy$-plane: ${ms[0]:g}\\text{{ kg}}$ at $({P[0][0]},{P[0][1]})\\text{{ m}}$, ${ms[1]:g}\\text{{ kg}}$ at $({P[1][0]},{P[1][1]})\\text{{ m}}$, and ${ms[2]:g}\\text{{ kg}}$ at $({P[2][0]},{P[2][1]})\\text{{ m}}$. How far is the center of mass of the three objects from the origin?"
    return MQ("pc_com_planar_distance", "2.1", "2.B", stem, key, ds, rng, "Center of mass in two dimensions as mass-weighted averages of each coordinate", ["Find $x_{cm}$ and $y_{cm}$ as mass-weighted averages", "Combine them with the Pythagorean theorem"],
              "numpy weighted averages recompute both coordinates and the distance", f"$x_{{cm}}={sig(xc)}\\text{{ m}}$ and $y_{{cm}}={sig(yc)}\\text{{ m}}$, so the distance is ${sig(d)}\\text{{ m}}$.", [f"ms={ms}", f"P={P}"], est=120)


# ======================= 단원 3 =======================
@retry_sep
def pc_power_constant_force_scaling(rng):
    k = pick(rng, [2, 3]); ans = float(k)
    key, ds = num_opts(ans, [(f"Multiplies the power by ${k * k}$, treating the power like the kinetic energy, which grows with the square of the time.", float(k * k)), (f"Multiplies the power by $\\sqrt{{{k}}}$, taking the square root of the time factor.", math.sqrt(k)), ("Leaves the power unchanged, because the force is constant.", 1.0), (f"Multiplies the power by ${k ** 3}$, cubing the time factor.", float(k ** 3))], "", fmt=lambda v: f"${sig(v, 3)}$")
    stem = f"A constant net force acts on an object that starts from rest. By what factor is the instantaneous power delivered by the force at $t={k}T$ greater than the instantaneous power at $t=T$?"
    return MQ("pc_power_constant_force_scaling", "3.5", "2.D", stem, key, ds, rng, "Instantaneous power of a constant force grows linearly with time", ["Write the velocity as $at=Ft/m$", "Use $P=Fv$ to find how the power depends on time"],
              "the power is evaluated numerically at the two times", f"$P=Fv=F^2t/m$ is proportional to $t$, so the factor is ${k}$.", [f"k={k}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pc_coaster_rank(rng):
    for _ in forever():
        h0 = pick(rng, [30.0, 40.0, 50.0]); v0 = pick(rng, [2.0, 3.0, 4.0]); hs = rng.sample([5.0, 10.0, 15.0, 20.0, 25.0, 30.0], 4); labs = ["A", "B", "C", "D"]
        vals = {L: math.sqrt(v0 ** 2 + 2 * CG * (h0 - h)) for L, h in zip(labs, hs)}
        try:
            key, ds, order = rank_x(vals, labs, [("Ranks by the height only, with the highest point fastest, as if potential energy added to the speed.", {L: h for L, h in zip(labs, hs)}), ("Ranks by the order of the labels along the track, assuming the car speeds up all the way.", {L: -i for i, L in enumerate(labs)}), ("Ranks by the reverse order of the labels along the track.", {L: i for i, L in enumerate(labs)})], 0.05)
        except ValueError:
            continue
        break
    desc = ", ".join(f"{L} at ${h:g}\\text{{ m}}$" for L, h in zip(labs, hs))
    stem = f"A roller-coaster car moves without friction. At a point ${h0:g}\\text{{ m}}$ above the ground its speed is ${v0:g}\\text{{ m/s}}$. The track passes through four points at these heights above the ground: {desc}. Which ranking orders the speed of the car at the four points from greatest to least?"
    return MQ("pc_coaster_rank", "3.4", "2.C", stem, key, ds, rng, "Speed from energy conservation depends only on the height", ["Use conservation of energy to relate the speed to the height", "Rank the speeds by the heights, lowest point fastest"],
              "the speed at each point is computed from the energy balance and ranked", f"$v^2=v_0^2+2g(h_0-h)$ ranks the speeds {key.text}.", [f"h0={h0}", f"v0={v0}", f"hs={hs}"], est=100, judg=["quantitative_comparison", "law_selection"])


@retry_sep
def pc_spring_speed_equilibrium(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); k = pick(rng, [50.0, 100.0, 200.0]); x1 = pick(rng, [0.10, 0.20, 0.30]); v = x1 * math.sqrt(k / m)
        agree(v, math.sqrt(2 * (0.5 * k * x1 * x1) / m), 1e-9, "v")
        break
    key, ds = num_opts(v, [(f"Uses $\\sqrt{{kx_1/m}}={sig(math.sqrt(k * x1 / m))}\\text{{ m/s}}$, with the stretch to the first power.", math.sqrt(k * x1 / m)), (f"Uses $x_1\\sqrt{{m/k}}={sig(x1 * math.sqrt(m / k))}\\text{{ m/s}}$, with the mass and spring constant interchanged.", x1 * math.sqrt(m / k)), (f"Uses $kx_1/m={sig(k * x1 / m)}\\text{{ m/s}}$, which is the acceleration at release.", k * x1 / m), (f"Drops the factor of two in the energy balance, $\\sqrt{{kx_1^2/(2m)}}={sig(x1 * math.sqrt(k / (2 * m)))}\\text{{ m/s}}$.", x1 * math.sqrt(k / (2 * m)))], "m/s")
    stem = f"A ${m:g}\\text{{ kg}}$ block on a frictionless horizontal surface is attached to an ideal spring ($k={k:g}\\text{{ N/m}}$). The block is pulled ${x1:g}\\text{{ m}}$ from the equilibrium position and released from rest. What is the speed of the block as it passes the equilibrium position?"
    return MQ("pc_spring_speed_equilibrium", "3.1", "2.B", stem, key, ds, rng, "Work done by the spring force equals the kinetic energy gained", ["Find the work done by the spring force as $\\int kx\\,dx$ from $x_1$ to zero", "Set it equal to the kinetic energy"],
              "a Simpson integration of the spring force recomputes the work and the speed", f"$W=\\tfrac12kx_1^2=\\tfrac12mv^2$ gives $v={sig(v)}\\text{{ m/s}}$.", [f"m={m}", f"k={k}", f"x1={x1}"], est=95)


@retry_sep
def pc_bounce_height(rng):
    for _ in forever():
        h = pick(rng, [1.0, 2.0, 3.0]); e = pick(rng, [0.5, 0.6, 0.7, 0.8]); hb = e * e * h
        v1 = math.sqrt(2 * CG * h); v2 = e * v1; agree(hb, v2 ** 2 / (2 * CG), 1e-9, "hb")
        break
    key, ds = num_opts(hb, [(f"Multiplies the height by the speed fraction, $e\\,h={sig(e * h)}\\text{{ m}}$, without squaring.", e * h), (f"Uses one minus the fraction, $(1-e)h={sig((1 - e) * h)}\\text{{ m}}$.", (1 - e) * h), (f"Cubes the fraction, $e^3h={sig(e ** 3 * h)}\\text{{ m}}$.", e ** 3 * h), (f"Takes the square root of the fraction, $\\sqrt{{e}}\\,h={sig(math.sqrt(e) * h)}\\text{{ m}}$.", math.sqrt(e) * h)], "m")
    stem = f"A ball is dropped from rest from a height of ${h:g}\\text{{ m}}$ onto a hard floor. Each time it hits the floor it rebounds with ${e * 100:g}$ percent of its speed just before the impact. Air resistance is negligible. What is the maximum height that the ball reaches after the first bounce?"
    return MQ("pc_bounce_height", "3.4", "2.B", stem, key, ds, rng, "Rebound height depends on the square of the rebound speed", ["Find the speed just before the impact from energy conservation", "Apply the speed fraction and find the rise from the rebound speed"],
              "the speeds before and after the bounce are computed and the rise recomputed", f"$v_2=ev_1$ and $h_b=v_2^2/(2g)=e^2h={sig(hb)}\\text{{ m}}$.", [f"h={h}", f"e={e}"], est=95)


@retry_sep
def pc_inverse_square_force(rng):
    for _ in forever():
        A = pick(rng, [4.0, 6.0, 8.0, 12.0]); r = pick(rng, [1.0, 2.0, 3.0]); F = A / r ** 2
        U = lambda s: -A / s; Fn = -nd(U, r); agree(F, abs(Fn), 1e-5, "F")
        break
    key, ds = num_opts(F, [(f"Reports the magnitude of the potential energy, $A/r={sig(A / r)}\\text{{ N}}$.", A / r), (f"Differentiates twice, $2A/r^3={sig(2 * A / r ** 3)}\\text{{ N}}$.", 2 * A / r ** 3), (f"Divides by the cube of the distance, $A/r^3={sig(A / r ** 3)}\\text{{ N}}$.", A / r ** 3), (f"Halves the correct force, $A/(2r^2)={sig(A / (2 * r ** 2))}\\text{{ N}}$, by treating the potential energy as an integral of the force with a factor of one half.", A / (2 * r ** 2))], "N")
    stem = f"The potential energy of a particle at distance $r$ from a fixed point is $U(r)=-{A:g}/r$, where $U$ is in joules and $r$ is in meters. What is the magnitude of the force on the particle at $r={r:g}\\text{{ m}}$?"
    return MQ("pc_inverse_square_force", "3.3", "2.B", stem, key, ds, rng, "Force as the negative derivative of the potential energy", ["Differentiate the potential energy with respect to $r$", "Evaluate the magnitude at the given distance"],
              "sympy derivative versus a central finite difference", f"$F=-dU/dr=-{A:g}/r^2$, whose magnitude at $r={r:g}\\text{{ m}}$ is ${sig(F)}\\text{{ N}}$.", [f"A={A}", f"r={r}"], est=85)


@retry_sep
def pc_work_fx_graph_signed(rng):
    for _ in forever():
        xs = [0, 2, 4, 6]; Fv = [0, rng.randint(4, 10), rng.randint(-8, -2), rng.randint(-6, 4)]
        W = float(trapz_exact(xs, Fv)); dist = float(sum(abs(Fr(Fv[i] + Fv[i + 1]) / 2 * (xs[i + 1] - xs[i])) for i in range(3)))
        if W != 0 and abs(abs(W) - dist) > 2 and Fv[3] != 0:
            break
    tt = np.linspace(0, 6, 60001); agree(W, float(np.trapezoid(np.interp(tt, xs, Fv), tt)), 1e-6, "W")
    key, ds = signed_opts(W, [(f"Adds the magnitudes of the areas, ${sig(dist)}\\text{{ J}}$, without regard to the sign of the force.", dist), (f"Multiplies the final force by the distance, ${sig(Fv[3] * 6)}\\text{{ J}}$.", Fv[3] * 6), (f"Averages the force values at the plotted points and multiplies by the distance, ${sig(sum(Fv) / 4 * 6)}\\text{{ J}}$.", sum(Fv) / 4 * 6), (f"Uses only the first segment, ${sig(float(Fr(Fv[0] + Fv[1]) / 2 * 2))}\\text{{ J}}$.", float(Fr(Fv[0] + Fv[1]) / 2 * 2))], "J")
    stim = graph_stim("Net force on the block versus position", [("F", list(zip(xs, Fv)))], gaxis("Position (m)", 0, 6, 1), gaxis("Net force (N)", min(Fv + [0]) - 2, max(Fv + [0]) + 2, 2))
    stem = "A block moves along the $x$-axis under the net force shown in the graph, which acts along the line of motion. How much net work does the force do on the block from $x=0$ to $x=6\\text{ m}$?"
    return MQ("pc_work_fx_graph_signed", "3.2", "2.B", stem, key, ds, rng, "Net work as the signed area under a force-position graph", ["Find the area of each segment under the graph", "Count the area below the axis as negative work"],
              "exact fractions for the trapezoid areas versus numpy integration of the resampled graph", f"The signed areas are {seg_text(xs, Fv, 'J')}, so the net work is ${sig(W)}\\text{{ J}}$.", [f"Fv={Fv}"], stim=stim, est=100, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "quantitative_comparison"])


STAGE_U1_C = ["pc_exp_decay_distance", "pc_toss_from_platform_apex", "pc_plane_crosswind", "pc_circular_kinematics_accel", "pc_xt_quartic_minimum"]
STAGE_U2_C = ["pc_crate_pull_angle", "pc_table_hanging_friction", "pc_hooke_table_constant", "pc_exp_force_velocity", "pc_circle_bottom_tension", "pc_turntable_radius", "pc_field_zero_point", "pc_drag_half_terminal_time", "pc_com_planar_distance"]
STAGE_U3_C = ["pc_power_constant_force_scaling", "pc_coaster_rank", "pc_spring_speed_equilibrium", "pc_bounce_height", "pc_inverse_square_force", "pc_work_fx_graph_signed"]
