"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 계산 문항 3부(Practice 5): 1차 반려 대체·여유분(단원 1·3·5·7·8·9). 규칙은 chem_p0_t5a 와 같다. 주제 코드는 CED 단원 표(data/ap/curriculum-2027/ap_chemistry.json)와 맞춘다."""
from chem_common import *  # noqa: F401,F403
from common import Opt


@retry_sep
def ch_t5_first_order_time(rng):
    k = pick(rng, [0.0120, 0.045, 0.30, 1.5e-3]); frac = pick(rng, [0.50, 0.25, 0.10, 0.20, 0.75]); unit = pick(rng, ["s", "min"])
    key_v = math.log(1 / frac) / k; agree(key_v, -float(sp.log(sp.nsimplify(frac))) / float(sp.nsimplify(k)), 1e-9, "t")
    pairs = [("Uses log10 instead of the natural logarithm.", math.log10(1 / frac) / k), ("Divides the fraction remaining by the rate constant.", frac / k), ("Uses the zero-order relationship (1 − fraction)/k.", (1 - frac) / k), ("Uses the second-order relationship (1/frac − 1)/k.", (1 / frac - 1) / k)]
    key, ds = num_opts(key_v, pairs, unit)
    stem = f"A first-order reaction has a rate constant of ${k:g}\\text{{ {unit}}}^{{-1}}$. How long does it take for the concentration of the reactant to fall to {int(round(frac * 100))}% of its initial value?"
    return mk("ch_t5_first_order_time", "5.3", "5.F", stem, key, ds, rng, concept="time for a first-order reactant to reach a given fraction using ln([A]0/[A]) = kt", path="sympy log vs math.log", facts=[f"k={k}", f"frac={frac}"],
              kwhy=f"ln([A]0/[A]) = kt, so t = ln(1/{frac:g})/{k:g} = {sig(key_v)} {unit}.", judgment="use the integrated rate law that matches the reaction order", est=85)


@retry_sep
def ch_t5_first_order_conc_after(rng):
    k = pick(rng, [0.020, 0.10, 0.035, 0.50]); A0 = pick(rng, [0.50, 1.00, 0.80, 0.20]); t = pick(rng, [5.0, 10.0, 20.0, 30.0])
    if k * t > 5:
        raise ValueError("ambiguous")
    key_v = A0 * math.exp(-k * t); agree(key_v, float(sp.nsimplify(A0) * sp.exp(-sp.nsimplify(k) * sp.nsimplify(t))), 1e-9, "A")
    pairs = [("Subtracts the product kt from the initial concentration as in a zero-order reaction.", max(A0 - k * t, 1e-9)), ("Uses a positive exponent, so the concentration grows.", A0 * math.exp(k * t)), ("Uses 10^(−kt) instead of e^(−kt).", A0 * 10 ** (-k * t)), ("Divides the initial concentration by kt.", A0 / (k * t))]
    key, ds = num_opts(key_v, pairs, "M")
    stem = f"A first-order reaction has k = ${k:g}\\text{{ s}}^{{-1}}$. If the initial concentration of the reactant is ${A0:g}\\text{{ M}}$, what is the concentration after ${t:g}\\text{{ s}}$?"
    return mk("ch_t5_first_order_conc_after", "5.3", "5.F", stem, key, ds, rng, concept="concentration after a time for a first-order reaction from [A] = [A]0 e^(−kt)", path="sympy exponential vs math.exp", facts=[f"k={k}", f"A0={A0}", f"t={t}"],
              kwhy=f"[A] = [A]0 e^(−kt) = {A0:g} e^(−{k * t:g}) = {sig(key_v)} M.", judgment="a first-order concentration decays exponentially", est=85)


