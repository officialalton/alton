"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 개념 문항 3부: Practice 4(모형으로 예측·설명) 22개. 고정 문장 은행(chem_p0_n._bank): 원형마다 장면 2개, 정답 1 + 이름 붙은 오개념 3.
선택지 길이는 서로 비슷하게 맞춘다(정답이 가장 길다는 단서를 주지 않는다). 필요한 정보는 모두 본문에 있다."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5f"
    return f


ch_t5_p4_k_temperature = _b("ch_t5_p4_k_temperature", "7.6", "4.A", [
    ("The forward reaction of an equilibrium is exothermic. How does the value of K change when the temperature is increased?",
     ("K decreases, because the equilibrium shifts toward the reactants to absorb the added energy.", "Raising the temperature of an exothermic reaction favors the reverse direction, lowering K."),
     [("K increases, because adding energy always drives a reaction toward the products.", "For an exothermic reaction the added energy favors the endothermic reverse reaction."), ("K does not change, because K depends only on the stoichiometry of the reaction.", "K depends on temperature, and it changes when the temperature changes."), ("K increases, because the rate of the forward reaction increases more than the rate of the reverse reaction.", "At equilibrium the forward and reverse rates are equal, and K reflects the energy change instead.")]),
    ("The forward reaction of an equilibrium is endothermic. How does the value of K change when the temperature is decreased?",
     ("K decreases, because the equilibrium shifts toward the reactants when energy is removed from an endothermic reaction.", "Lowering the temperature favors the exothermic reverse reaction, lowering K."),
     [("K increases, because removing energy favors the reaction that absorbs energy.", "Removing energy favors the exothermic direction, not the endothermic one."), ("K does not change, because a temperature change only changes the rate of the reaction.", "Temperature changes the value of K for a reaction at equilibrium."), ("K increases, because there are more collisions at a lower temperature.", "There are fewer, less energetic collisions at a lower temperature.")])],
    "predict how K changes with temperature for exothermic and endothermic reactions")

ch_t5_p4_k_magnitude = _b("ch_t5_p4_k_magnitude", "7.5", "4.A", [
    ("A reaction at equilibrium has $K = 2 \\times 10^{-8}$ at a given temperature. Which statement best describes the equilibrium mixture?",
     ("The mixture contains mostly reactants, with very little product present.", "A very small K means the equilibrium lies far toward the reactants."),
     [("The mixture contains mostly products, with very little reactant present.", "That would require a large K."), ("The mixture contains about equal amounts of reactants and products.", "Roughly equal amounts correspond to K near 1."), ("The mixture contains only reactants and the reaction does not occur.", "A small K does not mean the reaction does not occur; a very small amount of product forms.")]),
    ("At 25 °C the reaction N₂O₄(g) ⇌ 2 NO₂(g) has $K = 0.15$, and at a higher temperature $K = 4.5$. Which statement about the extent of reaction is correct?",
     ("The reaction goes farther toward the products at the higher temperature, because K is larger.", "A larger K means more products at equilibrium."),
     [("The reaction goes farther toward the products at 25 °C, because K is smaller.", "A smaller K means less product at equilibrium."), ("The reaction goes to the same extent at both temperatures because it has the same stoichiometry.", "Different K values show different extents."), ("The reaction goes to completion at the higher temperature.", "K = 4.5 means products are favored but not that the reaction goes to completion.")])],
    "interpret the size of K as the position of equilibrium")

