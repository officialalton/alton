"""AP Microeconomics 확대 MI3 — 신규 원형 A(단원 1·2). 2026-10-19. 공개 세트 MI1·MI2 의 원형과 풀이 틀이 다르다(원형 id·토픽·풀이 경로가 겹치지 않음).
정답은 고정 문장(개념 비교·식별)이거나 코드가 계산한 값이며, 오답 문장은 이름 붙은 오개념 하나씩을 가진다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401


def _bank(rng, arch, topic, skill, bank, concept, path, est=60, judgment=None):
    """고정 문장 은행 한 항목을 골라 5지선다로 만든다. bank = [(stem, key_text, key_why, [(wrong_text, wrong_why), ...≥4])]."""
    stem, kt, kw, wr = bank[rng.randrange(len(bank))]
    k, ds = sent_opts(kt, kw, wr)
    return mk(arch, topic, skill, stem, k, ds, rng, concept=concept, path=path, facts=[f"variant={stem[:40]}"], est=est, **({"judgment": judgment} if judgment else {}))


# ================= 단원 1 =================
PPC_IN = [
    ("A country's economy is currently producing at a point inside its production possibilities curve for consumer goods and capital goods. Which statement best explains this situation and what it implies?",
     "Some resources are unemployed or used inefficiently, so output of both goods could rise without giving up either good.",
     "A point inside the curve means resources are idle or misallocated; moving to the curve raises output of at least one good at no opportunity cost.",
     [("The economy has more resources than the curve assumes, so the curve itself must shift outward before output can rise.", "Confuses an inside point with a shift of the curve; a point inside the curve reflects unused capacity, not a change in resource quantity."),
      ("The point is efficient, so producing more capital goods requires giving up some consumer goods.", "Treats an inside point like a point on the curve; trade-offs appear only once resources are fully and efficiently used."),
      ("The point cannot be produced with the current resources and technology, so it is unattainable.", "Reverses attainable and unattainable points; points inside the curve are attainable, points outside are not."),
      ("The country must be trading with another country, because only trade can place production inside the curve.", "Links an inside point to trade; trade lets consumption go beyond the curve but does not explain inefficient production.")]),
    ("A country's production possibilities curve shows capital goods on the vertical axis and consumer goods on the horizontal axis. A new technology raises the output per worker in consumer goods only. Which change in the curve is most likely?",
     "The curve pivots outward along the consumer goods axis, while the maximum quantity of capital goods stays the same.",
     "Technology that improves only one good raises the maximum of that good and leaves the other intercept unchanged, so the curve pivots.",
     [("The curve shifts outward in a parallel way, because better technology raises the maximum of both goods by the same amount.", "Assumes a parallel shift; a technology specific to one good changes only that good's intercept."),
      ("The curve shifts inward, because producing more consumer goods leaves fewer resources for capital goods.", "Confuses a movement along the curve with a shift; reallocating resources does not move the curve itself."),
      ("The curve does not change, because technology changes the price of the good rather than the possible output.", "Treats technology as a price effect; technology changes the feasible output and therefore the curve."),
      ("The curve pivots outward along the capital goods axis, because the new technology frees up resources for capital goods.", "Pivots the wrong intercept; the technology changes output per worker in consumer goods only.")]),
    ("A hurricane destroys a large share of a country's factories but not its workers or its farmland. Compared with the production possibilities curve before the storm, which statement is correct?",
     "The curve shifts inward, because the economy's stock of capital has shrunk, so some earlier combinations of output are no longer attainable.",
     "Losing capital reduces the feasible output combinations, so the whole curve moves inward (especially for goods that use capital).",
     [("The economy moves down along the same curve, because the country now produces fewer goods.", "Confuses a loss of productive capacity (a shift) with a choice of a different combination on the same curve."),
      ("The curve shifts outward, because rebuilding factories will create many jobs.", "Mixes the later effect of rebuilding with the immediate loss of capital; the loss of factories reduces capacity."),
      ("The curve does not change, because workers and farmland are unaffected and the curve depends only on labor and land.", "Ignores capital as a resource; any lost resource reduces the feasible output."),
      ("The economy moves to a point inside the old curve, but the curve itself stays where it was.", "Treats the damage as an inefficiency; destroyed factories lower the maximum possible output, so the curve shifts inward.")]),
]


def mi_ppc_inside_point(rng):
    return _bank(rng, "mi_ppc_inside_point", "1.3", "2.B", PPC_IN, "points inside, on, and shifts of a production possibilities curve", "fixed vetted statements; each wrong sentence confuses a movement with a shift or inefficiency with a trade-off",
                 judgment="separate a movement or inefficiency from a shift of the curve and match it to the cause given")


@retry_sep
def mi_trade_specialize_table(rng):
    """두 나라의 시간당 생산량 표에서 양쪽 모두에 이득이 되는 교환 비율(두 기회비용 사이)을 고른다."""
    lo = rng.choice([2, 3, 4]); hi = lo + 2
    a1 = rng.choice([4, 5, 6]); a2 = lo * a1
    b1 = rng.choice([3, 4, 5]); b2 = hi * b1
    (ga, ca_), (gb, cb_) = ((a1, a2), (b1, b2))
    if rng.random() < 0.5:
        (ga, ca_), (gb, cb_) = (b1, b2), (a1, a2)
    opp_a, opp_b = Fr(ca_, ga), Fr(cb_, gb)
    lo_v, hi_v = min(opp_a, opp_b), max(opp_a, opp_b)
    assert lo_v == lo and hi_v == hi
    # 독립 경로: 직물 1단위의 기회비용(곡물 단위)은 역수이므로 곡물의 비교우위가 낮은 나라가 직물에서는 비교우위를 갖는다
    assert (1 / opp_a < 1 / opp_b) == (opp_b < opp_a)
    mid = lo + 1
    stim = tbl("Output per hour of labor in each country.", ["", "Grain (units)", "Cloth (units)"], [["Country A", ga, ca_], ["Country B", gb, cb_]])
    stem = ("The table shows the output that one hour of labor produces in Country A and in Country B. The two countries specialize according to comparative advantage and trade grain for cloth. "
            "Which of the following exchange rates would make both countries better off?")
    rate = lambda v: f"1 unit of grain for {int(v)} units of cloth"  # noqa: E731
    k = Opt(rate(mid), True, f"One country gives up {lo} units of cloth to make a unit of grain and the other gives up {hi}; a rate strictly between them, {mid}, benefits both.", mid)
    ds = [Opt(rate(lo), False, "At exactly the grain exporter's opportunity cost it gains nothing from trading; the rate must be strictly between the two opportunity costs.", lo),
          Opt(rate(hi), False, "At exactly the other country's opportunity cost of grain it gains nothing from importing; the rate must be strictly between the two opportunity costs.", hi),
          Opt(rate(lo - 1), False, "Below both opportunity costs of grain: the grain exporter would receive less cloth than it gives up by making grain.", lo - 1),
          Opt(rate(hi + 1), False, "Above both opportunity costs of grain: the importer would pay more cloth than making grain at home costs, so it would refuse to trade.", hi + 1)]
    return mk("mi_trade_specialize_table", "1.4", "2.B", stem, k, ds, rng, concept="mutually beneficial terms of trade lie strictly between the two opportunity costs", path="opportunity-cost ratios from the table vs reciprocal comparison",
              stim=stim, facts=[f"A={ga},{ca_}", f"B={gb},{cb_}", f"lo={lo}", f"hi={hi}"], est=90, judgment="compare the two opportunity costs and choose a trade ratio between them")


MARGINAL_DEC = [
    ("A student pays a nonrefundable $40 fee for a pottery workshop and can leave at any hour. Each extra hour attended is worth $12 to her, and each extra hour costs her $15 of lost tutoring income. Which action maximizes her net benefit from here on?",
     "Stop attending now, because each additional hour costs more than it is worth to her; the $40 fee is a sunk cost.",
     "The fee is sunk and irrelevant; the marginal benefit of $12 is below the marginal cost of $15, so another hour lowers her net benefit.",
     [("Keep attending until the hours she has attended are worth the $40 fee she paid.", "Lets the sunk fee drive the decision; sunk costs should not affect choices at the margin."),
      ("Keep attending, because leaving would waste the $40 fee she already paid.", "Treats a sunk cost as a reason to continue; the fee cannot be recovered whatever she decides."),
      ("Keep attending, because the total value of the workshop exceeds the lost tutoring income.", "Compares totals instead of the marginal benefit and marginal cost of the next hour."),
      ("Attend only half of the remaining hours to split the difference between the $12 benefit and the $15 cost.", "Splitting the difference has no economic basis; whenever marginal cost exceeds marginal benefit she should do none of the extra hours.")]),
    ("A bakery has already purchased a $500 oven that cannot be resold. Baking one more batch of bread adds $90 to revenue and costs $70 in ingredients and labor. Which statement about the next batch is correct?",
     "The bakery should bake it, because the marginal benefit of $90 exceeds the marginal cost of $70; the oven price is sunk.",
     "A rational decision compares only marginal revenue and marginal cost; the $500 oven is already spent either way.",
     [("The bakery should not bake it until the batch's revenue covers the $500 oven.", "Adds the sunk oven cost to the marginal decision; the oven cost is unaffected by the choice."),
      ("The bakery should bake it only if the oven cost is divided evenly among all batches it will ever bake.", "Allocating a sunk cost across batches still makes it irrelevant to the marginal decision."),
      ("The bakery should not bake it, because its total cost including the oven is higher than the batch revenue.", "Uses total cost including a sunk cost; only the added cost of this batch matters."),
      ("The bakery is indifferent, because the batch adds $20 of net benefit only if the oven is ignored.", "Declares indifference; a positive net benefit of $20 means baking is strictly better.")]),
]


def mi_marginal_decision_sunk(rng):
    return _bank(rng, "mi_marginal_decision_sunk", "1.5", "2.B", MARGINAL_DEC, "marginal benefit versus marginal cost with a sunk cost", "fixed vetted scenarios; the key compares marginal values and ignores the sunk amount",
                 judgment="compare the marginal benefit with the marginal cost and ignore any sunk cost")


@retry_sep
def mi_mu_per_dollar_table(rng):
    """한계효용표와 가격에서 예산 안에서 효용을 최대로 하는 (X, Y) 조합을 구한다(한계효용/가격 규칙)."""
    px, py = rng.choice([(1, 2), (2, 1), (2, 3), (1, 3)])
    budget = rng.choice([8, 9, 10, 11, 12])
    mux = sorted(rng.sample(range(10, 41, 2), 6), reverse=True)
    muy = sorted(rng.sample(range(12, 60, 2), 6), reverse=True)
    # 탐욕: 한 번에 한 단위씩 MU/P 가 큰 쪽을 산다(독립 경로: 전수 탐색)
    best = None
    for x in range(0, 7):
        for y in range(0, 7):
            if x * px + y * py > budget:
                continue
            u = sum(mux[:x]) + sum(muy[:y])
            if best is None or u > best[0]:
                best = (u, x, y)
    bx, by = best[1], best[2]
    gx, gy, spent = 0, 0, 0
    while True:
        cand = []
        if gx < 6 and spent + px <= budget:
            cand.append((Fr(mux[gx], px), "x"))
        if gy < 6 and spent + py <= budget:
            cand.append((Fr(muy[gy], py), "y"))
        if not cand:
            break
        cand.sort(reverse=True)
        if cand[0][1] == "x":
            gx += 1; spent += px
        else:
            gy += 1; spent += py
    if (gx, gy) != (bx, by) or spent != budget and False:
        raise ValueError("not_enough_separated_distractors")
    if len([1 for x in range(7) for y in range(7) if x * px + y * py <= budget and sum(mux[:x]) + sum(muy[:y]) == best[0]]) > 1:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl("Marginal utility (utils) of each additional unit.", ["Unit", "Marginal utility of X", "Marginal utility of Y"], [[i + 1, mux[i], muy[i]] for i in range(6)])
    stem = f"A consumer has {usd(budget)} to spend on goods X and Y. The price of X is {usd(px)} per unit and the price of Y is {usd(py)} per unit. The table shows the marginal utility of each additional unit. Which bundle maximizes total utility?"
    fmtb = lambda xy: f"{xy[0]} unit{'' if xy[0] == 1 else 's'} of X and {xy[1]} unit{'' if xy[1] == 1 else 's'} of Y"  # noqa: E731
    k = Opt(fmtb((bx, by)), True, f"Buying one unit at a time by the larger marginal utility per dollar until the budget is spent gives {bx} of X and {by} of Y.", None)
    alt = []
    # 오개념: 단가가 싼 상품에 전부, 한계효용이 큰 상품 단위만 선택, 지출을 남김 등
    ex = min(budget // px, 6)
    ey = min(budget // py, 6)
    alt.append(Opt(fmtb((ex, 0)), False, "Spends the whole budget on the cheaper-per-unit good X without comparing marginal utility per dollar.", None))
    alt.append(Opt(fmtb((0, ey)), False, "Spends the whole budget on good Y because its first units have the highest marginal utility, ignoring its price.", None))
    alt.append(Opt(fmtb((min(6, bx + 1), max(0, by - 1))), False, "Shifts one unit toward X, giving up a unit of Y whose marginal utility per dollar is higher than that of the extra unit of X.", None))
    alt.append(Opt(fmtb((max(0, bx - 1), min(6, by + 1))), False, "Shifts one unit toward Y, but the extra unit of Y has a lower marginal utility per dollar than the unit of X given up.", None))
    alt.append(Opt(fmtb((bx, max(0, by - 1))), False, "Leaves part of the budget unspent; an additional affordable unit would still raise total utility.", None))
    seen = {k.text}
    ds = []
    for o in alt:
        if o.text in seen or (int(o.text.split()[0]) * px + int(o.text.split(" of X and ")[1].split()[0]) * py) > budget + 6:
            continue
        seen.add(o.text); ds.append(o)
    if len(ds) < 4:
        raise ValueError("not_enough_separated_distractors")
    return mk("mi_mu_per_dollar_table", "1.6", "2.A", stem, k, ds[:4], rng, concept="utility is maximized when the last dollar buys the same marginal utility in every good",
              path="greedy marginal utility per dollar vs exhaustive search over affordable bundles", stim=stim, facts=[f"px={px}", f"py={py}", f"budget={budget}", f"mux={mux}", f"muy={muy}", f"best={bx},{by}"], est=100,
              judgment="compare marginal utility per dollar one unit at a time within the budget")


INCENTIVE = [
    ("A restaurant owner raises the hourly wage she pays her cooks. Which statement best describes how this change affects the opportunity cost faced by a student who is deciding whether to attend a free job-skills workshop for one afternoon?",
     "The opportunity cost of attending rises, because the wage the student could earn during that afternoon is higher.",
     "The opportunity cost of attending is the value of the best alternative use of the time; a higher wage raises that forgone income.",
     [("Nothing changes, because the workshop is free and therefore costs the student nothing.", "Confuses a zero price with a zero opportunity cost; the student still gives up the best alternative use of time."),
      ("The opportunity cost falls, because a higher wage makes the student better off and more able to pay.", "Confuses the student's wealth with the cost of time; the higher wage raises the value of the forgone alternative."),
      ("The opportunity cost rises only for the restaurant owner, not for the student.", "Assigns the cost to the wrong decision maker; the student's forgone earnings are what matter for the student's choice."),
      ("The opportunity cost equals the total number of afternoons the student works in a year.", "Replaces the value of one forgone alternative with a count of all work time; opportunity cost is the best alternative forgone.")]),
    ("The government cuts the price of public bus rides to zero. Which statement about the opportunity cost of taking a bus is correct?",
     "Riders still bear an opportunity cost, because the time spent traveling could have been used for another activity.",
     "A zero ticket price removes the money cost but not the time and resource costs, so the opportunity cost stays positive.",
     [("Riders bear no opportunity cost, because opportunity cost is measured only in money paid.", "Limits opportunity cost to money payments; time and forgone alternatives count too."),
      ("The opportunity cost of the bus ride rises to the full cost of running the bus system for every rider.", "Assigns the operator's total cost to each rider; the rider's opportunity cost is the value of the rider's best alternative."),
      ("Only taxpayers bear any opportunity cost, because they pay for the free service.", "Ignores the rider's time; both riders and taxpayers face opportunity costs."),
      ("The opportunity cost falls to zero for society because the ticket price is zero.", "A free ticket shifts who pays; society still gives up the resources used to run the buses.")]),
]


def mi_incentives_opp_cost(rng):
    return _bank(rng, "mi_incentives_opp_cost", "1.1", "2.B", INCENTIVE, "opportunity cost depends on the best alternative, not on the price paid", "fixed vetted scenarios; each wrong sentence ties opportunity cost to money, to a total, or to another decision maker",
                 judgment="link a change in the value of the best alternative to the cost of the chosen action")


# ================= 단원 2 =================
@retry_sep
def mi_substitute_complement_id(rng):
    """상황(두 재화의 가격·수요 변화)에서 관계(대체재·보완재·독립재)를 식별한다."""
    pairs = [("tea", "coffee", "sub"), ("hot dogs", "hot dog buns", "comp"), ("streaming subscriptions", "movie theater tickets", "sub"), ("tennis rackets", "tennis balls", "comp"),
             ("printers", "ink cartridges", "comp"), ("bus rides", "ride-share trips", "sub"), ("butter", "margarine", "sub"), ("smartphones", "phone cases", "comp")]
    a, b, rel = pairs[rng.randrange(len(pairs))]
    up = rng.choice([True, False])
    if rel == "sub":
        dq = "rises" if up else "falls"
    else:
        dq = "falls" if up else "rises"
    pc = "rises" if up else "falls"
    stem = f"When the price of {a} {pc}, the quantity of {b} that consumers buy at every price {dq}. Which statement correctly identifies the relationship between {a} and {b}?"
    word = {"sub": "substitutes", "comp": "complements"}
    key_t = f"They are {word[rel]}, because the demand for {b} moves {'in the same direction as' if rel == 'sub' else 'in the opposite direction to'} the price of {a}."
    key_w = "Substitutes have a positive cross-price elasticity and complements a negative one." if rel == "sub" else "Complements have a negative cross-price elasticity because the goods are used together."
    other = "complements" if rel == "sub" else "substitutes"
    wrongs = [(f"They are {other}, because the demand for {b} moves {'in the same direction as' if rel != 'sub' else 'in the opposite direction to'} the price of {a}.", "Reverses the sign rule for cross-price effects; check whether the demand moves with or against the other good's price."),
              (f"They are unrelated goods, because the price of {a} should affect only the quantity of {a}.", "Confuses a movement along the demand curve for one good with a shift in demand for a related good."),
              (f"They are normal goods, because demand for {b} changes when the price of {a} changes.", "Normal and inferior describe the response to income, not to another good's price."),
              (f"They are inferior goods, because the demand for {b} changes in a way that depends on the price of {a}.", "Inferior goods are defined by income, not by a price change of a related good.")]
    k, ds = sent_opts(key_t, key_w, wrongs)
    return mk("mi_substitute_complement_id", "2.1", "1.B", stem, k, ds, rng, concept="classify related goods from the direction of the cross-price effect", path="fixed vetted pairs with a sign rule; the key is derived from the pair's relation",
              facts=[f"pair={a}|{b}|{rel}", f"up={up}"], est=55, judgment="read the direction of the demand change and name the relationship")


@retry_sep
def mi_elasticity_type_identify(rng):
    """가격 변화율과 수량 변화율로 탄력성 유형(탄력적·비탄력적·단위탄력적)과 총수입 반응을 식별한다."""
    dp = rng.choice([5, 8, 10, 12, 20])
    kind = rng.choice(["el", "inel", "unit"])
    dq = {"el": dp + rng.choice([5, 8, 10, 15]), "inel": max(1, dp - rng.choice([3, 4, 5])), "unit": dp}[kind]
    if dq <= 0 or (kind == "inel" and dq >= dp):
        raise ValueError("not_enough_separated_distractors")
    e = Fr(dq, dp)
    typ = "elastic" if e > 1 else "inelastic" if e < 1 else "unit elastic"
    agree(float(e), dq / dp, 1e-9, "ped")
    rev = "decrease" if e > 1 else "increase" if e < 1 else "stay the same"
    stem = f"After a seller raises the price of a good by {dp} percent, the quantity demanded falls by {dq} percent. Which statement correctly describes demand over this range and the effect of the price increase on the seller's total revenue?"
    key_t = f"Demand is {typ}, and total revenue will {rev}."
    allv = [("elastic", "decrease"), ("inelastic", "increase"), ("unit elastic", "stay the same")]
    wrongs = []
    why = {("elastic", "increase"): "Pairs elastic demand with a revenue gain; with elastic demand the percentage fall in quantity exceeds the percentage rise in price.",
           ("inelastic", "decrease"): "Pairs inelastic demand with a revenue loss; with inelastic demand the price rise outweighs the smaller percentage fall in quantity.",
           ("unit elastic", "increase"): "Treats a unit-elastic response as a revenue gain; equal percentage changes leave total revenue unchanged.",
           ("elastic", "stay the same"): "Mixes elastic demand with unchanged revenue, which is the unit-elastic case.",
           ("inelastic", "stay the same"): "Mixes inelastic demand with unchanged revenue, which is the unit-elastic case.",
           ("unit elastic", "decrease"): "Treats a unit-elastic response as a revenue loss; equal percentage changes leave revenue unchanged."}
    for t, r in [(t, r) for t in ("elastic", "inelastic", "unit elastic") for r in ("increase", "decrease", "stay the same")]:
        if (t, r) != (typ, rev) and (t, r) in why:
            wrongs.append((f"Demand is {t}, and total revenue will {r}.", why[(t, r)]))
    k, ds = sent_opts(key_t, f"The ratio of the percentage changes is {dq}/{dp} = {nm(float(e), 2)}, which means demand is {typ}, so a price increase makes revenue {rev}.", wrongs[:4])
    return mk("mi_elasticity_type_identify", "2.3", "1.B", stem, k, ds, rng, concept="price elasticity from percentage changes and the total-revenue test", path="exact ratio of percentage changes vs total-revenue rule table",
              facts=[f"dp={dp}", f"dq={dq}", f"type={typ}"], est=70, judgment="compare the percentage changes and apply the total-revenue test")


ELAS_COMPARE = [
    ("Which statement correctly compares the price elasticity of demand for a good over a short period and over a long period after a price increase?",
     "Demand is usually more elastic in the long run, because consumers have more time to find substitutes and change their habits.",
     "Time to adjust makes buyers more responsive, so long-run demand is more elastic than short-run demand.",
     [("Demand is usually more elastic in the short run, because consumers react most strongly right after the change.", "Reverses the time effect; buyers need time to find substitutes, so the short run is less elastic."),
      ("Elasticity is the same in both periods, because elasticity depends only on the slope of the demand curve.", "Ties elasticity to slope alone; elasticity also depends on the time horizon and the position on the curve."),
      ("Demand is more elastic in the long run only if the good is a necessity.", "Applies the time effect only to necessities; the long run raises elasticity for nearly all goods."),
      ("Demand is perfectly inelastic in the long run, because prices eventually stop mattering.", "Confuses a long adjustment period with perfect inelasticity; long-run responses are generally larger.")]),
    ("Which of the following correctly distinguishes the slope of a straight-line demand curve from its price elasticity?",
     "The slope is constant along a straight-line demand curve, but the elasticity changes from elastic at high prices to inelastic at low prices.",
     "Elasticity uses percentage changes relative to the starting price and quantity, so it varies along a linear curve even though the slope is constant.",
     [("Both the slope and the elasticity are constant along a straight-line demand curve.", "Treats elasticity as the slope; elasticity depends on percentage changes and varies along the line."),
      ("The slope changes along the curve, but the elasticity is constant everywhere.", "Reverses the two ideas; the slope of a straight line is constant."),
      ("Elasticity is elastic at low prices and inelastic at high prices on a straight-line demand curve.", "Reverses the pattern; at high prices and low quantities the same dollar change is a large percentage change."),
      ("A flatter demand curve always has a lower elasticity than a steeper one at the same price and quantity.", "Reverses the comparison; at the same point a flatter curve is more elastic.")]),
    ("A sales tax is placed on a good whose demand and supply have different elasticities. Which statement correctly compares how the tax burden falls on buyers and on sellers?",
     "The side of the market with the less elastic curve bears the larger share of the tax, because it has fewer alternatives.",
     "The less elastic side cannot easily avoid the tax, so its price changes more and it bears more of the burden.",
     [("The side with the more elastic curve bears the larger share, because it responds more to the tax.", "Reverses the rule; the more elastic side escapes the tax by changing its behavior."),
      ("The tax burden is always split equally, because the tax is collected from one party.", "Confuses legal and economic incidence; the burden depends on relative elasticities."),
      ("The side that sends the tax payment to the government bears the whole burden.", "Mixes up who sends the payment with who bears the burden."),
      ("Buyers bear the larger share whenever the tax is collected from buyers.", "Ties the burden to who writes the check, not to elasticity.")]),
]


def mi_elasticity_compare(rng):
    return _bank(rng, "mi_elasticity_compare", "2.3", "1.D", ELAS_COMPARE, "compare elasticity across time, along a line, and across market sides", "fixed vetted statements; each wrong sentence reverses a comparison or merges slope and elasticity",
                 judgment="compare how elasticity differs across the cases and reject the reversed or merged statements")


CEIL_FLOOR = [
    ("Which statement correctly compares a binding price ceiling and a binding price floor?",
     "A binding price ceiling causes a shortage, while a binding price floor causes a surplus.",
     "A ceiling below equilibrium raises quantity demanded and cuts quantity supplied (shortage); a floor above equilibrium does the reverse (surplus).",
     [("A binding price ceiling causes a surplus, while a binding price floor causes a shortage.", "Reverses both outcomes; a ceiling holds the price below equilibrium so buyers want more than sellers offer."),
      ("Both a binding price ceiling and a binding price floor cause shortages.", "Treats the two controls alike; a floor above equilibrium leaves sellers offering more than buyers want."),
      ("Both a binding price ceiling and a binding price floor leave the market at equilibrium.", "Ignores that a binding control prevents the price from reaching equilibrium."),
      ("A price ceiling is binding only above the equilibrium price, and a price floor is binding only below it.", "Reverses where each control binds; ceilings bind below equilibrium and floors bind above it.")]),
    ("A per-unit tax and a per-unit subsidy are each applied to the sellers of a good in a competitive market. Which statement correctly compares their effects?",
     "The tax raises the buyers' price and lowers the quantity traded, while the subsidy lowers that price and raises the quantity.",
     "A tax shifts supply left (higher price, lower quantity), and a subsidy shifts supply right (lower price, higher quantity).",
     [("Both the tax and the subsidy raise the price buyers pay, because both change the sellers' costs.", "Treats a subsidy like a tax; a subsidy lowers sellers' costs and shifts supply right."),
      ("The tax lowers the price buyers pay and the subsidy raises it, because the government gains from the tax.", "Reverses the price effects; a tax shifts supply left, raising the buyers' price."),
      ("Both reduce the quantity traded, because government intervention always reduces trade.", "Assumes any intervention reduces trade; a subsidy raises the quantity traded."),
      ("Neither changes the quantity traded, because the government only moves money between buyers and sellers.", "Ignores the incentive effect; both policies move the quantity away from the market equilibrium.")]),
    ("A tariff and a quota are each used to limit imports of a good. Which statement correctly compares them?",
     "Both raise the domestic price and cut imports, but only a tariff raises government revenue (unless quota licenses are sold).",
     "Both restrict imports and raise the domestic price; only the tariff directly generates government revenue.",
     [("A tariff lowers the domestic price, while a quota raises it.", "Treats the two policies as opposite; both raise the price of the imported good in the domestic market."),
      ("Neither policy changes the domestic price, because world prices set the domestic price.", "Ignores that a binding tariff or quota raises the domestic price above the world price."),
      ("A quota raises government revenue, while a tariff raises none.", "Reverses the revenue effect; the tariff is a tax collected by the government on each import."),
      ("Both policies increase imports, because domestic producers want to buy foreign inputs.", "Confuses a restriction on imports with a trade expansion.")]),
]


def mi_policy_compare(rng):
    return _bank(rng, "mi_policy_compare", "2.8", "1.D", CEIL_FLOOR, "compare price controls, taxes and subsidies, and tariffs and quotas", "fixed vetted comparisons; each wrong sentence reverses an effect or treats two policies as identical",
                 judgment="compare the two policies on price, quantity, and revenue and reject reversed effects")


MODEL_LIMIT = [
    ("A student uses a simple supply and demand model to predict the effect of a new tax on a good. Which of the following is a limitation of the model that could make the prediction less accurate?",
     "The model assumes that other determinants of demand and supply, such as income and input prices, stay constant while the tax changes.",
     "The ceteris paribus assumption is a limitation: if other determinants change at the same time, the predicted result may not occur.",
     [("The model cannot show a change in price, because it only shows quantities.", "Misstates the model; supply and demand determine both price and quantity."),
      ("The model assumes every buyer and seller sets the price, so no market has a single price.", "Reverses the assumption; the model assumes price takers who face one market price."),
      ("The model shows only what happens after the tax is removed.", "Misdescribes the model; it compares equilibria before and after a change."),
      ("The model requires that the government collect the tax from buyers rather than sellers.", "The model's result does not depend on whom the tax is collected from; only the shifts differ in form.")]),
    ("A production possibilities curve for two goods is drawn as a smooth, bowed-out curve. Which of the following is a limitation of using this model to describe a real economy?",
     "The model assumes two goods with fixed resources and technology, while a real economy has many goods and changing resources.",
     "Simplifying assumptions (two goods, fixed resources and technology) make the model easy to use but limit how closely it matches a real economy.",
     [("The model cannot show opportunity cost, because opportunity cost needs three goods.", "Opportunity cost is exactly what the curve shows; two goods are enough."),
      ("The model assumes that resources are unlimited, so it cannot show scarcity.", "The model assumes limited resources; scarcity is the reason for a trade-off."),
      ("The model shows prices of the two goods on the axes, so it cannot show quantities.", "The axes show quantities of the two goods, not prices."),
      ("The model assumes the economy always produces inside the curve.", "Reverses the assumption; the curve shows the maximum output with full and efficient use of resources.")]),
]


def mi_model_limitations(rng):
    return _bank(rng, "mi_model_limitations", "2.6", "1.D", MODEL_LIMIT, "limitations of simple economic models", "fixed vetted statements; each wrong sentence misstates what the model assumes or shows",
                 judgment="separate a genuine simplifying assumption from a misstatement about what the model shows")
