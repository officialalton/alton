"""AP Macroeconomics 확대 MA3 — 신규 원형 X3(단원 3·4·5 비수치 보충). 2026-10-19. 키 문장이 오답보다 지나치게 길지 않게(key_much_longer 게이트) 쓴다."""
from macro_common import *  # noqa: F401,F403
from macro_p0_x1 import _bank

FISCAL_LAGS = [
    ("Policymakers notice that the economy is in a recession, but a tax cut passed by Congress takes effect only after the recession has already ended. Which statement best describes the problem this illustrates?",
     "Fiscal policy lags can make a stimulus arrive too late, so it may add to demand when the economy is already recovering.", "Recognition, legislative, and implementation lags delay discretionary fiscal policy, which can make it destabilizing.",
     [("Automatic stabilizers acted too slowly because they require a vote in Congress.", "Automatic stabilizers need no vote; the lag described belongs to discretionary policy."), ("The tax cut had no effect, because fiscal policy cannot change aggregate demand.", "Fiscal policy can change aggregate demand; the issue is the timing."),
      ("The central bank should have raised interest rates, because tax cuts always cause inflation.", "A tax cut raises demand; the lag problem is about timing, not about a monetary response."), ("Crowding out, because the tax cut raised interest rates and reduced private investment.", "Crowding out concerns higher interest rates from deficit financing, not delays.")]),
    ("A government passes a large spending program in response to a recession, but the projects begin only after the economy has returned to full employment. Which statement best explains why this is a drawback of discretionary fiscal policy?",
     "The spending adds to aggregate demand when it is no longer needed, which can push the economy into an inflationary gap.", "Long lags can turn a well-intended stimulus into an overheating of the economy.",
     [("The spending lowers aggregate demand, because projects take time to complete.", "Government purchases raise aggregate demand once they are made."), ("The spending reduces potential output, because the government competes with firms for resources.", "A temporary change in demand does not reduce potential output."),
      ("The spending is unnecessary, because the economy always returns to full employment immediately.", "Self-correction takes time; the problem is a mismatch in timing."), ("The spending has no effect, because it was financed with taxes in earlier years.", "Spending adds to demand regardless of when taxes were collected.")]),
]


def ma_fiscal_lags(rng):
    return _bank(rng, "ma_fiscal_lags", "3.8", "2.B", FISCAL_LAGS, "lags make discretionary fiscal policy hard to time", "fixed vetted scenarios; wrong options misattribute the lag or deny that policy affects demand", judgment="explain the timing problem of discretionary policy")


INFL_GAP = [
    ("The economy is operating at an output level above potential real GDP, and the unemployment rate is below the natural rate. Assuming no policy response, which statement best describes the long-run adjustment?",
     "Nominal wages and input prices rise, shifting short-run aggregate supply left until output returns to potential and the price level is higher.", "Tight resource markets bid up wages and input prices, which shifts SRAS left and removes the inflationary gap.",
     [("Nominal wages and input prices fall, shifting short-run aggregate supply right, so the price level falls.", "An inflationary gap puts upward pressure on wages, not downward."), ("Long-run aggregate supply shifts right until it matches the higher level of output.", "Potential output does not rise because actual output exceeds it."),
      ("Aggregate demand shifts right until the gap is closed.", "A rightward shift in AD would widen the gap."), ("Real GDP stays above potential output indefinitely, because prices adjust only downward.", "Prices and wages adjust upward in an inflationary gap, which eliminates the gap.")]),
]


def ma_inflationary_gap_adjust(rng):
    return _bank(rng, "ma_inflationary_gap_adjust", "3.7", "3.A", INFL_GAP, "self-correction of an inflationary gap through rising input prices", "fixed vetted scenario; wrong options reverse the wage response or shift the wrong curve", judgment="trace the adjustment from an inflationary gap to long-run equilibrium")


DEF_REC = [
    ("During a recession the federal budget deficit grows even though Congress has passed no new laws. Which statement best explains this?",
     "Tax revenues fall and spending on transfers such as unemployment benefits rises automatically as income falls.", "These are automatic stabilizers: lower incomes reduce tax receipts and raise benefit payments.",
     [("Congress automatically raises government purchases whenever unemployment rises.", "Changes in purchases require a decision by Congress."), ("Interest rates fall in recessions, which raises the government's tax revenue.", "Lower interest rates do not raise tax revenue; falling incomes lower it."),
      ("Tax rates rise automatically in recessions to finance the benefits.", "Tax rates stay the same; revenue falls because the tax base shrinks."), ("The central bank buys government bonds, which increases the deficit directly.", "Open market purchases change reserves and interest rates; they do not change the deficit directly.")]),
]


def ma_deficit_in_recession(rng):
    return _bank(rng, "ma_deficit_in_recession", "3.9", "3.A", DEF_REC, "automatic stabilizers raise the deficit in a recession", "fixed vetted scenario; wrong options credit new laws or rate changes", judgment="explain why the deficit changes without any new legislation")


