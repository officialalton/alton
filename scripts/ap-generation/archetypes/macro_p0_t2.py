"""AP Macroeconomics 5세트 채우기(MA5, 2026-10-21) — 신규 원형 T2(단원 3·4·5·6 부족 칸 보충: 정의 식별·비교·설명). 고정 문장 은행형, 원형마다 시나리오 2개. 정답 문장이 오답보다 지나치게 길지 않게 쓴다."""
from macro_common import *  # noqa: F401,F403
from macro_p0_x1 import _bank

FIN_CMP = [
    ("Which statement correctly compares money with a bond as a financial asset?",
     "Money is more liquid than a bond, while a bond usually pays interest and money pays little or none.", "Money can be spent immediately at full value; a bond must be sold first but pays interest.",
     [("Money is less liquid than a bond, because a bond can be spent directly in stores.", "Bonds cannot be spent directly; money is the most liquid asset."), ("Money pays a higher interest rate than a bond, because money is riskier to hold.", "Bonds pay interest; ordinary money pays little or none."),
      ("Money and bonds are equally liquid, because both can be exchanged for goods at any time.", "A bond must be sold or redeemed before it can be used to buy goods."), ("A bond is money, because it can be used to settle a debt in the same way as currency.", "A bond is a financial asset that is not itself money.")]),
    ("Which statement correctly compares a checking account balance with a certificate of deposit that charges a penalty for early withdrawal?",
     "The checking balance is more liquid, because the funds can be spent immediately without losing value.", "A penalty makes the certificate costly to convert to spendable money, so it is less liquid.",
     [("The certificate of deposit is more liquid, because it pays a higher interest rate.", "Interest does not make an asset more liquid; ease of conversion does."), ("The two are equally liquid, because both are held at a bank.", "Where an asset is held does not determine how easily it becomes spendable money."),
      ("The checking balance is less liquid, because it can be withdrawn at any time.", "Withdrawing at any time makes the balance more liquid, not less."), ("The certificate is more liquid, because the bank guarantees the funds.", "A guarantee affects risk, not how quickly funds can be spent.")]),
]


def ma_t_financial_asset_compare(rng):
    return _bank(rng, "ma_t_financial_asset_compare", "4.1", "1.D", FIN_CMP, "liquidity and interest differ across financial assets", "fixed vetted statements; wrong options reverse liquidity or return", judgment="compare financial assets by liquidity and return")


TOOLS_CMP = [
    ("Which statement correctly compares a rise in the reserve requirement with a cut in the discount rate?",
     "The reserve requirement increase reduces the money supply, while the discount rate cut tends to increase it.", "A higher requirement leaves banks fewer reserves to lend; a lower discount rate makes borrowing reserves cheaper.",
     [("Both actions increase the money supply, because both give banks more flexibility.", "A higher reserve requirement reduces lendable reserves and the money supply."), ("The reserve requirement increase raises the money supply, while the discount rate cut lowers it.", "The two effects are reversed."),
      ("Both actions reduce the money supply, because both make borrowing from the central bank harder.", "A lower discount rate makes borrowing from the central bank easier."), ("Neither action affects the money supply, because banks ignore central bank policies.", "Both are monetary policy tools that change banks' reserves or costs.")]),
    ("Which statement correctly compares an open market purchase of bonds with an open market sale of bonds by the central bank?",
     "A purchase adds reserves and tends to lower the interest rate, while a sale removes reserves and tends to raise it.", "Buying bonds pays banks with new reserves; selling bonds takes reserves out of the banking system.",
     [("A purchase removes reserves and raises the interest rate, while a sale adds reserves and lowers it.", "The effects of buying and selling are reversed."), ("Both a purchase and a sale add reserves, because both involve the central bank paying banks.", "A sale removes reserves because banks pay the central bank."),
      ("Both a purchase and a sale raise the interest rate, because both increase bond trading.", "A purchase lowers the interest rate by adding reserves."), ("Neither changes reserves, because bonds are not part of the money supply.", "Bond transactions with banks change reserves directly.")]),
]


