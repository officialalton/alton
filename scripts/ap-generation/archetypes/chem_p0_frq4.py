"""AP Chemistry — FRQ 새 시나리오 7종(2026-10-21, CH4 용): 이전 FRQ(약산 적정·자유 에너지·농도-시간·PES·연소 화학량론·루이스/VSEPR·평형식)와 자료·조건·풀이 틀이 다르다.
유형·배점·행 구조는 chem_p0_g.py 와 같다(긴 문항 10점 + 짧은 문항 4점, 모든 행 1점). 정답·표·기대값은 코드가 두 경로(정확 분수 vs 수치)로 계산한다.
긴 — 과망간산 산화환원 적정 / 전기분해(패러데이) / 초기 속도 표와 속도 법칙; 짧은 — 연속 이온화 에너지 / 침전 한계 반응물 / 분자간 힘과 용해 / ICE 표 평형 농도."""
import json
from chem_common import *  # noqa: F401,F403
from calc_ab_frq import part
from chem_p0_g import R, _pack, _ev


def _stim(text):
    return {"kind": "text", "description": text, "data": {}}


def _tab(desc, cols, rows):
    return {"kind": "table", "description": desc, "data": {"x_label": cols[0], "columns": cols, "y_label": cols[-1], "rows": rows}}


# ======================= 긴 문항: 과망간산 적정으로 철 정량 (10) =======================
def chf_long_redox_titration(rng):
    for _ in forever():
        M, V, ore = pick(rng, [0.0200, 0.0250, 0.0300]), pick(rng, [18.40, 21.60, 24.20, 26.80]), pick(rng, [0.700, 0.800, 0.900, 1.000])
        nMn = M * V / 1000; nFe25 = 5 * nMn; nFe100 = 4 * nFe25; mFe = nFe100 * 55.85; pct = 100 * mFe / ore
        if 15 < pct < 95:
            break
    agree(nMn, float(Fr(str(M)) * Fr(str(V)) / 1000), 1e-12, "nMn"); agree(pct, 100 * float(Fr(str(M)) * Fr(str(V)) / 1000 * 20) * 55.85 / ore, 1e-9, "pct")
    stim = _stim(f"A student dissolves a ${ore:.3f}\\text{{ g}}$ sample of iron ore in acid so that all of the iron is present as Fe²⁺ and dilutes the solution to $100.00\\text{{ mL}}$. A $25.00\\text{{ mL}}$ portion is titrated with ${M:.4f}\\text{{ M}}$ KMnO₄. The balanced equation is MnO₄⁻ + 5 Fe²⁺ + 8 H⁺ → Mn²⁺ + 5 Fe³⁺ + 4 H₂O. The endpoint is reached after ${V:.2f}\\text{{ mL}}$ of KMnO₄ has been added.")
    parts = [
        part("A", "Calculate the number of moles of MnO₄⁻ added at the endpoint and the number of moles of Fe²⁺ in the $25.00\\text{ mL}$ portion.", 2, "calculate", ["5.F", "3.C"], f"n(MnO₄⁻) = ({M:.4f} M)({V / 1000:.5f} L) = {nMn:.3e} mol; n(Fe²⁺) = 5 × {nMn:.3e} = {nFe25:.3e} mol.",
             [R("A1", "numeric", f"Calculates the moles of MnO₄⁻ (about {nMn:.3e} mol)", [f"{nMn:.3e}"], nums=True, units=True, err=["uses the volume in mL without converting to liters"]),
              R("A2", "numeric", f"Multiplies by 5 for the moles of Fe²⁺ (about {nFe25:.3e} mol)", [f"{nFe25:.3e}"], requires="A1", nums=True, units=True, err=["uses a 1:1 mole ratio"])]),
        part("B", "Calculate the mass percent of iron in the ore sample.", 2, "calculate", ["5.F"], f"The 100.00 mL solution holds 4 × {nFe25:.3e} = {nFe100:.3e} mol Fe, which is {mFe:.4f} g; mass percent = {mFe:.4f}/{ore:.3f} × 100 = {pct:.1f}%.",
             [R("B1", "numeric", f"Scales the moles of Fe²⁺ from the 25.00 mL portion to the 100.00 mL solution (about {nFe100:.3e} mol)", [f"{nFe100:.3e}"], nums=True, err=["uses only the moles in the 25.00 mL portion"]),
              R("B2", "numeric", f"Calculates the mass percent of iron by converting to the mass of iron and dividing by the ore mass (about {pct:.1f}%)", [f"{pct:.1f}"], requires="B1", nums=True, units=True, err=["divides by the mass of the portion instead of the whole sample"])]),
        part("C", "No indicator was added to the flask. Explain how the student can still identify the endpoint.", 2, "explain", ["4.B", "6.E"], "MnO₄⁻ is purple and is reduced to nearly colorless Mn²⁺ while Fe²⁺ remains; once all of the Fe²⁺ has reacted, the first excess drop of MnO₄⁻ leaves a faint persistent pink color.",
             [R("C1", "claim", "States that the endpoint is the first persistent pink or purple color", ["persistent pink"], err=["says the solution becomes colorless at the endpoint"]),
              R("C2", "justification", "Justifies that MnO₄⁻ is consumed (reduced to colorless Mn²⁺) until the Fe²⁺ is gone, so the excess MnO₄⁻ colors the solution", ["excess MnO4-", "Fe2+ is gone"], requires="C1", err=["says Fe²⁺ itself produces the pink color"])]),
        part("D", "A bubble was trapped in the tip of the buret before the titration and left the tip during the titration. Will the calculated mass percent of iron be too high, too low, or unaffected? Justify your answer.", 2, "predict", ["2.B", "6.E"], "Too high: the bubble volume is counted as titrant delivered, so the recorded volume is larger than the volume that reacted.",
             [R("D1", "claim", "States that the mass percent of iron will be too high", ["too high"], err=["says it will be too low"]),
              R("D2", "justification", "Justifies that the buret reading overstates the volume of KMnO₄ that reacted, which overstates the moles of Fe²⁺", ["recorded volume larger", "overstates moles"], requires="D1", err=["says the concentration of KMnO₄ changes"])]),
        part("E", "Identify the oxidizing agent in the reaction and justify your answer using oxidation numbers.", 2, "justify", ["4.B", "6.E"], "MnO₄⁻ is the oxidizing agent: the oxidation number of Mn decreases from +7 to +2, so MnO₄⁻ is reduced and oxidizes Fe²⁺.",
             [R("E1", "claim", "Identifies MnO₄⁻ as the oxidizing agent", ["MnO4-"], err=["identifies Fe²⁺ as the oxidizing agent"]),
              R("E2", "justification", "Cites the change in the oxidation number of Mn from +7 to +2, showing that it is reduced", ["+7 to +2", "reduced"], requires="E1", err=["uses the oxidation number of iron without noting that it increases"])]),
    ]
    return _pack("chf_long_redox_titration", "long", "4.6", ["4.5", "4.4"], "5.F", "Permanganate titration of iron in an ore", stim, parts, 10, 23, [f"M={M}", f"V={V}", f"ore={ore}", f"nMn={nMn:.6e}", f"pct={pct:.4f}"],
                 [_ev("B", "mass percent iron", pct, 0.2, "%")],
                 ("Redox titration stoichiometry, scaling from an aliquot, endpoint detection, error analysis, and oxidation numbers", ["Use the mole ratio from the balanced equation", "Scale the aliquot to the whole sample and compute a mass percent", "Reason about the endpoint, the buret error and the oxidizing agent"],
                  [("the iron is completely converted to Fe²⁺", "the stimulus states it")], {"type": "text", "must_include": ["balanced equation", "volumes and concentration"]}, "exact fractions for moles and mass percent; oxidation numbers by rule"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 전기분해 (10) =======================
def chf_long_electrolysis(rng):
    for _ in forever():
        I, t = pick(rng, [1.50, 2.00, 2.50, 3.00]), pick(rng, [20.0, 30.0, 45.0, 60.0]) * 60
        q = I * t; ne = q / 96485; nCu = ne / 2; mCu = nCu * 63.55; nO2 = ne / 4; VO2 = nO2 * 0.08206 * 298 / 1.00
        if 0.3 < mCu < 3.5:
            break
    agree(ne, float(Fr(str(I)) * Fr(str(t)) / 96485), 1e-12, "ne"); agree(VO2, float(Fr(str(I)) * Fr(str(t)) / 96485 / 4 * Fr("0.08206") * 298), 1e-9, "VO2")
    stim = _stim(f"A student electrolyzes $1.0\\text{{ M}}$ CuSO₄(aq) between two inert electrodes, using a constant current of ${I:.2f}\\text{{ A}}$ for ${t / 60:.0f}\\text{{ minutes}}$. Copper metal forms on one electrode, and a gas forms on the other. Use F = 96,485 C/mol e⁻.")
    parts = [
        part("A", "Calculate the total charge, in coulombs, and the number of moles of electrons that flow.", 2, "calculate", ["5.F"], f"q = It = ({I:.2f} A)({t:.0f} s) = {q:.0f} C; n(e⁻) = {q:.0f}/96,485 = {ne:.4f} mol.",
             [R("A1", "numeric", f"Calculates the charge ({q:.0f} C) using the time in seconds", [f"{q:.0f}"], nums=True, units=True, err=["uses the time in minutes"]),
              R("A2", "numeric", f"Divides by the Faraday constant (about {ne:.4f} mol e⁻)", [f"{ne:.4f}"], requires="A1", nums=True, units=True, err=["multiplies by the Faraday constant"])]),
        part("B", "Calculate the mass of copper that forms.", 2, "calculate", ["5.F"], f"Cu²⁺ + 2 e⁻ → Cu, so n(Cu) = {ne:.4f}/2 = {nCu:.4f} mol and the mass is {mCu:.2f} g.",
             [R("B1", "numeric", f"Uses two moles of electrons per mole of Cu (about {nCu:.4f} mol Cu)", [f"{nCu:.4f}"], nums=True, err=["assumes one mole of electrons per mole of Cu"]),
              R("B2", "numeric", f"Calculates the mass of copper (about {mCu:.2f} g)", [f"{mCu:.2f}"], requires="B1", nums=True, units=True, err=["omits the molar mass"])]),
        part("C", "The gas formed at the other electrode is O₂, from 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. Calculate the volume of O₂ at 298 K and 1.00 atm.", 2, "calculate", ["5.F", "3.C"], f"n(O₂) = {ne:.4f}/4 = {nO2:.5f} mol; V = nRT/P = ({nO2:.5f})(0.08206)(298)/1.00 = {VO2:.3f} L.",
             [R("C1", "numeric", f"Uses four moles of electrons per mole of O₂ (about {nO2:.5f} mol)", [f"{nO2:.5f}"], nums=True, err=["uses two moles of electrons per mole of O₂"]),
              R("C2", "numeric", f"Calculates the volume of O₂ with PV = nRT (about {VO2:.3f} L)", [f"{VO2:.3f}"], requires="C1", nums=True, units=True, err=["uses the temperature in °C"])]),
        part("D", "Identify the electrode at which copper forms and justify your answer.", 2, "justify", ["5.B", "6.E"], "Copper forms at the cathode: Cu²⁺ gains electrons and is reduced, and reduction occurs at the cathode.",
             [R("D1", "claim", "Identifies the electrode at which copper forms as the cathode", ["cathode"], err=["identifies the anode"]),
              R("D2", "justification", "Justifies with Cu²⁺ gaining electrons (reduction), which occurs at the cathode", ["Cu2+ gains electrons", "reduction"], requires="D1", err=["says oxidation occurs at the cathode"])]),
        part("E", "The student repeats the electrolysis with the current doubled. Predict the time needed to deposit the same mass of copper and justify your answer.", 2, "predict", ["2.B", "6.E"], "Half as long: the same mass requires the same charge, q = It, so doubling the current halves the time.",
             [R("E1", "claim", "States that the time needed is half as long", ["half"], err=["says the time stays the same"]),
              R("E2", "justification", "Justifies that the same mass needs the same total charge and q = It", ["same charge", "q = It"], requires="E1", err=["says the mass depends only on the current"])]),
    ]
    return _pack("chf_long_electrolysis", "long", "9.11", ["9.9", "9.8"], "5.F", "Electrolysis of copper sulfate solution", stim, parts, 10, 23, [f"I={I}", f"t={t}", f"ne={ne:.6f}", f"mCu={mCu:.4f}", f"VO2={VO2:.4f}"],
                 [_ev("A", "moles of electrons", ne, ne * 0.01, "mol"), _ev("B", "mass of copper", mCu, 0.02, "g"), _ev("C", "volume of O2", VO2, 0.02, "L")],
                 ("Charge, moles of electrons, mass of metal, gas volume, electrode identification, and a proportional prediction", ["Convert current and time to charge and moles of electrons", "Use the half-reaction stoichiometry for the metal and the gas", "Identify the electrode and reason about the charge needed"],
                  [("the current is constant and the efficiency is 100 percent", "the stimulus states the constant current")], {"type": "text", "must_include": ["current and time", "half-reactions"]}, "exact fractions for charge and moles; ideal gas law recomputed from the fractions"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 초기 속도 표와 속도 법칙 (10) =======================
def chf_long_initial_rates(rng):
    for _ in forever():
        a, b = pick(rng, [(1, 2), (2, 1), (1, 1), (2, 2)]), None
        a, b = a
        k = pick(rng, [0.0125, 0.250, 3.50, 0.0400]); A1, B1 = pick(rng, [(0.10, 0.10), (0.20, 0.10), (0.10, 0.20)])
        runs = [(A1, B1), (2 * A1, B1), (A1, 2 * B1), (2 * A1, 2 * B1)]
        rates = [k * x ** a * y ** b for x, y in runs]
        newA, newB = pick(rng, [(0.30, 0.15), (0.050, 0.40), (0.15, 0.30)])
        rnew = k * newA ** a * newB ** b
        if all(1e-6 < r < 5 for r in rates + [rnew]):
            break
    ordA = math.log(rates[1] / rates[0], 2); ordB = math.log(rates[2] / rates[0], 2)
    agree(ordA, a, 1e-9, "a"); agree(ordB, b, 1e-9, "b")
    kfit = rates[0] / (runs[0][0] ** a * runs[0][1] ** b); agree(kfit, k, 1e-9, "k")
    unit = {2: "M⁻¹ s⁻¹", 3: "M⁻² s⁻¹", 4: "M⁻³ s⁻¹"}[a + b] if a + b > 1 else "s⁻¹"
    stim = _tab("Initial rates for A + B → products at one temperature", ["Experiment", "[A]₀ (M)", "[B]₀ (M)", "Initial rate (M/s)"], [[str(i + 1), f"{x:g}", f"{y:g}", f"{r:.3e}"] for i, ((x, y), r) in enumerate(zip(runs, rates))])
    parts = [
        part("A", "Determine the order of the reaction with respect to A and with respect to B. Justify each answer with the data.", 3, "determine", ["5.B", "3.C"], f"Doubling [A] with [B] fixed multiplies the rate by {rates[1] / rates[0]:g}, so the order in A is {a}; doubling [B] with [A] fixed multiplies the rate by {rates[2] / rates[0]:g}, so the order in B is {b}.",
             [R("A1", "numeric", f"Finds the order {a} in A by comparing experiments 1 and 2 (rate ratio {rates[1] / rates[0]:g})", [f"{a}"], nums=True, err=["compares experiments in which both concentrations change"]),
              R("A2", "numeric", f"Finds the order {b} in B by comparing experiments 1 and 3 (rate ratio {rates[2] / rates[0]:g})", [f"{b}"], nums=True, err=["uses the coefficient from the equation"]),
              R("A3", "justification", "Relates each rate ratio to the factor by which the concentration changed", ["rate ratio", "concentration doubled"], requires="A1", err=["gives the orders without using the data"])]),
        part("B", "Write the rate law for the reaction and calculate the value of the rate constant, including units.", 2, "calculate", ["5.F"], f"rate = k[A]^{a}[B]^{b}; k = {rates[0]:.3e}/(({runs[0][0]:g})^{a}({runs[0][1]:g})^{b}) = {kfit:.4g} {unit}.",
             [R("B1", "expression", f"Writes rate = k[A]^{a}[B]^{b}", [f"rate = k[A]^{a}[B]^{b}"], err=["includes a product or a concentration with the wrong exponent"]),
              R("B2", "numeric", f"Calculates k (about {kfit:.4g} {unit}) with units", [f"{kfit:.4g}"], requires="B1", nums=True, units=True, err=["omits the units of k"])]),
        part("C", f"Calculate the initial rate when [A]₀ = {newA:g} M and [B]₀ = {newB:g} M.", 2, "calculate", ["5.F"], f"rate = ({kfit:.4g})({newA:g})^{a}({newB:g})^{b} = {rnew:.3e} M/s.",
             [R("C1", "numeric", f"Substitutes the concentrations into the rate law", [f"{newA:g}", f"{newB:g}"], nums=True, err=["uses the concentrations of experiment 1"]),
              R("C2", "numeric", f"Calculates the rate (about {rnew:.3e} M/s)", [f"{rnew:.3e}"], requires="C1", nums=True, units=True, err=["adds the terms instead of multiplying"])]),
        part("D", "The temperature is increased and the experiments are repeated. The rate constant increases. Explain this increase in terms of the molecules that react.", 2, "explain", ["6.E"], "A larger fraction of collisions has energy at least equal to the activation energy at the higher temperature, so more collisions are effective and the rate constant is larger.",
             [R("D1", "claim", "States that a larger fraction of collisions has enough energy to react", ["larger fraction", "enough energy"], err=["says the activation energy decreases"]),
              R("D2", "justification", "Connects the energy to the activation energy at the higher temperature", ["activation energy", "higher temperature"], requires="D1", err=["says the concentration of the reactants increases"])]),
        part("E", "A student proposes that the reaction occurs in a single elementary step A + B → products. Is the proposal consistent with the rate law? Justify your answer.", 1, "justify", ["4.B", "6.E"], f"{'Consistent' if (a, b) == (1, 1) else 'Not consistent'}: for a single elementary step the rate law would be rate = k[A][B], {'which matches the experimental rate law' if (a, b) == (1, 1) else 'which does not match the experimental orders ' + str(a) + ' and ' + str(b)}.",
             [R("E1", "justification", f"States that the proposal is {'consistent' if (a, b) == (1, 1) else 'not consistent'} because an elementary step has orders equal to its coefficients, rate = k[A][B]", ["elementary step", "coefficients"], err=["decides from the coefficient of the overall equation without considering the experimental orders"])]),
    ]
    return _pack("chf_long_initial_rates", "long", "5.2", ["5.3", "5.5"], "5.F", "Method of initial rates and the rate law", stim, parts, 10, 23, [f"a={a}", f"b={b}", f"k={k}", f"A1={A1}", f"B1={B1}", f"newA={newA}", f"newB={newB}", f"rnew={rnew:.4e}"],
                 [_ev("B", "rate constant", kfit, abs(kfit) * 0.02)],
                 ("Orders from controlled comparisons of initial rates, the rate law and k, a predicted rate, the effect of temperature, and consistency with an elementary step", ["Compare experiments in which only one concentration changes", "Write the rate law and solve for k with its units", "Explain the temperature effect and test the proposed step"],
                  [("the temperature is the same in every experiment", "the stimulus states it")], {"type": "table", "must_include": ["initial concentrations", "initial rates"]}, "logs of exact rate ratios give the orders; k recomputed from every experiment"), ["law_selection", "justification", "representation_reading"])


# ======================= 짧은 문항: 연속 이온화 에너지 (4) =======================
def chf_short_ionization_energy(rng):
    el, Z, ies, valence = pick(rng, [("magnesium", 12, [738, 1451, 7733, 10543], 2), ("aluminum", 13, [578, 1817, 2745, 11577], 3), ("sodium", 11, [496, 4562, 6910, 9543], 1)])
    jump = max(range(1, 4), key=lambda i: ies[i] / ies[i - 1])
    agree(float(jump), float(valence), 1e-9, "jump")
    stim = _tab(f"Successive ionization energies of a main-group element (atomic number {Z})", ["Ionization", "Energy (kJ/mol)"], [[f"IE{i + 1}", f"{v:,}"] for i, v in enumerate(ies)])
    parts = [
        part("A", "Identify the number of valence electrons of the element. Justify your answer with the data.", 2, "justify", ["1.A", "6.E"], f"{valence} valence electron{'s' if valence > 1 else ''}: the energy increases sharply between IE{valence} and IE{valence + 1} ({ies[valence - 1]:,} to {ies[valence]:,} kJ/mol), because the next electron comes from a filled inner shell closer to the nucleus.",
             [R("A1", "claim", f"States {valence} valence electron{'s' if valence > 1 else ''}", [f"{valence}"], nums=True, err=["chooses the number of the largest ionization energy"]),
              R("A2", "justification", f"Cites the large jump between IE{valence} and IE{valence + 1} as the removal of an electron from an inner shell", ["large jump", "inner shell"], requires="A1", err=["says the energy increases because the atom is smaller"])]),
        part("B", f"Calculate the ratio IE{valence + 1}/IE{valence} for the element.", 1, "calculate", ["3.C"], f"{ies[valence]:,}/{ies[valence - 1]:,} = {ies[valence] / ies[valence - 1]:.1f}.",
             [R("B1", "numeric", f"Calculates the ratio of the energies (about {ies[valence] / ies[valence - 1]:.1f})", [f"{ies[valence] / ies[valence - 1]:.1f}"], nums=True, err=["subtracts the energies instead of dividing"])]),
        part("C", "A second element in the same period has a larger nuclear charge. Predict whether its first ionization energy is greater or less than the first ionization energy of this element, and justify your answer with Coulomb's law.", 1, "predict", ["2.B", "6.E"], "Greater in general: a larger nuclear charge at a similar distance attracts the valence electrons more strongly, so more energy is needed to remove one.",
             [R("C1", "justification", "Predicts a greater first ionization energy and cites the stronger attraction from the larger nuclear charge at a similar distance", ["greater", "nuclear charge"], err=["says the larger nuclear charge increases the shielding"])]),
    ]
    return _pack("chf_short_ionization_energy", "short", "1.7", ["1.6", "1.4"], "1.A", "Successive ionization energies and valence electrons", stim, parts, 4, 9, [f"el={el}", f"Z={Z}", f"valence={valence}"], [_ev("B", "ratio of energies", ies[valence] / ies[valence - 1], 0.05)],
                 ("Valence electrons from successive ionization energies, a ratio of energies, and a Coulomb's law prediction", ["Locate the large jump in the successive energies", "Compute the ratio of the two energies", "Use the nuclear charge to predict the trend"], [("the energies are for the gaseous atom", "the data table")], {"type": "table", "must_include": ["successive ionization energies"]},
                  "the position of the jump found with a ratio search and with the valence count"), ["representation_reading", "justification"])


# ======================= 짧은 문항: 침전 반응과 한계 반응물 (4) =======================
def chf_short_precip_limiting(rng):
    salt, mmo, prod, mmp, cat_c, an_c = pick(rng, [("Pb(NO₃)₂", 331.2, "PbI₂", 461.0, 1, 2), ("BaCl₂", 208.2, "BaSO₄", 233.4, 1, 1), ("CaCl₂", 111.0, "CaCO₃", 100.1, 1, 1)])
    other = {"Pb(NO₃)₂": "KI", "BaCl₂": "Na₂SO₄", "CaCl₂": "Na₂CO₃"}[salt]; coef = {"Pb(NO₃)₂": 2, "BaCl₂": 1, "CaCl₂": 1}[salt]
    V1, M1, V2, M2 = pick(rng, [(50.0, 0.200, 50.0, 0.300), (40.0, 0.250, 60.0, 0.200), (75.0, 0.100, 25.0, 0.500)])
    n1 = V1 / 1000 * M1; n2 = V2 / 1000 * M2
    ext1, ext2 = n1, n2 / coef
    lim = salt if ext1 < ext2 else other; nprod = min(ext1, ext2); mprod = nprod * mmp
    agree(mprod, float(min(Fr(str(V1)) / 1000 * Fr(str(M1)), Fr(str(V2)) / 1000 * Fr(str(M2)) / coef) * Fr(str(mmp))), 1e-9, "mprod")
    excess = other if lim == salt else salt; nex = (n2 - coef * n1) if lim == salt else (n1 - n2 / coef); nex_m = nex if excess == salt else nex
    stim = _stim(f"A student mixes ${V1:.1f}\\text{{ mL}}$ of ${M1:.3f}\\text{{ M}}$ {salt}(aq) with ${V2:.1f}\\text{{ mL}}$ of ${M2:.3f}\\text{{ M}}$ {other}(aq). A precipitate of {prod} forms. Assume that the reaction goes to completion.")
    parts = [
        part("A", "Determine which reactant is the limiting reactant. Show your work.", 2, "determine", ["5.F"], f"n({salt}) = {n1:.4f} mol and n({other}) = {n2:.4f} mol; the stoichiometry needs {coef} mol {other} per mol {salt}, so the limiting reactant is {lim}.",
             [R("A1", "numeric", f"Calculates the moles of each reactant ({n1:.4f} mol and {n2:.4f} mol)", [f"{n1:.4f}", f"{n2:.4f}"], nums=True, units=True, err=["uses volumes in mL"]),
              R("A2", "claim", f"Compares the moles using the mole ratio and identifies {lim} as limiting", [lim], requires="A1", err=["compares the molarities instead of the moles"])]),
        part("B", f"Calculate the mass of {prod} that forms.", 1, "calculate", ["5.F"], f"{nprod:.4f} mol × {mmp} g/mol = {mprod:.3f} g.",
             [R("B1", "numeric", f"Uses the limiting reactant to find about {mprod:.3f} g", [f"{mprod:.3f}"], nums=True, units=True, err=["uses the moles of the excess reactant"])]),
        part("C", "A student claims that the total number of moles of ions in the solution decreases during the precipitation. Is the claim correct? Justify your answer.", 1, "justify", ["4.B", "6.E"], "Correct: ions that form the solid leave the solution, so there are fewer moles of dissolved ions.",
             [R("C1", "justification", "States that the claim is correct because ions are removed from the solution as the solid forms", ["ions removed", "solid forms"], err=["says that the mass of the ions decreases because mass is lost"])]),
    ]
    return _pack("chf_short_precip_limiting", "short", "4.4", ["4.5", "3.7"], "5.F", "Precipitation with a limiting reactant", stim, parts, 4, 9, [f"salt={salt}", f"V1={V1}", f"M1={M1}", f"V2={V2}", f"M2={M2}", f"mprod={mprod:.4f}"], [_ev("B", "mass of precipitate", mprod, 0.02, "g")],
                 ("Moles from volume and molarity, the limiting reactant by mole ratio, the mass of precipitate, and ions leaving the solution", ["Find moles of each solution", "Compare with the mole ratio", "Convert the limiting amount to mass"], [("the reaction goes to completion", "the stimulus states it")], {"type": "text", "must_include": ["volumes", "molarities"]},
                  "extent of reaction from exact fractions for both reactants"), ["law_selection", "justification"])


# ======================= 짧은 문항: 분자간 힘과 끓는점 표 (4) =======================
def chf_short_imf_dissolving(rng):
    rows = [["propane, C₃H₈", "44.1", "231"], ["butane, C₄H₁₀", "58.1", "273"], ["dimethyl ether, CH₃OCH₃", "46.1", "248"], ["ethanol, CH₃CH₂OH", "46.1", "351"]]
    stim = _tab("Molar masses and normal boiling points of four organic compounds", ["Substance", "Molar mass (g/mol)", "Normal boiling point (K)"], rows)
    parts = [
        part("A", "Using the table, compare the boiling points of propane and butane, and explain the difference in terms of intermolecular forces.", 2, "explain", ["3.A", "6.E"], "Butane has the higher boiling point (273 K versus 231 K); both are nonpolar, and the larger electron cloud of butane is more polarizable, so its London dispersion forces are stronger and more energy is needed to separate the molecules.",
             [R("A1", "claim", "States that butane (273 K) has a higher boiling point than propane (231 K)", ["butane higher", "273", "231"], nums=True, err=["says propane has the higher boiling point because it is smaller"]),
              R("A2", "justification", "Explains that the larger, more polarizable electron cloud of butane gives stronger London dispersion forces", ["more polarizable", "London dispersion forces"], requires="A1", err=["says the C–C bonds of butane are stronger so they break less easily"])]),
        part("B", "Draw a diagram of two ethanol molecules that shows one hydrogen bond between them. Label the hydrogen bond with a dashed line and show the atoms involved.", 1, "draw", ["3.A", "3.B"], "The hydrogen atom of the O–H group in one ethanol molecule is joined by a dashed line to the oxygen atom of the other molecule.",
             [R("B1", "diagram", "Draws a dashed line between the hydrogen of the O–H group of one molecule and the oxygen of the second molecule", ["dashed line", "O–H hydrogen to oxygen"], err=["draws the dashed line between two carbon atoms or between two hydrogen atoms"])]),
        part("C", "Ethanol and dimethyl ether have the same molar mass, but ethanol has a much higher boiling point. Explain this difference in terms of intermolecular forces.", 1, "explain", ["3.A", "6.E"], "Ethanol molecules can form hydrogen bonds with one another (H bonded to O), which are stronger than the dipole–dipole forces between dimethyl ether molecules, which have no O–H group.",
             [R("C1", "justification", "Explains that ethanol forms hydrogen bonds, which are stronger than the forces between dimethyl ether molecules", ["hydrogen bonds", "stronger"], err=["says the O–H bond of ethanol breaks when the liquid boils"])]),
    ]
    return _pack("chf_short_imf_dissolving", "short", "3.1", ["3.2", "3.8"], "3.A", "Intermolecular forces and boiling points of alkanes, an ether and an alcohol", stim, parts, 4, 9, ["rows=" + json.dumps(rows)], [],
                 ("Reading a table of boiling points, London dispersion forces in two alkanes, a diagram of a hydrogen bond, and hydrogen bonding in an alcohol versus an ether", ["Read the trend from the table", "Relate the trend to the strength of the intermolecular forces", "Show and explain a hydrogen bond"], [("the boiling points are measured at 1 atm", "the table title")], {"type": "table", "must_include": ["molar masses", "normal boiling points"]},
                  "tabulated boiling points; the ordering is checked from the table values"), ["representation_reading", "justification"])


# ======================= 짧은 문항: ICE 표와 평형 농도 (4) =======================
def chf_short_ice_table(rng):
    for _ in forever():
        A0, B0, x = pick(rng, [(0.500, 0.500, 0.100), (0.800, 0.400, 0.150), (1.00, 0.600, 0.200), (0.400, 0.400, 0.120)])
        if x < min(A0, B0):
            break
    Aeq, Beq, Ceq = A0 - x, B0 - x, x; K = Ceq / (Aeq * Beq)
    agree(K, float(Fr(str(x)) / ((Fr(str(A0)) - Fr(str(x))) * (Fr(str(B0)) - Fr(str(x))))), 1e-9, "K")
    stim = _stim(f"For the gas-phase reaction A(g) + B(g) ⇌ C(g), a student starts a rigid container with ${A0:g}\\text{{ M}}$ of A and ${B0:g}\\text{{ M}}$ of B and no C. At equilibrium at a fixed temperature, the concentration of C is ${Ceq:g}\\text{{ M}}$.")
    parts = [
        part("A", "Write the equilibrium constant expression and calculate the equilibrium concentrations of A and B.", 2, "calculate", ["5.F"], f"[A] = {A0:g} − {x:g} = {Aeq:g} M and [B] = {B0:g} − {x:g} = {Beq:g} M, because each mole of C formed uses one mole of A and one of B.",
             [R("A1", "expression", "Writes Kc = [C]/([A][B])", ["Kc = [C]/([A][B])"], err=["puts the reactants in the numerator"]),
              R("A2", "numeric", f"Calculates [A] = {Aeq:g} M and [B] = {Beq:g} M", [f"{Aeq:g}", f"{Beq:g}"], requires="A1", nums=True, units=True, err=["subtracts twice the change"])]),
        part("B", "Calculate the value of Kc.", 1, "calculate", ["5.F"], f"Kc = {Ceq:g}/(({Aeq:g})({Beq:g})) = {K:.3f}.",
             [R("B1", "numeric", f"Substitutes into the expression for about {K:.3f}", [f"{K:.3f}"], nums=True, err=["uses the initial concentrations"])]),
        part("C", "Calculate the value of Kc for the reverse reaction, C(g) ⇌ A(g) + B(g), at the same temperature.", 1, "calculate", ["5.F"], f"For the reverse reaction, K = 1/Kc = 1/{K:.3f} = {1 / K:.3f}.",
             [R("C1", "numeric", f"Calculates the value of the reciprocal of Kc (about {1 / K:.3f})", [f"{1 / K:.3f}"], nums=True, err=["uses the same value of Kc for the reverse reaction"])]),
    ]
    return _pack("chf_short_ice_table", "short", "7.7", ["7.5", "7.4"], "5.F", "ICE table and equilibrium concentrations", stim, parts, 4, 9, [f"A0={A0}", f"B0={B0}", f"x={x}", f"K={K:.4f}"], [_ev("B", "Kc", K, K * 0.02)],
                 ("Equilibrium concentrations from the change in a product, Kc, and Kc for the reverse reaction", ["Use the stoichiometry of the change", "Substitute equilibrium concentrations into Kc", "Take the reciprocal for the reverse reaction"], [("the temperature is fixed", "the stimulus states it")], {"type": "text", "must_include": ["initial concentrations", "equilibrium concentration of C"]},
                  "Kc from exact fractions; the reverse constant as its reciprocal"), ["law_selection", "justification"])
