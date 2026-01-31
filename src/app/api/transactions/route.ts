import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkAndFlagDuplicates } from '@/lib/duplicate-detection';
import { detectWashSale } from '@/lib/wash-sale-detector';

// Create a new transaction manually
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, type, symbol, quantity, price, amount, fees, description, notes, claimImmediately, accountId } = body;

    // Validate required fields
    if (!date || !type || !symbol || quantity === undefined || price === undefined) {
      return NextResponse.json(
        { error: 'Date, type, symbol, quantity, and price are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['BUY', 'SELL', 'DIVIDEND', 'TRANSFER_IN', 'TRANSFER_OUT'];
    if (!validTypes.includes(type.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid transaction type.' },
        { status: 400 }
      );
    }

    const txDate = new Date(date);
    const txType = type.toUpperCase();
    const txSymbol = symbol.toUpperCase();
    const txQuantity = Number(quantity);
    const txPrice = Number(price);
    const calculatedAmount = amount || txQuantity * txPrice;

    // Check for wash sale on SELL transactions with losses
    let washSaleFlag = false;
    let washSaleAmount: number | null = null;

    if (claimImmediately && (txType === 'SELL' || txType === 'TRANSFER_OUT')) {
      // Get user's transactions to check wash sale
      const userTransactions = await prisma.transaction.findMany({
        where: {
          claimedById: session.id,
          symbol: txSymbol,
        },
        select: {
          id: true,
          date: true,
          type: true,
          symbol: true,
          quantity: true,
          price: true,
          amount: true,
        },
      });

      // Calculate cost basis to determine if this is a loss
      const buyTransactions = userTransactions.filter(t => t.type === 'BUY' || t.type === 'TRANSFER_IN');
      const totalCost = buyTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalBought = buyTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const avgCost = totalBought > 0 ? totalCost / totalBought : 0;
      const estimatedCostBasis = avgCost * txQuantity;
      const estimatedGainLoss = calculatedAmount - estimatedCostBasis;

      if (estimatedGainLoss < 0) {
        const washResult = detectWashSale(
          txDate,
          txSymbol,
          estimatedGainLoss,
          txQuantity,
          userTransactions.map(t => ({
            ...t,
            date: new Date(t.date),
          }))
        );

        if (washResult.isWashSale) {
          washSaleFlag = true;
          washSaleAmount = washResult.disallowedLoss;
        }
      }
    }

    // Create the transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: txDate,
        type: txType,
        symbol: txSymbol,
        quantity: txQuantity,
        price: txPrice,
        amount: Number(calculatedAmount),
        fees: Number(fees) || 0,
        description: description || null,
        notes: notes || null,
        claimedById: claimImmediately ? session.id : null,
        accountId: accountId || null,
        washSaleFlag,
        washSaleAmount,
      },
    });

    // Create tax lot for BUY or TRANSFER_IN transactions when claimed
    if (claimImmediately && (txType === 'BUY' || txType === 'TRANSFER_IN')) {
      await prisma.taxLot.create({
        data: {
          transactionId: transaction.id,
          symbol: txSymbol,
          quantity: txQuantity,
          remainingQty: txQuantity,
          costBasis: Number(calculatedAmount) + (Number(fees) || 0),
          acquiredDate: txDate,
        },
      });
    }

    // Create history entry for claimed transactions
    if (claimImmediately) {
      await prisma.transactionHistory.create({
        data: {
          transactionId: transaction.id,
          userId: session.id,
          changeType: 'CREATE',
          newData: {
            date: txDate.toISOString(),
            type: txType,
            symbol: txSymbol,
            quantity: txQuantity,
            price: txPrice,
            amount: Number(calculatedAmount),
          },
        },
      });
    }

    // Check for duplicates if not claimed immediately
    if (!claimImmediately) {
      await checkAndFlagDuplicates(transaction.id, {
        date: txDate,
        symbol: txSymbol,
        type: txType,
        quantity: txQuantity,
        price: txPrice,
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        ...transaction,
        date: transaction.date.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
      },
      washSale: washSaleFlag ? { flag: true, amount: washSaleAmount } : null,
    });
  } catch (error) {
    console.error('[Transactions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// Get transactions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unclaimed = searchParams.get('unclaimed') === 'true';

    let transactions;

    if (unclaimed) {
      // For unclaimed transactions, only show those from connected users
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

      // Get unclaimed transactions that were uploaded by allowed users
      transactions = await prisma.transaction.findMany({
        where: {
          claimedById: null,
          dataUpload: {
            userId: { in: allowedUserIds },
          },
        },
        orderBy: [
          { isDuplicateFlag: 'desc' },
          { date: 'desc' },
        ],
      });
    } else {
      // For claimed transactions, only show user's own
      transactions = await prisma.transaction.findMany({
        where: { claimedById: session.id },
        orderBy: { date: 'desc' },
      });
    }

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Transactions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
