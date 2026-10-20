"""AP Chemistry 원형 P — CH3 새 2문항 세트 2개(2026-10-19): 커피컵 열량계 표(단원 6) / ΔG° 대 T 표(단원 9). 공개 세트 3개와 풀이 틀이 다르다."""
from chem_common import *  # noqa: F401,F403
from chem_p0_f import _set


def _table(desc, cols, rows):
    return {"kind": "table", "description": desc, "data": {"x_label": cols[0], "columns": cols, "y_label": cols[-1], "rows": rows}}


def chs_calorimeter_dissolve_set(rng):
    """세트: 커피컵 열량계에서 염을 녹인다 → (용액이 얻은 열 q, 용해 엔탈피 ΔH 몰당)."""
    for _ in forever():
        salt, M = pick(rng, [("NH4NO3", 80.04), ("CaCl2", 110.98), ("KCl", 74.55), ("NaOH", 40.00), ("LiCl", 42.39)])
        ms = pick(rng, [5.00, 8.00, 10.0, 12.0]); mw = pick(rng, [100.0, 150.0, 200.0]); Ti = pick(rng, [20.0, 22.0, 24.0, 25.0])
        dHm = {"NH4NO3": 25.7, "CaCl2": -82.8, "KCl": 17.2, "NaOH": -44.5, "LiCl": -37.0}[salt]
        n = ms / M; q_rxn = dHm * 1000 * n; msol = ms + mw
        Tf = round(Ti - q_rxn / (msol * 4.18), 1)
        dT = Tf - Ti
        if abs(dT) >= 2.0:
            break
    q_sol = msol * 4.18 * dT
    agree(q_sol, float(sp.nsimplify(msol) * sp.nsimplify(4.18) * sp.nsimplify(round(dT, 1))), 1e-6, "q")
    dH = -q_sol / n / 1000
    agree(dH, bisect(lambda x: x * n * 1000 + q_sol, -1e4, 1e4), 1e-6, "dH")
    rows = [["Mass of " + salt + " (g)", f"{ms:g}"], ["Mass of water (g)", f"{mw:g}"], ["Initial temperature (°C)", f"{Ti:g}"], ["Final temperature (°C)", f"{Tf:g}"], ["Molar mass of " + salt + " (g/mol)", f"{M:g}"]]
    stim = _table("Coffee-cup calorimeter data for dissolving a salt in water", ["Quantity", "Value"], rows)
    k1, d1 = signed_opts(q_sol, [("Uses the sign of the heat released by the reaction instead of the heat gained by the solution.", -q_sol), ("Uses only the mass of water and leaves out the mass of the salt.", mw * 4.18 * dT),
                                 ("Uses the final temperature in place of the temperature change.", msol * 4.18 * Tf), ("Uses the mass of the salt alone as the mass of the solution.", ms * 4.18 * dT)], "J")
    k2, d2 = signed_opts(dH, [("Gives the heat gained by the solution per mole without changing its sign.", q_sol / n / 1000), ("Forgets to convert joules to kilojoules.", -q_sol / n), ("Divides by the mass in grams instead of the moles of salt.", -q_sol / ms / 1000), ("Reports the heat of the solution in kilojoules rather than per mole of salt.", -q_sol / 1000)], "kJ/mol")
    qs = []
    for stm, key, ds, nm in [("What is the heat gained by the solution, in J? (A negative value means the solution lost heat.)", k1, d1, "q1"), (f"What is the enthalpy change for dissolving one mole of {salt}, in kJ/mol?", k2, d2, "q2")]:
        qs.append(mk(f"chs_calorimeter_dissolve_set_{nm}", "6.4", "5.F", stm, key, ds, rng, concept="heat gained by a calorimeter solution and the molar enthalpy of dissolution", cond=[("the solution has a specific heat of 4.18 J/(g °C)", "intro")], path="exact decimal product vs root solve of the heat balance", material={"type": "table", "must_include": ["masses", "temperatures"]}, facts=[f"salt={salt}", f"ms={ms}", f"mw={mw}", f"Ti={Ti}", f"Tf={Tf}"], judgment="relate the sign of the heat of the solution to the enthalpy change of the process", est=105,
                       kwhy=(f"q = m c ΔT = ({msol:g} g)(4.18 J/(g °C))({dT:+.1f} °C) = {sig(q_sol)} J." if nm == "q1" else f"n = {ms:g}/{M:g} = {n:.4f} mol; the process gained {sig(-q_sol)} J from the surroundings, so ΔH = −q/n = {sig(dH)} kJ/mol.")))
    return _set("chs_calorimeter_dissolve_set", f"A student dissolves a sample of {salt} in water in a coffee-cup calorimeter. Assume that the specific heat of the solution is $4.18\\text{{ J/(g}}\\cdot^{{\\circ}}\\text{{C)}}$, that the mass of the solution is the sum of the masses of the salt and the water, and that no heat is lost to the calorimeter. The data are shown.", stim, qs, "6.4", "5.F")


