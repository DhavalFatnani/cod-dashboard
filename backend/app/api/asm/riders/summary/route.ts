export async function GET() {
  // Mock summary for now
  return Response.json({ riders: [], totals: { pending: 0, bundled: 0 } });
}
