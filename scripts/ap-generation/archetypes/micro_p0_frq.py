"""AP Microeconomics P0 FRQ 원형(2026-10-13). 긴 문항 3종(10점) + 짧은 문항 5종(5점). 공식 구조(CED p.121): 긴 1 + 짧은 2 = 20점. 그래프 그리기(스킬 4.A–4.C)는 FRQ 점수의 30–50%.
모든 수치는 코드가 계산하고 독립 경로로 다시 계산한다. 루브릭은 의미 기반(문구 일치 아님), 모범 답안은 'ALTON reference answer for self-review — not official AP scoring'. 그래프 그리기 행은 체크리스트(종이 손글씨)다."""
from micro_common import *  # noqa: F401,F403
from calc_ab_frq import row, part
from micro_common import Mkt  # noqa: F401

REF = "ALTON reference answer for self-review — not official AP scoring. "
ELEM_MIN = 26


def fr(rid, pts, crit, el, alt, err, nums=False, requires=None, both=False, note=None):
    """의미 기반 채점 행. el: 개념 서술(25자 이상, 수치 행은 수 포함)."""
    r = row(rid, pts, crit, el, alt=alt, err=err, requires=requires, both=both, nums=nums)
    r["meaning_based"] = True; r["uses_concept"] = False; r["single_explanation"] = False
    r["grading_note"] = note or "Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase."
    return r


def prt(label, prompt, pts, mode, skills, answer, rows, topics):
    p = part(label, prompt, pts, mode, skills, REF + answer, rows)
    p["topic_codes"] = topics
    return p


def finish(pk, concept, thinking, cond, material, path, model):
    pk["blueprint"] = frq_blueprint(pk["archetype"], SUB, pk, concept, thinking, cond, material, path, extra={"model": model})
    return pk


def mdl(initial, changed, held, checks, aid):
    return {"initial_state": initial, "changed_conditions": changed, "held_constant": held, "checks": checks, "key_assumptions_id": aid, "explanation_assumptions_id": aid}


GOODS_F = ["cabbage", "wheat", "lemons", "cotton", "corn"]


# ======================= L1 완전경쟁 기업과 시장 (긴, 10점) =======================
def mif_long_pc_firm(rng):
    b = rng.choice([1, 2]); k = rng.choice([2, 3, 4]); a = rng.choice([10, 20]); F = b * k * k
    TC = [F + a * q + b * q * q for q in range(0, 9)]
    atc = [None] + [Fr(TC[q], q) for q in range(1, 9)]
    # 독립 경로: 표에서 평균 총비용 최소 수량
    kq = min(range(1, 9), key=lambda q: atc[q])
    if kq != k:
        raise ValueError("min_atc_mismatch")
    P1 = a + 2 * b * k
    agree(float(atc[k]), P1, 1e-9, "p1")
    qstar = k + 2
    mcs = [None] + [TC[q] - TC[q - 1] for q in range(1, 9)]
    P2 = mcs[qstar] + 1
    best = max(range(0, 9), key=lambda q: P2 * q - TC[q])
    last = max(q for q in range(1, 9) if mcs[q] <= P2)
    if best != qstar or last != qstar:
        raise ValueError("profit_max_mismatch")
    profit = P2 * qstar - TC[qstar]
    if profit <= 0:
        raise ValueError("nonpositive_profit")
    g = rng.choice(GOODS_F)
    stim = tbl(f"Total cost of producing {g} for a typical firm in a perfectly competitive, constant-cost {g} industry.", ["Quantity (tons)", "Total cost (dollars)"], [[q, TC[q]] for q in range(0, 9)], notes=[f"The market for {g} is currently in long-run equilibrium at a price of ${P1} per ton."])
    parts = [
        prt("A", f"Draw correctly labeled side-by-side graphs for the market for {g} and for a typical firm, both in long-run equilibrium at a price of ${P1} per ton. On your graphs, label the market equilibrium price and quantity (${P1} and Q_M), the firm's quantity (Q_F), and the firm's MC and ATC curves.", 3, "draw", ["4.A"],
            f"Market graph: downward-sloping demand and upward-sloping supply meeting at ${P1} and Q_M. Firm graph: U-shaped ATC with MC crossing it at its minimum, a horizontal price line at ${P1}, and Q_F where the price line meets MC.",
            [fr("A1", 1, "Market graph labeled correctly", ["Draws downward-sloping demand and upward-sloping supply curves with Price and Quantity labeled on the axes and the intersection labeled with the price and Q_M"], ["labels may be written as P and Q or as price and quantity", "curves may be labeled D and S or demand and supply"], ["omits axis labels", "draws both curves with the same slope sign"]),
             fr("A2", 1, "Firm graph curves correct", ["Draws U-shaped MC and ATC curves on the firm graph, with MC crossing ATC at the minimum of ATC and a horizontal price line at the long-run price touching ATC at its minimum"], ["the price line may be labeled as demand, marginal revenue, or price", "MC may be drawn as a rising curve through the minimum of ATC"], ["draws ATC as a downward-sloping line only", "places the price line above or below the minimum of ATC"]),
             fr("A3", 1, "Quantities labeled consistently", ["Labels the firm's quantity Q_F where the price line meets MC and shows the same price on both graphs"], ["Q_F may be marked on the horizontal axis directly below the MC-price intersection", "the firm quantity is labeled at the minimum of ATC"], ["labels Q_F at the minimum of MC", "uses different prices on the two graphs"])], ["3.7"]),
        prt("B", f"Suppose market demand for {g} increases and the market price rises to ${P2} per ton. Using the table, calculate the firm's profit-maximizing quantity and its economic profit at that price.", 2, "calculate", ["3.C"],
            f"Marginal cost of the {qstar}th ton is ${mcs[qstar]}, below ${P2}, and the next ton costs ${mcs[qstar + 1]}, above it, so the firm produces {qstar} tons. Profit = ${P2} x {qstar} - ${TC[qstar]} = ${profit}.",
            [fr("B1", 1, "Profit-maximizing quantity (answer)", ["Finds the last ton whose marginal cost does not exceed the price (the quantity answer is correct)", str(qstar)], ["price equals marginal cost", "compares each additional ton's cost with the price"], ["uses the quantity that minimizes average total cost", "uses the largest quantity in the table"], nums=True),
             fr("B2", 1, "Economic profit (answer)", ["Computes total revenue minus total cost at the profit-maximizing quantity (the profit answer is correct)", str(profit)], ["price minus ATC times quantity", "total revenue less the table's total cost"], ["forgets to subtract total cost", "uses marginal cost instead of total cost"], nums=True, requires="B1")], ["3.5"]),
        prt("C", f"On your graphs from part (A), show the short-run effect of the increase in demand: label the new market price (${P2}) on the market graph and, on the firm graph, label the firm's new quantity (Q_F2) and shade the firm's economic profit.", 2, "draw", ["4.C"],
            "Market demand shifts right and the equilibrium price rises to the new price. On the firm graph the new horizontal price line meets MC at Q_F2, and the rectangle between the price and ATC up to Q_F2 is shaded.",
            [fr("C1", 1, "Market effect shown", ["Shifts the market demand curve to the right and labels the new, higher equilibrium price on the market graph"], ["draws the new demand curve and labels it D2", "shows an arrow indicating the rightward shift"], ["shifts the supply curve instead of demand", "shows the price falling"]),
             fr("C2", 1, "Firm profit shown", ["Draws the higher price line on the firm graph, labels Q_F2 where it meets MC, and shades the profit rectangle between the price and ATC up to Q_F2"], ["shading may be a rectangle outlined and hatched", "Q_F2 may be marked on the horizontal axis"], ["shades the area between price and MC", "labels Q_F2 at the minimum of ATC"])], ["2.7"]),
        prt("D", "Explain what happens to the number of firms in the industry in the long run and why.", 2, "explain", ["2.B"],
            "Firms are earning positive economic profit, so new firms enter; entry shifts market supply to the right, which lowers the price until economic profit returns to zero.",
            [fr("D1", 1, "Entry because of profit", ["States that firms enter the industry because existing firms are earning positive economic profit"], ["new firms are attracted by profits", "the number of firms increases because price exceeds average total cost"], ["says firms exit", "says the number of firms does not change in a competitive market"]),
             fr("D2", 1, "Mechanism of adjustment", ["Explains that entry shifts market supply to the right, which lowers the price until economic profit falls to zero"], ["more firms mean greater market supply and a lower price", "the price falls back toward the minimum of average total cost"], ["says entry shifts demand", "says price keeps rising"], requires="D1")], ["3.6"]),
        prt("E", "In the new long-run equilibrium, will the market quantity of the good be greater than, less than, or equal to Q_M? Identify and give a reason.", 1, "select", ["3.A"],
            "Greater than Q_M, because the price returns to its original level while demand is higher, so the market quantity is larger.",
            [fr("E1", 1, "States the long-run market quantity and the reason", ["States that the long-run market quantity is greater than Q_M because the price returns to its original level at the higher demand"], ["more than the original quantity", "the long-run supply curve is horizontal in a constant-cost industry"], ["says the quantity returns to Q_M", "says the quantity is less than Q_M"])], ["3.7"]),
    ]
    pk = {"archetype": "mif_long_pc_firm", "template": "long_pc_firm", "topic": "3.7", "extra_topics": ["3.5", "3.6", "2.7"], "skill": "4.A", "calculator": "allowed", "title": "A perfectly competitive firm and its market", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 24,
          "facts": [f"b={b}", f"k={k}", f"a={a}", f"P1={P1}", f"P2={P2}", f"qstar={qstar}", f"profit={profit}", f"good={g}"], "context": "perfect_competition"}
    return finish(pk, "Perfectly competitive firm in long-run equilibrium, a demand increase, short-run profit, and long-run entry", ["Draw the market and firm graphs consistent with long-run equilibrium", "Use marginal cost from the table to find the profit-maximizing quantity and profit", "Show the short-run change and reason about entry"],
                  [("Competitive constant-cost industry with the cost table shown and a long-run price equal to the minimum of ATC", "stated in the stimulus notes")], {"type": "table", "must_include": ["total cost table", "long-run price"]},
                  "table scan of profit by quantity versus the MC-at-most-price rule, and ATC minimum found by scanning the table",
                  mdl(f"competitive industry in long-run equilibrium at ${P1} with firm costs TC = {F} + {a}Q + {b}Q^2", [f"market demand rises and price becomes ${P2}"], ["firm cost curves", "constant-cost industry"], ["ATC minimum at the long-run price", "profit-maximizing quantity by scan", "profit", "long-run entry direction"], "pc-constant-cost"))


