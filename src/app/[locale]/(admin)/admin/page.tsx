import prisma from '@/lib/db';
import Link from 'next/link';
import {
  Users,
  Receipt,
  Upload,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

async function getStats() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    newUsersThisWeek,
    transactionCount,
    uploadCount,
    chatCount,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.transaction.count(),
    prisma.dataUpload.count(),
    prisma.chatMessage.count(),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        role: true,
        _count: {
          select: { transactions: true },
        },
      },
    }),
  ]);

  return {
    userCount,
    newUsersThisWeek,
    transactionCount,
    uploadCount,
    chatCount,
    recentUsers,
  };
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of FamilyFolio platform usage and activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Users
            </span>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.userCount}
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            +{stats.newUsersThisWeek} this week
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Transactions
            </span>
            <Receipt className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.transactionCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Total tracked
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Data Uploads
            </span>
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.uploadCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            CSV & image imports
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              AI Chats
            </span>
            <MessageSquare className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.chatCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Messages sent
          </p>
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Users
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Newly registered accounts
          </p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {stats.recentUsers.map((user) => (
            <div
              key={user.id}
              className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.name || 'No name'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {user.role === 'admin' && (
                  <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
                    Admin
                  </span>
                )}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {user._count.transactions} transactions
                </span>
                <span className="text-sm text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/${locale}/admin/users`}
            className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            View All Users
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
