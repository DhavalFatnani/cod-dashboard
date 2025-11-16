import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  const id = z.string().uuid().parse(params.id);
  return getOrCreateIdempotent(idk, "POST", `/asm/bundles/${id}/accept`, async () => {
    // In real impl: transactional accept
    return { status: 200, body: { accepted: true, bundleId: id, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