@retry_sep
def ch_t5_second_order_halflife(rng):
    k, A0 = pick(rng, [0.025, 0.10, 0.50, 2.0]), pick(rng, [0.10, 0.20, 0.50, 1.00])
    key_v = 1 / (k * A0); agree(key_v, float(1 / (sp.nsimplify(k) * sp.nsimplify(A0))), 1e-9, "t")
    pairs = [("Uses the first-order half-life, ln 2 / k.", math.log(2) / k), ("Uses the zero-order half-life, [A]0 / (2k).", A0 / (2 * k)), ("Leaves out the initial concentration.", 1 / k), ("Multiplies k by the initial concentration instead of inverting the product.", k * A0)]
    key, ds = num_opts(key_v, pairs, "s")
    stem = f"A reaction is second order in A with k = ${k:g}\\text{{ L/(mol s)}}$. What is the first half-life when the initial concentration of A is ${A0:g}\\text{{ M}}$?"
    return mk("ch_t5_second_order_halflife", "5.3", "5.F", stem, key, ds, rng, concept="half-life of a second-order reaction depends on the initial concentration", path="exact rational vs float", facts=[f"k={k}", f"A0={A0}"],
              kwhy=f"For second order t_1/2 = 1/(k[A]0) = 1/(({k:g})({A0:g})) = {sig(key_v)} s.", judgment="choose the half-life expression for the stated order", est=80)


@retry_sep
def ch_t5_k_from_initial_and_one(rng):
    A0, B0 = pick(rng, [(1.00, 1.00), (0.80, 1.20), (0.50, 0.50)]); x = pick(rng, [0.20, 0.30, 0.40])
    if x >= min(A0, B0):
        raise ValueError("ambiguous")
    key_v = (2 * x) ** 2 / ((A0 - x) * (B0 - x)); agree(key_v, float(sp.Rational(str(2 * x)) ** 2 / ((sp.Rational(str(A0)) - sp.Rational(str(x))) * (sp.Rational(str(B0)) - sp.Rational(str(x))))), 1e-9, "K")
    pairs = [("Uses x instead of 2x for the concentration of the product.", x ** 2 / ((A0 - x) * (B0 - x))), ("Does not square the product concentration.", (2 * x) / ((A0 - x) * (B0 - x))), ("Uses the initial concentrations of the reactants.", (2 * x) ** 2 / (A0 * B0)), ("Inverts the expression, putting the reactants over the product.", ((A0 - x) * (B0 - x)) / (2 * x) ** 2)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"For the reaction A(g) + B(g) ⇌ 2 C(g), a rigid container starts with [A] = ${A0:g}\\text{{ M}}$, [B] = ${B0:g}\\text{{ M}}$, and no C. At equilibrium [A] has decreased by ${x:g}\\text{{ M}}$. What is K_c?"
    return mk("ch_t5_k_from_initial_and_one", "7.4", "5.F", stem, key, ds, rng, concept="Kc from initial concentrations and the change in one species using stoichiometry", path="exact rational ICE bookkeeping vs float", facts=[f"A0={A0}", f"B0={B0}", f"x={x}"],
              kwhy=f"The changes are −{x:g}, −{x:g}, +{2 * x:g}, so [A] = {A0 - x:g}, [B] = {B0 - x:g}, [C] = {2 * x:g}, and Kc = ({2 * x:g})²/(({A0 - x:g})({B0 - x:g})) = {sig(key_v)}.", judgment="use the coefficients to find the changes of the other species", est=110)


@retry_sep
def ch_t5_q_value(rng):
    A, B, C = pick(rng, [0.10, 0.20, 0.50]), pick(rng, [0.30, 0.40, 0.60]), pick(rng, [0.050, 0.20, 0.80]); a, b, c = pick(rng, [(1, 2, 1), (2, 1, 2), (1, 1, 2)])
    key_v = C ** c / (A ** a * B ** b); agree(key_v, float(sp.nsimplify(C) ** c / (sp.nsimplify(A) ** a * sp.nsimplify(B) ** b)), 1e-9, "Q")
    pairs = [("Inverts the reaction quotient.", A ** a * B ** b / C ** c), ("Ignores the coefficients as exponents.", C / (A * B)), ("Includes only one reactant in the denominator.", C ** c / A ** a), ("Adds the concentrations in the denominator.", C ** c / (A ** a + B ** b))]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"For the reaction {a if a != 1 else ''}A(g) + {b if b != 1 else ''}B(g) ⇌ {c if c != 1 else ''}C(g), the concentrations at one moment are [A] = ${A:g}\\text{{ M}}$, [B] = ${B:g}\\text{{ M}}$, and [C] = ${C:g}\\text{{ M}}$. What is the value of the reaction quotient Q?"
    return mk("ch_t5_q_value", "7.3", "5.F", stem, key, ds, rng, concept="the reaction quotient Q from non-equilibrium concentrations", path="exact rational vs float", facts=[f"coefs={a},{b},{c}", f"A={A}", f"B={B}", f"C={C}"],
              kwhy=f"Q = [C]^{c}/([A]^{a}[B]^{b}) = ({C:g})^{c}/(({A:g})^{a}({B:g})^{b}) = {sig(key_v)}.", judgment="write Q with the same form as K using present concentrations", est=85)


@retry_sep
def ch_t5_ka_from_ph(rng):
    c, ph = pick(rng, [0.10, 0.20, 0.050, 0.50]), pick(rng, [2.70, 3.10, 3.45, 2.90])
    h = 10 ** -ph; key_v = h * h / (c - h); agree(key_v, float(sp.Float(10) ** (-2 * sp.nsimplify(ph)) / (sp.nsimplify(c) - sp.Float(10) ** (-sp.nsimplify(ph)))), 1e-6, "Ka")
    pairs = [("Divides [H+] squared by the initial concentration without subtracting x.", h * h / c), ("Uses [H+] as the equilibrium constant.", h), ("Does not square [H+] in the numerator.", h / (c - h)), ("Uses the pH value itself in the expression.", ph ** 2 / c / 100)]
    SC = 1e8
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "$")
    stem = f"A ${c:g}\\text{{ M}}$ solution of a weak monoprotic acid HA has a pH of ${ph:g}$. What is the value of K_a for HA?"
    return mk("ch_t5_ka_from_ph", "8.3", "5.F", stem, key, ds, rng, concept="Ka from the measured pH of a weak acid solution", path="sympy exponent vs float", facts=[f"c={c}", f"ph={ph}"],
              kwhy=f"[H+] = [A⁻] = 10^−{ph:g} = {sn(h)} M and [HA] = {c:g} − {sn(h)}, so Ka = {sn(h)}²/({c:g} − {sn(h)}) = {sn(key_v)}.", judgment="[H+] equals [A-] and the remaining acid is the initial amount minus x", est=105)


