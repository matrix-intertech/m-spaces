import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = [
  { prefix: "/admin", roles: ["admin", "support"] },
  { prefix: "/broker", roles: ["broker"] },
  { prefix: "/sales", roles: ["external_sales"] },
  { prefix: "/owner", roles: ["owner"] },
] as const;

function protectedRouteFor(pathname: string) {
  return PROTECTED_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get("connect.sid")?.value);
}

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = protectedRouteFor(request.nextUrl.pathname);

  if (!route) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|assets|uploads).*)"],
};
