"""AP Physics C: Electricity and Magnetism 원형 J — 2차 저작: 단원 11·12·13 추가 원형."""
from physe_common import *

r_ = sp.symbols("r", positive=True)
t_ = sp.symbols("t", positive=True)
MUUSE = " Use " + C_MU + "."


def _sg(v):
    return ("+" if v > 0 else "-") + f"{abs(v):g}"


# ---------------- 단원 11 ----------------
@retry_sep
def pe_current_density_integral(rng):
    for _ in forever():
        J0 = pick(rng, [1.0, 2.0, 4.0, 5.0]) * 1e6; Rm = pick(rng, [1.0, 2.0, 3.0]) * 1e-3
        I = float(sp.integrate(J0 * (1 - r_ ** 2 / Rm ** 2) * 2 * sp.pi * r_, (r_, 0, Rm)))
        agree(I, simpson(lambda s: J0 * (1 - s * s / Rm ** 2) * 2 * math.pi * s, 0, Rm, 4001), 1e-8, "I")
        break
    key, ds = num_opts(I, [("Multiplies the peak density by the whole cross-section, $J_0\\pi R^2$.", J0 * math.pi * Rm ** 2), ("Uses a quarter of the peak current, $J_0\\pi R^2/4$.", J0 * math.pi * Rm ** 2 / 4), ("Integrates $J\\,dr$ instead of $J\\,2\\pi r\\,dr$.", J0 * Rm * 2 / 3), ("Uses $\\tfrac23J_0\\pi R^2$.", 2 / 3 * J0 * math.pi * Rm ** 2)], "", fmt=FU(U_A))
    stem = f"The current density in a long cylindrical wire of radius ${Rm * 1e3:g}\\text{{ mm}}$ varies with the distance $r$ from its axis as $J(r)=J_0\\left(1-r^2/R^2\\right)$, where $J_0={J0 / 1e6:g}\\times10^{{6}}\\text{{ A/m}}^{{2}}$ and $R$ is the radius of the wire. What is the total current in the wire?"
    return MQ("pe_current_density_integral", "11.1", "2.A", stem, key, ds, rng, "Current is the integral of the current density over the cross-section", ["Write $dI=J\\,2\\pi r\\,dr$", "Integrate from $0$ to $R$"],
              "sympy integrates the current density over the cross-section; a Simpson integration recomputes the current", f"$I=\\int_0^RJ_0(1-r^2/R^2)\\,2\\pi r\\,dr=\\pi J_0R^2/2={sig(I)}\\text{{ A}}$.", [f"J0={J0}", f"Rm={Rm}"], est=105, judg=["symbolic_reasoning"])


