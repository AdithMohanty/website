import fs from "node:fs/promises";
import path from "node:path";

// Upstash Redis when configured (needed on Vercel), otherwise a file in .data/.
// Vercel's integration may add a prefix, e.g. STORAGE_KV_REST_API_URL.
function env(...suffixes: string[]) {
  for (const suffix of suffixes) {
    const key = Object.keys(process.env).find((k) => k === suffix || k.endsWith(`_${suffix}`));
    if (key && process.env[key]) return process.env[key];
  }
}

const url = env("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
const token = env("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");
const DATA_DIR = path.join(process.cwd(), ".data");

async function redis(command: string[]) {
  const res = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return ((await res.json()) as { result: string | null }).result;
}

export async function getValue<T>(key: string): Promise<T | null> {
  try {
    const raw = url && token
      ? await redis(["GET", key])
      : await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8");
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setValue(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  if (url && token) {
    await redis(["SET", key, raw]);
  } else if (process.env.VERCEL) {
    throw new Error(
      "No Upstash Redis database found. Connect one in Vercel (Storage tab), then redeploy."
    );
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, `${key}.json`), raw);
  }
}
