"""AP Microeconomics 확대 MI3 — 신규 원형 D(단원 5, 스킬 2.B 보충). 2026-10-19."""
from micro_common import *  # noqa: F401,F403
from micro_common import _sg  # noqa: F401
from micro_p0_s5a import _bank

CONCEPT_ID = [
    ("A town has one vacant lot. The council can use it for a playground or for a parking garage but not both. Which basic economic concept does the council's situation best illustrate?",
     "Scarcity, because the limited resource (land) cannot satisfy both wants, so the council must choose.",
     "A fixed amount of land with competing uses is a direct example of scarcity, which forces a choice.",
     [("A shortage, because the quantity of parking demanded exceeds the quantity supplied at the current price.", "A shortage is a market imbalance at a given price; the council's problem is a limited resource with competing uses."),
      ("Diminishing marginal utility, because the lot's value falls with each additional use.", "Nothing in the situation involves the falling value of additional units of one good."),
      ("A market failure, because the lot is not being sold in a competitive market.", "A market failure is an inefficient market outcome; the situation describes a choice under limited resources."),
      ("Comparative advantage, because the council must specialize in one of the two uses.", "Comparative advantage concerns lower opportunity costs of producers, not a choice between two uses of one resource.")]),
    ("After a city doubles the price of parking downtown, shoppers switch to the bus, and a bakery sells a bit fewer loaves to shoppers. Which concept best describes why parking demand falls when its price rises?",
     "The law of demand: at a higher price, consumers buy a smaller quantity and look for substitutes such as the bus.",
     "A higher price lowers the quantity demanded, and substitutes (bus rides) make the response larger.",
     [("The law of supply: producers offer a smaller quantity at a higher price.", "The law of supply describes sellers' behavior, not shoppers' reaction to a price increase."),
      ("The income effect only, because shoppers have less money after the higher parking price.", "A price change affects quantity demanded through both substitution and income effects; the question points to switching to substitutes."),
      ("An increase in demand for the bus that is caused by the parking price, with no change in the quantity of parking demanded.", "The quantity of parking demanded falls along the demand curve; this option ignores the movement."),
      ("Price ceilings, because the city controls the price of parking.", "A price ceiling holds a price below equilibrium; here the city raises the price.")]),
]


def mi_concept_scenario_id(rng):
    return _bank(rng, "mi_concept_scenario_id", "1.1", "1.B", CONCEPT_ID, "identify scarcity or the law of demand from a short scenario", "fixed vetted scenarios; the key names the concept the scenario illustrates", judgment="identify the concept from the features of the scenario")


COMP_ADV = [
    ("Country X can produce both cars and wheat using fewer resources than Country Z can, so X has an absolute advantage in both goods. Which statement correctly explains whether trade between X and Z can still benefit both countries?",
     "Yes, because gains from trade depend on comparative advantage: each country should specialize in the good for which its opportunity cost is lower.",
     "Even a country with an absolute advantage in everything has a lower opportunity cost in only one good, so both can gain by specializing and trading.",
     [("No, because Country X can make everything more cheaply and would gain nothing from trade.", "Confuses absolute advantage with comparative advantage; gains come from differences in opportunity cost."),
      ("Yes, but only Country Z gains, because the country with the absolute advantage gives up nothing.", "Country X also gains by concentrating on the good for which its opportunity cost is lower and importing the other."),
      ("No, because trade is beneficial only when each country has an absolute advantage in a different good.", "Absolute advantage in different goods is not required; comparative advantage is enough."),
      ("Yes, because each country should produce the good for which its absolute cost of production is lowest.", "Specialization is based on the lowest opportunity cost, not the lowest absolute resource cost.")]),
    ("A skilled lawyer is also the fastest typist in her office. She hires an assistant to type her documents even though she types faster than the assistant. Which statement best explains why this decision is efficient?",
     "She has a comparative advantage in legal work, because the opportunity cost of an hour spent typing (the legal work she gives up) is greater than the assistant's.",
     "Specializing where the opportunity cost is lowest raises total output even if she has an absolute advantage in both tasks.",
     [("She has an absolute advantage in legal work only, because she is better at law than the assistant.", "The lawyer is faster at typing too, so she has an absolute advantage in both tasks; the efficient choice rests on opportunity cost."),
      ("She has a comparative advantage in typing, because she types faster than the assistant.", "Typing faster shows an absolute advantage; the assistant's opportunity cost of typing is lower."),
      ("The decision is inefficient, because she could do both tasks faster herself.", "Doing both tasks herself would give up the more valuable legal work, so total output would be lower."),
      ("The decision is efficient only if the assistant is paid less than the lawyer earns for one hour of legal work.", "The decision is efficient whenever the opportunity cost of her typing time exceeds the assistant's, which does not depend on a particular wage comparison alone.")]),
]


def mi_absolute_vs_comparative(rng):
    return _bank(rng, "mi_absolute_vs_comparative", "1.4", "2.B", COMP_ADV, "gains from trade rest on comparative advantage even when one party has an absolute advantage in everything", "fixed vetted scenarios; the key explains the gain with opportunity cost, not absolute cost", judgment="separate absolute from comparative advantage and explain the gain")


