import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { TransactionsClient } from './TransactionsClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transactions' });

  return {
    title: t('title'),
  };
}

async function getTransactions(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { claimedById: userId },
    orderBy: { date: 'desc' },
  });

  return transactions.map((tx) => ({
    ...tx,
    date: tx.date.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));
}

export default async function TransactionsPage({
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

  const transactions = await getTransactions(session.id);

  return <TransactionsClient transactions={transactions} locale={locale} />;
}