ch_t5_p4_spontaneity_signs = _b("ch_t5_p4_spontaneity_signs", "9.3", "4.A", [
    ("A reaction has a positive ΔH° and a positive ΔS°. Under which condition is the reaction spontaneous?",
     ("At high temperature, because the TΔS term becomes larger than ΔH.", "ΔG = ΔH − TΔS becomes negative when T is high enough for TΔS to exceed ΔH."),
     [("At low temperature, because the positive ΔH favors the reaction.", "A positive ΔH opposes spontaneity and is overcome only when the TΔS term is large."), ("At all temperatures, because the entropy increases.", "The unfavorable ΔH prevents spontaneity at low temperature."), ("At no temperature, because a positive ΔH makes ΔG always positive.", "Above a certain temperature ΔG becomes negative.")]),
    ("A reaction has a negative ΔH° and a negative ΔS°. Under which condition is the reaction spontaneous?",
     ("At low temperature, because the favorable ΔH outweighs the small TΔS term.", "ΔG = ΔH − TΔS is negative when T is low enough that −TΔS is smaller than |ΔH|."),
     [("At high temperature, because the entropy decrease favors the reaction.", "A negative ΔS is unfavorable and its effect grows with temperature."), ("At all temperatures, because the reaction releases energy.", "At high temperature the unfavorable −TΔS term makes ΔG positive."), ("At no temperature, because a negative ΔS makes ΔG always positive.", "At low temperature the favorable ΔH makes ΔG negative.")])],
    "predict the temperature dependence of spontaneity from the signs of ΔH and ΔS")

ch_t5_p4_kinetic_control = _b("ch_t5_p4_kinetic_control", "9.4", "4.B", [
    ("A reaction is thermodynamically favorable (ΔG° < 0), but a mixture of the reactants shows no change at room temperature for years. Which explanation is most consistent with chemical theory?",
     ("The reaction has a very high activation energy, so the rate is extremely slow at room temperature.", "Thermodynamics predicts whether a reaction can occur, and kinetics determines how fast."),
     [("The reaction has a positive ΔG°, so it cannot occur.", "The problem states that ΔG° is negative."), ("The reaction is at equilibrium, so the amounts of reactants and products do not change.", "At equilibrium there would be measurable products when ΔG° is negative."), ("The reaction has a negative ΔH, so it releases energy instead of reacting.", "A negative ΔH does not prevent the reaction from happening.")]),
    ("Diamond is thermodynamically less stable than graphite at 1 atm, yet diamonds persist for millions of years. Which explanation is most consistent with chemical theory?",
     ("The conversion has a very high activation energy, so it is kinetically extremely slow.", "A favorable ΔG° does not require a fast reaction."),
     [("The conversion has a positive ΔG°, so diamond is more stable than graphite.", "Graphite is the more stable form at 1 atm."), ("The conversion is at equilibrium, so diamond and graphite are present in equal amounts.", "Diamond and graphite are not at equilibrium at room temperature."), ("The conversion releases no energy, so it cannot occur.", "The conversion is slightly exothermic and cannot be ruled out by energy alone.")])],
    "separate thermodynamic favorability from reaction rate")

ch_t5_p4_cell_direction = _b("ch_t5_p4_cell_direction", "9.8", "4.A", [
    ("A galvanic cell is built from a Zn electrode in Zn²⁺ solution ($E^{\\circ} = -0.76\\text{ V}$) and a Cu electrode in Cu²⁺ solution ($E^{\\circ} = +0.34\\text{ V}$). Which statement describes the cell correctly?",
     ("Zn is the anode where oxidation occurs, and electrons flow through the wire from the Zn electrode to the Cu electrode.", "The half-cell with the lower reduction potential is oxidized at the anode, and electrons flow from anode to cathode."),
     [("Cu is the anode where oxidation occurs, and electrons flow from the Cu electrode to the Zn electrode.", "Copper has the greater reduction potential and is reduced at the cathode."), ("Zn is the cathode where reduction occurs, and electrons flow from the Cu electrode to the Zn electrode.", "Zinc is oxidized, so it is the anode."), ("Both electrodes are oxidized, and electrons flow through the salt bridge.", "One electrode is reduced, and electrons flow through the wire rather than the salt bridge.")]),
    ("In the galvanic cell Mg|Mg²⁺ ($E^{\\circ} = -2.37\\text{ V}$) and Ag|Ag⁺ ($E^{\\circ} = +0.80\\text{ V}$), which statement is correct?",
     ("Silver ions are reduced at the cathode, and the Mg electrode loses mass as it is oxidized.", "Mg is oxidized and dissolves; Ag⁺ is reduced and deposits on the silver electrode."),
     [("Silver is oxidized at the anode, and the Ag electrode loses mass.", "Silver has the greater reduction potential and is reduced."), ("Magnesium ions are reduced at the cathode, and the Mg electrode gains mass.", "Mg²⁺ has the lower reduction potential and is not reduced in this cell."), ("No electrons flow because both electrodes are metals.", "Electrons flow because the half-cells differ in reduction potential.")])],
    "identify the anode, the cathode, and the direction of electron flow from reduction potentials")

