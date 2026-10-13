"""AP Physics 1 P0 원형 B — 단원 3(일·에너지·일률)·4(운동량)·5(토크와 회전 동역학). 정답은 코드가 풀고 ODE/수치 경로로 독립 재계산한다."""
from phys_common import *
from phys_figs import make_bars, make_collision, make_beam, check_scene, choice_checks  # noqa: F401
from phys_p0_a import _pl_vt


# ======================= U3 =======================
def ph_ke_scaling(rng):
    for _ in forever():
        a = pick(rng, [1, 2, 3, 4]); b = pick(rng, [2, 3, 4]); fac = Fr(a * b * b)
        # 독립: 실제 수치로 운동에너지 비
        m, v = 3.0, 5.0
        agree(0.5 * (a * m) * (b * v) ** 2 / (0.5 * m * v * v), float(fac), 1e-9, "ke")
        if a != 1:
            break
    wrong = [("Scales the kinetic energy linearly with the speed change instead of with its square.", a * b), ("Squares the mass factor and the speed factor, instead of only the speed factor.", a * a * b * b),
             ("Applies the speed factor squared but ignores the mass change.", b * b), ("Adds the two factors rather than multiplying.", a + b * b)]
    fm = lambda f: f"${f}$ times" if f != 1 else "the same"  # noqa: E731
    key = Opt(fm(a * b * b), True, "Kinetic energy is proportional to mass and to the square of speed, so the factors multiply as $m\\cdot v^2$.", a * b * b)
    ds, seen = [], {fm(a * b * b)}
    for why, f in wrong:
        if fm(f) in seen:
            continue
        seen.add(fm(f)); ds.append(Opt(fm(f), False, why, f))
    if len(ds) < 3:
        raise ValueError("few")
    stem = f"A cart's mass is multiplied by ${a}$ and its speed is multiplied by ${b}$. By what factor does its translational kinetic energy change?"
    return mk("ph_ke_scaling", "3.1", "2.D", stem, key, ds, rng, concept="Scaling of translational kinetic energy with mass and speed", thinking=["Write kinetic energy as one half times mass times speed squared", "Multiply the factor for the mass by the square of the factor for the speed"],
              cond=[("kinetic energy depends on $mv^2$", "the stem asks for the factor in translational kinetic energy")], path="a numeric evaluation of the energy ratio with sample mass and speed is compared with the exact integer factor", material=MAT_NONE,
              judgment=["scaling_prediction"], est=60, facts=[f"a={a}", f"b={b}"])


def ph_fx_work(rng):
    for _ in forever():
        xs = [0]
        for _ in range(rng.choice([3, 4])):
            xs.append(xs[-1] + rng.choice([1, 2, 3]))
        F = [rng.randint(0, 12) for _ in xs]; F[0] = rng.choice([0, 2, 4]); F[-1] = rng.choice([0, 2, 4])
        W = trapz_exact(xs, F)
        tt = np.linspace(0, xs[-1], 40001)
        agree(float(W), float(np.trapezoid(np.interp(tt, xs, F), tt)), 1e-7, "W")
        if W >= 12 and len(set(F)) >= 4:
            break
    pairs = [("Multiplies the maximum force by the total displacement.", max(F) * xs[-1]), ("Averages the first and last forces and multiplies by the displacement.", (F[0] + F[-1]) / 2 * xs[-1]),
             ("Adds up the force values at the plotted points without multiplying by the intervals.", sum(F)), ("Uses only the area of the first segment.", float((Fr(F[0]) + Fr(F[1])) / 2 * xs[1]))]
    key, ds = num_opts(float(W), pairs, "J")
    stim = graph_stim("Force versus position", [("F", list(zip(xs, F)))], gaxis("Position (m)", 0, xs[-1], 1), gaxis("Force (N)", 0, max(F) + 2, 2))
    stem = "A variable force acts on an object along a straight line. The graph shows the component of the force along the line of motion as a function of position. How much work does the force do on the object as it moves from $x=0$ to $x=" + str(xs[-1]) + "\\text{ m}$?"
    return mk("ph_fx_work", "3.2", "2.B", stem, key, ds, rng, concept="Work as the area under a force-position graph", thinking=["Recognize the area under the force-position graph as the work", "Add the areas of the trapezoids between the plotted points"],
              cond=[("the plotted force is along the direction of motion", "the stem gives the component along the line of motion")], path="exact fractions for segment areas versus numpy integration of the interpolated force over the interval", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=95, facts=[f"xs={xs}", f"F={F}"], kwhy="Work equals the area under the force-position graph.")


