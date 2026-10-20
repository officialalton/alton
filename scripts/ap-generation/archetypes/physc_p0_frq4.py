"""AP Physics C: Mechanics — FRQ 네 번째 시나리오 4종(2026-10-20 4차 저작): MR 막대 회전 시작 / TBR 단진동 x–t·v–t 그래프 / LAB 용수철 T²–m / QQT 완전 비탄성 충돌. 유형·배점·행 구조는 physc_p0_frq.py 와 같다."""
from physc_common import *
from phys_p0_frq import R, _ev, part
from physc_p0_frq import _pack


# ======================= MR (10): 수평에서 놓은 막대 =======================
def pcf_mr_rod_release(rng):
    for _ in forever():
        M = pick(rng, [1.0, 2.0, 3.0]); L = pick(rng, [0.8, 1.0, 1.5]); al = 3 * CG / (2 * L); w = math.sqrt(3 * CG / L); a_end = al * L
        agree(al, (M * CG * L / 2) / (M * L * L / 3), 1e-9, "al"); agree(0.5 * (M * L * L / 3) * w * w, M * CG * L / 2, 1e-9, "E")
        break
    stim = {"kind": "text", "description": f"A uniform rod of mass $M={M:g}\\text{{ kg}}$ and length $L={L:g}\\text{{ m}}$ is held horizontal and is free to rotate about a frictionless horizontal pivot at one end. The rotational inertia of the rod about the pivot is $\\tfrac13ML^2$. The rod is released from rest. Use $g=9.8\\text{{ m/s}}^2$.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the center of mass of the rod at the instant of release, draw and label the forces (not components) that act on the rod. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A"],
             "Two arrows from the dot: the weight straight down and the force of the pivot straight up (its magnitude is less than the weight because the center of mass accelerates downward).",
             [R("A1", "diagram", "Draws and labels the weight (down) and the force exerted by the pivot (up), with no extra force such as a force of rotation", ["weight", "pivot force"], err=["adds a force of rotation", "draws only the weight"]),
              R("A2", "diagram", "The directions are correct: weight straight down and the pivot force straight up", ["directions"], err=["draws the pivot force horizontal at the instant of release"]),
              R("A3", "diagram", "The weight arrow is longer than the pivot-force arrow because the center of mass accelerates downward", ["weight longer than pivot force"], err=["draws equal lengths for an accelerating rod"])]),
        part("B", "Derive an expression for the angular acceleration $\\alpha$ of the rod just after the release in terms of $g$ and $L$.", 3, "derive", ["2.A"],
             "The torque of the weight about the pivot is $Mg(L/2)$, so $\\alpha=\\tau/I=Mg(L/2)/(\\tfrac13ML^2)=3g/(2L)$.",
             [R("B1", "expression", "Finds the torque of the weight about the pivot, $\\tau=Mg(L/2)$, using the center of mass at $L/2$", ["tau = M g L/2"], err=["uses the lever arm L"]),
              R("B2", "expression", "Applies $\\tau=I\\alpha$ with $I=\\tfrac13ML^2$", ["tau = I alpha", "I = 1/3 M L^2"], requires="B1", err=["uses the rotational inertia about the center, $\\tfrac1{12}ML^2$"]),
              R("B3", "expression", "Obtains $\\alpha=3g/(2L)$ (the mass cancels)", ["3 g / (2 L)"], requires="B2", err=["obtains $g/L$"])]),
        part("C", f"Calculate the angular speed of the rod when it is vertical, for $L={L:g}\\text{{ m}}$.", 2, "calculate", ["2.B"],
             f"$Mg(L/2)=\\tfrac12(\\tfrac13ML^2)\\omega^2$ gives $\\omega=\\sqrt{{3g/L}}\\approx{w:.2f}\\text{{ rad/s}}$.",
             [R("C1", "expression", "Equates the loss of gravitational energy of the center of mass to the rotational kinetic energy: $Mg(L/2)=\\tfrac12I\\omega^2$", ["M g L/2 = 1/2 I omega^2"], err=["uses the drop L for the center of mass"]),
              R("C2", "numeric", f"Obtains about {w:.2f} with units of radians per second", [f"{w:.2f}", "rad/s"], requires="C1", nums=True, units=True)]),
        part("D", "A second rod of the same length but twice the mass is released in the same way. Does the angular acceleration just after the release increase, decrease or stay the same? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "It stays the same, because the torque $Mg(L/2)$ and the rotational inertia $\\tfrac13ML^2$ are both proportional to $M$ and the mass cancels in $\\alpha=3g/(2L)$.",
             [R("D1", "claim", "States that the angular acceleration stays the same", ["stays the same"], err=["states that the angular acceleration doubles"]),
              R("D2", "justification", "Justifies that the mass appears in both the torque and the rotational inertia and cancels in $\\alpha=3g/(2L)$", ["mass cancels", "both proportional to M"], requires="D1", err=["argues only that all objects fall at the same rate"])]),
    ]
    return _pack("pcf_mr_rod_release", "mr", "5.6", ["6.1", "5.4", "2.2"], "2.B", "Uniform rod released from the horizontal", stim, parts, 10, 22, [f"M={M}", f"L={L}", f"al={al:.4f}", f"w={w:.4f}"],
                 [_ev("C", "angular speed", w, max(0.05, 0.012 * w), "rad/s")],
                 ("Rotational form of Newton's second law and energy conservation for a pivoted rod, and a justified prediction about the mass", ["Draw the free-body diagram of the rod", "Find the torque of the weight and divide by the rotational inertia", "Use energy conservation for the angular speed and predict the effect of the mass"],
                  [("the pivot is frictionless and the rod is uniform", "the stimulus states a frictionless pivot and a uniform rod")], {"type": "text", "must_include": ["the mass", "the length", "the rotational inertia about the pivot"]},
                  "the torque and the rotational inertia are combined numerically; the angular speed is recomputed from the energy balance"),
                 ["representation_reading", "law_selection", "justification"])


