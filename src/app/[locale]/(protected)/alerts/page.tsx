import { setRequestLocale } from 'next-intl/server';
import { AlertsClient } from './AlertsClient';

export async function generateMetadata() {
  return {
    title: 'Price Alerts',
  };
}

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AlertsClient locale={locale} />;
}
