import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSuperbundle } from "@/lib/store";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";

const schema = z.object({ asmId: z.string().uuid(), riderBundleIds: z.array(z.string().uuid()).min(1) });

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  return getOrCreateIdempotent(idk, "POST", "/asm/superbundles", async () => {
    const input = schema.parse(await req.json());
    const sb = createSuperbundle(input.asmId, input.riderBundleIds);
    return { status: 201, body: { superbundle: sb, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
