"""AP Physics C: Electricity and Magnetism 원형 Q — 4차 저작: 자료로 주장을 뒷받침하는 3.C 문항, 두 상황 비교(2.C), 변화 예측(2.D). 표 자료는 모두 코드가 계산한다."""
from physe_common import *

MUUSE = " Use " + C_MU + "."


def _tab(title, xl, yl, rows):
    return table_stimulus(title, xl, [[f"{a:g}", f"{b:.4g}"] for a, b in rows], yl)


# ---------------- 3.C: 표 자료가 뒷받침하는 주장 ----------------
@retry_sep
def pe_data_force_distance_claim(rng):
    for _ in forever():
        c = pick(rng, [2.0, 3.0, 5.0]); rs = [10.0, 20.0, 30.0, 40.0]
        Fs = [c * 100 / r ** 2 for r in rs]
        break
    rows = list(zip(rs, Fs))
    stim = _tab("Force between two small charged spheres", "Separation r (cm)", "Force F (mN)", rows)
    key, ds = sentence_options("The data support an inverse-square dependence, because the product $Fr^2$ is the same for every row.", f"For every row $Fr^2={c * 100:g}$ in these units, which a $1/r$ or a linear dependence cannot give.",
                               [("The data support an inverse dependence, because $F$ decreases as $r$ increases and $Fr$ is the same for every row.", "Confuses any decreasing trend with $1/r$; $Fr$ changes from row to row."),
                                ("The data support a linear dependence, because the force changes by about the same amount from one row to the next.", "Reads equal spacing of the separations as equal changes of the force."),
                                ("The data cannot support any conclusion, because only four points were measured.", "Believes a few points cannot distinguish a power law from other dependences.")])
    stem = "The table gives the measured force between two small charged spheres at several separations. Which conclusion about the dependence of the force on the separation is best supported by the data?"
    return MQ("pe_data_force_distance_claim", "8.1", "3.C", stem, key, ds, rng, "A power law is supported by a quantity such as $Fr^2$ that stays constant across the data", ["Test candidate dependences against the table", "Choose the one that holds for every row"],
              "the products $Fr$ and $Fr^2$ are recomputed for each row of the table", "", [f"c={c}"], stim=stim, est=90, mat={"type": "table", "must_include": ["separation column", "force column"]}, judg=["representation_reading", "justification"], cond=[("the spheres are small and identical and the measurements are accurate", "the stem states small charged spheres")])


@retry_sep
def pe_data_rc_claim(rng):
    for _ in forever():
        V0 = pick(rng, [6.0, 9.0, 12.0]); tau = pick(rng, [10.0, 20.0, 40.0]); ts = [0.0, tau, 2 * tau, 3 * tau]
        Vs = [V0 * math.exp(-t / tau) for t in ts]
        break
    rows = list(zip(ts, Vs))
    stim = _tab("Voltage across a discharging capacitor", "Time t (ms)", "Voltage V (V)", rows)
    key, ds = sentence_options("The voltage falls by the same factor in each equal time interval, which supports an exponential decay with a constant time constant.", f"Each $\\tau$ interval multiplies the voltage by $1/e\\approx0.37$: ${V0:g}\\to{Vs[1]:.2f}\\to{Vs[2]:.2f}\\to{Vs[3]:.2f}$ volts.",
                               [("The voltage falls by the same amount in each equal time interval, which supports a linear decay.", "Describes a constant ratio as a constant difference."),
                                ("The voltage falls faster at later times, which supports a decay that speeds up.", "Reads the table as an accelerating decay although the successive drops get smaller."),
                                ("The voltage stays proportional to the time, which supports $V\\propto t$.", "Confuses a decaying quantity with a growing one.")])
    stem = "The table gives the measured voltage across a capacitor discharging through a resistor at equally spaced times. Which conclusion about the way the voltage decays is best supported by the data?"
    return MQ("pe_data_rc_claim", "11.8", "3.C", stem, key, ds, rng, "A constant ratio between values at equal time steps indicates an exponential decay", ["Compute the differences and the ratios of successive values", "Match the pattern to a decay law"],
              "the successive ratios and differences are recomputed from the table values", "", [f"V0={V0}", f"tau={tau}"], stim=stim, est=90, mat={"type": "table", "must_include": ["time column", "voltage column"]}, judg=["representation_reading", "justification"], cond=[("the capacitor discharges through a fixed resistor", "the stem states a fixed resistor")])