def ma_t_fed_tools_compare(rng):
    return _bank(rng, "ma_t_fed_tools_compare", "4.6", "1.D", TOOLS_CMP, "compare the effects of different monetary policy tools on reserves and the money supply", "fixed vetted statements; wrong options reverse a direction or merge the tools", judgment="compare two tools by their effect on reserves")


RATE_CMP = [
    ("Which statement correctly compares the nominal interest rate with the real interest rate?",
     "The real rate equals the nominal rate minus expected inflation, so it measures the gain in purchasing power.", "Adjusting the nominal rate for expected inflation shows the true return to lenders.",
     [("The real rate equals the nominal rate plus expected inflation, so it is always higher.", "Real equals nominal minus expected inflation, not plus."), ("The nominal rate measures the gain in purchasing power, while the real rate is the stated rate.", "The real rate, not the nominal rate, measures purchasing power."),
      ("The two rates are always equal, because inflation does not change what a lender earns.", "Inflation lowers the real return when it is not offset by a higher nominal rate."), ("The real rate is set by the central bank, while the nominal rate is set by inflation.", "Neither rate is defined that way.")]),
    ("A lender charges a 6 percent nominal interest rate while expected inflation is 2 percent. Which statement correctly compares the nominal and real interest rates?",
     "The real interest rate is 4 percent, because the nominal rate is reduced by expected inflation.", "Real rate = nominal rate minus expected inflation = 6% - 2% = 4%.",
     [("The real interest rate is 8 percent, because expected inflation is added to the nominal rate.", "Inflation is subtracted, not added."), ("The real interest rate is 6 percent, because the nominal rate already reflects all costs.", "The nominal rate must be adjusted for expected inflation."),
      ("The real interest rate is 2 percent, because it equals expected inflation.", "The real rate is the nominal rate less expected inflation, not inflation alone."), ("The real interest rate is 3 percent, because the nominal rate is divided by expected inflation.", "The rates are subtracted, not divided.")]),
]


def ma_t_interest_rate_compare(rng):
    return _bank(rng, "ma_t_interest_rate_compare", "4.2", "1.D", RATE_CMP, "real rate is the nominal rate minus expected inflation", "fixed vetted statements; wrong options add inflation or swap the definitions", judgment="compare nominal and real rates")


MONEY_FUNC = [
    ("A household keeps part of this month's paycheck in a checking account so it can pay next month's rent. Which function of money does this best illustrate?",
     "Store of value, because the money keeps its purchasing power until it is spent later.", "Holding money for later spending is the store-of-value function.",
     [("Medium of exchange, because the household pays for goods with it right now.", "The household is holding the money, not exchanging it today."), ("Unit of account, because prices are quoted in dollars.", "Quoting prices is a different function from holding money."),
      ("Barter, because the household trades its work for a good directly.", "Barter does not use money at all."), ("Standard of deferred payment, because a lender will repay a loan.", "No loan is being repaid in the example.")]),
    ("A store posts every price in dollars so that shoppers can compare the cost of a jacket and a pair of shoes. Which function of money does this best illustrate?",
     "Unit of account, because dollars give a common measure for comparing the value of different goods.", "A common unit for stating and comparing prices is the unit-of-account function.",
     [("Store of value, because shoppers save the dollars for later.", "Saving for later is a different function."), ("Medium of exchange, because shoppers hand over dollars at the register.", "The example is about quoting and comparing prices, not the act of paying."),
      ("Barter, because shoppers compare the jacket with the shoes directly.", "Money quotes both prices, so this is not barter."), ("Fiat money, because dollars are not backed by gold.", "That describes the type of money, not a function.")]),
]


def ma_t_money_function_identify(rng):
    return _bank(rng, "ma_t_money_function_identify", "4.3", "1.B", MONEY_FUNC, "match each example to a function of money", "fixed vetted scenarios; wrong options name another function", judgment="identify the function of money in the example")


