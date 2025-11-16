import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadSlip } from "@/lib/store";
import { getOrCreateIdempotent, generateRequestId } from "@/lib/idempotency";

const body = z.object({ url: z.string().url() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const idk = req.headers.get("idempotency-key") ?? undefined;
  const id = z.string().uuid().parse(params.id);
  return getOrCreateIdempotent(idk, "POST", `/sm/depositbundles/${id}/upload-slip`, async () => {
    const input = body.parse(await req.json());
    const updated = uploadSlip(id, input.url);
    if (!updated) return { status: 404, body: { error: "not_found", requestId } };
    return { status: 200, body: { depositBundle: updated, requestId } };
  }).then((r) => NextResponse.json(r.body, { status: r.status, headers: { "x-request-id": requestId } }));
}
