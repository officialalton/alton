"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 개념 문항 1부: Practice 1(입자 수준 모형) 16개. 고정 문장 은행(chem_p0_n._bank): 원형마다 장면 2개, 정답 1 + 이름 붙은 오개념 3.
필요한 정보는 모두 본문에 있고 CED 범위 안의 내용만 쓴다. 구조 기준: 공개 문항과 자료·조건·과제가 달라야 한다."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5d"
    return f


ch_t5_p1_mole_particles = _b("ch_t5_p1_mole_particles", "1.1", "1.A", [
    ("Sample X contains 1.0 mol of CO₂ molecules and sample Y contains 1.0 mol of O₂ molecules. Which statement correctly compares the particles in the two samples?",
     ("The samples contain the same number of molecules, but the molecules in X are more massive on average.", "One mole of any substance contains the same number of particles, and CO₂ has the larger molar mass."),
     [("Sample X contains more molecules because CO₂ has more atoms in each molecule.", "The number of molecules depends only on the number of moles, which is the same for both."), ("Sample Y contains more molecules because O₂ molecules are smaller.", "A mole is a fixed number of particles regardless of their size."), ("The samples contain the same mass because each is 1.0 mol.", "One mole of different substances has different masses because molar masses differ.")]),
    ("A 1.0 mol sample of Al atoms and a 1.0 mol sample of Mg atoms are compared. Which statement about the particles is correct?",
     ("The samples contain the same number of atoms, but the Al sample has the greater mass.", "Both samples hold the same number of atoms, and aluminum atoms are more massive than magnesium atoms."),
     [("The Mg sample contains more atoms because magnesium has a smaller molar mass.", "A smaller molar mass does not change the number of atoms in one mole."), ("The Al sample contains more atoms because it has the greater mass.", "A mole is a count; the greater mass is due to the heavier atoms, not to more atoms."), ("The two samples have the same mass because they have the same number of atoms.", "The same number of atoms of different elements has different masses.")])],
    "compare equal-mole samples as equal numbers of particles with different masses")

ch_t5_p1_mass_spectrum_peaks = _b("ch_t5_p1_mass_spectrum_peaks", "1.2", "1.A", [
    ("The mass spectrum of a sample of an element shows two peaks, one at mass 63 with a height of 69 percent and one at mass 65 with a height of 31 percent. What do the two peaks represent?",
     ("Two isotopes of the element, with the peak heights showing their relative abundances.", "Peaks in a mass spectrum correspond to isotopes with different masses, and heights give relative abundance."),
     [("Two different elements mixed in the sample, each present as one isotope.", "A sample of a single element gives peaks only for its isotopes."), ("Two energy levels from which electrons were removed.", "Energy levels are shown by photoelectron spectra, not mass spectra."), ("Two types of bonds between the atoms of the element.", "A mass spectrum of atoms gives masses, not bonding information.")]),
    ("A mass spectrum of an element shows three peaks at masses 24, 25, and 26. What can be concluded about the element from the spectrum?",
     ("The element has three naturally occurring isotopes with masses near 24, 25, and 26.", "Each peak is a different isotope, so three peaks mean three isotopes."),
     [("The element has three valence electrons.", "Valence electron count is not determined by a mass spectrum."), ("The element forms three different compounds.", "The spectrum of the element does not show compounds."), ("The element has atoms whose masses are the same as each other.", "Peaks at different masses show atoms with different masses.")])],
    "interpret the peaks of a mass spectrum of an element")

