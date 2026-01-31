import { setRequestLocale } from 'next-intl/server';
import { RebalanceClient } from './RebalanceClient';

export async function generateMetadata() {
  return {
    title: 'Rebalancing',
  };
}

export default async function RebalancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <RebalanceClient locale={locale} />;
}
