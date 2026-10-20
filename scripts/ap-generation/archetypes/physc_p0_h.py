"""AP Physics C: Mechanics 원형 H — 2문항 공유 자료 세트(그래프/함수 자료 하나에 문항 둘)."""
from physc_common import *

x_ = sp.symbols("x", positive=True)
t_ = sp.symbols("t", positive=True)


@retry_sep
def pcs_fx_poly_set(rng):
    """세트: F(x)=c x^2 그래프 → (일, 나중 속력). 단원 3."""
    for _ in forever():
        c = pick(rng, [1.0, 2.0, 3.0]); X = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [1.0, 2.0, 4.0]); W = c * X ** 3 / 3; v = math.sqrt(2 * W / m)
        agree(W, simpson(lambda s: c * s * s, 0, X), 1e-6, "W")
        if W > 5:
            break
    k1, d1 = num_opts(W, [("Multiplies the final force by the distance.", c * X ** 3), ("Averages the initial and final forces and multiplies by the distance.", c * X ** 3 / 2), ("Integrates to $cX^2/2$, using the wrong power.", c * X ** 2 / 2), ("Integrates twice, $cX^4/12$.", c * X ** 4 / 12)], "J")
    k2, d2 = num_opts(v, [("Omits the factor of two in the work-energy theorem, $\\sqrt{W/m}$.", math.sqrt(W / m)), ("Reports the work per unit mass, $W/m$, as the speed.", W / m), ("Uses the final force times the distance as the work, $\\sqrt{2cX^3/m}$.", math.sqrt(2 * c * X ** 3 / m)), ("Forgets the square root, $2W/m$.", 2 * W / m)], "m/s")
    stim = dense_graph_stim("Net force on the block versus position, $F(x)=cx^2$", lambda s: c * s * s, 0, X, gaxis("Position (m)", 0, X, 1), gaxis("Net force (N)", 0, math.ceil(c * X * X / 2) * 2, max(1, math.ceil(c * X * X / 8))), n=61)
    q = []
    for st, key, ds, nm, kw in [(f"How much work does the net force do on the block from $x=0$ to $x={X:g}\\text{{ m}}$?", k1, d1, "q1", f"$W=\\int_0^{{{X:g}}}{c:g}x^2dx={sig(W)}\\text{{ J}}$."),
                                (f"What is the speed of the block at $x={X:g}\\text{{ m}}$?", k2, d2, "q2", f"$\\tfrac12mv^2=W$ gives $v=\\sqrt{{2W/m}}={sig(v)}\\text{{ m/s}}$.")]:
        q.append(mk(f"pcs_fx_poly_set_{nm}", "3.2", "2.B", st, key, ds, rng, concept="Two questions about work by a force that depends on position", thinking=["Integrate the force over the displacement", "Use the work-energy theorem for the speed"],
                    cond=[("the plotted force is the net force and its form is given by the equation in the shared description", "the shared stimulus states $F(x)=cx^2$ and plots it")], path="sympy integral versus Simpson integration; speed from the energy equation", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=95, facts=[f"c={c}", f"X={X}", f"m={m}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ block starts from rest at $x=0$ on a frictionless horizontal surface. The net force on the block along the $x$-axis is $F(x)={c:g}x^2$ (with $F$ in newtons and $x$ in meters), plotted in the graph."
    return set_pack("pcs_fx_poly_set", "3.2", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_xt_cubic_set(rng):
    """세트: x(t) 함수 → (t0 의 속도, 속도가 0 인 시각). 단원 1."""
    for _ in forever():
        r1 = pick(rng, [1, 2]); r2 = r1 + pick(rng, [1, 2, 3]); k = pick(rng, [1, 2])
        B = 1.5 * k * (r1 + r2)
        if B != int(B):
            continue
        A = k; C = 3 * k * r1 * r2; x = A * t_ ** 3 - int(B) * t_ ** 2 + C * t_; t0 = pick(rng, [t for t in range(1, 6) if t not in (r1, r2)]); v0 = float(sp.diff(x, t_).subs(t_, t0)); f = sp.lambdify(t_, x, "math")
        agree(v0, nd(f, t0), 1e-6, "v"); disp = float(x.subs(t_, r2) - x.subs(t_, r1))
        if v0 != 0 and abs(disp) > 1:
            break
    k1, d1 = signed_opts(v0, [("Divides the position by the time, which gives an average velocity.", float(x.subs(t_, t0)) / t0), ("Evaluates the position function instead of its derivative.", float(x.subs(t_, t0))), ("Differentiates only the cubic term.", 3.0 * A * t0 * t0), ("Reports the acceleration at that time.", float(sp.diff(x, t_, 2).subs(t_, t0)))], "m/s")
    k2, d2 = signed_opts(disp, [("Reports the absolute value of the displacement as a distance with the wrong sign.", -disp), ("Divides the displacement by the elapsed time, which is the average velocity.", disp / (r2 - r1)), ("Reports the position at the later time only.", float(x.subs(t_, r2))), ("Reports the position at the earlier time only.", float(x.subs(t_, r1)))], "m")
    q = []
    for st, key, ds, nm, kw in [(f"What is the velocity of the particle at $t={t0}\\text{{ s}}$?", k1, d1, "q1", f"$v=dx/dt={3 * A}t^2-{2 * int(B)}t+{C}$ at $t={t0}\\text{{ s}}$ is ${sig(v0)}\\text{{ m/s}}$."),
                                (f"The particle is momentarily at rest at $t={r1}\\text{{ s}}$ and at $t={r2}\\text{{ s}}$. What is its displacement between these two times?", k2, d2, "q2", f"$\\Delta x=x({r2})-x({r1})={sig(disp)}\\text{{ m}}$.")]:
        q.append(mk(f"pcs_xt_cubic_set_{nm}", "1.2", "2.B", st, key, ds, rng, concept="Two questions about one position function", thinking=["Differentiate the position function when a velocity is needed", "Evaluate the position function at the two times when a displacement is needed"],
                    cond=[("the position function is the one given in the shared description", "the shared stimulus states the position function")], path="sympy derivative versus a central finite difference; the displacement from direct evaluation", material=MAT_NONE,
                    judgment=["law_selection", "symbolic_reasoning"], est=95, facts=[f"A={A}", f"B={B}", f"C={C}", f"t0={t0}"], kwhy=kw))
    tmax = max(r2 + 1, t0 + 1); xs_ = [float(x.subs(t_, i / 10)) for i in range(0, int(tmax * 10) + 1)]; lo = math.floor(min(xs_) / 2) * 2 - 2; hi = math.ceil(max(xs_) / 2) * 2 + 2
    stim = dense_graph_stim("Position of the particle versus time", lambda s_: float(x.subs(t_, s_)), 0, tmax, gaxis("Time (s)", 0, tmax, 1), gaxis("Position (m)", lo, hi, max(2, (hi - lo) // 6 // 2 * 2)), n=int(tmax * 10) + 1)
    intro = f"A particle moves along the $x$-axis with position $x(t)={A}t^3-{int(B)}t^2+{C}t$, where $x$ is in meters and $t$ is in seconds. The graph shows $x$ as a function of time."
    return set_pack("pcs_xt_cubic_set", "1.2", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_ft_sine_set(rng):
    """세트: F(t)=c sin(pi t/T) 그래프 → (충격량, 평균 힘). 단원 4."""
    for _ in forever():
        c = pick(rng, [10.0, 20.0, 30.0, 50.0]); T = pick(rng, [0.02, 0.04, 0.10, 0.20]); J = 2 * c * T / math.pi; Fav = J / T
        agree(J, simpson(lambda s: c * math.sin(math.pi * s / T), 0, T), 1e-6, "J")
        break
    k1, d1 = num_opts(J, [("Multiplies the peak force by the time, $cT$.", c * T), ("Takes half of the peak force times the time, $cT/2$.", c * T / 2), ("Uses $cT/\\pi$, forgetting a factor of two from the integral of the sine.", c * T / math.pi), ("Uses $\\pi cT/2$.", math.pi * c * T / 2)], "N·s")
    k2, d2 = num_opts(Fav, [("Reports the peak force.", c), ("Reports half of the peak force.", c / 2), ("Divides the impulse by two times the duration.", J / (2 * T)), ("Reports $c/\\pi$.", c / math.pi)], "N")
    stim = dense_graph_stim("Force on the ball versus time during the contact", lambda s: c * math.sin(math.pi * s / T), 0, T, gaxis("Time (s)", 0, T, T / 4), gaxis("Force (N)", 0, c, c / 5), n=81)
    q = []
    for st, key, ds, nm, kw in [("What is the magnitude of the impulse that the force delivers during the contact?", k1, d1, "q1", f"$J=\\int_0^T c\\sin(\\pi t/T)dt=2cT/\\pi={sig(J)}\\text{{ N·s}}$."),
                                ("What is the magnitude of the average force during the contact?", k2, d2, "q2", f"$F_{{avg}}=J/T=2c/\\pi={sig(Fav)}\\text{{ N}}$.")]:
        q.append(mk(f"pcs_ft_sine_set_{nm}", "4.2", "2.B", st, key, ds, rng, concept="Two questions about one force-time function", thinking=["Integrate the force over the contact time for the impulse", "Divide the impulse by the duration for the average force"],
                    cond=[("the force has the sine form given in the shared description", "the shared stimulus states the function and plots it")], path="sympy integral versus Simpson integration", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"c={c}", f"T={T}"], kwhy=kw))
    intro = f"During a collision with a wall, the force on a ball is $F(t)={c:g}\\sin(\\pi t/{T:g})$ (in newtons, with $t$ in seconds) for $0\\le t\\le{T:g}\\text{{ s}}$, as shown in the graph. The ball is in contact with the wall only during this time."
    return set_pack("pcs_ft_sine_set", "4.2", intro, stim, q, q[0]["facts"])


@retry_sep
def pcs_shm_energy_set(rng):
    """세트: U(x) 포물선과 총 에너지 E → (진폭, 최대 속력). 단원 7."""
    for _ in forever():
        k = pick(rng, [50.0, 100.0, 200.0]); m = pick(rng, [0.5, 1.0, 2.0]); A = pick(rng, [0.10, 0.20, 0.30]); E = 0.5 * k * A * A; vmax = math.sqrt(2 * E / m)
        T2, vq = _shm(k, m, A); agree(vmax, vq, 3e-3, "vmax")
        break
    k1, d1 = num_opts(A, [(f"Divides the energy by the spring constant, $E/k={sig(E / k)}\\text{{ m}}$, with the wrong power.", E / k), (f"Takes $\\sqrt{{E/k}}={sig(math.sqrt(E / k))}\\text{{ m}}$, missing the factor of two in $E=\\tfrac12kA^2$.", math.sqrt(E / k)), (f"Reads the total energy, ${sig(E)}\\text{{ J}}$, as if it were a position in meters.", E), (f"Solves $E=\\tfrac12kA$ with the amplitude to the first power, $2E/k={sig(2 * E / k)}\\text{{ m}}$.", 2 * E / k)], "m")
    k2, d2 = num_opts(vmax, [(f"Omits the factor of two, $\\sqrt{{E/m}}={sig(math.sqrt(E / m))}\\text{{ m/s}}$.", math.sqrt(E / m)), (f"Divides the energy by the mass without a square root, $E/m={sig(E / m)}\\text{{ m/s}}$.", E / m), (f"Uses the potential energy at half of the amplitude as the kinetic energy, $\\sqrt{{2(E/4)/m}}={sig(math.sqrt(2 * E / 4 / m))}\\text{{ m/s}}$.", math.sqrt(2 * E / 4 / m)), (f"Multiplies instead of dividing by the mass, $\\sqrt{{2Em}}={sig(math.sqrt(2 * E * m))}\\text{{ m/s}}$.", math.sqrt(2 * E * m))], "m/s")
    xs = [i * A / 20 for i in range(-30, 31)]; U = [[round(x, 5), round(0.5 * k * x * x, 5)] for x in xs]
    stim = graph_stim("Potential energy of the block (curve U) and total mechanical energy (line E)", [("U", [tuple(p) for p in U]), ("E", [(round(xs[0], 5), round(E, 5)), (round(xs[-1], 5), round(E, 5))])], gaxis("Position (m)", round(-1.5 * A, 4), round(1.5 * A, 4), round(A / 2, 4)), gaxis("Energy (J)", 0, round(E * 2.5, 4), round(E / 2, 4)))
    q = []
    for st, key, ds, nm, kw in [("What is the amplitude of the oscillation?", k1, d1, "q1", f"The block turns around where $U=E$, which the graph shows at $x=\\pm{sig(A)}\\text{{ m}}$."),
                                ("What is the maximum speed of the block?", k2, d2, "q2", f"At $x=0$ all of $E$ is kinetic: $\\tfrac12mv^2=E$ gives $v={sig(vmax)}\\text{{ m/s}}$.")]:
        q.append(mk(f"pcs_shm_energy_set_{nm}", "7.4", "2.B", st, key, ds, rng, concept="Two questions about one potential energy graph of an oscillator", thinking=["Locate the turning points where the potential energy curve meets the total energy line", "Use the kinetic energy at the equilibrium position for the speed"],
                    cond=[("the oscillator is ideal and the total energy is constant", "the shared description states an ideal spring and a frictionless surface")], path="an RK4 integration of the oscillator recomputes the maximum speed at the equilibrium position", material=MAT_GRAPH("axis labels with units", "total energy line"),
                    judgment=["representation_reading", "law_selection"], est=100, facts=[f"k={k}", f"m={m}", f"A={A}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ block on a frictionless surface is attached to an ideal spring and oscillates. The graph shows the potential energy $U$ of the system as a function of the position of the block and its constant total mechanical energy $E$."
    return set_pack("pcs_shm_energy_set", "7.4", intro, stim, q, q[0]["facts"])


def _shm(k, m, A):
    st = np.array([A, 0.0]); t = 0.0; dt = 1e-4
    while st[0] > 0:
        prv = st.copy(); st = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), st, t, t + dt, 1); t += dt
    fr = prv[0] / (prv[0] - st[0]); return 4 * (t - dt + dt * fr), abs(prv[1] + (st[1] - prv[1]) * fr)


@retry_sep
def pcs_drag_graph_set(rng):
    """세트: 선형 저항 낙하 v–t 그래프 → (종단 속력, 저항 계수). 단원 2."""
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); b = pick(rng, [2.0, 4.0, 5.0]); vt = m * CG / b; tau = m / b
        if not (3 <= vt <= 30):
            continue
        y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, 6 * tau, 6000); agree(vt * (1 - math.exp(-6)), y[0], 1e-5, "v6")
        break
    k1, d1 = num_opts(vt, [(f"Reads the speed at $t={sig(tau)}\\text{{ s}}$, ${sig(vt * (1 - math.exp(-1)))}\\text{{ m/s}}$, where the curve is still rising.", vt * (1 - math.exp(-1))), (f"Reads the speed at $t={sig(2 * tau)}\\text{{ s}}$, ${sig(vt * (1 - math.exp(-2)))}\\text{{ m/s}}$, before the curve levels off.", vt * (1 - math.exp(-2))), (f"Takes half of the plateau value, ${sig(0.5 * vt)}\\text{{ m/s}}$, as the terminal speed.", 0.5 * vt), (f"Reads the top of the vertical axis, ${sig(round(vt * 1.25, 3))}\\text{{ m/s}}$, as the terminal speed.", round(vt * 1.25, 3))], "m/s")
    k2, d2 = num_opts(b, [(f"Divides the terminal speed by the weight, $v_t/(mg)={sig(vt / (m * CG))}\\text{{ kg/s}}$.", vt / (m * CG)), (f"Uses the weight $mg={sig(m * CG)}\\text{{ N}}$ as the drag coefficient.", m * CG), (f"Divides the terminal speed by $g$, $v_t/g={sig(vt / CG)}$, which has the units of a time.", vt / CG), (f"Multiplies the mass by the terminal speed, $mv_t={sig(m * vt)}\\text{{ kg·m/s}}$.", m * vt)], "kg/s")
    stim = dense_graph_stim("Speed of the falling object versus time", lambda s: vt * (1 - math.exp(-s / tau)), 0, 6 * tau, gaxis("Time (s)", 0, round(6 * tau, 3), round(tau, 3)), gaxis("Speed (m/s)", 0, round(vt * 1.25, 3), round(vt / 4, 3)), n=121)
    q = []
    for st, key, ds, nm, kw in [("What is the terminal speed of the object?", k1, d1, "q1", f"The curve approaches the constant value ${sig(vt)}\\text{{ m/s}}$."),
                                ("What is the drag coefficient $b$?", k2, d2, "q2", f"At terminal speed $bv_t=mg$ gives $b=mg/v_t={sig(b)}\\text{{ kg/s}}$.")]:
        q.append(mk(f"pcs_drag_graph_set_{nm}", "2.9", "2.B", st, key, ds, rng, concept="Two questions about one speed-time graph of a falling object with linear drag", thinking=["Read the plateau of the speed-time graph as the terminal speed", "Use the force balance at terminal speed to find the drag coefficient"],
                    cond=[("the drag force is $bv$", "the shared description states the drag force law")], path="an RK4 integration of the equation of motion reproduces the graph and its plateau", material=MAT_GRAPH("axis labels with units"),
                    judgment=["representation_reading", "law_selection"], est=105, facts=[f"m={m}", f"b={b}"], kwhy=kw))
    intro = f"A ${m:g}\\text{{ kg}}$ object is released from rest and falls through a fluid that exerts a drag force of magnitude $bv$ opposing the motion. The graph shows the speed of the object as a function of time."
    return set_pack("pcs_drag_graph_set", "2.9", intro, stim, q, q[0]["facts"])


STAGE_SETS = ["pcs_fx_poly_set", "pcs_xt_cubic_set", "pcs_ft_sine_set", "pcs_shm_energy_set", "pcs_drag_graph_set"]