ch_t5_p1_pes_subshell_count = _b("ch_t5_p1_pes_subshell_count", "1.6", "1.A", [
    ("A photoelectron spectrum of a neutral atom shows three peaks with relative heights of 2, 2, and 6. Which electron configuration is consistent with the spectrum?",
     ("1s² 2s² 2p⁶", "Peak heights give the number of electrons in each subshell, so 2, 2, and 6 match 1s², 2s², and 2p⁶."),
     [("1s² 2s² 2p⁴", "This has 4 electrons in the 2p subshell, so the third peak would have a height of 4."), ("1s² 2s⁶ 2p²", "The 2s subshell can hold at most 2 electrons."), ("1s² 2p² 3s⁶", "The 3s subshell can hold at most 2 electrons and 2p fills before 3s.")]),
    ("In a photoelectron spectrum of an atom, the peak at the lowest binding energy has a relative height of 1 and the other peaks have relative heights of 2, 2, 6, 2, and 6. Which statement correctly describes the outermost electrons of the atom?",
     ("The outermost subshell holds one electron, since the lowest-binding-energy peak is the outermost one.", "The peak at the lowest binding energy is the outermost subshell, and its height gives the number of electrons."),
     [("The outermost subshell holds six electrons, since the tallest peak is the outermost one.", "The six-electron peak is at a higher binding energy than the outermost subshell."), ("The outermost subshell holds two electrons, since most of the peaks have a height of 2.", "A relative height of 1 means one electron in that subshell."), ("The outermost subshell is full, since the spectrum contains peaks with a height of 6.", "A single electron cannot fill an s subshell, which holds two electrons.")])],
    "read subshell populations from relative peak heights in a photoelectron spectrum")

ch_t5_p1_effective_charge = _b("ch_t5_p1_effective_charge", "1.7", "1.B", [
    ("Atoms of sodium and chlorine are in the same period. Which statement best explains why the radius of a chlorine atom is smaller than the radius of a sodium atom?",
     ("Chlorine has a greater nuclear charge, and its valence electrons are in the same shell, so they are pulled closer to the nucleus.", "Across a period the nuclear charge increases while the valence shell stays the same, which draws the electrons in."),
     [("Chlorine has more electron shells than sodium, so its electrons are held more tightly.", "Sodium and chlorine have the same number of occupied shells."), ("Chlorine has fewer protons than sodium, so it has a weaker nuclear charge.", "Chlorine has more protons than sodium."), ("Chlorine electrons repel each other more strongly than sodium electrons do, so they are closer to the nucleus.", "Greater repulsion would increase the size, not decrease it.")]),
    ("Which statement best explains why the first ionization energy of potassium is lower than that of sodium?",
     ("The valence electron of potassium is in a shell farther from the nucleus and is more shielded, so it is easier to remove.", "A larger distance and greater shielding reduce the attraction between the nucleus and the valence electron."),
     [("Potassium has a greater nuclear charge acting on its valence electron than sodium has.", "The effective pull on the valence electron is not greater in potassium; the added shell and shielding dominate."), ("Potassium has fewer electron shells than sodium.", "Potassium has more shells than sodium."), ("Potassium atoms have a smaller radius than sodium atoms.", "Potassium atoms are larger than sodium atoms.")])],
    "explain a periodic trend with nuclear charge, shielding, and distance")

ch_t5_p1_strong_acid_particles = _b("ch_t5_p1_strong_acid_particles", "8.1", "1.A", [
    ("A particulate representation of a 0.10 M aqueous solution of HCl is drawn. Which description of the solute particles is consistent with HCl being a strong acid?",
     ("Nearly all the solute appears as H₃O⁺ and Cl⁻ ions, with essentially no HCl molecules remaining.", "A strong acid ionizes essentially completely in water."),
     [("Most of the solute appears as intact HCl molecules, with a few H₃O⁺ and Cl⁻ ions.", "That describes a weak acid, which ionizes only slightly."), ("The solute appears as equal numbers of H₃O⁺ ions and OH⁻ ions.", "Equal numbers of H₃O⁺ and OH⁻ describe a neutral solution, not an acidic one."), ("The solute appears as HCl molecules surrounded by water molecules, with no ions.", "Strong acids are ionized, so ions are present rather than only molecules.")]),
    ("Equal concentrations of HNO₃ (a strong acid) and HF (a weak acid) are prepared. Which statement describes how the solutions differ at the particulate level?",
     ("The HNO₃ solution contains a much larger concentration of H₃O⁺ ions because HNO₃ ionizes nearly completely.", "A strong acid ionizes nearly completely, whereas a weak acid ionizes only to a small extent."),
     [("The HF solution contains a larger concentration of H₃O⁺ ions because HF molecules are smaller.", "Strength depends on the extent of ionization, not on the size of the molecule."), ("The two solutions contain the same concentration of H₃O⁺ ions because their concentrations are equal.", "Equal concentrations of acid do not give equal ion concentrations unless both ionize to the same extent."), ("The HNO₃ solution contains no water molecules because the acid is strong.", "All aqueous solutions are mostly water molecules.")])],
    "describe the particles in strong and weak acid solutions")