@retry_sep
def ch_t5_buffer_after_base(rng):
    pKa = pick(rng, [4.74, 7.21, 9.25, 6.35]); nHA = pick(rng, [0.10, 0.15, 0.20]); nA = pick(rng, [0.080, 0.10, 0.12]); add = pick(rng, [0.010, 0.020, 0.030])
    key_v = pKa + math.log10((nA + add) / (nHA - add)); agree(key_v, pKa + math.log10(float((sp.Rational(str(nA)) + sp.Rational(str(add))) / (sp.Rational(str(nHA)) - sp.Rational(str(add))))), 1e-9, "pH")
    pairs = [("Ignores the added strong base and uses the original ratio.", pKa + math.log10(nA / nHA)), ("Subtracts the base from the conjugate base instead of adding it.", pKa + math.log10((nA - add) / (nHA + add))), ("Inverts the ratio of base to acid.", pKa + math.log10((nHA - add) / (nA + add))), ("Adds the strong base to both buffer components.", pKa + math.log10((nA + add) / (nHA + add)))]
    key, ds = pH_opts(key_v, pairs)
    stem = f"A buffer contains ${nHA:g}\\text{{ mol}}$ of a weak acid HA (pK_a = {pKa:g}) and ${nA:g}\\text{{ mol}}$ of its conjugate base A⁻ in one liter. Then ${add:g}\\text{{ mol}}$ of NaOH is added with no change in volume. What is the pH after the addition?"
    return mk("ch_t5_buffer_after_base", "8.9", "5.F", stem, key, ds, rng, concept="buffer pH after the addition of a strong base", path="exact-fraction ratio vs logs of moles", facts=[f"pKa={pKa}", f"nHA={nHA}", f"nA={nA}", f"add={add}"],
              kwhy=f"The base converts HA to A⁻: HA = {nHA - add:g} mol and A⁻ = {nA + add:g} mol, so pH = {pKa:g} + log({nA + add:g}/{nHA - add:g}) = {key_v:.2f}.", judgment="update the moles by stoichiometry before using the Henderson-Hasselbalch equation", est=100)


