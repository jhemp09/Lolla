/**
 * Best-effort link to Spotify for a band, since we don't store (and can't safely look up
 * client-side) each artist's actual Spotify ID — doing that precisely would need a real API
 * call authenticated with a client secret, which has to live behind a server, not in this
 * static app. A search link opens the Spotify app if it's installed (falls back to the web
 * player otherwise) and lands on search results with the artist almost always the top hit —
 * one tap from their actual page, just not automatic.
 */
export function spotifySearchUrl(bandName: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(bandName)}`;
}
