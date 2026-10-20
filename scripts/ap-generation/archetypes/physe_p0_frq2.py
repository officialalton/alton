"""AP Physics C: Electricity and Magnetism — FRQ 원형 2차 저작(유형마다 2개 더: MR 2·TBR 2·LAB 2·QQT 2)."""
from physe_common import *
from phys_p0_frq import R, _ev, part, REF_NOTE
from physe_p0_frq import _pack, KP

t_ = sp.symbols("t", positive=True)
MUP = "$\\mu_0=4\\pi\\times10^{-7}\\text{ T}\\cdot\\text{m/A}$"


# ======================= MR (10): 두 전지와 세 저항 =======================
def pef_mr_kirchhoff(rng):
    for _ in forever():
        e1 = pick(rng, [12.0, 18.0, 24.0]); e2 = pick(rng, [6.0, 9.0, 12.0]); R1 = pick(rng, [2.0, 3.0, 6.0]); R2 = pick(rng, [2.0, 4.0, 6.0]); R3 = pick(rng, [3.0, 4.0, 6.0])
        A = np.array([[R1, 0.0, R3], [0.0, R2, R3], [1.0, 1.0, -1.0]]); s = np.linalg.solve(A, np.array([e1, e2, 0.0])); I1, I2, I3 = float(s[0]), float(s[1]), float(s[2])
        I3s = (e1 * R2 + e2 * R1) / (R1 * R2 + R1 * R3 + R2 * R3); agree(I3, I3s, 1e-9, "I3")
        P3 = I3 * I3 * R3
        if I1 > 0 and I2 > 0 and I3 > 0.5:
            break
    stim = {"kind": "text", "description": f"Two batteries of emfs $\\varepsilon_1={e1:g}\\text{{ V}}$ and $\\varepsilon_2={e2:g}\\text{{ V}}$ with negligible internal resistance have their positive terminals connected to the same wire (the top wire) and their negative terminals connected to the bottom wire. Battery 1 is in series with $R_1={R1:g}\\,\\Omega$ and battery 2 is in series with $R_2={R2:g}\\,\\Omega$ in separate branches, and a resistor $R_3={R3:g}\\,\\Omega$ connects the top wire to the bottom wire.", "data": {}}
    parts = [
        part("A", "Draw a schematic diagram of the circuit and label the three branch currents $I_1$ (through battery 1), $I_2$ (through battery 2) and $I_3$ (through $R_3$) with arrows showing the directions in which they flow.", 3, "diagram", ["1.A"],
             "Three branches in parallel between the top and bottom wires; $I_1$ and $I_2$ leave the positive terminals toward the top wire and $I_3$ flows from the top wire through $R_3$ to the bottom wire.",
             [R("A1", "diagram", "Draws three parallel branches (battery 1 with $R_1$, battery 2 with $R_2$, and $R_3$) joined at a top and a bottom wire", ["three parallel branches"], err=["draws all elements in series"]),
              R("A2", "diagram", "Marks the polarity of both batteries with the positive terminals on the top wire", ["battery polarities"], err=["reverses the polarity of one battery"]),
              R("A3", "diagram", "Labels $I_1$, $I_2$ and $I_3$ with arrows toward the top wire for $I_1$ and $I_2$ and downward through $R_3$ for $I_3$", ["current labels and arrows"], requires="A1", err=["draws $I_3$ upward through $R_3$"])]),
        part("B", "Use Kirchhoff's rules to derive an expression for the current $I_3$ in $R_3$ in terms of $\\varepsilon_1$, $\\varepsilon_2$, $R_1$, $R_2$ and $R_3$.", 3, "derive", ["2.A"],
             "The junction rule gives $I_3=I_1+I_2$ and the loop rules give $\\varepsilon_1-I_1R_1-I_3R_3=0$ and $\\varepsilon_2-I_2R_2-I_3R_3=0$; eliminating $I_1$ and $I_2$ gives $I_3=\\dfrac{\\varepsilon_1R_2+\\varepsilon_2R_1}{R_1R_2+R_1R_3+R_2R_3}$.",
             [R("B1", "expression", "Writes the junction rule $I_3=I_1+I_2$", ["I3 = I1 + I2"], err=["writes $I_3=I_1-I_2$ for the stated directions"]),
              R("B2", "expression", "Writes a correct loop equation for each battery loop, for example $\\varepsilon_1-I_1R_1-I_3R_3=0$ and $\\varepsilon_2-I_2R_2-I_3R_3=0$", ["two loop equations"], err=["omits the voltage drop across $R_3$ in one loop"]),
              R("B3", "expression", "Eliminates $I_1$ and $I_2$ to obtain $I_3=(\\varepsilon_1R_2+\\varepsilon_2R_1)/(R_1R_2+R_1R_3+R_2R_3)$", ["(e1 R2 + e2 R1) / (R1 R2 + R1 R3 + R2 R3)"], requires="B2", err=["algebra error in the elimination"])]),
        part("C", "Calculate the current in $R_3$ and the power dissipated in $R_3$ for the given values.", 2, "calculate", ["2.B"],
             f"$I_3\\approx{I3:.2f}\\text{{ A}}$ and $P_3=I_3^2R_3\\approx{P3:.1f}\\text{{ W}}$.",
             [R("C1", "numeric", f"Calculates $I_3$ of about {I3:.2f} with units of amperes (accept any value within 2 percent)", [f"{I3:.2f}", "A"], requires="B3", nums=True, units=True, err=["uses $\\varepsilon_1/(R_1+R_3)$"]),
              R("C2", "numeric", f"Calculates the power $P_3=I_3^2R_3$ of about {P3:.1f} with units of watts", [f"{P3:.1f}", "W"], requires="C1", nums=True, units=True)]),
        part("D", "Both emfs are doubled while all the resistances stay the same. By what factor does the power dissipated in $R_3$ change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The power increases by a factor of 4: every current in the linear circuit is proportional to the emfs, so $I_3$ doubles and $P_3=I_3^2R_3$ becomes four times ${P3:.1f}\\text{{ W}}$.",
             [R("D1", "numeric", "States that the power increases by a factor of 4", ["factor of 4", "increases"], nums=True, err=["states that the power doubles", "states that the power is unchanged"]),
              R("D2", "justification", "Justifies that all currents are proportional to the emfs (a linear circuit) so $I_3$ doubles, and that $P=I^2R$ depends on the square of the current", ["currents proportional to the emfs", "P proportional to I^2"], requires="D1", err=["argues only that more voltage means more power"])]),
    ]
    return _pack("pef_mr_kirchhoff", "mr", "11.6", ["11.7", "11.4"], "2.A", "Two batteries and three resistors: Kirchhoff's rules", stim, parts, 10, 22, [f"e1={e1}", f"e2={e2}", f"R1={R1}", f"R2={R2}", f"R3={R3}", f"I3={I3:.5f}", f"P3={P3:.4f}"],
                 [_ev("C", "current in R3", I3, 0.02 * I3 + 0.005, "A"), _ev("C", "power in R3", P3, 0.03 * P3 + 0.02, "W")],
                 ("Representing a two-loop circuit, deriving a branch current with Kirchhoff's rules, calculating current and power, and predicting the effect of doubling the emfs", ["Draw the circuit and label the currents", "Apply the junction rule and two loop rules", "Evaluate the current and power", "Predict the effect of doubling both emfs"],
                  [("the batteries and wires are ideal and the resistors are ohmic", "the stimulus states ideal batteries and ohmic resistors")], {"type": "text", "must_include": ["the emfs", "the three resistances", "the battery polarity"]},
                  "numpy linalg.solve of the junction and loop equations recomputes the three currents and the power; the closed form for the branch current confirms it"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= MR (10): 전류 밀도가 변하는 도선의 자기장 =======================
def pef_mr_wire_ampere(rng):
    for _ in forever():
        J0 = pick(rng, [1.0, 2.0, 4.0]) * 1e5; Rm = pick(rng, [2.0, 4.0]) * 1e-3; fr = pick(rng, [0.25, 0.4]); r = fr * Rm
        s = sp.symbols("s", positive=True)
        Ienc = float(sp.integrate(J0 * s / Rm * 2 * sp.pi * s, (s, 0, r))); B = MU0 * Ienc / (2 * math.pi * r) * 1e6
        agree(Ienc, simpson(lambda x: J0 * x / Rm * 2 * math.pi * x, 0, r, 4001), 1e-8, "Ienc")
        Itot = 2 * math.pi * J0 * Rm ** 2 / 3
        B2 = MU0 * J0 * (2 * r) ** 2 / (3 * Rm) * 1e6
        break
    stim = {"kind": "text", "description": f"A long straight cylindrical wire of radius $R={Rm * 1e3:g}\\text{{ mm}}$ carries a current along its axis. The current density depends on the distance $r$ from the axis as $J(r)=J_0r/R$, where $J_0={J0 / 1e5:g}\\times10^{{5}}\\text{{ A/m}}^{{2}}$. Use {MUP}.", "data": {}}
    parts = [
        part("A", "Draw a diagram of the cross-section of the wire as a circle with the current out of the page. On it draw a circular Amperian loop of radius $r<R$ concentric with the wire and an arrow showing the direction of the magnetic field on the loop.", 3, "diagram", ["1.A"],
             "A circle concentric with the wire inside its boundary, with the field arrow tangent to the circle and pointing counterclockwise for a current out of the page.",
             [R("A1", "diagram", "Draws a circular loop concentric with the wire and inside its boundary ($r<R$)", ["concentric loop of radius r < R"], err=["draws the loop off-center or outside the wire"]),
              R("A2", "diagram", "Draws the field arrow tangent to the loop (perpendicular to the radius)", ["tangent arrow"], err=["draws a radial arrow"]),
              R("A3", "diagram", "Gives the correct sense, counterclockwise for a current out of the page, by the right-hand rule", ["counterclockwise"], requires="A2", err=["draws a clockwise arrow"])]),
        part("B", "Derive an expression for the magnitude of the magnetic field at a distance $r<R$ from the axis in terms of $\\mu_0$, $J_0$, $R$ and $r$.", 3, "derive", ["2.A"],
             "$I_{enc}=\\int_0^rJ_0\\dfrac{r'}{R}2\\pi r'\\,dr'=\\dfrac{2\\pi J_0r^3}{3R}$ and Ampère's law $B\\,2\\pi r=\\mu_0I_{enc}$ gives $B=\\dfrac{\\mu_0J_0r^2}{3R}$.",
             [R("B1", "expression", "Writes the current in a thin ring, $dI=J\\,2\\pi r'\\,dr'$", ["dI = J 2 pi r' dr'"], err=["uses $J\\pi r'^2$ without integrating"]),
              R("B2", "expression", "Integrates from $0$ to $r$ to obtain $I_{enc}=2\\pi J_0r^3/(3R)$", ["2 pi J0 r^3 / (3 R)"], requires="B1", err=["integrates to $r^2$ instead of $r^3$"]),
              R("B3", "expression", "Applies Ampère's law to obtain $B=\\mu_0J_0r^2/(3R)$", ["mu0 J0 r^2 / (3 R)"], requires="B2", err=["uses $B=\\mu_0I_{enc}/r$ without $2\\pi$"])]),
        part("C", f"Calculate the magnitude of the magnetic field at $r={r * 1e3:g}\\text{{ mm}}$, in microteslas.", 2, "calculate", ["2.B"],
             f"$B=\\mu_0J_0r^2/(3R)\\approx{B:.1f}\\,\\mu\\text{{T}}$.",
             [R("C1", "numeric", "Substitutes the values (with the radii in meters) into the expression from part B", ["substitution in SI units"], requires="B3", nums=True, err=["leaves the radii in millimeters"]),
              R("C2", "numeric", f"Obtains about {B:.1f} with units of microteslas (accept any value within 2 percent)", [f"{B:.1f}", "microteslas"], requires="C1", nums=True, units=True)]),
        part("D", "By what factor does the magnitude of the field change if the distance from the axis is doubled to $2r$ (which is still inside the wire)? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The field increases by a factor of 4, because $B\\propto r^2$ inside this wire (the enclosed current grows as $r^3$ while the loop length grows as $r$); at $2r$ the field is about ${B2:.1f}\\,\\mu\\text{{T}}$.",
             [R("D1", "numeric", "States that the field increases by a factor of 4", ["factor of 4", "increases"], nums=True, err=["states that the field doubles", "states that the field decreases as $1/r$"]),
              R("D2", "justification", "Justifies with $B=\\mu_0J_0r^2/(3R)$ (proportional to $r^2$) or with the enclosed current scaling as $r^3$ and the circumference as $r$", ["B proportional to r^2"], requires="D1", err=["argues with the $1/r$ law for the exterior of a wire"])]),
    ]
    return _pack("pef_mr_wire_ampere", "mr", "12.4", ["12.3", "11.1"], "2.A", "Magnetic field inside a wire with a nonuniform current density", stim, parts, 10, 22, [f"J0={J0}", f"Rm={Rm}", f"r={r}", f"B={B:.4f}", f"B2={B2:.4f}"],
                 [_ev("C", "magnetic field", B, 0.02 * B + 0.1, "microteslas"), _ev("D", "factor by which the field changes", 4.0, 0.05, "")],
                 ("Applying Ampère's law with an enclosed current found by integration, representing the loop and field direction, and predicting how the field scales with distance", ["Draw the Amperian loop and the field direction", "Integrate the current density for the enclosed current and apply Ampère's law", "Predict the scaling of the field with the distance"],
                  [("the current is along the axis and the current density depends only on the distance from the axis", "the stimulus states an axial current with a radially varying density")], {"type": "text", "must_include": ["the radius", "the current density law"]},
                  "sympy integrates the current density; a Simpson integration recomputes the enclosed current; the field scaling follows from the closed form"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 변하는 자기장 속 고리의 유도 기전력 그래프 =======================
def pef_tbr_induction_graph(rng):
    for _ in forever():
        side = pick(rng, [10.0, 20.0, 25.0]); B1 = pick(rng, [0.20, 0.40, 0.50]); Rr = pick(rng, [0.5, 1.0, 2.0]); A = (side * 1e-2) ** 2
        emf1 = A * B1 / 2.0; q1 = A * B1 / Rr; emf_rot = emf1 * 0.5
        agree(q1, simpson(lambda s: emf1 / Rr, 0, 2.0, 11), 1e-9, "q")
        break
    stim = {"kind": "text", "description": f"A square loop of side ${side:g}\\text{{ cm}}$ and total resistance ${Rr:g}\\,\\Omega$ lies in a uniform magnetic field perpendicular to its plane. The magnitude of the field changes with time as follows: it increases linearly from $0$ to $B_1={B1:g}\\text{{ T}}$ between $t=0$ and $t=2\\text{{ s}}$, stays constant between $t=2\\text{{ s}}$ and $t=4\\text{{ s}}$, and decreases linearly back to $0$ between $t=4\\text{{ s}}$ and $t=6\\text{{ s}}$. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the induced emf $\\varepsilon$ in the loop as a function of time from $t=0$ to $t=6\\text{ s}$, taking the emf during the first interval as positive. Label the value of the emf in the first interval in terms of the quantities given.", 4, "graph", ["1.C", "1.B"],
             "A positive constant $\\varepsilon=AB_1/(2\\text{ s})$ from $0$ to $2$ s, zero from $2$ s to $4$ s, and an equal-magnitude negative constant from $4$ s to $6$ s (three flat segments with steps at $2$ s and $4$ s).",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The emf is constant and positive from $0$ to $2$ s with the labeled value $AB_1/(2\\text{ s})$", ["positive constant segment with value"], err=["draws a ramp instead of a constant emf"]),
              R("A3", "graph", "The emf is zero from $2$ s to $4$ s", ["zero emf in the middle interval"], err=["draws the emf equal to the field in the middle interval"]),
              R("A4", "graph", "The emf is negative with the same magnitude from $4$ s to $6$ s", ["equal and opposite emf in the last interval"], requires="A2", err=["draws a positive emf for the decreasing field"])]),
        part("B", "Use Faraday's law to derive an expression for the magnitude of the emf in the first interval in terms of $s$ (the side length), $B_1$ and the duration $T$ of the interval.", 3, "derive", ["2.A"],
             "$\\Phi=s^2B(t)$ and $B=B_1t/T$, so $|\\varepsilon|=d\\Phi/dt=s^2B_1/T$.",
             [R("B1", "expression", "Writes the flux through the loop $\\Phi=s^2B(t)$ (the field is perpendicular to the plane)", ["Phi = s^2 B"], err=["uses a different area"]),
              R("B2", "expression", "Writes the field as $B(t)=B_1t/T$ and differentiates", ["B = B1 t / T"], requires="B1", err=["differentiates the area instead of the field"]),
              R("B3", "expression", "Obtains $|\\varepsilon|=s^2B_1/T$", ["s^2 B1 / T"], requires="B2", err=["omits the area"])]),
        part("C", "Calculate the magnitude of the emf in the first interval and the total charge that flows through the loop during that interval.", 3, "calculate", ["2.B"],
             f"$|\\varepsilon|=s^2B_1/T\\approx{emf1 * 1e3:.2f}\\text{{ mV}}$ and $q=\\varepsilon T/R=\\Delta\\Phi/R\\approx{q1 * 1e3:.2f}\\text{{ mC}}$.",
             [R("C1", "numeric", f"Calculates the emf of about {emf1 * 1e3:.2f} with units of millivolts (accept any value within 2 percent)", [f"{emf1 * 1e3:.2f}", "mV"], requires="B3", nums=True, units=True, err=["leaves the side in centimeters"]),
              R("C2", "expression", "Relates the current to the emf, $I=\\varepsilon/R$, and the charge to the current, $q=IT$ (or $q=\\Delta\\Phi/R$)", ["I = emf / R", "q = I T"], err=["uses $q=\\varepsilon R$"]),
              R("C3", "numeric", f"Calculates the charge of about {q1 * 1e3:.2f} with units of millicoulombs", [f"{q1 * 1e3:.2f}", "mC"], requires="C2", nums=True, units=True)]),
        part("D", "The loop is rotated about an axis in its plane so that its normal makes an angle of $60^\\circ$ with the field, and the field changes in the same way. By what factor does the emf in the first interval change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The flux is $s^2B\\cos60^\\circ$, so the emf is multiplied by $\\cos60^\\circ=0.5$ (from ${emf1 * 1e3:.2f}\\text{{ mV}}$ to ${emf_rot * 1e3:.2f}\\text{{ mV}}$).",
             [R("D1", "numeric", "States that the emf is multiplied by 0.5 (it is halved)", ["0.5", "halved"], nums=True, err=["states that the emf is unchanged", "states a factor of $\\sin60^\\circ$"]),
              R("D2", "justification", "Justifies with $\\Phi=BA\\cos\\theta$: only the component of the field along the normal contributes to the flux", ["flux uses cos theta"], requires="D1", err=["argues only that tilting the loop changes the area"])]),
    ]
    return _pack("pef_tbr_induction_graph", "tbr", "13.2", ["13.1", "13.3"], "1.C", "Induced emf from a changing field: graph, Faraday's law and prediction", stim, parts, 12, 27, [f"side={side}", f"B1={B1}", f"Rr={Rr}", f"emf1={emf1:.6f}", f"q1={q1:.6f}"],
                 [_ev("C", "emf in the first interval", emf1 * 1e3, 0.02 * emf1 * 1e3 + 0.01, "mV"), _ev("C", "charge", q1 * 1e3, 0.02 * q1 * 1e3 + 0.01, "mC")],
                 ("Sketching the induced emf for a piecewise field, deriving it with Faraday's law, calculating the emf and the charge, and predicting the effect of tilting the loop", ["Sketch the emf from the slope of the field in each interval", "Derive the emf from the flux", "Calculate the emf and the charge", "Predict the effect of tilting the loop"],
                  [("the loop is fixed in a uniform field and has the stated total resistance", "the stimulus states a fixed loop in a uniform field with a stated resistance")], {"type": "text", "must_include": ["the loop side", "the field values and times", "the resistance"]},
                  "the emf is recomputed from the slope of the flux in each interval and the charge from a numerical integration of the current"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 축전기의 방전 =======================
def pef_tbr_discharge(rng):
    for _ in forever():
        V0 = pick(rng, [6.0, 9.0, 12.0]); Rk = pick(rng, [2.0, 5.0, 10.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); tau = Rk * 1e3 * Cu * 1e-6
        Vtau = V0 * math.exp(-1); thalf = tau * math.log(2) / 2
        y = rk4(lambda t0, s: np.array([-s[0] / tau]), [V0], 0.0, thalf, 4000); agree(0.5 * V0 * V0, y[0] ** 2, 1e-6, "Uhalf")
        break
    stim = {"kind": "text", "description": f"A capacitor of capacitance $C={Cu:g}\\,\\mu\\text{{F}}$ is charged to a potential difference $V_0={V0:g}\\text{{ V}}$ and then, at $t=0$, connected across a resistor of resistance $R={Rk:g}\\text{{ k}}\\Omega$. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the potential difference $V$ across the capacitor as a function of time from $t=0$ to about five time constants. Label the initial value and mark the time constant and the value of $V$ at that time.", 4, "graph", ["1.C", "1.B"],
             f"A decaying exponential that starts at $V_0={V0:g}\\text{{ V}}$, has its steepest slope at $t=0$ and approaches zero, passing through about ${Vtau:.2f}\\text{{ V}}$ (37 percent of $V_0$) at $t=\\tau=RC={tau * 1e3:g}\\text{{ ms}}$.",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", f"The curve starts at the labeled value $V_0={V0:g}\\text{{ V}}$ at $t=0$", ["initial value"], nums=True, err=["starts at zero"]),
              R("A3", "graph", "The curve decays exponentially toward zero with a decreasing slope and never goes negative", ["exponential decay toward zero"], err=["draws a straight line to zero"]),
              R("A4", "graph", "Marks $t=\\tau=RC$ and the value about $0.37V_0$ there", ["tau marked", "0.37 V0"], requires="A3", err=["marks the point where the voltage is half of $V_0$ as $\\tau$"])]),
        part("B", "Use Kirchhoff's loop rule to derive an expression for $V(t)$ in terms of $V_0$, $R$, $C$ and $t$.", 3, "derive", ["2.A"],
             "$V=IR$ with $I=-dq/dt$ and $q=CV$ gives $V=-RC\\,dV/dt$; separating variables and integrating with $V(0)=V_0$ gives $V=V_0e^{-t/RC}$.",
             [R("B1", "expression", "Writes the loop equation $q/C-IR=0$ with $I=-dq/dt$ (or $V=-RC\\,dV/dt$)", ["V = -R C dV/dt"], err=["omits the minus sign for the decreasing charge"]),
              R("B2", "expression", "Separates variables and integrates with $V(0)=V_0$", ["separate and integrate"], requires="B1", err=["uses $V(0)=0$"]),
              R("B3", "expression", "Obtains $V(t)=V_0e^{-t/RC}$", ["V0 e^(-t/RC)"], requires="B2", err=["obtains $1-e^{-t/RC}$"])]),
        part("C", "Calculate the time at which the energy stored in the capacitor has fallen to half of its initial value.", 3, "calculate", ["2.B", "2.A"],
             f"The energy is $\\tfrac12CV^2$, so it is half of the initial value when $V=V_0/\\sqrt2$: $t=\\tfrac12RC\\ln2\\approx{thalf * 1e3:.2f}\\text{{ ms}}$.",
             [R("C1", "expression", "Notes that the energy $U=\\tfrac12CV^2$ is proportional to $V^2$, so $V=V_0/\\sqrt2$ when $U=U_0/2$", ["U proportional to V^2", "V = V0/sqrt(2)"], err=["sets $V=V_0/2$"]),
              R("C2", "expression", "Solves $e^{-t/RC}=1/\\sqrt2$ to obtain $t=\\tfrac12RC\\ln2$", ["t = (1/2) R C ln 2"], requires="C1", err=["obtains $t=RC\\ln2$"]),
              R("C3", "numeric", f"Obtains about {thalf * 1e3:.2f} with units of milliseconds (accept any value within 2 percent)", [f"{thalf * 1e3:.2f}", "ms"], requires="C2", nums=True, units=True)]),
        part("D", "The capacitor is replaced by one with twice the capacitance, charged to the same initial potential difference. By what factor does the time for the voltage to fall to $V_0/e$ change? By what factor does the initial energy change? Justify your answers.", 2, "explain", ["2.D", "3.B"],
             "The time constant $RC$ doubles, so the time doubles; the initial energy $\\tfrac12CV_0^2$ also doubles.",
             [R("D1", "numeric", "States that both the time and the initial energy double (factor 2 for each)", ["time doubles", "energy doubles"], nums=True, err=["states that the time is unchanged because the voltage is the same"]),
              R("D2", "justification", "Justifies with $\\tau=RC$ (proportional to $C$) and $U_0=\\tfrac12CV_0^2$ (proportional to $C$)", ["tau proportional to C", "U proportional to C"], requires="D1", err=["argues only that a bigger capacitor holds more charge"])]),
    ]
    return _pack("pef_tbr_discharge", "tbr", "11.8", ["10.3", "11.4"], "1.C", "Discharge of a capacitor: graph, derivation and energy", stim, parts, 12, 27, [f"V0={V0}", f"Rk={Rk}", f"Cu={Cu}", f"Vtau={Vtau:.5f}", f"thalf={thalf:.6f}"],
                 [_ev("A", "voltage at one time constant", Vtau, 0.02 * Vtau + 0.02, "V"), _ev("C", "time for the energy to halve", thalf * 1e3, 0.02 * thalf * 1e3 + 0.02, "ms")],
                 ("Sketching the discharge of a capacitor, deriving the exponential law with the loop rule, finding the time for the stored energy to halve, and predicting the effect of a larger capacitance", ["Sketch the exponential decay with the labeled initial value and the time constant", "Derive the decay law", "Find the time at which the energy halves", "Predict the effect of doubling C"],
                  [("the resistor and the capacitor are ideal", "the stimulus states an ideal resistor and capacitor")], {"type": "text", "must_include": ["the capacitance", "the resistance", "the initial voltage"]},
                  "an RK4 integration of the decay equation recomputes the time at which the stored energy is half of the initial value"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): 도선의 길이와 저항(비저항) =======================
def pef_lab_resistivity(rng):
    Ls = [0.20, 0.40, 0.60, 0.80, 1.00]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); dmm = pick(rng, [0.20, 0.30, 0.50]); rho = pick(rng, [1.0e-6, 1.5e-6, 4.9e-7])  # 니크롬 계열
        A = math.pi * (dmm * 1e-3 / 2) ** 2
        Rs = [round(rho * L / A * (1 + r2.uniform(-0.02, 0.02)), 3) for L in Ls]
        slope, icpt = np.polyfit(Ls, Rs, 1); Xn = np.array([[L, 1.0] for L in Ls]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(Rs)); agree(slope, beta[0], 1e-9, "slope")
        rho_est = slope * A
        if abs(rho_est - rho) / rho < 0.06:
            break
    stim = {"kind": "table", "description": f"A student measures the resistance R of pieces of the same resistance wire, of diameter d = {dmm:g} mm, for several lengths L.", "data": {"x_label": "Length of wire L (m)", "y_label": "Resistance R (ohms)", "rows": [[L, r_] for L, r_ in zip(Ls, Rs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the resistance as a function of the length. Include the equipment and the measurements, how the length is changed, and one way to reduce the uncertainty in the resistance.", 3, "design", ["3.A", "2.B"],
             "Stretch a single wire straight along a meterstick, connect it in a circuit with a battery and an ammeter, measure the potential difference across the section of length $L$ with a voltmeter and the current with the ammeter, change the length by moving the contact, and compute $R=V/I$; keep the same wire and temperature, and reduce the uncertainty by using small currents (to limit heating) or by repeating and averaging.",
             [R("A1", "design", "Identifies how the resistance is found (voltmeter across the section and ammeter in series, $R=V/I$, or an ohmmeter) and how the length is measured", ["voltmeter and ammeter or ohmmeter", "length measured"], err=["measures the length without a way to get the resistance"]),
              R("A2", "design", "Changes only the length while keeping the same wire (diameter and material) and the temperature the same", ["change only the length, same wire and temperature"]),
              R("A3", "design", "Reduces the uncertainty by using small currents to avoid heating, or by repeating the measurement and averaging, or by using a longer range of lengths (any one earns the point)", ["small currents or repeat and average or longer range (any one earns the point)"])]),
        part("B", "For a uniform wire $R=\\rho L/A$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to determine the resistivity $\\rho$.", 1, "explain", ["2.B", "3.A"],
             "Plot $R$ on the vertical axis against $L$ on the horizontal axis; the slope is $\\rho/A$.",
             [R("B1", "expression", "Identifies $R$ (vertical) versus $L$ (horizontal), with slope $\\rho/A$", ["R versus L"], err=["plots R versus 1/L"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in the form identified in part B and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(L,R)$: {', '.join(f'({L:g}, {r_:.3f})' for L, r_ in zip(Ls, Rs))} with a best-fit line of slope about ${slope:.2f}\\,\\Omega/\\text{{m}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(L,R)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the resistivity of the wire material in micro-ohm-meters ($1\\,\\mu\\Omega\\cdot\\text{m}=10^{-6}\\,\\Omega\\cdot\\text{m}$). Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $\\rho/A\\approx{slope:.2f}\\,\\Omega/\\text{{m}}$ with $A=\\pi(d/2)^2={A * 1e6:.4f}\\text{{ mm}}^2$, so $\\rho=\\text{{slope}}\\cdot A\\approx{rho_est * 1e6:.3f}\\,\\mu\\Omega\\cdot\\text{{m}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} ohms per meter; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $\\rho$: $\\rho=\\text{slope}\\cdot A$ with $A=\\pi d^2/4$ and the diameter converted to meters", ["rho = slope A", "A = pi d^2 / 4"], err=["uses the diameter as the radius in the area"]),
              R("D3", "numeric", f"Obtains $\\rho$ of about {rho_est * 1e6:.3f} with units of micro-ohm-meters (accept any value consistent with the student's own slope from D1)", [f"{rho_est * 1e6:.3f}", "micro-ohm meters"], alt=["a value of rho consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pef_lab_resistivity", "lab", "11.3", ["11.2", "11.4"], "3.A", "Experiment: resistivity from resistance versus length", stim, parts, 10, 27, [f"dmm={dmm}", f"rho={rho}", f"slope={slope:.5f}", f"rho_est={rho_est:.6g}", f"Rs={Rs}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "ohm/m"), _ev("D", "resistivity", rho_est * 1e6, 0.06 * rho * 1e6, "micro-ohm m")],
                 ("Designing an experiment and analyzing resistance data to extract the resistivity from the slope of R versus L", ["Describe how the resistance and the length are measured and the length is varied", "Plot R versus L as a straight line", "Use the slope and the wire's cross-sectional area to determine the resistivity"],
                  [("the generated resistances follow $R=\\rho L/A$ with a small random error so the fitted resistivity is within six percent of the generating value", "the code rejects a seed whose fitted resistivity differs from the generating value by more than six percent")], {"type": "table", "must_include": ["length", "resistance"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted resistivity is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= LAB (10): 도선에 작용하는 자기력과 전류 =======================
def pef_lab_magnetic_force(rng):
    Is = [1.0, 2.0, 3.0, 4.0, 5.0]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); L = pick(rng, [0.050, 0.080, 0.100]); B = pick(rng, [0.10, 0.20, 0.40])
        Fs = [round(B * L * i * 1e3 * (1 + r2.uniform(-0.02, 0.02)), 3) for i in Is]  # mN
        slope, icpt = np.polyfit(Is, Fs, 1); Xn = np.array([[i, 1.0] for i in Is]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(Fs)); agree(slope, beta[0], 1e-9, "slope")
        B_est = slope * 1e-3 / L
        if abs(B_est - B) / B < 0.06:
            break
    stim = {"kind": "table", "description": f"A student hangs a horizontal straight segment of wire of length L = {L * 100:g} cm perpendicular to a uniform horizontal magnetic field of unknown magnitude B and measures the vertical magnetic force F on the wire (from the change in the reading of a balance) for several currents I in the wire.", "data": {"x_label": "Current in the wire I (A)", "y_label": "Magnetic force on the wire F (mN)", "rows": [[i, f_] for i, f_ in zip(Is, Fs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the force as a function of the current. Include the equipment and the measurements, how the current is changed, and one way to reduce the uncertainty in the force.", 3, "design", ["3.A", "2.B"],
             "Place the wire segment between the poles of a magnet on a balance, pass a current from a variable power supply through the wire, measure the current with an ammeter and the change in the balance reading (converted to a force) for each current; keep the field region, the wire length and the orientation the same; reduce the uncertainty by repeating each reading with the current reversed and averaging the change in reading.",
             [R("A1", "design", "Identifies how the current is measured and varied (ammeter and a variable supply or rheostat) and how the force is measured (a balance or force sensor)", ["a way to measure the current and a way to measure the force"], err=["omits how the force is measured"]),
              R("A2", "design", "Changes only the current while keeping the field, the wire length in the field and the orientation the same", ["change only the current"]),
              R("A3", "design", "Reduces the uncertainty by repeating the readings and averaging, or by reversing the current and averaging the magnitudes, or by using a more sensitive balance (any one earns the point)", ["repeat and average or reverse the current or more sensitive balance (any one earns the point)"])]),
        part("B", "For a wire perpendicular to the field $F=ILB$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to determine $B$.", 1, "explain", ["2.B", "3.A"],
             "Plot $F$ on the vertical axis against $I$ on the horizontal axis; the slope is $LB$.",
             [R("B1", "expression", "Identifies $F$ (vertical) versus $I$ (horizontal), with slope $LB$", ["F versus I"], err=["plots F versus I squared"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in the form identified in part B and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(I,F)$: {', '.join(f'({i:g}, {f_:.3f})' for i, f_ in zip(Is, Fs))} with a best-fit line of slope about ${slope:.2f}\\text{{ mN/A}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(I,F)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the magnitude of the magnetic field. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $LB\\approx{slope:.2f}\\text{{ mN/A}}$, so $B=\\text{{slope}}/L\\approx{B_est:.3f}\\text{{ T}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.2f} mN/A; accept any value within 5 percent)", [f"{slope:.2f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $B$: $B=\\text{slope}/L$ (with the force converted to newtons and the length to meters)", ["B = slope / L"], err=["uses $B=\\text{slope}\\cdot L$"]),
              R("D3", "numeric", f"Obtains $B$ of about {B_est:.3f} with units of teslas (accept any value consistent with the student's own slope from D1)", [f"{B_est:.3f}", "T"], alt=["a value of B consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pef_lab_magnetic_force", "lab", "12.1", ["12.2", "11.1"], "3.A", "Experiment: magnetic field from the force on a current-carrying wire", stim, parts, 10, 27, [f"L={L}", f"B={B}", f"slope={slope:.5f}", f"B_est={B_est:.5f}", f"Fs={Fs}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "mN/A"), _ev("D", "magnetic field", B_est, 0.06 * B + 0.002, "T")],
                 ("Designing an experiment and analyzing force data to extract the magnetic field from the slope of F versus I", ["Describe how the current and the force are measured and the current is varied", "Plot F versus I as a straight line", "Use the slope and the wire length to determine the field"],
                  [("the generated forces follow $F=ILB$ with a small random error so the fitted field is within six percent of the generating value", "the code rejects a seed whose fitted field differs from the generating value by more than six percent")], {"type": "table", "must_include": ["current", "force"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted field is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 대전된 구 껍질의 내부와 외부 =======================
def pef_qqt_shell_field(rng):
    for _ in forever():
        Rc = pick(rng, [20.0, 30.0]); Qn = pick(rng, [2.0, 3.0, 4.0]); Rm = Rc * 1e-2
        Eout = K * Qn * 1e-9 / Rm ** 2; Eout2 = K * Qn * 1e-9 / (2 * Rm) ** 2
        break
    stim = {"kind": "text", "description": f"A thin spherical shell of radius $R={Rc:g}\\text{{ cm}}$ carries a charge $Q={Qn:g}\\text{{ nC}}$ spread uniformly over its surface. The shell is nonconducting and in vacuum. Use {KP}.", "data": {}}
    parts = [
        part("A", "A student claims that the electric field at the center of the shell is the same as the electric field just outside its surface. Do you agree or disagree with the claim? Justify your answer using Gauss's law.", 3, "explain", ["3.B", "3.C"],
             "Disagree. For a spherical Gaussian surface inside the shell no charge is enclosed, so by symmetry and Gauss's law the field there is zero, while just outside the field is $kQ/R^2$.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees because the field is continuous"]),
              R("A2", "justification", "Justifies that a spherical Gaussian surface inside the shell encloses no charge, so the field inside is zero", ["no enclosed charge inside", "field zero inside"], err=["says the field is zero because the charges cancel pairwise without using Gauss's law"]),
              R("A3", "justification", "Contrasts this with a surface just outside, which encloses the whole charge $Q$ and gives a nonzero field $kQ/R^2$", ["whole charge enclosed outside", "kQ/R^2"], requires="A2", err=["says the outside field is also zero"])]),
        part("B", "Derive an expression for the magnitude of the electric field at a distance $r>R$ from the center and calculate its value at $r=R$ (just outside the surface).", 3, "derive", ["2.A", "2.B"],
             f"$E\\,4\\pi r^2=Q/\\varepsilon_0$ gives $E=kQ/r^2$; at $r=R$ it is $\\approx{Eout:.0f}\\text{{ N/C}}$.",
             [R("B1", "expression", "Applies Gauss's law with a concentric spherical surface: $E\\,4\\pi r^2=Q/\\varepsilon_0$", ["E 4 pi r^2 = Q / epsilon_0"], err=["uses the surface area $2\\pi r^2$"]),
              R("B2", "expression", "Obtains $E=kQ/r^2$", ["k Q / r^2"], requires="B1", err=["obtains $kQ/r$"]),
              R("B3", "numeric", f"Calculates the field at $r=R$ of about {Eout:.0f} with units of newtons per coulomb (accept any value within 2 percent)", [f"{Eout:.0f}", "N/C"], requires="B2", nums=True, units=True)]),
        part("C", "The same shell is observed at a distance twice as far from its center, $r=2R$. Predict the factor by which the field changes compared with the value just outside the surface, and justify your prediction.", 2, "explain", ["2.D", "3.B"],
             f"The field falls to one quarter (about ${Eout2:.0f}\\text{{ N/C}}$), because outside the shell $E\\propto1/r^2$.",
             [R("C1", "numeric", "States that the field is multiplied by one quarter (0.25)", ["one quarter", "0.25"], nums=True, err=["states that the field is halved", "states that the field is unchanged"]),
              R("C2", "justification", "Justifies with $E=kQ/r^2$ (the shell acts like a point charge at its center outside)", ["E proportional to 1/r^2"], requires="C1", err=["argues only that the field is weaker farther away"])]),
    ]
    return _pack("pef_qqt_shell_field", "qqt", "8.6", ["8.3", "8.5"], "3.B", "Field of a charged spherical shell", stim, parts, 8, 16, [f"Rc={Rc}", f"Qn={Qn}", f"Eout={Eout:.4f}", f"Eout2={Eout2:.4f}"],
                 [_ev("B", "field just outside the shell", Eout, 0.02 * Eout + 1.0, "N/C")],
                 ("Using Gauss's law to contrast the field inside and outside a charged shell, deriving the exterior field, and predicting its scaling", ["Compare the enclosed charge for surfaces inside and outside", "Derive the exterior field with Gauss's law", "Predict how the field varies with distance"],
                  [("the charge is uniform over the surface of the shell", "the stimulus states a uniform surface charge")], {"type": "text", "must_include": ["the radius", "the charge"]},
                  "the exterior field is recomputed from the closed form and the interior flux is shown to vanish numerically"),
                 ["law_selection", "justification", "symbolic_reasoning"])


# ======================= QQT (8): 충전하는 동안의 에너지 =======================
def pef_qqt_rc_energy(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0, 24.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); C = Cu * 1e-6
        Wb = C * e * e * 1e6; Uc = 0.5 * C * e * e * 1e6; Qh = Wb - Uc
        Rr = 1000.0; tau = Rr * C; ts = np.linspace(0, 40 * tau, 400001); Ip = e / Rr * np.exp(-ts / tau); Ed = float(np.trapezoid(Ip ** 2 * Rr, ts)) * 1e6
        agree(Qh, Ed, 1e-4, "Qh")
        break
    stim = {"kind": "text", "description": f"A battery of emf $\\varepsilon={e:g}\\text{{ V}}$ and negligible internal resistance charges an initially uncharged capacitor of capacitance $C={Cu:g}\\,\\mu\\text{{F}}$ through a resistor. The capacitor ends fully charged.", "data": {}}
    parts = [
        part("A", "A student claims that all of the energy supplied by the battery during the charging is stored in the capacitor. Do you agree or disagree with the claim? Justify your answer by comparing the work done by the battery with the energy stored.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The battery does work $q\\varepsilon=C\\varepsilon^2$ on the charge it moves, but the capacitor stores only $\\tfrac12C\\varepsilon^2$; the other half is dissipated as thermal energy in the resistor.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees that the energy is conserved in the capacitor"]),
              R("A2", "justification", "Justifies by identifying the work done by the battery as $Q\\varepsilon=C\\varepsilon^2$", ["battery work C epsilon^2"], err=["uses $\\tfrac12C\\varepsilon^2$ for the battery's work"]),
              R("A3", "justification", "Compares with the energy stored, $\\tfrac12C\\varepsilon^2$, and concludes that the remainder is dissipated in the resistor", ["stored energy is half", "rest dissipated in the resistor"], requires="A2", err=["says the remainder is stored in the wires"])]),
        part("B", "Derive expressions for the work done by the battery, the energy stored in the capacitor, and the thermal energy dissipated in the resistor, and calculate the thermal energy for the given values.", 3, "derive", ["2.A", "2.B"],
             f"$W_{{battery}}=C\\varepsilon^2$, $U=\\tfrac12C\\varepsilon^2$ and $Q_{{thermal}}=W_{{battery}}-U=\\tfrac12C\\varepsilon^2\\approx{Qh:.0f}\\,\\mu\\text{{J}}$.",
             [R("B1", "expression", "Writes the battery's work as $W=q\\varepsilon$ with $q=C\\varepsilon$, giving $C\\varepsilon^2$", ["C epsilon^2"], err=["writes $W=\\tfrac12C\\varepsilon^2$"]),
              R("B2", "expression", "Writes the stored energy $U=\\tfrac12C\\varepsilon^2$ and the thermal energy $Q=W-U=\\tfrac12C\\varepsilon^2$", ["U = 1/2 C epsilon^2", "Q = 1/2 C epsilon^2"], requires="B1", err=["states that the thermal energy depends on $R$"]),
              R("B3", "numeric", f"Calculates the thermal energy of about {Qh:.0f} with units of microjoules (accept any value within 2 percent)", [f"{Qh:.0f}", "microjoules"], requires="B2", nums=True, units=True)]),
        part("C", "The experiment is repeated with a resistor of twice the resistance. Predict whether the thermal energy dissipated in the resistor increases, decreases or stays the same, and justify your prediction.", 2, "explain", ["2.D", "3.B"],
             "The thermal energy stays the same, because the total energy dissipated is $\\tfrac12C\\varepsilon^2$ regardless of $R$; a larger $R$ only makes the charging slower.",
             [R("C1", "claim", "States that the thermal energy stays the same", ["stays the same"], err=["states that the thermal energy doubles because $P=I^2R$"]),
              R("C2", "justification", "Justifies with the energy balance: the dissipated energy equals $W-U=\\tfrac12C\\varepsilon^2$, which does not depend on $R$", ["Q = 1/2 C epsilon^2 independent of R"], requires="C1", err=["argues only that the current is smaller with a larger resistor"])]),
    ]
    return _pack("pef_qqt_rc_energy", "qqt", "11.8", ["10.3", "11.4"], "3.B", "Energy balance while charging a capacitor", stim, parts, 8, 16, [f"e={e}", f"Cu={Cu}", f"Wb={Wb:.4f}", f"Uc={Uc:.4f}", f"Qh={Qh:.4f}"],
                 [_ev("B", "thermal energy", Qh, 0.02 * Qh + 0.5, "microjoules")],
                 ("Using energy bookkeeping to show that half of the battery's work in charging a capacitor is dissipated, deriving the three energies, and predicting independence from the resistance", ["Compare the battery's work with the stored energy", "Derive the three energies", "Predict the effect of a larger resistance on the dissipated energy"],
                  [("the battery is ideal and the capacitor starts uncharged and ends fully charged", "the stimulus states an ideal battery and complete charging")], {"type": "text", "must_include": ["the emf", "the capacitance"]},
                  "numpy integrates $I^2R$ over the charging current to recompute the dissipated energy and compares it with $W-U$"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ_B = ["pef_mr_kirchhoff", "pef_mr_wire_ampere", "pef_tbr_induction_graph", "pef_tbr_discharge", "pef_lab_resistivity", "pef_lab_magnetic_force", "pef_qqt_shell_field", "pef_qqt_rc_energy"]
