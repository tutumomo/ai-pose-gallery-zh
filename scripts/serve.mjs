#!/usr/bin/env node
// 自架伺服器：把本機 build 好的前端 + Worker 的兩個 API 端點，用一個 Node process 跑起來。
//
//   node scripts/serve.mjs            # → http://127.0.0.1:8789
//   PORT=9000 node scripts/serve.mjs
//
// 設計重點：
// 1. 素材（img / thumbs / data）直接從 repo 根目錄出，不做 1.1GB 拷貝；
//    只有前端程式碼需要 `pnpm build` 產生 dist/。
// 2. /api/proxy 與 /api/oauth/token 等同 Cloudflare 上的 functions/api/*，
//    所以自架版與線上版行為一致。
// 3. SPA fallback：未知路徑回 dist/index.html（TanStack Router 前端路由）。

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8789)
const HOSTS = (process.env.HOST || '127.0.0.1')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
const OAUTH_TOKEN_HOSTS = (process.env.OAUTH_TOKEN_HOSTS || '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length })
  res.end(buf)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------- 靜態檔案
function cacheHeadersFor(urlPath) {
  if (urlPath.startsWith('/img/') || urlPath.startsWith('/thumbs/')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  }
  if (urlPath.startsWith('/data/')) {
    return { 'Cache-Control': 'public, max-age=86400' }
  }
  if (urlPath.startsWith('/assets/')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  }
  return { 'Cache-Control': 'public, max-age=0, must-revalidate' }
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')
  if (!clean) return null

  // 素材優先從 repo 根目錄取（避免 dist/ 複製一份 1.1GB）
  if (clean.startsWith('img/') || clean.startsWith('thumbs/') || clean.startsWith('data/')) {
    const p = path.join(ROOT, clean)
    if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }

  const p = path.join(DIST, clean)
  if (p.startsWith(DIST) && fs.existsSync(p) && fs.statSync(p).isFile()) return p
  return null
}

function serveFile(res, filePath, urlPath, method) {
  const ext = path.extname(filePath).toLowerCase()
  const stat = fs.statSync(filePath)
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ...cacheHeadersFor(urlPath),
  }
  if (method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  fs.createReadStream(filePath).pipe(res)
}

function serveIndex(res) {
  const index = path.join(DIST, 'index.html')
  if (!fs.existsSync(index)) {
    json(res, 503, { error: { message: 'dist/ 尚未建置，請先執行 pnpm build' } })
    return
  }
  const buf = fs.readFileSync(index)
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=0, must-revalidate',
  })
  res.end(buf)
}

// ---------------------------------------------------------------- /api/proxy
async function handleProxy(req, res) {
  const targetUrl = req.headers['x-target-url']
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    json(res, 400, { error: { message: 'Missing or invalid x-target-url header' } })
    return
  }
  const forward = {}
  for (const key of ['content-type', 'authorization', 'x-goog-api-key', 'x-dashscope-async']) {
    const val = req.headers[key]
    if (val) forward[key] = val
  }
  const body = await readBody(req)
  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: forward,
      body: body.length ? body : undefined,
    })
    const text = await upstream.text()
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(text),
    })
    res.end(text)
  } catch (err) {
    json(res, 502, { error: { message: err.message } })
  }
}

// ------------------------------------------------------- /api/oauth/token
async function handleOAuthToken(req, res) {
  let payload
  try {
    payload = JSON.parse((await readBody(req)).toString('utf-8') || '{}')
  } catch {
    json(res, 400, { error: 'invalid_json', message: '请求体必须是 JSON' })
    return
  }
  const { tokenUrl, clientId, clientSecretEnv, tokenAuthStyle = 'body', form = {} } = payload
  if (!tokenUrl || !/^https:\/\//i.test(tokenUrl)) {
    json(res, 400, { error: 'invalid_token_url', message: 'tokenUrl 必须是 https 地址' })
    return
  }
  let target
  try {
    target = new URL(tokenUrl)
  } catch {
    json(res, 400, { error: 'invalid_token_url', message: 'tokenUrl 无法解析' })
    return
  }
  if (!OAUTH_TOKEN_HOSTS.includes(target.host.toLowerCase())) {
    json(res, 403, {
      error: 'token_host_not_allowed',
      message: `tokenUrl 主机 ${target.host} 不在 OAUTH_TOKEN_HOSTS 白名单内`,
    })
    return
  }
  const secret = clientSecretEnv ? process.env[clientSecretEnv] : undefined
  if (clientSecretEnv && !secret) {
    json(res, 400, { error: 'missing_client_secret', message: `环境变量 ${clientSecretEnv} 未设置` })
    return
  }
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) if (typeof v === 'string') body.set(k, v)
  if (clientId && !body.has('client_id')) body.set('client_id', clientId)
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  }
  if (secret) {
    if (tokenAuthStyle === 'basic') {
      headers.Authorization = `Basic ${Buffer.from(`${clientId || ''}:${secret}`).toString('base64')}`
    } else {
      body.set('client_secret', secret)
    }
  }
  try {
    const upstream = await fetch(target.toString(), { method: 'POST', headers, body })
    const text = await upstream.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = Object.fromEntries(new URLSearchParams(text).entries())
    }
    json(res, upstream.status, data)
  } catch (err) {
    json(res, 502, { error: 'upstream_error', message: err.message })
  }
}

// -------------------------------------------------------------------- 主體
const handler = async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0]

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'authorization,content-type,x-target-url',
    })
    res.end()
    return
  }

  if (urlPath === '/api/proxy' && req.method === 'POST') {
    await handleProxy(req, res)
    return
  }
  if (urlPath === '/api/oauth/token' && req.method === 'POST') {
    await handleOAuthToken(req, res)
    return
  }
  if (urlPath === '/api/health') {
    json(res, 200, { ok: true, dist: fs.existsSync(DIST), root: ROOT })
    return
  }

  const file = resolveFile(urlPath)
  if (file) {
    serveFile(res, file, urlPath, req.method)
    return
  }

  // SPA fallback：帶副檔名的路徑視為資源缺失，其餘回 index.html
  if (path.extname(urlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }
  serveIndex(res)
}

for (const host of HOSTS) {
http.createServer(handler).listen(PORT, host, () => {
  console.log(`pose gallery server  http://${host}:${PORT}`)
  console.log(`  static       dist/ + repo img|thumbs|data`)
  console.log(`  api          /api/proxy  /api/oauth/token  /api/health`)
  console.log(`  oauth hosts  ${OAUTH_TOKEN_HOSTS.length ? OAUTH_TOKEN_HOSTS.join(', ') : '(未設定 → 一律 403)'}`)
})
}
