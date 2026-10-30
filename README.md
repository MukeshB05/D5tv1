# d5tv-fixed

1. Replace `channels.m3u` with your playlist (keep the `#EXTINF ... group-title="..." tvg-language="..." tvg-logo="..."` lines),
   or edit `SOURCES` at the top of the script in `index.html` (URLs or `/channels.m3u`).
2. Deploy on Cloudflare Pages: build command: none, output directory: `/` (repo root). `functions/proxy.js` is picked up automatically.
3. Do NOT add a `/* /index.html 200` rule in `_redirects`: it makes `/channels.m3u` return the HTML page, which shows "0 channels".

How it works: each playlist and stream is tried directly first; if it fails (CORS, `http://` on an https site) it retries through `/proxy`.
Heads up: proxied streams count against the Cloudflare Pages Functions free limit (100k requests/day), so the proxy is only a fallback.
Only use playlists/streams you are allowed to use.