@retry_sep
def pe_data_iv_claim(rng):
    for _ in forever():
        c = pick(rng, [0.02, 0.04, 0.05]); Vs = [2.0, 4.0, 6.0, 8.0]
        Is = [c * v * v for v in Vs]
        break
    rows = list(zip(Vs, Is))
    stim = _tab("Current through a device at several applied voltages", "Potential difference V (V)", "Current I (A)", rows)
    key, ds = sentence_options("The device is not ohmic, because the ratio $V/I$ is not the same for every row (it decreases as the voltage increases).", f"For an ohmic device $V/I$ is constant; here $V/I$ is ${Vs[0] / Is[0]:.1f}$, ${Vs[1] / Is[1]:.1f}$, ${Vs[2] / Is[2]:.1f}$ and ${Vs[3] / Is[3]:.1f}\\,\\Omega$.",
                               [("The device is ohmic, because the current increases every time the voltage increases.", "Believes any increasing relation between $I$ and $V$ is ohmic."),
                                ("The device is ohmic with a resistance equal to the slope between the first two rows.", "Applies the local slope of the first rows as a resistance valid for all rows."),
                                ("The device is not ohmic, because the current is not proportional to the resistance.", "Misstates the condition for ohmic behavior in terms of resistance instead of voltage.")])
    stem = "The table gives the current through a device at several potential differences. Which conclusion about the device is best supported by the data?"
    return MQ("pe_data_iv_claim", "11.3", "3.C", stem, key, ds, rng, "A device is ohmic if $V/I$ is constant over the range measured", ["Compute $V/I$ for each row", "Compare with the definition of an ohmic device"],
              "the ratio $V/I$ is recomputed for each row of the table", "", [f"c={c}"], stim=stim, est=85, mat={"type": "table", "must_include": ["voltage column", "current column"]}, judg=["representation_reading", "justification"], cond=[("the measurements are accurate", "the stem states measured data")])


@retry_sep
def pe_data_gap_capacitance_claim(rng):
    for _ in forever():
        k0 = pick(rng, [4.0, 6.0, 8.0]); ds_ = [1.0, 2.0, 3.0, 4.0]; Cs = [k0 / d for d in ds_]
        break
    rows = list(zip(ds_, Cs))
    stim = _tab("Capacitance of a parallel-plate capacitor at several plate separations", "Plate separation d (mm)", "Capacitance C (nF)", rows)
    key, ds = sentence_options("The capacitance is inversely proportional to the separation, because the product $Cd$ is the same for every row.", f"$Cd={k0:g}$ in these units for each row, as $C=\\varepsilon_0A/d$ predicts.",
                               [("The capacitance decreases linearly with the separation, because each additional millimeter lowers it by the same amount.", "Reads equal steps in separation as equal drops in capacitance."),
                                ("The capacitance is independent of the separation, because the plates keep the same area.", "Believes the capacitance depends only on the plate area."),
                                ("The capacitance is inversely proportional to the square of the separation, because the field is an inverse-square field.", "Applies the inverse-square law for the field of a point charge to a parallel-plate capacitor.")])
    stem = "The table gives the measured capacitance of a parallel-plate capacitor with vacuum between the plates at several plate separations. Which conclusion about the dependence of the capacitance on the separation is best supported by the data?"
    return MQ("pe_data_gap_capacitance_claim", "10.3", "3.C", stem, key, ds, rng, "A product that is constant across the data identifies an inverse proportionality", ["Test $C\\,d$ and $C\\,d^2$ for each row", "Choose the dependence that holds"],
              "the products $Cd$ and $Cd^2$ are recomputed for each row of the table", "", [f"k0={k0}"], stim=stim, est=90, mat={"type": "table", "must_include": ["separation column", "capacitance column"]}, judg=["representation_reading", "justification"], cond=[("the plate area is kept the same", "the stem states a fixed plate area")])


