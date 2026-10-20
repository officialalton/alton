"""AP Chemistry 원형 Q — CH3 보강(2026-10-20): 첫 생성에서 반려된 원형을 대신할 입자 표현(P1)·모델 분석(P4) 고정 문장 은행 원형. 항목마다 한 주제 코드만 쓴다."""
from chem_common import *  # noqa: F401,F403
from chem_p0_o import _b


def _q(arch, topic, skill, bank, concept):
    f = _b(arch, topic, skill, bank, concept, "fixed fact bank checked against CED " + topic)
    f.__module__ = "chem_p0_q"
    return f


ch_q_particulate_bonding = _q("ch_q_particulate_bonding", "2.1", "1.A", [
    ("A particulate diagram of solid sodium chloride is to be drawn. Which description matches a correct diagram?",
     ("Alternating Na⁺ and Cl⁻ ions arranged in a repeating lattice, each ion surrounded by ions of the opposite charge.", "An ionic solid is a lattice of alternating cations and anions."),
     [("Pairs of neutral Na and Cl atoms joined by a shared pair of electrons, arranged in a regular pattern.", "Sodium chloride is ionic and does not contain shared electron pairs between neutral atoms."), ("Positive Na⁺ ions in a lattice surrounded by a sea of freely moving electrons, with no Cl⁻ ions shown.", "The sea of electrons describes a metal, and sodium chloride also contains Cl⁻ ions."), ("Separate NaCl molecules held together only by weak forces between the molecules.", "Sodium chloride is not made of separate molecules; it is a lattice of ions.")]),
    ("A particulate diagram of solid copper is to be drawn. Which description matches a correct diagram?",
     ("Copper cations arranged in a lattice, surrounded by delocalized valence electrons that move among the cations.", "A metal consists of cations in a sea of delocalized electrons."),
     [("Alternating Cu⁺ and Cu⁻ ions arranged in a repeating lattice, with every electron held by one ion.", "A metal does not consist of oppositely charged copper ions."), ("Separate Cu2 molecules with a shared electron pair between each two atoms of copper.", "Copper is not made of separate molecules; its electrons are delocalized."), ("Neutral copper atoms with every valence electron held in a fixed position on one atom.", "Metallic bonding is described by electrons that are free to move.")]),
    ("A particulate diagram of solid diamond, a form of carbon, is to be drawn. Which description matches a correct diagram?",
     ("Carbon atoms, each covalently bonded to four neighboring carbon atoms in a continuous three-dimensional network.", "Diamond is a network covalent solid with four bonds per carbon atom."),
     [("Separate C4 molecules with only weak dispersion forces between the molecules.", "Diamond is not a molecular solid; the covalent bonds extend through the crystal."), ("Alternating C⁺ and C⁻ ions arranged in a repeating lattice of oppositely charged ions.", "Diamond is made of carbon atoms and not of ions."), ("Carbon cations in a sea of delocalized electrons that move freely through the solid.", "Diamond does not conduct because its electrons are not free to move.")]),
], "choose the correct particulate representation of an ionic, metallic or covalent network solid")

ch_q_particulate_acid = _q("ch_q_particulate_acid", "8.3", "1.A", [
    ("A particulate diagram of a solution of a weak acid HA in water is to be drawn. Which description matches a correct diagram?",
     ("Mostly intact HA molecules, with a small number of H3O⁺ ions and A⁻ ions, among many water molecules.", "A weak acid ionizes only slightly, so most of it remains as HA."),
     [("No HA molecules, with H3O⁺ ions and A⁻ ions present in equal numbers among water molecules.", "That diagram shows a strong acid that is completely ionized."), ("Only HA molecules among water molecules, with no H3O⁺ ions and no A⁻ ions.", "A weak acid does ionize to a small extent and so some ions are present."), ("Mostly H3O⁺ ions with a few A⁻ ions and a few HA molecules among water molecules.", "The hydronium and A⁻ ions are formed in equal numbers.")]),
    ("A particulate diagram of a solution of the strong acid HCl in water is to be drawn. Which description matches a correct diagram?",
     ("H3O⁺ ions and Cl⁻ ions in equal numbers among water molecules, with no HCl molecules.", "A strong acid is completely ionized in water."),
     [("Mostly intact HCl molecules with a few H3O⁺ ions and Cl⁻ ions among water molecules.", "That diagram shows a weak acid that is only partly ionized."), ("Equal numbers of H3O⁺ ions and OH⁻ ions among water molecules, with no Cl⁻ ions shown.", "The chloride ion from the acid must be shown and the OH⁻ ions are not produced by the acid."), ("Intact HCl molecules only, dissolved among water molecules, with no ions.", "HCl is ionized completely in water.")]),
    ("A particulate diagram of a solution of the weak base NH3 in water is to be drawn. Which description matches a correct diagram?",
     ("Mostly intact NH3 molecules, with a small number of NH4⁺ ions and OH⁻ ions among many water molecules.", "A weak base accepts a proton from water only to a small extent."),
     [("No NH3 molecules, with NH4⁺ ions and OH⁻ ions in equal numbers among water molecules.", "That diagram shows a base that reacts completely, which is not true of ammonia."), ("Mostly NH4⁺ ions with a few OH⁻ ions and a few NH3 molecules among water molecules.", "The ions are formed in equal numbers and only a small fraction of NH3 reacts."), ("Only NH3 molecules among water molecules, with no NH4⁺ ions and no OH⁻ ions.", "Ammonia reacts to a small extent to form ions, so some ions are present.")]),
], "choose the particulate representation of a strong or weak acid or base in water")

