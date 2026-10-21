"""AP Macroeconomics 확대 MA4 — 신규 원형 Y1(단원 4·5·6 보충 8개). 2026-10-21. 공개 세트·재고에 없는 풀이 틀·장면의 고정 문장 은행. 정답 문장이 오답보다 지나치게 길지 않게 쓴다."""
from macro_common import *  # noqa: F401,F403
from macro_p0_x1 import _bank

STAGE_Y_A = [
    "ma_lf_thrift_shock", "ma_lf_profit_outlook", "ma_lf_deficit_regime", "ma_lf_two_shifts_rate_qty",
    "ma_money_demand_price_level", "ma_money_supply_open_market", "ma_phillips_move_vs_shift", "ma_trade_barrier_chain",
]

THRIFT = [
    ("Households in an economy decide to save a larger share of their income at every real interest rate. Which statement best describes the effect in the market for loanable funds?",
     "The supply of loanable funds increases, so the equilibrium real interest rate falls and the quantity of investment rises.",
     "More saving shifts the supply curve right, which lowers the real rate and raises the quantity of funds borrowed for investment.",
     [("The demand for loanable funds increases, so the real interest rate rises and investment falls.", "Saving is a source of loanable funds, so it changes supply rather than demand."),
      ("The supply of loanable funds increases, so the real interest rate rises and investment falls.", "A rightward supply shift lowers the equilibrium real interest rate."),
      ("The supply of loanable funds decreases, so the real interest rate rises and investment falls.", "Higher saving raises the amount of funds offered at each rate, so supply does not fall."),
      ("Neither curve shifts, so the real interest rate stays the same and investment is unchanged.", "A change in saving at every rate is a shift of the supply curve, not a movement along it.")]),
    ("Foreign savers become less willing to lend to a country and withdraw some of their funds at every real interest rate. Which statement best describes the effect in that country's market for loanable funds?",
     "The supply of loanable funds decreases, so the equilibrium real interest rate rises and the quantity of investment falls.",
     "Less lending shifts the supply curve left, which raises the real rate and lowers the quantity of funds borrowed for investment.",
     [("The demand for loanable funds decreases, so the real interest rate falls and investment falls.", "Foreign lenders are suppliers of funds, so their withdrawal changes supply rather than demand."),
      ("The supply of loanable funds decreases, so the real interest rate falls and investment rises.", "A leftward supply shift raises, not lowers, the equilibrium real interest rate."),
      ("The supply of loanable funds increases, so the real interest rate falls and investment rises.", "Withdrawing funds reduces the amount offered at each rate, so supply does not rise."),
      ("The supply curve does not shift, because foreign funds are not part of national saving.", "Funds supplied by foreign savers are part of the supply of loanable funds.")]),
]


def ma_lf_thrift_shock(rng):
    return _bank(rng, "ma_lf_thrift_shock", "4.7", "3.B", THRIFT, "a change in saving or foreign lending shifts the supply of loanable funds and moves the real interest rate and investment in opposite directions", "fixed vetted scenarios; wrong options swap the curve that shifts or reverse the rate and investment effects")


OUTLOOK = [
    ("Firms become more optimistic about future profits and want to borrow more for new equipment at every real interest rate. Which statement best describes the effect in the market for loanable funds?",
     "The demand for loanable funds increases, so the real interest rate rises and the quantity of saving rises along the supply curve.",
     "More borrowing for investment shifts demand right, raising the real rate, which induces a movement along the upward-sloping supply curve.",
     [("The supply of loanable funds increases, so the real interest rate falls and saving falls.", "Borrowers represent demand for funds, so optimism shifts demand rather than supply."),
      ("The demand for loanable funds increases, so the real interest rate falls and saving rises.", "A rightward demand shift raises, not lowers, the equilibrium real interest rate."),
      ("The demand for loanable funds decreases, so the real interest rate falls and saving falls.", "Greater willingness to borrow raises demand, so demand does not decrease."),
      ("Neither curve shifts, so the real interest rate and saving are unchanged.", "A change in desired borrowing at every rate shifts the demand curve.")]),
    ("An investment tax credit that encouraged firms to borrow for new factories ends, and firms want to borrow less at every real interest rate. Which statement best describes the effect in the market for loanable funds?",
     "The demand for loanable funds decreases, so the real interest rate falls and the quantity of saving falls along the supply curve.",
     "Less desired borrowing shifts demand left, lowering the real rate, which reduces the quantity of funds supplied along the supply curve.",
     [("The supply of loanable funds decreases, so the real interest rate rises and investment falls.", "Ending a credit for borrowers changes the willingness to borrow, which is demand, not the supply of funds."),
      ("The demand for loanable funds decreases, so the real interest rate rises and saving rises.", "A leftward demand shift lowers, not raises, the equilibrium real interest rate."),
      ("The demand for loanable funds increases, so the real interest rate rises and saving rises.", "Firms want to borrow less, so demand does not increase."),
      ("Neither curve shifts, so the real interest rate is unchanged and only investment falls.", "A change in desired borrowing at every rate shifts the demand curve and changes the rate.")]),
]


