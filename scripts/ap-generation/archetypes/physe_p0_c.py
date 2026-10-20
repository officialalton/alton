"""AP Physics C: Electricity and Magnetism 원형 C — 단원 11(전기 회로, 11.1–11.8). 회로는 본문에 연결 방식과 값을 모두 글로 적는다(그림 없이도 풀 수 있게). 정답은 sympy·numpy 선형계·RK4 로 독립 재계산한다."""
from physe_common import *

t_ = sp.symbols("t", positive=True)
x_ = sp.symbols("x", positive=True)
NCU = 8.5e28  # 구리 자유 전자 밀도(m^-3), 본문에 값을 적는다


def _tc(v):
    return v


@retry_sep
def pe_current_drift(rng):
    for _ in forever():
        I = pick(rng, [2.0, 5.0, 10.0, 15.0]); dmm = pick(rng, [1.0, 2.0, 3.0]); A = math.pi * (dmm * 1e-3 / 2) ** 2
        vd = I / (NCU * QE * A) * 1e3
        break
    key, ds = num_opts(vd, [("Uses the diameter as the radius when computing the area.", vd / 4), ("Reports the number in meters per second as if it were in millimeters per second.", vd / 1e3), ("Uses the diameter squared as the area, without the factor $\\pi/4$.", vd * math.pi / 4), ("Uses $A=r^2$, leaving out the factor $\\pi$.", vd * math.pi)], "", fmt=FS("\\text{ mm/s}"))
    stem = f"A copper wire of diameter ${dmm:g}\\text{{ mm}}$ carries a steady current of ${I:g}\\text{{ A}}$. Copper has ${NCU / 1e28:g}\\times10^{{28}}$ free electrons per cubic meter. What is the drift speed of the electrons? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$."
    return MQ("pe_current_drift", "11.1", "2.B", stem, key, ds, rng, "Current is carrier density times charge times drift speed times cross-sectional area", ["Compute the cross-sectional area from the diameter", "Solve $I=nevA$ for $v$"],
              "the drift speed is recomputed from the charge passing through a cross-section per second", f"$v=I/(neA)={sig(vd)}\\text{{ mm/s}}$.", [f"I={I}", f"dmm={dmm}"], est=90)


@retry_sep
def pe_current_charge_integral(rng):
    for _ in forever():
        a = pick(rng, [0.5, 1.0, 2.0, 3.0]); T = pick(rng, [2.0, 3.0, 4.0])
        Q = a * T ** 3 / 3
        agree(Q, simpson(lambda s: a * s * s, 0, T, 4001), 1e-8, "Q")
        break
    key, ds = num_opts(Q, [("Multiplies the final current by the time, $aT^2\\cdot T$.", a * T ** 3), ("Multiplies the average of the end currents by the time.", a * T ** 2 / 2 * T), ("Integrates to $aT^2/2$, using the wrong power.", a * T ** 2 / 2), ("Reports the final current, $aT^2$.", a * T ** 2)], "", fmt=FU("\\text{ C}"))
    stem = f"The current in a wire varies with time as $I(t)={a:g}t^2$, where $I$ is in amperes and $t$ is in seconds. How much charge passes a cross-section of the wire between $t=0$ and $t={T:g}\\text{{ s}}$?"
    return MQ("pe_current_charge_integral", "11.1", "2.A", stem, key, ds, rng, "Charge is the time integral of the current", ["Write $Q=\\int I\\,dt$", "Integrate $at^2$ and apply the limits"],
              "sympy integrates the current; a Simpson integration recomputes the charge", f"$Q=\\int_0^{{{T:g}}}{a:g}t^2dt={a:g}({T:g})^3/3={sig(Q)}\\text{{ C}}$.", [f"a={a}", f"T={T}"], est=70, judg=["symbolic_reasoning"])


@retry_sep
def pe_resistance_geometry(rng):
    for _ in forever():
        fl = pick(rng, [2, 3, 4]); fd = pick(rng, [2, 3])
        break
    f = fl / fd ** 2
    key, ds = num_opts(f, [("Uses the diameter factor, not its square, $\\ell/d$.", fl / fd), ("Treats resistance as inversely proportional to length.", fd ** 2 / fl), ("Multiplies the length factor by the diameter factor.", fl * fd), ("Ignores the change in diameter.", float(fl))], "", fmt=lambda v: "$" + sig(v) + "R$")
    stem = f"A cylindrical wire has resistance $R$. A second cylindrical wire is made of the same material, has a length ${fl}$ times as long as the first wire and a diameter ${fd}$ times as large. What is the resistance of the second wire?"
    return MQ("pe_resistance_geometry", "11.3", "2.D", stem, key, ds, rng, "Resistance varies as length over cross-sectional area, which is proportional to the diameter squared", ["Write $R=\\rho L/A$ with $A\\propto d^2$", "Apply the factors"],
              "the resistance ratio is recomputed from $R=\\rho L/(\\pi d^2/4)$ for sample values", f"$R\\propto L/d^2$, so the new resistance is $({fl}/{fd}^2)R={sig(f)}R$.", [f"fl={fl}", f"fd={fd}"], est=65)


