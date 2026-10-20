"""AP Physics C: Mechanics — FRQ 두 번째 시나리오 4종(2026-10-20 2차 저작): MR 도르래-원판 / TBR 저항 낙하 v-t 그래프 / LAB 진자 T²-L / QQT 원 궤도 에너지. 유형·배점·행 구조는 physc_p0_frq.py 와 같다(MR 10 / TBR 12 / LAB 10 / QQT 8, 행 1점)."""
from physc_common import *
from phys_p0_frq import R, _ev, part
from physc_p0_frq import _pack

GM_E = 3.986e14


# ======================= MR (10): 질량 있는 도르래에 매달린 블록 =======================
def pcf_mr_pulley_disk(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); M = pick(rng, [2.0, 4.0, 6.0]); R_ = pick(rng, [0.10, 0.20, 0.25])
        a = m * CG / (m + M / 2); T = m * (CG - a)
        sol = np.linalg.solve(np.array([[m, 1.0], [-M / 2, 1.0]]), np.array([m * CG, 0.0])); agree(a, sol[0], 1e-9, "a"); agree(T, sol[1], 1e-9, "T")
        a2 = m * CG / (m + M); agree(a2, m * CG / (m + (2 * M) / 2), 1e-9, "a2")
        break
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ hangs from a light string that is wrapped around a pulley. The pulley is a uniform disk of mass $M={M:g}\\text{{ kg}}$ and radius $R={R_:g}\\text{{ m}}$ and can rotate about a fixed, frictionless horizontal axle through its center; its rotational inertia is $\\tfrac12MR^2$. The string does not slip on the pulley. The block is released from rest. Use $g=9.8\\text{{ m/s}}^2$.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the hanging block, draw and label the forces (not components) that act on the block while it falls. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A"],
             "Two arrows from the dot: weight straight down and tension straight up; the weight arrow is longer than the tension arrow because the block accelerates downward.",
             [R("A1", "diagram", "Draws and labels the weight (down) and the tension (up), with no extra force such as a force of motion", ["weight", "tension"], err=["adds a force of motion downward"]),
              R("A2", "diagram", "The directions are correct: weight straight down and tension straight up", ["directions"], err=["draws the tension downward"]),
              R("A3", "diagram", "The weight arrow is longer than the tension arrow because the block accelerates downward", ["weight longer than tension"], err=["draws equal lengths for an accelerating block"])]),
        part("B", "Derive an expression for the magnitude $a$ of the acceleration of the block in terms of $m$, $M$ and $g$.", 3, "derive", ["2.A"],
             "$mg-T=ma$ for the block and $TR=(\\tfrac12MR^2)(a/R)$ for the pulley give $T=\\tfrac12Ma$, so $a=mg/(m+M/2)$.",
             [R("B1", "expression", "Applies Newton's second law to the block: $mg-T=ma$", ["m g - T = m a"], err=["uses T = m g"]),
              R("B2", "expression", "Applies the rotational form of Newton's second law to the pulley with $a=\\alpha R$: $TR=\\tfrac12MR^2(a/R)$, so $T=\\tfrac12Ma$", ["T R = I alpha", "T = M a / 2"], err=["omits the rotational inertia of the pulley"]),
              R("B3", "expression", "Combines the equations to $a=mg/(m+M/2)$", ["m g / (m + M/2)"], requires="B2", err=["obtains $mg/(m+M)$"])]),
        part("C", f"Calculate the acceleration of the block for $m={m:g}\\text{{ kg}}$ and $M={M:g}\\text{{ kg}}$.", 2, "calculate", ["2.B"],
             f"$a=mg/(m+M/2)=({m:g})(9.8)/({m:g}+{M / 2:g})\\approx {a:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "numeric", "Substitutes the values into the expression from part B", ["substitution"], requires="B3", nums=True, err=["uses the full mass of the pulley, $M$, in place of $M/2$"]),
              R("C2", "numeric", f"Obtains about {a:.2f} with units of meters per second squared", [f"{a:.2f}", "m/s^2"], requires="C1", nums=True, units=True)]),
        part("D", "The pulley is replaced by a uniform disk of the same radius but twice the mass. Does the magnitude of the acceleration of the block increase, decrease, or stay the same? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "It decreases, because a pulley with twice the mass has twice the rotational inertia, so $a=mg/(m+M/2)$ has a larger denominator.",
             [R("D1", "claim", "States that the acceleration decreases", ["decreases"], err=["states that the acceleration is unchanged because the hanging mass is unchanged"]),
              R("D2", "justification", "Justifies that the larger pulley mass increases the effective inertia ($m+M/2$) of the system, or that more of the energy goes into rotation", ["larger M increases m + M/2", "more rotational inertia"], requires="D1", err=["argues only that the pulley is heavier"])]),
    ]
    return _pack("pcf_mr_pulley_disk", "mr", "5.6", ["2.5", "5.4", "1.2"], "2.B", "Block hanging from a pulley with rotational inertia", stim, parts, 10, 24, [f"m={m}", f"M={M}", f"R={R_}", f"a={a:.4f}", f"T={T:.4f}"],
                 [_ev("C", "acceleration", a, max(0.05, 0.012 * a), "m/s^2")],
                 ("Newton's second law for translation and rotation together, a derivation of the acceleration, and a justified prediction about the pulley's mass", ["Draw the free-body diagram of the block", "Write the translational equation for the block and the rotational equation for the pulley and eliminate the tension", "Predict the effect of the pulley's mass on the acceleration"],
                  [("the string does not slip and the axle is frictionless", "the stimulus states a non-slipping string and a frictionless axle")], {"type": "text", "must_include": ["the masses", "the pulley's rotational inertia"]},
                  "numpy linalg.solve of the two coupled equations recomputes the acceleration and the tension"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= TBR (12): 저항을 받는 낙하의 속력-시간 그래프 =======================
def pcf_tbr_drag_graph(rng):
    for _ in forever():
        m = pick(rng, [0.5, 1.0, 2.0]); b = pick(rng, [1.0, 2.0, 4.0]); vt = m * CG / b; tau = m / b; v1 = vt * (1 - math.exp(-1))
        y = rk4(lambda tt, s: np.array([CG - b * s[0] / m]), [0.0], 0.0, tau, 8000); agree(v1, y[0], 1e-6, "v1")
        if 1.5 < vt < 40:
            break
    stim = {"kind": "text", "description": f"An object of mass $m={m:g}\\text{{ kg}}$ is released from rest and falls through a fluid that exerts a drag force of magnitude $bv$ opposing the motion, with $b={b:g}\\text{{ kg/s}}$. Take $g=9.8\\text{{ m/s}}^2$. The speed of the object is $v(t)=v_t\\left(1-e^{{-t/\\tau}}\\right)$ with $\\tau=m/b$. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the speed $v$ of the object as a function of time $t$ from $t=0$ until the speed is nearly constant. Label the terminal speed $v_t$ with its value and show the initial slope of the curve.", 4, "graph", ["1.A", "1.C"],
             f"A curve starting at the origin with initial slope $g=9.8\\text{{ m/s}}^2$, concave down, approaching the horizontal line $v_t={vt:.2f}\\text{{ m/s}}$.",
             [R("A1", "graph", "Both axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The curve starts at the origin and its initial slope is steep (equal to $g$)", ["starts at the origin with slope g"], err=["starts at a nonzero speed"]),
              R("A3", "graph", "The curve is concave down and levels off toward a horizontal asymptote", ["concave down", "horizontal asymptote"], err=["draws a straight line with no leveling off"]),
              R("A4", "graph", f"The asymptote is labeled $v_t$ with a value of about ${vt:.2f}\\text{{ m/s}}$", [f"{vt:.2f}"], nums=True)]),
        part("B", "Write Newton's second law for the object and derive an expression for the terminal speed $v_t$ in terms of $m$, $g$ and $b$.", 3, "derive", ["2.A"],
             "$mg-bv=m\\,dv/dt$. At terminal speed $dv/dt=0$, so $v_t=mg/b$.",
             [R("B1", "expression", "Writes Newton's second law with the correct signs: $mg-bv=m\\,dv/dt$", ["m g - b v = m dv/dt"], err=["adds the drag force to the weight"]),
              R("B2", "expression", "Sets the acceleration to zero at terminal speed", ["dv/dt = 0"], requires="B1", err=["sets the speed to zero"]),
              R("B3", "expression", "Obtains $v_t=mg/b$", ["m g / b"], requires="B2", err=["obtains $v_t=b/(mg)$"])]),
        part("C", f"Calculate the terminal speed, the time constant $\\tau$, and the speed of the object at $t=\\tau$.", 3, "calculate", ["2.B"],
             f"$v_t=mg/b={vt:.2f}\\text{{ m/s}}$, $\\tau=m/b={tau:.2f}\\text{{ s}}$, and $v(\\tau)=v_t(1-e^{{-1}})\\approx{v1:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", f"Calculates the terminal speed of about {vt:.2f} with units of meters per second", [f"{vt:.2f}", "m/s"], requires="B3", nums=True, units=True, err=["uses $v_t=b/(mg)$"]),
              R("C2", "numeric", f"Calculates the time constant $\\tau=m/b$ of about {tau:.2f} with units of seconds", [f"{tau:.2f}", "s"], nums=True, units=True, err=["inverts the ratio"]),
              R("C3", "numeric", f"Evaluates $v(\\tau)=v_t(1-e^{{-1}})$ to about {v1:.2f} with units of meters per second", [f"{v1:.2f}", "m/s"], requires="C1", nums=True, units=True, err=["uses $v_te^{-1}$"])]),
        part("D", "The object is replaced by one with twice the mass and the same drag coefficient $b$. Predict by what factors the terminal speed and the time constant change, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             "Both double, because $v_t=mg/b$ and $\\tau=m/b$ are each proportional to the mass.",
             [R("D1", "numeric", "States that the terminal speed doubles and the time constant doubles (a factor of 2 for each)", ["terminal speed doubles", "time constant doubles"], nums=True, err=["states that the terminal speed is unchanged because all objects fall at the same rate"]),
              R("D2", "justification", "Justifies with $v_t=mg/b$ and $\\tau=m/b$, which are both proportional to $m$ at fixed $b$", ["v_t and tau proportional to m"], requires="D1", err=["argues only that heavier objects fall faster"])]),
    ]
    return _pack("pcf_tbr_drag_graph", "tbr", "2.9", ["2.5", "1.2", "1.3"], "1.C", "Speed-time graph of a fall with linear drag", stim, parts, 12, 27, [f"m={m}", f"b={b}", f"vt={vt:.4f}", f"tau={tau:.4f}", f"v1={v1:.4f}"],
                 [_ev("A", "terminal speed", vt, 0.02 * vt + 0.02, "m/s"), _ev("C", "time constant", tau, 0.01 * tau + 0.005, "s"), _ev("C", "speed at tau", v1, 0.012 * v1 + 0.02, "m/s")],
                 ("Representing the speed of a falling object with linear drag as a graph, deriving the terminal speed, and predicting the effect of a larger mass", ["Sketch the speed-time graph with its initial slope and asymptote", "Derive the terminal speed from the force balance", "Predict the effect of doubling the mass on the terminal speed and the time constant"],
                  [("the drag force is $bv$ and the speed follows the stated exponential approach", "the stimulus states the drag law and the speed function")], {"type": "text", "must_include": ["the mass", "the drag coefficient", "the speed function"]},
                  "an RK4 integration of m dv/dt = mg - bv recomputes the speed at one time constant"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 진자의 T²–L 선형화로 g 측정 =======================
def pcf_lab_pendulum_g(rng):
    Ls = [0.20, 0.40, 0.60, 0.80, 1.00]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); gtrue = pick(rng, [9.7, 9.8, 9.9])
        Ts = [round(2 * math.pi * math.sqrt(L / gtrue) * (1 + r2.uniform(-0.01, 0.01)), 3) for L in Ls]; T2 = [round(t * t, 4) for t in Ts]
        slope, icpt = np.polyfit(Ls, T2, 1); Xn = np.array([[L, 1.0] for L in Ls]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(T2)); agree(slope, beta[0], 1e-9, "slope")
        g_est = 4 * math.pi ** 2 / slope
        if abs(g_est - 9.8) / 9.8 < 0.04:
            break
    stim = {"kind": "table", "description": "A student measures the period $T$ of a small bob hanging on a light string of length $L$ and swinging with a small amplitude, for several string lengths. The student wants to determine the gravitational field strength $g$.", "data": {"x_label": "String length L (m)", "y_label": "Period T (s)", "rows": [[L, t] for L, t in zip(Ls, Ts)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the period as a function of the string length. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured period.", 3, "design", ["3.A", "2.B"],
             "Measure the length from the pivot to the center of the bob with a meterstick for each setting; release the bob from a small angle and time many swings (for example 10) with a stopwatch, divide to find the period; change only the string length with the same bob and the same small starting angle; reduce the uncertainty by timing many swings or repeating and averaging.",
             [R("A1", "design", "Identifies how the length is measured (pivot to the center of the bob) and how the period is timed (a stopwatch)", ["a way to measure the length and a way to time the period"], err=["omits how the period is measured"]),
              R("A2", "design", "Changes only the string length while using the same bob and the same small starting angle (both conditions are needed)", ["change only the length with the same bob and small angle"]),
              R("A3", "design", "Reduces the timing uncertainty by timing many swings and dividing, or by repeating and averaging (either earns the point)", ["time many swings or repeat and average (either earns the point)"])]),
        part("B", "Using the relationship between the period of a simple pendulum, its length and $g$, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $g$.", 1, "explain", ["2.B", "3.A"],
             "$T=2\\pi\\sqrt{L/g}$, so $T^2=(4\\pi^2/g)L$: plot $T^2$ on the vertical axis against $L$ on the horizontal axis; the slope is $4\\pi^2/g$.",
             [R("B1", "expression", "Identifies $T^2$ (vertical) versus $L$ (horizontal)", ["T squared versus L"], err=["plots T versus L"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(L,T^2)$: {', '.join(f'({L:g}, {t:.3f})' for L, t in zip(Ls, T2))} with a best-fit line of slope about ${slope:.2f}\\text{{ s}}^2/\\text{{m}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(L, T^2)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the gravitational field strength $g$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $4\\pi^2/g\\approx {slope:.2f}\\text{{ s}}^2/\\text{{m}}$, so $g=4\\pi^2/\\text{{slope}}\\approx {g_est:.1f}\\text{{ m/s}}^2$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} s^2/m; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $g$: slope $=4\\pi^2/g$ so $g=4\\pi^2/\\text{slope}$", ["g = 4 pi^2 / slope"], err=["uses $g=\\text{slope}/(4\\pi^2)$"]),
              R("D3", "numeric", f"Obtains $g$ of about {g_est:.1f} with units of meters per second squared (accept any value consistent with the student's own slope from D1)", [f"{g_est:.1f}", "m/s^2"], alt=["a value of g consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pcf_lab_pendulum_g", "lab", "7.5", ["7.2", "3.4"], "3.A", "Experiment: g from the period of a simple pendulum", stim, parts, 10, 27, [f"gtrue={gtrue}", f"slope={slope:.5f}", f"g_est={g_est:.3f}", f"T2={T2}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "s^2/m"), _ev("D", "gravitational field strength", g_est, 0.06 * g_est, "m/s^2")],
                 ("Designing an experiment and analyzing linearized pendulum data to extract the gravitational field strength", ["Describe the measurements and how the timing uncertainty is reduced", "Linearize $T^2=(4\\pi^2/g)L$ and plot the data", "Use the slope to determine g"],
                  [("the generated periods follow $T=2\\pi\\sqrt{L/g}$ with a small random error so the fitted g is within four percent of 9.8", "the code rejects a seed whose fitted g differs from 9.8 by more than four percent")], {"type": "table", "must_include": ["string length", "period"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted g is compared with the reference value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 원 궤도의 에너지 =======================
def pcf_qqt_orbit_energy(rng):
    for _ in forever():
        m = pick(rng, [500.0, 1000.0, 2000.0]); r1 = pick(rng, [7.0e6, 8.0e6, 1.0e7]); k = pick(rng, [2.0, 3.0, 4.0]); r2 = k * r1
        E1 = -GM_E * m / (2 * r1); E2 = -GM_E * m / (2 * r2); dE = E2 - E1
        K1 = GM_E * m / (2 * r1); v1 = math.sqrt(GM_E / r1); v2 = math.sqrt(GM_E / r2)
        agree(K1, 0.5 * m * v1 ** 2, 1e-9, "K"); agree(v2 / v1, 1 / math.sqrt(k), 1e-9, "vr")
        break
    stim = {"kind": "text", "description": f"A satellite of mass $m={m:g}\\text{{ kg}}$ moves in a circular orbit of radius {sci(r1, "m")} around Earth, measured from the center of Earth. Thrusters later raise it to a circular orbit of radius $r_2={k:g}\\,r_1$. Use $GM_E=3.986\\times10^{{14}}\\text{{ m}}^3/\\text{{s}}^2$ and take the gravitational potential energy to be zero at infinite separation.", "data": {}}
    parts = [
        part("A", "A student claims that when the satellite moves to the larger orbit its kinetic energy decreases but its total mechanical energy increases. Do you agree or disagree with the claim? Justify your answer using the expressions for the energies of a circular orbit.", 3, "explain", ["3.B", "3.C"],
             "Agree. For a circular orbit $K=GMm/(2r)$ decreases as $r$ increases, while $E=K+U=-GMm/(2r)$ is negative and becomes less negative (increases) as $r$ increases.",
             [R("A1", "claim", "Agrees with the claim", ["agree"], err=["disagrees because a higher orbit has more energy in every form"]),
              R("A2", "justification", "Justifies the decrease of the kinetic energy with $K=GMm/(2r)$ from the centripetal condition", ["K = G M m / (2 r)", "K decreases with r"], err=["says the kinetic energy increases with the height"]),
              R("A3", "justification", "Justifies the increase of the total energy with $E=-GMm/(2r)$, which becomes less negative as $r$ increases", ["E = - G M m / (2 r)", "E increases with r"], requires="A2", err=["says the total energy is positive"])]),
        part("B", "Derive an expression for the total mechanical energy of the satellite in a circular orbit of radius $r$, and calculate, in gigajoules (GJ), the change in the total mechanical energy when the satellite moves from $r_1$ to $r_2$.", 3, "derive", ["2.A", "2.B"],
             f"$GMm/r^2=mv^2/r$ gives $K=GMm/(2r)$, and $E=K+U=-GMm/(2r)$. $\\Delta E=\\tfrac12GMm(1/r_1-1/r_2)\\approx{dE / 1e9:.3g}\\text{{ GJ}}$.",
             [R("B1", "expression", "Sets the gravitational force equal to the centripetal force to get $K=GMm/(2r)$", ["G M m / r^2 = m v^2 / r", "K = G M m / (2 r)"], err=["uses K = G M m / r"]),
              R("B2", "expression", "Adds the potential energy $U=-GMm/r$ to obtain $E=-GMm/(2r)$", ["E = K + U = - G M m / (2 r)"], requires="B1", err=["obtains $E=+GMm/(2r)$"]),
              R("B3", "numeric", f"Calculates $\\Delta E=\\tfrac12GMm(1/r_1-1/r_2)$ of about {dE / 1e9:.3g} with units of gigajoules (positive)", [f"{dE / 1e9:.3g}", "GJ"], requires="B2", nums=True, units=True, err=["gives a negative change"])]),
        part("C", "Predict the ratio of the orbital speed in the larger orbit to the orbital speed in the original orbit, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The ratio is $v_2/v_1=\\sqrt{{r_1/r_2}}=1/\\sqrt{{{k:g}}}\\approx{1 / math.sqrt(k):.3f}$, because $v=\\sqrt{{GM/r}}$.",
             [R("C1", "numeric", f"States that the speed ratio is about {1 / math.sqrt(k):.3f} (the speed decreases)", [f"{1 / math.sqrt(k):.3f}", "decreases"], nums=True, err=["states that the speed increases", f"states a ratio of {1 / k:.3f}"]),
              R("C2", "justification", "Justifies with $v=\\sqrt{GM/r}$, so the speed is inversely proportional to the square root of the radius", ["v = sqrt(GM/r)", "v proportional to 1/sqrt(r)"], requires="C1", err=["argues only that the satellite is farther away"])]),
    ]
    return _pack("pcf_qqt_orbit_energy", "qqt", "6.6", ["3.4", "2.6"], "3.B", "Energy of a satellite moved to a larger circular orbit", stim, parts, 8, 16, [f"m={m}", f"r1={r1}", f"k={k}", f"dE={dE:.5g}", f"vr={v2 / v1:.5f}"],
                 [_ev("B", "change in total energy", dE / 1e9, 0.012 * dE / 1e9, "GJ"), _ev("C", "speed ratio", v2 / v1, 0.01, "")],
                 ("Using the energies of a circular orbit to justify a claim about the kinetic and total energy and to predict the change in the orbital speed", ["Derive the kinetic, potential and total energy of a circular orbit", "Compare the energies at the two radii", "Predict the orbital speed ratio from the radius ratio"],
                  [("the orbits are circular and the only force is Earth's gravity", "the stimulus gives circular orbits about Earth")], {"type": "text", "must_include": ["the masses", "the two radii"]},
                  "the energies are recomputed numerically from the orbital speeds at the two radii"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ_B = ["pcf_mr_pulley_disk", "pcf_tbr_drag_graph", "pcf_lab_pendulum_g", "pcf_qqt_orbit_energy"]