def ma_lf_profit_outlook(rng):
    return _bank(rng, "ma_lf_profit_outlook", "4.7", "3.B", OUTLOOK, "changes in firms' desired borrowing shift the demand for loanable funds, and saving responds along the supply curve", "fixed vetted scenarios; wrong options swap the curve that shifts or reverse the rate effect")


REGIME = [
    ("A government that had balanced its budget begins running large deficits and borrows in the national loanable funds market. Which statement best describes the effect on the real interest rate and private investment?",
     "The real interest rate rises and private investment falls, because government borrowing increases the demand for loanable funds.",
     "Government borrowing adds to the demand for funds, which raises the real rate and crowds out some private borrowing for investment.",
     [("The real interest rate falls and private investment rises, because government spending adds to the supply of funds.", "Government borrowing draws on funds, so it raises demand rather than supply."),
      ("The real interest rate rises and private investment rises, because higher rates reward savers.", "A higher real rate lowers the quantity of funds firms want to borrow for investment."),
      ("The real interest rate and private investment are unchanged, because the government spends the money it borrows.", "The government's borrowing competes with private borrowers for the same funds."),
      ("The real interest rate falls and private investment falls, because less saving is available.", "A rate decrease would not accompany an increase in the demand for funds.")]),
    ("A government that had been running a deficit moves to a budget surplus and uses the surplus to repay debt, so it borrows far less in the national loanable funds market. Which statement best describes the effect on the real interest rate and private investment?",
     "The real interest rate falls and private investment rises, because lower government borrowing decreases the demand for loanable funds.",
     "Less government borrowing shifts demand left, which lowers the real rate and lets more funds go to private investment.",
     [("The real interest rate rises and private investment falls, because paying down debt reduces the supply of funds.", "Reduced government borrowing lowers demand for funds, so supply does not fall."),
      ("The real interest rate falls and private investment falls, because lower rates discourage borrowing.", "A lower real rate raises the quantity of funds firms want to borrow for investment."),
      ("The real interest rate and private investment are unchanged, because debt repayment is a transfer.", "A smaller government claim on funds frees funds for private borrowers."),
      ("The real interest rate rises and private investment rises, because the government competes less for funds.", "Lower demand for funds leads to a lower, not higher, real interest rate.")]),
]


def ma_lf_deficit_regime(rng):
    return _bank(rng, "ma_lf_deficit_regime", "4.7", "3.A", REGIME, "government borrowing is part of the demand for loanable funds, so moving into or out of deficit shifts the real interest rate and private investment", "fixed vetted scenarios; wrong options treat government borrowing as supply or reverse the crowding-out effect")


TWO = [
    ("In the market for loanable funds, households save more at every real interest rate, and at the same time firms become more eager to borrow at every real interest rate. Which statement must be true?",
     "The equilibrium quantity of loanable funds increases, but the change in the real interest rate cannot be determined.",
     "Supply and demand both shift right, so quantity rises for sure, while the real rate depends on which shift is larger.",
     [("The equilibrium real interest rate rises, but the change in the quantity cannot be determined.", "When both curves shift right, the quantity changes for certain and the rate is the ambiguous result."),
      ("The equilibrium real interest rate falls and the quantity of loanable funds rises.", "A rightward demand shift pushes the rate up, so a fall cannot be guaranteed."),
      ("The equilibrium real interest rate rises and the quantity of loanable funds falls.", "Two rightward shifts cannot lower the equilibrium quantity."),
      ("Both the real interest rate and the quantity are unchanged, because the two shifts offset each other.", "The shifts offset in the rate only if they are of exactly the right size, and they still raise the quantity.")]),
    ("In the market for loanable funds, foreign lenders withdraw funds at every real interest rate, and at the same time the government borrows more at every real interest rate. Which statement must be true?",
     "The equilibrium real interest rate rises, but the change in the quantity of loanable funds cannot be determined.",
     "Supply shifts left and demand shifts right, so the rate rises for sure while the quantity depends on which shift is larger.",
     [("The equilibrium quantity of loanable funds rises, but the change in the real interest rate cannot be determined.", "A leftward supply shift together with a rightward demand shift leaves the quantity, not the rate, ambiguous."),
      ("The equilibrium real interest rate falls and the quantity of loanable funds falls.", "Both a decrease in supply and an increase in demand raise the real rate."),
      ("The equilibrium real interest rate falls and the quantity of loanable funds rises.", "Neither shift lowers the equilibrium real interest rate."),
      ("Both the real interest rate and the quantity are unchanged, because the two shifts offset each other.", "The two shifts reinforce each other in raising the rate.")]),
]


