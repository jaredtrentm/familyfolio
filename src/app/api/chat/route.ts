import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

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

    // Calculate holdings
    const holdingsMap = new Map<string, { symbol: string; quantity: number; costBasis: number }>();

    for (const tx of transactions) {
      const existing = holdingsMap.get(tx.symbol) || { symbol: tx.symbol, quantity: 0, costBasis: 0 };

      switch (tx.type) {
        case 'BUY':
        case 'TRANSFER_IN':
          existing.quantity += tx.quantity;
          existing.costBasis += tx.amount;
          break;
        case 'SELL':
        case 'TRANSFER_OUT':
          const ratio = tx.quantity / existing.quantity;
          existing.quantity -= tx.quantity;
          existing.costBasis -= existing.costBasis * ratio;
          break;
      }

      if (existing.quantity > 0) {
        holdingsMap.set(tx.symbol, existing);
      } else {
        holdingsMap.delete(tx.symbol);
      }
    }

    const holdings = Array.from(holdingsMap.values());
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

=== RECENT TRANSACTIONS ===
${transactions.slice(0, 5).map((tx) =>
  `${tx.type} ${tx.quantity} ${tx.symbol} @ $${tx.price}`
).join('\n') || 'None'}

=== NOTES ===
- Prices marked as "market" are from stock price feeds
- Prices marked as "estimated (avg cost)" mean the market price isn't available yet
- The dashboard will automatically try to fetch current prices on page load

Provide helpful, accurate information about their portfolio. Be concise but informative.
If asked about specific stocks, use the portfolio data above.
If asked about recommendations, provide general guidance but remind them to consult a financial advisor.
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
