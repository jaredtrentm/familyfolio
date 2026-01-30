import { setRequestLocale } from 'next-intl/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar locale={locale} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        <MobileNav locale={locale} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
