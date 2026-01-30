import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

// Paths that don't require authentication
const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

// Paths that should skip locale handling
const apiPaths = ['/api'];

// Admin paths - requires admin role
const adminPaths = ['/admin'];

// Security headers to apply to all responses
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy - don't leak sensitive data in referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy - restrict browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes but add security headers
  if (apiPaths.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Apply intl middleware
  const response = intlMiddleware(request);

  // Check authentication for protected routes
  const token = request.cookies.get('auth-token')?.value;
  const isPublicPath = publicPaths.some((path) => pathname.includes(path));
  const isAdminPath = adminPaths.some((path) => pathname.includes(path));

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

  // Admin route protection is handled at page level for simplicity
  // The admin layout will check if user is admin

  // Add security headers to all responses
  return addSecurityHeaders(response as NextResponse);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
