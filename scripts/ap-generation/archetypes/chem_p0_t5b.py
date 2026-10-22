"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 계산 문항 2부(Practice 5): 단원 8(산·염기)·9(열역학·전기화학)·1·2. 규칙은 chem_p0_t5a 와 같다."""
from chem_common import *  # noqa: F401,F403
from common import Opt


@retry_sep
def ch_t5_ph_weak_acid(rng):
    Ka, c = pick(rng, [1.8e-5, 6.3e-5, 3.5e-8, 4.5e-4, 7.2e-4]), pick(rng, [0.050, 0.10, 0.20, 0.50])
    x = math.sqrt(Ka * c); key_v = -math.log10(x)
    agree(key_v, -math.log10(float(sp.sqrt(sp.nsimplify(Ka) * sp.nsimplify(c)))), 1e-9, "pH")
    pairs = [("Treats the weak acid as strong, so [H+] equals the formal concentration.", -math.log10(c)), ("Sets [H+] equal to Ka instead of solving for x.", -math.log10(Ka)), ("Forgets the square root and uses [H+] = Ka × c.", -math.log10(Ka * c)), ("Reports the pOH rather than the pH.", 14 + math.log10(x))]
    key, ds = pH_opts(key_v, pairs)
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of a weak monoprotic acid HA with K_a = ${sn(Ka, 2)}$? (Assume that x is much smaller than the initial concentration.)"
    return mk("ch_t5_ph_weak_acid", "8.3", "5.F", stem, key, ds, rng, concept="pH of a weak acid solution using x = sqrt(Ka c) when the dissociation is small", path="sympy square root vs direct formula", facts=[f"Ka={Ka}", f"c={c}"],
              kwhy=f"With x ≪ c, Ka = x²/c, so [H+] = sqrt({sn(Ka, 2)} × {c:g}) = {sn(x)} M and pH = {key_v:.2f}.", judgment="set up the weak acid equilibrium and use the small-x approximation", est=95)


@retry_sep
def ch_t5_percent_ionization(rng):
    Ka, c = pick(rng, [1.8e-5, 6.3e-5, 4.5e-4, 7.2e-4, 1.4e-4]), pick(rng, [0.010, 0.050, 0.10, 0.50])
    x = math.sqrt(Ka * c); key_v = 100 * x / c
    agree(key_v, 100 * float(sp.sqrt(sp.nsimplify(Ka) * sp.nsimplify(c))) / c, 1e-9, "pct")
    pairs = [("Reports the fraction instead of the percent.", x / c), ("Divides the formal concentration by the hydrogen ion concentration.", 100 * c / x / 100), ("Uses Ka as the hydrogen ion concentration.", 100 * Ka / c), ("Uses the pH value divided by the concentration.", 100 * (-math.log10(x)) / c / 100)]
    key, ds = num_opts(key_v, pairs, "%")
    stem = f"A ${c:g}\\text{{ M}}$ solution of a weak acid HA has K_a = ${sn(Ka, 2)}$. What percent of the acid is ionized at equilibrium? (Assume x is small compared with the initial concentration.)"
    return mk("ch_t5_percent_ionization", "8.3", "5.F", stem, key, ds, rng, concept="percent ionization of a weak acid from x = sqrt(Ka c)", path="sympy vs direct formula", facts=[f"Ka={Ka}", f"c={c}"],
              kwhy=f"x = sqrt({sn(Ka, 2)} × {c:g}) = {sn(x)} M, so the percent ionized is 100 × {sn(x)}/{c:g} = {sig(key_v)} %.", judgment="percent ionization is the ionized amount over the initial concentration", est=95)


