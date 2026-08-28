import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const OPEN = [/^\/login$/, /^\/api\/auth\//, /^\/$/];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN.some((re) => re.test(pathname))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  const token = request.cookies.get("seo_session")?.value;
  const needsAuth =
    pathname.startsWith("/p") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/api/");
  if (needsAuth && !token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/p/:path*", "/settings/:path*", "/settings", "/api/:path*"],
};