ch_q_particulate_ionic_solid = _q("ch_q_particulate_ionic_solid", "2.3", "1.A", [
    ("A particulate diagram of solid magnesium oxide, MgO, is to be drawn. Which description matches a correct diagram?",
     ("Equal numbers of Mg²⁺ and O²⁻ ions in an alternating lattice, with each ion surrounded by ions of opposite charge.", "The formula MgO gives a 1:1 ratio of the 2+ and 2− ions."),
     [("Twice as many Mg²⁺ ions as O²⁻ ions in an alternating lattice, with each oxygen ion between two magnesium ions.", "The charges 2+ and 2− balance in a 1:1 ratio."), ("Equal numbers of Mg⁺ ions and O⁻ ions in an alternating lattice, with each ion touching ions of the opposite charge.", "Magnesium forms a 2+ ion and oxygen forms a 2− ion."), ("Pairs of neutral Mg and O atoms sharing electrons, in separate molecules with weak forces between them.", "Magnesium oxide is ionic and is not made of separate molecules.")]),
    ("A particulate diagram of solid calcium fluoride, CaF2, is to be drawn. Which description matches a correct diagram?",
     ("Twice as many F⁻ ions as Ca²⁺ ions in a repeating lattice, with ions of opposite charge as neighbors.", "The formula CaF2 gives a 1:2 ratio of Ca²⁺ to F⁻."),
     [("Equal numbers of Ca²⁺ ions and F⁻ ions in a repeating lattice, with each ion touching ions of the opposite charge.", "Equal numbers would not balance the charge of 2+ against 1−."), ("Twice as many Ca²⁺ ions as F⁻ ions in a repeating lattice, with each fluoride ion between two calcium ions.", "The ratio is reversed; two fluoride ions balance one calcium ion."), ("Separate CaF2 molecules, each with one calcium atom and two fluorine atoms, and weak forces between the molecules.", "A salt is a lattice of ions and not separate molecules.")]),
    ("A student compares two diagrams of solid sodium chloride. Diagram X shows each ion touching six ions of the opposite charge. Diagram Y shows each ion touching only one ion of the opposite charge, in separate pairs. Which diagram is correct, and why?",
     ("Diagram X, because an ionic lattice extends in three dimensions and every ion is surrounded by ions of opposite charge.", "A lattice has no separate pairs of ions."),
     [("Diagram Y, because ionic compounds exist as separate pairs of ions that are held by one bond each.", "Separate pairs would describe molecules, which sodium chloride does not form."), ("Diagram Y, because each ion attracts only one partner with the opposite charge and ignores its other neighbors.", "Each ion attracts every neighbor of the opposite charge in the lattice."), ("Both diagrams are equally correct, because the formula NaCl does not tell the arrangement of the ions.", "The formula gives only the ratio and does not describe the arrangement.")]),
], "choose the correct particulate arrangement of an ionic solid from its formula")