BANK_ID = [
    ("On a commercial bank's balance sheet, which of the following is a liability?",
     "Checking account deposits held by customers, because the bank owes this money to the depositors.", "Deposits are claims customers hold against the bank.",
     [("Loans the bank has made to customers, because the bank is owed repayment.", "Loans are assets because borrowers owe the bank."), ("Required reserves held at the central bank, because the bank can withdraw them.", "Reserves are assets the bank holds."),
      ("Government bonds the bank holds, because they pay interest.", "Bonds the bank owns are assets."), ("Cash in the bank's vault, because it is stored on the premises.", "Vault cash is an asset of the bank.")]),
    ("A bank has $20,000 in checking deposits and must hold 10 percent of deposits as reserves. It holds $5,000 in reserves. Which of the following correctly identifies the bank's excess reserves?",
     "$3,000, because the bank holds $5,000 in reserves and must hold only $2,000.", "Required reserves = 10% x $20,000 = $2,000, so excess = $5,000 - $2,000 = $3,000.",
     [("$5,000, because all of the reserves held are excess.", "Required reserves must be subtracted first."), ("$2,000, because this is the amount the bank must hold.", "That is the required reserves, not the excess."),
      ("$18,000, because the bank may lend the remaining deposits.", "Excess reserves are reserves held above the requirement."), ("$0, because the bank is exactly at the requirement.", "The bank holds more than it is required to hold.")]),
]


def ma_t_bank_balance_identify(rng):
    return _bank(rng, "ma_t_bank_balance_identify", "4.4", "1.B", BANK_ID, "deposits are bank liabilities and reserves above the requirement are excess", "fixed vetted scenarios; wrong options label an asset as a liability or misuse required reserves", judgment="identify liabilities and excess reserves from the balance sheet")


PHIL_ID = [
    ("Which of the following correctly describes the long-run Phillips curve?",
     "A vertical line at the natural rate of unemployment, showing no long-run trade-off between inflation and unemployment.", "In the long run unemployment returns to its natural rate whatever the inflation rate.",
     [("A downward-sloping line, showing a permanent trade-off between inflation and unemployment.", "That describes the short-run curve."), ("A horizontal line at the natural rate of inflation, showing unemployment is fixed.", "The long-run curve is vertical, not horizontal."),
      ("An upward-sloping line, showing that higher inflation raises unemployment permanently.", "The long-run curve does not slope upward."), ("A vertical line at zero inflation, showing the economy never leaves full employment.", "The line sits at the natural rate of unemployment, not at zero inflation.")]),
    ("Which of the following would shift the short-run Phillips curve upward?",
     "An increase in expected inflation, because workers and firms build higher inflation into wages and prices.", "Higher expected inflation raises the inflation rate at every unemployment rate.",
     [("A decrease in expected inflation, because wages grow more slowly.", "Lower expected inflation shifts the curve downward."), ("A fall in the unemployment rate, because the labor market is tighter.", "That is a movement along the curve, not a shift."),
      ("A decrease in the price of imported oil, because production costs fall.", "Lower costs shift the short-run curve downward."), ("A decrease in aggregate demand, because spending falls.", "A fall in demand moves the economy along the curve.")]),
]


def ma_t_phillips_long_identify(rng):
    return _bank(rng, "ma_t_phillips_long_identify", "5.2", "1.B", PHIL_ID, "the long-run Phillips curve is vertical and expected inflation shifts the short-run curve", "fixed vetted statements; wrong options confuse movements with shifts or the two curves", judgment="identify the Phillips curve shape and what shifts it")


DEBT_ID = [
    ("Which of the following correctly identifies the national debt?",
     "The total amount the government owes from past deficits that surpluses have not offset.", "The debt is the accumulated stock of borrowing.",
     [("The amount by which government spending exceeds tax revenue in a single year.", "That is the annual budget deficit."), ("The value of all goods and services produced in a year.", "That is GDP."),
      ("The amount the government plans to collect in taxes next year.", "That is projected tax revenue."), ("The amount of money the central bank has created.", "That is related to the money supply, not the debt.")]),
    ("A government spends $900 billion and collects $800 billion in taxes in one year. Which of the following correctly identifies the $100 billion?",
     "The budget deficit for the year, which adds $100 billion to the national debt.", "Spending above revenue in one year is the deficit and it adds to the debt.",
     [("The national debt, because it is the amount the government owes.", "The debt is the total accumulated, not one year's gap."), ("The budget surplus, because tax revenue is a positive amount.", "A surplus occurs when revenue exceeds spending."),
      ("The trade deficit, because the government buys goods from abroad.", "A trade deficit compares imports and exports."), ("The GDP gap, because spending exceeds output.", "The GDP gap compares output with potential output.")]),
]


