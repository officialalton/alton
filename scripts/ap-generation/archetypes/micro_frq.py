"""Micro 짧은 FRQ(5점) 신규 원형 2종(설계도 포함). 모형 → 변화 시나리오 → 결과·그래프 검증."""
from common import *
from calc_ab_frq import row, part
from bp import frq_blueprint, meaning
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
        part("A", f"The firm maximizes profit. Calculate the profit-maximizing quantity and the price the firm charges. Show your work.", 2, "calculate", ["3.A"], f"MR = {A} - {2*B}Q = MC = {m}, so Q = {int(q_star)}; P = {A} - {B}({int(q_star)}) = ${int(p_star)}.", [
            row("A1", 1, "Sets marginal revenue equal to marginal cost (MR = %d - %dQ) and solves for the quantity (answer %d)" % (A, 2 * B, q_star), [str(int(q_star))], nums=True, alt=["MR = MC", "marginal revenue equals marginal cost"], err=["sets P = MC and gets the competitive quantity %d" % int(q_comp)]),
            row("A2", 1, "Reads the price from the demand curve at the profit-maximizing quantity (answer $%d)" % p_star, [str(int(p_star))], nums=True, requires="A1", err=["uses MR instead of P at that quantity"])]),
        part("B", "Calculate the firm's economic profit.", 1, "calculate", ["3.A"], f"Profit = ({int(p_star)} - {m}) x {int(q_star)} = ${int(profit)}.", [row("B1", 1, "Profit = (P - ATC) x Q (answer)", [str(int(profit))], nums=True, alt=["total revenue minus total cost"], err=["uses MC instead of ATC for the margin", "forgets to multiply by quantity"])]),
        part("C", "Calculate the deadweight loss caused by the monopoly relative to the efficient quantity (where P = MC).", 1, "calculate", ["3.C"], f"Efficient Q = {int(q_comp)}; DWL = 1/2 x ({int(q_comp)} - {int(q_star)}) x ({int(p_star)} - {m}) = ${dwl:g}.", [row("C1", 1, "Computes the triangle with base Q_efficient - Q_monopoly and height P - MC (answer)", [f"{dwl:g}"], nums=True, err=["uses the full demand triangle", "uses MR for the height"])]),
        part("D", f"Suppose marginal cost rises by ${dm} per unit (and demand is unchanged). Does the profit-maximizing quantity increase, decrease, or stay the same? Explain.", 1, "explain", ["3.B"], f"Quantity decreases: MR = MC now occurs at Q = {int(q2)} < {int(q_star)} because higher marginal cost intersects the same MR curve at a smaller quantity.", [row("D1", 1, "States quantity decreases and links the higher MC to the MR = MC intersection at a smaller quantity", ["decreases", "MR = MC"], both=True, alt=["falls", "lower quantity", "marginal cost curve shifts up and meets marginal revenue at a lower quantity"], err=["says price decreases", "says quantity is unchanged because demand is unchanged"])]),
    ]
    for pt in parts: pt["topic_codes"] = ["4.2"]
    pk = {"archetype": "frq_micro_monopoly", "template": "short_market_numeric", "topic": "4.2", "extra_topics": [], "skill": "3.A", "representative_skill": "3.A", "calculator": "allowed", "title": "Monopoly pricing and deadweight loss", "stimulus": stim,
          "parts": parts, "total_points": 5, "est_minutes": 12, "facts": [f"A={A},B={B},m={m}", f"Q*={q_star}", f"P*={p_star}", f"profit={profit}", f"dwl={dwl}", f"Q2={q2}"], "context": "monopoly"}
    meaning(pk, {"A1": {"keep_nums": True, "elements": ["Sets marginal revenue equal to marginal cost to find the profit-maximizing quantity (the quantity answer is correct)"], "alt": ["MR = MC", "marginal revenue equals marginal cost", "where MR crosses MC"], "err": ["sets price equal to marginal cost and gets the competitive quantity", "uses the demand curve instead of marginal revenue"]},
               "A2": {"keep_nums": True, "elements": ["Reads the price from the demand curve at the profit-maximizing quantity (the price answer is correct)"], "alt": ["price on the demand curve above the quantity", "substitutes Q into the demand equation"], "err": ["reports marginal revenue as the price"]},
               "B1": {"keep_nums": True, "elements": ["Computes profit as (price minus average total cost) times quantity (the profit answer is correct)"], "keep_nums": True, "alt": ["total revenue minus total cost", "profit per unit times the quantity sold"], "err": ["uses marginal cost instead of average total cost", "forgets to multiply by quantity"]},
               "C1": {"keep_nums": True, "elements": ["Computes the deadweight-loss triangle with base equal to the efficient minus the monopoly quantity and height equal to price minus marginal cost"], "keep_nums": True, "alt": ["one half times base times height of the lost-surplus triangle", "the area of the lost-surplus triangle between demand and marginal cost"], "err": ["uses the whole demand triangle", "uses marginal revenue for the height"]},
               "D1": {"elements": ["States that the profit-maximizing quantity decreases", "Links the higher marginal cost to the MR = MC intersection occurring at a smaller quantity"], "alt": ["falls", "lower quantity", "the marginal cost curve shifts up and meets marginal revenue at a lower quantity"], "err": ["says price decreases", "says quantity is unchanged because demand is unchanged"]}})
    pk["blueprint"] = frq_blueprint("frq_micro_monopoly", SUB, pk, "Profit-maximizing monopoly with constant marginal cost, deadweight loss, and a cost shock",
        ["Identify MR for a linear demand curve (twice the slope)", "Set MR = MC to find quantity, read price from demand", "Compute profit and deadweight loss, then reason about a rise in MC"],
        [("Constant MC = ATC and linear demand, so MR = A - 2BQ", "stated in the stimulus table notes")], {"type": "model", "must_include": ["demand schedule", "MC = ATC"]},
        "profit maximization by symbolic differentiation cross-checked by a separate exact-fraction MR=MC module (micro_checks.monopoly)",
        extra={"model": {"initial_state": f"single seller facing demand P = {A} - {B}Q with constant MC = ATC = {m}", "changed_conditions": [f"marginal cost increases by {dm}"], "held_constant": ["demand", "ATC = MC relationship (no fixed cost)"], "checks": ["MR=MC quantity", "price from demand", "profit", "deadweight loss triangle", "direction of quantity change"], "key_assumptions_id": "monopoly-linear-const-mc", "explanation_assumptions_id": "monopoly-linear-const-mc"}})
    return pk