ch_q_particulate_buffer = _q("ch_q_particulate_buffer", "8.8", "1.A", [
    ("A particulate diagram of a buffer made from acetic acid, CH3COOH, and sodium acetate in water is to be drawn. Which description matches a correct diagram?",
     ("Many CH3COOH molecules and many CH3COO⁻ ions, with Na⁺ ions and water molecules also present.", "A buffer contains both the weak acid and its conjugate base in large amounts."),
     [("Many CH3COOH molecules with no CH3COO⁻ ions, and water molecules.", "Without the conjugate base the solution is not a buffer."), ("Many CH3COO⁻ ions and Na⁺ ions with no CH3COOH molecules, and water molecules.", "Without the weak acid the solution is not a buffer."), ("Many H3O⁺ ions and Cl⁻ ions with no CH3COOH molecules, and water molecules.", "That diagram shows a strong acid solution and not a buffer.")]),
    ("A buffer contains many CH3COOH molecules and many CH3COO⁻ ions in water. A small amount of strong acid is added to the buffer. Which description matches a correct diagram after the reaction is complete?",
     ("Fewer CH3COO⁻ ions and more CH3COOH molecules than before, with almost no added H3O⁺ remaining.", "The acetate ions react with the added H3O⁺ to form CH3COOH."),
     [("More CH3COO⁻ ions and fewer CH3COOH molecules than before.", "The acetate ions are used up by the added acid and so they become fewer."), ("Many added H3O⁺ ions remaining, with the numbers of CH3COOH and CH3COO⁻ unchanged.", "The buffer removes most of the added H3O⁺ by reacting it with acetate."), ("No CH3COOH molecules, because the strong acid has used them up.", "The strong acid produces CH3COOH from acetate and does not use it up.")]),
    ("A buffer contains many CH3COOH molecules and many CH3COO⁻ ions in water. A small amount of strong base is added to the buffer. Which description matches a correct diagram after the reaction is complete?",
     ("Fewer CH3COOH molecules and more CH3COO⁻ ions than before, with almost no added OH⁻ remaining.", "The weak acid reacts with the added OH⁻ to form acetate ions and water."),
     [("More CH3COOH molecules and fewer CH3COO⁻ ions than before.", "The acid is used up by the added base and so it becomes fewer."), ("Many added OH⁻ ions remaining, with the numbers of CH3COOH and CH3COO⁻ unchanged.", "The buffer removes most of the added OH⁻ by reacting it with CH3COOH."), ("No CH3COO⁻ ions, because the base has used them up.", "The base converts CH3COOH to acetate and does not remove it.")]),
], "choose the particulate representation of a buffer before and after added acid or base")

ch_q_imf_property = _q("ch_q_imf_property", "3.1", "4.A", [
    ("CH4, C2H6 and C3H8 are nonpolar gases. Which of the following correctly ranks them by their vapor pressure at the same temperature, from lowest to highest?",
     ("C3H8 < C2H6 < CH4, because the larger molecules have stronger dispersion forces.", "Stronger attractions between the molecules lower the vapor pressure."),
     [("CH4 < C2H6 < C3H8, because the larger molecules escape more easily from the liquid.", "Larger molecules with stronger forces escape less easily."), ("C2H6 < CH4 < C3H8, because the forces are strongest in the middle molecule.", "The strength of the dispersion forces rises steadily with the number of electrons."), ("All three have the same vapor pressure, because all are nonpolar.", "Nonpolar molecules still differ in the strength of dispersion forces.")]),
    ("Glycerol, C3H5(OH)3, is much more viscous than ethanol, C2H5OH. Which statement best explains the difference?",
     ("Glycerol has three OH groups per molecule and forms more hydrogen bonds, so its molecules move past each other less easily.", "More hydrogen bonds per molecule give a stronger network."),
     [("Glycerol has fewer OH groups than ethanol and so its molecules attract each other less.", "Glycerol has three OH groups and ethanol has one."), ("Glycerol has weaker intermolecular forces because its molar mass is greater.", "A greater molar mass and more hydrogen bonds give stronger forces."), ("Glycerol has covalent bonds between its molecules, which ethanol does not have.", "Hydrogen bonds between molecules are not covalent bonds.")]),
    ("F2, Cl2 and Br2 are nonpolar diatomic molecules. Which of the following correctly ranks them by their boiling points, from lowest to highest?",
     ("F2 < Cl2 < Br2, because the larger molecules have more electrons and are more polarizable.", "A more polarizable electron cloud gives stronger dispersion forces."),
     [("Br2 < Cl2 < F2, because the smaller molecules pack more closely.", "Packing does not set the boiling point; the strength of the forces does."), ("Cl2 < F2 < Br2, because chlorine is the most electronegative.", "The electronegativity does not matter for a nonpolar molecule."), ("F2 = Cl2 = Br2, because the bonds are all single bonds.", "The strength of the dispersion forces depends on the size of the molecule.")]),
], "rank properties of substances from the strength of their intermolecular forces")

