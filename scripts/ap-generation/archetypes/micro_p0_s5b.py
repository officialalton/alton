"""AP Microeconomics 확대 MI3 — 신규 원형 B(단원 2 보충·단원 3). 2026-10-19. 공개 세트와 풀이 틀이 겹치지 않는다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_p0_s5a import _bank


SURPLUS_CMP = [
    ("Which statement correctly compares consumer surplus and deadweight loss in a competitive market that is restricted by a binding price floor above equilibrium?",
     "Consumer surplus is the benefit buyers receive above the price they pay, while deadweight loss is the surplus that disappears because fewer units than the efficient quantity are traded.",
     "Consumer surplus measures buyers' net gain at the price paid; deadweight loss measures the total surplus lost when the quantity traded falls below the efficient quantity.",
     [("Consumer surplus is the total revenue sellers receive, while deadweight loss is the profit sellers lose when the price rises.", "Mixes consumer surplus with revenue; consumer surplus is the buyers' gain, and deadweight loss is lost total surplus, not lost profit."),
      ("Consumer surplus and deadweight loss are the same measure, because both are areas under the demand curve.", "Treats two different areas as one; deadweight loss is a triangle of lost trades, not buyers' net gain."),
      ("Deadweight loss is the surplus transferred from buyers to sellers by the price floor, while consumer surplus is the surplus lost.", "Confuses a transfer with a loss; a transfer moves surplus between groups, while deadweight loss is surplus that no one receives."),
      ("Consumer surplus rises with the price floor, because buyers pay a higher price for each unit.", "A higher price lowers buyers' surplus on every unit; it does not raise it.")]),
    ("Which statement correctly compares producer surplus and consumer surplus at a competitive equilibrium?",
     "Producer surplus is the difference between the price sellers receive and their minimum acceptable price, while consumer surplus is the difference between buyers' maximum willingness to pay and the price paid.",
     "Both are net gains from trade measured against the market price, one for sellers and one for buyers.",
     [("Producer surplus is the difference between the price and the buyers' willingness to pay, while consumer surplus is the difference between the price and the sellers' cost.", "Swaps the two definitions; consumer surplus uses buyers' willingness to pay and producer surplus uses sellers' costs."),
      ("Producer surplus equals total revenue, while consumer surplus equals total spending minus total revenue.", "Equates surplus with revenue; surplus subtracts costs or willingness to pay from the price."),
      ("Both surpluses equal zero at the equilibrium, because the market clears there.", "Confuses market clearing with zero gains; only the marginal unit has zero surplus."),
      ("Producer surplus is the area above the supply curve and below the demand curve, which is the same as consumer surplus.", "Describes total surplus; each surplus is a separate triangle bounded by the price line.")]),
]


def mi_surplus_compare(rng):
    return _bank(rng, "mi_surplus_compare", "2.6", "1.D", SURPLUS_CMP, "compare consumer surplus, producer surplus, and deadweight loss", "fixed vetted statements; each wrong sentence swaps definitions or merges a transfer with a loss",
                 judgment="compare the measures and reject swapped definitions")


# ================= 단원 3 =================
COST_DEFS = [
    ("Which of the following correctly defines average variable cost (AVC)?",
     "Total variable cost divided by the quantity produced.",
     "AVC = TVC / Q; it excludes fixed cost, which is why ATC minus AVC equals average fixed cost.",
     [("Total cost divided by the quantity produced.", "Describes average total cost, which also includes fixed cost."), ("The change in total cost from producing one more unit.", "Describes marginal cost, not an average."),
      ("Total fixed cost divided by the quantity produced.", "Describes average fixed cost, which falls as output rises."), ("Total variable cost divided by the number of workers hired.", "Divides by inputs instead of output; AVC is a cost per unit of output.")]),
    ("Which of the following correctly defines marginal cost?",
     "The change in total cost that results from producing one additional unit of output.",
     "MC = change in total cost / change in quantity; fixed cost does not change with output, so MC comes from variable cost.",
     [("Total cost divided by the quantity produced.", "Describes average total cost, not the cost of the last unit."), ("Total variable cost divided by the quantity produced.", "Describes average variable cost."),
      ("The cost of all fixed inputs in the short run.", "Describes total fixed cost, which does not change with output."), ("The price a firm receives for the last unit it sells.", "Describes the price or marginal revenue for a price taker, not a cost.")]),
    ("Which of the following correctly describes average fixed cost (AFC) as output increases in the short run?",
     "AFC falls continuously, because the same total fixed cost is spread over more units.",
     "AFC = TFC / Q with TFC constant, so it declines as Q rises (spreading overhead).",
     [("AFC is U-shaped, because of diminishing marginal returns.", "Describes ATC and AVC; AFC has no rising portion."), ("AFC rises when output rises, because more machines are needed.", "In the short run fixed cost does not change with output, so AFC cannot rise with Q."),
      ("AFC stays constant, because fixed cost does not depend on output.", "Total fixed cost is constant, but the cost per unit falls as it is spread over more units."), ("AFC equals marginal cost, because both are costs of one unit.", "Marginal cost is the cost of an added unit; AFC is the fixed cost per unit of all units.")]),
]


def mi_cost_definitions(rng):
    return _bank(rng, "mi_cost_definitions", "3.2", "1.A", COST_DEFS, "definitions of average and marginal cost measures", "fixed vetted definitions; each wrong sentence defines a different cost measure", judgment="recall the exact definition and reject definitions of related measures")


@retry_sep
def mi_returns_scale_id(rng):
    """모든 투입을 k배 했을 때 산출이 m배: 규모수익 유형을 식별한다."""
    k = rng.choice([2, 3, 4])
    kind = rng.choice(["irs", "crs", "drs"])
    q0 = rng.choice([40, 50, 60, 80, 100])
    m = {"irs": k + rng.choice([1, 2]), "crs": k, "drs": k - 1 if k > 2 else 1}[kind]
    if kind == "drs" and m < 2:
        m = 2 if k > 2 else None
    if m is None:
        raise ValueError("not_enough_separated_distractors")
    out = q0 * m
    name = {"irs": "increasing returns to scale", "crs": "constant returns to scale", "drs": "decreasing returns to scale"}
    agree(float(m), float(out) / q0, 1e-9, "scale")
    got = "irs" if m > k else "crs" if m == k else "drs"
    assert got == kind
    items = rng.choice([("labor and capital", "bakery"), ("workers and machines", "print shop"), ("labor and equipment", "software firm")])
    stem = f"A {items[1]} produces {q0} units per day. In the long run, it multiplies all of its inputs ({items[0]}) by {k} and now produces {out} units per day. Which statement correctly identifies what the firm experiences?"
    key_t = f"{name[kind].capitalize()}, because output rises by a factor of {m} when all inputs rise by a factor of {k}."
    wrongs = []
    for o in ("irs", "crs", "drs"):
        if o != kind:
            wrongs.append((f"{name[o].capitalize()}, because output rises by a factor of {m} when all inputs rise by a factor of {k}.",
                           {"irs": "Claims increasing returns even though output does not grow by more than the input factor.", "crs": "Claims constant returns even though output does not grow by exactly the input factor.", "drs": "Claims decreasing returns even though output does not grow by less than the input factor."}[o]))
    wrongs.append(("Diminishing marginal returns, because the firm needed more inputs to produce more output.", "Confuses returns to scale (all inputs change, long run) with diminishing marginal returns (one input changes, short run)."))
    wrongs.append(("Economies of scale, because total cost increased when the firm produced more output.", "Higher total cost is not evidence of economies of scale; the term refers to falling average cost over a range of output."))
    k_, ds = sent_opts(key_t, f"Inputs rose by {k}x and output rose by {m}x, so the firm has {name[kind]}.", wrongs[:4])
    return mk("mi_returns_scale_id", "3.3", "1.B", stem, k_, ds, rng, concept="returns to scale compare the proportional change in output with the proportional change in all inputs", path="ratio comparison vs rule table; changes of all inputs only (long run)",
              facts=[f"k={k}", f"m={m}", f"q0={q0}", f"kind={kind}"], est=65, judgment="compare the factor change in output with the factor change in inputs")


@retry_sep
def mi_explicit_implicit_cost(rng):
    """사업 상황에서 명시적 비용과 암묵적 비용을 구분해 '암묵적 비용'에 해당하는 항목을 식별한다."""
    cases = [
        ("A graphic designer leaves a $70,000 job to open her own studio. Her only payments are $20,000 for rent and $10,000 for supplies each year.", "the $70,000 salary she gave up", [("the $20,000 rent payment", "Rent is a payment to another party, so it is an explicit cost."), ("the $10,000 spent on supplies", "Supplies are purchased with money, so they are an explicit cost."), ("the studio's total revenue", "Revenue is a benefit, not a cost of any kind.")]),
        ("A farmer owns her land outright and could rent it to a neighbor for $15,000 per year. She farms it herself and pays $25,000 for seed and equipment.", "the $15,000 rent she could have earned", [("the $25,000 spent on seed and equipment", "Money paid for seed and equipment is an explicit cost."), ("the land's purchase price paid years ago", "A past purchase price is a sunk cost, not the forgone annual return."), ("the farm's total revenue", "Revenue is a benefit, not a cost of any kind.")]),
        ("A man invests $50,000 of his savings in a food truck instead of keeping it in an account that pays $3,000 a year. He pays $18,000 for ingredients and fuel.", "the $3,000 of interest he gave up", [("the $18,000 paid for ingredients and fuel", "Ingredients and fuel are paid for with money, so they are explicit costs."), ("the $50,000 he invested, counted every year", "The invested money is a stock; the yearly implicit cost is the return it could have earned."), ("the truck's total revenue", "Revenue is a benefit, not a cost of any kind.")]),
    ]
    stem0, key_item, wr = cases[rng.randrange(len(cases))]
    stem = f"{stem0} Which of the following is an implicit cost of operating the business?"
    k = Opt(key_item[0].upper() + key_item[1:] + ".", True, "An implicit cost is the value of a resource the owner supplies, measured by the best alternative use; it involves no payment to another party.", None)
    ds = [Opt(w[0][0].upper() + w[0][1:] + ".", False, w[1], None) for w in wr]
    ds.append(Opt("The wages the business pays to a part-time employee.", False, "Wages paid to an employee are payments to another party, so they are explicit costs.", None))
    return mk("mi_explicit_implicit_cost", "3.4", "1.B", stem, k, ds, rng, concept="implicit costs are the opportunity costs of owner-supplied resources", path="fixed vetted business cases with one forgone alternative each",
              facts=[f"case={stem0[:30]}"], est=60, judgment="separate payments to others from the value of the owner's forgone alternatives")


SHORT_LONG = [
    ("A bakery owner wants to double the number of loaves baked each day. Which situation describes the long run for this bakery?",
     "The owner has time to build a second kitchen and buy additional ovens, so every input can be changed.",
     "The long run is the period long enough for all inputs, including plant size, to be varied.",
     [("The owner hires two more bakers this week but keeps the same ovens.", "Changing only labor with the same capital describes the short run."), ("The owner buys more flour for the week and uses the same equipment.", "Changing only a variable input describes the short run."),
      ("The owner has exactly one year to operate, whatever inputs are changed.", "The long run is defined by the ability to change all inputs, not by a fixed number of months."), ("The owner runs the ovens for extra hours each day, but she cannot move to a larger building.", "A fixed building means at least one input is fixed, so this is the short run.")]),
    ("A manufacturer finds that doubling its workforce while keeping the same factory raises output by less than double. Which statement correctly describes this situation?",
     "It is a short-run situation with a fixed input, and the smaller gain in output reflects diminishing marginal returns to labor.",
     "Only labor changes while the factory is fixed, so this is the short run, and the smaller increase reflects diminishing marginal returns.",
     [("It is a long-run situation with decreasing returns to scale, because output rose by less than the workforce.", "Returns to scale require every input to change; here the factory is fixed."), ("It is a long-run situation, because the firm had enough time to double its workforce.", "The length of time is not what defines the long run; the ability to change every input is."),
      ("It is a short-run situation with increasing marginal returns, because the firm hired more workers.", "Output rose by less than proportionally, which is diminishing, not increasing, marginal returns."), ("It is a short-run situation with economies of scale, because output increased.", "Economies of scale describe falling average cost as all inputs change; they are not a short-run concept.")]),
]


def mi_short_long_run_id(rng):
    return _bank(rng, "mi_short_long_run_id", "3.1", "1.B", SHORT_LONG, "short run (some input fixed) versus long run (all inputs variable)", "fixed vetted scenarios; the key identifies the period by whether any input is fixed", judgment="identify the period from which inputs can change")


ECON_SCALE = [
    ("A growing furniture maker finds that its average cost per chair falls as it builds a larger factory because each worker can specialize in one task. Which of the following does this best illustrate?",
     "Economies of scale from specialization of labor.", "Falling long-run average cost from specialization is an economy of scale.",
     [("Diminishing marginal returns, because adding workers raised output.", "Diminishing marginal returns apply to one variable input with fixed capital; this example is about a larger scale of operation."), ("Diseconomies of scale, because the firm became bigger.", "Diseconomies of scale means average cost rises as the firm grows, the opposite of this case."),
      ("A short-run fixed cost, because the factory itself is fixed.", "The firm changes the factory size, so this is a long-run scale change."), ("Constant returns to scale, because the firm produces more chairs.", "Average cost falls here, which is not constant returns.")]),
    ("A large firm adds several management layers, and the extra coordination makes it harder to monitor workers, so average cost per unit rises as the firm expands. Which of the following does this best illustrate?",
     "Diseconomies of scale from coordination problems.", "Rising long-run average cost from coordination and monitoring difficulties is a diseconomy of scale.",
     [("Economies of scale, because the firm is producing more output.", "Economies of scale mean average cost falls as the firm expands."), ("Diminishing marginal returns, because one input is fixed.", "The firm expands all inputs, including managers; the cause is coordination, not a fixed input."),
      ("Constant returns to scale, because output rises with inputs.", "Rising average cost shows output is rising less than costs, not in proportion."), ("A fall in average fixed cost, because output has risen.", "Falling average fixed cost would reduce unit cost; here average cost rises.")]),
    ("A grocery chain buys in huge volumes and gets a lower price per unit from its suppliers, which lowers its average cost as it opens more stores. Which of the following does this best illustrate?",
     "Economies of scale from bulk purchasing.", "A lower input price per unit with larger purchases lowers long-run average cost, an economy of scale.",
     [("Diminishing marginal returns, because the chain adds more stores.", "Diminishing returns require a fixed input; here the whole operation expands."), ("Diseconomies of scale, because the chain is larger.", "Average cost is falling, so this is the opposite of diseconomies of scale."),
      ("A shift of the short-run marginal cost curve caused by a change in fixed cost.", "A bulk discount is a change in input prices as scale changes, not a change in short-run fixed cost."), ("Normal profit, because the chain earns revenue above its cost.", "Normal profit describes the owner's opportunity cost, not why average cost falls with scale.")]),
]


def mi_scale_source_id(rng):
    return _bank(rng, "mi_scale_source_id", "3.3", "1.B", ECON_SCALE, "sources of economies and diseconomies of scale", "fixed vetted scenarios; the key links the cost change to its source", judgment="identify whether average cost falls or rises with scale and name the source")


ATC_MC = [
    ("Which statement correctly describes the relationship between marginal cost (MC) and average total cost (ATC)?",
     "MC crosses ATC at the minimum point of ATC; when MC is below ATC, ATC falls, and when MC is above ATC, ATC rises.",
     "The average falls while the added cost is below it and rises when the added cost is above it, so MC intersects ATC at ATC's minimum.",
     [("MC crosses ATC at the maximum point of ATC.", "ATC is U-shaped, so the crossing is at its minimum, not a maximum."), ("MC is always above ATC, because marginal cost includes fixed cost.", "MC excludes fixed cost, and it lies below ATC for the early units."),
      ("When MC is above ATC, ATC falls, because each added unit costs more.", "Reverses the rule; a higher added cost pulls the average up."), ("MC and ATC never intersect, because one measures a total and the other a unit.", "Both are costs per unit; MC always passes through the minimum of ATC.")]),
    ("Which statement correctly compares average variable cost (AVC) and average total cost (ATC) as output increases?",
     "The vertical gap between ATC and AVC equals average fixed cost, so the gap narrows as output rises.",
     "ATC = AVC + AFC, and AFC falls with output, so the gap between ATC and AVC shrinks.",
     [("AVC is always above ATC, because variable cost is larger than total cost.", "Total cost includes variable cost, so ATC is at least AVC."), ("The gap between ATC and AVC widens as output rises, because fixed cost grows with output.", "Fixed cost is constant in the short run, so the gap per unit shrinks."),
      ("ATC and AVC have the same minimum quantity, because both are U-shaped.", "ATC reaches its minimum at a larger output than AVC because AFC keeps falling after AVC begins to rise."), ("The gap between ATC and AVC is marginal cost, so it changes with each unit.", "The gap is average fixed cost, not marginal cost.")]),
]


def mi_atc_mc_compare(rng):
    return _bank(rng, "mi_atc_mc_compare", "3.2", "1.D", ATC_MC, "relationships among ATC, AVC, AFC, and MC", "fixed vetted statements; each wrong sentence reverses a relationship", judgment="compare the cost curves and reject reversed relationships")


PROFIT_CMP = [
    ("An owner earns $120,000 in revenue, pays $70,000 in explicit costs, and could have earned $60,000 working elsewhere. Which statement correctly compares the firm's accounting profit with its economic profit?",
     "Accounting profit is $50,000 and economic profit is -$10,000, because economic profit also subtracts the $60,000 implicit cost.",
     "Accounting profit = 120,000 - 70,000 = 50,000; economic profit also subtracts the 60,000 opportunity cost, giving -10,000.",
     [("Accounting profit is $50,000 and economic profit is $110,000, because economic profit adds the owner's opportunity cost.", "Adds the implicit cost instead of subtracting it."), ("Accounting profit is -$10,000 and economic profit is $50,000, because accounting profit includes implicit costs.", "Swaps the two measures; accounting profit subtracts only explicit costs."),
      ("Both are $50,000, because the owner paid no one the $60,000.", "Ignores that economic cost includes implicit costs even when no payment is made."), ("Accounting profit is $120,000 and economic profit is $50,000, because accounting profit ignores costs.", "Accounting profit still subtracts explicit costs.")]),
    ("A firm earns zero economic profit in the long run. Which statement correctly compares this outcome with accounting profit?",
     "The firm's accounting profit is positive, because zero economic profit means revenue just covers explicit and implicit costs.",
     "Zero economic profit (normal profit) means revenue equals explicit plus implicit costs, so revenue exceeds explicit costs and accounting profit is positive when implicit costs are positive.",
     [("The firm's accounting profit must also be zero, because the two measures are always equal.", "Accounting profit omits implicit costs, so it exceeds economic profit by the implicit costs."), ("The firm's accounting profit is negative, because zero economic profit means the firm loses money.", "Zero economic profit means all opportunity costs are covered; the owner is not losing money."),
      ("The firm will leave the industry, because zero economic profit is worse than any alternative.", "At zero economic profit owners earn their best alternative return and have no reason to exit."), ("The firm is earning above-normal profit, because accounting profit is positive.", "Above-normal profit is positive economic profit, not positive accounting profit.")]),
]


def mi_profit_measures_compare(rng):
    return _bank(rng, "mi_profit_measures_compare", "3.4", "1.D", PROFIT_CMP, "compare accounting profit, economic profit, and normal profit", "fixed vetted numbers and statements; the key derives each measure from the figures given", est=75, judgment="compute or reason about both profit measures and compare them")


SHUT_EXIT = [
    ("Which statement correctly compares a perfectly competitive firm's short-run shutdown rule with its long-run exit rule?",
     "In the short run the firm shuts down if price is below average variable cost; in the long run it exits if price is below average total cost.",
     "Fixed cost is sunk in the short run, so only variable cost matters for shutting down; in the long run all costs are avoidable, so the firm compares price with ATC.",
     [("In the short run the firm shuts down if price is below average total cost; in the long run it exits if price is below average variable cost.", "Swaps the two rules; fixed cost is sunk only in the short run."),
      ("In both the short run and the long run, the firm shuts down whenever price is below marginal cost.", "Price below marginal cost at the current quantity means reducing output, not shutting down or exiting."),
      ("In the short run the firm shuts down whenever it earns an economic loss, and in the long run it exits only if the loss exceeds fixed cost.", "A firm may keep operating at a loss in the short run if price covers average variable cost."),
      ("The rules are identical in both periods, because fixed cost is always irrelevant.", "Fixed cost matters in the long run because it can be avoided by leaving the industry.")]),
    ("Which statement correctly compares the supply curve of one perfectly competitive firm with the market supply curve?",
     "The firm's short-run supply curve is the part of its marginal cost curve above average variable cost, and the market supply curve is the horizontal sum of the firms' supply curves.",
     "A price taker produces where P = MC above the shutdown point; adding the quantities supplied at each price across firms gives market supply.",
     [("The firm's supply curve is its entire average total cost curve, and the market supply curve is the vertical sum of the firms' supply curves.", "A firm's supply is the marginal cost curve above AVC, and market supply adds quantities horizontally."),
      ("The market supply curve is the supply curve of the largest firm, because the largest firm sets the price.", "Price takers do not set the price; market supply adds all firms' quantities."),
      ("The firm's supply curve is horizontal at the market price, and the market supply curve is vertical.", "Confuses the firm's perfectly elastic demand with its supply curve."),
      ("The firm's supply curve is its marginal revenue curve, which is upward sloping.", "Marginal revenue is horizontal for a price taker; supply comes from marginal cost.")]),
]


def mi_shutdown_exit_compare(rng):
    return _bank(rng, "mi_shutdown_exit_compare", "3.6", "1.D", SHUT_EXIT, "compare short-run shutdown with long-run exit, and firm supply with market supply", "fixed vetted statements; each wrong sentence swaps a decision rule or an aggregation direction", judgment="compare the rules by period and reject swapped rules")