@retry_sep
def pe_data_current_decay_claim(rng):
    for _ in forever():
        Rr = pick(rng, [20.0, 50.0, 100.0]); L = pick(rng, [0.2, 0.5, 1.0]); tau = L / Rr * 1e3; e = pick(rng, [6.0, 12.0])
        ts = [0.0, tau, 2 * tau, 3 * tau]; Is = [e / Rr * (1 - math.exp(-t / tau)) * 1e3 for t in ts]
        break
    rows = list(zip(ts, Is))
    stim = _tab("Current after the switch in an RL circuit is closed", "Time t (ms)", "Current I (mA)", rows)
    key, ds = sentence_options("The current is approaching a final value, because each equal time interval closes the same fraction of the remaining gap to that value.", f"The remaining gap to ${e / Rr * 1e3:.0f}\\text{{ mA}}$ shrinks by a constant factor each interval, as for $I=I_\\infty(1-e^{{-t/\\tau}})$.",
                               [("The current is increasing at a constant rate, because it rises by the same amount in each interval.", "Reads the table as linear although the increases get smaller."),
                                ("The current will keep increasing without limit, because it is larger in each successive row.", "Believes an increasing sequence has no upper limit."),
                                ("The current rises instantly to its final value, because the inductor has no effect on the circuit.", "Ignores that an inductor opposes the change in current.")])
    stem = "The table gives the current at equally spaced times after the switch in a series circuit of a battery, a resistor and an inductor is closed. Which conclusion about how the current changes is best supported by the data?"
    return MQ("pe_data_current_decay_claim", "13.5", "3.C", stem, key, ds, rng, "The current in an RL circuit approaches its final value exponentially", ["Compute the increase in each interval and the remaining gap to the final value", "Match the pattern to the circuit equation"],
              "the table values are recomputed from the circuit equation with an RK4 integration", "", [f"Rr={Rr}", f"L={L}", f"e={e}"], stim=stim, est=90, mat={"type": "table", "must_include": ["time column", "current column"]}, judg=["representation_reading", "justification"], cond=[("the battery and the inductor are ideal", "the stem states a battery and an inductor")])


@retry_sep
def pe_data_force_current_length_claim(rng):
    for _ in forever():
        B = pick(rng, [0.10, 0.20, 0.40]); Is = [1.0, 2.0, 3.0, 4.0]; L = 0.10
        Fs = [B * L * i * 1e3 for i in Is]
        break
    rows = list(zip(Is, Fs))
    stim = _tab("Magnetic force on a straight wire in a uniform field", "Current I (A)", "Force F (mN)", rows)
    key, ds = sentence_options("The force is directly proportional to the current, because the ratio $F/I$ is the same for every row.", f"$F/I={Fs[0] / Is[0]:.3g}\\text{{ mN/A}}$ for every row.",
                               [("The force is proportional to the square of the current, because the force increases faster than the current.", "Reads an increasing trend as a quadratic dependence."),
                                ("The force is inversely proportional to the current, because a larger current spreads the force over more charges.", "Invents an inverse relation with no support in the data."),
                                ("The force is independent of the current, because the field has a fixed value.", "Believes only the field, not the current, determines the force.")])
    stem = "The table gives the magnetic force on a straight wire of fixed length that is perpendicular to a uniform magnetic field, for several currents. Which conclusion about the dependence of the force on the current is best supported by the data?"
    return MQ("pe_data_force_current_length_claim", "12.1", "3.C", stem, key, ds, rng, "A constant ratio $F/I$ identifies a direct proportionality", ["Compute $F/I$ and $F/I^2$ for each row", "Choose the dependence that holds"],
              "the ratios $F/I$ and $F/I^2$ are recomputed for each row of the table", "", [f"B={B}"], stim=stim, est=85, mat={"type": "table", "must_include": ["current column", "force column"]}, judg=["representation_reading", "justification"], cond=[("the wire length and the field are fixed", "the stem states a fixed wire length and field")])


