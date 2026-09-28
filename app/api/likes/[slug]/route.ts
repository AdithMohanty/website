import { cookies } from "next/headers";
import { getPost } from "@/lib/posts";
import { setHas, setSize, setToggle } from "@/lib/store";

// Each visitor gets a random id in a cookie; a post's likes are the set of
// ids that liked it, so the same visitor can only ever count once.
const COOKIE = "visitor";

type Ctx = { params: Promise<{ slug: string }> };

async function likes(slug: string, visitor: string | undefined) {
  const key = `likes-${slug}`;
  return {
    count: await setSize(key),
    liked: visitor ? await setHas(key, visitor) : false,
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!getPost(slug)) return Response.json({ error: "Not found" }, { status: 404 });
  const jar = await cookies();
  return Response.json(await likes(slug, jar.get(COOKIE)?.value), {
    headers: { "Cache-Control": "no-store" },
  });
}

// Body { liked: boolean } — like or unlike.
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!getPost(slug)) return Response.json({ error: "Not found" }, { status: 404 });

  const jar = await cookies();
  let visitor = jar.get(COOKIE)?.value;
  if (!visitor) {
    visitor = crypto.randomUUID();
    jar.set(COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 5,
      path: "/",
    });
  }

  try {
    const { liked } = (await req.json()) as { liked?: unknown };
    await setToggle(`likes-${slug}`, visitor, liked === true);
    return Response.json(await likes(slug, visitor));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
