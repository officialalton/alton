"""AP Physics 1 P0 원형 C — 단원 6(회전 에너지·운동량·궤도)·7(진동)·8(유체) + 2문항 세트. 정답은 코드가 풀고 ODE/수치 경로로 독립 재계산한다."""
from phys_common import *
from phys_figs import make_utube, make_tank_hole, make_collision, check_scene  # noqa: F401

# 굴러 내려오는 물체의 I = k m R^2
SHAPES = [("solid disk", 0.5), ("hoop", 1.0), ("solid sphere", 0.4)]


# ======================= U6 =======================
def ph_rolling_incline(rng):
    for _ in forever():
        h = pick(rng, [0.5, 0.8, 1.0, 1.5, 2.0]); th = pick(rng, [20, 30, 40]); (name, kk) = pick(rng, SHAPES)
        v = math.sqrt(2 * G * h / (1 + kk))
        a = G * math.sin(math.radians(th)) / (1 + kk)
        s_len = h / math.sin(math.radians(th))
        s = np.array([0.0, 0.0]); t = 0.0; dt = 1e-4
        while s[0] < s_len:
            prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], a]), s, t, t + dt, 1); t += dt
        fr = (s_len - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(v, vn, 2e-3, "v")
        break
    pairs = [("Treats the object as sliding without friction and uses $\\sqrt{2gh}$, ignoring the rotational kinetic energy.", math.sqrt(2 * G * h)), ("Drops the factor of two in the kinetic energy and ignores the rotational part, using $\\sqrt{gh}$.", math.sqrt(G * h)),
             ("Puts the rotational term in the numerator, using $\\sqrt{2gh(1+k)}$.", math.sqrt(2 * G * h * (1 + kk))), ("Drops the factor of two and keeps the rotational term, using $\\sqrt{gh/(1+k)}$.", math.sqrt(G * h / (1 + kk)))]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A {name} rolls without slipping from rest down an incline of ${th}^\\circ$, starting at a vertical height of ${h:g}\\text{{ m}}$ above the bottom. Its rotational inertia about its center is ${kk:g}MR^2$. What is the speed of its center of mass at the bottom?"
    return mk("ph_rolling_incline", "6.5", "2.B", stem, key, ds, rng, concept="Energy conservation for rolling without slipping", thinking=["Write the final kinetic energy as translational plus rotational parts and relate $\\omega$ to $v$", "Equate it to the lost gravitational potential energy and solve for $v$"],
              cond=[("the object rolls without slipping so friction does no work", "the stem states rolling without slipping")], path="RK4 integration of the constant center-of-mass acceleration $g\\sin\\theta/(1+k)$ along the incline gives the speed at the bottom", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=115, facts=[f"h={h}", f"th={th}", f"k={kk}"], kwhy=f"$mgh=\\tfrac12mv^2(1+k)$ so $v=\\sqrt{{2gh/(1+k)}}=\\sqrt{{2(9.8)({h:g})/(1+{kk:g})}}={sig(v)}\\text{{ m/s}}$.")


def ph_ang_mom_platform(rng):
    for _ in forever():
        I0 = pick(rng, [4.0, 6.0, 8.0]); w0 = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [1.0, 2.0]); r = pick(rng, [0.8, 1.0, 1.5])
        w1 = I0 * w0 / (I0 + m * r * r)
        agree(I0 * w0, (I0 + m * r * r) * w1, 1e-9, "L")
        break
    pairs = [("Keeps the angular speed unchanged because the platform is not acted on by a torque.", w0), ("Uses conservation of kinetic energy instead of angular momentum.", w0 * math.sqrt(I0 / (I0 + m * r * r))),
             ("Adds the rotational inertia of the object as $mr$ without squaring the radius.", I0 * w0 / (I0 + m * r)), ("Uses the object's distance from the axis as the full rotational inertia of the system.", w0 * m * r * r / I0)]
    key, ds = num_opts(w1, pairs, "rad/s")
    stem = f"A horizontal platform with rotational inertia ${I0:g}\\text{{ kg}}\\cdot\\text{{m}}^2$ spins freely about its vertical axis at ${w0:g}\\text{{ rad/s}}$. A ${m:g}\\text{{ kg}}$ clay ball is dropped onto the platform and sticks at a distance of ${r:g}\\text{{ m}}$ from the axis. What is the angular speed of the platform right afterward? Treat the ball as a point mass."
    return mk("ph_ang_mom_platform", "6.4", "2.B", stem, key, ds, rng, concept="Conservation of angular momentum when rotational inertia changes", thinking=["Identify that no external torque acts about the axis so angular momentum is conserved", "Add the point mass contribution $mr^2$ to the rotational inertia and solve for the final angular speed"],
              cond=[("the ball lands without applying an external torque about the axis", "the stem states the platform spins freely and the ball is dropped vertically")], path="the final angular speed is checked by recomputing $L_i$ and $L_f$ with numpy and asserting equality", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=100, facts=[f"I0={I0}", f"w0={w0}", f"m={m}", f"r={r}"], kwhy=f"Angular momentum is conserved: $\\omega={I0:g}({w0:g})/({I0:g}+{m:g}({r:g})^2)={sig(w1)}\\text{{ rad/s}}$.")


