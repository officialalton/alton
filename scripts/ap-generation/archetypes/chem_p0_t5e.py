"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 개념 문항 2부: Practice 2(실험·검증) 14개 + Practice 6(논증·근거) 8개. 고정 문장 은행(chem_p0_n._bank): 원형마다 장면 2개, 정답 1 + 이름 붙은 오개념 3.
정답은 하나의 절차나 주장만 모든 요구를 충족하도록 쓴다(필요한 정보는 본문에 있다)."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5e"
    return f


# ======================= Practice 2 =======================
ch_t5_p2_gas_question = _b("ch_t5_p2_gas_question", "3.4", "2.A", [
    ("A student wants to test how the volume of a sample of gas depends on its pressure at constant temperature, using a gas syringe and a pressure gauge. Which question can be answered with these measurements?",
     ("How does the volume of the gas change as the pressure on the gas is changed at a fixed temperature?", "The syringe gives volume and the gauge gives pressure, so the relationship can be measured."),
     [("How does the molar mass of the gas change as the pressure changes?", "Molar mass is a fixed property and is not measured by a syringe and a gauge."), ("What type of bonds are present in the gas molecules?", "The apparatus gives no information about bonding."), ("How does the color of the gas change with its volume?", "Color is not measured with a syringe and a pressure gauge.")]),
    ("A student has a flask, a pressure sensor, and a water bath at adjustable temperatures. Which question can be tested with this equipment?",
     ("How does the pressure of a fixed amount of gas in a rigid flask change as the temperature is changed?", "The sensor measures pressure while the bath controls the temperature."),
     [("How does the number of moles of gas change as the pressure changes in a sealed flask?", "In a sealed flask the amount of gas does not change with pressure."), ("What is the identity of the gas in the flask?", "A pressure sensor and a water bath do not identify a gas."), ("How does the volume of the flask change as the gas is heated?", "A rigid flask has a fixed volume.")])],
    "choose a testable question from the available equipment")

ch_t5_p2_beer_procedure = _b("ch_t5_p2_beer_procedure", "3.13", "2.C", [
    ("A student wants to determine the concentration of a colored copper(II) solution using a spectrophotometer. Which procedure is best?",
     ("Measure the absorbance of known solutions at one wavelength, plot absorbance against concentration, and read the unknown concentration from its absorbance on the line.", "A calibration line from known solutions converts an unknown's absorbance to concentration."),
     [("Measure the absorbance of the unknown only, and divide the absorbance by the volume of the solution.", "Absorbance depends on the species and its concentration; it is not divided by volume."), ("Measure the absorbance of the unknown at several different wavelengths and then average all of the values.", "Absorbance varies with wavelength, so averaging does not give a concentration."), ("Measure the mass of the unknown solution and compare it with the mass of an equal volume of pure water.", "The mass of a solution does not isolate the concentration of the absorbing species.")]),
    ("A student uses Beer's law to find the molar absorptivity of a dye. Which set of measurements is needed?",
     ("The absorbance of a dye solution of known concentration, measured in a cuvette of known path length, at a fixed wavelength.", "Beer's law ε = A/(bc) needs absorbance, path length, and concentration."),
     [("The mass of the cuvette and the volume of the dye solution only.", "These do not give absorbance, path length, or concentration."), ("The absorbance of the dye at a wavelength that is not absorbed by the dye.", "Absorbance at a non-absorbing wavelength is near zero and cannot be used."), ("The pH of the solution at several concentrations.", "The pH does not give the molar absorptivity.")])],
    "choose the procedure that measures every quantity the calculation needs")

