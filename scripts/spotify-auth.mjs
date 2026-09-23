// Gets a Spotify refresh token and saves it to .env.local.
// Needs redirect URI http://127.0.0.1:8888/callback on the Spotify app.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");
const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SCOPES = "user-read-currently-playing user-read-playback-state";

function readEnv() {
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function writeEnvValue(key, value) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  fs.writeFileSync(ENV_FILE, text);
}

const env = readEnv();
const clientId = env.SPOTIFY_CLIENT_ID;
const clientSecret = env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const authUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT_URI);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.end(`Spotify returned an error: ${url.searchParams.get("error")}`);
    return;
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
  });
  const data = await tokenRes.json();

  if (!data.refresh_token) {
    res.end("Could not get a refresh token. Check the terminal.");
    console.error(data);
  } else {
    writeEnvValue("SPOTIFY_REFRESH_TOKEN", data.refresh_token);
    res.end("Done! Saved to .env.local. You can close this tab.");
    console.log("Saved SPOTIFY_REFRESH_TOKEN to .env.local. Restart the dev server to pick it up.");
  }
  server.close();
});

server.listen(8888, "127.0.0.1", () => {
  console.log("Open this link and approve access:\n\n" + authUrl + "\n");
});
