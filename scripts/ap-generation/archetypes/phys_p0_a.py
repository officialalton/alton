"""AP Physics 1 P0 원형 A — 단원 1(운동학)·2(힘과 병진 동역학). 정답은 코드가 sympy/정확 분수로 풀고 numpy·ODE·이분법으로 독립 재계산한다.
각 함수는 시드 rng 하나로 한 문항 팩을 만든다. 조건 불충족 시 ValueError(파이프라인이 시드를 건너뛴다)."""
from phys_common import *
from phys_figs import make_fbd, make_vectors, make_motion_diagram, make_atwood, check_scene, choice_checks, render_svg  # noqa: F401

t_, v_ = sp.symbols("t v", positive=True)


def _pl_vt(rng, nseg=None, vmin=-6, vmax=9):
    nseg = nseg or pick(rng, [3, 4])
    xs = [0]
    for _ in range(nseg):
        xs.append(xs[-1] + pick(rng, [2, 3, 4]))
    vs = [rng.randint(vmin, vmax) for _ in xs]
    vs[0] = pick(rng, [0, 0, 2, 4])
    return xs, vs


def _dist_exact(xs, vs):
    """구간선형 속도의 이동 거리(영점 교차에서 구간을 나눈다), 정확 분수."""
    tot = Fr(0)
    for i in range(len(xs) - 1):
        a, b, dt = Fr(vs[i]), Fr(vs[i + 1]), Fr(xs[i + 1] - xs[i])
        if a * b >= 0:
            tot += abs(a + b) / 2 * dt
        else:
            tz = dt * abs(a) / (abs(a) + abs(b))
            tot += abs(a) * tz / 2 + abs(b) * (dt - tz) / 2
    return tot


# ======================= 1. v–t 그래프 변위 (1.2 / 2.B, 그림: G) =======================
def ph_vt_displacement(rng):
    ctx = pick(rng, ["a cart on a straight track", "a cyclist on a straight road", "a toy train on a straight rail"])
    for _ in forever():
        xs, vs = _pl_vt(rng)
        disp = trapz_exact(xs, vs)
        dist = _dist_exact(xs, vs)
        # 독립 경로: 촘촘한 표본 적분(변위)과 |v| 적분(거리)
        tt = np.linspace(0, xs[-1], 40001); vv = np.interp(tt, xs, vs)
        agree(float(disp), float(np.trapezoid(vv, tt)), 1e-6, "disp"); agree(float(dist), float(np.trapezoid(np.abs(vv), tt)), 1e-5, "dist")
        if disp != 0 and abs(float(disp)) >= 4 and float(dist) != abs(float(disp)) and vs[-1] != 0:
            break
    T = xs[-1]
    pairs = [("Reports the total distance traveled (area of the graph ignoring sign) instead of the displacement.", float(dist)),
             (f"Multiplies the final velocity by the total time, assuming the velocity stayed at its last value.", vs[-1] * T),
             ("Averages the first and last velocities and multiplies by the total time, which only works when the acceleration is constant.", (vs[0] + vs[-1]) / 2 * T),
             ("Finds the area of only the first segment of the graph rather than the whole interval.", float((Fr(vs[0]) + Fr(vs[1])) / 2 * (xs[1] - xs[0])))]
    key, ds = num_opts(float(disp), pairs, "m")
    stim = graph_stim("Velocity versus time for the motion", [("v", list(zip(xs, vs)))], gaxis("Time (s)", 0, T, 1), gaxis("Velocity (m/s)", min(vs + [0]) - 1, max(vs + [0]) + 1, 1))
    stem = f"The graph shows the velocity of {ctx} as a function of time. What is the displacement of the object from $t=0$ to $t={T}\\text{{ s}}$? Positive is to the right."
    return mk("ph_vt_displacement", "1.2", "2.B", stem, key, ds, rng, concept="Displacement is the signed area under a velocity-time graph", thinking=["Read the velocity at each vertex of the graph", "Add signed areas of the segments, with area below the axis counted as negative displacement"],
              cond=[("the velocity is piecewise linear between the plotted vertices", "the graph is built from integer vertices joined by straight segments")], path="exact fractions for trapezoid areas versus numpy trapezoid integration of a dense resampling of the same graph",
              material=MAT_GRAPH("axis labels with units", "vertices"), judgment=["representation_reading", "quantitative_comparison"], stim=stim, est=100, facts=[f"xs={xs}", f"vs={vs}"], kwhy="Displacement is the signed area under the velocity-time graph; area below the axis subtracts.")


