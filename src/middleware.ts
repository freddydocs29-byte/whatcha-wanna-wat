import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware — one rule only.
 *
 * Unauthenticated visitors at "/" are redirected to the Founding Tasters gate
 * (/founding). Auth state is signalled by the wwe_auth cookie, which is set
 * by every successful auth event (email signup, email signin, OAuth callback).
 *
 * The matcher is scoped to "/" only. All other routes — /auth, /auth/callback,
 * /founding, /terms, /privacy, /api/*, and every app screen — are unaffected.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.has("wwe_auth")) {
    return NextResponse.redirect(new URL("/founding", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