def ma_lf_two_shifts_rate_qty(rng):
    return _bank(rng, "ma_lf_two_shifts_rate_qty", "4.7", "3.B", TWO, "when supply and demand for loanable funds both shift, one of the real interest rate and the quantity is determinate and the other is ambiguous", "fixed vetted scenarios; wrong options claim the ambiguous variable is determinate or reverse a determinate effect")


MDEM = [
    ("In a money market with a fixed money supply, the price level rises and people need more money to carry out their usual purchases. Which statement best describes the effect on the nominal interest rate and the reason?",
     "The nominal interest rate rises, because the demand for money increases while the money supply is fixed.",
     "A higher price level raises the money people want to hold at each interest rate, so demand shifts right and the equilibrium rate rises.",
     [("The nominal interest rate falls, because the demand for money increases while the money supply is fixed.", "A rightward money demand shift with fixed supply raises, not lowers, the nominal rate."),
      ("The nominal interest rate rises, because the money supply increases as prices rise.", "The central bank's money supply is unchanged, so supply does not shift."),
      ("The nominal interest rate is unchanged, because the money market only responds to the real interest rate.", "The nominal interest rate is the price of holding money, and money demand depends on it."),
      ("The nominal interest rate falls, because the demand for money decreases when prices rise.", "A higher price level raises, not lowers, money demand.")]),
    ("A new payment technology lets people complete their purchases while holding much less cash and fewer checking deposits, while the central bank leaves the money supply unchanged. Which statement best describes the effect on the nominal interest rate and the reason?",
     "The nominal interest rate falls, because the demand for money decreases while the money supply is fixed.",
     "Needing to hold less money at each interest rate shifts money demand left, so the equilibrium nominal rate falls.",
     [("The nominal interest rate rises, because the demand for money decreases while the money supply is fixed.", "A leftward money demand shift with fixed supply lowers, not raises, the nominal rate."),
      ("The nominal interest rate falls, because the money supply decreases when people hold less cash.", "The central bank leaves the money supply unchanged, so supply does not shift."),
      ("The nominal interest rate is unchanged, because the quantity of money is fixed.", "A fixed quantity of money does not prevent the price of holding money from changing."),
      ("The nominal interest rate rises, because people need more money for transactions.", "The technology reduces, not raises, the money people need to hold.")]),
]


def ma_money_demand_price_level(rng):
    return _bank(rng, "ma_money_demand_price_level", "4.5", "3.A", MDEM, "changes in the price level or in payment technology shift money demand, which moves the nominal interest rate when supply is fixed", "fixed vetted scenarios; wrong options shift the wrong curve or reverse the nominal rate effect")


OMO = [
    ("The central bank buys government bonds from banks in the open market, and the demand for money does not change. Which statement best describes the effect in the money market?",
     "The money supply increases, so the nominal interest rate falls.",
     "Bond purchases add reserves and shift the vertical money supply curve right, which lowers the equilibrium nominal rate.",
     [("The money supply increases, so the nominal interest rate rises.", "With demand unchanged, a rightward supply shift lowers the nominal rate."),
      ("The money supply decreases, so the nominal interest rate rises.", "Buying bonds puts reserves into the banking system, so the money supply does not fall."),
      ("The demand for money decreases, so the nominal interest rate falls.", "The purchase changes the supply of money, not the demand for money."),
      ("Neither curve shifts, so the nominal interest rate is unchanged.", "An open market purchase changes bank reserves and shifts money supply.")]),
    ("The central bank sells government bonds to banks in the open market, and the demand for money does not change. Which statement best describes the effect in the money market?",
     "The money supply decreases, so the nominal interest rate rises.",
     "Bond sales drain reserves and shift the vertical money supply curve left, which raises the equilibrium nominal rate.",
     [("The money supply decreases, so the nominal interest rate falls.", "With demand unchanged, a leftward supply shift raises the nominal rate."),
      ("The money supply increases, so the nominal interest rate falls.", "Selling bonds takes reserves out of the banking system, so the money supply does not rise."),
      ("The demand for money increases, so the nominal interest rate rises.", "The sale changes the supply of money, not the demand for money."),
      ("Neither curve shifts, so the nominal interest rate is unchanged.", "An open market sale changes bank reserves and shifts money supply.")]),
]


def ma_money_supply_open_market(rng):
    return _bank(rng, "ma_money_supply_open_market", "4.5", "3.A", OMO, "open market operations shift the money supply and move the nominal interest rate in the opposite direction", "fixed vetted scenarios; wrong options reverse the direction of the supply shift or attribute the change to money demand")