ch_t5_p2_solubility_procedure = _b("ch_t5_p2_solubility_procedure", "3.10", "2.C", [
    ("A student wants to find the solubility of a salt in water at 25 °C in grams of salt per 100 g of water. Which procedure is best?",
     ("Stir excess salt in water until no more dissolves, filter off the undissolved solid, evaporate a weighed portion of the clear solution, and weigh the dry residue.", "The saturated solution is separated from excess solid and the dissolved mass is found by evaporation."),
     [("Add a small amount of the salt to water and record whether it dissolves completely.", "A single trial does not show the maximum amount that dissolves."), ("Weigh the salt and the water, mix them, and record the total mass of the mixture.", "The total mass does not show how much of the salt actually dissolved."), ("Heat the water to boiling, add the salt, and weigh the solution while it is hot.", "The solubility at 25 °C requires the solution to be at 25 °C.")]),
    ("A student wants to test whether temperature affects the solubility of potassium nitrate. Which procedure is best?",
     ("Make saturated solutions at several temperatures with equal masses of water and measure the salt dissolved at each.", "Only the temperature is varied, and the amount dissolved is measured."),
     [("Dissolve a different mass of salt in each flask, all kept at the same temperature.", "The temperature is not varied in this procedure."), ("Dissolve the salt in different volumes of water at different temperatures in each flask.", "Changing the volume of water as well as the temperature confuses the two effects."), ("Measure the color of the solution at room temperature only and compare it with a chart.", "Color at one temperature does not show how solubility changes.")])],
    "design a procedure that isolates the variable and measures the outcome")

ch_t5_p2_chromatography_predict = _b("ch_t5_p2_chromatography_predict", "3.9", "2.B", [
    ("In paper chromatography with a nonpolar solvent, two dyes are spotted on a polar paper. Dye X is less polar than dye Y. Which prediction is best?",
     ("Dye X travels farther, because it is attracted more strongly to the nonpolar solvent than to the polar paper.", "The less polar compound is carried farther by the nonpolar solvent."),
     [("Dye Y travels farther than dye X, because the more polar dye is carried better by the solvent.", "The more polar dye is held more strongly by the polar paper."), ("Both dyes travel the same distance, because they move in the same solvent on the same paper.", "Different attractions to the solvent and the paper give different distances."), ("Neither dye moves, because the paper is a solid and the dyes cannot dissolve in it.", "The solvent moves through the paper and carries the dyes.")]),
    ("A student separates a mixture by simple distillation. Compound P boils at 78 °C and compound Q boils at 118 °C. Which prediction is best?",
     ("The distillate collected first will be richer in P, which has the lower boiling point.", "The more volatile component vaporizes first."),
     [("The distillate collected first will be richer in Q, which has the higher boiling point.", "The higher-boiling component vaporizes later."), ("P and Q will condense in equal amounts at all times.", "Compounds with different boiling points are separated by distillation."), ("Neither will distill because they are both liquids.", "Distillation separates liquids by their boiling points.")])],
    "predict the result of a separation from polarity or boiling point")

ch_t5_p2_titration_procedure = _b("ch_t5_p2_titration_procedure", "4.6", "2.C", [
    ("A student wants to find the concentration of an acetic acid solution in vinegar. Which procedure is best?",
     ("Pipet a measured volume of vinegar into a flask with indicator, titrate with standard NaOH to the end point, and record the NaOH volume.", "A known volume of acid, a standard base, and an end-point indicator give the moles of acid."),
     [("Measure the mass of the vinegar sample and divide by its density to find the acid concentration.", "This gives the volume of the vinegar, not the concentration of acetic acid."), ("Add a large excess of water to the vinegar and measure the temperature change of the mixture.", "A temperature change does not give the concentration."), ("Add a few drops of indicator to the vinegar and record the color without adding any base.", "The color alone does not give an amount of acid.")]),
    ("A student titrates 25.00 mL of an unknown HCl solution with 0.100 M NaOH. Which pair of measurements is needed to calculate the molarity of the HCl?",
     ("The volume of HCl solution used and the volume of NaOH solution needed to reach the end point.", "The moles of NaOH at the end point equal the moles of HCl, and dividing by the HCl volume gives the molarity."),
     [("The mass of the flask and the temperature of the NaOH.", "These do not give the moles of base or the volume of acid."), ("The color of the indicator before the titration only.", "The end-point volume is needed to find the moles of base."), ("The density of the NaOH solution and the pH of the water.", "These measurements do not give the moles of acid or base.")])],
    "choose the measurements a titration calculation needs")