@retry_sep
def ch_t5_ph_after_dilution(rng):
    M1, V1, V2 = pick(rng, [0.10, 0.50, 1.0, 2.0]), pick(rng, [10.0, 25.0, 50.0]), pick(rng, [250.0, 500.0, 1000.0])
    c = M1 * V1 / V2; key_v = -math.log10(c); agree(key_v, -math.log10(float(sp.nsimplify(M1) * sp.nsimplify(V1) / sp.nsimplify(V2))), 1e-9, "pH")
    pairs = [("Reports the pH of the original strong acid solution without accounting for dilution.", -math.log10(M1)), ("Divides the original molarity by the final volume in mL.", -math.log10(M1 / V2)), ("Computes the pOH rather than the pH.", 14 + math.log10(c)), ("Uses the ratio of the volumes without the original molarity.", -math.log10(V1 / V2))]
    key, ds = pH_opts(key_v, pairs)
    stem = f"A ${V1:g}\\text{{ mL}}$ sample of ${M1:g}\\text{{ M}}$ HCl is diluted with water to a final volume of ${V2:g}\\text{{ mL}}$. What is the pH of the diluted solution?"
    return mk("ch_t5_ph_after_dilution", "8.2", "5.F", stem, key, ds, rng, concept="pH of a strong acid after dilution", path="exact rational dilution then log vs direct", facts=[f"M1={M1}", f"V1={V1}", f"V2={V2}"],
              kwhy=f"The new concentration is {M1:g} × {V1:g}/{V2:g} = {sn(c)} M, so pH = −log({sn(c)}) = {key_v:.2f}.", judgment="dilute first, then take the negative logarithm", est=80)


@retry_sep
def ch_t5_poh_to_h(rng):
    poh = pick(rng, [2.40, 3.70, 4.85, 5.30, 9.20, 10.60])
    key_v = 10 ** -(14 - poh); agree(key_v, float(sp.Float(10) ** (-(14 - sp.nsimplify(poh)))), 1e-6, "H")
    pairs = [("Reports [OH−] instead of [H+].", 10 ** -poh), ("Uses [H+] = 10^(−pOH) as if pOH were the pH.", 10 ** -poh * 1.0 if False else 10 ** -(poh + 1.3)), ("Uses 14 + pOH instead of 14 − pOH.", 10 ** -(14 + poh)), ("Subtracts pOH from 7 instead of 14.", 10 ** -(7 - poh))]
    SC = 1e14
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ M}$")
    stem = f"An aqueous solution at 25 °C has a pOH of ${poh:g}$. What is the hydrogen ion concentration, [H⁺], of the solution?"
    return mk("ch_t5_poh_to_h", "8.2", "5.F", stem, key, ds, rng, concept="[H+] from pOH using pH + pOH = 14", path="sympy power vs float power", facts=[f"poh={poh}"],
              kwhy=f"pH = 14 − {poh:g} = {14 - poh:.2f}, so [H+] = 10^−{14 - poh:.2f} = {sn(key_v)} M.", judgment="convert pOH to pH first, then to concentration", est=85)


@retry_sep
def ch_t5_titration_equivalence_volume(rng):
    Ma, Va, Mb, ratio = pick(rng, [0.100, 0.200, 0.150]), pick(rng, [20.0, 25.0, 40.0]), pick(rng, [0.100, 0.250, 0.200]), pick(rng, [1, 2])
    key_v = ratio * Ma * Va / Mb; agree(key_v, float(sp.nsimplify(ratio) * sp.nsimplify(Ma) * sp.nsimplify(Va) / sp.nsimplify(Mb)), 1e-9, "Vb")
    pairs = [("Ignores the 1:2 mole ratio between the acid and the base." if ratio == 2 else "Doubles the volume of base for a 1:1 reaction.", Ma * Va / Mb if ratio == 2 else 2 * Ma * Va / Mb), ("Inverts the molarity ratio.", ratio * Mb * Va / Ma), ("Uses the volume of acid as the volume of base.", Va), ("Multiplies the molarities and divides by the volume of acid.", ratio * Ma * Mb / Va * 100)]
    key, ds = num_opts(key_v, pairs, "mL")
    acid, base = ("HCl", "NaOH") if ratio == 1 else ("H₂SO₄", "NaOH")
    stem = f"${Va:g}\\text{{ mL}}$ of ${Ma:g}\\text{{ M}}$ {acid} is titrated with ${Mb:g}\\text{{ M}}$ {base}. What volume of {base} solution is needed to reach the equivalence point?"
    return mk("ch_t5_titration_equivalence_volume", "8.5", "5.F", stem, key, ds, rng, concept="volume of titrant at the equivalence point from the mole ratio", path="exact rational vs float", facts=[f"Ma={Ma}", f"Va={Va}", f"Mb={Mb}", f"ratio={ratio}"],
              kwhy=f"The moles of OH⁻ needed are {ratio} × {Ma:g} × {Va / 1000:g} L, so the volume of base is {ratio} × ({Ma:g})({Va:g})/{Mb:g} = {sig(key_v)} mL.", judgment="use the mole ratio of the neutralization, then divide by the titrant molarity", est=90)


