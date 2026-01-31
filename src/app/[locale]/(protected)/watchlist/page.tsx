import { setRequestLocale } from 'next-intl/server';
import { WatchlistClient } from './WatchlistClient';

export async function generateMetadata() {
  return {
    title: 'Watchlist',
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
