import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    // Get stock prices from cache
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: holdings.map((h) => h.symbol) } },
    });
    const priceMap = new Map(stockCache.map((s) => [s.symbol, s]));

    // Build portfolio summary for AI
    const portfolioSummary = holdings.map((h) => {
      const stock = priceMap.get(h.symbol);
      const currentPrice = stock?.currentPrice || h.costBasis / h.quantity;
      const currentValue = h.quantity * currentPrice;
      return `${h.symbol}: ${h.quantity} shares, Cost: $${h.costBasis.toFixed(2)}, Current: $${currentValue.toFixed(2)}`;
    }).join('\n');

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

Current user's portfolio:
${portfolioSummary || 'No holdings yet'}

Total portfolio cost basis: $${totalCostBasis.toFixed(2)}
Number of holdings: ${holdings.length}

Recent transactions: ${transactions.slice(0, 5).map((tx) =>
  `${tx.type} ${tx.quantity} ${tx.symbol} @ $${tx.price}`
).join(', ') || 'None'}

Provide helpful, accurate information about their portfolio. Be concise but informative.
If asked about specific stocks, use the portfolio data above.
If asked about recommendations, provide general guidance but remind them to consult a financial advisor.`;

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
