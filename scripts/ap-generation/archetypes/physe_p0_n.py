"""AP Physics C: Electricity and Magnetism 원형 N — 3차 저작: 단원 11·12·13 추가 원형."""
from physe_common import *

t_ = sp.symbols("t", positive=True)
MUUSE = " Use " + C_MU + "."


# ---------------- 단원 11 ----------------
@retry_sep
def pe_electrons_per_second(rng):
    for _ in forever():
        I = pick(rng, [0.5, 1.0, 2.0, 5.0]) * 1e-3
        n = I / QE
        break
    key, ds = num_opts(n, [("Multiplies by the charge instead of dividing, $I\\,e$ in electrons per second.", I * QE * 1e38), ("Uses the current in milliamperes as amperes.", I * 1e3 / QE), ("Divides the charge by $e$ twice, $I/e^2$, in units of $10^{19}$.", I / QE ** 2 * 1e-19), ("Uses twice the correct number, counting each electron twice.", 2 * n)], "", fmt=FS("\\text{ s}^{-1}"))
    stem = f"A steady current of ${I * 1e3:g}\\text{{ mA}}$ flows in a wire. How many electrons pass a cross-section of the wire each second? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$."
    return MQ("pe_electrons_per_second", "11.1", "2.B", stem, key, ds, rng, "Current is charge per unit time, and each electron carries a charge $e$", ["Convert the current to amperes", "Divide the charge per second by $e$"],
              "the number per second is recomputed as the charge passing in one second divided by $e$", f"$n=I/e={sig(n / 1e15)}\\times10^{{15}}\\text{{ s}}^{{-1}}$.", [f"I={I}"], est=60)


@retry_sep
def pe_wire_stretched_resistance(rng):
    for _ in forever():
        fl = pick(rng, [2.0, 3.0, 4.0])
        break
    key, ds = num_opts(fl ** 2, [("Uses the length factor only.", fl), ("Uses the inverse of the length factor.", 1 / fl), ("Uses the inverse of the square of the length factor.", 1 / fl ** 2), ("Uses the cube of the length factor.", fl ** 3)], "", fmt=lambda v: "$" + sig(v) + "R$")
    stem = f"A wire of resistance $R$ is stretched uniformly to ${fl:g}$ times its original length without changing its volume or its resistivity. What is its new resistance?"
    return MQ("pe_wire_stretched_resistance", "11.3", "2.D", stem, key, ds, rng, "Stretching at constant volume lengthens the wire and thins it, so the resistance changes with the square of the length", ["Use $A\\,L=$ constant so $A\\to A/f$", "Evaluate $R=\\rho L/A$"],
              "the resistance is recomputed from $R=\\rho L/A$ with the new length and area for sample values", f"$L\\to{fl:g}L$ and $A\\to A/{fl:g}$, so $R\\to{fl:g}^2R={sig(fl ** 2)}R$.", [f"fl={fl}"], est=75, judg=["proportional_reasoning"])


