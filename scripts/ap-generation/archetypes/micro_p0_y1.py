"""AP Microeconomics 확대 MI5 — 신규 원형 Y1(단원 1·2·3·4·6 보충 9개). 2026-10-21. 공개 세트·재고에 없는 장면의 고정 문장 은행. 정답 문장이 오답보다 지나치게 길지 않게 쓴다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_p0_s5a import _bank

STAGE_Y_A = [
    "mi_factor_role_id", "mi_supply_shift_eq", "mi_shutdown_condition_compare", "mi_entry_exit_adjust", "mi_cost_curve_input_change",
    "mi_cartel_stability_factors", "mi_monopcomp_run_adjust", "mi_externality_remedy",
]

ROLE = [
    ("A baker takes on the risk of opening a second shop, organizing the workers and equipment and keeping any profit or loss. Which factor of production does the baker's role best represent?",
     "Entrepreneurship, because the baker combines the other resources and bears the risk of the business.",
     "Entrepreneurs organize land, labor, and capital and earn profit or loss for taking the risk.",
     [("Labor, because the baker works in the shop and is paid a wage.", "Labor is the work effort of employees, while this role involves organizing resources and bearing risk."),
      ("Capital, because the baker has invested money in the second shop.", "Capital as a factor means machines and buildings, not the risk-taking role."),
      ("Land, because the baker uses natural resources to bake bread.", "Land refers to natural resources, which are not the baker's organizing role."),
      ("Financial capital, because the baker takes the risk of losing money.", "Money is not a factor of production, and risk-taking is entrepreneurship.")]),
    ("A farmer rents out a field to a neighboring farm and receives a payment for its use. Which factor of production does the field represent, and what is the payment called?",
     "The field is land, and the payment for its use is rent.",
     "Natural resources such as fields are land, and the income earned by their owners is rent.",
     [("The field is capital, and the payment for its use is interest.", "Capital means human-made goods used in production, and a natural field is not human-made."),
      ("The field is labor, and the payment for its use is a wage.", "Labor is human effort, not a natural resource."),
      ("The field is land, and the payment for its use is profit.", "Profit is the reward to entrepreneurs, while payment for land is called rent."),
      ("The field is entrepreneurship, and the payment for its use is interest.", "Entrepreneurship is the risk-taking organizing role, not a field.")]),
]


def mi_factor_role_id(rng):
    return _bank(rng, "mi_factor_role_id", "1.1", "1.A", ROLE, "the four factors of production and their payments: rent, wages, interest, and profit", "fixed vetted scenarios; wrong options misclassify the factor or the payment")


SUP = [
    ("A new method of harvesting tomatoes lowers the cost of producing tomatoes, and nothing else changes in the market for tomatoes. Which statement best describes the effect on the equilibrium price and quantity?",
     "The price falls and the quantity rises, because supply increases while demand is unchanged.",
     "Lower production costs shift supply right, which lowers the equilibrium price and raises the equilibrium quantity.",
     [("The price rises and the quantity rises, because lower costs increase demand.", "A cost change shifts supply, not demand."),
      ("The price falls and the quantity falls, because supply decreases.", "Lower costs increase supply, so the equilibrium quantity rises."),
      ("The price rises and the quantity falls, because supply decreases.", "Lower costs shift supply right and lower the price."),
      ("The price and quantity are unchanged, because demand is unchanged.", "A shift in supply changes the equilibrium even if demand does not move.")]),
    ("A drought sharply reduces the amount of wheat that farmers can grow at every price, and nothing else changes in the market for wheat. Which statement best describes the effect on the equilibrium price and quantity?",
     "The price rises and the quantity falls, because supply decreases while demand is unchanged.",
     "Lower output at every price shifts supply left, which raises the equilibrium price and lowers the equilibrium quantity.",
     [("The price falls and the quantity falls, because the drought decreases demand.", "A drought affects production, which is supply, not demand."),
      ("The price rises and the quantity rises, because supply increases.", "A drought shifts supply left, so the equilibrium quantity falls."),
      ("The price falls and the quantity rises, because supply increases.", "Less wheat at every price raises the equilibrium price."),
      ("The price and quantity are unchanged, because wheat demand is fixed.", "A shift in supply changes the equilibrium even if demand does not move.")]),
]


def mi_supply_shift_eq(rng):
    return _bank(rng, "mi_supply_shift_eq", "2.7", "3.A", SUP, "a supply shift with unchanged demand moves equilibrium price and quantity in opposite and same directions respectively", "fixed vetted scenarios; wrong options swap the curve that shifts or reverse a direction")


SHUT = [
    ("In the short run, a perfectly competitive firm faces a market price that is below its average total cost but above its average variable cost at the quantity where marginal cost equals price. Which statement best describes what the firm should do?",
     "Continue producing in the short run, because the revenue covers all variable costs and part of the fixed costs.",
     "When price exceeds average variable cost, producing loses less than shutting down and paying all fixed costs.",
     [("Shut down immediately, because the firm is earning negative economic profit.", "A short-run loss does not require shutting down if variable costs are covered."),
      ("Raise the price above average total cost, because the firm is a price maker.", "A competitive firm is a price taker and cannot set its price."),
      ("Produce where average total cost is lowest, because that always minimizes losses.", "Output is chosen where marginal cost equals price, not at minimum ATC."),
      ("Shut down, because the price is below average total cost.", "Price below ATC alone does not trigger a shutdown in the short run.")]),
    ("In the short run, a perfectly competitive firm faces a market price that is below its average variable cost at every quantity. Which statement best describes what the firm should do?",
     "Shut down temporarily, because the revenue cannot cover even the variable costs of producing.",
     "When price is below average variable cost, each unit adds more to cost than to revenue, so producing loses more than paying only fixed costs.",
     [("Continue producing, because the firm still earns some revenue.", "Revenue below variable cost makes the loss larger than the fixed cost alone."),
      ("Produce where average total cost is lowest, because that minimizes losses.", "At this price every quantity loses more than the fixed cost."),
      ("Raise the price above average variable cost, because the firm sets its own price.", "A competitive firm is a price taker and cannot set its price."),
      ("Continue producing, because shutting down ends fixed costs only in the long run.", "Fixed costs are paid either way, so the choice depends on covering variable costs.")]),
]


def mi_shutdown_condition_compare(rng):
    return _bank(rng, "mi_shutdown_condition_compare", "3.6", "2.A", SHUT, "a competitive firm continues producing in the short run when price exceeds average variable cost and shuts down when it does not", "fixed vetted scenarios; wrong options use ATC for the shutdown rule or let the firm set its price")


ENTRY = [
    ("Firms in a perfectly competitive market are earning positive economic profit, and there are no barriers to entry. Which statement best describes what happens in the long run?",
     "New firms enter, market supply increases, the price falls, and economic profit falls to zero.",
     "Positive profit attracts entry, which shifts supply right and lowers the price until profit is zero.",
     [("Firms exit, market supply decreases, and the price rises until economic profit is zero.", "Exit happens when firms lose money, not when profit is positive."),
      ("New firms enter, market demand increases, and the price rises, so profit grows.", "Entry shifts supply, not demand, and a falling price erodes profit."),
      ("Existing firms raise their prices, because positive profit shows consumers will pay more.", "Competitive firms are price takers, so their own prices are set by the market."),
      ("Nothing changes, because positive economic profit is the long-run equilibrium.", "Long-run equilibrium in a competitive market has zero economic profit.")]),
    ("Firms in a perfectly competitive market are earning negative economic profit, and firms are free to leave the market. Which statement best describes what happens in the long run?",
     "Some firms exit, market supply decreases, the price rises, and economic profit rises to zero.",
     "Losses push firms out, which shifts supply left and raises the price until the remaining firms break even.",
     [("New firms enter, market supply increases, and the price falls until economic profit is zero.", "Entry happens when firms earn profit, not when they lose money."),
      ("Some firms exit, market demand decreases, and the price falls, so losses deepen.", "Exit shifts supply, not demand, and a rising price reduces losses."),
      ("Existing firms lower their prices, because losses show consumers want lower prices.", "Competitive firms are price takers, so their own prices are set by the market."),
      ("Nothing changes, because negative economic profit is the long-run equilibrium.", "Long-run equilibrium in a competitive market has zero economic profit.")]),
]


def mi_entry_exit_adjust(rng):
    return _bank(rng, "mi_entry_exit_adjust", "3.6", "2.B", ENTRY, "entry and exit shift market supply until economic profit is zero in the long run", "fixed vetted scenarios; wrong options swap the direction of entry and exit or shift demand instead of supply")


COSTIN = [
    ("A firm's monthly rent on its factory, which does not change with the quantity produced, rises while everything else stays the same. Which statement correctly describes the effect on the firm's cost curves?",
     "Average total cost rises at every quantity, while average variable cost and marginal cost do not change.",
     "Rent is a fixed cost, so it raises average fixed cost and average total cost but not variable or marginal cost.",
     [("Marginal cost rises at every quantity, because all costs rose.", "Marginal cost depends only on how total variable cost changes, not on fixed cost."),
      ("Average variable cost rises at every quantity, because rent is a cost of production.", "Rent is a fixed cost and is not part of variable cost."),
      ("Average total cost is unchanged, because rent does not depend on output.", "Fixed cost is part of total cost, so average total cost rises."),
      ("Average total cost, average variable cost, and marginal cost all rise.", "Only the curves that include fixed cost rise.")]),
    ("The wage that a firm pays to its workers rises while everything else stays the same. Which statement correctly describes the effect on the firm's cost curves?",
     "Marginal cost, average variable cost, and average total cost all rise at every quantity.",
     "Wages are a variable cost, so a higher wage raises marginal cost, average variable cost, and average total cost.",
     [("Only average fixed cost rises, because wages are paid regardless of output.", "Wages change with the quantity produced, so they are a variable cost."),
      ("Only marginal cost rises, because wages affect only the last unit.", "Higher wages raise the variable cost of every unit, so the average curves rise too."),
      ("Average variable cost and marginal cost rise, but average total cost does not.", "Average total cost includes variable cost, so it rises as well."),
      ("None of the curves change, because workers are hired in the long run.", "A wage change affects short-run variable cost immediately.")]),
]


def mi_cost_curve_input_change(rng):
    return _bank(rng, "mi_cost_curve_input_change", "3.2", "3.A", COSTIN, "a fixed-cost change shifts only the curves that include fixed cost, while a variable-cost change shifts marginal and average variable cost too", "fixed vetted scenarios; wrong options move the wrong set of cost curves")


CARTEL = [
    ("Which situation would make it easiest for the members of a cartel to keep their agreement to limit output?",
     "There are only a few members, and each member can easily observe the others' output.",
     "Few members and easy monitoring make cheating easy to detect and punish.",
     [("There are many members, and each can sell secretly to customers.", "Many members and secret sales make cheating hard to detect."),
      ("Each member would earn more by producing a little extra than by keeping to its quota.", "That incentive to cheat is the source of instability in a cartel."),
      ("Members face no penalty for producing more than their quota.", "Without a penalty, cheating is more likely."),
      ("New firms can freely enter and sell at lower prices.", "Entry erodes the cartel's ability to hold the price above competitive levels.")]),
    ("Two firms that are the only producers of a good agree to each produce half of the monopoly output. Each firm can raise its own profit by producing more if the other keeps to the agreement. Which statement best describes what is likely to happen?",
     "The agreement is likely to break down, because each firm has an incentive to cheat on the quota.",
     "Each firm gains by expanding output if the other holds back, so both are tempted to cheat and the cartel breaks down.",
     [("The agreement is stable, because both firms earn the monopoly profit when they keep to it.", "Earning the monopoly profit does not remove each firm's gain from cheating."),
      ("The agreement is stable, because the firms cannot tell what the other produces.", "Not seeing the other's output makes cheating easier, not less likely."),
      ("The firms raise prices further, because they are the only producers.", "Cheating on quotas increases total output and lowers the price."),
      ("The firms earn zero profit, because the market has only two sellers.", "Two sellers can earn positive profit, but their agreement is unstable.")]),
]


def mi_cartel_stability_factors(rng):
    return _bank(rng, "mi_cartel_stability_factors", "4.5", "2.A", CARTEL, "cartels are more stable with few members and easy monitoring, and unstable because each member gains by cheating", "fixed vetted scenarios; wrong options ignore the incentive to cheat or reverse the role of monitoring")


MONO = [
    ("Firms in a monopolistically competitive market are earning positive economic profit in the short run, and entry is easy. Which statement best describes what happens to each existing firm in the long run?",
     "The demand for each existing firm's product decreases as new firms enter, and economic profit falls to zero.",
     "Entry offers consumers more close substitutes, which shifts each firm's demand left until profit is zero.",
     [("The demand for each existing firm's product increases, and economic profit grows.", "More substitutes reduce, not increase, each firm's demand."),
      ("The market supply curve of each firm shifts right, because firms have more competitors.", "A firm in this market is described by its demand and cost curves, and entry shifts its demand left."),
      ("Firms exit the market until the remaining firms earn a positive profit again.", "Exit occurs when firms lose money, not when profit is positive."),
      ("Each firm's economic profit stays positive, because its product is differentiated.", "Product differentiation does not prevent entry from eliminating profit.")]),
    ("Firms in a monopolistically competitive market are earning negative economic profit in the short run, and firms are free to leave. Which statement best describes what happens to each remaining firm in the long run?",
     "The demand for each remaining firm's product increases as other firms exit, and economic loss falls to zero.",
     "Exit leaves fewer close substitutes, which shifts each remaining firm's demand right until the loss disappears.",
     [("The demand for each remaining firm's product decreases, and the loss grows.", "Fewer substitutes raise, not lower, each firm's demand."),
      ("New firms enter the market, because the loss shows that profits are possible.", "Entry occurs when firms earn profit, not when they lose money."),
      ("Each firm's economic loss stays negative, because its product is differentiated.", "Exit continues until the remaining firms break even."),
      ("The market price falls until all firms break even, because firms are price takers.", "Monopolistically competitive firms face downward-sloping demand and are not price takers.")]),
]


def mi_monopcomp_run_adjust(rng):
    return _bank(rng, "mi_monopcomp_run_adjust", "4.4", "2.B", MONO, "entry or exit in monopolistic competition shifts each firm's demand until economic profit is zero", "fixed vetted scenarios; wrong options shift demand the wrong way or treat the firms as price takers")


EXT = [
    ("A factory's production creates air pollution that harms nearby residents, and the factory does not pay for the damage. Which statement best explains why the market outcome is inefficient?",
     "The social cost of production is greater than the private cost, so the market produces more than the efficient quantity.",
     "A negative externality means the firm ignores the external cost, so quantity exceeds the level where marginal social benefit equals marginal social cost.",
     [("The social cost is less than the private cost, so the market produces less than the efficient quantity.", "A negative externality adds to cost for others, making social cost larger than private cost."),
      ("The market produces the efficient quantity, because the factory maximizes its own profit.", "Maximizing private profit ignores the external cost."),
      ("The price of the good is too high, because the factory passes the pollution cost to consumers.", "The pollution cost falls on third parties, so the price is too low."),
      ("The residents have too much demand for clean air, so the market output is too low.", "The problem is the unpriced cost, not residents' demand.")]),
    ("A city wants to reduce the output of a good whose production causes pollution. Which policy best leads the producer to take the external cost into account?",
     "A tax on each unit produced that equals the marginal external cost of the pollution.",
     "A per-unit tax equal to the marginal external cost raises the producer's private cost to the social cost.",
     [("A subsidy on each unit produced that equals the marginal external cost.", "A subsidy lowers the producer's cost and increases the quantity, which worsens the problem."),
      ("A price ceiling below the market price of the good.", "A price ceiling creates a shortage and does not make the producer account for the external cost."),
      ("A tax on consumers' income that equals the marginal external cost.", "An income tax does not change the producer's cost for each unit of pollution."),
      ("A lump-sum tax on the producer that does not depend on output.", "A lump-sum tax does not change the cost of producing another unit.")]),
]


def mi_externality_remedy(rng):
    return _bank(rng, "mi_externality_remedy", "6.2", "2.A", EXT, "a negative externality makes social cost exceed private cost, and a per-unit tax equal to the marginal external cost internalizes it", "fixed vetted scenarios; wrong options reverse the cost gap or choose a policy that raises output")