ch_t5_p2_stoich_question = _b("ch_t5_p2_stoich_question", "4.5", "2.A", [
    ("A student heats a weighed sample of magnesium in air in a crucible and weighs the product, magnesium oxide. Which question can be answered with the masses collected?",
     ("What is the mass ratio of magnesium to oxygen in the compound formed?", "The mass gained is the mass of oxygen that combined with the magnesium."),
     [("What is the first ionization energy of magnesium?", "The experiment does not measure ionization energy."), ("What is the electronegativity of oxygen?", "The masses do not give electronegativity."), ("What is the boiling point of magnesium oxide?", "Heating in a crucible and weighing does not measure a boiling point.")]),
    ("A student mixes a measured mass of a carbonate with excess acid in an open flask on a balance and records the mass lost. Which question can be answered with the data?",
     ("How many moles of carbon dioxide were released, and therefore how many moles of carbonate reacted?", "The mass lost is the mass of CO₂ gas that escaped."),
     [("What is the pH of the solution at the end of the experiment?", "The mass data do not give the pH."), ("What is the molar volume of the gas at 25 °C?", "The mass lost does not give a volume."), ("What is the heat capacity of the carbonate?", "The experiment does not measure heat.")])],
    "choose the question that the data from a mass-based experiment can answer")

ch_t5_p2_calorimetry_procedure = _b("ch_t5_p2_calorimetry_procedure", "6.4", "2.C", [
    ("A student wants to measure the heat released when 2.0 g of a salt dissolves in water using a foam-cup calorimeter. Which procedure is best?",
     ("Measure the mass of water in the cup, record its initial temperature, add the salt, stir, and record the highest or lowest temperature reached.", "The heat is calculated from the mass of water, its specific heat, and its temperature change."),
     [("Record the temperature of the salt before it is added and the mass of the cup only.", "The temperature change of the water and its mass are needed."), ("Add the salt to the water and measure the volume of the solution.", "Volume does not give the heat absorbed or released."), ("Measure the temperature of the water before adding the salt and then weigh the salt.", "The final temperature must be recorded to find the temperature change.")]),
    ("A student uses a coffee-cup calorimeter to find the heat of neutralization when 50.0 mL of HCl is mixed with 50.0 mL of NaOH. Which set of measurements is sufficient?",
     ("The initial temperature of each solution, the final temperature of the mixture, and the mass of the mixture.", "The heat is $q = mc\\Delta T$, which needs mass, specific heat, and the temperature change."),
     [("The pH of each solution and the color of the indicator at the end of the experiment.", "These do not give the temperature change or the mass."), ("The final temperature of the mixture only, without any initial temperatures.", "A temperature change requires the initial temperatures as well."), ("The concentrations of the two solutions only, without any temperature readings.", "Concentrations give the moles but not the heat released.")])],
    "choose a calorimetry procedure that supplies mass, temperature change, and the amount reacting")

ch_t5_p2_calorimetry_error = _b("ch_t5_p2_calorimetry_error", "6.4", "2.E", [
    ("In a calorimetry experiment, a student measures the heat released by a reaction but some heat escapes through a poorly insulated cup. How does this error affect the calculated heat of reaction, compared with the true value?",
     ("The calculated heat released is too small, because the measured temperature rise is smaller than it should be.", "Heat lost to the surroundings is not recorded as a temperature rise."),
     [("The calculated heat released is too large, because the temperature of the solution is higher.", "Lost heat lowers the measured temperature, not raises it."), ("The calculated value is unaffected because the total energy is conserved.", "The calorimeter measures only the heat that stays in the water."), ("The calculated heat is negative instead of positive.", "The sign is set by the direction of the temperature change, which is unchanged.")]),
    ("A student uses 55 g of water in the calculation of $q = mc\\Delta T$, but the cup actually contained 50 g of water. How does this error affect the calculated heat?",
     ("The calculated heat is too large, because the mass used is greater than the actual mass.", "q is proportional to the mass used in the calculation."),
     [("The calculated heat is too small, because the actual mass was smaller.", "The calculation uses the larger value, so the result is larger."), ("The calculated heat is unaffected because the mass cancels.", "The mass does not cancel in $q = mc\\Delta T$."), ("The calculated heat is zero, because the temperature change is unaffected.", "A temperature change still gives a nonzero heat.")])],
    "predict the direction of a calorimetry error")

