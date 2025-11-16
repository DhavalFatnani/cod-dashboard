import { NextResponse } from "next/server";
import { listDeposits } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ deposits: listDeposits() });
}