MD_SHIFT = [
    ("Which of the following events would increase the demand for money in the money market?",
     "A rise in real GDP, which increases the number and value of transactions people carry out.", "More transactions raise the need for money balances at every interest rate.",
     [("A fall in the nominal interest rate, which moves the economy along the money demand curve.", "A change in the interest rate moves along the curve and does not shift it."), ("An increase in the money supply by the central bank.", "A change in supply shifts the supply curve, not demand."),
      ("A fall in the price level, which reduces the amount of money needed for purchases.", "A fall in the price level decreases the demand for money; it does not increase it."), ("A rise in the interest rate paid on government bonds.", "A higher return on bonds lowers money demand at each interest rate.")]),
]


def ma_money_demand_shift_factors(rng):
    return _bank(rng, "ma_money_demand_shift_factors", "4.5", "3.A", MD_SHIFT, "money demand shifts with the price level and real GDP and moves along with the interest rate", "fixed vetted statements; wrong options are movements along the curve or supply changes", judgment="separate a shift of money demand from a movement along it")


MON_LAGS = [
    ("The central bank lowers its interest rate target in response to a recession, but investment and consumption respond only many months later. Which statement best describes the problem this illustrates?",
     "Lags in monetary policy mean the stimulus can take effect after the economy has begun to recover, which can add to inflation.", "Interest-rate changes affect spending slowly, so policy may arrive late.",
     [("Monetary policy cannot change interest rates, so it has no effect on aggregate demand.", "The central bank can change interest rates; the issue is the delay before spending responds."), ("The central bank should have raised the target, because lower rates cause recessions.", "Lower rates raise spending; the problem is timing, not direction."),
      ("Fiscal policy always works faster, so monetary policy should never be used.", "Fiscal policy also has lags, and monetary policy is useful because it can be changed quickly."), ("The delay shows that the money supply is not related to interest rates.", "The money supply and interest rates are linked; the delay concerns the spending response.")]),
]


def ma_monetary_lags(rng):
    return _bank(rng, "ma_monetary_lags", "4.6", "2.B", MON_LAGS, "monetary policy works with lags between the rate change and the response of spending", "fixed vetted scenario; wrong options deny the link or reverse the direction", judgment="explain the timing problem of monetary policy")


LF_INFLOW = [
    ("Foreign savers become more willing to lend to domestic borrowers, increasing the supply of loanable funds in the domestic loanable funds market. Which statement correctly describes the effect on the real interest rate and domestic investment?",
     "The real interest rate falls and domestic investment rises, because more loanable funds are available.", "A rightward shift of loanable funds supply lowers the equilibrium real interest rate and raises investment.",
     [("The real interest rate rises and domestic investment falls, because foreign lenders demand higher returns.", "A larger supply lowers the equilibrium rate."), ("The real interest rate falls and domestic investment falls, because lower rates discourage borrowing.", "A lower rate raises the quantity of funds demanded for investment."),
      ("The real interest rate is unchanged, because foreign saving does not enter the domestic market.", "Foreign saving adds to loanable funds supplied in the domestic market."), ("Only the nominal interest rate falls, because the real rate is set by the central bank.", "The real rate is determined in the loanable funds market.")]),
]


def ma_lf_capital_inflow(rng):
    return _bank(rng, "ma_lf_capital_inflow", "4.7", "3.B", LF_INFLOW, "a capital inflow raises loanable funds supply, lowers the real interest rate, and raises investment", "fixed vetted scenario; wrong options reverse the rate or investment effect", judgment="trace a shift in loanable funds supply to the rate and investment")


PC_BELOW = [
    ("The unemployment rate stays below the natural rate for a long period, and workers begin to demand and receive higher nominal wages. Which statement correctly describes what happens to the short-run Phillips curve?",
     "It shifts upward, because higher wage demands raise inflation expectations and costs at every unemployment rate.", "Persistent tight labor markets raise expected inflation, which shifts the short-run Phillips curve up.",
     [("It shifts downward, because higher wages lower the inflation rate.", "Higher wages raise costs and inflation."), ("It stays in the same place, because wages do not affect the Phillips curve.", "Wage pressure and expectations shift the short-run curve."),
      ("The long-run Phillips curve shifts to the left, because unemployment is below the natural rate.", "The long-run curve is vertical at the natural rate and does not shift with this event."), ("The economy moves down along the curve to even lower unemployment with the same inflation.", "Lower unemployment along the curve is associated with higher, not equal, inflation.")]),
]


def ma_phillips_unemp_below_natural(rng):
    return _bank(rng, "ma_phillips_unemp_below_natural", "5.2", "3.A", PC_BELOW, "persistent low unemployment raises expected inflation and shifts the short-run Phillips curve up", "fixed vetted scenario; wrong options reverse the shift or move the long-run curve", judgment="decide how expectations change the short-run curve")


DEBT_BURDEN = [
    ("Which of the following best describes how a large national debt can burden future generations?",
     "Interest payments on the debt must be paid from future taxes, and borrowing can reduce the private capital stock through higher interest rates.", "Debt service competes with other government uses, and crowding out can lower future productive capacity.",
     [("The debt must be repaid in full by the next generation, because the government cannot roll over its debt.", "Governments normally roll over (refinance) their debt rather than repaying it all at once."), ("The debt is always owed to foreign countries, so every dollar of interest leaves the economy.", "Much government debt is held by domestic residents, so interest on that part stays in the economy."),
      ("The debt automatically reduces future real GDP by the amount of the debt.", "The effect depends on interest rates, crowding out, and how the borrowed funds were used."), ("The debt has no effect, because the government can print money to pay it off at no cost.", "Financing the debt with money creation causes inflation, which is a cost.")]),
]


