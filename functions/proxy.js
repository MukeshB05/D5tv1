// Cloudflare Pages Function: /proxy?url=<encoded>[&referer=<encoded>]
// Fixes CORS + http:// mixed content for playlists and HLS streams.
// For .m3u8 manifests it rewrites every variant / segment / key URL to go through this proxy too.

const BLOCKED = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/i
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Expose-Headers': '*' }

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const self = new URL(request.url)
  const target = self.searchParams.get('url')
  if (!target) return new Response('missing url', { status: 400, headers: CORS })

  let t
  try { t = new URL(target) } catch { return new Response('bad url', { status: 400, headers: CORS }) }
  if (!/^https?:$/.test(t.protocol) || BLOCKED.test(t.hostname)) return new Response('blocked', { status: 403, headers: CORS })

  const referer = self.searchParams.get('referer')
  const headers = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36' }
  if (referer) headers.Referer = referer
  const range = request.headers.get('Range'); if (range) headers.Range = range

  const up = await fetch(t.toString(), { headers, redirect: 'follow' })
  const type = up.headers.get('content-type') || ''
  const isM3u8 = /mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(t.pathname + t.search)

  if (!isM3u8) {   // segments, keys, plain playlists: stream straight through
    const h = new Headers(CORS)
    for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) if (up.headers.get(k)) h.set(k, up.headers.get(k))
    return new Response(up.body, { status: up.status, headers: h })
  }

  const base = up.url || t.toString()
  const ref = referer ? '&referer=' + encodeURIComponent(referer) : ''
  const wrap = (u) => `${self.origin}/proxy?url=${encodeURIComponent(new URL(u, base).toString())}${ref}`
  const body = (await up.text()).split(/\r?\n/).map((line) => {
    if (!line.trim()) return line
    if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`)
    return wrap(line.trim())
  }).join('\n')
  return new Response(body, { status: up.status, headers: { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' } })
}