ch_t5_p2_pes_predict = _b("ch_t5_p2_pes_predict", "1.6", "2.B", [
    ("A photoelectron spectrum of neon is compared with a spectrum of sodium. Which prediction about the 1s peak is best?",
     ("The 1s peak of sodium appears at a higher binding energy than the 1s peak of neon because sodium has a greater nuclear charge.", "A larger nuclear charge holds the 1s electrons more tightly."),
     [("The 1s peak of sodium appears at a lower binding energy than that of neon because sodium has more electrons.", "More electrons in outer shells do not weaken the pull on 1s electrons enough to outweigh the greater nuclear charge."), ("The two 1s peaks appear at the same binding energy because both elements have two 1s electrons.", "The binding energy depends on the nuclear charge."), ("Sodium has no 1s peak because its valence electron is in the 3s subshell.", "All electrons in the atom give peaks, including the 1s electrons.")]),
    ("A student compares the photoelectron spectra of carbon and nitrogen. Which prediction about the 2p peak is best?",
     ("The 2p peak of nitrogen is taller than that of carbon because nitrogen has more 2p electrons.", "Peak height is proportional to the number of electrons in the subshell: 3 for N and 2 for C."),
     [("The 2p peaks have the same height because both atoms have 2p electrons.", "Heights depend on the number of electrons in the subshell, which differs."), ("The 2p peak of carbon is taller because carbon has fewer protons.", "Peak height depends on the number of electrons, not the number of protons."), ("Neither atom has a 2p peak because the 2p subshell is empty.", "Both carbon and nitrogen have 2p electrons.")])],
    "predict features of photoelectron spectra from nuclear charge and electron counts")

ch_t5_p2_empirical_procedure = _b("ch_t5_p2_empirical_procedure", "1.3", "2.C", [
    ("A student wants to determine the empirical formula of a copper oxide by heating the oxide in a stream of hydrogen gas to form copper metal. Which measurements are needed?",
     ("The mass of the copper oxide before heating and the mass of the copper metal that remains after reduction is complete.", "The mass of oxygen removed is the difference, and the moles of Cu and O give the ratio."),
     [("The mass of the copper oxide and the volume of the hydrogen gas passed over it.", "The hydrogen volume does not give the mass of copper or oxygen in the oxide."), ("The mass of the crucible and the temperature of the hydrogen.", "These do not give the masses of copper and oxygen in the oxide."), ("The color of the oxide before and after heating only.", "A color change does not give a mass ratio.")]),
    ("A student burns a weighed hydrocarbon sample and collects the CO₂ and H₂O produced. Which set of measurements is needed to find the empirical formula of the hydrocarbon?",
     ("The masses of CO₂ and H₂O collected, from which the moles of C and H are found.", "All of the carbon ends up in CO₂ and all of the hydrogen in H₂O."),
     [("The volume of oxygen gas used and the color of the flame.", "These do not give the moles of C and H."), ("The temperature of the products and the pressure of the room.", "These do not give the masses of C and H."), ("The mass of the hydrocarbon only.", "The mass of the sample alone does not give the C:H ratio.")])],
    "choose measurements that give an empirical formula")

ch_t5_p2_gas_error = _b("ch_t5_p2_gas_error", "3.4", "2.E", [
    ("A student collects a gas over water and calculates its moles with $PV = nRT$ using the total pressure, without correcting for the water vapor. How does this affect the calculated moles of the gas?",
     ("The calculated moles are too large, because the pressure of the dry gas is less than the total pressure that was used.", "The total pressure includes the vapor pressure of water, so the used pressure is too high."),
     [("The calculated moles are too small, because the water vapor takes up space.", "Using a pressure that is too high makes n too large, not too small."), ("The calculated moles are unaffected, because water vapor is not a gas.", "Water vapor is a gas and contributes to the total pressure."), ("The calculated moles are correct because the pressures cancel.", "The pressures do not cancel in n = PV/RT.")]),
    ("A student records the temperature of a gas sample in °C but uses the value directly in $PV = nRT$. How does this affect the calculated moles if the temperature is 25 °C?",
     ("The calculated moles are too large, because the value used for T is much smaller than the kelvin temperature.", "n = PV/RT, so a smaller T gives a larger n."),
     [("The calculated moles are too small, because the Celsius value is larger.", "The Celsius value 25 is smaller than 298 K."), ("The calculated moles are unaffected because the temperature scales are equivalent.", "The scales have different zero points."), ("The calculated moles are negative.", "A positive Celsius value gives a positive n.")])],
    "predict the direction of an error in a gas law calculation")