PHIL = [
    ("Policymakers use expansionary policy to lower the unemployment rate while expectations of inflation stay the same. Which statement correctly describes the change on the Phillips curve diagram?",
     "The economy moves up along the short-run Phillips curve to a point with lower unemployment and higher inflation.",
     "With unchanged expectations the short-run curve stays in place, so the economy moves along it to a higher inflation rate.",
     [("The short-run Phillips curve shifts right, so unemployment and inflation both rise.", "Unchanged expectations mean the short-run curve does not shift."),
      ("The economy moves down along the short-run Phillips curve to lower inflation and lower unemployment.", "Along a downward-sloping curve, lower unemployment goes with higher inflation."),
      ("The long-run Phillips curve shifts left, so the natural rate of unemployment falls.", "Expansionary demand policy does not change the natural rate."),
      ("The economy moves along the long-run Phillips curve to higher inflation and lower unemployment.", "The long-run curve is vertical, so unemployment does not change along it.")]),
    ("Workers and firms begin to expect higher inflation, and the actual unemployment rate stays at the natural rate. Which statement correctly describes the change on the Phillips curve diagram?",
     "The short-run Phillips curve shifts up, so every unemployment rate now goes with a higher inflation rate.",
     "Higher expected inflation raises wages and prices at every unemployment rate, which shifts the short-run curve up.",
     [("The economy moves up along the short-run Phillips curve to lower unemployment and higher inflation.", "A movement along the curve requires a change in unemployment, but unemployment stays at the natural rate."),
      ("The short-run Phillips curve shifts down, so every unemployment rate goes with lower inflation.", "Higher expected inflation shifts the curve up, not down."),
      ("The long-run Phillips curve shifts right, so the natural rate of unemployment rises.", "A change in inflation expectations does not move the long-run curve."),
      ("Neither curve changes, so higher expectations have no effect on inflation.", "Expected inflation is the factor that shifts the short-run curve.")]),
]


def ma_phillips_move_vs_shift(rng):
    return _bank(rng, "ma_phillips_move_vs_shift", "5.2", "1.D", PHIL, "a change in unemployment with fixed expectations is a movement along the short-run Phillips curve, while changed expectations shift the curve", "fixed vetted scenarios; wrong options confuse movement with a shift or use the long-run curve")


TRADE = [
    ("A country imposes a tariff that raises the price of imported goods, and as a result its net exports increase while the rest of the economy is unchanged. Which statement best explains the effect on the country's real GDP and price level in the short run?",
     "Aggregate demand increases, so real GDP and the price level both rise along the short-run aggregate supply curve.",
     "Higher net exports raise aggregate demand, which moves the economy up along SRAS to a larger real GDP and a higher price level.",
     [("Aggregate supply increases, so real GDP rises and the price level falls.", "Net exports are a component of aggregate demand, not a determinant of aggregate supply."),
      ("Aggregate demand increases, so real GDP rises and the price level falls.", "A rightward AD shift raises the price level along SRAS."),
      ("Aggregate demand decreases, so real GDP and the price level both fall.", "An increase in net exports raises, not lowers, aggregate demand."),
      ("Neither curve shifts, so real GDP and the price level are unchanged.", "Net exports are part of aggregate expenditure, so a change shifts aggregate demand.")]),
    ("Foreign consumers buy fewer of a country's goods after the country's currency appreciates, which lowers its net exports while the rest of the economy is unchanged. Which statement best explains the effect on the country's real GDP and price level in the short run?",
     "Aggregate demand decreases, so real GDP and the price level both fall along the short-run aggregate supply curve.",
     "Lower net exports reduce aggregate demand, which moves the economy down along SRAS to a smaller real GDP and a lower price level.",
     [("Aggregate supply decreases, so real GDP falls and the price level rises.", "Net exports are a component of aggregate demand, not a determinant of aggregate supply."),
      ("Aggregate demand decreases, so real GDP falls and the price level rises.", "A leftward AD shift lowers the price level along SRAS."),
      ("Aggregate demand increases, so real GDP and the price level both rise.", "A fall in net exports reduces, not raises, aggregate demand."),
      ("Neither curve shifts, so real GDP and the price level are unchanged.", "Net exports are part of aggregate expenditure, so a change shifts aggregate demand.")]),
]


def ma_trade_barrier_chain(rng):
    return _bank(rng, "ma_trade_barrier_chain", "6.5", "2.B", TRADE, "changes in net exports shift aggregate demand and move real GDP and the price level in the same direction along SRAS", "fixed vetted scenarios; wrong options treat net exports as aggregate supply or give a price-level change that contradicts the AD shift")