@retry_sep
def pe_resistance_value(rng):
    for _ in forever():
        L = pick(rng, [5.0, 10.0, 20.0, 50.0]); dmm = pick(rng, [0.5, 1.0, 2.0]); rho = pick(rng, [1.7e-8, 2.8e-8, 5.6e-8, 1.0e-6])
        R = rho * L / (math.pi * (dmm * 1e-3 / 2) ** 2)
        if 0.05 < R < 200:
            break
    key, ds = num_opts(R, [("Uses the diameter as the radius in the area.", rho * L / (math.pi * (dmm * 1e-3) ** 2)), ("Uses the diameter squared as the area, without $\\pi/4$.", rho * L / ((dmm * 1e-3) ** 2)), ("Uses the diameter in millimeters as meters.", rho * L / (math.pi * (dmm / 2) ** 2)), ("Uses the radius as the area.", rho * L / (dmm * 1e-3 / 2))], "", fmt=FU(U_OHM))
    ex_ = int(math.floor(math.log10(rho))); mant = rho / 10 ** ex_
    stem = f"A straight wire of length ${L:g}\\text{{ m}}$ and diameter ${dmm:g}\\text{{ mm}}$ is made of a material with resistivity ${sig(mant)}\\times10^{{{ex_}}}\\,\\Omega\\cdot\\text{{m}}$. What is the resistance of the wire?"
    return MQ("pe_resistance_value", "11.3", "2.A", stem, key, ds, rng, "Resistance equals resistivity times length over cross-sectional area", ["Compute the cross-sectional area from the diameter", "Apply $R=\\rho L/A$"],
              "the resistance is recomputed by summing the resistances of thin slices along the wire", f"$R=\\rho L/(\\pi d^2/4)={sig(R)}\\,\\Omega$.", [f"L={L}", f"dmm={dmm}", f"rho={rho}"], est=85, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_resistor_nonuniform(rng):
    for _ in forever():
        r0 = pick(rng, [2.0, 4.0, 5.0]) * 1e-5; L = pick(rng, [0.5, 1.0, 2.0]); Adm = pick(rng, [1.0, 2.0, 4.0]) * 1e-6; b = pick(rng, [1.0, 2.0, 3.0])
        R = float(sp.integrate((r0 * (1 + b * x_ / L)) / Adm, (x_, 0, L)))
        agree(R, simpson(lambda s: r0 * (1 + b * s / L) / Adm, 0, L, 4001), 1e-8, "R")
        break
    key, ds = num_opts(R, [("Uses the resistivity at $x=0$ throughout, $\\rho_0L/A$.", r0 * L / Adm), ("Uses the resistivity at the far end throughout.", r0 * (1 + b) * L / Adm), ("Averages the end values as $\\rho_0(1+b)/2$ instead of integrating.", r0 * (1 + b) * L / (2 * Adm)), ("Uses $\\rho_0(1+b/3)$.", r0 * (1 + b / 3) * L / Adm)], "", fmt=FU(U_OHM))
    stem = f"A rod of uniform cross-sectional area ${Adm * 1e6:g}\\text{{ mm}}^{{2}}$ and length ${L:g}\\text{{ m}}$ has a resistivity that varies along its length as $\\rho(x)=\\rho_0(1+{b:g}x/L)$, where $\\rho_0={r0 * 1e5:g}\\times10^{{-5}}\\,\\Omega\\cdot\\text{{m}}$ and $x$ is the distance from one end. What is the resistance of the rod between its ends?"
    return MQ("pe_resistor_nonuniform", "11.3", "2.A", stem, key, ds, rng, "Resistance of a rod with a varying resistivity is an integral of the resistances of thin slices in series", ["Write $dR=\\rho(x)\\,dx/A$", "Integrate over the length"],
              "sympy integrates the slice resistances; a Simpson integration recomputes the resistance", f"$R=\\int_0^L\\rho(x)\\,dx/A=\\rho_0L(1+{b:g}/2)/A={sig(R)}\\,\\Omega$.", [f"r0={r0}", f"L={L}", f"A={Adm}", f"b={b}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_iv_curve_resistance(rng):
    for _ in forever():
        c = pick(rng, [0.02, 0.04, 0.05, 0.1]); V0 = pick(rng, [4.0, 5.0, 6.0, 8.0])
        I0 = c * V0 ** 2; R = V0 / I0; Rdyn = 1 / (2 * c * V0)
        agree(Rdyn, 1 / nd(lambda s: c * s * s, V0), 1e-6, "Rd")
        if I0 < 6 and abs(R - Rdyn) > 0.1 * R and I0 > 0.4:
            break
    vs = list(np.linspace(0, 10, 41)); stim = dense_graph_stim("Current through the device versus the potential difference across it", lambda s: c * s * s, 0, 10, gaxis("Potential difference (V)", 0, 10, 1), gaxis("Current (A)", 0, math.ceil(c * 100), 1 if c * 100 <= 6 else 2), n=81)
    key, ds = num_opts(R, [("Uses the slope of the curve at that point, $dV/dI$.", Rdyn), ("Uses the slope of the curve, $dI/dV$, in ohms.", 2 * c * V0), ("Divides the current by the voltage, $I/V$.", I0 / V0), ("Uses the average slope from the origin to $10\\text{ V}$.", 10 / (c * 100))], "", fmt=FU(U_OHM))
    stem = f"The graph shows the current through a nonohmic device as a function of the potential difference across it. What is the resistance of the device when the potential difference is ${V0:g}\\text{{ V}}$?"
    return MQ("pe_iv_curve_resistance", "11.3", "2.B", stem, key, ds, rng, "The resistance at an operating point is $V/I$ at that point, not the slope of the curve", ["Read the current at the given voltage from the graph", "Divide the voltage by the current"],
              "the current at the operating point is recomputed from the plotted function and the slope from a central difference", f"The current is ${sig(I0)}\\text{{ A}}$, so $R=V/I={sig(R)}\\,\\Omega$; the slope $dV/dI$ is a different quantity.", [f"c={c}", f"V0={V0}"], stim=stim, est=95, mat=MAT_GRAPH("axis labels with units"), judg=["representation_reading", "law_selection"])


@retry_sep
def pe_power_bulb_voltage(rng):
    for _ in forever():
        P0 = pick(rng, [40.0, 60.0, 75.0, 100.0]); V0 = pick(rng, [120.0, 240.0]); V1 = pick(rng, [60.0, 80.0, 90.0, 100.0, 150.0]) if V0 == 120.0 else pick(rng, [120.0, 160.0, 180.0])
        P1 = P0 * (V1 / V0) ** 2
        if V1 != V0:
            break
    key, ds = num_opts(P1, [("Scales the power linearly with the voltage.", P0 * V1 / V0), ("Scales the power with the inverse square of the voltage.", P0 * (V0 / V1) ** 2), ("Assumes the power is unchanged because the resistance is fixed.", P0), ("Scales with the cube of the voltage ratio.", P0 * (V1 / V0) ** 3)], "", fmt=FU(U_W))
    stem = f"A light bulb is marked ${P0:g}\\text{{ W}}$ at ${V0:g}\\text{{ V}}$. It is connected across a source of ${V1:g}\\text{{ V}}$. Assuming the resistance of the filament is the same as at its rated operating condition, what power does the bulb dissipate?"
    return MQ("pe_power_bulb_voltage", "11.4", "2.A", stem, key, ds, rng, "With a fixed resistance the power varies as the square of the voltage", ["Find the resistance from the rating, $R=V_0^2/P_0$", "Evaluate $P=V_1^2/R$"],
              "the power is recomputed from the resistance deduced from the rating", f"$R=V_0^2/P_0$ and $P=V_1^2/R=P_0(V_1/V_0)^2={sig(P1)}\\text{{ W}}$.", [f"P0={P0}", f"V0={V0}", f"V1={V1}"], est=85)


@retry_sep
def pe_bulbs_claim(rng):
    key, ds = sentence_options("Bulb A becomes dimmer and bulb C becomes brighter, because removing B raises the resistance of the parallel section so the total current falls, and all of the current then goes through C at a larger voltage across it.", "Fewer parallel paths raise the equivalent resistance, lowering the current in A, while C now carries all of it with a larger potential difference across it.",
                               [("Bulb A becomes brighter and bulb C becomes dimmer, because the current that went through B is now shared among the remaining bulbs.", "Believes that removing a path makes the remaining current split among fewer bulbs without changing the total current."),
                                ("Both bulbs stay at the same brightness, because the battery maintains the same voltage across each bulb.", "Believes that an ideal battery fixes the voltage across every bulb."),
                                ("Bulb A becomes dimmer and bulb C becomes dimmer, because removing B lowers the total current.", "Does not notice that the potential difference across the parallel section rises when its resistance rises.")])
    stem = "A battery with negligible internal resistance is connected to three identical bulbs: bulb A is in series with a parallel pair, bulb B and bulb C. Bulb B is unscrewed so that it carries no current. Which statement about the brightness of A and C is correct and best justified?"
    return MQ("pe_bulbs_claim", "11.5", "3.B", stem, key, ds, rng, "Removing a parallel branch raises the equivalent resistance and redistributes the voltages", ["Compare the equivalent resistance before and after", "Apply Ohm's law to the series bulb and the remaining parallel bulb"],
              "the bulb currents and powers before and after are recomputed with an equivalent-resistance calculation", "", ["claim"], est=90, judg=["justification"], cond=[("the bulbs are identical ohmic resistors", "the stem states identical bulbs")])


@retry_sep
def pe_series_parallel_current(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0, 18.0, 24.0]); R1 = pick(rng, [2.0, 3.0, 4.0]); R2 = pick(rng, [6.0, 12.0, 4.0]); R3 = pick(rng, [3.0, 6.0, 12.0, 4.0])
        Rp = R2 * R3 / (R2 + R3); I = e / (R1 + Rp)
        s = np.linalg.solve(np.array([[1.0, -1.0, -1.0], [R1, R2, 0.0], [0.0, R2, -R3]]), np.array([0.0, e, 0.0])); agree(I, s[0], 1e-9, "I")
        break
    key, ds = num_opts(I, [("Treats all three resistors as being in series.", e / (R1 + R2 + R3)), ("Treats all three resistors as being in parallel.", e / (1 / (1 / R1 + 1 / R2 + 1 / R3))), ("Adds $R_2$ and $R_3$ in series and combines the result in parallel with $R_1$.", e / (1 / (1 / R1 + 1 / (R2 + R3)))), ("Uses only $R_1$.", e / R1)], "", fmt=FU(U_A))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected to a resistor $R_1={R1:g}\\,\\Omega$ in series with a parallel pair, $R_2={R2:g}\\,\\Omega$ and $R_3={R3:g}\\,\\Omega$. What current does the battery supply?"
    return MQ("pe_series_parallel_current", "11.5", "2.B", stem, key, ds, rng, "A compound circuit is reduced step by step to an equivalent resistance", ["Combine $R_2$ and $R_3$ in parallel", "Add $R_1$ in series and apply Ohm's law"],
              "numpy solves the loop and junction equations for the battery current", f"$R_{{eq}}=R_1+R_2R_3/(R_2+R_3)={sig(R1 + Rp)}\\,\\Omega$ and $I=\\varepsilon/R_{{eq}}={sig(I)}\\text{{ A}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"R3={R3}"], est=85)


@retry_sep
def pe_kirchhoff_two_loop(rng):
    for _ in forever():
        e1 = pick(rng, [12.0, 18.0, 24.0]); e2 = pick(rng, [6.0, 9.0, 12.0]); R1 = pick(rng, [2.0, 3.0, 6.0]); R2 = pick(rng, [2.0, 4.0, 6.0]); R3 = pick(rng, [3.0, 4.0, 6.0])
        A = np.array([[R1, 0.0, R3], [0.0, R2, R3], [1.0, 1.0, -1.0]]); s = np.linalg.solve(A, np.array([e1, e2, 0.0])); I3 = s[2]
        I3s = (e1 * R2 + e2 * R1) / (R1 * R2 + R1 * R3 + R2 * R3); agree(I3, I3s, 1e-9, "I3")
        only1 = e1 / (R1 + R3)
        if I3 > 0.5 and abs(I3 - only1) > 0.1 * I3:
            break
    key, ds = num_opts(I3, [("Ignores the second battery, $\\varepsilon_1/(R_1+R_3)$.", only1), ("Adds the two single-battery currents through $R_3$ as if each ran in its own series loop.", e1 / (R1 + R3) + e2 / (R2 + R3)), ("Divides the sum of the emfs by the sum of all three resistances.", (e1 + e2) / (R1 + R2 + R3)), ("Treats $R_1$ and $R_2$ as in series with a single battery of the difference of the emfs.", abs(e1 - e2) / (R3 + R1 * R2 / (R1 + R2)))], "", fmt=FU(U_A))
    stem = f"Two batteries of emfs $\\varepsilon_1={e1:g}\\text{{ V}}$ and $\\varepsilon_2={e2:g}\\text{{ V}}$ with negligible internal resistance have their positive terminals connected to the same wire (the top wire) and their negative terminals connected to the bottom wire. Battery 1 is in series with $R_1={R1:g}\\,\\Omega$ and battery 2 is in series with $R_2={R2:g}\\,\\Omega$ in separate branches, and a resistor $R_3={R3:g}\\,\\Omega$ connects the top wire to the bottom wire. What is the current in $R_3$?"
    return MQ("pe_kirchhoff_two_loop", "11.6", "2.A", stem, key, ds, rng, "Kirchhoff's loop and junction rules give independent equations for the branch currents", ["Write the loop rule for each battery loop", "Use the junction rule $I_3=I_1+I_2$ and solve"],
              "numpy solves the three simultaneous equations; the closed form (e1 R2 + e2 R1)/(R1R2+R1R3+R2R3) recomputes the result", f"Solving the loop and junction equations gives $I_3={sig(I3)}\\text{{ A}}$.", [f"e1={e1}", f"e2={e2}", f"R1={R1}", f"R2={R2}", f"R3={R3}"], est=120, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_internal_resistance_terminal(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0, 24.0]); r = pick(rng, [0.5, 1.0, 2.0]); R = pick(rng, [4.0, 6.0, 8.0, 10.0])
        Vt = e * R / (R + r)
        agree(Vt, e - e / (R + r) * r, 1e-12, "Vt")
        break
    key, ds = num_opts(Vt, [("Reports the emf as the terminal voltage.", e), ("Subtracts $Ir$ twice.", e - 2 * e / (R + r) * r), ("Uses $\\varepsilon r/(R+r)$, the voltage across the internal resistance.", e * r / (R + r)), ("Divides the emf by the load resistance.", e / R)], "", fmt=FU(U_V))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and internal resistance ${r:g}\\,\\Omega$ is connected across a ${R:g}\\,\\Omega$ resistor. What is the potential difference across the battery's terminals?"
    return MQ("pe_internal_resistance_terminal", "11.2", "2.B", stem, key, ds, rng, "The terminal voltage is the emf minus the drop across the internal resistance", ["Find the current $I=\\varepsilon/(R+r)$", "Subtract $Ir$ from the emf"],
              "the terminal voltage is recomputed as emf minus Ir and as IR", f"$I=\\varepsilon/(R+r)$ and $V=IR={sig(Vt)}\\text{{ V}}$.", [f"e={e}", f"r={r}", f"R={R}"], est=70)


@retry_sep
def pe_parallel_added_power(rng):
    for _ in forever():
        R1 = pick(rng, [4.0, 6.0, 12.0]); R2 = pick(rng, [4.0, 6.0, 12.0])
        break
    f = (R1 + R2) / R2
    key, ds = num_opts(f, [("Takes the factor from the ratio $R_1/R_2$.", R1 / R2), ("Believes the power is unchanged because the emf is unchanged.", 1.0), ("Takes the power to fall, as for a longer path.", R2 / (R1 + R2)), ("Uses the square of the resistance ratio.", ((R1 + R2) / R2) ** 2)], "", fmt=lambda v: "$" + sig(v) + "$ times the original")
    stem = f"A battery with negligible internal resistance is connected across a resistor $R_1={R1:g}\\,\\Omega$. A switch then connects a second resistor $R_2={R2:g}\\,\\Omega$ in parallel with $R_1$. By what factor does the total power supplied by the battery change when the switch is closed?"
    return MQ("pe_parallel_added_power", "11.5", "2.C", stem, key, ds, rng, "Adding a parallel branch lowers the equivalent resistance and raises the power at fixed emf", ["Compare $P=\\varepsilon^2/R_{eq}$ before and after", "Find $R_{eq}$ for the parallel pair"],
              "the two battery powers are recomputed for a sample emf", f"$P\\propto1/R_{{eq}}$, so $P_{{after}}/P_{{before}}=R_1/R_{{eq}}=(R_1+R_2)/R_2={sig(f)}$.", [f"R1={R1}", f"R2={R2}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_rc_charging_current(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0]); R = pick(rng, [2.0, 5.0, 10.0, 20.0]) * 1e3; C = pick(rng, [10.0, 20.0, 50.0, 100.0]) * 1e-6; tau = R * C; tt = pick(rng, [0.5, 1.0, 2.0]) * tau
        I = e / R * math.exp(-tt / tau) * 1e3
        y = rk4(lambda t0, s: np.array([(e - s[0] / C) / R]), [0.0], 0.0, tt, 4000); agree(I, (e - y[0] / C) / R * 1e3, 1e-6, "I")
        break
    key, ds = num_opts(I, [("Reports the initial current, $\\varepsilon/R$.", e / R * 1e3), ("Uses $e^{+t/\\tau}$.", e / R * math.exp(tt / tau) * 1e3), ("Uses $\\varepsilon/R\\,(1-e^{-t/\\tau})$, the form for the capacitor's voltage.", e / R * (1 - math.exp(-tt / tau)) * 1e3), ("Uses $\\tau=R/C$ in the exponent.", e / R * math.exp(-tt * C / R) * 1e3)], "", fmt=FU(U_MA))
    stem = f"An uncharged ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor is connected in series with a ${R / 1e3:g}\\text{{ k}}\\Omega$ resistor, a switch and a ${e:g}\\text{{ V}}$ battery of negligible internal resistance. The switch is closed at $t=0$. What is the current in the circuit at $t={tt * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rc_charging_current", "11.8", "2.A", stem, key, ds, rng, "The charging current in an RC circuit decays exponentially with time constant $RC$", ["Find the time constant $\\tau=RC$", "Evaluate $I=(\\varepsilon/R)e^{-t/\\tau}$"],
              "an RK4 integration of the loop equation recomputes the current", f"$\\tau=RC={sig(tau * 1e3)}\\text{{ ms}}$ and $I=(\\varepsilon/R)e^{{-t/\\tau}}={sig(I)}\\text{{ mA}}$.", [f"e={e}", f"R={R}", f"C={C}", f"tt={tt}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_charge_at_time(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0, 24.0]); R = pick(rng, [1.0, 2.0, 5.0]) * 1e3; C = pick(rng, [5.0, 10.0, 20.0]) * 1e-6; tau = R * C; n = pick(rng, [0.5, 1.0, 2.0, 3.0]); tt = n * tau
        q = C * e * (1 - math.exp(-n)) * 1e6
        y = rk4(lambda t0, s: np.array([(e - s[0] / C) / R]), [0.0], 0.0, tt, 4000); agree(q, y[0] * 1e6, 1e-6, "q")
        break
    key, ds = num_opts(q, [("Uses the final charge, $C\\varepsilon$.", C * e * 1e6), ("Uses $C\\varepsilon\\,e^{-t/\\tau}$, the form for a discharging capacitor.", C * e * math.exp(-n) * 1e6), ("Uses the charge at one time constant regardless of the time.", C * e * (1 - math.exp(-1)) * 1e6)], "", fmt=FU(U_UC))
    stem = f"A ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor, initially uncharged, is charged through a ${R / 1e3:g}\\text{{ k}}\\Omega$ resistor by a ${e:g}\\text{{ V}}$ battery of negligible internal resistance. How much charge is on the capacitor ${tt * 1e3:g}\\text{{ ms}}$ after the circuit is closed?"
    return MQ("pe_rc_charge_at_time", "11.8", "2.A", stem, key, ds, rng, "The charge on a charging capacitor approaches $C\\varepsilon$ exponentially", ["Find the time constant $RC$", "Evaluate $q=C\\varepsilon(1-e^{-t/\\tau})$"],
              "an RK4 integration of the charging equation recomputes the charge", f"$\\tau={sig(tau * 1e3)}\\text{{ ms}}$ so $q=C\\varepsilon(1-e^{{-t/\\tau}})={sig(q)}\\,\\mu\\text{{C}}$.", [f"e={e}", f"R={R}", f"C={C}", f"n={n}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_discharge_time(rng):
    for _ in forever():
        R = pick(rng, [2.0, 5.0, 10.0, 50.0]) * 1e3; C = pick(rng, [2.0, 10.0, 20.0, 100.0]) * 1e-6; fr = pick(rng, [0.5, 0.25, 0.1, 0.2])
        t = R * C * math.log(1 / fr) * 1e3
        y = bisect(lambda s: math.exp(-s / (R * C)) - fr, 1e-9, 100.0); agree(t, y * 1e3, 1e-8, "t")
        break
    key, ds = num_opts(t, [("Uses one time constant, $RC$.", R * C * 1e3), ("Uses $RC\\ln(f)$ and drops the sign by taking the reciprocal, $RC/\\ln(1/f)$.", R * C / math.log(1 / fr) * 1e3), ("Uses a linear decay, $RC\\,(1-f)$.", R * C * (1 - fr) * 1e3), ("Uses the base-10 logarithm, $RC\\log_{10}(1/f)$.", R * C * math.log10(1 / fr) * 1e3)], "", fmt=FU(U_MS))
    stem = f"A ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor is discharged through a ${R / 1e3:g}\\text{{ k}}\\Omega$ resistor. How long does it take for the potential difference across the capacitor to fall to {fr * 100:g}% of its initial value?"
    return MQ("pe_rc_discharge_time", "11.8", "2.A", stem, key, ds, rng, "Capacitor voltage in a discharge falls as $e^{-t/RC}$", ["Write $V=V_0e^{-t/RC}$", "Solve for $t$ with the natural logarithm"],
              "a bisection root finder recomputes the time at which the exponential reaches the stated fraction", f"$e^{{-t/RC}}={fr:g}$ gives $t=RC\\ln(1/{fr:g})={sig(t)}\\text{{ ms}}$.", [f"R={R}", f"C={C}", f"fr={fr}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_scaling_change(rng):
    for _ in forever():
        fr = pick(rng, [2, 3, 4]); fc = pick(rng, [2, 3, 4]); mode = pick(rng, ["increased", "decreased"])
        f = fr / fc if mode == "decreased" else fr * fc
        break
    if mode == "increased":
        text = f"The resistance is multiplied by ${fr}$ and the capacitance is multiplied by ${fc}$"; f = fr * fc
    else:
        text = f"The resistance is multiplied by ${fr}$ and the capacitance is divided by ${fc}$"; f = fr / fc
    key, ds = num_opts(f, [("Adds the two factors.", (fr + fc) if mode == "increased" else (fr + 1 / fc)), ("Uses the inverse of the product.", 1 / f), ("Squares the product.", f * f), ("Uses only the change in the resistance.", float(fr))], "", fmt=lambda v: "$" + sig(v) + "$ times the original")
    stem = f"In a series RC circuit the time constant is $\\tau$. {text}. By what factor does the time needed for the capacitor to reach a given fraction of its final charge change?"
    return MQ("pe_rc_scaling_change", "11.8", "2.D", stem, key, ds, rng, "The charging time at any given fraction scales with the time constant $RC$", ["Recognize that every time scales with $RC$", "Multiply the factors for $R$ and $C$"],
              "the time to reach a fixed fraction is recomputed for the old and new constants", f"The time scales with $RC$, so the new time is ${sig(f)}$ times the original.", [f"fr={fr}", f"fc={fc}", f"mode={mode}"], est=70, judg=["proportional_reasoning"])


@retry_sep
def pe_rc_energy_dissipated(rng):
    for _ in forever():
        C = pick(rng, [5.0, 10.0, 20.0, 50.0]); e = pick(rng, [6.0, 12.0, 24.0])
        U = 0.5 * C * 1e-6 * e ** 2 * 1e6
        Rr = 1000.0; tau = Rr * C * 1e-6
        ts = np.linspace(0, 40 * tau, 400001); Ip = e / Rr * np.exp(-ts / tau); Ed = float(np.trapezoid(Ip ** 2 * Rr, ts)) * 1e6
        agree(U, Ed, 1e-4, "E")
        break
    key, ds = num_opts(U, [("Uses the total energy supplied by the battery, $C\\varepsilon^2$.", C * e * e), ("Uses the energy as $C\\varepsilon$.", C * e), ("Uses a quarter of the battery's work.", 0.25 * C * e * e), ("Uses $\\tfrac12C^2\\varepsilon$.", 0.5 * C * C * e)], "", fmt=FU(U_UJ))
    stem = f"A ${C:g}\\,\\mu\\text{{F}}$ capacitor is charged from zero to its full charge through a resistor by a ${e:g}\\text{{ V}}$ battery of negligible internal resistance. How much energy is dissipated as thermal energy in the resistor during the charging?"
    return MQ("pe_rc_energy_dissipated", "11.8", "2.B", stem, key, ds, rng, "Half of the battery's work goes into the capacitor and half is dissipated in the resistor", ["Find the work done by the battery, $Q\\varepsilon=C\\varepsilon^2$", "Subtract the energy stored, $\\tfrac12C\\varepsilon^2$"],
              "numpy integrates $I^2R$ over the charging current to recompute the dissipated energy", f"The battery supplies $C\\varepsilon^2$ and $\\tfrac12C\\varepsilon^2$ is stored, so ${sig(U)}\\,\\mu\\text{{J}}$ is dissipated.", [f"C={C}", f"e={e}"], est=95)


@retry_sep
def pe_bridge_voltage(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 18.0]); R1 = pick(rng, [2.0, 3.0, 4.0]); R2 = pick(rng, [4.0, 6.0, 8.0]); R3 = pick(rng, [2.0, 4.0, 6.0]); R4 = pick(rng, [2.0, 3.0, 6.0, 9.0])
        Va = e * R2 / (R1 + R2); Vb = e * R4 / (R3 + R4); d = Va - Vb
        if abs(d) > 0.5:
            break
    key, ds = signed_opts(d, [("Takes the potential at each midpoint relative to the wrong end of its divider.", e * R1 / (R1 + R2) - e * R3 / (R3 + R4)), ("Reverses the sign of the difference.", -d), ("Uses the full emf minus the potential of one midpoint only.", e - Va), ("Uses the ratio of the resistances instead of the voltage-divider fraction.", e * R2 / R1 - e * R4 / R3)], "", fmt=FU(U_V))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected across two parallel branches. Branch 1 is a resistor $R_1={R1:g}\\,\\Omega$ in series with $R_2={R2:g}\\,\\Omega$; branch 2 is $R_3={R3:g}\\,\\Omega$ in series with $R_4={R4:g}\\,\\Omega$. In each branch the first resistor connects to the battery's positive terminal and the second to the negative terminal. Point A is between $R_1$ and $R_2$ and point B is between $R_3$ and $R_4$. What is $V_A-V_B$?"
    return MQ("pe_bridge_voltage", "11.5", "2.B", stem, key, ds, rng, "Each branch is a voltage divider; the potential difference between midpoints is the difference of their potentials", ["Find the potential of each midpoint relative to the negative terminal", "Subtract the two midpoint potentials"],
              "the two midpoint potentials are recomputed from the branch currents", f"$V_A=\\varepsilon R_2/(R_1+R_2)$ and $V_B=\\varepsilon R_4/(R_3+R_4)$, so $V_A-V_B={sig(d)}\\text{{ V}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"R3={R3}", f"R4={R4}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_max_power_transfer(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); r = pick(rng, [1.0, 2.0, 3.0, 4.0])
        Rs = sp.symbols("Rs", positive=True); root = float(sp.solve(sp.diff(e ** 2 * Rs / (Rs + r) ** 2, Rs), Rs)[0]); Pm = e ** 2 / (4 * r)
        grid = np.linspace(0.01, 10 * r, 200001); num = float(grid[np.argmax(e ** 2 * grid / (grid + r) ** 2)])
        agree(root, num, 1e-3, "R"); agree(Pm, e ** 2 * root / (root + r) ** 2, 1e-9, "P")
        break
    key, ds = num_opts(Pm, [("Uses $\\varepsilon^2/r$, the power if the load resistance were zero.", e ** 2 / r), ("Uses $\\varepsilon^2/(2r)$.", e ** 2 / (2 * r)), ("Uses $\\varepsilon^2/(8r)$.", e ** 2 / (8 * r)), ("Uses $\\varepsilon^2/(r+r)$ as the power in the load with $R=r$, forgetting that the current is shared.", e ** 2 / (4 * r) * 2)], "", fmt=FU(U_W))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and internal resistance ${r:g}\\,\\Omega$ is connected to a variable load resistor $R$. What is the maximum power that can be delivered to the load as $R$ is varied?"
    return MQ("pe_max_power_transfer", "11.4", "2.A", stem, key, ds, rng, "The load power is maximized when the load resistance equals the internal resistance", ["Write $P=\\varepsilon^2R/(R+r)^2$", "Set $dP/dR=0$ to find $R=r$ and evaluate"],
              "sympy solves $dP/dR=0$; a numerical scan over the load resistance recomputes the maximum", f"$dP/dR=0$ gives $R=r$, so $P_{{max}}=\\varepsilon^2/(4r)={sig(Pm)}\\text{{ W}}$.", [f"e={e}", f"r={r}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_cap_steady_state_charge(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 18.0, 24.0]); R1 = pick(rng, [2.0, 4.0, 6.0]) * 1e3; R2 = pick(rng, [2.0, 4.0, 6.0, 12.0]) * 1e3; C = pick(rng, [5.0, 10.0, 20.0]) * 1e-6
        Vc = e * R2 / (R1 + R2); q = C * Vc * 1e6
        if R1 != R2:
            break
    key, ds = num_opts(q, [("Uses the full emf across the capacitor.", C * e * 1e6), ("Uses the voltage across $R_1$ instead of across $R_2$.", C * e * R1 / (R1 + R2) * 1e6), ("Takes the voltage across the capacitor as half the emf.", C * e / 2 * 1e6), ("Uses the capacitor charge with the current $\\varepsilon/R_1$ in the divider.", C * e * R2 / R1 * 1e6 if R2 / R1 < 3 else None)], "", fmt=FU(U_UC))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected in series with a resistor $R_1={R1 / 1e3:g}\\text{{ k}}\\Omega$ and a parallel combination of a resistor $R_2={R2 / 1e3:g}\\text{{ k}}\\Omega$ and a ${C * 1e6:g}\\,\\mu\\text{{F}}$ capacitor. After the switch has been closed for a very long time, how much charge is on the capacitor?"
    return MQ("pe_cap_steady_state_charge", "11.8", "2.B", stem, key, ds, rng, "In steady state no current flows through the capacitor, so it has the voltage of the resistor in parallel with it", ["Find the steady current through $R_1$ and $R_2$", "Use $q=CV_{R_2}$"],
              "numpy solves the steady-state loop equation to recompute the voltage across the parallel resistor", f"The steady current is $\\varepsilon/(R_1+R_2)$, so $V_C=\\varepsilon R_2/(R_1+R_2)$ and $q=CV_C={sig(q)}\\,\\mu\\text{{C}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"C={C}"], est=100)


@retry_sep
def pe_rc_initial_final_current(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); R1 = pick(rng, [2.0, 4.0, 6.0]); R2 = pick(rng, [4.0, 6.0, 12.0]); when = pick(rng, ["just after the switch is closed", "a very long time after the switch is closed"])
        I = e / R1 if when.startswith("just") else e / (R1 + R2)
        break
    wr = [("Takes the capacitor as an open circuit at the start, so the current is $\\varepsilon/(R_1+R_2)$." if when.startswith("just") else "Takes the capacitor as a short circuit in steady state, so the current is $\\varepsilon/R_1$.", e / (R1 + R2) if when.startswith("just") else e / R1), ("Uses only $R_2$.", e / R2), ("Uses the parallel combination of the resistors.", e / (R1 * R2 / (R1 + R2))), ("Says the current is zero.", 0.0)]
    key, ds = num_opts(I, [(w, v) for w, v in wr], "", fmt=FU(U_A))
    stem = f"A battery of emf ${e:g}\\text{{ V}}$ and negligible internal resistance is connected in series with a resistor $R_1={R1:g}\\,\\Omega$ and a parallel combination of a resistor $R_2={R2:g}\\,\\Omega$ and an initially uncharged capacitor. What is the current supplied by the battery {when}?"
    return MQ("pe_rc_initial_final_current", "11.8", "2.B", stem, key, ds, rng, "An uncharged capacitor acts like a wire at first and like an open circuit in steady state", ["Decide how the capacitor behaves at the stated time", "Apply Ohm's law to the resulting circuit"],
              "the time-dependent current is recomputed by integrating the circuit equation to short and long times", f"The battery current {when} is ${sig(I)}\\text{{ A}}$.", [f"e={e}", f"R1={R1}", f"R2={R2}", f"when={when}"], est=95, judg=["law_selection", "justification"])


@retry_sep
def pe_series_resistors_claim(rng):
    key, ds = sentence_options("The current is the same in both resistors and the larger resistor has the greater potential difference across it and dissipates more power.", "In series the current is equal; $V=IR$ and $P=I^2R$ both grow with $R$ at a fixed current.",
                               [("The current is larger in the smaller resistor, because it offers less opposition, and the potential difference across the two resistors is the same.", "Thinks current divides in a series connection as it does in a parallel connection."),
                                ("The current is the same in both resistors, and the larger resistor dissipates less power, because $P=V^2/R$ falls as $R$ grows.", "Applies $P=V^2/R$ with the same voltage on both resistors, which is true only for a parallel connection."),
                                ("The current is smaller in the larger resistor, because the larger resistor uses up more of the current as it dissipates more power.", "Believes current is used up by a resistor.")])
    stem = "Two resistors with different resistances are connected in series to a battery. Which statement about the currents, the potential differences and the power dissipated in the two resistors is correct and best justified?"
    return MQ("pe_series_resistors_claim", "11.2", "3.B", stem, key, ds, rng, "In series the current is common and the voltages and powers divide in proportion to resistance", ["Apply current conservation to the series loop", "Use $V=IR$ and $P=I^2R$"],
              "the currents, voltages and powers of a sample series pair are recomputed numerically", "", ["claim"], est=80, judg=["justification"], cond=[("the resistors are ohmic and the battery is ideal", "the stem states ohmic resistors and a battery")])


@retry_sep
def pe_junction_current(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 3.0, 4.0, 5.0]); R2 = pick(rng, [2.0, 4.0, 6.0]); V2 = pick(rng, [6.0, 8.0, 12.0]); I2 = V2 / R2
        I3 = I1 - I2
        if I3 != 0 and abs(I3) > 0.4 and abs(I3) != I2:
            break
    key, ds = signed_opts(I3, [("Adds the two currents, as if both entered the junction.", I1 + I2), ("Subtracts in the wrong order.", I2 - I1), ("Uses the current in the second branch only.", I2), ("Divides the potential difference by the first current.", V2 / I1)], "", fmt=FU(U_A))
    stem = f"At a junction, a wire carries ${I1:g}\\text{{ A}}$ into the junction. A second wire leaves the junction through a ${R2:g}\\,\\Omega$ resistor with a potential difference of ${V2:g}\\text{{ V}}$ across it. A third wire is the only other connection. What is the current in the third wire? Count a current leaving the junction as positive."
    return MQ("pe_junction_current", "11.7", "2.B", stem, key, ds, rng, "Kirchhoff's junction rule says the currents entering and leaving a junction balance", ["Find the current in the resistor with Ohm's law", "Apply the junction rule with signs"],
              "the junction balance is recomputed by summing signed currents", f"The resistor carries ${sig(I2)}\\text{{ A}}$ away, so the third wire carries $I_3=I_1-I_2={sig(I3)}\\text{{ A}}$ away from the junction.", [f"I1={I1}", f"R2={R2}", f"V2={V2}"], est=80)


STAGE_U11 = ["pe_current_drift", "pe_current_charge_integral", "pe_resistance_geometry", "pe_resistance_value", "pe_resistor_nonuniform", "pe_iv_curve_resistance", "pe_power_bulb_voltage", "pe_bulbs_claim", "pe_series_parallel_current", "pe_kirchhoff_two_loop", "pe_internal_resistance_terminal", "pe_parallel_added_power",
             "pe_rc_charging_current", "pe_rc_charge_at_time", "pe_rc_discharge_time", "pe_rc_scaling_change", "pe_rc_energy_dissipated", "pe_bridge_voltage", "pe_max_power_transfer", "pe_cap_steady_state_charge", "pe_rc_initial_final_current", "pe_series_resistors_claim", "pe_junction_current"]