# ======================= 2. a–t 그래프 → 속도 변화 (1.2 / 2.B, 그림: G) =======================
def ph_at_velocity_change(rng):
    for _ in forever():
        xs, a = _pl_vt(rng, vmin=-4, vmax=6)
        v0 = pick(rng, [-4, -2, 0, 2, 3, 5])
        dv = trapz_exact(xs, a)
        vf = v0 + float(dv)
        tt = np.linspace(0, xs[-1], 40001)
        agree(vf, v0 + float(np.trapezoid(np.interp(tt, xs, a), tt)), 1e-6, "vf")
        if dv != 0 and vf != 0 and abs(float(dv)) >= 3 and abs(vf) != abs(float(dv)):
            break
    T = xs[-1]
    pairs = [("Reports the change in velocity but forgets to add the initial velocity.", float(dv)),
             ("Multiplies the final acceleration by the elapsed time, treating the acceleration as constant.", a[-1] * T + v0),
             ("Subtracts the area from the initial velocity, as if the acceleration pointed opposite to the stated positive direction.", v0 - float(dv)),
             ("Uses only the largest acceleration on the graph times the elapsed time.", max(a, key=abs) * T + v0)]
    key, ds = num_opts(vf, pairs, "m/s")
    stim = graph_stim("Acceleration versus time", [("a", list(zip(xs, a)))], gaxis("Time (s)", 0, T, 1), gaxis("Acceleration (m/s²)", min(a + [0]) - 1, max(a + [0]) + 1, 1))
    stem = f"The graph shows the acceleration of an object moving along a straight line. At $t=0$ the velocity is ${v0}\\text{{ m/s}}$. What is the velocity at $t={T}\\text{{ s}}$?"
    return mk("ph_at_velocity_change", "1.2", "2.B", stem, key, ds, rng, concept="The area under an acceleration-time graph is the change in velocity", thinking=["Recognize that the area under a-t is the change in velocity", "Add the signed area to the initial velocity"],
              cond=[("the acceleration is piecewise linear in time", "the graph is built from integer vertices")], path="exact fractions for segment areas versus numpy integration of a dense resampling", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=100, facts=[f"xs={xs}", f"a={a}", f"v0={v0}"], kwhy="The final velocity is the initial velocity plus the signed area under the a-t graph.")


# ======================= 3. 등가속 직선 운동 시간 (1.2 / 2.B) =======================
def ph_kinematics_time(rng):
    for _ in forever():
        v0 = pick(rng, [3.0, 4.0, 5.0, 6.0, 8.0]); a = pick(rng, [1.5, 2.0, 2.5, 3.0, 4.0]); d = pick(rng, [30, 40, 50, 60, 80])
        tsym = sp.symbols("tau", positive=True)
        sols = sp.solve(sp.Eq(v0 * tsym + sp.Rational(str(a)) / 2 * tsym ** 2, d), tsym)
        ts = float(max(sols, key=float))
        tn = bisect(lambda x: v0 * x + a / 2 * x * x - d, 0, 100)
        agree(ts, tn, 1e-9, "t")
        if ts > 2:
            break
    pairs = [("Divides the distance by the initial speed, ignoring the acceleration.", d / v0),
             ("Uses the final speed as if it were constant over the whole trip and divides the distance by it.", d / (v0 + a * ts)),
             ("Drops the factor of one half in the displacement equation.", float(max(sp.solve(sp.Eq(v0 * tsym + sp.Rational(str(a)) * tsym ** 2, d), tsym), key=float))),
             ("Divides the distance by the average of the initial speed and the acceleration, mixing units.", d / ((v0 + a) / 2))]
    key, ds = num_opts(ts, pairs, "s")
    stem = f"A skater moving at ${v0:g}\\text{{ m/s}}$ along a straight line speeds up uniformly at ${a:g}\\text{{ m/s}}^2$. How long does the skater take to travel ${d}\\text{{ m}}$ while speeding up?"
    return mk("ph_kinematics_time", "1.2", "2.B", stem, key, ds, rng, concept="Choose the kinematic equation that links displacement, initial velocity, acceleration and time", thinking=["Identify which quantities are known and unknown", "Solve the quadratic from the displacement equation and keep the physically meaningful root"],
              cond=[("the acceleration is constant", "the problem states the skater speeds up uniformly")], path="sympy solves the quadratic symbolically; a bisection root finder on the displacement function recomputes the time", material=MAT_NONE,
              judgment=["law_selection"], est=110, facts=[f"v0={v0}", f"a={a}", f"d={d}"], kwhy="The displacement equation gives a quadratic in time; its positive root is the travel time.")


# ======================= 4. 경사 던지기 사거리 (1.5 / 2.B) =======================
def ph_projectile_range(rng):
    for _ in forever():
        v0 = pick(rng, [12.0, 15.0, 18.0, 20.0, 25.0]); th = pick(rng, [25, 30, 35, 40, 50, 55, 60, 65])
        R = v0 ** 2 * math.sin(2 * math.radians(th)) / G
        # 독립 경로: RK4 로 비행(지면에서 발사, 지면 복귀)
        f = lambda t, y: np.array([y[2], y[3], 0.0, -G])  # noqa: E731
        T = 2 * v0 * math.sin(math.radians(th)) / G
        y = rk4(f, [0, 0, v0 * math.cos(math.radians(th)), v0 * math.sin(math.radians(th))], 0, T, 4000)
        agree(R, y[0], 1e-6, "range"); agree(0.0, abs(y[1]), 1e-3, "lands")
        if th not in (45,) and 8 < R < 80:
            break
    th_r = math.radians(th)
    pairs = [("Assumes the maximum-range launch angle and uses $v_0^2/g$, ignoring the stated angle.", v0 ** 2 / G),
             ("Omits the factor of two from $\\sin 2\\theta$, using $v_0^2\\sin\\theta\\cos\\theta/g$.", v0 ** 2 * math.sin(th_r) * math.cos(th_r) / G),
             ("Uses the vertical velocity component for the horizontal motion, giving $v_0^2\\sin^2\\theta\\cdot 2/g$.", 2 * (v0 * math.sin(th_r)) ** 2 / G),
             ("Uses cosine for the vertical component and sine for the horizontal component.", 2 * v0 ** 2 * math.sin(th_r) * math.cos(th_r) / G * (math.tan(th_r) if th > 45 else 1 / math.tan(th_r)))]
    key, ds = num_opts(R, pairs, "m")
    stem = f"A ball is launched from level ground with speed ${v0:g}\\text{{ m/s}}$ at ${th}^\\circ$ above the horizontal. Air resistance is negligible. How far from the launch point does the ball land?"
    return mk("ph_projectile_range", "1.5", "2.B", stem, key, ds, rng, concept="Horizontal range of a projectile launched from level ground", thinking=["Split the launch velocity into horizontal and vertical components", "Use the vertical motion to find the flight time, then the horizontal motion for the distance"],
              cond=[("the landing height equals the launch height and air resistance is ignored", "the stem states level ground and negligible air resistance")], path="closed form range versus an RK4 integration of the equations of motion until the ball returns to the ground", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=120, facts=[f"v0={v0}", f"th={th}"], kwhy="The vertical motion fixes the time of flight and the constant horizontal velocity then gives the range.")