def chs_gibbs_temperature_set(rng):
    """세트: 세 온도에서의 ΔG° 표 → (ΔS°, ΔH°)."""
    for _ in forever():
        dH = pick(rng, [-120.0, -90.0, 60.0, 110.0, 180.0]); dS = pick(rng, [-250.0, -160.0, 120.0, 210.0, 300.0])
        if dH * dS > 0 and abs(dS) > 100:
            break
    Ts = [300.0, 400.0, 500.0]; Gs = [dH - T * dS / 1000 for T in Ts]
    X = np.vstack([np.ones(3), np.array(Ts)]).T
    co = np.linalg.lstsq(X, np.array(Gs), rcond=None)[0]
    agree(co[1] * -1000, dS, 1e-6, "dS"); agree(co[0], dH, 1e-6, "dH")
    rows = [[f"{T:g}", f"{g:.1f}"] for T, g in zip(Ts, Gs)]
    stim = _table("Standard free energy change of a reaction at three temperatures", ["Temperature (K)", "ΔG° (kJ/mol)"], rows)
    slope = (Gs[2] - Gs[0]) / (Ts[2] - Ts[0])
    k1, d1 = signed_opts(dS, [("Reports the slope in kJ/(mol K), which is the negative of ΔS°, as ΔS°.", slope), ("Reports ΔS° with the right magnitude but the wrong sign.", -dS), ("Forgets to convert kJ to J.", -slope), ("Divides a single value of ΔG° by its temperature.", Gs[0] / Ts[0] * 1000)], "J/(mol K)")
    k2, d2 = signed_opts(dH, [("Takes the ΔG° at 300 K as ΔH°.", Gs[0]), ("Takes the ΔG° at 500 K as ΔH°.", Gs[2]), ("Averages the three values of ΔG°.", sum(Gs) / 3), ("Subtracts the TΔS° term from ΔG° instead of adding it.", Gs[0] - Ts[0] * dS / 1000)], "kJ/mol")
    qs = []
    for stm, key, ds, nm in [("What is the standard entropy change, ΔS°, of the reaction, in J/(mol K)? Assume that ΔH° and ΔS° do not change with temperature.", k1, d1, "q1"), ("What is the standard enthalpy change, ΔH°, of the reaction, in kJ/mol? Assume that ΔH° and ΔS° do not change with temperature.", k2, d2, "q2")]:
        qs.append(mk(f"chs_gibbs_temperature_set_{nm}", "9.3", "5.F", stm, key, ds, rng, concept="ΔS° and ΔH° from a linear ΔG° versus T table", cond=[("ΔH° and ΔS° are independent of temperature", "the stem states the assumption")], path="least squares of ΔG° against T vs the two-point slope", material={"type": "table", "must_include": ["temperatures", "free energies"]}, facts=[f"dH={dH}", f"dS={dS}"], judgment="read the slope and intercept of ΔG° = ΔH° − TΔS°", est=105,
                       kwhy=(f"ΔG° = ΔH° − TΔS°, so the slope of ΔG° against T is −ΔS°: ({Gs[2]:.1f} − {Gs[0]:.1f}) kJ / 200 K = {slope:.4f} kJ/(mol K), so ΔS° = {dS:.0f} J/(mol K)." if nm == "q1" else f"At 300 K, ΔH° = ΔG° + TΔS° = {Gs[0]:.1f} + (300)({dS / 1000:.3f}) = {dH:.0f} kJ/mol.")))
    return _set("chs_gibbs_temperature_set", "The table gives the standard free energy change, ΔG°, of one reaction at three temperatures. Assume that ΔH° and ΔS° of the reaction do not change with temperature.", stim, qs, "9.3", "5.F")


