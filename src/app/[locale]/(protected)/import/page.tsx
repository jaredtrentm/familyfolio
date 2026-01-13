import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { ImportClient } from './ImportClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'import' });

  return {
    title: t('title'),
  };
}

async function getUploadHistory(userId: string) {
  const uploads = await prisma.dataUpload.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return uploads.map((upload) => ({
    ...upload,
    createdAt: upload.createdAt.toISOString(),
  }));
}

export default async function ImportPage({
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

  const uploadHistory = await getUploadHistory(session.id);

  return <ImportClient uploadHistory={uploadHistory} locale={locale} />;
}
