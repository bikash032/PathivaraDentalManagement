import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must match SESSION_COOKIE in src/lib/auth/session.ts. Duplicated here
// because middleware can't safely import Prisma/"server-only" code.
const SESSION_COOKIE = "session_token";
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  // This is a coarse, fast redirect for UX only. The authoritative check —
  // session validity in the DB and User.isActive — happens in
  // requireUser()/requirePermission() on every protected server component
  // and action, so this middleware being bypassable is not a security hole.
  if (!isPublic && !hasCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
