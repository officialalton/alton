"""AP Macroeconomics 확대 MA5 — 신규 원형 Y2(단원 5 개념 문항 6개). 2026-10-21. 고정 문장 은행, 정답 문장이 오답보다 지나치게 길지 않게 쓴다."""
from macro_common import *  # noqa: F401,F403
from macro_p0_x1 import _bank

STAGE_Y_B = [
    "ma_deficit_path_debt", "ma_growth_capital_or_human", "ma_growth_sacrifice_now", "ma_hyperinflation_money_printing",
    "ma_lrpc_vertical_reason", "ma_disinflation_cost",
]

DEFDEBT = [
    ("A government that ran a budget deficit last year runs a budget surplus this year and uses the whole surplus to repay borrowing. Which statement correctly describes what happens to the national debt this year?",
     "The national debt decreases, because the surplus is used to repay part of the money previously borrowed.",
     "A surplus used for repayment reduces the stock of outstanding government borrowing, which is the national debt.",
     [("The national debt increases, because a surplus means the government is still borrowing.", "A surplus means the government is spending less than it collects, so it is not adding to its borrowing."),
      ("The national debt is unchanged, because a surplus only affects the budget deficit.", "Using the surplus to repay borrowing reduces the accumulated debt."),
      ("The national debt falls to zero, because a surplus cancels all earlier deficits.", "A single year's surplus reduces, but rarely eliminates, the accumulated debt."),
      ("The national debt increases, because repaying debt raises interest payments.", "Repaying borrowing lowers the debt on which interest is paid.")]),
    ("A government's budget deficit shrinks from a large amount last year to a small but positive amount this year. Which statement correctly describes what happens to the national debt this year?",
     "The national debt still increases, but by a smaller amount than last year, because the government is still borrowing.",
     "A positive deficit means new borrowing is added to the existing debt, even if the deficit is smaller.",
     [("The national debt decreases, because the deficit is smaller than it was last year.", "A smaller deficit still adds new borrowing, so the debt does not fall."),
      ("The national debt is unchanged, because a smaller deficit leaves total borrowing the same.", "Any positive deficit adds to the debt."),
      ("The national debt falls by the amount that the deficit declined.", "The decline in the deficit does not repay existing debt."),
      ("The national debt rises by more than last year, because debt grows faster as deficits shrink.", "The debt grows by this year's deficit, which is smaller than last year's.")]),
]


def ma_deficit_path_debt(rng):
    return _bank(rng, "ma_deficit_path_debt", "5.4", "1.B", DEFDEBT, "the national debt is the accumulation of past deficits and surpluses, so a surplus lowers it and a smaller positive deficit still raises it", "fixed vetted scenarios; wrong options confuse the flow of the deficit with the stock of the debt")


CAPHUM = [
    ("A manufacturing firm installs new automated machinery that lets each worker produce more output per hour. Which source of long-run economic growth does this best illustrate?",
     "An increase in physical capital per worker, which raises labor productivity.",
     "Machinery is physical capital, and more capital per worker raises output per worker.",
     [("An increase in human capital, because workers are producing more.", "Human capital is the skill and education of workers, while machinery is physical capital."),
      ("An increase in the labor force, because more output is produced.", "The number of workers has not changed, only the capital each worker uses."),
      ("An increase in the money supply, because firms have more funds to spend.", "Money growth does not raise long-run productivity."),
      ("A fall in the natural rate of unemployment, because machines replace workers.", "A change in the natural rate is not the source of this productivity gain.")]),
    ("A government expands a program that trains workers in advanced technical skills, so workers can produce more with the same machines. Which source of long-run economic growth does this best illustrate?",
     "An increase in human capital, which raises labor productivity.",
     "Skills and training are human capital, and more human capital raises output per worker.",
     [("An increase in physical capital, because training programs use buildings and equipment.", "Physical capital is the stock of machines and structures, which has not changed for the firm."),
      ("An increase in technological progress, because the machines have been improved.", "The machines are the same, so the gain comes from worker skills."),
      ("An increase in the labor force, because more workers are employed.", "The number of workers is unchanged, only their skills."),
      ("A decrease in natural resources per worker, because training uses up resources.", "Training does not reduce natural resources, and the effect would not raise growth.")]),
]


