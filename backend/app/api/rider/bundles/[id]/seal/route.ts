import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";
import { sealRiderBundle } from "@/lib/store";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  const id = z.string().uuid().parse(params.id);
  return getOrCreateIdempotent(idk, "POST", `/rider/bundles/${id}/seal`, async () => {
    const b = sealRiderBundle(id);
    if (!b) return { status: 404, body: { error: "not_found", requestId } };
    return { status: 200, body: { bundle: b, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