STAGE_P_SETS = ["chs_calorimeter_dissolve_set", "chs_gibbs_temperature_set", "ch_q_particulate_bonding", "ch_q_particulate_acid", "ch_q_particulate_ionic_solid", "ch_q_particulate_buffer", "ch_q_imf_property", "ch_q_rate_relationship", "ch_q_half_life_concept"]


STAGE_CH3_MC = ["ch_combined_gas", "ch_dilution", "ch_gas_molar_mass", "ch_gas_particle_claim", "ch_gibbs_k", "ch_halflife_order_claim", "ch_hydrate_error", "ch_lewis_lone_pairs", "ch_n_arrhenius_ratio", "ch_n_buffer_after_acid", "ch_n_calorimetry_direction", "ch_n_catalyst_profile", "ch_n_empirical_formula", "ch_n_entropy_rank", "ch_n_entropy_reaction", "ch_n_galvanic_flow", "ch_n_gas_density", "ch_n_gas_stoich_volume", "ch_n_gibbs_hs", "ch_n_halfway_titration_ph", "ch_n_heat_phase_change", "ch_n_isotope_abundance", "ch_n_k_from_equilibrium", "ch_n_ksp_from_solubility", "ch_n_limiting_mass", "ch_n_molarity_mass", "ch_n_mole_fraction_pressure", "ch_n_oxidation_number", "ch_n_particulate_solution", "ch_n_percent_yield", "ch_n_ph_strong_base", "ch_n_polarity_molecule", "ch_n_rate_law_concept", "ch_n_second_order_time", "ch_needed_ka", "ch_o_acid_base_type", "ch_o_bond_enthalpy_concept", "ch_o_bond_order_length", "ch_o_buffer_concept", "ch_o_cell_justify", "ch_o_collision_model", "ch_o_conductivity_claim", "ch_o_conj_pair", "ch_o_curve_features", "ch_o_energy_diagram", "ch_o_gas_question", "ch_o_hess_logic", "ch_o_hydrate_procedure", "ch_o_ice_concentration", "ch_o_imf_justify", "ch_o_isotope_question", "ch_o_ka_strength", "ch_o_lewis_choice", "ch_o_mechanism_step", "ch_o_mixture_error", "ch_o_net_ionic", "ch_o_periodic_predict", "ch_o_precip_claim", "ch_o_redox_agent", "ch_o_separation_procedure", "ch_o_spontaneity_justify", "ch_o_vsepr_shape", "ch_percent_yield", "ch_radius_trend", "ch_solid_type_claim", "ch_strong_ph", "ch_titration_point", "ch_vapor_pressure_justify"]
STAGE_CH3_SETS = ["chs_calorimeter_dissolve_set", "chs_gibbs_temperature_set", "ch_q_particulate_bonding", "ch_q_particulate_acid", "ch_q_particulate_ionic_solid", "ch_q_particulate_buffer", "ch_q_imf_property", "ch_q_rate_relationship", "ch_q_half_life_concept"]
STAGE_CH3_FRQ = ["chf_long_buffer", "chf_long_ksp", "chf_long_calorimetry", "chf_short_massspec", "chf_short_gas_mix", "chf_short_solution", "chf_short_neutral"]
STAGE_CH3_ALL = STAGE_CH3_MC + STAGE_CH3_SETS

STAGE_CH3R2_ALL = ["ch_n_second_order_time", "ch_o_vsepr_shape", "ch_o_bond_order_length", "ch_o_buffer_concept", "ch_o_acid_base_type", "ch_o_collision_model", "ch_o_hess_logic", "ch_o_ka_strength", "ch_o_mechanism_step", "ch_o_precip_claim", "ch_o_redox_agent", "ch_o_spontaneity_justify", "chs_gibbs_temperature_set", "ch_q_particulate_bonding", "ch_q_particulate_acid", "ch_q_particulate_ionic_solid", "ch_q_particulate_buffer", "ch_q_imf_property", "ch_q_rate_relationship", "ch_q_half_life_concept"]

STAGE_CH3F2_FRQ = ["chf_long_ksp", "chf_short_gas_mix"]
