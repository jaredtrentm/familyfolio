import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

// Paths that don't require authentication
const publicPaths = ['/login', '/register'];

// Paths that should skip locale handling
const apiPaths = ['/api'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes
  if (apiPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Apply intl middleware
  const response = intlMiddleware(request);

  // Check authentication for protected routes
  const token = request.cookies.get('auth-token')?.value;
  const isPublicPath = publicPaths.some((path) => pathname.includes(path));

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(en|zh)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : defaultLocale;

  if (!token && !isPublicPath) {
    // Redirect to login if not authenticated
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublicPath) {
    // Redirect to dashboard if already authenticated
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
