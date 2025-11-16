import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createDepositBundle } from "@/lib/store";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";

const schema = z.object({ smId: z.string().uuid(), superbundleIds: z.array(z.string().uuid()).min(1) });

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  return getOrCreateIdempotent(idk, "POST", "/sm/depositbundles", async () => {
    const input = schema.parse(await req.json());
    const db = createDepositBundle(input.smId, input.superbundleIds);
    return { status: 201, body: { depositBundle: db, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