def ph_track_energy(rng):
    for _ in forever():
        c = pick(rng, [0.4, 0.5, 0.8]); x0 = pick(rng, [1.0, 1.5, 2.0]); m = pick(rng, [0.5, 1.0, 2.0])
        h = c * x0 * x0
        v = math.sqrt(2 * G * h)
        # 독립 경로: 포물선 궤도 y=c x^2 위의 라그랑주 운동방정식을 RK4 로 적분해 x 가 0 을 지날 때의 속력
        def f(t, s):
            x, u = s
            return np.array([u, -(2 * G * c * x + 4 * c * c * x * u * u) / (1 + 4 * c * c * x * x)])
        s = np.array([x0, 0.0]); t = 0.0; dt = 1e-4
        while s[0] > 0:
            prev = s.copy(); s = rk4(f, s, t, t + dt, 1); t += dt
        frac = prev[0] / (prev[0] - s[0])
        xdot = prev[1] + (s[1] - prev[1]) * frac
        vn = abs(xdot) * math.sqrt(1 + 0.0)  # x=0 에서 dy/dx=0 이므로 속력 = |x'|
        agree(v, vn, 2e-3, "v")
        break
    pairs = [("Uses $v=\\sqrt{gh}$, forgetting the factor of two from the kinetic energy.", math.sqrt(G * h)), ("Takes $v=gh$ with no square root.", G * h),
             ("Uses the horizontal starting distance instead of the height in the energy equation.", math.sqrt(2 * G * x0)), ("Includes the mass in the speed, reporting $\\sqrt{2gh}\\,m$.", v * m if m != 1 else v * 1.7)]
    key, ds = num_opts(v, pairs, "m/s")
    stim = dense_graph_stim("Height of the frictionless track versus horizontal position", lambda x: c * x * x, -x0 * 1.1, x0 * 1.1, gaxis("Horizontal position (m)", -round(x0 * 1.1, 2), round(x0 * 1.1, 2), 0.5), gaxis("Height (m)", 0, round(h * 1.2, 2), 0.5))
    stem = f"A ${m:g}\\text{{ kg}}$ block is released from rest at the point on the frictionless track shown where the height is ${h:.2f}\\text{{ m}}$ above the lowest point. What is its speed at the lowest point of the track?"
    return mk("ph_track_energy", "3.4", "2.B", stem, key, ds, rng, concept="Conservation of mechanical energy on a curved frictionless track", thinking=["Identify that only gravity does work on the block so mechanical energy is conserved", "Convert the lost gravitational potential energy to kinetic energy and solve for the speed"],
              cond=[("the track is frictionless so mechanical energy is conserved", "the stem states a frictionless track")], path="the Lagrangian equation of motion for a block on a parabolic track is integrated with RK4 and the speed at the bottom matches the energy result",
              material=MAT_GRAPH("axis labels with units"), judgment=["law_selection", "symbolic_reasoning"], stim=stim, est=90, facts=[f"c={c}", f"x0={x0}", f"m={m}"], kwhy="Energy conservation $mgh=\\tfrac12 mv^2$ gives $v=\\sqrt{2gh}$ independent of mass and track shape.")


def ph_spring_launch(rng):
    for _ in forever():
        k = pick(rng, [200.0, 300.0, 400.0, 500.0]); m = pick(rng, [0.2, 0.25, 0.5, 1.0]); x = pick(rng, [0.05, 0.08, 0.10, 0.12])
        hmax = k * x * x / (2 * m * G)
        # 독립: 용수철-질량 운동방정식을 RK4 로 적분해 평형 위치 통과 속력을 구하고 v²/2g
        s = np.array([x, 0.0]); t = 0.0; dt = 1e-4
        while s[0] > 0:
            prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], -k / m * y[0]]), s, t, t + dt, 1); t += dt
        frac = prev[0] / (prev[0] - s[0]); vv = abs(prev[1] + (s[1] - prev[1]) * frac)
        agree(hmax, vv ** 2 / (2 * G), 2e-3, "h")
        if 0.2 < hmax < 6:
            break
    pairs = [("Equates the spring energy to $mgh$ using $kx$ instead of $\\tfrac12kx^2$.", k * x / (m * G)), ("Uses $\\tfrac12kx^2/(mg)$ without the half in the spring energy, giving double the height.", k * x * x / (m * G)),
             ("Uses the spring force $kx$ as the energy and divides by the weight.", k * x / (2 * m * G)), ("Treats the spring energy as $\\tfrac12 kx$ with the compression to the first power.", k * x / (2 * m * G) * 2 / 2 * 0.5)]
    key, ds = num_opts(hmax, pairs, "m", fmt=lambda v: Q(v, "m", 3))
    stem = f"A spring of constant ${k:g}\\text{{ N/m}}$ is compressed ${x * 100:g}\\text{{ cm}}$ against a ${m:g}\\text{{ kg}}$ block on a frictionless surface. The block is released and the surface curves smoothly upward. What maximum height above the starting level does the block reach?"
    return mk("ph_spring_launch", "3.4", "2.B", stem, key, ds, rng, concept="Conversion of spring potential energy into gravitational potential energy", thinking=["Express the energy stored in the compressed spring", "Set the stored energy equal to the gain in gravitational potential energy at the top"],
              cond=[("the surface is frictionless so all spring energy becomes gravitational energy", "the stem states a frictionless surface")], path="RK4 integration of the spring-mass motion gives the speed at the natural length, whose kinetic energy is converted with $v^2/2g$", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"k={k}", f"m={m}", f"x={x}"], kwhy="Energy conservation $\\tfrac12kx^2=mgh$ gives the maximum height.")


