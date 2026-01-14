import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { UnclaimedClient } from './UnclaimedClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'unclaimed' });

  return {
    title: t('title'),
  };
}

async function getUnclaimedTransactions(userId: string) {
  // Get all users who are connected to the current user (approved share requests)
  const connections = await prisma.shareRequest.findMany({
    where: {
      status: 'approved',
      OR: [
        { requesterId: userId },
        { targetId: userId },
      ],
    },
  });

  // Build list of user IDs who can share unclaimed transactions
  const sharedUserIds = new Set<string>([userId]);
  for (const conn of connections) {
    sharedUserIds.add(conn.requesterId);
    sharedUserIds.add(conn.targetId);
  }
  const allowedUserIds = Array.from(sharedUserIds);

  // Get unclaimed transactions that were uploaded by allowed users
  // A transaction is "from" a user if its dataUpload was created by that user
  const transactions = await prisma.transaction.findMany({
    where: {
      claimedById: null,
      dataUpload: {
        userId: { in: allowedUserIds },
      },
    },
    include: {
      dataUpload: {
        select: { userId: true },
      },
    },
    orderBy: [
      { isDuplicateFlag: 'desc' }, // Show duplicates first
      { date: 'desc' },
    ],
  });

  return transactions.map((tx) => ({
    ...tx,
    date: tx.date.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    uploadedBy: tx.dataUpload?.userId || null,
  }));
}

export default async function UnclaimedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    return null;
  }

  const transactions = await getUnclaimedTransactions(session.id);

  return (
    <UnclaimedClient
      transactions={transactions}
      locale={locale}
      userId={session.id}
    />
  );
}
