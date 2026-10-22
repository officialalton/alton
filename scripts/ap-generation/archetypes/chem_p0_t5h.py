"""AP Chemistry 원형 — CH4·CH5 5세트 채우기(2026-10-21) 개념 문항 4부: 1차 실행 뒤 CH5 에 남은 칸((6,2)·(4,4)·(6,6)·(4,2))을 메우는 10개. 고정 문장 은행(chem_p0_n._bank), 장면 2개씩, 선택지 길이는 서로 비슷하게."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5h"
    return f


ch_t5_p2_hess_question = _b("ch_t5_p2_hess_question", "6.9", "2.A", [
    ("A student measures the enthalpy changes of two reactions in a calorimeter and wants to find the enthalpy change of a third reaction that is hard to measure directly. Which question can be answered by combining the results?",
     ("What is the enthalpy change of the third reaction, if its equation equals the sum of the two measured reactions?", "Hess's law adds the enthalpy changes of reactions that sum to the target reaction."),
     [("What is the rate of the third reaction at 25 °C, from the heats of the two reactions?", "Enthalpy changes do not give a reaction rate."), ("What is the mechanism of the third reaction, from the temperatures recorded?", "Temperatures from calorimetry do not reveal a mechanism."), ("What is the equilibrium constant of the third reaction, from the masses used?", "Masses do not give an equilibrium constant without more information.")]),
    ("A student burns equal moles of two fuels in a calorimeter and records the temperature rise of the water. Which question can be answered with these data?",
     ("Which fuel releases more energy per mole when it burns completely?", "The temperature rise of the same mass of water shows the heat released."),
     [("Which fuel has the greater activation energy for combustion?", "A temperature rise does not give an activation energy."), ("Which fuel has the stronger carbon-carbon bonds in its molecules?", "The data do not identify individual bond strengths."), ("Which fuel burns at the greater rate in the first second?", "A final temperature rise does not give a rate.")])],
    "choose the question that calorimetric data and Hess's law can answer")

ch_t5_p2_cold_pack_predict = _b("ch_t5_p2_cold_pack_predict", "6.1", "2.B", [
    ("A student dissolves a salt in water in an insulated cup and finds that the temperature of the solution decreases. The student then doubles the mass of salt in the same amount of water. Which prediction is best?",
     ("The temperature decrease will be larger, because more salt absorbs more energy from the same amount of water.", "More dissolving absorbs more energy, so the water cools further."),
     [("The temperature decrease will be smaller, because more salt means more energy released.", "The process absorbs energy, so more salt absorbs more energy."), ("The temperature will not change, because the same amount of water is used.", "The energy absorbed depends on the amount of salt dissolved."), ("The temperature will increase, because more particles collide with each other.", "The solution cools because the process is endothermic.")]),
    ("A student mixes two solutions in an insulated cup and finds that the temperature rises by 4.0 °C. The student repeats the experiment with twice the volume of each solution at the same concentrations. Which prediction is best?",
     ("The temperature rise will be about 4.0 °C, because twice the energy is released but into twice the mass of solution.", "Doubling everything doubles the energy and the mass, so the temperature change is unchanged."),
     [("The temperature rise will be about 8.0 °C, because twice as much energy is released.", "The energy is shared by twice the mass, so the rise is the same."), ("The temperature rise will be about 2.0 °C, because the extra solution absorbs energy.", "The temperature change depends on the ratio of energy to mass, which is unchanged."), ("The temperature will not change, because the concentrations are the same.", "The reaction still releases energy, so the temperature rises.")])],
    "predict how a temperature change scales with the amount of reactant")

ch_t5_p2_formation_procedure = _b("ch_t5_p2_formation_procedure", "6.6", "2.C", [
    ("A student wants to measure the enthalpy change of the reaction of Zn(s) with aqueous CuSO₄ using a coffee-cup calorimeter. Which procedure is best?",
     ("Measure the volume and the initial temperature of the CuSO₄ solution, add a known mass of zinc, stir, and record the highest temperature.", "The temperature change, the mass of the solution, and the amount of zinc allow ΔH to be calculated."),
     [("Measure the mass of the zinc before and after it reacts and record the color of the solution.", "A mass change and a color do not give a temperature change."), ("Heat the CuSO₄ solution to boiling and then add the zinc to it.", "The initial temperature must be known and measured before the reaction, not at the boiling point."), ("Add the zinc to the solution and measure the pH of the mixture.", "The pH does not give the energy transferred.")]),
    ("A student wants to determine the enthalpy change of neutralization when HCl reacts with NaOH. Which set of steps is best?",
     ("Mix known volumes of the two solutions of known concentration in an insulated cup and record the initial and the maximum temperatures.", "The temperature change, the total mass, and the moles that reacted allow ΔH to be calculated."),
     [("Mix an unmeasured amount of each solution and record the final temperature only.", "Without the amounts and the initial temperature, ΔH cannot be calculated."), ("Mix the solutions in an open beaker and record only the volume of the mixture.", "The volume alone does not give the heat released."), ("Add indicator to each solution and record the color before and after mixing.", "A color change does not measure the heat released.")])],
    "choose a calorimetry procedure that supplies the needed quantities")

ch_t5_p2_heat_phase_procedure = _b("ch_t5_p2_heat_phase_procedure", "6.5", "2.C", [
    ("A student wants to determine the heat needed to melt one gram of ice. Which procedure is best?",
     ("Add a weighed mass of ice at 0 °C to a known mass of warm water in an insulated cup and record the initial and final temperatures of the water.", "The energy lost by the water equals the energy to melt the ice and to warm the melt water."),
     [("Add an unweighed ice cube to a cup of water and record the final temperature only.", "Without the masses and the initial temperature, the heat cannot be calculated."), ("Heat a weighed mass of ice on a hot plate and record how long it takes to melt.", "A time measurement does not give the energy absorbed without the power of the plate."), ("Add the ice to cold water and record the volume of the mixture.", "The volume does not give the heat absorbed.")]),
    ("A student wants to find the heat of vaporization of a liquid using an electric heater of known power. Which measurements are needed?",
     ("The power of the heater, the time of heating, and the mass of liquid that evaporates.", "The energy supplied is power times time, and dividing by the mass that vaporized gives the energy per gram."),
     [("The power of the heater and the color of the liquid.", "The color does not give the mass vaporized."), ("The time of heating and the initial volume of the container only.", "The mass vaporized and the power are needed."), ("The mass of the liquid before heating and the room temperature only.", "The energy supplied and the mass vaporized are needed.")])],
    "choose measurements that give the energy of a phase change")

ch_t5_p2_yield_procedure = _b("ch_t5_p2_yield_procedure", "4.5", "2.C", [
    ("A student wants to determine the percent yield of copper(II) hydroxide produced when excess NaOH solution is added to a measured amount of CuSO₄. Which procedure is best?",
     ("Weigh the CuSO₄, add excess NaOH, then filter, dry, and weigh the solid to compare with the theoretical mass.", "Percent yield compares the actual mass of product with the theoretical mass."),
     [("Weigh the NaOH solution and record only the color of the solid that forms in the mixture.", "The mass of the product and the theoretical mass are needed."), ("Add excess NaOH to the CuSO₄ and weigh the wet mixture before any drying of the solid.", "A wet mixture does not give the mass of the dry product."), ("Measure the volume of the CuSO₄ solution and the pH of the final solution, but not any masses.", "These do not give the mass of the product.")]),
    ("A student wants to find the limiting reactant when a measured mass of magnesium reacts with a measured volume of HCl solution of known concentration. Which procedure is best?",
     ("Convert both measured amounts to moles and compare them with the 1 : 2 mole ratio.", "The limiting reactant is determined by comparing the available moles with the stoichiometric ratio."),
     [("Compare the mass of Mg with the mass of the HCl solution, without converting either to moles.", "Masses must be converted to moles before a comparison using the mole ratio."), ("Record the color of the solution after the reaction, without any calculation from the amounts.", "A color does not identify the limiting reactant."), ("Heat the mixture and record the temperature of the mixture, without comparing any amounts.", "A temperature does not identify the limiting reactant.")])],
    "choose a procedure that supports a yield or limiting-reactant calculation")

ch_t5_p2_change_test = _b("ch_t5_p2_change_test", "4.4", "2.A", [
    ("A student heats a white solid and observes that it turns into a black solid and a gas is given off. Which question can the student test to decide whether a chemical change occurred?",
     ("Does the black solid have different properties from the original white solid, such as solubility and melting point?", "A chemical change forms a new substance with different properties."),
     [("Is the mass of the black solid exactly equal to the mass of the white solid?", "A mass can differ in either type of change when a gas leaves."), ("Is the black solid in the same container as the white solid was?", "The container does not tell what kind of change occurred."), ("Does the white solid look the same color under dim light?", "A color appearance under dim light does not test for a new substance.")]),
    ("A student cools liquid water to ice and then warms the ice back to liquid water. Which question can be answered to decide whether the changes were physical or chemical?",
     ("Is the substance after each change still water with the same chemical formula and properties?", "A physical change does not change the identity of the substance."),
     [("Did the temperature of the water change during the experiment?", "Temperature changes occur in both kinds of change."), ("Did the volume of the sample change during the experiment?", "Volume changes occur in both kinds of change."), ("Was the process carried out in an open container?", "The container does not determine the kind of change.")])],
    "choose a testable question that separates physical from chemical change")

ch_t5_p4_redox_model = _b("ch_t5_p4_redox_model", "4.9", "4.A", [
    ("In the reaction 2 Mg(s) + O₂(g) → 2 MgO(s), which species is oxidized and which is the oxidizing agent?",
     ("Mg is oxidized, and O₂ is the oxidizing agent because it gains electrons.", "Mg goes from 0 to +2 and loses electrons; O₂ goes from 0 to −2 and gains electrons."),
     [("O₂ is oxidized, and Mg is the oxidizing agent because it loses electrons.", "The species that loses electrons is oxidized and is the reducing agent."), ("Mg is oxidized, and Mg is the oxidizing agent because it loses electrons.", "The oxidizing agent is the species that is reduced, not the one that is oxidized."), ("Neither species is oxidized, because the product is neutral overall.", "The oxidation numbers of the elements change, so electrons are transferred.")]),
    ("In the reaction Zn(s) + 2 H⁺(aq) → Zn²⁺(aq) + H₂(g), which species is the reducing agent?",
     ("Zn, because its oxidation number increases from 0 to +2 as it loses electrons.", "The reducing agent is the species that is oxidized."),
     [("H⁺, because its oxidation number decreases from +1 to 0.", "H⁺ is reduced, so it is the oxidizing agent."), ("H₂, because it is a product of the reaction.", "The reducing agent is a reactant, not a product."), ("Zn²⁺, because it carries a positive charge.", "Zn²⁺ is a product formed by oxidation of Zn.")])],
    "identify the species oxidized and the oxidizing or reducing agent from oxidation numbers")

ch_t5_p4_limiting_model = _b("ch_t5_p4_limiting_model", "4.5", "4.B", [
    ("A particulate diagram of a mixture of N₂ and H₂ shows 4 N₂ molecules and 6 H₂ molecules before the reaction N₂ + 3 H₂ → 2 NH₃. Which statement about the mixture is consistent with the balanced equation?",
     ("H₂ is the limiting reactant, because 6 H₂ molecules react with only 2 N₂ molecules and 2 N₂ molecules remain.", "Six H₂ need 2 N₂ in a 3 : 1 ratio, so H₂ runs out first."),
     [("N₂ is the limiting reactant, because there are fewer N₂ molecules than H₂ molecules.", "A comparison of the numbers alone ignores the 1 : 3 mole ratio."), ("Both are limiting, because the numbers of molecules are different.", "Only one reactant is limiting in a given mixture."), ("There is no limiting reactant, because the diagram contains both reactants.", "The reactants are in the wrong ratio, so one limits the reaction.")]),
    ("A mixture contains 3 molecules of O₂ and 4 molecules of CH₄ before the combustion CH₄ + 2 O₂ → CO₂ + 2 H₂O. Which statement is consistent with the balanced equation?",
     ("O₂ is the limiting reactant, because the 3 O₂ molecules react with only 1.5 CH₄ molecules.", "Each CH₄ needs 2 O₂, so 3 O₂ can react with only 1.5 CH₄."),
     [("CH₄ is the limiting reactant, because there are more CH₄ molecules than O₂ molecules.", "A reactant that is present in a greater number is not limiting when the ratio is higher than required."), ("Neither reactant is left over, because 3 + 4 equals 7.", "The sum of the molecule counts does not show how they react."), ("CH₄ is the limiting reactant, because it appears first in the equation.", "The order in the equation does not determine the limiting reactant.")])],
    "decide a limiting reactant from a particle count and the mole ratio")

ch_t5_p6_endothermic_claim = _b("ch_t5_p6_endothermic_claim", "6.1", "6.A", [
    ("When solid ammonium chloride is dissolved in water in an insulated cup, the temperature of the water falls from 24.0 °C to 20.5 °C. Which claim is best supported by this observation?",
     ("The dissolving of ammonium chloride is endothermic, because the water lost energy to the process.", "A fall in the temperature of the surroundings shows that energy flowed into the process."),
     [("The dissolving is exothermic, because the water lost energy.", "Energy lost by the surroundings is gained by the process, which is endothermic."), ("The dissolving is neither endothermic nor exothermic, because the temperature changed only slightly.", "Any temperature change shows an energy transfer."), ("The dissolving breaks covalent bonds in water, so energy is absorbed.", "The temperature change comes from the dissolving process in general, not from breaking bonds in water.")]),
    ("When two clear solutions are mixed in an insulated cup, the temperature of the mixture rises from 21.0 °C to 27.0 °C. Which claim is best supported by this observation?",
     ("The reaction is exothermic, because the energy released raised the temperature of the mixture.", "A rise in the temperature of the surroundings shows that energy was released."),
     [("The reaction is endothermic, because the temperature of the mixture increased.", "An increase in the temperature of the surroundings shows energy released, not absorbed."), ("The reaction produces energy, because the final temperature is higher.", "Energy is transferred, not produced."), ("The reaction has ΔH > 0, because the energy change is positive for the surroundings.", "A gain of energy by the surroundings means ΔH < 0 for the reaction.")])],
    "support an endothermic or exothermic claim with a temperature observation")

ch_t5_p6_formation_claim = _b("ch_t5_p6_formation_claim", "6.8", "6.D", [
    ("A student claims that the enthalpy change for a reaction can be calculated from the standard enthalpies of formation of the products and the reactants. Which statement best justifies the claim?",
     ("The reaction can be written as the decomposition of the reactants into elements followed by the formation of the products, and enthalpy is a state function.", "The path through the elements gives the same overall ΔH, so ΔH = Σ ΔH_f(products) − Σ ΔH_f(reactants)."),
     [("The enthalpy of formation of any element in its standard state is large, so it must be included.", "The enthalpy of formation of an element in its standard state is zero."), ("The enthalpy of formation is the energy needed to break all of the bonds in a compound.", "The enthalpy of formation is the enthalpy change to form a compound from its elements."), ("Products always have a higher enthalpy of formation than reactants.", "The sign and size of the difference depend on the specific reaction.")]),
    ("A student claims that ΔH° for the reaction C(graphite) → C(diamond) is equal to the standard enthalpy of formation of diamond. Which statement best justifies the claim?",
     ("Graphite is the reference form of carbon, so its enthalpy of formation is zero and ΔH° equals the enthalpy of formation of diamond.", "ΔH° = ΔH_f(diamond) − ΔH_f(graphite) = ΔH_f(diamond) − 0."),
     [("Diamond is an element, so its enthalpy of formation must be zero.", "Only the standard-state form of the element has a zero enthalpy of formation, which is graphite for carbon."), ("Graphite is more energetic than diamond, so it has the larger enthalpy of formation.", "Graphite is the reference form and has an enthalpy of formation of zero."), ("The two forms of carbon have the same enthalpy, so ΔH° is zero.", "The two forms differ in enthalpy, so ΔH° is not zero.")])],
    "justify an enthalpy calculation with enthalpies of formation")