def ma_growth_capital_or_human(rng):
    return _bank(rng, "ma_growth_capital_or_human", "5.6", "1.A", CAPHUM, "physical capital and human capital are distinct sources of higher labor productivity and long-run growth", "fixed vetted scenarios; wrong options misclassify the source of productivity growth")


SACRIFICE = [
    ("A country chooses to devote a larger share of its output to factories and equipment and a smaller share to consumer goods this year. Which statement best describes the trade-off involved in this choice?",
     "Current consumption is lower, but the larger capital stock can raise future production and growth.",
     "Resources used for capital goods are not available for consumption now, but capital raises productive capacity later.",
     [("Current consumption is higher, because capital goods are consumed more quickly.", "Producing more capital goods leaves fewer resources for consumer goods now."),
      ("Future production is lower, because factories raise the cost of consumer goods.", "More capital raises productive capacity over time."),
      ("Neither current consumption nor future production changes, because total output is fixed.", "The choice changes the mix of output and the future capacity of the economy."),
      ("Future growth is lower, because saving reduces the funds available for investment.", "Producing more capital goods corresponds to higher, not lower, investment.")]),
    ("A government increases the share of its budget spent on education and research and cuts spending on programs that provide immediate benefits. Which statement best describes the trade-off involved in this choice?",
     "Immediate benefits are smaller, but higher productivity can raise living standards in the future.",
     "Budget funds spent on education and research are not available for current programs, but they raise future productivity.",
     [("Immediate benefits are larger, because spending on research pays off at once.", "The payoff from education and research arrives mainly in the future."),
      ("Future living standards are lower, because education spending raises taxes.", "Greater productivity raises potential output and living standards over time."),
      ("Neither immediate benefits nor future living standards change, because the budget is fixed.", "Changing the mix of spending changes both what is available now and later."),
      ("Future growth is lower, because spending on research crowds out private consumption.", "Research and education raise potential output rather than lowering growth.")]),
]


def ma_growth_sacrifice_now(rng):
    return _bank(rng, "ma_growth_sacrifice_now", "5.7", "1.D", SACRIFICE, "policies that raise long-run growth usually require giving up some current consumption or benefits", "fixed vetted scenarios; wrong options reverse the timing of the cost and benefit")


HYPER = [
    ("A government pays for its spending by creating new money at a very rapid rate while the economy's real output grows slowly. Which statement best explains the likely result?",
     "The price level rises rapidly, because the money supply grows much faster than real output.",
     "Money growth far above output growth means more money chases the same goods, which pushes prices up continuously.",
     [("Real output rises rapidly, because the larger money supply raises long-run productivity.", "Money growth does not raise long-run real output."),
      ("The price level is stable, because new money offsets the slow growth of output.", "Money growth that exceeds output growth raises prices."),
      ("The interest rate falls permanently, because the money supply is larger.", "Rapid money growth raises inflation and the nominal interest rate over time."),
      ("Unemployment falls to zero, because spending rises with the money supply.", "Rapid money growth does not eliminate unemployment.")]),
    ("A central bank keeps the money supply growing at about the same rate as real output for many years. Which statement best explains the likely result for the price level?",
     "The price level stays roughly stable, because the quantity of money grows in line with real output.",
     "When money grows with real output, the money available per unit of output stays about the same.",
     [("The price level rises rapidly, because any growth of the money supply causes inflation.", "Money growth matched to output growth does not raise the price level."),
      ("The price level falls rapidly, because real output is growing.", "A stable money-to-output ratio does not produce a falling price level."),
      ("Real output stops growing, because the central bank limits money growth.", "Money growth matched to output does not stop real growth."),
      ("The interest rate must rise, because the money supply is growing.", "The nominal interest rate does not rise just because money grows with output.")]),
]


def ma_hyperinflation_money_printing(rng):
    return _bank(rng, "ma_hyperinflation_money_printing", "5.3", "1.B", HYPER, "persistent inflation comes from money growth that outpaces real output growth", "fixed vetted scenarios; wrong options credit money growth with raising real output or ignore the ratio to output")


