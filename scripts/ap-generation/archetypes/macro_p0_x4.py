"""AP Macroeconomics 확대 MA3 — 신규 원형 X4(단원 4·5 비수치 보충: 설명·다변수 문항). 2026-10-19. 정답 문장이 오답보다 지나치게 길지 않게 쓴다."""
from macro_common import *  # noqa: F401,F403
from macro_p0_x1 import _bank

NEUTRAL = [
    ("Suppose the money supply in an economy doubles permanently while real output, velocity, and everything else stay the same. Which statement best explains the long-run effect?",
     "The price level roughly doubles, because the same real output is exchanged for twice as much money.", "With MV = PQ and V and Q unchanged, a doubling of M doubles P.",
     [("Real output doubles, because people have twice as much money to spend.", "In the long run real output is set by resources and technology, not by money."), ("The price level is unchanged, because real output is unchanged.", "With output and velocity fixed, a larger money supply must raise the price level."),
      ("The interest rate falls permanently, because the supply of money is larger.", "In the long run the real interest rate is set by saving and investment, not the money supply."), ("Velocity doubles, because people hold less money relative to their income.", "The scenario holds velocity constant.")]),
]


def ma_money_neutral_explain(rng):
    return _bank(rng, "ma_money_neutral_explain", "5.3", "2.A", NEUTRAL, "long-run neutrality: a larger money supply raises the price level, not real output", "fixed vetted scenario; wrong options give money real long-run effects", judgment="explain the long-run effect of money growth with the equation of exchange")


ANTIC = [
    ("Workers and firms correctly expect 5 percent inflation, and actual inflation turns out to be 5 percent. Which statement best explains why this anticipated inflation has smaller real effects than unexpected inflation?",
     "Wages and contracts already include the expected inflation, so real wages and relative prices are not distorted.", "When inflation is anticipated, nominal contracts adjust in advance, leaving real values nearly unchanged.",
     [("Anticipated inflation raises real output permanently, because firms expect higher prices.", "Anticipated inflation does not raise real output."), ("Anticipated inflation lowers the real value of all contracts, because prices rise faster than wages.", "Contracts that include expected inflation keep their real value."),
      ("Anticipated inflation eliminates menu costs and shoe-leather costs completely.", "Some costs of inflation remain even when it is expected."), ("Anticipated inflation redistributes income from borrowers to lenders.", "That redistribution is caused by unexpected inflation.")]),
]


def ma_anticipated_inflation(rng):
    return _bank(rng, "ma_anticipated_inflation", "5.2", "2.A", ANTIC, "anticipated inflation is built into contracts and has smaller real effects", "fixed vetted scenario; wrong options credit anticipated inflation with real output or redistribution", judgment="explain why expectations reduce the real effects of inflation")


DEBT_INT = [
    ("A government runs large budget deficits for many years and its national debt rises steadily. Which statement best explains how the higher debt can affect future budgets?",
     "Interest payments on the larger debt become a bigger part of spending, which can force higher taxes or less spending on other programs.", "Debt service is a claim on future budgets, which raises future tax needs or reduces other spending.",
     [("Interest payments fall as debt rises, because the government can borrow at lower rates.", "A larger debt does not lower interest payments."), ("The debt raises future budgets' surpluses, because borrowed funds increase tax revenue directly.", "Borrowing does not raise tax revenue by itself."),
      ("The debt has no effect on future budgets, because the government owes the debt to itself.", "Part of the debt is held by the public and by foreigners, which requires interest payments."), ("The debt automatically lowers the inflation rate, because the government spends less.", "Deficits and debt do not automatically lower inflation.")]),
]


def ma_debt_service_budget(rng):
    return _bank(rng, "ma_debt_service_budget", "5.4", "2.A", DEBT_INT, "interest on the national debt claims a growing share of future budgets", "fixed vetted scenario; wrong options deny the claim on future budgets", judgment="explain how debt links the past deficits to future budgets")


GROWTH_INFL = [
    ("A government wants to raise the long-run growth rate of real GDP without raising the inflation rate. Which of the following policies is most consistent with that goal, and why?",
     "Subsidizing research and worker training, because this raises productivity and shifts long-run aggregate supply right without adding to demand.", "Supply-side measures raise potential output, which lowers price pressure while raising growth.",
     [("Increasing the money supply rapidly, because more money raises real GDP in the long run.", "Rapid money growth raises prices, not long-run output."), ("Raising government purchases permanently, because spending raises potential output directly.", "Higher purchases raise demand and can add to inflation."),
      ("Cutting interest rates to the lowest level possible, because cheaper credit always raises productivity.", "Lower rates stimulate demand in the short run but do not raise potential output."), ("Imposing price controls on all goods, because lower prices raise real GDP.", "Price controls distort markets and do not raise potential output.")]),
]


