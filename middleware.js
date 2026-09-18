import { NextResponse } from 'next/server';

const COOKIE_NAME = 'new_roadmap_auth';
const PUBLIC_PATHS = ['/enter-passcode'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const passcode = process.env.SITE_PASSCODE;

  // If no passcode is configured (e.g. local dev without the env var set),
  // don't lock anyone out.
  if (!passcode) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie && cookie.value === passcode) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/enter-passcode';
  url.search = '';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// Runs on everything except Next.js internals and the favicon.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