ch_t5_p1_weak_base_particles = _b("ch_t5_p1_weak_base_particles", "8.3", "1.A", [
    ("A student draws a particulate diagram of an aqueous solution of the weak base NH₃. Which set of species should be shown as the main solute species?",
     ("Mostly NH₃ molecules, with a small number of NH₄⁺ and OH⁻ ions.", "A weak base reacts with water only to a small extent, so most of the solute remains as molecules."),
     [("Mostly NH₄⁺ and OH⁻ ions, with a small number of NH₃ molecules.", "That would be the picture for a strong base or a base that ionizes extensively."), ("Equal numbers of NH₃ molecules and H₃O⁺ ions.", "A basic solution has more OH⁻ than H₃O⁺."), ("Only NH₃ molecules and no ions.", "Some NH₃ does react with water, so a few ions must be shown.")]),
    ("Which particulate description matches a 0.10 M solution of a weak acid HA at equilibrium?",
     ("Most of the solute is present as HA molecules, with a small concentration of H₃O⁺ and A⁻ ions.", "A weak acid is only slightly ionized, so HA molecules greatly outnumber ions."),
     [("The solute is present entirely as H₃O⁺ and A⁻ ions.", "That describes complete ionization, a strong acid."), ("The solute is present as equal numbers of HA molecules and A⁻ ions only.", "Each A⁻ ion is accompanied by an H₃O⁺ ion, and a weak acid is mostly un-ionized."), ("There are more H₃O⁺ ions than HA molecules.", "For a weak acid the un-ionized molecules outnumber the ions.")])],
    "match particle drawings to weak acid and base ionization")

ch_t5_p1_buffer_particles = _b("ch_t5_p1_buffer_particles", "8.4", "1.A", [
    ("A particulate diagram of a buffer shows many HA molecules and many A⁻ ions in solution. Which description best identifies why this mixture resists a change in pH when a small amount of strong acid is added?",
     ("The A⁻ ions react with the added H₃O⁺ ions, converting them to HA and limiting the change in [H₃O⁺].", "The conjugate base consumes added acid."),
     [("The HA molecules react with the added H₃O⁺ ions to form A⁻ ions.", "HA is an acid and does not react with additional acid."), ("The water molecules absorb the added H₃O⁺ ions without changing the pH.", "Adding a strong acid to water alone changes the pH substantially."), ("The A⁻ ions and HA molecules combine to form a precipitate.", "A buffer remains in solution.")]),
    ("A solution contains HA molecules and A⁻ ions in comparable amounts. A small amount of OH⁻ is added. Which statement describes what happens at the particulate level?",
     ("The HA molecules react with OH⁻ to form A⁻ ions and water, so [OH⁻] stays small.", "The weak acid component consumes added base."),
     [("The A⁻ ions react with OH⁻ ions to form HA molecules.", "A⁻ is a base and does not react with additional base."), ("The OH⁻ ions remain in solution and raise the pH sharply.", "A buffer limits the pH change by consuming the added base."), ("The HA molecules ionize completely, adding H₃O⁺ to the solution.", "HA is weak and does not ionize completely.")])],
    "identify the buffer components that react with added acid or base")