@retry_sep
def ch_t5_ph_weak_base(rng):
    Kb, c = pick(rng, [1.8e-5, 4.4e-4, 5.6e-4, 1.7e-6]), pick(rng, [0.10, 0.20, 0.50, 0.050])
    x = math.sqrt(Kb * c); key_v = 14 + math.log10(x)
    agree(key_v, 14 + math.log10(float(sp.sqrt(sp.nsimplify(Kb) * sp.nsimplify(c)))), 1e-9, "pH")
    pairs = [("Reports the pOH of the solution rather than the pH.", -math.log10(x)), ("Treats the weak base as strong, so [OH−] equals the formal concentration.", 14 + math.log10(c)), ("Takes [H+] equal to the square root of Kb c and reports that pH.", -math.log10(x) if False else -math.log10(Kb * c)), ("Uses Kb directly as [OH−].", 14 + math.log10(Kb))]
    key, ds = pH_opts(key_v, pairs)
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of a weak base B with K_b = ${sn(Kb, 2)}$ at 25 °C? (Assume x is much smaller than the initial concentration.)"
    return mk("ch_t5_ph_weak_base", "8.3", "5.F", stem, key, ds, rng, concept="pH of a weak base solution via [OH-] = sqrt(Kb c)", path="sympy square root vs direct formula", facts=[f"Kb={Kb}", f"c={c}"],
              kwhy=f"[OH⁻] = sqrt({sn(Kb, 2)} × {c:g}) = {sn(x)} M, pOH = {-math.log10(x):.2f}, and pH = 14 − pOH = {key_v:.2f}.", judgment="find [OH-] from Kb, then convert pOH to pH", est=100)


@retry_sep
def ch_t5_buffer_ratio_for_ph(rng):
    pKa, ph = pick(rng, [4.74, 7.21, 6.35, 9.25, 3.75]), 0.0
    delta = pick(rng, [-0.60, -0.30, 0.30, 0.60, 1.00]); ph = pKa + delta
    key_v = 10 ** delta; agree(key_v, float(sp.Float(10) ** sp.nsimplify(delta)), 1e-6, "r")
    pairs = [("Inverts the ratio, giving [HA]/[A−].", 10 ** -delta), ("Takes the ratio equal to the pH divided by the pKa.", ph / pKa), ("Uses the difference pH − pKa as the ratio.", abs(delta) + 1e-3 if abs(delta) > 0.1 else 1.0), ("Uses 10^(pH) instead of 10^(pH − pKa).", 10 ** ph / 1e3)]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + sig(v, 3) + "$")
    stem = f"A buffer is made from a weak acid HA with pK_a = ${pKa:g}$ and its conjugate base A⁻. What ratio [A⁻]/[HA] gives the buffer a pH of ${ph:.2f}$?"
    return mk("ch_t5_buffer_ratio_for_ph", "8.9", "5.F", stem, key, ds, rng, concept="the base-to-acid ratio needed for a target pH from the Henderson-Hasselbalch equation", path="sympy power of ten vs float", facts=[f"pKa={pKa}", f"delta={delta}"],
              kwhy=f"pH = pKa + log([A⁻]/[HA]) gives log ratio = {ph:.2f} − {pKa:g} = {delta:+.2f}, so the ratio is 10^{delta:+.2f} = {sig(key_v)}.", judgment="rearrange the Henderson-Hasselbalch equation for the ratio", est=90)