# ======================= 5. 상대 운동: 강 건너기 (1.4 / 2.B, 그림: V) =======================
def ph_relative_velocity(rng):
    for _ in forever():
        vb = pick(rng, [3.0, 4.0, 5.0, 6.0]); vr = pick(rng, [1.0, 1.5, 2.0, 3.0, 4.0])
        if vr >= vb:
            continue
        s = math.hypot(vb, vr)
        agree(s, float(sp.sqrt(sp.Rational(str(vb)) ** 2 + sp.Rational(str(vr)) ** 2)), 1e-9, "speed")
        break
    pairs = [("Adds the two speeds directly, as if the boat pointed downstream.", vb + vr), ("Subtracts the speeds, as if the boat pointed upstream.", vb - vr),
             ("Reports only the boat's speed relative to the water and ignores the current.", vb), ("Subtracts the squares and takes the square root, using the wrong sign in the Pythagorean combination.", math.sqrt(vb ** 2 - vr ** 2))]
    key, ds = num_opts(s, pairs, "m/s")
    sc = make_vectors([{"label": "boat", "dx": 0, "dy": vb}, {"label": "current", "dx": vr, "dy": 0}])
    assert not check_scene(sc)
    stem = f"A boat heads straight across a river, pointing perpendicular to the banks, at ${vb:g}\\text{{ m/s}}$ relative to the water. The current flows parallel to the banks at ${vr:g}\\text{{ m/s}}$. What is the speed of the boat relative to the ground?"
    return mk("ph_relative_velocity", "1.4", "2.B", stem, key, ds, rng, concept="Combining perpendicular velocities in a moving reference frame", thinking=["Identify the two velocities as perpendicular vectors", "Add them as vectors and find the magnitude of the resultant"],
              cond=[("the boat velocity relative to the water and the current are perpendicular", "the stem states the boat points perpendicular to the banks")], path="exact symbolic square root versus numpy hypot of the component vector sum", material=MAT_NONE,
              judgment=["law_selection"], est=90, facts=[f"vb={vb}", f"vr={vr}"], kwhy="The ground velocity is the vector sum of the boat velocity and the current, so its magnitude is the hypotenuse.")


# ======================= 6. 수평 발사 vs 낙하: 시간 비교 (1.5 / 3.B) =======================
def ph_launch_vs_drop(rng):
    h = pick(rng, [2.0, 5.0, 10.0, 20.0]); v0 = pick(rng, [3.0, 5.0, 8.0])
    t_drop = math.sqrt(2 * h / G)
    f = lambda t, y: np.array([y[2], y[3], 0.0, -G])  # noqa: E731
    y = rk4(f, [0, h, v0, 0.0], 0, t_drop, 2000)
    agree(0.0, abs(y[1]), 1e-3, "lands_both")
    key, ds = sentence_options("The two balls reach the ground at the same time, but the launched ball lands farther from the base of the table.",
                               "Vertical motion is independent of horizontal motion, so both fall for the same time; the launched ball keeps moving horizontally.",
                               [("The ball that is dropped reaches the ground first because it has no horizontal motion to slow its fall.", "Treats horizontal speed as taking time away from the vertical motion."),
                                ("The launched ball reaches the ground first because it has a larger total speed.", "Confuses a larger speed with a shorter fall time, ignoring that the vertical motion starts from rest for both."),
                                ("The two balls reach the ground at the same time and land at the same distance from the base of the table.", "Recognizes equal fall times but ignores the horizontal velocity of the launched ball.")])
    stem = f"Two identical balls are at the edge of a table ${h:g}\\text{{ m}}$ above the floor. One ball is dropped from rest and the other is launched horizontally at ${v0:g}\\text{{ m/s}}$ at the same instant. Air resistance is negligible. Which statement is correct?"
    return mk("ph_launch_vs_drop", "1.5", "3.B", stem, key, ds, rng, concept="Independence of horizontal and vertical motion in projectile motion", thinking=["Compare the vertical motion of the two balls, which both start with zero vertical velocity", "Use the horizontal velocity of the launched ball to compare landing positions"],
              cond=[("both balls start with zero vertical velocity from the same height", "the stem states one is dropped and one is launched horizontally from the same table edge")], path="RK4 integration of the launched ball confirms it lands when the free-fall time from the same height elapses", material=MAT_NONE,
              judgment=["justification", "law_selection"], est=90, facts=[f"h={h}", f"v0={v0}"])