# ======================= TBR (12): 단진동 x–t, v–t 그래프 =======================
def pcf_tbr_shm_phase_graphs(rng):
    for _ in forever():
        k = pick(rng, [40.0, 80.0, 100.0]); m = pick(rng, [0.4, 1.0, 2.0]); A = pick(rng, [0.10, 0.20]); w = math.sqrt(k / m); T = 2 * math.pi / w; vmax = A * w; amax = A * w * w
        agree(vmax, math.sqrt(k / m) * A, 1e-9, "vmax")
        break
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is attached to a horizontal ideal spring of spring constant $k={k:g}\\text{{ N/m}}$ on a frictionless surface. The block is pulled to $x=+A$ with $A={A:g}\\text{{ m}}$ and released from rest at $t=0$. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", f"On the axes provided, sketch the position $x$ and the velocity $v$ of the block as functions of time $t$ for one full period (use two separate sets of axes stacked vertically with the same time scale). Label the amplitudes and the period.", 4, "graph", ["1.A", "1.C"],
             f"$x(t)$ is a cosine starting at $+{A:g}\\text{{ m}}$ with period $T={T:.2f}\\text{{ s}}$; $v(t)$ is a negative sine, zero at $t=0$, reaching $-{vmax:.2f}\\text{{ m/s}}$ at $T/4$.",
             [R("A1", "graph", "Both sets of axes are labeled with quantities and units and share the same time scale", ["axis labels", "units"]),
              R("A2", "graph", f"The position graph is a cosine that starts at $+A={A:g}\\text{{ m}}$", ["cosine starting at +A"], nums=True, err=["starts at zero like a sine"]),
              R("A3", "graph", f"The velocity graph is zero at $t=0$ and first becomes negative, reaching about $-{vmax:.2f}\\text{{ m/s}}$ at a quarter period", [f"{vmax:.2f}", "starts at zero", "negative first"], nums=True, err=["draws the velocity as a positive cosine"]),
              R("A4", "graph", f"The period is marked as about ${T:.2f}\\text{{ s}}$ on the time axis", [f"{T:.2f}"], nums=True, err=["marks half of the period"])]),
        part("B", "Derive an expression for the maximum speed of the block in terms of $A$, $k$ and $m$.", 3, "derive", ["2.A"],
             "$x=A\\cos\\omega t$ with $\\omega=\\sqrt{k/m}$, so $v=dx/dt=-A\\omega\\sin\\omega t$ and $v_{max}=A\\sqrt{k/m}$.",
             [R("B1", "expression", "Identifies the angular frequency $\\omega=\\sqrt{k/m}$ (or sets the initial elastic energy $\\tfrac12kA^2$ equal to the maximum kinetic energy)", ["omega = sqrt(k/m)"], alt=["1/2 k A^2 = 1/2 m v_max^2 (energy conservation)"], err=["uses $\\omega=\\sqrt{m/k}$"]),
              R("B2", "expression", "Differentiates the position function to find the velocity $v=-A\\omega\\sin\\omega t$ (or writes the kinetic energy at the equilibrium position)", ["v = - A omega sin omega t"], alt=["1/2 m v^2 = 1/2 k A^2"], requires="B1", err=["differentiates cos to sin without the factor omega"]),
              R("B3", "expression", "Obtains $v_{max}=A\\sqrt{k/m}$", ["A sqrt(k/m)"], requires="B2", err=["omits the square root"])]),
        part("C", "Calculate the period, the maximum speed and the magnitude of the maximum acceleration of the block.", 3, "calculate", ["2.B"],
             f"$T=2\\pi\\sqrt{{m/k}}\\approx{T:.2f}\\text{{ s}}$, $v_{{max}}=A\\sqrt{{k/m}}\\approx{vmax:.2f}\\text{{ m/s}}$ and $a_{{max}}=A\\omega^2=kA/m\\approx{amax:.2f}\\text{{ m/s}}^2$.",
             [R("C1", "numeric", f"Calculates the period of about {T:.2f} with units of seconds", [f"{T:.2f}", "s"], nums=True, units=True, err=["omits the $2\\pi$"]),
              R("C2", "numeric", f"Calculates the maximum speed of about {vmax:.2f} with units of meters per second", [f"{vmax:.2f}", "m/s"], nums=True, units=True, err=["omits the square root"]),
              R("C3", "numeric", f"Calculates the maximum acceleration of about {amax:.2f} with units of meters per second squared", [f"{amax:.2f}", "m/s^2"], nums=True, units=True, err=["uses $A\\omega$ for the acceleration"])]),
        part("D", "The block is replaced by one with four times the mass and released from the same position. Predict by what factors the period and the maximum speed change, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The period doubles and the maximum speed is halved, because $T=2\\pi\\sqrt{m/k}$ and $v_{max}=A\\sqrt{k/m}$ depend on $m$ through $\\sqrt{m}$.",
             [R("D1", "numeric", "States that the period doubles (a factor of 2) and the maximum speed is halved (a factor of 1/2)", ["period doubles", "speed halves"], nums=True, err=["states a factor of 4 for the period"]),
              R("D2", "justification", "Justifies with $T\\propto\\sqrt{m}$ and $v_{max}\\propto1/\\sqrt{m}$ (same stored energy shared with a larger mass)", ["T proportional to sqrt m", "same energy larger mass"], requires="D1", err=["argues only that the heavier block is slower"])]),
    ]
    return _pack("pcf_tbr_shm_phase_graphs", "tbr", "7.3", ["7.1", "7.2", "1.3"], "2.D", "Position and velocity graphs of a block on a spring", stim, parts, 12, 27, [f"k={k}", f"m={m}", f"A={A}", f"T={T:.4f}", f"vmax={vmax:.4f}", f"amax={amax:.4f}"],
                 [_ev("C", "period", T, 0.01, "s"), _ev("C", "maximum speed", vmax, 0.012 * vmax + 0.005, "m/s"), _ev("C", "maximum acceleration", amax, 0.012 * amax + 0.02, "m/s^2")],
                 ("Sketching the position and velocity graphs of an oscillator, deriving the maximum speed by differentiation, and predicting the effect of a larger mass", ["Sketch the position and the velocity as functions of time", "Differentiate the position function for the velocity and find its maximum", "Predict the effect of a larger mass on the period and the maximum speed"],
                  [("the surface is frictionless and the spring is ideal", "the stimulus states a frictionless surface and an ideal spring")], {"type": "text", "must_include": ["the mass", "the spring constant", "the amplitude"]},
                  "an RK4 simulation recomputes the period and the maximum speed; the maximum acceleration follows from Hooke's law"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 용수철 T²–m 선형화 =======================
def pcf_lab_spring_period_k(rng):
    ms = [0.10, 0.20, 0.30, 0.40, 0.50]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); k = pick(rng, [20.0, 25.0, 40.0, 50.0])
        Ts = [round(2 * math.pi * math.sqrt(m / k) * (1 + r2.uniform(-0.015, 0.015)), 3) for m in ms]; T2 = [round(t * t, 4) for t in Ts]
        slope = float(np.polyfit(ms, T2, 1)[0]); X = np.array([[m, 1.0] for m in ms]); beta = np.linalg.solve(X.T @ X, X.T @ np.array(T2)); agree(slope, beta[0], 1e-9, "slope"); k_est = 4 * math.pi ** 2 / slope
        if abs(k_est - k) / k < 0.04:
            break
    stim = {"kind": "table", "description": "A student hangs a block of mass m from a vertical spring of unknown spring constant k, pulls it down a small distance and releases it, and measures the period T of the oscillation for several masses.", "data": {"x_label": "Mass m (kg)", "y_label": "Period T (s)", "rows": [[m, t] for m, t in zip(ms, Ts)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the period as a function of the mass. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured period.", 3, "design", ["3.A", "2.B"],
             "Measure each mass with a balance (or use known slotted masses); displace the block a small distance and time 10 oscillations with a stopwatch, dividing to find the period; change only the hanging mass with the same spring and the same small starting displacement; reduce the timing uncertainty by timing many oscillations or repeating the trials and averaging.",
             [R("A1", "design", "Identifies how the mass is measured and how the period is timed (a stopwatch)", ["a way to know the mass and a way to time the period"], err=["omits how the period is measured"]),
              R("A2", "design", "Changes only the mass while using the same spring and the same small starting displacement (both conditions are needed)", ["change only the mass and keep the spring and displacement"]),
              R("A3", "design", "Reduces the timing uncertainty by timing many oscillations and dividing, or by repeating the trials and averaging (either earns the point)", ["time many oscillations or repeat and average (either earns the point)"])]),
        part("B", "Using the relationship between the period of a block on a spring, the mass and the spring constant, identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $k$.", 1, "explain", ["2.B", "3.A"],
             "$T=2\\pi\\sqrt{m/k}$, so $T^2=(4\\pi^2/k)m$: plot $T^2$ on the vertical axis against $m$ on the horizontal axis; the slope is $4\\pi^2/k$.",
             [R("B1", "expression", "Identifies $T^2$ (vertical) versus $m$ (horizontal)", ["T squared versus m"], err=["plots T versus m"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(m,T^2)$: {', '.join(f'({m:g}, {t:.3f})' for m, t in zip(ms, T2))} with a best-fit line of slope about ${slope:.2f}\\text{{ s}}^2/\\text{{kg}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(m, T^2)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the spring constant $k$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $4\\pi^2/k\\approx{slope:.2f}\\text{{ s}}^2/\\text{{kg}}$, so $k=4\\pi^2/\\text{{slope}}\\approx{k_est:.1f}\\text{{ N/m}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} s^2/kg; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the spring constant: slope $=4\\pi^2/k$ so $k=4\\pi^2/\\text{slope}$", ["k = 4 pi^2 / slope"], err=["uses $k=\\text{slope}/(4\\pi^2)$"]),
              R("D3", "numeric", f"Obtains $k$ of about {k_est:.1f} with units of newtons per meter (accept any value consistent with the student's own slope from D1)", [f"{k_est:.1f}", "N/m"], alt=["a value of k consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pcf_lab_spring_period_k", "lab", "7.2", ["7.1", "3.4"], "3.A", "Experiment: spring constant from the period of a hanging block", stim, parts, 10, 27, [f"k={k}", f"slope={slope:.5f}", f"k_est={k_est:.4f}", f"T2={T2}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "s^2/kg"), _ev("D", "spring constant", k_est, 0.05 * k_est, "N/m")],
                 ("Designing an experiment and analyzing linearized period data to extract the spring constant", ["Describe the measurements and how the timing uncertainty is reduced", "Linearize $T^2=(4\\pi^2/k)m$ and plot the data", "Use the slope to determine k"],
                  [("the generated periods follow $T=2\\pi\\sqrt{m/k}$ with a small random error so the fitted k is within four percent of the generating value", "the code rejects a seed whose fitted k differs from the generating value by more than four percent")], {"type": "table", "must_include": ["mass", "period"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted k is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 완전 비탄성 충돌 =======================
def pcf_qqt_inelastic_collision(rng):
    for _ in forever():
        m1 = pick(rng, [1.0, 2.0, 3.0]); m2 = pick(rng, [1.0, 2.0, 4.0]); v = pick(rng, [3.0, 4.0, 6.0]); vf = m1 * v / (m1 + m2); frac = m2 / (m1 + m2); frac2 = 2 * m2 / (m1 + 2 * m2)
        sol = np.linalg.solve(np.array([[m1 + m2]]), np.array([m1 * v])); agree(vf, sol[0], 1e-9, "vf")
        Ki = 0.5 * m1 * v * v; Kf = 0.5 * (m1 + m2) * vf * vf; agree(1 - Kf / Ki, frac, 1e-9, "frac")
        if frac2 > frac + 0.03:
            break
    stim = {"kind": "text", "description": f"A cart of mass $m_1={m1:g}\\text{{ kg}}$ moves at $v={v:g}\\text{{ m/s}}$ on a frictionless horizontal track and collides with a stationary cart of mass $m_2={m2:g}\\text{{ kg}}$. The carts stick together.", "data": {}}
    parts = [
        part("A", "A student claims that both the total momentum and the total kinetic energy of the two carts are conserved in the collision. Do you agree or disagree with the claim? Justify your answer.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The momentum is conserved because there is no external horizontal force on the carts, but the carts stick together, so the collision is perfectly inelastic and part of the kinetic energy is transformed into internal energy.",
             [R("A1", "claim", "Disagrees with the claim (only the momentum is conserved)", ["disagree"], err=["agrees that both are conserved"]),
              R("A2", "justification", "Justifies that the momentum is conserved because there is no external horizontal force on the system of the two carts", ["no external force so momentum conserved"], err=["says momentum is lost because the carts stick"]),
              R("A3", "justification", "Justifies that the kinetic energy is not conserved because the carts stick together (the collision is perfectly inelastic) and some energy becomes internal energy", ["perfectly inelastic", "kinetic energy becomes internal energy"], requires="A1", err=["says the energy disappears without any transformation"])]),
        part("B", "Derive an expression for the speed of the combined carts after the collision and the fraction of the initial kinetic energy that is lost, in terms of $m_1$ and $m_2$.", 3, "derive", ["2.A"],
             f"$m_1v=(m_1+m_2)v_f$ gives $v_f=m_1v/(m_1+m_2)={vf:.2f}\\text{{ m/s}}$ and the lost fraction is $1-K_f/K_i=m_2/(m_1+m_2)={frac:.3f}$.",
             [R("B1", "expression", "Applies conservation of momentum: $m_1v=(m_1+m_2)v_f$", ["m1 v = (m1 + m2) v_f"], err=["conserves the kinetic energy instead"]),
              R("B2", "expression", "Solves for $v_f=m_1v/(m_1+m_2)$", ["m1 v / (m1 + m2)"], requires="B1", err=["puts $m_2$ in the numerator"]),
              R("B3", "expression", "Obtains the lost fraction $m_2/(m_1+m_2)$ from $K_f/K_i=m_1/(m_1+m_2)$", ["m2 / (m1 + m2)"], requires="B2", err=["gives the fraction that remains"])]),
        part("C", f"The stationary cart is replaced by one with twice the mass, ${2 * m2:g}\\text{{ kg}}$. Does the fraction of the initial kinetic energy that is lost increase, decrease or stay the same? Give its new value and justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"It increases to $2m_2/(m_1+2m_2)={frac2:.3f}$, because the lost fraction $m_2/(m_1+m_2)$ increases with $m_2$.",
             [R("C1", "numeric", f"States that the lost fraction increases to about {frac2:.3f}", ["increases", f"{frac2:.3f}"], nums=True, err=["states that the fraction is unchanged"]),
              R("C2", "justification", "Justifies with $m_2/(m_1+m_2)$, which increases with $m_2$ (a heavier target makes the final speed smaller and the loss larger)", ["fraction increases with m2"], requires="C1", err=["argues only that heavier objects lose more energy"])]),
    ]
    return _pack("pcf_qqt_inelastic_collision", "qqt", "4.4", ["4.3", "3.1"], "3.B", "Perfectly inelastic collision of two carts", stim, parts, 8, 16, [f"m1={m1}", f"m2={m2}", f"v={v}", f"vf={vf:.4f}", f"frac={frac:.4f}", f"frac2={frac2:.4f}"],
                 [_ev("B", "final speed", vf, 0.01 * vf, "m/s"), _ev("C", "lost fraction", frac2, 0.01, "")],
                 ("Using conservation of momentum to justify what is and is not conserved in a perfectly inelastic collision and to predict the effect of a heavier target", ["Decide which quantities are conserved", "Derive the final speed and the lost fraction", "Predict how the lost fraction depends on the target mass"],
                  [("the track is frictionless so there is no external horizontal force on the carts", "the stimulus states a frictionless horizontal track")], {"type": "text", "must_include": ["the masses", "the initial speed"]},
                  "numpy linalg.solve of the momentum balance recomputes the final speed; the kinetic energies before and after are compared numerically"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ_D = ["pcf_mr_rod_release", "pcf_tbr_shm_phase_graphs", "pcf_lab_spring_period_k", "pcf_qqt_inelastic_collision"]