ch_t5_p1_conjugate_pairs = _b("ch_t5_p1_conjugate_pairs", "8.1", "1.A", [
    ("In the reaction NH₃ + H₂O ⇌ NH₄⁺ + OH⁻, which species is the conjugate acid of the base NH₃?",
     ("NH₄⁺", "NH₃ accepts a proton to become NH₄⁺, which is its conjugate acid."),
     [("OH⁻", "OH⁻ is the conjugate base of H₂O."), ("H₂O", "H₂O is the Brønsted-Lowry acid in this reaction, not the conjugate acid of NH₃."), ("NH₃", "NH₃ is the base; it is not its own conjugate acid.")]),
    ("In the reaction HCN + H₂O ⇌ H₃O⁺ + CN⁻, which species is the conjugate base of the acid HCN?",
     ("CN⁻", "HCN donates a proton and forms CN⁻, its conjugate base."),
     [("H₃O⁺", "H₃O⁺ is the conjugate acid of H₂O."), ("H₂O", "H₂O is the base that accepts the proton, not the conjugate base of HCN."), ("HCN", "HCN is the acid; it is not its own conjugate base.")])],
    "identify conjugate acid-base pairs in a proton-transfer reaction")

ch_t5_p1_titration_particles = _b("ch_t5_p1_titration_particles", "8.5", "1.A", [
    ("A solution of a strong acid is titrated with a strong base. At the equivalence point, which particles are present in the greatest amounts, besides water molecules?",
     ("Cation and anion spectator ions from the salt formed, with very few H₃O⁺ or OH⁻ ions.", "At the equivalence point the acid and base have reacted completely, leaving the ions of the salt."),
     [("Un-ionized acid molecules and OH⁻ ions.", "Acid molecules have been consumed at the equivalence point."), ("Large amounts of H₃O⁺ ions from the unreacted acid.", "No acid remains at the equivalence point."), ("Large amounts of OH⁻ ions from the added base.", "OH⁻ ions are present in excess only after the equivalence point.")]),
    ("Before any base is added, a weak acid HA is titrated with NaOH. After half of the acid has been neutralized, which species are present in comparable amounts?",
     ("HA molecules and A⁻ ions.", "At the half-equivalence point half the acid has been converted to its conjugate base."),
     [("H₃O⁺ ions and OH⁻ ions.", "These are present only in very small, equal amounts in a neutral solution."), ("Na⁺ ions and OH⁻ ions only.", "Hydroxide is consumed by the acid before the equivalence point."), ("HA molecules and Na⁺ ions only.", "A⁻ ions have formed from the reaction and must also be present.")])],
    "identify the main species at points in an acid-base titration")

ch_t5_p1_ionic_lattice = _b("ch_t5_p1_ionic_lattice", "2.3", "1.A", [
    ("Which description best matches the particulate structure of solid sodium chloride?",
     ("A repeating three-dimensional lattice of alternating Na⁺ and Cl⁻ ions held together by electrostatic attractions.", "An ionic solid consists of a lattice of cations and anions."),
     [("Discrete NaCl molecules held together by weak dispersion forces.", "Ionic compounds do not form discrete molecules in the solid."), ("Sodium atoms and chlorine atoms sharing electrons in a network of covalent bonds.", "Sodium chloride has ionic, not covalent, bonding."), ("A sea of delocalized electrons surrounding Na⁺ ions.", "That describes a metal, not an ionic compound.")]),
    ("A solid is formed from Mg²⁺ ions and O²⁻ ions. How does the particulate arrangement of MgO compare with the arrangement in NaCl?",
     ("Both are lattices of alternating cations and anions, but MgO has stronger attractions because the ions have greater charges.", "Coulomb's law shows that larger charges give stronger attractions."),
     [("MgO contains discrete molecules while NaCl contains a lattice.", "Both MgO and NaCl are ionic lattices."), ("MgO has weaker attractions because the ions have greater charges.", "Greater charges strengthen the electrostatic attraction."), ("MgO contains a sea of delocalized electrons shared by all of the ions.", "That describes a metal rather than an ionic solid.")])],
    "describe an ionic solid as a lattice and relate lattice strength to ion charge")