ch_t5_p4_entropy_sign = _b("ch_t5_p4_entropy_sign", "9.2", "4.A", [
    ("Which process is expected to have a negative ΔS for the system?",
     ("The condensation of water vapor to liquid water at 25 °C.", "Gas molecules become more ordered and less free as they form a liquid."),
     [("The sublimation of solid carbon dioxide to gas.", "A solid becoming a gas increases the entropy."), ("The dissolving of solid sodium chloride in water.", "A crystal separating into dispersed ions increases the entropy."), ("The decomposition of CaCO₃(s) into CaO(s) and CO₂(g).", "A gas is produced, which increases the entropy.")]),
    ("Which reaction is expected to have the most negative ΔS for the system?",
     ("N₂(g) + 3 H₂(g) → 2 NH₃(g)", "Four moles of gas become two moles of gas, a decrease in the number of gas particles."),
     [("2 NH₃(g) → N₂(g) + 3 H₂(g)", "Two moles of gas become four moles of gas, an increase in entropy."), ("H₂(g) + Cl₂(g) → 2 HCl(g)", "The number of moles of gas does not change, so ΔS is small."), ("2 H₂O(l) → 2 H₂(g) + O₂(g)", "Gases are produced from a liquid, which increases the entropy.")])],
    "predict the sign of an entropy change from the states and the number of particles")

ch_t5_p4_acid_strength_structure = _b("ch_t5_p4_acid_strength_structure", "8.6", "4.A", [
    ("HF, HCl, HBr, and HI are compared. Which statement best explains why HI is the strongest acid of the four in water?",
     ("The H–I bond is the longest and weakest of the four, so it is the easiest to break to release H⁺.", "Bond strength decreases down the group, favoring ionization."),
     [("Iodine is the most electronegative of the four halogens, so it pulls the electrons away from hydrogen most.", "Iodine is the least electronegative of these halogens."), ("The H–I bond is the shortest of the four, so it breaks most easily.", "The H–I bond is the longest, not the shortest."), ("HI has the most hydrogen bonding between molecules, so it ionizes most.", "Hydrogen bonding is strongest in HF, the weakest of these acids.")]),
    ("Which of the following acids is predicted to be the stronger acid, HClO₃ or HClO₂, and why?",
     ("HClO₃, because the additional oxygen atom draws electron density away from the O–H bond and stabilizes the conjugate base.", "More oxygen atoms bonded to the central atom increase acid strength."),
     [("HClO₂, because it has fewer oxygen atoms and so holds its proton less tightly.", "Fewer oxygen atoms make the O–H bond less polarized."), ("They are equally strong because each contains chlorine and hydrogen.", "The number of oxygen atoms changes the acid strength."), ("HClO₂, because chlorine has a lower oxidation number in it.", "A higher oxidation number of chlorine goes with the stronger acid.")])],
    "explain acid strength with bond strength and electron withdrawal")

ch_t5_p4_ph_pka_species = _b("ch_t5_p4_ph_pka_species", "8.7", "4.A", [
    ("A weak acid HA has a pKa of 4.8. Which species predominates in a solution with a pH of 6.8?",
     ("A⁻, because the pH is greater than the pKa of the acid.", "When pH > pKa the conjugate base is the predominant form."),
     [("HA, because the pH is greater than the pKa of the acid.", "When pH > pKa the acid form is the minor form."), ("HA and A⁻ in equal amounts, because the solution is nearly neutral.", "Equal amounts occur only at pH equal to the pKa."), ("Neither, because the pH is not equal to the pKa.", "One of the two forms always predominates away from the pKa.")]),
    ("A weak base's conjugate acid BH⁺ has a pKa of 9.3. Which species predominates in a solution with a pH of 7.0?",
     ("BH⁺, because the pH is lower than the pKa of the conjugate acid.", "When pH < pKa the protonated form predominates."),
     [("B, because the pH is lower than the pKa of the conjugate acid.", "At a pH below the pKa, the protonated form predominates."), ("B and BH⁺ in equal amounts, because the solution is neutral.", "Equal amounts occur only when pH equals the pKa."), ("Neither, because the pH is lower than 9.3.", "One of the two forms always predominates away from the pKa.")])],
    "predict the predominant acid or base form from the pH and the pKa")