ch_t5_p2_density_procedure = _b("ch_t5_p2_density_procedure", "1.4", "2.C", [
    ("A student wants to find the percent by mass of copper in a copper-zinc alloy by reacting the alloy with excess hydrochloric acid, in which only the zinc reacts. Which procedure is best?",
     ("Weigh the alloy, add excess acid until no more gas forms, rinse and dry the remaining solid, and weigh it.", "The mass of the leftover copper compared with the mass of the alloy gives the percent copper."),
     [("Weigh the alloy and then measure the pH of the acid.", "The pH does not give the mass of copper."), ("Weigh the acid before and after the reaction and compare.", "The acid mass does not isolate the mass of copper."), ("Heat the alloy in air and record the color of the product.", "A color does not give the composition.")]),
    ("A student wants to find the percent of NaCl in a mixture of NaCl and sand by dissolving the NaCl in water. Which procedure is best?",
     ("Weigh the mixture, dissolve the NaCl in water, filter, dry and weigh the sand, and find the NaCl by difference.", "Only NaCl dissolves, so the mass lost equals the mass of NaCl."),
     [("Weigh the mixture and then measure its volume in a graduated cylinder to find the NaCl.", "Mass and volume of the mixture do not separate the two components."), ("Add water to the mixture and record only the temperature of the resulting solution.", "A temperature does not give the composition."), ("Dissolve the mixture and weigh the whole solution, which contains the NaCl and water.", "The mass of the solution includes the water and does not isolate the NaCl.")])],
    "choose a gravimetric procedure that isolates one component")

ch_t5_p2_redox_procedure = _b("ch_t5_p2_redox_procedure", "4.9", "2.C", [
    ("A student wants to find the concentration of iron(II) ions in a solution by titrating with a standard potassium permanganate solution, which is purple and is reduced to nearly colorless Mn²⁺. Which end-point observation is expected?",
     ("The first persistent faint pink color after the last Fe²⁺ has been oxidized by the added MnO₄⁻.", "Excess MnO₄⁻ is no longer reduced, so its purple color persists."),
     [("The solution turns colorless when excess permanganate is added.", "Excess permanganate would give a purple or pink color, not colorless."), ("A white precipitate forms at the end point.", "No precipitate is expected in this redox titration."), ("The solution becomes dark purple at the start and stays so throughout.", "The purple color disappears while Fe²⁺ remains to be oxidized.")]),
    ("A student titrates a solution of oxalic acid with standardized permanganate. Which measurement is needed, besides the permanganate concentration, to find the concentration of oxalic acid?",
     ("The volume of permanganate needed to reach the end point and the volume of oxalic acid titrated.", "The moles of permanganate at the end point are related to the moles of oxalic acid by the balanced equation."),
     [("The mass of the flask and the pH of the permanganate.", "These do not give the moles used."), ("The color of the oxalic acid before the titration only.", "The end-point volume is needed."), ("The density of the water in the flask.", "The density does not give the amount of oxalic acid.")])],
    "recognize the end point and the measurements of a redox titration")


