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

async function getUnclaimedTransactions() {
  const transactions = await prisma.transaction.findMany({
    where: { claimedById: null },
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

  const transactions = await getUnclaimedTransactions();

  return (
    <UnclaimedClient
      transactions={transactions}
      locale={locale}
      userId={session.id}
    />
  );
}
