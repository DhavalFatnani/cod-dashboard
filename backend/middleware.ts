import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

async function getClaims(token: string | undefined): Promise<{ role?: string } | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return { role: (payload as any).role };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/health") || url.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  const session = req.cookies.get("session")?.value;
  const claims = await getClaims(session);
  if (!claims?.role) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = NextResponse.next();
  res.headers.set("x-user-role", claims.role);
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