ch_t5_p4_imf_ranking = _b("ch_t5_p4_imf_ranking", "3.1", "4.A", [
    ("Which list ranks the substances CH₄, CH₃OH, and CH₃CH₃ in order of increasing boiling point?",
     ("CH₄ < CH₃CH₃ < CH₃OH", "Dispersion forces increase with the number of electrons, and CH₃OH adds hydrogen bonding."),
     [("CH₃OH < CH₄ < CH₃CH₃", "Hydrogen bonding makes CH₃OH the highest, not the lowest."), ("CH₃CH₃ < CH₄ < CH₃OH", "Ethane has more electrons than methane and a higher boiling point."), ("CH₃CH₃ < CH₃OH < CH₄", "Methane has the weakest forces and the lowest boiling point.")]),
    ("Which list ranks Ne, Ar, and Kr in order of increasing boiling point?",
     ("Ne < Ar < Kr", "The larger electron clouds of heavier noble gases give stronger dispersion forces."),
     [("Kr < Ar < Ne", "This reverses the dependence of dispersion forces on size."), ("Ar < Ne < Kr", "Neon has the smallest cloud and the weakest dispersion forces."), ("They all have the same boiling point because they are noble gases.", "Dispersion forces differ with the number of electrons.")])],
    "rank substances by the strength of intermolecular forces")

ch_t5_p4_solid_properties = _b("ch_t5_p4_solid_properties", "3.2", "4.C", [
    ("Solid X is hard, has a very high melting point, and does not conduct electricity as a solid or when melted. Which type of solid is X most likely?",
     ("A covalent network solid, because strong covalent bonds extend throughout the structure and there are no mobile charges.", "Network solids are hard with high melting points and are nonconductors."),
     [("An ionic solid, because ionic solids conduct electricity when melted.", "Molten ionic compounds conduct, which contradicts the data."), ("A metallic solid, because metals are hard and have high melting points.", "Metals conduct electricity as solids."), ("A molecular solid, because molecular solids have very high melting points.", "Molecular solids have low melting points.")]),
    ("Solid Y is soft, has a low melting point, and does not conduct electricity as a solid or as a liquid. Which type of solid is Y most likely?",
     ("A molecular solid, because the particles are held together by weak intermolecular forces.", "Weak forces explain the softness and the low melting point."),
     [("An ionic solid, because ionic solids have low melting points.", "Ionic solids have high melting points."), ("A metallic solid, because metals are soft and have low melting points.", "Metals conduct electricity."), ("A covalent network solid, because network solids are soft.", "Network solids are hard with very high melting points.")])],
    "classify a solid from its physical properties")

ch_t5_p4_phase_particles = _b("ch_t5_p4_phase_particles", "3.3", "4.C", [
    ("A sample of water is heated at constant pressure from 80 °C to 100 °C and then continues to be heated while it boils. Which statement describes what happens to the average kinetic energy of the molecules during boiling?",
     ("The average kinetic energy stays constant while the added energy goes into overcoming intermolecular attractions.", "The temperature is constant during boiling, so the average kinetic energy does not change."),
     [("The average kinetic energy increases because the added energy raises the temperature.", "The temperature remains constant during a phase change."), ("The average kinetic energy decreases because the molecules spread apart.", "Spreading apart changes the potential energy, not the temperature."), ("The average kinetic energy becomes zero while the water changes phase.", "Molecules keep moving during a phase change.")]),
    ("Which statement best describes the particles in a gas, compared with the particles in a liquid at the same temperature?",
     ("The gas particles are much farther apart and have negligible attractions, with the same average kinetic energy.", "At the same temperature the average kinetic energy is the same in both phases."),
     [("The gas particles move faster on average because gases have a higher temperature.", "The temperature is the same in this comparison."), ("The gas particles have stronger attractions that hold them in a fixed volume.", "Gas particles have much weaker attractions than liquid particles."), ("The gas particles are in fixed positions with no motion.", "Gas particles move freely.")])],
    "describe particle motion and spacing across phase changes")

