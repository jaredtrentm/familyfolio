import { setRequestLocale, getTranslations } from 'next-intl/server';
import { RebalanceClient } from './RebalanceClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rebalance' });
  return {
    title: t('title'),
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