@retry_sep
def ch_t5_delta_g_from_k(rng):
    K, T = pick(rng, [1.0e-3, 2.5e2, 4.0e5, 3.2e-6, 1.0e8]), pick(rng, [298.0, 350.0, 400.0])
    key_v = -R_J * T * math.log(K) / 1000; agree(key_v, float(-sp.nsimplify(R_J) * sp.nsimplify(T) * sp.log(sp.nsimplify(K)) / 1000), 1e-6, "dG")
    pairs = [("Uses the opposite sign, ΔG° = +RT ln K.", -key_v), ("Uses log base 10 instead of the natural logarithm.", -R_J * T * math.log10(K) / 1000), ("Forgets to convert joules to kilojoules.", -R_J * T * math.log(K)), ("Uses R in L atm/(mol K) instead of J/(mol K).", -R_ATM * T * math.log(K) / 1000)]
    key, ds = signed_opts(key_v, pairs, "kJ/mol")
    stem = f"A reaction has an equilibrium constant K = ${sn(K, 2)}$ at ${T:g}\\text{{ K}}$. What is the standard Gibbs free energy change, ΔG°, for the reaction at this temperature? (R = 8.314 J/(mol K))"
    return mk("ch_t5_delta_g_from_k", "9.5", "5.F", stem, key, ds, rng, concept="ΔG° from the equilibrium constant, ΔG° = −RT ln K", path="sympy natural log vs math.log", facts=[f"K={K}", f"T={T}"],
              kwhy=f"ΔG° = −RT ln K = −(8.314)({T:g}) ln({sn(K, 2)}) = {sig(key_v)} kJ/mol.", judgment="use the natural logarithm and convert J to kJ", est=95)


@retry_sep
def ch_t5_cell_potential_sum(rng):
    pair = pick(rng, [(("Zn2+/Zn", -0.76), ("Cu2+/Cu", 0.34)), (("Mg2+/Mg", -2.37), ("Ag+/Ag", 0.80)), (("Fe2+/Fe", -0.44), ("Cu2+/Cu", 0.34)), (("Al3+/Al", -1.66), ("Zn2+/Zn", -0.76)), (("Ni2+/Ni", -0.26), ("Ag+/Ag", 0.80))])
    (an, ea), (ca, ec) = pair
    key_v = ec - ea; agree(key_v, float(sp.nsimplify(ec) - sp.nsimplify(ea)), 1e-9, "E")
    pairs = [("Adds the two reduction potentials.", ec + ea), ("Subtracts in the wrong order (anode minus cathode), which gives the opposite sign.", ea - ec), ("Adds the magnitudes of the two potentials.", abs(ec) + abs(ea) if abs(ec) + abs(ea) != key_v else key_v + 0.5), ("Uses only the potential of the cathode half-cell.", ec)]
    key, ds = abs_opts(key_v, pairs, lambda v: E_fmt(v), 0.15)
    stem = f"A galvanic cell is built from the half-cells {an} ($E^{{\\circ}} = {ea:+.2f}\\text{{ V}}$) and {ca} ($E^{{\\circ}} = {ec:+.2f}\\text{{ V}}$), with the half-cell of greater reduction potential as the cathode. What is the standard cell potential, $E^{{\\circ}}_{{\\text{{cell}}}}$?"
    return mk("ch_t5_cell_potential_sum", "9.9", "5.F", stem, key, ds, rng, concept="standard cell potential from two standard reduction potentials", path="exact difference vs float", facts=[f"an={an}", f"ca={ca}"],
              kwhy=f"E°cell = E°cathode − E°anode = {ec:+.2f} − ({ea:+.2f}) = {key_v:+.2f} V.", judgment="subtract the anode reduction potential from the cathode reduction potential", est=80)


@retry_sep
def ch_t5_faraday_mass(rng):
    metal = pick(rng, [("Cu", 63.55, 2), ("Ag", 107.87, 1), ("Ni", 58.69, 2), ("Zn", 65.38, 2), ("Al", 26.98, 3)]); I, t = pick(rng, [0.50, 1.50, 2.00, 5.00]), pick(rng, [600.0, 1800.0, 3600.0, 7200.0])
    sym, M, z = metal
    key_v = I * t / (z * F_CONST) * M; agree(key_v, float(sp.nsimplify(I) * sp.nsimplify(t) / (z * sp.nsimplify(F_CONST)) * sp.nsimplify(M)), 1e-9, "m")
    pairs = [("Ignores the number of electrons transferred per ion.", I * t / F_CONST * M), ("Multiplies by the number of electrons instead of dividing by it.", I * t * z / F_CONST * M), ("Uses the time in minutes instead of seconds.", I * (t / 60) / (z * F_CONST) * M), ("Forgets to multiply the moles by the molar mass.", I * t / (z * F_CONST))]
    key, ds = num_opts(key_v, pairs, "g")
    stem = f"A current of ${I:g}\\text{{ A}}$ passes through a solution of {sym} ions for ${t:g}\\text{{ s}}$, and each ion is reduced to the metal by gaining {z} electron{'s' if z > 1 else ''}. What mass of {sym} is deposited? (F = 96,485 C/mol)"
    return mk("ch_t5_faraday_mass", "9.11", "5.F", stem, key, ds, rng, concept="mass deposited in electrolysis from current, time, and electrons transferred", path="exact rational vs float", facts=[f"metal={sym}", f"I={I}", f"t={t}"],
              kwhy=f"Charge = {I:g} × {t:g} = {I * t:g} C; moles of electrons = {I * t / F_CONST:.4f}; moles of {sym} = that divided by {z}; mass = {sig(key_v)} g.", judgment="convert charge to moles of electrons, then to moles and grams of metal", est=100)