LRVERT = [
    ("A student asks why the long-run Phillips curve is vertical. Which statement is the best explanation?",
     "In the long run, expectations adjust, so unemployment returns to the natural rate at any inflation rate.",
     "Wages and prices adjust to expected inflation, so unemployment does not depend on the inflation rate over time.",
     [("In the long run, inflation is always zero, so every point on the curve has the same inflation.", "The long-run curve can be drawn at any steady inflation rate, not only at zero."),
      ("In the long run, unemployment is always zero, so the curve touches the vertical axis.", "The long-run curve is at the natural rate, which is above zero."),
      ("In the long run, higher inflation always lowers unemployment, so the curve slopes downward.", "The long-run curve has no trade-off because expectations adjust."),
      ("In the long run, the money supply is fixed, so inflation cannot change.", "A fixed money supply is not what makes the long-run curve vertical.")]),
    ("A country's natural rate of unemployment rises because of a lasting change in the structure of its labor market. Which statement correctly describes the long-run Phillips curve?",
     "The long-run Phillips curve shifts right, because it is vertical at the new, higher natural rate.",
     "The long-run curve is drawn at the natural rate, so a higher natural rate moves it to the right.",
     [("The long-run Phillips curve shifts left, because higher unemployment lowers inflation.", "A higher natural rate moves the vertical curve to the right."),
      ("The long-run Phillips curve does not shift, because it depends only on the inflation rate.", "The location of the vertical curve is set by the natural rate of unemployment."),
      ("The long-run Phillips curve becomes downward sloping, because unemployment is higher.", "The long-run curve stays vertical at any natural rate."),
      ("The short-run Phillips curve shifts down, because the labor market is weaker.", "The question asks about the long-run curve, which shifts with the natural rate.")]),
]


def ma_lrpc_vertical_reason(rng):
    return _bank(rng, "ma_lrpc_vertical_reason", "5.2", "1.B", LRVERT, "the long-run Phillips curve is vertical at the natural rate of unemployment, and moves only when the natural rate changes", "fixed vetted scenarios; wrong options give the curve a slope, put it at zero unemployment, or fail to shift it with the natural rate")


DISINF = [
    ("A central bank wants to lower the inflation rate in the short run by reducing aggregate demand. Which statement best describes the cost shown by the short-run Phillips curve?",
     "Unemployment rises above its starting level, because lower inflation requires moving down along the curve.",
     "Along a downward-sloping short-run curve, lower inflation comes with higher unemployment.",
     [("Unemployment falls below its starting level, because lower inflation reduces uncertainty.", "On the short-run curve, lower inflation is associated with higher unemployment."),
      ("Unemployment is unchanged, because the short-run curve is vertical.", "The vertical curve is the long-run curve, not the short-run curve."),
      ("The short-run Phillips curve shifts up, because lower demand raises costs.", "The policy moves the economy along the curve, not up with a shift."),
      ("Inflation rises, because lower demand raises expectations of inflation.", "Lower demand lowers inflation along the short-run curve.")]),
    ("A temporary rise in oil prices raises firms' costs, shifting the short-run Phillips curve up. Which statement best describes the effect on the trade-off facing policymakers?",
     "Every unemployment rate now comes with higher inflation, so reducing inflation costs more unemployment.",
     "An upward-shifted short-run curve puts higher inflation at each unemployment rate, so the trade-off worsens.",
     [("Every unemployment rate now comes with lower inflation, so the trade-off improves.", "An upward shift raises, not lowers, inflation at each unemployment rate."),
      ("Unemployment falls at every inflation rate, because costs are higher.", "A rise in costs does not lower unemployment at each inflation rate."),
      ("The trade-off disappears, because oil prices are outside policymakers' control.", "The short-run trade-off still exists on the new, higher curve."),
      ("The long-run Phillips curve shifts right, because oil prices change the natural rate.", "A temporary supply shock moves the short-run curve, not the long-run curve.")]),
]


def ma_disinflation_cost(rng):
    return _bank(rng, "ma_disinflation_cost", "5.2", "1.D", DISINF, "the short-run Phillips curve shows that lowering inflation raises unemployment, and a supply shock worsens the trade-off", "fixed vetted scenarios; wrong options reverse the direction of the trade-off or confuse the short-run and long-run curves")
