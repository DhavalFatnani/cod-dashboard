import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";
import { createRiderBundle, listRiderBundles } from "@/lib/store";

const createSchema = z.object({ riderId: z.string().uuid(), orderIds: z.array(z.string().uuid()).min(1) });

export async function GET() {
  return NextResponse.json({ bundles: listRiderBundles() });
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  return getOrCreateIdempotent(idk, "POST", "/rider/bundles", async () => {
    const body = await req.json();
    const input = createSchema.parse(body);
    const b = createRiderBundle(input.riderId, input.orderIds);
    return { status: 201, body: { bundle: b, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
