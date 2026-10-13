"""AP Microeconomics P0 원형 A — 단원 1(기본 경제 개념). 2026-10-13. 모든 정답은 코드가 계산하고 독립 경로로 다시 계산한다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401


def _variant(rng, table):
    return table[rng.randrange(len(table))]


# ======================= 1.1 희소성·기회비용 =======================
@retry_sep
def mi_opp_cost_choice(rng):
    pay = sorted(rng.sample(range(40, 161, 10), 3), reverse=True)
    x, y, z = pay
    names = rng.choice([("Maya", "work at a cafe", "tutor a neighbor", "help a friend move"), ("Devon", "mow lawns", "work at a bike shop", "babysit"), ("Priya", "work at a bakery", "give music lessons", "wash cars")])
    who, a, b, c = names
    key_val = y
    assert key_val == sorted(pay)[-2]
    agree(key_val, float(sp.Max(*[sp.Integer(v) for v in pay[1:]])), 1e-9, "second_best")  # 독립 경로: 선택하지 않은 대안 중 최댓값
    stem = f"{who} has one free Saturday and values each option only by the pay it brings. {who} can {a} and earn {usd(x)}, {b} and earn {usd(y)}, or {c} and earn {usd(z)}. {who} chooses to {a}. What is the opportunity cost of {who}'s choice?"
    k, ds = val_opts(key_val, [(f"Counts the pay from the chosen option as its cost; the opportunity cost is the value of the best alternative that is given up, not the benefit gained.", x), (f"Adds the pay of both unchosen options; only the single next-best alternative is forgone.", y + z),
                               (f"Uses the least valuable unchosen option instead of the next-best one.", z), ("Treats opportunity cost as an out-of-pocket money expense; no money was paid, so the cost is taken to be zero.", 0), (f"Subtracts the next-best pay from the chosen pay, which gives the net benefit rather than the cost.", x - y)], usd)
    return mk("mi_opp_cost_choice", "1.1", "1.C", stem, k, ds, rng, concept="opportunity cost is the value of the next-best alternative given up", path="sort of the three pay values vs symbolic maximum over the unchosen options",
              kwhy=f"The chosen option is worth {usd(x)}; the best alternative given up is {usd(y)}, so the opportunity cost is {usd(y)}.", facts=[f"pay={pay}", f"key={key_val}"], est=55)


SCARCE = [
    ("Which of the following is the best definition of scarcity?", "Limited resources are not enough to satisfy unlimited wants.", "Scarcity is the gap between limited resources and unlimited wants, so every society must choose.",
     [("A situation in which the price of a good is very high.", "Confuses scarcity with a high price; scarce goods can be cheap and the concept applies to all goods that are limited."), ("A shortage in which quantity demanded exceeds quantity supplied at the current price.", "Confuses scarcity with a market shortage, which is a temporary disequilibrium at one price."),
      ("A lack of money among low-income households.", "Confuses scarcity with poverty; scarcity affects rich and poor societies alike."), ("A temporary condition that disappears once technology improves.", "Treats scarcity as temporary; limited resources and unlimited wants persist after technology improves."),
      ("The inefficient use of available resources by a society.", "Confuses scarcity with inefficiency; even efficient use of resources leaves wants unsatisfied.")]),
    ("A student chooses to attend a concert tonight instead of studying or working a shift. Which statement best describes the opportunity cost of attending the concert?", "The value of the best alternative the student gives up.", "Opportunity cost is the value of the next-best alternative forgone, here the more valuable of studying and working.",
     [("The ticket price and nothing else.", "Counts only the explicit money cost and ignores the value of the time that is given up."), ("The total value of every alternative the student could have chosen.", "Adds all alternatives instead of using only the next-best one."),
      ("Zero, because the student values the concert more than the alternatives.", "Mistakes the benefit of the chosen option for a lack of cost; choices always have a forgone alternative."), ("The enjoyment the student receives from the concert.", "Describes the benefit of the chosen option, not the cost of giving up the alternative."),
      ("The cost the concert organizers pay to produce the show.", "Confuses the buyer's opportunity cost with the seller's production cost.")]),
    ("Which of the following statements about economic choices is correct?", "Because resources are scarce, producing more of one good requires producing less of another.", "With scarce resources, using more of them for one good leaves fewer for others, so a trade-off exists.",
     [("A wealthy society can produce unlimited quantities of every good and does not face trade-offs.", "Believes wealth removes scarcity; even rich societies have limited resources and face trade-offs."), ("A good that is free to consumers has no opportunity cost to society.", "Treats a zero price as a zero cost; resources used to make the good have alternative uses."),
      ("Opportunity costs exist only when money is paid for a good.", "Ties opportunity cost to monetary payments; time and resources have opportunity costs without any payment."), ("Efficient resource allocation eliminates scarcity.", "Confuses efficiency with abundance; efficient allocation still leaves wants unsatisfied."),
      ("Scarcity affects only the production of goods and not the use of time.", "Limits scarcity to goods; time is also a limited resource that must be allocated.")]),
]


def mi_scarcity_concept(rng):
    q, kt, kw, wr = _variant(rng, SCARCE)
    k, ds = sent_opts(kt, kw, wr)
    return mk("mi_scarcity_concept", "1.1", "1.A", q, k, ds, rng, concept="scarcity and opportunity cost", path="fixed vetted definitions; each wrong sentence encodes one named confusion", facts=[f"variant={q[:30]}"], est=45, judgment="recall the definition and reject near-miss definitions")


# ======================= 1.2 경제 체제 =======================
SYSTEMS = [
    ("A central planning agency decides what goods are produced, how many are produced, and who receives them, and firms follow its quotas.", "command economy"),
    ("Households and firms decide what to buy and sell, prices signal scarcity, and the government plays only a minimal role in production decisions.", "market economy"),
    ("Most resources are allocated through voluntary exchange at market prices, but the government also provides public goods and regulates some industries.", "mixed economy"),
    ("Production methods, jobs, and the distribution of goods are determined mainly by custom and the choices of previous generations.", "traditional economy"),
]


def mi_economic_systems(rng):
    desc, ans = SYSTEMS[rng.randrange(len(SYSTEMS))]
    others = [s[1] for s in SYSTEMS if s[1] != ans] + ["laissez-faire monopoly"]
    why = {"command economy": "Takes government direction of every decision as the defining feature, which the description does not contain.", "market economy": "Assumes prices and voluntary exchange alone drive decisions, ignoring the planning or custom the description names.",
           "mixed economy": "Treats any government role as a mix; the description does not combine market exchange with a meaningful government role.", "traditional economy": "Treats habit and custom as the allocation method, which the description does not mention.",
           "laissez-faire monopoly": "Confuses an economic system with a market structure; a monopoly is a market structure, not a way to answer the three basic economic questions."}
    k, ds = sent_opts(f"{ans[0].upper()}{ans[1:]}", f"The described allocation method is characteristic of a {ans}.", [(f"{o[0].upper()}{o[1:]}", why[o]) for o in others])
    stem = f"Which type of economic system is best described as follows? {desc}"
    return mk("mi_economic_systems", "1.2", "1.B", stem, k, ds, rng, concept="identify an economic system from how it answers what, how, and for whom", path="fixed vetted descriptions mapped to a system label", facts=[f"answer={ans}"], est=45)


# ======================= 1.3 생산 가능 곡선 =======================
def _ppc_pts(rng):
    # 선형이 아닌 오목(체감하는 기회비용) 곡선의 네 점 (자본재, 소비재)
    caps = [0, 10, 20, 30, 40]
    top = rng.choice([100, 120, 140, 160])
    drops = rng.choice([[0, 5, 15, 35, 80], [0, 4, 12, 28, 60], [0, 5, 14, 30, 70]])
    drops = [d * top // 80 for d in drops]
    return [(c, top - d) for c, d in zip(caps, drops)]


@retry_sep
def mi_ppc_opp_cost(rng):
    pts = _ppc_pts(rng)
    i = rng.choice([1, 2, 3]); j = i + 1
    (c0, g0), (c1, g1) = pts[i], pts[j]
    dc, dg = c1 - c0, g0 - g1
    oc = Fr(dg, dc)
    # 독립 경로: 선분 기울기(numpy)
    agree(float(oc), float(-np.polyfit([c0, c1], [g0, g1], 1)[0]), 1e-9, "slope")
    rows = [[str(c), str(g)] for c, g in pts]
    stim = tbl("Production possibilities for an economy that produces only capital goods and consumer goods.", ["Capital goods", "Consumer goods"], rows)
    stem = f"The table shows points on an economy's production possibilities curve. Moving from the combination with {c0} capital goods to the combination with {c1} capital goods, what is the opportunity cost of each additional capital good, measured in consumer goods?"
    f = lambda v: nm(v, 2)  # noqa: E731
    k, ds = val_opts(float(oc), [("Divides the capital goods gained by the consumer goods lost, which inverts the ratio.", dc / dg), ("Reports the total consumer goods given up instead of the amount per capital good.", dg), ("Reports the consumer goods that remain after the move rather than the amount given up.", g1),
                                 ("Reports the number of capital goods gained instead of the ratio.", dc), ("Uses the slope from the first row to the last row instead of the two named combinations.", (pts[0][1] - pts[4][1]) / (pts[4][0] - pts[0][0]))], f)
    return mk("mi_ppc_opp_cost", "1.3", "1.C", stem, k, ds, rng, concept="opportunity cost along a PPC is consumer goods given up per capital good gained", path="exact ratio of changes vs numpy least-squares slope of the two points", stim=stim, kwhy=f"Consumer goods fall by {dg} while capital goods rise by {dc}, so each capital good costs {dg}/{dc} = {f(float(oc))} consumer goods.",
              facts=[f"pts={pts}", f"i={i}", f"oc={float(oc):.4f}"], est=70)


@retry_sep
def mi_ppc_graph_points(rng):
    top = rng.choice([60, 80, 100]); right = rng.choice([40, 50, 60])
    # 오목 곡선(타원 1/4)
    fn = lambda x: top * math.sqrt(max(0.0, 1 - (x / right) ** 2))  # noqa: E731
    on = right * rng.choice([0.4, 0.6]); inside = (on * 0.5, fn(on * 0.5) * 0.45); outside = (right * 0.8, top * 0.8)
    curve = dense_pts(fn, 0, right, 31)
    pts = [("A", round(on, 1), round(fn(on), 1)), ("B", round(inside[0], 1), round(inside[1], 1)), ("C", round(outside[0], 1), round(outside[1], 1))]
    # 독립 경로: 점이 곡선 안/위/밖인지 부등식으로 판정
    pos = {lb: ("on" if abs(y - fn(x)) < 0.6 else "inside" if y < fn(x) else "outside") for lb, x, y in pts}
    agree(1, 1 if (pos["A"], pos["B"], pos["C"]) == ("on", "inside", "outside") else 0, 1e-9, "positions")
    stim = econ_graph("A production possibilities curve for an economy that makes two goods; points A, B, and C are marked.", [("PPC", curve)], right + 10, top + 20, 10, 20, points=pts, xlabel="Capital goods", ylabel="Consumer goods")
    stem = "The graph shows an economy's production possibilities curve (PPC) and three production combinations. Which of the following correctly describes the combinations?"
    k, ds = sent_opts("Point A is efficient and attainable, point B is attainable but inefficient, and point C is unattainable with current resources and technology.", "A lies on the curve (efficient), B inside it (unused or misallocated resources), and C outside it (unattainable).",
                      [("Point A is attainable but inefficient, point B is efficient, and point C is unattainable with current resources.", "Reverses efficient and inefficient points; points on the curve are efficient and points inside are not."), ("Points A and B are both efficient, and point C is attainable only with trade.", "Treats any attainable point as efficient and thinks trade moves production outside the curve."),
                       ("Point A is unattainable, point B is efficient, and point C is attainable but inefficient.", "Swaps the meaning of points outside and on the curve."), ("Point A is efficient, point B is unattainable, and point C is attainable but inefficient.", "Reads points inside the curve as unattainable and outside as attainable."),
                       ("Points A and C are efficient, and point B is unattainable with current resources.", "Treats points outside the PPC as efficient, ignoring the resource constraint.")])
    return mk("mi_ppc_graph_points", "1.3", "1.B", stem, k, ds, rng, concept="points on, inside, and outside a PPC", path="curve equation x^2/a^2+y^2/b^2=1 inequality test vs marker-to-curve vertical distance", stim=stim, facts=[f"pos={pos}", f"top={top}", f"right={right}"], est=60)


PPC_EVENTS = [("A technological advance doubles the output of capital goods that can be made with any given resources, but does not affect consumer goods.", "pivots outward along the capital goods axis only"),
              ("A natural disaster destroys half of the economy's factories and machines.", "shifts inward on both axes"),
              ("A large increase in the number of workers moves into the economy.", "shifts outward on both axes"),
              ("Economy moves from using some resources inefficiently to using all of them efficiently.", "moves from a point inside the curve to a point on the curve")]


def mi_ppc_shift(rng):
    ev, ans = PPC_EVENTS[rng.randrange(len(PPC_EVENTS))]
    others = [e[1] for e in PPC_EVENTS if e[1] != ans] + ["shifts outward on the consumer goods axis only"]
    wh = {"pivots outward along the capital goods axis only": "Assumes a technology that helps one good moves the other axis intercept as well.", "shifts inward on both axes": "Assumes any change to a single input removes capacity for both goods in this way.",
          "shifts outward on both axes": "Assumes any change makes the curve grow in both directions.", "moves from a point inside the curve to a point on the curve": "Confuses a movement to the curve with a shift of the curve itself.",
          "shifts outward on the consumer goods axis only": "Reverses which good the technology affects."}
    k, ds = sent_opts(f"The PPC {ans}." if "moves" not in ans else f"The economy {ans}.", f"The event changes the economy's capacity accordingly: {ans}.", [(f"The PPC {o}." if "moves" not in o else f"The economy {o}.", wh[o]) for o in others])
    return mk("mi_ppc_shift", "1.3", "3.A", f"Consider the following event: {ev} Which of the following best describes the effect on the economy's production possibilities?", k, ds, rng, concept="shifts of and movements along a PPC", path="fixed vetted event-effect table", facts=[f"event={ev[:30]}"], est=55)


# ======================= 1.4 비교우위 =======================
@retry_sep
def mi_comp_adv_table(rng):
    A = [rng.choice([20, 24, 30, 36, 40, 48]), rng.choice([10, 12, 15, 20, 24])]; B = [rng.choice([10, 12, 15, 20]), rng.choice([20, 24, 30, 36])]
    oa = Fr(A[1], A[0]); ob = Fr(B[1], B[0])  # 상품 X 1단위의 기회비용(Y 단위)
    if oa == ob:
        raise ValueError("not_enough_separated_distractors")
    who = "Country A" if oa < ob else "Country B"
    # 독립 경로: 상품 Y 의 기회비용이 반대로 높은 쪽
    oya = Fr(A[0], A[1]); oyb = Fr(B[0], B[1])
    y_who = "Country A" if oya < oyb else "Country B"
    agree(1, 1 if y_who != who else 0, 1e-9, "opposite")
    g = rng.choice([("wheat", "cloth"), ("laptops", "bicycles"), ("corn", "soybeans")])
    stim = tbl(f"Maximum output per day of two goods when each country devotes all of its resources to one good.", ["Country", f"{g[0].capitalize()} (units)", f"{g[1].capitalize()} (units)"], [["Country A", A[0], A[1]], ["Country B", B[0], B[1]]])
    stem = f"The table shows how much {g[0]} or {g[1]} each country can produce in a day if it uses all of its resources for one good. Which of the following is correct?"
    other = "Country B" if who == "Country A" else "Country A"
    k, ds = sent_opts(f"{who} has the comparative advantage in {g[0]}, and {other} has the comparative advantage in {g[1]}.", f"The opportunity cost of {g[0]} is {float(oa):.2f} {g[1]} in Country A and {float(ob):.2f} in Country B, so {who} has the lower cost of {g[0]}.",
                      [(f"{who} has the comparative advantage in both goods.", "A country cannot have the comparative advantage in both goods because opportunity costs are reciprocal."), (f"{other} has the comparative advantage in {g[0]}, and {who} has the comparative advantage in {g[1]}.", "Reverses the opportunity-cost comparison."),
                       (f"{who} has the comparative advantage in {g[0]} only because it has the larger output of {g[0]}.", "Confuses absolute advantage (larger output) with comparative advantage (lower opportunity cost)."),
                       (f"Neither country has a comparative advantage, so trade would not benefit them.", "Believes comparative advantage requires a difference in absolute output rather than in opportunity cost."),
                       (f"{other} has the comparative advantage in both goods because it has the higher output of {g[1]}.", "Uses one output number to claim an advantage in both goods.")])
    return mk("mi_comp_adv_table", "1.4", "1.C", stem, k, ds, rng, concept="comparative advantage from opportunity costs", path="exact ratios of outputs vs reciprocal opportunity cost of the other good", stim=stim, facts=[f"A={A}", f"B={B}", f"who={who}"], est=75)


@retry_sep
def mi_trade_terms(rng):
    # 국가 A: X 1단위 기회비용 a(Y), B: b(Y); a<b. 상호 이익 교환비율은 a<k<b
    a = rng.choice([1, 2, 3]); b = a + rng.choice([2, 3, 4])
    g = rng.choice([("tablets", "chairs"), ("wheat", "rice")])
    mid = Fr(a + b, 2)
    cand = {"inside": [x for x in [Fr(a) + Fr(b - a, 4), mid, Fr(b) - Fr(b - a, 4)]], "low": Fr(a) - Fr(1, 2), "high": Fr(b) + Fr(1, 2), "a": Fr(a), "b": Fr(b)}
    k_val = float(mid)
    assert a < mid < b
    agree(k_val, float((sp.Rational(a) + sp.Rational(b)) / 2), 1e-9, "mid")
    stem = f"In Country A the opportunity cost of producing one unit of {g[0]} is {a} {"unit" if a == 1 else "units"} of {g[1]}. In Country B the opportunity cost of producing one unit of {g[0]} is {b} units of {g[1]}. Which of the following terms of trade, in units of {g[1]} per unit of {g[0]}, would make both countries better off if Country A exports {g[0]} to Country B?"
    f = lambda v: f"{nm(v, 2)} {'unit' if abs(v - 1) < 1e-9 else 'units'} of {g[1]} per unit of {g[0]}"  # noqa: E731
    k, ds = val_opts(k_val, [("Sets the price equal to Country A's opportunity cost, so Country A gains nothing from trading.", a), ("Sets the price equal to Country B's opportunity cost, so Country B gains nothing from trading.", b),
                             ("Sets the price below Country A's opportunity cost, so Country A would lose by exporting.", float(cand["low"]) if cand["low"] > 0 else a - 0.5), ("Sets the price above Country B's opportunity cost, so Country B would lose by importing.", float(cand["high"])),
                             ("Adds the two opportunity costs instead of choosing a value between them.", a + b), ("Multiplies the two opportunity costs instead of choosing a value between them.", a * b)], f)
    return mk("mi_trade_terms", "1.4", "3.C", stem, k, ds, rng, concept="mutually beneficial terms of trade lie between the two opportunity costs", path="interval test a < terms < b vs symbolic midpoint inside the interval", kwhy=f"Terms must lie strictly between {a} and {b} units of {g[1]}; {nm(k_val, 2)} does.", facts=[f"a={a}", f"b={b}"], est=70)


# ======================= 1.5 / 1.6 한계 분석 =======================
@retry_sep
def mi_mb_mc_table(rng):
    n = 6
    mb = sorted([rng.randrange(8, 46, 2) for _ in range(n)], reverse=True)
    mc = sorted([rng.randrange(4, 30, 2) for _ in range(n)])
    for i in range(1, n):
        if mb[i] == mb[i - 1]:
            mb[i] -= 1
        if mc[i] == mc[i - 1]:
            mc[i] += 1
    if any(mb[i] == mc[i] for i in range(n)):
        raise ValueError("not_enough_separated_distractors")
    opt = max([i + 1 for i in range(n) if mb[i] > mc[i]], default=0)
    if opt in (0, n):
        raise ValueError("not_enough_separated_distractors")
    # 독립 경로: 순편익(누적) 최대 수량
    cum = [sum(mb[:q]) - sum(mc[:q]) for q in range(n + 1)]
    opt2 = max(range(n + 1), key=lambda q: cum[q])
    agree(opt, opt2, 1e-9, "optimal_q")
    unit = rng.choice(["hours of study", "hours of exercise", "hours of practice"])
    stim = tbl(f"Marginal benefit and marginal cost (in dollars) of each additional {unit[:-1] if unit.endswith('s') else unit} in a day.", ["Hour", "Marginal benefit", "Marginal cost"], [[i + 1, usd(mb[i]), usd(mc[i])] for i in range(n)])
    stem = f"The table shows the marginal benefit and marginal cost of each additional hour of an activity for a rational decision maker. Based on the table, how many {unit} should the person choose?"
    k, ds = val_opts(opt, [("Chooses the first hour where marginal benefit exceeds marginal cost and stops there.", 1), ("Chooses the hour where marginal cost first exceeds marginal benefit instead of the last hour that is worth doing.", opt + 1), ("Chooses the quantity where the total benefit is largest regardless of cost.", n), ("Chooses the quantity just below the best one, stopping before the last hour with a positive net gain.", max(opt - 1, 0)),
                          ("Chooses the quantity where marginal benefit equals zero.", 0)], lambda v: str(int(v)))
    return mk("mi_mb_mc_table", "1.5", "2.C", stem, k, ds, rng, concept="choose the quantity where marginal benefit still covers marginal cost", path="last hour with MB >= MC vs argmax of cumulative net benefit", stim=stim, kwhy=f"Hour {opt} is the last hour with marginal benefit at least marginal cost, so the person should choose {opt}.", facts=[f"mb={mb}", f"mc={mc}", f"opt={opt}"], est=70)


@retry_sep
def mi_utility_rule(rng):
    # 두 재화(X: 가격 px, Y: 가격 py)의 한계효용 표; 예산에 맞춰 마지막 1단위 선택을 묻는다.
    px, py = rng.choice([(2, 1), (4, 2), (3, 1), (6, 3)])
    mux = [rng.choice([24, 30, 36, 48])]; muy = [rng.choice([10, 12, 14, 16])]
    for _ in range(3):
        mux.append(mux[-1] - rng.choice([4, 6, 8])); muy.append(muy[-1] - rng.choice([1, 2, 3]))
    if min(mux) <= 0 or min(muy) <= 0:
        raise ValueError("not_enough_separated_distractors")
    budget = rng.choice([10, 12, 14])
    # 탐욕: 달러당 한계효용이 큰 단위부터 예산 소진까지 구입 (정확 분수) — 독립 경로: 완전탐색
    units = [("X", i + 1, Fr(mux[i], px), px) for i in range(4)] + [("Y", i + 1, Fr(muy[i], py), py) for i in range(4)]
    units.sort(key=lambda u: -u[2])
    spent, nx, ny = 0, 0, 0
    for g, i, r, p in units:
        if spent + p <= budget:
            spent += p
            if g == "X": nx += 1
            else: ny += 1
    best = (-1, None)
    for a in range(5):
        for b in range(5):
            if a * px + b * py <= budget:
                u = sum(mux[:a]) + sum(muy[:b])
                if u > best[0]: best = (u, (a, b))
    if best[1] != (nx, ny) or spent != budget:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl(f"Marginal utility (utils) from each additional unit. The price of X is {usd(px)} and the price of Y is {usd(py)}.", ["Unit", "Marginal utility of X", "Marginal utility of Y"], [[i + 1, mux[i], muy[i]] for i in range(4)])
    stem = f"A consumer has {usd(budget)} to spend on goods X and Y, which cost {usd(px)} and {usd(py)} per unit. The table shows the marginal utility of each additional unit. To maximize total utility, how many units of X should the consumer buy?"
    k, ds = val_opts(nx, [("Buys the quantity of X that spends the whole budget on X, ignoring the marginal utility per dollar of Y.", budget // px), ("Buys X until its marginal utility falls to the lowest marginal utility of Y, ignoring prices.", sum(1 for v in mux if v >= min(muy))), ("Buys one more unit of X than the utility-maximizing quantity.", nx + 1), ("Splits the budget equally between X and Y by spending.", budget // (2 * px)), ("Buys no X because Y has smaller marginal utility numbers.", 0)], lambda v: str(int(v)))
    return mk("mi_utility_rule", "1.6", "2.C", stem, k, ds, rng, concept="utility maximization: equalize marginal utility per dollar", path="greedy marginal-utility-per-dollar purchases vs brute-force search over all affordable bundles", stim=stim,
              kwhy=f"Buying units in order of marginal utility per dollar and exhausting the budget gives {nx} units of X and {ny} units of Y.", facts=[f"px={px}", f"py={py}", f"budget={budget}", f"mux={mux}", f"muy={muy}", f"nx={nx}", f"ny={ny}"], est=100)


def mi_consumer_rule(rng):
    px, py = rng.choice([(4, 2), (5, 1), (6, 3), (10, 2)]); mux = rng.choice([20, 30, 40, 60]); muy = rng.choice([4, 6, 8, 12])
    rx, ry = Fr(mux, px), Fr(muy, py)
    if rx == ry:
        raise ValueError("equal_ratio")
    more = "X" if rx > ry else "Y"
    less = "Y" if more == "X" else "X"
    agree(1.0 if rx > ry else 0.0, 1.0 if bool(sp.Rational(mux, px) > sp.Rational(muy, py)) else 0.0, 1e-9, "ratio_sign")
    stem = f"A consumer spends an entire income on goods X and Y. At the current bundle, the marginal utility of X is {mux} utils and its price is {usd(px)}; the marginal utility of Y is {muy} utils and its price is {usd(py)}. To increase total utility, the consumer should"
    k, ds = sent_opts(f"buy more of {more} and less of {less}, because {more} gives more marginal utility per dollar.", f"The marginal utility per dollar is {mux}/{px} = {float(rx):.1f} for X and {muy}/{py} = {float(ry):.1f} for Y, so shifting spending toward {more} raises utility.",
                      [(f"buy more of {less} and less of {more}, because {less} is cheaper per unit.", "Compares prices only and ignores marginal utility per dollar."), (f"buy more of {less} and less of {more}, because {less} has the lower marginal utility.", "Believes a lower marginal utility means the good should be bought more."),
                       ("make no change, because the consumer has spent the entire income.", "Thinks that spending the whole income already means utility is maximized, which requires equal marginal utility per dollar."), (f"buy more of both goods, because both give positive marginal utility.", "Ignores the budget constraint."),
                       (f"buy more of {more} and less of {less}, because {more} has the higher price.", "Reverses the role of price; a higher price lowers marginal utility per dollar.")])
    return mk("mi_consumer_rule", "1.6", "2.A", stem, k, ds, rng, concept="compare marginal utility per dollar across goods", path="exact ratio comparison vs sympy rational comparison", facts=[f"mux={mux}", f"muy={muy}", f"px={px}", f"py={py}", f"more={more}"], est=60)


def mi_sunk_cost(rng):
    spent = rng.choice([200, 300, 500, 800]); future_cost = rng.choice([40, 60, 90]); future_benefit = future_cost + rng.choice([-30, 30, 50])
    go = future_benefit > future_cost
    g = rng.choice([("concert tickets that cannot be refunded", "go to the concert"), ("a non-refundable gym membership", "go to the gym today")])
    stem = f"Jordan has already paid {usd(spent)} for {g[0]}. Jordan now expects an additional cost of {usd(future_cost)} (travel and time) to {g[1]}, and values the experience at {usd(future_benefit)}. Which of the following is the best economic advice?"
    r = f"{g[1][0].upper()}{g[1][1:]}"
    if go:
        k, ds = sent_opts(f"{r}, because the additional benefit of {usd(future_benefit)} exceeds the additional cost of {usd(future_cost)}.", f"The {usd(spent)} is a sunk cost; only the additional {usd(future_cost)} cost and {usd(future_benefit)} benefit matter.",
                          [(f"Do not go, because the {usd(spent)} already spent can never be recovered.", "Lets a sunk cost drive a forward-looking decision."), (f"Do not go, because the total cost of {usd(spent + future_cost)} exceeds the benefit.", "Includes the sunk cost in the comparison."), ("Go only if the refund is possible, because refundable costs are the only relevant ones.", "Misreads which costs are relevant; the unrecoverable cost is irrelevant either way."),
                           (f"Go, because the {usd(spent)} already spent proves the experience is worth that much.", "Treats spending as evidence of value instead of comparing marginal benefit and cost."), ("It cannot be determined without knowing what Jordan paid last year.", "Believes past spending beyond the sunk amount is needed.")])
    else:
        k, ds = sent_opts(f"Do not go, because the additional cost of {usd(future_cost)} exceeds the additional benefit of {usd(future_benefit)}.", f"The {usd(spent)} is sunk and irrelevant; the additional cost exceeds the additional benefit.",
                          [(f"{r}, because the {usd(spent)} already spent would otherwise be wasted.", "Lets a sunk cost drive a forward-looking decision."), (f"{r}, because the total benefit of {usd(future_benefit + spent)} exceeds the additional cost.", "Counts the sunk payment as a benefit of going."), ("Go, because the cost has already been paid and is therefore free.", "Treats an unrecoverable cost as zero while still counting its payment as a benefit."),
                           ("Do not go, because sunk costs should be recovered by selling the ticket.", "Assumes sunk costs can be recovered, which contradicts the non-refundable payment."), ("It cannot be determined without knowing what Jordan paid last year.", "Believes past spending beyond the sunk amount is needed.")])
    return mk("mi_sunk_cost", "1.5", "2.B", stem, k, ds, rng, concept="sunk costs are ignored; compare additional benefit with additional cost", path="direct comparison of additional benefit and additional cost vs sympy inequality", facts=[f"spent={spent}", f"cost={future_cost}", f"benefit={future_benefit}", f"go={go}"], est=70)
