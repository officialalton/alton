"""AP Chemistry 원형 — CH5 단독 6칸 대체 2부(2026-10-22): 운영 보고의 부족 칸(1단원 6.D 이온화 에너지 추론, 3단원 2.C 표준 용액 절차, 4단원 4.A 산화환원 입자 모형, 8단원 5.D 적정 자료표, 5.F 암모늄 pH, 5.F 약산 적정 당량점 pH).
개념 문항은 고정 문장 은행(chem_p0_n._bank), 계산 문항은 이중 경로(sympy 정확 풀이 vs 수치)이며 오답은 이름 붙은 오개념이다. 공개 문항과 자료·조건·과제·풀이 단계가 달라야 한다."""
import json
from chem_p0_n import _bank
from chem_p0_p import _table
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5j"
    return f


ch_t5j_p6_ionization_anomaly = _b("ch_t5j_p6_ionization_anomaly", "1.7", "6.D", [
    ("The first ionization energy of aluminum (578 kJ/mol) is lower than that of magnesium (738 kJ/mol), even though aluminum has the larger nuclear charge. Which statement best explains this observation?",
     ("The outermost electron of Al is in a 3p subshell, which is higher in energy and farther from the nucleus than the 3s subshell of Mg, so it is easier to remove.", "A 3p electron is held less tightly than a 3s electron because it is less penetrating, which outweighs the added proton."),
     [("Aluminum atoms are larger than magnesium atoms because they have more electron shells.", "Both atoms have three shells, so the shell count does not explain the lower ionization energy of Al."), ("Aluminum has fewer protons than magnesium, so its nucleus attracts electrons less strongly.", "Aluminum has 13 protons and magnesium has 12, so the nuclear charge is larger for aluminum."), ("The outermost electron of Al is paired in a 3s orbital, so repulsion removes it more easily.", "The outermost electron of Al is a single 3p electron, not a paired 3s electron.")]),
    ("The first ionization energy of sulfur (1000 kJ/mol) is lower than that of phosphorus (1012 kJ/mol), even though sulfur has the larger nuclear charge. Which statement best explains this observation?",
     ("A 3p orbital of sulfur holds a pair of electrons, and the repulsion between the paired electrons makes one of them easier to remove than an unpaired electron of phosphorus.", "Electron–electron repulsion in a doubly occupied 3p orbital lowers the energy needed to remove an electron."),
     [("Sulfur atoms have a smaller radius than phosphorus atoms, so the outer electrons are held more weakly.", "A smaller radius generally raises, not lowers, the ionization energy."), ("Sulfur has fewer protons than phosphorus, so its nucleus attracts electrons less strongly.", "Sulfur has 16 protons and phosphorus has 15, so sulfur has the larger nuclear charge."), ("The outermost electron of sulfur is in a 4s subshell, which is farther from the nucleus.", "The outermost electrons of sulfur are in the 3p subshell, as in phosphorus.")])],
    "explain an exception to the general trend of ionization energy across a period using subshell energy or electron pairing")

ch_t5j_p2_standard_solution_procedure = _b("ch_t5j_p2_standard_solution_procedure", "3.7", "2.C", [
    ("A student needs 250.0 mL of a 0.100 M NaCl solution from solid NaCl. Which procedure is most appropriate for making the solution accurately?",
     ("Dissolve 1.461 g of NaCl in water in a beaker, transfer it to a 250.0 mL volumetric flask with rinsings, and fill to the mark.", "Dissolving first, transferring completely, and filling to the calibration mark gives exactly 250.0 mL of solution with the intended amount of solute."),
     [("Add 1.461 g of NaCl to a 250.0 mL graduated cylinder, then add 250.0 mL of water and stir until it dissolves.", "Adding 250.0 mL of water to the solid makes more than 250.0 mL of solution, so the concentration is too low."), ("Add 1.461 g of NaCl to a beaker and fill the beaker with water until it reaches the 250 mL line on its side.", "A beaker's markings are not accurate enough to prepare a solution of a precise concentration."), ("Dissolve 14.61 g of NaCl in water and dilute the solution to 250.0 mL in a volumetric flask.", "Using 14.61 g gives a concentration ten times too large.")]),
    ("A student has 1.00 M HCl and needs 100.0 mL of 0.100 M HCl. Which procedure is most appropriate for the dilution?",
     ("Pipet 10.00 mL of the 1.00 M HCl into a 100.0 mL volumetric flask that holds some water, then add water to the mark.", "The moles of HCl in 10.00 mL of 1.00 M acid are 0.0100 mol, which gives 0.100 M in 100.0 mL, and a pipet and flask measure the volumes accurately."),
     [("Pour 10.00 mL of the 1.00 M HCl into a beaker that holds 100.0 mL of water and stir the mixture.", "This makes about 110 mL of solution, so the concentration is below 0.100 M, and the volumes are not measured accurately."), ("Pour 100.0 mL of the 1.00 M HCl into a beaker that holds 10.00 mL of water and stir the mixture.", "This produces a solution that is far more concentrated than 0.100 M."), ("Pipet 1.00 mL of the 1.00 M HCl into a 100.0 mL volumetric flask and add water to the mark.", "This makes 0.0100 M HCl, which is ten times too dilute.")])],
    "choose an accurate procedure for preparing a standard solution by direct weighing or dilution")