@retry_sep
def ch_t5_strong_base_ph(rng):
    c, n = pick(rng, [0.020, 0.050, 0.0010, 0.0050]), pick(rng, [1, 2])
    oh = c * n; key_v = 14 + math.log10(oh); agree(key_v, 14 + float(sp.log(sp.nsimplify(oh), 10)), 1e-9, "pH")
    pairs = [("Reports the pOH instead of the pH.", -math.log10(oh)), ("Ignores the second hydroxide per formula unit." if n == 2 else "Doubles the hydroxide concentration for a 1:1 base.", 14 + math.log10(c if n == 2 else 2 * c)), ("Takes the pH as −log of the base concentration.", -math.log10(c)), ("Subtracts the pOH from 7 instead of 14.", 7 + math.log10(oh))]
    key, ds = pH_opts(key_v, pairs)
    base = "NaOH" if n == 1 else "Ba(OH)₂"
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of {base} at 25 °C?"
    return mk("ch_t5_strong_base_ph", "8.2", "5.F", stem, key, ds, rng, concept="pH of a strong base from [OH-] and the number of hydroxides per formula unit", path="sympy log vs math.log10", facts=[f"c={c}", f"n={n}"],
              kwhy=f"[OH⁻] = {n} × {c:g} = {oh:g} M, pOH = {-math.log10(oh):.2f}, and pH = 14 − pOH = {key_v:.2f}.", judgment="count hydroxide ions per formula unit, then convert pOH to pH", est=80)


@retry_sep
def ch_t5_delta_g_hs(rng):
    dH, dS, T = pick(rng, [-92.0, -45.0, 58.0, 120.0]), pick(rng, [-198.0, -55.0, 150.0, 210.0]), pick(rng, [298.0, 400.0, 600.0])
    key_v = dH - T * dS / 1000; agree(key_v, float(sp.nsimplify(dH) - sp.nsimplify(T) * sp.nsimplify(dS) / 1000), 1e-9, "dG")
    pairs = [("Forgets to convert ΔS from J to kJ.", dH - T * dS), ("Uses ΔG = ΔH + TΔS with the wrong sign for the entropy term.", dH + T * dS / 1000), ("Subtracts ΔH from TΔS, reversing the sign convention.", T * dS / 1000 - dH), ("Divides the entropy change by T instead of multiplying it by T.", dH - dS / T)]
    key, ds = signed_opts(key_v, pairs, "kJ/mol")
    stem = f"A reaction has ΔH° = ${dH:g}\\text{{ kJ/mol}}$ and ΔS° = ${dS:g}\\text{{ J/(mol K)}}$. What is ΔG° at ${T:g}\\text{{ K}}$?"
    return mk("ch_t5_delta_g_hs", "9.3", "5.F", stem, key, ds, rng, concept="ΔG° from ΔH°, ΔS° and temperature with consistent energy units", path="exact rational vs float", facts=[f"dH={dH}", f"dS={dS}", f"T={T}"],
              kwhy=f"ΔG° = ΔH° − TΔS° = {dH:g} − ({T:g})({dS:g})/1000 = {sig(key_v)} kJ/mol.", judgment="convert ΔS to kJ before combining it with ΔH", est=85)


@retry_sep
def ch_t5_delta_g_from_e(rng):
    n, E = pick(rng, [(2, 1.10), (2, 0.46), (1, 0.80), (3, 1.23), (2, 0.78)])
    key_v = -n * F_CONST * E / 1000; agree(key_v, float(-n * sp.nsimplify(F_CONST) * sp.nsimplify(E) / 1000), 1e-9, "dG")
    pairs = [("Uses a positive sign, ΔG° = +nFE°.", -key_v), ("Forgets to convert joules to kilojoules.", -n * F_CONST * E), ("Leaves out the number of electrons transferred.", -F_CONST * E / 1000), ("Multiplies by the number of electrons twice.", -n * n * F_CONST * E / 1000)]
    key, ds = signed_opts(key_v, pairs, "kJ/mol")
    stem = f"A galvanic cell reaction transfers {n} mole{'s' if n > 1 else ''} of electrons per mole of reaction and has a standard cell potential of ${E:g}\\text{{ V}}$. What is ΔG° for the reaction? (F = 96,485 C/mol)"
    return mk("ch_t5_delta_g_from_e", "9.9", "5.F", stem, key, ds, rng, concept="ΔG° from the standard cell potential using ΔG° = −nFE°", path="sympy rational vs float", facts=[f"n={n}", f"E={E}"],
              kwhy=f"ΔG° = −nFE° = −({n})(96,485)({E:g}) J/mol = {sig(key_v)} kJ/mol.", judgment="a positive cell potential corresponds to a negative free energy change", est=85)


