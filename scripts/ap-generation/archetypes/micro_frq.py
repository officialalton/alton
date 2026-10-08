"""Micro 짧은 FRQ(5점) 신규 원형 2종(설계도 포함). 모형 → 변화 시나리오 → 결과·그래프 검증."""
from common import *
from calc_ab_frq import row, part
from bp import frq_blueprint
import micro_checks as mc
from fractions import Fraction as Fr

SUB = "ap_microeconomics"

def frq_micro_monopoly(rng):
    A = rng.choice([60, 80, 100, 120]); B = rng.choice([1, 2]); m = rng.choice([10, 20, 30]); dm = rng.choice([10, 20])
    Q = sp.symbols("Q"); prof = (A - B * Q) * Q - m * Q                       # 생성 경로: 이윤 극대화(미분)
    q_star = float(sp.solve(sp.diff(prof, Q), Q)[0]); p_star = A - B * q_star; profit = (p_star - m) * q_star
    ref = mc.monopoly({"A": A, "B": B, "m": m})                                 # 독립 경로: MR=MC 분수 계산 모듈
    if abs(float(Fr(ref["Q"])) - q_star) > 1e-9 or abs(float(Fr(ref["P"])) - p_star) > 1e-9 or abs(float(Fr(ref["profit"])) - profit) > 1e-9: raise ValueError("independent_check_failed")
    q_comp = (A - m) / B; dwl = 0.5 * (q_comp - q_star) * (p_star - m); q2 = (A - (m + dm)) / (2 * B)
    if q_star != int(q_star) or p_star != int(p_star) or q2 != int(q2) or q2 <= 0: raise ValueError("non_integer")
    rows = [[str(q), str(A - B * q)] for q in range(0, int(A / B) + 1, int(A / B / 5)) if A - B * q >= 0][:6]
    stim = {"kind": "table", "description": f"Demand schedule faced by a single seller (a monopolist) with constant marginal cost and average total cost equal to ${m} per unit.", "data": {"columns": ["Quantity (Q)", "Price (P, dollars)"], "rows": rows, "notes": [f"Marginal cost = average total cost = ${m} per unit.", f"The demand schedule follows P = {A} - {B}Q."]}}
    parts = [
        part("A", f"The firm maximizes profit. Calculate the profit-maximizing quantity. Show your work.", 1, "calculate", ["3.A"], f"MR = {A} - {2*B}Q = MC = {m}, so Q = {int(q_star)}.", [row("A1", 1, "Sets MR = MC (MR = %d - %dQ) and finds Q = %d (answer)" % (A, 2 * B, q_star), [str(int(q_star))], nums=True)]),
        part("B", "Calculate the price the firm charges.", 1, "calculate", ["3.A"], f"P = {A} - {B}({int(q_star)}) = ${int(p_star)}.", [row("B1", 1, "Reads price from the demand curve at the profit-maximizing quantity (answer)", [str(int(p_star))], nums=True)]),
        part("C", "Calculate the firm's economic profit.", 1, "calculate", ["3.A"], f"Profit = ({int(p_star)} - {m}) x {int(q_star)} = ${int(profit)}.", [row("C1", 1, "Profit = (P - ATC) x Q (answer)", [str(int(profit))], nums=True)]),
        part("D", "Calculate the deadweight loss caused by the monopoly relative to the efficient quantity (where P = MC).", 1, "calculate", ["3.C"], f"Efficient Q = {int(q_comp)}; DWL = 1/2 x ({int(q_comp)} - {int(q_star)}) x ({int(p_star)} - {m}) = ${dwl:g}.", [row("D1", 1, "Computes the triangle with base Q_efficient - Q_monopoly and height P - MC (answer)", [f"{dwl:g}"], nums=True)]),
        part("E", f"Suppose marginal cost rises by ${dm} per unit (and demand is unchanged). Does the profit-maximizing quantity increase, decrease, or stay the same? Explain.", 1, "explain", ["3.B"], f"Quantity decreases: MR = MC now occurs at Q = {int(q2)} < {int(q_star)} because higher marginal cost intersects the same MR curve at a smaller quantity.", [row("E1", 1, "States quantity decreases and links the higher MC to the MR = MC intersection at a smaller quantity", ["decreases", "MR = MC"], both=True)]),
    ]
    for pt in parts: pt["topic_codes"] = ["4.2"]
    pk = {"archetype": "frq_micro_monopoly", "template": "short_market_numeric", "topic": "4.2", "extra_topics": [], "skill": "3.A", "representative_skill": "3.A", "calculator": "allowed", "title": "Monopoly pricing and deadweight loss", "stimulus": stim,
          "parts": parts, "total_points": 5, "est_minutes": 12, "facts": [f"A={A},B={B},m={m}", f"Q*={q_star}", f"P*={p_star}", f"profit={profit}", f"dwl={dwl}", f"Q2={q2}"], "context": "monopoly"}
    pk["blueprint"] = frq_blueprint("frq_micro_monopoly", SUB, pk, "Profit-maximizing monopoly with constant marginal cost, deadweight loss, and a cost shock",
        ["Identify MR for a linear demand curve (twice the slope)", "Set MR = MC to find quantity, read price from demand", "Compute profit and deadweight loss, then reason about a rise in MC"],
        [("Constant MC = ATC and linear demand, so MR = A - 2BQ", "stated in the stimulus table notes")], {"type": "model", "must_include": ["demand schedule", "MC = ATC"]},
        "profit maximization by symbolic differentiation cross-checked by a separate exact-fraction MR=MC module (micro_checks.monopoly)",
        extra={"model": {"initial_state": f"single seller facing demand P = {A} - {B}Q with constant MC = ATC = {m}", "changed_conditions": [f"marginal cost increases by {dm}"], "held_constant": ["demand", "ATC = MC relationship (no fixed cost)"], "checks": ["MR=MC quantity", "price from demand", "profit", "deadweight loss triangle", "direction of quantity change"], "key_assumptions_id": "monopoly-linear-const-mc", "explanation_assumptions_id": "monopoly-linear-const-mc"}})
    return pk

