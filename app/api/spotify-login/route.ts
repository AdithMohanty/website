// Sends a listener through Spotify's login and back to the visualizer, so the
// listen-along player plays full songs instead of previews. Logging in signs
// the browser in to Spotify, which is all the player needs: the code Spotify
// sends back is never exchanged, and no token is kept.
//
// This URL (on each domain the site runs on) must be listed as a redirect URI
// in the Spotify app's dashboard. Spotify doesn't allow "localhost" there, so
// try it locally at http://127.0.0.1:3000.
export function GET(req: Request) {
  const url = new URL(req.url);
  const back = new URL("/visualizer", url.origin);

  // Back from Spotify: logged in, or they turned it down.
  if (url.searchParams.has("code") || url.searchParams.has("error")) {
    if (url.searchParams.has("code")) back.searchParams.set("listen", "1");
    return Response.redirect(back, 303);
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) return Response.redirect(back, 303);
  const login = new URL("https://accounts.spotify.com/authorize");
  login.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${url.origin}/api/spotify-login`,
  }).toString();
  return Response.redirect(login, 303);
}
