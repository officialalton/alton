"""AP Physics C: Electricity and Magnetism — FRQ 원형 3차 저작(유형마다 1개 더: MR·TBR·LAB·QQT)."""
from physe_common import *
from phys_p0_frq import R, _ev, part, REF_NOTE
from physe_p0_frq import _pack, KP


# ======================= MR (10): 유전체를 넣은 평행판 축전기 =======================
def pef_mr_capacitor_dielectric(rng):
    for _ in forever():
        Acm = pick(rng, [100.0, 200.0, 400.0]); dmm = pick(rng, [1.0, 2.0, 4.0]); kap = pick(rng, [2.0, 3.0, 4.0, 5.0]); V = pick(rng, [12.0, 24.0, 50.0])
        C0 = EPS0 * Acm * 1e-4 / (dmm * 1e-3); C = kap * C0; U = 0.5 * C * V * V; U0 = 0.5 * C0 * V * V
        E0 = V / (dmm * 1e-3); Ed = E0 / kap
        break
    stim = {"kind": "text", "description": f"An air-filled parallel-plate capacitor has square plates of area $A={Acm:g}\\text{{ cm}}^{{2}}$ separated by $d={dmm:g}\\text{{ mm}}$. It is charged by a ${V:g}\\text{{ V}}$ battery and the battery is then disconnected. A dielectric slab of constant $\\kappa={kap:g}$ that completely fills the gap is then inserted. Use {KP.replace('k=9.0', 'k=9.0')} and $\\varepsilon_0=8.85\\times10^{{-12}}\\text{{ F/m}}$.", "data": {}}
    parts = [
        part("A", "Draw a diagram of the capacitor in cross-section (two parallel plates, the top plate positive) and draw several electric field lines in the gap before the dielectric is inserted, marking the direction of the field. Then state how the density of the field lines in the gap should change after the dielectric is inserted.", 3, "diagram", ["1.A"],
             "Straight, evenly spaced field lines from the positive plate to the negative plate, perpendicular to the plates and pointing downward; after insertion the field in the gap is weaker (fewer lines per area) because the charge on the plates is unchanged.",
             [R("A1", "diagram", "Draws parallel field lines perpendicular to the plates, evenly spaced", ["parallel evenly spaced lines"], err=["draws curved lines in the middle of the gap"]),
              R("A2", "diagram", "Marks the direction from the positive plate to the negative plate (downward)", ["direction from positive to negative"], err=["draws the arrows toward the positive plate"]),
              R("A3", "diagram", "States that the field in the gap becomes weaker (lines less dense) after the dielectric is inserted", ["weaker field with the dielectric"], requires="A1", err=["states that the field becomes stronger"])]),
        part("B", "Derive an expression for the capacitance $C$ with the dielectric in place and for the energy $U$ stored in the capacitor after the battery is disconnected and the dielectric inserted, in terms of $\\kappa$, $\\varepsilon_0$, $A$, $d$ and the initial voltage $V_0$.", 3, "derive", ["2.A"],
             "$C=\\kappa\\varepsilon_0A/d$; the charge $Q=C_0V_0=\\varepsilon_0AV_0/d$ is unchanged, so $U=Q^2/(2C)=\\dfrac{\\varepsilon_0AV_0^2}{2\\kappa d}$.",
             [R("B1", "expression", "Writes $C=\\kappa\\varepsilon_0A/d$ with the dielectric", ["kappa epsilon_0 A / d"], err=["divides by $\\kappa$"]),
              R("B2", "expression", "Notes that the charge is unchanged, $Q=C_0V_0$ with $C_0=\\varepsilon_0A/d$", ["Q = C0 V0"], requires="B1", err=["keeps the voltage fixed"]),
              R("B3", "expression", "Obtains $U=Q^2/(2C)=\\varepsilon_0AV_0^2/(2\\kappa d)$", ["epsilon_0 A V0^2 / (2 kappa d)"], requires="B2", err=["obtains $\\kappa\\varepsilon_0AV_0^2/(2d)$"])]),
        part("C", "Calculate the capacitance with the dielectric in place, in picofarads, and the energy stored after the insertion, in nanojoules.", 2, "calculate", ["2.B"],
             f"$C=\\kappa\\varepsilon_0A/d\\approx{C * 1e12:.0f}\\text{{ pF}}$ and $U=\\dfrac{{\\varepsilon_0AV_0^2}}{{2\\kappa d}}\\approx{U0 / kap * 1e9:.2f}\\text{{ nJ}}$.",
             [R("C1", "numeric", f"Calculates $C$ of about {C * 1e12:.0f} with units of picofarads (accept any value within 2 percent)", [f"{C * 1e12:.0f}", "pF"], requires="B1", nums=True, units=True, err=["leaves the area in square centimeters"]),
              R("C2", "numeric", f"Calculates $U$ of about {U0 / kap * 1e9:.2f} with units of nanojoules", [f"{U0 / kap * 1e9:.2f}", "nJ"], requires="B3", nums=True, units=True)]),
        part("D", "How does the electric field in the gap after the insertion compare with the field before it? Calculate the ratio and justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The field is reduced to $1/\\kappa={1 / kap:.3f}$ of its original value (from ${E0:.0f}\\text{{ V/m}}$ to ${Ed:.0f}\\text{{ V/m}}$), because the free charge on the plates is unchanged while the dielectric's induced charge partly cancels the field.",
             [R("D1", "numeric", f"States that the field is smaller by the factor $1/\\kappa$ (about {1 / kap:.3f})", [f"{1 / kap:.3f}", "decreases"], nums=True, err=["states that the field is unchanged because the charge is unchanged", "states that the field is multiplied by $\\kappa$"]),
              R("D2", "justification", "Justifies with $E=\\sigma/(\\kappa\\varepsilon_0)$ at fixed free charge density, or with $E=V/d$ and $V=Q/C$ falling by $\\kappa$", ["E = sigma/(kappa epsilon_0)"], requires="D1", err=["argues only that the dielectric blocks the field without a quantitative relation"])]),
    ]
    return _pack("pef_mr_capacitor_dielectric", "mr", "10.4", ["10.3", "8.6"], "2.A", "Inserting a dielectric into a charged, isolated capacitor", stim, parts, 10, 22, [f"Acm={Acm}", f"dmm={dmm}", f"kap={kap}", f"V={V}", f"C={C * 1e12:.4f}", f"U={U0 / kap * 1e9:.4f}"],
                 [_ev("C", "capacitance", C * 1e12, 0.02 * C * 1e12 + 0.5, "pF"), _ev("C", "stored energy", U0 / kap * 1e9, 0.02 * U0 / kap * 1e9 + 0.01, "nJ")],
                 ("Representing the field in a capacitor, deriving the capacitance and the stored energy after inserting a dielectric into an isolated capacitor, and predicting the change of the field", ["Draw the field lines and describe their change", "Derive the capacitance and the energy at fixed charge", "Calculate the values and compare the fields"],
                  [("the capacitor is isolated after charging so the free charge is constant", "the stimulus states that the battery is disconnected before the insertion")], {"type": "text", "must_include": ["the plate area", "the separation", "the dielectric constant", "the initial voltage"]},
                  "the capacitance and the stored energy are recomputed from $Q=C_0V_0$ and $U=Q^2/(2C)$; the field ratio follows from the closed form"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 고리 축 위 전위 그래프 =======================
def pef_tbr_ring_potential(rng):
    for _ in forever():
        Rc = pick(rng, [10.0, 20.0]); Qn = pick(rng, [4.0, 6.0, 8.0, 12.0]); Rm = Rc * 1e-2
        V0 = K * Qn * 1e-9 / Rm; Vx = K * Qn * 1e-9 / math.sqrt(Rm ** 2 + Rm ** 2)
        Ex = K * Qn * 1e-9 * Rm / (2 * Rm ** 2) ** 1.5
        xs = np.linspace(0.5 * Rm, 1.5 * Rm, 2001); Vs = K * Qn * 1e-9 / np.sqrt(xs ** 2 + Rm ** 2); Ed = -float(np.gradient(Vs, xs)[1000])
        agree(Ex, Ed, 2e-3, "E")
        break
    stim = {"kind": "text", "description": f"A thin ring of radius $R={Rc:g}\\text{{ cm}}$ carries a uniform charge $Q={Qn:g}\\text{{ nC}}$ and lies in the plane $x=0$ with its center at the origin, so the $x$-axis is its axis. Use {KP}. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the electric potential $V$ on the axis as a function of $x$ for $-3R\\le x\\le3R$ (zero potential at infinity). Label the value of the potential at $x=0$ and at $x=R$ in terms of $k$, $Q$ and $R$.", 4, "graph", ["1.C", "1.B"],
             "A symmetric bell-shaped curve with its maximum $kQ/R$ at $x=0$, falling to $kQ/(\\sqrt2R)$ at $x=\\pm R$ and approaching zero for large $|x|$, always positive.",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The curve is symmetric about $x=0$ with its maximum at the origin, labeled $kQ/R$", ["maximum at the origin", "kQ/R"], err=["draws a minimum at the origin"]),
              R("A3", "graph", "Labels the value $kQ/(\\sqrt2R)$ at $x=\\pm R$", ["kQ/(sqrt(2) R)"], requires="A2", err=["labels $kQ/(2R)$"]),
              R("A4", "graph", "The curve stays positive and approaches zero at large $|x|$", ["positive, tends to zero"], err=["draws a curve that crosses zero"])]),
        part("B", "Derive an expression for the electric potential at a point on the axis a distance $x$ from the center in terms of $k$, $Q$, $R$ and $x$.", 3, "derive", ["2.A"],
             "Every element of charge $dq$ is the same distance $\\sqrt{x^2+R^2}$ from the point, so $V=\\int\\dfrac{k\\,dq}{\\sqrt{x^2+R^2}}=\\dfrac{kQ}{\\sqrt{x^2+R^2}}$.",
             [R("B1", "expression", "Writes the potential of a charge element, $dV=k\\,dq/\\sqrt{x^2+R^2}$", ["k dq / sqrt(x^2 + R^2)"], err=["uses $k\\,dq/(x^2+R^2)$"]),
              R("B2", "expression", "Recognizes that the distance is the same for all elements, so the integral is just $\\int dq=Q$", ["same distance, integral of dq equals Q"], requires="B1", err=["inserts an angle dependence"]),
              R("B3", "expression", "Obtains $V=kQ/\\sqrt{x^2+R^2}$", ["k Q / sqrt(x^2 + R^2)"], requires="B2", err=["obtains $kQx/(x^2+R^2)^{3/2}$"])]),
        part("C", "Use the potential to find the magnitude of the electric field on the axis at $x=R$, and calculate its value.", 3, "calculate", ["2.A", "2.B"],
             f"$E_x=-dV/dx=kQx/(x^2+R^2)^{{3/2}}$, which at $x=R$ is $kQ/(2^{{3/2}}R^2)\\approx{Ex:.0f}\\text{{ N/C}}$.",
             [R("C1", "expression", "Uses $E_x=-dV/dx$ and differentiates $V$", ["E = -dV/dx"], requires="B3", err=["integrates instead of differentiating"]),
              R("C2", "expression", "Obtains $E_x=kQx/(x^2+R^2)^{3/2}$", ["k Q x / (x^2 + R^2)^(3/2)"], requires="C1", err=["omits the factor $x$ in the numerator"]),
              R("C3", "numeric", f"Calculates the field at $x=R$ of about {Ex:.0f} with units of newtons per coulomb (accept any value within 2 percent)", [f"{Ex:.0f}", "N/C"], requires="C2", nums=True, units=True)]),
        part("D", "A charged ring of twice the radius and the same total charge is used. By what factor does the potential at the center change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The potential at the center is $kQ/R$, so doubling the radius at fixed charge halves it (from ${V0:.0f}\\text{{ V}}$ to ${V0 / 2:.0f}\\text{{ V}}$), because every charge element is twice as far from the center.",
             [R("D1", "numeric", "States that the potential at the center is halved (factor 0.5)", ["0.5", "halved"], nums=True, err=["states that it is quartered", "states that it is unchanged because the charge is the same"]),
              R("D2", "justification", "Justifies with $V=kQ/R$ at the center (proportional to $1/R$ at fixed $Q$)", ["V = kQ/R"], requires="D1", err=["argues with the $1/r^2$ field law"])]),
    ]
    return _pack("pef_tbr_ring_potential", "tbr", "9.2", ["8.4", "8.3"], "1.C", "Potential on the axis of a charged ring", stim, parts, 12, 27, [f"Rc={Rc}", f"Qn={Qn}", f"V0={V0:.4f}", f"Vx={Vx:.4f}", f"Ex={Ex:.4f}"],
                 [_ev("A", "potential at the center", V0, 0.02 * V0 + 0.5, "V"), _ev("C", "field at x = R", Ex, 0.02 * Ex + 1.0, "N/C")],
                 ("Sketching the axial potential of a ring, deriving it by integrating over elements, obtaining the field as the negative gradient, and predicting the scaling with the radius", ["Sketch V(x) with the labeled values", "Derive the axial potential", "Differentiate for the field", "Predict the effect of doubling the radius"],
                  [("the ring is uniformly charged and isolated in vacuum", "the stimulus states a uniform charge in vacuum")], {"type": "text", "must_include": ["the ring radius", "the total charge"]},
                  "sympy differentiates the potential; a numerical gradient of the potential recomputes the field"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): RL 회로의 감쇠로 인덕턴스 측정 =======================
def pef_lab_rl_decay(rng):
    ts = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); Rr = pick(rng, [50.0, 100.0, 200.0]); L = pick(rng, [0.1, 0.2, 0.4]); I0 = pick(rng, [50.0, 100.0])
        tau = L / Rr * 1e3  # ms
        if tau < 2.0 or tau >= 40:
            continue
        Is = [round(I0 * math.exp(-t / tau) * (1 + r2.uniform(-0.02, 0.02)), 3) for t in ts]
        lnI = [math.log(i) for i in Is]; slope, icpt = np.polyfit(ts, lnI, 1); Xn = np.array([[t, 1.0] for t in ts]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(lnI)); agree(slope, beta[0], 1e-9, "slope")
        L_est = -Rr / (slope * 1e3)
        if abs(L_est - L) / L < 0.08 and 2.0 <= tau < 40:
            break
    stim = {"kind": "table", "description": f"A student connects an ideal inductor of unknown inductance L in series with a resistor of resistance R = {Rr:g} Ω and a battery. After the current has reached a steady value, the battery is replaced by a short wire so that the current decays through the inductor and the resistor. A current sensor records the current I at intervals of 2 ms after the switch is thrown.", "data": {"x_label": "Time t (ms)", "y_label": "Current I (mA)", "rows": [[t, i_] for t, i_ in zip(ts, Is)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the current as a function of time. Include the equipment and the measurements, how the decay is started, and one way to reduce the uncertainty in the current readings.", 3, "design", ["3.A", "2.B"],
             "Build a series circuit of the inductor, the known resistor, a battery and a switch with a current sensor (or a voltmeter across the resistor and a data logger); close the switch for a long time, then switch the battery out of the circuit so the current decays; record the current at fixed time intervals with the data logger; repeat the decay several times and average the readings.",
             [R("A1", "design", "Identifies the circuit (inductor, known resistor, source and switch) and a way to measure the current with time (a current sensor or a voltmeter across $R$ and a data logger)", ["circuit and a time-resolved current measurement"], err=["omits how the time is recorded"]),
              R("A2", "design", "Starts the decay from a steady current (switch closed for a long time) and then removes the battery, keeping $R$ and $L$ the same", ["steady current first, then decay"]),
              R("A3", "design", "Reduces the uncertainty by repeating the decay and averaging, or by using a data logger with a high sampling rate (any one earns the point)", ["repeat and average or high-rate data logger (any one earns the point)"])]),
        part("B", "For the decaying current $I=I_0e^{-Rt/L}$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to determine $L$.", 1, "explain", ["2.B", "3.A"],
             "Taking the natural logarithm gives $\\ln I=\\ln I_0-(R/L)t$: plot $\\ln I$ on the vertical axis against $t$ on the horizontal axis; the slope is $-R/L$.",
             [R("B1", "expression", "Identifies $\\ln I$ (vertical) versus $t$ (horizontal), with slope $-R/L$", ["ln I versus t"], err=["plots I versus t"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in the form identified in part B and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(t,\\ln I)$: {', '.join(f'({t:g}, {li:.3f})' for t, li in zip(ts, lnI))} with a best-fit line of slope about ${slope:.4f}\\text{{ ms}}^{{-1}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the six points $(t,\\ln I)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line with a negative slope through the trend of the points", ["best-fit line with negative slope"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the inductance $L$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $-R/L\\approx{slope:.4f}\\text{{ ms}}^{{-1}}={slope * 1e3:.1f}\\text{{ s}}^{{-1}}$, so $L=-R/\\text{{slope}}\\approx{L_est:.3f}\\text{{ H}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.4f} per millisecond; accept any value within 5 percent)", [f"{slope:.4f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $L$: $L=-R/\\text{slope}$ (with the time converted to seconds)", ["L = -R / slope"], err=["uses $L=-\\text{slope}\\cdot R$"]),
              R("D3", "numeric", f"Obtains $L$ of about {L_est:.3f} with units of henries (accept any value consistent with the student's own slope from D1)", [f"{L_est:.3f}", "H"], alt=["a value of L consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pef_lab_rl_decay", "lab", "13.5", ["13.4", "11.3"], "3.A", "Experiment: inductance from the decay of current in an RL circuit", stim, parts, 10, 27, [f"Rr={Rr}", f"L={L}", f"I0={I0}", f"slope={slope:.6f}", f"L_est={L_est:.5f}", f"Is={Is}"],
                 [_ev("D", "slope of ln I versus t", slope, 0.05 * abs(slope), "1/ms"), _ev("D", "inductance", L_est, 0.08 * L, "H")],
                 ("Designing an experiment and linearizing the exponential decay of the current in an RL circuit to extract the inductance from the slope of ln I versus t", ["Describe the circuit and the current readings at known times", "Linearize $I=I_0e^{-Rt/L}$ with a logarithm and plot the data", "Use the slope and the resistance to determine the inductance"],
                  [("the generated currents follow $I=I_0e^{-Rt/L}$ with a small random error so the fitted inductance is within eight percent of the generating value", "the code rejects a seed whose fitted inductance differs from the generating value by more than eight percent")], {"type": "table", "must_include": ["time", "current"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted inductance is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 균일한 자기장 속 양성자의 운동 =======================
def pef_qqt_proton_field(rng):
    for _ in forever():
        v = pick(rng, [2.0, 4.0, 5.0]) * 1e5; B = pick(rng, [0.10, 0.20, 0.50]); r = MP * v / (QE * B); r2 = MP * v / (QE * 2 * B)
        y = rk4(lambda t0, s: np.array([s[2], s[3], QE * B / MP * s[3], -QE * B / MP * s[2]]), [0.0, 0.0, v, 0.0], 0.0, math.pi * MP / (QE * B), 4000); agree(r, abs(y[1]) / 2, 1e-4, "r")
        break
    stim = {"kind": "text", "description": f"A proton moves with speed $v={v / 1e5:g}\\times10^{{5}}\\text{{ m/s}}$ in a plane perpendicular to a uniform magnetic field of magnitude $B={B:g}\\text{{ T}}$ and follows a circular path. Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_p=1.67\\times10^{{-27}}\\text{{ kg}}$.", "data": {}}
    parts = [
        part("A", "A student claims that the magnetic force on the proton increases its kinetic energy as it goes around the circle. Do you agree or disagree with the claim? Justify your answer using the direction of the force.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The magnetic force is always perpendicular to the velocity, so it does no work on the proton and its speed and kinetic energy stay constant; it only changes the direction of the velocity.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees because the force acts on the proton all the time"]),
              R("A2", "justification", "Justifies that the magnetic force is perpendicular to the velocity at every instant", ["force perpendicular to velocity"], err=["says the force is parallel to the velocity"]),
              R("A3", "justification", "Concludes that the force does no work, so the kinetic energy and the speed are constant", ["no work, constant speed"], requires="A2", err=["says the speed changes while the direction stays fixed"])]),
        part("B", "Derive an expression for the radius of the circular path in terms of $m_p$, $v$, $e$ and $B$, and calculate its value.", 3, "derive", ["2.A", "2.B"],
             f"The magnetic force supplies the centripetal force: $evB=m_pv^2/r$, so $r=m_pv/(eB)\\approx{r * 100:.3f}\\text{{ cm}}$.",
             [R("B1", "expression", "Sets the magnetic force $evB$ equal to the centripetal force $m_pv^2/r$", ["e v B = m v^2 / r"], err=["sets the force equal to $m_pv/r$"]),
              R("B2", "expression", "Solves for $r=m_pv/(eB)$", ["m v / (e B)"], requires="B1", err=["obtains $r=eB/(m_pv)$"]),
              R("B3", "numeric", f"Calculates $r$ of about {r * 100:.3f} with units of centimeters (accept any value within 2 percent)", [f"{r * 100:.3f}", "cm"], requires="B2", nums=True, units=True)]),
        part("C", "The magnitude of the magnetic field is doubled. Predict the factor by which the radius changes and justify your prediction.", 2, "explain", ["2.D", "3.B"],
             f"The radius is halved (to about ${r2 * 100:.3f}\\text{{ cm}}$), because $r\\propto1/B$ at fixed speed.",
             [R("C1", "numeric", "States that the radius is halved (factor 0.5)", ["halved", "0.5"], nums=True, err=["states that the radius is doubled", "states that the radius is unchanged"]),
              R("C2", "justification", "Justifies with $r=m_pv/(eB)$ (inversely proportional to $B$)", ["r proportional to 1/B"], requires="C1", err=["argues only that a stronger field bends the path more without the relation"])]),
    ]
    return _pack("pef_qqt_proton_field", "qqt", "12.2", ["12.1", "11.1"], "3.B", "Proton in a uniform magnetic field", stim, parts, 8, 16, [f"v={v}", f"B={B}", f"r={r:.6f}", f"r2={r2:.6f}"],
                 [_ev("B", "radius", r * 100, 0.02 * r * 100 + 0.001, "cm")],
                 ("Using the direction of the magnetic force to argue that it does no work, deriving the radius of the circular path, and predicting its dependence on the field", ["Decide whether the magnetic force changes the kinetic energy", "Derive the radius from the centripetal condition", "Predict the effect of doubling the field"],
                  [("the field is uniform and the motion is in the plane perpendicular to it", "the stimulus states a uniform field and planar motion")], {"type": "text", "must_include": ["the speed", "the field"]},
                  "an RK4 integration of the equation of motion recomputes the diameter of the circular path"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ_C = ["pef_mr_capacitor_dielectric", "pef_tbr_ring_potential", "pef_lab_rl_decay", "pef_qqt_proton_field"]