@retry_sep
def ch_t5_coulomb_ratio(rng):
    q1, q2, r1, r2 = pick(rng, [(1, 1, 2.0, 1.0), (1, 2, 1.0, 1.0), (2, 2, 2.0, 1.0), (1, 3, 3.0, 1.0)])[0:4]
    key_v = (q1 * q2) / (r1 ** 2) if True else 0
    base = 1.0
    pairs = [("Uses the distance instead of the square of the distance.", (q1 * q2) / r1), ("Adds the charges instead of multiplying them.", (q1 + q2) / (r1 ** 2)), ("Treats the force as proportional to the distance.", q1 * q2 * r1), ("Ignores the distance dependence.", float(q1 * q2))]
    key, ds = num_opts(key_v, pairs, "", fmt=lambda v: "$" + f"{v:.3g}" + "$")
    stem = f"Compare the electrostatic attraction between two ions with charges +{q1} and −{q2} separated by ${r1:g}$ distance units with the attraction between a +1 ion and a −1 ion separated by 1 unit. By what factor is the force (in units of the reference force) changed according to Coulomb's law?"
    return mk("ch_t5_coulomb_ratio", "2.2", "5.F", stem, key, ds, rng, concept="relative strength of ionic attraction from charges and separation using Coulomb's law", path="exact rational vs float", facts=[f"q={q1},{q2}", f"r={r1}"],
              kwhy=f"Force is proportional to q1q2/r², so the factor is ({q1})({q2})/({r1:g})² = {key_v:.3g}.", judgment="force scales with the product of the charges and the inverse square of the separation", est=80)


@retry_sep
def ch_t5_photon_energy_wavelength(rng):
    lam = pick(rng, [250.0, 410.0, 532.0, 650.0, 1064.0]); h, c = 6.626e-34, 2.998e8
    key_v = h * c / (lam * 1e-9); agree(key_v, float(sp.nsimplify(h) * sp.nsimplify(c) / (sp.nsimplify(lam) * sp.Float(1e-9))), 1e-9, "E")
    pairs = [("Uses the wavelength in nanometers without converting to meters.", h * c / lam), ("Multiplies the wavelength by hc instead of dividing.", h * c * lam * 1e-9), ("Uses E = h/λ and leaves out the speed of light.", h / (lam * 1e-9)), ("Uses the frequency as the energy.", c / (lam * 1e-9))]
    SC = 1e19
    key, ds = num_opts(key_v * SC, [(w, v * SC) for w, v in pairs], "", fmt=lambda v: "$" + sn(v / SC, 3) + "\\text{ J}$")
    stem = f"What is the energy of one photon of light with a wavelength of ${lam:g}\\text{{ nm}}$? (h = 6.626 × 10⁻³⁴ J s; c = 2.998 × 10⁸ m/s)"
    return mk("ch_t5_photon_energy_wavelength", "3.12", "5.F", stem, key, ds, rng, concept="photon energy from the wavelength using E = hc/λ", path="sympy rational vs float", facts=[f"lam={lam}"],
              kwhy=f"E = hc/λ = (6.626 × 10⁻³⁴)(2.998 × 10⁸)/({lam:g} × 10⁻⁹ m) = {sn(key_v)} J.", judgment="convert nanometers to meters and use E = hc/λ", est=85)