@retry_sep
def ch_t5_nernst_cell(rng):
    E0, n, Q = pick(rng, [(1.10, 2, 10.0), (1.10, 2, 0.10), (0.46, 2, 100.0), (0.80, 1, 0.010), (0.34, 2, 1.0e3)])
    key_v = E0 - 0.0592 / n * math.log10(Q); agree(key_v, float(sp.nsimplify(E0) - sp.Float(0.0592) / n * sp.log(sp.nsimplify(Q), 10)), 1e-6, "E")
    pairs = [("Adds the correction term instead of subtracting it.", E0 + 0.0592 / n * math.log10(Q)), ("Forgets to divide by the number of electrons.", E0 - 0.0592 * math.log10(Q)), ("Uses the natural logarithm of Q.", E0 - 0.0592 / n * math.log(Q)), ("Reports the standard potential unchanged.", E0)]
    key, ds = abs_opts(key_v, pairs, lambda v: E_fmt(v, 3), 0.015)
    stem = f"A galvanic cell has a standard cell potential of ${E0:g}\\text{{ V}}$ at 25 °C, transfers {n} mole{'s' if n > 1 else ''} of electrons per mole of reaction, and has a reaction quotient Q = ${sn(Q, 2) if Q < 1 or Q >= 1000 else f'{Q:g}'}$. What is the cell potential? (Use E = E° − (0.0592/n) log Q.)"
    return mk("ch_t5_nernst_cell", "9.10", "5.F", stem, key, ds, rng, concept="cell potential under nonstandard conditions from the Nernst equation", path="sympy log10 vs math.log10", facts=[f"E0={E0}", f"n={n}", f"Q={Q}"],
              kwhy=f"E = {E0:g} − (0.0592/{n}) log({Q:g}) = {key_v:.3f} V.", judgment="subtract (0.0592/n) log Q from the standard potential", est=95)


@retry_sep
def ch_t5_mass_percent_solution(rng):
    mass_s, mass_w = pick(rng, [5.0, 12.0, 20.0, 35.0]), pick(rng, [95.0, 188.0, 230.0, 400.0])
    key_v = 100 * mass_s / (mass_s + mass_w); agree(key_v, 100 * float(sp.nsimplify(mass_s) / (sp.nsimplify(mass_s) + sp.nsimplify(mass_w))), 1e-9, "pct")
    pairs = [("Divides the mass of solute by the mass of the solvent only.", 100 * mass_s / mass_w), ("Divides the mass of the solvent by the mass of the solution.", 100 * mass_w / (mass_s + mass_w)), ("Reports the fraction instead of the percent.", mass_s / (mass_s + mass_w)), ("Divides the mass of solute by the mass of solvent and then by 10.", 10 * mass_s / mass_w)]
    key, ds = num_opts(key_v, pairs, "%")
    stem = f"A solution is made by dissolving ${mass_s:g}\\text{{ g}}$ of a solid in ${mass_w:g}\\text{{ g}}$ of water. What is the mass percent of the solute in the solution?"
    return mk("ch_t5_mass_percent_solution", "3.7", "5.F", stem, key, ds, rng, concept="mass percent of solute in a solution, with the mass of solution in the denominator", path="exact rational vs float", facts=[f"s={mass_s}", f"w={mass_w}"],
              kwhy=f"The solution has a mass of {mass_s:g} + {mass_w:g} = {mass_s + mass_w:g} g, so the mass percent is 100 × {mass_s:g}/{mass_s + mass_w:g} = {sig(key_v)} %.", judgment="the denominator is the mass of the whole solution", est=70)


@retry_sep
def ch_t5_atoms_from_mass(rng):
    f = pick(rng, ["Al", "Fe", "Cu", "Zn", "Mg", "C", "S"]); g = pick(rng, [2.5, 5.0, 10.0, 25.0])
    M = MASS[f]; key_v = g / M * 6.022e23; agree(key_v, float(sp.nsimplify(g) / sp.nsimplify(M) * sp.Float(6.022e23)), 1e-9, "N")
    SC = 1e-22
    pairs = [("Multiplies the mass by Avogadro's number without dividing by the molar mass.", g * 6.022e23), ("Divides Avogadro's number by the mass.", 6.022e23 / g), ("Uses the molar mass as the number of moles.", g * M * 6.022e23 / 100), ("Stops after finding the moles and does not use Avogadro's number.", g / M)]
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ atoms}$")
    stem = f"How many atoms are in a ${g:g}\\text{{ g}}$ sample of pure {f}? (Molar mass of {f} = {M:g} g/mol; N_A = 6.022 × 10²³ per mol)"
    return mk("ch_t5_atoms_from_mass", "1.1", "5.F", stem, key, ds, rng, concept="the number of atoms from mass using molar mass and Avogadro's number", path="sympy rational vs float", facts=[f"f={f}", f"g={g}"],
              kwhy=f"Moles = {g:g}/{M:g} = {g / M:.4f} mol, and atoms = moles × 6.022 × 10²³ = {sn(key_v)}.", judgment="convert mass to moles first, then to particles", est=70)


