// Vercel's storage integrations can add a prefix to variable names
// (e.g. STORAGE_BLOB_READ_WRITE_TOKEN), so match on the ending.
export function env(...names: string[]) {
  for (const name of names) {
    const key = Object.keys(process.env).find((k) => k === name || k.endsWith(`_${name}`));
    if (key && process.env[key]) return process.env[key];
  }
}