# ======================= L2 가격 상한 (긴, 10점) =======================
def mif_long_market_policy(rng):
    for _ in forever():
        P0 = rng.choice([10, 12, 15, 20]); Q0 = rng.choice([60, 80, 100]); b = rng.choice([2, 4, 5]); d = rng.choice([2, 3, 4])
        if b == d: continue
        a = Q0 + b * P0; c = Q0 - d * P0; Pc = P0 - rng.choice([2, 3, 4])
        if Pc <= 0 or c + d * Pc <= 0: continue
        break
    Qd, Qs = a - b * Pc, c + d * Pc
    short = Qd - Qs
    if short <= 0: raise ValueError("no_shortage")
    # 독립 경로: 표의 가격 행에서 교차를 찾는다
    prices = sorted({Pc, P0, P0 + 2, P0 + 4, Pc - 1 if Pc > 1 else Pc + 1, P0 - 1})
    tab = [[usd(p), a - b * p, c + d * p] for p in prices if a - b * p > 0 and c + d * p >= 0]
    eq_rows = [r for r in tab if r[1] == r[2]]
    if len(eq_rows) != 1 or eq_rows[0][1] != Q0:
        raise ValueError("table_eq_mismatch")
    hi = P0 + rng.choice([2, 3])
    g = rng.choice(["apartments in a college town", "gasoline", "bottled water", "concert tickets"])
    stim = tbl(f"Quantity demanded and quantity supplied of {g} at different prices in a competitive market.", ["Price (dollars)", "Quantity demanded", "Quantity supplied"], tab)
    parts = [
        prt("A", f"Draw a correctly labeled graph of the competitive market for {g}. On your graph, label the equilibrium price (P_E) and the equilibrium quantity (Q_E).", 2, "draw", ["4.A"], "A downward-sloping demand curve and an upward-sloping supply curve with Price and Quantity axes, intersecting at P_E and Q_E.",
            [fr("A1", 1, "Curves and axes", ["Draws a downward-sloping demand curve and an upward-sloping supply curve with Price and Quantity labeled on the axes and the curves labeled"], ["curves may be labeled D and S", "axes may be labeled P and Q"], ["draws two curves with the same slope sign", "omits an axis label"]),
             fr("A2", 1, "Equilibrium labeled", ["Labels the intersection of the curves as the equilibrium with P_E on the price axis and Q_E on the quantity axis"], ["drops dashed lines from the intersection to the axes", "labels the equilibrium point E with P_E and Q_E"], ["labels a point that is not the intersection", "labels only the price"])], ["2.6"]),
        prt("B", "Using the table, determine the equilibrium quantity.", 1, "calculate", ["3.C"], f"Quantity demanded equals quantity supplied at ${P0}, where {Q0} units are traded.", [fr("B1", 1, "Equilibrium quantity (answer)", ["Identifies the price at which quantity demanded equals quantity supplied and reads the quantity (the quantity answer is correct)", str(Q0)], ["the row where the two quantities are equal", "equilibrium quantity from the table"], ["reports the equilibrium price instead of the quantity"], nums=True)], ["2.6"]),
        prt("C", f"The government sets a price ceiling of ${Pc} per unit. On your graph, show the price ceiling, label the quantity actually traded (Q_C), and label the shortage.", 2, "draw", ["4.B"], "A horizontal line at the ceiling below P_E, Q_C on the quantity axis at the quantity supplied at the ceiling, and the horizontal gap between supply and demand at the ceiling labeled as the shortage.",
            [fr("C1", 1, "Ceiling drawn", ["Draws a horizontal price ceiling line below the equilibrium price and labels it with the ceiling price"], ["the line may extend across the graph at the ceiling price", "the line is labeled price ceiling or PC"], ["draws the ceiling above the equilibrium price", "draws a vertical line"]),
             fr("C2", 1, "Quantity and shortage shown", ["Labels Q_C where the ceiling meets the supply curve and marks the gap between the supply and demand curves at the ceiling as the shortage"], ["Q_C is marked on the horizontal axis at the quantity supplied", "the shortage is shown as a horizontal segment between supply and demand"], ["marks Q_C at the quantity demanded", "labels the surplus instead of the shortage"], requires="C1")], ["2.8"]),
        prt("D", "Using the table, calculate the quantity demanded and the quantity supplied at the price ceiling and the size of the shortage.", 2, "calculate", ["3.C"], f"At ${Pc}: quantity demanded is {Qd} and quantity supplied is {Qs}, so the shortage is {short} units.",
            [fr("D1", 1, "Quantities at the ceiling (answer)", ["Reads the quantity demanded and quantity supplied at the ceiling price (both answers are correct)", str(Qd), str(Qs)], ["row of the table at the ceiling price", "quantity demanded and supplied at the ceiling"], ["reads quantities at the equilibrium price"], nums=True, both=True),
             fr("D2", 1, "Shortage (answer)", ["Subtracts quantity supplied from quantity demanded to find the shortage (the shortage answer is correct)", str(short)], ["difference between demanded and supplied", "excess of quantity demanded over quantity supplied"], ["reports the quantity traded as the shortage"], nums=True, requires="D1")], ["2.8"]),
        prt("E", "Explain two effects of the price ceiling on the market other than the shortage.", 2, "explain", ["2.A"], "Some mutually beneficial trades no longer occur, creating deadweight loss; and buyers who are willing to pay more than the ceiling cannot buy, which leads to nonprice rationing or black markets.",
            [fr("E1", 1, "Explains the deadweight loss", ["Explains that the quantity traded falls below the efficient quantity, so some mutually beneficial transactions do not occur and a deadweight loss results"], ["total surplus falls", "a triangle of lost surplus appears"], ["says total surplus rises", "says the price ceiling helps all buyers"]),
             fr("E2", 1, "Explains nonprice rationing", ["Explains that buyers willing to pay more than the ceiling cannot obtain the good, which leads to waiting, favoritism, or black markets"], ["black markets could develop", "buyers compete with time or queues instead of price"], ["says sellers lower their costs", "says the shortage disappears"])], ["2.8"]),
        prt("F", f"Suppose instead the government had set a price ceiling of ${hi} per unit. Identify what would happen to the quantity traded and explain why.", 1, "select", ["3.A"], f"The quantity traded would not change, because ${hi} is above the equilibrium price of ${P0}, so the ceiling is not binding.",
            [fr("F1", 1, "States that the ceiling is nonbinding and gives the reason", ["States that the quantity traded would be unchanged because a ceiling above the equilibrium price is not binding"], ["no effect on price or quantity", "the market stays at equilibrium"], ["says a shortage would arise", "says the quantity traded would fall"])], ["2.8"]),
    ]
    pk = {"archetype": "mif_long_market_policy", "template": "long_market_policy", "topic": "2.8", "extra_topics": ["2.6"], "skill": "4.A", "calculator": "allowed", "title": "A market with a price ceiling", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 25,
          "facts": [f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"P0={P0}", f"Pc={Pc}", f"hi={hi}", f"good={g}"], "context": "price_ceiling"}
    return finish(pk, "Competitive market equilibrium and a binding price ceiling with its shortage, deadweight loss, and a nonbinding comparison", ["Draw the market and read equilibrium from the table", "Show the binding ceiling, the quantity traded and the shortage on the graph and calculate them", "Explain the welfare effects and contrast a nonbinding ceiling"],
                  [("Competitive market with the schedule in the table and a ceiling below the equilibrium price", "stated in the stimulus")], {"type": "table", "must_include": ["demand and supply schedule", "ceiling price"]},
                  "table intersection scan versus sympy solution of the linear schedules",
                  mdl(f"competitive market with Qd = {a} - {b}P and Qs = {c} + {d}P", [f"price ceiling of ${Pc}"], ["demand and supply curves"], ["equilibrium", "quantities at the ceiling", "shortage", "nonbinding ceiling"], "ceiling-linear"))