def frq_micro_game(rng):
    names = rng.choice([("Firm A", "Firm B", "not advertise", "advertise"), ("Airline X", "Airline Y", "high fare", "low fare"), ("Firm A", "Firm B", "low output", "high output")])   # (협력 전략, 이탈 전략)
    ra, ca, s1, s2 = names; labels = [s1, s2]
    structure = rng.choice(["both_dominant", "row_dominant_only"])   # 구조 2종: 교과서 죄수의 딜레마만 반복하지 않는다
    hh = rnd(rng, 60, 80); ll = hh - rnd(rng, 15, 25); sucker = max(5, ll - rnd(rng, 10, 20)); temp = hh + rnd(rng, 15, 30)
    if structure == "both_dominant":
        M = [[[hh, hh], [sucker, temp]], [[temp, sucker], [ll, ll]]]
    else:   # 행 기업만 우월전략(s2), 열 기업은 상대 선택에 따라 최선 반응이 달라진다(우월전략 없음); 균형은 (s2, c*)이고 둘 다에게 더 좋은 칸이 존재
        cs = rng.choice([0, 1]); e1, e2 = rnd(rng, 35, 50), rnd(rng, 35, 50); M = [[None, None], [None, None]]
        M[1][cs] = [e1, e2]; M[0][cs] = [e1 - rnd(rng, 5, 12), e2 - rnd(rng, 10, 20)]; M[0][1 - cs] = [e1 + rnd(rng, 5, 12), e2 + rnd(rng, 12, 25)]; M[1][1 - cs] = [M[0][1 - cs][0] + rnd(rng, 10, 20), e2 - rnd(rng, 5, 10)]
    nash = mc.nash({"payoffs": M})
    brute = [[r, c] for r in range(2) for c in range(2) if M[r][c][0] == max(M[0][c][0], M[1][c][0]) and M[r][c][1] == max(M[r][0][1], M[r][1][1])]
    if nash["nash"] != brute or len(brute) != 1 or len(nash["dominant_row"]) != 1: raise ValueError("no_unique_nash_with_row_dominant")
    if structure == "row_dominant_only" and nash["dominant_col"]: raise ValueError("col_also_dominant")
    r0, c0 = brute[0]; eq = M[r0][c0]
    stim = {"kind": "payoff_matrix", "description": f"Payoff matrix for two firms, {ra} (rows) and {ca} (columns), each choosing to {s1} or {s2}. The firms choose simultaneously, once, with no binding agreement. Payoffs are profits in millions of dollars, listed as ({ra}, {ca}).", "data": {"row_player": ra, "col_player": ca, "row_strategies": labels, "col_strategies": labels, "payoff_units": "millions of dollars of profit",
            "payoffs": {f"{labels[r]},{labels[c]}": M[r][c] for r in range(2) for c in range(2)}, "format": f"({ra} payoff, {ca} payoff)"}}
    better = [(r, c) for r in range(2) for c in range(2) if M[r][c][0] > eq[0] and M[r][c][1] > eq[1]]
    if not better: raise ValueError("no_pareto_improvement")
    br, bc = better[0]
    parts = [
        part("A", f"Does {ra} have a dominant strategy? If so, identify it and justify using the payoffs.", 2, "explain", ["2.C"], f"Yes: {labels[r0]}. Whatever {ca} chooses, {ra} earns more with {labels[r0]} (for example {M[r0][0][0]} vs {M[1-r0][0][0]} if {ca} chooses {labels[0]}, and {M[r0][1][0]} vs {M[1-r0][1][0]} if {ca} chooses {labels[1]}).", [
            row("A1", 1, "Identifies the dominant strategy", [labels[r0]]),
            row("A2", 1, "Justifies by showing that the strategy pays more against each of the rival's choices", [labels[r0]], requires="A1")]),
        part("B", "Identify the Nash equilibrium of the game.", 1, "select", ["2.C"], f"({ra}: {labels[r0]}, {ca}: {labels[c0]}).", [row("B1", 1, "States the equilibrium strategy pair for both firms", [labels[r0], labels[c0]], both=True)]),
        part("C", f"State the payoffs of {ra} and {ca} in the Nash equilibrium.", 1, "select", ["2.C"], f"${eq[0]} million for {ra} and ${eq[1]} million for {ca}.", [row("C1", 1, "Reads both equilibrium payoffs from the matrix (answer)", [str(eq[0]), str(eq[1])], nums=True, both=True)]),
        part("D", f"The outcome ({ra}: {labels[br]}, {ca}: {labels[bc]}) gives both firms higher payoffs than the Nash equilibrium. Explain why the firms might not reach it without an enforceable agreement.", 1, "explain", ["2.B"], "At least one firm earns more by switching to its best response, so the outcome is not stable without enforcement.", [row("D1", 1, "Explains that at least one firm has an incentive to deviate from that outcome (a better response exists), so it is not stable", ["incentive to deviate", "better response"], both=True)]),
    ]
    for pt in parts: pt["topic_codes"] = ["4.5"]
    pk = {"archetype": "frq_micro_game", "template": "short_game_theory", "topic": "4.5", "extra_topics": [], "skill": "2.C", "representative_skill": "2.C", "calculator": "na", "title": "Oligopoly game: dominant strategies and equilibrium", "stimulus": stim,
          "parts": parts, "total_points": 5, "est_minutes": 11, "facts": [f"payoffs={M}", f"nash={nash['nash']}", f"dominant_row={nash['dominant_row']}", f"structure={structure}"], "context": "oligopoly"}
    meaning(pk, {"A1": {"elements": ["Names the strategy that pays the firm more against every choice of the rival (its dominant strategy)"], "alt": ["the dominant strategy is " + labels[r0], "choosing " + labels[r0] + " is always better for " + ra], "err": ["names the strategy that is best only against one rival choice", "says there is no dominant strategy"]},
               "A2": {"elements": ["Shows that the strategy pays more against each of the rival's choices (any valid comparison of the payoffs)"], "alt": ["compares payoffs for both rival choices with the numbers", "better regardless of what the other firm does"], "err": ["compares payoffs against only one rival choice", "justifies with the highest total payoff"]},
               "B1": {"elements": ["States the strategy pair in which each firm plays its best response to the other"], "alt": ["both firms play their best responses at the cell", "neither firm can gain by switching alone"], "err": ["identifies only one firm's strategy", "names the cooperative cell"]},
               "C1": {"keep_nums": True, "elements": ["Reads both equilibrium payoffs correctly from the matrix (answer)"], "alt": ["the payoffs in the equilibrium cell", "the numbers in the Nash equilibrium cell"], "err": ["reads the payoffs of a different cell", "swaps the firms' payoffs"]},
               "D1": {"elements": ["Explains that a firm can earn more by deviating from that outcome, so it is not stable without enforcement"], "alt": ["a firm can earn more by deviating", "the dominant strategy tempts a firm away", "cheating pays"], "err": ["says the outcome is infeasible because payoffs are lower", "says firms are irrational"]}})
    pk["blueprint"] = frq_blueprint("frq_micro_game", SUB, pk, "Dominant strategy, Nash equilibrium, and a mutually better outcome in a two-firm game",
        ["Compare each firm's payoffs holding the rival's choice fixed to find a dominant strategy", "Find the strategy pair where neither firm benefits from deviating", "Compare equilibrium payoffs with the other outcomes and explain the incentive problem"],
        [("Simultaneous one-shot game with the payoffs shown and no enforceable agreement", "stated in the stimulus description")], {"type": "payoff_matrix", "must_include": ["row and column strategies", "payoffs for both players"]},
        "best-response enumeration cross-checked by a separate Nash/dominance module (micro_checks.nash)",
        extra={"model": {"initial_state": f"two firms simultaneously choose {s1} or {s2} with the payoff matrix shown", "changed_conditions": ["comparison of the equilibrium with a mutually better outcome"], "held_constant": ["payoff matrix", "one-shot simultaneous play"], "checks": ["dominant strategy", "Nash equilibrium by best responses", "equilibrium payoff", "Pareto comparison"], "key_assumptions_id": "oneshot-simultaneous", "explanation_assumptions_id": "oneshot-simultaneous"}})
    return pk
