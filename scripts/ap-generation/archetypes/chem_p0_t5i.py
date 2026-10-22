"""AP Chemistry 원형 — CH5 단독 4칸 대체(2026-10-21): 공개 문항과 구조가 겹쳐 쓸 수 없던 가상 칸을 채우는 새 문항 4개(단원 1 절차 P2, 단원 3 개념 P4 둘, 단원 8 계산 P5).
개념 문항은 고정 문장 은행(chem_p0_n._bank), 계산 문항은 이중 경로(sympy vs 수치)이며 오답은 이름 붙은 오개념이다."""
from chem_p0_n import _bank
from chem_common import *  # noqa: F401,F403


def _b(arch, topic, skill, bank, concept, path="fixed fact bank checked against CED"):
    f = _bank(arch, topic, skill, bank, concept, path)
    f.__module__ = "chem_p0_t5i"
    return f


ch_t5i_p2_oxide_formula_procedure = _b("ch_t5i_p2_oxide_formula_procedure", "1.3", "2.C", [
    ("A student wants to find the empirical formula of a copper oxide made by heating copper metal in air. Which pair of measurements is sufficient to determine the formula?",
     ("The mass of the copper before heating and the mass of the oxide after heating to a constant mass.", "The difference of the two masses is the mass of oxygen combined, so the mole ratio of Cu to O can be calculated."),
     [("The mass of the copper before heating and the volume of air in the room.", "The volume of room air does not give the mass of oxygen that combined with the copper."), ("The color of the product and the temperature of the flame.", "Color and flame temperature do not give the amounts of Cu and O."), ("The mass of the product only.", "The mass of the product alone does not separate the mass of copper from the mass of oxygen.")]),
    ("A student heats a hydrated salt in a crucible to find the formula of the hydrate. Which step best ensures that all of the water has been removed before the final mass is recorded?",
     ("Reheat the crucible and weigh it again, repeating until two successive masses agree.", "Masses that no longer change show that no more water is leaving the sample."),
     [("Heat the sample for exactly one minute and weigh it once.", "A fixed time does not show that the sample is dry."), ("Add a few drops of water and weigh the sample while it is still wet.", "Extra water adds mass and defeats the purpose of drying."), ("Weigh the crucible while it is still very hot to save time.", "A hot crucible produces air currents that make the mass reading inaccurate.")])],
    "choose the measurements and the repeat-to-constant-mass step that determine an empirical or hydrate formula")

ch_t5i_p4_evaporation_forces = _b("ch_t5i_p4_evaporation_forces", "3.1", "4.C", [
    ("At 25 °C, acetone, CH₃COCH₃, evaporates much faster than water from open dishes. Which statement best explains the difference?",
     ("Acetone molecules cannot form hydrogen bonds with each other, so its intermolecular attractions are weaker than those in water.", "Weaker attractions let more molecules escape the liquid at a given temperature."),
     [("Acetone molecules are heavier, so they move faster on average at 25 °C than water molecules.", "At the same temperature heavier molecules have the same average kinetic energy and move more slowly."), ("Acetone has stronger covalent bonds than water, so its molecules separate easily.", "Evaporation depends on the attractions between molecules, not on the strength of covalent bonds."), ("Water molecules are nonpolar, so they stay in the liquid state.", "Water molecules are polar and form hydrogen bonds.")]),
    ("Two liquids, X and Y, are at the same temperature. Liquid X has a much higher surface tension than liquid Y. Which statement about the intermolecular forces is most reasonable?",
     ("The forces between molecules of X are stronger than those between molecules of Y.", "Surface tension is higher when molecules at the surface are pulled inward more strongly by their neighbors."),
     [("The forces between molecules of X are weaker than between molecules of Y.", "Weaker forces give a lower, not a higher, surface tension."), ("The molecules of X have a higher average kinetic energy than those of Y.", "The liquids are at the same temperature, so their average kinetic energies are equal."), ("The covalent bonds inside the molecules of X are broken at the surface.", "Surface tension does not involve breaking bonds within molecules.")])],
    "relate evaporation rate and surface tension to the strength of intermolecular forces")