def frq_micro_game(rng):
    names = rng.choice([("Firm A", "Firm B", "advertise", "not advertise"), ("Airline X", "Airline Y", "high fare", "low fare"), ("Firm A", "Firm B", "high output", "low output")])
    ra, ca, s1, s2 = names[0], names[1], names[2], names[3]
    # 죄수의 딜레마형: 두 기업 모두 s2 가 우월전략이며 유일한 내쉬균형(s2,s2)은 (s1,s1)보다 둘 다에게 나쁘다
    hh = rnd(rng, 60, 80); ll = hh - rnd(rng, 15, 25); sucker = max(5, ll - rnd(rng, 10, 20)); temp = hh + rnd(rng, 15, 30)   # temp > hh > ll > sucker (죄수의 딜레마형)
    M = [[[hh, hh], [sucker, temp]], [[temp, sucker], [ll, ll]]]            # rows: (s1,s2), cols: (s1,s2); payoff[row][col]=[row player, col player]
    nash = mc.nash({"payoffs": M})                                           # 독립 경로: 모듈 계산
    brute = [[r, c] for r in range(2) for c in range(2) if M[r][c][0] == max(M[0][c][0], M[1][c][0]) and M[r][c][1] == max(M[r][0][1], M[r][1][1])]   # 생성 경로: 직접 최선 반응
    if nash["nash"] != brute or len(brute) != 1 or nash["dominant_row"] != [0] and nash["dominant_row"] != [1]: raise ValueError("no_unique_dominant")
    r0, c0 = brute[0]; dom = ra + " (" + [s1, s2][r0] + ")"
    coop = M[1 - r0][1 - c0]
    labels = [s1, s2]
    stim = {"kind": "payoff_matrix", "description": f"Payoff matrix for two firms, {ra} (rows) and {ca} (columns), each choosing to {s1} or {s2}. Payoffs are profits in millions of dollars, listed as ({ra}, {ca}).", "data": {"row_player": ra, "col_player": ca, "row_strategies": labels, "col_strategies": labels, "payoff_units": "millions of dollars of profit",
            "payoffs": {f"{labels[r]},{labels[c]}": M[r][c] for r in range(2) for c in range(2)}, "format": f"({ra} payoff, {ca} payoff)"}}
    eq = M[r0][c0]
    parts = [
        part("A", f"Does {ra} have a dominant strategy? If so, identify it.", 1, "explain", ["2.C"], f"Yes: {labels[r0]}, since it gives {ra} a higher payoff than {labels[1-r0]} regardless of {ca}'s choice.", [row("A1", 1, "Identifies the dominant strategy and notes it is better regardless of the other firm's choice", [labels[r0], "regardless"], both=True)]),
        part("B", "Identify the Nash equilibrium of the game.", 1, "explain", ["2.C"], f"Both firms choose {labels[r0]}/{labels[c0]}: ({ra}: {labels[r0]}, {ca}: {labels[c0]}).", [row("B1", 1, "States the equilibrium strategy pair", [labels[r0], labels[c0]], both=True)]),
        part("C", f"What is {ra}'s payoff in the Nash equilibrium?", 1, "calculate", ["2.C"], f"${eq[0]} million.", [row("C1", 1, "Reads the equilibrium payoff for the row firm (answer)", [str(eq[0])], nums=True)]),
        part("D", "Is there an outcome that gives both firms a higher payoff than the Nash equilibrium? If so, identify it and the payoffs.", 1, "explain", ["2.C"], f"Yes: ({labels[1-r0]}, {labels[1-c0]}) gives {ra} ${coop[0]} million and {ca} ${coop[1]} million." if coop[0] > eq[0] and coop[1] > eq[1] else "No outcome gives both firms a higher payoff.", [row("D1", 1, "Identifies whether a mutually better outcome exists and states its payoffs (answer)", [str(coop[0]), str(coop[1])] if coop[0] > eq[0] and coop[1] > eq[1] else ["no"], nums=True)]),
        part("E", "Explain why the firms might not reach that outcome without an enforceable agreement.", 1, "explain", ["2.B"], "Each firm has an incentive to deviate to its dominant strategy, so the cooperative outcome is not stable without enforcement.", [row("E1", 1, "Explains the incentive to deviate (dominant strategy) makes the cooperative outcome unstable", ["incentive", "deviate"], both=True)]),
    ]
    if not (coop[0] > eq[0] and coop[1] > eq[1]): raise ValueError("no_pareto_improvement")
    for pt in parts: pt["topic_codes"] = ["4.5"]
    pk = {"archetype": "frq_micro_game", "template": "short_game_theory", "topic": "4.5", "extra_topics": [], "skill": "2.C", "representative_skill": "2.C", "calculator": "allowed", "title": "Oligopoly game: dominant strategies and equilibrium", "stimulus": stim,
          "parts": parts, "total_points": 5, "est_minutes": 11, "facts": [f"payoffs={M}", f"nash={nash['nash']}", f"dominant_row={nash['dominant_row']}"], "context": "oligopoly"}
    pk["blueprint"] = frq_blueprint("frq_micro_game", SUB, pk, "Dominant strategy, Nash equilibrium, and a mutually better outcome in a two-firm game",
        ["Compare each firm's payoffs holding the rival's choice fixed to find a dominant strategy", "Find the strategy pair where neither firm benefits from deviating", "Compare equilibrium payoffs with the other outcomes and explain the incentive problem"],
        [("Simultaneous one-shot game with the payoffs shown and no enforceable agreement", "stated in the stimulus description")], {"type": "payoff_matrix", "must_include": ["row and column strategies", "payoffs for both players"]},
        "best-response enumeration cross-checked by a separate Nash/dominance module (micro_checks.nash)",
        extra={"model": {"initial_state": f"two firms simultaneously choose {s1} or {s2} with the payoff matrix shown", "changed_conditions": ["comparison of the equilibrium with the cooperative outcome"], "held_constant": ["payoff matrix", "one-shot simultaneous play"], "checks": ["dominant strategy", "Nash equilibrium by best responses", "equilibrium payoff", "Pareto comparison"], "key_assumptions_id": "oneshot-simultaneous", "explanation_assumptions_id": "oneshot-simultaneous"}})
    return pk