ch_t5_p4_nonideal_gas = _b("ch_t5_p4_nonideal_gas", "3.6", "4.D", [
    ("Which conditions cause a real gas to deviate most from ideal behavior?",
     ("High pressure and low temperature, because particles are close together and attractions and particle volume matter.", "At high pressure and low temperature the ideal gas assumptions fail."),
     [("Low pressure and high temperature, because the particles are far apart and move quickly.", "Those conditions make a real gas behave most ideally."), ("High pressure and high temperature, because the particles are close together and fast.", "High temperature reduces the effect of attractions and favors ideal behavior."), ("Low pressure and low temperature, because the particles are far apart and slow.", "At low pressure the volume of particles is negligible, but the low temperature increases the effect of attractions.")]),
    ("A gas at high pressure has a measured volume greater than the volume predicted by the ideal gas law. Which factor best explains the difference?",
     ("The particles themselves occupy a significant part of the volume, which the ideal gas model ignores.", "At high pressure the particle volume becomes a significant fraction of the container volume."),
     [("The attractions between the particles pull them together and increase the volume.", "Attractions would reduce the volume, not increase it."), ("The particles stop moving at high pressure, which increases the volume.", "Particles keep moving at any pressure."), ("The number of moles of gas increases as the pressure rises.", "The amount of gas does not change with pressure.")])],
    "explain deviations from the ideal gas law with particle volume and attractions")

ch_t5_p4_solution_representation = _b("ch_t5_p4_solution_representation", "3.8", "4.A", [
    ("A particulate diagram of an aqueous solution of CaCl₂ should show which ratio of ions?",
     ("Two Cl⁻ ions for every Ca²⁺ ion, each surrounded by water molecules.", "CaCl₂ dissociates into one Ca²⁺ and two Cl⁻ ions."),
     [("One Cl⁻ ion for every Ca²⁺ ion, each surrounded by water molecules.", "The formula CaCl₂ has two chloride ions per calcium ion."), ("Two Ca²⁺ ions for every Cl⁻ ion, each surrounded by water molecules.", "This reverses the ratio in the formula."), ("Intact CaCl₂ molecules surrounded by water molecules.", "CaCl₂ is an ionic compound that dissociates in water.")]),
    ("A particulate diagram of an aqueous solution of ethanol, C₂H₅OH, should show which species?",
     ("Intact C₂H₅OH molecules mixed among water molecules, with hydrogen bonds between the two kinds of molecules.", "Ethanol dissolves as molecules and can hydrogen bond with water."),
     [("C₂H₅⁺ and OH⁻ ions mixed among water molecules.", "Ethanol does not dissociate into these ions."), ("Separate C, H, and O atoms mixed among water molecules.", "Dissolving does not break the molecules into atoms."), ("Intact C₂H₅OH molecules clumped together away from the water.", "Ethanol is miscible with water and mixes uniformly.")])],
    "represent the species in an ionic or molecular solution")

ch_t5_p4_energy_diagram = _b("ch_t5_p4_energy_diagram", "6.2", "4.B", [
    ("An energy diagram shows the reactants at a higher energy than the products. Which statement about the reaction is consistent with the diagram?",
     ("The reaction is exothermic, because the products are lower in energy and energy is released.", "Products at lower energy than the reactants mean energy is released to the surroundings."),
     [("The reaction is endothermic, because the products are lower in energy.", "Lower-energy products correspond to a release of energy."), ("The reaction is endothermic, because energy must be added to reach the transition state.", "Activation energy is needed in both endothermic and exothermic reactions."), ("The reaction has no net energy change because it needs activation energy.", "The net energy change is the difference between the products and the reactants.")]),
    ("In an energy diagram for a reaction with ΔH > 0, which statement about the activation energies of the forward and reverse reactions is consistent with the diagram?",
     ("The activation energy of the forward reaction is larger than that of the reverse reaction by the amount ΔH.", "The products sit higher than the reactants, so climbing from the reactants takes more energy than climbing from the products."),
     [("The activation energy of the reverse reaction is larger than that of the forward reaction by the amount ΔH.", "The reverse reaction starts from the higher-energy products and has the smaller barrier."), ("The activation energies of the forward and reverse reactions are equal because they share the same transition state.", "A shared transition state does not make the barriers equal when the reactants and products differ in energy."), ("The activation energy of the forward reaction is zero because the reaction absorbs energy.", "Every reaction has a positive activation energy.")])],
    "read the sign of ΔH from the relative energies of reactants and products")