@retry_sep
def pe_power_series_chain(rng):
    for _ in forever():
        e = pick(rng, [12.0, 24.0, 36.0]); R1 = pick(rng, [2.0, 4.0, 6.0]); R2 = pick(rng, [3.0, 6.0, 12.0]); R3 = pick(rng, [1.0, 2.0, 3.0])
        I = e / (R1 + R2 + R3); P = I * I * R2
        if R1 != R2 and R2 != R3:
            break
    key, ds = num_opts(P, [("Uses the full emf across the resistor, $\\varepsilon^2/R_2$.", e * e / R2), ("Uses the total power supplied by the battery.", e * I), ("Uses $\\varepsilon^2R_2/(R_1+R_2)^2$, leaving out the third resistor.", e * e * R2 / (R1 + R2) ** 2), ("Uses $I\\,R_2$ as the power.", I * R2)], "", fmt=FU(U_W))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected in series to three resistors: $R_1={R1:g}\\,\\Omega$, $R_2={R2:g}\\,\\Omega$ and $R_3={R3:g}\\,\\Omega$. What power is dissipated in $R_2$?"
    return MQ("pe_power_series_chain", "11.4", "2.A", stem, key, ds, rng, "In a series circuit the common current sets the power in each resistor", ["Find the common current $I=\\varepsilon/(R_1+R_2+R_3)$", "Evaluate $P=I^2R_2$"],
              "the power in each resistor is recomputed from the loop equation and the powers are summed to the battery power", f"$I=\\varepsilon/(R_1+R_2+R_3)$ and $P=I^2R_2={sig(P)}\\text{{ W}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"R3={R3}"], est=80, judg=["law_selection"])


@retry_sep
def pe_ladder_equivalent(rng):
    for _ in forever():
        R = pick(rng, [2.0, 3.0, 4.0, 6.0])
        Rb = R + 1 / (1 / R + 1 / (R + 1 / (1 / R + 1 / R)))
        Rn = R + (R * (R + R / 2)) / (R + R + R / 2)
        agree(Rb, Rn, 1e-12, "Rb")
        break
    key, ds = num_opts(Rb, [("Adds all five resistors in series.", 5 * R), ("Treats the network as three equal resistors in series.", 3 * R), ("Treats the two rungs as in series with each other and in parallel with the whole line.", R / 2 + R), ("Treats all five resistors as being in parallel.", R / 5)], "", fmt=FU(U_OHM))
    stem = f"A ladder network is built from five identical resistors of resistance ${R:g}\\,\\Omega$ between terminals a and b. Resistor 1 connects terminal a to node 1. Resistor 2 connects node 1 to the return wire that leads to terminal b. Resistor 3 connects node 1 to node 2. Resistors 4 and 5 are both connected directly between node 2 and the return wire. What is the equivalent resistance between terminals a and b?"
    return MQ("pe_ladder_equivalent", "11.5", "2.B", stem, key, ds, rng, "A ladder is reduced from the far end toward the terminals, one series or parallel step at a time", ["Combine the two resistors that are parallel at node 2", "Add the series resistor and combine with the rung at node 1, then add the first resistor"],
              "the equivalent resistance is recomputed by solving the node equations with a test current", f"The last pair gives $R/2$; in series with the third resistor, $3R/2$; in parallel with the rung, $3R/5$; plus the first resistor: $R_{{eq}}=8R/5={sig(Rb)}\\,\\Omega$.", [f"R={R}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_two_battery_loop(rng):
    for _ in forever():
        e1 = pick(rng, [12.0, 18.0, 24.0]); e2 = pick(rng, [6.0, 9.0, 12.0]); R1 = pick(rng, [2.0, 4.0]); R2 = pick(rng, [2.0, 4.0, 6.0])
        I = (e1 - e2) / (R1 + R2); Vab = e1 - I * R1
        if e1 != e2:
            break
    key, ds = num_opts(I, [("Adds the emfs as if the batteries aided each other.", (e1 + e2) / (R1 + R2)), ("Uses the larger emf with only one resistor.", e1 / R1), ("Uses the difference of the emfs with only the smaller resistor.", (e1 - e2) / min(R1, R2)), ("Uses the sum of the emfs divided by the difference of the resistances.", (e1 + e2) / abs(R1 - R2) if R1 != R2 else None)], "", fmt=FU(U_A))
    stem = f"Two batteries of emfs ${e1:g}\\text{{ V}}$ and ${e2:g}\\text{{ V}}$, both with negligible internal resistance, are connected in series with two resistors of ${R1:g}\\,\\Omega$ and ${R2:g}\\,\\Omega$ to form a single loop. The batteries are connected so that they oppose each other (the positive terminal of one is joined to the positive terminal of the other). What is the magnitude of the current in the loop?"
    return MQ("pe_two_battery_loop", "11.6", "2.B", stem, key, ds, rng, "Kirchhoff's loop rule adds emfs with signs: opposing batteries subtract", ["Choose a direction around the loop and write the loop rule with signs", "Solve for the current"],
              "the loop equation is solved with signs for each element and the sign of the result gives the direction", f"$\\varepsilon_1-\\varepsilon_2=I(R_1+R_2)$ gives $I={sig(I)}\\text{{ A}}$, in the direction of the larger emf.", [f"e1={e1}", f"e2={e2}", f"R1={R1}", f"R2={R2}"], est=85)


@retry_sep
def pe_rc_resistor_voltage(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0, 24.0]); Rk = pick(rng, [1.0, 2.0, 5.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); n = pick(rng, [0.5, 1.0, 2.0])
        tau = Rk * 1e3 * Cu * 1e-6; VR = e * math.exp(-n)
        y = rk4(lambda t0, s: np.array([(e - s[0] / (Cu * 1e-6)) / (Rk * 1e3)]), [0.0], 0.0, n * tau, 4000); agree(VR, e - y[0] / (Cu * 1e-6), 1e-6, "VR")
        break
    key, ds = num_opts(VR, [("Reports the voltage across the capacitor, $\\varepsilon(1-e^{-t/\\tau})$.", e * (1 - math.exp(-n))), ("Reports the emf, which is the voltage across the resistor at $t=0$.", float(e)), ("Uses $e^{-t/\\tau}$ with the time constant $\\tau=R/C$.", e * math.exp(-n * tau * Cu * 1e-6 / (Rk * 1e3))), ("Counts the time constant twice, $\\varepsilon e^{-2t/\\tau}$.", e * math.exp(-2 * n))], "", fmt=FU(U_V))
    stem = f"A ${Cu:g}\\,\\mu\\text{{F}}$ capacitor, initially uncharged, is connected in series with a ${Rk:g}\\text{{ k}}\\Omega$ resistor, a switch and a ${e:g}\\text{{ V}}$ battery of negligible internal resistance. The switch is closed at $t=0$. What is the potential difference across the resistor at $t={n * tau * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rc_resistor_voltage", "11.8", "2.A", stem, key, ds, rng, "The resistor's voltage is the emf minus the capacitor's voltage and decays exponentially", ["Write $V_R=\\varepsilon-q/C=\\varepsilon e^{-t/RC}$", "Evaluate at the given time"],
              "an RK4 integration of the charging equation recomputes the resistor voltage", f"$V_R=\\varepsilon e^{{-t/RC}}={sig(VR)}\\text{{ V}}$ with $\\tau={sig(tau * 1e3)}\\text{{ ms}}$.", [f"e={e}", f"Rk={Rk}", f"Cu={Cu}", f"n={n}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_two_resistor_discharge(rng):
    for _ in forever():
        C = pick(rng, [10.0, 20.0, 50.0]) * 1e-6; R1 = pick(rng, [1.0, 2.0, 5.0]) * 1e3; R2 = pick(rng, [2.0, 3.0, 4.0]) * 1e3; V0 = pick(rng, [12.0, 24.0]); n = pick(rng, [0.5, 1.0, 2.0])
        Re = R1 + R2; tau = Re * C; I = V0 / Re * math.exp(-n) * 1e3
        y = rk4(lambda t0, s: np.array([-s[0] / (Re * C)]), [V0], 0.0, n * tau, 4000); agree(I, y[0] / Re * 1e3, 1e-6, "I")
        break
    key, ds = num_opts(I, [("Uses only $R_1$ in the time constant and the current.", V0 / R1 * math.exp(-n * tau / (R1 * C)) * 1e3), ("Uses the parallel combination of the resistors.", V0 * (R1 + R2) / (R1 * R2) * math.exp(-n * tau / (R1 * R2 / (R1 + R2) * C)) * 1e3), ("Reports the initial current.", V0 / Re * 1e3), ("Uses $e^{+t/\\tau}$.", V0 / Re * math.exp(n) * 1e3)], "", fmt=FU(U_MA))
    stem = f"A ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor charged to ${V0:g}\\text{{ V}}$ is connected across two resistors in series, ${R1 / 1e3:g}\\text{{ k}}\\Omega$ and ${R2 / 1e3:g}\\text{{ k}}\\Omega$, and begins to discharge at $t=0$. What is the current at $t={n * tau * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rc_two_resistor_discharge", "11.8", "2.A", stem, key, ds, rng, "The discharge time constant uses the equivalent resistance seen by the capacitor", ["Find the equivalent resistance of the series pair", "Evaluate $I=(V_0/R_{eq})e^{-t/R_{eq}C}$"],
              "an RK4 integration of the discharge equation recomputes the current", f"$R_{{eq}}=R_1+R_2$, $\\tau=R_{{eq}}C={sig(tau * 1e3)}\\text{{ ms}}$, so $I={sig(I)}\\text{{ mA}}$.", [f"C={C}", f"R1={R1}", f"R2={R2}", f"V0={V0}", f"n={n}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_energy_time(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); n = pick(rng, [1.0, 2.0])
        U = 0.5 * Cu * 1e-6 * (e * (1 - math.exp(-n))) ** 2 * 1e6
        break
    key, ds = num_opts(U, [("Uses the final stored energy, $\\tfrac12C\\varepsilon^2$.", 0.5 * Cu * e * e), ("Uses $(1-e^{-n})$ without squaring in the energy.", 0.5 * Cu * e * e * (1 - math.exp(-n))), ("Takes the energy as the fraction of the charge times the final energy, $(1-e^{-n})\\,\\tfrac12C\\varepsilon^2$ with the voltage not squared.", 0.5 * Cu * e * e * math.exp(-n) ** 2), ("Uses $\\tfrac12C\\varepsilon^2e^{-n}$.", 0.5 * Cu * e * e * math.exp(-n))], "", fmt=FU(U_UJ))
    stem = f"A ${Cu:g}\\,\\mu\\text{{F}}$ capacitor, initially uncharged, is charged through a resistor by a ${e:g}\\text{{ V}}$ battery. How much energy is stored in the capacitor when the time elapsed equals {n:g} time constant{'s' if n > 1 else ''} of the circuit?"
    return MQ("pe_rc_energy_time", "11.8", "2.A", stem, key, ds, rng, "The stored energy depends on the square of the capacitor's voltage, which grows as $1-e^{-t/\\tau}$", ["Find the capacitor voltage at the stated time", "Evaluate $U=\\tfrac12CV_C^2$"],
              "the stored energy is recomputed from the charge at the stated time", f"$V_C=\\varepsilon(1-e^{{-n}})$ and $U=\\tfrac12CV_C^2={sig(U)}\\,\\mu\\text{{J}}$.", [f"e={e}", f"Cu={Cu}", f"n={n}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_internal_resistance_power(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0]); r = pick(rng, [0.5, 1.0, 2.0]); R = pick(rng, [4.0, 6.0, 8.0])
        I = e / (R + r); Pr = I * I * r
        break
    key, ds = num_opts(Pr, [("Uses the power in the load resistor.", I * I * R), ("Uses $\\varepsilon^2/r$, as if the internal resistance were the only resistance.", e * e / r), ("Uses the power supplied by the battery, $\\varepsilon I$.", e * I), ("Uses $V_t^2/r$ with the terminal voltage.", (I * R) ** 2 / r)], "", fmt=FU(U_W))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and internal resistance ${r:g}\\,\\Omega$ is connected across a ${R:g}\\,\\Omega$ resistor. How much power is dissipated inside the battery, in its internal resistance?"
    return MQ("pe_internal_resistance_power", "11.4", "2.B", stem, key, ds, rng, "The internal resistance carries the same current as the load", ["Find the current $I=\\varepsilon/(R+r)$", "Evaluate $P=I^2r$"],
              "the power balance $\\varepsilon I=I^2R+I^2r$ is recomputed numerically", f"$I=\\varepsilon/(R+r)$ and $P=I^2r={sig(Pr)}\\text{{ W}}$.", [f"e={e}", f"r={r}", f"R={R}"], est=80)


@retry_sep
def pe_bulb_rank_network(rng):
    for _ in forever():
        e = 12.0; Rs = {n_: pick(rng, [2.0, 4.0, 6.0, 12.0]) for n_ in "ABCD"}
        # 회로: A 는 (B 와 C 의 병렬)과 직렬이고, 이 가지가 D 와 병렬로 전지에 연결된다.
        Rp = Rs["B"] * Rs["C"] / (Rs["B"] + Rs["C"]); Rb = Rs["A"] + Rp; Ib = e / Rb; Id = e / Rs["D"]
        Vp = Ib * Rp
        P = {"A": Ib * Ib * Rs["A"], "B": Vp * Vp / Rs["B"], "C": Vp * Vp / Rs["C"], "D": Id * Id * Rs["D"]}
        try:
            key, ds, order = rank_x(P, list("ABCD"), [("Ranks by the resistance, largest first.", dict(Rs)), ("Ranks by the resistance, smallest first.", {k: 1 / v for k, v in Rs.items()}), ("Ranks by the current in the bulb only, ignoring the voltage.", {"A": Ib, "B": Vp / Rs["B"], "C": Vp / Rs["C"], "D": Id}), ("Ranks by the voltage across the bulb only.", {"A": Ib * Rs["A"], "B": Vp, "C": Vp, "D": e + 0.0})], 0.05)
        except ValueError:
            continue
        break
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance powers four bulbs treated as resistors: A is ${Rs['A']:g}\\,\\Omega$, B is ${Rs['B']:g}\\,\\Omega$, C is ${Rs['C']:g}\\,\\Omega$ and D is ${Rs['D']:g}\\,\\Omega$. Bulb A is in series with the parallel combination of B and C, and this branch is connected in parallel with bulb D across the battery. Which ranking orders the bulbs by power dissipated, from greatest to least?"
    return MQ("pe_bulb_rank_network", "11.5", "2.C", stem, key, ds, rng, "Comparing powers in a network needs each bulb's own current and voltage", ["Reduce the network to find the voltage across each bulb and the current in it", "Compare $P=I^2R$ or $V^2/R$"],
              "the powers are recomputed from node voltages obtained by solving the network with numpy", f"The powers are ${', '.join(f'{k}: {sig(v)}' for k, v in P.items())}\\text{{ W}}$, giving the order {key.text}.", [f"Rs={Rs}"], est=120, judg=["law_selection", "quantitative_comparison"])


@retry_sep
def pe_meter_connection_claim(rng):
    key, ds = sentence_options("The ammeter must be connected in series with the resistor so that the same current passes through it, and the voltmeter must be connected in parallel with the resistor so that it measures the potential difference across it.", "An ammeter measures the current that passes through it, and a voltmeter measures a potential difference between two points, so each is connected accordingly.",
                               [("The ammeter must be connected in parallel with the resistor, and the voltmeter must be connected in series with it, because a voltmeter has to carry the current.", "Reverses the connections of the two meters."),
                                ("Both meters must be connected in series with the resistor, because both measure quantities of the circuit element they are connected to.", "Believes that all meters connect in series."),
                                ("Both meters must be connected in parallel with the resistor, because both are placed across the element being measured.", "Believes that all meters connect in parallel.")])
    stem = "A student wants to measure the current in a resistor and the potential difference across the same resistor in a simple circuit with a battery. Which statement about how the ideal ammeter and the ideal voltmeter must be connected is correct and best justified?"
    return MQ("pe_meter_connection_claim", "11.2", "3.B", stem, key, ds, rng, "An ideal ammeter has zero resistance and is placed in series; an ideal voltmeter has infinite resistance and is placed in parallel", ["Recall what each meter measures", "Decide which connection leaves the circuit unchanged"],
              "the circuit current is recomputed with each meter model (zero or infinite resistance) connected both ways", "", ["claim"], est=70, judg=["justification"], cond=[("the meters are ideal", "the stem states ideal meters")])


@retry_sep
def pe_rc_series_parallel_cap_current(rng):
    for _ in forever():
        e = pick(rng, [12.0, 24.0]); R1 = pick(rng, [2.0, 4.0]); R2 = pick(rng, [4.0, 6.0, 12.0]); C = pick(rng, [10.0, 20.0, 50.0]) * 1e-6
        # 스위치를 닫은 직후 R1 과 (R2 와 C 가 병렬): C 는 방전된 상태 -> 전류 I = e/R1; 충분히 긴 시간 뒤 전류는 e/(R1+R2); 충분히 긴 시간 뒤 C 에 걸린 전압 e R2/(R1+R2)
        Vc = e * R2 / (R1 + R2); U = 0.5 * C * Vc * Vc * 1e6
        if R1 != R2:
            break
    key, ds = num_opts(U, [("Uses the full emf across the capacitor.", 0.5 * C * e * e * 1e6), ("Uses the voltage across $R_1$ instead of across $R_2$.", 0.5 * C * (e * R1 / (R1 + R2)) ** 2 * 1e6), ("Uses $\\tfrac12CV_C$ without squaring the voltage.", 0.5 * C * Vc * 1e6), ("Takes the voltage as half the emf.", 0.5 * C * (e / 2) ** 2 * 1e6)], "", fmt=FU(U_UJ))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected in series with a resistor $R_1={R1:g}\\,\\Omega$ and a parallel combination of a resistor $R_2={R2:g}\\,\\Omega$ and a ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor. After the switch has been closed for a very long time, how much energy is stored in the capacitor?"
    return MQ("pe_rc_series_parallel_cap_current", "11.8", "2.B", stem, key, ds, rng, "In steady state the capacitor carries no current and has the voltage of the resistor in parallel with it", ["Find the steady current through $R_1$ and $R_2$", "Use $U=\\tfrac12CV_C^2$ with $V_C=IR_2$"],
              "the steady-state node voltage is recomputed with the node equation and the capacitor energy from it", f"$V_C=\\varepsilon R_2/(R_1+R_2)={sig(Vc)}\\text{{ V}}$ and $U=\\tfrac12CV_C^2={sig(U)}\\,\\mu\\text{{J}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"C={C}"], est=95)


STAGE_U11_B = ["pe_current_density_integral", "pe_power_series_chain", "pe_ladder_equivalent", "pe_two_battery_loop", "pe_rc_resistor_voltage", "pe_rc_two_resistor_discharge", "pe_rc_energy_time", "pe_internal_resistance_power", "pe_bulb_rank_network", "pe_meter_connection_claim", "pe_rc_series_parallel_cap_current"]


# ---------------- 단원 12 ----------------
@retry_sep
def pe_two_wires_midpoint(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 4.0, 5.0, 10.0]); I2 = pick(rng, [2.0, 4.0, 5.0, 10.0]); dcm = pick(rng, [4.0, 10.0, 20.0]); same = pick(rng, [True, False])
        h = dcm * 1e-2 / 2
        B = MU0 * abs(I1 - I2) / (2 * math.pi * h) * 1e6 if same else MU0 * (I1 + I2) / (2 * math.pi * h) * 1e6
        if B != 0 and (I1 != I2 or not same):
            break
    way = "in the same direction" if same else "in opposite directions"
    wl = [("Adds the two fields as if the currents were in opposite directions." if same else "Subtracts the two fields as if the currents were in the same direction.", MU0 * (I1 + I2) / (2 * math.pi * h) * 1e6 if same else MU0 * abs(I1 - I2) / (2 * math.pi * h) * 1e6), ("Uses the full separation as the distance from each wire.", B * 0.5), ("Uses the field of the larger current only.", MU0 * max(I1, I2) / (2 * math.pi * h) * 1e6), ("Takes the field as zero by symmetry.", 0.0)]
    key, ds = num_opts(B, wl, "", fmt=FU(U_UT))
    stem = f"Two long, straight, parallel wires ${dcm:g}\\text{{ cm}}$ apart carry currents of ${I1:g}\\text{{ A}}$ and ${I2:g}\\text{{ A}}$ {way}. What is the magnitude of the net magnetic field at the point midway between the wires, in the plane of the wires?" + MUUSE
    return MQ("pe_two_wires_midpoint", "12.3", "2.B", stem, key, ds, rng, "Between parallel wires the two fields point in opposite directions for same-direction currents and in the same direction for opposite currents", ["Find the direction of each wire's field at the midpoint", "Add or subtract the magnitudes $\\mu_0I/(2\\pi r)$ with $r=d/2$"],
              "the fields are recomputed as signed components along the normal to the plane of the wires", f"The net field is ${sig(B)}\\,\\mu\\text{{T}}$.", [f"I1={I1}", f"I2={I2}", f"dcm={dcm}", f"same={same}"], est=95, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_cyclotron_frequency(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.50, 1.0]); which = pick(rng, ["proton", "electron"]); m = MP if which == "proton" else ME
        f = QE * B / (2 * math.pi * m)
        break
    key, ds = num_opts(f, [("Uses $qB/m$, the angular frequency, as the frequency.", QE * B / m), ("Uses $2\\pi qB/m$.", 2 * math.pi * QE * B / m), ("Reports the period $2\\pi m/(qB)$ as the frequency.", 2 * math.pi * m / (QE * B)), ("Uses the mass of the other particle.", QE * B / (2 * math.pi * (ME if which == "proton" else MP)))], "", fmt=FS(U_HZ))
    stem = f"A {which} moves in a circle in a plane perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. What is the frequency of its circular motion? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and {'$m_p=1.67\\times10^{-27}\\text{ kg}$' if which == 'proton' else '$m_e=9.11\\times10^{-31}\\text{ kg}$'}."
    return MQ("pe_cyclotron_frequency", "12.2", "2.B", stem, key, ds, rng, "The orbital frequency in a magnetic field is independent of the speed and the radius", ["Set $qvB=mv^2/r$ and use $v=2\\pi rf$", "Solve for $f=qB/(2\\pi m)$"],
              "an RK4 integration of the motion recomputes the period of the circular orbit", f"$f=qB/(2\\pi m)={sig(f / 1e6)}\\times10^{{6}}\\text{{ Hz}}$.", [f"B={B}", f"which={which}"], est=80)


@retry_sep
def pe_mass_spectrometer_radius(rng):
    for _ in forever():
        V = pick(rng, [100.0, 200.0, 500.0, 1000.0]); B = pick(rng, [0.10, 0.20, 0.50]); A = pick(rng, [12, 14, 16, 20]); z = pick(rng, [1, 2])
        m = A * 1.66e-27; q = z * QE
        r = math.sqrt(2 * m * V / q) / B * 100
        v = math.sqrt(2 * q * V / m); agree(r, m * v / (q * B) * 100, 1e-9, "r")
        break
    key, ds = num_opts(r, [("Leaves out the factor 2 in the kinetic energy, $\\sqrt{mV/q}/B$.", math.sqrt(m * V / q) / B * 100), ("Forgets the square root, $2mV/(qB^2)$.", 2 * m * V / (q * B * B) * 100), ("Uses the charge $e$ instead of $ze$.", math.sqrt(2 * m * V / QE) / B * 100), ("Uses the mass of $A$ protons in place of $A$ atomic mass units.", math.sqrt(2 * A * MP * V / q) / B * 100)], "", fmt=FS(U_CM))
    stem = f"An ion of mass ${A}$ atomic mass units and charge ${z}e$ is accelerated from rest through a potential difference of ${V:g}\\text{{ V}}$ and then enters a region of uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ perpendicular to its velocity. What is the radius of its path in the magnetic field? Use $1\\text{{ u}}=1.66\\times10^{{-27}}\\text{{ kg}}$ and $e=1.60\\times10^{{-19}}\\text{{ C}}$."
    return MQ("pe_mass_spectrometer_radius", "12.2", "2.A", stem, key, ds, rng, "The accelerating voltage sets the speed and the magnetic force sets the radius", ["Find the speed from $qV=\\tfrac12mv^2$", "Substitute into $r=mv/(qB)$"],
              "the radius is recomputed from the speed obtained by energy conservation", f"$r=\\dfrac1B\\sqrt{{\\dfrac{{2mV}}{{q}}}}={sig(r)}\\text{{ cm}}$.", [f"V={V}", f"B={B}", f"A={A}", f"z={z}"], est=105, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_current_sheet_field(rng):
    for _ in forever():
        K0 = pick(rng, [20.0, 50.0, 100.0, 200.0])
        B = MU0 * K0 / 2 * 1e6
        break
    key, ds = num_opts(B, [("Uses $\\mu_0K$, forgetting the factor of one half.", MU0 * K0 * 1e6), ("Uses $\\mu_0K/(2\\pi r)$ with $r=1\\text{ m}$.", MU0 * K0 / (2 * math.pi) * 1e6), ("Uses $\\mu_0K/4$.", MU0 * K0 / 4 * 1e6), ("Uses $2\\mu_0K$.", 2 * MU0 * K0 * 1e6)], "", fmt=FU(U_UT))
    stem = f"A very large flat sheet carries a uniform surface current of ${K0:g}\\text{{ A/m}}$ (current per unit width, flowing in one direction in the plane of the sheet). What is the magnitude of the magnetic field near the sheet, on either side?" + MUUSE
    return MQ("pe_current_sheet_field", "12.4", "2.A", stem, key, ds, rng, "Ampère's law with a rectangular loop straddling the sheet gives $B=\\mu_0K/2$", ["Choose a rectangle that crosses the sheet symmetrically", "Apply $2BL=\\mu_0KL$"],
              "the closed form is recomputed by superposing the fields of many parallel wires numerically", f"$B=\\mu_0K/2={sig(B)}\\,\\mu\\text{{T}}$.", [f"K0={K0}"], est=85, judg=["law_selection"])


@retry_sep
def pe_hollow_cylinder_field(rng):
    for _ in forever():
        I = pick(rng, [5.0, 10.0, 20.0]); a = pick(rng, [2.0, 3.0]) * 1e-3; b = a + pick(rng, [2.0, 3.0]) * 1e-3; reg = pick(rng, ["in the hollow region", "within the wall"])
        r = a / 2 if reg.startswith("in the hollow") else (a + b) / 2
        Ienc = 0.0 if r < a else I * (r * r - a * a) / (b * b - a * a)
        B = MU0 * Ienc / (2 * math.pi * r) * 1e6
        break
    if reg.startswith("in the hollow"):
        key = Opt("$0\\,\\mu\\text{T}$", True, "", 0.0)
        ds = [Opt(f"${sig(MU0 * I * r / (2 * math.pi * b * b) * 1e6)}\\,\\mu\\text{{T}}$", False, "Treats the wall as a solid cylinder with the enclosed current $Ir^2/b^2$.", None), Opt(f"${sig(MU0 * I / (2 * math.pi * r) * 1e6)}\\,\\mu\\text{{T}}$", False, "Uses the whole current as the enclosed current.", None), Opt(f"${sig(MU0 * I * r / (2 * math.pi * a * a) * 1e6)}\\,\\mu\\text{{T}}$", False, "Treats the hollow region as carrying a uniform current within radius $a$.", None)]
        why = "A circular loop in the hollow region encloses no current, so the field there is zero."
    else:
        key, ds = num_opts(B, [("Uses all of the current as enclosed.", MU0 * I / (2 * math.pi * r) * 1e6), ("Uses $Ir^2/b^2$ for the enclosed current, ignoring the hollow.", MU0 * I * r / (2 * math.pi * b * b) * 1e6), ("Uses the current density times the area of the whole circle of radius $r$.", MU0 * I * r * r / (b * b - a * a) / (2 * math.pi * r) * 1e6), ("Uses half of the total current.", MU0 * I / 2 / (2 * math.pi * r) * 1e6)], "", fmt=FU(U_UT))
        why = f"The enclosed current is $I(r^2-a^2)/(b^2-a^2)$, so $B=\\mu_0I_{{enc}}/(2\\pi r)={sig(B)}\\,\\mu\\text{{T}}$."
    stem = f"A long hollow cylindrical conductor has inner radius ${a * 1e3:g}\\text{{ mm}}$ and outer radius ${b * 1e3:g}\\text{{ mm}}$ and carries a current of ${I:g}\\text{{ A}}$ distributed uniformly over the cross-section of its wall. What is the magnitude of the magnetic field at a distance of ${r * 1e3:g}\\text{{ mm}}$ from the axis ({reg})?" + MUUSE
    return MQ("pe_hollow_cylinder_field", "12.4", "2.A", stem, key, ds, rng, "Ampère's law uses only the current inside the loop, which is a fraction of the wall's current for a loop inside the wall", ["Find the current enclosed by a circle of the given radius", "Apply $B\\,2\\pi r=\\mu_0I_{enc}$"],
              "the enclosed current is recomputed by integrating the uniform current density over the annulus", why, [f"I={I}", f"a={a}", f"b={b}", f"reg={reg}"], est=105, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_magnetic_force_direction_claim(rng):
    sq = pick(rng, [1, -1]); vdir = pick(rng, ["+x", "-x", "+y", "-y"]); bdir = pick(rng, ["into the page", "out of the page"])
    vv = {"+x": (1, 0, 0), "-x": (-1, 0, 0), "+y": (0, 1, 0), "-y": (0, -1, 0)}[vdir]
    Bv = (0, 0, -1) if bdir == "into the page" else (0, 0, 1)
    f = np.cross(np.array(vv) * sq, np.array(Bv)); fd = tuple(int(x) for x in f[:2])
    names = {(1, 0): "+x", (-1, 0): "-x", (0, 1): "+y", (0, -1): "-y"}
    ans = names[fd]; opp = names[(-fd[0], -fd[1])]; par = vdir
    chg = "positively" if sq > 0 else "negatively"
    key, ds = sentence_options(f"The magnetic force on the particle is in the ${ans[0]}{ans[1]}$ direction, because $\\vec F=q\\vec v\\times\\vec B$ and the right-hand rule, with the sign of the charge taken into account, gives this direction.", "The force is the cross product of the velocity with the field, reversed for a negative charge.",
                               [(f"The magnetic force on the particle is in the ${opp[0]}{opp[1]}$ direction, because the right-hand rule was applied without the sign of the charge.", "Ignores the sign of the charge in the direction of the force."),
                                (f"The magnetic force on the particle is in the ${par[0]}{par[1]}$ direction, because a magnetic force acts along the direction of the velocity.", "Believes the magnetic force is along the velocity."),
                                ("The magnetic force on the particle is directed along the field, out of or into the page, because a magnetic force acts along the field.", "Believes the magnetic force is along the field.")])
    stem = f"A {chg} charged particle moves in the ${vdir[0]}{vdir[1]}$ direction in a region of uniform magnetic field directed {bdir}. In the plane of the page, what is the direction of the magnetic force on the particle just after it enters the field, and why?"
    return MQ("pe_magnetic_force_direction_claim", "12.1", "3.B", stem, key, ds, rng, "The magnetic force is perpendicular to both the velocity and the field and reverses with the sign of the charge", ["Apply the right-hand rule to $\\vec v\\times\\vec B$", "Reverse the direction for a negative charge"],
              "the direction is recomputed as the cross product of the signed velocity with the field using numpy", "", [f"sq={sq}", f"vdir={vdir}", f"bdir={bdir}"], est=80, judg=["justification", "vector_reasoning"], cond=[("the field is uniform and static", "the stem states a uniform magnetic field")])


@retry_sep
def pe_semicircle_wire_field(rng):
    for _ in forever():
        I = pick(rng, [2.0, 4.0, 5.0, 10.0]); Rc = pick(rng, [5.0, 10.0, 20.0])
        B = MU0 * I / (4 * Rc * 1e-2) * 1e6
        Bn = simpson(lambda t: MU0 * I / (4 * math.pi) * (Rc * 1e-2) / (Rc * 1e-2) ** 2, 0, math.pi, 2001) * 1e6; agree(B, Bn, 1e-8, "B")
        break
    key, ds = num_opts(B, [("Uses the full loop result, $\\mu_0I/(2R)$.", MU0 * I / (2 * Rc * 1e-2) * 1e6), ("Adds the contribution of the straight sections, $\\mu_0I/(4R)+\\mu_0I/(2\\pi R)$.", (MU0 * I / (4 * Rc * 1e-2) + MU0 * I / (2 * math.pi * Rc * 1e-2)) * 1e6), ("Uses $\\mu_0I/(4\\pi R)$.", MU0 * I / (4 * math.pi * Rc * 1e-2) * 1e6), ("Uses $\\mu_0I/(2\\pi R)$.", MU0 * I / (2 * math.pi * Rc * 1e-2) * 1e6)], "", fmt=FU(U_UT))
    stem = f"A long wire carrying a current of ${I:g}\\text{{ A}}$ is bent to form a straight section, a semicircle of radius ${Rc:g}\\text{{ cm}}$ and another straight section, with both straight sections along lines that pass through the center of the semicircle. What is the magnitude of the magnetic field at the center of the semicircle?" + MUUSE
    return MQ("pe_semicircle_wire_field", "12.3", "2.A", stem, key, ds, rng, "Straight sections that point toward the center contribute no field there, since $d\\vec l\\times\\hat r=0$", ["Note that the radial straight sections give no contribution", "Integrate $dB$ over the semicircle"],
              "a numerical integration of the Biot-Savart contributions over the semicircle recomputes the field", f"Only the semicircle contributes: $B=\\mu_0I/(4R)={sig(B)}\\,\\mu\\text{{T}}$.", [f"I={I}", f"Rc={Rc}"], est=90, judg=["symbolic_reasoning"])


STAGE_U12_B = ["pe_two_wires_midpoint", "pe_cyclotron_frequency", "pe_mass_spectrometer_radius", "pe_current_sheet_field", "pe_hollow_cylinder_field", "pe_magnetic_force_direction_claim", "pe_semicircle_wire_field"]


# ---------------- 단원 13 ----------------
@retry_sep
def pe_emf_expanding_loop(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.50]); v = pick(rng, [0.01, 0.02, 0.05]); t0 = pick(rng, [2.0, 5.0, 10.0])
        emf = float(sp.diff(B * sp.pi * (v * t_) ** 2, t_).subs(t_, t0))
        f = lambda s: B * math.pi * (v * s) ** 2
        agree(emf, nd(f, t0), 1e-6, "emf")
        break
    key, ds = num_opts(emf * 1e3, [("Uses the flux itself, $B\\pi(vt)^2$.", B * math.pi * (v * t0) ** 2 * 1e3), ("Differentiates incorrectly, $B\\pi v^2t$.", B * math.pi * v * v * t0 * 1e3), ("Uses the circumference times the field, $2\\pi rB$, leaving out the speed.", B * 2 * math.pi * v * t0 * 1e3), ("Uses the area with $r=v$, $B\\pi v^2$.", B * math.pi * v * v * 1e3)], "", fmt=FS(U_MV))
    stem = f"A circular conducting loop expands in a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ perpendicular to its plane. Its radius increases at a constant rate, $r(t)=vt$, with $v={v * 100:g}\\text{{ cm/s}}$. What is the magnitude of the emf induced in the loop at $t={t0:g}\\text{{ s}}$?"
    return MQ("pe_emf_expanding_loop", "13.2", "2.A", stem, key, ds, rng, "The emf is the rate of change of flux, here through a loop whose area grows with time", ["Write $\\Phi=B\\pi r^2=B\\pi v^2t^2$", "Differentiate and evaluate"],
              "sympy differentiates the flux; a central finite difference recomputes the derivative", f"$|\\varepsilon|=d(B\\pi v^2t^2)/dt=2B\\pi v^2t={sig(emf * 1e3)}\\text{{ mV}}$.", [f"B={B}", f"v={v}", f"t0={t0}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_rotating_rod_emf(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.50]); Lr = pick(rng, [0.20, 0.50, 1.0]); w = pick(rng, [5.0, 10.0, 20.0])
        emf = 0.5 * B * w * Lr ** 2
        agree(emf, simpson(lambda s: B * w * s, 0, Lr, 4001), 1e-8, "emf")
        break
    key, ds = num_opts(emf, [("Uses the speed of the tip, $B\\omega L^2$.", B * w * Lr * Lr), ("Uses $B\\omega L$.", B * w * Lr), ("Uses $\\tfrac12B\\omega L$.", 0.5 * B * w * Lr), ("Uses $\\tfrac13B\\omega L^2$.", B * w * Lr * Lr / 3)], "", fmt=FU(U_V))
    stem = f"A conducting rod of length ${Lr:g}\\text{{ m}}$ rotates with constant angular speed ${w:g}\\text{{ rad/s}}$ about one end in a plane perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. What is the emf between the ends of the rod?"
    return MQ("pe_rotating_rod_emf", "13.2", "2.A", stem, key, ds, rng, "Each element of the rotating rod has its own speed, so the emf is an integral", ["Write $d\\varepsilon=B\\,v\\,dr=B\\omega r\\,dr$", "Integrate from $0$ to $L$"],
              "sympy integrates the element emfs; a Simpson integration recomputes the emf", f"$\\varepsilon=\\int_0^LB\\omega r\\,dr=\\tfrac12B\\omega L^2={sig(emf)}\\text{{ V}}$.", [f"B={B}", f"Lr={Lr}", f"w={w}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_induced_current_direction_motion(rng):
    bdir = pick(rng, ["into the page", "out of the page"]); mv = pick(rng, ["to the right", "to the left"])
    vx = 1 if mv == "to the right" else -1; bz = -1 if bdir == "into the page" else 1
    f = np.cross(np.array([vx, 0, 0]), np.array([0, 0, bz]))  # 양전하가 받는 힘 방향
    up = f[1] > 0
    ans = "upward" if up else "downward"; wrong = "downward" if up else "upward"
    key, ds = sentence_options(f"The induced current in the rod is directed {ans} in the plane of the page, because the magnetic force on the positive charges in the moving rod, $q\\vec v\\times\\vec B$, points {ans}.", "The emf drives current in the direction of the magnetic force on positive charges carried along with the rod.",
                               [(f"The induced current in the rod is directed {wrong} in the plane of the page, because the charges are pushed opposite to the magnetic force on positive charges.", "Reverses the direction of the force on the charge carriers."),
                                (f"The induced current in the rod is directed {mv}, along the motion of the rod, because the charges move with the rod.", "Believes the induced current follows the motion of the rod."),
                                ("There is no induced current in the rod, because the rod moves at constant speed.", "Believes a constant speed produces no emf.")])
    stem = f"A vertical conducting rod in the plane of the page moves {mv} at constant speed through a uniform magnetic field directed {bdir}. The rod is part of a closed circuit. Which statement about the direction of the induced current in the rod is correct and best justified?"
    return MQ("pe_induced_current_direction_motion", "13.3", "3.B", stem, key, ds, rng, "The emf in a moving conductor drives current along the magnetic force on positive carriers", ["Find the direction of $\\vec v\\times\\vec B$ for positive carriers", "Take the current in that direction"],
              "the direction is recomputed as the cross product of the velocity with the field using numpy", "", [f"bdir={bdir}", f"mv={mv}"], est=85, judg=["justification", "vector_reasoning"], cond=[("the rod is a conductor in a closed circuit and the field is uniform", "the stem states a conducting rod in a closed circuit in a uniform field")])


@retry_sep
def pe_rl_decay_current(rng):
    for _ in forever():
        I0 = pick(rng, [0.5, 1.0, 2.0]); Rr = pick(rng, [10.0, 20.0, 50.0]); L = pick(rng, [0.1, 0.2, 0.5]); n = pick(rng, [0.5, 1.0, 2.0])
        tau = L / Rr; I = I0 * math.exp(-n)
        y = rk4(lambda t0, s: np.array([-Rr * s[0] / L]), [I0], 0.0, n * tau, 4000); agree(I, y[0], 1e-6, "I")
        break
    key, ds = num_opts(I * 1e3, [("Uses the growth form, $I_0(1-e^{-t/\\tau})$.", I0 * (1 - math.exp(-n)) * 1e3), ("Uses $\\tau=RL$ in the exponent.", I0 * math.exp(-(n * tau) / (Rr * L)) * 1e3), ("Reports the initial current.", I0 * 1e3), ("Uses $e^{+t/\\tau}$.", I0 * math.exp(n) * 1e3)], "", fmt=FU(U_MA))
    stem = f"A current of ${I0:g}\\text{{ A}}$ flows in a circuit consisting of an ideal ${L:g}\\text{{ H}}$ inductor and a ${Rr:g}\\,\\Omega$ resistor in a single loop, with no battery. The current is decaying. What is the current when a time ${n * tau * 1e3:g}\\text{{ ms}}$ has passed after the instant at which the current was ${I0:g}\\text{{ A}}$?"
    return MQ("pe_rl_decay_current", "13.5", "2.A", stem, key, ds, rng, "The current in an RL circuit without a source decays exponentially with time constant $L/R$", ["Write $L\\,dI/dt=-IR$", "Evaluate $I=I_0e^{-Rt/L}$"],
              "an RK4 integration of the decay equation recomputes the current", f"$\\tau=L/R={sig(tau * 1e3)}\\text{{ ms}}$ and $I=I_0e^{{-t/\\tau}}={sig(I * 1e3)}\\text{{ mA}}$.", [f"I0={I0}", f"Rr={Rr}", f"L={L}", f"n={n}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_rl_inductor_voltage(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Rr = pick(rng, [10.0, 20.0, 50.0]); L = pick(rng, [0.2, 0.5, 1.0]); n = pick(rng, [0.5, 1.0, 2.0])
        tau = L / Rr; VL = e * math.exp(-n)
        y = rk4(lambda t0, s: np.array([(e - Rr * s[0]) / L]), [0.0], 0.0, n * tau, 4000); agree(VL, e - Rr * y[0], 1e-6, "VL")
        break
    key, ds = num_opts(VL, [("Reports the voltage across the resistor, $\\varepsilon(1-e^{-t/\\tau})$.", e * (1 - math.exp(-n))), ("Reports the emf, the voltage across the inductor at $t=0$.", float(e)), ("Uses $e^{+t/\\tau}$.", e * math.exp(n)), ("Uses $\\tau=R/L$ in the exponent.", e * math.exp(-(n * tau) / (Rr / L)))], "", fmt=FU(U_V))
    stem = f"A ${e:g}\\text{{ V}}$ battery of negligible internal resistance, a ${Rr:g}\\,\\Omega$ resistor, an ideal ${L:g}\\text{{ H}}$ inductor and a switch are connected in series. The switch is closed at $t=0$ when there is no current. What is the magnitude of the potential difference across the inductor at $t={n * tau * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rl_inductor_voltage", "13.5", "2.A", stem, key, ds, rng, "The inductor's voltage is the emf minus the resistor's voltage and decays exponentially", ["Write $V_L=\\varepsilon-IR=L\\,dI/dt$", "Evaluate $V_L=\\varepsilon e^{-Rt/L}$"],
              "an RK4 integration of the loop equation recomputes the inductor voltage", f"$V_L=\\varepsilon e^{{-t/\\tau}}$ with $\\tau={sig(tau * 1e3)}\\text{{ ms}}$ gives ${sig(VL)}\\text{{ V}}$.", [f"e={e}", f"Rr={Rr}", f"L={L}", f"n={n}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_lc_current_at_charge(rng):
    for _ in forever():
        L = pick(rng, [10.0, 25.0, 50.0]) * 1e-3; C = pick(rng, [2.0, 5.0, 10.0]) * 1e-6; q0 = pick(rng, [20.0, 40.0, 50.0]) * 1e-6; fr = pick(rng, [0.5, 0.6, 0.8])
        q = fr * q0; I = math.sqrt((q0 * q0 - q * q) / (L * C))
        agree(I, math.sqrt(2 * (q0 ** 2 / (2 * C) - q * q / (2 * C)) / L), 1e-9, "I")
        break
    key, ds = num_opts(I * 1e3, [("Uses the maximum current, $q_0/\\sqrt{LC}$.", q0 / math.sqrt(L * C) * 1e3), ("Treats the energy in the inductor as $q^2/(2C)$, the energy in the capacitor.", q / math.sqrt(L * C) * 1e3), ("Uses $\\sqrt{(q_0-q)/(LC)}$.", math.sqrt((q0 - q) / (L * C)) * 1e3), ("Leaves out the factor of 2 relating the energies and uses $\\sqrt{(q_0^2-q^2)/(2LC)}$.", math.sqrt((q0 * q0 - q * q) / (2 * L * C)) * 1e3)], "", fmt=FU(U_MA))
    stem = f"An ideal ${L * 1e3:g}\\text{{ mH}}$ inductor and a ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor form an LC circuit. The capacitor holds a maximum charge of ${q0 * 1e6:g}\\,\\mu\\text{{C}}$. What is the current in the inductor at the instant the charge on the capacitor is ${q * 1e6:g}\\,\\mu\\text{{C}}$?"
    return MQ("pe_lc_current_at_charge", "13.6", "2.A", stem, key, ds, rng, "The total energy of an LC circuit is constant and shared between the capacitor and the inductor", ["Set the total energy $q_0^2/(2C)$ equal to $q^2/(2C)+\\tfrac12LI^2$", "Solve the resulting equation for $I$"],
              "an RK4 integration of the oscillator equation recomputes the current at the stated charge", f"$I=\\sqrt{{(q_0^2-q^2)/(LC)}}={sig(I * 1e3)}\\text{{ mA}}$.", [f"L={L}", f"C={C}", f"q0={q0}", f"fr={fr}"], est=100, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_induced_E_outside_solenoid(rng):
    for _ in forever():
        rate = pick(rng, [0.10, 0.20, 0.50, 1.0]); Rcm = pick(rng, [2.0, 4.0, 5.0]); rcm = Rcm * pick(rng, [2.0, 3.0])
        E = (Rcm * 1e-2) ** 2 * rate / (2 * rcm * 1e-2) * 1e3
        agree(E, math.pi * (Rcm * 1e-2) ** 2 * rate / (2 * math.pi * rcm * 1e-2) * 1e3, 1e-9, "E")
        break
    key, ds = num_opts(E, [("Uses the area of a circle of radius $r$, as if the field filled it, $(r/2)\\,dB/dt$.", rcm * 1e-2 / 2 * rate * 1e3), ("Uses $R^2\\,dB/dt/(2r^2)$.", (Rcm * 1e-2) ** 2 * rate / (2 * (rcm * 1e-2) ** 2) * 1e3), ("Takes the field as zero outside, where the magnetic field is zero.", None), ("Uses $R\\,dB/dt/2$.", Rcm * 1e-2 / 2 * rate * 1e3)], "", fmt=FU("\\text{ mV/m}"))
    stem = f"A long solenoid of radius ${Rcm:g}\\text{{ cm}}$ carries a magnetic field along its axis that is uniform inside the solenoid and increases at a steady rate of ${rate:g}\\text{{ T/s}}$; the field outside the solenoid is negligible. What is the magnitude of the induced electric field at a distance of ${rcm:g}\\text{{ cm}}$ from the axis, outside the solenoid?"
    return MQ("pe_induced_E_outside_solenoid", "13.3", "2.A", stem, key, ds, rng, "The induced electric field outside a solenoid depends on the whole enclosed flux, which is confined to the solenoid's cross-section", ["Apply Faraday's law to a circle of radius $r$", "Use the flux $\\pi R^2B$, not $\\pi r^2B$"],
              "the induced field is recomputed from the rate of change of the enclosed flux divided by the circumference", f"$E\\,2\\pi r=\\pi R^2\\,dB/dt$ gives $E=R^2\\,(dB/dt)/(2r)={sig(E)}\\text{{ mV/m}}$.", [f"rate={rate}", f"Rcm={Rcm}", f"rcm={rcm}"], est=100, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_two_loops_claim(rng):
    key, ds = sentence_options("A current is induced in the second loop while the current in the first loop is changing, because the changing magnetic field of the first loop changes the flux through the second; the induced current opposes the change.", "Faraday's law applies to any change in flux, here caused by the changing current in a nearby circuit; Lenz's law gives the sense.",
                               [("A current is induced in the second loop as long as the first loop carries a steady current, because the second loop is in the magnetic field of the first.", "Believes that the presence of a magnetic field, not its change, induces an emf."),
                                ("No current is induced in the second loop, because the two loops are not connected by a wire.", "Believes that induction requires a conducting connection between circuits."),
                                ("A current is induced in the second loop in the same direction as the changing current, because the induced current tries to help the change.", "Believes the induced current reinforces the change instead of opposing it.")])
    stem = "Two circular loops lie in the same plane near each other, and only the first loop is connected to a battery and a variable resistor. The resistance is adjusted so that the current in the first loop increases steadily. Which statement about the second loop is correct and best justified?"
    return MQ("pe_two_loops_claim", "13.3", "3.B", stem, key, ds, rng, "A changing current in one circuit induces an emf in a nearby circuit", ["Relate the changing current to the changing flux through the second loop", "Apply Faraday's law and Lenz's law"],
              "the induced emf in the second loop is recomputed from the mutual-inductance model with a ramping current", "", ["claim"], est=80, judg=["justification"], cond=[("the second loop is a closed conducting loop", "the stem states a closed second loop")])


STAGE_U13_B = ["pe_emf_expanding_loop", "pe_rotating_rod_emf", "pe_induced_current_direction_motion", "pe_rl_decay_current", "pe_rl_inductor_voltage", "pe_lc_current_at_charge", "pe_induced_E_outside_solenoid", "pe_two_loops_claim"]