def ma_t_national_debt_identify(rng):
    return _bank(rng, "ma_t_national_debt_identify", "5.4", "1.B", DEBT_ID, "the deficit is a yearly flow and the debt is the accumulated stock", "fixed vetted statements; wrong options swap deficit and debt or name another measure", judgment="identify deficit and debt")


PRODUCTIVITY = [
    ("Which of the following best defines labor productivity?",
     "The amount of real output produced per hour of labor.", "Productivity is output per unit of input, here per worker hour.",
     [("The total number of hours that workers are willing to supply.", "That is labor supply."), ("The share of the labor force that has a job.", "That is the employment rate."),
      ("The wage paid for each hour of work.", "That is the wage rate."), ("The number of workers in the economy.", "That is the size of the labor force.")]),
    ("Which of the following is an example of an increase in human capital?",
     "Workers complete job training that raises the skills they bring to production.", "Education and training raise the quality of labor.",
     [("A firm buys new machinery for its factory.", "Machinery is physical capital."), ("The population grows because more people are born.", "That raises the quantity of labor, not its quality."),
      ("A discovery of new oil reserves in the country.", "Natural resources are a different factor of production."), ("The government lowers the minimum wage.", "A wage change does not by itself raise skills.")]),
]


def ma_t_productivity_identify(rng):
    return _bank(rng, "ma_t_productivity_identify", "5.6", "1.B", PRODUCTIVITY, "productivity is output per unit of input and human capital is the skill of labor", "fixed vetted statements; wrong options name another labor or capital measure", judgment="identify productivity and human capital")


PHIL_CMP = [
    ("Which statement correctly compares the short-run and long-run Phillips curves?",
     "The short-run curve slopes downward and shows a trade-off, while the long-run curve is vertical at the natural rate of unemployment.", "Unemployment can fall below the natural rate only temporarily, so the long-run curve has no trade-off.",
     [("Both curves slope downward, because inflation and unemployment always move in opposite directions.", "The long-run curve is vertical."), ("The short-run curve is vertical, while the long-run curve slopes downward.", "The two shapes are reversed."),
      ("Both curves are vertical, because unemployment never changes.", "The short-run curve slopes downward."), ("The long-run curve shows a larger trade-off, because people adjust more slowly over time.", "People adjust over time, which removes the trade-off.")]),
    ("Which statement correctly compares the effects of expected inflation and unexpected inflation on unemployment?",
     "Unexpected inflation can lower unemployment temporarily, while expected inflation is built into wages and does not.", "Workers are fooled only by unexpected inflation; expected inflation is already in wage contracts.",
     [("Expected inflation lowers unemployment, while unexpected inflation has no effect.", "The effects are reversed."), ("Both lower unemployment permanently, because higher prices raise production.", "Neither lowers unemployment permanently."),
      ("Neither affects unemployment, because wages always equal prices.", "Unexpected inflation can temporarily reduce unemployment."), ("Unexpected inflation raises unemployment, while expected inflation lowers it.", "Unexpected inflation tends to reduce unemployment in the short run.")]),
]


def ma_t_phillips_compare2(rng):
    return _bank(rng, "ma_t_phillips_compare2", "5.2", "1.D", PHIL_CMP, "short-run trade-off versus long-run vertical Phillips curve and expected versus unexpected inflation", "fixed vetted statements; wrong options reverse the shapes or the effects", judgment="compare the short-run and long-run Phillips relationships")