ch_t5_p4_reaction_type = _b("ch_t5_p4_reaction_type", "4.7", "4.A", [
    ("Aqueous solutions of AgNO₃ and NaCl are mixed and a white solid forms. Which type of reaction has occurred?",
     ("A precipitation reaction, because an insoluble ionic compound formed from the combined ions.", "AgCl is insoluble, so the ions combine and separate from the solution."),
     [("An oxidation-reduction reaction, because silver ions gain electrons from chloride ions.", "No change in oxidation numbers occurs in this exchange of ions."), ("An acid-base reaction, because the white solid is a salt.", "No proton transfer occurs in this reaction."), ("A decomposition reaction, because the nitrate ions break apart.", "The nitrate ions stay unchanged in solution.")]),
    ("Zinc metal is placed in an aqueous solution of copper(II) sulfate and the blue color fades as copper metal forms. Which type of reaction has occurred?",
     ("An oxidation-reduction reaction, because zinc loses electrons and copper(II) ions gain electrons.", "Electrons are transferred from the zinc atoms to the copper(II) ions."),
     [("A precipitation reaction, because a solid forms from two aqueous solutions.", "The solid is copper metal formed by electron transfer, not an insoluble ionic compound."), ("An acid-base reaction, because the metal reacts with a solution.", "No protons are transferred in this reaction."), ("A decomposition reaction, because the copper compound breaks apart.", "The change is driven by electron transfer, not decomposition.")])],
    "classify a reaction from the observations and the species involved")

ch_t5_p4_specific_heat = _b("ch_t5_p4_specific_heat", "6.4", "4.A", [
    ("Equal masses of metal X and metal Y are heated to the same temperature and placed in identical cups of water at the same initial temperature. The water in the cup with X warms more than the water in the cup with Y. Which conclusion is best supported?",
     ("Metal X has the greater specific heat, because it transferred more energy to the water while cooling.", "A larger heat transfer for the same mass and the same temperature drop means a larger specific heat."),
     [("Metal Y has the greater specific heat, because the water warmed less.", "The water warmed less because Y released less energy, which means a lower specific heat."), ("The two metals have the same specific heat because their masses are equal.", "The same mass does not give the same specific heat."), ("Metal X has the lower specific heat, because it warmed the water more quickly.", "The amount of energy released, not the speed, shows the specific heat.")]),
    ("Two samples with the same mass absorb the same amount of heat. Sample P warms by 5.0 °C and sample Q warms by 12.0 °C. Which statement is correct?",
     ("Sample P has the greater specific heat, because it needs more energy for each degree of temperature change.", "With q and m equal, c is inversely proportional to ΔT."),
     [("Sample Q has the greater specific heat, because its temperature changed more.", "A larger temperature change for the same energy means a smaller specific heat."), ("The samples have the same specific heat because they absorbed the same heat.", "The same heat with different temperature changes shows different specific heats."), ("Sample P has the lower specific heat, because its temperature changed less.", "A smaller temperature change for the same heat means a larger specific heat.")])],
    "compare specific heats from heat transfer and temperature change")

