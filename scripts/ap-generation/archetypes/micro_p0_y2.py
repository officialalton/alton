"""AP Microeconomics 확대 MI5 — 신규 원형 Y2(단원 3·4·6 보충 6개: 가격차별 2·독점 비교·시장구조 식별·외부효과·가동 중단). 2026-10-21. 고정 문장 은행, 정답 문장이 오답보다 지나치게 길지 않게 쓴다.
참고: 이 저장소에서 토픽 4.3 은 가격차별(mi_pd_*)이다."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_p0_s5a import _bank

STAGE_Y_C = [
    "mi_pdiscrim_profit_logic", "mi_monopoly_welfare_compare", "mi_pdiscrim_effect_cases", "mi_structure_features_match",
    "mi_externality_permits", "mi_seasonal_shutdown",
]

PDLOGIC = [
    ("A software company sells the same program to schools and to businesses, charging schools a much lower price. Which statement best explains why this pricing can raise the company's profit?",
     "Schools have more elastic demand than businesses, and the company can keep the groups from reselling to each other.",
     "Charging more where demand is less elastic and less where it is more elastic raises profit if resale is prevented.",
     [("Schools have less elastic demand than businesses, so a lower price raises revenue from schools.", "A price cut raises revenue only where demand is elastic, which is the more price-sensitive group."),
      ("The two groups have the same elasticity, so different prices raise profit by confusing buyers.", "With identical elasticities there is no gain from charging different prices."),
      ("The company's marginal cost is lower for schools, so schools must pay a lower price.", "Price discrimination is based on willingness to pay and elasticity, not on a difference in marginal cost."),
      ("Businesses can easily resell the program to schools, so the lower price protects the company.", "Easy resale would undermine the price difference.")]),
    ("A museum charges a lower admission price to students than to other adults and checks identification at the door. Which statement best explains why the museum can increase its profit this way?",
     "Students are more sensitive to price than other adults, and the identification check prevents resale of student tickets.",
     "Separating more elastic and less elastic buyers and preventing resale lets the museum raise profit with different prices.",
     [("Students are less sensitive to price than other adults, so the discount raises the number of student visits.", "A discount helps only where buyers are price sensitive, so students must be the more elastic group."),
      ("Students cost more to serve than other adults, so they must pay a higher price.", "Pricing in this way depends on elasticity of demand, not on a higher cost of serving a group."),
      ("The museum gains profit only if all visitors pay the same price, because separate prices confuse visitors.", "Charging different prices to groups with different elasticities raises profit."),
      ("The identification check is irrelevant, because students could resell tickets to other adults.", "The check prevents resale, which is a condition for the strategy to work.")]),
]


def mi_pdiscrim_profit_logic(rng):
    return _bank(rng, "mi_pdiscrim_profit_logic", "4.3", "2.B", PDLOGIC, "charging a higher price to the less elastic group and preventing resale raises a monopolist's profit", "fixed vetted scenarios; wrong options reverse which group pays more or ignore the resale condition")


COMPARE = [
    ("Compared with the same industry if it were perfectly competitive, a single-price monopolist producing a good with the same costs will most likely have which result?",
     "A higher price and a lower quantity, with a deadweight loss.",
     "The monopolist produces where marginal revenue equals marginal cost, so price exceeds marginal cost and quantity is lower than efficient.",
     [("A lower price and a higher quantity, with a gain in total surplus.", "Monopoly restricts output and raises the price relative to competition."),
      ("The same price and quantity, but a lower consumer surplus.", "A change in market power changes the price and the quantity."),
      ("A higher price and a higher quantity, because the monopolist's revenue is larger.", "A monopolist raises its price by cutting, not raising, the quantity."),
      ("A lower price, because the monopolist's cost per unit is lower.", "With the same costs, the monopolist's price is not lower.")]),
    ("Which statement correctly compares consumer surplus in a market served by a single-price monopolist with the same market under perfect competition, assuming the same costs and demand?",
     "Consumer surplus is smaller under monopoly, because the price is higher and the quantity is lower.",
     "Higher price and lower quantity shrink the area between the demand curve and the price.",
     [("Consumer surplus is larger under monopoly, because the monopolist has a higher profit.", "Higher monopoly profit is not a source of consumer surplus."),
      ("Consumer surplus is the same, because demand does not change.", "Consumer surplus depends on the price and quantity, which both change."),
      ("Consumer surplus is larger under monopoly, because the price is lower.", "The monopoly price is higher than the competitive price."),
      ("Consumer surplus is smaller under monopoly, because the quantity is higher.", "The monopoly quantity is lower than the competitive quantity.")]),
]


def mi_monopoly_welfare_compare(rng):
    return _bank(rng, "mi_monopoly_welfare_compare", "4.2", "1.D", COMPARE, "a single-price monopoly charges more and sells less than perfect competition, which lowers consumer surplus and creates deadweight loss", "fixed vetted scenarios; wrong options reverse the price or quantity comparison")


PDCASE = [
    ("A monopolist that had been charging one price to all buyers begins to charge each buyer exactly the most that buyer is willing to pay. Compared with the single-price outcome, which statement is correct?",
     "Output rises to the efficient level, consumer surplus falls to zero, and the deadweight loss disappears.",
     "A perfect price discriminator sells every unit that buyers value above marginal cost, so output is efficient and the monopolist captures the surplus.",
     [("Output falls, consumer surplus rises, and the deadweight loss grows.", "Perfect price discrimination raises output, and the seller captures consumer surplus."),
      ("Output is unchanged, consumer surplus is unchanged, and the deadweight loss disappears.", "The deadweight loss disappears only because output expands and the surplus is captured."),
      ("Output rises, consumer surplus rises, and the deadweight loss disappears.", "The seller captures consumer surplus, so it does not rise."),
      ("Output rises to the efficient level, and consumer surplus rises to its largest value.", "Under perfect discrimination, consumer surplus falls to zero.")]),
    ("A monopolist currently charging a single price starts charging a lower price to a second group of buyers whose willingness to pay is below the original price, without changing the price paid by the first group. Which statement is most likely true?",
     "Output increases, because the second group buys units that were not sold at the single price.",
     "Sales to the second group are additional units, so total output rises and the deadweight loss falls.",
     [("Output decreases, because the second group's lower price reduces the monopolist's marginal revenue.", "The second group buys additional units, so output increases."),
      ("Output is unchanged, because the first group's price did not change.", "The second group buys units that were not sold before."),
      ("Output increases, but the first group's consumer surplus rises.", "The first group's price is unchanged, so its consumer surplus is unchanged."),
      ("Deadweight loss rises, because more units are sold at lower prices.", "More units sold at prices above marginal cost reduce the deadweight loss.")]),
]


def mi_pdiscrim_effect_cases(rng):
    return _bank(rng, "mi_pdiscrim_effect_cases", "4.2", "3.A", PDCASE, "price discrimination raises output relative to a single price, and perfect discrimination removes the deadweight loss and consumer surplus", "fixed vetted scenarios; wrong options reverse the output, surplus, or deadweight-loss effect")


STRUCT = [
    ("A town has dozens of restaurants, each selling its own style of food at its own price, and new restaurants can open easily. Which market structure does the restaurant market best represent?",
     "Monopolistic competition, because there are many sellers of differentiated products and entry is easy.",
     "Many firms, differentiated products, and free entry describe monopolistic competition.",
     [("Perfect competition, because there are many sellers and entry is easy.", "Perfect competition requires identical products, but restaurants differentiate their food."),
      ("Oligopoly, because each restaurant is aware of its rivals.", "Oligopoly has a few large sellers, not dozens of small ones."),
      ("Monopoly, because each restaurant is the only seller of its own style of food.", "Many close substitutes remain, so no restaurant is a monopoly."),
      ("Perfect competition, because each restaurant sets its own price.", "Setting its own price indicates market power, not perfect competition.")]),
    ("The only company that supplies electricity to a region is protected by high costs of building a second network, so no rival can enter. Which market structure does the electricity market best represent?",
     "Monopoly, because there is a single seller and barriers to entry block rivals.",
     "A single seller protected by barriers to entry describes a monopoly.",
     [("Oligopoly, because the company is large and has few competitors.", "Oligopoly requires a few sellers, but this market has only one."),
      ("Monopolistic competition, because the company sells a differentiated product.", "Monopolistic competition requires many sellers and free entry."),
      ("Perfect competition, because customers pay the same price for electricity.", "Perfect competition requires many sellers, which this market lacks."),
      ("Monopoly, because the company can enter any market it wants.", "Monopoly is defined by barriers that keep others out, not by the firm's freedom to enter other markets.")]),
]


def mi_structure_features_match(rng):
    return _bank(rng, "mi_structure_features_match", "4.1", "1.B", STRUCT, "market structures are identified by the number of sellers, product differentiation, and barriers to entry", "fixed vetted scenarios; wrong options swap the number of sellers or the entry condition")


PERMIT = [
    ("A government limits total pollution by issuing a fixed number of tradable pollution permits, and firms may buy and sell the permits. Which statement best explains why trading can lower the total cost of meeting the limit?",
     "Firms that can cut pollution cheaply sell permits to firms for which cutting is costly, so the cuts happen where they cost least.",
     "Trading moves the reductions to the firms with the lowest abatement costs while total pollution stays at the cap.",
     [("Firms that can cut pollution cheaply buy more permits, so they cut less.", "Low-cost reducers have more to gain by selling permits than buying them."),
      ("Trading raises total pollution above the cap, because permits can be sold to anyone.", "The cap fixes total pollution regardless of who holds the permits."),
      ("Trading is not useful, because every firm must cut by the same amount.", "Trading lets firms with different costs cut by different amounts."),
      ("Permits raise the marginal social benefit of pollution, so firms pollute less.", "Permits create a price for pollution, which does not change social benefit.")]),
    ("A government changes from a rule that requires every firm to reduce pollution by 20 percent to a rule that allows firms to trade pollution permits under a fixed total cap. Which statement best describes the likely result?",
     "The same total pollution reduction is achieved at a lower total cost, because firms with low cutting costs reduce more.",
     "Allowing trades shifts reductions to firms with the lowest costs, so the cap is met more cheaply.",
     [("The total pollution reduction is smaller, because firms are no longer required to reduce.", "The total cap still fixes the total reduction."),
      ("The total cost of meeting the cap is higher, because trading adds transaction costs for every firm.", "Trading usually lowers total costs because reductions shift to low-cost firms."),
      ("The same total pollution reduction is achieved at the same cost, because every firm cuts by the same amount.", "Under trading, firms do not all cut by the same amount."),
      ("Pollution falls to zero, because firms with high costs buy permits.", "Permits are limited by the cap, so pollution does not fall to zero.")]),
]


def mi_externality_permits(rng):
    return _bank(rng, "mi_externality_permits", "6.2", "2.A", PERMIT, "tradable permits meet a pollution cap at lower cost by shifting reductions to firms with the lowest abatement costs", "fixed vetted scenarios; wrong options reverse who sells permits or claim trading changes the cap")


SEASON = [
    ("A seasonal ice cream stand in a competitive market has fixed costs that it must pay all year whether or not it opens. In the winter, the price it can charge is below its average variable cost at every quantity. Which statement best describes what the stand should do in the winter?",
     "Close for the winter, because opening would lose more than the fixed costs it must pay anyway.",
     "When price is below average variable cost, opening adds losses beyond fixed cost, so temporary closure is better.",
     [("Stay open, because the stand still earns some revenue to cover fixed costs.", "Revenue below variable cost makes the loss larger than the fixed cost alone."),
      ("Stay open, because the price is below average total cost, so closing would end all costs.", "Fixed costs continue even if the stand is closed in the short run."),
      ("Raise the price, because a competitive firm can set any price it chooses.", "A competitive firm is a price taker and cannot set its price."),
      ("Close permanently, because a short-run loss requires leaving the industry.", "A short-run shutdown does not require leaving the market for good.")]),
    ("In the summer, the price that the same ice cream stand can charge is above its average variable cost but below its average total cost. Which statement best describes what the stand should do in the summer?",
     "Stay open and produce, because the revenue covers all variable costs and part of the fixed costs.",
     "When price exceeds average variable cost, producing reduces the loss compared with closing and paying all fixed costs.",
     [("Close, because the stand is making a loss.", "A short-run loss does not require closing if variable costs are covered."),
      ("Close, because price is below average total cost, which includes fixed costs.", "The shutdown decision compares price with average variable cost, not average total cost."),
      ("Stay open, because the stand earns a positive economic profit.", "With price below average total cost, the stand has an economic loss."),
      ("Stay open, because fixed costs are not part of the stand's costs.", "Fixed costs are real costs, but they are paid whether or not the stand operates.")]),
]


def mi_seasonal_shutdown(rng):
    return _bank(rng, "mi_seasonal_shutdown", "3.6", "2.A", SEASON, "a competitive firm operates in the short run if price covers average variable cost and closes if it does not, because fixed costs are paid either way", "fixed vetted scenarios; wrong options use average total cost or let the firm set its price")