ch_q_rate_relationship = _q("ch_q_rate_relationship", "5.1", "4.B", [
    ("For the reaction 2 N2O5 → 4 NO2 + O2, the rate of appearance of O2 is 1.0 x 10⁻⁴ M/s. What is the rate of appearance of NO2?",
     ("4.0 x 10⁻⁴ M/s, because 4 mol of NO2 form for each mole of O2.", "The rates are in the ratio of the coefficients."),
     [("2.5 x 10⁻⁵ M/s, because the ratio is inverted.", "More moles of NO2 form per mole of O2, so the rate is larger."), ("1.0 x 10⁻⁴ M/s, because all species change at the same rate.", "The rate of change of each species depends on its coefficient."), ("2.0 x 10⁻⁴ M/s, because the coefficient of N2O5 is 2.", "The ratio of NO2 to O2 is 4 to 1.")]),
    ("For the reaction N2 + 3 H2 → 2 NH3, the rate of disappearance of H2 is 0.60 M/s. What is the rate of disappearance of N2?",
     ("0.20 M/s, because 1 mol of N2 reacts for every 3 mol of H2.", "The rate of N2 is one third of the rate of H2."),
     [("1.8 M/s, because N2 is used three times as fast as H2.", "More H2 than N2 is used, so N2 is used more slowly."), ("0.60 M/s, because the species are used at the same rate.", "The rates follow the coefficients."), ("0.40 M/s, because the coefficient of NH3 is 2.", "The ratio of N2 to H2 is 1 to 3.")]),
    ("For the reaction A → 2 B, how does the rate of disappearance of A compare with the rate of appearance of B?",
     ("The rate of disappearance of A is half the rate of appearance of B.", "Two moles of B form for each mole of A that reacts."),
     [("The rate of disappearance of A is twice the rate of appearance of B.", "B is formed at twice the rate at which A is used."), ("The two rates are equal.", "The coefficients are different, so the rates differ."), ("The rate of appearance of B is zero until A is gone.", "B forms as A reacts and not after it is gone.")]),
], "relate the rates of change of the species in a reaction through the coefficients")

ch_q_half_life_concept = _q("ch_q_half_life_concept", "5.3", "4.A", [
    ("For a first-order reaction, the half-life is 20 s at an initial concentration of 0.80 M. What is the half-life if the initial concentration is 0.40 M?",
     ("20 s, because the half-life of a first-order reaction does not depend on the concentration.", "t½ = 0.693/k for a first-order reaction."),
     [("10 s, because the smaller concentration is used up in half the time.", "That holds only for a zero-order reaction."), ("40 s, because the smaller concentration is used up more slowly.", "That holds for a second-order reaction."), ("5 s, because both the concentration and the time are halved twice.", "No order of reaction gives this relationship.")]),
    ("For a second-order reaction, the half-life is 20 s at an initial concentration of 0.80 M. What is the half-life if the initial concentration is 0.40 M?",
     ("40 s, because the half-life of a second-order reaction is inversely proportional to the initial concentration.", "t½ = 1/(k[A]0) for a second-order reaction."),
     [("20 s, because the half-life does not depend on the concentration.", "That holds only for a first-order reaction."), ("10 s, because the smaller concentration is used up in half the time.", "That holds for a zero-order reaction."), ("80 s, because the half-life is inversely proportional to the square of the concentration.", "The half-life depends on the first power of the concentration.")]),
    ("For a zero-order reaction, the half-life is 20 s at an initial concentration of 0.80 M. What is the half-life if the initial concentration is 0.40 M?",
     ("10 s, because the half-life of a zero-order reaction is proportional to the initial concentration.", "t½ = [A]0/(2k) for a zero-order reaction."),
     [("20 s, because the half-life does not depend on the concentration.", "That holds only for a first-order reaction."), ("40 s, because the smaller concentration lasts longer.", "That holds for a second-order reaction."), ("5 s, because the half-life is proportional to the square of the concentration.", "The half-life depends on the first power of the concentration.")]),
], "relate the half-life to the initial concentration for reactions of different order")

STAGE_Q_MC = ["ch_q_particulate_bonding", "ch_q_particulate_acid", "ch_q_particulate_ionic_solid", "ch_q_particulate_buffer", "ch_q_imf_property", "ch_q_rate_relationship", "ch_q_half_life_concept"]
