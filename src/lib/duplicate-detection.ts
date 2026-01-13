import prisma from './db';
import { subDays, addDays, isSameDay } from 'date-fns';

interface TransactionInput {
  date: Date;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
}

interface DuplicateMatch {
  transactionId: string;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Find likely duplicates of a transaction in the database
 * Only returns matches with score >= 80 (likely duplicates)
 */
export async function findLikelyDuplicates(
  newTxn: TransactionInput,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  // Find transactions: same symbol, same type, within 3 days
  const candidates = await prisma.transaction.findMany({
    where: {
      symbol: newTxn.symbol.toUpperCase(),
      type: newTxn.type.toUpperCase(),
      date: {
        gte: subDays(newTxn.date, 3),
        lte: addDays(newTxn.date, 3),
      },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    let score = 0;
    const reasons: string[] = [];

    // Same date = +40 points
    if (isSameDay(candidate.date, newTxn.date)) {
      score += 40;
      reasons.push('Same date');
    } else {
      // Within 1 day = +25 points
      const daysDiff = Math.abs(
        (candidate.date.getTime() - newTxn.date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff <= 1) {
        score += 25;
        reasons.push('Within 1 day');
      }
    }

    // Same quantity = +30 points
    if (candidate.quantity === newTxn.quantity) {
      score += 30;
      reasons.push('Same quantity');
    }

    // Same price (within 1%) = +30 points
    const priceDiff = Math.abs(candidate.price - newTxn.price) / candidate.price;
    if (priceDiff < 0.01) {
      score += 30;
      reasons.push('Same price');
    } else if (priceDiff < 0.03) {
      score += 20;
      reasons.push('Similar price');
    }

    // Only include likely duplicates (score >= 80)
    if (score >= 80) {
      matches.push({
        transactionId: candidate.id,
        matchScore: score,
        matchReasons: reasons,
      });
    }
  }

  return matches;
}

/**
 * Check a new transaction for duplicates and flag both if found
 */
export async function checkAndFlagDuplicates(
  newTransactionId: string,
  txnData: TransactionInput
): Promise<{ isDuplicate: boolean; duplicateOf?: string }> {
  const duplicates = await findLikelyDuplicates(txnData, newTransactionId);

  if (duplicates.length > 0) {
    // Get the highest scoring match
    const bestMatch = duplicates.sort((a, b) => b.matchScore - a.matchScore)[0];

    // Flag BOTH transactions as duplicates of each other
    await prisma.$transaction([
      // Flag the new transaction
      prisma.transaction.update({
        where: { id: newTransactionId },
        data: {
          isDuplicateFlag: true,
          duplicateOfId: bestMatch.transactionId,
          duplicateScore: bestMatch.matchScore,
        },
      }),
      // Flag the existing transaction
      prisma.transaction.update({
        where: { id: bestMatch.transactionId },
        data: {
          isDuplicateFlag: true,
          duplicateOfId: newTransactionId,
          duplicateScore: bestMatch.matchScore,
        },
      }),
    ]);

    return { isDuplicate: true, duplicateOf: bestMatch.transactionId };
  }

  return { isDuplicate: false };
}

/**
 * When a flagged duplicate is deleted, unflag its pair
 */
export async function unflagDuplicatePair(deletedTransactionId: string): Promise<void> {
  // Find any transaction that was flagged as duplicate of the deleted one
  const pairedTransaction = await prisma.transaction.findFirst({
    where: { duplicateOfId: deletedTransactionId },
  });

  if (pairedTransaction) {
    // Check if this transaction has OTHER duplicates
    const otherDuplicates = await findLikelyDuplicates(
      {
        date: pairedTransaction.date,
        symbol: pairedTransaction.symbol,
        type: pairedTransaction.type,
        quantity: pairedTransaction.quantity,
        price: pairedTransaction.price,
      },
      pairedTransaction.id
    );

    // Filter out the one being deleted
    const remainingDuplicates = otherDuplicates.filter(
      (d) => d.transactionId !== deletedTransactionId
    );

    if (remainingDuplicates.length === 0) {
      // No other duplicates, unflag this transaction
      await prisma.transaction.update({
        where: { id: pairedTransaction.id },
        data: {
          isDuplicateFlag: false,
          duplicateOfId: null,
          duplicateScore: null,
        },
      });
    } else {
      // Update to point to next duplicate
      await prisma.transaction.update({
        where: { id: pairedTransaction.id },
        data: {
          duplicateOfId: remainingDuplicates[0].transactionId,
          duplicateScore: remainingDuplicates[0].matchScore,
        },
      });
    }
  }
}
