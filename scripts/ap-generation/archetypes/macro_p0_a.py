"""AP Macroeconomics 원형 A — 단원 1(기본 경제 개념). 2026-10-14. 모든 정답은 코드가 계산하고 독립 경로로 다시 계산한다."""
from macro_common import *  # noqa: F401,F403
from macro_common import _sg  # noqa: F401


def _v(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 1.1 희소성 =======================
SCARCE = [
    ("Which of the following best defines scarcity?", "Limited resources are not enough to satisfy unlimited wants.", "Scarcity is the gap between limited resources and unlimited wants, so every society must choose.",
     [("A situation in which the price of a good is very high.", "Confuses scarcity with a high price; cheap goods are also scarce when resources are limited."), ("A shortage in which quantity demanded exceeds quantity supplied at the current price.", "Confuses scarcity with a market shortage, which is a temporary disequilibrium at one price."),
      ("A lack of money among low-income households.", "Confuses scarcity with poverty; scarcity affects rich and poor societies alike."), ("A temporary condition that disappears once technology improves.", "Treats scarcity as temporary; limited resources and unlimited wants persist after technology improves."),
      ("The inefficient use of available resources by a society.", "Confuses scarcity with inefficiency; even efficient use of resources leaves wants unsatisfied.")]),
    ("A city government has a fixed budget and must choose between building a library and building a park. Which statement best describes the opportunity cost of building the library?", "The value of the park that is given up.", "Opportunity cost is the value of the next-best alternative given up, here the park.",
     [("The dollar amount of the library's construction budget only.", "Counts only the explicit money cost and ignores the value of the alternative that is given up."), ("The total value of the library to city residents.", "Describes the benefit of the chosen option, not the cost of giving up the alternative."),
      ("Zero, because the government has already decided to build the library.", "Mistakes a decision already made for the absence of a cost; choices always have a forgone alternative."), ("The cost of maintaining the library after it opens.", "Describes a future operating cost instead of the value of the alternative given up."),
      ("The combined value of every project the city could have chosen.", "Adds all alternatives instead of using only the next-best one.")]),
    ("Which of the following statements about scarcity is correct?", "Even a wealthy economy faces scarcity because its resources are limited relative to wants.", "Scarcity exists whenever resources are limited relative to wants, regardless of how rich the economy is.",
     [("Scarcity exists only in poor economies.", "Believes wealth removes scarcity; wealthy economies also have limited resources and unlimited wants."), ("A good that is free to consumers is not scarce to society.", "Treats a zero price as a zero cost; resources used to make the good have alternative uses."),
      ("Efficient use of resources eliminates scarcity.", "Confuses efficiency with abundance; efficient allocation still leaves wants unsatisfied."), ("Scarcity affects the production of goods but not the use of time.", "Limits scarcity to goods; time is also a limited resource that must be allocated."),
      ("Scarcity disappears when the government provides a good.", "Assumes public provision creates resources; the resources used still have alternative uses.")]),
]


def ma_scarcity_concept(rng):
    q, kt, kw, wr = _v(rng, SCARCE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("ma_scarcity_concept", "1.1", "1.A", q, k, ds, rng, concept="scarcity and opportunity cost", path="fixed vetted definitions; each wrong sentence encodes one named confusion", facts=[f"variant={q[:30]}"], est=45, judgment="recall the definition and reject near-miss definitions")


FACTORS = [
    ("A farmer rents a field to a neighbor and receives a payment for its use.", "land", "rent", "labor", "wages"),
    ("A baker's employees receive payments for the hours they work.", "labor", "wages", "capital", "interest"),
    ("A firm lends money to buy machines, and the lender receives a payment for the use of the funds.", "capital", "interest", "land", "rent"),
    ("An entrepreneur starts a company, bears the risk of losses, and keeps what remains after paying all other costs.", "entrepreneurship", "profit", "labor", "wages"),
]
FPAY = {"land": "rent", "labor": "wages", "capital": "interest", "entrepreneurship": "profit"}


def ma_factors_payments(rng):
    desc, fac, pay, _, _ = _v(rng, FACTORS)
    others = [f for f in FPAY if f != fac]
    qt = rng.choice(["factor", "payment"])
    if qt == "factor":
        stem = f"Which factor of production is being used in the following situation? {desc}"
        k, ds = sent_opts(cap1(fac) + ".", f"The situation describes the use of {fac}, whose payment is {pay}.", [(cap1(o) + ".", f"Confuses {o} with {fac}; the payment in the situation is {pay}, which is the payment to {fac}.") for o in others] + [("Technology.", "Technology is knowledge that raises productivity, not one of the four factors of production.")])
    else:
        stem = f"Which payment goes to the owner of a factor of production in the following situation? {desc}"
        k, ds = sent_opts(cap1(pay) + ".", f"The owner of {fac} earns {pay}.", [(cap1(FPAY[o]) + ".", f"This is the payment to {o}, not to {fac}.") for o in others] + [("Dividends.", "Dividends are a share of profits paid to stockholders and are not the payment to this factor.")])
    return mk("ma_factors_payments", "1.1", "1.B", stem, k, ds, rng, concept="factors of production and their payments", path="fixed vetted factor-to-payment map; wrong options are the other factors or payments", facts=[f"factor={fac}", f"pay={pay}", f"mode={qt}"], est=45)


# ======================= 1.2 기회비용과 PPC =======================
def _ppc_pts(rng):
    caps = [0, 10, 20, 30, 40]
    top = rng.choice([100, 120, 140, 160])
    drops = rng.choice([[0, 5, 15, 35, 80], [0, 4, 12, 28, 60], [0, 5, 14, 30, 70]])
    drops = [d * top // 80 for d in drops]
    return [(c, top - d) for c, d in zip(caps, drops)]


@retry_sep
def ma_ppc_opp_cost(rng):
    pts = _ppc_pts(rng)
    i = rng.choice([1, 2, 3]); j = i + 1
    (c0, g0), (c1, g1) = pts[i], pts[j]
    dc, dg = c1 - c0, g0 - g1
    oc = Fr(dg, dc)
    agree(float(oc), float(-np.polyfit([c0, c1], [g0, g1], 1)[0]), 1e-9, "slope")
    stim = tbl("Production possibilities for an economy that produces only capital goods and consumer goods.", ["Capital goods", "Consumer goods"], [[str(c), str(g)] for c, g in pts])
    stem = f"The table shows points on an economy's production possibilities curve. Moving from the combination with {c0} capital goods to the combination with {c1} capital goods, what is the opportunity cost of each additional capital good, measured in consumer goods?"
    f = lambda v: nm(v, 2)  # noqa: E731
    k, ds = val_opts(float(oc), [("Divides the capital goods gained by the consumer goods lost, which inverts the ratio.", dc / dg), ("Reports the total consumer goods given up instead of the amount per capital good.", dg), ("Reports the consumer goods that remain after the move rather than the amount given up.", g1),
                                 ("Reports the number of capital goods gained instead of the ratio.", dc), ("Uses the slope from the first row to the last row instead of the two named combinations.", (pts[0][1] - pts[4][1]) / (pts[4][0] - pts[0][0]))], f)
    return mk("ma_ppc_opp_cost", "1.2", "1.C", stem, k, ds, rng, concept="opportunity cost along a PPC is consumer goods given up per capital good gained", path="exact ratio of changes vs numpy least-squares slope of the two points", stim=stim, kwhy=f"Consumer goods fall by {dg} while capital goods rise by {dc}, so each capital good costs {dg}/{dc} = {f(float(oc))} consumer goods.",
              facts=[f"pts={pts}", f"i={i}", f"oc={float(oc):.4f}"], est=70)


@retry_sep
def ma_ppc_graph_points(rng):
    top = rng.choice([60, 80, 100]); right = rng.choice([40, 50, 60])
    fn = lambda x: top * math.sqrt(max(0.0, 1 - (x / right) ** 2))  # noqa: E731
    on = right * rng.choice([0.4, 0.6]); inside = (on * 0.5, fn(on * 0.5) * 0.45); outside = (right * 0.8, top * 0.8)
    curve = dense_pts(fn, 0, right, 31)
    pts = [("A", round(on, 1), round(fn(on), 1)), ("B", round(inside[0], 1), round(inside[1], 1)), ("C", round(outside[0], 1), round(outside[1], 1))]
    pos = {lb: ("on" if abs(y - fn(x)) < 0.6 else "inside" if y < fn(x) else "outside") for lb, x, y in pts}
    agree(1, 1 if (pos["A"], pos["B"], pos["C"]) == ("on", "inside", "outside") else 0, 1e-9, "positions")
    stim = econ_graph("A production possibilities curve for an economy that makes two goods; points A, B, and C are marked.", [("PPC", curve)], right + 10, top + 20, 10, 20, points=pts, xlabel="Capital goods", ylabel="Consumer goods")
    stem = "The graph shows an economy's production possibilities curve (PPC) and three production combinations. Which of the following correctly describes the combinations?"
    k, ds = sent_opts("Point A is efficient and attainable, point B is attainable but inefficient, and point C is unattainable with current resources and technology.", "A lies on the curve (efficient), B inside it (unused or misallocated resources), and C outside it (unattainable).",
                      [("Point A is attainable but inefficient, point B is efficient, and point C is unattainable with current resources.", "Reverses efficient and inefficient points; points on the curve are efficient and points inside are not."), ("Points A and B are both efficient, and point C is attainable only with trade.", "Treats any attainable point as efficient and thinks trade moves production outside the curve."),
                       ("Point A is unattainable, point B is efficient, and point C is attainable but inefficient.", "Swaps the meaning of points outside and on the curve."), ("Point A is efficient, point B is unattainable, and point C is attainable but inefficient.", "Reads points inside the curve as unattainable and outside as attainable."),
                       ("Points A and C are efficient, and point B is unattainable with current resources.", "Treats points outside the PPC as efficient, ignoring the resource constraint.")])
    return mk("ma_ppc_graph_points", "1.2", "1.B", stem, k, ds, rng, concept="points on, inside, and outside a PPC", path="curve equation x^2/a^2+y^2/b^2=1 inequality test vs marker-to-curve vertical distance", stim=stim, facts=[f"pos={pos}", f"top={top}", f"right={right}"], est=60)


PPC_EVENTS = [("A technological advance doubles the output of capital goods that can be made with any given resources, but does not affect consumer goods.", "shifts outward at the capital goods intercept only"),
              ("A natural disaster destroys half of the economy's factories and machines.", "shifts inward on both axes"),
              ("A large increase in the number of workers moves into the economy.", "shifts outward on both axes"),
              ("An economy that has been using some resources inefficiently begins to use all of them efficiently.", "moves from a point inside the curve to a point on the curve")]


def ma_ppc_shift(rng):
    ev, ans = _v(rng, PPC_EVENTS)
    others = [e[1] for e in PPC_EVENTS if e[1] != ans] + ["shifts outward on the consumer goods axis only"]
    wh = {"shifts outward at the capital goods intercept only": "Assumes a technology that helps one good moves the other axis intercept as well.", "shifts inward on both axes": "Assumes any change to a single input removes capacity for both goods in this way.",
          "shifts outward on both axes": "Assumes any change makes the curve grow in both directions.", "moves from a point inside the curve to a point on the curve": "Confuses a movement to the curve with a shift of the curve itself.",
          "shifts outward on the consumer goods axis only": "Reverses which good the technology affects."}
    subj = lambda a: "The economy" if "moves" in a else "The PPC"  # noqa: E731
    k, ds = sent_opts(f"{subj(ans)} {ans}.", f"The event changes the economy's capacity accordingly: {ans}.", [(f"{subj(o)} {o}.", wh[o]) for o in others])
    return mk("ma_ppc_shift", "1.2", "3.A", f"Consider the following event: {ev} Which of the following best describes the effect on the economy's production possibilities?", k, ds, rng, concept="shifts of and movements along a PPC", path="fixed vetted event-effect table", facts=[f"event={ev[:30]}"], est=55)


def ma_ppc_shape(rng):
    shape = rng.choice(["bowed", "straight"])
    q = {"bowed": "An economy's production possibilities curve is bowed outward (concave to the origin). Which of the following is true?", "straight": "An economy's production possibilities curve is a straight line sloping downward. Which of the following is true?"}[shape]
    if shape == "bowed":
        k, ds = sent_opts("The opportunity cost of producing more of one good increases as more of that good is produced.", "A bowed-out PPC shows increasing opportunity costs because resources are not equally suited to both goods.",
                          [("The opportunity cost of producing more of one good is constant at every output level.", "Describes a straight-line PPC, not a bowed-out one."), ("The opportunity cost of producing more of one good decreases as more of that good is produced.", "Reverses the pattern; a bowed-out PPC has increasing, not decreasing, opportunity costs."),
                           ("The economy can produce any combination outside the curve if it trades.", "Confuses trade (consumption beyond the PPC) with the production possibilities themselves."), ("Resources are perfectly adaptable to the production of either good.", "Perfectly adaptable resources would give a straight line, not a bowed-out curve."),
                           ("There is no opportunity cost of moving along the curve.", "Believes there is no trade-off along the curve; every movement along a PPC gives up some of the other good.")])
    else:
        k, ds = sent_opts("The opportunity cost of producing more of one good is constant at every output level.", "A straight-line PPC shows a constant slope and therefore a constant opportunity cost.",
                          [("The opportunity cost of producing more of one good increases as more of that good is produced.", "Describes a bowed-out PPC, not a straight one."), ("There is no opportunity cost of moving along the curve.", "Believes there is no trade-off along the curve; every movement along a PPC gives up some of the other good."),
                           ("The economy is operating inefficiently at every point on the curve.", "Confuses a straight line with inefficiency; every point on the PPC is efficient."), ("Resources are so specialized that none can be used for the other good.", "Specialized resources produce a bowed-out PPC, not a constant-cost straight line."),
                           ("The curve must shift outward if the economy moves along it.", "Confuses a movement along the PPC with a shift of the curve.")])
    return mk("ma_ppc_shape", "1.2", "1.D", q, k, ds, rng, concept="straight versus bowed-out PPC and the opportunity cost it implies", path="fixed vetted statements by PPC shape", facts=[f"shape={shape}"], est=55)


# ======================= 1.3 비교우위 =======================
@retry_sep
def ma_comp_adv_table(rng):
    A = [rng.choice([20, 24, 30, 36, 40, 48]), rng.choice([10, 12, 15, 20, 24])]; B = [rng.choice([10, 12, 15, 20]), rng.choice([20, 24, 30, 36])]
    oa = Fr(A[1], A[0]); ob = Fr(B[1], B[0])
    if oa == ob:
        raise ValueError("not_enough_separated_distractors")
    who = "Country A" if oa < ob else "Country B"
    oya = Fr(A[0], A[1]); oyb = Fr(B[0], B[1])
    y_who = "Country A" if oya < oyb else "Country B"
    agree(1, 1 if y_who != who else 0, 1e-9, "opposite")
    g = rng.choice([("wheat", "cloth"), ("laptops", "bicycles"), ("corn", "soybeans")])
    stim = tbl("Maximum output per day of two goods when each country devotes all of its resources to one good.", ["Country", f"{g[0].capitalize()} (units)", f"{g[1].capitalize()} (units)"], [["Country A", A[0], A[1]], ["Country B", B[0], B[1]]])
    stem = f"The table shows how much {g[0]} or {g[1]} each country can produce in a day if it uses all of its resources for one good. Which of the following is correct?"
    other = "Country B" if who == "Country A" else "Country A"
    k, ds = sent_opts(f"{who} has the comparative advantage in {g[0]}, and {other} has the comparative advantage in {g[1]}.", f"The opportunity cost of {g[0]} is {float(oa):.2f} {g[1]} in Country A and {float(ob):.2f} in Country B, so {who} has the lower cost of {g[0]}.",
                      [(f"{who} has the comparative advantage in both goods.", "A country cannot have the comparative advantage in both goods because opportunity costs are reciprocal."), (f"{other} has the comparative advantage in {g[0]}, and {who} has the comparative advantage in {g[1]}.", "Reverses the opportunity-cost comparison."),
                       (f"{who} has the comparative advantage in {g[0]} only because it has the larger output of {g[0]}.", "Confuses absolute advantage (larger output) with comparative advantage (lower opportunity cost)."),
                       ("Neither country has a comparative advantage, so trade would not benefit them.", "Believes comparative advantage requires a difference in absolute output rather than in opportunity cost."),
                       (f"{other} has the comparative advantage in both goods because it has the higher output of {g[1]}.", "Uses one output number to claim an advantage in both goods.")])
    return mk("ma_comp_adv_table", "1.3", "1.C", stem, k, ds, rng, concept="comparative advantage from opportunity costs", path="exact ratios of outputs vs reciprocal opportunity cost of the other good", stim=stim, facts=[f"A={A}", f"B={B}", f"who={who}"], est=75)


@retry_sep
def ma_comp_adv_inputs(rng):
    """시간표: 한 단위 생산에 필요한 노동시간. 기회비용(다른 재화 단위)이 낮은 쪽이 비교우위."""
    a = [rng.choice([2, 3, 4, 6]), rng.choice([1, 2, 3, 4])]; b = [rng.choice([1, 2, 3, 4]), rng.choice([2, 3, 4, 6])]
    oa = Fr(a[0], a[1]); ob = Fr(b[0], b[1])  # 재화 1 의 기회비용(재화 2 단위) = 시간1/시간2
    if oa == ob:
        raise ValueError("not_enough_separated_distractors")
    low = "Country A" if oa < ob else "Country B"; high = "Country B" if low == "Country A" else "Country A"
    agree(1, 1 if sp.Rational(a[0], a[1]) < sp.Rational(b[0], b[1]) else 0, 1e-9, "order") if low == "Country A" else agree(1, 1 if sp.Rational(b[0], b[1]) < sp.Rational(a[0], a[1]) else 0, 1e-9, "order")
    g = rng.choice([("shirts", "bread"), ("chairs", "tables"), ("tea", "rice")])
    stim = tbl("Hours of labor needed to produce one unit of each good.", ["Country", f"Hours per unit of {g[0]}", f"Hours per unit of {g[1]}"], [["Country A", a[0], a[1]], ["Country B", b[0], b[1]]])
    stem = f"The table shows the hours of labor each country needs to produce one unit of {g[0]} or one unit of {g[1]}. Which country should specialize in producing {g[0]} to gain from trade?"
    k, ds = sent_opts(f"{low}, because it gives up fewer units of {g[1]} to produce a unit of {g[0]}.", f"The opportunity cost of one unit of {g[0]} is {a[0]}/{a[1]} = {float(oa):.2f} units of {g[1]} in Country A and {b[0]}/{b[1]} = {float(ob):.2f} in Country B.",
                      [(f"{high}, because it gives up fewer units of {g[1]} to produce a unit of {g[0]}.", "Reverses the opportunity-cost comparison."), (f"{high}, because it needs more hours to produce each good.", "Treats a larger labor requirement as an advantage; it indicates lower productivity."),
                       (f"The country that needs fewer hours per unit of {g[0]}, regardless of what it gives up of {g[1]}.", "Uses an absolute advantage (fewer hours) rather than a comparative advantage (lower opportunity cost)."),
                       ("Neither country, because the countries have the same opportunity costs.", "Claims no gain from trade although the opportunity costs of the two countries differ."), (f"Both countries should produce {g[0]} because each can produce it.", "Ignores that gains from trade come from specialization based on different opportunity costs.")])
    return mk("ma_comp_adv_inputs", "1.3", "3.A", stem, k, ds, rng, concept="specialization by comparative advantage from labor-hour requirements", path="exact ratio of hours vs sympy rational comparison", stim=stim, facts=[f"a={a}", f"b={b}", f"low={low}"], est=80)


@retry_sep
def ma_trade_terms(rng):
    a = rng.choice([1, 2, 3]); b = a + rng.choice([2, 3, 4])
    g = rng.choice([("tablets", "chairs"), ("wheat", "rice")])
    mid = Fr(a + b, 2)
    k_val = float(mid)
    assert a < mid < b
    agree(k_val, float((sp.Rational(a) + sp.Rational(b)) / 2), 1e-9, "mid")
    stem = f"In Country A the opportunity cost of producing one unit of {g[0]} is {a} {'unit' if a == 1 else 'units'} of {g[1]}. In Country B the opportunity cost of producing one unit of {g[0]} is {b} units of {g[1]}. Which of the following terms of trade, in units of {g[1]} per unit of {g[0]}, would make both countries better off if Country A exports {g[0]} to Country B?"
    f = lambda v: f"{nm(v, 2)} {'unit' if abs(v - 1) < 1e-9 else 'units'} of {g[1]} per unit of {g[0]}"  # noqa: E731
    k, ds = val_opts(k_val, [("Sets the price equal to Country A's opportunity cost, so Country A gains nothing from trading.", a), ("Sets the price equal to Country B's opportunity cost, so Country B gains nothing from trading.", b),
                             ("Sets the price below Country A's opportunity cost, so Country A would lose by exporting.", a - 0.5 if a - 0.5 > 0 else a / 2), ("Sets the price above Country B's opportunity cost, so Country B would lose by importing.", b + 0.5 + (b - a) / 4),
                             ("Adds the two opportunity costs instead of choosing a value between them.", a + b), ("Multiplies the two opportunity costs instead of choosing a value between them.", a * b)], f)
    return mk("ma_trade_terms", "1.3", "3.C", stem, k, ds, rng, concept="mutually beneficial terms of trade lie between the two opportunity costs", path="interval test a < terms < b vs symbolic midpoint inside the interval", kwhy=f"Terms must lie strictly between {a} and {b} units of {g[1]}; {nm(k_val, 2)} does.", facts=[f"a={a}", f"b={b}"], est=70)


# ======================= 1.4 / 1.5 수요·공급 결정요인 =======================
DEM = [
    ("Consumers' incomes rise, and the good is a normal good.", "D+", "A rise in income increases the demand for a normal good at every price."),
    ("Consumers' incomes rise, and the good is an inferior good.", "D-", "A rise in income decreases the demand for an inferior good at every price."),
    ("The price of a substitute good rises.", "D+", "Buyers switch toward this good, increasing its demand at every price."),
    ("The price of a complementary good falls.", "D+", "Cheaper complements make the pair more attractive, increasing demand for this good at every price."),
    ("The price of a complementary good rises.", "D-", "Costlier complements reduce the demand for this good at every price."),
    ("Consumers expect the price of the good to be higher next month.", "D+", "Expecting a higher future price raises current demand as buyers purchase earlier."),
    ("A change in tastes makes the good less popular.", "D-", "Weaker preferences reduce demand at every price."),
    ("The number of buyers in the market increases.", "D+", "More buyers raise market demand at every price."),
    ("The price of the good itself falls.", "Qd", "A change in the good's own price moves the market along the demand curve and changes the quantity demanded."),
]
SUP = [
    ("The price of an input used to produce the good falls.", "S+", "Lower production costs increase supply at every price."),
    ("The price of an input used to produce the good rises.", "S-", "Higher production costs decrease supply at every price."),
    ("A new technology lowers the cost of producing the good.", "S+", "Lower unit costs increase supply at every price."),
    ("The number of firms producing the good increases.", "S+", "More sellers increase market supply at every price."),
    ("The government imposes a per-unit tax on producers of the good.", "S-", "A tax raises the cost of selling each unit and decreases supply."),
    ("A natural disaster destroys some of the producers' capacity.", "S-", "Less capacity decreases supply at every price."),
    ("The price of the good itself rises.", "Qs", "A change in the good's own price moves the market along the supply curve and changes the quantity supplied."),
]
STMT = {
    "D+": "The demand curve shifts to the right.", "D-": "The demand curve shifts to the left.", "S+": "The supply curve shifts to the right.", "S-": "The supply curve shifts to the left.",
    "Qd": "The quantity demanded changes along an unchanged demand curve.", "Qs": "The quantity supplied changes along an unchanged supply curve.",
}
STMT_WHY = {
    "D+": "Shifts demand to the right although the event does not raise the quantity buyers want at each price.", "D-": "Shifts demand to the left although the event does not lower the quantity buyers want at each price.",
    "S+": "Shifts supply to the right although the event does not lower sellers' costs or add sellers.", "S-": "Shifts supply to the left although the event does not raise sellers' costs or remove sellers.",
    "Qd": "Treats a determinant of demand as a movement along the demand curve, which only a change in the good's own price causes.", "Qs": "Treats a determinant of supply as a movement along the supply curve, which only a change in the good's own price causes.",
}


def _shift_item(rng, arch, topic, table, side):
    ev, ans, mech = _v(rng, table)
    same = ["D+", "D-", "Qd"] if side == "D" else ["S+", "S-", "Qs"]
    opp = ["S+", "S-"] if side == "D" else ["D+", "D-"]
    cand = [c for c in same if c != ans] + opp
    why = {
        "D+": "Predicts a rightward shift of demand, which this event does not cause.", "D-": "Predicts a leftward shift of demand, which this event does not cause.",
        "Qd": "Predicts only a movement along the demand curve, although this event moves the whole curve (only the good's own price causes a movement along it).",
        "S+": "Predicts a rightward shift of supply, but the event does not change sellers' costs, technology, taxes, or the number of sellers.", "S-": "Predicts a leftward shift of supply, but the event does not change sellers' costs, technology, taxes, or the number of sellers.",
        "Qs": "Predicts only a movement along the supply curve, although this event moves the whole curve (only the good's own price causes a movement along it).",
    }
    if side == "S":
        why["D+"] = "Predicts a rightward shift of demand, but the event does not change buyers' incomes, tastes, expectations, related-good prices, or numbers."
        why["D-"] = "Predicts a leftward shift of demand, but the event does not change buyers' incomes, tastes, expectations, related-good prices, or numbers."
    if ans in ("Qd", "Qs"):
        why["Qd"] = why["Qd"].replace("although this event moves the whole curve", "although").replace("(only the good's own price causes a movement along it)", "the good's own price changes")
    k, ds = sent_opts(STMT[ans], mech, [(STMT[c], why[c]) for c in cand])
    mkt = rng.choice(["the market for frozen pizza", "the market for bicycles", "the market for coffee", "the market for notebooks"])
    stem = f"In {mkt}, consider the following event: {ev} Which of the following is the result, holding other factors constant?"
    return mk(arch, topic, "1.B", stem, k, ds, rng, concept="determinants shift demand or supply; the good's own price moves along the curve", path="fixed vetted event-effect table; wrong options are the other curve/direction statements", facts=[f"event={ev[:40]}", f"ans={ans}"], est=55)


def ma_demand_shift(rng):
    return _shift_item(rng, "ma_demand_shift", "1.4", DEM, "D")


def ma_supply_shift(rng):
    return _shift_item(rng, "ma_supply_shift", "1.5", SUP, "S")


def ma_movement_vs_shift(rng):
    price_of_what = rng.choice(["frozen pizza", "bicycles", "coffee"])
    kind = rng.choice(["qd", "demand"])
    if kind == "qd":
        stem = f"The price of {price_of_what} falls and no other factor changes. Which of the following correctly describes the effect on the market for {price_of_what}?"
        k, ds = sent_opts("There is an increase in the quantity demanded, which is a movement down along the demand curve.", "A change in the good's own price moves the market along an unchanged demand curve.",
                          [("There is an increase in demand, which shifts the demand curve to the right.", "Confuses a change in quantity demanded with a change in demand; only determinants other than the good's own price shift the curve."), ("There is a decrease in demand, which shifts the demand curve to the left.", "Predicts a leftward shift although a lower price does not decrease demand."),
                           ("There is a decrease in the quantity demanded, which is a movement up along the demand curve.", "Reverses the law of demand; a lower price raises the quantity demanded."), ("There is an increase in supply, which shifts the supply curve to the right.", "Treats a price change as a determinant of supply."),
                           ("There is no change in the quantity demanded because the demand curve does not shift.", "Believes the quantity demanded changes only when the curve shifts.")])
    else:
        stem = f"Consumers' incomes rise, and {price_of_what} is a normal good. Which of the following correctly describes the effect on the market for {price_of_what}, holding other factors constant?"
        k, ds = sent_opts("Demand increases, which shifts the demand curve to the right.", "Higher income increases the demand for a normal good at every price.",
                          [("The quantity demanded increases, which is a movement along an unchanged demand curve.", "Confuses a shift caused by income with a movement along the curve caused by the good's own price."), ("Demand decreases, which shifts the demand curve to the left.", "Treats a normal good as an inferior good."),
                           ("Supply increases, which shifts the supply curve to the right.", "Treats a change in buyers' income as a determinant of supply."), ("The quantity supplied decreases, which is a movement down along the supply curve.", "Predicts a fall in the quantity supplied although higher demand raises the price and the quantity supplied."),
                           ("Neither curve shifts, because income does not change the price of the good.", "Believes only the good's own price affects demand.")])
    return mk("ma_movement_vs_shift", "1.4", "1.D", stem, k, ds, rng, concept="change in quantity demanded versus change in demand", path="fixed vetted statements keyed to the cause", facts=[f"kind={kind}", f"good={price_of_what}"], est=60)


# ======================= 1.6 균형 =======================
@retry_sep
def ma_shortage_numeric(rng):
    m = new_mkt(rng, 20, 60, 20, 80)
    P1 = m.P0 + rng.choice([-1, 1]) * rng.choice([5, 10])
    if P1 <= m.C or m.pd(0) <= P1 or P1 <= 0:
        raise ValueError("not_enough_separated_distractors")
    qd, qs = m.qd(P1), m.qs(P1)
    diff = abs(qd - qs)
    if diff == 0 or qd < 0 or qs < 0:
        raise ValueError("not_enough_separated_distractors")
    kind = "shortage" if P1 < m.P0 else "surplus"
    q2, p2 = eq_sympy(m)
    agree(float(q2), m.Q0, 1e-9, "eq")
    agree(float(diff), abs(float(sp.Rational(m.A - P1) / sp.Rational(m.B.numerator, m.B.denominator)) - float(sp.Rational(P1 - m.C) / sp.Rational(m.D.numerator, m.D.denominator))), 1e-9, "gap")
    prices = sorted({P1, m.P0, m.P0 + 10 if m.pd(0) > m.P0 + 10 else m.P0 - 10, 2 * m.P0 - P1})
    prices = [p for p in prices if m.qd(p) >= 0 and m.qs(p) >= 0 and p > 0]
    if P1 not in prices or m.P0 not in prices:
        raise ValueError("not_enough_separated_distractors")
    rows = [[usd(p), nm(float(m.qd(p)), 1), nm(float(m.qs(p)), 1)] for p in prices]
    g = rng.choice(["bicycles", "concert tickets", "notebooks", "umbrellas"])
    stim = tbl(f"Quantity demanded and quantity supplied of {g} in a competitive market at different prices.", ["Price", "Quantity demanded", "Quantity supplied"], rows)
    stem = f"The table shows the quantity demanded and the quantity supplied of {g}. At a price of {usd(P1)}, the market has a {kind} of how many units?"
    f = lambda v: nm(v, 1)  # noqa: E731
    k, ds = val_opts(float(diff), [("Reports the equilibrium quantity instead of the size of the gap.", m.Q0), (f"Reports the quantity {'demanded' if kind == 'shortage' else 'supplied'} at the price instead of the gap.", float(qd if kind == 'shortage' else qs)), (f"Reports the quantity {'supplied' if kind == 'shortage' else 'demanded'} at the price instead of the gap.", float(qs if kind == 'shortage' else qd)),
                                   ("Adds the two quantities instead of subtracting.", float(qd + qs)), ("Reports the difference between the price and the equilibrium price.", abs(P1 - m.P0))], f)
    return mk("ma_shortage_numeric", "1.6", "3.C", stem, k, ds, rng, concept="shortage or surplus is the gap between quantities demanded and supplied at a given price", path="exact fractions vs sympy solution of the equilibrium and gap", stim=stim, kwhy=f"At {usd(P1)} quantity demanded is {f(float(qd))} and quantity supplied is {f(float(qs))}, a {kind} of {f(float(diff))} units.",
              facts=[f"A={m.A}", f"B={float(m.B)}", f"C={m.C}", f"D={float(m.D)}", f"P1={P1}", f"gap={float(diff)}", f"kind={kind}"], est=75)


def ma_double_shift(rng):
    ds_, ss_ = rng.choice([(1, 1), (-1, -1), (1, -1), (-1, 1)])
    P, Q = eq_effect_rule(ds_, ss_)
    s = eq_effect_sim(ds_, ss_)
    if (P, Q) != s:
        raise ValueError("rule_sim_mismatch")
    g = rng.choice(["the market for solar panels", "the market for bicycles", "the market for laptops"])
    dtxt = {1: "increases", -1: "decreases"}[ds_]; stxt = {1: "increases", -1: "decreases"}[ss_]
    stem = f"In {g}, demand {dtxt} and supply {stxt} at the same time. Which of the following describes the effect on the equilibrium price and quantity?"
    ans = combo_text(P, Q)
    # 오답: 가능한 방향 조합 중 정답이 아닌 것
    opts = [(combo_text(p, q), p, q) for p in (1, -1, None) for q in (1, -1, None) if (p, q) != (P, Q)]
    rng.shuffle(opts)
    wr = []
    for t, p, q in opts[:4]:
        if p is None and P is not None:
            w = "Calls the price effect indeterminate although the two shifts push the price in the same direction." if True else ""
        elif q is None and Q is not None:
            w = "Calls the quantity effect indeterminate although the two shifts push the quantity in the same direction."
        elif p is not None and P is None:
            w = "Claims a definite price effect although the two shifts push the price in opposite directions and their sizes are not given."
        elif q is not None and Q is None:
            w = "Claims a definite quantity effect although the two shifts push the quantity in opposite directions and their sizes are not given."
        else:
            w = f"Gets the direction of the {'price' if p != P else 'quantity'} change backward; demand and supply shifts must be combined using the direction of each shift."
        wr.append((t, f"{w} (Predicted: price {dir_word(p)}, quantity {dir_word(q)}.)"))
    k, d = sent_opts(ans, f"With demand {dtxt} and supply {stxt}, the price {dir_word(P)} and the quantity {dir_word(Q)} without information on the shift sizes.", wr)
    return mk("ma_double_shift", "1.6", "3.A", stem, k, d, rng, concept="simultaneous demand and supply shifts: determinate versus indeterminate", path="direction rule table vs numeric simulation of linear markets with three shift-size regimes", facts=[f"ds={ds_}", f"ss={ss_}", f"P={P}", f"Q={Q}"], est=65)


def ma_market_graph_shift(rng):
    m = new_mkt(rng, 30, 60, 30, 60)
    which = rng.choice(["demand", "supply"]); sg = rng.choice([1, -1])
    shift = 20 * sg
    dA = shift if which == "demand" else 0
    dC = -shift if which == "supply" else 0
    q1, p1 = mkt_check(m, dA=dA, dC=dC)
    q0, p0 = mkt_check(m)
    Pdir, Qdir = _sg(p1 - p0), _sg(q1 - q0)
    ev = rng.choice(["the market for hiking boots", "the market for tablets", "the market for olive oil"])
    d1 = line_pts(m.A, -m.B, 0, m.A / m.B); d2 = line_pts(m.A + dA, -m.B, 0, (m.A + dA) / m.B); s1 = line_pts(m.C, m.D, 0, 80); s2 = line_pts(m.C + dC, m.D, 0, 80)
    xhi = 100; yhi = int(max(m.A, m.A + dA)) + 10
    curves = [("D1", d1), ("S1", s1)] + ([("D2", d2)] if which == "demand" else [("S2", s2)])
    pts = [("E1", m.Q0, m.P0), ("E2", float(q1), float(p1))]
    stim = econ_graph(f"Supply and demand in {ev}; the market moves from equilibrium E1 to equilibrium E2 after one curve shifts.", curves, xhi, yhi, 10, 20, points=pts)
    stem = f"The graph shows {ev}. The market moves from equilibrium E1 to equilibrium E2. Which of the following events could have caused the change?"
    causes = {("demand", 1): ("Consumers' incomes rise and the good is a normal good.", "D+"), ("demand", -1): ("The price of a complementary good rises.", "D-"), ("supply", 1): ("A new technology lowers the cost of producing the good.", "S+"), ("supply", -1): ("The price of an input used to produce the good rises.", "S-")}
    kt, _ = causes[(which, sg)]
    wr = [causes[c][0] for c in causes if c != (which, sg)] + ["The price of the good itself falls."]
    why = {"D+": "Would shift demand to the right, but the graph shows the other curve shifting.", "D-": "Would shift demand to the left, but the graph shows the other curve shifting.", "S+": "Would shift supply to the right, but the graph shows the other curve shifting.", "S-": "Would shift supply to the left, but the graph shows the other curve shifting."}
    wlist = []
    for c in causes:
        if c == (which, sg):
            continue
        t, tag = causes[c]
        same_curve = c[0] == which
        wlist.append((t, ("Shifts the " + which + " curve, but in the opposite direction from the graph; the graph shows the curve moving " + ("right" if sg == 1 else "left") + ".") if same_curve else (f"Shifts the {c[0]} curve to the {'right' if c[1] == 1 else 'left'}, but the graph shows the {which} curve moving, not the {c[0]} curve.")))
    wlist.append(("The price of the good itself falls.", "A change in the good's own price moves along a curve; it does not shift a curve."))
    k, d = sent_opts(kt, f"The graph shows the {which} curve shifting to the {'right' if sg == 1 else 'left'}: {kt}", wlist)
    return mk("ma_market_graph_shift", "1.6", "3.A", stem, k, d, rng, concept="read which curve shifted and in which direction from a supply-demand graph", path="equilibrium recomputed exactly and by sympy; shifted curve and direction encoded in the graph", stim=stim,
              facts=[f"which={which}", f"sg={sg}", f"P0={m.P0}", f"Q0={m.Q0}", f"Pdir={Pdir}", f"Qdir={Qdir}"], est=75)