# ======================= Practice 6 =======================
ch_t5_p6_imf_claim = _b("ch_t5_p6_imf_claim", "3.1", "6.C", [
    ("The table lists the boiling points of CH₄ (−162 °C), SiH₄ (−112 °C), and GeH₄ (−88 °C). A student claims that the boiling points increase down the group because the dispersion forces get stronger. Which statement best supports the claim?",
     ("The molecules are nonpolar and larger molecules have larger, more polarizable electron clouds, so the dispersion forces between them are stronger.", "Dispersion forces increase with the size of the electron cloud."),
     [("The molecules become more polar down the group, so the dipole-dipole forces are stronger.", "These molecules are nonpolar tetrahedral molecules."), ("The covalent bonds become stronger down the group, so more energy is needed to boil the substances.", "Boiling overcomes intermolecular forces, not covalent bonds."), ("The molecules form hydrogen bonds that get stronger down the group.", "None of these molecules has hydrogen bonds.")]),
    ("Liquid ethanol boils at 78 °C and dimethyl ether (same formula, C₂H₆O) boils at −24 °C. A student claims the difference arises from the intermolecular forces. Which statement best supports the claim?",
     ("Ethanol molecules hydrogen bond through the O–H group, which is stronger than the dipole-dipole forces in dimethyl ether.", "Ethanol has an O–H bond that can hydrogen bond, and the ether does not."),
     [("Ethanol has a greater molar mass than dimethyl ether, so its dispersion forces are much stronger.", "The two compounds have the same formula and the same molar mass."), ("Ethanol is ionic and dimethyl ether is covalent, so ethanol has the stronger attractions.", "Both compounds are molecular."), ("Dimethyl ether has stronger covalent bonds than ethanol, so it boils at a lower temperature.", "Boiling involves intermolecular forces, not covalent bond strength.")])],
    "support a boiling-point claim with the dominant intermolecular force")

ch_t5_p6_solubility_claim = _b("ch_t5_p6_solubility_claim", "3.10", "6.D", [
    ("A student claims that iodine, I₂, dissolves much more readily in hexane than in water. Which justification best supports the claim?",
     ("I₂ and hexane are both nonpolar and attract through dispersion forces, but I₂ cannot bond strongly to polar water.", "Like dissolves like: nonpolar solutes dissolve in nonpolar solvents."),
     [("I₂ is an ionic compound and is attracted to the ions that make up hexane.", "I₂ is a nonpolar molecular substance and hexane contains no ions."), ("Hexane is a polar solvent, so it dissolves nonpolar solutes such as I₂ best.", "Hexane is a nonpolar solvent, not a polar one."), ("Water molecules are too small to surround I₂ molecules, so I₂ cannot dissolve in water.", "The explanation depends on polarity, not on the size of the water molecules.")]),
    ("A student claims that sodium chloride dissolves in water but not in hexane. Which justification best supports the claim?",
     ("Water forms strong ion-dipole attractions with Na⁺ and Cl⁻ that offset breaking the lattice, but hexane cannot.", "Polar solvents stabilize ions through ion-dipole interactions."),
     [("Hexane is denser than water, so the ions are unable to enter the hexane layer.", "Density is not the reason for the difference."), ("Sodium chloride is a nonpolar compound, so it prefers a polar solvent such as water.", "Sodium chloride is ionic, not nonpolar."), ("Water has a lower boiling point than hexane, so water is able to dissolve more solute.", "Boiling points do not determine solubility.")])],
    "justify a solubility claim with polarity and intermolecular forces")

ch_t5_p6_calorimetry_claim = _b("ch_t5_p6_calorimetry_claim", "6.4", "6.B", [
    ("A student mixes two solutions in a calorimeter and the temperature of the mixture rises from 22.0 °C to 26.5 °C. The student claims that the reaction is exothermic. Which statement best supports the claim?",
     ("The temperature of the surroundings (the solution) increased, so the reaction released energy to it.", "A temperature rise in the solution means the reaction transferred energy to the solution."),
     [("The temperature of the reaction mixture increased, so the reaction absorbed energy from the surroundings.", "A temperature rise shows energy released, not absorbed."), ("The final temperature is higher than room temperature, so heat was created.", "Energy is transferred, not created."), ("The change in temperature is positive, so ΔH is positive.", "A positive temperature change in the solution corresponds to a negative ΔH for the reaction.")]),
    ("A student dissolves a salt in water in a calorimeter and measures a temperature drop from 24.0 °C to 20.5 °C. Which claim is best supported by the data?",
     ("The dissolving process is endothermic, because it absorbed energy from the water.", "A drop in the water temperature means energy flowed from the water to the dissolving salt."),
     [("The dissolving process is exothermic, because it released energy into the water.", "Releasing energy would raise the temperature."), ("The dissolving process neither absorbs nor releases energy, because the temperature changed by only a few degrees.", "Any temperature change shows a transfer of energy."), ("The salt gained mass as it dissolved, so the water cooled.", "Mass changes do not explain the temperature drop.")])],
    "support an exothermic or endothermic claim with a temperature change")