SELF_CORR = [
    ("An economy is in a recessionary gap and the government takes no action. Which statement best explains how the economy can return to full employment on its own?",
     "High unemployment pushes wages and input prices down, which shifts short-run aggregate supply to the right until output returns to potential.", "Lower input costs raise short-run aggregate supply, moving the economy back toward long-run equilibrium.",
     [("Falling prices raise aggregate demand permanently, which shifts the long-run aggregate supply curve to the right.", "Long-run aggregate supply does not shift because of price changes."), ("The central bank automatically raises the money supply, which shifts aggregate demand to the right.", "The scenario has no policy action; the adjustment comes from wages and input prices."),
      ("The economy cannot return to full employment without government spending, because wages are fixed.", "Flexible wages and input prices allow self-correction over time."), ("Firms cut output further, which shifts short-run aggregate supply to the left.", "Lower costs shift supply right, not left.")]),
    ("An economy is in an inflationary gap and the government takes no action. Which statement best explains how the economy can return to potential output on its own?",
     "Tight labor markets push wages and input prices up, which shifts short-run aggregate supply to the left until output returns to potential.", "Higher input costs reduce short-run aggregate supply, moving the economy back toward long-run equilibrium.",
     [("Rising prices lower aggregate demand permanently, which shifts the long-run aggregate supply curve to the left.", "Long-run aggregate supply does not shift because of price changes."), ("Unemployment rises, which shifts short-run aggregate supply to the right.", "Unemployment is below the natural rate in an inflationary gap."),
      ("Workers accept lower wages, which lowers the price level.", "In an inflationary gap wages tend to rise."), ("The economy stays at the higher output level, because potential output rises.", "Potential output does not rise on its own in this situation.")]),
]


def ma_t_self_correct_explain(rng):
    return _bank(rng, "ma_t_self_correct_explain", "3.7", "2.A", SELF_CORR, "wage and input price changes shift short-run aggregate supply and self-correct a gap", "fixed vetted scenarios; wrong options shift the wrong curve or deny self-correction", judgment="explain how supply shifts close a gap")


XR_NX = [
    ("The dollar appreciates against other currencies. Which statement best explains the effect on net exports of the United States?",
     "Exports fall and imports rise, because goods made in the United States cost more abroad and imports cost less at home.", "A stronger dollar raises the foreign price of domestic goods and lowers the dollar price of imports.",
     [("Exports rise and net exports rise, because goods made in the United States become cheaper for foreign buyers.", "An appreciation makes domestic goods more expensive abroad."), ("Imports fall and net exports rise, because foreign goods become more expensive for domestic buyers.", "An appreciation makes imports cheaper."),
      ("Net exports do not change, because exchange rates affect only financial flows and not the prices of traded goods.", "Prices of traded goods change with the exchange rate."), ("Exports rise because the dollar is worth more, so more foreign buyers want to buy goods made at home.", "A higher-valued dollar makes exports harder to sell.")]),
    ("The dollar depreciates against other currencies. Which statement best explains the effect on net exports of the United States?",
     "Exports rise and imports fall, because goods made in the United States cost less abroad and imports cost more at home.", "A weaker dollar lowers the foreign price of domestic goods and raises the dollar price of imports.",
     [("Exports fall and net exports fall, because goods made in the United States become more expensive for foreign buyers.", "A depreciation makes domestic goods cheaper abroad."), ("Imports rise and net exports fall, because foreign goods become cheaper for domestic buyers.", "A depreciation makes imports more expensive."),
      ("Net exports do not change, because trade depends only on incomes and not on the prices of traded goods.", "Relative prices expressed in a common currency affect trade."), ("Exports fall because the dollar is worth less, so fewer foreign buyers want to buy goods made at home.", "A lower-valued dollar makes exports easier to sell.")]),
]


def ma_t_xrate_nx_explain(rng):
    return _bank(rng, "ma_t_xrate_nx_explain", "6.5", "2.B", XR_NX, "appreciation lowers and depreciation raises net exports through relative prices", "fixed vetted scenarios; wrong options reverse the price effects", judgment="trace the exchange rate through prices to net exports")


STAGE_T3_A = ["ma_t_financial_asset_compare", "ma_t_fed_tools_compare", "ma_t_interest_rate_compare", "ma_t_money_function_identify", "ma_t_bank_balance_identify", "ma_t_phillips_long_identify",
              "ma_t_national_debt_identify", "ma_t_productivity_identify", "ma_t_phillips_compare2", "ma_t_self_correct_explain", "ma_t_xrate_nx_explain"]
