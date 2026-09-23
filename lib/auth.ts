import { timingSafeEqual } from "node:crypto";

// Requests from your phone/laptop carry `Authorization: Bearer <LOCATION_SECRET>`.
export function isAuthorized(req: Request) {
  const secret = process.env.LOCATION_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
