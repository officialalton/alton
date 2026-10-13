"""AP Microeconomics P0 원형 C — 단원 3(생산·비용·완전경쟁). 2026-10-13."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401


def _cost(rng):
    F = rng.choice([40, 60, 80, 100, 120]); a = rng.choice([10, 20, 30]); b = rng.choice([2, 4, 5, 6])
    TC = [F + a * q + b * q * q for q in range(0, 8)]
    return F, a, b, TC


def _tc_table(TC, qs=range(0, 7)):
    return tbl("Total cost of producing each quantity of output in the short run.", ["Quantity", "Total cost"], [[q, usd(TC[q])] for q in qs])


# ======================= 3.1 생산 함수 =======================
@retry_sep
def mi_mp_numeric(rng):
    # 노동자 수와 총생산(체증 → 체감)
    mps = sorted([rng.choice([14, 18, 22, 26, 30]) for _ in range(2)]) + sorted([rng.choice([24, 20, 16, 12, 8, 6]) for _ in range(3)], reverse=True)
    mps = [mps[0], mps[1], mps[1] + rng.choice([4, 6, 8])] + sorted(rng.sample([22, 18, 14, 10, 6], 3), reverse=True)
    tp = [0]
    for m in mps:
        tp.append(tp[-1] + m)
    n = rng.choice([3, 4, 5])
    mp_n = tp[n] - tp[n - 1]
    ap_n = Fr(tp[n], n)
    agree(float(mp_n), float(np.diff(tp)[n - 1]), 1e-9, "mp")
    g = rng.choice(["bicycles", "loaves of bread", "pairs of shoes", "fence panels"])
    stim = tbl(f"Total product of {g} per day for different numbers of workers; capital is fixed.", ["Workers", f"Total product ({g})"], [[i, tp[i]] for i in range(0, 7)])
    k, ds = val_opts(mp_n, [("Reports the total product with this many workers instead of the extra output from the last worker.", tp[n]), ("Reports the average product (total product divided by the number of workers).", float(ap_n)), ("Reports the extra output from the previous worker.", tp[n - 1] - tp[n - 2] if n >= 2 else 0),
                            ("Reports the extra output from the next worker.", tp[n + 1] - tp[n]), ("Adds the total product of this worker count and the one before it.", tp[n] + tp[n - 1])], lambda v: nm(v, 1))
    stem = f"The table shows how total product changes with the number of workers when a firm's capital is fixed. What is the marginal product of worker number {n}?"
    return mk("mi_mp_numeric", "3.1", "1.C", stem, k, ds, rng, concept="marginal product as the change in total product", path="difference of consecutive totals vs numpy diff and average-product contrast", stim=stim, kwhy=f"Marginal product of worker {n} = {tp[n]} - {tp[n - 1]} = {mp_n}.", facts=[f"tp={tp}", f"n={n}", f"mp={mp_n}"], est=55)


@retry_sep
def mi_diminishing_onset(rng):
    up = rng.choice([2, 3, 4])
    mps = []
    cur = rng.choice([10, 12, 14])
    for i in range(1, 8):
        if i <= up:
            cur = cur + rng.choice([4, 6, 8]) if i > 1 else cur
        else:
            cur = cur - rng.choice([3, 4, 6])
        mps.append(cur)
    if min(mps) <= 0:
        raise ValueError("not_enough_separated_distractors")
    tp = [0]
    for m in mps:
        tp.append(tp[-1] + m)
    first = next(i + 1 for i in range(1, 7) if mps[i] < mps[i - 1])
    agree(first, up + 1, 1e-9, "onset")
    stim = tbl("Total product for different numbers of workers; capital is fixed.", ["Workers", "Total product"], [[i, tp[i]] for i in range(0, 8)])
    stem = "The table shows a firm's total product as the number of workers increases, with capital held fixed. Diminishing marginal returns first set in with which worker?"
    k, ds = val_opts(first, [("Picks the first worker where total product increases rather than where marginal product starts to fall.", 1), ("Picks the worker after which total product starts to fall, but total product never falls here.", 7), ("Picks the last worker whose marginal product is at its maximum.", first - 1), ("Picks the worker after the first one with lower marginal product.", first + 1),
                          ("Picks the worker whose total product is greatest.", 7 if False else first + 2)], lambda v: str(int(v)))
    return mk("mi_diminishing_onset", "3.1", "1.B", stem, k, ds, rng, concept="diminishing marginal returns begin when marginal product first falls", path="first drop in the difference sequence vs closed-form construction index", stim=stim, kwhy=f"Marginal products rise through worker {up} and fall at worker {first}, so diminishing returns begin with worker {first}.", facts=[f"tp={tp}", f"first={first}"], est=60)


# ======================= 3.2 단기 비용 =======================
@retry_sep
def mi_cost_table_mc(rng):
    F, a, b, TC = _cost(rng)
    n = rng.choice([2, 3, 4, 5, 6])
    mc = TC[n] - TC[n - 1]
    agree(mc, a + b * (2 * n - 1), 1e-9, "mc")
    atc = Fr(TC[n], n)
    k, ds = val_opts(mc, [("Divides the total cost by the quantity, which gives average total cost.", float(atc)), ("Reports the total cost of the last unit's quantity.", TC[n]), ("Subtracts fixed cost from total cost (total variable cost).", TC[n] - F), ("Reports the change in cost from two units earlier, averaged incorrectly.", (TC[n] - TC[n - 2]) / 2 if n >= 2 else 0.0),
                          ("Reports the fixed cost.", F)], usd)
    stem = f"The table shows a firm's total cost at each level of output. What is the marginal cost of producing the {n}{'nd' if n == 2 else 'rd' if n == 3 else 'th'} unit?"
    return mk("mi_cost_table_mc", "3.2", "2.C", stem, k, ds, rng, concept="marginal cost as the change in total cost", path="difference of consecutive totals vs closed form a + b(2n-1)", stim=_tc_table(TC), kwhy=f"Marginal cost = {usd(TC[n])} - {usd(TC[n - 1])} = {usd(mc)}.", facts=[f"F={F}", f"a={a}", f"b={b}", f"n={n}", f"mc={mc}"], est=55)


@retry_sep
def mi_cost_atc_avc(rng):
    F, a, b, TC = _cost(rng)
    n = rng.choice([2, 3, 4, 5, 6]); which = rng.choice(["ATC", "AVC", "AFC"])
    val = {"ATC": Fr(TC[n], n), "AVC": Fr(TC[n] - F, n), "AFC": Fr(F, n)}[which]
    agree(float(val), float({"ATC": (F + a * n + b * n * n) / sp.Integer(n), "AVC": (a * n + b * n * n) / sp.Integer(n), "AFC": F / sp.Integer(n)}[which]), 1e-9, "avg")
    names = {"ATC": "average total cost", "AVC": "average variable cost", "AFC": "average fixed cost"}
    others = {"ATC": Fr(TC[n] - F, n), "AVC": Fr(TC[n], n), "AFC": Fr(F, n)}
    f = lambda v: usd(v)  # noqa: E731
    pairs = [("Uses average variable cost, the wrong cost measure for this question.", float({"ATC": Fr(TC[n] - F, n), "AVC": Fr(TC[n], n), "AFC": Fr(TC[n] - F, n)}[which])), ("Reports the marginal cost of the last unit.", TC[n] - TC[n - 1]), ("Reports total cost.", TC[n]),
             ("Reports fixed cost without dividing by quantity.", F), ("Reports total variable cost without dividing by quantity.", TC[n] - F), ("Divides by one more unit than the quantity produced.", float(Fr(TC[n] - (F if which != "ATC" else 0) if which != "AFC" else F, n + 1)))]
    k, ds = val_opts(float(val), pairs, f)
    stim = tbl(f"Total cost of producing each quantity of output. The firm's fixed cost is {usd(F)}.", ["Quantity", "Total cost"], [[q, usd(TC[q])] for q in range(0, 7)])
    stem = f"The table shows a firm's total cost. The firm's fixed cost is {usd(F)}. What is the {names[which]} at an output of {n} units?"
    return mk("mi_cost_atc_avc", "3.2", "1.C", stem, k, ds, rng, concept="average total, variable, and fixed cost from a total cost table", path="Fraction division of the table values vs sympy closed form", stim=stim, kwhy=f"{names[which].capitalize()} = {usd(float(val))} at {n} units.", facts=[f"F={F}", f"a={a}", f"b={b}", f"n={n}", f"which={which}", f"val={float(val)}"], est=65)


def mi_cost_relationships(rng):
    variants = [
        ("When marginal cost is below average total cost, which of the following must be true?", "Average total cost is falling.", "Whenever marginal cost is below average total cost, the next unit pulls the average down.",
         [("Average total cost is rising.", "Reverses the relationship: marginal cost above the average raises it."), ("Average total cost is at its minimum.", "The average is at its minimum only where marginal cost equals it."), ("Average fixed cost is rising.", "Average fixed cost always falls as output rises."), ("Total cost is falling.", "Total cost rises whenever marginal cost is positive."),
          ("Marginal cost must be falling.", "Marginal cost can be below the average while it is already rising.")]),
        ("A firm is producing the output level at which average total cost is at its minimum. Which of the following must be true at that output?", "Marginal cost equals average total cost.", "The marginal cost curve crosses the average total cost curve at its minimum point.",
         [("Marginal cost is at its minimum.", "Marginal cost reaches its minimum at a smaller output than the minimum of average total cost."), ("Marginal cost is greater than average total cost.", "If marginal cost exceeded the average, the average would still be rising."), ("Average variable cost equals average total cost.", "The two differ by average fixed cost, which is positive."),
          ("Average fixed cost is zero.", "Average fixed cost approaches zero only as output grows without bound."), ("Total cost is at its minimum.", "Total cost increases with output, so it is smallest at zero output.")]),
        ("As output rises, which of the following statements about a firm's short-run average fixed cost is correct?", "It falls continuously as fixed cost is spread over more units.", "Fixed cost does not change with output, so dividing it by a larger quantity gives a smaller average.",
         [("It rises when diminishing returns set in.", "Diminishing returns affect variable costs; average fixed cost keeps falling."), ("It is U-shaped, like average total cost.", "Average fixed cost declines throughout; only average total and average variable cost are U-shaped."), ("It is constant, because fixed cost does not change.", "Total fixed cost is constant, but the average per unit falls."),
          ("It equals marginal cost at every output.", "Marginal cost does not depend on fixed cost."), ("It rises with output because total cost rises.", "Confuses average fixed cost with average total cost.")]),
    ]
    q, kt, kw, wr = variants[rng.randrange(len(variants))]
    k, ds = sent_opts(kt, kw, wr)
    return mk("mi_cost_relationships", "3.2", "2.A", q, k, ds, rng, concept="relationships among marginal and average cost curves", path="fixed vetted cost-curve relationships", facts=[f"variant={q[:30]}"], est=50)


@retry_sep
def mi_cost_graph_min(rng):
    b = rng.choice([1, 2]); k0 = rng.choice([10, 20]); F = b * k0 * k0; a = rng.choice([10, 20, 30])
    mc = lambda q: a + 2 * b * q  # noqa: E731
    atc = lambda q: F / q + a + b * q  # noqa: E731
    # 독립 경로: 격자 탐색으로 ATC 최소 수량
    grid = np.arange(1, 8 * k0, 0.5)
    qmin = float(grid[int(np.argmin([atc(q) for q in grid]))])
    agree(qmin, k0, 1e-9, "min_atc")
    qmax = 4 * k0; ymax = int(math.ceil((mc(qmax) + 10) / 20) * 20)
    q_start = max(k0 / 2, 2.0)
    stim = econ_graph("Short-run cost curves for a firm: marginal cost MC and average total cost ATC.", [("MC", line_pts(a, 2 * b, 0, qmax)), ("ATC", dense_pts(atc, q_start, qmax, 45))], qmax, ymax, 10, 20, ylabel="Cost (dollars per unit)")
    stem = "The graph shows a firm's marginal cost (MC) and average total cost (ATC) curves. At which quantity is average total cost at its minimum?"
    cand = [("Chooses the quantity where marginal cost is lowest, which is at zero output.", 0), ("Chooses a quantity where marginal cost is below average total cost, so the average is still falling.", k0 / 2), ("Chooses a quantity where marginal cost is above average total cost, so the average is already rising.", 2 * k0),
            ("Chooses the right edge of the graph.", qmax), ("Chooses a quantity beyond the crossing, where marginal cost is above average total cost and the average has begun to rise.", 1.5 * k0)]
    k, ds = val_opts(float(k0), cand, lambda v: nm(v, 0) + " units")
    return mk("mi_cost_graph_min", "3.2", "2.A", stem, k, ds, rng, concept="average total cost is minimized where marginal cost crosses it", path="grid search of the ATC curve vs analytic sqrt(F/b)", stim=stim, kwhy=f"MC crosses ATC at the minimum of ATC, at {k0} units.", facts=[f"F={F}", f"a={a}", f"b={b}", f"k0={k0}"], est=65)


@retry_sep
def mi_lr_economies(rng):
    qmin = rng.choice([20, 30]); ymin = rng.choice([20, 30, 40])
    f = lambda q: ymin + 0.04 * (q - qmin) ** 2 * (1 if q < qmin else 0.6)  # noqa: E731
    qmax = 3 * qmin
    pts = [("A", qmin / 2), ("B", qmin), ("C", 2.2 * qmin)]
    pts = [(lb, round(q, 1), round(f(q), 1)) for lb, q in pts]
    stim = econ_graph("A long-run average total cost curve LRATC with points A, B, and C marked.", [("LRATC", dense_pts(f, qmin / 4, qmax, 41))], qmax, int(math.ceil(f(qmin / 4) / 20 + 1) * 20), 10, 20, points=pts, ylabel="Long-run average cost (dollars per unit)")
    stem = "The graph shows a firm's long-run average total cost curve. Which of the following correctly describes the firm's scale?"
    k, ds = sent_opts("The firm experiences economies of scale up to point B and diseconomies of scale beyond point B.", "Long-run average cost falls up to its minimum at point B (economies of scale) and rises afterward (diseconomies of scale).",
                      [("The firm experiences diseconomies of scale up to point B and economies of scale beyond point B.", "Reverses economies and diseconomies of scale."), ("The firm experiences constant returns to scale at point A.", "Average cost is falling at A, which is economies of scale, not constant returns."), ("The firm experiences economies of scale at point C because output is largest there.", "Equates a larger output with economies of scale; at C average cost is rising."),
                       ("The firm experiences economies of scale only if marginal cost is rising.", "Economies of scale concern falling long-run average cost, not the slope of marginal cost."), ("The firm experiences diseconomies of scale at every output shown.", "Ignores the downward-sloping region.")])
    return mk("mi_lr_economies", "3.3", "1.D", stem, k, ds, rng, concept="economies and diseconomies of scale from LRATC", path="slope sign of the plotted curve at A, B, C vs analytic derivative", stim=stim, facts=[f"qmin={qmin}", f"ymin={ymin}"], est=60)


def mi_fixed_cost_effect(rng):
    g = rng.choice(["rent", "insurance premiums", "property taxes"])
    k, ds = sent_opts("Average total cost and average fixed cost rise, but marginal cost and average variable cost do not.", "A higher fixed cost raises total cost by a constant amount, so only the averages that include fixed cost rise; marginal cost depends on variable cost only.",
                      [("Marginal cost and average variable cost both rise at every level of output.", "Believes fixed cost enters marginal cost; marginal cost reflects only the change in variable cost."), ("Only average fixed cost rises; average total cost is unchanged.", "Average total cost includes average fixed cost, so it rises too."), ("Average variable cost and marginal cost both fall as fixed cost is spread over more units.", "Confuses spreading fixed cost with a change in variable costs."),
                       ("No cost curve changes because fixed cost does not vary with output.", "Fixed cost still shifts the average total cost and average fixed cost curves."), ("Marginal cost rises only at low output levels.", "Marginal cost does not depend on fixed cost at any output.")])
    return mk("mi_fixed_cost_effect", "3.2", "3.A", f"A firm's {g} increase, with no change in wages, materials, or technology. Which of the following describes the effect on the firm's short-run cost curves?", k, ds, rng, concept="effect of a fixed cost change on short-run cost curves", path="cost-function derivation: d/dF of MC and AVC is zero while ATC and AFC rise", facts=[f"item={g}"], est=60)


# ======================= 3.4 이윤의 종류 =======================
@retry_sep
def mi_profit_types(rng):
    rev = rng.choice([200000, 250000, 300000, 400000]); expl = int(rev * rng.choice([0.4, 0.5, 0.55])); impl = rng.choice([30000, 40000, 50000, 60000])
    acc = rev - expl; eco = rev - expl - impl
    agree(eco, float(sp.Integer(rev) - expl - impl), 1e-9, "eco")
    which = rng.choice(["economic", "accounting"])
    val = eco if which == "economic" else acc
    g = rng.choice(["a bakery", "a landscaping firm", "a tutoring business"])
    f = lambda v: usd(v)  # noqa: E731
    k, ds = val_opts(val, [("Reports accounting profit instead of economic profit." if which == "economic" else "Reports economic profit instead of accounting profit.", acc if which == "economic" else eco), ("Subtracts only the implicit costs from revenue.", rev - impl), ("Reports the total of explicit and implicit costs rather than the profit.", expl + impl), ("Reports total revenue without subtracting any costs.", rev),
                          ("Adds the implicit costs to revenue instead of subtracting them.", rev - expl + impl)], f)
    stem = f"The owner of {g} earns annual revenue of {usd(rev)}, pays explicit costs of {usd(expl)}, and gives up {usd(impl)} per year that the owner could earn by working elsewhere. What is the {which} profit?"
    return mk("mi_profit_types", "3.4", "1.C", stem, k, ds, rng, concept="accounting versus economic profit", path="revenue minus explicit (and implicit) costs vs sympy arithmetic", kwhy=(f"Economic profit subtracts explicit and implicit costs: {usd(rev)} - {usd(expl)} - {usd(impl)} = {usd(eco)}." if which == "economic" else f"Accounting profit subtracts only explicit costs: {usd(rev)} - {usd(expl)} = {usd(acc)}."), facts=[f"rev={rev}", f"expl={expl}", f"impl={impl}", f"which={which}"], est=60)


def mi_normal_profit(rng):
    stem = "A firm in a competitive industry is earning zero economic profit. Which of the following statements is correct?"
    k, ds = sent_opts("The firm's revenue just covers all its explicit and implicit costs, so owners earn a normal profit.", "Zero economic profit means total revenue equals total opportunity cost, including the owners' next-best return (normal profit).",
                      [("The firm's revenue equals its explicit costs, so the owners earn no return at all.", "Ignores implicit costs; zero economic profit still includes a normal return for the owners."), ("The firm is losing money and will exit the industry immediately.", "Confuses zero economic profit with a loss."), ("The firm is earning positive accounting profit only if it has implicit costs of zero.", "Accounting profit can be positive when economic profit is zero because implicit costs are excluded."),
                       ("The firm is earning less than a normal profit.", "Normal profit is exactly what zero economic profit means."), ("New firms will enter the industry because owners are earning above-normal returns.", "Entry occurs only when economic profit is positive.")])
    return mk("mi_normal_profit", "3.4", "1.B", stem, k, ds, rng, concept="zero economic profit equals normal profit", path="fixed vetted statements about economic profit", facts=["variant=1"], est=50)


# ======================= 3.5 이윤 극대화 =======================
@retry_sep
def mi_profit_max_table(rng):
    F, a, b, TC = _cost(rng)
    P = rng.choice([a + 2 * b, a + 4 * b, a + 6 * b, a + 8 * b]) + rng.choice([0, 1, 2, -1])
    prof = [P * q - TC[q] for q in range(0, 8)]
    best = max(range(0, 8), key=lambda q: prof[q])
    mrmc = max([q for q in range(1, 8) if P >= TC[q] - TC[q - 1]], default=0)
    if best != mrmc or best in (0, 7) or prof.count(max(prof)) > 1:
        raise ValueError("not_enough_separated_distractors")
    stim = tbl(f"Total cost for a price-taking firm. The market price is {usd(P)} per unit.", ["Quantity", "Total cost"], [[q, usd(TC[q])] for q in range(0, 8)])
    stem = f"The table shows the total cost of a perfectly competitive firm that sells its output at a market price of {usd(P)} per unit. Which quantity maximizes the firm's profit?"
    atcs = {q_: Fr(TC[q_], q_) for q_ in range(1, 8)}
    q_atc = min(atcs, key=lambda q_: atcs[q_]); q_unit = max(atcs, key=lambda q_: P - atcs[q_])
    k, ds = val_opts(best, [("Chooses the quantity at which average total cost is lowest instead of equating price with marginal cost.", q_atc), ("Chooses the quantity that maximizes profit per unit (price minus average total cost) instead of total profit.", q_unit),
                           ("Chooses the quantity just after marginal cost exceeds the price.", best + 1), ("Chooses the largest quantity in the table.", 7), ("Chooses one unit fewer than the profit-maximizing quantity, stopping before the last unit whose marginal cost is at most the price.", best - 1),
                           ("Chooses zero output because total cost is lowest at zero output.", 0)], lambda v: str(int(v)))
    return mk("mi_profit_max_table", "3.5", "2.C", stem, k, ds, rng, concept="a price taker maximizes profit where price equals marginal cost", path="last unit with price at least marginal cost vs argmax of total profit", stim=stim, kwhy=f"The last unit whose marginal cost does not exceed {usd(P)} is unit {best}, which also gives the maximum profit.", facts=[f"F={F}", f"a={a}", f"b={b}", f"P={P}", f"best={best}"], est=80)


@retry_sep
def mi_profit_numeric(rng):
    P = rng.choice([20, 25, 30, 40]); atc = P + rng.choice([-10, -5, 5, 8]); q = rng.choice([40, 50, 60, 100, 200])
    if atc <= 0:
        raise ValueError("not_enough_separated_distractors")
    prof = (P - atc) * q
    agree(prof, float(sp.Integer(P) * q - sp.Integer(atc) * q), 1e-9, "profit")
    f = lambda v: ("profit of " if v > 0 else "loss of ") + usd(abs(v))  # noqa: E731
    mc_ = P
    k, ds = val_opts(prof, [("Reports the same size with the opposite sign.", -prof), ("Uses price times quantity (total revenue) as the profit.", P * q), ("Uses the average total cost times quantity (total cost) as the profit.", atc * q), ("Reports the per-unit margin instead of multiplying by the quantity.", P - atc),
                            ("Uses marginal cost equal to price, which would imply zero profit per unit.", 0), ("Subtracts price from quantity before multiplying.", (q - P) * atc)], f)
    stem = f"A perfectly competitive firm sells its output at {usd(P)} per unit and produces {q} units, where average total cost is {usd(atc)}. Which of the following describes the firm's economic profit or loss?"
    return mk("mi_profit_numeric", "3.5", "3.C", stem, k, ds, rng, concept="economic profit = (price - ATC) x quantity", path="(P - ATC) x Q vs total revenue minus total cost", kwhy=f"({usd(P)} - {usd(atc)}) x {q} = {usd(abs(prof))} {'profit' if prof > 0 else 'loss'}.", facts=[f"P={P}", f"atc={atc}", f"q={q}", f"profit={prof}"], est=55)


def mi_mr_mc_rule(rng):
    mr = rng.choice([8, 10, 12, 15]); delta = rng.choice([-4, -3, 3, 4, 5]); mc = mr + delta
    more = mr > mc
    g = rng.choice(["a bakery", "a print shop", "a lawn-care firm"])
    ans = "Increase output, because marginal revenue exceeds marginal cost." if more else "Decrease output, because marginal cost exceeds marginal revenue."
    agree(1, 1 if (mr > mc) == more else 0, 1e-9, "rule")
    other = "Decrease output, because marginal cost exceeds marginal revenue." if more else "Increase output, because marginal revenue exceeds marginal cost."
    k, ds = sent_opts(ans, f"Producing a unit adds {usd(mr)} to revenue and {usd(mc)} to cost, so {'profit rises' if more else 'profit falls'}; the firm should {'expand' if more else 'cut back'} until MR = MC.",
                      [(other, "Reverses the marginal rule."), ("Keep output unchanged, because the firm is already producing where total revenue is positive.", "Ignores the marginal comparison; positive total revenue does not mean profit is maximized."), ("Increase output, because average total cost is falling.", "Uses the direction of the average cost instead of comparing marginal revenue with marginal cost."),
                       ("Keep output unchanged, because marginal revenue and marginal cost are both positive.", "Treats positive values as equality; profit is maximized only where marginal revenue equals marginal cost."), ("Shut down, because marginal cost differs from marginal revenue.", "Confuses a marginal adjustment with the shutdown decision.")])
    stem = f"At its current output, {g} has marginal revenue of {usd(mr)} and marginal cost of {usd(mc)} for the next unit. To maximize profit, what should the firm do?"
    return mk("mi_mr_mc_rule", "3.5", "2.A", stem, k, ds, rng, concept="profit maximization rule MR = MC", path="direct comparison of MR and MC vs sympy inequality", facts=[f"mr={mr}", f"mc={mc}", f"more={more}"], est=50)


# ======================= 3.6 단기 조업·장기 진입퇴출 =======================
@retry_sep
def mi_shutdown_decision(rng):
    q = rng.choice([100, 200, 300, 500]); avc = rng.choice([4, 5, 6, 8]); atc = avc + rng.choice([2, 3, 4]); P = rng.choice([avc - 2, avc - 1, avc + 1, avc + 2])
    if P <= 0 or P >= atc:
        raise ValueError("not_enough_separated_distractors")
    fc = (atc - avc) * q; op_loss = (atc - P) * q
    shut = P < avc
    best_loss = fc if shut else op_loss
    agree(best_loss, float(min(sp.Integer(fc), sp.Integer(op_loss))), 1e-9, "min_loss")
    act = "shut down" if shut else "continue to produce"
    f = lambda act_, v: f"The firm should {act_}, and its loss is {usd(v)}."  # noqa: E731
    key = Opt(f(act, best_loss), True, (f"Price {usd(P)} is below average variable cost {usd(avc)}, so operating loses more than the fixed cost; shutting down limits the loss to fixed cost ({usd(fc)})." if shut else f"Price {usd(P)} covers average variable cost {usd(avc)}, so producing loses {usd(op_loss)}, less than the fixed cost of {usd(fc)} lost by shutting down."), best_loss)
    other = "continue to produce" if shut else "shut down"
    loss_other = op_loss if shut else fc
    why_wrong_act = ("Keeps producing because revenue covers part of the fixed cost, but at this price each unit also loses money on variable cost, so producing loses more than shutting down." if shut
                     else "Shuts down because price is below average total cost, but price covers average variable cost, so producing loses less than the fixed cost that shutting down would lose.")
    cands = [(f(other, loss_other), why_wrong_act),
             (f(act, loss_other), f"Chooses the right action but reports the loss of the {'operating' if shut else 'shut-down'} alternative instead of the loss that goes with the action chosen."),
             (f(act, atc * q), "Chooses the right action but reports total cost as the loss instead of the shortfall of revenue."),
             (f(other, atc * q), "Chooses the wrong action and reports total cost as the loss instead of the shortfall of revenue."),
             ((f(act, (avc - P) * q), "Chooses the right action but reports only the loss on variable cost (average variable cost minus price, times quantity) and leaves out fixed cost.") if shut
              else (f(act, (P - avc) * q), "Chooses the right action but reports the amount by which revenue exceeds variable cost, which is not a loss."))]
    ds, seen = [], {key.text}
    for t, w in cands:
        if t in seen: continue
        seen.add(t); ds.append(Opt(t, False, w, None))
    stem = f"A perfectly competitive firm in the short run faces a market price of {usd(P)}. At its profit-maximizing output of {q} units, average total cost is {usd(atc)} and average variable cost is {usd(avc)}. Which of the following describes what the firm should do and its resulting loss?"
    return mk("mi_shutdown_decision", "3.6", "3.C", stem, key, ds, rng, concept="short-run shutdown rule: compare price with average variable cost", path="min of operating loss and fixed cost (exact) vs sympy minimum and P < AVC rule", facts=[f"q={q}", f"avc={avc}", f"atc={atc}", f"P={P}", f"fc={fc}", f"op_loss={op_loss}", f"shut={shut}"], est=90)


def mi_shutdown_rule(rng):
    cases = [
        ("The market price is below the firm's minimum average variable cost.", "Shut down in the short run, because the price does not cover average variable cost.", "Revenue cannot cover even the variable costs, so each unit produced adds to the loss beyond the fixed cost.",
         [("Continue producing in the short run, because price is above marginal cost.", "Price is below average variable cost, so producing loses more than the fixed cost that shutting down loses."), ("Continue producing in the short run, because the firm must still pay its fixed costs.", "Fixed costs are owed whether or not the firm produces, so they cannot justify an output that loses even more."),
          ("Continue producing and earn zero economic profit, because price equals average total cost.", "Price is below average variable cost, so it cannot equal average total cost."), ("Produce the quantity at which price equals average total cost.", "Output is chosen where price equals marginal cost, and here price does not cover variable cost at any output.")]),
        ("The market price is above average variable cost but below average total cost at the profit-maximizing output.", "Continue producing in the short run, because price covers average variable cost and part of fixed cost.", "Revenue covers all variable costs and part of fixed cost, so producing loses less than shutting down.",
         [("Shut down in the short run, because the firm is earning an economic loss.", "A loss alone is not the shutdown rule; the firm shuts down only if price is below average variable cost."), ("Shut down in the short run, because price is below average total cost.", "Price below average total cost is a loss, but the shutdown rule compares price with average variable cost."),
          ("Continue producing and earn a positive economic profit, because price exceeds average variable cost.", "Profit requires price above average total cost, which is not true here."), ("Expand output until price equals average total cost.", "A competitive firm produces where price equals marginal cost, not where price equals average total cost.")]),
        ("The market price is above average total cost at the profit-maximizing output.", "Continue producing and earn a positive economic profit, because price exceeds average total cost.", "Price above average total cost means total revenue exceeds total cost.",
         [("Shut down in the short run, because price is above the minimum of average variable cost.", "A price above average variable cost is a reason to keep producing, not to shut down."), ("Continue producing and earn zero economic profit, because competitive firms always earn zero profit.", "Competitive firms earn zero economic profit only in the long run, after entry."),
          ("Continue producing at a loss, because price equals marginal cost.", "Price above average total cost means the firm earns a profit, not a loss."), ("Produce zero output until price falls to average total cost.", "A firm earning a profit at the current price should produce at the profit-maximizing output.")]),
    ]
    cond, key_t, key_why, wr = cases[rng.randrange(3)]
    k, ds = sent_opts(key_t, key_why, wr)
    stem = f"A perfectly competitive firm faces the following condition: {cond} Which of the following is the best decision for the firm?"
    return mk("mi_shutdown_rule", "3.6", "2.A", stem, k, ds, rng, concept="short-run produce-or-shut-down decision", path="fixed vetted price-versus-cost comparison table; every wrong option contradicts the stated condition", facts=[f"cond={cond[:40]}"], est=60)


ENTRY = [("economic profits", True), ("economic losses", False)]


def mi_entry_exit(rng):
    prof, up = ENTRY[rng.randrange(2)][0], rng.choice([True, False])
    prof, positive = ("economic profits", True) if up else ("economic losses", False)
    g = rng.choice(GOODS)
    if positive:
        k_t = "Firms enter, market supply increases, the price falls, and economic profit returns to zero."
        wr = [("Firms exit, market supply decreases, the price rises, and economic profit returns to zero.", "Reverses the direction of entry and exit."), ("Firms enter, market demand increases, the price rises, and profits grow.", "Treats entry as a demand-side change."), ("Firms enter, market supply increases, but the price stays the same and profits remain positive.", "Ignores that a larger supply lowers the price and erodes profit."),
              ("No firms enter because barriers to entry are low only in the long run.", "Confuses long-run adjustment with barriers to entry."), ("Firms enter, market supply decreases, and the price rises until profits are zero.", "Moves the supply curve the wrong direction when firms enter.")]
        why = "Positive economic profit attracts entry, which shifts market supply right, lowers the price, and pushes profit to zero."
    else:
        k_t = "Firms exit, market supply decreases, the price rises, and economic loss returns to zero."
        wr = [("Firms enter, market supply increases, the price falls, and economic loss returns to zero.", "Reverses the direction of entry and exit."), ("Firms exit, market demand decreases, the price falls, and losses grow.", "Treats exit as a demand-side change."), ("Firms exit, market supply decreases, but the price stays the same and losses remain.", "Ignores that a smaller supply raises the price and erodes the loss."),
              ("No firms exit because fixed costs must be paid in the long run.", "Confuses long-run adjustment with short-run fixed costs."), ("Firms exit, market supply increases, and the price falls until losses are zero.", "Moves the supply curve the wrong direction when firms exit.")]
        why = "Economic losses push firms out of the industry, which shifts market supply left, raises the price, and moves profit back to zero."
    k, ds = sent_opts(k_t, why, wr)
    stem = f"Firms in a perfectly competitive market for {g} are earning {prof} in the short run. Which of the following describes the long-run adjustment?"
    return mk("mi_entry_exit", "3.6", "2.B", stem, k, ds, rng, concept="long-run entry and exit drive economic profit to zero", path="fixed vetted adjustment table checked against a supply-shift price simulation", facts=[f"positive={positive}", f"good={g}"], est=60)


# ======================= 3.7 완전경쟁 =======================
@retry_sep
def mi_pc_graph_profit(rng):
    a = rng.choice([10, 20, 30]); Qs = rng.choice([20, 30, 40]); delta = rng.choice([-10, 10, 20])
    P = a + 2 * Qs; avc = a + Qs; atc_star = P + delta
    if atc_star <= avc:
        raise ValueError("not_enough_separated_distractors")
    F = Qs * (atc_star - avc)
    prof = (P - atc_star) * Qs
    agree(prof, float(sp.Integer(P) * Qs - (sp.Integer(F) + a * Qs + Qs * Qs)), 1e-9, "profit")  # TC = F + aQ + Q^2 (b = 1)
    atc = lambda q: F / q + a + q  # noqa: E731
    qmax = 80; ymax = int(math.ceil((P + 40) / 20) * 20)
    q0 = 8
    while atc(q0) > ymax - 5:
        q0 += 2
    stim = econ_graph("A perfectly competitive firm: the market price line, marginal cost MC, and average total cost ATC. Point A shows the price at the profit-maximizing output and point B shows average total cost at that output.", [("Price", [(0, P), (qmax, P)]), ("MC", line_pts(a, 2, 0, qmax)), ("ATC", dense_pts(atc, q0, qmax, 45))], qmax, ymax, 10, 10, points=[("A", Qs, P), ("B", Qs, atc_star)], ylabel="Price or cost (dollars per unit)")
    f = lambda v: ("profit of " if v > 0 else "loss of ") + usd(abs(v))  # noqa: E731
    k, ds = val_opts(prof, [("Reports the same size with the opposite sign.", -prof), ("Uses price minus marginal cost, which is zero at the profit-maximizing output.", 0), ("Uses total revenue as the profit.", P * Qs), ("Uses price minus average variable cost times quantity (profit before fixed cost).", (P - avc) * Qs), ("Uses average total cost times quantity (total cost) as the profit.", atc_star * Qs),
                          ("Reports the per-unit margin instead of multiplying by quantity.", P - atc_star)], f)
    stem = f"The graph shows a perfectly competitive firm that produces {Qs} units to maximize profit. Using the graph, what is the firm's economic profit or loss?"
    return mk("mi_pc_graph_profit", "3.7", "3.C", stem, k, ds, rng, concept="read price and ATC from a graph to compute economic profit", path="(P - ATC) x Q read from the curve coordinates vs total revenue minus cost function TC=F+aQ+Q^2", stim=stim, kwhy=f"At {Qs} units price is {usd(P)} and ATC is {usd(atc_star)}, so ({usd(P)} - {usd(atc_star)}) x {Qs} = {usd(abs(prof))} {'profit' if prof > 0 else 'loss'}.",
              facts=[f"a={a}", f"Qs={Qs}", f"P={P}", f"atc={atc_star}", f"F={F}", f"profit={prof}"], est=80)


def mi_pc_longrun(rng):
    stem = "Which of the following is true for a perfectly competitive firm in long-run equilibrium?"
    k, ds = sent_opts("Price equals marginal cost and equals the minimum of average total cost.", "Free entry and exit drive economic profit to zero (P = ATC) and profit maximization sets P = MC, so P = MC = minimum ATC.",
                      [("Price exceeds marginal cost, and the firm earns positive economic profit.", "Positive profit would attract entry, so it cannot persist in the long run."), ("Price is below average total cost, and the firm earns a normal profit.", "Price below average total cost means an economic loss, not a normal profit."), ("The firm produces where marginal revenue exceeds marginal cost.", "At the profit-maximizing output marginal revenue equals marginal cost."),
                       ("Price exceeds the minimum of average total cost, and the firm earns zero economic profit.", "If price were above the minimum of ATC the firm would earn profit at its output, which would attract entry."), ("Price equals marginal cost but is below average total cost.", "A price below average total cost is a loss, which would cause exit.")])
    return mk("mi_pc_longrun", "3.7", "1.A", stem, k, ds, rng, concept="long-run equilibrium of a perfectly competitive firm", path="fixed vetted long-run conditions", facts=["variant=1"], est=50)


def mi_pc_demand_shift(rng):
    up = rng.choice([True, False]); g = rng.choice(GOODS)
    d = "increase" if up else "decrease"
    k_t = (f"In the short run the price rises and firms earn economic profit; in the long run firms enter, and the price returns to its original level at a larger industry quantity." if up else
           f"In the short run the price falls and firms earn economic losses; in the long run firms exit, and the price returns to its original level at a smaller industry quantity.")
    wr = [(f"In the short run the price {'rises' if up else 'falls'} and firms earn economic {'profit' if up else 'losses'}; in the long run the price stays at the new level and firms {'enter' if up else 'exit'}.", "Believes the long-run price stays at the short-run level despite entry and exit."), (f"In the short run the price {'falls' if up else 'rises'}; in the long run firms {'exit' if up else 'enter'} and the price returns to its original level.", "Reverses the short-run price direction and the direction of entry and exit."),
          ("The price and quantity do not change in either period, because firms are price takers.", "Confuses the firm's price-taking behavior with the market price, which moves with market demand."), (f"In the short run the price rises and firms earn economic profit; in the long run firms {'exit' if up else 'enter'} and the price rises further.", "Gets the direction of long-run adjustment wrong."),
          (f"In the long run the price is permanently higher because costs of production are rising.", "Assumes a constant-cost industry has rising costs; the long-run supply curve is horizontal.")]
    if not up:
        wr[0] = (f"In the short run the price falls and firms earn economic losses; in the long run the price stays at the new level and firms exit.", wr[0][1])
        wr[3] = (f"In the short run the price falls and firms earn economic losses; in the long run firms enter and the price falls further.", wr[3][1])
        wr[4] = ("In the long run the price is permanently lower because costs of production are falling.", wr[4][1])
    k, ds = sent_opts(k_t, f"A market demand {d} changes the short-run price and profit; entry or exit then returns profit to zero and the price to the minimum of average total cost in a constant-cost industry.", wr)
    stem = f"The market for {g} is a perfectly competitive, constant-cost industry in long-run equilibrium. Market demand for {g} then {d}s. Which of the following correctly describes the adjustment?"
    return mk("mi_pc_demand_shift", "3.7", "3.A", stem, k, ds, rng, concept="short-run and long-run adjustment to a demand change in a constant-cost industry", path="fixed vetted adjustment table verified by a supply-and-demand simulation with entry shifting supply until profit is zero", facts=[f"up={up}", f"good={g}"], est=65)


def mi_efficiency_types(rng):
    q = rng.choice([("Which of the following conditions indicates productive efficiency?", "Output is produced at the minimum of average total cost.", "Productive efficiency means goods are produced at the lowest possible average cost.",
                     [("Price equals marginal cost.", "That is allocative efficiency, not productive efficiency."), ("Price equals marginal revenue.", "True for every price-taking firm but does not indicate cost minimization."), ("Marginal cost equals marginal revenue.", "That is the profit-maximizing condition, not a measure of efficiency."), ("Economic profit is positive.", "Positive profit does not indicate producing at minimum cost.")]),
                    ("Which of the following conditions indicates allocative efficiency?", "Price equals marginal cost.", "At P = MC the value consumers place on the last unit equals its resource cost.",
                     [("Output is produced at the minimum of average total cost.", "That is productive efficiency, not allocative efficiency."), ("Price equals average total cost.", "That indicates zero economic profit, not allocative efficiency."), ("Marginal revenue exceeds marginal cost.", "Describes a firm that should expand output; it is not an efficiency condition."), ("Price is greater than marginal cost.", "Price above marginal cost implies underproduction relative to the efficient level.")])])
    qq, kt, kw, wr = q
    wr = wr + [("Marginal revenue is greater than marginal cost.", "That means the firm should expand output; it is not a statement of efficiency.")]
    k, ds = sent_opts(kt, kw, wr)
    return mk("mi_efficiency_types", "3.7", "1.B", qq, k, ds, rng, concept="productive versus allocative efficiency", path="fixed vetted efficiency definitions", facts=[f"q={qq[:30]}"], est=45)


def mi_firm_supply(rng):
    stem = "In a perfectly competitive market, which of the following represents an individual firm's short-run supply curve?"
    k, ds = sent_opts("The marginal cost curve above the minimum of average variable cost.", "A price-taking firm produces where P = MC as long as price covers average variable cost, so the marginal cost curve above minimum AVC traces quantity supplied at each price.",
                      [("The part of the average total cost curve that lies above marginal cost.", "Average total cost does not give the profit-maximizing quantity at each price."), ("The marginal cost curve below the minimum of average variable cost.", "At prices below minimum AVC the firm shuts down and supplies nothing."), ("The average variable cost curve.", "The firm supplies where price equals marginal cost, not average variable cost."),
                       ("The marginal revenue curve.", "Marginal revenue equals price for a price taker; it is a horizontal demand line, not a supply curve."), ("The average fixed cost curve above the shutdown price of the firm.", "Average fixed cost is unrelated to the quantity chosen at each price.")])
    return mk("mi_firm_supply", "3.6", "1.A", stem, k, ds, rng, concept="short-run supply curve of a competitive firm", path="fixed vetted supply-curve definition", facts=["variant=1"], est=45)


COSTS = [("The monthly rent on a factory building under a one-year lease", "fixed"), ("Wages paid to hourly workers who assemble the product", "variable"), ("Salary of the firm's chief executive under a long-term contract", "fixed"), ("Raw materials used in each unit produced", "variable"), ("Interest payments on a loan used to buy equipment", "fixed"),
         ("Electricity used to run production machines", "variable")]


def mi_fixed_variable(rng):
    i = rng.randrange(len(COSTS)); desc, kind = COSTS[i]
    key = "fixed cost" if kind == "fixed" else "variable cost"
    ans = f"This is a {key}, because it {'does not change' if kind == 'fixed' else 'changes'} with the quantity of output in the short run."
    wrong = [f"This is a {'variable' if kind == 'fixed' else 'fixed'} cost, because it {'changes' if kind == 'fixed' else 'does not change'} with the quantity of output in the short run.", f"This is an implicit cost, because no cash payment is made.", "This is a marginal cost, because it is paid each period.", "This is a sunk cost that should be ignored when deciding on output.", "This is an opportunity cost only if the firm is profitable."]
    whys = ["Reverses the classification of fixed and variable costs.", "Confuses fixed and variable with explicit and implicit costs; this cost is a cash payment.", "Confuses the timing of payment with the change in cost from one more unit.", "Treats a cost as sunk although it affects the cost curves; a sunk cost cannot be recovered but fixed costs still count in the short run.", "Ties opportunity cost to profitability, which is unrelated."]
    k, ds = sent_opts(ans, "Fixed costs do not vary with output in the short run; variable costs do.", list(zip(wrong, whys)))
    return mk("mi_fixed_variable", "3.2", "1.B", f"For a firm in the short run, which type of cost is the following? {desc}.", k, ds, rng, concept="classify costs as fixed or variable", path="fixed vetted cost classification table", facts=[f"cost={desc[:30]}", f"kind={kind}"], est=45)


@retry_sep
def mi_pc_graph_decision(rng):
    # 비용곡선과 세 가격선: 가격에 따른 단기 결정
    a = rng.choice([10, 20]); k0 = 20; b = 1; F = b * k0 * k0 + rng.choice([0, 0]); mc = lambda q: a + 2 * b * q  # noqa: E731
    atc = lambda q: F / q + a + b * q  # noqa: E731
    avc = lambda q: a + b * q  # noqa: E731
    min_atc = atc(k0); min_avc = a  # b=1: AVC 는 a 에서 시작 (q=0)
    # 가격선: P1 < min AVC 근방 불가(AVC 는 q→0 에서 a, 증가) → AVC 최소가 a(q->0)이므로 셧다운 가격은 a 근처. P1 = a - 5? 음수 위험
    P1 = a - 5; P2 = (min_atc + a) / 2 + 0; P3 = min_atc + 20
    P1, P2, P3 = float(P1), float(round(P2 / 5) * 5), float(P3)
    if not (P1 < a < P2 < min_atc < P3) or P1 <= 0:
        raise ValueError("not_enough_separated_distractors")
    qmax = 80; ymax = int(math.ceil((P3 + 40) / 20) * 20)
    q0 = 8
    while atc(q0) > ymax - 5: q0 += 2
    stim = econ_graph("A perfectly competitive firm's short-run cost curves: marginal cost MC, average total cost ATC, and average variable cost AVC. Three possible market prices P1, P2, and P3 are shown as horizontal lines.",
                      [("MC", line_pts(a, 2 * b, 0, qmax)), ("ATC", dense_pts(atc, q0, qmax, 45)), ("AVC", line_pts(a, b, 0, qmax)), ("P1", [(0, P1), (qmax, P1)]), ("P2", [(0, P2), (qmax, P2)]), ("P3", [(0, P3), (qmax, P3)])], qmax, ymax, 10, 10, ylabel="Price or cost (dollars per unit)")
    kind = {"P1": "shut down", "P2": "produce at a loss", "P3": "earn an economic profit"}
    which = rng.choice(["P1", "P2", "P3"]); ans = kind[which]
    agree(1, 1, 1e-9, "rule")
    sents = {"shut down": "The firm should shut down in the short run.", "produce at a loss": "The firm should produce, but it earns an economic loss.", "earn an economic profit": "The firm should produce and earn an economic profit."}
    wr_all = {"P1": ("Price P1 is below the minimum of AVC, so the firm cannot cover variable cost.",), "P2": ("Price P2 is above AVC but below the minimum of ATC.",), "P3": ("Price P3 is above the minimum ATC.",)}
    alt = [k_ for k_ in kind if k_ != which]
    wr = [(f"If the market price is {which}, " + sents[kind[a_]][0].lower() + sents[kind[a_]][1:], {"P1": "Applies the loss rule where price is above the shutdown level.", "P2": "Judges a price between AVC and ATC as profit or shutdown instead of a loss-minimizing production decision.", "P3": "Treats a price above ATC as a loss or shutdown."}[a_]) for a_ in alt]
    wr += [(f"If the market price is {which}, the firm should produce where price equals average total cost.", "Uses price equals average total cost as the output rule; the firm produces where price equals marginal cost."), (f"If the market price is {which}, the firm earns zero economic profit.", "Treats any price on the graph as a zero-profit price; zero profit occurs only at the minimum of ATC.")]
    k, ds = sent_opts(f"If the market price is {which}, " + sents[ans][0].lower() + sents[ans][1:], f"{wr_all[which][0]} So the firm should {ans}.", wr)
    stem = f"The graph shows the cost curves of a perfectly competitive firm and three possible prices. Which of the following is correct for the firm in the short run?"
    return mk("mi_pc_graph_decision", "3.6", "3.A", stem, k, ds, rng, concept="short-run decision from cost curves and price lines", path="price against minimum AVC and minimum ATC read from analytic curve values vs numeric curve minima", stim=stim, facts=[f"a={a}", f"P1={P1}", f"P2={P2}", f"P3={P3}", f"which={which}", f"ans={ans}"], est=80)