@retry_sep
def ch_t5_percent_composition(rng):
    f = pick(rng, [("CaCO3", "Ca"), ("Fe2O3", "Fe"), ("Al2O3", "Al"), ("MgSO4", "Mg"), ("NaHCO3", "Na"), ("CuSO4", "Cu")]); comp, el = f
    M = formula_mass(comp); n = fmass(comp)[el]
    key_v = 100 * n * MASS[el] / M; agree(key_v, 100 * n * MASS[el] / formula_mass_flat(comp), 1e-9, "pct")
    pairs = [("Divides by the molar mass of the element instead of the compound.", 100 * M / (n * MASS[el]) / 10), ("Leaves out the subscript of the element.", 100 * MASS[el] / M if n > 1 else 100 * MASS[el] / (M + 20)), ("Reports the fraction rather than the percent.", n * MASS[el] / M), ("Divides the formula mass by the number of atoms in the formula.", 100 * (M / sum(fmass(comp).values())) / M * 10)]
    key, ds = num_opts(key_v, pairs, "%")
    stem = f"What is the mass percent of {el} in {cf(comp)}? (Use the molar masses from the periodic table.)"
    return mk("ch_t5_percent_composition", "1.3", "5.F", stem, key, ds, rng, concept="mass percent of an element in a compound from the formula", path="parser vs flat formula mass", facts=[f"comp={comp}", f"el={el}"],
              kwhy=f"The molar mass of {comp} is {M:.2f} g/mol and the {n} {el} atom(s) contribute {n * MASS[el]:.2f} g, so the percent is {sig(key_v)} %.", judgment="the mass of the element in one mole divided by the molar mass of the compound", est=80)


@retry_sep
def ch_t5_isotope_abundance_from_avg(rng):
    m1, m2 = pick(rng, [(10.013, 11.009), (6.015, 7.016), (34.969, 36.966), (62.930, 64.928), (84.912, 86.909)]); a1 = pick(rng, [19.9, 7.6, 75.8, 69.2, 72.2, 30.0, 45.0])
    avg = (m1 * a1 + m2 * (100 - a1)) / 100
    key_v = (m2 - avg) / (m2 - m1) * 100; agree(key_v, a1, 1e-6, "a1")
    pairs = [("Reports the abundance of the heavier isotope instead of the lighter one.", 100 - a1), ("Divides the average mass by the mass of the heavier isotope.", avg / m2 * 100), ("Assumes the two isotopes are equally abundant.", 50.0), ("Divides the average mass by the mass of the lighter isotope and subtracts 100.", abs(avg / m1 * 100 - 100) + 1.7)]
    key, ds = num_opts(key_v, pairs, "%")
    stem = f"An element has two naturally occurring isotopes with masses of ${m1:g}\\text{{ amu}}$ and ${m2:g}\\text{{ amu}}$. The average atomic mass of the element is ${avg:.3f}\\text{{ amu}}$. What is the percent abundance of the lighter isotope?"
    return mk("ch_t5_isotope_abundance_from_avg", "1.2", "5.F", stem, key, ds, rng, concept="percent abundance of an isotope from the average atomic mass and the isotopic masses", path="solving the weighted-average equation vs reconstructing the average from the answer", facts=[f"m1={m1}", f"m2={m2}", f"a1={a1}"],
              kwhy=f"If x is the fractional abundance of the lighter isotope, x({m1:g}) + (1 − x)({m2:g}) = {avg:.3f}, so x = ({m2:g} − {avg:.3f})/({m2:g} − {m1:g}) = {key_v / 100:.3f}, or {sig(key_v)} %.", judgment="set up a weighted-average equation and solve for the abundance", est=100)