ch_t5j_p4_displacement_model = _b("ch_t5j_p4_displacement_model", "4.9", "4.A", [
    ("Chlorine gas is bubbled through a colorless solution of sodium bromide, and the solution turns orange as Br₂ forms. Which particle-level statement best describes the change?",
     ("Cl₂ molecules gain electrons to form Cl⁻ ions, and Br⁻ ions lose electrons to form Br₂ molecules.", "Chlorine is reduced and bromide is oxidized, so electrons transfer from Br⁻ to Cl₂."),
     [("Br⁻ ions gain electrons to form Br₂ molecules, and Cl₂ molecules lose electrons to form Cl⁻ ions.", "Forming Br₂ from Br⁻ requires a loss of electrons, so it is oxidation."), ("Na⁺ ions gain electrons from Cl₂ and form sodium atoms.", "Sodium ions are spectators here and are not reduced."), ("Cl₂ molecules and Br⁻ ions share electrons to form BrCl molecules.", "The orange color is from Br₂, and the change is an electron transfer rather than sharing to form BrCl.")]),
    ("A strip of copper metal is placed in a colorless solution of silver nitrate. After some time, silver crystals form on the strip and the solution becomes blue. Which particle-level statement best describes the change?",
     ("Cu atoms lose electrons to form Cu²⁺ ions in solution, and Ag⁺ ions gain electrons to form Ag atoms on the strip.", "Copper is oxidized and silver ions are reduced, which accounts for the blue Cu²⁺ and the silver crystals."),
     [("Ag⁺ ions lose electrons to form Ag atoms, and Cu atoms gain electrons to form Cu²⁺ ions.", "Forming Ag atoms from Ag⁺ ions requires a gain of electrons, so it is reduction."), ("Cu atoms gain electrons from NO₃⁻ ions to form Cu²⁺ ions.", "Nitrate ions are spectators and electrons are not gained when Cu²⁺ forms."), ("Ag atoms from the strip dissolve to make the solution blue.", "The blue color comes from Cu²⁺ ions, and no silver was on the strip at the start.")])],
    "describe an electron-transfer displacement reaction at the particle level")


@retry_sep
def ch_t5j_ka_from_titration_table(rng):
    for _ in forever():
        pKa = pick(rng, [3.75, 4.20, 4.76, 5.10, 6.35]); Va = pick(rng, [20.0, 25.0, 30.0, 40.0])
        half = Va / 2
        def ph(v):
            return pKa + math.log10(v / (Va - v)) if v < Va else None
        vs = [round(half / 2, 1), half, round(half * 1.5, 1)]
        if all(0 < v < Va for v in vs):
            break
    Ka = 10 ** (-pKa); phs = [ph(v) for v in vs]
    rows = [[f"{v:g}", f"{p:.2f}"] for v, p in zip(vs, phs)] + [[f"{Va:g}", "equivalence point"]]
    stim = _table("Titration of a weak monoprotic acid with NaOH: pH during the titration", ["Volume of NaOH added (mL)", "pH"], rows)
    agree(Ka, float(sp.Float(10) ** (-sp.nsimplify(pKa))), 1e-9, "Ka")
    pairs = [("Takes the pH at the first listed volume as the pKa.", 10 ** (-phs[0])), ("Takes the pH at the last listed volume before the equivalence point as the pKa.", 10 ** (-phs[2])),
             ("Reports the pKa itself instead of Ka.", pKa), ("Uses the equivalence volume as the pH when it finds Ka.", 10 ** (-Va))]
    pairs = [(t, v) for t, v in pairs if abs(v - Ka) / Ka > 0.08]
    if len(pairs) < 3:
        raise ValueError("ambiguous")
    key, ds = num_opts(Ka, pairs[:3], "")
    stem = f"A student titrates a weak monoprotic acid with NaOH and records the data in the table. The equivalence point is reached at ${Va:g}\\text{{ mL}}$. What is the value of K_a for the acid?"
    return mk("ch_t5j_ka_from_titration_table", "8.5", "5.D", stem, key, ds, rng, concept="Ka of a weak acid from the pH at the half-equivalence point in titration data", path="pKa = pH at half-equivalence read from the table vs Henderson–Hasselbalch fit", stim=stim, facts=[f"pKa={pKa}", f"Va={Va}"],
              kwhy=f"At {half:g} mL (half the equivalence volume) [HA] = [A⁻], so pH = pKa = {phs[1]:.2f} and Ka = 10^(−{phs[1]:.2f}) = {sn(Ka, 3)}.", judgment="find the half-equivalence volume in the table and read the pH there", est=100)