LABOR_FORCES = [
    ("Two things happen at once in a competitive labor market for warehouse workers: a new scanning technology raises each worker's marginal product, and a wave of new residents increases the number of people willing to work at every wage. Which statement describes the effect on the equilibrium wage and employment?",
     "Employment rises, but the change in the wage is indeterminate, because labor demand shifts right and labor supply shifts right at the same time.",
     "Higher productivity shifts labor demand right (wage up, employment up) and more workers shifts labor supply right (wage down, employment up); employment rises for sure, the wage depends on which shift is larger.",
     [("The wage rises and employment rises, because greater productivity always raises wages.", "Ignores the supply shift; more workers put downward pressure on the wage."),
      ("The wage falls and employment falls, because more workers compete for the same jobs.", "Ignores the demand shift and mislabels employment; both shifts raise employment."),
      ("Employment is indeterminate, but the wage rises, because demand and supply shift in opposite directions.", "Both curves shift right, so employment rises with certainty and the wage is the indeterminate variable."),
      ("Neither the wage nor employment changes, because the two shifts cancel each other out.", "The shifts offset only in the wage in special cases; both increase the quantity of labor employed.")]),
    ("In a competitive labor market, a union convinces some workers to retire early, which reduces the number of workers willing to work at every wage, while at the same time higher demand for the product raises the marginal revenue product of labor. Which statement describes the effect on the equilibrium wage and employment?",
     "The wage rises, but the change in employment is indeterminate, because labor supply shifts left and labor demand shifts right.",
     "A leftward supply shift and a rightward demand shift both raise the wage; employment falls with the supply shift and rises with the demand shift, so its change depends on the sizes.",
     [("Employment rises and the wage rises, because demand for the product increased.", "Ignores the supply decrease; a smaller labor force reduces the quantity of labor supplied at each wage."),
      ("The wage falls and employment is indeterminate, because fewer workers lower the wage.", "Fewer workers raise, not lower, the wage when supply shifts left."),
      ("Employment falls and the wage is indeterminate, because the shifts push the wage in opposite directions.", "Both shifts raise the wage, so the wage is determinate; employment is the indeterminate variable."),
      ("The wage rises and employment falls, because labor supply is the only curve that shifts.", "Labor demand also shifts right, which offsets the fall in employment.")]),
]


def mi_labor_forces_both_shift(rng):
    return _bank(rng, "mi_labor_forces_both_shift", "5.2", "2.B", LABOR_FORCES, "simultaneous shifts in labor demand and labor supply: one variable is determinate, the other is not", "fixed vetted scenarios; the key applies the double-shift rule to wage and employment",
                 judgment="combine the two shifts and decide which variable is determinate")


INPUT_DEM = [
    ("A restaurant can make meals with either cooks or automated kitchen machines, and the two are substitutes in production. The price of the automated machines falls sharply. Holding the wage constant, which statement correctly describes the effect on the restaurant's demand for cooks?",
     "The restaurant substitutes machines for cooks, which tends to decrease the demand for cooks, though the larger output it can now afford works in the opposite direction.",
     "A cheaper substitute input lowers demand for labor through the substitution effect, partly offset by an output effect when lower costs raise production.",
     [("The demand for cooks increases, because the restaurant is producing more meals.", "Reports only the output effect and ignores the substitution of machines for cooks."),
      ("The demand for cooks is unaffected, because labor demand depends only on the wage.", "Labor demand also depends on the prices of other inputs and on the product price."),
      ("The demand for cooks decreases by the full amount, because the output effect never matters.", "Ignores the output effect that partly offsets the substitution effect."),
      ("The quantity of cooks demanded increases along the same labor demand curve, because machines are cheaper.", "A change in another input's price shifts the labor demand curve rather than moving along it.")]),
    ("A restaurant uses cooks and ovens together, and the two inputs are complements in production. The price of ovens falls. Holding the wage constant, which statement correctly describes the effect on the restaurant's demand for cooks?",
     "The demand for cooks increases, because cheaper ovens raise the marginal product of cooks and the restaurant expands output.",
     "When inputs are complements, a cheaper partner input raises the productivity of labor and the scale of output, so labor demand shifts right.",
     [("The demand for cooks decreases, because the restaurant substitutes ovens for cooks.", "Treats complements as substitutes."),
      ("The demand for cooks is unaffected, because the wage has not changed.", "A change in the price of a complementary input shifts labor demand even if the wage is unchanged."),
      ("The quantity of cooks demanded decreases along the labor demand curve, because ovens cost less.", "A change in another input's price shifts the whole curve; it is not a movement along the curve."),
      ("The demand for cooks decreases, because lower costs of ovens reduce the restaurant's output.", "Lower input costs raise the profit-maximizing output.")]),
]


def mi_input_price_effect(rng):
    return _bank(rng, "mi_input_price_effect", "5.3", "2.B", INPUT_DEM, "the price of a substitute or complementary input shifts labor demand through substitution and output effects", "fixed vetted scenarios; the key combines the substitution and output effects",
                 judgment="separate the substitution effect from the output effect and decide the net direction")