ch_t5_p4_bond_enthalpy = _b("ch_t5_p4_bond_enthalpy", "6.7", "4.A", [
    ("A reaction breaks bonds with a total bond energy of 1,240 kJ and forms bonds with a total bond energy of 1,380 kJ. Which statement about the reaction is correct?",
     ("The reaction is exothermic, with an estimated ΔH of −140 kJ, because more energy is released in forming bonds than is absorbed in breaking bonds.", "ΔH = (energy of bonds broken) − (energy of bonds formed) = 1,240 − 1,380."),
     [("The reaction is endothermic, with an estimated ΔH of +140 kJ, because more energy is released than absorbed.", "The sign is reversed: more energy released than absorbed is exothermic."), ("The reaction is exothermic, with an estimated ΔH of −2,620 kJ, because the two energies are added.", "The estimate uses the difference of the two energies, not the sum."), ("The reaction has no enthalpy change because bonds are both broken and formed.", "The net difference between bonds broken and formed gives ΔH.")]),
    ("Which statement is correct about the enthalpy change for a reaction in which the bonds formed are weaker, in total, than the bonds broken?",
     ("The reaction is endothermic, because more energy is absorbed in breaking bonds than is released in forming bonds.", "Weaker bonds in the products mean the products are higher in energy than the reactants."),
     [("The reaction is exothermic, because forming bonds always releases energy.", "The net energy depends on the comparison of the total energy absorbed and released."), ("The reaction is exothermic, because weaker bonds release energy as they form.", "Weaker bonds release less energy than the stronger bonds that were broken absorbed."), ("The reaction is endothermic, because breaking bonds releases energy.", "Breaking bonds absorbs energy.")])],
    "estimate the sign of the enthalpy change from the energies of bonds broken and formed")

ch_t5_p4_phase_heat = _b("ch_t5_p4_phase_heat", "6.5", "4.A", [
    ("Ice at 0 °C is heated at a constant rate until it melts completely and then continues heating. Which statement describes the temperature of the sample during melting?",
     ("The temperature stays at 0 °C because the added energy is used to overcome attractions between molecules.", "During a phase change the added energy changes the potential energy rather than the temperature."),
     [("The temperature rises steadily because the energy is added at a constant rate.", "During a phase change the temperature does not rise."), ("The temperature falls because the molecules separate and need less energy.", "The temperature does not fall during melting."), ("The temperature stays at 0 °C because no energy is being added.", "Energy is being added; it changes the potential energy.")]),
    ("Steam at 100 °C condenses to liquid water at 100 °C. Which statement about the energy change is correct?",
     ("Energy is released to the surroundings as the molecules form attractions, while the temperature stays at 100 °C.", "Condensation is exothermic, releasing the energy absorbed during vaporization."),
     [("Energy is absorbed from the surroundings as the molecules get closer together.", "Condensation releases energy."), ("No energy is transferred because the temperature does not change.", "Energy is transferred even though the temperature is constant."), ("The temperature of the water falls below 100 °C as it condenses.", "The temperature stays constant during the phase change.")])],
    "describe energy and temperature changes during a phase change")

ch_t5_p4_net_ionic = _b("ch_t5_p4_net_ionic", "4.2", "4.B", [
    ("Solutions of Pb(NO₃)₂ and KI are mixed and a yellow solid PbI₂ forms. Which species are spectator ions in the reaction?",
     ("K⁺ and NO₃⁻, because they remain dissolved and do not take part in forming the solid.", "Only Pb²⁺ and I⁻ combine to form the precipitate."),
     [("Pb²⁺ and I⁻, because they are present in the greatest amounts.", "These ions form the solid and are therefore not spectators."), ("K⁺ and I⁻, because they are both present in the KI solution.", "I⁻ takes part in forming PbI₂."), ("There are no spectator ions because all of the ions react.", "K⁺ and NO₃⁻ remain unchanged in solution.")]),
    ("Which equation is the net ionic equation for the reaction between aqueous BaCl₂ and aqueous Na₂SO₄, which forms solid BaSO₄?",
     ("Ba²⁺(aq) + SO₄²⁻(aq) → BaSO₄(s)", "The net ionic equation shows only the species that change."),
     [("BaCl₂(aq) + Na₂SO₄(aq) → BaSO₄(s) + 2 NaCl(aq)", "This is the molecular equation, not the net ionic equation."), ("Ba²⁺(aq) + 2 Cl⁻(aq) + 2 Na⁺(aq) + SO₄²⁻(aq) → BaSO₄(s) + 2 Na⁺(aq) + 2 Cl⁻(aq)", "This is the complete ionic equation, including spectator ions."), ("Na⁺(aq) + Cl⁻(aq) → NaCl(s)", "Sodium chloride is soluble and does not precipitate.")])],
    "identify spectator ions and write a net ionic equation")