@retry_sep
def ch_t5j_ammonium_ph(rng):
    c = pick(rng, [0.100, 0.200, 0.500, 0.0500]); Kb = pick(rng, [1.8e-5, 1.7e-6, 6.3e-5])
    Ka = 1.0e-14 / Kb; x = math.sqrt(Ka * c); ph = -math.log10(x)
    if x / c > 0.05:
        raise ValueError("ambiguous")
    agree(ph, float(-sp.log(sp.sqrt(sp.nsimplify(1.0e-14) / sp.nsimplify(Kb) * sp.nsimplify(c)), 10)), 1e-6, "pH")
    pairs = [("Uses Kb directly as if the cation were a weak base.", 14 + math.log10(math.sqrt(Kb * c))), ("Treats the salt as neutral and reports pH 7.00.", 7.00), ("Uses the concentration as [H⁺].", -math.log10(c)), ("Takes the square root of Ka without multiplying by the concentration.", -math.log10(math.sqrt(Ka)))]
    pairs = [(t, v) for t, v in pairs if abs(v - ph) > 0.2]
    if len(pairs) < 3:
        raise ValueError("ambiguous")
    key, ds = num_opts(ph, pairs[:3], "", n=3)
    stem = f"What is the pH of a ${c:g}\\text{{ M}}$ solution of a salt that contains the cation of a weak base with K_b = ${sn(Kb, 2)}$ and a chloride ion? (K_w = 1.0 × 10⁻¹⁴ at 25 °C; the approximation x << c may be used.)"
    return mk("ch_t5j_ammonium_ph", "8.3", "5.F", stem, key, ds, rng, concept="pH of a solution of the conjugate acid of a weak base using Ka = Kw/Kb", path="sympy exact Ka and pH vs direct formula", facts=[f"c={c}", f"Kb={Kb}"],
              kwhy=f"Ka = Kw/Kb = {sn(Ka, 3)}; [H⁺] = √(Ka c) = {sn(x, 3)} M; pH = {ph:.2f}.", judgment="convert Kb of the base to Ka of its conjugate acid before solving for [H⁺]", est=110)


@retry_sep
def ch_t5j_equivalence_ph(rng):
    for _ in forever():
        Ka = pick(rng, [1.8e-5, 6.8e-4, 4.0e-5, 1.4e-4]); Ma, Va, Mb = pick(rng, [0.100, 0.200, 0.0500]), pick(rng, [25.0, 40.0, 50.0]), pick(rng, [0.100, 0.200])
        n = Ma * Va / 1000; Vb = n / Mb * 1000; Vt = (Va + Vb) / 1000; cA = n / Vt; Kb = 1.0e-14 / Ka; x = math.sqrt(Kb * cA)
        if x / cA < 0.05 and 7.5 < 14 + math.log10(x) < 10.5:
            break
    pOH = -math.log10(x); ph = 14 - pOH
    agree(ph, float(14 + sp.log(sp.sqrt(sp.nsimplify(1.0e-14) / sp.nsimplify(Ka) * sp.nsimplify(cA)), 10)), 1e-6, "pH")
    pairs = [("Reports the pH of a neutral solution, 7.00, because the acid and base have reacted completely.", 7.00), ("Reports the pOH instead of the pH.", pOH), ("Uses Ka in place of Kb when finding the hydroxide ion concentration.", 14 + math.log10(math.sqrt(Ka * cA)) if False else -math.log10(math.sqrt(Ka * cA))),
             ("Uses the initial concentration of the acid instead of the concentration after mixing.", 14 + math.log10(math.sqrt(Kb * Ma)))]
    pairs = [(t, v) for t, v in pairs if abs(v - ph) > 0.2]
    if len(pairs) < 3:
        raise ValueError("ambiguous")
    key, ds = num_opts(ph, pairs[:3], "", n=3)
    stem = f"A ${Va:g}\\text{{ mL}}$ sample of ${Ma:g}\\text{{ M}}$ weak monoprotic acid HA (K_a = ${sn(Ka, 2)}$) is titrated with ${Mb:g}\\text{{ M}}$ NaOH. What is the pH at the equivalence point? (K_w = 1.0 × 10⁻¹⁴ at 25 °C; the approximation x << c may be used.)"
    return mk("ch_t5j_equivalence_ph", "8.5", "5.F", stem, key, ds, rng, concept="pH at the equivalence point of a weak acid–strong base titration from the hydrolysis of the conjugate base", path="sympy exact Kb and pH vs direct formula", facts=[f"Ka={Ka}", f"Ma={Ma}", f"Va={Va}", f"Mb={Mb}"],
              kwhy=f"At equivalence n(A⁻) = {n:.5f} mol in {Vt * 1000:.1f} mL, so [A⁻] = {cA:.4f} M; Kb = Kw/Ka = {sn(Kb, 3)}; [OH⁻] = √(Kb c) = {sn(x, 3)} M; pH = 14 − {pOH:.2f} = {ph:.2f}.", judgment="recognize that the conjugate base controls the pH at the equivalence point", est=130)