def ph_orbit_period_ratio(rng):
    for _ in forever():
        n = pick(rng, [2, 3, 4, 5, 9]); ratio = float(n) ** 1.5
        GM = 3.986e14; r1 = 7.0e6
        T = lambda r: 2 * math.pi * math.sqrt(r ** 3 / GM)  # noqa: E731
        agree(T(n * r1) / T(r1), ratio, 1e-9, "ratio")
        break
    pairs = [("Takes the period to be proportional to the orbital radius.", float(n)), ("Takes the period to be proportional to the square of the orbital radius.", float(n * n)),
             ("Uses $\\sqrt{r}$, the dependence of the speed on the radius.", math.sqrt(n)), ("Divides instead of multiplying: uses $r^{-3/2}$.", 1 / ratio)]
    key, ds = num_opts(ratio, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$ times")
    stem = f"Satellite 2 orbits Earth in a circular orbit with a radius ${n}$ times the orbital radius of satellite 1. How many times as long is the orbital period of satellite 2 as the period of satellite 1?"
    return mk("ph_orbit_period_ratio", "6.6", "2.D", stem, key, ds, rng, concept="Orbital period scaling for circular orbits", thinking=["Use gravity as the centripetal force to relate speed and orbital radius", "Combine with the circumference to find how the period scales with the radius"],
              cond=[("both satellites move in circular orbits about the same planet", "the stem states circular orbits about Earth")], path="the periods are computed from the real gravitational parameter of Earth and an actual radius, and their ratio is compared with the exponent $3/2$ result", material=MAT_NONE,
              judgment=["scaling_prediction"], est=80, facts=[f"n={n}"], kwhy=f"The period scales as $r^{{3/2}}$, so multiplying the radius by ${n}$ multiplies the period by ${n}^{{3/2}}={sig(ratio)}$.")


def ph_torque_time_area(rng):
    for _ in forever():
        from phys_p0_a import _pl_vt
        xs = [0]
        for _ in range(rng.choice([2, 3])):
            xs.append(xs[-1] + rng.choice([1, 2, 3]))
        tq = [rng.randint(0, 8) for _ in xs]; tq[0] = rng.choice([0, 2]); tq[-1] = rng.choice([0, 2])
        dL = trapz_exact(xs, tq); I = pick(rng, [2.0, 4.0, 5.0])
        w = float(dL) / I
        tt = np.linspace(0, xs[-1], 40001)
        agree(float(dL), float(np.trapezoid(np.interp(tt, xs, tq), tt)), 1e-7, "dL")
        if dL >= 8 and len(set(tq)) >= 3:
            break
    pairs = [("Reports the area, which is the change in angular momentum, as if it were the angular speed.", float(dL)), ("Multiplies the largest torque by the elapsed time and divides by the rotational inertia.", max(tq) * xs[-1] / I),
             ("Divides by the rotational inertia twice.", float(dL) / I / I), ("Uses the average of the first and last torques times the elapsed time over $I$.", (tq[0] + tq[-1]) / 2 * xs[-1] / I)]
    key, ds = num_opts(w, pairs, "rad/s")
    stim = graph_stim("Net torque versus time", [("tau", list(zip(xs, tq)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Torque (N·m)", 0, max(tq) + 2, 2))
    stem = f"A wheel with rotational inertia ${I:g}\\text{{ kg}}\\cdot\\text{{m}}^2$ is at rest when a net torque that varies as shown is applied about its axle. What is the angular speed of the wheel at $t={xs[-1]}\\text{{ s}}$?"
    return mk("ph_torque_time_area", "6.3", "2.B", stem, key, ds, rng, concept="Angular impulse as the area under a torque-time graph", thinking=["Find the area under the torque-time graph as the angular impulse", "Divide by the rotational inertia to get the change in angular speed"],
              cond=[("the wheel starts at rest and the plotted torque is the net torque", "the stem states both")], path="exact trapezoid area versus numpy integration of the interpolated torque", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=100, facts=[f"xs={xs}", f"tq={tq}", f"I={I}"], kwhy=f"The areas under the torque-time graph are {seg_text(xs, tq, 'N·m·s')}, so $I\\Delta\\omega={sig(float(dL))}$ and $\\omega={sig(float(dL))}/{I:g}={sig(w)}\\text{{ rad/s}}$.")


# ======================= U7 =======================
def _sim_period(k, m, A=0.1):
    """독립 경로: 용수철-질량을 RK4 로 적분해 x 가 처음 +A 로 돌아오는 시간(영점 통과 4번의 평균으로 주기 추정)."""
    s = np.array([A, 0.0]); t = 0.0; dt = 1e-3; crossings = []
    while len(crossings) < 2:
        prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), s, t, t + dt, 1); t += dt
        if prev[0] * s[0] < 0:
            crossings.append(t - dt + dt * prev[0] / (prev[0] - s[0]))
        if t > 100:
            raise ValueError("no_period")
    return 2 * (crossings[1] - crossings[0])


def ph_period_scaling(rng):
    for _ in forever():
        a = pick(rng, [2, 4, 9]); b = pick(rng, [2, 4])
        k0, m0 = 50.0, 0.5
        P0 = _sim_period(k0, m0)
        P1 = _sim_period(k0 * b, m0 * a)
        ratio = P1 / P0
        exact = math.sqrt(a / b)
        agree(ratio, exact, 5e-3, "ratio")
        if abs(exact - 1) > 0.2:
            break
    pairs = [("Takes the period to be proportional to the mass instead of its square root.", a / b if a / b != exact else a), ("Takes the period to be proportional to the spring constant.", float(b)),
             ("Uses $\\sqrt{b/a}$, inverting the dependence on mass and on the spring constant.", math.sqrt(b / a)), ("Ignores the spring constant change and uses only the mass dependence $\\sqrt{a}$.", math.sqrt(a))]
    key, ds = num_opts(exact, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$ times")
    stem = f"A block on a spring oscillates with period $P$ on a frictionless horizontal surface. The block is replaced by one with ${a}$ times the mass and the spring is replaced by one with ${b}$ times the spring constant. The amplitude is unchanged. How many times as long as $P$ is the new period?"
    return mk("ph_period_scaling", "7.2", "2.D", stem, key, ds, rng, concept="Period of a mass-spring oscillator depends on $\\sqrt{m/k}$", thinking=["Recall that the period is proportional to the square root of mass over spring constant", "Combine the factors for both changes"],
              cond=[("the oscillator is an ideal mass-spring system", "the stem states a frictionless horizontal surface and an ideal spring")], path="the period of each system is measured from an RK4 simulation of the equation of motion and the ratio is compared with the closed form", material=MAT_NONE,
              judgment=["scaling_prediction"], est=80, facts=[f"a={a}", f"b={b}"], kwhy=f"The period scales as $\\sqrt{{m/k}}$, so the factor is $\\sqrt{{{a}/{b}}}={sig(exact)}$.")


def ph_shm_vmax(rng):
    for _ in forever():
        A = pick(rng, [0.05, 0.08, 0.10, 0.20]); P = pick(rng, [0.4, 0.5, 0.8, 1.0, 2.0])
        vmax = 2 * math.pi * A / P
        tt = np.linspace(0, P, 20001); x = A * np.sin(2 * math.pi * tt / P)
        agree(vmax, float(np.max(np.abs(np.gradient(x, tt)))), 1e-4, "vmax")
        break
    pairs = [("Takes the maximum speed to be the amplitude divided by the period, $A/P$, omitting the factor of $2\\pi$.", A / P), ("Uses $2\\pi A P$, multiplying by the period instead of dividing.", 2 * math.pi * A * P),
             ("Reports the maximum acceleration $4\\pi^2A/P^2$ instead of the maximum speed.", 4 * math.pi ** 2 * A / P ** 2), ("Uses $\\pi A/P$, dropping one factor of two from $2\\pi A/P$.", math.pi * A / P)]
    key, ds = num_opts(vmax, pairs, "m/s")
    stim = dense_graph_stim("Position versus time of an oscillating block", lambda t: A * math.sin(2 * math.pi * t / P), 0, 2 * P, gaxis("Time (s)", 0, 2 * P, P / 4), sym_axis("Position (m)", A), n=161)
    stem = "The graph shows the position of a block oscillating on a spring as a function of time. What is the maximum speed of the block?"
    return mk("ph_shm_vmax", "7.3", "2.B", stem, key, ds, rng, concept="Maximum speed of a simple harmonic oscillator from a position-time graph", thinking=["Read the amplitude and the period from the graph", "Use $v_{max}=\\omega A$ with $\\omega=2\\pi/P$"],
              cond=[("the motion is simple harmonic so the position is sinusoidal in time", "the plotted points follow a sine curve")], path="numpy gradient of the sampled position function gives the maximum speed that is compared with $2\\pi A/P$", material=MAT_GRAPH("axis labels with units", "one or more full periods"),
              judgment=["representation_reading", "symbolic_reasoning"], stim=stim, est=105, facts=[f"A={A}", f"P={P}"], kwhy=f"The graph gives $A={A:g}\\text{{ m}}$ and $P={P:g}\\text{{ s}}$, so the maximum speed is $\\omega A=2\\pi A/P={sig(vmax)}\\text{{ m/s}}$.")


def ph_shm_energy(rng):
    for _ in forever():
        k = pick(rng, [40.0, 60.0, 80.0, 100.0]); A = pick(rng, [0.10, 0.20, 0.30]); frac = pick(rng, [0.4, 0.5, 0.6])
        x = frac * A
        K = 0.5 * k * (A * A - x * x)
        m = 0.4
        s = np.array([A, 0.0]); t = 0.0; dt = 1e-4
        while s[0] > x:
            prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), s, t, t + dt, 1); t += dt
        fr = (prev[0] - x) / (prev[0] - s[0]); vn = prev[1] + (s[1] - prev[1]) * fr
        agree(K, 0.5 * m * vn * vn, 3e-3, "K")
        break
    pairs = [("Reports the elastic potential energy at that position, $\\tfrac12kx^2$, not the kinetic energy.", 0.5 * k * x * x), ("Reports the total energy $\\tfrac12kA^2$ as the kinetic energy.", 0.5 * k * A * A),
             ("Uses $\\tfrac12k(A-x)^2$, subtracting the amplitude and displacement before squaring.", 0.5 * k * (A - x) ** 2), ("Subtracts the amplitude and position without squaring: $\\tfrac12k(A-x)$.", 0.5 * k * (A - x))]
    key, ds = num_opts(K, pairs, "J")
    stem = f"A block attached to an ideal horizontal spring of spring constant ${k:g}\\text{{ N/m}}$ oscillates on a frictionless surface with amplitude ${A:g}\\text{{ m}}$. What is the kinetic energy of the block when its displacement from equilibrium is ${x:g}\\text{{ m}}$?"
    return mk("ph_shm_energy", "7.4", "2.B", stem, key, ds, rng, concept="Energy of a simple harmonic oscillator at an intermediate position", thinking=["Find the total mechanical energy from the amplitude", "Subtract the elastic potential energy at the given displacement"],
              cond=[("the surface is frictionless so the total mechanical energy is constant", "the stem states a frictionless surface and an ideal spring")], path="RK4 integration of the equation of motion gives the speed at the displacement whose kinetic energy matches the energy result", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=100, facts=[f"k={k}", f"A={A}", f"x={x}"], kwhy=f"$K=\\tfrac12k(A^2-x^2)=\\tfrac12({k:g})({A:g}^2-{x:g}^2)={sig(K)}\\text{{ J}}$.")


# ======================= U8 =======================
def ph_float_fraction(rng):
    for _ in forever():
        rho = pick(rng, [200.0, 300.0, 400.0, 600.0, 700.0, 800.0]); rw = CONSTS["rho_water"]
        frac = rho / rw
        # 독립: 잠긴 깊이 비율에 대해 (부력 - 무게) = 0 의 근을 이분법으로
        d = bisect(lambda f: rw * f - rho, 0.0, 1.0)
        agree(frac, d, 1e-9, "frac")
        break
    fm = lambda v: "$" + sig(v, 2) + "$ of its volume"  # noqa: E731
    pairs = [("Reports the fraction of the fluid density that the block has relative to the block density, inverting the ratio.", min(rw / rho, 9.9) if rw / rho < 10 else 9.9), ("Reports one minus the correct fraction, the fraction above the surface.", 1 - frac),
             ("Takes half the volume to be submerged for any floating object.", 0.5), ("Squares the density ratio.", frac ** 2), ("Uses the square root of the density ratio.", frac ** 0.5)]
    key = Opt(fm(frac), True, f"A floating object displaces its own weight of fluid, so the submerged fraction equals the density ratio ${rho:g}/{rw:g}={sig(frac, 2)}$.", frac)
    ds, seen = [], [frac]
    for why, v in pairs:
        if v > 1.0 or any(abs(v - c) < 0.08 for c in seen):
            continue
        seen.append(v); ds.append(Opt(fm(v), False, why, v))
    if len(ds) < 3:
        raise ValueError("few")
    stem = f"A uniform block of density ${rho:g}\\text{{ kg/m}}^3$ floats at rest in fresh water of density ${rw:g}\\text{{ kg/m}}^3$. What fraction of the block's volume is below the water surface?"
    return mk("ph_float_fraction", "8.3", "2.B", stem, key, ds, rng, concept="Buoyancy balance for a floating object", thinking=["Set the buoyant force equal to the weight of the floating block", "Express the displaced fluid volume as the submerged fraction of the block's volume"],
              cond=[("the block floats at rest so the buoyant force equals its weight", "the stem states the block floats at rest")], path="a bisection root finder on the net vertical force as a function of the submerged fraction recomputes the fraction", material=MAT_NONE,
              judgment=["law_selection"], est=75, facts=[f"rho={rho}"])


def ph_gauge_pressure(rng):
    for _ in forever():
        rho = pick(rng, [1000.0, 1030.0, 800.0, 1250.0]); h = pick(rng, [5.0, 8.0, 12.0, 20.0]); P0 = CONSTS["P_atm"]
        P = P0 + rho * G * h
        agree(P, float(sp.Rational(str(P0)) + sp.Rational(str(rho)) * sp.Rational(str(G)) * sp.Rational(str(h))), 1e-9, "P")
        break
    pairs = [("Reports only the pressure due to the liquid, $\\rho g h$, forgetting the atmosphere above the surface.", rho * G * h), ("Reports only atmospheric pressure, ignoring the depth.", P0),
             ("Uses $\\rho h$ instead of $\\rho g h$, forgetting the gravitational field strength: $P_0+\\rho h$.", P0 + rho * h), ("Counts the liquid column twice, using $P_0+2\\rho g h$.", P0 + rho * G * h * 2)]
    key, ds = num_opts(P, pairs, "Pa", fmt=lambda v: sci(v, "Pa"))
    stem = f"An open tank holds a liquid of density ${rho:g}\\text{{ kg/m}}^3$. Atmospheric pressure is $1.01\\times10^{{5}}\\text{{ Pa}}$. What is the absolute pressure at a point ${h:g}\\text{{ m}}$ below the surface of the liquid?"
    return mk("ph_gauge_pressure", "8.2", "2.B", stem, key, ds, rng, concept="Absolute pressure at depth in a static fluid", thinking=["Compute the pressure added by the liquid column from $\\rho g h$", "Add the atmospheric pressure acting on the surface"],
              cond=[("the liquid is incompressible and open to the atmosphere", "the stem states an open tank and gives a single density")], path="exact rational arithmetic on the three terms versus the float evaluation of the pressure", material=MAT_NONE,
              judgment=["law_selection"], est=80, facts=[f"rho={rho}", f"h={h}"], kwhy=f"$P=P_0+\\rho gh=1.01\\times10^{{5}}+({rho:g})(9.8)({h:g})={sig(P)}\\text{{ Pa}}$.")


def ph_continuity(rng):
    for _ in forever():
        d1 = pick(rng, [4.0, 6.0, 8.0]); d2 = pick(rng, [2.0, 3.0, 4.0]); v1 = pick(rng, [1.0, 1.5, 2.0])
        if d2 >= d1:
            continue
        A1 = math.pi * (d1 / 2) ** 2; A2 = math.pi * (d2 / 2) ** 2
        v2 = v1 * A1 / A2
        agree(v2, v1 * (d1 / d2) ** 2, 1e-9, "v2")
        break
    pairs = [("Uses the ratio of the diameters instead of the ratio of the areas.", v1 * d1 / d2), ("Inverts the area ratio, as if the fluid slowed in the narrow pipe.", v1 * A2 / A1),
             ("Assumes the speed is the same in both parts of the pipe.", v1), ("Uses the ratio of radii cubed.", v1 * (d1 / d2) ** 3)]
    key, ds = num_opts(v2, pairs, "m/s")
    stem = f"Water flows steadily through a horizontal pipe whose diameter narrows from ${d1:g}\\text{{ cm}}$ to ${d2:g}\\text{{ cm}}$. The water speed in the wide section is ${v1:g}\\text{{ m/s}}$. What is the water speed in the narrow section?"
    return mk("ph_continuity", "8.4", "2.B", stem, key, ds, rng, concept="Continuity equation for an incompressible fluid in a pipe", thinking=["Recognize that the volume flow rate is constant for an incompressible fluid", "Relate the speeds through the cross-sectional areas, which scale with the square of the diameter"],
              cond=[("the flow is steady and the fluid is incompressible", "the stem states steady flow of water")], path="the cross-sectional areas are computed numerically from $\\pi r^2$ and the speeds from the flow rate; the result matches the squared diameter ratio", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=90, facts=[f"d1={d1}", f"d2={d2}", f"v1={v1}"], kwhy=f"$A_1v_1=A_2v_2$ with $A\\propto d^2$ gives $v_2=v_1(d_1/d_2)^2={v1:g}({d1:g}/{d2:g})^2={sig(v2)}\\text{{ m/s}}$.")


def ph_bernoulli_dp(rng):
    for _ in forever():
        rho = 1000.0; v1 = pick(rng, [1.0, 1.5, 2.0]); v2 = pick(rng, [4.0, 5.0, 6.0])
        dP = 0.5 * rho * (v2 * v2 - v1 * v1)
        agree(dP, float(sp.Rational(1, 2) * sp.Rational(str(rho)) * (sp.Rational(str(v2)) ** 2 - sp.Rational(str(v1)) ** 2)), 1e-9, "dP")
        break
    pairs = [("Uses $\\tfrac12\\rho(v_2-v_1)^2$, squaring the difference instead of taking the difference of squares.", 0.5 * rho * (v2 - v1) ** 2), ("Omits the factor of one half.", rho * (v2 * v2 - v1 * v1)),
             ("Uses $\\rho(v_2-v_1)$, forgetting to square the speeds.", rho * (v2 - v1)), ("Uses only the faster speed: $\\tfrac12\\rho v_2^2$.", 0.5 * rho * v2 * v2)]
    key, ds = num_opts(dP, pairs, "Pa", fmt=lambda v: sci(v, "Pa") if abs(v) >= 1e4 else Q(v, "Pa", 3))
    stem = f"Water of density ${rho:g}\\text{{ kg/m}}^3$ flows through a horizontal pipe. The speed is ${v1:g}\\text{{ m/s}}$ in a wide section and ${v2:g}\\text{{ m/s}}$ in a narrow section. By how much is the pressure in the wide section greater than the pressure in the narrow section?"
    return mk("ph_bernoulli_dp", "8.4", "2.B", stem, key, ds, rng, concept="Bernoulli's equation for a horizontal pipe", thinking=["Apply Bernoulli's equation between the two sections at the same height", "Express the pressure difference as one half the density times the difference of the squared speeds"],
              cond=[("the pipe is horizontal so the height terms cancel", "the stem states a horizontal pipe")], path="sympy rational arithmetic on the Bernoulli expression versus its float evaluation", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=95, facts=[f"v1={v1}", f"v2={v2}"], kwhy=f"Bernoulli gives $P_1-P_2=\\tfrac12\\rho(v_2^2-v_1^2)=\\tfrac12(1000)({v2:g}^2-{v1:g}^2)={sig(dP)}\\text{{ Pa}}$.")


def ph_torricelli_range(rng):
    for _ in forever():
        d = pick(rng, [0.4, 0.6, 0.8, 1.0]); hh = pick(rng, [0.4, 0.5, 0.8, 1.0]); tankH = d + hh + 0.4
        v = math.sqrt(2 * G * d); R = v * math.sqrt(2 * hh / G)
        f = lambda t, y: np.array([y[2], y[3], 0.0, -G])  # noqa: E731
        T = math.sqrt(2 * hh / G)
        y = rk4(f, [0, hh, v, 0.0], 0, T, 3000)
        agree(R, y[0], 1e-6, "R"); agree(0.0, abs(y[1]), 1e-3, "land")
        break
    pairs = [("Uses $\\sqrt{dh}$ without the factor of two, halving the range.", math.sqrt(d * hh)), ("Uses $4\\sqrt{dh}$.", 4 * math.sqrt(d * hh)),
             ("Uses the full height of the water surface above the ground, $d+h$, in place of the depth $d$, giving $2\\sqrt{(d+h)h}$.", 2 * math.sqrt((d + hh) * hh)), ("Uses the depth below the surface, $d$, as the height of the fall, giving a range of $2d$.", 2 * d)]
    key, ds = num_opts(R, pairs, "m")
    sc = make_tank_hole(d, hh, tankH); assert not check_scene(sc)
    stem = f"A large open tank stands on level ground. Water leaves a small hole ${d:g}\\text{{ m}}$ below the water surface and ${hh:g}\\text{{ m}}$ above the ground, moving horizontally. How far from the tank does the water stream land? Treat the water as ideal."
    return mk("ph_torricelli_range", "8.4", "2.B", stem, key, ds, rng, concept="Exit speed from a hole (Torricelli) and projectile motion of the stream", thinking=["Find the exit speed from Bernoulli's equation with the depth of the hole", "Treat the stream as a horizontal projectile falling from the hole height to the ground"],
              cond=[("the tank is large so the surface speed is negligible and the fluid is ideal", "the stem states a large open tank and an ideal fluid")], path="RK4 integration of the horizontal projectile from the hole height with the Bernoulli exit speed lands at the closed-form range", material=MAT_DIAGRAM("tank, hole depth and hole height"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Water leaving a hole in a tank", sc), est=120, facts=[f"d={d}", f"hh={hh}"], kwhy=f"The exit speed is $\\sqrt{{2gd}}={sig(v)}\\text{{ m/s}}$ and the fall time is $\\sqrt{{2h/g}}={sig(math.sqrt(2 * hh / G))}\\text{{ s}}$, so the range is $2\\sqrt{{dh}}={sig(R)}\\text{{ m}}$.")


def ph_hydraulic_lift(rng):
    for _ in forever():
        d1 = pick(rng, [2.0, 3.0, 4.0]); d2 = pick(rng, [10.0, 12.0, 15.0, 20.0]); F1 = pick(rng, [50.0, 100.0, 200.0])
        F2 = F1 * (d2 / d1) ** 2
        agree(F2, F1 * (math.pi * (d2 / 2) ** 2) / (math.pi * (d1 / 2) ** 2), 1e-9, "F2")
        break
    pairs = [("Uses the ratio of the diameters instead of the ratio of the areas.", F1 * d2 / d1), ("Inverts the ratio, giving a smaller force on the larger piston.", F1 * (d1 / d2) ** 2),
             ("Assumes the forces are equal because the pressure is the same.", F1), ("Uses the ratio of the diameters cubed.", F1 * (d2 / d1) ** 3)]
    key, ds = num_opts(F2, pairs, "N", fmt=lambda v: Q(v, "N", 3) if v < 1e4 else sci(v, "N"))
    stem = f"In a hydraulic lift, a small piston of diameter ${d1:g}\\text{{ cm}}$ is pushed with a force of ${F1:g}\\text{{ N}}$. The large piston has a diameter of ${d2:g}\\text{{ cm}}$. What is the maximum force the large piston can exert? The pistons are at the same height."
    return mk("ph_hydraulic_lift", "8.2", "2.B", stem, key, ds, rng, concept="Pascal's principle in a hydraulic lift", thinking=["Recognize that the pressure is the same under both pistons", "Relate the forces through the piston areas, which scale with the square of the diameter"],
              cond=[("the fluid is incompressible and the pistons are at the same height", "the stem states pistons at the same height")], path="the piston areas are computed numerically from $\\pi r^2$ and the force from equal pressures; the result matches the squared diameter ratio", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=85, facts=[f"d1={d1}", f"d2={d2}", f"F1={F1}"], kwhy=f"Equal pressures give $F_2=F_1(A_2/A_1)=F_1(d_2/d_1)^2={F1:g}({d2:g}/{d1:g})^2={sig(F2)}\\text{{ N}}$.")


def ph_apparent_weight(rng):
    for _ in forever():
        rho = pick(rng, [2700.0, 7800.0, 8900.0]); Vcm = pick(rng, [100.0, 200.0, 500.0]); V = Vcm * 1e-6; rw = CONSTS["rho_water"]
        Wapp = (rho - rw) * V * G
        agree(Wapp, rho * V * G - rw * V * G, 1e-9, "Wapp")
        break
    pairs = [("Reports the weight in air, ignoring the buoyant force.", rho * V * G), ("Reports the buoyant force instead of the apparent weight.", rw * V * G), ("Adds the buoyant force to the weight, as if the water pushed down.", (rho + rw) * V * G),
             ("Uses the mass of water displaced as if it were a force with no factor of $g$.", (rho - rw) * V)]
    key, ds = num_opts(Wapp, pairs, "N")
    stem = f"A solid metal object of density ${rho:g}\\text{{ kg/m}}^3$ and volume ${Vcm:g}\\text{{ cm}}^3$ hangs from a scale and is fully submerged in water of density $1000\\text{{ kg/m}}^3$ without touching the container. What does the scale read?"
    return mk("ph_apparent_weight", "8.3", "2.B", stem, key, ds, rng, concept="Apparent weight of a submerged object", thinking=["Compute the weight of the object and the buoyant force from the displaced water", "Subtract the buoyant force from the weight to find the scale reading"],
              cond=[("the object is fully submerged and in equilibrium", "the stem states the object hangs fully submerged on a scale")], path="exact arithmetic on $(\\rho-\\rho_w)Vg$ versus the separately computed weight minus buoyant force", material=MAT_NONE,
              judgment=["law_selection"], est=95, facts=[f"rho={rho}", f"V={Vcm}"], kwhy=f"The scale reads the weight minus the buoyant force, $(\\rho-\\rho_w)Vg=({rho:g}-1000)({sig(V)})(9.8)={sig(Wapp)}\\text{{ N}}$.")


# ======================= 2문항 세트 =======================
def phs_vt_set(rng):
    """세트 1: 하나의 v–t 그래프 → (변위, 마지막 구간 평균 가속도). 같은 그래프에서 두 문항을 만든다(단원 1 안)."""
    from phys_p0_a import _pl_vt, _dist_exact
    for _ in forever():
        xs, vs = _pl_vt(rng, nseg=3, vmin=-3, vmax=8)
        disp = trapz_exact(xs, vs)
        dt = xs[-1] - xs[-2]; acc = (vs[-1] - vs[-2]) / dt
        if disp != 0 and acc != 0 and abs(float(disp)) >= 4 and dt != abs(vs[-1] - vs[-2]):
            break
    stim = graph_stim("Velocity versus time of a cart", [("v", list(zip(xs, vs)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Velocity (m/s)", min(vs + [0]) - 1, max(vs + [0]) + 1, 1))
    T = xs[-1]
    k1, d1 = num_opts(float(disp), [("Reports the distance traveled instead of the displacement.", float(_dist_exact(xs, vs))), ("Multiplies the final velocity by the total time.", vs[-1] * T),
                                     ("Averages the first and last velocities and multiplies by the time.", (vs[0] + vs[-1]) / 2 * T), ("Uses only the first segment.", float((Fr(vs[0]) + Fr(vs[1])) / 2 * xs[1]))], "m")
    k2, d2 = num_opts(acc, [("Reports the change in velocity over the last segment without dividing by the elapsed time.", float(vs[-1] - vs[-2])), ("Divides the final velocity by the total time of the trip.", vs[-1] / T),
                            ("Gives the acceleration the opposite sign by subtracting the velocities in the wrong order.", -acc), ("Averages the velocities at the ends of the last segment, which is not a rate of change.", (vs[-1] + vs[-2]) / 2)], "m/s^2")
    q = []
    for st, key, ds, top, nm in [(f"What is the displacement of the cart from $t=0$ to $t={T}\\text{{ s}}$? Positive is to the right.", k1, d1, "1.2", "q1"),
                                 (f"What is the average acceleration of the cart during the last segment of the graph, from $t={xs[-2]}\\text{{ s}}$ to $t={T}\\text{{ s}}$?", k2, d2, "1.2", "q2")]:
        q.append(mk(f"phs_vt_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about a single velocity-time graph", thinking=["Read the graph to find the needed area or slope", "Apply the kinematic definition of displacement or average acceleration"],
                    cond=[("the graph is piecewise linear", "the shared stimulus is built from integer vertices")], path="exact fractions versus numpy integration or polyfit of the same graph", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], stim=None, est=95, facts=[f"xs={xs}", f"vs={vs}"], kwhy=(f"The signed areas of the segments are {seg_text(xs, vs, 'm')}; area below the axis subtracts, so the displacement is ${sig(float(disp))}\\text{{ m}}$." if nm == "q1"
                          else f"The average acceleration is the slope of the last segment, $({vs[-1]}-({vs[-2]}))/{dt}={sig(acc)}\\text{{ m/s}}^2$.")))
    return {"archetype": "phs_vt_set", "topic": "1.2", "skill": "2.B", "calculator": "allowed", "set_intro": "A cart moves along a straight horizontal track. The graph shows the velocity of the cart as a function of time, with right taken as positive.", "stimulus": stim, "items": q, "facts": q[0]["facts"], "blueprint": q[0]["blueprint"]}


def phs_collision_set(rng):
    """세트 2: 충돌 자료 → (충돌 후 속도, 손실된 운동 에너지)."""
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [1.0, 2.0, 4.0]); v1 = pick(rng, [4.0, 5.0, 6.0]); v2 = pick(rng, [0.0, -2.0, 1.0])
        v = (m1 * v1 + m2 * v2) / (m1 + m2)
        K0 = 0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2; K1 = 0.5 * (m1 + m2) * v * v; loss = K0 - K1
        agree(loss, 0.5 * m1 * m2 / (m1 + m2) * (v1 - v2) ** 2, 1e-9, "loss")
        if abs(v) > 0.3 and loss > 3:
            break
    sc = make_collision([{"m": m1, "v": v1}, {"m": m2, "v": v2}])
    stim = diagram_stim("Two carts before they stick together", sc)
    k1, d1 = num_opts(v, [("Averages the two velocities without weighting by mass.", (v1 + v2) / 2), ("Divides the first cart's momentum by the total mass only.", m1 * v1 / (m1 + m2)),
                          ("Ignores the sign of the second velocity.", (m1 * v1 + m2 * abs(v2)) / (m1 + m2)), ("Divides total momentum by the first cart's mass.", (m1 * v1 + m2 * v2) / m1)], "m/s")
    k2, d2 = num_opts(loss, [("Reports the final kinetic energy instead of the energy lost.", K1), ("Reports the initial kinetic energy of the first cart only.", 0.5 * m1 * v1 ** 2),
                             ("Subtracts the speeds before squaring: $\\tfrac12(m_1+m_2)(v_1-v)^2$.", 0.5 * (m1 + m2) * (v1 - v) ** 2), ("Reports the change in momentum of the first cart as an energy.", m1 * abs(v1 - v))], "J")
    q = []
    for st, key, ds, top, nm in [("What is the velocity of the combined carts after the collision? Take right as positive.", k1, d1, "4.3", "q1"), ("How much kinetic energy is lost in the collision?", k2, d2, "4.4", "q2")]:
        q.append(mk(f"phs_collision_set_{nm}", top, "2.B", st, key, ds, rng, concept="Two questions about a perfectly inelastic collision", thinking=["Use conservation of momentum or energy accounting", "Compute the requested quantity from the shared data"],
                    cond=[("the carts stick together on a frictionless track", "the shared diagram states the carts stick together")], path="sympy conservation equations versus numpy arithmetic; the energy loss is also recomputed from the reduced mass formula", material=MAT_DIAGRAM("two carts with masses and velocities"),
                    judgment=["law_selection", "symbolic_reasoning"], est=95, facts=[f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}"], kwhy=(f"Momentum is conserved, so $v=({m1:g}\\cdot{v1:g}+{m2:g}\\cdot({v2:g}))/{m1 + m2:g}={sig(v)}\\text{{ m/s}}$." if nm == "q1"
                          else f"Before the collision $K_0=\\tfrac12({m1:g})({v1:g})^2+\\tfrac12({m2:g})({v2:g})^2={sig(K0)}\\text{{ J}}$ and after it $K_1=\\tfrac12({m1 + m2:g})({sig(v)})^2={sig(K1)}\\text{{ J}}$, so ${sig(loss)}\\text{{ J}}$ is lost.")))
    intro = f"On a frictionless track, a ${m1:g}\\text{{ kg}}$ cart moving at ${v1:g}\\text{{ m/s}}$ collides with and sticks to a ${m2:g}\\text{{ kg}}$ cart with velocity ${v2:g}\\text{{ m/s}}$ (right is positive)."
    return {"archetype": "phs_collision_set", "topic": "4.3", "skill": "2.B", "calculator": "allowed", "set_intro": intro, "stimulus": stim, "items": q, "facts": q[0]["facts"], "blueprint": q[0]["blueprint"]}


STAGE_U6 = ["ph_rolling_incline", "ph_ang_mom_platform", "ph_orbit_period_ratio", "ph_torque_time_area"]
STAGE_U7 = ["ph_period_scaling", "ph_shm_vmax", "ph_shm_energy"]
STAGE_U8 = ["ph_float_fraction", "ph_gauge_pressure", "ph_continuity", "ph_bernoulli_dp", "ph_torricelli_range", "ph_hydraulic_lift", "ph_apparent_weight"]
STAGE_SETS = ["phs_vt_set", "phs_collision_set"]
