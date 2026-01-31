import { setRequestLocale, getTranslations } from 'next-intl/server';
import { WatchlistClient } from './WatchlistClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'watchlist' });
  return {
    title: t('title'),
  };
}

export default async function WatchlistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WatchlistClient locale={locale} />;
}