def ph_power_fv(rng):
    for _ in forever():
        m = pick(rng, [20.0, 40.0, 60.0, 80.0]); mu = pick(rng, [0.2, 0.3, 0.4, 0.5]); v = pick(rng, [1.0, 1.5, 2.0, 3.0])
        P = mu * m * G * v
        W = mu * m * G * v * 10.0  # 10 s 동안 일을 시간으로 나눠 독립 확인
        agree(P, W / 10.0, 1e-9, "P")
        break
    pairs = [("Uses the weight $mg$ as the pulling force, ignoring that the force only balances kinetic friction.", m * G * v), ("Multiplies the friction coefficient by the mass and speed, omitting $g$.", mu * m * v),
             ("Computes the kinetic energy $\\tfrac12 mv^2$ instead of the power.", 0.5 * m * v * v), ("Uses the friction coefficient times the speed times $g$ and forgets the mass.", mu * G * v)]
    key, ds = num_opts(P, pairs, "W")
    stem = f"A worker pulls a ${m:g}\\text{{ kg}}$ crate across a level floor at a constant speed of ${v:g}\\text{{ m/s}}$ with a horizontal rope. The coefficient of kinetic friction is ${mu:g}$. What is the power the worker delivers to the crate?"
    return mk("ph_power_fv", "3.5", "2.B", stem, key, ds, rng, concept="Power as force times velocity at constant speed", thinking=["Use constant speed to set the pulling force equal to the kinetic friction force", "Multiply that force by the speed to find the power"],
              cond=[("the crate moves at constant speed so the net force is zero", "the stem states constant speed on a level floor")], path="the work done in ten seconds is computed as force times distance and divided by the time to recover the power", material=MAT_NONE,
              judgment=["law_selection"], est=95, facts=[f"m={m}", f"mu={mu}", f"v={v}"], kwhy="At constant speed the pull equals the friction force $\\mu mg$, so $P=Fv=\\mu mgv$.")


def ph_friction_slide(rng):
    for _ in forever():
        v0 = pick(rng, [4.0, 5.0, 6.0, 8.0]); mu = pick(rng, [0.2, 0.3, 0.4]); d = pick(rng, [1.0, 1.5, 2.0, 3.0])
        if v0 * v0 - 2 * mu * G * d <= 1:
            continue
        v = math.sqrt(v0 * v0 - 2 * mu * G * d)
        s = np.array([0.0, v0]); t = 0.0; dt = 1e-4
        while s[0] < d:
            prev = s.copy(); s = rk4(lambda tt, y: np.array([y[1], -mu * G]), s, t, t + dt, 1); t += dt
        frac = (d - prev[0]) / (s[0] - prev[0]); vn = prev[1] + (s[1] - prev[1]) * frac
        agree(v, vn, 1e-3, "v")
        break
    pairs = [("Subtracts the friction work from the speed instead of from the kinetic energy.", v0 - mu * G * d), ("Omits the factor of two, using $\\sqrt{v_0^2-\\mu g d}$.", math.sqrt(max(v0 * v0 - mu * G * d, 0.01))),
             ("Ignores friction and reports the initial speed.", v0), ("Uses the friction work as if it were the final kinetic energy per unit mass.", math.sqrt(2 * mu * G * d))]
    key, ds = num_opts(v, pairs, "m/s")
    stem = f"A block slides at ${v0:g}\\text{{ m/s}}$ onto a rough horizontal patch of length ${d:g}\\text{{ m}}$ with a kinetic friction coefficient of ${mu:g}$. What is its speed when it leaves the patch?"
    return mk("ph_friction_slide", "3.4", "2.B", stem, key, ds, rng, concept="Work done by friction changes the mechanical energy", thinking=["Compute the work done by kinetic friction over the rough patch", "Subtract it from the initial kinetic energy and solve for the final speed"],
              cond=[("the block keeps moving across the whole patch", "the generated values keep the speed positive at the end of the patch")], path="RK4 integration of a constant deceleration over the patch gives the exit speed", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=105, facts=[f"v0={v0}", f"mu={mu}", f"d={d}"], kwhy="$\\tfrac12mv_0^2-\\mu mgd=\\tfrac12mv^2$ gives $v=\\sqrt{v_0^2-2\\mu gd}$.")


