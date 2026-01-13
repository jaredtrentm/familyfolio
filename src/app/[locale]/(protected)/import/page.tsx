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
    take: 20,
    include: {
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return uploads.map((upload) => ({
    id: upload.id,
    filename: upload.filename,
    fileType: upload.fileType,
    status: upload.status,
    errorMessage: upload.errorMessage,
    createdAt: upload.createdAt.toISOString(),
    accountId: upload.accountId,
    accountName: upload.account?.name || null,
  }));
}

async function getAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
    },
  });

  return accounts;
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

  const [uploadHistory, accounts] = await Promise.all([
    getUploadHistory(session.id),
    getAccounts(session.id),
  ]);

  return (
    <ImportClient
      uploadHistory={uploadHistory}
      accounts={accounts}
      locale={locale}
    />
  );
}
