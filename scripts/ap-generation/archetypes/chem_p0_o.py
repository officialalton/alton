"""AP Chemistry 원형 O — CH3 새 풀이 틀 2차(2026-10-19): 실험·표현·논증 칸(P1·P2·P4·P6)을 메우는 고정 문장 은행 원형 + 평형 ICE 계산 1개.
각 원형은 서로 다른 화학 장면 3개를 갖고, 시드가 장면을 고른다. 정답 1 + 이름 붙은 오개념 3. 필요한 정보는 모두 본문에 있다."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_o"
    return f


# ---- Unit 1, practice 2 ----
ch_o_isotope_question = _b("ch_o_isotope_question", "1.2", "2.A", [
    ("A student wants to test whether a sample of an element has the same isotopic composition as the value tabulated for natural samples. Which question can be answered with a mass spectrum of the sample?",
     ("What is the relative abundance of each isotope, as shown by the peak heights?", "A mass spectrum gives isotopic masses and relative abundances."),
     [("What is the number of valence electrons in each atom of the element?", "Valence electron count comes from photoelectron spectroscopy or the periodic table, not from isotope peaks."), ("What is the type of bonding between atoms of the element in the solid?", "Peaks in a mass spectrum do not show bonding."), ("What is the melting point of the element?", "A mass spectrum does not give any bulk property such as melting point.")]),
    ("A chemist obtains a photoelectron spectrum of a sample of an element. Which question about the element can be addressed directly from the spectrum?",
     ("How many electrons are in each subshell, from the peak positions and heights?", "PES peaks show binding energies of subshells and the relative numbers of electrons."),
     [("What is the average atomic mass of the element?", "Average atomic mass comes from a mass spectrum."), ("What is the mass of one mole of the sample?", "A PES spectrum does not give a mass."), ("What type of crystal structure does the solid element have?", "PES does not give crystal structure.")]),
    ("A student weighs a sample of a pure compound and wants to find its empirical formula by combustion analysis. Which question can be answered from the masses of CO2 and H2O that are collected?",
     ("What is the mole ratio of carbon to hydrogen in the compound?", "The masses of CO2 and H2O give moles of C and H."),
     [("What is the melting point of the compound?", "Combustion products do not give a melting point."), ("What is the shape of the molecule?", "Combustion analysis does not reveal geometry."), ("Which isotopes of carbon are present in the compound?", "The masses of CO2 and H2O do not identify isotopes.")]),
], "choose a testable question that a given measurement can answer")

ch_o_hydrate_procedure = _b("ch_o_hydrate_procedure", "1.3", "2.C", [
    ("A student wants to find the percent by mass of water in a hydrated salt. Which procedure is best?",
     ("Heat a weighed hydrate in a crucible, cool it, and reweigh it until the mass is constant.", "Heating to constant mass drives off all the water and the mass lost is the water."),
     [("Dissolve the hydrate in a known volume of water and measure the mass of the solution.", "Dissolving does not separate the water of hydration from the added water."), ("Heat the sample once for ten seconds and weigh it while it is still hot.", "A single short heating may be incomplete, and a hot sample gives a false mass."), ("Add excess water to the hydrate and weigh the mixture.", "Adding water increases the mass and does not remove the water of hydration.")]),
    ("A student wants to determine the percent of calcium carbonate in a mixture with sand by measuring the carbon dioxide released. Which procedure is best?",
     ("Add excess acid to a weighed sample on a balance and record the mass lost as it bubbles.", "CaCO3 reacts with acid to release CO2, and sand does not."),
     [("Heat the sample until it melts and record the change in mass.", "Neither compound melts at these conditions, and sand would not lose mass."), ("Add water to the sample, filter it and weigh the residue.", "Both calcium carbonate and sand are insoluble, so they are not separated by water."), ("Add excess base and record the mass of gas released.", "Calcium carbonate does not release a gas with a base.")]),
    ("A student wants to find the percent by mass of copper in a brass sample using a reaction in which only the zinc dissolves in acid. Which procedure is best?",
     ("Add excess acid until no gas forms, filter and dry the copper, and weigh it.", "Only the zinc reacts, so the leftover solid is copper whose mass gives the percent."),
     [("Weigh the sample, add acid and weigh the solution that forms.", "The mass of the solution includes the acid and so does not give the mass of copper."), ("Heat the sample in air and measure the gas given off.", "Heating brass in air does not release a gas that depends on its composition."), ("Add excess acid and record the mass of the filtrate only.", "The filtrate contains the dissolved zinc and the added acid, not the copper.")]),
], "choose a procedure for a gravimetric analysis")

ch_o_periodic_predict = _b("ch_o_periodic_predict", "1.7", "2.B", [
    ("A student predicts that the first ionization energy of aluminum is lower than that of magnesium. Which statement best supports the prediction?",
     ("The outermost electron of aluminum is in a 3p subshell, which is higher in energy than the 3s subshell.", "A 3p electron is easier to remove than a 3s electron."),
     [("Aluminum has a larger nuclear charge, so its electrons are held more weakly.", "A larger nuclear charge by itself would increase ionization energy."), ("Aluminum atoms are smaller than magnesium atoms, so their electrons are more loosely held.", "Aluminum atoms are smaller, but size is not the reason for the exception."), ("The 3p subshell is lower in energy than the 3s subshell.", "The 3p subshell is higher in energy than the 3s subshell of the same shell.")]),
    ("A student predicts that the atomic radius of S²⁻ is greater than that of S. Which statement best supports the prediction?",
     ("The ion has the same nuclear charge but two more electrons, so electron repulsion expands the cloud.", "More electrons with the same nuclear charge give a larger radius."),
     [("The ion has a larger nuclear charge, so it pulls the electrons less strongly.", "The nuclear charge does not change."), ("The ion has fewer electrons, so it has a smaller attraction between the nucleus and the electrons.", "S²⁻ has two more electrons than S."), ("The ion has a different number of protons than the atom.", "An atom becomes an ion by gaining electrons, not by changing its protons.")]),
    ("A student predicts that the first ionization energy of oxygen is lower than that of nitrogen. Which statement best supports the prediction?",
     ("The paired 2p electron of oxygen feels extra repulsion, so it is easier to remove.", "The paired 2p electron in oxygen feels extra repulsion."),
     [("Oxygen has a smaller nuclear charge than nitrogen.", "Oxygen has a larger nuclear charge."), ("Oxygen has a larger atomic radius than nitrogen, so it holds its electrons weakly.", "Oxygen is slightly smaller than nitrogen."), ("The outermost electron in oxygen is in a 3s subshell.", "The outermost electron of oxygen is in the 2p subshell.")]),
], "make a prediction about a periodic property and support it")

ch_o_mixture_error = _b("ch_o_mixture_error", "1.4", "2.E", [
    ("In an experiment to find the mass percent of water in a hydrate, a student weighed the crucible and sample after heating but did not let it cool. The mass reading was too low because of rising air currents. How does this error affect the calculated percent of water?",
     ("Too high, because the apparent final mass is low and so the mass lost seems larger.", "A low final mass makes the mass loss look too large."),
     [("The calculated percent water is too low, because the final mass is too low.", "A lower final mass increases the calculated mass lost."), ("There is no effect, because the same crucible is used for both masses.", "The error is in the final mass and does not cancel."), ("The calculated percent water is too low, because the initial mass is too high.", "The initial mass was measured correctly.")]),
    ("A student separates a mixture of sand and salt by dissolving the salt in water, filtering, and drying the sand. The sand was weighed while still wet. How does this error affect the calculated percent of sand?",
     ("The calculated percent of sand is too high, because the mass includes water.", "Extra water raises the measured mass of the residue."),
     [("The calculated percent of sand is too low, because the water is not part of the sample.", "The added water increases, not decreases, the measured mass."), ("There is no effect, because water evaporates when it is weighed.", "Water does not evaporate fast enough to be neglected and the mass reading includes it."), ("The calculated percent of salt is too high, because the sand is wet.", "A wet sand mass makes the calculated percent of salt too low.")]),
    ("A student heats a hydrate until the mass is constant, but some of the anhydrous salt spatters out of the crucible during heating. How does this error affect the calculated percent of water in the hydrate?",
     ("The calculated percent water is too high, because the mass lost includes the salt that spattered out.", "Lost salt is counted as lost water."),
     [("The calculated percent water is too low, because less water was driven off.", "The spattered salt increases the apparent mass loss."), ("There is no effect, because the salt does not contain water.", "The anhydrous salt lost is counted as mass lost in the calculation."), ("The calculated percent water is too low, because the mass of the sample is too high.", "The initial mass was measured correctly.")]),
], "identify the effect of an experimental error on a calculated mass percent")

# ---- Unit 2, practice 1 and 6 ----
ch_o_lewis_choice = _b("ch_o_lewis_choice", "2.5", "1.A", [
    ("Which Lewis structure best represents HCN?",
     ("H–C≡N with a lone pair on the nitrogen atom.", "Hydrogen forms one bond, carbon four bonds, and nitrogen three bonds plus one lone pair, and the structure has 10 valence electrons."),
     [("H–C=N with two lone pairs on the nitrogen atom.", "Carbon has only three bonds in this structure and fails the octet rule."), ("H=C=N with a lone pair on the nitrogen atom.", "Hydrogen cannot form a double bond."), ("H–C–N with three lone pairs on the nitrogen atom.", "Carbon has only two bonds, so it has an incomplete octet.")]),
    ("Which Lewis structure best represents the carbonate ion, CO3²⁻?",
     ("Carbon with one double and two single bonds to oxygen, a −1 charge on each single-bonded oxygen, and resonance.", "The ion has 24 valence electrons and three equivalent resonance structures."),
     [("A carbon atom with three double bonds to oxygen atoms.", "This gives 24 electrons but a formal charge distribution that does not equal the −2 charge of the ion."), ("A carbon atom with three single bonds to oxygen atoms and no charges on the oxygen atoms.", "The charge of −2 must be shown on the atoms."), ("An oxygen atom in the center bonded to a carbon atom and two oxygen atoms.", "Carbon is the central atom of the ion.")]),
    ("Which Lewis structure best represents the ammonium ion, NH4⁺?",
     ("A nitrogen atom with four single bonds to hydrogen atoms, no lone pair, and a formal charge of +1.", "Nitrogen has eight electrons in four bonds, with 8 valence electrons in all."),
     [("A nitrogen atom with three single bonds to hydrogen atoms, one lone pair, and a charge of +1.", "This is the structure of NH3 with an extra charge that does not account for the fourth hydrogen atom."), ("A nitrogen atom with four single bonds and one lone pair.", "This has ten electrons around nitrogen, which violates the octet rule for nitrogen."), ("A nitrogen atom with two double bonds to two hydrogen atoms.", "Hydrogen cannot form double bonds.")]),
], "choose the correct Lewis structure from the valence electron count")

ch_o_vsepr_shape = _b("ch_o_vsepr_shape", "2.6", "1.A", [
    ("Which of the following correctly gives the molecular geometry of SF4, a molecule with four bonded atoms and one lone pair on the central atom?",
     ("See-saw, because the lone pair is equatorial in a trigonal bipyramid of five domains.", "Five domains give a trigonal bipyramidal arrangement and one lone pair gives a see-saw shape."),
     [("Tetrahedral, because there are four bonded atoms.", "Lone pairs must be counted as domains, so the electron-domain geometry is trigonal bipyramidal."), ("Square planar, because there are four bonded atoms in one plane.", "Square planar needs two lone pairs on an octahedral arrangement."), ("Trigonal pyramidal, because there is one lone pair.", "A trigonal pyramid has three bonded atoms and one lone pair.")]),
    ("Which of the following correctly gives the molecular geometry of XeF2, a molecule with two bonded atoms and three lone pairs on the central atom?",
     ("Linear, because the three lone pairs are equatorial and the two bonds are axial.", "The three lone pairs lie in a plane and the two bonds point in opposite directions."),
     [("Bent, because there are three lone pairs.", "A bent shape requires lone pairs that are not placed symmetrically."), ("T-shaped, because there are three lone pairs.", "T-shaped molecules have two lone pairs and three bonded atoms."), ("Trigonal planar, because there are three electron pairs in a plane.", "The bonded atoms are two, and they define a linear arrangement.")]),
    ("Which of the following correctly gives the molecular geometry of the chlorate ion, ClO3⁻, with three bonded atoms and one lone pair on the central chlorine atom?",
     ("Trigonal pyramidal, because four tetrahedral domains include one lone pair.", "Four domains give a tetrahedral arrangement and the lone pair gives a pyramid."),
     [("Trigonal planar, because there are three bonded atoms.", "The lone pair must be counted as a domain."), ("Tetrahedral, because there are four electron domains.", "Tetrahedral molecular geometry requires four bonded atoms."), ("Bent, because chlorine has a lone pair.", "A bent shape has two bonded atoms.")]),
], "predict the molecular geometry from the electron domains")

ch_o_bond_order_length = _b("ch_o_bond_order_length", "2.4", "1.B", [
    ("Which of the following correctly ranks the carbon–carbon bonds in C2H6, C2H4 and C2H2 in order of increasing bond length?",
     ("C2H2 < C2H4 < C2H6, because a higher bond order gives a shorter bond.", "A higher bond order brings the nuclei closer together."),
     [("C2H6 < C2H4 < C2H2, because more bonds make the atoms repel more.", "A higher bond order shortens the bond."), ("C2H2 = C2H4 = C2H6, because all of them join two carbon atoms.", "The bond length depends on the bond order."), ("C2H4 < C2H2 < C2H6, because a double bond is the shortest.", "A triple bond is shorter than a double bond.")]),
    ("A student compares the bond energies of the $\\mathrm{N-N}$, $\\mathrm{N=N}$ and $\\mathrm{N\\equiv N}$ bonds. Which of the following is correct?",
     ("The bond energy increases from N–N to N=N to N≡N, because more shared pairs bind more strongly.", "A higher bond order gives a higher bond energy."),
     [("The bond energy decreases from N–N to N≡N, because shorter bonds are weaker.", "Shorter bonds of a higher order are stronger."), ("All three bonds have the same energy because they join nitrogen atoms.", "Bond energy increases with the bond order."), ("The N=N bond has the highest energy, because double bonds are the most stable.", "The triple bond has the highest energy.")]),
    ("In the carbonate ion, CO3²⁻, the three carbon–oxygen bonds are identical. How does the length of each C–O bond compare with a $\\mathrm{C=O}$ bond and a $\\mathrm{C-O}$ single bond?",
     ("It is between the two, because the resonance forms give each bond an average order of 4/3.", "Delocalization gives an intermediate bond order."),
     [("It is the same as the C=O bond, because one resonance form has a double bond.", "Each bond is the average of the resonance forms, not equal to the double bond."), ("It is the same as the C–O single bond, because the ion has a negative charge.", "The extra charge does not change the bond order to one."), ("It is longer than both, because resonance weakens all bonds.", "Resonance gives an intermediate length and not a longer one.")]),
], "relate bond order to bond length and bond energy")

ch_o_conductivity_claim = _b("ch_o_conductivity_claim", "2.1", "6.A", [
    ("A student observes that solid NaCl does not conduct electricity but molten NaCl does. Which claim is best supported by this evidence?",
     ("Charged ions are present in NaCl and conduct only when they are free to move in the liquid.", "Conduction requires mobile charge carriers."),
     [("NaCl contains delocalized electrons that are free only in the liquid.", "Ionic solids do not contain delocalized electrons."), ("NaCl is a molecular substance that becomes ionic when it melts.", "The ions already exist in the solid, where they are fixed in the lattice."), ("NaCl has no charged particles in either state.", "The conduction of the liquid shows the presence of charge carriers.")]),
    ("A student finds that a solid element conducts electricity in the solid state and is malleable. Which claim is best supported by this evidence?",
     ("The element is a metal, with a lattice of cations surrounded by delocalized valence electrons.", "Metals conduct because their valence electrons are mobile and are malleable because the electron sea allows the layers to slide."),
     [("The element is an ionic solid, with oppositely charged ions in a lattice.", "Ionic solids do not conduct in the solid state and are brittle."), ("The element is a network covalent solid, with atoms joined by covalent bonds.", "Network solids are hard and brittle and generally do not conduct."), ("The element is a molecular solid, with weak forces between the molecules.", "A molecular solid is soft and a poor conductor.")]),
    ("A solid is hard, has a very high melting point, and does not conduct electricity as a solid or when melted. Which claim is best supported?",
     ("A network covalent solid, in which atoms are covalently bonded throughout the crystal.", "A hard and non-conducting solid with a very high melting point fits a covalent network."),
     [("The solid is an ionic solid, because it has a high melting point.", "An ionic solid would conduct when it melts."), ("The solid is a metallic solid, because it is hard.", "A metal would conduct electricity when it is melted, so it does not fit."), ("The solid is a molecular solid, because it does not conduct.", "A molecular solid has a low melting point and is soft.")]),
], "make a claim about bonding from conductivity and physical properties")

# ---- Unit 3, practice 2 and 6 ----
ch_o_gas_question = _b("ch_o_gas_question", "3.4", "2.A", [
    ("A student wants to test how the volume of a gas sample depends on its temperature. Which question can be answered by an experiment in which the temperature is varied?",
     ("How does the volume of a fixed amount of gas change as the temperature changes, at constant pressure?", "The question names the variable that is changed, the one that is measured and the ones that are held constant."),
     [("How does the volume of the gas change when the pressure and the temperature are changed at the same time?", "Changing two variables at once does not allow a conclusion about temperature."), ("Is the gas an ideal gas?", "This is not a question about the temperature dependence of the volume."), ("What is the color of the gas at different temperatures?", "Color is not the quantity under study.")]),
    ("A student wants to find out how the pressure of a gas depends on the number of moles of gas in a rigid container. Which question is testable?",
     ("How does the pressure change as moles are added to a rigid container at constant T?", "The volume and the temperature are held constant, and only the moles change."),
     [("How does the pressure change when the container is allowed to expand while moles are added?", "A change in volume would also change the pressure."), ("Does the pressure depend on the gas's color?", "Color is not a relevant variable."), ("Why is the gas pressure always the same?", "The question assumes a result that the experiment is designed to test.")]),
    ("A student wants to determine whether two gases at the same temperature and pressure have the same average kinetic energy. Which question is testable?",
     ("Do gases at the same temperature have the same average kinetic energy per particle?", "Temperature is a measure of the average kinetic energy of the particles."),
     [("Do two gases at the same temperature always have the same particle speed?", "Particle speed depends on molar mass as well."), ("Is the more massive gas faster?", "At the same temperature, a more massive particle is slower on average."), ("Does one gas move faster because its pressure is higher?", "The statement is not testable at a fixed temperature without changing the number of particles.")]),
], "choose a testable question about gas behavior")

ch_o_separation_procedure = _b("ch_o_separation_procedure", "3.9", "2.C", [
    ("A mixture contains two liquids, ethanol (boiling point 78 °C) and water (boiling point 100 °C). Which procedure best separates them?",
     ("Distill the mixture and collect the liquid that condenses near 78 °C.", "The component with the lower boiling point vaporizes first."),
     [("Filter the mixture through filter paper.", "Both components are liquids that pass through the filter."), ("Add salt and collect the solid that forms.", "Adding salt does not separate two miscible liquids."), ("Cool the mixture to 50 °C and pour off the water.", "Cooling does not separate liquids that are miscible.")]),
    ("A mixture contains iron filings and sand. Which procedure best separates them?",
     ("Pass a magnet over it to remove the iron filings.", "Iron is attracted to a magnet and sand is not."),
     [("Add water and filter the mixture.", "Neither component dissolves in water."), ("Heat the mixture until one component melts.", "The melting points are far above laboratory temperatures."), ("Distill the mixture.", "Neither iron nor sand is a liquid, so there is nothing to distill.")]),
    ("A student wants to separate the pigments in a sample of ink using paper chromatography. Which procedure is best?",
     ("Spot the ink on a paper strip and let solvent rise.", "The pigments separate by their different attraction to the paper and to the solvent."),
     [("Immerse the spot of ink in the solvent.", "The ink dissolves into the solvent in the container and does not separate."), ("Heat the paper until the ink melts.", "Heat does not separate the pigments by their polarity."), ("Add water to the ink and filter it.", "The pigments pass through filter paper together.")]),
], "choose a procedure for a separation based on physical properties")

ch_o_imf_justify = _b("ch_o_imf_justify", "3.1", "6.C", [
    ("Ethanol, C2H5OH, boils at 78 °C, and dimethyl ether, CH3OCH3, which has the same molar mass, boils at −24 °C. Which statement best justifies the difference?",
     ("Ethanol forms hydrogen bonds, which are stronger than dimethyl ether's dipole forces.", "Only ethanol has an O–H bond that allows hydrogen bonding."),
     [("Ethanol has a larger molar mass than dimethyl ether.", "The two have the same molar mass."), ("Ethanol has stronger covalent bonds than dimethyl ether.", "Boiling does not break covalent bonds within molecules."), ("Dimethyl ether has stronger dispersion forces than ethanol.", "The dispersion forces are similar for molecules of the same molar mass.")]),
    ("Pentane, C5H12, boils at 36 °C and neopentane, C5H12, which has the same formula, boils at 9 °C. Which statement best justifies the difference?",
     ("Pentane is long and contacts more, so its dispersion forces are stronger.", "A larger surface area gives more polarizable contact."),
     [("Pentane has a greater molar mass than neopentane.", "Both have the same molar mass."), ("Pentane forms hydrogen bonds, and neopentane does not.", "Neither contains an O–H, N–H or F–H bond."), ("Neopentane is polar, and pentane is not.", "Both molecules are nonpolar, so neither has a dipole to explain the difference.")]),
    ("HF boils at 20 °C and HCl boils at −85 °C. Which statement best justifies the difference?",
     ("HF forms hydrogen bonds, which are stronger than the forces in HCl.", "Hydrogen bonding requires H bonded to F, O or N."),
     [("HF has the greater molar mass.", "HCl has the greater molar mass."), ("The H–F bond is weaker than the H–Cl bond, so it breaks more easily.", "The H–F bond is stronger than the H–Cl bond, and boiling does not break it."), ("HCl is a nonpolar molecule.", "HCl is a polar molecule with a dipole between H and Cl.")]),
], "justify a boiling-point difference with intermolecular forces")

# ---- Unit 4, practice 4 and 6 ----
ch_o_net_ionic = _b("ch_o_net_ionic", "4.2", "4.A", [
    ("Solutions of AgNO3 and NaCl are mixed and a white precipitate forms. Which of the following is the net ionic equation?",
     ("Ag⁺(aq) + Cl⁻(aq) → AgCl(s)", "The silver and chloride ions combine; Na⁺ and NO3⁻ are spectator ions."),
     [("AgNO3(aq) + NaCl(aq) → AgCl(s) + NaNO3(aq)", "This is the molecular equation and not a net ionic equation."), ("Na⁺(aq) + NO3⁻(aq) → NaNO3(s)", "Sodium nitrate is soluble and does not precipitate."), ("Ag⁺(aq) + Na⁺(aq) → AgNa(s)", "Two cations do not combine.")]),
    ("Solutions of BaCl2 and Na2SO4 are mixed and a white precipitate forms. Which of the following lists the spectator ions?",
     ("Na⁺ and Cl⁻", "These ions stay dissolved and do not appear in the net ionic equation."),
     [("Ba²⁺ and SO4²⁻", "These ions form the precipitate BaSO4."), ("Ba²⁺ and Cl⁻", "Barium ions are in the precipitate."), ("Na⁺ and SO4²⁻", "The sulfate ions are in the precipitate.")]),
    ("A student adds hydrochloric acid to a solution of sodium hydroxide. Which of the following is the net ionic equation?",
     ("H⁺(aq) + OH⁻(aq) → H2O(l)", "Na⁺ and Cl⁻ are spectator ions."),
     [("HCl(aq) + NaOH(aq) → NaCl(aq) + H2O(l)", "This is the molecular equation."), ("Na⁺(aq) + Cl⁻(aq) → NaCl(s)", "Sodium chloride remains dissolved."), ("H2O(l) → H⁺(aq) + OH⁻(aq)", "This is the reverse of the reaction.")]),
], "write and interpret net ionic equations for precipitation and neutralization")

ch_o_acid_base_type = _b("ch_o_acid_base_type", "4.3", "4.B", [
    ("In the reaction NH3(aq) + H2O(l) ⇌ NH4⁺(aq) + OH⁻(aq), which species acts as the Brønsted-Lowry base in the forward reaction?",
     ("NH3, because it accepts a proton from H2O.", "A Brønsted-Lowry base is a proton acceptor."),
     [("H2O, because it accepts a proton.", "Water donates the proton in the forward reaction."), ("OH⁻, because it is produced.", "A product is not a base in the forward direction by this fact alone."), ("NH4⁺, because it has a positive charge.", "NH4⁺ donates a proton in the reverse reaction.")]),
    ("In the reaction HF(aq) + H2O(l) ⇌ F⁻(aq) + H3O⁺(aq), which is the conjugate base of HF?",
     ("F⁻, because it forms when HF loses a proton.", "A conjugate base is formed by the loss of a proton."),
     [("H3O⁺, because it forms from water.", "H3O⁺ is the conjugate acid of water."), ("H2O, because it reacts with HF.", "Water acts as the base here."), ("HF, because it is a weak acid.", "HF is the acid, not its conjugate base.")]),
    ("A strong acid, HCl, is added to a solution of sodium acetate, NaCH3COO. Which reaction occurs?",
     ("H⁺ combines with CH3COO⁻ to form CH3COOH.", "Acetate is the conjugate base of a weak acid."),
     [("H⁺ combines with Na⁺ to form NaH.", "Sodium ions are spectators."), ("Cl⁻ combines with CH3COO⁻ to form a precipitate.", "No precipitate forms when a proton transfer to acetate occurs."), ("CH3COO⁻ donates a proton to H⁺.", "Acetate has no proton to donate to a hydrogen ion.")]),
], "identify acids, bases and their conjugates in proton-transfer reactions")

ch_o_redox_agent = _b("ch_o_redox_agent", "4.9", "4.C", [
    ("In the reaction Mg(s) + 2 HCl(aq) → MgCl2(aq) + H2(g), which species is the oxidizing agent?",
     ("H⁺, because it is reduced to H2.", "The oxidizing agent is the species that is reduced."),
     [("Mg, because it is the metal.", "Magnesium is oxidized, so it is the reducing agent."), ("Cl⁻, because it is a spectator.", "Chloride is a spectator ion."), ("H2, because it is a product.", "H2 is the product of the reduction.")]),
    ("In the reaction 2 Fe³⁺(aq) + Sn²⁺(aq) → 2 Fe²⁺(aq) + Sn⁴⁺(aq), which species is the reducing agent?",
     ("Sn²⁺, because it loses electrons and is oxidized.", "The reducing agent is oxidized."),
     [("Fe³⁺, because it loses electrons.", "Fe³⁺ gains electrons, so it is the oxidizing agent."), ("Fe²⁺, because it is a product.", "Fe²⁺ is the reduced product."), ("Sn⁴⁺, because it has the higher charge.", "Sn⁴⁺ is the oxidized product.")]),
    ("Which of the following is a redox reaction?",
     ("2 Na(s) + Cl2(g) → 2 NaCl(s), because the oxidation numbers of both elements change.", "Sodium goes from 0 to +1 and chlorine from 0 to −1."),
     [("AgNO3(aq) + NaCl(aq) → AgCl(s) + NaNO3(aq), because a solid forms.", "No oxidation number changes in a precipitation reaction."), ("HCl(aq) + NaOH(aq) → NaCl(aq) + H2O(l), because water forms.", "A neutralization does not change oxidation numbers."), ("NaCl(s) → Na⁺(aq) + Cl⁻(aq), because ions form.", "Dissolving does not change oxidation numbers.")]),
], "identify oxidizing and reducing agents and redox reactions")

ch_o_precip_claim = _b("ch_o_precip_claim", "4.2", "6.C", [
    ("A student mixes solutions of Pb(NO3)2 and KI and observes a yellow solid. Which claim is best supported?",
     ("PbI2 precipitated, because lead(II) iodide is insoluble in water.", "The yellow solid is lead(II) iodide."),
     [("A precipitate of KNO3 formed, because potassium and nitrate ions are present.", "All nitrates and potassium salts are soluble."), ("A gas formed, which is seen as a yellow solid.", "A solid is a precipitate and not a gas."), ("No reaction occurred, because the ions are all soluble.", "The formation of a solid shows a reaction.")]),
    ("Solutions of Na2CO3 and CaCl2 are mixed, and the mixture turns cloudy. Which claim is best supported?",
     ("CaCO3 precipitated, because most carbonates other than Group 1 are insoluble.", "Ca²⁺ and CO3²⁻ form an insoluble compound."),
     [("Sodium chloride formed as a precipitate, because chlorides are insoluble.", "Sodium chloride is soluble."), ("Water boiled, which produced bubbles that make it cloudy.", "There is no heat source, and a precipitate is the cause of the cloudiness."), ("The solutions formed a new element.", "A reaction between ions does not produce a new element.")]),
    ("A student mixes solutions of KCl and NaNO3 and sees no change. Which claim is best supported?",
     ("No precipitate forms, because KNO3 and NaCl are both soluble.", "All salts of Group 1 metals are soluble."),
     [("A precipitate forms, but it cannot be seen.", "No evidence supports a precipitate."), ("A reaction occurred, because the solutions were mixed.", "Mixing solutions does not by itself show that a reaction occurred."), ("NaCl precipitated because the sodium ion combines with chloride.", "Sodium chloride is soluble in water.")]),
], "make a claim about precipitation from solubility rules and observations")

# ---- Unit 5 ----
ch_o_mechanism_step = _b("ch_o_mechanism_step", "5.5", "4.C", [
    ("A reaction mechanism has two elementary steps: (1) A + B → C (slow); (2) C + A → D (fast). What is the rate law for the overall reaction?",
     ("rate = k[A][B], because the slow step involves one A and one B.", "The rate law of the rate-determining step gives the overall rate law."),
     [("rate = k[A]²[B], because A appears twice in the mechanism.", "Only the slow step determines the rate law."), ("rate = k[C][A], because that is the fast step.", "The fast step does not set the rate."), ("rate = k[D], because D is the final product.", "The rate does not depend on the product concentration here.")]),
    ("A proposed mechanism has two steps: (1) NO2 + NO2 → NO3 + NO (slow); (2) NO3 + CO → NO2 + CO2 (fast). What is the overall reaction, and which species is an intermediate?",
     ("NO2 + CO → NO + CO2, with NO3 as the intermediate formed and then used.", "An intermediate forms in one step and is used up in a later step."),
     [("NO2 + CO → NO + CO2, and NO2 is the intermediate.", "NO2 is a reactant overall and it is regenerated; it acts as a catalyst, not an intermediate."), ("2 NO2 + CO → NO + CO2 + NO2, and CO is the intermediate.", "CO is a reactant and not an intermediate."), ("NO3 + CO → NO + CO2, and NO is the intermediate.", "NO is a product that is not consumed in a later step.")]),
    ("For a reaction with the mechanism (1) A ⇌ B (fast equilibrium); (2) B + C → D (slow), which is the rate law in terms of the reactants A and C?",
     ("rate = k[A][C], because [B] follows [A] through the fast equilibrium.", "B is an intermediate and so it must be replaced by [A]."),
     [("rate = k[B][C], because the slow step sets the rate.", "The rate law can include only the reactants and not the intermediate B."), ("rate = k[A], because step 1 is the first.", "The slow step includes C."), ("rate = k[D], because D is the product.", "The product concentration is not in the rate law.")]),
], "derive the rate law from a mechanism with a slow step")

ch_o_collision_model = _b("ch_o_collision_model", "5.7", "4.A", [
    ("Which statement best explains why the rate of a reaction increases when the temperature is raised?",
     ("A larger fraction of collisions have energy that is greater than or equal to the activation energy.", "Raising T widens the distribution of kinetic energies toward higher values."),
     [("The activation energy becomes lower when the temperature is raised.", "The activation energy does not depend on temperature."), ("The number of reactant particles increases when the temperature is raised.", "Heating does not create more particles."), ("The reaction becomes more exothermic at higher temperatures.", "ΔH does not change the rate that way.")]),
    ("Which statement best explains why a powdered solid reacts faster than a single large piece of the same mass?",
     ("The powder has more surface area, so more collisions occur.", "A greater surface area exposes more particles."),
     [("The powder has a lower activation energy.", "The activation energy is the same for the same reaction."), ("The powder has a higher temperature.", "The temperatures are the same."), ("The powder has more atoms than the large piece.", "The masses are the same, so the number of atoms is the same.")]),
    ("A reaction has an activation energy of 60 kJ/mol. Which statement best describes the energy distribution of the molecules at a higher temperature?",
     ("A larger fraction of molecules reaches 60 kJ/mol, though the average stays below it.", "More molecules exceed the barrier at the higher temperature."),
     [("All molecules have energy of at least 60 kJ/mol.", "Only a fraction has enough energy."), ("The distribution is unchanged, but the molecules move faster.", "The distribution of energy shifts with temperature."), ("The average energy exceeds the activation energy.", "The average energy remains lower.")]),
], "explain how temperature and surface area change reaction rates with collision ideas")

# ---- Unit 6 ----
ch_o_energy_diagram = _b("ch_o_energy_diagram", "6.6", "4.A", [
    ("An energy diagram for a reaction shows that the products are at a lower energy than the reactants, and the peak is above both. Which statement is correct?",
     ("The reaction is exothermic, ΔH is negative, and Ea is the energy from the reactants to the peak.", "Products lower than reactants indicate a release of energy."),
     [("The reaction is endothermic, so ΔH is positive.", "Products at lower energy make the reaction exothermic."), ("The activation energy is the difference between the reactants and the products.", "That difference between the reactants and the products is ΔH."), ("The reaction is exothermic, so no activation energy is needed.", "Every reaction has an energy barrier.")]),
    ("For an endothermic reaction, how does the activation energy of the forward reaction compare with that of the reverse reaction?",
     ("The forward Ea is greater, because the products are higher in energy than the reactants.", "Ea(forward) = Ea(reverse) + ΔH."),
     [("The forward activation energy is smaller, because the reaction absorbs energy.", "The barrier from the lower-energy side is larger."), ("They are equal, because a catalyst is not present.", "The two activation energies differ by the value of ΔH."), ("The activation energy of the reverse reaction is zero.", "The reverse reaction also has a barrier.")]),
    ("A reaction has $\\Delta H = -50\\text{ kJ/mol}$ and a forward activation energy of $80\\text{ kJ/mol}$. What is the activation energy of the reverse reaction?",
     ("130 kJ/mol, because the reverse barrier is 80 + 50 kJ/mol.", "Ea(reverse) = 80 + 50 = 130 kJ/mol."),
     [("30 kJ/mol, because 80 − 50 = 30.", "This subtracts the energy released instead of adding it."), ("50 kJ/mol, because it equals ΔH.", "The activation energy is not equal to ΔH."), ("80 kJ/mol, because a reaction has one activation energy.", "The reverse barrier is different.")]),
], "interpret reaction energy diagrams for activation energy and enthalpy change")

ch_o_hess_logic = _b("ch_o_hess_logic", "6.9", "4.B", [
    ("Reaction 1 has $\\Delta H = -100\\text{ kJ}$. A student reverses reaction 1 and doubles it. What is ΔH for the new reaction?",
     ("+200 kJ, because reversing flips the sign and doubling doubles the value.", "Both operations are applied to ΔH."),
     [("−200 kJ, because doubling the reaction doubles ΔH.", "Reversing changes the sign."), ("+100 kJ, because reversing only changes the sign.", "Doubling the equation also doubles ΔH."), ("−50 kJ, because reversing halves the value.", "Reversing does not halve the value.")]),
    ("Given A → B with $\\Delta H = +30\\text{ kJ}$ and B → C with $\\Delta H = -80\\text{ kJ}$, what is ΔH for A → C?",
     ("−50 kJ, because the enthalpy changes of the steps are added.", "Hess's law says that the sum of the steps gives the overall change."),
     [("+110 kJ, because the magnitudes are added.", "The signs must be included."), ("+50 kJ, because the second step is reversed.", "The second step is not reversed."), ("−110 kJ, because both steps release energy.", "The first step absorbs energy.")]),
    ("The standard enthalpy of formation of CO2(g) is −394 kJ/mol. What is ΔH for the decomposition CO2(g) → C(s) + O2(g)?",
     ("+394 kJ, because decomposition is the reverse of the formation.", "Reversing the formation changes the sign."),
     [("−394 kJ, because the formation of CO2 is exothermic.", "The decomposition is the reverse."), ("0 kJ, because the elements are in their standard states.", "The elements have a ΔHf of zero, but the reaction does not."), ("+197 kJ, because the equation produces only one oxygen atom.", "O2 is a molecule, and the stoichiometry does not halve ΔH.")]),
], "apply Hess's law to reversed and scaled reactions")

ch_o_bond_enthalpy_concept = _b("ch_o_bond_enthalpy_concept", "6.8", "4.D", [
    ("When bonds form in a chemical reaction, which statement is correct?",
     ("Energy is released, so bond formation is an exothermic process.", "Forming a bond lowers the energy of the atoms."),
     [("Energy is absorbed, so bond formation is endothermic.", "Breaking bonds absorbs energy."), ("No energy change occurs, because the atoms are the same.", "Bond formation always changes energy."), ("Energy is released only when the bonds are single bonds.", "The release is true for all bonds.")]),
    ("A reaction breaks bonds with a total energy of 1200 kJ and forms bonds with a total energy of 1500 kJ. What is ΔH for the reaction?",
     ("−300 kJ, because ΔH = energy of bonds broken − energy of bonds formed.", "More energy is released in forming the bonds than is used in breaking them."),
     [("+300 kJ, because the energy of the bonds formed is larger.", "The sign is reversed, because bond formation releases the larger energy."), ("+2700 kJ, because the energies are added.", "The values are subtracted."), ("−2700 kJ, because the energies are added.", "ΔH is a difference of the two energies and is not their sum.")]),
    ("Why is the O–H bond in water harder to break than the O–O bond in hydrogen peroxide?",
     ("The O–H bond has the greater bond energy, because it is shorter.", "A shorter bond between the atoms is generally stronger."),
     [("The O–O bond is a double bond.", "The O–O bond in peroxide is a single bond."), ("The O–H bond has a lower bond energy, which makes it stable.", "A lower energy would make it easier to break."), ("Hydrogen atoms have a larger mass than oxygen atoms.", "Hydrogen is lighter than oxygen.")]),
], "relate bond breaking and bond making to the sign of the enthalpy change")


# ---- Unit 7, practice 5: ICE table ----
@retry_sep
def ch_o_ice_concentration(rng):
    c0 = pick(rng, [0.10, 0.20, 0.50, 1.00]); K = pick(rng, [0.0050, 0.020, 0.10, 0.50])
    x = sp.Symbol("x", positive=True)
    sol = [float(v) for v in sp.solve(sp.Eq((2 * x) ** 2, sp.nsimplify(K) * (sp.nsimplify(c0) - x)), x) if v.is_real and float(v) > 0 and float(v) < c0]
    xv = sol[0]; xb = bisect(lambda t: (2 * t) ** 2 - K * (c0 - t), 0.0, c0)
    agree(xv, xb, 1e-9, "x")
    key_v = 2 * xv
    pairs = [("Uses x instead of 2x for the concentration of the product.", xv), ("Ignores the loss of N2O4 and solves (2x)² = K c₀.", math.sqrt(K * c0)), ("Takes the square root of K as the concentration.", math.sqrt(K)),
             ("Uses the starting concentration of N2O4 as the equilibrium concentration of NO2.", c0)]
    key, ds = num_opts(key_v, pairs, "M")
    stem = f"The reaction $\\mathrm{{N_2O_4(g)}} \\rightleftharpoons 2\\,\\mathrm{{NO_2(g)}}$ has $K_c = {K:g}$ at a certain temperature. A rigid container initially holds $\\mathrm{{N_2O_4}}$ at ${c0:g}\\text{{ M}}$ and no $\\mathrm{{NO_2}}$. What is the equilibrium concentration of $\\mathrm{{NO_2}}$?"
    return mk("ch_o_ice_concentration", "7.6", "5.F", stem, key, ds, rng, concept="equilibrium concentration from K and initial concentration with an ICE table", path="sympy quadratic solve vs bisection on the equilibrium condition", facts=[f"K={K}", f"c0={c0}"],
              kwhy=f"Let x be the N2O4 that reacts: [NO2] = 2x and [N2O4] = {c0:g} − x. Then (2x)²/({c0:g} − x) = {K:g}, so x = {xv:.4g} and [NO2] = 2x = {sig(key_v)} M.", judgment="set up the ICE table with the stoichiometric factor and solve the quadratic", est=120)
ch_o_ice_concentration.__module__ = "chem_p0_o"

# ---- Unit 8 ----
ch_o_curve_features = _b("ch_o_curve_features", "8.5", "4.A", [
    ("A weak acid is titrated with a strong base. Which statement describes the pH at the equivalence point?",
     ("The pH is above 7, because the conjugate base of the weak acid reacts with water.", "A weak acid titrated with a strong base has a basic equivalence point."),
     [("The pH equals 7, because the moles of acid equal the moles of base.", "That holds only for a strong acid and a strong base."), ("The pH is less than 7, because a weak acid is present.", "The weak acid has been converted to its conjugate base."), ("The pH equals the pKa of the acid.", "The pKa equals the pH at the half-equivalence point.")]),
    ("A strong acid is titrated with a strong base. Which statement describes the titration curve?",
     ("The pH rises slowly, then sharply near equivalence, at pH 7.", "A strong acid and strong base give a neutral equivalence point."),
     [("The pH is greater than 7 at the equivalence point.", "That happens for a weak acid and a strong base."), ("The pH is constant until the equivalence point.", "A buffer region is present only for weak acids."), ("The pH falls as the base is added.", "The pH rises when a base is added.")]),
    ("On the titration curve of a weak acid with a strong base, which region shows the smallest change in pH when a small amount of base is added?",
     ("The buffer region, where the weak acid and its conjugate base are both present.", "A buffer resists a change in pH."),
     [("The equivalence point, where the number of moles of acid equals base.", "The pH changes most rapidly near the equivalence point."), ("The region after the equivalence point.", "Excess strong base gives a rapid rise."), ("The initial point, before any base is added.", "The pH changes quickly just after the start but then flattens in the buffer region.")]),
], "interpret features of titration curves")

ch_o_ka_strength = _b("ch_o_ka_strength", "8.3", "4.B", [
    ("Acid X has $K_a = 1.0 \\times 10^{-3}$ and acid Y has $K_a = 1.0 \\times 10^{-6}$. Both solutions have the same initial concentration. Which statement is correct?",
     ("The solution of X has the lower pH, because X ionizes more and gives more hydronium.", "A larger Ka means greater ionization."),
     [("The solution of Y has the lower pH, because its Ka is smaller.", "A smaller Ka gives less ionization and a higher pH."), ("The solutions have the same pH, because the concentrations are equal.", "The pH depends on Ka as well as on the concentration."), ("The solution of X has the higher pH, because it ionizes more.", "More ionization gives more hydronium ions and a lower pH.")]),
    ("The conjugate base of a weak acid HA is A⁻. If the Ka of HA is larger, which statement about A⁻ is correct?",
     ("A⁻ is a weaker base, because a stronger acid has a weaker conjugate base.", "Ka × Kb = Kw, so Kb decreases as Ka increases."),
     [("A⁻ is a stronger base, because the acid is stronger.", "The conjugate pairs have opposite trends."), ("A⁻ has the same strength as the base for any acid.", "The Kb of the conjugate base depends on the Ka of its acid."), ("A⁻ is not a base, because it has a negative charge.", "A⁻ can accept a proton, so it is a base.")]),
    ("A 0.10 M solution of acid HA has a pH of 3.00, and a 0.10 M solution of acid HB has a pH of 1.00. Which statement is correct?",
     ("HB is the stronger acid, because its solution has the lower pH.", "A lower pH means a higher hydronium concentration."),
     [("HA is a stronger acid than HB, because its pH is higher.", "A higher pH means a weaker acid at the same concentration."), ("They have the same strength, because the concentrations are the same.", "The pH values differ, so the strengths differ."), ("HA ionizes to a greater extent than HB.", "HB ionizes to a greater extent, as the lower pH shows.")]),
], "compare acid strength from Ka values and pH")

ch_o_buffer_concept = _b("ch_o_buffer_concept", "8.9", "4.C", [
    ("Which of the following mixtures forms a buffer?",
     ("Equal moles of acetic acid and sodium acetate in solution.", "A weak acid and its conjugate base are both present."),
     [("Equal moles of HCl and NaCl in solution.", "A strong acid and its salt do not resist a change in pH."), ("Equal moles of NaOH and NaCl in solution.", "A strong base and a neutral salt do not form a buffer."), ("Equal moles of acetic acid and NaCl in solution.", "A neutral salt does not supply the conjugate base.")]),
    ("A buffer contains a weak acid HA and its conjugate base A⁻. A small amount of strong base is added. Which reaction minimizes the change in pH?",
     ("HA reacts with the added OH⁻ to form A⁻ and water.", "The weak acid neutralizes the added base."),
     [("A⁻ reacts with the added OH⁻ to form HA and O²⁻.", "A⁻ does not react with a base."), ("A⁻ reacts with the added OH⁻ to make more HA.", "A base is neutralized by an acid and not by its conjugate base."), ("HA reacts with the water to form more OH⁻.", "This would raise the pH further.")]),
    ("Which change increases the buffer capacity of a buffer made from HA and A⁻ while keeping the pH the same?",
     ("Increasing the concentrations of HA and A⁻ by the same factor.", "A larger amount of both components neutralizes more added acid or base."),
     [("Decreasing the concentrations of HA and A⁻ by the same factor.", "A smaller amount gives a smaller capacity."), ("Adding a strong acid until the concentration of A⁻ is zero.", "A buffer needs both components."), ("Replacing HA with a strong acid.", "A strong acid cannot form a buffer.")]),
], "decide which solutions behave as buffers and how they respond to added acid or base")

ch_o_conj_pair = _b("ch_o_conj_pair", "8.1", "4.A", [
    ("In a solution of a weak base B in water, B(aq) + H2O(l) ⇌ BH⁺(aq) + OH⁻(aq), which are the conjugate acid-base pairs?",
     ("BH⁺ and B, and H2O and OH⁻.", "Each pair differs by one proton."),
     [("B and OH⁻, and H2O and BH⁺.", "These species do not differ by one proton."), ("B and H2O, and BH⁺ and OH⁻.", "These are not related by a proton transfer."), ("BH⁺ and H2O, and B and OH⁻.", "These are not conjugate pairs.")]),
    ("Which of the following is the conjugate acid of HPO4²⁻?",
     ("H2PO4⁻, because it gains a proton from HPO4²⁻.", "A conjugate acid has one more proton."),
     [("PO4³⁻, because it has a higher charge.", "PO4³⁻ is the conjugate base of HPO4²⁻."), ("H3PO4, because it has the most hydrogen atoms.", "H3PO4 has two more protons."), ("HPO4⁻, because the charge is smaller.", "The species has an incorrect formula for a conjugate.")]),
    ("What is the conjugate base of the hydronium ion, H3O⁺?",
     ("H2O, because it forms when H3O⁺ loses a proton.", "The conjugate base has one fewer proton."),
     [("OH⁻, because it is the base in water.", "OH⁻ is the conjugate base of water."), ("H2O2, because it has an extra oxygen atom.", "This species is unrelated by a proton transfer."), ("O²⁻, because it has the lowest hydrogen content.", "O²⁻ is the conjugate base of OH⁻.")]),
], "identify conjugate acid-base pairs")

# ---- Unit 9, practice 6 ----
ch_o_spontaneity_justify = _b("ch_o_spontaneity_justify", "9.3", "6.D", [
    ("A reaction has ΔH < 0 and ΔS > 0. Which statement is best justified?",
     ("The reaction is spontaneous at all temperatures, because ΔG = ΔH − TΔS is negative for every T.", "Both terms favor spontaneity."),
     [("The reaction is spontaneous only at low temperature, because ΔH is negative.", "The −TΔS term is also negative, so the reaction is spontaneous at all T."), ("The reaction is spontaneous only at high temperature, because ΔS is positive.", "Both terms favor spontaneity at any T."), ("The reaction is nonspontaneous at all temperatures.", "ΔG is negative at all temperatures.")]),
    ("A reaction has ΔH > 0 and ΔS > 0. Which statement is best justified?",
     ("Spontaneous only at high temperatures, because −TΔS must outweigh the positive ΔH.", "The entropy term becomes more important as T rises."),
     [("The reaction is spontaneous at all temperatures, because ΔS is positive.", "A positive ΔH opposes spontaneity at low T."), ("The reaction is spontaneous only at low temperatures.", "At low T the positive ΔH dominates."), ("The reaction is never spontaneous.", "At high T, −TΔS can make ΔG negative.")]),
    ("A reaction has ΔH < 0 and ΔS < 0. Which statement is best justified?",
     ("Spontaneous only at low temperatures, because −TΔS must be smaller than |ΔH|.", "At high temperatures the positive −TΔS term dominates."),
     [("The reaction is spontaneous at all temperatures, because ΔH is negative.", "A negative ΔS opposes spontaneity at high T."), ("The reaction is spontaneous only at high temperatures.", "At high T, ΔG becomes positive."), ("The reaction is never spontaneous, because ΔS is negative.", "At low T the ΔH term dominates.")]),
], "justify the temperature dependence of spontaneity from the signs of ΔH and ΔS")

ch_o_cell_justify = _b("ch_o_cell_justify", "9.9", "6.E", [
    ("A galvanic cell has a standard cell potential of +1.10 V. Which statement is best justified?",
     ("ΔG° < 0 and K > 1, because ΔG° = −nFE° and E° > 0.", "A positive E° means a spontaneous reaction at standard conditions."),
     [("ΔG° is positive and K is greater than 1.", "ΔG° and E° have opposite signs."), ("ΔG° is negative and K is less than 1.", "A negative ΔG° gives K greater than 1."), ("ΔG° is zero and K equals 1.", "That is true only when E° is zero.")]),
    ("In a galvanic cell the concentration of the product ion is increased well above the standard concentration. Which statement about the cell potential is best justified?",
     ("E decreases from E°, because Q increases in E = E° − (RT/nF) ln Q.", "A higher Q reduces the driving force."),
     [("E increases above E°, because more product is present.", "More product makes the forward reaction less favorable."), ("E does not change, because E° is a constant.", "The potential E depends on the reaction quotient Q."), ("E becomes negative at once.", "E decreases but not necessarily to a negative value.")]),
    ("A cell is run until the cell potential is zero. Which statement is best justified?",
     ("The system is at equilibrium, so Q = K and ΔG = 0.", "At equilibrium there is no net driving force."),
     [("The cell has reached its standard state.", "The zero potential does not mean that the standard state has been reached."), ("The electrodes have been removed.", "The cell has a zero potential while the electrodes are present."), ("The reaction has stopped because there are no ions.", "Ions are present at equilibrium.")]),
], "justify conclusions about spontaneity and equilibrium from cell potentials")

STAGE_O_MC = ["ch_o_isotope_question", "ch_o_hydrate_procedure", "ch_o_periodic_predict", "ch_o_mixture_error", "ch_o_lewis_choice", "ch_o_vsepr_shape", "ch_o_bond_order_length", "ch_o_conductivity_claim", "ch_o_gas_question", "ch_o_separation_procedure",
              "ch_o_imf_justify", "ch_o_net_ionic", "ch_o_acid_base_type", "ch_o_redox_agent", "ch_o_precip_claim", "ch_o_mechanism_step", "ch_o_collision_model", "ch_o_energy_diagram", "ch_o_hess_logic", "ch_o_bond_enthalpy_concept",
              "ch_o_ice_concentration", "ch_o_curve_features", "ch_o_ka_strength", "ch_o_buffer_concept", "ch_o_conj_pair", "ch_o_spontaneity_justify", "ch_o_cell_justify"]