# ======================= L3 독점과 가격 상한 규제 (긴, 10점) =======================
def mif_long_monopoly(rng):
    for _ in forever():
        A = rng.choice([60, 80, 100, 120]); B = rng.choice([1, 2]); m = rng.choice([10, 20, 30]); F = rng.choice([100, 150, 200, 300])
        Qm = Fr(A - m, 2 * B); Pm = A - B * Qm
        if Qm != int(Qm) or Pm != int(Pm): continue
        Qm, Pm = int(Qm), int(Pm); prof = (Pm - m) * Qm - F
        if prof <= 0: continue
        Qr = Fr(A - m, B)
        if Qr != int(Qr): continue
        Qr = int(Qr)
        break
    q = sp.symbols("q")
    qs = float(sp.solve(sp.diff((A - B * q) * q - m * q, q), q)[0]); agree(qs, Qm, 1e-9, "Qm")
    qgrid = np.arange(0, int(A / B), 1.0); pj = (A - B * qgrid - m) * qgrid - F; agree(float(qgrid[int(np.argmax(pj))]), Qm, 1.0, "Qm_grid")
    rows = [[qq, usd(A - B * qq)] for qq in range(0, int(A / B) + 1, int(A / B / 6) or 1) if A - B * qq >= 0][:7]
    stim = tbl("Demand schedule for the only seller (a monopolist) of a product.", ["Quantity", "Price (dollars)"], rows, notes=[f"The demand schedule follows P = {A} - {B}Q.", f"Marginal cost is constant at ${m} per unit, and the firm has a fixed cost of ${F}."])
    parts = [
        prt("A", "Draw a correctly labeled graph of the monopolist's market showing the demand curve, the marginal revenue curve, and the marginal cost curve. Label the profit-maximizing quantity (Q_M) and price (P_M).", 2, "draw", ["4.A"], "A downward-sloping demand curve with a marginal revenue curve below it (steeper), a horizontal MC curve, Q_M where MR crosses MC, and P_M on the demand curve above Q_M.",
            [fr("A1", 1, "Curves drawn", ["Draws a downward-sloping demand curve, a marginal revenue curve that lies below demand and is steeper, and a horizontal marginal cost curve, all labeled, with Price and Quantity on the axes"], ["curves may be labeled D, MR, and MC", "MR may reach the quantity axis at half the demand intercept"], ["draws MR above demand", "draws MR and demand with the same slope"]),
             fr("A2", 1, "Optimum labeled", ["Labels Q_M where MR crosses MC and labels P_M on the vertical axis at the demand curve directly above Q_M"], ["dashed lines from the MR-MC intersection down to Q_M and up to demand to P_M", "price read from demand, not from MC"], ["labels P_M at the MC curve", "puts Q_M at the demand-MC intersection"], requires="A1")], ["4.2"]),
        prt("B", "Using the demand schedule and the marginal cost, calculate the profit-maximizing quantity and the price.", 2, "calculate", ["3.C"], f"MR = {A} - {2 * B}Q equals MC = {m} at Q = {Qm}; the price from demand is ${Pm}.",
            [fr("B1", 1, "Profit-maximizing quantity (answer)", ["Sets marginal revenue equal to marginal cost and solves for the quantity (the quantity answer is correct)", str(Qm)], ["MR = MC", "marginal revenue equals marginal cost"], ["sets price equal to marginal cost and gets the competitive quantity"], nums=True),
             fr("B2", 1, "Price (answer)", ["Reads the price from the demand curve at the profit-maximizing quantity (the price answer is correct)", str(Pm)], ["substitutes Q into the demand equation", "price on demand above the quantity"], ["reports marginal cost or marginal revenue as the price"], nums=True, requires="B1")], ["4.2"]),
        prt("C", "Calculate the monopolist's economic profit.", 1, "calculate", ["3.C"], f"Profit = (${Pm} - ${m}) x {Qm} - ${F} = ${prof}.",
            [fr("C1", 1, "Economic profit (answer)", ["Computes total revenue minus total variable and fixed cost at the profit-maximizing quantity (the profit answer is correct)", str(prof)], ["(price minus average total cost) times quantity", "total revenue less total cost"], ["forgets the fixed cost", "uses marginal cost as average total cost"], nums=True)], ["4.2"]),
        prt("D", "A regulator now sets a maximum price equal to the monopolist's marginal cost. On your graph, show the regulated price and label the quantity the firm would produce (Q_R).", 2, "draw", ["4.C"], "A horizontal price cap at the MC level; the quantity Q_R is where the demand curve meets MC, larger than Q_M.",
            [fr("D1", 1, "Price cap shown", ["Draws the price cap at the level of the marginal cost curve and labels it as the regulated price"], ["the cap may coincide with the MC line", "labels the regulated price P_R equal to MC"], ["draws the cap at P_M", "draws the cap above the demand intercept"]),
             fr("D2", 1, "Regulated quantity", ["Labels Q_R on the quantity axis where the demand curve meets the marginal cost curve and shows it is greater than Q_M"], ["Q_R is at the intersection of demand and MC", "the regulated quantity exceeds the monopoly quantity"], ["labels Q_R at the MR-MC intersection", "shows Q_R smaller than Q_M"], requires="D1")], ["6.4"]),
        prt("E", "Explain why the unregulated monopolist's output is not allocatively efficient.", 2, "explain", ["2.B"], "The monopolist sets MR = MC, so price exceeds marginal cost; the last units valued by consumers at more than their cost are not produced, creating deadweight loss.",
            [fr("E1", 1, "Explains why price is above marginal cost", ["Explains that the monopolist produces where marginal revenue equals marginal cost, so price exceeds marginal cost at that quantity"], ["P is greater than MC at the monopoly output", "MR lies below demand so the price is above MC"], ["says price equals marginal cost", "says the monopolist produces the efficient quantity"]),
             fr("E2", 1, "Lost surplus", ["Explains that the quantity is below the efficient quantity, so units whose benefit exceeds their cost are not produced, creating deadweight loss"], ["some mutually beneficial trades do not occur", "total surplus is lower than at the competitive quantity"], ["says deadweight loss is zero", "says output is above the efficient quantity"], requires="E1")], ["4.2"]),
        prt("F", "Calculate the firm's economic profit when the price is capped at marginal cost.", 1, "calculate", ["3.C"], f"At a price equal to marginal cost the firm earns no margin over marginal cost, so it loses its fixed cost: -${F}.",
            [fr("F1", 1, "Profit under the cap (answer)", ["Finds that revenue just covers variable cost, so the firm loses its fixed cost (the loss answer is correct)", str(F)], ["economic loss equal to the fixed cost", "profit equals minus the fixed cost"], ["reports zero profit", "reports the unregulated profit"], nums=True)], ["6.4"]),
    ]
    pk = {"archetype": "mif_long_monopoly", "template": "long_monopoly", "topic": "4.2", "extra_topics": ["6.4"], "skill": "4.A", "calculator": "allowed", "title": "A monopolist and price regulation", "stimulus": stim, "parts": parts, "total_points": 10, "est_minutes": 25,
          "facts": [f"A={A}", f"B={B}", f"m={m}", f"F={F}", f"Qm={Qm}", f"Pm={Pm}", f"profit={prof}", f"Qr={Qr}"], "context": "monopoly_regulation"}
    return finish(pk, "Monopoly profit maximization, profit, deadweight loss, and a price cap at marginal cost", ["Draw D, MR, MC and the monopoly optimum", "Compute the optimum and profit, show the price cap", "Explain the inefficiency and compute the loss under the cap"],
                  [("Linear demand, constant marginal cost, and fixed cost stated in the stimulus", "stated in the table notes")], {"type": "table", "must_include": ["demand schedule", "marginal cost", "fixed cost"]},
                  "sympy derivative of profit versus numpy grid search of profit by quantity",
                  mdl(f"single seller with P = {A} - {B}Q, MC = {m}, fixed cost {F}", [f"price cap set at marginal cost {m}"], ["demand", "marginal cost", "fixed cost"], ["MR=MC quantity", "price from demand", "profit", "regulated quantity", "loss under the cap"], "monopoly-cap"))


