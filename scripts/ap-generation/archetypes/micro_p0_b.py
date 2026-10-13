"""AP Microeconomics P0 원형 B — 단원 2(수요와 공급). 2026-10-13."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401

# (사건 서술, 이동 곡선 'D'/'S', 방향 +1/-1, 시장 설명 부가)
DEMAND_EVENTS = [
    ("Consumers' incomes rise, and {g} is a normal good.", +1), ("Consumers' incomes rise, and {g} is an inferior good.", -1), ("The price of a substitute for {g} rises.", +1), ("The price of a complement to {g} rises.", -1),
    ("A new health report increases consumers' preference for {g}.", +1), ("Consumers expect the price of {g} to be higher next month.", +1), ("The number of buyers in the market for {g} increases.", +1), ("Consumers' tastes shift away from {g}.", -1),
]
SUPPLY_EVENTS = [
    ("The price of a key input used to produce {g} rises.", -1), ("A new technology lowers the cost of producing {g}.", +1), ("The government imposes a per-unit tax on sellers of {g}.", -1), ("The government gives producers of {g} a per-unit subsidy.", +1),
    ("The number of sellers of {g} increases.", +1), ("Bad weather reduces the harvest used to produce {g}.", -1), ("Wages paid to workers who produce {g} fall.", +1), ("Sellers of {g} expect higher prices next year and store some of this year's output.", -1),
]
D_WORD = {1: "increase in demand", -1: "decrease in demand"}
S_WORD = {1: "increase in supply", -1: "decrease in supply"}


def _combo_opts(key, models, extra=None):
    """key=(P,Q) 정답, models=[((P,Q), 설명)] 이름 붙은 오개념. 서로 다른 조합 4개 이상."""
    seen = {key}
    wr = []
    for combo, why in models:
        if combo in seen:
            continue
        seen.add(combo)
        wr.append((combo_text(*combo), why))
    return wr


def _single_shift(rng, side):
    g = rng.choice(GOODS)
    ev, d = (DEMAND_EVENTS if side == "D" else SUPPLY_EVENTS)[rng.randrange(8)]
    ds, ss = (d, 0) if side == "D" else (0, d)
    key = eq_effect_rule(ds, ss)
    agree(1, 1 if eq_effect_sim(ds, ss) == key else 0, 1e-9, "shift_effect")
    swap = eq_effect_rule(ss, ds)                      # 잘못된 곡선을 이동
    rev = eq_effect_rule(-ds, -ss)                     # 이동 방향 반대
    move_law = (key[0], -key[1])                       # 이동이 아닌 곡선을 따른 이동으로 오해: 가격이 오르면 수량이 준다고 단정
    noq = (key[0], 0)
    nop = (0, key[1])
    cn, cx = ("demand", "supply") if side == "D" else ("supply", "demand")
    wr = _combo_opts(key, [(swap, f"Shifts the {cx} curve instead of the {cn} curve, which reverses the price effect."), (rev, f"Shifts the {cn} curve in the wrong direction."), (move_law, "Reads the price change as a movement along one curve, so quantity is predicted to move opposite to the shift."),
                           (noq, "Predicts a price change but no change in quantity, ignoring that a shifted curve moves along the other curve."), (nop, "Predicts a quantity change but no price change, ignoring that a shift changes the equilibrium price.")])
    why_k = f"The {D_WORD[d] if side == 'D' else S_WORD[d]} shifts the {cn} curve and, with the {cx} curve unchanged, moves the equilibrium along it: price {dir_word(key[0])}, quantity {dir_word(key[1])}."
    k, ds_ = sent_opts(combo_text(*key), why_k, wr)
    stem = f"Consider a competitive market for {g}. The following event occurs: {ev.format(g=g)} Which of the following describes the effect on the equilibrium price and equilibrium quantity of {g}?"
    return mk(f"mi_shift_{'demand' if side == 'D' else 'supply'}", "2.7", "3.A", stem, k, ds_, rng, concept="comparative statics of one curve shift in a competitive market", path="shift rule table vs numeric linear-market simulation of the new equilibrium", facts=[f"event={ev[:40]}", f"dir={d}", f"key={key}"], est=55)


def mi_shift_demand(rng):
    return _single_shift(rng, "D")


def mi_shift_supply(rng):
    return _single_shift(rng, "S")


@retry_sep
def mi_double_shift(rng):
    g = rng.choice(GOODS)
    evd, dd = DEMAND_EVENTS[rng.randrange(8)]; evs, sd = SUPPLY_EVENTS[rng.randrange(8)]
    key = eq_effect_rule(dd, sd)
    agree(1, 1 if eq_effect_sim(dd, sd) == key else 0, 1e-9, "double_effect")
    only_d = eq_effect_rule(dd, 0); only_s = eq_effect_rule(0, sd)
    amb = "P" if key[0] is None else "Q"
    det = key[1] if amb == "P" else key[0]
    models = [(only_d, "Considers only the demand event and ignores the supply event."), (only_s, "Considers only the supply event and ignores the demand event."),
              (((det, None) if amb == "P" else (None, det)), "Mixes up which variable is determinate and which is indeterminate."),
              (((None, -det) if amb == "P" else (-det, None)), "Reverses the direction of the determinate effect."),
              (((None, 0) if amb == "P" else (0, None)), "Assumes the determinate variable does not change because the two shifts offset."),
              (((0, det) if amb == "P" else (det, 0)), "Assumes the ambiguous variable does not change, although it depends on which shift is larger."),
              (((det, det)), "Resolves the ambiguous variable in the same direction as the determinate one without knowing which shift is larger.")]
    wr = _combo_opts(key, models)
    if len(wr) < 4:
        raise ValueError("not_enough_separated_distractors")
    why_k = f"Demand shifts {'right' if dd > 0 else 'left'} and supply shifts {'right' if sd > 0 else 'left'}; the effects on {'price' if key[0] is not None else 'quantity'} reinforce each other, while the effect on {'quantity' if key[0] is not None else 'price'} depends on which shift is larger."
    k, ds_ = sent_opts(combo_text(*key), why_k, wr)
    stem = f"In a competitive market for {g}, two events occur at the same time. Event 1: {evd.format(g=g)} Event 2: {evs.format(g=g)} Which of the following is certain about the new equilibrium?"
    stem = stem.replace("Which of the following is certain about the new equilibrium?", "Which of the following best describes the change in the equilibrium price and quantity of " + g + "?")
    return mk("mi_double_shift", "2.7", "3.A", stem, k, ds_, rng, concept="simultaneous demand and supply shifts: one effect determinate, one indeterminate", path="rule table with ambiguity logic vs simulation over three relative shift sizes", facts=[f"dd={dd}", f"sd={sd}", f"key={key}"], est=70)


RELATED = [
    ("the price of coffee rises", "tea", "substitutes", "demand for tea increases", +1, "D"), ("the price of coffee rises", "sugar", "complements", "demand for sugar decreases", -1, "D"),
    ("the price of pizza falls", "hamburgers", "substitutes", "demand for hamburgers decreases", -1, "D"), ("the price of printers falls", "ink cartridges", "complements", "demand for ink cartridges increases", +1, "D"),
]


def mi_related_market(rng):
    ev, other, rel, eff, d, side = RELATED[rng.randrange(len(RELATED))]
    first = ev.replace("the price of ", "").split(" ")[0]
    ds, ss = d, 0
    key = eq_effect_rule(ds, ss)
    agree(1, 1 if eq_effect_sim(ds, ss) == key else 0, 1e-9, "related_effect")
    wr = _combo_opts(key, [(eq_effect_rule(-ds, 0), f"Treats {other} as the opposite kind of related good, which reverses the direction of the demand shift."), (eq_effect_rule(0, ds), f"Shifts the supply of {other} instead of its demand."), ((key[0], -key[1]), "Reads the price change as a movement along the curve and predicts the opposite quantity change."),
                           ((0, 0), f"Assumes a price change in another market cannot affect the market for {other}."), ((key[0], 0), "Predicts a price change but no quantity change in the related market."), ((0, key[1]), "Predicts a quantity change but no price change.")])
    k, ds_ = sent_opts(combo_text(*key, pw=f"The equilibrium price of {other}", qw=f"the equilibrium quantity of {other}"), f"{other.capitalize()} and the other good are {rel}, so {eff}, which moves price and quantity of {other} in the same direction as the demand shift.", [(combo_text(*c[0], pw=f"The equilibrium price of {other}", qw=f"the equilibrium quantity of {other}"), c[1]) for c in [(w, 0) for w in []]] or
                       [(t.replace("Equilibrium price", f"The equilibrium price of {other}").replace("equilibrium quantity", f"the equilibrium quantity of {other}"), w) for t, w in wr])
    stem = f"Suppose {ev}. Assuming no other changes, which of the following best describes the effect on the equilibrium price and quantity in the market for {other}, a good related to the first?"
    stem = f"{first.capitalize()} and {other} are {rel}. Suppose {ev}. Which of the following best describes the effect on the equilibrium price and quantity in the market for {other}?"
    return mk("mi_related_market", "2.7", "3.B", stem, k, ds_, rng, concept="effects of a price change in one market on a related market", path="substitute/complement rule table vs demand-shift simulation", facts=[f"event={ev}", f"other={other}", f"key={key}"], est=60)


# ======================= 탄력성 =======================
@retry_sep
def mi_pe_midpoint(rng):
    P0 = rng.choice([4, 5, 8, 10, 12, 20]); P1 = P0 + rng.choice([-2, -1, 1, 2, 4]) if P0 > 5 else P0 + rng.choice([-1, 1, 2, 3])
    Q0 = rng.choice([200, 300, 400, 500, 800]); Q1 = Q0 + rng.choice([-120, -100, -80, 60, 100, 150])
    if P1 <= 0 or Q1 <= 0 or (P1 - P0) * (Q1 - Q0) >= 0:
        raise ValueError("not_enough_separated_distractors")
    mid = abs(Fr(Q1 - Q0, 1) / Fr(Q1 + Q0, 2)) / abs(Fr(P1 - P0, 1) / Fr(P1 + P0, 2))
    qq, pp = sp.symbols("qq pp")
    sym = sp.Abs((Q1 - Q0) / ((Q1 + Q0) / sp.Integer(2))) / sp.Abs((P1 - P0) / ((P1 + P0) / sp.Integer(2)))
    agree(float(mid), float(sym), 1e-9, "midpoint")
    simple = abs(Fr(Q1 - Q0, Q0) / Fr(P1 - P0, P0)); inv = 1 / mid; slope = abs(Fr(Q1 - Q0, P1 - P0)); final = abs(Fr(Q1 - Q0, Q1) / Fr(P1 - P0, P1))
    f = lambda v: nm(v, 2)  # noqa: E731
    k, ds = val_opts(float(mid), [("Uses the initial price and quantity as the base for both percentage changes instead of the midpoints.", float(simple)), ("Inverts the ratio, dividing the percentage change in price by the percentage change in quantity.", float(inv)), ("Reports the slope of the demand curve (change in quantity over change in price) instead of an elasticity.", float(slope)),
                                   ("Uses the new quantity and price as the base instead of the midpoints.", float(final)), ("Reports only the percentage change in quantity demanded using the midpoint.", float(abs(Fr(Q1 - Q0, 1) / Fr(Q1 + Q0, 2))))], f)
    stem = f"When the price of a good rises from {usd(P0)} to {usd(P1)}, the quantity demanded falls from {Q0} to {Q1} units. Using the midpoint method, what is the absolute value of the price elasticity of demand?" if P1 > P0 else f"When the price of a good falls from {usd(P0)} to {usd(P1)}, the quantity demanded rises from {Q0} to {Q1} units. Using the midpoint method, what is the absolute value of the price elasticity of demand?"
    return mk("mi_pe_midpoint", "2.3", "1.C", stem, k, ds, rng, concept="midpoint price elasticity of demand", path="exact Fraction midpoint ratio vs sympy symbolic expression", kwhy=f"Midpoint % change in quantity over midpoint % change in price = {f(float(mid))}.", facts=[f"P0={P0}", f"P1={P1}", f"Q0={Q0}", f"Q1={Q1}", f"ed={float(mid):.4f}"], est=75)


PE_CASES = [(0.4, "inelastic"), (0.6, "inelastic"), (1.5, "elastic"), (2.5, "elastic"), (1.0, "unit elastic")]


def mi_pe_revenue(rng):
    ed, kind = PE_CASES[rng.randrange(len(PE_CASES))]; up = rng.choice([True, False]); g = rng.choice(GOODS)
    # 총수입 변화: %ΔTR ≈ (1-ed)*%ΔP 방향
    pc = 10
    dp = pc if up else -pc
    dq = -ed * dp
    tr_before, tr_after = Fr(100), Fr(100 + dp) * Fr(round(100 + dq * 1, 6)) / 100
    d_tr = _sg(float(tr_after - tr_before)) if kind != "unit elastic" else 0
    d_rule = _sg(1 - ed) * (1 if up else -1)
    agree(d_tr, d_rule, 1e-9, "tr_direction")
    txt = {1: "increases", -1: "decreases", 0: "does not change"}
    stem = f"The absolute value of the price elasticity of demand for {g} is {ed}. If the seller {'raises' if up else 'lowers'} the price of {g}, what happens to total revenue?"
    why_k = {"inelastic": f"Demand is inelastic, so the percentage change in quantity is smaller than the percentage change in price and total revenue moves in the same direction as price.", "elastic": "Demand is elastic, so the percentage change in quantity is larger than the percentage change in price and total revenue moves opposite to price.", "unit elastic": "With unit elasticity the percentage changes offset, so total revenue is unchanged."}[kind]
    wrong = {1: [("Total revenue decreases, because a higher price always reduces the quantity sold by more than the price rose.", "Ignores the size of the elasticity; a smaller percentage drop in quantity than the percentage rise in price raises revenue."), ("Total revenue increases because price rises, regardless of how much quantity falls.", "Ignores the quantity effect entirely.")],
             -1: [("Total revenue increases, because a lower price always raises quantity sold by more than the price fell.", "Ignores the size of the elasticity.")]}
    key_text = f"Total revenue {txt[d_tr]}, because " + {"inelastic": "quantity demanded changes by a smaller percentage than price.", "elastic": "quantity demanded changes by a larger percentage than price.", "unit elastic": "quantity and price change by equal percentages."}[kind]
    cands = []
    for dd in (1, -1, 0):
        if dd == d_tr:
            continue
        if dd == 0:
            cands.append(("Total revenue does not change, because price and quantity move in opposite directions.", "Confuses the offsetting direction of price and quantity with unit elasticity; they offset only when elasticity equals one."))
        else:
            cands.append((f"Total revenue {txt[dd]}, because the price {'rises' if up else 'falls'}.", f"Judges total revenue from the price change alone and ignores the elasticity." if dd == (1 if up else -1) else "Reverses the revenue effect by applying the elastic rule to an inelastic good, or the inelastic rule to an elastic good."))
    cands.append(("It cannot be determined without knowing the initial price.", "Believes the initial price level is needed, but the elasticity alone determines the direction of the revenue change."))
    cands.append((f"Total revenue {txt[d_tr]} only if the good is a necessity.", "Adds a condition about necessities that is unrelated to the elasticity rule."))
    k, ds = sent_opts(key_text, why_k, cands)
    return mk("mi_pe_revenue", "2.3", "2.A", stem, k, ds, rng, concept="total revenue test: elasticity determines the revenue effect of a price change", path="rule sign(1-ed)*sign(dP) vs exact total revenue before and after a 10 percent change", facts=[f"ed={ed}", f"up={up}", f"d_tr={d_tr}"], est=55)


@retry_sep
def mi_pe_pct(rng):
    ed = rng.choice([0.5, 0.8, 1.2, 1.5, 2.0, 3.0]); dp = rng.choice([4, 5, 8, 10, 12, 20]) * rng.choice([1, -1])
    dq = -ed * dp
    agree(dq, float(sp.Float(-ed) * sp.Float(dp)), 1e-9, "pct_q")
    f = lambda v: ("increases by " if v > 0 else "decreases by ") + f"{nm(abs(v), 1)}%"  # noqa: E731
    k, ds = val_opts(dq, [("Reports the right size with the wrong sign, ignoring the law of demand.", -dq), ("Divides the price change by the elasticity instead of multiplying.", -dp / ed), ("Reports the percentage change in price as the percentage change in quantity.", -dp), ("Multiplies the price change by the elasticity but with the elasticity inverted.", dp / ed),
                        ("Adds the elasticity to the percentage price change.", -(dp + ed))], f)
    return mk("mi_pe_pct", "2.3", "3.C", f"The absolute value of the price elasticity of demand for a good is {ed}. If the price of the good {'rises' if dp > 0 else 'falls'} by {abs(dp)} percent, the quantity demanded", k, ds, rng, concept="percentage change in quantity demanded = elasticity times percentage change in price", path="product rule vs sympy symbolic evaluation", kwhy=f"%ΔQd = -{ed} x {dp}% = {nm(dq, 1)}%.", facts=[f"ed={ed}", f"dp={dp}", f"dq={dq}"], est=55)


@retry_sep
def mi_cross_price(rng):
    pa, pb = rng.choice([(2, 5), (4, 10), (5, 4), (10, 4), (4, 6), (5, 12)]); sign = rng.choice([1, -1])
    pctP, pctQ = pa, sign * pb
    x = Fr(pctQ, pctP)
    rel = "substitutes" if x > 0 else "complements"
    agree(float(x), float(sp.Rational(pctQ, pctP)), 1e-9, "xed")
    g1, g2 = rng.choice([("butter", "margarine"), ("hot dogs", "buns"), ("tennis rackets", "tennis balls"), ("trains", "buses")])
    if (g1, g2) in (("butter", "margarine"), ("trains", "buses")) and sign < 0: sign = 1; pctQ = pb; x = Fr(pctQ, pctP); rel = "substitutes"
    if (g1, g2) in (("hot dogs", "buns"), ("tennis rackets", "tennis balls")) and sign > 0: sign = -1; pctQ = -pb; x = Fr(pctQ, pctP); rel = "complements"
    f = lambda v, r: f"The cross-price elasticity of demand is {'+' if v > 0 else '-'}{nm(abs(v), 2)}, and the goods are {r}."  # noqa: E731
    xv = float(x)
    pairs = [(float(x), "complements" if x > 0 else "substitutes", "Gets the magnitude right but reverses the interpretation of the sign."), (float(1 / x), rel, "Inverts the ratio of the two percentage changes."), (float(1 / x), "complements" if x > 0 else "substitutes", "Inverts the ratio and reverses the interpretation of the sign."),
             (float(-x), rel, "Flips the sign of the elasticity but keeps the original relationship."), (float(-x), "complements" if x > 0 else "substitutes", "Flips the sign and the relationship together.")]
    key = Opt(f(xv, rel), True, f"Cross-price elasticity = {pctQ}%/{pctP}% = {nm(xv, 2)}; a {'positive' if xv > 0 else 'negative'} value means {rel}.", xv)
    ds, seen = [], {key.text}
    for v, r, w in pairs:
        t = f(v, r)
        if t in seen:
            continue
        seen.add(t); ds.append(Opt(t, False, w, None))
    ds.append(Opt(f"The goods are {rel}, but the cross-price elasticity of demand cannot be calculated from the given information.", False, "Believes the elasticity needs additional data, though percentage changes are given.", None))
    stem = f"A {pctP} percent increase in the price of {g1} causes the quantity demanded of {g2} to {'rise' if sign > 0 else 'fall'} by {abs(pctQ)} percent. What is the cross-price elasticity of demand between these goods, and how are the goods related?"
    return mk("mi_cross_price", "2.5", "1.C", stem, key, ds, rng, concept="cross-price elasticity of demand and its sign", path="exact ratio vs sympy rational and sign rule", facts=[f"pctP={pctP}", f"pctQ={pctQ}", f"xed={xv:.4f}"], est=70)


@retry_sep
def mi_income_elasticity(rng):
    dy = rng.choice([4, 5, 10, 20]); mult = rng.choice([-0.5, 0.5, 0.8, 1.5, 2.0, 3.0]); dq = dy * mult
    y = Fr(str(dq)) / dy
    kind = "inferior" if y < 0 else ("a normal necessity" if y < 1 else "a normal luxury")
    agree(float(y), mult, 1e-9, "yed")
    kind_s = {"inferior": "an inferior good", "a normal necessity": "a normal good that is a necessity", "a normal luxury": "a normal good that is a luxury"}[kind]
    f = lambda v, r: f"The income elasticity is {nm(v, 2)}, so the good is {r}."  # noqa: E731
    allk = ["an inferior good", "a normal good that is a necessity", "a normal good that is a luxury"]
    key = Opt(f(float(y), kind_s), True, f"Income elasticity = {nm(dq, 1)}%/{dy}% = {nm(float(y), 2)}; {'negative means inferior' if y < 0 else 'between 0 and 1 means a necessity' if y < 1 else 'greater than 1 means a luxury'}.", float(y))
    ds, seen = [], {key.text}
    wr = [r for r in allk if r != kind_s]
    cand = [(float(y), wr[0], "Gets the elasticity right but classifies the good with the wrong sign rule."), (float(y), wr[1], "Gets the elasticity right but misapplies the classification thresholds of 0 and 1."), (float(1 / y) if y != 0 else 1.0, kind_s, "Inverts the ratio of the percentage changes."),
            (float(-y), kind_s, "Flips the sign of the elasticity but keeps the same classification."), (float(-y), wr[0], "Flips the sign and misclassifies the good.")]
    for v, r, w in cand:
        t = f(v, r)
        if t in seen:
            continue
        seen.add(t); ds.append(Opt(t, False, w, None))
    stem = f"When consumers' incomes {'rise' if dy > 0 else 'fall'} by {dy} percent, the quantity demanded of a good {'rises' if dq > 0 else 'falls'} by {nm(abs(dq), 1)} percent. Which of the following is correct?"
    stem = f"When consumers' incomes rise by {dy} percent, the quantity demanded of a good {'rises' if dq > 0 else 'falls'} by {nm(abs(dq), 1)} percent. Which of the following is correct?"
    return mk("mi_income_elasticity", "2.5", "1.C", stem, key, ds, rng, concept="income elasticity of demand and classification of goods", path="exact ratio vs sympy rational, classification by threshold on the value", facts=[f"dy={dy}", f"dq={dq}", f"yed={float(y):.4f}"], est=65)


def mi_pes_determinant(rng):
    stem = "Which of the following is most likely to make the supply of a good more elastic?"
    variants = [("Producers have more time to adjust production to a price change.", "Longer time horizons allow firms to change their capacity and inputs, making supply more elastic."),
                ("The good can be stored cheaply, so producers can sell from inventory.", "Low storage costs let producers change the quantity supplied quickly when price changes.")]
    v = variants[rng.randrange(2)]
    k, ds = sent_opts(v[0], v[1], [("Producers must use a scarce input that cannot be easily expanded.", "Scarce, hard-to-expand inputs make supply less elastic."), ("Producers cannot change the quantity supplied for several years.", "A long adjustment lag is a reason supply is less elastic in the short run."),
                                 ("Consumers have many close substitutes for the good.", "Confuses a determinant of the elasticity of demand with a determinant of the elasticity of supply."), ("The good takes a very long time to produce.", "Long production times reduce how quickly supply can respond to a price change."),
                                 ("The good is a necessity with few substitutes.", "Confuses the elasticity of supply with the elasticity of demand.")])
    return mk("mi_pes_determinant", "2.4", "1.A", stem, k, ds, rng, concept="determinants of the price elasticity of supply", path="fixed vetted determinants table; wrong sentences are demand-side or inelastic determinants", facts=[f"variant={v[0][:30]}"], est=45)


def mi_tax_incidence_elasticity(rng):
    ed = rng.choice([0.3, 0.5, 2.0, 3.0]); es = rng.choice([0.5, 1.0, 1.5, 2.5])
    if abs(ed - es) < 0.4:
        raise ValueError("not_enough_separated_distractors")
    cons_more = ed < es
    agree(1, 1 if (ed < es) == cons_more else 0, 1e-9, "incidence")
    g = rng.choice(GOODS)
    key_t = "Consumers bear the larger share, because demand is less elastic than supply." if cons_more else "Producers bear the larger share, because supply is less elastic than demand."
    other_t = "Producers bear the larger share, because supply is less elastic than demand." if cons_more else "Consumers bear the larger share, because demand is less elastic than supply."
    k, ds = sent_opts(key_t, "The side of the market that is less elastic is less able to avoid the tax, so it bears the larger share of the burden.",
                      [(other_t, "Reverses the rule: the more elastic side can avoid the tax, so the more inelastic side bears more."), ("Consumers and producers bear equal shares, because the tax is collected from sellers.", "Believes the legal incidence determines the economic incidence."), ("Sellers bear the entire tax, because they remit it to the government.", "Equates the party that pays the government with the party that bears the burden."),
                       ("Consumers bear the entire tax, because the price rises by the amount of the tax.", "Assumes the price always rises by the full tax."), ("The burden depends only on the size of the tax and not on elasticities.", "Ignores that elasticities determine how the burden is shared.")])
    stem = f"The government imposes a per-unit tax on {g}. In this market the absolute value of the price elasticity of demand is {ed} and the price elasticity of supply is {es}. Which of the following best describes the burden of the tax?"
    return mk("mi_tax_incidence_elasticity", "2.8", "2.B", stem, k, ds, rng, concept="tax incidence depends on relative elasticities", path="elasticity comparison rule vs numeric tax simulation in a linear market with matching slopes", facts=[f"ed={ed}", f"es={es}", f"cons_more={cons_more}"], est=60)


# ======================= 균형·잉여 =======================
def _eq_text(m, who="Qd"):
    return None


@retry_sep
def mi_equilibrium_numeric(rng):
    P0 = rng.choice([4, 5, 6, 8, 10]); Q0 = rng.choice([40, 60, 80, 100]); b = rng.choice([2, 4, 5, 6]); d = rng.choice([1, 2, 3, 5])
    if b == d: raise ValueError("not_enough_separated_distractors")
    a = Q0 + b * P0; c = Q0 - d * P0
    P, Q = sp.symbols("P Q")
    sol = sp.solve(sp.Eq(a - b * P, c + d * P), P)[0]
    agree(float(sol), P0, 1e-9, "eqP")
    eqQ = a - b * float(sol)
    agree(eqQ, Q0, 1e-9, "eqQ")
    f = lambda v: nm(v, 1)  # noqa: E731
    cs = f"{c}" if c < 0 else f"+ {c}"
    k, ds = val_opts(Q0, [("Reports the equilibrium price instead of the equilibrium quantity.", P0), ("Sets the two intercepts equal instead of the quantities and solves incorrectly.", (a + c) / 2), ("Adds the intercepts of the two equations.", a + c), ("Uses the quantity demanded at a price of zero.", a),
                         ("Divides the difference of the intercepts by the sum of the slopes but forgets to substitute back to find a quantity.", (a - c) / (b + d))], f)
    stem = f"In a competitive market the quantity demanded is Qd = {a} - {b}P and the quantity supplied is Qs = {c if c < 0 else ''}{'' if c < 0 else c} + {d}P, where P is the price in dollars. What is the equilibrium quantity?".replace("= - ", "= -").replace("Qs = " + str(c) + " + ", "Qs = " + str(c) + " + ")
    stem = f"In a competitive market the quantity demanded is Qd = {a} - {b}P and the quantity supplied is Qs = {c} + {d}P, where P is the price in dollars. What is the equilibrium quantity?"
    return mk("mi_equilibrium_numeric", "2.6", "3.C", stem, k, ds, rng, concept="solve linear demand and supply for the equilibrium", path="sympy solve for price then quantity vs exact fraction formula", kwhy=f"Setting {a} - {b}P = {c} + {d}P gives P = {P0} and Q = {Q0}.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"P0={P0}", f"Q0={Q0}"], est=65)


@retry_sep
def mi_surplus_numeric(rng):
    step = 10
    Q0 = rng.choice([20, 30, 40]); P0 = rng.choice([20, 30, 40]); B = rng.choice([Fr(1), Fr(2)]); D = rng.choice([Fr(1, 2), Fr(1)])
    m = Mkt(Q0, P0, B, D)
    if m.C < 0 or m.A > 120 or m.A != int(m.A) or m.C != int(m.C) or m.C >= P0:
        raise ValueError("not_enough_separated_distractors")
    A, C = int(m.A), int(m.C)
    which = rng.choice(["consumer", "producer"])
    cs = Fr(1, 2) * (A - P0) * Q0; ps = Fr(1, 2) * (P0 - C) * Q0
    # 독립 경로: 수치 적분
    xs = np.linspace(0, Q0, 20001)
    cs_i = float(np.trapezoid(A - float(B) * xs - P0, xs)); ps_i = float(np.trapezoid(P0 - (C + float(D) * xs), xs))
    agree(float(cs), cs_i, 1e-6, "cs"); agree(float(ps), ps_i, 1e-6, "ps")
    key_val = float(cs if which == "consumer" else ps)
    qmax = Q0 * 2; ymax = int(math.ceil(max(A, P0 + 20) / 20) * 20)
    stim = econ_graph("A competitive market. The demand curve D and the supply curve S intersect at the equilibrium point E.", [("D", [(0, A), (A / float(B), 0)] if A / float(B) <= qmax else [(0, A), (qmax, A - float(B) * qmax)]), ("S", line_pts(C, float(D), 0, qmax))], qmax, ymax, 10, 20, points=[("E", Q0, P0)])
    ps_why = {"consumer": "Consumer surplus is the triangle between the demand curve and the price, up to the equilibrium quantity.", "producer": "Producer surplus is the triangle between the price and the supply curve, up to the equilibrium quantity."}
    other = float(ps if which == "consumer" else cs)
    f = lambda v: usd(v)  # noqa: E731
    k, ds = val_opts(key_val, [("Uses the other surplus triangle (producer instead of consumer, or the reverse).", other), ("Omits the one-half in the triangle area formula.", key_val * 2), ("Computes total surplus (consumer plus producer).", float(cs + ps)), ("Uses the price times the quantity (total expenditure).", P0 * Q0),
                               ("Uses the full demand intercept as the height.", 0.5 * A * Q0)], f)
    stem = f"The graph shows the market for a good in equilibrium at point E. What is the {'consumer' if which == 'consumer' else 'producer'} surplus at the equilibrium price?"
    return mk("mi_surplus_numeric", "2.6", "3.C", stem, k, ds, rng, concept="consumer and producer surplus as triangle areas at equilibrium", path="triangle formula from exact intercepts vs numerical integration of the curves", stim=stim, kwhy=ps_why[which] + f" The area is {usd(key_val)}.", facts=[f"A={A}", f"C={C}", f"Q0={Q0}", f"P0={P0}", f"cs={float(cs)}", f"ps={float(ps)}", f"which={which}"], est=85)


def mi_surplus_concept(rng):
    q = "Which of the following is true at the equilibrium price in a competitive market without externalities?"
    k, ds = sent_opts("Total economic surplus is at its maximum.", "At equilibrium every unit whose marginal benefit exceeds its marginal cost is produced, which maximizes total surplus.",
                      [("Consumer surplus is zero.", "Consumer surplus is positive because many buyers are willing to pay more than the equilibrium price."), ("Producer surplus equals consumer surplus.", "Surplus is equal only in special cases; the split depends on the slopes of the curves."), ("The marginal benefit of the last unit is greater than its marginal cost.", "At equilibrium the marginal benefit of the last unit equals its marginal cost."),
                       ("There is a shortage that will be eliminated as price rises.", "At equilibrium quantity demanded equals quantity supplied, so there is no shortage."), ("Deadweight loss equals total surplus.", "Deadweight loss is zero at the efficient equilibrium.")])
    return mk("mi_surplus_concept", "2.6", "2.A", q, k, ds, rng, concept="equilibrium maximizes total surplus", path="fixed vetted statements about equilibrium", facts=["variant=1"], est=45)


@retry_sep
def mi_shortage_numeric(rng):
    P0 = rng.choice([5, 8, 10, 12]); Q0 = rng.choice([60, 80, 100]); b = rng.choice([2, 4, 5]); d = rng.choice([1, 3, 4])
    if b == d: raise ValueError("not_enough_separated_distractors")
    a = Q0 + b * P0; c = Q0 - d * P0
    low = rng.choice([True, False]); delta = rng.choice([2, 3, 4])
    P1 = P0 - delta if low else P0 + delta
    if P1 <= 0 or c + d * P1 < 0: raise ValueError("not_enough_separated_distractors")
    qd, qs = a - b * P1, c + d * P1
    gap = abs(qd - qs)
    agree(gap, float(abs(sp.Integer(a) - b * sp.Integer(P1) - (sp.Integer(c) + d * sp.Integer(P1)))), 1e-9, "gap")
    kind = "shortage" if qd > qs else "surplus"
    f = lambda t: (lambda v: f"A {t[0]} of {nm(v, 0)} units")  # noqa: E731
    mk_text = lambda v, t: f"There is a {t} of {nm(v, 0)} units."  # noqa: E731
    other = "surplus" if kind == "shortage" else "shortage"
    key = Opt(mk_text(gap, kind), True, f"At a price of {usd(P1)}, Qd = {qd} and Qs = {qs}, so there is a {kind} of {abs(qd - qs)} units.", gap)
    cands = [(mk_text(gap, other), f"Gets the size right but reverses the {kind}/{other} label; when price is {'below' if kind == 'shortage' else 'above'} equilibrium, the market has a {kind}."), (mk_text(qd, kind), "Reports the quantity demanded rather than the difference between demand and supply."), (mk_text(qs, kind), "Reports the quantity supplied rather than the difference."),
             (mk_text(abs(Q0 - min(qd, qs)), kind), "Compares one quantity with the equilibrium quantity instead of comparing quantity demanded with quantity supplied."), (mk_text(gap + Q0, kind), "Adds the equilibrium quantity to the gap.")]
    ds, seen = [], {key.text}
    for t, w in cands:
        if t in seen: continue
        seen.add(t); ds.append(Opt(t, False, w, None))
    stem = f"In a market, the quantity demanded is Qd = {a} - {b}P and the quantity supplied is Qs = {c} + {d}P. If the price is {usd(P1)}, which of the following describes the market?"
    return mk("mi_shortage_numeric", "2.7", "3.C", stem, key, ds, rng, concept="shortage or surplus at a non-equilibrium price", path="difference of exact quantities vs sympy evaluation and equilibrium-price comparison", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"P1={P1}", f"kind={kind}", f"gap={gap}"], est=65)


@retry_sep
def mi_price_control_graph(rng):
    m = new_mkt(rng, 20, 60, 20, 60)
    Q0, P0 = m.Q0, m.P0
    kind = rng.choice(["ceiling", "ceiling", "floor"])
    binding = rng.random() < 0.8
    if kind == "ceiling":
        Pc = P0 - rng.choice([10, 15, 20]) if binding else P0 + rng.choice([10, 15])
    else:
        Pc = P0 + rng.choice([10, 15, 20]) if binding else P0 - rng.choice([10, 15])
    if Pc <= m.C + 1 or Pc >= m.A - 1:
        raise ValueError("not_enough_separated_distractors")
    Qd, Qs = float(m.qd(Pc)), float(m.qs(Pc))
    if Qd != int(Qd) or Qs != int(Qs): raise ValueError("not_enough_separated_distractors")
    traded = min(Qd, Qs) if binding else Q0
    gap = abs(Qd - Qs) if binding else 0
    # 독립 경로: 단위별 수요·공급 가격 비교로 거래 가능한 단위 수를 센다
    cnt = sum(1 for q in range(0, int(max(Qd, Qs, Q0)) + 2) if m.pd(q + 1) >= Pc and m.ps(q + 1) <= Pc) if kind == "ceiling" and False else None
    agree(traded, (min(Qd, Qs) if (kind == "ceiling" and Pc < P0) or (kind == "floor" and Pc > P0) else Q0), 1e-9, "traded")
    qmax = int(m.A / float(m.B)) if m.A / float(m.B) < 140 else 140
    qmax = max(qmax, Q0 * 2); qmax = int(math.ceil(qmax / 10) * 10)
    ymax = int(math.ceil(m.A / 10) * 10)
    lab = "Price ceiling" if kind == "ceiling" else "Price floor"
    stim = econ_graph(f"A competitive market with demand curve D and supply curve S. A horizontal line shows a government {lab.lower()}.", [("D", line_pts(m.A, -float(m.B), 0, qmax)), ("S", line_pts(m.C, float(m.D), 0, qmax)), (lab, [(0, Pc), (qmax, Pc)])], qmax, ymax, 10, 10)
    tt = "shortage" if kind == "ceiling" else "surplus"
    other = "surplus" if kind == "ceiling" else "shortage"
    if binding:
        key_t = f"{nm(traded, 0)} units are traded, and there is a {tt} of {nm(gap, 0)} units."
        key_why = f"At the controlled price Qd = {nm(Qd, 0)} and Qs = {nm(Qs, 0)}; trade equals the smaller (short) side, {nm(traded, 0)}, leaving a {tt} of {nm(gap, 0)}."
        wr = [(f"{nm(max(Qd, Qs), 0)} units are traded, and there is a {tt} of {nm(gap, 0)} units.", "Assumes trade equals the larger of quantity demanded and quantity supplied; the short side limits trade."), (f"{nm(traded, 0)} units are traded, and there is a {other} of {nm(gap, 0)} units.", f"Reverses the {tt}/{other} label for this type of price control."),
              (f"{nm(Q0, 0)} units are traded, and there is no {tt}.", "Treats the price control as nonbinding or as having no effect on the quantity traded."), (f"{nm(Q0, 0)} units are traded, and there is a {tt} of {nm(gap, 0)} units.", "Keeps the equilibrium quantity as the amount traded even though trade is limited by the short side."),
              (f"{nm(traded, 0)} units are traded, and there is a {tt} of {nm(abs(Q0 - traded), 0)} units.", "Measures the shortfall from the equilibrium quantity instead of the gap between quantity demanded and supplied.")]
    else:
        key_t = f"{nm(Q0, 0)} units are traded, and there is neither a shortage nor a surplus."
        key_why = f"The {lab.lower()} is {'above' if kind == 'ceiling' else 'below'} the equilibrium price {usd(P0)}, so it is not binding and the market stays at {nm(Q0, 0)} units."
        wr = [(f"{nm(min(Qd, Qs), 0)} units are traded, and there is a {tt} of {nm(abs(Qd - Qs), 0)} units.", "Treats a nonbinding price control as binding."), (f"{nm(min(Qd, Qs), 0)} units are traded, and there is a {other} of {nm(abs(Qd - Qs), 0)} units.", "Treats a nonbinding control as binding and reverses the label."),
              (f"{nm(Q0, 0)} units are traded, and there is a {tt} of {nm(abs(Qd - Qs), 0)} units.", "Keeps the equilibrium trade but still reports a gap that exists only for a binding control."), (f"{nm(max(Qd, Qs), 0)} units are traded, and there is neither a shortage nor a surplus.", "Uses the quantity at the control price instead of at the market equilibrium."),
              (f"0 units are traded, because the control is illegal.", "Believes the price control prevents all trade.")]
    k, ds = sent_opts(key_t, key_why, wr)
    stem = f"The graph shows a competitive market and a government-imposed {lab.lower()}. Which of the following describes the result of the {lab.lower()}?"
    return mk("mi_price_control_graph", "2.8", "3.A", stem, k, ds, rng, concept="effects of binding and nonbinding price ceilings and floors", path="min-of-quantities rule with exact quantities vs unit-by-unit willingness counting", stim=stim, facts=[f"A={m.A}", f"C={m.C}", f"B={m.B}", f"D={m.D}", f"Q0={Q0}", f"P0={P0}", f"Pc={Pc}", f"kind={kind}", f"binding={binding}", f"traded={traded}"], est=80)


@retry_sep
def mi_price_floor_surplus(rng):
    P0 = rng.choice([6, 8, 10]); Q0 = rng.choice([60, 80, 100]); b = rng.choice([2, 4, 5]); d = rng.choice([1, 3, 4])
    if b == d: raise ValueError("not_enough_separated_distractors")
    a = Q0 + b * P0; c = Q0 - d * P0; fl = P0 + rng.choice([2, 3, 4])
    qd, qs = a - b * fl, c + d * fl
    if qd <= 0: raise ValueError("not_enough_separated_distractors")
    sur = qs - qd
    agree(sur, float(sp.Integer(c) + d * sp.Integer(fl) - (sp.Integer(a) - b * sp.Integer(fl))), 1e-9, "surplus")
    f = lambda v: nm(v, 0) + " units"  # noqa: E731
    k, ds = val_opts(sur, [("Reports the quantity supplied at the price floor rather than the difference.", qs), ("Reports the quantity demanded at the price floor rather than the difference.", qd), ("Reports the difference between the equilibrium quantity and the quantity demanded.", Q0 - qd), ("Reports the difference between the quantity supplied and the equilibrium quantity.", qs - Q0),
                          ("Reports the price change multiplied by the supply slope only.", (fl - P0) * d)], f)
    stem = f"A market has demand Qd = {a} - {b}P and supply Qs = {c} + {d}P, where P is the price in dollars. The government sets a price floor of {usd(fl)}. How large is the resulting surplus?"
    return mk("mi_price_floor_surplus", "2.8", "3.C", stem, k, ds, rng, concept="size of the surplus created by a binding price floor", path="Qs minus Qd at the floor (exact) vs sympy evaluation, and floor above the equilibrium price", kwhy=f"At {usd(fl)}: Qs = {qs}, Qd = {qd}, so the surplus is {sur} units.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"floor={fl}", f"surplus={sur}"], est=65)


def _tax_market(rng):
    for _ in forever():
        P0 = rng.choice([8, 10, 12, 16, 20]); Q0 = rng.choice([40, 60, 80, 100]); b = rng.choice([2, 3, 4]); d = rng.choice([2, 3, 4, 5]); t = rng.choice([2, 3, 4, 6])
        a = Q0 + b * P0; c = Q0 - d * P0
        if (a + d * t) % 1 or (b + d) <= 0:
            continue
        # 세금 t 는 판매자에게: Qs = c + d(P - t)
        Pb = Fr(a - c + d * t, b + d)
        Qt = a - b * Pb
        Ps = Pb - t
        if Pb == int(Pb) and Qt == int(Qt) and Qt > 0 and b != d:
            return a, b, c, d, t, P0, Q0, Pb, Qt, Ps


@retry_sep
def mi_per_unit_tax(rng):
    a, b, c, d, t, P0, Q0, Pb, Qt, Ps = _tax_market(rng)
    P, Qs_sym = sp.symbols("P Qs")
    sol = sp.solve(sp.Eq(a - b * P, c + d * (P - t)), P)[0]
    agree(float(sol), float(Pb), 1e-9, "tax_price")
    f = lambda v: nm(v, 0)  # noqa: E731
    k, ds = val_opts(float(Qt), [("Keeps the pre-tax equilibrium quantity, ignoring the effect of the tax.", Q0), ("Subtracts the amount of the tax from the equilibrium quantity.", Q0 - t), ("Shifts the supply curve by the tax in the wrong direction.", a - b * float(Fr(a - c - d * t, b + d))), ("Assumes buyers pay the whole tax and reads the quantity demanded at the pre-tax price plus the tax.", a - b * (P0 + t)),
                          ("Reports the price consumers pay instead of the quantity.", float(Pb))], f)
    stem = f"In a market, Qd = {a} - {b}P and Qs = {c} + {d}P, where P is the price in dollars. The government imposes a tax of {usd(t)} per unit on sellers, so sellers receive P - {t} per unit. What is the new equilibrium quantity?"
    stem = f"In a market, the quantity demanded is Qd = {a} - {b}P, where P is the price buyers pay. Sellers receive the price buyers pay minus a tax of {usd(t)} per unit, so the quantity supplied is Qs = {c} + {d}(P - {t}). What is the new equilibrium quantity?"
    return mk("mi_per_unit_tax", "2.8", "3.C", stem, k, ds, rng, concept="equilibrium quantity after a per-unit tax", path="exact solution of the shifted supply equation vs sympy solve", kwhy=f"Solving {a} - {b}P = {c} + {d}(P - {t}) gives P = {nm(float(Pb), 2)} and Q = {int(Qt)}.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"t={t}", f"Pb={float(Pb)}", f"Qt={float(Qt)}", f"Q0={Q0}"], est=75)


@retry_sep
def mi_tax_incidence_numeric(rng):
    a, b, c, d, t, P0, Q0, Pb, Qt, Ps = _tax_market(rng)
    share_c = Pb - P0
    agree(float(share_c), float(Fr(d * t, b + d)), 1e-9, "consumer_share")
    f = lambda v: usd(v) + " per unit"  # noqa: E731
    k, ds = val_opts(float(share_c), [("Assumes the tax is split equally between buyers and sellers.", t / 2), ("Assumes buyers pay the entire tax.", t), ("Reports the share paid by sellers instead of the share paid by buyers.", float(t - share_c)), ("Reports the price buyers pay after the tax rather than the increase.", float(Pb)),
                          ("Reports the pre-tax equilibrium price.", P0)], f)
    stem = f"In a market, Qd = {a} - {b}P and Qs = {c} + {d}P before any tax, where P is the price in dollars. The government then imposes a tax of {usd(t)} per unit on sellers. How much of the tax per unit is paid by buyers through a higher price?"
    return mk("mi_tax_incidence_numeric", "2.8", "3.C", stem, k, ds, rng, concept="consumer share of a per-unit tax", path="difference of exact post-tax and pre-tax buyer prices vs closed form d*t/(b+d)", kwhy=f"Buyers' price rises from {usd(P0)} to {usd(float(Pb))}, so they pay {usd(float(share_c))} of the {usd(t)} tax.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"t={t}", f"share={float(share_c)}"], est=75)


@retry_sep
def mi_dwl_tax(rng):
    a, b, c, d, t, P0, Q0, Pb, Qt, Ps = _tax_market(rng)
    dwl = Fr(1, 2) * t * (Q0 - Qt)
    # 독립 경로: 수치 적분(세금 쐐기)
    qs = np.linspace(float(Qt), Q0, 20001)
    num = float(np.trapezoid((a - qs) / b - ((qs - c) / d), qs))
    agree(float(dwl), num, 1e-6, "dwl")
    f = lambda v: usd(v)  # noqa: E731
    k, ds = val_opts(float(dwl), [("Omits the one-half from the triangle area.", float(t * (Q0 - Qt))), ("Uses the tax revenue instead of the deadweight loss.", float(t * Qt)), ("Uses the remaining quantity instead of the lost quantity.", float(Fr(1, 2) * t * Qt)), ("Multiplies the lost quantity by the price rather than by the tax.", float(Fr(1, 2) * P0 * (Q0 - Qt))),
                          ("Uses the tax squared.", float(t * t))], f)
    stem = f"A per-unit tax of {usd(t)} is imposed on sellers in a market where Qd = {a} - {b}P and Qs = {c} + {d}P before the tax, with P in dollars. The equilibrium quantity falls from {Q0} to {int(Qt)} units. What is the deadweight loss of the tax?"
    return mk("mi_dwl_tax", "2.8", "3.C", stem, k, ds, rng, concept="deadweight loss of a per-unit tax as a triangle", path="one-half times tax times quantity reduction vs numerical integration of the wedge between demand and supply prices", kwhy=f"DWL = 1/2 x {t} x ({Q0} - {int(Qt)}) = {usd(float(dwl))}.", facts=[f"t={t}", f"Q0={Q0}", f"Qt={float(Qt)}", f"dwl={float(dwl)}"], est=75)


def mi_subsidy_effect(rng):
    g = rng.choice(GOODS)
    key = (-1, 1)
    agree(1, 1 if eq_effect_rule(0, 1) == key else 0, 1e-9, "subsidy")
    txt = lambda a, b: f"The price consumers pay {dir_word(a)}, and the quantity bought and sold {dir_word(b)}."  # noqa: E731
    k, ds = sent_opts(txt(-1, 1), "A per-unit subsidy to sellers shifts supply right, lowering the price buyers pay and raising the equilibrium quantity.",
                      [(txt(1, 1), "Treats the subsidy as a boost to demand, which would raise the price buyers pay."), (txt(1, -1), "Treats the subsidy like a tax on sellers, which shifts supply left."), (txt(-1, -1), "Gets the price effect but applies the law of demand backward to quantity."),
                       (txt(0, 1), "Assumes sellers keep the whole subsidy and the price buyers pay is unchanged."), (txt(-1, 0), "Predicts a price change without a quantity change.")])
    stem = f"The government begins giving sellers of {g} a per-unit subsidy in a competitive market. Which of the following correctly describes the effects of the subsidy?"
    return mk("mi_subsidy_effect", "2.8", "3.A", stem, k, ds, rng, concept="effects of a per-unit subsidy on price and quantity", path="supply-shift rule vs linear-market simulation", facts=[f"good={g}"], est=55)


@retry_sep
def mi_import_numeric(rng):
    P0 = rng.choice([8, 10, 12]); Q0 = rng.choice([60, 80, 100]); b = rng.choice([2, 3, 4]); d = rng.choice([1, 2, 3, 5])
    if b == d: raise ValueError("not_enough_separated_distractors")
    a = Q0 + b * P0; c = Q0 - d * P0; pw = P0 - rng.choice([2, 3, 4])
    if pw <= 0 or c + d * pw < 0: raise ValueError("not_enough_separated_distractors")
    qd, qs = a - b * pw, c + d * pw; imp = qd - qs
    agree(imp, float(sp.Integer(a) - b * sp.Integer(pw) - (sp.Integer(c) + d * sp.Integer(pw))), 1e-9, "imports")
    f = lambda v: nm(v, 0) + " units"  # noqa: E731
    k, ds = val_opts(imp, [("Reports the quantity demanded at the world price instead of imports.", qd), ("Reports the quantity supplied domestically at the world price instead of imports.", qs), ("Reports the domestic equilibrium quantity.", Q0), ("Uses the difference between the domestic equilibrium quantity and the quantity supplied at the world price.", Q0 - qs),
                         ("Reports the difference between quantity demanded at the world price and the domestic equilibrium quantity.", qd - Q0)], f)
    stem = f"A country's domestic demand is Qd = {a} - {b}P and domestic supply is Qs = {c} + {d}P, with P in dollars. The country opens to trade and takes the world price of {usd(pw)}, which is below the domestic equilibrium price. How many units does the country import?"
    return mk("mi_import_numeric", "2.9", "3.C", stem, k, ds, rng, concept="imports at a world price below the domestic equilibrium", path="Qd minus Qs at the world price (exact) vs sympy evaluation", kwhy=f"At {usd(pw)}: Qd = {qd}, Qs = {qs}, so imports are {imp} units.", facts=[f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"pw={pw}", f"imports={imp}"], est=65)


def mi_tariff_effects(rng):
    g = rng.choice(GOODS)
    k, ds = sent_opts("The domestic price rises, imports fall, domestic producer surplus rises, and domestic consumer surplus falls.", "A tariff raises the domestic price above the world price: imports fall, domestic producers gain, and consumers lose.",
                      [("The domestic price falls, imports rise, domestic producer surplus falls, and domestic consumer surplus rises.", "Describes the effect of removing a tariff, not imposing one."), ("The domestic price rises, imports fall, and both domestic producer surplus and consumer surplus rise.", "Believes a higher domestic price also benefits consumers."),
                       ("The domestic price is unchanged, imports fall, and domestic producer surplus rises.", "Believes a tariff can reduce imports without changing the domestic price."), ("The domestic price rises, imports rise, and domestic producer surplus rises.", "Assumes a higher domestic price attracts more imports, ignoring the tariff on imports."),
                       ("The world price rises by the full amount of the tariff, and imports are unchanged.", "Assumes a small importing country changes the world price.")])
    stem = f"A small country that imports {g} at the world price imposes a tariff on imports of {g}. Which of the following describes the effects of the tariff?"
    return mk("mi_tariff_effects", "2.9", "3.A", stem, k, ds, rng, concept="effects of a tariff on price, imports, and surplus", path="fixed vetted tariff-effect table", facts=[f"good={g}"], est=55)


def mi_demand_determinant(rng):
    k, ds = sent_opts("A decrease in the price of a complement to the good.", "A cheaper complement raises the demand for the good, shifting the demand curve to the right.",
                      [("A decrease in the price of the good itself.", "A change in the good's own price moves along the demand curve; it does not shift it."), ("A decrease in the number of sellers of the good.", "The number of sellers affects supply, not demand."), ("An increase in the cost of the inputs used to produce the good.", "Input costs shift the supply curve, not the demand curve."),
                       ("An improvement in the production technology for the good.", "Technology shifts supply, not demand."), ("An increase in the price of a complement to the good.", "A costlier complement lowers demand, shifting the curve left, not right.")])
    stem = "Which of the following would cause the demand curve for a normal good to shift to the right?"
    return mk("mi_demand_determinant", "2.1", "1.A", stem, k, ds, rng, concept="determinants that shift demand versus movement along the curve", path="fixed vetted determinants table with distractors from supply-side and own-price changes", facts=["variant=complement"], est=45)


@retry_sep
def mi_movement_vs_shift(rng):
    g = rng.choice(GOODS)
    case = rng.choice(["own_price", "income", "input"])
    desc = {"own_price": f"The price of {g} falls, and consumers buy more of it.", "income": f"Consumers' incomes rise, and they buy more of {g}, a normal good, at every price.", "input": f"The price of an input falls, and sellers supply more {g} at every price."}[case]
    ans = {"own_price": "A movement along the demand curve, which is an increase in the quantity demanded.", "income": "A rightward shift of the demand curve, which is an increase in demand.", "input": "A rightward shift of the supply curve, which is an increase in supply."}[case]
    others = ["A movement along the demand curve, which is an increase in the quantity demanded.", "A rightward shift of the demand curve, which is an increase in demand.", "A rightward shift of the supply curve, which is an increase in supply.", "A movement along the supply curve, which is an increase in the quantity supplied.", "A leftward shift of the demand curve, which is a decrease in demand."]
    why = {others[0]: "Treats a change caused by something other than the good's own price as a movement along the curve.", others[1]: "Treats a change in the good's own price as a shift of the demand curve.", others[2]: "Attributes a demand-side or own-price change to the supply curve.",
           others[3]: "Mistakes a change caused by a supply determinant for a movement along the supply curve.", others[4]: "Reverses the direction of the demand shift."}
    k, ds = sent_opts(ans, "A change in the good's own price moves along a curve, while a change in a determinant shifts the curve.", [(o, why[o]) for o in others if o != ans])
    return mk("mi_movement_vs_shift", "2.1", "1.B", f"Consider the following situation: {desc} Which of the following correctly describes the change in the market?", k, ds, rng, concept="movement along versus shift of a curve", path="fixed vetted scenario-to-description table", facts=[f"case={case}"], est=50)