ch_t5_p1_metal_particles = _b("ch_t5_p1_metal_particles", "2.4", "1.B", [
    ("Which statement best explains at the particulate level why a solid piece of copper conducts electricity?",
     ("Copper contains delocalized valence electrons that can move through the lattice of Cu cations.", "Metallic bonding provides mobile electrons that carry charge."),
     [("Copper contains Cu²⁺ and Cu⁻ ions that move through the solid.", "The ions in a metal are fixed in position in the lattice."), ("Copper contains discrete molecules that pass electrons between them.", "Metals are not made of discrete molecules."), ("The bonds in copper are polar covalent, so charge moves along them.", "Metallic bonding is not polar covalent bonding.")]),
    ("An alloy of copper and zinc (brass) is harder than pure copper. Which statement offers the best particulate-level explanation?",
     ("The zinc atoms are a different size from the copper atoms and disrupt the regular layers, making it harder for layers to slide.", "Atoms of different sizes in the lattice hinder layer movement."),
     [("The zinc atoms form covalent bonds with all of the copper atoms.", "Metals in alloys are held by metallic bonding, not new covalent bonds."), ("The zinc atoms are identical in size to the copper atoms, which locks the layers in place.", "Identical atoms would allow layers to slide as in a pure metal."), ("The zinc atoms remove the delocalized electrons, so the metal is hard.", "The delocalized electrons remain in an alloy.")])],
    "link metallic bonding and lattice structure to properties")

ch_t5_p1_lewis_electron_count = _b("ch_t5_p1_lewis_electron_count", "2.5", "1.A", [
    ("How many valence electrons must appear in the Lewis diagram of the sulfate ion, SO₄²⁻?",
     ("32", "The valence electrons are 6 for S plus 24 for four O atoms plus 2 for the 2− charge: 32."),
     [("30", "This leaves out the two extra electrons from the 2− charge."), ("34", "This adds the charge electrons twice."), ("24", "This counts only the oxygen atoms.")]),
    ("How many valence electrons must appear in the Lewis diagram of the ammonium ion, NH₄⁺?",
     ("8", "N contributes 5 and four H atoms contribute 4, giving 9 electrons; the 1+ charge removes one, leaving 8."),
     [("9", "This forgets to remove one electron for the 1+ charge."), ("10", "This adds an electron for the charge instead of removing one."), ("5", "This counts only the nitrogen atom.")])],
    "count valence electrons for a polyatomic ion")

ch_t5_p1_vsepr_shape = _b("ch_t5_p1_vsepr_shape", "2.7", "1.A", [
    ("Which molecular geometry is predicted for PF₃, which has a central phosphorus atom with three bonding pairs and one lone pair?",
     ("Trigonal pyramidal", "Four electron domains arranged tetrahedrally with one lone pair give a trigonal pyramidal shape."),
     [("Trigonal planar", "A trigonal planar shape requires three electron domains and no lone pair."), ("Tetrahedral", "A tetrahedral shape requires four bonding pairs and no lone pairs."), ("Bent", "A bent shape requires two bonding pairs with one or two lone pairs.")]),
    ("Which molecular geometry is predicted for SF₄, which has a central sulfur atom with four bonding pairs and one lone pair?",
     ("Seesaw", "Five electron domains give a trigonal bipyramidal arrangement, and one lone pair gives a seesaw shape."),
     [("Square planar", "Square planar requires four bonding pairs and two lone pairs."), ("Tetrahedral", "Tetrahedral requires four electron domains in total, not five."), ("Trigonal bipyramidal", "That shape requires five bonding pairs and no lone pairs.")])],
    "predict a molecular geometry from bonding and lone pairs")