# ======================= S3 외부효과 (짧은, 5점) =======================
def mif_short_externality(rng):
    for _ in forever():
        A = rng.choice([100, 120, 140]); B = rng.choice([1, 2]); Cc = rng.choice([20, 30]); D = rng.choice([1, 2]); e = rng.choice([20, 30, 40, 60])
        Qm = Fr(A - Cc, B + D); Qe = Fr(A - Cc - e, B + D)
        if Qm != int(Qm) or Qe != int(Qe) or Qe <= 0: continue
        Qm, Qe = int(Qm), int(Qe); break
    qq = np.arange(0, 200, 1.0); net = np.cumsum((A - B * qq) - (Cc + D * qq + e)); agree(float(qq[int(np.argmax(net))]), Qe, 1.0, "Qe_grid")
    g = rng.choice(["paper", "fertilizer", "electricity from coal", "chemical dyes"])
    rows = [[q_, usd(A - B * q_), usd(Cc + D * q_), usd(e)] for q_ in range(0, 5 * (Qm // 5 + 1) + 1, max(1, Qm // 4))][:7]
    stim = tbl(f"Marginal private benefit, marginal private cost, and marginal external cost per unit in the market for {g}.", ["Quantity", "Marginal private benefit (demand)", "Marginal private cost (supply)", "Marginal external cost"], rows, notes=[f"Production of {g} imposes a constant external cost of ${e} per unit on people who are not buyers or sellers."])
    parts = [
        prt("A", f"Draw a correctly labeled graph of the market for {g} showing demand, private supply, and marginal social cost. Label the market quantity (Q_M) and the socially efficient quantity (Q_E).", 2, "draw", ["4.A"], "Demand and upward-sloping supply, with the MSC curve above supply; Q_M where demand meets supply and Q_E, smaller, where demand meets MSC.",
            [fr("A1", 1, "Curves drawn", ["Draws a downward-sloping demand curve, an upward-sloping private supply curve, and a marginal social cost curve above the supply curve, all labeled, with Price and Quantity on the axes"], ["MSC may be labeled MSC or social cost", "supply may be labeled S or private cost"], ["draws MSC below supply", "omits the MSC curve"]),
             fr("A2", 1, "Quantities labeled", ["Labels Q_M where demand meets supply and Q_E where demand meets the marginal social cost curve, with Q_E less than Q_M"], ["dashed lines to the horizontal axis at each intersection", "Q_E drawn to the left of Q_M"], ["labels Q_E to the right of Q_M", "labels both quantities at the same point"], requires="A1")], ["6.2"]),
        prt("B", "Explain why the market quantity is greater than the efficient quantity.", 1, "explain", ["2.A"], "Producers ignore the external cost, so the market supply curve reflects only private cost and the market produces where marginal private benefit equals marginal private cost, beyond the point where marginal social cost equals benefit.",
            [fr("B1", 1, "Explains the ignored external cost", ["Explains that producers do not bear the external cost, so the market produces beyond the point where marginal social benefit equals marginal social cost"], ["private cost is below social cost", "the market ignores the cost imposed on third parties"], ["says the market underproduces", "says producers pay the external cost"])], ["6.2"]),
        prt("C", "Calculate the per-unit tax that would lead the market to produce the efficient quantity.", 1, "calculate", ["3.C"], f"A tax equal to the marginal external cost, ${e} per unit.", [fr("C1", 1, "Tax (answer)", ["Sets the per-unit tax equal to the marginal external cost (the tax answer is correct)", str(e)], ["tax equals the external cost per unit", "a Pigouvian tax"], ["reports the market price", "reports the total external cost"], nums=True)], ["6.2"]),
        prt("D", f"Suppose the government instead gives producers of {g} a per-unit subsidy. Would the quantity produced move closer to or farther from the efficient quantity? Explain.", 1, "explain", ["3.A"], "Farther from the efficient quantity, because the subsidy shifts private supply right and increases a quantity that is already too large.",
            [fr("D1", 1, "Explains the effect of the subsidy", ["States that the quantity moves farther from the efficient quantity because a subsidy lowers private cost and raises an already excessive quantity"], ["the market would overproduce even more", "supply shifts right and output increases"], ["says the subsidy moves output closer to Q_E", "says the subsidy reduces output"])], ["6.2"]),
    ]
    pk = {"archetype": "mif_short_externality", "template": "short_externality", "topic": "6.2", "extra_topics": [], "skill": "4.A", "calculator": "allowed", "title": "A market with a negative externality", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"A={A}", f"B={B}", f"C={Cc}", f"D={D}", f"e={e}", f"Qm={Qm}", f"Qe={Qe}", f"good={g}"], "context": "externality"}
    return finish(pk, "Negative externality: market versus efficient quantity, the corrective tax, and a subsidy", ["Draw private supply, MSC, and demand and mark the two quantities", "Explain overproduction and compute the corrective tax", "Judge the effect of a subsidy"],
                  [("Constant external cost per unit stated in the table notes", "stated in the stimulus notes")], {"type": "table", "must_include": ["marginal external cost"]},
                  "analytic Q_M and Q_E versus numpy search for maximum social surplus",
                  mdl(f"market with MPB = {A} - {B}Q, MPC = {Cc} + {D}Q, external cost ${e} per unit", ["corrective tax or subsidy"], ["demand and supply"], ["market quantity", "efficient quantity", "tax equals external cost", "subsidy direction"], "externality-constant"))


# ======================= S4 노동시장 (짧은, 5점) =======================
def mif_short_labor(rng):
    for _ in forever():
        P = rng.choice([2, 3, 4]); mps = sorted(rng.sample([30, 26, 22, 18, 14, 10], 5), reverse=True)
        tp = [0]
        for m_ in mps: tp.append(tp[-1] + m_)
        mrps = [m_ * P for m_ in mps]
        w = rng.choice(mrps[1:4]) + rng.choice([-3, -2, 1, 2])
        best = sum(1 for x in mrps if x >= w)
        if 1 <= best <= 4: break
    prof = [sum(mrps[:q]) - w * q for q in range(6)]; agree(best, max(range(6), key=lambda q: prof[q]), 1e-9, "hire")
    n3 = mrps[2]
    g = rng.choice(["bicycles", "chairs", "bags of flour", "garden sheds"])
    stim = tbl(f"Total product of {g} per day for a firm that sells {g} in a perfectly competitive market at ${P} each and hires labor in a perfectly competitive labor market at a wage of ${w} per day.", ["Workers", f"Total product ({g})"], [[i, tp[i]] for i in range(0, 6)])
    nxt = best + 1
    parts = [
        prt("A", "Calculate the marginal revenue product of the third worker.", 1, "calculate", ["2.C"], f"MP of the third worker = {tp[3]} - {tp[2]} = {mps[2]}; MRP = {mps[2]} x ${P} = ${n3}.", [fr("A1", 1, "MRP (answer)", ["Multiplies the third worker's marginal product by the output price (the answer is correct)", str(n3)], ["marginal product times price", "extra output times the price of the product"], ["reports the marginal product without the price", "uses total product"], nums=True)], ["5.3"]),
        prt("B", "How many workers should the firm hire to maximize profit?", 1, "calculate", ["2.C"], f"Hire while the marginal revenue product is at least the wage of ${w}: {best} workers.", [fr("B1", 1, "Workers hired (answer)", ["Hires workers until the marginal revenue product falls below the wage (the number answer is correct)", str(best)], ["hire up to the last worker whose MRP is at least the wage", "MRP equals the wage"], ["hires the worker with the highest marginal product only", "hires all five workers"], nums=True)], ["5.3"]),
        prt("C", f"Explain why the firm does not hire worker number {nxt}.", 1, "explain", ["2.A"], f"Worker {nxt} adds ${mrps[best]} of revenue, which is less than the wage of ${w}, so hiring would reduce profit.",
            [fr("C1", 1, "Explains why MRP below the wage stops hiring", ["Explains that the next worker's marginal revenue product is less than the wage, so hiring that worker would lower profit"], ["the extra revenue from the worker is less than the extra cost", "MRP is below the wage for that worker"], ["says the worker is unproductive in total", "says the firm hires only workers with rising marginal product"])], ["5.3"]),
        prt("D", "Suppose the price of the product rises. Identify the effect on the firm's demand for labor.", 1, "select", ["3.B"], "The demand for labor increases (shifts right), because a higher output price raises the marginal revenue product at every quantity of labor.",
            [fr("D1", 1, "Labor demand shifts right", ["States that the demand for labor increases because the higher output price raises the marginal revenue product of every worker"], ["derived demand rises with the product price", "more workers are hired at the same wage"], ["says labor supply increases", "says the demand for labor decreases"])], ["5.2"]),
        prt("E", "If the firm were the only employer of labor in its town (a monopsonist), would it hire more, fewer, or the same number of workers as in the competitive labor market? Explain.", 1, "explain", ["2.B"], "Fewer, because the marginal factor cost of labor exceeds the wage, so the monopsonist hires where MRP equals the higher marginal factor cost.",
            [fr("E1", 1, "Explains why a monopsonist hires fewer workers", ["States that the monopsonist hires fewer workers because its marginal factor cost exceeds the wage"], ["hiring more workers requires raising the wage for all workers", "the monopsonist hires where MRP equals MFC"], ["says a monopsonist hires more workers", "says the monopsonist pays a higher wage"])], ["5.4"]),
    ]
    pk = {"archetype": "mif_short_labor", "template": "short_labor", "topic": "5.3", "extra_topics": ["5.2", "5.4"], "skill": "2.C", "calculator": "allowed", "title": "A firm's demand for labor", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"P={P}", f"tp={tp}", f"w={w}", f"best={best}", f"mrp3={n3}", f"good={g}"], "context": "labor_demand"}
    return finish(pk, "Marginal revenue product, the hiring decision, a labor demand shift, and monopsony", ["Compute marginal products and multiply by the output price", "Hire while MRP is at least the wage", "Reason about demand shifts and monopsony"],
                  [("Competitive output and labor markets with the price and wage stated in the table description", "stated in the stimulus description")], {"type": "table", "must_include": ["total product", "output price", "wage"]},
                  "MRP count versus argmax of profit across worker counts",
                  mdl(f"competitive firm selling at ${P} and paying ${w} per worker", ["output price rises", "firm is a monopsonist"], ["production function"], ["MRP", "number hired", "demand shift", "monopsony direction"], "labor-demand"))


# ======================= S5 비교우위와 무역 (짧은, 5점) =======================
def mif_short_trade(rng):
    for _ in forever():
        A = [rng.choice([24, 30, 36, 48]), rng.choice([12, 15, 20, 24])]; B = [rng.choice([12, 15, 20]), rng.choice([24, 30, 36])]
        oa, ob = Fr(A[1], A[0]), Fr(B[1], B[0])
        if oa < ob and oa * 2 != ob: break
    g1, g2 = rng.choice([("wheat", "cloth"), ("laptops", "chairs"), ("corn", "shirts")])
    # 독립 경로: 두 번째 재화의 기회비용이 반대로 낮은 쪽
    agree(1, 1 if Fr(A[0], A[1]) > Fr(B[0], B[1]) else 0, 1e-9, "opposite")
    mid = (oa + ob) / 2
    stim = tbl(f"Maximum output per day if a country uses all of its resources to produce only one good.", ["Country", f"{g1.capitalize()}", f"{g2.capitalize()}"], [["Country A", A[0], A[1]], ["Country B", B[0], B[1]]])
    parts = [
        prt("A", f"Calculate the opportunity cost of producing one unit of {g1}, in units of {g2}, in each country.", 2, "calculate", ["1.C"], f"Country A: {A[1]}/{A[0]} = {float(oa):.2f} units of {g2}; Country B: {B[1]}/{B[0]} = {float(ob):.2f} units of {g2}.",
            [fr("A1", 1, "Country A opportunity cost (answer)", ["Divides the amount of the other good given up by the amount of this good gained for Country A (the answer is correct)", f"{float(oa):.2f}"], ["units of the other good per unit of this good", "ratio of the maximum outputs"], ["inverts the ratio", "reports the maximum output of the other good"], nums=True),
             fr("A2", 1, "Country B opportunity cost (answer)", ["Divides the amount of the other good given up by the amount of this good gained for Country B (the answer is correct)", f"{float(ob):.2f}"], ["units of the other good per unit of this good", "ratio of the maximum outputs"], ["inverts the ratio", "reports the maximum output of the other good"], nums=True)], ["1.4"]),
        prt("B", f"Which country has the comparative advantage in producing {g1}? Identify the country.", 1, "select", ["1.C"], f"Country A, because its opportunity cost of {g1} is lower.", [fr("B1", 1, "Comparative advantage", ["Identifies the country with the lower opportunity cost of the good as the one with the comparative advantage"], ["the country that gives up less of the other good", "Country A has the lower cost"], ["picks the country with the larger absolute output", "picks the country with the higher opportunity cost"])], ["1.4"]),
        prt("C", f"Explain why both countries can gain if Country A exports {g1} to Country B at a price of {nm(float(mid), 2)} units of {g2} per unit of {g1}.", 1, "explain", ["2.A"], f"The price of {nm(float(mid), 2)} is above Country A's opportunity cost ({float(oa):.2f}) and below Country B's ({float(ob):.2f}), so each country obtains the good for less than it would cost to produce at home.",
            [fr("C1", 1, "Explains the gains from trade", ["Explains that the trading price lies between the two opportunity costs, so each country obtains the good at a cost lower than its own opportunity cost"], ["each country gets the good for less than it gives up at home", "the price is between the two opportunity costs"], ["says only the exporter gains", "says trade benefits only the country with the absolute advantage"])], ["1.4"]),
        prt("D", f"Draw a correctly labeled production possibilities curve for Country A with {g1} on the horizontal axis. Label the maximum quantity of each good.", 1, "draw", ["4.A"], f"A straight line from {A[1]} units of {g2} on the vertical axis to {A[0]} units of {g1} on the horizontal axis.",
            [fr("D1", 1, "PPC drawn", ["Draws a downward-sloping PPC with both axes labeled and the intercepts labeled with the maximum quantity of each good for Country A"], ["the curve may be a straight line because the opportunity cost is constant", "intercepts may be marked with the numbers from the table"], ["swaps the axis intercepts", "draws an upward-sloping curve"])], ["1.3"]),
    ]
    pk = {"archetype": "mif_short_trade", "template": "short_trade", "topic": "1.4", "extra_topics": ["1.3"], "skill": "1.C", "calculator": "allowed", "title": "Comparative advantage and gains from trade", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 11,
          "facts": [f"A={A}", f"B={B}", f"mid={float(mid):.3f}", f"goods={g1}/{g2}"], "context": "trade"}
    return finish(pk, "Opportunity costs from maximum outputs, comparative advantage, and gains from trade within the terms of trade", ["Compute opportunity costs as output ratios", "Identify the lower-cost producer", "Explain gains from trade and draw a PPC"],
                  [("Constant opportunity costs implied by the maximum outputs", "stated in the table description")], {"type": "table", "must_include": ["maximum outputs"]},
                  "ratio of outputs versus reciprocal opportunity cost of the other good",
                  mdl("two countries with constant opportunity costs given by the table", [f"trade at {nm(float(mid), 2)} units of {g2} per {g1}"], ["technology"], ["opportunity cost", "comparative advantage", "terms between opportunity costs", "PPC intercepts"], "trade-constant"))


# ======================= S6 탄력성 (짧은, 5점) =======================
def mif_short_elasticity(rng):
    for _ in forever():
        P0 = rng.choice([5, 8, 10, 12]); P1 = P0 + rng.choice([1, 2, 3]); Q0 = rng.choice([400, 500, 600, 800]); Q1 = Q0 - rng.choice([40, 60, 80, 100, 150])
        if Q1 <= 0: continue
        pq = Fr(Q1 - Q0, 1) / Fr(Q1 + Q0, 2); pp = Fr(P1 - P0, 1) / Fr(P1 + P0, 2); e = abs(pq / pp)
        if e == 1 or abs(e - 1) < Fr(1, 5): continue
        break
    qq, pps = sp.symbols("qq pps"); sym = abs(((Q1 - Q0) / ((Q1 + Q0) / sp.Integer(2))) / ((P1 - P0) / ((P1 + P0) / sp.Integer(2)))); agree(float(e), float(sym), 1e-9, "e")
    kind = "elastic" if e > 1 else "inelastic"
    tr0, tr1 = P0 * Q0, P1 * Q1
    d_tr = "increases" if tr1 > tr0 else "decreases"
    xs = rng.choice([(2, 5), (4, 6), (5, 10)]); pctP, pctQ = xs[0], xs[1] * rng.choice([1, -1])
    xed = Fr(pctQ, pctP)
    g1, g2 = rng.choice([("coffee", "tea"), ("pizza", "salad")])
    stim = tbl(f"Price and quantity demanded of {g1} before and after a price increase.", ["", "Price (dollars)", "Quantity demanded"], [["Before", P0, Q0], ["After", P1, Q1]], notes=[f"A {pctP} percent increase in the price of {g1} changes the quantity demanded of {g2} by {pctQ} percent."])
    parts = [
        prt("A", f"Using the midpoint method, calculate the absolute value of the price elasticity of demand for {g1} between the two prices.", 2, "calculate", ["1.C"], f"Percentage change in quantity = {float(abs(pq)) * 100:.1f}%, percentage change in price = {float(abs(pp)) * 100:.1f}%, elasticity = {float(e):.2f}.",
            [fr("A1", 1, "Percentage changes (answer)", ["Computes the percentage change in quantity and in price using midpoints as the base (both are correct)", f"{float(abs(pq)) * 100:.1f}", f"{float(abs(pp)) * 100:.1f}"], ["change divided by the average of the two values", "midpoint formula for each variable"], ["divides by the initial value instead of the midpoint", "divides by the final value"], nums=True, both=True),
             fr("A2", 1, "Elasticity (answer)", ["Divides the percentage change in quantity by the percentage change in price (the elasticity answer is correct)", f"{float(e):.2f}"], ["ratio of the two midpoint percentage changes", "absolute value of the elasticity"], ["inverts the ratio", "reports the slope"], nums=True, requires="A1")], ["2.3"]),
        prt("B", f"Is the demand for {g1} between these prices elastic, inelastic, or unit elastic? Identify.", 1, "select", ["1.C"], f"{kind.capitalize()}, because the elasticity is {'greater' if e > 1 else 'less'} than 1.", [fr("B1", 1, "Elasticity classification", [f"Classifies demand as {kind} because the elasticity coefficient is {'greater' if e > 1 else 'less'} than one"], ["compares the elasticity with 1", f"{kind} demand"], ["classifies demand with the opposite label", "says unit elastic"])], ["2.3"]),
        prt("C", f"Explain what happens to the total revenue from {g1} when the price rises, using your answer to part (B).", 1, "explain", ["2.A"], f"Total revenue {d_tr} (from ${tr0} to ${tr1}), because the percentage change in quantity is {'larger' if e > 1 else 'smaller'} than the percentage change in price.",
            [fr("C1", 1, "Explains the revenue effect", [f"Explains that total revenue {d_tr} because demand is {kind}, so the percentage fall in quantity is {'larger' if e > 1 else 'smaller'} than the percentage rise in price"], ["compares the percentage changes in price and quantity", f"revenue {d_tr} for {kind} demand"], ["says revenue always rises when price rises", "says revenue always falls when price rises"])], ["2.3"]),
        prt("D", f"Calculate the cross-price elasticity of demand between {g1} and {g2} and identify whether the goods are substitutes or complements.", 1, "calculate", ["1.C"], f"{pctQ}/{pctP} = {float(xed):.2f}; the goods are {'substitutes' if xed > 0 else 'complements'}.",
            [fr("D1", 1, "Cross-price elasticity and relationship (answer)", ["Divides the percentage change in quantity of the other good by the percentage change in price and interprets the sign (the value and relationship are correct)", f"{float(xed):.2f}", ("The goods are substitutes because the elasticity is positive" if xed > 0 else "The goods are complements because the elasticity is negative")], ["positive means substitutes and negative means complements", "ratio of the two percentage changes"], ["inverts the ratio", "reverses the interpretation of the sign"], nums=True, both=True)], ["2.5"]),
    ]
    pk = {"archetype": "mif_short_elasticity", "template": "short_elasticity", "topic": "2.3", "extra_topics": ["2.5"], "skill": "1.C", "calculator": "allowed", "title": "Elasticity and total revenue", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"P0={P0}", f"P1={P1}", f"Q0={Q0}", f"Q1={Q1}", f"e={float(e):.4f}", f"pctP={pctP}", f"pctQ={pctQ}", f"goods={g1}/{g2}"], "context": "elasticity"}
    return finish(pk, "Midpoint price elasticity, its classification, the total revenue effect, and cross-price elasticity", ["Compute midpoint percentage changes and their ratio", "Classify elasticity and connect it to revenue", "Compute and interpret a cross-price elasticity"],
                  [("Midpoint method and the data shown in the table and its notes", "stated in the stimulus")], {"type": "table", "must_include": ["prices and quantities", "cross-price data"]},
                  "exact Fraction midpoint ratio versus sympy expression, revenue compared directly",
                  mdl(f"demand data for {g1} with a price change and a cross-price observation for {g2}", [f"price rises from ${P0} to ${P1}"], ["other determinants of demand"], ["midpoint elasticity", "classification", "total revenue direction", "cross-price sign"], "elasticity-midpoint"))


