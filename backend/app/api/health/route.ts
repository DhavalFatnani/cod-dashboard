export async function GET() {
  return Response.json({ ok: true, service: "backend", time: new Date().toISOString() });
}
