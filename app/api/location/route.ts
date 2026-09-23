import { timingSafeEqual } from "node:crypto";
import { getPublicLocation, saveLocation } from "@/lib/location";

export async function GET() {
  return Response.json(await getPublicLocation(), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

function authorized(req: Request) {
  const secret = process.env.LOCATION_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

// Sent by the phone shortcut: Authorization: Bearer <LOCATION_SECRET>,
// body { city, region, lat, lon }.
export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const loc = await saveLocation(body);
    return Response.json({ ok: true, city: loc.city });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
