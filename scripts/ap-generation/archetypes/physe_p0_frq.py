"""AP Physics C: Electricity and Magnetism — FRQ 원형 4유형 × 2시나리오(MR 10점 / TBR 12점 / LAB 10점 / QQT 8점, 합 40). 배점·유형은 AP Central CED(Course Framework V.1, 2026)의 시험 설명(Section II: MR 10, TBR 12, 실험 설계·분석 10, QQT 8)으로 확인했다.
공식 FRQ 는 종이 손글씨이므로 이 원형은 문제·키·채점 행·자기 채점 참고 답안을 만든다. 모든 정답·수치는 코드(sympy·numpy·RK4)가 두 경로로 계산한다. 모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다."""
from physe_common import *
from phys_p0_frq import R, _ev, part, REF_NOTE
from bp import frq_blueprint

t_ = sp.symbols("t", positive=True)


def _pack(arch, template, topic, extra, skill, title, stim, parts, total, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == total and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), (arch, total)
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": total, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUBC, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


KP = "$k=9.0\\times10^{9}\\text{ N}\\cdot\\text{m}^{2}/\\text{C}^{2}$"


# ======================= MR (10): 대전된 고리의 축 위 전기장 =======================
def pef_mr_ring_field(rng):
    for _ in forever():
        Rc = pick(rng, [10.0, 15.0, 20.0]); Qn = pick(rng, [4.0, 6.0, 8.0, 12.0]); xc = pick(rng, [10.0, 15.0, 20.0]) ; Rr = Rc * 1e-2; x = xc * 1e-2
        E = K * Qn * 1e-9 * x / (x * x + Rr * Rr) ** 1.5
        En = simpson(lambda th: K * (Qn * 1e-9 / (2 * math.pi)) * x / (x * x + Rr * Rr) ** 1.5, 0, 2 * math.pi, 2001); agree(E, En, 1e-8, "E")
        E2 = K * Qn * 1e-9 * x / (x * x + (2 * Rr) ** 2) ** 1.5; f = E2 / E
        if xc != Rc:
            break
    stim = {"kind": "text", "description": f"A thin ring of radius $R={Rc:g}\\text{{ cm}}$ carries a charge of $Q={Qn:g}\\text{{ nC}}$ spread uniformly around it. Point P is on the axis of the ring, perpendicular to the plane of the ring through its center, at a distance $x={xc:g}\\text{{ cm}}$ from the center. Use {KP}.", "data": {}}
    parts = [
        part("A", "On the dot below, which represents point P, draw arrows that show the electric field at P caused by two small charge elements on opposite sides of the ring, and draw the direction of the net field at P. Each arrow must start on the dot and be labeled.", 3, "diagram", ["1.A"],
             "Two arrows from P pointing away from the two elements (each tilted away from the axis), whose components perpendicular to the axis cancel, and a net-field arrow along the axis pointing away from the ring.",
             [R("A1", "diagram", "Draws two field arrows at P, each pointing away from its (positive) charge element along the line joining them", ["two arrows pointing away from the elements"], err=["draws the arrows toward the ring"]),
              R("A2", "diagram", "The two arrows have equal length and are symmetric about the axis", ["equal length symmetric arrows"], err=["draws arrows of unequal length for symmetric elements"]),
              R("A3", "diagram", "Labels the net field along the axis, pointing away from the ring, because the perpendicular components cancel", ["net field along the axis away from the ring"], requires="A1", err=["draws the net field perpendicular to the axis"])]),
        part("B", "Derive an expression for the magnitude of the electric field at P in terms of $k$, $Q$, $R$ and $x$.", 3, "derive", ["2.A"],
             "$dE=k\\,dq/(x^2+R^2)$ and only the axial component $dE\\,x/\\sqrt{x^2+R^2}$ survives; integrating over the ring gives $E=kQx/(x^2+R^2)^{3/2}$.",
             [R("B1", "expression", "Writes the field of a charge element, $dE=k\\,dq/(x^2+R^2)$", ["k dq / (x^2 + R^2)"], err=["uses $k\\,dq/x^2$"]),
              R("B2", "expression", "Takes the axial component with the factor $x/\\sqrt{x^2+R^2}$", ["x / sqrt(x^2 + R^2)"], requires="B1", err=["omits the component factor"]),
              R("B3", "expression", "Integrates over the ring ($\\int dq=Q$) to obtain $E=kQx/(x^2+R^2)^{3/2}$", ["k Q x / (x^2 + R^2)^(3/2)"], requires="B2", err=["obtains $kQ/(x^2+R^2)$"])]),
        part("C", f"Calculate the magnitude of the electric field at P for the given values.", 2, "calculate", ["2.B"],
             f"$E=kQx/(x^2+R^2)^{{3/2}}\\approx{E:.0f}\\text{{ N/C}}$.",
             [R("C1", "numeric", "Substitutes the values, converting centimeters and nanocoulombs to SI units, into the expression from part B", ["substitution in SI units"], requires="B3", nums=True, err=["leaves the distances in centimeters"]),
              R("C2", "numeric", f"Obtains about {E:.0f} with units of newtons per coulomb (accept any value within 2 percent)", [f"{E:.0f}", "N/C"], requires="C1", nums=True, units=True)]),
        part("D", f"The ring is replaced by a ring of the same charge but twice the radius, and point P stays at the same position. By what factor does the magnitude of the electric field at P change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The field decreases by a factor of about ${f:.2f}$: using $E=kQx/(x^2+(2R)^2)^{{3/2}}$ gives ${E2:.0f}\\text{{ N/C}}$, because the charge is farther from P and the axial component factor is smaller.",
             [R("D1", "numeric", f"States that the field decreases to about {f:.2f} times its original value (accept any value within 3 percent)", [f"{f:.2f}", "decreases"], nums=True, err=["states that the field is unchanged because the charge is the same", "states that the field is halved"]),
              R("D2", "justification", "Justifies by using $E=kQx/(x^2+R^2)^{3/2}$ with $R\\to2R$ (the elements are farther away and the field is not simply inversely proportional to $R$)", ["E with R replaced by 2R"], requires="D1", err=["argues only that a bigger ring weakens the field without using the expression"])]),
    ]
    return _pack("pef_mr_ring_field", "mr", "8.4", ["8.3", "8.1"], "2.A", "Electric field on the axis of a charged ring", stim, parts, 10, 22, [f"Rc={Rc}", f"Qn={Qn}", f"xc={xc}", f"E={E:.4f}", f"f={f:.5f}"],
                 [_ev("C", "electric field", E, 0.02 * E + 1.0, "N/C"), _ev("D", "field ratio", f, 0.03 * f + 0.005, "")],
                 ("Integrating the fields of the elements of a charged ring to find the field on its axis, with a justified prediction about a change of radius", ["Represent the fields of two opposite elements and their sum", "Derive the axial field by integration", "Predict the effect of doubling the radius"],
                  [("the ring is uniformly charged and in vacuum", "the stimulus states a uniform charge distribution in vacuum")], {"type": "text", "must_include": ["the radius", "the charge", "the axial distance"]},
                  "numpy integrates the axial component of the field of the ring elements around the angle; sympy confirms the closed form"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= MR (10): RC 회로의 충전 =======================
def pef_mr_rc_circuit(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0]); Rk = pick(rng, [2.0, 5.0, 10.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); n = pick(rng, [1.0, 2.0])
        Rr = Rk * 1e3; C = Cu * 1e-6; tau = Rr * C; tt = n * tau
        q = C * e * (1 - math.exp(-n)) * 1e6
        y = rk4(lambda t0, s: np.array([(e - s[0] / C) / Rr]), [0.0], 0.0, tt, 4000); agree(q, y[0] * 1e6, 1e-6, "q")
        thalf = tau * math.log(2) * 1e3
        break
    stim = {"kind": "text", "description": f"A battery of emf $\\varepsilon={e:g}\\text{{ V}}$ and negligible internal resistance, a resistor of resistance $R={Rk:g}\\text{{ k}}\\Omega$, a capacitor of capacitance $C={Cu:g}\\,\\mu\\text{{F}}$ and a switch are connected in series. The capacitor is initially uncharged and the switch is closed at $t=0$.", "data": {}}
    parts = [
        part("A", "Draw a schematic diagram of the circuit using standard symbols for the battery, resistor, capacitor and switch, and include a voltmeter connected so that it measures the potential difference across the capacitor.", 3, "diagram", ["1.A"],
             "A single series loop containing the battery, the switch, the resistor and the capacitor, with the voltmeter connected in parallel with the capacitor only.",
             [R("A1", "diagram", "Draws a single series loop containing the battery, switch, resistor and capacitor with correct symbols", ["series loop with all four elements"], err=["connects the capacitor in parallel with the battery"]),
              R("A2", "diagram", "Connects the voltmeter in parallel with the capacitor only (not in series, not across the resistor)", ["voltmeter in parallel with the capacitor"], err=["connects the voltmeter in series with the capacitor"]),
              R("A3", "diagram", "The battery symbol is drawn with its polarity marked and the symbols are unambiguous", ["battery polarity", "clear symbols"])]),
        part("B", "Using Kirchhoff's loop rule, derive an expression for the charge $q(t)$ on the capacitor as a function of time in terms of $\\varepsilon$, $R$, $C$ and $t$.", 3, "derive", ["2.A"],
             "$\\varepsilon-R\\,dq/dt-q/C=0$; separating variables and integrating with $q(0)=0$ gives $q(t)=C\\varepsilon\\left(1-e^{-t/RC}\\right)$.",
             [R("B1", "expression", "Writes the loop equation $\\varepsilon-R\\,dq/dt-q/C=0$", ["epsilon - R dq/dt - q/C = 0"], err=["omits the capacitor's potential difference"]),
              R("B2", "expression", "Separates variables and integrates with $q(0)=0$", ["separate and integrate"], requires="B1", err=["uses a different initial condition"]),
              R("B3", "expression", "Obtains $q(t)=C\\varepsilon(1-e^{-t/RC})$", ["C epsilon (1 - e^(-t/RC))"], requires="B2", err=["obtains a decaying exponential $C\\varepsilon e^{-t/RC}$"])]),
        part("C", f"Calculate the charge on the capacitor at $t={tt * 1e3:g}\\text{{ ms}}$.", 2, "calculate", ["2.B"],
             f"$\\tau=RC={tau * 1e3:g}\\text{{ ms}}$ and $q=C\\varepsilon(1-e^{{-t/\\tau}})\\approx{q:.1f}\\,\\mu\\text{{C}}$.",
             [R("C1", "numeric", "Substitutes the values into the expression from part B (the time constant is $RC$)", ["substitution"], requires="B3", nums=True, err=["uses the time in milliseconds without converting"]),
              R("C2", "numeric", f"Obtains about {q:.1f} with units of microcoulombs (accept any value within 2 percent)", [f"{q:.1f}", "microcoulombs"], requires="C1", nums=True, units=True)]),
        part("D", "The resistor is replaced by one with twice the resistance. Does the final charge on the capacitor change? By what factor does the time needed to reach half of the final charge change? Justify your answers.", 2, "explain", ["2.D", "3.B"],
             f"The final charge $C\\varepsilon$ does not depend on $R$, so it is unchanged. The time to reach half of the final charge is $RC\\ln2$, which doubles (from ${thalf:.1f}\\text{{ ms}}$ to ${2 * thalf:.1f}\\text{{ ms}}$).",
             [R("D1", "claim", "States that the final charge is unchanged and the time doubles", ["unchanged", "doubles"], err=["states that the final charge is halved", "states that the time is halved"]),
              R("D2", "justification", "Justifies with $q_{final}=C\\varepsilon$ (independent of $R$) and $t_{1/2}=RC\\ln2$ (proportional to $R$)", ["q_final = C epsilon", "time proportional to R"], requires="D1", err=["argues only that a larger resistance slows the current without relating it to the time constant"])]),
    ]
    return _pack("pef_mr_rc_circuit", "mr", "11.8", ["11.2", "10.3"], "2.A", "Charging a capacitor through a resistor", stim, parts, 10, 22, [f"e={e}", f"Rk={Rk}", f"Cu={Cu}", f"n={n}", f"q={q:.4f}", f"thalf={thalf:.4f}"],
                 [_ev("C", "charge", q, 0.02 * q + 0.1, "microcoulombs"), _ev("D", "factor by which the time to reach half of the final charge changes", 2.0, 0.05, "")],
                 ("Representing an RC circuit, deriving the charging law with the loop rule, calculating the charge at a time, and predicting the effect of doubling the resistance", ["Draw the circuit with the voltmeter in parallel with the capacitor", "Derive the charge as a function of time", "Predict the effect of doubling R on the final charge and the time scale"],
                  [("the battery is ideal and the capacitor starts uncharged", "the stimulus states an ideal battery and an uncharged capacitor")], {"type": "text", "must_include": ["the emf", "the resistance", "the capacitance"]},
                  "an RK4 integration of the loop equation recomputes the charge and the time to reach half of the final charge; sympy solves the differential equation"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): 균일하게 대전된 구의 E(r) 그래프 =======================
def pef_tbr_gauss_er(rng):
    for _ in forever():
        Rc = pick(rng, [10.0, 20.0]); Qn = pick(rng, [4.0, 6.0, 8.0, 12.0]); Rm = Rc * 1e-2
        Es = K * Qn * 1e-9 / Rm ** 2; dV = K * Qn * 1e-9 / (2 * Rm)
        agree(dV, simpson(lambda s: K * Qn * 1e-9 * s / Rm ** 3, 0, Rm, 4001), 1e-8, "dV")
        Ehalf = K * Qn * 1e-9 * (Rm / 2) / Rm ** 3
        break
    stim = {"kind": "text", "description": f"A solid nonconducting sphere of radius $R={Rc:g}\\text{{ cm}}$ carries a total charge $Q={Qn:g}\\text{{ nC}}$ spread uniformly through its volume. The sphere is in vacuum. Use {KP}. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the magnitude of the electric field $E$ as a function of the distance $r$ from the center of the sphere, for $0\\le r\\le3R$. Label the value of the field at $r=R$ in terms of $k$, $Q$ and $R$.", 4, "graph", ["1.C", "1.B"],
             "A straight line from the origin rising to $kQ/R^2$ at $r=R$, then a curve falling as $1/r^2$ (equal to one quarter of the peak at $r=2R$).",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The field rises linearly from zero at the center to $r=R$", ["linear rise from the origin"], err=["draws a field that is zero everywhere inside as for a conductor"]),
              R("A3", "graph", "The field is continuous at $r=R$ with the labeled value $kQ/R^2$", ["peak at r = R", "kQ/R^2"], err=["places the peak at a different radius"]),
              R("A4", "graph", "Beyond $R$ the field decreases as $1/r^2$ (about one quarter of the peak at $2R$)", ["inverse-square decay"], requires="A3", err=["draws a linear decrease"])]),
        part("B", "Use Gauss's law to derive an expression for the magnitude of the electric field inside the sphere, at a distance $r<R$ from the center, in terms of $k$, $Q$, $R$ and $r$.", 3, "derive", ["2.A"],
             "A spherical Gaussian surface of radius $r$ encloses $Q(r/R)^3$, so $E\\,4\\pi r^2=Q(r/R)^3/\\varepsilon_0$ and $E=kQr/R^3$.",
             [R("B1", "expression", "Chooses a concentric spherical Gaussian surface and writes the flux $E\\,4\\pi r^2$", ["E 4 pi r^2"], err=["uses a cylindrical Gaussian surface"]),
              R("B2", "expression", "Finds the enclosed charge $Q(r/R)^3$ from the uniform density", ["Q (r/R)^3"], requires="B1", err=["uses the whole charge $Q$ as the enclosed charge"]),
              R("B3", "expression", "Obtains $E=kQr/R^3$", ["k Q r / R^3"], requires="B2", err=["obtains $kQ/r^2$"])]),
        part("C", "Calculate the magnitude of the potential difference between the center of the sphere and its surface.", 3, "calculate", ["2.A", "2.B"],
             f"$|\\Delta V|=\\int_0^R kQr/R^3\\,dr=kQ/(2R)\\approx{dV:.1f}\\text{{ V}}$.",
             [R("C1", "expression", "Sets up $\\Delta V=-\\int E\\,dr$ with the interior field from part B", ["integral of kQr/R^3 dr"], requires="B3", err=["uses the exterior field $kQ/r^2$ inside"]),
              R("C2", "expression", "Integrates to obtain $kQ/(2R)$", ["k Q / (2 R)"], requires="C1", err=["obtains $kQ/R$"]),
              R("C3", "numeric", f"Obtains about {dV:.1f} with units of volts (accept any value within 2 percent)", [f"{dV:.1f}", "V"], requires="C2", nums=True, units=True)]),
        part("D", "A second sphere has twice the radius and twice the total charge of the first (uniform volume charge). By what factor does the magnitude of the electric field at its surface differ from that at the surface of the first sphere? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The field at the surface is $kQ/R^2$; doubling both $Q$ and $R$ gives $2/4=1/2$, so the surface field is half as large.",
             [R("D1", "numeric", "States that the surface field is one half of the original", ["one half", "0.5"], nums=True, err=["states that the field is doubled", "states that the field is unchanged"]),
              R("D2", "justification", "Justifies with $E_{surface}=kQ/R^2$, with the factor $2$ from the charge and $1/4$ from the radius", ["kQ/R^2", "factors 2 and 1/4"], requires="D1", err=["argues only that a larger charge gives a larger field"])]),
    ]
    return _pack("pef_tbr_gauss_er", "tbr", "8.6", ["8.3", "9.2"], "1.C", "Field of a uniformly charged sphere: graph, Gauss's law and potential difference", stim, parts, 12, 27, [f"Rc={Rc}", f"Qn={Qn}", f"Es={Es:.4f}", f"dV={dV:.4f}", f"Ehalf={Ehalf:.4f}"],
                 [_ev("A", "peak field at the surface", Es, 0.02 * Es + 1.0, "N/C"), _ev("C", "potential difference center to surface", dV, 0.02 * dV + 0.1, "V")],
                 ("Sketching the field of a uniformly charged sphere, deriving the interior field with Gauss's law, integrating for a potential difference, and predicting a scaling", ["Sketch E(r) with the interior linear rise and the exterior inverse-square fall", "Derive the interior field with Gauss's law", "Integrate the field for the potential difference and scale the surface field"],
                  [("the charge density is uniform and the sphere is isolated in vacuum", "the stimulus states a uniform volume charge in vacuum")], {"type": "text", "must_include": ["the radius", "the total charge"]},
                  "sympy integrates the interior field; a Simpson integration recomputes the potential difference; the surface field scaling follows from the closed form"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= TBR (12): RL 회로의 전류 =======================
def pef_tbr_rl_current(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Rr = pick(rng, [10.0, 20.0, 40.0]); L = pick(rng, [0.2, 0.4, 0.5, 1.0]); n = pick(rng, [1.0, 2.0])
        tau = L / Rr; tt = n * tau; Imax = e / Rr; I = Imax * (1 - math.exp(-n)); didt0 = e / L
        y = rk4(lambda t0, s: np.array([(e - Rr * s[0]) / L]), [0.0], 0.0, tt, 4000); agree(I, y[0], 1e-6, "I")
        break
    stim = {"kind": "text", "description": f"A battery of emf $\\varepsilon={e:g}\\text{{ V}}$ and negligible internal resistance, a resistor $R={Rr:g}\\,\\Omega$, an ideal inductor $L={L:g}\\text{{ H}}$ and a switch are connected in series. There is no current at $t=0$, when the switch is closed. Blank axes are provided on the answer sheet.", "data": {}}
    parts = [
        part("A", "On the axes provided, sketch the current $I$ in the circuit as a function of time $t$ from $t=0$ to about five time constants. Label the final value of the current and the time constant in terms of $\\varepsilon$, $R$ and $L$.", 4, "graph", ["1.C", "1.B"],
             "A curve that starts at zero with its steepest slope, bends over, and approaches the final value $\\varepsilon/R$ without exceeding it; the time constant $L/R$ is marked where the current is about 63 percent of the final value.",
             [R("A1", "graph", "Axes are labeled with quantities and units", ["axis labels", "units"]),
              R("A2", "graph", "The current starts at zero at $t=0$ and increases with a decreasing slope", ["starts at zero", "decreasing slope"], err=["draws a straight line"]),
              R("A3", "graph", "The curve approaches the labeled final value $\\varepsilon/R$ as a horizontal asymptote", ["final value epsilon / R"], err=["draws a curve that overshoots the final value"]),
              R("A4", "graph", "Marks the time constant $L/R$ (the current is about 63 percent of the final value there)", ["tau = L/R", "63 percent"], requires="A3", err=["marks $RL$ as the time constant"])]),
        part("B", "Use Kirchhoff's loop rule to derive an expression for the current $I(t)$ in terms of $\\varepsilon$, $R$, $L$ and $t$.", 3, "derive", ["2.A"],
             "$\\varepsilon-IR-L\\,dI/dt=0$; separating variables and integrating with $I(0)=0$ gives $I(t)=(\\varepsilon/R)\\left(1-e^{-Rt/L}\\right)$.",
             [R("B1", "expression", "Writes the loop equation $\\varepsilon-IR-L\\,dI/dt=0$", ["epsilon - I R - L dI/dt = 0"], err=["omits the inductor's emf"]),
              R("B2", "expression", "Separates variables and integrates with $I(0)=0$", ["separate and integrate"], requires="B1", err=["uses a different initial condition"]),
              R("B3", "expression", "Obtains $I(t)=(\\varepsilon/R)(1-e^{-Rt/L})$", ["(epsilon/R)(1 - e^(-R t/L))"], requires="B2", err=["obtains $e^{-Lt/R}$ in the exponent"])]),
        part("C", f"Calculate the current at $t={tt * 1e3:g}\\text{{ ms}}$ and the rate of change of the current $dI/dt$ at $t=0$.", 3, "calculate", ["2.B"],
             f"$I=(\\varepsilon/R)(1-e^{{-Rt/L}})\\approx{I * 1e3:.0f}\\text{{ mA}}$ and $dI/dt(0)=\\varepsilon/L={didt0:g}\\text{{ A/s}}$.",
             [R("C1", "numeric", f"Obtains a current of about {I * 1e3:.0f} with units of milliamperes (accept any value within 2 percent)", [f"{I * 1e3:.0f}", "mA"], requires="B3", nums=True, units=True, err=["uses the final current"]),
              R("C2", "expression", "Notes that at $t=0$ there is no current through $R$, so the inductor's emf equals $\\varepsilon$: $L\\,dI/dt=\\varepsilon$", ["L dI/dt = epsilon at t = 0"], err=["says that the rate of change is zero at $t=0$"]),
              R("C3", "numeric", f"Obtains $dI/dt=\\varepsilon/L={didt0:g}$ with units of amperes per second", [f"{didt0:g}", "A/s"], requires="C2", nums=True, units=True)]),
        part("D", "The inductor is replaced by one with twice the inductance. Does the final current change? By what factor does the time needed to reach 63 percent of the final current change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             "The final current $\\varepsilon/R$ does not depend on $L$, so it is unchanged; the time constant $L/R$ doubles, so the time doubles.",
             [R("D1", "claim", "States that the final current is unchanged and the time doubles", ["unchanged", "doubles"], err=["states that the final current is halved"]),
              R("D2", "justification", "Justifies with $I_{final}=\\varepsilon/R$ (independent of $L$) and $\\tau=L/R$ (proportional to $L$)", ["I_final = epsilon/R", "tau proportional to L"], requires="D1", err=["argues only that a larger inductor opposes the current more"])]),
    ]
    return _pack("pef_tbr_rl_current", "tbr", "13.5", ["13.4", "11.2"], "1.C", "Current in an RL circuit: graph, derivation and prediction", stim, parts, 12, 27, [f"e={e}", f"Rr={Rr}", f"L={L}", f"n={n}", f"I={I:.5f}", f"didt0={didt0:.4f}"],
                 [_ev("C", "current", I * 1e3, 0.02 * I * 1e3 + 0.5, "mA"), _ev("C", "rate of change at t=0", didt0, 0.02 * didt0 + 0.05, "A/s")],
                 ("Sketching the growth of the current in an RL circuit, deriving it with the loop rule, calculating values, and predicting the effect of a larger inductance", ["Sketch the exponential approach to the final current", "Derive the current with the loop rule", "Calculate the current and its initial rate of change", "Predict the effect of doubling L"],
                  [("the battery is ideal and the inductor has no resistance", "the stimulus states an ideal battery and an ideal inductor")], {"type": "text", "must_include": ["the emf", "the resistance", "the inductance"]},
                  "an RK4 integration of the loop equation recomputes the current at the stated time; sympy solves the differential equation"),
                 ["representation_reading", "symbolic_reasoning", "justification"])


# ======================= LAB (10): RC 방전과 시간 상수 =======================
def pef_lab_rc_time_constant(rng):
    ts = [0.0, 10.0, 20.0, 30.0, 40.0, 50.0]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); Rk = pick(rng, [10.0, 20.0, 50.0]); Cu = pick(rng, [2.0, 5.0, 10.0]); V0 = pick(rng, [6.0, 9.0, 12.0])
        tau = Rk * 1e3 * Cu * 1e-6 * 1e3  # ms
        Vs = [round(V0 * math.exp(-t / tau) * (1 + r2.uniform(-0.02, 0.02)), 3) for t in ts]
        lnV = [math.log(v) for v in Vs]; slope, icpt = np.polyfit(ts, lnV, 1); Xn = np.array([[t, 1.0] for t in ts]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(lnV)); agree(slope, beta[0], 1e-9, "slope")
        C_est = -1 / (slope * 1e3 * Rk * 1e3) * 1e6
        if abs(C_est - Cu) / Cu < 0.08 and 0.5 < tau < 200:
            break
    stim = {"kind": "table", "description": f"A student charges a capacitor of unknown capacitance $C$ to a potential difference of about ${V0:g}\\text{{ V}}$ and then discharges it through a resistor of resistance $R={Rk:g}\\text{{ k}}\\Omega$. A voltmeter connected across the capacitor is read at intervals of $10\\text{{ ms}}$ after the discharge starts.", "data": {"x_label": "Time t (ms)", "y_label": "Capacitor voltage V (V)", "rows": [[t, v_] for t, v_ in zip(ts, Vs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the capacitor voltage as a function of time during the discharge. Include the equipment and the measurements, how the independent variable is controlled, and one way to reduce the uncertainty in the voltage readings.", 3, "design", ["3.A", "2.B"],
             "Charge the capacitor from a source, then close a switch to discharge it through the known resistor; read the voltmeter across the capacitor at equal time intervals measured with a stopwatch or record it with a data logger; use a high-impedance voltmeter so it does not discharge the capacitor, and repeat the run and average the readings.",
             [R("A1", "design", "Identifies the circuit (charged capacitor, known resistor, switch) and a voltmeter across the capacitor read at known times", ["capacitor, resistor and voltmeter across the capacitor", "times measured"], err=["places the voltmeter in series with the capacitor"]),
              R("A2", "design", "Controls the time by reading at equal intervals (with a timer or data logger) while keeping $R$ and $C$ the same", ["equal time intervals", "same R and C"]),
              R("A3", "design", "Reduces the uncertainty by repeating the run and averaging, or by using a high-impedance voltmeter or a data logger (any one earns the point)", ["repeat and average or high-impedance voltmeter or data logger (any one earns the point)"])]),
        part("B", "For a discharging capacitor $V=V_0e^{-t/RC}$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to determine $C$.", 1, "explain", ["2.B", "3.A"],
             "Taking the natural logarithm gives $\\ln V=\\ln V_0-t/(RC)$: plot $\\ln V$ on the vertical axis against $t$ on the horizontal axis; the slope is $-1/(RC)$.",
             [R("B1", "expression", "Identifies $\\ln V$ (vertical) versus $t$ (horizontal), with slope $-1/(RC)$", ["ln V versus t"], err=["plots V versus t"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in the form identified in part B and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(t,\\ln V)$: {', '.join(f'({t:g}, {lv:.3f})' for t, lv in zip(ts, lnV))} with a best-fit line of slope about ${slope:.4f}\\text{{ ms}}^{{-1}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the six points $(t,\\ln V)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line with a negative slope through the trend of the points", ["best-fit line with negative slope"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the capacitance $C$ of the capacitor. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $-1/(RC)\\approx{slope:.4f}\\text{{ ms}}^{{-1}}={slope * 1e3:.2f}\\text{{ s}}^{{-1}}$, so $C=-1/(R\\cdot\\text{{slope}})\\approx{C_est:.1f}\\,\\mu\\text{{F}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.4f} per millisecond; accept any value within 5 percent)", [f"{slope:.4f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $C$: slope $=-1/(RC)$ so $C=-1/(R\\cdot\\text{slope})$ (with the time converted to seconds)", ["C = -1 / (R slope)"], err=["uses $C=\\text{slope}/R$"]),
              R("D3", "numeric", f"Obtains $C$ of about {C_est:.1f} with units of microfarads (accept any value consistent with the student's own slope from D1)", [f"{C_est:.1f}", "microfarads"], alt=["a value of C consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pef_lab_rc_time_constant", "lab", "11.8", ["10.3", "11.3"], "3.A", "Experiment: capacitance from the discharge of a capacitor", stim, parts, 10, 27, [f"Rk={Rk}", f"Cu={Cu}", f"V0={V0}", f"slope={slope:.6f}", f"C_est={C_est:.4f}", f"Vs={Vs}"],
                 [_ev("D", "slope of ln V versus t", slope, 0.05 * abs(slope), "1/ms"), _ev("D", "capacitance", C_est, 0.08 * Cu, "microfarads")],
                 ("Designing an experiment and linearizing exponential discharge data to extract the capacitance from the slope of ln V versus t", ["Describe the circuit and the voltage readings at known times", "Linearize $V=V_0e^{-t/RC}$ with a logarithm and plot the data", "Use the slope to determine the capacitance"],
                  [("the generated voltages follow $V=V_0e^{-t/RC}$ with a small random error so the fitted capacitance is within eight percent of the generating value", "the code rejects a seed whose fitted capacitance differs from the generating value by more than eight percent")], {"type": "table", "must_include": ["time", "capacitor voltage"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted capacitance is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= LAB (10): 평행판 축전기의 간격과 전기용량 =======================
def pef_lab_capacitor_gap(rng):
    ds_ = [1.0, 1.5, 2.0, 3.0, 4.0]
    for _ in forever():
        r2 = random.Random(rng.randrange(10 ** 9)); Acm = pick(rng, [100.0, 200.0, 400.0]); A = Acm * 1e-4
        Cs = [round(EPS0 * A / (d * 1e-3) * 1e12 * (1 + r2.uniform(-0.02, 0.02)), 2) for d in ds_]
        inv = [1 / d for d in ds_]; slope, icpt = np.polyfit(inv, Cs, 1); Xn = np.array([[v, 1.0] for v in inv]); beta = np.linalg.solve(Xn.T @ Xn, Xn.T @ np.array(Cs)); agree(slope, beta[0], 1e-9, "slope")
        e0 = slope * 1e-12 * 1e-3 / A
        if abs(e0 - EPS0) / EPS0 < 0.06:
            break
    stim = {"kind": "table", "description": f"A student measures the capacitance $C$ of a parallel-plate capacitor with vacuum between its two identical square plates, each of area $A={Acm:g}\\text{{ cm}}^{{2}}$ at several plate separations $d$.", "data": {"x_label": "Plate separation d (mm)", "y_label": "Capacitance C (pF)", "rows": [[d, c_] for d, c_ in zip(ds_, Cs)]}}
    stim["data"]["notes"] = [stim["description"]]
    parts = [
        part("A", "Describe an experimental procedure to collect the data for the capacitance as a function of the plate separation. Include the equipment and the measurements, how the independent variable is changed, and one way to reduce the uncertainty in the separation.", 3, "design", ["3.A", "2.B"],
             "Mount the plates parallel on insulating supports, set each separation with spacers of known thickness or a micrometer, measure the capacitance with a capacitance meter, keep the area and the dielectric (air) the same; reduce the uncertainty in the separation by measuring it at several points around the plates and averaging, or by using a micrometer.",
             [R("A1", "design", "Identifies how the separation is set and measured and how the capacitance is measured (a capacitance meter or equivalent)", ["a way to set and measure the separation and a way to measure C"], err=["omits how the capacitance is measured"]),
              R("A2", "design", "Changes only the separation while keeping the plate area and the material between the plates the same, and keeps the plates parallel", ["change only the separation, same area and material"]),
              R("A3", "design", "Reduces the uncertainty in the separation by measuring at several places and averaging, or by using spacers of known thickness or a micrometer (any one earns the point)", ["measure at several places and average or spacers or micrometer (any one earns the point)"])]),
        part("B", "For an ideal parallel-plate capacitor $C=\\varepsilon_0A/d$. Identify the quantities that should be plotted on the vertical and horizontal axes so that the data produce a straight line whose slope can be used to determine $\\varepsilon_0$.", 1, "explain", ["2.B", "3.A"],
             "Plot $C$ on the vertical axis against $1/d$ on the horizontal axis; the slope is $\\varepsilon_0A$.",
             [R("B1", "expression", "Identifies $C$ (vertical) versus $1/d$ (horizontal), with slope $\\varepsilon_0A$", ["C versus 1/d"], err=["plots C versus d"])]),
        part("C", "On a blank grid whose scale you choose, plot the data in the form identified in part B and draw a best-fit line. Label the axes with quantities and units and use a scale that fills most of the grid.", 3, "graph", ["1.B", "3.A"],
             f"Points $(1/d,C)$: {', '.join(f'({v:.3f}, {c_:.2f})' for v, c_ in zip(inv, Cs))} with a best-fit line of slope about ${slope:.1f}\\text{{ pF}}\\cdot\\text{{mm}}$.",
             [R("C1", "graph", "Axes are labeled with quantities and units and the scale fills most of the grid", ["axis labels", "units", "scale"], err=["scale uses less than half the grid"]),
              R("C2", "graph", "Plots the five points $(1/d, C)$ accurately", ["points plotted"], nums=True),
              R("C3", "graph", "Draws a straight best-fit line through the trend of the points", ["best-fit line"], err=["connects the dots"])]),
        part("D", "Use the best-fit line to determine the experimental value of the permittivity of free space $\\varepsilon_0$. Show your work.", 3, "calculate", ["2.B", "2.D"],
             f"The slope is $\\varepsilon_0A\\approx{slope:.1f}\\text{{ pF}}\\cdot\\text{{mm}}={slope * 1e-15:.3g}\\text{{ F}}\\cdot\\text{{m}}$, so $\\varepsilon_0=\\text{{slope}}/A\\approx{e0:.3g}\\text{{ F/m}}$.",
             [R("D1", "numeric", f"Calculates the slope of the best-fit line using two points on the line (about {slope:.1f} pF·mm; accept any value within 5 percent)", [f"{slope:.1f}"], requires="C3", nums=True, err=["uses data points rather than points on the line"]),
              R("D2", "expression", "Relates the slope to $\\varepsilon_0$: $\\varepsilon_0=\\text{slope}/A$ (with pF·mm converted to F·m and the area in square meters)", ["epsilon_0 = slope / A"], err=["uses $\\varepsilon_0=\\text{slope}\\cdot A$"]),
              R("D3", "numeric", f"Obtains $\\varepsilon_0$ of about {e0:.3g} with units of farads per meter (accept any value consistent with the student's own slope from D1)", [f"{e0:.3g}", "F/m"], alt=["a value of epsilon_0 consistent with the student's own slope from D1"], nums=True, units=True)]),
    ]
    return _pack("pef_lab_capacitor_gap", "lab", "10.3", ["10.1", "8.6"], "3.A", "Experiment: permittivity of free space from a parallel-plate capacitor", stim, parts, 10, 27, [f"Acm={Acm}", f"slope={slope:.5f}", f"e0={e0:.6g}", f"Cs={Cs}"],
                 [_ev("D", "slope", slope, 0.05 * slope, "pF*mm"), _ev("D", "permittivity of free space", e0, 0.08 * EPS0, "F/m")],
                 ("Designing an experiment and linearizing capacitance data to extract the permittivity of free space from the slope of C versus 1/d", ["Describe how the separation is set and the capacitance is measured", "Linearize $C=\\varepsilon_0A/d$ and plot C versus 1/d", "Use the slope and the plate area to determine epsilon_0"],
                  [("the generated capacitances follow $C=\\varepsilon_0A/d$ with a small random error so the fitted permittivity is within six percent of the generating value", "the code rejects a seed whose fitted permittivity differs from the generating value by more than six percent")], {"type": "table", "must_include": ["plate separation", "capacitance"]},
                  "the slope is recomputed from the normal equations with numpy linalg.solve and compared with polyfit; the fitted permittivity is compared with the generating value"),
                 ["representation_reading", "quantitative_comparison", "design"])


# ======================= QQT (8): 양성자의 최근접 거리 =======================
def pef_qqt_closest_approach(rng):
    for _ in forever():
        Z = pick(rng, [2, 3, 4]); v = pick(rng, [4.0, 5.0, 8.0]) * 1e6; Zq = Z * QE
        rmin = K * Zq * QE / (0.5 * MP * v * v)
        agree(rmin, bisect(lambda s: K * Zq * QE / s - 0.5 * MP * v * v, 1e-18, 1.0), 1e-9, "r")
        break
    r2 = K * (2 * Zq) * QE / (0.5 * MP * v * v)
    stim = {"kind": "text", "description": f"A proton moves directly toward the center of a fixed nucleus of charge $+Ze$ with $Z={Z}$ (treated as a point charge) from a very large distance with speed $v={v / 1e6:g}\\times10^{{6}}\\text{{ m/s}}$. Use {KP}, $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_p=1.67\\times10^{{-27}}\\text{{ kg}}$.", "data": {}}
    parts = [
        part("A", "A student claims that if the proton's initial speed is doubled, the distance of closest approach to the nucleus is cut in half. Do you agree or disagree with the claim? Justify your answer using conservation of energy.", 3, "explain", ["3.B", "3.C"],
             "Disagree. At the turning point all of the initial kinetic energy $\\tfrac12mv^2$ has become electric potential energy $kq_1q_2/r$, so $r\\propto1/v^2$ and doubling the speed cuts the distance to one quarter.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees that the distance is halved"]),
              R("A2", "justification", "Justifies by equating the initial kinetic energy with the electric potential energy at the turning point", ["kinetic energy equals potential energy at the turning point"], err=["uses the force instead of the energy"]),
              R("A3", "justification", "Shows that the kinetic energy depends on $v^2$ while the potential energy depends on $1/r$, so $r\\propto1/v^2$", ["r proportional to 1/v^2"], requires="A2", err=["concludes $r\\propto1/v$"])]),
        part("B", "Derive an expression for the distance of closest approach in terms of $k$, $Z$, $e$, $m_p$ and $v$, and calculate its value.", 3, "derive", ["2.A", "2.B"],
             f"$\\tfrac12m_pv^2=k(Ze)(e)/r_{{min}}$ gives $r_{{min}}=2kZe^2/(m_pv^2)\\approx{rmin:.3g}\\text{{ m}}$.",
             [R("B1", "expression", "Writes the energy balance $\\tfrac12m_pv^2=k(Ze)e/r_{min}$ (initial potential energy is zero)", ["1/2 m v^2 = k Z e^2 / r"], err=["uses $kZe^2/r^2$ for the potential energy"]),
              R("B2", "expression", "Solves for $r_{min}=2kZe^2/(m_pv^2)$", ["2 k Z e^2 / (m v^2)"], requires="B1", err=["omits the factor of 2"]),
              R("B3", "numeric", f"Obtains about {rmin:.3g} with units of meters (accept any value within 2 percent)", [f"{rmin:.3g}", "m"], requires="B2", nums=True, units=True)]),
        part("C", f"The same proton is shot at a nucleus of charge $+{2 * Z}e$ with the same initial speed. Predict the distance of closest approach compared with the original and justify your prediction.", 2, "explain", ["2.D", "3.B"],
             f"The distance doubles to about ${r2:.3g}\\text{{ m}}$, because $r_{{min}}\\propto Z$ at fixed speed.",
             [R("C1", "numeric", "States that the distance of closest approach doubles", ["doubles", "factor of 2"], nums=True, err=["states that the distance is halved", "states that it is unchanged"]),
              R("C2", "justification", "Justifies with $r_{min}=2kZe^2/(m_pv^2)$ (directly proportional to the nuclear charge)", ["r proportional to Z"], requires="C1", err=["argues only that a stronger repulsion keeps the proton farther away"])]),
    ]
    return _pack("pef_qqt_closest_approach", "qqt", "9.3", ["9.1", "8.1"], "3.B", "Closest approach of a proton to a nucleus", stim, parts, 8, 16, [f"Z={Z}", f"v={v}", f"rmin={rmin:.6g}", f"r2={r2:.6g}"],
                 [_ev("B", "distance of closest approach", rmin, 0.02 * rmin, "m")],
                 ("Using conservation of energy to decide how the distance of closest approach depends on the speed and the nuclear charge", ["Equate the initial kinetic energy with the potential energy at the turning point", "Derive and evaluate the distance", "Predict the effect of a larger nuclear charge"],
                  [("only the electric force acts and the nucleus stays fixed", "the stimulus states a fixed point nucleus and only the electric force")], {"type": "text", "must_include": ["the nuclear charge", "the proton speed"]},
                  "a bisection root finder solves the energy balance for the turning point and recomputes the distance"),
                 ["law_selection", "justification", "symbolic_reasoning"])


# ======================= QQT (8): 레일 위를 움직이는 막대 =======================
def pef_qqt_motional_emf(rng):
    for _ in forever():
        B = pick(rng, [0.20, 0.50, 1.0]); L = pick(rng, [0.20, 0.50, 1.0]); v = pick(rng, [2.0, 4.0, 5.0]); Rr = pick(rng, [2.0, 4.0, 5.0])
        emf = B * L * v; I = emf / Rr; F = I * L * B; P = F * v
        agree(P, emf ** 2 / Rr, 1e-9, "P")
        break
    stim = {"kind": "text", "description": f"A conducting rod of length $L={L:g}\\text{{ m}}$ slides at constant speed $v={v:g}\\text{{ m/s}}$ along two parallel, frictionless conducting rails connected at one end by a resistor $R={Rr:g}\\,\\Omega$. A uniform magnetic field of magnitude $B={B:g}\\text{{ T}}$ is perpendicular to the plane of the rails. The rod and the rails have negligible resistance.", "data": {}}
    parts = [
        part("A", "A student claims that no external force is needed to keep the rod moving at constant speed, because the net force on an object moving at constant velocity is zero and the rails are frictionless. Do you agree or disagree with the claim? Justify your answer.", 3, "explain", ["3.B", "3.C"],
             "Disagree. The motion induces an emf and a current in the circuit, and the magnetic force on that current opposes the motion (Lenz's law), so an external force equal and opposite to it is needed to keep the net force zero.",
             [R("A1", "claim", "Disagrees with the claim", ["disagree"], err=["agrees because the speed is constant"]),
              R("A2", "justification", "Justifies the claim by explaining that the motion changes the flux, inducing an emf and a current in the rod", ["induced emf and current"], err=["says there is no current because the speed is constant"]),
              R("A3", "justification", "Explains that the magnetic force on the induced current opposes the motion, so an external force of equal magnitude is needed", ["magnetic force opposes the motion", "external force needed"], requires="A2", err=["says the magnetic force is in the direction of the motion"])]),
        part("B", "Derive an expression for the magnitude of the external force needed to keep the rod moving at constant speed in terms of $B$, $L$, $v$ and $R$, and calculate its value.", 3, "derive", ["2.A", "2.B"],
             f"$\\varepsilon=BLv$, $I=\\varepsilon/R$ and $F=ILB=B^2L^2v/R\\approx{F:.3g}\\text{{ N}}$.",
             [R("B1", "expression", "Writes the motional emf $\\varepsilon=BLv$ and the current $I=\\varepsilon/R$", ["epsilon = B L v", "I = epsilon / R"], err=["writes the emf as $Bv/L$"]),
              R("B2", "expression", "Writes the magnetic force on the rod $F=ILB$ and obtains $F=B^2L^2v/R$", ["B^2 L^2 v / R"], requires="B1", err=["obtains $B^2Lv/R$"]),
              R("B3", "numeric", f"Obtains about {F:.3g} with units of newtons (accept any value within 2 percent)", [f"{F:.3g}", "N"], requires="B2", nums=True, units=True)]),
        part("C", "The rod is now pulled at twice the speed. By what factor does the power supplied by the external force change? Justify your answer.", 2, "explain", ["2.D", "3.B"],
             f"The force is proportional to $v$ and the power $P=Fv$ is proportional to $v^2$, so the power increases by a factor of 4 (from ${P:.3g}\\text{{ W}}$ to ${4 * P:.3g}\\text{{ W}}$).",
             [R("C1", "numeric", "States that the power increases by a factor of 4", ["factor of 4", "increases"], nums=True, err=["states that the power doubles", "states that the power is unchanged"]),
              R("C2", "justification", "Justifies with $P=Fv$ and $F\\propto v$, or with $P=\\varepsilon^2/R$ and $\\varepsilon\\propto v$", ["P proportional to v^2"], requires="C1", err=["argues only that faster motion needs more power"])]),
    ]
    return _pack("pef_qqt_motional_emf", "qqt", "13.3", ["13.2", "11.4"], "3.B", "Rod pulled along rails in a magnetic field", stim, parts, 8, 16, [f"B={B}", f"L={L}", f"v={v}", f"Rr={Rr}", f"F={F:.6g}", f"P={P:.6g}"],
                 [_ev("B", "external force", F, 0.02 * F + 0.001, "N")],
                 ("Using Lenz's law and the motional emf to decide whether an external force is needed at constant speed, deriving the force and predicting the power at a different speed", ["Explain why the induced current produces an opposing magnetic force", "Derive the force from the emf and the current", "Predict how the power depends on the speed"],
                  [("the rails are frictionless and the rod and rails have negligible resistance", "the stimulus states frictionless rails and negligible rod resistance")], {"type": "text", "must_include": ["the rod length", "the field", "the speed", "the resistance"]},
                  "the force is recomputed from the power balance $Fv=\\varepsilon^2/R$"),
                 ["law_selection", "justification", "symbolic_reasoning"])


STAGE_FRQ = ["pef_mr_ring_field", "pef_tbr_gauss_er", "pef_lab_rc_time_constant", "pef_qqt_closest_approach", "pef_mr_rc_circuit", "pef_tbr_rl_current", "pef_lab_capacitor_gap", "pef_qqt_motional_emf"]