ch_t5_p1_imf_picture = _b("ch_t5_p1_imf_picture", "3.1", "1.B", [
    ("Liquid HF and liquid HCl are compared. Which statement offers the best particulate-level explanation for why HF has a much higher boiling point?",
     ("HF molecules form hydrogen bonds with each other, which are stronger than the dipole-dipole forces between HCl molecules.", "Hydrogen bonding between molecules with H bonded to F is stronger than ordinary dipole-dipole attraction."),
     [("HF molecules have a larger electron cloud, so dispersion forces are much greater than in HCl.", "HCl has the larger electron cloud, so its dispersion forces are greater."), ("The H–F bond is weaker than the H–Cl bond, so HF molecules break apart more easily.", "Boiling involves overcoming intermolecular forces, not breaking the covalent bond."), ("HF is ionic, so its particles are held by ionic bonds.", "HF is a covalent molecule.")]),
    ("Pentane, C₅H₁₂, and neopentane, C₅H₁₂, are isomers. Pentane boils at a higher temperature. Which statement best explains this difference?",
     ("Elongated pentane molecules have more surface contact, so their dispersion forces are stronger.", "Shape affects the amount of surface contact and therefore the dispersion forces."),
     [("Pentane molecules are polar and neopentane molecules are nonpolar.", "Both are nonpolar hydrocarbons."), ("Pentane molecules form hydrogen bonds with each other.", "Hydrocarbons do not have hydrogen bonds."), ("Pentane has more electrons than neopentane, so it is more polarizable.", "The isomers have the same formula and the same number of electrons.")])],
    "explain boiling point differences with intermolecular forces")

ch_t5_p1_solution_particles = _b("ch_t5_p1_solution_particles", "3.8", "1.A", [
    ("A particulate diagram of an aqueous solution of KBr shows ions surrounded by water molecules. Which orientation of water molecules is correct around a K⁺ ion?",
     ("The oxygen ends of the water molecules point toward the K⁺ ion.", "The partially negative oxygen atoms are attracted to the positive cation."),
     [("The hydrogen ends of the water molecules point toward the K⁺ ion.", "The partially positive hydrogen atoms would be repelled by a cation."), ("The water molecules form a ring around the ion with no particular orientation.", "Ion-dipole attractions orient the water molecules."), ("The water molecules are absent near the ion because ions repel water.", "Ions are stabilized by attraction to water molecules.")]),
    ("A sugar, C₁₂H₂₂O₁₁, dissolves in water to give a solution that does not conduct electricity. Which particulate representation of the solution is consistent with this observation?",
     ("Intact sugar molecules dispersed among water molecules, with no ions present.", "Molecular solutes that do not ionize leave no mobile ions to carry charge."),
     [("Positive and negative sugar ions dispersed among water molecules.", "Sugar does not form ions in water, so the solution would conduct if it did."), ("Sugar atoms separated from each other and surrounded by water.", "The molecules remain intact when sugar dissolves."), ("Water molecules arranged in a lattice around a solid sugar core.", "A dissolved solute is dispersed, not a solid core.")])],
    "draw or describe the species in an aqueous solution")

ch_t5_p1_reaction_energy = _b("ch_t5_p1_reaction_energy", "6.1", "1.B", [
    ("A cold pack becomes colder when the contents dissolve in water. Which statement correctly relates the particulate process to the temperature change?",
     ("The dissolving process absorbs energy from the surroundings, which lowers the temperature of the water.", "An endothermic process takes in energy from the surroundings."),
     [("The dissolving process releases energy to the surroundings, which lowers the temperature.", "Releasing energy would raise the temperature of the water."), ("The dissolving process creates energy, which cools the water.", "Energy is transferred rather than created."), ("The temperature falls because the solute particles are colder than the water.", "The temperature change is due to the energy absorbed by the process.")]),
    ("A hand warmer becomes hot when its contents react. Which statement relates the bond changes to the temperature change?",
     ("More energy is released in forming the bonds of the products than is absorbed in breaking the bonds of the reactants.", "An exothermic reaction releases net energy to the surroundings."),
     [("More energy is absorbed in breaking the bonds of the reactants than is released in forming the bonds of the products.", "That describes an endothermic reaction."), ("No energy is needed to break bonds in the reactants.", "Breaking bonds always requires energy."), ("Energy is released when bonds break and absorbed when bonds form.", "Breaking bonds absorbs energy and forming bonds releases energy.")])],
    "relate bond energy changes to heat flow")