# ---------------- 2.C: 두 상황 비교 ----------------
@retry_sep
def pe_compare_sphere_fields(rng):
    for _ in forever():
        R1 = pick(rng, [1.0, 2.0]); R2 = R1 * pick(rng, [2.0, 3.0]); Q1 = pick(rng, [1.0, 2.0]); Q2 = Q1 * pick(rng, [2.0, 3.0, 4.0])
        f = (Q2 / R2 ** 2) / (Q1 / R1 ** 2)
        if abs(f - 1) > 0.15:
            break
    key, ds = num_opts(f, [("Compares the charges only.", Q2 / Q1), ("Compares the radii only, $R_1/R_2$.", R1 / R2), ("Uses $Q/R$, the potential ratio.", (Q2 / R2) / (Q1 / R1)), ("Inverts the ratio, using $R^2/Q$ for each sphere.", (R2 ** 2 / Q2) / (R1 ** 2 / Q1))], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"Two isolated conducting spheres carry charges $Q_1={Q1:g}\\,\\mu\\text{{C}}$ and $Q_2={Q2:g}\\,\\mu\\text{{C}}$ and have radii $R_1={R1:g}\\text{{ cm}}$ and $R_2={R2:g}\\text{{ cm}}$. What is the ratio $E_2/E_1$ of the electric field magnitude just outside the surface of sphere 2 to that just outside sphere 1?"
    return MQ("pe_compare_sphere_fields", "8.3", "2.C", stem, key, ds, rng, "The surface field of a charged sphere is $kQ/R^2$, so comparing two spheres needs both the charge and the radius", ["Write $E=kQ/R^2$ for each sphere", "Form the ratio of the two results"],
              "the two fields are recomputed from the closed form and divided", f"$E_2/E_1=(Q_2/Q_1)(R_1/R_2)^2={sig(f)}$.", [f"R1={R1}", f"R2={R2}", f"Q1={Q1}", f"Q2={Q2}"], est=75, judg=["proportional_reasoning"])


@retry_sep
def pe_compare_cap_energies(rng):
    for _ in forever():
        C1 = pick(rng, [2.0, 4.0]); V1 = pick(rng, [10.0, 20.0]); C2 = C1 * pick(rng, [2.0, 3.0]); V2 = V1 / pick(rng, [2.0, 3.0])
        f = (C2 * V2 ** 2) / (C1 * V1 ** 2)
        if abs(f - 1) > 0.1:
            break
    key, ds = num_opts(f, [("Compares the capacitances only.", C2 / C1), ("Compares the voltages only.", V2 / V1), ("Uses $CV$, the charge ratio.", (C2 * V2) / (C1 * V1)), ("Divides by the square of the voltage, using $C/V^2$ for each capacitor.", (C2 / V2 ** 2) / (C1 / V1 ** 2))], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"Capacitor 1 has capacitance ${C1:g}\\,\\mu\\text{{F}}$ and is charged to ${V1:g}\\text{{ V}}$. Capacitor 2 has capacitance ${C2:g}\\,\\mu\\text{{F}}$ and is charged to ${V2:.3g}\\text{{ V}}$. What is the ratio of the energy stored in capacitor 2 to that stored in capacitor 1?"
    return MQ("pe_compare_cap_energies", "10.3", "2.C", stem, key, ds, rng, "The stored energy depends on the capacitance and on the square of the voltage", ["Write $U=\\tfrac12CV^2$ for each capacitor", "Form the ratio of the two results"],
              "the two energies are recomputed and divided", f"$U_2/U_1=(C_2/C_1)(V_2/V_1)^2={sig(f)}$.", [f"C1={C1}", f"V1={V1}", f"C2={C2}", f"V2={V2}"], est=75, judg=["proportional_reasoning"])


@retry_sep
def pe_compare_wire_forces(rng):
    for _ in forever():
        I1 = pick(rng, [2.0, 4.0]); d1 = pick(rng, [2.0, 4.0]); I2 = I1 * pick(rng, [2.0, 3.0]); d2 = d1 * pick(rng, [2.0, 3.0])
        f = (I2 ** 2 / d2) / (I1 ** 2 / d1)
        if abs(f - 1) > 0.1:
            break
    key, ds = num_opts(f, [("Uses the currents only, $I_2/I_1$.", I2 / I1), ("Uses $I^2$ without the distance.", (I2 / I1) ** 2), ("Uses $I^2/d^2$.", (I2 ** 2 / d2 ** 2) / (I1 ** 2 / d1 ** 2)), ("Uses the current to the first power, $I/d$ for each pair.", (I2 / d2) / (I1 / d1))], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"Pair 1 is two long parallel wires ${d1:g}\\text{{ cm}}$ apart, each carrying ${I1:g}\\text{{ A}}$. Pair 2 is two long parallel wires ${d2:g}\\text{{ cm}}$ apart, each carrying ${I2:g}\\text{{ A}}$. What is the ratio of the magnetic force per unit length between the wires of pair 2 to that between the wires of pair 1?"
    return MQ("pe_compare_wire_forces", "12.3", "2.C", stem, key, ds, rng, "The force per length between parallel wires is $\\mu_0I_1I_2/(2\\pi d)$", ["Write the force per length for each pair", "Form the ratio of the two results"],
              "the two forces per length are recomputed and divided", f"$F_2/F_1=(I_2/I_1)^2(d_1/d_2)={sig(f)}$.", [f"I1={I1}", f"d1={d1}", f"I2={I2}", f"d2={d2}"], est=80, judg=["proportional_reasoning"])


@retry_sep
def pe_compare_induced_emfs(rng):
    for _ in forever():
        r1 = pick(rng, [2.0, 4.0]); r2 = r1 * pick(rng, [2.0, 3.0]); rate1 = pick(rng, [1.0, 2.0]); rate2 = rate1 / pick(rng, [2.0, 4.0])
        f = (r2 ** 2 * rate2) / (r1 ** 2 * rate1)
        if abs(f - 1) > 0.1:
            break
    key, ds = num_opts(f, [("Compares the radii only, $r_2/r_1$.", r2 / r1), ("Compares the rates only.", rate2 / rate1), ("Uses $r\\,dB/dt$, the circumference rather than the area.", (r2 * rate2) / (r1 * rate1)), ("Uses $r^2/(dB/dt)$.", (r2 ** 2 / rate2) / (r1 ** 2 / rate1))], "", fmt=lambda v: "$" + sig(v) + "$")
    stem = f"Loop 1 has radius ${r1:g}\\text{{ cm}}$ and loop 2 has radius ${r2:g}\\text{{ cm}}$. Each lies perpendicular to a uniform magnetic field; the field at loop 1 changes at ${rate1:g}\\text{{ T/s}}$ and the field at loop 2 changes at ${rate2:g}\\text{{ T/s}}$. What is the ratio of the emf induced in loop 2 to that induced in loop 1?"
    return MQ("pe_compare_induced_emfs", "13.2", "2.C", stem, key, ds, rng, "The emf is the area times the rate of change of the field", ["Write $\\varepsilon=\\pi r^2\\,dB/dt$ for each loop", "Form the ratio of the two results"],
              "the two emfs are recomputed and divided", f"$\\varepsilon_2/\\varepsilon_1=(r_2/r_1)^2(\\text{{rate}}_2/\\text{{rate}}_1)={sig(f)}$.", [f"r1={r1}", f"r2={r2}", f"rate1={rate1}", f"rate2={rate2}"], est=80, judg=["proportional_reasoning"])


# ---------------- 2.D: 변화 예측 ----------------
@retry_sep
def pe_scale_magnetic_force(rng):
    for _ in forever():
        fq = pick(rng, [2, 3]); fv = pick(rng, [2, 3]); fb = pick(rng, [2, 4])
        f = fq * fv * fb
        break
    key, ds = num_opts(f, [("Adds the three factors.", float(fq + fv + fb)), ("Uses only the speed and field factors.", float(fv * fb)), ("Squares the speed factor.", float(fq * fv ** 2 * fb)), ("Divides by the field factor.", fq * fv / fb)], "", fmt=lambda v: "$" + sig(v) + "F$")
    stem = f"A particle moving perpendicular to a uniform magnetic field feels a magnetic force of magnitude $F$. A second particle has ${fq}$ times the charge and ${fv}$ times the speed of the first, and moves perpendicular to a field ${fb}$ times as strong. What is the magnitude of the magnetic force on the second particle?"
    return MQ("pe_scale_magnetic_force", "12.2", "2.D", stem, key, ds, rng, "The magnetic force is proportional to the charge, the speed and the field", ["Write the force law $F=qvB$", "Multiply the three factors"],
              "the force ratio is recomputed from $qvB$ for sample values", f"$F\\propto qvB$, so the new force is ${fq}\\cdot{fv}\\cdot{fb}\\,F={sig(f)}F$.", [f"fq={fq}", f"fv={fv}", f"fb={fb}"], est=65, judg=["proportional_reasoning"])


@retry_sep
def pe_scale_inductance(rng):
    for _ in forever():
        fn = pick(rng, [2, 3]); fl = pick(rng, [2, 4]); fa = pick(rng, [2, 3])
        f = fn ** 2 * fa / fl
        break
    key, ds = num_opts(f, [("Uses $N$ instead of $N^2$.", fn * fa / fl), ("Multiplies by the length factor instead of dividing.", fn ** 2 * fa * fl), ("Ignores the area factor.", fn ** 2 / fl), ("Divides by the area instead of multiplying, $N^2/(A\\ell)$.", fn ** 2 / fa / fl)], "", fmt=lambda v: "$" + sig(v) + "L$")
    stem = f"A long solenoid has inductance $L$. A second long solenoid has ${fn}$ times as many turns, is ${fl}$ times as long and has ${fa}$ times the cross-sectional area. What is the inductance of the second solenoid?"
    return MQ("pe_scale_inductance", "13.4", "2.D", stem, key, ds, rng, "The inductance of a solenoid is $\\mu_0N^2A/\\ell$", ["Write $L=\\mu_0N^2A/\\ell$", "Apply the three factors"],
              "the inductance ratio is recomputed from the closed form for sample values", f"$L\\propto N^2A/\\ell$, so the new inductance is ${fn}^2\\cdot{fa}/{fl}\\,L={sig(f)}L$.", [f"fn={fn}", f"fl={fl}", f"fa={fa}"], est=70, judg=["proportional_reasoning"])


@retry_sep
def pe_scale_capacitance_geometry(rng):
    for _ in forever():
        fa = pick(rng, [2, 3, 4]); fd = pick(rng, [2, 3]); kap = pick(rng, [2, 4])
        f = fa * kap / fd
        if abs(f - 1) > 0.1:
            break
    key, ds = num_opts(f, [("Ignores the dielectric.", fa / fd), ("Uses the separation factor multiplicatively.", fa * kap * fd), ("Uses $\\kappa$ in the denominator.", fa / fd / kap), ("Uses the square of the separation.", fa * kap / fd ** 2)], "", fmt=lambda v: "$" + sig(v) + "C$")
    stem = f"An air-filled parallel-plate capacitor has capacitance $C$. A second capacitor has plates of ${fa}$ times the area, a plate separation ${fd}$ times as large, and is completely filled with a dielectric of constant $\\kappa={kap}$. What is the capacitance of the second capacitor?"
    return MQ("pe_scale_capacitance_geometry", "10.4", "2.D", stem, key, ds, rng, "The capacitance of a filled parallel-plate capacitor is $\\kappa\\varepsilon_0A/d$", ["Write $C=\\kappa\\varepsilon_0A/d$", "Apply the three factors"],
              "the capacitance ratio is recomputed from the closed form", f"$C\\propto\\kappa A/d$, so the new capacitance is ${kap}\\cdot{fa}/{fd}\\,C={sig(f)}C$.", [f"fa={fa}", f"fd={fd}", f"kap={kap}"], est=70, judg=["proportional_reasoning"])


@retry_sep
def pe_scale_generator_emf(rng):
    for _ in forever():
        fw = pick(rng, [2, 3]); fn = pick(rng, [2, 3]); fb = pick(rng, [2, 3, 4])
        f = fw * fn * fb
        break
    key, ds = num_opts(f, [("Adds the three factors.", float(fw + fn + fb)), ("Squares the frequency factor.", float(fw ** 2 * fn * fb)), ("Ignores the number of turns.", float(fw * fb)), ("Divides by the field factor.", fw * fn / fb)], "", fmt=lambda v: "$" + sig(v) + "\\varepsilon_{max}$")
    stem = f"A coil rotating in a uniform magnetic field has a maximum induced emf $\\varepsilon_{{max}}$. The rotation rate is multiplied by ${fw}$, the number of turns is multiplied by ${fn}$ and the field is multiplied by ${fb}$, with the area unchanged. What is the new maximum emf?"
    return MQ("pe_scale_generator_emf", "13.2", "2.D", stem, key, ds, rng, "The peak emf of a rotating coil is $NBA\\omega$", ["Write $\\varepsilon_{max}=NBA\\omega$", "Multiply the three factors"],
              "the peak emf ratio is recomputed from $NBA\\omega$", f"$\\varepsilon_{{max}}\\propto N B\\omega$, so the new value is ${fw}\\cdot{fn}\\cdot{fb}\\,\\varepsilon_{{max}}={sig(f)}\\varepsilon_{{max}}$.", [f"fw={fw}", f"fn={fn}", f"fb={fb}"], est=65, judg=["proportional_reasoning"])


@retry_sep
def pe_scale_electric_energy(rng):
    for _ in forever():
        fq = pick(rng, [2, 3]); fr = pick(rng, [2, 3, 4])
        f = fq ** 2 / fr
        if abs(f - 1) > 0.1:
            break
    key, ds = num_opts(f, [("Uses $q$ instead of $q^2$.", fq / fr), ("Uses the inverse square of the distance.", fq ** 2 / fr ** 2), ("Multiplies by the distance factor.", fq ** 2 * fr), ("Uses $q^2/r^2$ with the charge factor on one charge only.", fq / fr ** 2)], "", fmt=lambda v: "$" + sig(v) + "U$")
    stem = f"Two point charges of equal magnitude $q$ and the same sign are a distance $r$ apart, and their electric potential energy is $U$. Each charge is multiplied by ${fq}$ and the distance is multiplied by ${fr}$. What is the new electric potential energy of the pair?"
    return MQ("pe_scale_electric_energy", "9.1", "2.D", stem, key, ds, rng, "The potential energy of a pair is $kq_1q_2/r$", ["Write $U=kq_1q_2/r$", "Apply the factors"],
              "the energy ratio is recomputed from $kq_1q_2/r$", f"$U\\propto q_1q_2/r$, so the new energy is ${fq}^2/{fr}\\,U={sig(f)}U$.", [f"fq={fq}", f"fr={fr}"], est=65, judg=["proportional_reasoning"])


STAGE_U8_D = ["pe_data_force_distance_claim", "pe_compare_sphere_fields"]
STAGE_U9_D = ["pe_scale_electric_energy"]
STAGE_U10_D = ["pe_data_gap_capacitance_claim", "pe_compare_cap_energies", "pe_scale_capacitance_geometry"]
STAGE_U11_D = ["pe_data_rc_claim", "pe_data_iv_claim"]
STAGE_U12_D = ["pe_data_force_current_length_claim", "pe_compare_wire_forces", "pe_scale_magnetic_force"]
STAGE_U13_D = ["pe_data_current_decay_claim", "pe_compare_induced_emfs", "pe_scale_inductance", "pe_scale_generator_emf"]
