"""AP Physics C: Mechanics — FRQ 세 번째 시나리오 4종(2026-10-20 3차 저작): MR 마찰 있는 경사면 / TBR 용수철 에너지 그래프 / LAB 원판 회전 관성 측정 / QQT 스케이터 각운동량. 유형·배점·행 구조는 physc_p0_frq.py 와 같다."""
from physc_common import *
from phys_p0_frq import R, _ev, part
from physc_p0_frq import _pack


# ======================= MR (10): 마찰 있는 경사면을 내려오는 블록 =======================
def pcf_mr_ramp_friction(rng):
    for _ in forever():
        m = pick(rng, [1.0, 2.0, 3.0]); th = pick(rng, [30, 37, 40]); d = pick(rng, [3.0, 4.0, 5.0]); mu = pick(rng, [0.15, 0.2, 0.25]); thr = math.radians(th)
        a = CG * (math.sin(thr) - mu * math.cos(thr)); v = math.sqrt(2 * a * d)
        y = rk4(lambda tt, s: np.array([s[1], a]), [0.0, 0.0], 0.0, math.sqrt(2 * d / a), 4000); agree(d, y[0], 1e-4, "d"); agree(v, y[1], 1e-4, "v")
        v2 = math.sqrt(2 * CG * d * (math.sin(thr) - 2 * mu * math.cos(thr))) if math.sin(thr) > 2 * mu * math.cos(thr) else None
        if a > 1.0 and v2:
            break
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is released from rest at the top of a rough incline that makes an angle of $\\theta={th}^\\circ$ with the horizontal. The coefficient of kinetic friction between the block and the incline is $\\mu={mu:g}$. The block slides a distance $d={d:g}\\text{{ m}}$ along the incline. Use $g=9.8\\text{{ m/s}}^2$.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents the block, draw and label the forces (not components) that act on the block while it slides down the incline. Each force must be represented by a distinct arrow starting on the dot.", 3, "diagram", ["1.A"],
             "Three arrows from the dot: weight straight down, the normal force perpendicular to the incline, and kinetic friction directed up the incline (opposite to the motion).",
             [R("A1", "diagram", "Draws and labels the weight, the normal force and the friction force, with no extra force such as a force of motion", ["weight", "normal force", "friction force"], err=["adds a force down the incline"]),
              R("A2", "diagram", "The weight points straight down and the normal force is perpendicular to the surface of the incline", ["weight down", "normal perpendicular to the incline"], err=["draws the normal force vertical"]),
              R("A3", "diagram", "The friction force points up the incline, opposite to the direction of the motion", ["friction up the incline"], err=["draws friction down the incline"])]),
        part("B", "Derive an expression for the speed $v$ of the block after it has slid the distance $d$, in terms of $g$, $d$, $\\theta$ and $\\mu$.", 3, "derive", ["2.A"],
             "$N=mg\\cos\\theta$ and $f=\\mu mg\\cos\\theta$. The work-energy theorem gives $mgd\\sin\\theta-\\mu mgd\\cos\\theta=\\tfrac12mv^2$, so $v=\\sqrt{2gd(\\sin\\theta-\\mu\\cos\\theta)}$.",
             [R("B1", "expression", "Finds the normal force $N=mg\\cos\\theta$ and the friction force $f=\\mu mg\\cos\\theta$", ["N = m g cos theta", "f = mu m g cos theta"], err=["uses N = m g"]),
              R("B2", "expression", "Applies the work-energy theorem with the work of the weight component and of friction: $mgd\\sin\\theta-fd=\\tfrac12mv^2$", ["m g d sin theta - f d = 1/2 m v^2"], requires="B1", err=["omits the work of friction"]),
              R("B3", "expression", "Solves for $v=\\sqrt{2gd(\\sin\\theta-\\mu\\cos\\theta)}$", ["sqrt(2 g d (sin theta - mu cos theta))"], requires="B2", err=["obtains $\\sqrt{2gd(\\sin\\theta+\\mu\\cos\\theta)}$"])]),
        part("C", f"Calculate the speed of the block after it has slid ${d:g}\\text{{ m}}$ for $\\theta={th}^\\circ$ and $\\mu={mu:g}$.", 2, "calculate", ["2.B"],
             f"$v=\\sqrt{{2(9.8)({d:g})(\\sin{th}^\\circ-{mu:g}\\cos{th}^\\circ)}}\\approx {v:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", "Substitutes the values into the expression from part B", ["substitution"], requires="B3", nums=True, err=["uses the cosine and the sine interchanged"]),
              R("C2", "numeric", f"Obtains about {v:.2f} with units of meters per second", [f"{v:.2f}", "m/s"], requires="C1", nums=True, units=True)]),
        part("D", f"The coefficient of kinetic friction is doubled to ${2 * mu:g}$ with everything else unchanged. Does the speed of the block after sliding ${d:g}\\text{{ m}}$ increase, decrease or stay the same, and what is its new value? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"It decreases, because a larger friction force removes more energy over the same distance: $v=\\sqrt{{2gd(\\sin\\theta-2\\mu\\cos\\theta)}}\\approx{v2:.2f}\\text{{ m/s}}$.",
             [R("D1", "numeric", f"States that the speed decreases and gives about {v2:.2f} with units of meters per second", ["decreases", f"{v2:.2f}", "m/s"], nums=True, units=True, err=["states that the speed is unchanged"]),
              R("D2", "justification", "Justifies that the work done by friction, $\\mu mgd\\cos\\theta$, is larger, so less of the gravitational energy becomes kinetic energy", ["more energy dissipated by friction"], requires="D1", err=["argues only that friction is bigger without relating it to the energy"])]),
    ]
    return _pack("pcf_mr_ramp_friction", "mr", "3.4", ["2.7", "2.2", "3.2"], "2.B", "Block sliding down a rough incline", stim, parts, 10, 22, [f"m={m}", f"th={th}", f"d={d}", f"mu={mu}", f"v={v:.4f}", f"v2={v2:.4f}"],
                 [_ev("C", "speed", v, max(0.05, 0.012 * v), "m/s"), _ev("D", "speed with doubled friction", v2, max(0.05, 0.012 * v2), "m/s")],
                 ("Work-energy theorem on a rough incline, a derivation of the final speed, and a justified prediction about the friction coefficient", ["Draw the free-body diagram of the block on the incline", "Apply the work-energy theorem with the work of the weight component and friction", "Predict the effect of doubling the coefficient of friction"],
                  [("the incline is rough with a constant coefficient of kinetic friction and air resistance is negligible", "the stimulus states the incline, the coefficient and the distance")], {"type": "text", "must_include": ["the mass", "the angle", "the distance", "the coefficient of friction"]},
                  "an RK4 integration of the constant acceleration along the incline recomputes the distance and the speed"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 용수철-블록의 에너지 그래프 =======================
def pcf_tbr_spring_energy_graph(rng):
    for _ in forever():
        k = pick(rng, [50.0, 100.0, 200.0]); m = pick(rng, [0.5, 1.0, 2.0]); A = pick(rng, [0.10, 0.20, 0.30]); E = 0.5 * k * A * A; vh = math.sqrt(k / m * (A * A - (A / 2) ** 2)); vmax = A * math.sqrt(k / m)
        agree(vh, math.sqrt(2 * (E - 0.5 * k * (A / 2) ** 2) / m), 1e-9, "vh")
        break
    stim = {"kind": "text", "description": f"A block of mass $m={m:g}\\text{{ kg}}$ is attached to a horizontal ideal spring of spring constant $k={k:g}\\text{{ N/m}}$ on a frictionless surface. The block oscillates between $x=-A$ and $x=+A$ with $A={A:g}\\text{{ m}}$, where $x=0$ is the equilibrium position. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", f"On the same axes provided, sketch the kinetic energy $K$ and the elastic potential energy $U$ of the system as functions of the position $x$ from $x=-A$ to $x=+A$. Label the total energy $E$ with its value.", 4, "graph", ["1.A", "1.C"],
             f"$U=\\tfrac12kx^2$ is an upward-opening parabola with its minimum $0$ at $x=0$ and maximum ${E:.3g}\\text{{ J}}$ at $x=\\pm A$; $K=E-U$ is a downward-opening parabola with its maximum ${E:.3g}\\text{{ J}}$ at $x=0$; the horizontal line $E={E:.3g}\\text{{ J}}$ is the sum.",
             [R("A1", "graph", "Both axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The potential energy is an upward-opening parabola that is zero at $x=0$", ["U parabola upward", "zero at x = 0"], err=["draws U as a straight line"]),
              R("A3", "graph", "The kinetic energy is a downward-opening parabola that is maximum at $x=0$ and zero at $x=\\pm A$", ["K parabola downward", "zero at the turning points"], err=["draws K with its minimum at $x=0$"]),
              R("A4", "graph", f"The total energy is shown as a horizontal line (or the intersections) labeled with a value of about ${E:.3g}\\text{{ J}}$", [f"{E:.3g}"], nums=True)]),
        part("B", "Derive an expression for the speed of the block at $x=A/2$ in terms of $m$, $k$ and $A$.", 3, "derive", ["2.A"],
             "$\\tfrac12kA^2=\\tfrac12mv^2+\\tfrac12k(A/2)^2$ so $v=\\sqrt{3k/(4m)}\\,A$.",
             [R("B1", "expression", "Writes the total energy as $\\tfrac12kA^2$ and the elastic energy at $A/2$ as $\\tfrac12k(A/2)^2$", ["1/2 k A^2", "1/2 k (A/2)^2"], err=["uses kA/2 as the energy"]),
              R("B2", "expression", "Sets the kinetic energy equal to the difference: $\\tfrac12mv^2=\\tfrac12kA^2-\\tfrac12k(A/2)^2$", ["1/2 m v^2 = 3/8 k A^2"], requires="B1", err=["sets the kinetic energy equal to the potential energy"]),
              R("B3", "expression", "Solves for $v=A\\sqrt{3k/(4m)}$", ["A sqrt(3k/(4m))"], requires="B2", err=["obtains $A\\sqrt{k/m}$, the maximum speed"])]),
        part("C", "Calculate the total energy, the speed of the block at $x=A/2$, and the maximum speed of the block.", 3, "calculate", ["2.B"],
             f"$E=\\tfrac12kA^2={E:.3g}\\text{{ J}}$, $v(A/2)\\approx{vh:.2f}\\text{{ m/s}}$ and $v_{{max}}=A\\sqrt{{k/m}}\\approx{vmax:.2f}\\text{{ m/s}}$.",
             [R("C1", "numeric", f"Calculates the total energy of about {E:.3g} with units of joules", [f"{E:.3g}", "J"], nums=True, units=True, err=["uses E = kA"]),
              R("C2", "numeric", f"Calculates the speed at $x=A/2$ of about {vh:.2f} with units of meters per second", [f"{vh:.2f}", "m/s"], requires="B3", nums=True, units=True, err=["uses the maximum speed"]),
              R("C3", "numeric", f"Calculates the maximum speed of about {vmax:.2f} with units of meters per second", [f"{vmax:.2f}", "m/s"], nums=True, units=True, err=["omits the square root"])]),
        part("D", "The amplitude is doubled with the same block and spring. Predict by what factors the total energy and the maximum speed change, and justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The total energy is multiplied by 4 and the maximum speed by 2, because $E=\\tfrac12kA^2$ and $v_{max}=A\\sqrt{k/m}$.",
             [R("D1", "numeric", "States that the total energy is multiplied by 4 and the maximum speed by 2", ["energy factor 4", "speed factor 2"], nums=True, err=["states that both double"]),
              R("D2", "justification", "Justifies with $E\\propto A^2$ and $v_{max}\\propto A$", ["E proportional to A squared", "v_max proportional to A"], requires="D1", err=["argues only that a larger amplitude means more energy"])]),
    ]
    return _pack("pcf_tbr_spring_energy_graph", "tbr", "7.4", ["3.3", "3.4", "7.2"], "1.C", "Energy graphs of a block on a spring", stim, parts, 12, 27, [f"k={k}", f"m={m}", f"A={A}", f"E={E:.4f}", f"vh={vh:.4f}", f"vmax={vmax:.4f}"],
                 [_ev("C", "total energy", E, 0.012 * E, "J"), _ev("C", "speed at A/2", vh, 0.012 * vh + 0.005, "m/s"), _ev("C", "maximum speed", vmax, 0.012 * vmax + 0.005, "m/s")],
                 ("Representing the kinetic and potential energy of an oscillator as functions of position, deriving the speed at a given position, and predicting the effect of the amplitude", ["Sketch the two energies against position", "Derive the speed at half of the amplitude from the energy balance", "Predict the effect of the amplitude on the energy and the maximum speed"],
                  [("the surface is frictionless and the spring is ideal so the total energy is constant", "the stimulus states a frictionless surface and an ideal spring")], {"type": "text", "must_include": ["the mass", "the spring constant", "the amplitude"]},
                  "the energies and the speeds are recomputed numerically from the closed forms"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 낙하하는 질량으로 원판의 회전 관성 측정 =======================
def pcf_lab_disk_inertia(rng):
    ms = [0.05, 0.10, 0.15, 0.20, 0.25]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); Md = pick(rng, [1.0, 1.5, 2.0]); Rd = 0.10; I_true = 0.5 * Md * Rd * Rd
        accs = [round(m * CG / (m + I_true / Rd ** 2) * (1 + r2.uniform(-0.015, 0.015)), 3) for m in ms]
        x = [1 / m for m in ms]; y = [1 / a for a in accs]; slope, icpt = np.polyfit(x, y, 1); Xn = np.array([[xx, 1.0] for xx in x]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(y)); agree(slope, beta[0], 1e-9, "slope")
        I_est = slope * CG * Rd ** 2
        if abs(I_est - I_true) / I_true < 0.08 and abs(icpt * CG - 1) < 0.1:
            break
    stim = {"kind": "table", "description": f"A student wraps a light string around the rim of a horizontal disk of radius R = {Rd:g} m that rotates on a frictionless axle. A mass m hangs from the string and is released from rest. The student measures the acceleration a of the hanging mass for several values of m and wants to determine the rotational inertia I of the disk. Assume the string does not slip.", "data": {"x_label": "Hanging mass m (kg)", "y_label": "Acceleration of the hanging mass a (m/s^2)", "rows": [[m, a] for m, a in zip(ms, accs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the acceleration as a function of the hanging mass. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the measured acceleration.", 3, "design", ["3.A", "2.B"],
             "Measure each hanging mass with a balance; release it from rest and measure the distance it falls with a meterstick and the fall time with a stopwatch (or a photogate) to find $a=2h/t^2$; change only the hanging mass with the same disk, string and release height; reduce the uncertainty by repeating each release and averaging the times or by using a larger fall height.",
             [R("A1", "design", "Identifies how the mass is measured and how the acceleration is found (fall distance and time, with $a=2h/t^2$)", ["a way to measure the mass and a way to find the acceleration"], err=["omits how the acceleration is found"]),
              R("A2", "design", "Changes only the hanging mass while using the same disk, string and release height (all three must be controlled)", ["change only the mass and keep the disk, string and height"]),
              R("A3", "design", "Reduces the uncertainty by repeating each release and averaging, or by using a larger fall height or a photogate (any one earns the point)", ["repeat and average or larger height or photogate (any one earns the point)"])]),
        part("B", "For the system, $a=\\dfrac{mg}{m+I/R^2}$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to find $I$.", 1, "explain", ["2.B", "3.A"],
             "$1/a=\\dfrac1g+\\dfrac{I}{gR^2}\\cdot\\dfrac1m$: plot $1/a$ on the vertical axis against $1/m$ on the horizontal axis; the slope is $I/(gR^2)$ and the intercept is $1/g$.",
             [R("B1", "expression", "Identifies $1/a$ (vertical) versus $1/m$ (horizontal)", ["1/a versus 1/m"], err=["plots a versus m"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in a form that gives a straight line, and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(1/m, 1/a)$: {', '.join(f'({xx:.1f}, {yy:.3f})' for xx, yy in zip(x, y))} with a best-fit line of slope about ${slope:.3f}\\text{{ kg·s}}^2\\text{{/m}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(1/m, 1/a)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the rotational inertia $I$ of the disk. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $I/(gR^2)\\approx{slope:.3f}$ in SI units, so $I=\\text{{slope}}\\cdot gR^2\\approx{I_est:.4f}\\text{{ kg·m}}^2$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.3f}; accept any value within 8 percent)", [f"{slope:.3f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to the rotational inertia: slope $=I/(gR^2)$ so $I=\\text{slope}\\cdot gR^2$", ["I = slope g R^2"], err=["uses $I=\\text{slope}/(gR^2)$"]),
              R("D3", "numeric", f"Obtains $I$ of about {I_est:.4f} with units of kg·m^2 (accept any value consistent with the student's own slope from D1)", [f"{I_est:.4f}", "kg m^2"], alt=["a value of I consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pcf_lab_disk_inertia", "lab", "5.6", ["5.4", "2.5"], "3.A", "Experiment: rotational inertia of a disk from a falling mass", stim, parts, 10, 27, [f"Md={Md}", f"Rd={Rd}", f"slope={slope:.5f}", f"I_est={I_est:.5f}", f"accs={accs}"],
                 [_ev("D", "slope", slope, 0.08 * slope, "kg s^2/m"), _ev("D", "rotational inertia", I_est, 0.08 * I_est, "kg m^2")],
                 ("Designing an experiment and analyzing linearized data to extract the rotational inertia of a disk from the acceleration of a falling mass", ["Describe the measurements and how the acceleration is found", "Linearize $a=mg/(m+I/R^2)$ as $1/a$ versus $1/m$ and plot the data", "Use the slope to determine the rotational inertia"],
                  [("the generated accelerations follow $a=mg/(m+I/R^2)$ with a small random error so the fitted inertia is within eight percent of the generating value", "the code rejects a seed whose fitted inertia differs from the generating value by more than eight percent")], {"type": "table", "must_include": ["hanging mass", "acceleration"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted inertia is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 팔을 당기는 스케이터 =======================
def pcf_qqt_skater(rng):
    for _ in forever():
        Ii = pick(rng, [3.0, 4.0, 5.0]); k = pick(rng, [2.0, 2.5, 3.0]); If = Ii / k; wi = pick(rng, [1.5, 2.0, 3.0]); wf = Ii * wi / If; Ki = 0.5 * Ii * wi ** 2; Kf = 0.5 * If * wf ** 2
        agree(Kf / Ki, k, 1e-9, "Kratio"); agree(wf, k * wi, 1e-9, "wf")
        break
    stim = {"kind": "text", "description": f"A figure skater spins about a vertical axis on frictionless ice with her arms extended. Her rotational inertia is $I_i={Ii:g}\\text{{ kg·m}}^2$ and her angular speed is $\\omega_i={wi:g}\\text{{ rad/s}}$. She then pulls her arms in so that her rotational inertia becomes $I_f={If:.3g}\\text{{ kg·m}}^2$.", "data": {}}
    parts = [
        part("A", "A student claims that the kinetic energy of the skater does not change when she pulls her arms in, because angular momentum is conserved. Do you agree or disagree with the claim? Justify your answer.", 3, "explain", ["3.B", "3.C"],
             "Disagree. Angular momentum is conserved because no external torque acts, but the rotational kinetic energy $K=L^2/(2I)$ increases when $I$ decreases at constant $L$; the energy comes from the work done by the skater's muscles.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees because both are conserved"]),
              R("A2", "justification", "Justifies that angular momentum is conserved because there is no external torque, which does not imply that the kinetic energy is conserved", ["no external torque so L is conserved", "K is not necessarily conserved"], err=["says that both quantities are conserved in every interaction"]),
              R("A3", "justification", "Justifies with $K=L^2/(2I)$, which increases when $I$ decreases, with the energy supplied by the work done by her muscles", ["K = L^2 / (2 I) increases", "work done by the skater"], requires="A2", err=["says the energy is lost to friction"])]),
        part("B", "Derive an expression for the final angular speed $\\omega_f$ in terms of $I_i$, $I_f$ and $\\omega_i$, and calculate its value.", 3, "derive", ["2.A", "2.B"],
             f"$I_i\\omega_i=I_f\\omega_f$ gives $\\omega_f=I_i\\omega_i/I_f={wf:.2f}\\text{{ rad/s}}$.",
             [R("B1", "expression", "Applies conservation of angular momentum: $I_i\\omega_i=I_f\\omega_f$", ["I_i omega_i = I_f omega_f"], err=["conserves the kinetic energy instead"]),
              R("B2", "expression", "Solves for $\\omega_f=I_i\\omega_i/I_f$", ["omega_f = I_i omega_i / I_f"], requires="B1", err=["inverts the ratio of the rotational inertias"]),
              R("B3", "numeric", f"Calculates $\\omega_f$ of about {wf:.2f} with units of radians per second", [f"{wf:.2f}", "rad/s"], requires="B2", nums=True, units=True)]),
        part("C", "Calculate the ratio of her final rotational kinetic energy to her initial rotational kinetic energy, and state which agent does the work that changes the energy.", 2, "calculate", ["2.B", "3.B"],
             f"$K_f/K_i=(\\tfrac12I_f\\omega_f^2)/(\\tfrac12I_i\\omega_i^2)=I_i/I_f={Kf / Ki:.2f}$; the extra energy comes from the work done by the skater's muscles in pulling the arms inward.",
             [R("C1", "numeric", f"Calculates a kinetic energy ratio of about {Kf / Ki:.2f}", [f"{Kf / Ki:.2f}"], nums=True, err=["gives a ratio less than one"]),
              R("C2", "claim", "States that the work is done by the skater (her muscles) as she pulls the arms inward against the needed centripetal force", ["work done by the skater's muscles"], requires="C1", err=["attributes the energy to the ice"])]),
    ]
    return _pack("pcf_qqt_skater", "qqt", "6.4", ["6.1", "5.4"], "3.B", "Skater pulling in her arms", stim, parts, 8, 16, [f"Ii={Ii}", f"If={If:.4f}", f"wi={wi}", f"wf={wf:.4f}", f"Kratio={Kf / Ki:.4f}"],
                 [_ev("B", "final angular speed", wf, 0.01 * wf, "rad/s"), _ev("C", "kinetic energy ratio", Kf / Ki, 0.01 * Kf / Ki, "")],
                 ("Using conservation of angular momentum to derive the final angular speed and showing that the kinetic energy is not conserved", ["Identify the conserved quantity and the one that is not", "Derive the final angular speed from conservation of angular momentum", "Compare the kinetic energies and identify the source of the extra energy"],
                  [("there is no external torque about the vertical axis so the angular momentum is conserved", "the stimulus states frictionless ice and a vertical axis")], {"type": "text", "must_include": ["the rotational inertias", "the initial angular speed"]},
                  "the angular momentum and the kinetic energies are recomputed numerically before and after"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ_C = ["pcf_mr_ramp_friction", "pcf_tbr_spring_energy_graph", "pcf_lab_disk_inertia", "pcf_qqt_skater"]
