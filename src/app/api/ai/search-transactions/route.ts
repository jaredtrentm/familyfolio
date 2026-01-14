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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, transactionIds } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get transactions to search through
    // If transactionIds provided, search those; otherwise search unclaimed
    let transactions;
    if (transactionIds && Array.isArray(transactionIds) && transactionIds.length > 0) {
      transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
        orderBy: { date: 'desc' },
      });
    } else {
      transactions = await prisma.transaction.findMany({
        where: { claimedById: null },
        orderBy: { date: 'desc' },
      });
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        matchingIds: [],
        message: 'No transactions to search through.',
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Fallback: simple keyword search
      const lowerQuery = query.toLowerCase();
      const matchingIds = transactions
        .filter((tx) =>
          tx.symbol.toLowerCase().includes(lowerQuery) ||
          tx.description?.toLowerCase().includes(lowerQuery) ||
          tx.type.toLowerCase().includes(lowerQuery)
        )
        .map((tx) => tx.id);

      return NextResponse.json({
        matchingIds,
        message: matchingIds.length > 0
          ? `Found ${matchingIds.length} transactions matching "${query}"`
          : `No transactions found matching "${query}"`,
      });
    }

    // Format transactions for AI
    const transactionList = transactions.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString().split('T')[0],
      type: tx.type,
      symbol: tx.symbol,
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
      description: tx.description,
    }));

    // Check if user is asking about duplicates
    const isDuplicateQuery = /duplicate|dup|重复|重覆/i.test(query);

    let prompt: string;

    if (isDuplicateQuery) {
      // Special prompt for duplicate detection
      prompt = `You are an expert at detecting duplicate financial transactions. Analyze these transactions and find ALL likely duplicates.

Here are all available transactions:
${JSON.stringify(transactionList, null, 2)}

A transaction is likely a DUPLICATE if:
1. Same symbol AND same type AND same quantity AND same price (most likely duplicate)
2. Same symbol AND same type AND same quantity AND dates within 3 days of each other (possible data import overlap)
3. Same symbol AND same type AND very similar amount (within 1%) AND dates within 1 week (possible rounding difference)
4. Same symbol AND same quantity AND same price but different dates - could be intentional OR a duplicate with wrong date

For each pair/group of duplicates found:
- Include ALL transaction IDs that are duplicates of each other (not just one from each pair)
- The user should see all related duplicates so they can choose which to keep

Return a JSON object with:
1. "matchingIds": array of ALL transaction IDs that appear to be duplicates (include all transactions in duplicate groups)
2. "duplicateGroups": array of arrays, where each inner array contains IDs that are duplicates of each other
3. "message": a summary like "Found X potential duplicate transactions in Y groups. Review carefully before deleting."

Example:
{"matchingIds": ["id1", "id2", "id3", "id4"], "duplicateGroups": [["id1", "id2"], ["id3", "id4"]], "message": "Found 4 potential duplicate transactions in 2 groups. Same AAPL buys appear twice."}

If no duplicates found:
{"matchingIds": [], "duplicateGroups": [], "message": "No duplicate transactions detected. All transactions appear unique."}

Return ONLY the JSON object, nothing else.`;
    } else {
      // Standard search prompt
      prompt = `You are helping a user find specific transactions from their investment portfolio.

Here are all available transactions:
${JSON.stringify(transactionList, null, 2)}

User's search query: "${query}"

Analyze the query and find matching transactions. Consider:
- Stock symbols (AAPL = Apple, GOOGL = Google/Alphabet, MSFT = Microsoft, etc.)
- Time references ("last summer" = June-August of previous year, "last month", "this year", etc.)
- Transaction types (buy, sell, dividend)
- Amounts or quantities mentioned
- Any other relevant criteria

Today's date is ${new Date().toISOString().split('T')[0]}.

Return a JSON object with:
1. "matchingIds": array of transaction IDs that match the query
2. "message": a brief, friendly explanation of what you found

Example response:
{"matchingIds": ["id1", "id2"], "message": "Found 2 Apple (AAPL) purchases from last summer."}

If no matches found:
{"matchingIds": [], "message": "No transactions found matching your search. Try searching for a stock symbol or time period."}

Return ONLY the JSON object, nothing else.`;
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    try {
      // Parse the JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);

        // Validate that returned IDs exist in our transactions
        const validIds = (result.matchingIds || []).filter((id: string) =>
          transactions.some((tx) => tx.id === id)
        );

        return NextResponse.json({
          matchingIds: validIds,
          message: result.message || `Found ${validIds.length} matching transactions.`,
        });
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // Fallback response
    return NextResponse.json({
      matchingIds: [],
      message: 'Could not process your search. Try using specific stock symbols or dates.',
    });
  } catch (error) {
    console.error('[AI Search Transactions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search transactions' },
      { status: 500 }
    );
  }
}