ch_t5_p6_hess_claim = _b("ch_t5_p6_hess_claim", "6.9", "6.D", [
    ("A student claims that the enthalpy change for a reaction can be found by adding the enthalpy changes of a series of steps that sum to the overall reaction. Which statement best justifies the claim?",
     ("Enthalpy is a state function, so the overall change depends only on the initial and final states and not on the path.", "Hess's law follows from enthalpy being a state function."),
     [("Energy is always conserved, so the steps must each release the same amount of energy.", "Conservation of energy does not require equal energy for each step."), ("Each step happens at the same rate, so their enthalpy changes add.", "Rates are unrelated to enthalpy changes."), ("The reaction takes place at constant temperature, so the path does not matter.", "A constant temperature is not the reason; state-function behavior is.")]),
    ("A student reverses a reaction and claims that the sign of ΔH changes. Which statement best justifies the claim?",
     ("The energy released in one direction must be absorbed in the other, so ΔH of the reverse reaction is the negative of ΔH forward.", "Reversing the path between the same two states reverses the sign of the enthalpy change."),
     [("The reverse reaction has the same ΔH because the same bonds are broken and formed.", "The sign of ΔH depends on the direction between states."), ("The magnitude of ΔH changes when the reaction is reversed, but its sign stays the same.", "Reversal changes the sign and keeps the magnitude."), ("The reverse reaction is always endothermic, no matter what the forward reaction was.", "The sign depends on the direction of the original reaction.")])],
    "justify Hess's law manipulations with enthalpy as a state function")

ch_t5_p6_acid_strength_claim = _b("ch_t5_p6_acid_strength_claim", "8.3", "6.F", [
    ("Two acids, HX and HY, are prepared at the same concentration. The pH of the HX solution is 2.0 and the pH of the HY solution is 3.5. A student claims that HX is the stronger acid. Which statement best connects the data to the claim?",
     ("The lower pH of HX shows a greater [H₃O⁺], meaning HX ionizes to a greater extent than HY at the same concentration.", "At equal concentrations, a lower pH means more ionization."),
     [("The higher pH of HY shows that HY ionizes more than HX.", "A higher pH means a lower [H₃O⁺] and less ionization."), ("The two acids must have the same Ka because their concentrations are equal.", "The extent of ionization differs for different acids even at equal concentrations."), ("The pH values show how much HX and HY were added, not their strength.", "At equal concentrations the pH difference is due to ionization.")]),
    ("A student measures the pH of 0.10 M solutions of acetic acid and hydrochloric acid and finds 2.9 and 1.0. The student claims that acetic acid is a weak acid. Which statement best connects the data to the claim?",
     ("The pH of 2.9 is far above the 1.0 expected for a fully ionized 0.10 M monoprotic acid, so only a small fraction ionizes.", "A 0.10 M strong monoprotic acid would have a pH near 1.0."),
     [("The pH of 2.9 is lower than that of HCl, so acetic acid ionizes completely.", "The pH of acetic acid is higher, not lower, than that of HCl."), ("The pH values are different because acetic acid is present at a different concentration than HCl.", "Both solutions are 0.10 M."), ("The pH of 2.9 shows that acetic acid is a base, since its pH differs from that of HCl.", "A pH below 7 shows an acidic solution.")])],
    "connect pH data at equal concentration to acid strength")

