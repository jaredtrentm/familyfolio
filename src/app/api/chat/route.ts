import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import {
  calculatePortfolioFromTransactions,
  formatClosedPositionsForAI,
  type Transaction as PortfolioTransaction,
} from '@/lib/portfolio-utils';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Function to refresh stock prices for a user
async function refreshStockPrices(userId: string): Promise<{ updated: number; prices: Record<string, number> }> {
  try {
    // Get user's symbols
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: userId },
      select: { symbol: true },
      distinct: ['symbol'],
    });

    const symbols = transactions.map(tx => tx.symbol.toUpperCase().trim());
    if (symbols.length === 0) {
      return { updated: 0, prices: {} };
    }

    // Trigger the stocks API to refresh
    // We'll make an internal call to update the cache
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
    });

    const prices: Record<string, number> = {};
    for (const stock of stockCache) {
      if (stock.currentPrice && stock.currentPrice > 0) {
        prices[stock.symbol] = stock.currentPrice;
      }
    }

    return { updated: Object.keys(prices).length, prices };
  } catch (error) {
    console.error('[Chat API] Failed to refresh prices:', error);
    return { updated: 0, prices: {} };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user's portfolio data for context
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'desc' },
    });

    // Get watchlist with stock data
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId: session.id },
      orderBy: { addedAt: 'desc' },
    });
    const watchlistSymbols = watchlistItems.map(w => w.symbol);
    const watchlistStockData = watchlistSymbols.length > 0
      ? await prisma.stockCache.findMany({
          where: { symbol: { in: watchlistSymbols } },
        })
      : [];
    const watchlistStockMap = new Map(watchlistStockData.map(s => [s.symbol, s]));

    // Get price alerts
    const priceAlerts = await prisma.priceAlert.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
    });

    // Get accounts with cash balances
    const accounts = await prisma.account.findMany({
      where: { userId: session.id },
      orderBy: { name: 'asc' },
    });

    // Get rebalancing targets
    const rebalanceTargets = await prisma.rebalanceTarget.findMany({
      where: { userId: session.id },
    });

    // Get user preferences
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: session.id },
    });

    // Calculate current holdings and closed positions using utility
    const portfolioTx: PortfolioTransaction[] = transactions.map(tx => ({
      id: tx.id,
      symbol: tx.symbol,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
      fees: tx.fees,
      date: tx.date,
    }));

    const portfolioData = calculatePortfolioFromTransactions(portfolioTx);
    const holdings = Array.from(portfolioData.currentHoldings.values());
    const closedPositions = portfolioData.closedPositions;
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);

    // Get stock prices from cache with normalized symbols
    const normalizedSymbols = holdings.map((h) => h.symbol.toUpperCase().trim());
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: normalizedSymbols } },
    });
    const priceMap = new Map(stockCache.map((s) => [s.symbol.toUpperCase().trim(), s]));

    // Build portfolio summary for AI with detailed price info
    let totalCurrentValue = 0;
    const portfolioSummary = holdings.map((h) => {
      const normalizedSymbol = h.symbol.toUpperCase().trim();
      const stock = priceMap.get(normalizedSymbol);
      const avgCost = h.costBasis / h.quantity;
      const hasCurrentPrice = stock?.currentPrice && stock.currentPrice > 0;
      const currentPrice = hasCurrentPrice ? stock.currentPrice! : avgCost;
      const currentValue = h.quantity * currentPrice;
      const gainLoss = currentValue - h.costBasis;
      const gainLossPercent = h.costBasis > 0 ? (gainLoss / h.costBasis) * 100 : 0;
      totalCurrentValue += currentValue;

      const priceSource = hasCurrentPrice ? 'market' : 'estimated (avg cost)';
      const sector = stock?.sector || 'Unknown';

      return `${normalizedSymbol} (${sector}): ${h.quantity.toFixed(4)} shares
  - Avg Cost: $${avgCost.toFixed(2)}, Current Price: $${currentPrice.toFixed(2)} (${priceSource})
  - Value: $${currentValue.toFixed(2)}, Gain/Loss: ${gainLoss >= 0 ? '+' : ''}$${gainLoss.toFixed(2)} (${gainLossPercent >= 0 ? '+' : ''}${gainLossPercent.toFixed(2)}%)`;
    }).join('\n\n');

    const totalGainLoss = totalCurrentValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    // Get recent chat history for context
    const recentMessages = await prisma.chatMessage.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Save user message
    await prisma.chatMessage.create({
      data: {
        userId: session.id,
        role: 'user',
        content: message,
      },
    });

    // Build conversation for Claude
    const conversationHistory = recentMessages
      .reverse()
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // Generate response
    let aiResponse = "I'm sorry, I couldn't process your request. Please try again.";

    if (process.env.ANTHROPIC_API_KEY) {
      const systemPrompt = `You are a helpful AI assistant for a family investment portfolio tracker called FamilyFolio.
You help users understand their investment portfolio, analyze their holdings, and provide guidance.

IMPORTANT: You can only see THIS USER's portfolio data. Each user's data is completely separate.

=== PORTFOLIO SUMMARY ===
${portfolioSummary || 'No holdings yet'}

=== TOTALS ===
- Total Cost Basis: $${totalCostBasis.toFixed(2)}
- Total Current Value: $${totalCurrentValue.toFixed(2)}
- Total Gain/Loss: ${totalGainLoss >= 0 ? '+' : ''}$${totalGainLoss.toFixed(2)} (${totalGainLossPercent >= 0 ? '+' : ''}${totalGainLossPercent.toFixed(2)}%)
- Number of Holdings: ${holdings.length}

=== CLOSED POSITIONS (Fully Sold Holdings) ===
${formatClosedPositionsForAI(closedPositions)}

=== REALIZED GAINS SUMMARY ===
- Total Realized Gain/Loss: ${portfolioData.totalRealizedGain >= 0 ? '+' : ''}$${portfolioData.totalRealizedGain.toFixed(2)}
- Long-term (>1 year): ${portfolioData.totalRealizedGainLongTerm >= 0 ? '+' : ''}$${portfolioData.totalRealizedGainLongTerm.toFixed(2)}
- Short-term (<1 year): ${portfolioData.totalRealizedGainShortTerm >= 0 ? '+' : ''}$${portfolioData.totalRealizedGainShortTerm.toFixed(2)}

=== RECENT TRANSACTIONS (Most Recent 10) ===
${transactions.slice(0, 10).map((tx) => {
  const txDate = tx.date.toISOString().split('T')[0];
  return `${txDate}: ${tx.type} ${tx.quantity.toFixed(4)} ${tx.symbol} @ $${tx.price.toFixed(2)} (Total: $${tx.amount.toFixed(2)})`;
}).join('\n') || 'None'}

=== ALL TRANSACTIONS BY SYMBOL (with dates for gains calculations) ===
${(() => {
  // Group transactions by symbol for easier AI reference
  const bySymbol = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const sym = tx.symbol.toUpperCase().trim();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(tx);
  }

  return Array.from(bySymbol.entries()).map(([symbol, txs]) => {
    const sortedTxs = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const txLines = sortedTxs.map(tx => {
      const txDate = tx.date.toISOString().split('T')[0];
      return `  ${txDate}: ${tx.type} ${tx.quantity.toFixed(4)} @ $${tx.price.toFixed(2)}`;
    }).join('\n');
    return `${symbol}:\n${txLines}`;
  }).join('\n\n');
})() || 'No transactions'}

=== WATCHLIST ===
${watchlistItems.length > 0
  ? watchlistItems.map(item => {
      const stock = watchlistStockMap.get(item.symbol);
      const priceInfo = stock?.currentPrice ? `$${stock.currentPrice.toFixed(2)}` : 'N/A';
      const changeInfo = stock?.dayChangePercent ? `${stock.dayChangePercent >= 0 ? '+' : ''}${stock.dayChangePercent.toFixed(2)}%` : '';
      const peInfo = stock?.peRatio ? `P/E: ${stock.peRatio.toFixed(2)}` : '';
      const targetInfo = stock?.targetPrice ? `Target: $${stock.targetPrice.toFixed(2)}` : '';
      const notes = item.notes ? ` (Notes: ${item.notes})` : '';
      return `${item.symbol}: ${priceInfo} ${changeInfo} | ${peInfo} ${targetInfo}${notes}`;
    }).join('\n')
  : 'No stocks in watchlist'}

=== PRICE ALERTS ===
${priceAlerts.length > 0
  ? priceAlerts.map(alert => {
      const status = alert.isActive ? (alert.triggeredAt ? 'TRIGGERED' : 'ACTIVE') : 'INACTIVE';
      return `${alert.symbol}: ${alert.condition} $${alert.targetPrice.toFixed(2)} [${status}]`;
    }).join('\n')
  : 'No price alerts set'}

=== ACCOUNTS (Cash Balances) ===
${accounts.length > 0
  ? accounts.map(acc => `${acc.name}: $${acc.cashBalance.toFixed(2)}${acc.isShared ? ' (Shared)' : ''}`).join('\n')
  : 'No accounts'}
Total Cash: $${accounts.reduce((sum, acc) => sum + acc.cashBalance, 0).toFixed(2)}

=== REBALANCING TARGETS ===
${rebalanceTargets.length > 0
  ? rebalanceTargets.map(target => `${target.targetType} - ${target.identifier}: ${target.targetPercent.toFixed(1)}%`).join('\n')
  : 'No rebalancing targets set'}

=== USER PREFERENCES ===
- Cost Basis Method: ${userPreferences?.costBasisMethod || 'FIFO'}

=== NOTES ===
- Prices marked as "market" are from stock price feeds
- Prices marked as "estimated (avg cost)" mean the market price isn't available yet
- The dashboard will automatically try to fetch current prices on page load
- "Closed Positions" are stocks the user fully sold - use this data for historical questions
- Long-term gains (>1 year holding) are taxed differently than short-term gains
- ALL TRANSACTIONS include dates - use these for calculating holding periods and tax implications
- When generating gains/loss reports, use the user's preferred cost basis method (${userPreferences?.costBasisMethod || 'FIFO'})
- WATCHLIST shows stocks the user is watching but hasn't purchased yet
- PRICE ALERTS notify the user when a stock hits a target price
- ACCOUNTS show cash balances available for investing

Provide helpful, accurate information about their portfolio. Be concise but informative.
If asked about specific stocks (current or previously held), use the portfolio data above.
If asked about the watchlist, use the WATCHLIST section with current prices and analyst targets.
If asked about past trades or realized gains, refer to the Closed Positions section and transaction dates.
If asked to generate a gains/loss report, use the transaction dates to determine acquisition dates and holding periods.
If asked about recommendations, provide general guidance but remind them to consult a financial advisor.
If asked about rebalancing, use the REBALANCING TARGETS section to show target allocations.
Never reveal data from other users - you can only see this user's portfolio.`;

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...conversationHistory,
            { role: 'user', content: message },
          ],
        });

        aiResponse = response.content[0].type === 'text'
          ? response.content[0].text
          : aiResponse;
      } catch (error) {
        console.error('Claude API error:', error);
      }
    }

    // Save assistant response
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        userId: session.id,
        role: 'assistant',
        content: aiResponse,
      },
    });

    return NextResponse.json({
      response: aiResponse,
      messageId: assistantMessage.id,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
