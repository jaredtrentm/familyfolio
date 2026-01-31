import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AlertsClient } from './AlertsClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'alerts' });
  return {
    title: t('title'),
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