def ma_debt_burden_concept(rng):
    return _bank(rng, "ma_debt_burden_concept", "5.4", "1.A", DEBT_BURDEN, "how the national debt can burden future generations", "fixed vetted statement; wrong options overstate or deny the burden")


TWIN = [
    ("The government increases its budget deficit by borrowing in the loanable funds market, and the real interest rate rises. Which statement correctly describes the likely effect on net capital inflow and the value of the dollar?",
     "Net capital inflow rises and the dollar appreciates, because higher domestic interest rates attract foreign lenders.", "Higher domestic interest rates raise the demand for dollar assets, which appreciates the dollar and lowers net exports.",
     [("Net capital inflow falls and the dollar depreciates, because higher interest rates discourage foreign lending.", "Higher interest rates make domestic assets more attractive to foreign lenders."), ("Net capital inflow is unchanged, because the deficit is financed only by domestic savers.", "Foreign savers respond to higher domestic interest rates."),
      ("Net capital inflow rises and the dollar depreciates, because foreign lending lowers the value of the dollar.", "Greater demand for dollar assets increases the demand for dollars."), ("Net exports rise, because a stronger dollar makes domestic goods cheaper abroad.", "A stronger dollar makes domestic goods more expensive abroad and lowers net exports.")]),
]


def ma_twin_deficits(rng):
    return _bank(rng, "ma_twin_deficits", "5.5", "3.B", TWIN, "a larger budget deficit raises interest rates, attracts capital inflow, appreciates the dollar, and lowers net exports", "fixed vetted scenario; wrong options reverse a link in the chain", judgment="follow the effect of a deficit into the open economy")


HYPER = [
    ("A country's government finances large budget deficits by having the central bank create new money, and prices in the country double every month. Which statement best identifies the cause of the high inflation?",
     "A very rapid increase in the money supply relative to real output, which raises the price level.", "Persistent, rapid money growth far above real output growth causes very high inflation (quantity theory).",
     [("A rapid increase in real output that raises the demand for money.", "Faster real output growth would reduce, not raise, inflation for a given money growth."), ("A fall in the natural rate of unemployment that shifts the Phillips curve.", "Movements in the natural rate do not explain price doubling every month."),
      ("A decrease in the money supply that lowers velocity.", "A smaller money supply would lower, not raise, the price level."), ("An increase in potential output that shifts long-run aggregate supply.", "Higher potential output would tend to lower prices.")]),
]


def ma_hyperinflation_cause(rng):
    return _bank(rng, "ma_hyperinflation_cause", "5.3", "1.B", HYPER, "very high inflation comes from money growth far above real output growth", "fixed vetted scenario; wrong options name real-side or opposite-direction causes")


GOAL_CONFLICT = [
    ("Policymakers want to reduce the unemployment rate in the short run and also to keep the inflation rate low. Which statement best describes the conflict between these two goals along a short-run Phillips curve?",
     "Policies that raise aggregate demand lower unemployment but also raise inflation, so reaching one goal makes the other harder.", "Along a short-run Phillips curve, lower unemployment is associated with higher inflation.",
     [("Policies that raise aggregate demand lower both unemployment and inflation, so the goals do not conflict.", "Higher demand raises prices, which raises inflation."), ("Policies that lower aggregate demand raise unemployment and also raise inflation.", "Lower demand reduces inflation pressure."),
      ("Unemployment and inflation both fall whenever the central bank raises interest rates.", "Higher interest rates raise unemployment in the short run."), ("The goals conflict only in the long run, when the Phillips curve is downward sloping.", "The long-run curve is vertical; the trade-off exists in the short run.")]),
]


def ma_policy_goal_conflict(rng):
    return _bank(rng, "ma_policy_goal_conflict", "5.1", "2.B", GOAL_CONFLICT, "demand policy faces a short-run trade-off between unemployment and inflation", "fixed vetted scenario; wrong options deny or reverse the trade-off", judgment="explain the conflict between two policy goals")


STAGE_X_B = ["ma_fiscal_lags", "ma_inflationary_gap_adjust", "ma_deficit_in_recession", "ma_money_demand_shift_factors", "ma_monetary_lags", "ma_lf_capital_inflow", "ma_phillips_unemp_below_natural", "ma_debt_burden_concept", "ma_twin_deficits", "ma_hyperinflation_cause", "ma_policy_goal_conflict",
             "ma_absolute_vs_comparative", "ma_tax_vs_spending_compare", "ma_fiscal_policy_compare", "ma_stabilizer_vs_discretionary", "ma_stagflation_dilemma", "ma_fed_tools_compare", "ma_longrun_phillips_why", "ma_phillips_compare", "ma_bop_account_entries", "ma_supply_self_correction"]
