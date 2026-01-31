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

    // Get user's existing transactions to learn patterns
    const userTransactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'desc' },
      take: 50,
    });

    // Get all users who are connected to the current user (approved share requests)
    const connections = await prisma.shareRequest.findMany({
      where: {
        status: 'approved',
        OR: [
          { requesterId: session.id },
          { targetId: session.id },
        ],
      },
    });

    // Build list of user IDs who can share unclaimed transactions
    const sharedUserIds = new Set<string>([session.id]);
    for (const conn of connections) {
      sharedUserIds.add(conn.requesterId);
      sharedUserIds.add(conn.targetId);
    }
    const allowedUserIds = Array.from(sharedUserIds);

    // Get unclaimed transactions only from connected users
    const unclaimedTransactions = await prisma.transaction.findMany({
      where: {
        claimedById: null,
        dataUpload: {
          userId: { in: allowedUserIds },
        },
      },
      orderBy: { date: 'desc' },
    });

    if (unclaimedTransactions.length === 0) {
      return NextResponse.json({ suggestedIds: [] });
    }

    // If no API key, return random selection as fallback
    if (!process.env.ANTHROPIC_API_KEY) {
      const randomIds = unclaimedTransactions
        .slice(0, Math.min(5, unclaimedTransactions.length))
        .map((tx) => tx.id);
      return NextResponse.json({ suggestedIds: randomIds });
    }

    // Build context for Claude
    const userSymbols = [...new Set(userTransactions.map((tx) => tx.symbol))];
    const userTypes = [...new Set(userTransactions.map((tx) => tx.type))];

    const prompt = `You are helping a user claim their transactions from a shared family brokerage account.

The user has previously claimed transactions with these characteristics:
- Symbols they've invested in: ${userSymbols.join(', ') || 'None yet'}
- Transaction types they've had: ${userTypes.join(', ') || 'None yet'}
- Recent transaction patterns: ${
      userTransactions.slice(0, 10).map((tx) =>
        `${tx.type} ${tx.quantity} shares of ${tx.symbol} on ${tx.date.toISOString().split('T')[0]}`
      ).join('; ') || 'No history'
    }

Here are the unclaimed transactions:
${unclaimedTransactions.map((tx) =>
  `ID: ${tx.id} | ${tx.type} | ${tx.symbol} | ${tx.quantity} shares @ $${tx.price} | ${tx.date.toISOString().split('T')[0]}`
).join('\n')}

Based on the user's investment patterns and history, which transaction IDs should they likely claim?
Consider:
1. Symbols they've invested in before
2. Similar transaction types
3. Logical continuity (e.g., if they bought AAPL before, they might be selling AAPL now)

Return ONLY a JSON array of transaction IDs that seem to belong to this user, nothing else.
If you can't determine any patterns, return an empty array [].
Example response: ["id1", "id2", "id3"]`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      // Try to extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestedIds = JSON.parse(jsonMatch[0]);
        // Validate that all IDs exist in unclaimed transactions
        const validIds = suggestedIds.filter((id: string) =>
          unclaimedTransactions.some((tx) => tx.id === id)
        );
        return NextResponse.json({ suggestedIds: validIds });
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // Fallback: suggest transactions with matching symbols
    const suggestedIds = unclaimedTransactions
      .filter((tx) => userSymbols.includes(tx.symbol))
      .map((tx) => tx.id);

    return NextResponse.json({ suggestedIds });
  } catch (error) {
    console.error('[AI Suggest Claims API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get AI suggestions' },
      { status: 500 }
    );
  }
}