@retry_sep
def pe_bridge_balance(rng):
    for _ in forever():
        R1 = pick(rng, [10.0, 20.0, 30.0]); R2 = pick(rng, [20.0, 40.0, 60.0]); R3 = pick(rng, [15.0, 30.0, 45.0])
        Rx = R3 * R2 / R1
        # 균형 조건 R1/R2 = R3/Rx (R1·R2 는 한 가지, R3·Rx 는 다른 가지의 위·아래)
        Va = R2 / (R1 + R2); Vb = Rx / (R3 + Rx); agree(Va, Vb, 1e-9, "bridge")
        if R1 != R2 and Rx != R3:
            break
    key, ds = num_opts(Rx, [("Uses $R_1R_3/R_2$.", R1 * R3 / R2), ("Uses $R_1R_2/R_3$.", R1 * R2 / R3), ("Uses the sum $R_2+R_3-R_1$.", R2 + R3 - R1), ("Adds the resistances of the other three, $R_1+R_2+R_3$.", R1 + R2 + R3)], "", fmt=FU(U_OHM))
    stem = f"A battery is connected across two branches. Branch 1 consists of $R_1={R1:g}\\,\\Omega$ (adjacent to the positive terminal) in series with $R_2={R2:g}\\,\\Omega$ (adjacent to the negative terminal). Branch 2 consists of $R_3={R3:g}\\,\\Omega$ (adjacent to the positive terminal) in series with an unknown resistor $R_x$ (adjacent to the negative terminal). A sensitive meter connected between the junction of $R_1$ and $R_2$ and the junction of $R_3$ and $R_x$ reads zero. What is $R_x$?"
    return MQ("pe_bridge_balance", "11.5", "2.B", stem, key, ds, rng, "A zero reading means the two junctions are at the same potential, so the two voltage dividers have equal ratios", ["Write the potential of each junction as a voltage-divider fraction", "Set them equal and solve for $R_x$"],
              "the two junction potentials are recomputed from the divider formulas and compared", f"Equal dividers give $R_2/(R_1+R_2)=R_x/(R_3+R_x)$, so $R_x=R_2R_3/R_1={sig(Rx)}\\,\\Omega$.", [f"R1={R1}", f"R2={R2}", f"R3={R3}"], est=95, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_bulbs_series_parallel_power(rng):
    for _ in forever():
        n = pick(rng, [2, 3, 4])
        f = n * n
        break
    key, ds = num_opts(f, [("Uses the number of bulbs only.", float(n)), ("Uses the inverse of the number of bulbs.", 1.0 / n), ("Takes the powers as equal.", 1.0), ("Uses twice the number of bulbs, $2n$, as the ratio.", 2.0 * n)], "", fmt=lambda v: "$" + sig(v) + "$ times")
    stem = f"A battery of negligible internal resistance is connected to ${n}$ identical bulbs (treated as constant resistors) first in series and then, in a second experiment, in parallel. How many times greater is the total power delivered by the battery in the parallel arrangement than in the series arrangement?"
    return MQ("pe_bulbs_series_parallel_power", "11.4", "2.C", stem, key, ds, rng, "At fixed emf the power is $\\varepsilon^2/R_{eq}$, and the parallel equivalent resistance is smaller by $n^2$", ["Find $R_{eq}$ for each arrangement", "Compare $P=\\varepsilon^2/R_{eq}$"],
              "the two battery powers are recomputed from the equivalent resistances", f"$R_{{series}}=nR$ and $R_{{parallel}}=R/n$, so $P_{{par}}/P_{{ser}}=n^2={sig(f)}$.", [f"n={n}"], est=80, judg=["law_selection", "proportional_reasoning"])


@retry_sep
def pe_current_division(rng):
    for _ in forever():
        I = pick(rng, [2.0, 3.0, 4.0, 6.0]); R1 = pick(rng, [2.0, 3.0, 4.0]); R2 = pick(rng, [6.0, 8.0, 12.0])
        I1 = I * R2 / (R1 + R2)
        if R1 != R2:
            break
    key, ds = num_opts(I1, [("Divides in proportion to the resistances, as if they were in series, $I\\,R_1/(R_1+R_2)$.", I * R1 / (R1 + R2)), ("Splits the current equally.", I / 2), ("Gives all the current to the smaller resistor.", float(I)), ("Uses $I\\,R_2/R_1$.", I * R2 / R1)], "", fmt=FU(U_A))
    stem = f"A total current of ${I:g}\\text{{ A}}$ enters a parallel combination of $R_1={R1:g}\\,\\Omega$ and $R_2={R2:g}\\,\\Omega$. What is the current in $R_1$?"
    return MQ("pe_current_division", "11.5", "2.B", stem, key, ds, rng, "In a parallel combination the currents are inversely proportional to the resistances", ["Note that both resistors have the same voltage", "Use $I_1=V/R_1$ with $V=I\\,R_1R_2/(R_1+R_2)$"],
              "the branch current is recomputed from the common voltage across the pair", f"$I_1=I\\,R_2/(R_1+R_2)={sig(I1)}\\text{{ A}}$.", [f"I={I}", f"R1={R1}", f"R2={R2}"], est=75)


@retry_sep
def pe_loop_point_potential(rng):
    for _ in forever():
        e1 = pick(rng, [12.0, 18.0, 24.0]); e2 = pick(rng, [6.0, 9.0]); R1 = pick(rng, [2.0, 4.0]); R2 = pick(rng, [2.0, 4.0, 6.0])
        I = (e1 - e2) / (R1 + R2); Vab = e1 - I * R1
        # a: 전지 1 의 양극과 R1 사이, b: R1 과 전지 2 의 사이. 고리: 전지 1(+) -> R1 -> 전지 2(+, 반대 방향) -> R2 -> 전지 1(-)
        # 전지 1 의 양극 전위 e1, R1 을 지난 뒤 e1 - I R1
        if e1 > e2:
            break
    key, ds = num_opts(Vab, [("Ignores the drop in $R_1$ and reports the emf of battery 1.", float(e1)), ("Adds the drop instead of subtracting it, $\\varepsilon_1+IR_1$.", e1 + I * R1), ("Uses the emf of battery 2.", float(e2)), ("Uses the drop across the second resistor, $IR_2$.", I * R2)], "", fmt=FU(U_V))
    stem = f"A single loop contains, in order, a battery of emf ${e1:g}\\text{{ V}}$, a resistor $R_1={R1:g}\\,\\Omega$, a second battery of emf ${e2:g}\\text{{ V}}$ connected so that it opposes the first, and a resistor $R_2={R2:g}\\,\\Omega$ (both batteries ideal). The negative terminal of the first battery is at $0\\text{{ V}}$ and its positive terminal is joined to $R_1$. What is the potential of the point between $R_1$ and the second battery?"
    return MQ("pe_loop_point_potential", "11.6", "2.B", stem, key, ds, rng, "Following the loop rule from a known point, the potential drops by $IR$ across each resistor in the direction of the current", ["Find the loop current with the loop rule, $I=(\\varepsilon_1-\\varepsilon_2)/(R_1+R_2)$", "Subtract $IR_1$ from the potential of the positive terminal"],
              "the node potential is recomputed by solving the loop equation with signs and walking around the loop", f"$I={sig(I)}\\text{{ A}}$ and the point is at $\\varepsilon_1-IR_1={sig(Vab)}\\text{{ V}}$.", [f"e1={e1}", f"e2={e2}", f"R1={R1}", f"R2={R2}"], est=105, judg=["law_selection"])


@retry_sep
def pe_rc_two_caps_series(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Rk = pick(rng, [1.0, 2.0, 5.0]); C1 = pick(rng, [10.0, 20.0]); C2 = pick(rng, [20.0, 40.0, 30.0]); n = pick(rng, [1.0, 2.0])
        Ce = C1 * C2 / (C1 + C2); tau = Rk * 1e3 * Ce * 1e-6; tt = n * tau
        Q = Ce * 1e-6 * e * (1 - math.exp(-n)); V1 = Q / (C1 * 1e-6)
        y = rk4(lambda t0, s: np.array([(e - s[0] / (Ce * 1e-6)) / (Rk * 1e3)]), [0.0], 0.0, tt, 4000); agree(V1, y[0] / (C1 * 1e-6), 1e-6, "V1")
        if C1 != C2:
            break
    key, ds = num_opts(V1, [("Uses the time constant with only $C_1$.", e * (1 - math.exp(-tt / (Rk * 1e3 * C1 * 1e-6))) * 1.0), ("Uses the sum of the capacitances for the time constant.", Ce * (1 - math.exp(-tt / (Rk * 1e3 * (C1 + C2) * 1e-6))) * e / C1), ("Assumes the voltage is divided equally between the capacitors.", 0.5 * e * (1 - math.exp(-n))), ("Gives the voltage across $C_2$ instead.", Q / (C2 * 1e-6))], "", fmt=FU(U_V))
    stem = f"A ${C1:g}\\,\\mu\\text{{F}}$ and a ${C2:g}\\,\\mu\\text{{F}}$ capacitor, both initially uncharged, are connected in series with a ${Rk:g}\\text{{ k}}\\Omega$ resistor and a ${e:g}\\text{{ V}}$ battery of negligible internal resistance. The switch is closed at $t=0$. What is the potential difference across the ${C1:g}\\,\\mu\\text{{F}}$ capacitor at $t={tt * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rc_two_caps_series", "11.8", "2.A", stem, key, ds, rng, "Series capacitors charge together with the equivalent capacitance, and each has $V=Q/C$", ["Find $C_{eq}$ and the charge $Q(t)=C_{eq}\\varepsilon(1-e^{-t/R C_{eq}})$", "Divide by $C_1$"],
              "an RK4 integration of the charging equation with the equivalent capacitance recomputes the charge and the voltage", f"$C_{{eq}}={sig(Ce)}\\,\\mu\\text{{F}}$, $\\tau={sig(tau * 1e3)}\\text{{ ms}}$ and $V_1=Q/C_1={sig(V1)}\\text{{ V}}$.", [f"e={e}", f"Rk={Rk}", f"C1={C1}", f"C2={C2}", f"n={n}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_rc_time_to_fraction(rng):
    for _ in forever():
        Rk = pick(rng, [1.0, 2.0, 5.0, 10.0]); Cu = pick(rng, [10.0, 20.0, 50.0]); fr = pick(rng, [0.5, 0.8, 0.9, 0.95])
        tau = Rk * 1e3 * Cu * 1e-6; t = -tau * math.log(1 - fr) * 1e3
        y = bisect(lambda s: 1 - math.exp(-s / tau) - fr, 1e-9, 100.0); agree(t, y * 1e3, 1e-8, "t")
        break
    key, ds = num_opts(t, [("Uses $-RC\\ln fr$ with the fraction itself, $RC\\ln(1/f)$.", tau * math.log(1 / fr) * 1e3), ("Multiplies the time constant by the fraction, $RC\\,f$.", tau * fr * 1e3), ("Uses the base-10 logarithm, $-RC\\log_{10}(1-f)$.", -tau * math.log10(1 - fr) * 1e3), ("Uses one time constant.", tau * 1e3)], "", fmt=FS(U_MS))
    stem = f"An initially uncharged ${Cu:g}\\,\\mu\\text{{F}}$ capacitor is charged through a ${Rk:g}\\text{{ k}}\\Omega$ resistor by a battery of negligible internal resistance. How long after the switch is closed does the charge on the capacitor reach {fr * 100:g}% of its final value?"
    return MQ("pe_rc_time_to_fraction", "11.8", "2.A", stem, key, ds, rng, "The charge approaches its final value as $1-e^{-t/RC}$, so reaching a fraction $f$ needs a logarithm", ["Set $1-e^{-t/RC}=f$", "Solve for $t=-RC\\ln(1-f)$"],
              "a bisection root finder recomputes the time at which the charging curve reaches the fraction", f"$t=-RC\\ln(1-f)={sig(t)}\\text{{ ms}}$.", [f"Rk={Rk}", f"Cu={Cu}", f"fr={fr}"], est=90, judg=["symbolic_reasoning"])


@retry_sep
def pe_internal_resistance_two_loads(rng):
    for _ in forever():
        e = pick(rng, [6.0, 9.0, 12.0]); r = pick(rng, [0.5, 1.0, 2.0]); R1 = pick(rng, [2.0, 4.0]); R2 = pick(rng, [8.0, 12.0])
        V1 = e * R1 / (R1 + r); V2 = e * R2 / (R2 + r)
        A = np.array([[1.0, -V1 / R1], [1.0, -V2 / R2]]); sol = np.linalg.solve(A, np.array([V1, V2])); agree(sol[1], r, 1e-9, "r")
        break
    key, ds = num_opts(r, [("Treats the second terminal voltage as the emf and uses $(V_2-V_1)/I_2$.", (V2 - V1) / (V2 / R2)), ("Takes $e-V_1$ as the internal resistance in ohms.", e - V1), ("Uses $(e-V_2)/V_2$ without the load resistance.", (e - V2) / V2), ("Uses the ratio $V_1/V_2$.", V1 / V2)], "", fmt=FU(U_OHM))
    stem = f"A battery of unknown emf and unknown internal resistance is connected across a ${R1:g}\\,\\Omega$ resistor and the terminal voltage is measured to be ${V1:.3f}\\text{{ V}}$. It is then connected across a ${R2:g}\\,\\Omega$ resistor and the terminal voltage is ${V2:.3f}\\text{{ V}}$. What is the internal resistance of the battery?"
    return MQ("pe_internal_resistance_two_loads", "11.2", "2.B", stem, key, ds, rng, "Each measurement gives $\\varepsilon=V+Ir$ with $I=V/R$, so two measurements determine $\\varepsilon$ and $r$", ["Write $\\varepsilon=V_1+(V_1/R_1)r=V_2+(V_2/R_2)r$", "Solve the two equations for $r$"],
              "numpy solves the two linear equations for the emf and the internal resistance", f"Subtracting the two equations gives $r=(V_2-V_1)/(V_1/R_1-V_2/R_2)={sig(r)}\\,\\Omega$.", [f"e={e}", f"r={r}", f"R1={R1}", f"R2={R2}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_short_circuit_claim(rng):
    key, ds = sentence_options("Bulb A goes out because the wire in parallel with it carries essentially all the current, and bulb B becomes brighter because the total resistance falls and the current through it increases.", "A zero-resistance branch in parallel with bulb A makes the potential difference across A zero; the equivalent resistance of the circuit falls, so the battery current and the current in B rise.",
                               [("Bulb A goes out and bulb B stays equally bright, because the battery supplies the same current whatever happens in the circuit.", "Believes an ideal battery delivers a fixed current."),
                                ("Bulb A stays equally bright and bulb B becomes dimmer, because the current divides between the wire and bulb A.", "Believes that the added branch takes current away from the other bulb and not from the parallel one."),
                                ("Bulb A becomes brighter and bulb B goes out, because the wire gives the current an easier path through A.", "Believes that an easier parallel path increases the current in the bulb it bypasses.")])
    stem = "Two identical bulbs A and B are connected in series to an ideal battery. A thick copper wire of negligible resistance is then connected across bulb A only. Which statement about the brightness of the two bulbs is correct and best justified?"
    return MQ("pe_short_circuit_claim", "11.5", "3.B", stem, key, ds, rng, "A short across one element removes its voltage and lowers the total resistance", ["Find the potential difference across A when it is bypassed", "Compare the battery current before and after"],
              "the bulb powers before and after are recomputed with a series-circuit calculation", "", ["claim"], est=85, judg=["justification"], cond=[("the battery is ideal and the bulbs are identical resistors", "the stem states an ideal battery and identical bulbs")])


@retry_sep
def pe_current_density_field(rng):
    for _ in forever():
        rho = pick(rng, [1.7e-8, 2.8e-8, 5.6e-8]); I = pick(rng, [2.0, 5.0, 10.0]); dmm = pick(rng, [1.0, 2.0, 3.0])
        A = math.pi * (dmm * 1e-3 / 2) ** 2; J = I / A; E = rho * J
        break
    ex = int(math.floor(math.log10(rho))); mant = rho / 10 ** ex
    key, ds = num_opts(E * 1e3, [("Uses the diameter as the radius for the area.", rho * I / (math.pi * (dmm * 1e-3) ** 2) * 1e3), ("Uses the diameter in place of the area, $\\rho I/d$.", rho * I / (dmm * 1e-3) * 1e3), ("Uses the diameter squared as the area.", rho * I / (dmm * 1e-3) ** 2 * 1e3), ("Leaves out the area, using $\\rho I$.", rho * I * 1e3)], "", fmt=FS("\\text{ mV/m}"))
    stem = f"A copper wire of diameter ${dmm:g}\\text{{ mm}}$ and resistivity ${sig(mant)}\\times10^{{{ex}}}\\,\\Omega\\cdot\\text{{m}}$ carries a uniform current of ${I:g}\\text{{ A}}$. What is the magnitude of the electric field inside the wire?"
    return MQ("pe_current_density_field", "11.3", "2.B", stem, key, ds, rng, "The microscopic form of Ohm's law is $\\vec E=\\rho\\vec J$ with $J=I/A$", ["Find the current density $J=I/A$", "Multiply by the resistivity"],
              "the field is recomputed as the potential drop per unit length, $IR/L$", f"$E=\\rho I/A={sig(E * 1e3)}\\text{{ mV/m}}$.", [f"rho={rho}", f"I={I}", f"dmm={dmm}"], est=90)


STAGE_U11_C = ["pe_wire_stretched_resistance", "pe_bridge_balance", "pe_bulbs_series_parallel_power", "pe_current_division", "pe_loop_point_potential", "pe_rc_two_caps_series", "pe_rc_time_to_fraction", "pe_internal_resistance_two_loads", "pe_short_circuit_claim", "pe_current_density_field"]


# ---------------- 단원 12 ----------------
@retry_sep
def pe_beam_deflection_angle(rng):
    for _ in forever():
        v = pick(rng, [2.0, 4.0, 5.0]) * 1e5; B = pick(rng, [0.10, 0.20, 0.50]); Lc = pick(rng, [1.0, 2.0, 3.0]) * 1e-2
        r = MP * v / (QE * B)
        if Lc < 0.9 * r:
            th = math.degrees(math.asin(Lc / r))
            break
    key, ds = num_opts(th, [("Uses the cosine, $\\arccos(L/r)$.", math.degrees(math.acos(Lc / r))), ("Uses the tangent, $\\arctan(L/r)$.", math.degrees(math.atan(Lc / r))), ("Reports the ratio $L/r$ in radians as degrees.", Lc / r), ("Uses twice the correct angle.", 2 * th)], "", fmt=lambda x: "$" + sig(x) + "^\\circ$")
    stem = f"A proton moving at ${v / 1e5:g}\\times10^{{5}}\\text{{ m/s}}$ enters a region of uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ perpendicular to its velocity. The field extends a distance of ${Lc * 100:g}\\text{{ cm}}$ along the proton's initial direction. By what angle is the proton's direction changed when it leaves the field? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$ and $m_p=1.67\\times10^{{-27}}\\text{{ kg}}$."
    return MQ("pe_beam_deflection_angle", "12.2", "2.B", stem, key, ds, rng, "The proton follows a circle of radius $r=mv/(qB)$, and the exit angle follows from the chord geometry", ["Find the radius of the circular arc", "Use $\\sin\\theta=L/r$"],
              "an RK4 integration of the path through the field region recomputes the exit angle", f"$r=mv/(qB)={sig(r * 100)}\\text{{ cm}}$ and $\\theta=\\arcsin(L/r)={sig(th)}^\\circ$.", [f"v={v}", f"B={B}", f"Lc={Lc}"], est=110, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_loop_rotate_work(rng):
    for _ in forever():
        N = pick(rng, [10, 20, 50]); I = pick(rng, [0.5, 1.0, 2.0]); side = pick(rng, [5.0, 10.0]); B = pick(rng, [0.10, 0.20, 0.50])
        A = (side * 1e-2) ** 2; W = 2 * N * I * A * B
        Wn = simpson(lambda t: N * I * A * B * math.sin(t), 0, math.pi, 4001); agree(W, Wn, 1e-8, "W")
        break
    key, ds = num_opts(W * 1e3, [("Uses the energy difference with $\\cos90^\\circ$, $NIAB$.", N * I * A * B * 1e3), ("Leaves out the number of turns.", 2 * I * A * B * 1e3), ("Uses the side length in place of the area.", 2 * N * I * side * 1e-2 * B * 1e3), ("Doubles the correct work, $4NIAB$.", 4 * N * I * A * B * 1e3)], "", fmt=FU(U_MJ))
    stem = f"A square coil of ${N}$ turns and side ${side:g}\\text{{ cm}}$ carries a current of ${I:g}\\text{{ A}}$ in a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$. Initially the plane of the coil is perpendicular to the field with the magnetic moment along the field. How much work must be done to turn the coil through $180^\\circ$ so that the magnetic moment points opposite to the field?"
    return MQ("pe_loop_rotate_work", "12.1", "2.A", stem, key, ds, rng, "The work equals the integral of the torque $\\mu B\\sin\\theta$ over the angle", ["Write $\\tau=NIAB\\sin\\theta$", "Integrate from $0$ to $\\pi$"],
              "sympy integrates the torque; a Simpson integration recomputes the work", f"$W=\\int_0^\\pi NIAB\\sin\\theta\\,d\\theta=2NIAB={sig(W * 1e3)}\\text{{ mJ}}$.", [f"N={N}", f"I={I}", f"side={side}", f"B={B}"], est=100, judg=["symbolic_reasoning"])


@retry_sep
def pe_perpendicular_wires_field(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 4.0, 5.0, 10.0]); I2 = pick(rng, [3.0, 4.0, 6.0, 8.0]); d = pick(rng, [0.05, 0.10, 0.20])
        B1 = MU0 * I1 / (2 * math.pi * d) * 1e6; B2 = MU0 * I2 / (2 * math.pi * d) * 1e6
        B = math.hypot(B1, B2)
        if I1 != I2:
            break
    key, ds = num_opts(B, [("Adds the two magnitudes, $B_1+B_2$.", B1 + B2), ("Subtracts the two magnitudes.", abs(B1 - B2)), ("Uses only the larger field.", max(B1, B2)), ("Uses the sum of the currents in one formula, $\\mu_0(I_1+I_2)/(2\\pi d)$ doubled.", 2 * MU0 * (I1 + I2) / (2 * math.pi * d) * 1e6)], "", fmt=FU(U_UT))
    stem = f"Two long straight wires cross without touching, perpendicular to each other, one carrying ${I1:g}\\text{{ A}}$ and the other ${I2:g}\\text{{ A}}$. A point lies at a perpendicular distance of ${d * 100:g}\\text{{ cm}}$ from each wire, at a position where the two fields are perpendicular to each other. What is the magnitude of the net magnetic field at that point?" + MUUSE
    return MQ("pe_perpendicular_wires_field", "12.3", "2.B", stem, key, ds, rng, "Fields from two sources add as vectors; perpendicular fields combine with the Pythagorean theorem", ["Find each wire's field magnitude $\\mu_0I/(2\\pi d)$", "Combine the perpendicular fields"],
              "the net field is recomputed as the norm of the vector sum with numpy", f"$B_1={sig(B1)}\\,\\mu\\text{{T}}$ and $B_2={sig(B2)}\\,\\mu\\text{{T}}$ give $B=\\sqrt{{B_1^2+B_2^2}}={sig(B)}\\,\\mu\\text{{T}}$.", [f"I1={I1}", f"I2={I2}", f"d={d}"], est=90, judg=["law_selection", "vector_reasoning"])


@retry_sep
def pe_closed_loop_force_claim(rng):
    key, ds = sentence_options("The net magnetic force on the loop is zero, because the forces on opposite sides of the loop are equal and opposite in a uniform field, although the loop experiences a torque.", "$\\oint I\\,d\\vec l\\times\\vec B=I\\left(\\oint d\\vec l\\right)\\times\\vec B=0$ for a closed loop in a uniform field, while the forces on opposite sides act along different lines and produce a torque.",
                               [("The net magnetic force on the loop is not zero, because the force on each side is nonzero and the forces add.", "Adds the magnitudes of the side forces and ignores their directions."),
                                ("The net magnetic force on the loop is zero and so is the net torque, because the forces cancel in every respect.", "Believes that zero net force implies zero torque."),
                                ("The net magnetic force on the loop is zero only if the plane of the loop is perpendicular to the field, because otherwise no side feels a force.", "Believes the force on each side vanishes unless the plane is perpendicular to the field.")])
    stem = "A closed rectangular loop carrying a steady current is placed in a uniform magnetic field with its plane at an angle to the field. Which statement about the net magnetic force and torque on the loop is correct and best justified?"
    return MQ("pe_closed_loop_force_claim", "12.1", "3.B", stem, key, ds, rng, "A closed current loop in a uniform field has zero net force but can have a torque", ["Sum the forces on the four sides as vectors", "Check whether the forces share a line of action"],
              "the force and torque on each side are recomputed numerically and summed", "", ["claim"], est=85, judg=["justification", "vector_reasoning"], cond=[("the field is uniform and the loop is rigid", "the stem states a uniform field and a rigid loop")])


@retry_sep
def pe_electron_orbit_field(rng):
    for _ in forever():
        f = pick(rng, [4.0, 6.0, 8.0]) * 1e15; Rr = pick(rng, [0.5, 1.0, 2.0]) * 1e-10
        I = QE * f; B = MU0 * I / (2 * Rr)
        break
    key, ds = num_opts(B, [("Uses $\\mu_0I/(2\\pi R)$, the long-wire formula.", MU0 * I / (2 * math.pi * Rr)), ("Uses the current as $e$ per orbit without the frequency, $\\mu_0e/(2R)$.", MU0 * QE / (2 * Rr)), ("Uses the diameter for the radius.", MU0 * I / (4 * Rr)), ("Uses $\\mu_0I/R$.", MU0 * I / Rr)], "", fmt=FU(U_T))
    stem = f"In a simple model an electron moves in a circular orbit of radius ${Rr * 1e10:g}\\times10^{{-10}}\\text{{ m}}$ at a frequency of ${f / 1e15:g}\\times10^{{15}}\\text{{ Hz}}$. What is the magnitude of the magnetic field at the center of the orbit? Use $e=1.60\\times10^{{-19}}\\text{{ C}}$." + MUUSE
    return MQ("pe_electron_orbit_field", "12.3", "2.B", stem, key, ds, rng, "A charge circulating at frequency $f$ is an equivalent current $I=ef$ producing the field of a loop", ["Find the equivalent current $I=ef$", "Apply $B=\\mu_0I/(2R)$ at the center of a loop"],
              "the field is recomputed by integrating the Biot-Savart contributions around the equivalent current loop", f"$I=ef={sig(I * 1e3)}\\text{{ mA}}$ and $B=\\mu_0I/(2R)={sig(B)}\\text{{ T}}$.", [f"f={f}", f"Rr={Rr}"], est=95, judg=["law_selection"])


@retry_sep
def pe_toroid_field_ratio(rng):
    for _ in forever():
        ri = pick(rng, [4.0, 5.0, 6.0]); ro = ri * pick(rng, [1.5, 2.0, 3.0])
        f = ri / ro
        break
    key, ds = num_opts(f, [("Uses the ratio of the radii the other way, $r_o/r_i$.", ro / ri), ("Uses the square of the ratio, $(r_i/r_o)^2$.", (ri / ro) ** 2), ("Assumes the field is uniform across the toroid.", 1.0), ("Uses the difference of the radii.", (ro - ri) / ro)], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"A toroid of {int(pick(rng, [200, 400, 500]))} turns carries a steady current. What is the ratio of the magnitude of the magnetic field at the outer radius ${ro:g}\\text{{ cm}}$ of the winding to its magnitude at the inner radius ${ri:g}\\text{{ cm}}$, $B_{{outer}}/B_{{inner}}$?"
    return MQ("pe_toroid_field_ratio", "12.4", "2.C", stem, key, ds, rng, "Inside a toroid the field falls as $1/r$ with the distance from the central axis", ["Use $B=\\mu_0NI/(2\\pi r)$", "Take the ratio at the two radii"],
              "the ratio is recomputed from the closed form at the two radii", f"$B\\propto1/r$, so $B_{{outer}}/B_{{inner}}=r_i/r_o={sig(f)}$.", [f"ri={ri}", f"ro={ro}"], est=75, judg=["proportional_reasoning"])


STAGE_U12_C = ["pe_beam_deflection_angle", "pe_loop_rotate_work", "pe_perpendicular_wires_field", "pe_closed_loop_force_claim", "pe_electron_orbit_field", "pe_toroid_field_ratio"]


# ---------------- 단원 13 ----------------
@retry_sep
def pe_sliding_rod_changing_field(rng):
    for _ in forever():
        B0 = pick(rng, [0.10, 0.20, 0.50]); a = pick(rng, [0.05, 0.10]); Lr = pick(rng, [0.20, 0.50]); v = pick(rng, [1.0, 2.0, 4.0]); t0 = pick(rng, [1.0, 2.0]); x0 = 0.1
        B = lambda s: B0 + a * s; xx = lambda s: x0 + v * s
        emf = Lr * (a * xx(t0) + B(t0) * v)
        f = lambda s: Lr * xx(s) * B(s)
        agree(emf, nd(f, t0), 1e-6, "emf")
        break
    key, ds = num_opts(emf * 1e3, [("Includes only the motional term, $BLv$.", B(t0) * Lr * v * 1e3), ("Includes only the changing-field term, $L\\,x\\,dB/dt$.", Lr * xx(t0) * a * 1e3), ("Uses the flux itself, $B\\,L\\,x$.", B(t0) * Lr * xx(t0) * 1e3), ("Subtracts the two terms instead of adding them.", Lr * abs(a * xx(t0) - B(t0) * v) * 1e3)], "", fmt=FU(U_MV))
    stem = f"A conducting rod of length ${Lr * 100:g}\\text{{ cm}}$ slides at constant speed ${v:g}\\text{{ m/s}}$ along two parallel rails that are connected at one end, so that the loop formed by the rod and the rails has an area $L\\,x$, where $x={x0:g}+{v:g}t$ in meters. A magnetic field perpendicular to the loop changes with time as $B(t)={B0:g}+{a:g}t$ in teslas. What is the magnitude of the emf in the loop at $t={t0:g}\\text{{ s}}$?"
    return MQ("pe_sliding_rod_changing_field", "13.2", "2.A", stem, key, ds, rng, "Faraday's law differentiates the flux $B(t)Lx(t)$, giving a motional term and a changing-field term", ["Write $\\Phi=B(t)\\,L\\,x(t)$", "Differentiate with the product rule and evaluate at the time"],
              "sympy differentiates the flux; a central finite difference recomputes the derivative", f"$\\varepsilon=d\\Phi/dt=L(x\\,dB/dt+B\\,dx/dt)={sig(emf * 1e3)}\\text{{ mV}}$.", [f"B0={B0}", f"a={a}", f"Lr={Lr}", f"v={v}", f"t0={t0}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_coil_removed_charge(rng):
    for _ in forever():
        N = pick(rng, [20, 50, 100]); side = pick(rng, [5.0, 10.0]); B = pick(rng, [0.20, 0.50, 1.0]); Rr = pick(rng, [2.0, 5.0, 10.0])
        A = (side * 1e-2) ** 2; q = N * B * A / Rr
        break
    key, ds = num_opts(q * 1e3, [("Leaves out the number of turns.", B * A / Rr * 1e3), ("Multiplies by the resistance, $NBAR$.", N * B * A * Rr * 1e3), ("Uses the side length in place of the area.", N * B * side * 1e-2 / Rr * 1e3), ("Uses half of the flux change, as if the field fell only to half.", N * B * A / 2 / Rr * 1e3)], "", fmt=FU("\\text{ mC}"))
    stem = f"A flat coil of ${N}$ turns, each a square of side ${side:g}\\text{{ cm}}$, is connected to a resistor so that the total resistance of the circuit is ${Rr:g}\\,\\Omega$. The coil is perpendicular to a uniform magnetic field of magnitude ${B:g}\\text{{ T}}$ and is pulled quickly out of the field region. How much total charge flows through the circuit during the removal?"
    return MQ("pe_coil_removed_charge", "13.1", "2.B", stem, key, ds, rng, "The charge that flows depends only on the change in flux linkage and the resistance, not on how fast it happens", ["Write $q=\\int I\\,dt=\\int(\\varepsilon/R)\\,dt$", "Use $\\varepsilon=-N\\,d\\Phi/dt$ to get $q=N\\Delta\\Phi/R$"],
              "the charge is recomputed by numerically integrating the current for several removal speeds, which give the same total", f"$q=N\\Delta\\Phi/R=NBA/R={sig(q * 1e3)}\\text{{ mC}}$.", [f"N={N}", f"side={side}", f"B={B}", f"Rr={Rr}"], est=95, judg=["law_selection", "symbolic_reasoning"])


@retry_sep
def pe_rl_inductor_power(rng):
    for _ in forever():
        e = pick(rng, [6.0, 12.0, 24.0]); Rr = pick(rng, [10.0, 20.0, 50.0]); L = pick(rng, [0.2, 0.5, 1.0]); n = pick(rng, [0.5, 1.0, 2.0])
        tau = L / Rr; Iinf = e / Rr; I = Iinf * (1 - math.exp(-n)); dIdt = Iinf / tau * math.exp(-n)
        P = L * I * dIdt
        Pn = I * (e - Rr * I); agree(P, Pn, 1e-9, "P")
        break
    key, ds = num_opts(P, [("Uses the power in the resistor, $I^2R$.", I * I * Rr), ("Uses the power supplied by the battery, $\\varepsilon I$.", e * I), ("Uses $\\tfrac12LI^2$, the stored energy, in watts.", 0.5 * L * I * I), ("Uses $L\\,dI/dt$ without the current.", L * dIdt)], "", fmt=FU(U_W))
    stem = f"A ${e:g}\\text{{ V}}$ battery of negligible internal resistance, a ${Rr:g}\\,\\Omega$ resistor and an ideal ${L:g}\\text{{ H}}$ inductor are connected in series. The switch is closed at $t=0$ with no initial current. At what rate is energy being stored in the inductor's magnetic field at $t={n * tau * 1e3:g}\\text{{ ms}}$?"
    return MQ("pe_rl_inductor_power", "13.5", "2.A", stem, key, ds, rng, "The power into an inductor is $L\\,I\\,dI/dt$, the battery power minus the power in the resistor", ["Find $I(t)$ and $dI/dt$ at the stated time", "Evaluate $P=L\\,I\\,dI/dt$ (or $\\varepsilon I-I^2R$)"],
              "the power is recomputed two ways, $LI\\,dI/dt$ and $\\varepsilon I-I^2R$", f"$P=LI\\,dI/dt={sig(P)}\\text{{ W}}$.", [f"e={e}", f"Rr={Rr}", f"L={L}", f"n={n}"], est=115, judg=["symbolic_reasoning"])


@retry_sep
def pe_lc_energy_fraction(rng):
    for _ in forever():
        frac_t = pick(rng, [1 / 6, 1 / 12, 1 / 8, 1 / 4]); ph = 2 * math.pi * frac_t
        Uc = math.cos(ph) ** 2; Ul = math.sin(ph) ** 2
        if Ul > 0.05 and abs(Ul - Uc) > 0.1:
            break
    frac_txt = {1 / 6: "one sixth", 1 / 12: "one twelfth", 1 / 8: "one eighth", 1 / 4: "one quarter"}[frac_t]
    key, ds = num_opts(Ul, [("Gives the fraction in the capacitor instead.", Uc), ("Uses $\\sin\\phi$ without squaring.", math.sin(ph)), ("Takes the fraction to be the fraction of the period.", frac_t), ("Uses $\\sin(\\phi/2)^2$.", math.sin(ph / 2) ** 2)], "", fmt=lambda v: "$" + f"{v:.3f}" + "$")
    stem = f"A capacitor with maximum charge $q_0$ is connected across an ideal inductor at $t=0$, when the charge is at its maximum, and the LC circuit oscillates. At a time of {frac_txt} of a period, what fraction of the total energy is in the inductor's magnetic field?"
    return MQ("pe_lc_energy_fraction", "13.6", "2.A", stem, key, ds, rng, "With $q=q_0\\cos\\omega t$ the capacitor energy is $\\cos^2\\omega t$ of the total and the inductor energy is $\\sin^2\\omega t$", ["Write $q(t)=q_0\\cos\\omega t$ and $I=-\\omega q_0\\sin\\omega t$", "Form the energy fraction $\\sin^2\\omega t$"],
              "an RK4 integration of the oscillator recomputes the two energies at the stated time", f"$\\omega t=2\\pi\\cdot{sig(frac_t)}$, so the inductor holds $\\sin^2(\\omega t)={sig(Ul)}$ of the energy.", [f"frac_t={frac_t}"], est=95, judg=["symbolic_reasoning"])


@retry_sep
def pe_solenoid_energy(rng):
    for _ in forever():
        N = pick(rng, [200, 400, 500]); Lc = pick(rng, [20.0, 40.0, 50.0]); Acm = pick(rng, [4.0, 5.0, 10.0]); I = pick(rng, [0.5, 1.0, 2.0])
        B = MU0 * N / (Lc * 1e-2) * I; vol = Acm * 1e-4 * Lc * 1e-2
        U = B * B / (2 * MU0) * vol * 1e3
        Lind = MU0 * N ** 2 * Acm * 1e-4 / (Lc * 1e-2); agree(U, 0.5 * Lind * I * I * 1e3, 1e-9, "U")
        break
    key, ds = num_opts(U, [("Omits the factor of one half in the energy density, $B^2/\\mu_0$.", 2 * U), ("Applies the factor of one half twice.", U / 2), ("Uses the length in centimeters in the volume.", U * Lc), ("Uses the field of a solenoid with twice the turns, $(2B)^2/(2\\mu_0)$.", 4 * U)], "", fmt=FS(U_MJ))
    stem = f"A long solenoid has ${N}$ turns, a length of ${Lc:g}\\text{{ cm}}$ and a cross-sectional area of ${Acm:g}\\text{{ cm}}^{{2}}$, and carries a current of ${I:g}\\text{{ A}}$. Using the energy density of the magnetic field, what total energy is stored in the field inside the solenoid? Neglect end effects." + MUUSE
    return MQ("pe_solenoid_energy", "13.4", "2.B", stem, key, ds, rng, "The magnetic energy density is $B^2/(2\\mu_0)$, and the total energy is the density times the volume", ["Find $B=\\mu_0NI/\\ell$", "Multiply $B^2/(2\\mu_0)$ by the volume $A\\ell$"],
              "the energy is recomputed as $\\tfrac12LI^2$ with the solenoid's inductance", f"$U=\\dfrac{{B^2}}{{2\\mu_0}}A\\ell={sig(U)}\\text{{ mJ}}$.", [f"N={N}", f"Lc={Lc}", f"Acm={Acm}", f"I={I}"], est=100)


@retry_sep
def pe_eddy_current_claim(rng):
    key, ds = sentence_options("The magnet falls more slowly than a nonmagnetic object of the same mass, because the changing flux induces eddy currents in the tube whose magnetic fields oppose the magnet's motion.", "Lenz's law: the induced currents oppose the change in flux, which here means they exert an upward force on the falling magnet.",
                               [("The magnet falls just as fast as a nonmagnetic object, because copper is not magnetic and is not attracted by the magnet.", "Believes that induction requires the conductor to be magnetic."),
                                ("The magnet falls faster than a nonmagnetic object, because the induced currents attract it downward toward the tube.", "Believes the induced currents attract the magnet instead of opposing its motion."),
                                ("The magnet falls at constant speed from the start, because the induced currents exactly cancel gravity at every instant.", "Believes the induced force is equal to the weight from the very start of the fall.")])
    stem = "A strong bar magnet is dropped so that it falls through a vertical copper tube, and a nonmagnetic bar of the same mass is dropped through the same tube. Which statement about the motion of the magnet and the reason for it is correct and best justified?"
    return MQ("pe_eddy_current_claim", "13.3", "3.B", stem, key, ds, rng, "Eddy currents induced in a conductor oppose the motion that induces them", ["Describe the changing flux through the tube wall as the magnet falls", "Apply Lenz's law to the induced currents' force"],
              "the induced force on a falling dipole is recomputed in a simple numerical model of a loop and a falling magnet", "", ["claim"], est=85, judg=["justification"], cond=[("the tube is a conductor and the air resistance is negligible", "the stem states a conducting tube and an otherwise ideal fall")])


STAGE_U13_C = ["pe_sliding_rod_changing_field", "pe_coil_removed_charge", "pe_rl_inductor_power", "pe_solenoid_energy", "pe_eddy_current_claim"]