ch_t5i_p4_heating_curve = _b("ch_t5i_p4_heating_curve", "3.3", "4.C", [
    ("A pure solid is heated at a constant rate. During the time the temperature stays constant at the melting point, which statement is correct?",
     ("The average kinetic energy stays the same, and the added energy raises the potential energy as attractions are overcome.", "At constant temperature the average kinetic energy is constant, so the energy goes into separating particles."),
     [("The average kinetic energy of the particles increases because energy is being added.", "The temperature, which tracks the average kinetic energy, is not changing."), ("The added energy breaks the covalent bonds inside each particle of the solid.", "Melting overcomes attractions between particles rather than the bonds within them."), ("No energy is being absorbed because the temperature is constant.", "Energy is still absorbed, but it changes the potential energy, not the temperature.")]),
    ("Water vapor at 110 °C is cooled at a constant rate to 80 °C. The temperature stays at 100 °C for a time. What is happening to the water molecules during that time?",
     ("The molecules are condensing: attractions form, energy is released, and the average kinetic energy is unchanged.", "During a phase change at constant temperature, the potential energy changes while the average kinetic energy is constant."),
     [("The molecules are slowing down on average because the sample is losing energy.", "The temperature is constant, so the average kinetic energy is constant."), ("The molecules are breaking into hydrogen and oxygen atoms.", "Condensation is a physical change and does not break bonds within molecules."), ("The molecules stop moving entirely until the sample is cooler.", "Molecules in a liquid keep moving at 100 °C.")])],
    "interpret the flat segment of a heating or cooling curve in terms of kinetic and potential energy")


@retry_sep
def ch_t5i_ka_from_ph(rng):
    c, ph = pick(rng, [0.100, 0.200, 0.0500, 0.150]), pick(rng, [2.85, 3.10, 3.40, 2.60])
    x = 10 ** (-ph); Ka = x * x / (c - x)
    if not (0.002 < x / c < 0.1):
        raise ValueError("ambiguous")
    agree(Ka, float(sp.Rational(str(10.0 ** (-2 * ph))) / (sp.Rational(str(c)) - sp.Rational(str(10.0 ** (-ph))))), 1e-3, "Ka")
    pairs = [("Uses [H⁺] squared divided by the initial concentration, ignoring the amount that ionized.", x * x / c), ("Uses [H⁺] divided by the initial concentration as Ka.", x / c), ("Uses the pH value instead of [H⁺] in the expression.", ph * ph / (c - ph) if ph < c else ph * ph / c), ("Divides the initial concentration by [H⁺] squared.", c / (x * x))]
    pairs = [(t, v) for t, v in pairs if abs(v - Ka) / Ka > 0.08][:3]
    if len(pairs) < 3:
        raise ValueError("ambiguous")
    key, ds = num_opts(Ka, pairs + [("Uses [H⁺] times the initial concentration.", x * c)] if len(pairs) == 3 and abs(x * c - Ka) / Ka > 0.08 else pairs, "")
    stem = f"The pH of a ${c:g}\\text{{ M}}$ solution of a weak monoprotic acid, HA, is {ph:g} at 25 °C. What is the value of K_a for HA?"
    return mk("ch_t5i_ka_from_ph", "8.3", "5.F", stem, key, ds, rng, concept="Ka from the pH of a weak acid solution", path="sympy exact ratio vs direct formula", facts=[f"c={c}", f"pH={ph}"],
              kwhy=f"[H⁺] = 10^(−{ph:g}) = {sn(x, 3)} M, so Ka = [H⁺]²/(c − [H⁺]) = {sn(Ka, 3)}.", judgment="find [H⁺] from the pH and use the equilibrium concentrations in Ka", est=100)