def ma_growth_without_inflation(rng):
    return _bank(rng, "ma_growth_without_inflation", "5.7", "2.B", GROWTH_INFL, "supply-side policies raise growth without adding inflation pressure", "fixed vetted scenario; wrong options are demand-side or distorting policies", judgment="match the policy to the goal using both growth and inflation")


DEF_GROWTH = [
    ("The government runs a large budget deficit that raises the real interest rate in the loanable funds market. Which statement best describes the effect on private investment and on future economic growth?",
     "Private investment falls (crowding out), which slows capital accumulation and lowers future long-run growth.", "Higher real interest rates reduce investment, and a smaller capital stock lowers future productive capacity.",
     [("Private investment rises, because a higher interest rate rewards savers.", "A higher rate reduces the quantity of funds demanded for investment."), ("Private investment is unaffected, because the government borrows from households only.", "Government borrowing competes with firms for loanable funds."),
      ("Future growth rises, because government spending is always more productive than private investment.", "Crowding out reduces the capital stock available for growth."), ("Future growth is unaffected, because investment does not change the capital stock.", "Investment adds to the capital stock and affects growth.")]),
]


def ma_deficit_growth_chain(rng):
    return _bank(rng, "ma_deficit_growth_chain", "5.5", "2.B", DEF_GROWTH, "deficits raise real interest rates, crowd out investment, and slow capital accumulation", "fixed vetted scenario; wrong options break a link in the chain", judgment="trace the effect from the deficit through the interest rate to investment and growth")


OIL_PC = [
    ("A sharp rise in the price of oil raises costs of production throughout the economy. Which statement best describes the effect on the short-run Phillips curve and the reason?",
     "The short-run Phillips curve shifts up, because the cost increase raises inflation at every unemployment rate.", "A leftward SRAS shift raises prices and unemployment together, shifting the short-run Phillips curve up.",
     [("The short-run Phillips curve shifts down, because higher costs reduce inflation.", "Higher costs raise inflation."), ("The economy moves along the Phillips curve to lower unemployment and higher inflation.", "The supply shock raises both unemployment and inflation, which is a shift, not a movement."),
      ("The long-run Phillips curve shifts to the right, because oil raises the natural rate permanently.", "A temporary supply shock does not shift the long-run curve."), ("The curve does not change, because oil is not in the price index.", "A cost increase that spreads through the economy raises inflation.")]),
]


def ma_supply_shock_phillips(rng):
    return _bank(rng, "ma_supply_shock_phillips", "5.2", "2.B", OIL_PC, "an adverse supply shock shifts the short-run Phillips curve up", "fixed vetted scenario; wrong options give the wrong direction or confuse a shift with a movement", judgment="link the supply shock to the shift in the Phillips curve")


PROD_BOOST = [
    ("A new technology raises labor productivity throughout the economy. Which statement best describes the long-run effect on real GDP and the price level in the AD-AS model, and why?",
     "Real GDP rises and the price level falls, because long-run and short-run aggregate supply both shift to the right.", "Higher productivity raises potential output and lowers costs, shifting both supply curves right.",
     [("Real GDP rises and the price level rises, because higher incomes raise aggregate demand only.", "The technology shifts aggregate supply, which lowers the price level."), ("Real GDP falls and the price level falls, because fewer workers are needed.", "Higher productivity raises output rather than reducing it."),
      ("Real GDP is unchanged and the price level falls, because potential output does not depend on technology.", "Technology raises potential output."), ("Real GDP rises and the price level is unchanged, because aggregate demand shifts right by the same amount.", "The technology shifts supply, not demand.")]),
]


def ma_productivity_boost_effects(rng):
    return _bank(rng, "ma_productivity_boost_effects", "5.6", "2.B", PROD_BOOST, "technology shifts aggregate supply right, raising real GDP and lowering the price level", "fixed vetted scenario; wrong options shift demand or deny the supply effect", judgment="combine the shifts of both supply curves")


FED_FX = [
    ("The Federal Reserve buys government bonds, which lowers domestic interest rates. Which statement best describes the likely effect on the foreign exchange market for the dollar and on domestic net exports?",
     "Lower domestic interest rates reduce the demand for dollar assets, so the dollar depreciates and net exports rise.", "A lower return on domestic assets lowers the demand for dollars, which depreciates the dollar and makes exports cheaper abroad.",
     [("Lower domestic interest rates raise the demand for dollars, so the dollar appreciates and net exports fall.", "Lower rates make domestic assets less attractive."), ("The dollar appreciates, because the Fed has increased the supply of dollars.", "A larger supply of dollars lowers their value; the interest rate effect points the same way."),
      ("The dollar is unaffected, because monetary policy works only on domestic markets.", "Interest rates affect international capital flows and the exchange rate."), ("Net exports fall, because a weaker dollar makes domestic goods more expensive abroad.", "A weaker dollar makes domestic goods cheaper abroad.")]),
]