ch_t5_p6_titration_claim = _b("ch_t5_p6_titration_claim", "8.5", "6.B", [
    ("A titration curve of a weak acid with a strong base shows a pH of 4.7 at the volume of base that is half the equivalence volume. A student claims that the pKa of the acid is about 4.7. Which statement best supports the claim?",
     ("At the half-equivalence point [HA] = [A⁻], so pH = pKa in the Henderson-Hasselbalch equation.", "The ratio of conjugate base to acid is 1 at the half-equivalence point, so the log term is zero."),
     [("At the half-equivalence point all of the acid has been converted to A⁻, so pH = pKa.", "At the half-equivalence point only half of the acid has reacted."), ("At the half-equivalence point the solution is neutral, so pH = 7 = pKa.", "The solution at this point is not neutral; the pH is the pKa."), ("At the half-equivalence point the strong base is in excess, so pH = pKa.", "No excess base is present at the half-equivalence point.")]),
    ("A titration curve of a strong acid with a strong base rises steeply near pH 7. A student claims that the equivalence point is at pH 7. Which statement best supports the claim?",
     ("The salt formed from a strong acid and a strong base does not react with water, so the solution at the equivalence point is neutral.", "Neither ion of the salt hydrolyzes."),
     [("The excess base at the equivalence point makes the solution neutral.", "There is no excess base at the equivalence point."), ("The conjugate base of a strong acid is a strong base that raises the pH.", "The conjugate base of a strong acid is negligibly basic."), ("The strong acid is fully ionized, so the pH equals 7 at the start of the titration.", "The initial pH of a strong acid solution is low.")])],
    "support a claim about a titration curve with the data and the chemistry")

ch_t5_p6_buffer_claim = _b("ch_t5_p6_buffer_claim", "8.8", "6.D", [
    ("A student claims that a solution containing equal moles of HF and NaF can serve as a buffer. Which justification is best?",
     ("It contains a weak acid and its conjugate base, which can neutralize added base and added acid respectively.", "A buffer needs both members of a conjugate pair."),
     [("It contains a strong acid and a strong base, which neutralize each other.", "HF is a weak acid, and NaF is a salt, not a strong base."), ("It contains a high concentration of H₃O⁺ ions that react with added OH⁻.", "A buffer works through its weak acid and conjugate base, not through a high concentration of H₃O⁺."), ("It contains two salts that do not react with water.", "F⁻ reacts with water to a small extent, and HF is a weak acid.")]),
    ("A student claims that 0.10 M HCl mixed with an equal volume of 0.10 M NaCl is not a buffer. Which justification is best?",
     ("HCl is a strong acid, so Cl⁻ cannot neutralize added acid and the mixture does not resist pH change.", "A buffer requires a weak acid and its conjugate base."),
     [("NaCl is a strong electrolyte, so the mixture conducts electricity too well to be a buffer.", "Conductivity is not the criterion for a buffer."), ("HCl and NaCl react to form a precipitate, which removes the acid from the solution.", "No precipitate forms when HCl and NaCl are mixed."), ("The mixture contains too much water, which dilutes any buffering ability it might have.", "The amount of water is not the reason.")])],
    "justify whether a mixture is a buffer from its conjugate pair")

ch_t5_p6_kmt_claim = _b("ch_t5_p6_kmt_claim", "3.5", "6.E", [
    ("A student claims that the pressure of a gas in a rigid container increases when the temperature is raised. Which statement best justifies the claim at the particulate level?",
     ("At the higher temperature the particles have greater average kinetic energy and collide with the walls more often and with more force.", "Higher temperature means faster particles, so the collisions with the walls are more frequent and more forceful."),
     [("At the higher temperature there are more gas particles in the container.", "Heating a sealed rigid container does not change the number of particles."), ("At the higher temperature the particles are larger and take up more space.", "Particles do not change size with temperature in the ideal gas model."), ("At the higher temperature the particles are attracted more strongly to the walls.", "The pressure rises because of collisions, not stronger attraction to the walls.")]),
    ("A student claims that compressing a gas at constant temperature to half its volume doubles its pressure. Which statement best justifies the claim?",
     ("The same particles in half the volume strike the walls twice as often per unit area, so the pressure doubles.", "The collision rate per unit area doubles when the volume is halved at constant temperature."),
     [("The particles move twice as fast because the volume decreases, so they hit the walls harder.", "At constant temperature the average speed does not change."), ("The number of particles doubles when the volume is halved, so the pressure doubles.", "Compression does not change the number of particles."), ("The particles become attracted to each other and collide with the walls harder than before.", "Pressure increases because of collision frequency, not stronger attractions.")])],
    "justify a gas law claim with collision frequency and force")