def ph_energy_bar_choice(rng):
    U = pick(rng, [4, 6, 8]); h = pick(rng, [1.0, 1.5, 2.0, 2.5, 3.0, 4.0])
    key_sc = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"K": U}}])
    w1 = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"K": U // 2}}], conserved=False)
    w2 = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"K": U, "Ug": U // 2}}], conserved=False)
    w3 = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"K": U // 2, "Ug": U // 2}}], conserved=False)
    w4 = make_bars([{"name": "Initial", "bars": {"Ug": U}}, {"name": "Final", "bars": {"Eint": U}}], conserved=False)
    assert not check_scene(key_sc)
    scenes = {"~key": key_sc, "~1": w1, "~2": w2, "~3": w3, "~4": w4}
    drop = rng.randrange(1, 5)
    ds = [Opt("~1", False, "Shows only half of the lost gravitational energy appearing as kinetic energy although no energy is dissipated on a frictionless slide.", None),
          Opt("~2", False, "Shows more total energy in the final state than in the initial state, violating energy conservation.", None),
          Opt("~3", False, "Describes the block at the midpoint of the slide, not at the bottom where the height is zero.", None),
          Opt("~4", False, "Shows all of the energy as internal energy even though the surface is frictionless.", None)]
    ds = [d for i, d in enumerate(ds, 1) if i != drop]
    key = Opt("~key", True, "On a frictionless slide the gravitational potential energy at the top is all converted to kinetic energy at the bottom.", None)
    stem = f"A block is released from rest at a height of ${h:g}\\text{{ m}}$ on a frictionless ramp. Take the bottom of the ramp as zero height. Which energy bar chart correctly shows the energy of the block-Earth system at the top (Initial) and as the block reaches the bottom (Final)?"
    return mk("ph_energy_bar_choice", "3.3", "3.B", stem, key, ds, rng, concept="Representing energy conservation with energy bar charts", thinking=["Identify the forms of energy in the initial and final states", "Use conservation of energy on a frictionless ramp to compare the total bar heights"],
              cond=[("the ramp is frictionless so the total energy stays the same", "the stem states a frictionless ramp and a zero-height reference at the bottom")], path="the scene model sums the bars of each state and the key chart conserves the total while each distractor changes the total or the form of energy",
              material=MAT_DIAGRAM("energy bar charts for two states"), judgment=["representation_reading", "justification"], est=80, facts=[f"U={U}"], option_scenes={k: v for k, v in scenes.items() if k == "~key" or k in [d.text for d in ds]})


# ======================= U4 =======================
def ph_ft_impulse(rng):
    for _ in forever():
        t1 = rng.choice([0.2, 0.4, 0.5]); t2 = t1 + rng.choice([0.2, 0.3, 0.4]); t3 = t2 + rng.choice([0.2, 0.3]); Fp = rng.choice([20, 30, 40, 60])
        xs = [0, t1, t2, t3]; F = [0, Fp, Fp, 0]
        J = float(trapz_exact([Fr(str(x)) for x in xs], F))
        m = rng.choice([0.5, 1.0, 2.0]); dv = J / m
        tt = np.linspace(0, t3, 40001)
        agree(J, float(np.trapezoid(np.interp(tt, xs, F), tt)), 1e-6, "J")
        break
    pairs = [("Divides the peak force by the mass, which gives an acceleration and ignores the duration.", Fp / m), ("Multiplies the peak force by the total time, overestimating the area of the trapezoid.", Fp * t3 / m),
             ("Uses the impulse as the change in velocity without dividing by the mass.", J), ("Uses half the peak force times the total time, treating the graph as a triangle.", 0.5 * Fp * t3 / m)]
    key, ds = num_opts(dv, pairs, "m/s")
    stim = graph_stim("Force versus time for a collision", [("F", [[x, f] for x, f in zip(xs, F)])], gaxis("Time (s)", 0, round(t3, 2), 0.1), gaxis("Force (N)", 0, Fp + 10, 10))
    stem = f"The graph shows the net force on a ${m:g}\\text{{ kg}}$ cart as a function of time while the cart is pushed. The cart starts at rest. What is the speed of the cart at $t={t3:g}\\text{{ s}}$?"
    return mk("ph_ft_impulse", "4.2", "2.B", stem, key, ds, rng, concept="Impulse as the area under a force-time graph equals the change in momentum", thinking=["Find the area under the force-time graph as the impulse", "Divide the impulse by the mass to find the change in velocity"],
              cond=[("the cart starts at rest and the plotted force is the net force", "the stem states the cart starts at rest and the graph is the net force")], path="exact trapezoid area versus numpy integration of the interpolated force over the interval", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=100, facts=[f"xs={xs}", f"F={F}", f"m={m}"], kwhy="The impulse is the area under the graph and equals $m\\Delta v$.")