def ma_fed_buys_bonds_fx(rng):
    return _bank(rng, "ma_fed_buys_bonds_fx", "4.6", "3.B", FED_FX, "expansionary monetary policy lowers interest rates, depreciates the dollar, and raises net exports", "fixed vetted scenario; wrong options reverse the exchange rate or net export effect", judgment="follow the effect of a rate change to the exchange rate and net exports")


SAVING_UP = [
    ("Households decide to save a larger share of their income, which increases the supply of loanable funds. Which statement best describes the effect on the real interest rate and on private investment in a closed economy?",
     "The real interest rate falls and private investment rises, because more funds are available for firms to borrow.", "A rightward shift in loanable funds supply lowers the equilibrium real rate and raises the quantity invested.",
     [("The real interest rate rises and private investment falls, because savers demand higher returns.", "More saving lowers the equilibrium rate."), ("The real interest rate falls and private investment falls, because lower rates reduce borrowing.", "A lower rate raises the quantity of funds demanded."),
      ("The real interest rate is unchanged, because saving does not affect the loanable funds market.", "Saving is the source of loanable funds."), ("Aggregate demand rises immediately, because more saving means more consumption.", "More saving means less consumption in the short run.")]),
]


def ma_saving_increase_effect(rng):
    return _bank(rng, "ma_saving_increase_effect", "4.7", "3.B", SAVING_UP, "higher saving shifts loanable funds supply right, lowering the real rate and raising investment", "fixed vetted scenario; wrong options reverse the rate or investment effect", judgment="trace a change in saving to the interest rate and investment")


CURR_CMP = [
    ("Which statement correctly compares the effects of a dollar appreciation and a dollar depreciation on net exports of the United States?",
     "An appreciation makes the nation's exports more expensive and imports cheaper, which lowers net exports, while a depreciation does the opposite.", "A stronger dollar buys more foreign currency, so the nation's goods cost more abroad and foreign goods cost less at home.",
     [("An appreciation makes the nation's exports cheaper and imports more expensive, which raises net exports.", "This is the effect of a depreciation, not an appreciation."), ("Both an appreciation and a depreciation raise net exports, because exchange rate changes help trade in both directions.", "The two changes move net exports in opposite directions."),
      ("Neither changes net exports, because trade depends only on incomes and not on prices.", "Relative prices expressed in a common currency affect trade."), ("A depreciation lowers net exports, because the dollar buys less foreign currency and imports cost more.", "A depreciation lowers the foreign price of the nation's goods and raises net exports.")]),
]


def ma_currency_strength_compare(rng):
    return _bank(rng, "ma_currency_strength_compare", "6.5", "1.D", CURR_CMP, "compare appreciation and depreciation effects on net exports", "fixed vetted statement; wrong options reverse or equate the two effects")


TRADE_CMP = [
    ("Which statement correctly distinguishes a trade deficit from a budget deficit?",
     "A trade deficit means imports exceed exports, while a budget deficit means government spending exceeds tax revenue.", "A trade deficit is about trade with the rest of the world; a budget deficit is about the government's own finances.",
     [("A trade deficit means government spending exceeds tax revenue, while a budget deficit means imports exceed exports.", "This swaps the two definitions."), ("A trade deficit and a budget deficit are the same thing, because both mean spending exceeds income.", "They measure different flows and can move independently."),
      ("A trade deficit means exports exceed imports, while a budget deficit means tax revenue exceeds spending.", "Both definitions are reversed; these describe a trade surplus and a budget surplus."), ("A trade deficit measures the total national debt, while a budget deficit measures the interest on the debt.", "Neither is a measure of the debt or of its interest.")]),
]


def ma_trade_vs_budget_deficit(rng):
    return _bank(rng, "ma_trade_vs_budget_deficit", "6.1", "1.D", TRADE_CMP, "a trade deficit versus a budget deficit", "fixed vetted statement; wrong options swap or merge the two concepts")


STAGE_X_D = ["ma_currency_strength_compare", "ma_trade_vs_budget_deficit"]
STAGE_X_C =["ma_money_neutral_explain", "ma_anticipated_inflation", "ma_debt_service_budget", "ma_growth_without_inflation", "ma_deficit_growth_chain", "ma_supply_shock_phillips", "ma_productivity_boost_effects", "ma_fed_buys_bonds_fx", "ma_saving_increase_effect"]
