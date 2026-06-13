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

async function getCurrentUserRole(request: NextRequest) {
  const userUrl = new URL("/svc/server/api/user", request.url);

  const response = await fetch(userUrl, {
    headers: {
      accept: "application/json",
      cookie: request.headers.get("cookie") ?? "",
      "x-middleware-prefetch": "1",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const role = payload?.data?.role ?? payload?.user?.role ?? payload?.role;
  return typeof role === "string" ? role.toLowerCase() : null;
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

  try {
    const role = await getCurrentUserRole(request);
    if (!role) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-request-id", requestId);
      return response;
    }

    if (!route.roles.some((allowedRole) => allowedRole === role)) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.headers.set("x-request-id", requestId);
      return response;
    }
  } catch (error) {
    console.error("[middleware] Protected route validation failed", {
      requestId,
      pathname: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    const response = NextResponse.redirect(new URL("/login", request.url));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|uploads).*)"],
};
