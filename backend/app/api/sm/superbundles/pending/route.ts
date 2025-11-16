import { NextResponse } from "next/server";
import { listPendingSuperbundles } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ superbundles: listPendingSuperbundles() });
}
