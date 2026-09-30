import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/api";

/**
 * Keeps signed-out visitors off the app, and signed-in ones off the login page.
 *
 * Next.js 16 renamed `middleware` to `proxy`: the file is `proxy.ts` and the
 * export is `proxy`. Only one is allowed per project, so the logic lives here
 * and is kept to a cheap check.
 *
 * This is an *optimistic* check, not the security boundary. It verifies only
 * that a token cookie exists — it does not, and cannot cheaply, verify the
 * signature; doing that on every navigation would mean a crypto call per request
 * to learn something the API will tell us anyway. The real enforcement is that
 * every page fetches its data through `lib/api.ts`, which attaches the bearer
 * token and gets a 401 for anything invalid. A forged cookie therefore reaches
 * the page shell and then renders an error instead of data.
 *
 * `config.matcher` keeps this off static assets and the API proxy, so it only
 * runs for navigations to real routes.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;

  const isLoginPage = pathname === "/login";

  if (!hasSession && !isLoginPage) {
    // `next` carries where they were heading, so signing in returns them there
    // instead of always landing on the dashboard.
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
