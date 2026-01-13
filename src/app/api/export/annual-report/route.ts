import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();

    // Define date range for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    // Get all transactions for the user within the year
    const transactions = await prisma.transaction.findMany({
      where: {
        claimedById: session.id,
        date: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get all transactions before this year for cost basis calculations
    const priorTransactions = await prisma.transaction.findMany({
      where: {
        claimedById: session.id,
        date: { lt: yearStart },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate holdings before the year started (for beginning balance)
    const beginningHoldings = calculateHoldings(priorTransactions);

    // Calculate holdings at end of year
    const allTransactions = [...priorTransactions, ...transactions];
    const endingHoldings = calculateHoldings(allTransactions);

    // Get stock prices
    const allSymbols = [...new Set([
      ...Array.from(beginningHoldings.keys()),
      ...Array.from(endingHoldings.keys()),
    ])];

    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: allSymbols } },
    });
    const priceMap = new Map(stockCache.map((s) => [s.symbol, s]));

    // Calculate year statistics
    const yearStats = calculateYearStats(transactions, beginningHoldings, priceMap);

    // Calculate realized gains for the year
    const realizedGains = calculateRealizedGains([...priorTransactions, ...transactions], transactions);

    // Calculate dividend income
    const dividendIncome = transactions
      .filter((tx) => tx.type === 'DIVIDEND')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Calculate ending portfolio value
    let endingPortfolioValue = 0;
    const holdingsSummary: Array<{
      symbol: string;
      name: string;
      shares: number;
      currentPrice: number;
      currentValue: number;
      costBasis: number;
      gain: number;
      gainPercent: number;
    }> = [];

    for (const [symbol, holding] of endingHoldings) {
      const stock = priceMap.get(symbol);
      const currentPrice = stock?.currentPrice || holding.costBasis / holding.quantity;
      const currentValue = holding.quantity * currentPrice;
      endingPortfolioValue += currentValue;

      holdingsSummary.push({
        symbol,
        name: stock?.name || symbol,
        shares: holding.quantity,
        currentPrice,
        currentValue,
        costBasis: holding.costBasis,
        gain: currentValue - holding.costBasis,
        gainPercent: holding.costBasis > 0 ? ((currentValue - holding.costBasis) / holding.costBasis) * 100 : 0,
      });
    }

    holdingsSummary.sort((a, b) => b.currentValue - a.currentValue);

    // Get AI summary if available
    let aiSummary = null;
    if (anthropic) {
      aiSummary = await generateAISummary({
        year,
        totalValue: endingPortfolioValue,
        totalCostBasis: yearStats.totalCostBasis,
        realizedGains: realizedGains.totalGain,
        unrealizedGains: endingPortfolioValue - yearStats.totalCostBasis,
        dividendIncome,
        transactionCount: transactions.length,
        buyTransactions: yearStats.buyCount,
        sellTransactions: yearStats.sellCount,
        topHoldings: holdingsSummary.slice(0, 5),
        topGainers: [...holdingsSummary].sort((a, b) => b.gainPercent - a.gainPercent).slice(0, 3),
        topLosers: [...holdingsSummary].sort((a, b) => a.gainPercent - b.gainPercent).slice(0, 3),
      });
    }

    // Generate HTML report
    const html = generateReportHtml({
      year,
      userName: session.name || 'Investor',
      endingPortfolioValue,
      yearStats,
      realizedGains,
      dividendIncome,
      holdingsSummary,
      aiSummary,
      transactions,
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="annual-report-${year}.html"`,
      },
    });
  } catch (error) {
    console.error('[Annual Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate annual report' },
      { status: 500 }
    );
  }
}

interface Holding {
  quantity: number;
  costBasis: number;
  lots: Array<{ quantity: number; price: number; date: Date }>;
}

function calculateHoldings(transactions: Array<{
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  amount: number;
  date: Date;
}>) {
  const holdings = new Map<string, Holding>();

  for (const tx of transactions) {
    const existing = holdings.get(tx.symbol) || { quantity: 0, costBasis: 0, lots: [] };

    if (tx.type === 'BUY') {
      existing.quantity += tx.quantity;
      existing.costBasis += tx.amount;
      existing.lots.push({ quantity: tx.quantity, price: tx.price, date: tx.date });
    } else if (tx.type === 'SELL') {
      if (existing.quantity > 0) {
        const sellRatio = Math.min(tx.quantity / existing.quantity, 1);
        existing.quantity -= tx.quantity;
        existing.costBasis -= existing.costBasis * sellRatio;

        // Remove from lots (FIFO)
        let remainingToSell = tx.quantity;
        while (remainingToSell > 0 && existing.lots.length > 0) {
          const lot = existing.lots[0];
          if (lot.quantity <= remainingToSell) {
            remainingToSell -= lot.quantity;
            existing.lots.shift();
          } else {
            lot.quantity -= remainingToSell;
            remainingToSell = 0;
          }
        }
      }
    }

    if (existing.quantity > 0.0001) {
      holdings.set(tx.symbol, existing);
    } else {
      holdings.delete(tx.symbol);
    }
  }

  return holdings;
}

function calculateYearStats(
  transactions: Array<{
    type: string;
    amount: number;
    quantity: number;
  }>,
  beginningHoldings: Map<string, Holding>,
  priceMap: Map<string, { currentPrice: number | null }>
) {
  let totalBought = 0;
  let totalSold = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      totalBought += tx.amount;
      buyCount++;
    } else if (tx.type === 'SELL') {
      totalSold += tx.amount;
      sellCount++;
    }
  }

  // Calculate beginning value
  let beginningValue = 0;
  let totalCostBasis = 0;
  for (const [symbol, holding] of beginningHoldings) {
    const stock = priceMap.get(symbol);
    const price = stock?.currentPrice || holding.costBasis / holding.quantity;
    beginningValue += holding.quantity * price;
    totalCostBasis += holding.costBasis;
  }

  return {
    totalBought,
    totalSold,
    buyCount,
    sellCount,
    beginningValue,
    totalCostBasis,
  };
}

function calculateRealizedGains(
  allTransactions: Array<{
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    date: Date;
  }>,
  yearTransactions: Array<{
    id: string;
    symbol: string;
    type: string;
    quantity: number;
    price: number;
    date: Date;
  }>
) {
  const lots = new Map<string, Array<{ quantity: number; price: number }>>();
  const yearSellIds = new Set(
    yearTransactions.filter((tx) => tx.type === 'SELL').map((tx) => tx.id)
  );

  let totalGain = 0;
  let totalProceeds = 0;
  let totalCostBasis = 0;
  const gains: Array<{
    symbol: string;
    date: string;
    quantity: number;
    proceeds: number;
    costBasis: number;
    gain: number;
  }> = [];

  for (const tx of allTransactions) {
    if (tx.type === 'BUY') {
      const symbolLots = lots.get(tx.symbol) || [];
      symbolLots.push({ quantity: tx.quantity, price: tx.price });
      lots.set(tx.symbol, symbolLots);
    } else if (tx.type === 'SELL') {
      const symbolLots = lots.get(tx.symbol) || [];
      let remainingToSell = tx.quantity;
      let costBasis = 0;

      while (remainingToSell > 0 && symbolLots.length > 0) {
        const lot = symbolLots[0];
        const sellFromLot = Math.min(remainingToSell, lot.quantity);

        costBasis += sellFromLot * lot.price;
        lot.quantity -= sellFromLot;
        remainingToSell -= sellFromLot;

        if (lot.quantity <= 0.0001) {
          symbolLots.shift();
        }
      }

      const proceeds = tx.quantity * tx.price;
      const gain = proceeds - costBasis;

      // Only count if this sale happened in the target year
      if (yearSellIds.has((tx as { id?: string }).id || '')) {
        totalGain += gain;
        totalProceeds += proceeds;
        totalCostBasis += costBasis;
        gains.push({
          symbol: tx.symbol,
          date: tx.date.toISOString().split('T')[0],
          quantity: tx.quantity,
          proceeds,
          costBasis,
          gain,
        });
      }

      lots.set(tx.symbol, symbolLots);
    }
  }

  return { totalGain, totalProceeds, totalCostBasis, gains };
}

async function generateAISummary(data: {
  year: number;
  totalValue: number;
  totalCostBasis: number;
  realizedGains: number;
  unrealizedGains: number;
  dividendIncome: number;
  transactionCount: number;
  buyTransactions: number;
  sellTransactions: number;
  topHoldings: Array<{ symbol: string; name: string; currentValue: number; gainPercent: number }>;
  topGainers: Array<{ symbol: string; gainPercent: number }>;
  topLosers: Array<{ symbol: string; gainPercent: number }>;
}) {
  if (!anthropic) return null;

  const prompt = `You are a financial advisor providing a year-end portfolio summary for ${data.year}. Write a professional but friendly summary (3-4 paragraphs) based on this data:

Portfolio Value: $${data.totalValue.toFixed(2)}
Total Cost Basis: $${data.totalCostBasis.toFixed(2)}
Unrealized Gains: $${data.unrealizedGains.toFixed(2)} (${data.totalCostBasis > 0 ? ((data.unrealizedGains / data.totalCostBasis) * 100).toFixed(1) : 0}%)
Realized Gains: $${data.realizedGains.toFixed(2)}
Dividend Income: $${data.dividendIncome.toFixed(2)}

Activity: ${data.transactionCount} transactions (${data.buyTransactions} buys, ${data.sellTransactions} sells)

Top Holdings: ${data.topHoldings.map((h) => `${h.symbol} ($${h.currentValue.toFixed(0)}, ${h.gainPercent >= 0 ? '+' : ''}${h.gainPercent.toFixed(1)}%)`).join(', ')}
Top Gainers: ${data.topGainers.map((h) => `${h.symbol} (${h.gainPercent >= 0 ? '+' : ''}${h.gainPercent.toFixed(1)}%)`).join(', ')}
Top Losers: ${data.topLosers.map((h) => `${h.symbol} (${h.gainPercent >= 0 ? '+' : ''}${h.gainPercent.toFixed(1)}%)`).join(', ')}

Include:
1. A brief performance overview
2. Key highlights (best performers, dividend income)
3. Areas of concern or attention
4. A forward-looking note

Keep it concise and actionable. Do not use emojis. Use plain HTML paragraph tags.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : null;
  } catch (error) {
    console.error('AI summary error:', error);
    return null;
  }
}

function generateReportHtml(data: {
  year: number;
  userName: string;
  endingPortfolioValue: number;
  yearStats: {
    totalBought: number;
    totalSold: number;
    buyCount: number;
    sellCount: number;
    totalCostBasis: number;
  };
  realizedGains: { totalGain: number; gains: Array<{ symbol: string; date: string; quantity: number; proceeds: number; costBasis: number; gain: number }> };
  dividendIncome: number;
  holdingsSummary: Array<{ symbol: string; name: string; shares: number; currentPrice: number; currentValue: number; costBasis: number; gain: number; gainPercent: number }>;
  aiSummary: string | null;
  transactions: Array<{ date: Date; type: string; symbol: string; quantity: number; price: number; amount: number }>;
}) {
  const unrealizedGain = data.endingPortfolioValue - data.yearStats.totalCostBasis;
  const unrealizedPercent = data.yearStats.totalCostBasis > 0
    ? (unrealizedGain / data.yearStats.totalCostBasis) * 100
    : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Annual Portfolio Report - ${data.year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    .header h1 { font-size: 28px; color: #0f172a; margin-bottom: 8px; }
    .header .subtitle { color: #64748b; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
    .summary-card .value { font-size: 24px; font-weight: 600; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; color: #0f172a; }
    .ai-summary { background: linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%); border-left: 4px solid #7c3aed; }
    .ai-summary p { margin-bottom: 12px; }
    .ai-summary p:last-child { margin-bottom: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 500; }
    td { font-size: 14px; }
    .text-right { text-align: right; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-buy { background: #fee2e2; color: #dc2626; }
    .badge-sell { background: #dcfce7; color: #16a34a; }
    .badge-dividend { background: #dbeafe; color: #2563eb; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; }
    @media print {
      body { background: white; padding: 20px; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Annual Portfolio Report</h1>
      <p class="subtitle">${data.year} Year-End Summary for ${data.userName}</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Portfolio Value</div>
        <div class="value">$${data.endingPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="label">Unrealized Gain/Loss</div>
        <div class="value ${unrealizedGain >= 0 ? 'positive' : 'negative'}">
          ${unrealizedGain >= 0 ? '+' : ''}$${unrealizedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span style="font-size: 14px; opacity: 0.8;">(${unrealizedPercent.toFixed(1)}%)</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="label">Realized Gains (${data.year})</div>
        <div class="value ${data.realizedGains.totalGain >= 0 ? 'positive' : 'negative'}">
          ${data.realizedGains.totalGain >= 0 ? '+' : ''}$${data.realizedGains.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div class="summary-card">
        <div class="label">Dividend Income</div>
        <div class="value positive">$${data.dividendIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>

    ${data.aiSummary ? `
    <div class="section ai-summary">
      <h2>AI Portfolio Analysis</h2>
      ${data.aiSummary}
    </div>
    ` : ''}

    <div class="section">
      <h2>Current Holdings</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th class="text-right">Shares</th>
            <th class="text-right">Price</th>
            <th class="text-right">Value</th>
            <th class="text-right">Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          ${data.holdingsSummary.map((h) => `
          <tr>
            <td><strong>${h.symbol}</strong></td>
            <td>${h.name}</td>
            <td class="text-right">${h.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="text-right">$${h.currentPrice.toFixed(2)}</td>
            <td class="text-right">$${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right ${h.gain >= 0 ? 'positive' : 'negative'}">
              ${h.gain >= 0 ? '+' : ''}$${h.gain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              (${h.gainPercent >= 0 ? '+' : ''}${h.gainPercent.toFixed(1)}%)
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${data.realizedGains.gains.length > 0 ? `
    <div class="section">
      <h2>Realized Gains/Losses (${data.year})</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Symbol</th>
            <th class="text-right">Shares Sold</th>
            <th class="text-right">Proceeds</th>
            <th class="text-right">Cost Basis</th>
            <th class="text-right">Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          ${data.realizedGains.gains.map((g) => `
          <tr>
            <td>${g.date}</td>
            <td><strong>${g.symbol}</strong></td>
            <td class="text-right">${g.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="text-right">$${g.proceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right">$${g.costBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right ${g.gain >= 0 ? 'positive' : 'negative'}">
              ${g.gain >= 0 ? '+' : ''}$${g.gain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="section">
      <h2>Transaction Activity (${data.year})</h2>
      <p style="margin-bottom: 16px; color: #64748b;">
        ${data.yearStats.buyCount + data.yearStats.sellCount} transactions:
        ${data.yearStats.buyCount} buys ($${data.yearStats.totalBought.toLocaleString(undefined, { minimumFractionDigits: 2 })}),
        ${data.yearStats.sellCount} sells ($${data.yearStats.totalSold.toLocaleString(undefined, { minimumFractionDigits: 2 })})
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Symbol</th>
            <th class="text-right">Quantity</th>
            <th class="text-right">Price</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.transactions.slice(0, 50).map((tx) => `
          <tr>
            <td>${tx.date.toISOString().split('T')[0]}</td>
            <td><span class="badge badge-${tx.type.toLowerCase()}">${tx.type}</span></td>
            <td><strong>${tx.symbol}</strong></td>
            <td class="text-right">${tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
            <td class="text-right">$${tx.price.toFixed(2)}</td>
            <td class="text-right">$${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          `).join('')}
          ${data.transactions.length > 50 ? `
          <tr><td colspan="6" style="text-align: center; color: #64748b;">... and ${data.transactions.length - 50} more transactions</td></tr>
          ` : ''}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated by FamilyFolio on ${new Date().toLocaleDateString()}</p>
      <p>This report is for informational purposes only. Consult a tax professional for tax advice.</p>
    </div>
  </div>
</body>
</html>`;
}
