import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toProblem } from "@/lib/problem";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";

const bodySchema = z.object({ phone: z.string().min(8).max(20) });

function generateDevOtp(phone: string): string {
  // Deterministic 6-digit code for non-production
  const base = Math.abs(Array.from(phone).reduce((acc, c) => acc * 33 + c.charCodeAt(0), 7));
  const window = Math.floor(Date.now() / (5 * 60 * 1000));
  return ((base + window) % 1_000_000).toString().padStart(6, "0");
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;

  return getOrCreateIdempotent(idk, "POST", "/auth/send-otp", async () => {
    let parsed;
    try {
      const body = await req.json();
      parsed = bodySchema.parse(body);
    } catch (e) {
      return { status: 400, body: toProblem(400, "Invalid request body", (e as Error).message, { instance: requestId }) };
    }

    const { phone } = parsed;
    const otp = generateDevOtp(phone);
    // In production, integrate with SMS provider. For now, return masked and dev flag.
    return {
      status: 200,
      body: { ok: true, phone: phone.replace(/.(?=.{2})/g, "*"), dev: process.env.NODE_ENV !== "production", otp },
    };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
