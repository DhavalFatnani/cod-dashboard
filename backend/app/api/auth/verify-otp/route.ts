import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toProblem } from "@/lib/problem";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";
import { SignJWT } from "jose";

const bodySchema = z.object({ phone: z.string().min(8).max(20), otp: z.string().length(6) });

function generateDevOtp(phone: string): string {
  const base = Math.abs(Array.from(phone).reduce((acc, c) => acc * 33 + c.charCodeAt(0), 7));
  const window = Math.floor(Date.now() / (5 * 60 * 1000));
  return ((base + window) % 1_000_000).toString().padStart(6, "0");
}

async function issueJwt(phone: string, role: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
  const token = await new SignJWT({ phone, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
  return token;
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;

  return getOrCreateIdempotent(idk, "POST", "/auth/verify-otp", async () => {
    let parsed;
    try {
      const body = await req.json();
      parsed = bodySchema.parse(body);
    } catch (e) {
      return { status: 400, body: toProblem(400, "Invalid request body", (e as Error).message, { instance: requestId }) };
    }

    const { phone, otp } = parsed;
    const expectedOtp = generateDevOtp(phone);
    if (process.env.NODE_ENV !== "production" && otp !== expectedOtp) {
      return { status: 401, body: toProblem(401, "Invalid OTP", "OTP verification failed", { instance: requestId }) };
    }

    // TODO: fetch role from users table; default dev role
    const role = "asm";
    const jwt = await issueJwt(phone, role);
    const res = NextResponse.json({ ok: true, role }, { status: 200, headers: { "x-request-id": requestId } });
    res.cookies.set("session", jwt, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    return { status: 200, body: { ok: true, role } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
