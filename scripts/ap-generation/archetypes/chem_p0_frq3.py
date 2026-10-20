"""AP Chemistry — FRQ 새 시나리오 7종(2026-10-19, 브랜치 ap-bi-ph-ch): CH3 가 CH1·CH2 와 FRQ 원형(풀이 틀)을 겹치지 않으려면 유형마다 새 시나리오가 필요하다.
유형·배점·행 구조는 chem_p0_g.py 와 같다(긴 문항 10점 3개 + 짧은 문항 4점 4개, 모든 행 1점). 정답·표·기대값은 코드가 두 경로로 계산한다.
새 시나리오: 긴 — 완충 용액 / 용해도곱·침전 / 열량계·헤스 법칙; 짧은 — 질량 분석 / 기체 혼합물 / 용액 농도·희석 / 강산·강염기 중화."""
from chem_common import *  # noqa: F401,F403
from calc_ab_frq import part
from chem_p0_g import R, _pack, _ev


def _stim(text):
    return {"kind": "text", "description": text, "data": {}}


# ======================= 긴 문항: 완충 용액 (10) =======================
def chf_long_buffer(rng):
    for _ in forever():
        name, pKa = pick(rng, [("acetic acid, CH3COOH", 4.74), ("formic acid, HCOOH", 3.75), ("dihydrogen phosphate, H2PO4⁻", 7.21), ("ammonium, NH4⁺", 9.25)])
        nHA = pick(rng, [0.200, 0.300, 0.400]); nA = pick(rng, [0.100, 0.150, 0.250, 0.300]); add = pick(rng, [0.020, 0.030, 0.040]); extra_dp = pick(rng, [0.30, 0.50, 0.70])
        if nA - add > 0.05 and nA != nHA:
            break
    pH0 = pKa + math.log10(nA / nHA)
    agree(pH0, pKa + math.log10(float(Fr(str(nA)) / Fr(str(nHA)))), 1e-9, "pH0")
    nA2, nHA2 = nA - add, nHA + add
    pH1 = pKa + math.log10(nA2 / nHA2)
    agree(pH1, pKa + math.log10(float((Fr(str(nA)) - Fr(str(add))) / (Fr(str(nHA)) + Fr(str(add))))), 1e-9, "pH1")
    ratio = 10 ** extra_dp; nAneed = nHA * ratio
    agree(nAneed, bisect(lambda x: math.log10(x / nHA) - extra_dp, 1e-6, 100.0), 1e-6, "nA")
    stim = _stim(f"A student prepares $1.00\\text{{ L}}$ of a buffer that contains ${nHA:g}\\text{{ mol}}$ of the weak acid {name} and ${nA:g}\\text{{ mol}}$ of its conjugate base. The pK_a of the weak acid is {pKa:g} at 25 °C. Assume that adding substances does not change the volume.")
    parts = [
        part("A", "Write the Henderson–Hasselbalch equation for this buffer and calculate its pH.", 2, "calculate", ["5.B", "5.F"], f"pH = pK_a + log([A⁻]/[HA]) = {pKa:g} + log({nA:g}/{nHA:g}) = {pH0:.2f}.",
             [R("A1", "expression", "Writes pH = pK_a + log([A⁻]/[HA]) with the base in the numerator", ["pH = pKa + log([A-]/[HA])"], err=["inverts the ratio"]),
              R("A2", "numeric", f"Calculates the pH (about {pH0:.2f})", [f"{pH0:.2f}"], requires="A1", nums=True, err=["uses the pK_a as the pH"])]),
        part("B", f"A student adds ${add:g}\\text{{ mol}}$ of a strong acid to the buffer. Calculate the pH after the addition.", 3, "calculate", ["5.F"], f"The strong acid converts A⁻ to HA: A⁻ = {nA2:g} mol, HA = {nHA2:g} mol; pH = {pKa:g} + log({nA2:g}/{nHA2:g}) = {pH1:.2f}.",
             [R("B1", "numeric", f"Subtracts the added acid from the moles of A⁻ ({nA2:g} mol)", [f"{nA2:g}"], nums=True, err=["adds the strong acid to A⁻"]),
              R("B2", "numeric", f"Adds the added acid to the moles of HA ({nHA2:g} mol)", [f"{nHA2:g}"], nums=True, err=["subtracts it from HA"]),
              R("B3", "numeric", f"Calculates the new pH (about {pH1:.2f})", [f"{pH1:.2f}"], requires="B2", nums=True, err=["ignores the added acid"])]),
        part("C", f"A second buffer is made with ${nHA:g}\\text{{ mol}}$ of the weak acid in $1.00\\text{{ L}}$. How many moles of the conjugate base must be present for the pH to be {extra_dp:.2f} units above the pK_a?", 2, "calculate", ["5.B", "5.F"], f"log([A⁻]/[HA]) = {extra_dp:.2f}, so [A⁻]/[HA] = {ratio:.3f} and n(A⁻) = {nAneed:.3f} mol.",
             [R("C1", "numeric", f"Finds the ratio of base to acid, 10^{extra_dp:.2f} (about {ratio:.2f})", [f"{ratio:.2f}"], nums=True, err=["uses the ratio equal to the pH difference"]),
              R("C2", "numeric", f"Multiplies by the moles of acid to get about {nAneed:.3f} mol", [f"{nAneed:.3f}"], requires="C1", nums=True, units=True, err=["divides by the moles of acid"])]),
        part("D", "Explain, in terms of the species present, how the original buffer resists a change in pH when a small amount of strong acid is added.", 2, "explain", ["4.B", "6.E"], "The conjugate base A⁻ reacts with the added H⁺ to form HA, so the amount of H⁺ that remains free is small and the ratio [A⁻]/[HA] changes only a little.",
             [R("D1", "claim", "Identifies the conjugate base A⁻ as the species that reacts with the added H⁺ to form the weak acid", ["A- reacts with H+", "forms HA"], err=["says the weak acid reacts with the added acid"]),
              R("D2", "justification", "Justifies that the ratio [A⁻]/[HA] changes only slightly, so the pH changes only slightly, because both components are present in large amounts compared with the added acid", ["ratio changes only slightly"], requires="D1", err=["says the added acid is removed from the solution entirely"])]),
        part("E", "The original buffer is diluted with water to ten times its volume. Does the pH change? Justify your answer.", 1, "predict", ["2.B"], "The pH does not change, because the ratio [A⁻]/[HA] is unchanged by dilution; the buffer capacity decreases.",
             [R("E1", "justification", "States that the pH is unchanged and justifies it with the unchanged ratio of the concentrations of A⁻ and HA", ["pH unchanged", "ratio unchanged"], err=["says the pH rises because there is more water"])]),
    ]
    return _pack("chf_long_buffer", "long", "8.9", ["8.5", "8.10"], "5.F", "Buffer pH, addition of strong acid and buffer composition", stim, parts, 10, 23, [f"pKa={pKa}", f"nHA={nHA}", f"nA={nA}", f"add={add}", f"dp={extra_dp}", f"pH0={pH0:.4f}", f"pH1={pH1:.4f}"],
                 [_ev("A", "initial pH", pH0, 0.03), _ev("B", "pH after acid", pH1, 0.03), _ev("C", "moles of base", nAneed, 0.01, "mol")],
                 ("Henderson–Hasselbalch pH of a buffer, a stoichiometric update after adding a strong acid, and an explanation of buffer action", ["Write the equation and use the mole ratio of base to acid", "Update the moles by stoichiometry after the strong acid reacts", "Explain the action of the buffer with the species present"],
                  [("the volume does not change", "the stimulus states it")], {"type": "text", "must_include": ["pK_a", "moles of the acid and the base"]},
                  "exact-fraction ratio and logs for the pH values; bisection on the log ratio recomputes the moles of the base"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 용해도곱과 침전 (10) =======================
def chf_long_ksp(rng):
    for _ in forever():
        form, Ksp, nc, na, cat, an = pick(rng, [("CaF2", 3.5e-11, 1, 2, "Ca²⁺", "F⁻"), ("PbI2", 9.8e-9, 1, 2, "Pb²⁺", "I⁻"), ("Mg(OH)2", 5.6e-12, 1, 2, "Mg²⁺", "OH⁻"), ("Ag2CrO4", 1.1e-12, 2, 1, "Ag⁺", "CrO4²⁻")])
        s = (Ksp / (nc ** nc * na ** na)) ** (1.0 / (nc + na))
        agree(s, bisect(lambda x: (nc * x) ** nc * (na * x) ** na - Ksp, 1e-12, 1.0), 1e-6, "s")
        c0 = pick(rng, [0.10, 0.050, 0.020]); cc = pick(rng, [2.0e-3, 5.0e-4, 2.0e-5, 1.0e-6, 3.0e-7]); ca = pick(rng, [2.0e-3, 4.0e-4, 6.0e-5, 1.0e-6, 2.0e-7])
        Q = (cc / 2) ** nc * (ca / 2) ** na
        if not (0.3 > Q / Ksp or Q / Ksp > 3):
            continue
        break
    precip = Q > Ksp
    sp_ = (Ksp / c0 ** na) ** (1.0 / nc) / nc
    agree(sp_, bisect(lambda x: (nc * x) ** nc * c0 ** na - Ksp, 1e-14, 1.0), 1e-6, "s'")
    stim = _stim(f"The solubility-product constant of {cf(form)} at 25 °C is $K_{{sp}} = {sn(Ksp, 2).strip('$')}$. Part (b) concerns mixing equal volumes of a ${sn(cc, 2).strip('$')}\\text{{ M}}$ solution that contains {cat} and a ${sn(ca, 2).strip('$')}\\text{{ M}}$ solution that contains {an}. Part (c) concerns a saturated solution of {cf(form)} in a solution that contains ${c0:g}\\text{{ M}}$ of {an} from a soluble salt.")
    parts = [
        part("A", f"Write the K_sp expression for {cf(form)} and calculate its molar solubility in pure water.", 2, "calculate", ["5.B", "5.F"], f"K_sp = [{cat}]^{nc}[{an}]^{na}; with s mol/L dissolved, ({nc}s)^{nc}({na}s)^{na} = K_sp, so s = {sn(s, 3)} M.",
             [R("A1", "expression", f"Writes K_sp = [{cat}]^{nc}[{an}]^{na} with the coefficients as exponents", [f"[{cat}]^{nc}[{an}]^{na}"], err=["includes the solid in the expression"]),
              R("A2", "numeric", f"Calculates the molar solubility (about {sn(s, 2)} M)", [f"{sn(s, 2)}"], requires="A1", nums=True, units=True, err=["takes s equal to K_sp"])]),
        part("B", "Calculate the reaction quotient Q immediately after the two solutions are mixed, and state whether a precipitate forms.", 3, "determine", ["3.C", "6.D"], f"After mixing, each concentration is halved: [{cat}] = {sn(cc / 2, 2)} M and [{an}] = {sn(ca / 2, 2)} M. Q = {sn(Q, 2)}, which is {'greater' if precip else 'less'} than K_sp, so {'a precipitate forms' if precip else 'no precipitate forms'}.",
             [R("B1", "numeric", "States that the concentrations are halved on mixing equal volumes", ["concentrations halved"], err=["uses the unmixed concentrations"]),
              R("B2", "numeric", f"Calculates Q (about {sn(Q, 2)}) from the diluted concentrations", [f"{sn(Q, 2)}"], requires="B1", nums=True, err=["omits the exponents"]),
              R("B3", "claim", f"Compares Q with K_sp and concludes that {'a precipitate forms' if precip else 'no precipitate forms'}", ["precipitate" if precip else "no precipitate"], requires="B2", err=["reverses the comparison"])]),
        part("C", f"Calculate the molar solubility of {cf(form)} in the solution that contains ${c0:g}\\text{{ M}}$ of {an}.", 2, "calculate", ["5.F"], f"With [{an}] = {c0:g} M, ({nc}s)^{nc}({c0:g})^{na} = K_sp gives s = {sn(sp_, 2)} M.",
             [R("C1", "expression", f"Sets up K_sp with [{an}] equal to the common-ion concentration ({c0:g} M) and ignores the small amount that dissolves", [f"[{an}] = {c0:g}"], err=["uses the same concentration for the two ions"]),
              R("C2", "numeric", f"Calculates the molar solubility (about {sn(sp_, 2)} M)", [f"{sn(sp_, 2)}"], requires="C1", nums=True, units=True, err=["forgets the exponent of the common ion"])]),
        part("D", "Compare the solubility in part (c) with the solubility in part (a). Justify your answer in terms of equilibrium.", 2, "justify", ["6.D", "6.E"], "The solubility is lower in the solution with the common ion: the added ion shifts the dissolution equilibrium toward the solid (Le Châtelier), so less of the salt dissolves.",
             [R("D1", "claim", "States that the solubility is lower in the solution that contains the common ion", ["lower"], err=["says the solubility is greater"]),
              R("D2", "justification", "Justifies with the shift of the dissolution equilibrium toward the solid when the concentration of the common ion is increased (or Q greater than K_sp for the pure-water saturation)", ["shifts toward the solid", "common ion"], requires="D1", err=["says that K_sp becomes smaller"])]),
        part("E", "A student states that adding the soluble salt changes the value of K_sp. Is the statement correct? Justify your answer.", 1, "justify", ["6.E"], "The statement is incorrect: K_sp depends only on temperature, and the added ion changes the concentrations, not the constant.",
             [R("E1", "justification", "States that the statement is incorrect and justifies that K_sp is a constant at a given temperature", ["incorrect", "depends on temperature only"], err=["says K_sp changes with the concentration"])]),
    ]
    return _pack("chf_long_ksp", "long", "7.11", ["7.9", "7.12"], "5.F", "Solubility product, precipitation and the common-ion effect", stim, parts, 10, 23, [f"form={form}", f"Ksp={Ksp}", f"cc={cc}", f"ca={ca}", f"c0={c0}", f"s={s:.4e}", f"Q={Q:.4e}", f"s'={sp_:.4e}"],
                 [_ev("A", "molar solubility", s, 0.03 * s, "M"), _ev("B", "Q", Q, 0.03 * Q, ""), _ev("C", "common-ion solubility", sp_, 0.03 * sp_, "M")],
                 ("K_sp from a formula, Q versus K_sp for mixing solutions, and the common-ion effect", ["Write the K_sp expression with the formula's subscripts", "Halve the concentrations for equal-volume mixing and compare Q with K_sp", "Use the common-ion concentration in K_sp to find the reduced solubility"],
                  [("the solutions are at 25 °C", "the stimulus")], {"type": "text", "must_include": ["K_sp", "concentrations"]},
                  "bisection on the K_sp equation recomputes the solubilities; Q is computed from exact halved concentrations"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항: 열량계와 헤스 법칙 (10) =======================
def chf_long_calorimetry(rng):
    for _ in forever():
        Vacid = pick(rng, [50.0, 75.0, 100.0]); cm = pick(rng, [0.50, 1.00, 2.00]); Ti = pick(rng, [21.0, 22.0, 23.0, 24.0]); dHrx = pick(rng, [-57.1, -55.8, -52.0])
        n = Vacid / 1000 * cm; msol = 2 * Vacid * 1.00
        dT = round(-dHrx * 1000 * n / (msol * 4.18), 1)
        if dT > 3.0:
            break
    Tf = Ti + dT; q = msol * 4.18 * dT; dHm = -q / n / 1000
    agree(dHm, -float(sp.nsimplify(msol) * sp.nsimplify(4.18) * sp.nsimplify(dT)) / n / 1000, 1e-9, "dH")
    d1 = pick(rng, [-90.0, -120.0, -75.0, -150.0]); d2 = pick(rng, [-60.0, 40.0, -30.0, 80.0]); dHt = 2 * d1 + d2
    agree(dHt, float(2 * sp.nsimplify(d1) + sp.nsimplify(d2)), 1e-9, "Hess")
    stim = _stim(f"A student mixes ${Vacid:g}\\text{{ mL}}$ of ${cm:g}\\text{{ M}}$ HCl with ${Vacid:g}\\text{{ mL}}$ of ${cm:g}\\text{{ M}}$ NaOH in a coffee-cup calorimeter. The initial temperature of both solutions is ${Ti:g}\\,^{{\\circ}}\\text{{C}}$ and the highest temperature reached is ${Tf:.1f}\\,^{{\\circ}}\\text{{C}}$. Assume that the density of the solution is $1.00\\text{{ g/mL}}$, that its specific heat is $4.18\\text{{ J/(g}}\\cdot^{{\\circ}}\\text{{C)}}$ and that no heat is lost to the calorimeter. Part (c) concerns the reactions (1) A + B → C, ΔH₁ = {d1:g} kJ and (2) 2 C → D, ΔH₂ = {d2:g} kJ.")
    parts = [
        part("A", "Calculate the heat, in J, gained by the solution.", 2, "calculate", ["3.C"], f"q = m c ΔT = ({msol:g} g)(4.18)({dT:.1f}) = {sig(q)} J.",
             [R("A1", "expression", "Uses q = m c ΔT with the total mass of both solutions", ["q = m c ΔT", "total mass"], err=["uses the volume of one solution only"]),
              R("A2", "numeric", f"Calculates q (about {sig(q)} J)", [sig(q)], requires="A1", nums=True, units=True, err=["uses a temperature instead of the change"])]),
        part("B", "Calculate the enthalpy change, in kJ per mole of water formed, for the reaction.", 2, "calculate", ["5.F"], f"n(H2O) = {n:.4f} mol; ΔH = −q/n = {dHm:.1f} kJ/mol.",
             [R("B1", "numeric", f"Finds the moles of water formed ({n:.4f} mol) from the limiting amount", [f"{n:.4f}"], nums=True, err=["uses the total volume to find the moles"]),
              R("B2", "numeric", f"Calculates ΔH (about {dHm:.1f} kJ/mol) with a negative sign for the exothermic reaction", [f"{dHm:.1f}"], requires="B1", nums=True, units=True, err=["reports a positive value"])]),
        part("C", "Use Hess's law to calculate ΔH for the reaction 2 A + 2 B → D.", 3, "calculate", ["5.F"], f"2 x (1) + (2): ΔH = 2({d1:g}) + ({d2:g}) = {dHt:g} kJ.",
             [R("C1", "expression", "Multiplies reaction (1) and its ΔH by 2", ["2 x reaction 1"], err=["does not scale ΔH₁"]),
              R("C2", "expression", "Adds reaction (2) without reversing it, so that 2 C cancels", ["adds reaction 2"], requires="C1", err=["reverses reaction 2"]),
              R("C3", "numeric", f"Calculates ΔH = {dHt:g} kJ", [f"{dHt:g}"], requires="C2", nums=True, units=True, err=["adds ΔH₁ without doubling it"])]),
        part("D", "The calorimeter actually lost some heat to the surroundings. Explain the effect of this error on the magnitude of the calculated ΔH.", 2, "justify", ["2.E", "6.G"], "The measured temperature rise is smaller than it would be with no loss, so |q| and the calculated |ΔH| are too small.",
             [R("D1", "claim", "States that the magnitude of the calculated ΔH is too small", ["too small"], err=["says it is too large"]),
              R("D2", "justification", "Justifies that the heat lost lowers the maximum temperature, so ΔT and q are smaller than the true values", ["lower ΔT"], requires="D1", err=["says the heat lost adds to the solution"])]),
        part("E", "The student repeats the experiment with twice the volume of each solution at the same concentrations. Predict the change in the temperature rise and justify your answer.", 1, "predict", ["2.B"], "The temperature rise is unchanged: the moles of water and the mass of the solution both double, so q/m stays the same.",
             [R("E1", "justification", "States that ΔT is unchanged and justifies that the heat released and the mass of the solution both double", ["unchanged", "both double"], err=["says ΔT doubles"])]),
    ]
    return _pack("chf_long_calorimetry", "long", "6.4", ["6.3", "6.9"], "5.F", "Coffee-cup calorimetry and Hess's law", stim, parts, 10, 23, [f"V={Vacid}", f"cm={cm}", f"Ti={Ti}", f"Tf={Tf:.1f}", f"q={q:.3f}", f"dHm={dHm:.4f}", f"d1={d1}", f"d2={d2}", f"dHt={dHt}"],
                 [_ev("A", "heat", q, 0.02 * abs(q), "J"), _ev("B", "dH", dHm, 0.5, "kJ/mol"), _ev("C", "Hess", dHt, 0.5, "kJ")],
                 ("Heat from a temperature change, molar enthalpy with a sign, Hess's law with scaled steps, and an error analysis", ["Compute q with the mass of the whole solution", "Convert to a molar enthalpy with the sign of an exothermic reaction", "Scale and add the given reactions"],
                  [("no heat is lost to the calorimeter in the calculation", "the stimulus")], {"type": "text", "must_include": ["volumes", "temperatures", "ΔH values"]},
                  "exact decimal products for q and ΔH; the Hess sum from exact integers"), ["law_selection", "justification", "representation_reading"])


# ======================= 짧은 문항: 질량 분석 (4) =======================
def chf_short_massspec(rng):
    name, Z, m1, m2, x1 = pick(rng, [("chlorine", 17, 34.97, 36.97, 75.8), ("copper", 29, 62.93, 64.93, 69.2), ("boron", 5, 10.01, 11.01, 19.9), ("gallium", 31, 68.93, 70.92, 60.1), ("bromine", 35, 78.92, 80.92, 50.7)])
    avg = (m1 * x1 + m2 * (100 - x1)) / 100
    agree(avg, float(sp.nsimplify(m1) * sp.nsimplify(x1) / 100 + sp.nsimplify(m2) * (100 - sp.nsimplify(x1)) / 100), 1e-9, "avg")
    n2 = round(m2) - Z
    stim = {"kind": "table", "description": f"Mass spectrum data for a sample of {name} (atomic number {Z})", "data": {"x_label": "Isotope", "columns": ["Isotope mass (u)", "Relative abundance (%)"], "y_label": "Relative abundance (%)", "rows": [[f"{m1:g}", f"{x1:g}"], [f"{m2:g}", f"{100 - x1:g}"]]}}
    parts = [
        part("A", f"Calculate the average atomic mass of {name} from the data.", 1, "calculate", ["3.C"], f"Average = ({m1:g})({x1 / 100:.3f}) + ({m2:g})({1 - x1 / 100:.3f}) = {avg:.2f} u.",
             [R("A1", "numeric", f"Calculates the weighted average (about {avg:.2f} u)", [f"{avg:.2f}"], nums=True, units=True, err=["averages the two masses without the abundances"])]),
        part("B", f"Determine the number of neutrons in an atom of the heavier isotope.", 1, "determine", ["1.A"], f"Mass number {round(m2)} minus {Z} protons gives {n2} neutrons.",
             [R("B1", "numeric", f"States {n2} neutrons (mass number {round(m2)} minus Z = {Z})", [f"{n2}"], nums=True, err=["gives the mass number as the number of neutrons"])]),
        part("C", "A second sample has a greater relative abundance of the heavier isotope. Predict whether its average atomic mass is greater or less than that of the first sample, and justify your answer.", 2, "predict", ["2.B", "6.E"], "Greater: the average is a weighted average, and increasing the weight of the heavier isotope moves it toward the larger mass.",
             [R("C1", "claim", "States that the average atomic mass is greater", ["greater"], err=["says it is less"]),
              R("C2", "justification", "Justifies with the weighted average: more weight on the heavier isotope moves the average toward its mass", ["weighted average", "heavier isotope"], requires="C1", err=["says the isotope masses change"])]),
    ]
    assert sum(p["points"] for p in parts) == 4
    return _pack("chf_short_massspec", "short", "1.2", ["1.1"], "1.A", "Mass spectrum, average atomic mass and neutrons", stim, parts, 4, 9, [f"name={name}", f"Z={Z}", f"m1={m1}", f"m2={m2}", f"x1={x1}", f"avg={avg:.4f}"], [_ev("A", "average mass", avg, 0.02, "u")],
                 ("Weighted average atomic mass, neutron count and a prediction about abundance", ["Weight each isotopic mass by its abundance", "Subtract the atomic number from the mass number", "Reason about the effect of a changed abundance"],
                  [("the abundances add to 100 percent", "the table of isotope data")], {"type": "text", "must_include": ["isotopic masses", "abundances"]}, "exact fractions for the weighted mean; the neutron count from the mass number"), ["representation_reading", "justification"])


# ======================= 짧은 문항: 기체 혼합물 (4) =======================
def chf_short_gas_mix(rng):
    for _ in forever():
        ga, gb, Ma, Mb = pick(rng, [("He", "N2", 4.00, 28.02), ("H2", "O2", 2.02, 32.00), ("CH4", "CO2", 16.04, 44.01), ("Ne", "Ar", 20.18, 39.95)])
        na = pick(rng, [0.50, 1.00, 1.50]); nb = pick(rng, [0.25, 0.75, 1.25]); V = pick(rng, [10.0, 20.0, 25.0]); Tc = pick(rng, [0, 27, 77])
        break
    T = Tc + 273.15; nt = na + nb; Pt = nt * R_ATM * T / V; Pb = Pt * nb / nt
    agree(Pt, bisect(lambda p: p * V - nt * R_ATM * T, 1e-9, 1e4), 1e-6, "Pt")
    stim = _stim(f"A rigid container of volume ${V:g}\\text{{ L}}$ holds ${na:g}\\text{{ mol}}$ of {cf(ga)}(g) and ${nb:g}\\text{{ mol}}$ of {cf(gb)}(g) at ${Tc}\\,^{{\\circ}}\\text{{C}}$. Assume ideal behavior. Molar masses: {cf(ga)} ${Ma:g}\\text{{ g/mol}}$, {cf(gb)} ${Mb:g}\\text{{ g/mol}}$.")
    parts = [
        part("A", "Calculate the total pressure, in atm, in the container.", 1, "calculate", ["5.B", "5.F"], f"P = nRT/V = ({nt:g})(0.08206)({T:.2f})/{V:g} = {Pt:.3f} atm.",
             [R("A1", "numeric", f"Calculates the total pressure (about {Pt:.3f} atm) using kelvins", [f"{Pt:.3f}"], nums=True, units=True, err=["uses the Celsius temperature"])]),
        part("B", f"Calculate the partial pressure of {cf(gb)}.", 1, "calculate", ["5.F"], f"P({gb}) = (n_b/n_total)P_total = ({nb:g}/{nt:g})({Pt:.3f}) = {Pb:.3f} atm.",
             [R("B1", "numeric", f"Multiplies the mole fraction of {gb} by the total pressure to calculate the partial pressure (about {Pb:.3f} atm)", [f"{Pb:.3f}"], nums=True, units=True, err=["uses the mole fraction of the other gas"])]),
        part("C", f"Which gas, {cf(ga)} or {cf(gb)}, has the greater average molecular speed at this temperature? Justify your answer.", 2, "justify", ["6.E", "6.B"], f"{ga} moves faster: at the same temperature the molecules have the same average kinetic energy, so the lighter molecules ({ga}) have the greater average speed.",
             [R("C1", "claim", f"Identifies {ga} (the gas of lower molar mass) as faster", [ga], err=["identifies the heavier gas"]),
              R("C2", "justification", "Justifies that the average kinetic energy depends only on temperature, so a smaller mass means a larger speed", ["same average kinetic energy", "smaller mass"], requires="C1", err=["says the heavier gas has more energy"])]),
    ]
    return _pack("chf_short_gas_mix", "short", "3.5", ["3.4", "3.6"], "5.F", "Gas mixture, partial pressure and molecular speed", stim, parts, 4, 9, [f"ga={ga}", f"gb={gb}", f"na={na}", f"nb={nb}", f"V={V}", f"Tc={Tc}", f"Pt={Pt:.4f}", f"Pb={Pb:.4f}"], [_ev("A", "total pressure", Pt, 0.02 * Pt, "atm"), _ev("B", "partial pressure", Pb, 0.02 * Pb, "atm")],
                 ("Ideal gas law for a mixture, a mole-fraction partial pressure and a kinetic-molecular-theory argument", ["Apply the ideal gas law to the total moles", "Apply Dalton's law with the mole fraction", "Reason about average kinetic energy and speed"],
                  [("the gases behave ideally", "the stimulus")], {"type": "text", "must_include": ["moles", "volume", "temperature"]}, "bisection on PV − nRT recomputes the pressure; the partial pressure from the mole fraction"), ["law_selection", "justification"])


# ======================= 짧은 문항: 용액 농도와 희석 (4) =======================
def chf_short_solution(rng):
    for _ in forever():
        f, M, ni = pick(rng, [("CaCl2", 110.98, 2), ("NaCl", 58.44, 1), ("K2SO4", 174.26, 2), ("MgCl2", 95.21, 2)])
        m = pick(rng, [5.55, 11.1, 22.2, 8.70]); V = pick(rng, [250.0, 500.0]); Vf = pick(rng, [2.0, 4.0, 5.0]) * V
        break
    n = m / M; c = n / (V / 1000); cf2 = c * V / Vf; Vadd = Vf - V
    agree(c, float(sp.nsimplify(m) / sp.nsimplify(M) / sp.nsimplify(V / 1000)), 1e-6, "c")
    ion = {"CaCl2": ("Cl⁻", 2), "NaCl": ("Cl⁻", 1), "K2SO4": ("K⁺", 2), "MgCl2": ("Cl⁻", 2)}[f]
    ci = c * ion[1]
    stim = _stim(f"A student dissolves ${m:g}\\text{{ g}}$ of {cf(f)} (molar mass ${M:g}\\text{{ g/mol}}$) in water to make ${V:g}\\text{{ mL}}$ of solution. The student then dilutes the solution with water to a final volume of ${Vf:g}\\text{{ mL}}$.")
    parts = [
        part("A", "Calculate the molarity of the original solution.", 1, "calculate", ["5.F"], f"n = {m:g}/{M:g} = {n:.4f} mol; M = {n:.4f}/{V / 1000:g} L = {c:.3f} M.",
             [R("A1", "numeric", f"Calculates the molarity (about {c:.3f} M) with the volume in liters", [f"{c:.3f}"], nums=True, units=True, err=["uses the volume in mL"])]),
        part("B", "Calculate the molarity of the diluted solution.", 1, "calculate", ["5.F"], f"M₁V₁ = M₂V₂ gives M₂ = ({c:.3f})({V:g})/{Vf:g} = {cf2:.4f} M.",
             [R("B1", "numeric", f"Uses M₁V₁ = M₂V₂ to calculate the diluted molarity (about {cf2:.4f} M)", [f"{cf2:.4f}"], nums=True, units=True, err=["divides by the volume of water added instead of the final volume"])]),
        part("C", f"Calculate the concentration of {ion[0]} ions in the original solution.", 1, "calculate", ["4.A"], f"Each formula unit gives {ion[1]} of these ions, so the concentration is {ion[1]} x {c:.3f} = {ci:.3f} M.",
             [R("C1", "numeric", f"Multiplies the molarity by {ion[1]} to calculate the ion concentration (about {ci:.3f} M)", [f"{ci:.3f}"], nums=True, units=True, err=["uses the molarity of the salt"])]),
        part("D", "Does the diluted solution conduct electricity better or worse than the original solution? Justify your answer.", 1, "justify", ["2.B"], "Worse: the concentration of the ions is lower, so there are fewer charge carriers per volume.",
             [R("D1", "justification", "States that the conductivity decreases and justifies with the lower concentration of ions (fewer charge carriers)", ["worse", "lower ion concentration"], err=["says the number of ions increases because there is more water"])]),
    ]
    return _pack("chf_short_solution", "short", "3.7", ["3.8", "3.13"], "5.F", "Molarity, dilution and ion concentration", stim, parts, 4, 9, [f"f={f}", f"m={m}", f"V={V}", f"Vf={Vf}", f"c={c:.5f}", f"cf={cf2:.5f}", f"ci={ci:.5f}"], [_ev("A", "molarity", c, 0.01 * c, "M"), _ev("B", "diluted molarity", cf2, 0.01 * cf2, "M")],
                 ("Molarity from a mass, dilution and ion concentration, with a conductivity argument", ["Convert the mass to moles and the volume to liters", "Apply the dilution relation", "Use the formula's subscripts for an ion concentration"],
                  [("the volumes are additive", "the stimulus gives the final volume")], {"type": "text", "must_include": ["mass", "volumes"]}, "exact fractions for molarity; the dilution relation recomputed through moles"), ["law_selection", "justification"])


# ======================= 짧은 문항: 강산·강염기 중화 (4) =======================
def chf_short_neutral(rng):
    for _ in forever():
        ca = pick(rng, [0.010, 0.020, 0.050]); cb = pick(rng, [0.0050, 0.010, 0.025]); Va = pick(rng, [25.0, 50.0]); nOH = pick(rng, [1, 2])
        break
    pHa = -math.log10(ca); pHb = 14 + math.log10(nOH * cb)
    Veq = ca * Va / (nOH * cb)
    agree(pHb, 14 - (-math.log10(nOH * cb)), 1e-9, "pHb"); agree(Veq, bisect(lambda v: nOH * cb * v - ca * Va, 0.0, 1e5), 1e-6, "Veq")
    base = "Ba(OH)₂" if nOH == 2 else "NaOH"
    stim = _stim(f"A student has a ${ca:g}\\text{{ M}}$ solution of the strong acid HNO₃ and a ${cb:g}\\text{{ M}}$ solution of the strong base {base}. Both are at 25 °C.")
    parts = [
        part("A", "Calculate the pH of the HNO₃ solution.", 1, "calculate", ["5.F"], f"pH = −log({ca:g}) = {pHa:.2f}.",
             [R("A1", "numeric", f"Calculates pH = {pHa:.2f}", [f"{pHa:.2f}"], nums=True, err=["gives the pOH"])]),
        part("B", f"Calculate the pH of the {base} solution.", 1, "calculate", ["5.F"], f"[OH⁻] = {nOH} x {cb:g} = {nOH * cb:g} M, pOH = {-math.log10(nOH * cb):.2f}, pH = {pHb:.2f}.",
             [R("B1", "numeric", f"Calculates [OH⁻] = {nOH * cb:g} M and pH = {pHb:.2f}", [f"{pHb:.2f}"], nums=True, err=["ignores the number of hydroxide ions per formula unit" if nOH == 2 else "reports the pOH as the pH"])]),
        part("C", f"Calculate the volume of the base solution, in mL, needed to neutralize ${Va:g}\\text{{ mL}}$ of the acid solution.", 1, "calculate", ["5.F"], f"n(H⁺) = {ca * Va / 1000:.5f} mol and each mole of {base} gives {nOH} mol OH⁻, so V = {Veq:.1f} mL.",
             [R("C1", "numeric", f"Equates moles of H⁺ and OH⁻ to find the volume (about {Veq:.1f} mL)", [f"{Veq:.1f}"], nums=True, units=True, err=["omits the factor for the number of hydroxide ions" if nOH == 2 else "uses the wrong volume"])]),
        part("D", "What is the pH of the solution at the equivalence point? Justify your answer.", 1, "justify", ["4.A", "6.D"], "The pH is 7: the ions that remain (a cation of a strong base and the nitrate ion) do not react with water, so the solution is neutral.",
             [R("D1", "justification", "States pH = 7 and justifies that neither remaining ion is a conjugate of a weak acid or base, so none reacts with water", ["pH 7", "spectator ions"], err=["says the pH is below 7 because an acid was used"])]),
    ]
    return _pack("chf_short_neutral", "short", "8.2", ["8.1", "4.3"], "5.F", "pH of strong acids and bases, and neutralization", stim, parts, 4, 9, [f"ca={ca}", f"cb={cb}", f"Va={Va}", f"nOH={nOH}", f"pHa={pHa:.4f}", f"pHb={pHb:.4f}", f"Veq={Veq:.3f}"], [_ev("A", "pH acid", pHa, 0.03), _ev("B", "pH base", pHb, 0.03), _ev("C", "equivalence volume", Veq, 0.2, "mL")],
                 ("pH of a strong acid and of a strong base with two hydroxide ions, a neutralization volume and the equivalence-point pH", ["Use −log of the concentration for a strong acid", "Count the hydroxide ions per formula unit", "Equate the moles of acid and base"],
                  [("the acid and the base are both strong", "the stimulus")], {"type": "text", "must_include": ["concentrations", "volume"]}, "pH from exact logs; the equivalence volume by root solving the mole balance"), ["law_selection", "justification"])


STAGE_FRQ3 = ["chf_long_buffer", "chf_long_ksp", "chf_long_calorimetry", "chf_short_massspec", "chf_short_gas_mix", "chf_short_solution", "chf_short_neutral"]