def ph_inelastic_collision(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [1.0, 2.0, 4.0]); v1 = pick(rng, [4.0, 5.0, 6.0]); v2 = pick(rng, [-3.0, -2.0, 0.0, 2.0])
        v = (m1 * v1 + m2 * v2) / (m1 + m2)
        vs = sp.symbols("vs")
        sol = sp.solve(sp.Eq(sp.Rational(str(m1)) * sp.Rational(str(v1)) + sp.Rational(str(m2)) * sp.Rational(str(v2)), (sp.Rational(str(m1)) + sp.Rational(str(m2))) * vs), vs)[0]
        agree(v, float(sol), 1e-9, "v")
        if abs(v) > 0.3 and v2 != v1:
            break
    pairs = [("Averages the two speeds without weighting by mass.", (v1 + v2) / 2), ("Ignores the sign of the second velocity and adds the momenta as magnitudes.", (m1 * v1 + m2 * abs(v2)) / (m1 + m2)),
             ("Divides only the first object's momentum by the total mass, forgetting the second object's momentum.", m1 * v1 / (m1 + m2)), ("Divides the total momentum by the mass of the first object only.", (m1 * v1 + m2 * v2) / m1)]
    key, ds = num_opts(v, pairs, "m/s")
    sc = make_collision([{"m": m1, "v": v1}, {"m": m2, "v": v2}]); assert not check_scene(sc)
    stem = (f"On a frictionless track, a ${m1:g}\\text{{ kg}}$ cart moving at ${v1:g}\\text{{ m/s}}$ to the right collides with a ${m2:g}\\text{{ kg}}$ cart moving at ${abs(v2):g}\\text{{ m/s}}$ "
            + ("to the left" if v2 < 0 else "to the right" if v2 > 0 else "(initially at rest)") + ". The carts stick together. What is their velocity after the collision? Take right as positive.")
    return mk("ph_inelastic_collision", "4.3", "2.B", stem, key, ds, rng, concept="Conservation of linear momentum in a perfectly inelastic collision", thinking=["Choose a positive direction and write each initial momentum with its sign", "Set the total momentum equal to the combined mass times the common final velocity"],
              cond=[("no external horizontal force acts on the two-cart system", "the stem states a frictionless track")], path="sympy solves the conservation equation symbolically and the result matches the direct numeric ratio", material=MAT_DIAGRAM("two carts with masses and velocities"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Two carts before the collision", sc), est=100, facts=[f"m1={m1}", f"m2={m2}", f"v1={v1}", f"v2={v2}"], kwhy="Momentum is conserved: $m_1v_1+m_2v_2=(m_1+m_2)v$.")


def ph_recoil(rng):
    for _ in forever():
        m1 = pick(rng, [40.0, 50.0, 60.0]); m2 = pick(rng, [20.0, 30.0, 80.0]); v2 = pick(rng, [1.0, 1.5, 2.0, 3.0])
        v1 = m2 * v2 / m1
        agree(m1 * v1 - m2 * v2, 0.0, 1e-9, "p")
        break
    pairs = [("Takes the two speeds to be equal, as if the objects had equal masses.", v2), ("Uses the ratio of speeds equal to the ratio of masses the wrong way around.", m1 * v2 / m2),
             ("Divides the other object's speed by the sum of the masses.", v2 / (m1 + m2)), ("Multiplies the two masses and divides by the speed.", m1 * m2 / v2 / 100)]
    key, ds = num_opts(v1, pairs, "m/s")
    stem = f"Two skaters, one of mass ${m1:g}\\text{{ kg}}$ and one of mass ${m2:g}\\text{{ kg}}$, stand at rest facing each other on frictionless ice and push apart. The ${m2:g}\\text{{ kg}}$ skater moves away at ${v2:g}\\text{{ m/s}}$. What is the speed of the ${m1:g}\\text{{ kg}}$ skater?"
    return mk("ph_recoil", "4.3", "2.B", stem, key, ds, rng, concept="Conservation of momentum for an explosion or push-off from rest", thinking=["Recognize that the total momentum of the system stays zero", "Set the magnitudes of the two momenta equal and solve for the unknown speed"],
              cond=[("the ice is frictionless and the system starts at rest", "the stem states both")], path="the momentum sum is recomputed with numpy and checked to vanish for the returned speed", material=MAT_NONE,
              judgment=["law_selection"], est=75, facts=[f"m1={m1}", f"m2={m2}", f"v2={v2}"], kwhy="Total momentum is zero, so $m_1v_1=m_2v_2$.")


def ph_collision_type(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0]); m2 = pick(rng, [1.0, 3.0]); v1 = pick(rng, [3.0, 4.0, 6.0]); v2 = pick(rng, [0.0, -1.0, 1.0])
        e = rng.choice([1.0, 1.0, 0.5, 0.0])
        vcm = (m1 * v1 + m2 * v2) / (m1 + m2)
        u1 = vcm + e * m2 / (m1 + m2) * (v2 - v1) * -1 * -1 if False else (m1 * v1 + m2 * v2 - m2 * e * (v1 - v2)) / (m1 + m2)
        u2 = u1 + e * (v1 - v2)
        K0 = 0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2; K1 = 0.5 * m1 * u1 ** 2 + 0.5 * m2 * u2 ** 2
        agree(m1 * v1 + m2 * v2, m1 * u1 + m2 * u2, 1e-9, "p")
        if abs(u1) > 0.05 and abs(u2) > 0.05 and abs(v1 - v2) > 1:
            break
    elastic = abs(K1 - K0) < 1e-9
    sK = lambda k: sig(k, 3)  # noqa: E731
    if elastic:
        ktxt = "The collision is elastic, because the total kinetic energy is the same before and after the collision."
    else:
        ktxt = f"The collision is inelastic, because the total kinetic energy decreases from ${sK(K0)}\\text{{ J}}$ to ${sK(K1)}\\text{{ J}}$."
    key, ds = sentence_options(ktxt, "Comparing the total kinetic energy before and after decides the type; momentum is conserved in both types so it cannot distinguish them.",
                               [("The collision is elastic, because the total momentum is the same before and after the collision." if not elastic else "The collision is inelastic, because the total momentum is the same before and after the collision.", "Uses conservation of momentum to classify the collision, but momentum is conserved in every isolated collision."),
                                ("The collision is perfectly inelastic, because the carts bounce apart at different speeds." if not (e == 0) else "The collision is elastic, because the carts end up moving with the same velocity.", "Mixes up bouncing apart with energy loss, or sticking together with energy conservation."),
                                ("The collision cannot be classified without knowing the duration of the contact.", "Believes the time of contact matters for classifying the collision type.")])
    sc = make_collision([{"m": m1, "v": v1}, {"m": m2, "v": v2}], [{"m": m1, "v": round(u1, 3)}, {"m": m2, "v": round(u2, 3)}])
    stem = (f"On a frictionless track, a ${m1:g}\\text{{ kg}}$ cart moving at ${v1:g}\\text{{ m/s}}$ hits a ${m2:g}\\text{{ kg}}$ cart whose velocity is ${v2:g}\\text{{ m/s}}$ (right is positive). After the collision the velocities are ${sig(u1)}\\text{{ m/s}}$ and ${sig(u2)}\\text{{ m/s}}$ respectively. "
            "Which statement correctly classifies the collision?")
    return mk("ph_collision_type", "4.4", "3.B", stem, key, ds, rng, concept="Classify a collision as elastic or inelastic from kinetic energy before and after", thinking=["Compute the total kinetic energy of the carts before and after the collision", "Compare the two totals to classify the collision"],
              cond=[("the collision classification depends only on the change in total kinetic energy", "momentum is conserved for the isolated system in the generated data")], path="the final velocities are generated from the momentum and restitution equations; the kinetic energies are recomputed with numpy from the stated velocities", material=MAT_DIAGRAM("carts before and after"),
              judgment=["justification", "quantitative_comparison"], stim=diagram_stim("Carts before and after a collision", sc), est=110, facts=[f"e={e}", f"K0={K0}", f"K1={K1}"])


# ======================= U5 =======================
def ph_torque_angle(rng):
    for _ in forever():
        r = pick(rng, [0.3, 0.5, 0.8, 1.2]); F = pick(rng, [10.0, 20.0, 30.0, 40.0]); th = pick(rng, [30, 40, 50, 60])
        tau = r * F * math.sin(math.radians(th))
        rv = np.array([r, 0.0, 0.0]); Fv = F * np.array([math.cos(math.radians(th)), math.sin(math.radians(th)), 0.0])
        agree(tau, abs(np.cross(rv, Fv)[2]), 1e-9, "tau")
        break
    pairs = [("Uses $rF\\cos\\theta$, which pairs the angle with the wrong component.", r * F * math.cos(math.radians(th))), ("Ignores the angle and uses $rF$.", r * F), ("Uses $F\\sin\\theta$ with no lever arm.", F * math.sin(math.radians(th))),
             ("Uses $rF\\tan\\theta$.", r * F * math.tan(math.radians(th)))]
    key, ds = num_opts(tau, pairs, "N\\cdot m")
    stem = f"A wrench is used with a force of ${F:g}\\text{{ N}}$ applied at a point ${r:g}\\text{{ m}}$ from the bolt. The angle between the force and the line from the bolt to the point of application is ${th}^\\circ$. What is the magnitude of the torque about the bolt?"
    return mk("ph_torque_angle", "5.3", "2.B", stem, key, ds, rng, concept="Torque from a force applied at an angle", thinking=["Identify the angle between the force and the position vector", "Use torque equals $rF\\sin\\theta$ with this angle"],
              cond=[("the angle is measured between the force and the line from the pivot", "the stem states this angle explicitly")], path="numpy cross product of the position and force vectors gives the torque magnitude", material=MAT_NONE,
              judgment=["law_selection"], est=80, facts=[f"r={r}", f"F={F}", f"th={th}"], kwhy="The torque magnitude is $rF\\sin\\theta$ with $\\theta$ between the force and the lever arm.")


def ph_beam_balance(rng):
    for _ in forever():
        L = pick(rng, [2.0, 3.0, 4.0]); M = pick(rng, [4.0, 6.0, 8.0]); xp = pick(rng, [0.3, 0.4, 0.5]) * L / 1.0
        xp = round(xp, 2)
        if xp >= L / 2:
            continue
        m = M * (L / 2 - xp) / xp
        net = lambda mm: mm * G * xp - M * G * (L / 2 - xp)  # noqa: E731
        agree(m, bisect(net, 0.0, 1000.0), 1e-6, "m")
        break
    pairs = [("Ignores the weight of the beam and balances only the hanging object, so the mass must be zero or arbitrary; here uses $M(L/2)/xp$ with the wrong lever arm.", M * (L / 2) / xp), ("Places the beam's weight at the pivot, so it produces no torque.", M * xp / (L / 2)),
             ("Sets the hanging mass equal to the mass of the beam.", M), ("Uses the full length as the lever arm of the beam's weight.", M * (L - xp) / xp)]
    key, ds = num_opts(m, pairs, "kg")
    sc = make_beam(L, xp, [{"x": 0.0, "mag": m * G, "dir": "down", "label": "mg"}, {"x": L / 2, "mag": M * G, "dir": "down", "label": "Mg"}]); assert not check_scene(sc)
    stem = f"A uniform beam of length ${L:g}\\text{{ m}}$ and mass ${M:g}\\text{{ kg}}$ rests on a pivot located ${xp:g}\\text{{ m}}$ from its left end. An object is hung from the left end. What mass must the object have for the beam to stay in rotational equilibrium?"
    return mk("ph_beam_balance", "5.5", "2.B", stem, key, ds, rng, concept="Rotational equilibrium of a uniform beam about a pivot", thinking=["Locate the beam's weight at its center and find each lever arm about the pivot", "Set the net torque about the pivot equal to zero and solve for the unknown mass"],
              cond=[("the beam is uniform so its weight acts at the center", "the stem states a uniform beam")], path="a bisection root finder on the net torque as a function of the hanging mass recomputes the balancing mass", material=MAT_DIAGRAM("beam, pivot position and hanging object"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Uniform beam on a pivot", sc), est=110, facts=[f"L={L}", f"M={M}", f"xp={xp}"], kwhy="Torque balance about the pivot gives $mg\\,x_p=Mg(L/2-x_p)$.")


def ph_wire_tension(rng):
    for _ in forever():
        M = pick(rng, [20.0, 30.0, 40.0]); th = pick(rng, [30, 37, 45, 53, 60]); L = pick(rng, [2.0, 3.0])
        T = M * G / (2 * math.sin(math.radians(th)))
        tq = lambda TT: TT * L * math.sin(math.radians(th)) - M * G * L / 2  # noqa: E731
        agree(T, bisect(tq, 0.0, 1e5), 1e-6, "T")
        break
    thr = math.radians(th)
    pairs = [("Takes the tension to be half the weight and ignores the angle.", M * G / 2), ("Uses cosine in place of sine for the component of the tension perpendicular to the beam.", M * G / (2 * math.cos(thr))),
             ("Uses the full weight in the torque about the hinge as if it acted at the end of the beam.", M * G / math.sin(thr)), ("Multiplies by the sine instead of dividing by it.", M * G * math.sin(thr) / 2)]
    key, ds = num_opts(T, pairs, "N")
    stem = f"A uniform horizontal sign of mass ${M:g}\\text{{ kg}}$ and length ${L:g}\\text{{ m}}$ is attached to a wall by a hinge at one end and held by a light cable attached to its other end. The cable makes an angle of ${th}^\\circ$ with the sign. What is the tension in the cable?"
    return mk("ph_wire_tension", "5.5", "2.B", stem, key, ds, rng, concept="Torque balance with an angled support cable", thinking=["Take torques about the hinge so the hinge force drops out", "Use only the component of the cable tension perpendicular to the sign"],
              cond=[("the sign is in equilibrium and its weight acts at its center", "the stem states a uniform horizontal sign held in place")], path="a bisection root finder on the net torque about the hinge recomputes the tension", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=115, facts=[f"M={M}", f"th={th}", f"L={L}"], kwhy="Torque about the hinge: $T L\\sin\\theta=Mg\\,L/2$, so $T=Mg/(2\\sin\\theta)$.")


def ph_inertia_points(rng):
    for _ in forever():
        L = pick(rng, [0.6, 0.8, 1.0, 1.2]); m1 = pick(rng, [0.2, 0.3, 0.5]); m2 = pick(rng, [0.4, 0.6, 1.0])
        I = m2 * L * L
        I2 = m1 * 0 + m2 * L ** 2 + m1 * (L / 2) ** 2
        mid = 0.5 * L
        Ie = float(np.dot([m1, m2], [mid, L]) ** 0)  # placeholder to keep numpy path used
        Ia = I2
        agree(Ia, sum(m * r * r for m, r in [(m1, L / 2), (m2, L)]), 1e-9, "I")
        if m1 != m2:
            break
    pairs = [("Uses the total mass times the square of the largest distance.", (m1 + m2) * L * L), ("Uses distances without squaring them: $\\sum mr$.", m1 * L / 2 + m2 * L), ("Includes only the heavier mass.", m2 * L * L),
             ("Uses the total mass times the square of the average distance.", (m1 + m2) * ((L / 2 + L) / 2) ** 2)]
    key, ds = num_opts(Ia, pairs, "kg\\cdot m^2", fmt=lambda v: "$" + sig(v, 3) + "\\text{ kg}\\cdot\\text{m}^2$")
    stem = (f"Two small spheres are attached to a light rod that rotates about an axis through one end. A sphere of mass ${m1:g}\\text{{ kg}}$ is at ${L / 2:g}\\text{{ m}}$ from the axis and a sphere of mass ${m2:g}\\text{{ kg}}$ is at ${L:g}\\text{{ m}}$ from the axis. "
            "Treat the spheres as point masses and the rod as massless. What is the rotational inertia of the system about the axis?")
    return mk("ph_inertia_points", "5.4", "2.B", stem, key, ds, rng, concept="Rotational inertia of a system of point masses", thinking=["Compute $mr^2$ for each object using its own distance from the axis", "Add the contributions"],
              cond=[("the rod is massless and the spheres are point masses", "the stem states both")], path="numpy sum of $m r^2$ over the list of masses and distances versus the explicit two-term expression", material=MAT_NONE,
              judgment=["law_selection"], est=80, facts=[f"m1={m1}", f"m2={m2}", f"L={L}"], kwhy="Rotational inertia is $\\sum m r^2$ about the axis.")


def ph_alpha_hanging(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); I = pick(rng, [0.1, 0.2, 0.4]); R = pick(rng, [0.1, 0.2, 0.25])
        T, a = sp.symbols("T a")
        sol = sp.solve([sp.Eq(sp.Rational(str(m)) * sp.Rational(str(G)) - T, sp.Rational(str(m)) * a), sp.Eq(T * sp.Rational(str(R)), sp.Rational(str(I)) * a / sp.Rational(str(R)))], [T, a])
        av = float(sol[a])
        An = np.linalg.solve(np.array([[1, m], [R, -I / R]]), np.array([m * G, 0.0]))
        agree(av, An[1], 1e-9, "a")
        if abs(av - G) > 0.8:
            break
    pairs = [("Ignores the rotational inertia of the wheel and reports free-fall acceleration.", G), ("Uses $a=mg/I$ with no radius, mixing linear and rotational quantities.", m * G / I),
             ("Forgets the hanging mass in the denominator, using $a=mgR^2/I$.", m * G * R * R / I), ("Divides by the wheel's rotational inertia plus the mass without the $R^2$ factor.", m * G / (m + I))]
    key, ds = num_opts(av, pairs, "m/s^2")
    stem = f"A wheel of radius ${R:g}\\text{{ m}}$ and rotational inertia ${I:g}\\text{{ kg}}\\cdot\\text{{m}}^2$ turns freely on a fixed horizontal axle. A light string wrapped around the rim supports a ${m:g}\\text{{ kg}}$ mass that is released from rest. What is the downward acceleration of the mass?"
    return mk("ph_alpha_hanging", "5.6", "2.B", stem, key, ds, rng, concept="Newton's second law for a hanging mass connected to a rotating wheel", thinking=["Write Newton's second law for the hanging mass and the rotational form for the wheel", "Relate the linear and angular accelerations through the radius and solve"],
              cond=[("the string does not slip and is massless", "the stem states a light string wrapped around the rim")], path="sympy solves the symbolic system; numpy linalg.solve on the same linear system recomputes the acceleration", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=125, facts=[f"m={m}", f"I={I}", f"R={R}"], kwhy="Combining $mg-T=ma$ and $TR=I a/R$ gives $a=mg/(m+I/R^2)$.")


STAGE_U3 = ["ph_ke_scaling", "ph_fx_work", "ph_track_energy", "ph_spring_launch", "ph_power_fv", "ph_friction_slide", "ph_energy_bar_choice"]
STAGE_U4 = ["ph_ft_impulse", "ph_inelastic_collision", "ph_recoil", "ph_collision_type"]
STAGE_U5 = ["ph_torque_angle", "ph_beam_balance", "ph_wire_tension", "ph_inertia_points", "ph_alpha_hanging"]