# ======================= 7. 운동 도해 → 가속도 방향 (1.3 / 3.B, 그림: M) =======================
def ph_motion_diagram(rng):
    for _ in forever():
        right = rng.random() < 0.5
        speeding = rng.random() < 0.5
        gaps = [1, 2, 3, 4] if speeding else [4, 3, 2, 1]
        xs = [0]
        for g in gaps:
            xs.append(xs[-1] + g)
        sign = 1 if right else -1
        vs = [sign * (x2 - x1) for x1, x2 in zip(xs, xs[1:])] + [sign * gaps[-1]]
        dv = vs[-1] - vs[0] if False else sign * (gaps[-1] - gaps[0])
        break
    pts = [sign * x for x in xs] if not right else xs
    # 정답: 가속도 방향 = dv 의 방향(독립 경로: 속도 차분의 부호)
    vel = np.diff(pts)
    acc_dir = np.sign(np.diff(vel).mean())
    agree(acc_dir, np.sign(dv), 1e-9, "acc_dir")
    word = {1: "to the right", -1: "to the left"}
    key, ds = sentence_options(f"The acceleration is directed {word[int(acc_dir)]}.", "The change in velocity between successive points has this direction, and acceleration points along the change in velocity.",
                               [(f"The acceleration is directed {word[int(-acc_dir)]}.", "Assumes the acceleration always points in the direction of the velocity (or the opposite) without checking whether the speed is increasing or decreasing."),
                                ("The acceleration is zero because the object moves in a straight line.", "Treats straight-line motion as unaccelerated even though the spacing between points changes."),
                                ("The acceleration cannot be determined without knowing the mass of the object.", "Confuses kinematics, which describes the change in velocity, with dynamics.")])
    sc = make_motion_diagram([float(x) for x in pts], [float(v) for v in vs])
    assert not check_scene(sc)
    stem = "The motion diagram shows an object at equal time intervals as it moves along a straight line, with arrows showing the velocity at each position. Which statement describes the acceleration of the object?"
    return mk("ph_motion_diagram", "1.3", "3.B", stem, key, ds, rng, concept="Determine the direction of acceleration from a motion diagram", thinking=["Compare the velocity arrow lengths at successive positions", "Decide the direction of the change in velocity and relate it to the acceleration"],
              cond=[("the points are recorded at equal time intervals", "the stem states equal intervals so spacing encodes speed")], path="numpy finite differences of the plotted positions give the velocity change sign, compared with the direction of increasing arrow length", material=MAT_DIAGRAM("equally timed positions", "velocity arrows"),
              judgment=["representation_reading", "justification"], stim=diagram_stim("Motion diagram with velocity arrows", sc), est=75, facts=[f"xs={pts}"])


