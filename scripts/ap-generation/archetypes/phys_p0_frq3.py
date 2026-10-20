"""AP Physics 1 — FRQ 세 번째 시나리오 4종(2026-10-19, 브랜치 ap-bi-ph-ch): PH6 이 PH3·PH4·PH5 와 FRQ 원형(풀이 틀)을 겹치지 않으려면 유형마다 새 시나리오가 필요하다.
유형·배점·행 구조는 phys_p0_frq.py 와 같다(MR 10 / TBR 12 / LAB 10 / QQT 8, 모든 행 1점). 모든 정답·표·기대값은 코드가 두 경로로 계산한다.
새 시나리오: MR 아트우드 기계 / TBR 엘리베이터 v–t 와 저울 읽음 / LAB 마찰 없는 경사면 a–sinθ / QQT 원 궤도 위성."""
from phys_common import *
from phys_p0_frq import R, _pack, _ev, part


# ======================= MR (10): 아트우드 기계 =======================
def phf_mr_atwood_machine(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 1.5, 2.0, 2.5]); m2 = m1 + pick(rng, [0.5, 1.0, 1.5]); h = pick(rng, [1.0, 1.5, 2.0])
        a_, T_ = sp.symbols("a T", positive=True)
        M1, M2, GG = [sp.Rational(str(v)) for v in (m1, m2, G)]
        sol = sp.solve([sp.Eq(T_ - M1 * GG, M1 * a_), sp.Eq(M2 * GG - T_, M2 * a_)], [T_, a_])
        a = float(sol[a_]); T = float(sol[T_])
        A = np.array([[1.0, -m1], [1.0, m2]]); Bv = np.array([m1 * G, m2 * G]); Tn, an = np.linalg.solve(A, Bv)
        agree(a, an, 1e-9, "a"); agree(T, Tn, 1e-9, "T")
        # 독립: 가속도 a 로 높이 h 만큼 내려오는 시간·속력을 RK4 로 적분해 v 를 구한다
        v = math.sqrt(2 * a * h); y = np.array([0.0, 0.0]); t = 0.0; dt = 1e-3
        while y[0] < h:
            y = rk4(lambda tt, s: np.array([s[1], a]), y, t, t + dt, 1); t += dt
        agree(v, y[1], 5e-3, "v")
        if a > 0.5:
            break
    mus = sp.symbols("k", positive=True)
    # 두 질량을 모두 k 배 하면 가속도는 그대로, 장력은 k 배
    a_scaled = sp.simplify((mus * M2 - mus * M1) * GG / (mus * M1 + mus * M2)); agree(float(a_scaled.subs(mus, 2)), a, 1e-9, "scale_a")
    stim = {"kind": "text", "description": f"Two blocks of masses $m_1={m1:g}\\text{{ kg}}$ and $m_2={m2:g}\\text{{ kg}}$ hang from the two ends of a light string that passes over a light, frictionless pulley (an Atwood machine). The blocks are released from rest with block 2 at a height $h={h:g}\\text{{ m}}$ above the floor.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents block 2 (the heavier block), draw and label the forces (not components) that act on it while the blocks move. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A", "1.C"],
             "Two arrows from the dot: weight straight down and tension straight up. The weight arrow is longer than the tension arrow because block 2 accelerates downward.",
             [R("A1", "diagram", "Draws and labels the two forces: weight (down) and tension (up), with no extra force such as a force of motion", ["weight", "tension"], err=["adds a force of motion downward"]),
              R("A2", "diagram", "Arrow directions are correct: weight straight down and tension straight up", ["directions"], err=["draws tension down"]),
              R("A3", "diagram", "The weight arrow is longer than the tension arrow, consistent with a downward acceleration", ["weight longer than tension"], err=["draws the two arrows with equal length"])]),
        part("B", "Derive an expression for the magnitude of the acceleration of the blocks in terms of $m_1$, $m_2$, and fundamental constants.", 3, "derive", ["2.A"],
             "$m_2g-T=m_2a$ and $T-m_1g=m_1a$, so $a=\\dfrac{(m_2-m_1)g}{m_1+m_2}$.",
             [R("B1", "expression", "Applies Newton's second law to block 2: $m_2g-T=m_2a$", ["m2 g - T = m2 a"], err=["uses T = m2 g"]),
              R("B2", "expression", "Applies Newton's second law to block 1: $T-m_1g=m_1a$", ["T - m1 g = m1 a"], err=["uses a different tension for the second block", "gets the sign of the acceleration wrong"]),
              R("B3", "expression", "Combines the equations to the correct expression $a=(m_2-m_1)g/(m_1+m_2)$", ["(m2 - m1) g/(m1+m2)"], requires="B2", err=["adds the masses in the numerator"])]),
        part("C", f"Calculate the speed of block 2 just before it reaches the floor for $m_1={m1:g}\\text{{ kg}}$, $m_2={m2:g}\\text{{ kg}}$ and $h={h:g}\\text{{ m}}$.", 2, "calculate", ["2.B"],
             f"$a={a:.2f}\\text{{ m/s}}^2$ and $v=\\sqrt{{2ah}}=\\sqrt{{2({a:.2f})({h:g})}}\\approx {v:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", f"Calculates the acceleration (about {a:.2f}) from the expression in part B", [f"{a:.2f}"], requires="B3", nums=True, err=["uses the sum of the masses in the numerator"]),
              R("C2", "numeric", f"Uses $v^2=2ah$ to find a speed of about {v:.2f} with units of meters per second", [f"{v:.2f}", "m/s"], requires="C1", nums=True, units=True, err=["forgets the square root"])]),
        part("D", "The masses of both blocks are doubled, so that they are $2m_1$ and $2m_2$. Does the magnitude of the acceleration of the blocks increase, decrease, or stay the same? Justify your answer.", 2, "explain", ["3.B", "3.C"],
             "The acceleration stays the same. In $a=(m_2-m_1)g/(m_1+m_2)$ the factor of 2 appears in the numerator and in the denominator and cancels.",
             [R("D1", "claim", "States that the acceleration stays the same", ["stays the same"], err=["states that the acceleration doubles"]),
              R("D2", "justification", "Justifies that doubling both masses doubles the net force and doubles the total mass, so the acceleration does not change", ["factor of 2 cancels"], requires="D1", err=["argues only that heavier objects fall at the same rate"])]),
    ]
    return _pack("phf_mr_atwood_machine", "mr", "2.5", ["2.2", "2.4", "1.2"], "2.B", "Atwood machine", stim, parts, 10, 22, [f"m1={m1}", f"m2={m2}", f"h={h}", f"a={a:.4f}", f"v={v:.3f}", f"T={T:.3f}"],
                 [_ev("C", "acceleration", a, max(0.06, 0.012 * a), "m/s^2"), _ev("C", "speed", v, max(0.06, 0.012 * v), "m/s")],
                 ("Newton's second law for two hanging blocks connected by a string and a justified prediction about the effect of doubling both masses", ["Draw the free-body diagram of the heavier block", "Write Newton's second law for each block and eliminate the tension", "Predict whether doubling both masses changes the acceleration using the derived expression"],
                  [("the string and the pulley are ideal so the tension is the same on both sides", "the stimulus states a light string over a light frictionless pulley")], {"type": "text", "must_include": ["the two masses", "the height h"]},
                  "sympy solves the two Newton equations; an RK4 integration of the motion over the height h recomputes the final speed"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= TBR (12): 엘리베이터 v–t 와 저울 읽음 =======================
def phf_tbr_elevator_forces(rng):
    for _ in forever():
        a1 = pick(rng, [1.0, 1.5, 2.0]); t1 = pick(rng, [2.0, 3.0, 4.0]); t2 = pick(rng, [4.0, 5.0, 6.0]); t3 = pick(rng, [2.0, 3.0, 4.0]); m = pick(rng, [50.0, 60.0, 70.0]); dT = pick(rng, [2.0, 3.0, 4.0])
        vm = a1 * t1; a3 = vm / t3; T = t1 + t2 + t3
        x_exact = float(Fr(str(vm)) * (Fr(str(t1)) / 2 + Fr(str(t2)) + Fr(str(t3)) / 2))
        ts = np.linspace(0, T, 12001); vs = np.interp(ts, [0, t1, t1 + t2, T], [0, vm, vm, 0]); x_num = float(np.sum((vs[1:] + vs[:-1]) / 2 * np.diff(ts))); agree(x_exact, x_num, 1e-5, "x")
        N1 = m * (G + a1); N2 = m * G; N3 = m * (G - a3)
        # 독립: 세 구간의 운동 방정식 N - m g = m a 를 선형계로 풀어 저울 읽음을 구한다
        for N_val, acc in ((N1, a1), (N2, 0.0), (N3, -a3)):
            Nn = float(np.linalg.solve(np.array([[1.0]]), np.array([m * (G + acc)]))[0]); agree(Nn, N_val, 1e-9, "N")
        if N3 > 0:
            break
    inc = vm * dT
    stim = {"kind": "text", "description": f"A person of mass $m={m:g}\\text{{ kg}}$ stands on a scale in an elevator that moves upward along a vertical shaft. Starting from rest, the elevator speeds up uniformly with acceleration $a_1={a1:g}\\text{{ m/s}}^2$ for $t_1={t1:g}\\text{{ s}}$, then moves at constant velocity for $t_2={t2:g}\\text{{ s}}$, and then slows down uniformly to a stop in $t_3={t3:g}\\text{{ s}}$. The scale reads the magnitude of the normal force on the person. Blank axes for the graphs are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the velocity $v$ of the elevator as a function of time $t$ for the whole trip. Label the axes with quantities and units and label the key values of velocity and time.", 4, "graph", ["1.A", "1.C"],
             f"A straight line from the origin up to $v={vm:.2f}\\text{{ m/s}}$ at $t={t1:g}\\text{{ s}}$, a horizontal line at that velocity until $t={t1 + t2:g}\\text{{ s}}$, and a straight line down to zero at $t={T:g}\\text{{ s}}$.",
             [R("A1", "graph", "Both axes are labeled with quantities and units and a scale is shown", ["axis labels", "units"], err=["omits units"]),
              R("A2", "graph", f"Draws a straight line from the origin rising to about ${vm:.2f}\\text{{ m/s}}$ at $t={t1:g}\\text{{ s}}$", [f"{vm:.2f}", f"{t1:g}"], nums=True, err=["draws a curve instead of a straight line for uniform acceleration"]),
              R("A3", "graph", f"Draws a horizontal segment at the same velocity from $t={t1:g}\\text{{ s}}$ to $t={t1 + t2:g}\\text{{ s}}$", [f"{t1 + t2:g}"], nums=True, err=["draws the constant-velocity segment with a slope"]),
              R("A4", "graph", f"Draws a straight line down to zero velocity at $t={T:g}\\text{{ s}}$", [f"{T:g}"], nums=True, err=["ends the graph below zero velocity"])]),
        part("B", "Determine the total distance that the elevator rises during the whole trip. Show how you use your graph from part A.", 3, "calculate", ["2.A", "2.B"],
             f"The displacement is the area under the $v$–$t$ graph: $y=\\tfrac12({vm:.2f})({t1:g})+({vm:.2f})({t2:g})+\\tfrac12({vm:.2f})({t3:g})\\approx {x_exact:.1f}\\text{{ m}}$.",
             [R("B1", "expression", "Identifies the displacement as the area under the velocity-time graph", ["displacement is the area under the v-t graph"], err=["uses the slope of the graph"]),
              R("B2", "expression", "Adds the areas of the triangle, the rectangle, and the second triangle: $\\tfrac12vt_1+vt_2+\\tfrac12vt_3$", ["1/2 v t1 + v t2 + 1/2 v t3"], requires="B1", err=["omits one of the three areas"]),
              R("B3", "numeric", f"Calculates a total distance of about {x_exact:.1f} with units of meters", [f"{x_exact:.1f}", "m"], requires="B2", nums=True, units=True, err=["uses the average velocity of only the first segment"])]),
        part("C", "Calculate the reading of the scale (the magnitude of the normal force on the person) during the first stage, when the elevator is speeding up. Show your work.", 3, "calculate", ["2.B", "2.A"],
             f"Newton's second law gives $N-mg=ma_1$, so $N=m(g+a_1)=({m:g})({G:g}+{a1:g})\\approx {N1:.0f}\\text{{ N}}$.",
             [R("C1", "expression", "Applies Newton's second law to the person with the normal force up and the weight down: $N-mg=ma_1$", ["N - m g = m a"], err=["uses N = m g", "subtracts the acceleration term"]),
              R("C2", "expression", "Solves for the normal force: $N=m(g+a_1)$", ["m (g + a)"], requires="C1", err=["gets $N=m(g-a_1)$"]),
              R("C3", "numeric", f"Calculates a reading of about {N1:.0f} with units of newtons", [f"{N1:.0f}", "N"], requires="C2", nums=True, units=True, err=["uses a mass in the units of newtons"])]),
        part("D", f"In a second trip the constant-velocity stage is made ${dT:g}\\text{{ s}}$ longer while everything else about the trip is unchanged. By how much does the total distance that the elevator rises change? Justify your answer using your velocity-time graph from part A.", 2, "explain", ["2.D", "3.B"],
             f"The distance increases by $v\\Delta t={vm:.2f}\\times{dT:g}={inc:.1f}\\text{{ m}}$, because the added area under the graph is a rectangle of height $v={vm:.2f}\\text{{ m/s}}$ and width ${dT:g}\\text{{ s}}$ and the other two areas do not change.",
             [R("D1", "numeric", f"States that the distance increases by about {inc:.1f} with units of meters", [f"{inc:.1f}", "increases"], nums=True, err=["states the distance does not change because the velocity is constant"]),
              R("D2", "justification", "Justifies that the extra area under the graph is a rectangle of height equal to the constant velocity, with the other areas unchanged", ["added rectangle of height v and width delta t"], requires="D1", err=["argues only that the elevator travels longer"])]),
    ]
    return _pack("phf_tbr_elevator_forces", "tbr", "1.3", ["1.2", "2.5"], "1.A", "Elevator motion in three stages: v-t graph and scale reading", stim, parts, 12, 27, [f"a1={a1}", f"t1={t1}", f"t2={t2}", f"t3={t3}", f"m={m}", f"dT={dT}", f"vm={vm:.4f}", f"y={x_exact:.4f}", f"N1={N1:.3f}"],
                 [_ev("B", "total distance", x_exact, max(0.1, 0.01 * x_exact), "m"), _ev("C", "scale reading", N1, max(2.0, 0.01 * N1), "N"), _ev("D", "added distance", inc, max(0.05, 0.01 * inc), "m")],
                 ("Translating a verbal description of an elevator's motion into a velocity-time graph, using the area for the distance, and using Newton's second law for the scale reading", ["Represent the motion as a velocity-time graph", "Use the area under the graph to find the distance", "Apply Newton's second law to the person in the accelerating elevator"],
                  [("the acceleration is constant in each stage and the elevator moves upward the whole time", "the stimulus states uniform speeding up and slowing down and upward motion")], {"type": "text", "must_include": ["acceleration", "durations of the three stages", "mass of the person"]},
                  "the distance is computed from exact fractions of the three areas and recomputed by trapezoid integration; the scale reading from a linear solve of Newton's second law"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 마찰 없는 경사면에서 a – sinθ 로 g =======================
def phf_lab_incline_g(rng):
    ths = [10, 15, 20, 25, 30]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); gtrue = pick(rng, [9.7, 9.8, 9.9])
        sins = [math.sin(math.radians(t)) for t in ths]
        accs = [round(gtrue * s * (1 + r2.uniform(-0.015, 0.015)), 3) for s in sins]
        slope, icpt = np.polyfit(sins, accs, 1); g_est = slope
        X = np.array([[x, 1.0] for x in sins]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(accs)); agree(slope, beta[0], 1e-9, "slope")
        if abs(g_est - 9.8) / 9.8 < 0.04:
            break
    rows = [[th, a] for th, a in zip(ths, accs)]
    stim = {"kind": "table", "description": "A student releases a low-friction cart from rest on a track that is tilted at an angle θ to the horizontal, and measures the acceleration of the cart down the track with a motion sensor. The student repeats the experiment for several angles and wants to determine the gravitational field strength $g$.", "data": {"x_label": "Angle of the track θ (degrees)", "y_label": "Acceleration of the cart a (m/s^2)", "rows": rows}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the acceleration as a function of the angle. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured angle.", 3, "design", ["3.A", "2.B"],
             "Use a protractor (or measure the height of the raised end and the length of the track and find the angle from a trigonometric ratio) to set each angle of the track and a motion sensor to measure the acceleration; change only the angle with the same cart and track; reduce the uncertainty in the angle by measuring the height and the length with a meterstick and calculating the angle.",
             [R("A1", "design", "Identifies a way to set and measure the angle and a way to measure the acceleration (motion sensor or a time and distance measurement)", ["a way to measure the angle and a way to measure the acceleration"], err=["omits how the acceleration is measured"]),
              R("A2", "design", "Changes only the angle while using the same cart and the same track (both conditions are needed)", ["change only the angle with the same cart and track"]),
              R("A3", "design", "Reduces the uncertainty in the angle by calculating it from the height and the length measured with a meterstick, or by repeating the measurement and averaging (either earns the point)", ["calculate the angle from the height and the length or repeat and average (either earns the point)"])]),
        part("B", "Using the relationship between the acceleration of the cart, the angle of the track, and $g$ when friction is negligible, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $g$.", 1, "explain", ["2.B", "3.A"],
             "For a frictionless incline $a=g\\sin\\theta$: plot $a$ on the vertical axis against $\\sin\\theta$ on the horizontal axis; the slope is $g$.",
             [R("B1", "expression", "Identifies $a$ (vertical) versus $\\sin\\theta$ (horizontal)", ["a versus sin theta"], err=["plots a versus theta"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(\\sin\\theta,a)$: {', '.join(f'({s:.3f}, {a:.3f})' for s, a in zip(sins, accs))} with a best-fit line of slope about ${slope:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "graph", "Axes are labeled with quantities and units (sin theta has no units) and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(\\sin\\theta, a)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the gravitational field strength $g$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope of the best-fit line is $g\\approx {g_est:.1f}\\text{{ m/s}}^2$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} m/s^2; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the gravitational field strength: slope $=g$", ["slope = g"], err=["uses slope = 1/g"]),
              R("D3", "numeric", f"States $g$ (about {g_est:.1f}; accept any value within 8 percent) with units of meters per second squared or newtons per kilogram", [f"{g_est:.1f}", "m/s^2 or N/kg"], alt=["a value of g consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("phf_lab_incline_g", "lab", "2.5", ["1.2", "2.7"], "3.A", "Experiment: gravitational field strength from a cart on a tilted track", stim, parts, 10, 27, [f"gtrue={gtrue}", f"slope={slope:.5f}", f"g_est={g_est:.3f}", f"accs={accs}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "m/s^2"), _ev("D", "gravitational field strength", g_est, 0.08 * g_est, "m/s^2")],
                 ("Designing an experiment and analyzing linearized data to extract the gravitational field strength from a low-friction incline", ["Describe the measurements and how uncertainty in the angle is reduced", "Linearize the incline relationship and plot the data", "Use the slope to determine g"],
                  [("the generated accelerations follow $a=g\\sin\\theta$ with a small random error so the best-fit slope is within a few percent of g", "the code rejects a seed whose fitted g differs from 9.8 by more than four percent")], {"type": "table", "must_include": ["angle", "acceleration"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted g is compared with the reference value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 원 궤도 위성 =======================
def phf_qqt_orbit_speed(rng):
    for _ in forever():
        R1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); f = pick(rng, [2.0, 4.0, 9.0]); R2 = f * R1; GM = 3.986e14
        v1 = math.sqrt(GM / R1); v2 = math.sqrt(GM / R2)
        # 독립: 원 궤도 조건을 RK4 로 적분해 1/4 바퀴 뒤 반지름과 속력이 그대로임을 확인
        s0 = np.array([R2, 0.0, 0.0, v2]); fg = lambda t, s: np.array([s[2], s[3], -GM * s[0] / (s[0] ** 2 + s[1] ** 2) ** 1.5, -GM * s[1] / (s[0] ** 2 + s[1] ** 2) ** 1.5])  # noqa: E731
        Tq = 2 * math.pi * math.sqrt(R2 ** 3 / GM) / 4; s1 = rk4(fg, s0, 0.0, Tq, 4000); agree(math.hypot(s1[0], s1[1]), R2, 1e-5, "r"); agree(math.hypot(s1[2], s1[3]), v2, 1e-5, "v")
        T2 = 2 * math.pi * R2 / v2; T1 = 2 * math.pi * R1 / v1; ratio_T = T2 / T1; agree(ratio_T, f ** 1.5, 1e-9, "Tratio")
        break
    stim = {"kind": "text", "description": f"Two satellites orbit Earth in circular orbits. Satellite 1 has an orbital radius of $r_1={R1:.2g}\\text{{ m}}$ (measured from the center of Earth) and satellite 2 has an orbital radius of $r_2={R2:.2g}\\text{{ m}}$, which is ${f:g}$ times as great. The mass of Earth is $M$. Treat Earth as a uniform sphere.", "data": {}}
    parts = [
        part("A", f"A student claims that satellite 2 has a smaller orbital speed than satellite 1. Do you agree or disagree with the student's claim? Justify your answer using Newton's law of gravitation and the condition for circular motion.", 3, "explain", ["3.B", "3.C"],
             "Agree. The gravitational force provides the centripetal force: $GMm/r^2=mv^2/r$, so $v=\\sqrt{GM/r}$ and the speed decreases as the radius increases.",
             [R("A1", "claim", "Agrees that the speed of satellite 2 is smaller", ["agree", "smaller speed"], err=["disagrees because a farther satellite must move faster"]),
              R("A2", "justification", "Justifies by setting the gravitational force equal to the centripetal force: $GMm/r^2=mv^2/r$", ["G M m / r^2 = m v^2 / r"], err=["uses the weight mg at the surface of Earth for every orbit"]),
              R("A3", "justification", "Justifies with the reason that $v=\\sqrt{GM/r}$, so the speed decreases as the radius increases", ["v proportional to 1/sqrt(r)"], requires="A2", err=["concludes that the speed is independent of the radius"])]),
        part("B", f"Derive an expression for the orbital speed $v$ of a satellite in a circular orbit of radius $r$ in terms of $M$, $r$, and fundamental constants, and then determine the numerical ratio $v_2/v_1$.", 3, "derive", ["2.A", "2.B"],
             f"$v=\\sqrt{{GM/r}}$, so $v_2/v_1=\\sqrt{{r_1/r_2}}=1/\\sqrt{{{f:g}}}={v2 / v1:.3f}$.",
             [R("B1", "expression", "Obtains $v=\\sqrt{GM/r}$ from $GMm/r^2=mv^2/r$", ["sqrt(G M / r)"], err=["leaves the mass of the satellite in the expression"]),
              R("B2", "expression", "Writes the ratio $v_2/v_1=\\sqrt{r_1/r_2}$", ["sqrt(r1/r2)"], requires="B1", err=["inverts the ratio under the square root"]),
              R("B3", "numeric", f"Calculates $v_2/v_1\\approx {v2 / v1:.3f}$ (no units)", [f"{v2 / v1:.3f}"], requires="B2", nums=True, err=["uses the ratio of the radii without the square root"])]),
        part("C", f"Satellite 2 is ${f:g}$ times as far from the center of Earth as satellite 1. Predict the ratio of the period of satellite 2 to the period of satellite 1. Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The period is $T=2\\pi r/v=2\\pi\\sqrt{{r^3/(GM)}}$, so $T_2/T_1=({f:g})^{{3/2}}={ratio_T:.2f}$: the period of satellite 2 is about {ratio_T:.1f} times as long.",
             [R("C1", "numeric", f"States that the ratio of the periods is about {ratio_T:.1f} (the period of satellite 2 is greater)", [f"{ratio_T:.1f}", "greater"], nums=True, err=["states that the periods are equal", "uses the ratio of the radii"]),
              R("C2", "justification", "Justifies with $T=2\\pi r/v$ and $v=\\sqrt{GM/r}$, which gives $T\\propto r^{3/2}$", ["T = 2 pi r / v", "T proportional to r to the 3/2"], requires="C1", err=["argues only that a larger orbit takes more time"])]),
    ]
    return _pack("phf_qqt_orbit_speed", "qqt", "6.6", ["2.6", "2.9"], "3.B", "Two satellites in circular orbits", stim, parts, 8, 16, [f"r1={R1}", f"f={f}", f"v1={v1:.2f}", f"v2={v2:.2f}", f"Tratio={ratio_T:.4f}"],
                 [_ev("B", "speed ratio", v2 / v1, max(0.005, 0.01 * v2 / v1), ""), _ev("C", "period ratio", ratio_T, max(0.05, 0.01 * ratio_T), "")],
                 ("Using the gravitational force as the centripetal force to justify a claim about orbital speed and to predict the change in the period", ["Set the gravitational force equal to the centripetal force", "Derive the speed and the period as functions of the radius", "Apply the radius factor to predict the ratios"],
                  [("the orbits are circular and the only force is gravity from Earth", "the stimulus gives circular orbits about a uniform Earth")], {"type": "text", "must_include": ["the two radii"]},
                  "an RK4 integration of the orbit confirms the circular orbit speed sqrt(GM/r) and the period ratio equals the radius factor to the three halves"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_N_FRQ = ["phf_mr_atwood_machine", "phf_tbr_elevator_forces", "phf_lab_incline_g", "phf_qqt_orbit_speed"]
STAGE_N2_FRQ = ["phf_tbr_elevator_forces", "phf_qqt_orbit_speed", "phf_lab_incline_g"]
STAGE_N3_FRQ = ["phf_lab_incline_g"]
