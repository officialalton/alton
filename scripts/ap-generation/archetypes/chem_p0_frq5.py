"""AP Chemistry — FRQ 새 시나리오 7종(2026-10-21, CH5 용): 이전 FRQ 와 CH4 새 시나리오 어느 쪽과도 자료·조건·풀이 틀이 다르다.
긴 — 중량 분석(염화물 침전) / 전지 전위·네른스트 / 메커니즘·반감기·촉매; 짧은 — 이온의 전자 배치·홀전자 / 실험식·분자식 / 고체 유형과 성질 / 약산 Ka 와 이온화율.
정답·표·기대값은 코드가 두 경로(정확 분수 vs 수치)로 계산한다."""
from chem_common import *  # noqa: F401,F403
from calc_ab_frq import part
from chem_p0_g import R, _pack, _ev


def _stim(text):
    return {"kind": "text", "description": text, "data": {}}


# ======================= 긴 문항: 중량 분석(염화물) (10) =======================
def chf_long_gravimetric(rng):
    for _ in forever():
        m, mAg = pick(rng, [0.500, 0.600, 0.750, 0.800]), pick(rng, [0.610, 0.790, 0.920, 1.100, 1.250])
        nAg = mAg / 143.32; mCl = nAg * 35.45; pct = 100 * mCl / m
        if 10 < pct < 60:
            break
    agree(pct, 100 * float(Fr(str(mAg)) / Fr("143.32") * Fr("35.45") / Fr(str(m))), 1e-9, "pct")
    nsalt_per = pick(rng, [1, 2])
    stim = _stim(f"A student dissolves a ${m:.3f}\\text{{ g}}$ sample of an unknown chloride salt in water and adds excess AgNO₃(aq). The AgCl precipitate is filtered, washed, dried, and found to have a mass of ${mAg:.3f}\\text{{ g}}$. The molar mass of AgCl is 143.32 g/mol, and the molar mass of Cl is 35.45 g/mol.")
    parts = [
        part("A", "Write the net ionic equation for the precipitation reaction.", 1, "write", ["2.B"], "Ag⁺(aq) + Cl⁻(aq) → AgCl(s).",
             [R("A1", "expression", "Writes Ag⁺(aq) + Cl⁻(aq) → AgCl(s) with phases", ["Ag+ + Cl- -> AgCl(s)"], err=["includes spectator ions in the equation"])]),
        part("B", "Calculate the number of moles of AgCl formed and the mass of chloride in the sample.", 3, "calculate", ["5.F"], f"n(AgCl) = {mAg:.3f}/143.32 = {nAg:.5f} mol, which equals n(Cl⁻); mass of Cl = {nAg:.5f} × 35.45 = {mCl:.4f} g.",
             [R("B1", "numeric", f"Divides the mass of AgCl by its molar mass (about {nAg:.5f} mol)", [f"{nAg:.5f}"], nums=True, units=True, err=["multiplies by the molar mass"]),
              R("B2", "claim", "States that the moles of Cl⁻ equal the moles of AgCl (1:1)", ["1:1", "moles of Cl- equal moles of AgCl"], requires="B1", err=["uses the mole ratio of the salt instead of the chloride"]),
              R("B3", "numeric", f"Calculates the mass of chloride (about {mCl:.4f} g)", [f"{mCl:.4f}"], requires="B2", nums=True, units=True, err=["uses the molar mass of AgCl"])]),
        part("C", "Calculate the mass percent of chloride in the unknown salt.", 2, "calculate", ["5.F"], f"{mCl:.4f}/{m:.3f} × 100 = {pct:.1f}%.",
             [R("C1", "numeric", "Divides the mass of chloride by the mass of the sample", [f"{mCl / m:.3f}"], nums=True, err=["divides by the mass of the precipitate"]),
              R("C2", "numeric", f"Expresses the result as about {pct:.1f}%", [f"{pct:.1f}"], requires="C1", nums=True, err=["leaves the result as a fraction"])]),
        part("D", "A student forgets to dry the precipitate completely before finding its mass. Predict the effect on the calculated mass percent of chloride, and justify your answer.", 2, "predict", ["3.C", "6.E"], "Too high: wet precipitate has extra mass from water, so the mass of AgCl is too large and the moles of Cl⁻ are overestimated.",
             [R("D1", "claim", "States that the mass percent will be too high", ["too high"], err=["says the result will be too low"]),
              R("D2", "justification", "Explains that the extra water adds mass to the precipitate, overstating the moles of AgCl and Cl⁻", ["extra mass from water", "overestimates moles"], requires="D1", err=["says the water reacts with the chloride"])]),
        part("E", "The student repeats the experiment but uses too little AgNO₃(aq), so some chloride remains in solution. Explain why the calculated mass percent would be incorrect.", 2, "explain", ["4.B", "6.E"], "Too low: AgNO₃ would be the limiting reactant, so less AgCl forms than the chloride in the sample could produce.",
             [R("E1", "claim", "States that the calculated mass percent would be too low", ["too low"], err=["says the result would be unaffected"]),
              R("E2", "justification", "States that not all of the chloride precipitates, so the mass of AgCl underestimates the chloride in the sample", ["not all chloride precipitates"], requires="E1", err=["says the excess AgNO₃ lowers the mass of AgCl"])]),
    ]
    return _pack("chf_long_gravimetric", "long", "4.5", ["3.7", "1.4"], "5.F", "Gravimetric analysis of chloride", stim, parts, 10, 23, [f"m={m}", f"mAg={mAg}", f"pct={pct:.4f}"],
                 [_ev("C", "mass percent chloride", pct, 0.2, "%")],
                 ("Net ionic equation, mass of precipitate to moles of the ion to mass percent, and two sources of experimental error", ["Write the net ionic equation", "Convert the mass of precipitate to the mass of chloride and a mass percent", "Predict the effect of incomplete drying and of insufficient reagent"],
                  [("the precipitation of chloride is complete when the reagent is in excess", "the stimulus states the excess AgNO₃")], {"type": "text", "must_include": ["mass of the sample", "mass of the precipitate"]}, "exact fractions for the moles and mass percent"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 갈바니 전지와 네른스트 (10) =======================
def chf_long_nernst_cell(rng):
    for _ in forever():
        met, E_red = pick(rng, [("Zn", -0.76), ("Fe", -0.44), ("Ni", -0.25), ("Pb", -0.13)])
        Q = pick(rng, [0.10, 0.50, 5.0, 10.0]); n = 2
        E0 = 0.34 - E_red; dG = -n * 96485 * E0 / 1000; K = 10 ** (n * E0 / 0.0592); E = E0 - (0.0592 / n) * math.log10(Q)
        if K < 1e45:
            break
    agree(dG, -n * 96485 * (0.34 + abs(E_red) * (1 if E_red < 0 else -1)) / 1000 if E_red < 0 else -n * 96485 * (0.34 - E_red) / 1000, 1e-9, "dG")
    agree(E, E0 - 0.0592 / 2 * math.log10(Q), 1e-12, "E")
    stim = _stim(f"A galvanic cell is built from a Cu electrode in Cu²⁺(aq) and a {met} electrode in {met}²⁺(aq), connected by a salt bridge. The standard reduction potentials are Cu²⁺ + 2 e⁻ → Cu, E° = +0.34 V, and {met}²⁺ + 2 e⁻ → {met}, E° = {E_red:+.2f} V. Use F = 96,485 C/mol e⁻ and E = E° − (0.0592/n) log Q at 25 °C.")
    parts = [
        part("A", "Calculate the standard cell potential, E°cell, and identify the anode.", 2, "calculate", ["5.F", "5.B"], f"E°cell = 0.34 − ({E_red:+.2f}) = {E0:.2f} V; {met} is oxidized, so {met} is the anode.",
             [R("A1", "numeric", f"Calculates E°cell by subtracting the reduction potentials (about {E0:.2f} V)", [f"{E0:.2f}"], nums=True, units=True, err=["adds the reduction potentials"]),
              R("A2", "claim", f"Identifies the {met} electrode as the anode", [met], requires="A1", err=["identifies Cu as the anode"])]),
        part("B", "Calculate the standard free energy change, ΔG°, in kJ per mole of reaction.", 2, "calculate", ["5.F"], f"ΔG° = −nFE° = −(2)(96,485)({E0:.2f})/1000 = {dG:.0f} kJ/mol.",
             [R("B1", "numeric", "Uses n = 2 moles of electrons", ["2"], nums=True, err=["uses n = 1"]),
              R("B2", "numeric", f"Calculates ΔG° of about {dG:.0f} kJ/mol with the correct sign", [f"{dG:.0f}"], requires="B1", nums=True, units=True, err=["omits the negative sign or leaves the units in J"])]),
        part("C", "Calculate the cell potential when the reaction quotient is Q = " + f"{Q:g}" + ".", 2, "calculate", ["5.F"], f"E = {E0:.2f} − (0.0592/2) log({Q:g}) = {E:.3f} V.",
             [R("C1", "expression", "Substitutes E° and Q into E = E° − (0.0592/n) log Q", ["E = E0 - (0.0592/n) log Q"], err=["uses the natural logarithm"]),
              R("C2", "numeric", f"Calculates E of about {E:.3f} V", [f"{E:.3f}"], requires="C1", nums=True, units=True, err=["adds the correction term"])]),
        part("D", "Describe the direction in which electrons and anions in the salt bridge move in this cell.", 2, "describe", ["3.C", "6.E"], f"Electrons move through the wire from the {met} anode to the Cu cathode; anions move through the salt bridge toward the anode compartment to balance the charge as {met}²⁺ forms.",
             [R("D1", "claim", f"States that electrons flow from the {met} electrode to the Cu electrode", ["from anode to cathode"], err=["says electrons move through the salt bridge"]),
              R("D2", "justification", "States that anions in the salt bridge move toward the anode to balance the positive charge", ["anions toward anode"], requires="D1", err=["says anions move toward the cathode"])]),
        part("E", "The concentration of Cu²⁺ in the cathode compartment is decreased. Predict the effect on the cell potential and justify your answer.", 2, "predict", ["2.B", "6.E"], "The cell potential decreases: a smaller [Cu²⁺] increases Q, and E = E° − (0.0592/n) log Q becomes smaller.",
             [R("E1", "claim", "States that the cell potential decreases", ["decreases"], err=["says the cell potential increases"]),
              R("E2", "justification", "Links the lower [Cu²⁺] to a larger Q and a smaller E in the Nernst equation", ["larger Q", "Nernst equation"], requires="E1", err=["says E° changes with concentration"])]),
    ]
    return _pack("chf_long_nernst_cell", "long", "9.10", ["9.9", "9.8"], "5.F", "Galvanic cell, free energy and the Nernst equation", stim, parts, 10, 23, [f"met={met}", f"E_red={E_red}", f"Q={Q}", f"E0={E0:.3f}", f"E={E:.4f}"],
                 [_ev("A", "standard cell potential", E0, 0.01, "V"), _ev("B", "delta G", dG, abs(dG) * 0.02, "kJ"), _ev("C", "cell potential at Q", E, 0.005, "V")],
                 ("Standard cell potential from reduction potentials, ΔG° from E°, a Nernst-equation potential, charge movement in the cell, and the effect of a concentration change", ["Subtract the reduction potentials and name the anode", "Use ΔG° = −nFE° and the Nernst equation", "Describe the movement of electrons and ions and predict the effect of a change"],
                  [("the temperature is 25 °C", "the stimulus states it")], {"type": "text", "must_include": ["standard reduction potentials", "Nernst equation"]}, "E° from tabulated potentials; ΔG and E recomputed from exact fractions and base-10 logs"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 메커니즘·반감기·촉매 (10) =======================
def chf_long_mechanism_halflife(rng):
    for _ in forever():
        k = pick(rng, [0.0231, 0.0462, 0.0693, 0.0139, 0.0347]); c0 = pick(rng, [0.800, 1.20, 2.00]); frac = pick(rng, [0.25, 0.125, 0.0625])
        t_half = math.log(2) / k; t = math.log(1 / frac) / k; ctime = c0 * math.exp(-k * 60)
        if 10 < t_half < 80:
            break
    agree(t_half, float(sp.log(2) / sp.nsimplify(k)), 1e-9, "th"); agree(t, -math.log(frac) / k, 1e-9, "t")
    stim = _stim(f"The decomposition of a reactant X(g) → products occurs in two steps. Step 1 (slow): X → Y + Z. Step 2 (fast): Y → W. The reaction is first order in X with a rate constant k = {k:g} min⁻¹ at a fixed temperature. The initial concentration of X is ${c0:g}\\text{{ M}}$.")
    parts = [
        part("A", "Write the rate law for the overall reaction and identify the rate-determining step.", 2, "write", ["5.B", "4.B"], "rate = k[X]; the slow first step X → Y + Z is the rate-determining step, and its rate depends only on [X].",
             [R("A1", "expression", "Writes rate = k[X]", ["rate = k[X]"], err=["includes [Y] in the rate law"]),
              R("A2", "claim", "Identifies the slow step (step 1) as rate-determining", ["step 1", "slow step"], requires="A1", err=["says the fast step determines the rate"])]),
        part("B", "Identify an intermediate in the mechanism and explain how you know.", 1, "identify", ["3.C"], "Y is an intermediate: it is produced in step 1 and consumed in step 2, so it does not appear in the overall reaction.",
             [R("B1", "justification", "Identifies Y as the intermediate because it is produced in one step and consumed in a later step", ["produced in step 1", "consumed in step 2"], err=["identifies the final product W as the intermediate"])]),
        part("C", "Calculate the half-life of X and the time needed for the concentration of X to fall to " + f"{frac:g}" + " of its initial value.", 3, "calculate", ["5.F"], f"t½ = ln 2 / k = {t_half:.1f} min; t = ln({1 / frac:g})/k = {t:.1f} min.",
             [R("C1", "expression", "Uses t½ = ln 2/k for a first-order reaction", ["t1/2 = ln2/k"], err=["uses t½ = 1/(k[X]₀)"]),
              R("C2", "numeric", f"Calculates the half-life (about {t_half:.1f} min)", [f"{t_half:.1f}"], requires="C1", nums=True, units=True, err=["omits the units or uses log10"]),
              R("C3", "numeric", f"Calculates the time to reach {frac:g} of the initial concentration (about {t:.1f} min)", [f"{t:.1f}"], requires="C2", nums=True, units=True, err=["assumes a constant amount of reactant is consumed per half-life"])]),
        part("D", f"Calculate the concentration of X after 60 minutes.", 2, "calculate", ["5.F"], f"[X] = [X]₀e^(−kt) = ({c0:g})e^(−({k:g})(60)) = {ctime:.3f} M.",
             [R("D1", "expression", "Uses ln[X] = ln[X]₀ − kt or [X] = [X]₀ e^(−kt)", ["ln[X] = ln[X]0 - kt"], err=["uses the zero-order equation [X] = [X]₀ − kt"]),
              R("D2", "numeric", f"Calculates [X] of about {ctime:.3f} M", [f"{ctime:.3f}"], requires="D1", nums=True, units=True, err=["omits the exponent's negative sign"])]),
        part("E", "A catalyst is added that provides a new pathway for the slow step. Explain the effect of the catalyst on the activation energy, the enthalpy change of the reaction, and the rate constant.", 2, "explain", ["6.E"], "The catalyst lowers the activation energy of the slow step, so k increases; the enthalpy change is unchanged because the reactants and products are the same.",
             [R("E1", "claim", "States that the activation energy decreases, the rate constant increases, and ΔH does not change", ["lower Ea", "ΔH unchanged"], err=["says the catalyst changes ΔH"]),
              R("E2", "justification", "Justifies that a lower barrier lets a larger fraction of collisions react and that ΔH depends only on the reactants and products", ["larger fraction of collisions", "reactants and products"], requires="E1", err=["says the catalyst is consumed in the overall reaction"])]),
    ]
    return _pack("chf_long_mechanism_halflife", "long", "5.7", ["5.5", "5.8"], "5.F", "Two-step mechanism, half-life and a catalyst", stim, parts, 10, 23, [f"k={k}", f"c0={c0}", f"frac={frac}", f"t_half={t_half:.4f}", f"t={t:.4f}", f"ctime={ctime:.5f}"],
                 [_ev("C", "half-life", t_half, 0.2, "min"), _ev("C", "time to fraction", t, 0.3, "min"), _ev("D", "concentration after 60 min", ctime, 0.003, "M")],
                 ("The rate law from a slow step, an intermediate, first-order half-life and concentration calculations, and the effect of a catalyst", ["Write the rate law from the slow step", "Identify the intermediate from the sequence of steps", "Apply the first-order relations and explain the effect of a catalyst"],
                  [("the temperature is fixed", "the stimulus states it")], {"type": "text", "must_include": ["two-step mechanism", "rate constant"]}, "ln relations recomputed from exact values; the half-life from t½ = ln 2/k"), ["law_selection", "justification", "representation_reading"])


# ======================= 짧은 문항: 이온의 전자 배치 (4) =======================
def chf_short_configuration_ions(rng):
    el, cfg, ion, ion_cfg, unp, ch = pick(rng, [("iron", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶", "Fe³⁺", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵", 5, 3), ("cobalt", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁷", "Co²⁺", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁷", 3, 2), ("nickel", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁸", "Ni²⁺", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁸", 2, 2), ("zinc", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰", "Zn²⁺", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰", 0, 2)])
    stim = _stim(f"A student studies the element {el} and its ion {ion}.")
    parts = [
        part("A", f"Write the ground-state electron configuration of a neutral {el} atom.", 1, "write", ["2.B"], f"{cfg}.",
             [R("A1", "expression", f"Writes {cfg}", [cfg], err=["fills 3d before 4s"])]),
        part("B", f"Write the electron configuration of {ion} and state the number of unpaired electrons in {ion}.", 2, "determine", ["1.A", "2.B"], f"{ion}: {ion_cfg}; there {'are' if unp != 1 else 'is'} {unp} unpaired electron{'s' if unp != 1 else ''} (electrons are removed from 4s before 3d).",
             [R("B1", "expression", f"Writes {ion_cfg} with the 4s electrons removed first", [ion_cfg], err=["removes electrons from the 3d subshell first"]),
              R("B2", "numeric", f"States {unp} unpaired electrons", [f"{unp}"], requires="B1", nums=True, err=["pairs electrons in the 3d orbitals before placing one in each"])]),
        part("C", f"Explain why the radius of {ion} is smaller than the radius of a neutral {el} atom.", 1, "explain", ["2.B", "6.E"], "Removing the outer 4s electrons leaves fewer electron shells and a greater effective nuclear charge per remaining electron, which pulls the remaining electrons closer to the nucleus.",
             [R("C1", "justification", "Relates the loss of the outermost shell and the greater effective nuclear charge per remaining electron to the smaller radius", ["fewer shells", "effective nuclear charge"], err=["says the nucleus gains protons when the ion forms"])]),
    ]
    return _pack("chf_short_configuration_ions", "short", "1.5", ["1.6", "1.7"], "1.A", "Electron configurations of a transition metal and its ion", stim, parts, 4, 9, [f"el={el}", f"ion={ion}", f"unp={unp}"], [],
                 ("Ground-state configuration, configuration and unpaired electrons of a cation, and the size of an ion", ["Fill subshells in order of energy", "Remove electrons from the highest shell first and count the unpaired electrons", "Explain the change in size"], [("the atom and ion are in the gas phase", "the stimulus names the species")], {"type": "text", "must_include": ["element", "ion"]},
                  "the configuration by the aufbau order and by the electron count; unpaired electrons by Hund's rule"), ["representation_reading", "justification"])


# ======================= 짧은 문항: 실험식과 분자식 (4) =======================
def chf_short_empirical_formula(rng):
    C_, H_, O_, M = pick(rng, [(2, 4, 2, 120.1), (1, 2, 1, 90.1), (3, 6, 3, 90.1), (2, 4, 1, 88.1)])
    mm = 12.011 * C_ + 1.008 * H_ + 15.999 * O_; mol = M
    pC, pH, pO = 12.011 * C_ / mm * 100, 1.008 * H_ / mm * 100, 15.999 * O_ / mm * 100
    from math import gcd
    g = gcd(gcd(C_, H_), O_); eC, eH, eO = C_ // g, H_ // g, O_ // g
    emass = 12.011 * eC + 1.008 * eH + 15.999 * eO; mult = round(mol / emass)
    agree(float(mult), mol / emass, 0.15, "mult")
    stim = _stim(f"A sample of an organic compound contains {pC:.1f}% carbon, {pH:.1f}% hydrogen, and {pO:.1f}% oxygen by mass. The molar mass of the compound is {mol:.1f} g/mol.")
    parts = [
        part("A", "Determine the empirical formula of the compound. Show your work.", 2, "determine", ["5.F"], f"In 100 g: {pC:.1f} g C = {pC / 12.011:.2f} mol, {pH:.1f} g H = {pH / 1.008:.2f} mol, {pO:.1f} g O = {pO / 15.999:.2f} mol; dividing by the smallest gives C{eC if eC > 1 else ''}H{eH if eH > 1 else ''}O{eO if eO > 1 else ''}.",
             [R("A1", "numeric", "Converts each percent to moles in a 100 g sample", [f"{pC / 12.011:.2f}", f"{pH / 1.008:.2f}", f"{pO / 15.999:.2f}"], nums=True, units=True, err=["uses the percentages as moles"]),
              R("A2", "expression", f"Divides by the smallest number of moles to get the ratio and writes C{eC if eC > 1 else ''}H{eH if eH > 1 else ''}O{eO if eO > 1 else ''}", [f"C{eC}H{eH}O{eO}"], requires="A1", err=["rounds the ratio before dividing"])]),
        part("B", "Determine the molecular formula from the molar mass.", 1, "determine", ["5.F"], f"The empirical formula mass is {emass:.1f} g/mol and {mol:.1f}/{emass:.1f} = {mol / emass:.1f}, so the molecular formula is C{eC * mult if eC * mult > 1 else ''}H{eH * mult if eH * mult > 1 else ''}O{eO * mult if eO * mult > 1 else ''}.",
             [R("B1", "expression", f"Multiplies the empirical formula by {mult} and writes C{eC * mult}H{eH * mult}O{eO * mult}", [f"C{eC * mult}H{eH * mult}O{eO * mult}"], err=["gives the empirical formula as the molecular formula"])]),
        part("C", "A student claims that two compounds with the same empirical formula must have the same percent composition by mass. Is the claim correct? Justify your answer.", 1, "justify", ["2.B", "6.E"], "Correct: the same atom ratio gives the same mass ratio of the elements, so the percent composition is the same even if the molar masses differ.",
             [R("C1", "justification", "States that the claim is correct because the same ratio of atoms gives the same mass ratio of elements", ["same ratio", "same mass percent"], err=["says the molar mass must also be the same"])]),
    ]
    return _pack("chf_short_empirical_formula", "short", "1.3", ["1.1", "3.4"], "5.F", "Empirical and molecular formulas from percent composition", stim, parts, 4, 9, [f"C={C_}", f"H={H_}", f"O={O_}", f"mult={mult}"], [],
                 ("Empirical formula from percent composition, molecular formula from molar mass, and percent composition shared by compounds with one empirical formula", ["Convert percent by mass to moles in a 100 g sample", "Find the whole-number ratio", "Use the molar mass to scale to the molecular formula"], [("the percentages add to 100 percent", "the stimulus states them")], {"type": "text", "must_include": ["percent by mass", "molar mass"]},
                  "the formula recovered from exact atomic masses and from the integer ratio"), ["law_selection", "justification"])


# ======================= 짧은 문항: 고체의 유형과 성질 (4) =======================
def chf_short_solid_types(rng):
    sa, sb, ta, tb = pick(rng, [("Cu", "NaCl", "metallic", "ionic"), ("Fe", "SiC", "metallic", "covalent network"), ("Ag", "MgO", "metallic", "ionic"), ("Cu", "SiO₂", "metallic", "covalent network")])
    art = lambda w: "an" if w[0] in "aeiou" else "a"
    species = {"metallic": "metal cations surrounded by a sea of delocalized electrons, held together by metallic bonding", "ionic": "positive and negative ions held in a lattice by electrostatic attractions", "covalent network": "atoms linked by covalent bonds throughout the whole solid"}
    stim = _stim(f"A student compares two solids at 25 °C, {sa} and {sb}. {sa} is {art(ta)} {ta} solid, and {sb} is {art(tb)} {tb} solid.")
    parts = [
        part("A", f"Describe the species that make up solid {sb} and the type of attraction that holds them in place.", 1, "describe", ["2.B"], f"Solid {sb} contains {species[tb]}.",
             [R("A1", "claim", f"Describes {species[tb]}", [tb], err=["describes discrete molecules held by weak dispersion forces"])]),
        part("B", f"Compare the electrical conductivity of solid {sa} and solid {sb} at 25 °C, and explain the difference in terms of the charged species that can or cannot move.", 2, "explain", ["2.B", "6.E"],
             f"Solid {sa} conducts electricity and solid {sb} does not: the delocalized electrons of the metal are free to move, but in solid {sb} the " + ("ions are fixed in the lattice" if tb == "ionic" else "electrons are localized in covalent bonds") + " and cannot move through the solid.",
             [R("B1", "claim", f"States that solid {sa} conducts electricity and solid {sb} does not", ["conducts", "does not conduct"], err=["says both solids conduct because they contain charged species"]),
              R("B2", "justification", f"Explains with mobile delocalized electrons in {sa} and " + ("fixed ions" if tb == "ionic" else "localized shared electrons") + f" in {sb}", ["delocalized electrons", "fixed ions" if tb == "ionic" else "localized electrons"], requires="B1", err=["explains with the molar mass of the solids"])]),
        part("C", f"Predict which of the two solids has the higher melting point, and justify your prediction in terms of the bonding.", 1, "predict", ["2.B", "6.E"], (f"{sb} has the higher melting point: strong electrostatic attractions between ions must be overcome." if tb == "ionic" else f"{sb} has the higher melting point: strong covalent bonds throughout the network must be broken.") + " (Metals such as Cu, Fe and Ag melt at lower temperatures than these solids.)",
             [R("C1", "justification", f"Predicts that {sb} has the higher melting point and links it to the strength of the bonding throughout the solid", ["higher melting point", "strong bonding"], err=["says melting a network solid only separates molecules"])]),
    ]
    return _pack("chf_short_solid_types", "short", "2.4", ["2.1", "2.2"], "2.B", "Types of solids and their properties", stim, parts, 4, 9, [f"sa={sa}", f"sb={sb}"], [],
                 ("Species and bonding in metallic, ionic and network solids, their electrical conductivity in the solid state, and the relative melting point", ["Describe the species and the bonding", "Compare conductivity by whether charged species can move", "Predict the melting point from the bond strength"], [("the solids are pure and in the solid state", "the stimulus names them")], {"type": "text", "must_include": ["two solids"]},
                  "the properties from a tabulated classification of the solids"), ["representation_reading", "justification"])


# ======================= 짧은 문항: 약산 Ka와 이온화율 (4) =======================
def chf_short_weak_acid_ka(rng):
    for _ in forever():
        name, Ka = pick(rng, [("acetic acid", 1.8e-5), ("hypochlorous acid", 3.0e-8), ("nitrous acid", 4.5e-4), ("formic acid", 1.8e-4)])
        c = pick(rng, [0.100, 0.200, 0.0500, 0.500])
        x = bisect(lambda z: z * z / (c - z) - Ka, 1e-14, c - 1e-14)
        if x / c < 0.2:
            break
    pH = -math.log10(x); pct = 100 * x / c; xa = math.sqrt(Ka * c)
    agree(x, (-Ka + math.sqrt(Ka * Ka + 4 * Ka * c)) / 2, 1e-9, "x")
    stim = _stim(f"A student prepares a ${c:g}\\text{{ M}}$ solution of {name}, HA, at 25 °C. The K_a of {name} is ${sn(Ka, 2)}$.")
    parts = [
        part("A", "Write the equilibrium expression for the ionization of the acid and calculate [H⁺] at equilibrium (the approximation x << c may be used).", 2, "calculate", ["5.F", "6.D"], f"Ka = [H⁺][A⁻]/[HA]; with x << {c:g}, x² = Ka c, so [H⁺] = √(({sn(Ka, 2)})({c:g})) = {sn(xa, 2)} M.",
             [R("A1", "expression", "Writes Ka = [H⁺][A⁻]/[HA]", ["Ka = [H+][A-]/[HA]"], err=["places [HA] in the numerator"]),
              R("A2", "numeric", f"Calculates [H⁺] of about {sn(xa, 2)} M", [f"{xa:.2e}"], requires="A1", nums=True, units=True, err=["forgets the square root"])]),
        part("B", "Calculate the pH of the solution.", 1, "calculate", ["5.F"], f"pH = −log({sn(xa, 2)}) = {-math.log10(xa):.2f}.",
             [R("B1", "numeric", f"Calculates the pH of about {-math.log10(xa):.2f}", [f"{-math.log10(xa):.2f}"], nums=True, err=["uses the concentration of the acid as [H⁺]"])]),
        part("C", "Calculate the percent ionization of the acid.", 1, "calculate", ["5.F"], f"Percent ionization = ({sn(xa, 2)}/{c:g}) × 100 = {100 * xa / c:.3g}%.",
             [R("C1", "numeric", f"Calculates the percent ionization by dividing [H⁺] by the initial concentration (about {100 * xa / c:.3g}%)", [f"{100 * xa / c:.3g}"], nums=True, err=["divides by the Ka"])]),
    ]
    return _pack("chf_short_weak_acid_ka", "short", "8.3", ["8.4", "7.4"], "5.F", "Ka, pH and percent ionization of a weak acid", stim, parts, 4, 9, [f"name={name}", f"Ka={Ka}", f"c={c}", f"xa={xa:.4e}"], [],
                 ("Equilibrium expression for a weak acid, the approximate [H+], pH, and percent ionization", ["Write Ka for the acid", "Solve for [H+] with the small-x approximation", "Convert to pH and percent ionization"], [("x is small compared with the initial concentration", "the stimulus allows the approximation")], {"type": "text", "must_include": ["Ka", "initial concentration"]},
                  "the quadratic solution is compared with the approximation"), ["law_selection", "representation_reading"])


# ======================= 짧은 문항: 공명 구조와 결합 차수 (4) =======================
def chf_short_resonance_bond_order(rng):
    sp_, ve, n_res, bo, desc, atoms = pick(rng, [("NO₃⁻", 24, 3, 4 / 3, "one N=O double bond and two N–O single bonds, with the double bond in a different position in each of the three forms", "N and three O"), ("CO₃²⁻", 24, 3, 4 / 3, "one C=O double bond and two C–O single bonds, with the double bond in a different position in each of the three forms", "C and three O"), ("NO₂⁻", 18, 2, 1.5, "one N=O double bond and one N–O single bond, with the double bond in a different position in each of the two forms", "N and two O"), ("O₃", 18, 2, 1.5, "one O=O double bond and one O–O single bond, with the double bond in a different position in each of the two forms", "three O")])
    agree(bo, (2 + (n_res - 1)) / n_res, 1e-12, "bo")
    stim = _stim(f"A student studies the species {sp_}, which has {ve} valence electrons and is made of {atoms} atoms. The central atom is bonded to every other atom.")
    parts = [
        part("A", f"Draw all of the Lewis structures of {sp_} that obey the octet rule and show all valence electrons. Show that more than one acceptable structure exists.", 2, "draw", ["4.A", "3.C"], f"Each of the {n_res} resonance forms has {desc}; all {ve} valence electrons are shown with lone pairs on the outer atoms.",
             [R("A1", "diagram", f"Draws a correct Lewis structure that accounts for all {ve} valence electrons with {desc.split(',')[0]}", [f"{ve} valence electrons", "lone pairs"], err=["omits lone pairs on the terminal atoms"]),
              R("A2", "diagram", f"Shows the other resonance form(s), with the double bond in a different position ({n_res} forms in total)", ["resonance forms", "double bond position"], requires="A1", err=["draws the same structure twice"])]),
        part("B", "Calculate the average bond order of the bonds from the central atom to the outer atoms.", 1, "calculate", ["5.F"], f"Total bonds divided by the number of equivalent positions: (2 + {n_res - 1})/{n_res} = {bo:.2f}.",
             [R("B1", "numeric", f"Calculates the average bond order of about {bo:.2f}", [f"{bo:.2f}"], nums=True, err=["gives the bond order as 2 or 1 for every bond"])]),
        part("C", "Predict how the length of the bonds from the central atom to the outer atoms compares with the length of a typical single bond and a typical double bond between the same two elements. Justify your answer.", 1, "predict", ["4.A", "6.E"], "The bond lengths are all equal and between those of a single bond and a double bond, because the electrons are delocalized over all the equivalent positions and the average bond order is between 1 and 2.",
             [R("C1", "justification", "States that the bonds are equal in length and between the single-bond and double-bond lengths because the average bond order lies between 1 and 2", ["between single and double", "bond order between 1 and 2"], err=["says one bond is shorter than the others"])]),
    ]
    return _pack("chf_short_resonance_bond_order", "short", "2.6", ["2.5", "2.7"], "4.A", "Resonance structures, bond order and bond length", stim, parts, 4, 9, [f"species={sp_}", f"bo={bo:.4f}"], [_ev("B", "average bond order", bo, 0.02)],
                 ("Resonance forms of a polyatomic species, the average bond order, and the bond length compared with single and double bonds", ["Draw every resonance form with all valence electrons", "Average the bond order over the equivalent positions", "Relate the bond order to the bond length"], [("the species is isolated and in the gas phase", "the stimulus names the species")], {"type": "text", "must_include": ["species", "valence electrons"]},
                  "the valence-electron count and the bond order from the number of resonance forms"), ["representation_reading", "justification"])