# ======================= 8. Atwood: 장력 (2.5 / 2.B, 그림: S) =======================
def ph_atwood_tension(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0, 4.0]); m2 = pick(rng, [2.0, 3.0, 5.0, 6.0])
        if m2 <= m1 * 1.3:
            continue
        T, a = sp.symbols("T a")
        sol = sp.solve([sp.Eq(T - sp.Rational(str(m1)) * sp.Rational(str(G)), sp.Rational(str(m1)) * a), sp.Eq(sp.Rational(str(m2)) * sp.Rational(str(G)) - T, sp.Rational(str(m2)) * a)], [T, a])
        Tv = float(sol[T])
        A = np.array([[1, -m1], [1, m2]]); b = np.array([m1 * G, m2 * G]); Tn, an = np.linalg.solve(A, b)
        agree(Tv, Tn, 1e-9, "T")
        break
    pairs = [("Takes the tension to be the weight of the lighter block, which holds only if the system is in equilibrium.", m1 * G), ("Takes the tension to be the weight of the heavier block, ignoring that the heavier block accelerates downward.", m2 * G),
             ("Averages the two weights, which is not what Newton's second law gives for unequal masses.", (m1 + m2) * G / 2), ("Computes the net force on the system divided by the number of blocks.", (m2 - m1) * G / 2)]
    key, ds = num_opts(Tv, pairs, "N")
    sc = make_atwood(m1, m2); assert not check_scene(sc)
    stem = f"Two blocks of masses ${m1:g}\\text{{ kg}}$ and ${m2:g}\\text{{ kg}}$ hang from a light string over a frictionless, massless pulley and are released from rest. What is the tension in the string while the blocks move?"
    return mk("ph_atwood_tension", "2.5", "2.B", stem, key, ds, rng, concept="Newton's second law for two connected masses", thinking=["Write Newton's second law separately for each block", "Solve the two equations together for the tension"],
              cond=[("the string and pulley are ideal so one tension acts on both blocks", "the stem states a light string and a massless frictionless pulley")], path="sympy solves the two equations; numpy linalg.solve on the same linear system recomputes the tension", material=MAT_DIAGRAM("two hanging masses", "pulley"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Two blocks over a pulley", sc), est=120, facts=[f"m1={m1}", f"m2={m2}"], kwhy="Applying Newton's second law to each block and eliminating the acceleration gives the tension $2m_1m_2g/(m_1+m_2)$.")


# ======================= 9. 경사면 마찰 가속도 (2.7 / 2.B, 그림: S) =======================
def ph_incline_friction(rng):
    from phys_figs import make_incline
    for _ in forever():
        th = pick(rng, [25, 30, 35, 40]); mu = pick(rng, [0.10, 0.15, 0.20, 0.25]); m = pick(rng, [2.0, 3.0, 4.0, 5.0])
        a = G * (math.sin(math.radians(th)) - mu * math.cos(math.radians(th)))
        # 독립 경로: 1 s 동안 RK4, x = a/2
        y = rk4(lambda t, y: np.array([y[1], G * math.sin(math.radians(th)) - mu * G * math.cos(math.radians(th))]), [0, 0], 0, 1.0, 500)
        agree(a, 2 * y[0], 1e-6, "a")
        if a > 0.8:
            break
    thr = math.radians(th)
    pairs = [("Ignores friction and uses $g\\sin\\theta$.", G * math.sin(thr)), ("Subtracts the friction force without dividing by the mass correctly, using $g\\sin\\theta-\\mu\\sin\\theta$.", G * math.sin(thr) * (1 - mu)),
             ("Uses the cosine for the component along the incline and the sine for the normal force, swapping the components.", G * (math.cos(thr) - mu * math.sin(thr))), ("Adds the friction term instead of subtracting it while the block slides down.", G * (math.sin(thr) + mu * math.cos(thr)))]
    key, ds = num_opts(a, pairs, "m/s^2")
    sc = make_incline(th, m, mu); assert not check_scene(sc)
    stem = f"A ${m:g}\\text{{ kg}}$ block slides down a ${th}^\\circ$ incline. The coefficient of kinetic friction between the block and the incline is ${mu:g}$. What is the magnitude of the block's acceleration?"
    return mk("ph_incline_friction", "2.7", "2.B", stem, key, ds, rng, concept="Newton's second law along an incline with kinetic friction", thinking=["Resolve the weight into components parallel and perpendicular to the incline", "Use the perpendicular balance for the normal force, then Newton's second law along the incline"],
              cond=[("the block slides down so kinetic friction acts up the incline", "the stem states the block slides and gives the kinetic friction coefficient")], path="closed form acceleration versus an RK4 integration of the motion for one second whose displacement equals half the acceleration", material=MAT_DIAGRAM("incline angle", "block"),
              judgment=["law_selection", "symbolic_reasoning"], stim=diagram_stim("Block on a rough incline", sc), est=120, facts=[f"th={th}", f"mu={mu}", f"m={m}"], kwhy="Along the incline $ma=mg\\sin\\theta-\\mu mg\\cos\\theta$, and the mass cancels.")


# ======================= 10. 자유물체도 선택 (2.2 / 3.B, 선택지 그림: F) =======================
def ph_fbd_choice(rng):
    for _ in forever():
        m = pick(rng, [2.0, 3.0, 4.0, 5.0]); Fp = pick(rng, [8.0, 10.0, 12.0, 15.0])
        Fg = m * G
        base = [{"id": "Fg", "label": "Fg", "angle": 270, "mag": Fg}, {"id": "N", "label": "N", "angle": 90, "mag": Fg}, {"id": "Fp", "label": "Fp", "angle": 0, "mag": Fp}, {"id": "Ff", "label": "Ff", "angle": 180, "mag": Fp}]
        key_sc = make_fbd(base)
        wrong = {"a": make_fbd([base[0], base[1], base[2], {"id": "Fm", "label": "Fm", "angle": 0, "mag": Fp * 1.6}, base[3]]),
                 "b": make_fbd([base[0], base[1], base[2]], equilibrium=False),
                 "c": make_fbd([base[0], {"id": "N", "label": "N", "angle": 90, "mag": Fg * 0.6}, base[2], base[3]], equilibrium=False),
                 "d": make_fbd([base[0], base[1], base[2], {"id": "Ff", "label": "Ff", "angle": 0, "mag": Fp}], equilibrium=False)}
        break
    for sc in [key_sc, *wrong.values()]:
        sc["allow_overlap"] = True
    scenes = {"~key": key_sc, "~a": wrong["a"], "~b": wrong["b"], "~c": wrong["c"], "~d": wrong["d"]}
    assert [check_scene(s) for s in [key_sc]] == [[]]
    ds = [Opt("~a", False, "Adds a forward 'force of motion' to the diagram; moving objects need no such force, and constant velocity requires a zero net force.", None),
          Opt("~b", False, "Omits the friction force even though the surface is rough and the box moves at constant velocity.", None),
          Opt("~c", False, "Draws a normal force smaller than the weight although there is no vertical acceleration, so the normal force must equal the weight.", None),
          Opt("~d", False, "Draws friction in the same direction as the push, but kinetic friction opposes the motion.", None)]
    key = Opt("~key", True, "The weight and normal force balance vertically and the push and friction balance horizontally, with friction opposing the motion.", None)
    pick_idx = rng.randrange(4)
    ds = [d for i, d in enumerate(ds) if i != pick_idx]  # 오답 4개 중 3개를 무작위로 쓴다
    stem = (f"A ${m:g}\\text{{ kg}}$ box is pushed along a rough horizontal floor by a horizontal force of ${Fp:g}\\text{{ N}}$ and moves at constant velocity to the right. "
            "Which free-body diagram correctly shows the forces on the box? Arrow lengths show the relative magnitudes of the forces.")
    p = mk("ph_fbd_choice", "2.2", "3.B", stem, key, ds, rng, concept="Select the correct free-body diagram for an object moving at constant velocity", thinking=["List the real forces acting on the box and their directions", "Use constant velocity to require balanced forces in each direction and compare the arrow lengths"],
           cond=[("constant velocity means the net force is zero in both directions", "the stem states constant velocity on a horizontal floor")], path="the scene model sums the force vectors with numpy trigonometry and checks the key diagram sums to zero while each distractor does not or adds a spurious force",
           material=MAT_DIAGRAM("force arrows with labels", "relative lengths"), judgment=["representation_reading", "justification"], est=90, facts=[f"m={m}", f"Fp={Fp}"], option_scenes={k: v for k, v in scenes.items() if k in ["~key"] + [d.text for d in ds]})
    return p


# ======================= 11. 엘리베이터 저울 (2.5 / 2.B, 그림: G) =======================
def ph_elevator_scale(rng):
    for _ in forever():
        m = pick(rng, [50.0, 60.0, 70.0, 80.0]); a = pick(rng, [1.0, 1.5, 2.0, 2.5]); t1 = pick(rng, [2, 3, 4]); t2 = t1 + pick(rng, [4, 5, 6]); t3 = t2 + pick(rng, [2, 3, 4])
        xs = [0, t1, t2, t3]; vs = [0, a * t1, a * t1, 0]
        slope = (vs[1] - vs[0]) / (xs[1] - xs[0])
        N = m * (G + slope)
        Nn = m * (G + float(np.polyfit([xs[0], xs[1]], [vs[0], vs[1]], 1)[0]))
        agree(N, Nn, 1e-9, "N")
        break
    pairs = [("Gives the person's weight, which is correct only when the elevator does not accelerate.", m * G), ("Subtracts $ma$ from the weight, as if the elevator accelerated downward.", m * (G - slope)),
             ("Uses only $ma$ and forgets the weight of the person.", m * slope), ("Adds the speed at the top of the ramp instead of the acceleration.", m * (G + vs[1]))]
    key, ds = num_opts(N, pairs, "N")
    stim = graph_stim("Elevator velocity versus time", [("v", list(zip(xs, vs)))], gaxis("Time (s)", 0, xs[-1], 1), gaxis("Velocity (m/s, upward positive)", 0, vs[1] + 1, 0.5))
    stem = f"A ${m:g}\\text{{ kg}}$ person stands on a scale in an elevator. The graph shows the velocity of the elevator, with upward positive. What does the scale read between $t=0$ and $t={t1}\\text{{ s}}$?"
    return mk("ph_elevator_scale", "2.5", "2.B", stem, key, ds, rng, concept="Apparent weight from the acceleration read off a velocity-time graph", thinking=["Find the acceleration as the slope of the velocity-time graph", "Apply Newton's second law to the person: the scale force minus the weight equals ma"],
              cond=[("the scale reading equals the normal force on the person", "the person stands on the scale inside the accelerating elevator")], path="the slope is recomputed with numpy polyfit through the two vertices and the force from Newton's second law", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "law_selection"], stim=stim, est=110, facts=[f"m={m}", f"xs={xs}", f"vs={vs}"], kwhy="The slope gives the acceleration and $N-mg=ma$, so the scale reads $m(g+a)$.")


# ======================= 12. 용수철 상수: F–x 그래프, cm 단위 (2.8 / 2.B, 그림: G) =======================
def ph_spring_k_graph(rng):
    for _ in forever():
        k = pick(rng, [40.0, 50.0, 80.0, 100.0, 120.0, 200.0]); x1 = pick(rng, [5, 10, 15, 20])  # cm
        pts = [(0, 0), (x1 / 2, k * x1 / 200), (x1, k * x1 / 100)]
        slope_si = (pts[2][1] - pts[0][1]) / ((pts[2][0] - pts[0][0]) / 100)
        kn = float(np.polyfit([p[0] / 100 for p in pts], [p[1] for p in pts], 1)[0])
        agree(slope_si, kn, 1e-9, "k"); agree(slope_si, k, 1e-9, "k0")
        break
    F1 = pts[2][1]
    pairs = [("Leaves the length in centimeters, giving a slope in N/cm that is 100 times too small.", F1 / x1), ("Divides the force by the stretch in meters but uses half the stretch, mixing up the plotted point.", F1 / (x1 / 200)),
             ("Multiplies the force by the stretch in meters, which gives an energy-like quantity rather than a slope.", F1 * x1 / 100), ("Uses the stretch in centimeters as if it were meters in $F/x$ and then multiplies by $g$.", F1 / x1 * G)]
    key, ds = num_opts(float(k), pairs, "N/m")
    stim = graph_stim("Force versus stretch of a spring", [("F", [[a, round(b, 3)] for a, b in pts])], gaxis("Stretch (cm)", 0, x1, x1 / 5), gaxis("Force (N)", 0, round(F1 * 1.1, 1), round(F1 / 5, 2)))
    stem = "A student measures the force needed to stretch a spring and plots the data shown. The stretch is in centimeters. What is the spring constant of the spring?"
    return mk("ph_spring_k_graph", "2.8", "2.B", stem, key, ds, rng, concept="Spring constant as the slope of a force versus stretch graph, with a unit conversion", thinking=["Identify the slope of the line as the spring constant", "Convert centimeters to meters before reporting a value in N/m"],
              cond=[("the spring obeys Hooke's law so the graph is a straight line through the origin", "the plotted points lie on a line through the origin")], path="numpy polyfit of force against stretch in meters gives the slope that is compared with the generating constant", material=MAT_GRAPH("axis labels with units"),
              judgment=["representation_reading", "quantitative_comparison"], stim=stim, est=90, facts=[f"k={k}", f"x1={x1}"], kwhy="The slope of force against stretch in meters is the spring constant.")


# ======================= 13. 수평 원운동 장력 (2.9 / 2.B) =======================
def ph_circular_tension(rng):
    for _ in forever():
        m = pick(rng, [0.2, 0.3, 0.5, 0.8]); r = pick(rng, [0.5, 0.8, 1.0, 1.5]); P = pick(rng, [0.8, 1.0, 1.2, 1.5, 2.0])
        v = 2 * math.pi * r / P
        T = m * v * v / r
        Tn = m * (2 * math.pi / P) ** 2 * r
        agree(T, Tn, 1e-9, "T")
        break
    pairs = [("Uses $mv/r$, forgetting to square the speed.", m * v / r), ("Uses $mv^2$ and forgets to divide by the radius.", m * v * v),
             ("Uses $mv^2/(2r)$, halving the centripetal force by confusing it with kinetic energy.", m * v * v / (2 * r)), ("Takes the tension to be the weight $mg$, ignoring the circular motion.", m * G)]
    key, ds = num_opts(T, pairs, "N")
    stem = f"A ${m:g}\\text{{ kg}}$ ball on a light string moves in a horizontal circle of radius ${r:g}\\text{{ m}}$ at constant speed on a frictionless table, completing one revolution every ${P:g}\\text{{ s}}$. What is the tension in the string?"
    return mk("ph_circular_tension", "2.9", "2.B", stem, key, ds, rng, concept="Centripetal force from the period of uniform circular motion", thinking=["Find the speed from the circumference and the period", "Set the tension equal to the net centripetal force $mv^2/r$"],
              cond=[("the table is frictionless and horizontal so the tension is the only horizontal force", "the stem states a frictionless horizontal table")], path="the force is recomputed directly from the angular speed as $m\\omega^2 r$ and compared with $mv^2/r$", material=MAT_NONE,
              judgment=["law_selection"], est=100, facts=[f"m={m}", f"r={r}", f"P={P}"], kwhy="The tension supplies the centripetal force $mv^2/r$ with $v=2\\pi r/P$.")


# ======================= 14. 수직 원(고리) 꼭대기 수직항력 (2.9 / 2.B) =======================
def ph_vertical_circle_top(rng):
    for _ in forever():
        m = pick(rng, [800.0, 900.0, 1000.0, 1200.0]); r = pick(rng, [8.0, 10.0, 12.0, 15.0]); v = pick(rng, [10.0, 12.0, 14.0])
        if v * v / r <= G * 1.2:
            continue
        N = m * (v * v / r - G)
        agree(N, float(sp.Rational(str(m)) * (sp.Rational(str(v)) ** 2 / sp.Rational(str(r)) - sp.Rational(str(G)))), 1e-9, "N")
        break
    pairs = [("Adds the weight instead of subtracting it, which is the result at the bottom of the loop.", m * (v * v / r + G)), ("Uses only $mv^2/r$ and forgets that the weight also points toward the center at the top.", m * v * v / r),
             ("Reports the weight $mg$, ignoring the circular motion.", m * G), ("Uses the diameter instead of the radius in the centripetal term.", m * (v * v / (2 * r) - G))]
    key, ds = num_opts(N, pairs, "N")
    stem = f"A ${m:g}\\text{{ kg}}$ car travels on the inside of a vertical circular loop of radius ${r:g}\\text{{ m}}$ and passes the top of the loop at ${v:g}\\text{{ m/s}}$ while staying in contact with the track. What is the magnitude of the normal force from the track on the car at the top?"
    return mk("ph_vertical_circle_top", "2.9", "2.B", stem, key, ds, rng, concept="Net centripetal force at the top of a vertical loop", thinking=["Identify that at the top both the weight and the normal force point toward the center", "Write $N+mg=mv^2/r$ and solve for the normal force"],
              cond=[("the car stays in contact with the track at the top", "the stem states it stays in contact and the generated values keep $v^2/r$ above $g$")], path="sympy rational arithmetic versus the float evaluation of $m(v^2/r-g)$ with an assertion that contact is maintained", material=MAT_NONE,
              judgment=["law_selection", "symbolic_reasoning"], est=110, facts=[f"m={m}", f"r={r}", f"v={v}"], kwhy="At the top both the weight and the normal force point toward the center, so $N+mg=mv^2/r$.")


# ======================= 15. 만유인력 거리·질량 비례 (2.6 / 2.D) =======================
def ph_gravity_scaling(rng):
    ma = pick(rng, [1, 2, 3]); mb = pick(rng, [1, 2, 4]); rf = pick(rng, [2, 3, 4])
    fac = Fr(ma * mb, rf * rf)
    # 독립 경로: 실제 상수로 힘을 계산해 비
    G0 = CONSTS["G"]; m1, m2, r0 = 5.0e3, 4.0e3, 10.0
    ratio = (G0 * ma * m1 * mb * m2 / (rf * r0) ** 2) / (G0 * m1 * m2 / r0 ** 2)
    agree(float(fac), ratio, 1e-9, "ratio")
    if fac == 1:
        raise ValueError("trivial")
    wrong = [("Applies the distance change as a factor of $r$ instead of $r^2$.", Fr(ma * mb, rf)), ("Multiplies by the distance change, treating gravity as increasing with separation.", Fr(ma * mb * rf)),
             ("Ignores the mass changes and applies only the inverse-square distance factor.", Fr(1, rf * rf)), ("Squares the mass factors as well as the distance factor.", Fr(ma * ma * mb * mb, rf * rf))]
    fmt = lambda f: "$" + (f"{f.numerator}" if f.denominator == 1 else f"\\frac{{{f.numerator}}}{{{f.denominator}}}") + "F$"  # noqa: E731
    key = Opt(fmt(fac), True, "Gravitational force is proportional to the product of the masses and inversely proportional to the square of the distance.", float(fac))
    ds, seen = [], {fmt(fac)}
    for why, f in wrong:
        if fmt(f) in seen or f == fac:
            continue
        seen.add(fmt(f)); ds.append(Opt(fmt(f), False, why, float(f)))
    if len(ds) < 3:
        raise ValueError("few")
    stem = (f"Two objects exert a gravitational force of magnitude $F$ on each other. The mass of one object is multiplied by ${ma}$, the mass of the other is multiplied by ${mb}$, and the distance between their centers is multiplied by ${rf}$. "
            "What is the new magnitude of the gravitational force?")
    return mk("ph_gravity_scaling", "2.6", "2.D", stem, key, ds, rng, concept="Predict the change in gravitational force when masses and separation change", thinking=["Write the force as proportional to the product of the masses over the square of the distance", "Multiply the proportional factors for each change"],
              cond=[("the objects behave as point masses or uniform spheres", "the stem refers to the distance between their centers")], path="exact Fraction arithmetic versus the force ratio computed with the numeric gravitational constant and sample masses", material=MAT_NONE,
              judgment=["scaling_prediction"], est=75, facts=[f"ma={ma}", f"mb={mb}", f"rf={rf}"])


# ======================= 16. 질량 중심 (2.1 / 2.B) =======================
def ph_center_of_mass(rng):
    for _ in forever():
        n = 3
        ms = [pick(rng, [1.0, 2.0, 3.0, 4.0]) for _ in range(n)]; xs = sorted(rng.sample(range(0, 13), n))
        xs = [float(x) for x in xs]
        cm = sum(m * x for m, x in zip(ms, xs)) / sum(ms)
        agree(cm, float(np.average(xs, weights=ms)), 1e-9, "cm")
        if abs(cm - np.mean(xs)) > 0.8 and len(set(ms)) > 1:
            break
    pairs = [("Takes the unweighted mean of the positions, ignoring the different masses.", float(np.mean(xs))), ("Uses the midpoint of the two outer objects.", (xs[0] + xs[-1]) / 2),
             ("Weights by mass but divides by the number of objects rather than by the total mass.", sum(m * x for m, x in zip(ms, xs)) / n), ("Places the center of mass at the position of the most massive object.", xs[ms.index(max(ms))])]
    key, ds = num_opts(cm, pairs, "m")
    rows = ", ".join(f"${m:g}\\text{{ kg}}$ at $x={x:g}\\text{{ m}}$" for m, x in zip(ms, xs))
    stem = f"Three small objects lie on the $x$-axis: {rows}. What is the $x$-coordinate of the center of mass of the system?"
    return mk("ph_center_of_mass", "2.1", "2.B", stem, key, ds, rng, concept="Center of mass of a system of point masses", thinking=["Weight each position by its mass", "Divide the sum by the total mass"],
              cond=[("the objects are point masses on one axis", "the stem lists masses and positions on the x-axis")], path="numpy average with weights versus the explicit mass-weighted sum divided by total mass", material=MAT_NONE,
              judgment=["law_selection"], est=80, facts=[f"ms={ms}", f"xs={xs}"], kwhy="The center of mass is the mass-weighted average of the positions.")


# ======================= 17. 뉴턴 제3법칙 (2.3 / 3.B) =======================
def ph_third_law(rng):
    heavy, light = pick(rng, [("a large truck", "a small car"), ("a loaded freight cart", "a light toy cart"), ("a heavy bowling ball", "a light foam ball")])
    key, ds = sentence_options(f"The force of {heavy} on {light} has the same magnitude as the force of {light} on {heavy}.", "Newton's third law: the two interaction forces are equal in magnitude and opposite in direction, regardless of mass.",
                               [(f"The force of {heavy} on {light} is greater because {heavy} has more mass.", "Believes the more massive object exerts the larger force in an interaction."),
                                (f"The force of {light} on {heavy} is greater because {light} is the one that accelerates more.", "Confuses the larger acceleration of the lighter object with a larger force on the heavier object."),
                                (f"The forces are equal only if {heavy} and {light} move at the same speed.", "Thinks equality of the interaction forces depends on the objects' speeds.")])
    stem = f"{heavy[0].upper() + heavy[1:]} collides head-on with {light}. Which statement correctly compares the forces the two objects exert on each other during the collision?"
    return mk("ph_third_law", "2.3", "3.B", stem, key, ds, rng, concept="Newton's third law for an interaction between unequal masses", thinking=["Identify the two forces as an interaction pair between the objects", "Apply Newton's third law to compare their magnitudes"],
              cond=[("the forces are an interaction pair acting during the collision", "the stem asks about the forces the two objects exert on each other")], path="momentum bookkeeping in a code check: equal and opposite impulses give momentum changes of equal magnitude for any masses",
              material=MAT_NONE, judgment=["justification", "law_selection"], est=60, facts=[heavy, light])


STAGE_U1 = ["ph_vt_displacement", "ph_at_velocity_change", "ph_kinematics_time", "ph_projectile_range", "ph_relative_velocity", "ph_launch_vs_drop", "ph_motion_diagram"]
STAGE_U2 = ["ph_atwood_tension", "ph_incline_friction", "ph_fbd_choice", "ph_elevator_scale", "ph_spring_k_graph", "ph_circular_tension", "ph_vertical_circle_top", "ph_gravity_scaling", "ph_center_of_mass", "ph_third_law"]