# ======================= S7 독점적 경쟁 (짧은, 5점) =======================
def mif_short_mc(rng):
    for _ in forever():
        A = rng.choice([100, 120, 140]); B = 2; c = rng.choice([20, 30, 40]); Qs = Fr(A - c, 2 * B)
        if Qs != int(Qs) or Qs % 5 != 0: continue
        Qs = int(Qs); Ps = A - B * Qs
        F = rng.choice([80, 120, 160]) if False else rng.choice([100, 150, 200])
        prof = (Ps - c) * Qs - F
        if prof <= 0: continue
        break
    q = sp.symbols("q"); agree(float(sp.solve(sp.diff((A - B * q) * q - c * q, q), q)[0]), Qs, 1e-9, "Qs")
    qgrid = np.arange(0, A / B, 1.0); agree(float(qgrid[int(np.argmax((A - B * qgrid - c) * qgrid - F))]), Qs, 1.0, "Qs_grid")
    qlist = sorted({int(Qs / 2), Qs, int(Qs * 1.5), int(Qs * 2)})
    rows = [[x, usd(A - B * x), usd(A - 2 * B * x), usd(c), usd(c + F / x if F % x == 0 else round(c + F / x, 2))] for x in qlist]
    g = rng.choice(["a neighborhood coffee shop", "a boutique hair salon", "a local pizza restaurant"])
    stim = tbl(f"Price, marginal revenue (MR), marginal cost (MC), and average total cost (ATC), in dollars, for {g} in a monopolistically competitive market.", ["Quantity", "Price (demand)", "Marginal revenue", "Marginal cost", "Average total cost"], rows)
    parts = [
        prt("A", f"Draw a correctly labeled graph showing the firm's demand, marginal revenue, marginal cost, and average total cost curves in the short run. Label the profit-maximizing quantity (Q_1) and price (P_1).", 2, "draw", ["4.A"], "A downward-sloping demand curve with MR below it, a horizontal MC curve, and a U-shaped ATC; Q_1 where MR crosses MC and P_1 on demand above Q_1.",
            [fr("A1", 1, "Curves drawn", ["Draws a downward-sloping demand curve, a marginal revenue curve below it, a marginal cost curve, and a U-shaped average total cost curve, all labeled, with Price and Quantity on the axes"], ["MC may be drawn horizontal or rising", "curves may be labeled D, MR, MC, and ATC"], ["draws MR above demand", "omits the ATC curve"]),
             fr("A2", 1, "Optimum labeled", ["Labels Q_1 where MR crosses MC and P_1 on the demand curve above Q_1"], ["dashed lines from the MR-MC intersection to the axes", "price read from demand, not from MC"], ["labels P_1 at the MC curve", "puts Q_1 at the demand-ATC intersection"], requires="A1")], ["4.4"]),
        prt("B", "On your graph, shade the firm's economic profit in the short run.", 1, "draw", ["4.B"], "The rectangle between the price and ATC at Q_1, extending to Q_1 on the horizontal axis.", [fr("B1", 1, "Profit shaded", ["Shades the rectangle whose height is the difference between P_1 and ATC at Q_1 and whose width is Q_1"], ["the rectangle bounded by P_1, ATC at Q_1, and the vertical axis", "shaded area above ATC and below the price"], ["shades the area between price and MC", "shades the area under the demand curve"])], ["4.4"]),
        prt("C", "Explain what happens to the demand for this firm's product in the long run.", 1, "explain", ["2.B"], "Positive economic profit attracts new firms offering close substitutes, so the demand for this firm's product decreases until economic profit is zero.",
            [fr("C1", 1, "Explains how entry lowers demand", ["Explains that economic profit attracts entry of firms selling close substitutes, so the demand for this firm's product decreases"], ["new competitors take away some customers", "the firm's demand curve shifts to the left"], ["says demand increases", "says no firms can enter because of product differentiation"])], ["4.4"]),
        prt("D", "In long-run equilibrium, how does the firm's price compare with its marginal cost? Identify.", 1, "select", ["1.D"], "Price is greater than marginal cost, because the firm faces a downward-sloping demand curve and produces where marginal revenue equals marginal cost.",
            [fr("D1", 1, "Price above marginal cost", ["States that price exceeds marginal cost in long-run equilibrium because the firm has a downward-sloping demand curve and marginal revenue is below price"], ["P is greater than MC even with zero economic profit", "price equals average total cost but exceeds marginal cost"], ["says price equals marginal cost as in perfect competition", "says price is below marginal cost"])], ["4.4"]),
    ]
    pk = {"archetype": "mif_short_mc", "template": "short_monopolistic_competition", "topic": "4.4", "extra_topics": [], "skill": "4.A", "calculator": "na", "title": "A monopolistically competitive firm", "stimulus": stim, "parts": parts, "total_points": 5, "est_minutes": 12,
          "facts": [f"A={A}", f"B={B}", f"c={c}", f"F={F}", f"Qs={Qs}", f"Ps={Ps}", f"profit={prof}", f"firm={g}"], "context": "monopolistic_competition"}
    return finish(pk, "Short-run profit of a monopolistically competitive firm and the long-run adjustment", ["Draw the four curves and mark the MR = MC optimum", "Shade the profit rectangle", "Reason about entry and the long-run price-cost relationship"],
                  [("Linear demand, constant marginal cost, and fixed cost implied by the table", "stated in the stimulus")], {"type": "table", "must_include": ["price, MR, MC, ATC data"]},
                  "sympy derivative of profit versus numpy grid search of profit by quantity",
                  mdl(f"monopolistically competitive firm with P = {A} - {B}Q, MC = {c}, fixed cost {F}", ["entry of rival firms in the long run"], ["cost curves"], ["MR=MC quantity", "profit shading", "demand shifts left", "price above MC"], "mc-short-run"))
